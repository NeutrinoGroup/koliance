package market

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// ==================== RANKING (issue #16) ====================

func change(symbol string, pct float64) InstrumentChange {
	prev := 100.0
	price := prev * (1 + pct/100)
	return InstrumentChange{
		Symbol:        symbol,
		Price:         price,
		PreviousClose: prev,
		Change:        price - prev,
		ChangePercent: pct,
		AsOf:          time.Date(2026, 10, 9, 20, 0, 0, 0, time.UTC),
		Currency:      "USD",
		Source:        SourceAlpacaBars,
	}
}

func symbolsOf(rows []InstrumentChange) []string {
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.Symbol)
	}
	return out
}

func TestRankMoversSplitsGainersLosersAndUnchanged(t *testing.T) {
	m := RankMovers([]InstrumentChange{
		change("NVDA", 3.14),
		change("AAPL", 0),
		change("TSLA", -1.22),
	})

	if got, want := fmt.Sprint(symbolsOf(m.Gainers)), "[NVDA]"; got != want {
		t.Errorf("gainers = %v, want %v", got, want)
	}
	if got, want := fmt.Sprint(symbolsOf(m.Losers)), "[TSLA]"; got != want {
		t.Errorf("losers = %v, want %v", got, want)
	}
	if got, want := fmt.Sprint(symbolsOf(m.Unchanged)), "[AAPL]"; got != want {
		t.Errorf("unchanged = %v, want %v", got, want)
	}
	if m.UnrankedCount != 0 {
		t.Errorf("unrankedCount = %d, want 0", m.UnrankedCount)
	}
	if m.Synthetic {
		t.Error("movers of real bars must not be flagged synthetic")
	}
	if m.Source != SourceAlpacaBars {
		t.Errorf("source = %q, want %q", m.Source, SourceAlpacaBars)
	}
	if !m.AsOf.Equal(time.Date(2026, 10, 9, 20, 0, 0, 0, time.UTC)) {
		t.Errorf("asOf = %v", m.AsOf)
	}
}

// The leaderboard must read the right way round at BOTH ends: the biggest gain
// first in gainers, the biggest loss first in losers. An implementation that
// sorts once and shares the slice passes the gainers assertion and silently
// reverses the losers board.
func TestRankMoversOrdersBothEnds(t *testing.T) {
	m := RankMovers([]InstrumentChange{
		change("A", 1.0),
		change("B", 9.5),
		change("C", 4.2),
		change("D", -0.5),
		change("E", -7.7),
		change("F", -2.2),
	})

	if got, want := fmt.Sprint(symbolsOf(m.Gainers)), "[B C A]"; got != want {
		t.Errorf("gainers order = %v, want %v", got, want)
	}
	if got, want := fmt.Sprint(symbolsOf(m.Losers)), "[E F D]"; got != want {
		t.Errorf("losers order = %v, want %v (biggest loss first)", got, want)
	}
}

// The upstream payload is a JSON object keyed by symbol, so its Go form is a
// map: the rows reach this function in an order that changes between calls. A
// ranking that inherits that order reshuffles itself between two identical
// requests, which is the one thing a leaderboard must never do.
//
// The input here is rebuilt from a map on every round for exactly that reason.
// An earlier version of this test sorted a fixed slice 50 times — which proves
// nothing, because sort.Slice is deterministic for a fixed input: it would pass
// against an implementation with no tie-break at all.
func TestRankMoversIsStableWhenTheInputOrderChanges(t *testing.T) {
	source := map[string]InstrumentChange{
		"ZZZZ": change("ZZZZ", 2.0),
		"AAAA": change("AAAA", 2.0),
		"MMMM": change("MMMM", 2.0),
		"BBBB": change("BBBB", -2.0),
		"YYYY": change("YYYY", -2.0),
	}

	var want string
	for round := 0; round < 50; round++ {
		in := make([]InstrumentChange, 0, len(source))
		for _, c := range source { // map iteration is randomised per round
			in = append(in, c)
		}
		m := RankMovers(in)
		got := fmt.Sprint(symbolsOf(m.Gainers)) + "|" + fmt.Sprint(symbolsOf(m.Losers))
		if round == 0 {
			want = got
			continue
		}
		if got != want {
			t.Fatalf("round %d: ordering changed with input order\n want %s\n  got %s", round, want, got)
		}
	}
	if want != "[AAAA MMMM ZZZZ]|[YYYY BBBB]" {
		t.Errorf("ordering = %s, want the symbol tie-break at both ends", want)
	}
}

