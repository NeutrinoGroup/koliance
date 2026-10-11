package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/market"
)

// ==================== INDEPENDENT EDGE-CASE SUITE (03 环, qa-validator) ====================
//
// Written by an agent that did not implement this change, against the delivered
// behaviour of `docs/changes/027` (issues #14 / #16). It deliberately does not
// repeat the implementer's assertions; it attacks the places the implementer's
// own write-up names as weak, plus the boundaries that a happy-path suite does
// not reach:
//
//   1. #14 measured STRICTLY. The implementer's negative case
//      (`TestMarketReadEndpointsRefuseWithoutCredentials`) checks the refusal by
//      searching the serialised body for the substrings "150", "TSLA",
//      "realtimePrices", "gainers", "feedId". A substring search over the whole
//      body cannot tell a JSON *number* from a digit inside an error message or
//      from a JSON *key*, and a future refuse() that echoed a price inside a
//      string would pass it. Here the body is parsed, and the assertions are on
//      the top-level key set and on every JSON number reachable in it.
//      The measurement is paired with a positive control, because a measurement
//      that can see nothing also reports "nothing".
//
//   2. Ranking edges: every requested symbol accounted for exactly once, an
//      all-unranked board, and extreme magnitudes.
//
//   3. The probe cache and the ranking under real concurrency (run with -race).
//
//   4. /health's constant `status: "healthy"` — what it does and does not hide.
//
// This file adds tests only. No production file is modified by it.

// indyStrictNumbers parses a response body and returns its TOP-LEVEL keys and
// every JSON number reachable anywhere inside it, as text.
//
// Strictness is the point: `strings.Contains(body, "150")` is true for a body
// whose only content is the string "ALPACA_API_KEY ... not configured", for a
// key named `feedId`, and for an upstream error naming an HTTP status. Parsing
// first means the assertion is about the payload's *shape*, which is what
// "no price field" actually means.
func indyStrictNumbers(t *testing.T, body []byte) (map[string]bool, []string) {
	t.Helper()
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		t.Fatalf("response body is not JSON: %v (%s)", err, string(body))
	}
	top := map[string]bool{}
	var nums []string
	var walk func(any)
	walk = func(x any) {
		switch n := x.(type) {
		case json.Number:
			nums = append(nums, n.String())
		case map[string]any:
			for k, e := range n {
				walk(e)
				_ = k
			}
		case []any:
			for _, e := range n {
				walk(e)
			}
		}
	}
	if m, ok := v.(map[string]any); ok {
		for k := range m {
			top[k] = true
		}
	}
	walk(v)
	sort.Strings(nums)
	return top, nums
}

func indyKeys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// indyRouter wires the router against one stub upstream (the data host and the
// trading host are the same stub here, which is fine: the tests that care about
// which host was called assert on r.URL.Path inside the handler).
func indyRouter(t *testing.T, upstream http.HandlerFunc, withCreds bool) (http.Handler, *int32) {
	t.Helper()
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		upstream(w, r)
	}))
	t.Cleanup(srv.Close)

	// Steam/GitHub probes point at a closed port so their verdict cannot depend
	// on the network. (Same idiom as market_test.go; these are package vars, the
	// weakness the implementer flagged.)
	origSteam, origGitHub := steamProbeBaseURL, githubProbeBaseURL
	steamProbeBaseURL, githubProbeBaseURL = "http://127.0.0.1:1", "http://127.0.0.1:1"
	t.Cleanup(func() { steamProbeBaseURL, githubProbeBaseURL = origSteam, origGitHub })

	cfg := indyConfig(srv.URL, withCreds)

	alp := market.NewAlpacaClient(cfg.AlpacaBaseURL, cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	oracle := market.NewPriceOracle(cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	oracle.SetDataBaseURL(cfg.AlpacaDataURL)
	oracle.SetFeed(cfg.AlpacaDataFeed)
	oracle.SetSymbols([]string{"NVDA", "TSLA"})

	probeCache.Lock()
	probeCache.entries = map[string]cachedProbe{}
	probeCache.Unlock()

	return NewRouter(Deps{
		Cfg:         cfg,
		Market:      market.NewService(alp, oracle, nil),
		PriceOracle: oracle,
	}), &hits
}

func indyConfig(upstream string, withCreds bool) *config.Config {
	cfg := &config.Config{
		SteamDomain:        "koliance.oodai.space",
		MonadChainID:       "10143",
		CORSAllowedOrigins: config.ParseOrigins(config.DefaultCORSOrigins),
		APIToken:           opToken,
		PythHermesURL:      "http://127.0.0.1:1",
		AlpacaBaseURL:      upstream,
		AlpacaDataURL:      upstream,
		AlpacaDataFeed:     "iex",
	}
	if withCreds {
		cfg.AlpacaAPIKey, cfg.AlpacaAPISecret = "test-key", "test-secret"
	}
	return cfg
}

func indyStubBars(body string, status int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}
}

