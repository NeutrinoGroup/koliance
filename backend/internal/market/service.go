package market

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/koliance/backend/internal/platform/database"
)

type Service struct {
	alpaca *AlpacaClient
	oracle *PriceOracle
	db     *database.DB
}

func NewService(alpaca *AlpacaClient, oracle *PriceOracle, db *database.DB) *Service {
	return &Service{
		alpaca: alpaca,
		oracle: oracle,
		db:     db,
	}
}

type MarketOverview struct {
	Account   *AlpacaAccount   `json:"account"`
	Positions []AlpacaPosition `json:"positions"`
	Prices    []PythPriceData  `json:"realtimePrices"`
	// Movers is ranked from the same rows as Prices, so publishing the ranking
	// costs no extra upstream request. Zero value when the upstream had nothing.
	Movers Movers `json:"movers"`
}

type TradeRequest struct {
	Symbol      string  `json:"symbol"`
	Side        string  `json:"side"`        // "buy" (Long) or "sell" (Short)
	NotionalUSD float64 `json:"notionalUSD"` // Target trade volume
	Leverage    float64 `json:"leverage"`    // 1x to 4x
}

type TradeResult struct {
	Success     bool         `json:"success"`
	Order       *AlpacaOrder `json:"order,omitempty"`
	Message     string       `json:"message"`
	Symbol      string       `json:"symbol"`
	Side        string       `json:"side"`
	NotionalUSD float64      `json:"notionalUSD"`
}

// DataHealth is the market data subsystem's own health, as opposed to the
// process's. It is reported by /api/v1/market/health and folded into /health.
type DataHealth struct {
	// Configured is false when credentials are absent. It is not an error: it is
	// the reason every other field is empty.
	Configured  bool         `json:"configured"`
	Alpaca      AlpacaHealth `json:"alpaca"`
	PriceOracle OracleHealth `json:"priceOracle"`
	Source      string       `json:"source"`
	Synthetic   bool         `json:"synthetic"`
}

// AlpacaHealth mirrors the trading client's last observed call.
type AlpacaHealth struct {
	Observed    bool   `json:"observed"`
	OK          bool   `json:"ok"`
	LastError   string `json:"lastError,omitempty"`
	LastSuccess string `json:"lastSuccess,omitempty"`
}

// OracleHealth is the outcome of a live market-data read performed by the
// probe itself (not a cached state), so `instruments: 0` cannot be confused
// with "we never asked".
type OracleHealth struct {
	OK          bool     `json:"ok"`
	Error       string   `json:"error,omitempty"`
	Symbols     []string `json:"symbols"`
	Instruments int      `json:"instruments"`
	LatestBar   string   `json:"latestBar,omitempty"`
}

// GetMarketOverview returns the account, its positions and real prices.
//
// Positions and prices are best-effort: a failure in either is recorded on the
// client (and therefore visible in DataHealth) but does not erase the account
// view the page is built around. The account itself is required — without it
// the overview has nothing to say, and pretending otherwise is the failure mode
// this whole change is about.
func (s *Service) GetMarketOverview(ctx context.Context) (*MarketOverview, error) {
	acc, err := s.alpaca.GetAccount(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch alpaca account: %w", err)
	}

	positions, _ := s.alpaca.GetPositions(ctx)
	prices, _ := s.oracle.PriceList(ctx)

	return &MarketOverview{
		Account:   acc,
		Positions: positions,
		Prices:    prices,
		Movers:    MoversFromPrices(prices),
	}, nil
}

// GetMovers returns the ranked movers (issue #16). It returns an error rather
// than an empty board when the upstream is unreachable, so a caller cannot
// mistake "market data is down" for "nothing moved".
func (s *Service) GetMovers(ctx context.Context) (Movers, error) {
	changes, err := s.oracle.PriceChange(ctx, nil)
	if err != nil {
		return Movers{}, err
	}
	return RankMovers(changes), nil
}

// GetDataHealth probes the price upstream once and reports what it observed.
// Never returns a fabricated success: an unconfigured credential set is
// reported as Configured=false with OK=false.
func (s *Service) GetDataHealth(ctx context.Context) DataHealth {
	h := DataHealth{Configured: s.oracle.Configured(), Source: SourceAlpacaBars, Synthetic: false}
	h.PriceOracle.Symbols = s.oracle.Symbols()

	state := s.alpaca.Health()
	h.Alpaca = AlpacaHealth{
		Observed:  state.Observed,
		OK:        state.OK,
		LastError: state.LastError,
	}
	if !state.LastSuccess.IsZero() {
		h.Alpaca.LastSuccess = state.LastSuccess.Format(time.RFC3339)
	}

	changes, err := s.oracle.PriceChange(ctx, nil)
	if err != nil {
		h.PriceOracle.OK = false
		h.PriceOracle.Error = err.Error()
		return h
	}

	h.PriceOracle.OK = true
	var latest time.Time
	for _, c := range changes {
		if c.Price > 0 {
			h.PriceOracle.Instruments++
			if c.AsOf.After(latest) {
				latest = c.AsOf
			}
		}
	}
	if !latest.IsZero() {
		h.PriceOracle.LatestBar = latest.Format(time.RFC3339)
	}
	if h.PriceOracle.Instruments == 0 {
		// HTTP 200 with an empty payload is not health. This is the branch that
		// separates "the API answered" from "we have data".
		h.PriceOracle.OK = false
		h.PriceOracle.Error = "alpaca returned no bars for the configured symbols"
	}
	return h
}

func (s *Service) ExecuteTrade(ctx context.Context, req TradeRequest) (*TradeResult, error) {
	if req.NotionalUSD <= 0 {
		return &TradeResult{Success: false, Message: "Notional USD must be greater than zero"}, nil
	}

	effectiveNotional := req.NotionalUSD
	if req.Leverage > 1 {
		effectiveNotional = req.NotionalUSD * req.Leverage
	}

	// Format notional to 2 decimal places string
	notionalStr := strconv.FormatFloat(effectiveNotional, 'f', 2, 64)

	order, err := s.alpaca.CreateOrder(ctx, OrderRequest{
		Symbol:      req.Symbol,
		Notional:    notionalStr,
		Side:        req.Side,
		Type:        "market",
		TimeInForce: "day",
	})
	if err != nil {
		return &TradeResult{
			Success:     false,
			Message:     err.Error(),
			Symbol:      req.Symbol,
			Side:        req.Side,
			NotionalUSD: effectiveNotional,
		}, fmt.Errorf("place order: %w", err)
	}

	return &TradeResult{
		Success:     true,
		Order:       order,
		Message:     fmt.Sprintf("Order placed successfully for %s (%s, %.0fx leverage: $%.2f notional with $%.2f margin)", req.Symbol, req.Side, req.Leverage, effectiveNotional, req.NotionalUSD),
		Symbol:      req.Symbol,
		Side:        req.Side,
		NotionalUSD: effectiveNotional,
	}, nil
}

func (s *Service) ClosePosition(ctx context.Context, symbol string) error {
	return s.alpaca.ClosePosition(ctx, symbol)
}

func (s *Service) GetPrice(ctx context.Context, symbol string) (*PythPriceData, error) {
	return s.oracle.LatestPrice(ctx, symbol)
}

func (s *Service) GetBars(ctx context.Context, symbol, rangeParam string) (*SymbolBarsDTO, error) {
	return s.oracle.GetBars(ctx, symbol, rangeParam)
}