// "Did not move" and "we cannot tell whether it moved" are different facts.
// Collapsing an unknown change into 0% would put an instrument in `unchanged`
// on the strength of a missing previous close.
func TestRankMoversKeepsUnknownChangesOutOfUnchanged(t *testing.T) {
	unknown := InstrumentChange{Symbol: "NEW", Price: 42, Source: SourceAlpacaBars, Unranked: true}
	noPrevClose := InstrumentChange{Symbol: "NOPREV", Price: 42, Source: SourceAlpacaBars}
	flat := change("FLAT", 0)

	m := RankMovers([]InstrumentChange{unknown, noPrevClose, flat})

	if m.UnrankedCount != 2 {
		t.Errorf("unrankedCount = %d, want 2", m.UnrankedCount)
	}
	if got, want := fmt.Sprint(symbolsOf(m.Unchanged)), "[FLAT]"; got != want {
		t.Errorf("unchanged = %v, want %v", got, want)
	}
}

func TestRankMoversEmptyInputSerialisesAsArrays(t *testing.T) {
	// An empty board must be `[]`, not `null`: a frontend that maps over it
	// should not have to special-case the empty case.
	raw, err := json.Marshal(RankMovers(nil))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	for _, key := range []string{`"gainers":[]`, `"losers":[]`, `"unchanged":[]`} {
		if !strings.Contains(string(raw), key) {
			t.Errorf("missing %s in %s", key, raw)
		}
	}
}

func TestMoversFromPricesCarriesProvenancePerRow(t *testing.T) {
	m := MoversFromPrices([]PythPriceData{
		{Symbol: "NVDA", Price: 150, PreviousClose: 100, Change: 50, ChangePercent: 50, Source: SourceAlpacaBars, UpdatedAt: time.Now()},
	})
	if len(m.Gainers) != 1 || m.Gainers[0].Currency != "USD" {
		t.Fatalf("gainers = %+v", m.Gainers)
	}
	if m.Gainers[0].Synthetic {
		t.Error("row flagged synthetic")
	}
}

// ==================== REAL ALPACA PARSING ====================

