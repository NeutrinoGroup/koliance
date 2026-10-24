package market

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// This file replaces `oracle_pyth.go`, and the rename is the point.
//
// The old file was named for Pyth, its DTO was named `PythPriceData`, and it
// advertised `FeedID: "alpaca_us_equity"` — while its only HTTP call went to
// data.alpaca.markets. Nothing in it ever touched Pyth. A file name is weaker
// evidence than an import, and this one was actively wrong: anyone scheduling
// work from the file list would budget for a Pyth integration that did not
// exist (the repo's own `docs/planning/执行记录-Phase0.md` records that
// misreading). The DTO name is kept only because the JSON keys are pinned by
// the frontend contract; see GAP-52.

// DefaultAlpacaDataURL is Alpaca's market-data host. It is NOT the trading host
// in ALPACA_BASE_URL: different hostname, different API, same credentials.
const DefaultAlpacaDataURL = "https://data.alpaca.markets"

// DefaultDataFeed is the market data feed. `iex` is the one included with
// Alpaca's paper tier; `sip` requires a paid subscription and returns 403
// otherwise, so the default is the one that works out of the box.
const DefaultDataFeed = "iex"

// SourceAlpacaBars names the live source in every response derived from it.
// It is deliberately not spelled "pyth": see the file header.
const SourceAlpacaBars = "alpaca_daily_bars"

// DefaultSymbols is the instrument set the market page shows. Order is
// irrelevant — every list is sorted before it leaves the package.
const DefaultSymbols = "NVDA,AAPL,TSLA,SPY"

// AlpacaBar is one bar from /v2/stocks/bars.
type AlpacaBar struct {
	T time.Time `json:"t"`
	O float64   `json:"o"`
	H float64   `json:"h"`
	L float64   `json:"l"`
	C float64   `json:"c"`
	V int64     `json:"v"`
}

// alpacaBarsPage models the subset of /v2/stocks/bars this package consumes.
// Bars is keyed by symbol and is a JSON object, not an array — which is why
// every consumer of it must sort explicitly (Go randomises map iteration).
type alpacaBarsPage struct {
	Bars          map[string][]AlpacaBar `json:"bars"`
	NextPageToken string                 `json:"next_page_token"`
}

// SymbolBarsDTO models real historical bars for a symbol from Alpaca.
type SymbolBarsDTO struct {
	Symbol     string    `json:"symbol"`
	Timeframe  string    `json:"timeframe"`
	Timestamps []int64   `json:"timestamps"`
	Closes     []float64 `json:"closes"`
	Source     string    `json:"source"`
	Synthetic  bool      `json:"synthetic"`
}

// PriceOracle reads real Alpaca daily bars and derives the numbers the market
// page needs: latest price and change over the most recent session.
type PriceOracle struct {
	baseURL    string
	feed       string
	symbols    []string
	keyID      string
	secretKey  string
	httpClient *http.Client
}

func NewPriceOracle(keyID, secretKey string) *PriceOracle {
	return &PriceOracle{
		baseURL:   DefaultAlpacaDataURL,
		feed:      DefaultDataFeed,
		symbols:   strings.Split(DefaultSymbols, ","),
		keyID:     strings.TrimSpace(keyID),
		secretKey: strings.TrimSpace(secretKey),
		httpClient: &http.Client{
			// Two round trips' worth of budget; the demo tolerates a slow quote
			// far better than it tolerates a hanging request.
			Timeout: 8 * time.Second,
		},
	}
}

// SetDataBaseURL points the oracle at another host (tests use an httptest
// server; a deployment can point at a private feed host).
func (p *PriceOracle) SetDataBaseURL(u string) {
	if s := strings.TrimRight(strings.TrimSpace(u), "/"); s != "" {
		p.baseURL = s
	}
}

// SetFeed overrides the data feed (`iex` / `sip` / `delayed_sip` / `otc`).
func (p *PriceOracle) SetFeed(f string) {
	if s := strings.TrimSpace(f); s != "" {
		p.feed = s
	}
}