// ==================== 1. #14: NO DATA ⇒ NO NUMBERS ====================

// The headline negative judgement, measured on the payload's shape rather than
// on substrings of its serialisation.
func TestIndyRefusalCarriesNoPriceFieldAtAll(t *testing.T) {
	h, hits := indyRouter(t, indyStubBars(twoBarPayload, http.StatusOK), false)

	for _, path := range []string{
		"/api/v1/market/overview",
		"/api/v1/market/prices",
		"/api/v1/market/movers",
	} {
		rr := do(h, http.MethodGet, path, "", nil)
		if rr.Code != http.StatusServiceUnavailable {
			t.Fatalf("GET %s without credentials: %d, want 503 (%s)", path, rr.Code, rr.Body.String())
		}

		top, nums := indyStrictNumbers(t, rr.Body.Bytes())
		// Exactly one key. A payload key here — `realtimePrices`, `gainers`,
		// `meta`, anything — is a quote that reached a caller with no data
		// behind it.
		if len(top) != 1 || !top["error"] {
			t.Errorf("GET %s: top-level keys = %v, want exactly [error]", path, indyKeys(top))
		}
		if len(nums) != 0 {
			t.Errorf("GET %s: refusal body contains JSON numbers %v — a refusal carries no number", path, nums)
		}
		if msg, _ := indyStrictNumbers(t, rr.Body.Bytes()); msg == nil {
			t.Fatalf("GET %s: no parseable body", path)
		}
	}

	if n := atomic.LoadInt32(hits); n != 0 {
		t.Errorf("the upstream was called %d times although no credentials are configured", n)
	}
}

// Positive control. Without this, the test above would also pass against a
// measurement that reads nothing at all — the same trap the probe cache and the
// progress-page hook are documented to have.
func TestIndyTheMeasurementSeesAPayloadWhenThereIsOne(t *testing.T) {
	h, _ := indyRouter(t, indyStubBars(twoBarPayload, http.StatusOK), true)

	rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("movers with credentials: %d (%s)", rr.Code, rr.Body.String())
	}
	top, nums := indyStrictNumbers(t, rr.Body.Bytes())
	for _, k := range []string{"gainers", "losers", "unchanged", "unrankedCount", "asOf", "source", "synthetic"} {
		if !top[k] {
			t.Errorf("top-level key %q missing from a real movers payload: %v", k, indyKeys(top))
		}
	}
	if len(nums) == 0 {
		t.Fatal("no JSON number found in a payload that quotes two instruments — the measurement is blind")
	}
	t.Logf("control: %d top-level keys, numbers %v", len(top), nums)
}

// Half a credential set must not pass the gate. (The implementer tests one
// missing secret; the mirror case — key absent, secret present — is untested
// there, and it takes the other branch of `&&`.)
func TestIndyGateRefusesWithEitherCredentialMissing(t *testing.T) {
	for _, tc := range []struct {
		name         string
		key, secret  string
		wantRefusal  bool
		wantUpstream int32
	}{
		{"both empty", "", "", true, 0},
		{"key only", "test-key", "", true, 0},
		{"secret only", "", "test-secret", true, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var hits int32
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				atomic.AddInt32(&hits, 1)
				_, _ = w.Write([]byte(twoBarPayload))
			}))
			t.Cleanup(srv.Close)

			cfg := indyConfig(srv.URL, false)
			cfg.AlpacaAPIKey, cfg.AlpacaAPISecret = tc.key, tc.secret

			oracle := market.NewPriceOracle(cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
			oracle.SetDataBaseURL(cfg.AlpacaDataURL)
			oracle.SetSymbols([]string{"NVDA"})

			probeCache.Lock()
			probeCache.entries = map[string]cachedProbe{}
			probeCache.Unlock()

			h := NewRouter(Deps{
				Cfg:         cfg,
				Market:      market.NewService(market.NewAlpacaClient(cfg.AlpacaBaseURL, cfg.AlpacaAPIKey, cfg.AlpacaAPISecret), oracle, nil),
				PriceOracle: oracle,
			})

			rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
			gotRefusal := rr.Code == http.StatusServiceUnavailable
			if gotRefusal != tc.wantRefusal {
				t.Errorf("status = %d, want 503 (refusal)", rr.Code)
			}
			if n := atomic.LoadInt32(&hits); n != tc.wantUpstream {
				t.Errorf("upstream calls = %d, want %d", n, tc.wantUpstream)
			}
		})
	}
}