// alpacaStub stands in for data.alpaca.markets. It is the only way to test a
// change calculation without credentials, and it lets the payload be shaped
// exactly like the real one (bars keyed by symbol, descending).
func alpacaStub(t *testing.T, body string, status int, assert func(*http.Request)) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if assert != nil {
			assert(r)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func newStubOracle(t *testing.T, srv *httptest.Server, symbols []string) *PriceOracle {
	t.Helper()
	o := NewPriceOracle("key-id", "secret")
	o.SetDataBaseURL(srv.URL)
	o.SetSymbols(symbols)
	return o
}

func TestPriceOracleDerivesChangeFromTwoDailyBars(t *testing.T) {
	body := `{"bars":{
		"NVDA":[
			{"t":"2026-10-09T04:00:00Z","o":148,"h":152,"l":147,"c":150.5,"v":1000},
			{"t":"2026-10-08T04:00:00Z","o":140,"h":145,"l":139,"c":140.0,"v":900}
		],
		"AAPL":[
			{"t":"2026-10-09T04:00:00Z","o":230,"h":232,"l":228,"c":228.0,"v":800},
			{"t":"2026-10-08T04:00:00Z","o":236,"h":238,"l":234,"c":240.0,"v":700}
		]
	}}`
	var gotQuery string
	srv := alpacaStub(t, body, http.StatusOK, func(r *http.Request) {
		gotQuery = r.URL.RawQuery
		if r.Header.Get("APCA-API-KEY-ID") != "key-id" || r.Header.Get("APCA-API-SECRET-KEY") != "secret" {
			t.Errorf("credentials missing from upstream request: %v", r.Header)
		}
	})

	o := newStubOracle(t, srv, []string{"NVDA", "AAPL"})
	changes, err := o.PriceChange(context.Background(), nil)
	if err != nil {
		t.Fatalf("PriceChange: %v", err)
	}
	if len(changes) != 2 {
		t.Fatalf("got %d changes, want 2", len(changes))
	}

	// The request must ask for two bars, sorted newest first: one bar cannot
	// express a change, and the ordering is what makes "the last two" well
	// defined.
	for _, want := range []string{"timeframe=1Day", "limit=2", "sort=desc", "symbols=NVDA%2CAAPL"} {
		if !strings.Contains(gotQuery, want) {
			t.Errorf("query %q missing %q", gotQuery, want)
		}
	}

	bySym := map[string]InstrumentChange{}
	for _, c := range changes {
		bySym[c.Symbol] = c
	}

	nvda := bySym["NVDA"]
	if nvda.Price != 150.5 || nvda.PreviousClose != 140.0 {
		t.Errorf("NVDA price/prev = %v/%v, want 150.5/140", nvda.Price, nvda.PreviousClose)
	}
	if nvda.Change != 10.5 || nvda.ChangePercent != 7.5 {
		t.Errorf("NVDA change = %v (%v%%), want 10.5 (7.5%%)", nvda.Change, nvda.ChangePercent)
	}
	if nvda.Unranked || nvda.Synthetic {
		t.Errorf("NVDA flagged unranked/synthetic: %+v", nvda)
	}
	if nvda.AsOf.UTC() != time.Date(2026, 10, 9, 4, 0, 0, 0, time.UTC) {
		t.Errorf("NVDA asOf = %v", nvda.AsOf)
	}

	aapl := bySym["AAPL"]
	if aapl.Change != -12.0 || aapl.ChangePercent != -5.0 {
		t.Errorf("AAPL change = %v (%v%%), want -12 (-5%%)", aapl.Change, aapl.ChangePercent)
	}
}

// TestPriceOracleLookbackWindowAndPagination asserts that PriceChange passes
// a 7-day start window parameter (protecting weekend and holiday requests from
// 0-bar empty sets) and follows upstream NextPageTokens to assemble multi-symbol bars.
func TestPriceOracleLookbackWindowAndPagination(t *testing.T) {
	page1 := `{"bars":{
		"NVDA":[
			{"t":"2026-10-23T04:00:00Z","c":210.0},
			{"t":"2026-10-22T04:00:00Z","c":200.0}
		]
	},"next_page_token":"token_page_2"}`

	page2 := `{"bars":{
		"AAPL":[
			{"t":"2026-10-23T04:00:00Z","c":350.0},
			{"t":"2026-10-22T04:00:00Z","c":340.0}
		]
	},"next_page_token":""}`

	var requests []string
	callCount := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r.URL.RawQuery)
		callCount++
		w.Header().Set("Content-Type", "application/json")
		if callCount == 1 {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(page1))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(page2))
	}))
	defer srv.Close()

	o := newStubOracle(t, srv, []string{"NVDA", "AAPL"})
	changes, err := o.PriceChange(context.Background(), nil)
	if err != nil {
		t.Fatalf("PriceChange error: %v", err)
	}
	if len(changes) != 2 {
		t.Fatalf("got %d changes, want 2", len(changes))
	}

	if len(requests) != 2 {
		t.Fatalf("got %d upstream requests, want 2 pages", len(requests))
	}

	// First request must supply start window and symbols
	req1 := requests[0]
	if !strings.Contains(req1, "start=") {
		t.Errorf("request 1 query %q missing start parameter", req1)
	}
	expectedStart := time.Now().UTC().AddDate(0, 0, -7).Format("2006-01-02")
	if !strings.Contains(req1, "start="+expectedStart) {
		t.Errorf("request 1 start parameter mismatch, got %q, want %q", req1, expectedStart)
	}

	// Second request must include page_token
	req2 := requests[1]
	if !strings.Contains(req2, "page_token=token_page_2") {
		t.Errorf("request 2 query %q missing page_token", req2)
	}

	bySym := map[string]InstrumentChange{}
	for _, c := range changes {
		bySym[c.Symbol] = c
	}

	if bySym["NVDA"].Price != 210.0 || bySym["NVDA"].PreviousClose != 200.0 {
		t.Errorf("NVDA prices incorrect: %+v", bySym["NVDA"])
	}
	if bySym["AAPL"].Price != 350.0 || bySym["AAPL"].PreviousClose != 340.0 {
		t.Errorf("AAPL prices incorrect: %+v", bySym["AAPL"])
	}
}