// SetSymbols overrides the tracked instrument set.
func (p *PriceOracle) SetSymbols(symbols []string) {
	clean := make([]string, 0, len(symbols))
	for _, s := range symbols {
		if s = strings.ToUpper(strings.TrimSpace(s)); s != "" {
			clean = append(clean, s)
		}
	}
	if len(clean) > 0 {
		p.symbols = clean
	}
}

// SetHTTPClient replaces the HTTP client (test injection, the same idiom
// game.Service already uses for its Steam client).
func (p *PriceOracle) SetHTTPClient(hc *http.Client) {
	if hc != nil {
		p.httpClient = hc
	}
}

// Configured reports whether credentials are present.
func (p *PriceOracle) Configured() bool {
	return p.keyID != "" && p.secretKey != ""
}

// Symbols returns a copy of the tracked instrument set.
func (p *PriceOracle) Symbols() []string {
	out := make([]string, len(p.symbols))
	copy(out, p.symbols)
	return out
}

// PythPriceData is the price DTO the frontend consumes. The name is a
// historical artefact of `oracle_pyth.go` (see file header): every field here
// is sourced from Alpaca. The JSON keys cannot change without a frontend
// change, so the misleading Go name is the cheaper of the two costs (GAP-52).
type PythPriceData struct {
	Symbol     string    `json:"symbol"`
	FeedID     string    `json:"feedId"`
	Price      float64   `json:"price"`
	Confidence float64   `json:"confidence"`
	UpdatedAt  time.Time `json:"updatedAt"`

	// PreviousClose / Change / ChangePercent are derived from the two most
	// recent daily bars in the same request (issue #16: 涨跌幅).
	PreviousClose float64 `json:"previousClose"`
	Change        float64 `json:"change"`
	ChangePercent float64 `json:"changePercent"`

	// Source / Synthetic make the provenance machine-readable, mirroring the
	// frontend route's fields (`src/app/api/market/route.ts`) so both halves of
	// the market page can be checked the same way.
	Source    string `json:"source"`
	Synthetic bool   `json:"synthetic"`
}

// ErrNoMarketData is returned when the upstream answered but has no bar for the
// requested symbol. It is not an error about the exchange being closed: an
// absent bar means "we have no observation", which is exactly the case that
// must never be filled in with a plausible-looking number.
var ErrNoMarketData = errors.New("no market data")