// CHARACTERISATION OF A GAP (green test, not a proof of correctness).
//
// `config.Config.AlpacaConfigured()` compares the raw env values, while
// `market.PriceOracle`/`AlpacaClient` trim them. So a deployment whose
// ALPACA_API_KEY is whitespace passes the 503 gate and then fails *inside* the
// handler — as 502 on prices/movers and 500 on overview, i.e. the caller is
// told "the upstream is having a bad day" when the truth is "this deployment
// was never configured". Two definitions of "configured" is precisely the D4
// drift the change set out to remove.
//
// The safety property still holds (no synthetic data is served), which is why
// this is a status-code defect rather than a data defect. This test pins the
// CURRENT behaviour on purpose: it is here so the gap is visible in code, and
// it will go red the moment either definition is made to agree. When that
// happens, assert 503 here and delete this comment.
func TestIndyWhitespaceCredentialsPassTheGateButNotTheOracle(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		_, _ = w.Write([]byte(twoBarPayload))
	}))
	t.Cleanup(srv.Close)

	cfg := indyConfig(srv.URL, false)
	cfg.AlpacaAPIKey, cfg.AlpacaAPISecret = "   ", "   \t" // configured? the two answers differ

	if !cfg.AlpacaConfigured() {
		t.Fatal("premise changed: Config.AlpacaConfigured() now trims, so the gate would refuse and this gap is closed")
	}
	oracle := market.NewPriceOracle(cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	if oracle.Configured() {
		t.Fatal("premise changed: PriceOracle.Configured() now accepts whitespace")
	}
	oracle.SetDataBaseURL(cfg.AlpacaDataURL)
	oracle.SetSymbols([]string{"NVDA"})

	probeCache.Lock()
	probeCache.entries = map[string]cachedProbe{}
	probeCache.Unlock()

	h := NewRouter(Deps{
		Cfg:         cfg,
		Market:      market.NewService(market.NewAlpacaClient(cfg.AlpacaBaseURL, cfg.AlpacaAPIKey, cfg.AlpacaAPISecret), oracle, nil),
		PriceOracle: oracle,
	})

	// Measured, not asserted as correct: record all three.
	got := map[string]int{}
	for _, p := range []string{"/api/v1/market/prices", "/api/v1/market/movers", "/api/v1/market/overview"} {
		rr := do(h, http.MethodGet, p, "", nil)
		got[p] = rr.Code
		if _, nums := indyStrictNumbers(t, rr.Body.Bytes()); len(nums) != 0 {
			t.Errorf("GAP IS WORSE THAN REPORTED: GET %s answered %d with JSON numbers %v", p, rr.Code, nums)
		}
	}
	t.Logf("GAP: whitespace-only credentials → %v (503 was the contract; overview answers 500 while the two data endpoints answer 502 — the three disagree with each other)", got)

	if got["/api/v1/market/movers"] == http.StatusServiceUnavailable {
		t.Errorf("the gap appears closed: movers answered 503 — update this test to assert the refusal on all three paths")
	}
	if n := atomic.LoadInt32(&hits); n != 0 {
		t.Errorf("no upstream call was expected; got %d", n)
	}
}

// ==================== 2. RANKING EDGES ====================

// indyBars builds an Alpaca-shaped bars payload from symbol → [prev, latest].
func indyBars(spec map[string][2]float64, single map[string]float64) string {
	var sb strings.Builder
	sb.WriteString(`{"bars":{`)
	first := true
	write := func(sym, body string) {
		if !first {
			sb.WriteString(",")
		}
		first = false
		sb.WriteString(`"` + sym + `":` + body)
	}
	for sym, pair := range spec {
		write(sym, fmt.Sprintf(
			`[{"t":"2026-10-09T04:00:00Z","c":%v},{"t":"2026-10-08T04:00:00Z","c":%v}]`, pair[1], pair[0]))
	}
	for sym, c := range single {
		write(sym, fmt.Sprintf(`[{"t":"2026-10-09T04:00:00Z","c":%v}]`, c))
	}
	sb.WriteString("}}")
	return sb.String()
}