// The two ends of the subtraction must come from the same snapshot. A payload
// that arrives in ascending order must not produce a sign-flipped change, and
// an instrument with a single bar has an unknown change, not a zero one.
func TestPriceOracleHandlesAscendingBarsAndSingleBar(t *testing.T) {
	body := `{"bars":{
		"ASC":[
			{"t":"2026-10-08T04:00:00Z","c":100.0},
			{"t":"2026-10-09T04:00:00Z","c":110.0}
		],
		"ONE":[{"t":"2026-10-09T04:00:00Z","c":50.0}]
	}}`
	srv := alpacaStub(t, body, http.StatusOK, nil)
	o := newStubOracle(t, srv, []string{"ASC", "ONE"})

	changes, err := o.PriceChange(context.Background(), nil)
	if err != nil {
		t.Fatalf("PriceChange: %v", err)
	}
	bySym := map[string]InstrumentChange{}
	for _, c := range changes {
		bySym[c.Symbol] = c
	}

	if asc := bySym["ASC"]; asc.Price != 110 || asc.PreviousClose != 100 || asc.ChangePercent != 10 {
		t.Errorf("ASC = %+v, want price 110 up from 100 (+10%%)", asc)
	}
	one := bySym["ONE"]
	if one.Price != 50 {
		t.Errorf("ONE price = %v, want 50", one.Price)
	}
	if !one.Unranked {
		t.Errorf("a single bar is an unknown change, got %+v", one)
	}
}

func TestPriceOraclePriceListIsSortedBySymbol(t *testing.T) {
	body := `{"bars":{
		"TSLA":[{"t":"2026-10-09T04:00:00Z","c":250},{"t":"2026-10-08T04:00:00Z","c":240}],
		"AAPL":[{"t":"2026-10-09T04:00:00Z","c":230},{"t":"2026-10-08T04:00:00Z","c":220}],
		"NVDA":[{"t":"2026-10-09T04:00:00Z","c":150},{"t":"2026-10-08T04:00:00Z","c":140}]
	}}`
	srv := alpacaStub(t, body, http.StatusOK, nil)
	o := newStubOracle(t, srv, []string{"TSLA", "AAPL", "NVDA"})

	// 20 rounds: map iteration order changes per range statement, so a missing
	// sort shows up within a couple of runs.
	for i := 0; i < 20; i++ {
		prices, err := o.PriceList(context.Background())
		if err != nil {
			t.Fatalf("PriceList: %v", err)
		}
		if len(prices) != 3 {
			t.Fatalf("got %d prices", len(prices))
		}
		if prices[0].Symbol != "AAPL" || prices[1].Symbol != "NVDA" || prices[2].Symbol != "TSLA" {
			t.Fatalf("round %d: order = %s,%s,%s", i, prices[0].Symbol, prices[1].Symbol, prices[2].Symbol)
		}
	}
}

func TestPriceListOmitsInstrumentsWithoutABar(t *testing.T) {
	srv := alpacaStub(t, `{"bars":{"NVDA":[{"t":"2026-10-09T04:00:00Z","c":150}]}}`, http.StatusOK, nil)
	o := newStubOracle(t, srv, []string{"NVDA", "GHOST"})

	prices, err := o.PriceList(context.Background())
	if err != nil {
		t.Fatalf("PriceList: %v", err)
	}
	// A missing instrument must not appear as a 0.00 quote.
	if len(prices) != 1 || prices[0].Symbol != "NVDA" {
		t.Fatalf("prices = %+v, want only NVDA", prices)
	}
}

func TestLatestPriceReportsAnAbsentSymbol(t *testing.T) {
	srv := alpacaStub(t, `{"bars":{}}`, http.StatusOK, nil)
	o := newStubOracle(t, srv, []string{"NVDA"})

	_, err := o.LatestPrice(context.Background(), "NVDA")
	if err == nil {
		t.Fatal("expected an error for a symbol with no bars")
	}
	if !errors.Is(err, ErrNoMarketData) {
		t.Errorf("err = %v, want ErrNoMarketData", err)
	}
}

func TestPriceOracleSurfacesUpstreamStatus(t *testing.T) {
	srv := alpacaStub(t, `{"message":"subscription does not permit querying recent SIP data"}`, http.StatusForbidden, nil)
	o := newStubOracle(t, srv, []string{"NVDA"})

	_, err := o.PriceChange(context.Background(), nil)
	if err == nil {
		t.Fatal("expected an error on 403")
	}
	if !strings.Contains(err.Error(), "403") {
		t.Errorf("err = %v, want it to name the status", err)
	}
}