// PriceChange fetches the two most recent daily bars for each symbol and
// derives its change over the most recent session.
//
// Why /v2/stocks/bars with limit=2 rather than /v2/stocks/bars/latest: a change
// is a difference of two observations, and Alpaca's bar object carries no
// previous-close field. One request for two bars beats two requests for one.
// Asking for two also keeps both ends of the subtraction from the same
// snapshot, so a change can never be computed across a stale/fresh mismatch.
func (p *PriceOracle) PriceChange(ctx context.Context, symbols []string) ([]InstrumentChange, error) {
	if !p.Configured() {
		return nil, ErrAlpacaCredentialsMissing
	}
	want := symbols
	if len(want) == 0 {
		want = p.symbols
	}
	if len(want) == 0 {
		return nil, fmt.Errorf("market: no symbols requested and none configured")
	}

	limit := 2
	if len(want) > 1 {
		limit = 100
	}

	// Calculate a 7-day lookback window start date (YYYY-MM-DD).
	// Alpaca /v2/stocks/bars defaults start to 00:00:00 UTC of today if omitted,
	// which returns empty bars on weekends (Saturday, Sunday) and holidays.
	// Providing a 7-day start window guarantees that the latest sessions
	// (e.g. Friday and Thursday close) are always returned regardless of weekday/weekend.
	startWindow := time.Now().UTC().AddDate(0, 0, -7).Format("2006-01-02")

	q := url.Values{}
	q.Set("symbols", strings.Join(want, ","))
	q.Set("timeframe", "1Day")
	q.Set("limit", strconv.Itoa(limit))
	q.Set("sort", "desc")
	q.Set("feed", p.feed)
	q.Set("start", startWindow)

	allBars := make(map[string][]AlpacaBar)
	pageToken := ""

	// Page up to 5 times if Alpaca paginated and some requested symbols are still missing bars
	for pageIdx := 0; pageIdx < 5; pageIdx++ {
		if pageToken != "" {
			q.Set("page_token", pageToken)
		} else {
			q.Del("page_token")
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/v2/stocks/bars?"+q.Encode(), nil)
		if err != nil {
			return nil, fmt.Errorf("market: build bars request: %w", err)
		}
		req.Header.Set("APCA-API-KEY-ID", p.keyID)
		req.Header.Set("APCA-API-SECRET-KEY", p.secretKey)
		req.Header.Set("Accept", "application/json")

		resp, err := p.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("market: alpaca bars: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			raw, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
			resp.Body.Close()
			return nil, fmt.Errorf("market: alpaca bars status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
		}

		var page alpacaBarsPage
		decodeErr := json.NewDecoder(resp.Body).Decode(&page)
		resp.Body.Close()
		if decodeErr != nil {
			return nil, fmt.Errorf("market: decode alpaca bars: %w", decodeErr)
		}

		for k, bars := range page.Bars {
			allBars[strings.ToUpper(k)] = append(allBars[strings.ToUpper(k)], bars...)
		}

		// Check if we already have bars for all requested symbols
		allFound := true
		for _, sym := range want {
			if len(allBars[strings.ToUpper(sym)]) < 2 {
				allFound = false
				break
			}
		}

		if allFound || page.NextPageToken == "" {
			break
		}
		pageToken = page.NextPageToken
	}

	out := make([]InstrumentChange, 0, len(want))
	for _, sym := range want {
		// A symbol with no bars is reported as unranked rather than dropped, so
		// "we asked and got nothing" stays distinguishable from "we did not ask".
		out = append(out, changeForSymbol(strings.ToUpper(sym), allBars[strings.ToUpper(sym)]))
	}
	return out, nil
}

// changeForSymbol derives one instrument's change from its bars.
//
// The latest/previous pair is picked by timestamp rather than by position:
// `sort=desc` is what the request asks for, but a change computed on an
// assumed ordering would be silently wrong if the upstream ever returned
// ascending bars. Ordering here is checked, not assumed.
func changeForSymbol(symbol string, bars []AlpacaBar) InstrumentChange {
	change := InstrumentChange{Symbol: symbol, Currency: "USD", Source: SourceAlpacaBars, Synthetic: false}
	if len(bars) == 0 {
		change.Unranked = true
		return change
	}

	latest := bars[0]
	for _, b := range bars[1:] {
		if b.T.After(latest.T) {
			latest = b
		}
	}
	change.Price = round2(latest.C)
	change.AsOf = latest.T.UTC()

	var prev *AlpacaBar
	for i := range bars {
		if !bars[i].T.Before(latest.T) || bars[i].T.IsZero() {
			continue // same bar, or a malformed one
		}
		if prev == nil || bars[i].T.After(prev.T) {
			prev = &bars[i]
		}
	}
	if prev == nil || prev.C <= 0 {
		// No previous close: the change is unknown, and unknown is not zero.
		// RankMovers keeps these out of every bucket.
		change.Unranked = true
		return change
	}

	change.PreviousClose = round2(prev.C)
	// Percent from the rounded change: see round2's comment.
	change.Change = round2(change.Price - change.PreviousClose)
	change.ChangePercent = round4(change.Change / change.PreviousClose * 100)
	return change
}

// LatestPrice returns the price and change for one symbol.
func (p *PriceOracle) LatestPrice(ctx context.Context, symbol string) (*PythPriceData, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	if symbol == "" {
		return nil, fmt.Errorf("%w: empty symbol", ErrNoMarketData)
	}
	changes, err := p.PriceChange(ctx, []string{symbol})
	if err != nil {
		return nil, err
	}
	if len(changes) == 0 || changes[0].Price <= 0 {
		return nil, fmt.Errorf("%w: %s", ErrNoMarketData, symbol)
	}
	dto := changes[0].ToPriceDTO()
	return &dto, nil
}

// PriceList returns the tracked instruments' prices, sorted by symbol so the
// order does not change between two identical requests.
func (p *PriceOracle) PriceList(ctx context.Context) ([]PythPriceData, error) {
	changes, err := p.PriceChange(ctx, nil)
	if err != nil {
		return nil, err
	}
	SortBySymbol(changes)

	out := make([]PythPriceData, 0, len(changes))
	for _, c := range changes {
		if c.Price <= 0 {
			continue // no observation: report nothing rather than a zero price
		}
		out = append(out, c.ToPriceDTO())
	}
	return out, nil
}

// ToPriceDTO converts the internal change record into the wire DTO.
func (c InstrumentChange) ToPriceDTO() PythPriceData {
	return PythPriceData{
		Symbol:        c.Symbol,
		FeedID:        c.Source,
		Price:         c.Price,
		Confidence:    0, // Alpaca publishes no confidence interval; the old 0.01 was invented
		UpdatedAt:     c.AsOf,
		PreviousClose: c.PreviousClose,
		Change:        c.Change,
		ChangePercent: c.ChangePercent,
		Source:        c.Source,
		Synthetic:     c.Synthetic,
	}
}

// Derived numbers are rounded at the edge, not in the middle, and the percent
// is computed from the already-rounded change so the two fields agree exactly:
// `change / previousClose * 100 == changePercent` is checkable by a reader of
// the JSON, which it would not be if each field were rounded independently.
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}

// mapRangeToAlpacaParams maps requested timeframe range to Alpaca /v2/stocks/bars query parameters.
func mapRangeToAlpacaParams(rangeParam string) (timeframe string, start string, limit int) {
	now := time.Now().UTC()
	switch strings.ToLower(strings.TrimSpace(rangeParam)) {
	case "1d":
		// 15-minute intraday bars over the last 3 days to guarantee coverage across weekends/holidays.
		return "15Min", now.AddDate(0, 0, -3).Format("2006-01-02"), 100
	case "5d":
		// 1-hour bars over the last 7 days.
		return "1Hour", now.AddDate(0, 0, -7).Format("2006-01-02"), 100
	case "1y":
		// Daily bars over the last 370 days.
		return "1Day", now.AddDate(-1, 0, -5).Format("2006-01-02"), 365
	case "1mo", "":
		fallthrough
	default:
		// Daily bars over the last 35 days (1 month).
		return "1Day", now.AddDate(0, -1, -5).Format("2006-01-02"), 50
	}
}

// GetBars queries Alpaca for real historical bars of a symbol across the requested range.
func (p *PriceOracle) GetBars(ctx context.Context, symbol, rangeParam string) (*SymbolBarsDTO, error) {
	if !p.Configured() {
		return nil, ErrAlpacaCredentialsMissing
	}
	sym := strings.ToUpper(strings.TrimSpace(symbol))
	if sym == "" {
		return nil, fmt.Errorf("%w: empty symbol", ErrNoMarketData)
	}

	timeframe, startWindow, limit := mapRangeToAlpacaParams(rangeParam)

	q := url.Values{}
	q.Set("symbols", sym)
	q.Set("timeframe", timeframe)
	q.Set("limit", strconv.Itoa(limit))
	q.Set("sort", "asc")
	q.Set("feed", p.feed)
	q.Set("start", startWindow)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/v2/stocks/bars?"+q.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("market: build bars request: %w", err)
	}
	req.Header.Set("APCA-API-KEY-ID", p.keyID)
	req.Header.Set("APCA-API-SECRET-KEY", p.secretKey)
	req.Header.Set("Accept", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("market: alpaca bars: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("market: alpaca bars status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var page alpacaBarsPage
	if err := json.NewDecoder(resp.Body).Decode(&page); err != nil {
		return nil, fmt.Errorf("market: decode alpaca bars: %w", err)
	}

	var rawBars []AlpacaBar
	for k, v := range page.Bars {
		if strings.EqualFold(k, sym) {
			rawBars = v
			break
		}
	}
	if len(rawBars) == 0 {
		return nil, fmt.Errorf("%w: %s", ErrNoMarketData, sym)
	}

	timestamps := make([]int64, len(rawBars))
	closes := make([]float64, len(rawBars))
	for i, b := range rawBars {
		timestamps[i] = b.T.Unix()
		closes[i] = round2(b.C)
	}

	return &SymbolBarsDTO{
		Symbol:     sym,
		Timeframe:  timeframe,
		Timestamps: timestamps,
		Closes:     closes,
		Source:     SourceAlpacaBars,
		Synthetic:  false,
	}, nil
}