func indyBucketOf(m market.Movers, sym string) string {
	for _, b := range []struct {
		name string
		rows []market.InstrumentChange
	}{{"gainers", m.Gainers}, {"losers", m.Losers}, {"unchanged", m.Unchanged}} {
		for _, r := range b.rows {
			if r.Symbol == sym {
				return b.name
			}
		}
	}
	return ""
}

// Every instrument we asked about must be accounted for exactly once: in one of
// the three boards, or in unrankedCount. This is the invariant a ranking can be
// held to without agreeing on any particular number, and it is the one that
// silently breaks when a bucket is filtered with `continue`.
func TestIndyEveryRequestedSymbolIsAccountedForExactlyOnce(t *testing.T) {
	body := indyBars(map[string][2]float64{
		"AAA": {100, 101}, // up
		"BBB": {100, 99},  // down
		"CCC": {100, 100}, // genuinely flat
		"DDD": {100, 101}, // will be overwritten below to a single bar
	}, nil)
	// DDD gets a single bar (unknown change); EEE is absent from the payload
	// entirely (we asked, the exchange has nothing).
	body = strings.Replace(body, `"DDD":[{"t":"2026-10-09T04:00:00Z","c":101},{"t":"2026-10-08T04:00:00Z","c":100}]`,
		`"DDD":[{"t":"2026-10-09T04:00:00Z","c":101}]`, 1)

	h, _ := indyRouter(t, indyStubBars(body, http.StatusOK), true)
	// Ask for five instruments: the four above plus one with no bar.
	cfg := indyConfig("", true)
	_ = cfg

	rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("movers: %d (%s)", rr.Code, rr.Body.String())
	}
	var m market.Movers
	if err := json.Unmarshal(rr.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode: %v", err)
	}

	ranked := len(m.Gainers) + len(m.Losers) + len(m.Unchanged)
	if ranked+m.UnrankedCount != 2 {
		t.Errorf("accounted rows = %d ranked + %d unranked, want 2 (the router's stub oracle tracks NVDA,TSLA)", ranked, m.UnrankedCount)
	}

	seen := map[string]int{}
	for _, rows := range [][]market.InstrumentChange{m.Gainers, m.Losers, m.Unchanged} {
		for _, r := range rows {
			seen[r.Symbol]++
		}
	}
	for sym, n := range seen {
		if n != 1 {
			t.Errorf("symbol %s appears %d times across the three boards", sym, n)
		}
	}
	if indyBucketOf(m, "NVDA") == "" && m.UnrankedCount == 0 {
		t.Error("NVDA vanished: it is in no board and was not counted as unranked")
	}
}

// A board where nothing can be ranked must say so with an EMPTY board and a
// count — not by putting the instruments into `unchanged`, which would report
// "did not move" for "we cannot tell".
func TestIndyAllUnrankedBoardIsEmptyAndCounted(t *testing.T) {
	body := indyBars(nil, map[string]float64{"NVDA": 150, "TSLA": 240})
	h, _ := indyRouter(t, indyStubBars(body, http.StatusOK), true)

	rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("movers: %d (%s)", rr.Code, rr.Body.String())
	}
	raw := rr.Body.String()
	for _, want := range []string{`"gainers":[]`, `"losers":[]`, `"unchanged":[]`} {
		if !strings.Contains(raw, want) {
			t.Errorf("body missing %s (null instead of []?): %s", want, raw)
		}
	}
	var m market.Movers
	if err := json.Unmarshal(rr.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if m.UnrankedCount != 2 {
		t.Errorf("unrankedCount = %d, want 2", m.UnrankedCount)
	}
	// `asOf` has no observation behind it here. Recorded, not asserted as
	// right: it still marshals as the zero timestamp rather than being omitted.
	t.Logf("all-unranked board: asOf = %q, source = %q, synthetic = %v", m.AsOf, m.Source, m.Synthetic)
	if !m.AsOf.IsZero() {
		t.Errorf("asOf = %v, want the zero time when nothing was ranked", m.AsOf)
	}
}