// ==================== FAIL CLOSED (issue #14) ====================

// The headline negative judgement: without credentials NOTHING is returned. It
// is not a "degraded" mode with plausible numbers in it — the return is empty
// and the error is the sentinel every caller maps to 503.
func TestNoCredentialsMeansNoData(t *testing.T) {
	ctx := context.Background()

	o := NewPriceOracle("", "")
	changes, err := o.PriceChange(ctx, nil)
	if !errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Fatalf("PriceChange err = %v, want ErrAlpacaCredentialsMissing", err)
	}
	if len(changes) != 0 {
		t.Fatalf("PriceChange returned %d rows without credentials: %+v", len(changes), changes)
	}

	prices, err := o.PriceList(ctx)
	if !errors.Is(err, ErrAlpacaCredentialsMissing) || len(prices) != 0 {
		t.Fatalf("PriceList = %+v, %v; want no rows and the sentinel", prices, err)
	}

	if _, err := o.LatestPrice(ctx, "NVDA"); !errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Fatalf("LatestPrice err = %v, want the sentinel", err)
	}

	// Half a credential set is not configured either.
	half := NewPriceOracle("key", "")
	if half.Configured() {
		t.Error("Configured() = true with no secret")
	}
	if _, err := half.PriceList(ctx); !errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Errorf("half-configured PriceList err = %v", err)
	}

	c := NewAlpacaClient("http://127.0.0.1:1", "", "")
	if _, err := c.GetAccount(ctx); !errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Errorf("GetAccount err = %v", err)
	}
	if _, err := c.GetPositions(ctx); !errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Errorf("GetPositions err = %v", err)
	}
	if _, err := c.CreateOrder(ctx, OrderRequest{Symbol: "NVDA", Notional: "10"}); !errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Errorf("CreateOrder err = %v", err)
	}
	if err := c.ClosePosition(ctx, "NVDA"); !errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Errorf("ClosePosition err = %v", err)
	}
}

// A missing credential set must be distinguishable from "upstream is down":
// both fail, but only one is a configuration error, and the operator-facing
// message differs.
func TestUpstreamFailureIsNotReportedAsMissingCredentials(t *testing.T) {
	srv := alpacaStub(t, `{"message":"internal error"}`, http.StatusInternalServerError, nil)
	o := newStubOracle(t, srv, []string{"NVDA"})

	_, err := o.PriceChange(context.Background(), nil)
	if err == nil {
		t.Fatal("expected an error")
	}
	if errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Errorf("a 500 was reported as missing credentials: %v", err)
	}
}

// A 200 with no bars for a requested symbol must NOT come back as a generic
// "symbol not found": the caller has to be able to tell "we asked and there is
// nothing" from "the upstream is broken".
func TestNoBarsIsNotReportedAsAnUpstreamFailure(t *testing.T) {
	srv := alpacaStub(t, `{"bars":{"NVDA":[{"t":"2026-10-09T04:00:00Z","c":150}]}}`, http.StatusOK, nil)
	o := newStubOracle(t, srv, []string{"NVDA", "TSLA"})

	_, err := o.LatestPrice(context.Background(), "TSLA")
	if !errors.Is(err, ErrNoMarketData) {
		t.Fatalf("err = %v, want ErrNoMarketData", err)
	}
	if errors.Is(err, ErrAlpacaCredentialsMissing) {
		t.Error("an absent bar was reported as a credentials problem")
	}
}

// ==================== CREDENTIAL STATE (what /health reports) ====================