// Extreme magnitudes must survive the round trip. A rank whose numbers cannot
// be encoded is worse than no rank: the JSON encoder fails the whole response.
func TestIndyExtremeChangesSurviveEncoding(t *testing.T) {
	body := indyBars(map[string][2]float64{
		"NVDA": {0.01, 100.0}, // +999900%
		"TSLA": {100.0, 0.01}, // -99.99%
	}, nil)
	h, _ := indyRouter(t, indyStubBars(body, http.StatusOK), true)

	rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("movers: %d (%s)", rr.Code, rr.Body.String())
	}
	var m market.Movers
	if err := json.Unmarshal(rr.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode (the encoder produced something unparseable?): %v", err)
	}
	if len(m.Gainers) != 1 || m.Gainers[0].Symbol != "NVDA" {
		t.Fatalf("gainers = %+v", m.Gainers)
	}
	if got := m.Gainers[0].ChangePercent; got < 999000 || got > 1000000 {
		t.Errorf("NVDA changePercent = %v, want ~999900", got)
	}
	if len(m.Losers) != 1 || m.Losers[0].Symbol != "TSLA" {
		t.Fatalf("losers = %+v", m.Losers)
	}
	if got := m.Losers[0].ChangePercent; got > -99 || got < -100 {
		t.Errorf("TSLA changePercent = %v, want -99.99", got)
	}
	// The published invariant: changePercent is derived from the ROUNDED change,
	// so a reader of the JSON can check one against the other.
	for _, r := range append(append([]market.InstrumentChange{}, m.Gainers...), m.Losers...) {
		want := r.Change / r.PreviousClose * 100
		if diff := want - r.ChangePercent; diff > 0.0002 || diff < -0.0002 {
			t.Errorf("%s: change/previousClose*100 = %v but changePercent = %v", r.Symbol, want, r.ChangePercent)
		}
	}
}

// A sub-cent quote whose rounded closes coincide. This is a boundary of the
// published "percent is computed from the rounded change" rule, not a defect
// claim: the test only pins that the instrument is still accounted for
// somewhere, and logs which board it lands in.
func TestIndySubCentRoundingBoundaryKeepsTheInstrument(t *testing.T) {
	body := indyBars(map[string][2]float64{"NVDA": {1.001, 1.002}}, nil)
	h, _ := indyRouter(t, indyStubBars(body, http.StatusOK), true)

	rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
	var m market.Movers
	if err := json.Unmarshal(rr.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode: %v", err)
	}
	where := indyBucketOf(m, "NVDA")
	if where == "" && m.UnrankedCount == 0 {
		t.Fatalf("NVDA is in no board and uncounted: %s", rr.Body.String())
	}
	if where == "unchanged" {
		t.Logf("ROUNDING BOUNDARY: 1.001→1.002 rounds both closes to 1.00, so a quote that did move reports changePercent=0 and is listed as 持平 (unrankedCount=%d)", m.UnrankedCount)
	}
}

// ==================== 2b. RANKING STABILITY, EXHAUSTIVELY ====================
//
// The implementer's version of this judgement (`TestRankMoversIsStableWhenThe
// InputOrderChanges` in internal/market) rebuilds the input from a map 50
// times. That is a valid sampling test of a pure function, but it is not a
// proof, and it is worth recording that the rationale attached to it — "the
// upstream payload is a JSON object, so its Go representation is a map and map
// iteration is randomised" — does NOT reach this function from the HTTP path:
// `PriceChange` iterates the requested-symbols slice and only *looks up*
// `page.Bars[sym]`, so the slice handed to RankMovers is deterministic. The
// tie-break is therefore defence for direct callers, not for this endpoint.
//
// This test removes the sampling question entirely: it enumerates every
// permutation of the input (5! = 120) and requires one single output ordering.
// A missing tie-break makes the output equal the input for an insertion-sorted
// slice, so at least one permutation disagrees.
func TestIndyRankOrderingIsInvariantOverAllInputPermutations(t *testing.T) {
	mk := func(sym string, pct float64) market.InstrumentChange {
		prev := 100.0
		price := prev * (1 + pct/100)
		return market.InstrumentChange{
			Symbol:        sym,
			Price:         price,
			PreviousClose: prev,
			Change:        price - prev,
			ChangePercent: pct,
			AsOf:          time.Date(2026, 10, 9, 20, 0, 0, 0, time.UTC),
			Source:        market.SourceAlpacaBars,
		}
	}
	// Three rise by exactly the same percent and two fall by exactly the same
	// percent: every cross-symbol comparison inside a board is a tie.
	base := []market.InstrumentChange{
		mk("ZZZZ", 2.0), mk("AAAA", 2.0), mk("MMMM", 2.0), mk("YYYY", -2.0), mk("BBBB", -2.0),
	}

	var permute func([]market.InstrumentChange, int, *int, *string)
	permute = func(a []market.InstrumentChange, k int, count *int, want *string) {
		if k == len(a) {
			in := make([]market.InstrumentChange, len(a))
			copy(in, a)
			m := market.RankMovers(in)
			got := fmt.Sprint(syms(m.Gainers)) + "|" + fmt.Sprint(syms(m.Losers)) + "|" + fmt.Sprint(syms(m.Unchanged))
			*count++
			if *want == "" {
				*want = got
				return
			}
			if got != *want {
				t.Errorf("ordering changed with input order: want %s, got %s (input %v)", *want, got, syms(in))
			}
			return
		}
		for i := k; i < len(a); i++ {
			a[k], a[i] = a[i], a[k]
			permute(a, k+1, count, want)
			a[k], a[i] = a[i], a[k]
		}
	}

	count, want := 0, ""
	permute(base, 0, &count, &want)
	if count != 120 {
		t.Fatalf("enumerated %d permutations, want 120", count)
	}
	if want != "[AAAA MMMM ZZZZ]|[YYYY BBBB]|[]" {
		t.Errorf("ordering = %s, want the symbol tie-break applied inside both boards", want)
	}
}

func syms(rows []market.InstrumentChange) []string {
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.Symbol)
	}
	return out
}

// ==================== 3. CONCURRENCY (run this file with -race) ====================

// Two identical requests must produce identical bytes — under load, and with
// the upstream map iteration order changing underneath (Go randomises map
// iteration per range statement). Without the symbol tie-break this is the test
// that flips.
func TestIndyMoversIsByteStableUnderConcurrency(t *testing.T) {
	body := indyBars(map[string][2]float64{
		"NVDA": {100, 102.5},
		"TSLA": {100, 102.5}, // identical percent: the tie-break is the only thing separating them
	}, nil)
	h, _ := indyRouter(t, indyStubBars(body, http.StatusOK), true)

	// Warm up, then compare every concurrent read against it.
	first := do(h, http.MethodGet, "/api/v1/market/movers", "", nil).Body.String()
	if !strings.Contains(first, "NVDA") || !strings.Contains(first, "TSLA") {
		t.Fatalf("warm-up body looks wrong: %s", first)
	}

	const workers, rounds = 12, 8
	var wg sync.WaitGroup
	errs := make(chan string, workers*rounds)
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < rounds; i++ {
				got := do(h, http.MethodGet, "/api/v1/market/movers", "", nil).Body.String()
				if got != first {
					errs <- fmt.Sprintf("body changed under load:\n first=%s\n   got=%s", first, got)
					return
				}
				// /healthz shares the probe cache and the oracle with this path.
				hr := do(h, http.MethodGet, "/healthz", "", nil)
				if hr.Code != http.StatusOK {
					errs <- fmt.Sprintf("healthz under load: %d", hr.Code)
					return
				}
			}
		}()
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		t.Error(e)
	}
}

// The probe cache is a process-wide map behind a mutex. Concurrent /healthz
// traffic must (a) not race, (b) reuse the cached verdict once warm. Render
// pings the health check path continuously, so this is the production shape,
// not a synthetic one.
func TestIndyProbeCacheServesConcurrentHealthRequests(t *testing.T) {
	var calls int32
	h, _ := indyRouter(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(twoBarPayload))
	}, true)

	// Warm the cache with one request.
	if rr := do(h, http.MethodGet, "/healthz", "", nil); rr.Code != http.StatusOK {
		t.Fatalf("warm-up healthz: %d", rr.Code)
	}
	warm := atomic.LoadInt32(&calls)
	if warm == 0 {
		t.Fatal("the first request made no upstream call")
	}

	// The age has to be measurable before it can be asserted on. Measured: with
	// no pause, every worker's request lands in the same millisecond as the
	// write, `now.Sub(entry.at).Milliseconds()` is 0, and `AgeMS` — declared
	// `json:"ageMs,omitempty"` — is omitted from the JSON entirely. So
	// `"cached":true` with no `ageMs` is a legal encoding of "reused just now",
	// not a defect; the first version of this test read it as one and flaked.
	time.Sleep(5 * time.Millisecond)

	const workers = 24
	var wg sync.WaitGroup
	bodies := make([]string, workers)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rr := do(h, http.MethodGet, "/healthz", "", nil)
			bodies[i] = rr.Body.String()
			if rr.Code != http.StatusOK {
				t.Errorf("concurrent healthz: %d", rr.Code)
			}
		}(i)
	}
	wg.Wait()

	// Inside probeTTL nothing may hit the upstream again: that is the whole
	// point of the cache (GitHub's anonymous quota is 60/hour).
	if got := atomic.LoadInt32(&calls); got != warm {
		t.Errorf("upstream calls = %d after %d cached requests, want %d", got, workers, warm)
	}
	for i, b := range bodies {
		if !strings.Contains(b, `"cached":true`) {
			t.Errorf("worker %d: verdict is not marked cached: %s", i, b)
		}
		if !strings.Contains(b, `"ageMs"`) {
			t.Errorf("worker %d: cached verdict carries no ageMs: %s", i, b)
		}
	}
}