func TestAlpacaClientRecordsFailureThenSuccess(t *testing.T) {
	status := http.StatusInternalServerError
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(`{"message":"boom"}`))
	}))
	t.Cleanup(srv.Close)

	c := NewAlpacaClient(srv.URL, "k", "s")
	if st := c.Health(); st.Observed || st.OK {
		t.Fatalf("before any call: %+v, want unobserved", st)
	}

	if _, err := c.GetAccount(context.Background()); err == nil {
		t.Fatal("expected the 500 to surface")
	}
	st := c.Health()
	if !st.Observed || st.OK {
		t.Fatalf("after a 500: %+v, want observed but not OK", st)
	}
	if !strings.Contains(st.LastError, "500") {
		t.Errorf("lastError = %q, want it to name the status", st.LastError)
	}

	// Recovering must clear the error, or the badge would stay red after the
	// upstream came back — a stale failure is its own kind of lie.
	status = http.StatusOK
	if _, err := c.GetAccount(context.Background()); err != nil {
		t.Fatalf("GetAccount: %v", err)
	}
	st = c.Health()
	if !st.OK || st.LastError != "" || st.LastSuccess.IsZero() {
		t.Fatalf("after a 200: %+v, want OK with no stale error", st)
	}
}

func TestAlpacaClientRecordsMissingCredentials(t *testing.T) {
	c := NewAlpacaClient("http://127.0.0.1:1", "", "")
	_, _ = c.GetAccount(context.Background())

	st := c.Health()
	if !st.Observed || st.OK {
		t.Fatalf("state = %+v, want observed and not OK", st)
	}
	if !strings.Contains(st.LastError, "ALPACA_API_KEY") {
		t.Errorf("lastError = %q, want it to name the missing variables", st.LastError)
	}
}

// ==================== DATA HEALTH ====================

func TestDataHealthReportsUnconfiguredRatherThanHealthy(t *testing.T) {
	svc := NewService(NewAlpacaClient("http://127.0.0.1:1", "", ""), NewPriceOracle("", ""), nil)

	h := svc.GetDataHealth(context.Background())
	if h.Configured {
		t.Error("configured = true with no credentials")
	}
	if h.PriceOracle.OK {
		t.Error("priceOracle.ok = true with no credentials")
	}
	if h.PriceOracle.Instruments != 0 {
		t.Errorf("instruments = %d, want 0", h.PriceOracle.Instruments)
	}
	if h.Synthetic {
		t.Error("synthetic = true")
	}
}

func TestDataHealthIsFalseOnAnEmptyUpstreamPayload(t *testing.T) {
	// The case a naive probe gets wrong: HTTP 200, no data.
	srv := alpacaStub(t, `{"bars":{}}`, http.StatusOK, nil)
	svc := NewService(NewAlpacaClient(srv.URL, "k", "s"), newStubOracle(t, srv, []string{"NVDA"}), nil)

	h := svc.GetDataHealth(context.Background())
	if !h.Configured {
		t.Error("configured = false although credentials are present")
	}
	if h.PriceOracle.OK {
		t.Error("priceOracle.ok = true on an empty bars object")
	}
	if !strings.Contains(h.PriceOracle.Error, "no bars") {
		t.Errorf("error = %q, want it to say no bars were returned", h.PriceOracle.Error)
	}
}

func TestDataHealthCountsQuotedInstruments(t *testing.T) {
	body := `{"bars":{
		"NVDA":[{"t":"2026-10-09T04:00:00Z","c":150},{"t":"2026-10-08T04:00:00Z","c":140}],
		"AAPL":[{"t":"2026-10-09T04:00:00Z","c":230},{"t":"2026-10-08T04:00:00Z","c":220}]
	}}`
	srv := alpacaStub(t, body, http.StatusOK, nil)
	svc := NewService(NewAlpacaClient(srv.URL, "k", "s"), newStubOracle(t, srv, []string{"NVDA", "AAPL"}), nil)

	h := svc.GetDataHealth(context.Background())
	if !h.PriceOracle.OK || h.PriceOracle.Instruments != 2 {
		t.Fatalf("health = %+v, want ok with 2 instruments", h.PriceOracle)
	}
	if h.PriceOracle.LatestBar == "" {
		t.Error("latestBar is empty although bars were read")
	}
}

// ==================== SERVICE WIRING ====================

func TestGetMarketOverviewPropagatesAccountFailure(t *testing.T) {
	srv := alpacaStub(t, `{"message":"unauthorized"}`, http.StatusUnauthorized, nil)
	svc := NewService(NewAlpacaClient(srv.URL, "k", "s"), NewPriceOracle("k", "s"), nil)

	_, err := svc.GetMarketOverview(context.Background())
	if err == nil {
		t.Fatal("expected the account failure to propagate")
	}
	if !strings.Contains(err.Error(), "alpaca account") {
		t.Errorf("err = %v, want context about the account call", err)
	}
}