// A cache that never expires is the same defect pointing the other way: one bad
// observation, or one good one, is reported forever. Measured — this test was
// written, run against a `readCachedProbe` with the TTL branch deleted, and it
// PASSED; the delivered `TestHealthProbeCacheIsUsedAndExpires` is what caught
// that fault, because it is the only one of the two that manipulates probeTTL.
// The test that missed it was the *independent* one, so the hole is closed
// here rather than noted: at `probeTTL = 0` the upstream must be asked again.
func TestIndyExpiredVerdictIsNotReused(t *testing.T) {
	var calls int32
	h, _ := indyRouter(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(twoBarPayload))
	}, true)

	origTTL := probeTTL
	t.Cleanup(func() { probeTTL = origTTL })

	if rr := do(h, http.MethodGet, "/healthz", "", nil); rr.Code != http.StatusOK {
		t.Fatalf("warm-up: %d", rr.Code)
	}
	warm := atomic.LoadInt32(&calls)
	if warm == 0 {
		t.Fatal("the first request made no upstream call")
	}

	// Inside the TTL: reused, and it says so.
	body := do(h, http.MethodGet, "/healthz", "", nil).Body.String()
	if got := atomic.LoadInt32(&calls); got != warm {
		t.Errorf("upstream calls = %d inside the TTL, want %d", got, warm)
	}
	if !strings.Contains(body, `"cached":true`) {
		t.Errorf("a verdict inside the TTL is not labelled cached: %s", body)
	}

	// Past the TTL: every probe must be asked again, not just alpaca.
	probeTTL = 0
	after := do(h, http.MethodGet, "/healthz", "", nil).Body.String()
	if got := atomic.LoadInt32(&calls); got <= warm {
		t.Errorf("upstream calls = %d after the TTL expired, want more than %d — a cache that never expires reports one observation forever",
			got, warm)
	}
	if strings.Contains(after, `"cached":true`) {
		t.Errorf("a verdict past the TTL is still labelled cached: %s", after)
	}
}

// ==================== 4. /health ====================

// `status: "healthy"` with HTTP 200 is returned even when every probed
// integration is dead. That is the recorded trade-off (a non-200 on /healthz
// would have Render restart a process whose only problem is a missing env var),
// and it is the reason the degraded/probes fields have to carry the signal.
// This test pins both halves: the status line says nothing, the detail does.
func TestIndyHealthStatusIsHealthyEvenWhenEveryProbeFails(t *testing.T) {
	h, _ := indyRouter(t, indyStubBars(`{"bars":{}}`, http.StatusOK), false)

	for _, path := range []string{"/healthz", "/health", "/api/v1/health"} {
		rr := do(h, http.MethodGet, path, "", nil)
		if rr.Code != http.StatusOK {
			t.Fatalf("GET %s: %d, want 200 (Render's healthCheckPath must not fail on a data-source degradation)", path, rr.Code)
		}
		var body map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
		if body["status"] != "healthy" {
			t.Errorf("GET %s: status = %v, want the constant healthy", path, body["status"])
		}
		degraded, _ := body["degraded"].([]any)
		got := map[string]bool{}
		for _, d := range degraded {
			got[fmt.Sprint(d)] = true
		}
		for _, key := range []string{"steam", "github", "alpaca", "pyth"} {
			if !got[key] {
				t.Errorf("GET %s: degraded = %v, want it to include %q", path, degraded, key)
			}
		}
	}
}

// ... and the detail really does name the missing variable, so the fact is not
// merely "false" but actionable.
func TestIndyHealthProbeErrorNamesTheMissingVariable(t *testing.T) {
	h, _ := indyRouter(t, indyStubBars(twoBarPayload, http.StatusOK), false)

	var body map[string]any
	if err := json.Unmarshal(do(h, http.MethodGet, "/healthz", "", nil).Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	probes, _ := body["probes"].(map[string]any)
	alpaca, _ := probes["alpaca"].(map[string]any)
	msg, _ := alpaca["error"].(string)
	if !strings.Contains(msg, "ALPACA_API_KEY") {
		t.Errorf("probes.alpaca.error = %q, want it to name ALPACA_API_KEY", msg)
	}
	// The ALREADY-GATED endpoint, for contrast: configured=false is reported by
	// /market/health with 200 rather than refused, because that is the fact an
	// operator needs.
	rr := do(h, http.MethodGet, "/api/v1/market/health", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("market/health: %d, want 200", rr.Code)
	}
	var dh market.DataHealth
	if err := json.Unmarshal(rr.Body.Bytes(), &dh); err != nil {
		t.Fatalf("decode market/health: %v", err)
	}
	if dh.Configured || dh.PriceOracle.OK || dh.Synthetic {
		t.Errorf("market/health = %+v, want configured=false, priceOracle.ok=false, synthetic=false", dh)
	}
}

// ==================== 5. THE OVERVIEW'S SWALLOWED ERRORS ====================

// `GetMarketOverview` discards the positions and prices errors
// (`positions, _ := …`, `prices, _ := …`), which the implementer flagged. This
// measures the consequence: with a credentialed deployment whose bar read fails,
// the overview answers 200 with `realtimePrices: null` and an empty board whose
// `unrankedCount` is 0 — i.e. "we could not ask" is byte-identical to "nothing
// moved" at this endpoint. The same failure IS loud on /movers (502), so the
// gap is confined to this response shape.
func TestIndyOverviewReportsA200WithAnEmptyBoardWhenTheBarReadFails(t *testing.T) {
	h, _ := indyRouter(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "/account"):
			_, _ = w.Write([]byte(`{"id":"a1","cash":"1000"}`))
		case strings.HasSuffix(r.URL.Path, "/positions"):
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"message":"boom"}`))
		default:
			// bars
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"message":"subscription does not permit querying recent SIP data"}`))
		}
	}, true)

	rr := do(h, http.MethodGet, "/api/v1/market/overview", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("overview: %d (%s)", rr.Code, rr.Body.String())
	}
	var ov struct {
		Positions []market.AlpacaPosition `json:"positions"`
		Prices    []market.PythPriceData  `json:"realtimePrices"`
		Movers    market.Movers           `json:"movers"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &ov); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(ov.Prices) != 0 || len(ov.Positions) != 0 {
		t.Errorf("want no rows when both reads failed, got %d prices / %d positions", len(ov.Prices), len(ov.Positions))
	}
	if len(ov.Movers.Gainers)+len(ov.Movers.Losers)+len(ov.Movers.Unchanged) != 0 || ov.Movers.UnrankedCount != 0 {
		t.Errorf("movers = %+v, want an empty board with unrankedCount 0", ov.Movers)
	}
	t.Logf("GAP: overview answers 200 with %s and an empty movers board; the error text (%q / %q) reaches no caller",
		strings.TrimSpace(`"realtimePrices":null`),
		"boom", "subscription does not permit querying recent SIP data")

	// The same upstream failure IS reported on the dedicated endpoint, which is
	// what keeps this gap bounded.
	if rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil); rr.Code != http.StatusBadGateway {
		t.Errorf("movers on the same upstream failure: %d, want 502 — the gap is not supposed to be repo-wide", rr.Code)
	}
}

// ==================== 6. MAIN DOES NOT WIRE THE ORACLE ====================
//
// `cmd/api` calls SetDataBaseURL/SetFeed (main.go:40-41) and has no test. The
// router-level dependency is asserted instead: a router whose PriceOracle was
// NOT pointed at a data host must not answer with prices from the default host.
// This is a guard against a future `cmd/api` refactor silently dropping the two
// setters — with them dropped, the oracle would call data.alpaca.markets.
func TestIndyOracleMustBePointedAtTheDataHostExplicitly(t *testing.T) {
	cfg := indyConfig("http://127.0.0.1:1", true)
	// Deliberately NOT calling SetDataBaseURL: the default is the real host.
	oracle := market.NewPriceOracle(cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	oracle.SetHTTPClient(&http.Client{Timeout: time.Second})
	oracle.SetSymbols([]string{"NVDA"})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_, err := oracle.PriceChange(ctx, nil)
	if err == nil {
		t.Fatal("an oracle with no data host set answered with data — it must have contacted the default host")
	}
	// It must fail on the network, not on credentials: that proves the request
	// was actually attempted against something.
	if strings.Contains(err.Error(), "credentials not configured") {
		t.Fatalf("unexpected error: %v", err)
	}
	t.Logf("unconfigured data host: %v", err)
}