func TestGetMarketOverviewRanksTheSamePricesItReturns(t *testing.T) {
	body := `{"bars":{
		"NVDA":[{"t":"2026-10-09T04:00:00Z","c":150},{"t":"2026-10-08T04:00:00Z","c":140}],
		"TSLA":[{"t":"2026-10-09T04:00:00Z","c":240},{"t":"2026-10-08T04:00:00Z","c":250}]
	}}`
	requests := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/account"):
			requests++
			_, _ = w.Write([]byte(`{"id":"a1","cash":"1000","buying_power":"4000"}`))
		case strings.HasSuffix(r.URL.Path, "/positions"):
			requests++
			_, _ = w.Write([]byte(`[]`))
		case strings.HasSuffix(r.URL.Path, "/bars"):
			requests++
			_, _ = w.Write([]byte(body))
		default:
			t.Errorf("unexpected upstream path %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	o := newStubOracle(t, srv, []string{"NVDA", "TSLA"})
	svc := NewService(NewAlpacaClient(srv.URL, "k", "s"), o, nil)

	overview, err := svc.GetMarketOverview(context.Background())
	if err != nil {
		t.Fatalf("GetMarketOverview: %v", err)
	}
	if len(overview.Prices) != 2 {
		t.Fatalf("prices = %+v", overview.Prices)
	}
	if len(overview.Movers.Gainers) != 1 || overview.Movers.Gainers[0].Symbol != "NVDA" {
		t.Errorf("gainers = %+v", overview.Movers.Gainers)
	}
	if len(overview.Movers.Losers) != 1 || overview.Movers.Losers[0].Symbol != "TSLA" {
		t.Errorf("losers = %+v", overview.Movers.Losers)
	}
	// The ranking must be derived from the same rows, not from a second call.
	if requests != 3 {
		t.Errorf("upstream requests = %d, want 3 (account, positions, bars)", requests)
	}
}

func TestGetMoversReturnsErrorNotAnEmptyBoard(t *testing.T) {
	o := NewPriceOracle("k", "s") // default (real) host, never reached: no symbols? it has defaults
	o.SetDataBaseURL("http://127.0.0.1:1")
	svc := NewService(NewAlpacaClient("http://127.0.0.1:1", "k", "s"), o, nil)

	if _, err := svc.GetMovers(context.Background()); err == nil {
		t.Fatal("expected an error when the upstream is unreachable")
	}
}

func TestExecuteTradeWrapsUpstreamFailure(t *testing.T) {
	srv := alpacaStub(t, `{"message":"insufficient buying power"}`, http.StatusForbidden, nil)
	svc := NewService(NewAlpacaClient(srv.URL, "k", "s"), NewPriceOracle("k", "s"), nil)

	res, err := svc.ExecuteTrade(context.Background(), TradeRequest{Symbol: "NVDA", Side: "buy", NotionalUSD: 100, Leverage: 1})
	if err == nil {
		t.Fatal("expected an error")
	}
	if res == nil || res.Success {
		t.Errorf("result = %+v, want an unsuccessful result alongside the error", res)
	}
	if !strings.Contains(res.Message, "insufficient buying power") {
		t.Errorf("message = %q, want the upstream reason", res.Message)
	}
}

func TestExecuteTradeRejectsNonPositiveNotionalWithoutCallingUpstream(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	svc := NewService(NewAlpacaClient(srv.URL, "k", "s"), NewPriceOracle("k", "s"), nil)
	res, err := svc.ExecuteTrade(context.Background(), TradeRequest{Symbol: "NVDA", Side: "buy", NotionalUSD: 0})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Success {
		t.Error("success = true for a zero notional")
	}
	if called {
		t.Error("the upstream was called for an invalid request")
	}
}

// ==================== CONTEXT ====================

// Context must reach the upstream request: the previous client built requests
// with http.NewRequest, so a cancelled caller left the call running.
func TestPriceChangeHonoursContextCancellation(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	t.Cleanup(func() { close(release); srv.Close() })

	o := newStubOracle(t, srv, []string{"NVDA"})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	start := time.Now()
	if _, err := o.PriceChange(ctx, nil); err == nil {
		t.Fatal("expected an error from a cancelled context")
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("call took %v to notice cancellation", elapsed)
	}
}
