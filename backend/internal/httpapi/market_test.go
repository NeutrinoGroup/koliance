package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sort"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/koliance/backend/internal/agentcard"
	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/market"
)

// These tests pin the two things issue #14 and issue #16 are about:
//
//  1. /api/v1/market/* answers with real upstream data or a 503 — never with
//     numbers produced locally. The negative case (no credentials) is the one
//     that must be aggressively checked, because a fabricated fallback would
//     look *identical* to a working deployment from the outside.
//  2. /health's integration keys are the outcome of a probe. The old code
//     returned a literal `true` for alpaca/pyth/steam/github, so a dead
//     upstream reported healthy forever.
//
// Every upstream here is an httptest server, so the suite is hermetic: no test
// in this file depends on the network, and "upstream is down" is expressed by a
// closed port rather than by hoping the real API fails.

// marketDeps wires the router against stub upstreams.
type marketDeps struct {
	apiURL   string // stands in for paper-api.alpaca.markets
	dataURL  string // stands in for data.alpaca.markets
	override func(*config.Config)
}

func newMarketRouter(t *testing.T, d marketDeps) http.Handler {
	t.Helper()

	// The other three probes are pointed at a dead port: only alpaca is under
	// test, and its outcome must not depend on Steam/GitHub/Hermes being up.
	origSteam, origGitHub := steamProbeBaseURL, githubProbeBaseURL
	steamProbeBaseURL, githubProbeBaseURL = "http://127.0.0.1:1", "http://127.0.0.1:1"
	t.Cleanup(func() { steamProbeBaseURL, githubProbeBaseURL = origSteam, origGitHub })

	cfg := &config.Config{
		SteamDomain:        "koliance.oodai.space",
		MonadChainID:       "10143",
		CORSAllowedOrigins: config.ParseOrigins(config.DefaultCORSOrigins),
		APIToken:           opToken,
		PythHermesURL:      "http://127.0.0.1:1",
		AlpacaBaseURL:      d.apiURL,
		AlpacaDataURL:      d.dataURL,
		AlpacaDataFeed:     "iex",
	}
	if d.override != nil {
		d.override(cfg)
	}

	// A cached probe from another test would change this test's verdict.
	probeCache.Lock()
	probeCache.entries = map[string]cachedProbe{}
	probeCache.Unlock()

	alp := market.NewAlpacaClient(cfg.AlpacaBaseURL, cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	oracle := market.NewPriceOracle(cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	oracle.SetDataBaseURL(cfg.AlpacaDataURL)
	oracle.SetFeed(cfg.AlpacaDataFeed)
	oracle.SetSymbols([]string{"NVDA", "TSLA"})

	return NewRouter(Deps{
		Cfg: cfg,
		// Wired exactly as cmd/api does. A nil here would make every
		// /api/v1/agentcard/* handler panic, and services.agentcard reports that
		// fact — so the stub router has to carry it (docs/changes/034 §2).
		Cards:       agentcard.NewService(agentcard.NewPermissionGuard(), nil),
		Market:      market.NewService(alp, oracle, nil),
		PriceOracle: oracle,
	})
}

const twoBarPayload = `{"bars":{
	"NVDA":[{"t":"2026-10-09T04:00:00Z","c":150.0},{"t":"2026-10-08T04:00:00Z","c":140.0}],
	"TSLA":[{"t":"2026-10-09T04:00:00Z","c":240.0},{"t":"2026-10-08T04:00:00Z","c":250.0}]
}}`

func withCreds(c *config.Config) {
	c.AlpacaAPIKey = "test-key"
	c.AlpacaAPISecret = "test-secret"
}

// ==================== FAIL CLOSED WITHOUT CREDENTIALS ====================

// jsonTree decodes a body with numbers kept in their literal form and returns
// the value together with every JSON number reachable in it, as text.
//
// Numbers are collected from the *parsed tree*, so a number nested inside an
// object or an array is seen; a `json.Unmarshal` into a struct would lose both
// the unknown keys and the literals.
func jsonTree(t *testing.T, label string, body []byte) (any, []string) {
	t.Helper()
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		t.Fatalf("%s: body is not JSON: %v (%s)", label, err, string(body))
	}
	var nums []string
	var walk func(any)
	walk = func(x any) {
		switch n := x.(type) {
		case json.Number:
			nums = append(nums, n.String())
		case map[string]any:
			for _, e := range n {
				walk(e)
			}
		case []any:
			for _, e := range n {
				walk(e)
			}
		}
	}
	walk(v)
	sort.Strings(nums)
	return v, nums
}

// assertRefusal pins the shape of a refusal: exactly one top-level key `error`,
// whose value is a plain string naming the missing configuration, and no JSON
// number anywhere in the body.
//
// Why the shape and not a word list: the defect issue #14 guards against is a
// refusal that still carries a quote. `lastKnownRegularMarketPrice`,
// `realtimePrices`, `gainers`, `meta` — any key at all — is that defect, and
// enumerating the ones we happened to think of cannot catch the one we did not.
// The `error` value must be a string for the same reason: a raw number would be
// a price with a reassuring label, and a number embedded in the message text
// would be a price wearing a sentence. That second half is not a comment — it
// is asserted, by `priceShapedInText` just below. (It used to be only a
// comment, and the claim outran the code; see docs/changes/034 §1.)
// priceShapedInText matches a number in an error MESSAGE that a price could be
// read off, as opposed to a digit an operator's prose may legitimately carry.
//
// It exists to make the assertion below real rather than aspirational: the
// first version of `assertRefusal` documented "a number embedded in the message
// text would be a price wearing a sentence" while asserting only that the
// `error` value was a JSON *string* — which a refusal carrying
// "…(last known NVDA close 999.99)" satisfies exactly. Measured: that injection
// left the whole suite green (docs/changes/034 §4.1).
//
// The alternation is a property, not a word list. A word list cannot catch the
// price we did not think of (docs/changes/030 §2):
//
//	\d+\.\d{2,}  a decimal with two or more places — 999.99, 7.1429, 1.0013
//	\d{3,}       three or more consecutive digits     — 150, 999, 1042
//
// Deliberately NOT matched: `2/2`, single digits, and one-decimal fractions.
// Legitimate operator prose uses those ("probe failed after 4s"), and refusing
// a refusal only because it is informative would be the wrong trade. The
// refusal strings in this package carry no digits at all — they name
// ALPACA_API_KEY / ALPACA_API_SECRET — so the narrow form costs nothing.
var priceShapedInText = regexp.MustCompile(`\d+\.\d{2,}|\d{3,}`)

func assertRefusal(t *testing.T, label string, body []byte) {
	t.Helper()

	v, nums := jsonTree(t, label, body)
	obj, isObj := v.(map[string]any)
	if !isObj {
		t.Errorf("%s: refusal body is a %T, want a JSON object: %s", label, v, string(body))
	} else {
		keys := make([]string, 0, len(obj))
		for k := range obj {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		if len(keys) != 1 || keys[0] != "error" {
			t.Errorf("%s: top-level keys = %v, want exactly [error] — a refusal is an error and nothing else", label, keys)
		}
		if e, present := obj["error"]; present {
			if _, isString := e.(string); !isString {
				t.Errorf("%s: error = %#v, want a string", label, e)
			} else if m := priceShapedInText.FindString(e.(string)); m != "" {
				t.Errorf("%s: error message contains %q — a price hidden in a refusal's own prose is still a price served without a source: %s",
					label, m, string(body))
			}
		}
	}

	// Checked outside the object branch: a top-level array of quotes is not a
	// refusal either, and its numbers must still be reported. (Guarding both
	// checks behind one condition and shadowing `nums` inside it is how this
	// kind of assertion goes blind.)
	if len(nums) != 0 {
		t.Errorf("%s: refusal body carries JSON number(s) %v — a refusal carries no number", label, nums)
	}

	// The refusal still has to be actionable: #14 is about not inventing data,
	// not about hiding why there is none. Asserted as a property (some error
	// message names the variable) rather than as the exact `jsonError` wording.
	var payload struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &payload); err != nil || !strings.Contains(payload.Error, "ALPACA_API_KEY") {
		t.Errorf("%s: refusal does not name the missing configuration: %s", label, body)
	}
}

// The headline negative judgement for issue #14. Asserts the status AND the
// shape of the body: a 503 whose body still carried a price series — or a
// single price field — would pass a status-only check and be exactly the
// defect.
func TestMarketReadEndpointsRefuseWithoutCredentials(t *testing.T) {
	proxied := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		proxied = true // a call here would mean the gate let it through
		_, _ = w.Write([]byte(twoBarPayload))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL}) // no credentials

	for _, path := range []string{
		"/api/v1/market/overview",
		"/api/v1/market/prices",
		"/api/v1/market/movers",
	} {
		rr := do(h, http.MethodGet, path, "", nil)
		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("GET %s without credentials: %d, want 503", path, rr.Code)
		}
		assertRefusal(t, "GET "+path, rr.Body.Bytes())
	}
	if proxied {
		t.Error("an upstream request was made although no credentials are configured")
	}
}

// Positive control for the shape assertion above: it must be able to see a
// payload when there is one, or "no keys, no numbers" would also be its verdict
// on a measurement that reads nothing at all — the trap the progress-page hook
// and the empty-denominator coverage record describe (AGENTS.md §8).
func TestRefusalShapeMeasurementSeesARealPayload(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(twoBarPayload))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	rr := do(h, http.MethodGet, "/api/v1/market/prices", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("prices with credentials: %d (%s)", rr.Code, rr.Body.String())
	}
	// /prices is a JSON array, /movers an object: the measurement must see the
	// numbers in both shapes, so it is exercised on both.
	for _, path := range []string{"/api/v1/market/prices", "/api/v1/market/movers"} {
		body := do(h, http.MethodGet, path, "", nil).Body.Bytes()
		v, nums := jsonTree(t, "control "+path, body)
		if len(nums) == 0 {
			t.Errorf("control %s: no JSON number found in a body that quotes two instruments (%T) — the measurement is blind", path, v)
		} else {
			t.Logf("control %s: %T numbers=%v", path, v, nums)
		}
	}
}

// Half a credential set is not configured. This is the case a check on "is any
// credential present" would wave through.
func TestMarketReadEndpointsRefuseWithOnlyOneCredential(t *testing.T) {
	h := newMarketRouter(t, marketDeps{
		apiURL:  "http://127.0.0.1:1",
		dataURL: "http://127.0.0.1:1",
		override: func(c *config.Config) {
			c.AlpacaAPIKey = "test-key" // secret deliberately absent
		},
	})

	rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("with only ALPACA_API_KEY set: %d, want 503", rr.Code)
	}
}

// /api/v1/market/health is the one market endpoint that is NOT gated: its whole
// purpose is to report the unconfigured state as a fact.
func TestMarketHealthReportsUnconfiguredInsteadOfRefusing(t *testing.T) {
	h := newMarketRouter(t, marketDeps{apiURL: "http://127.0.0.1:1", dataURL: "http://127.0.0.1:1"})

	rr := do(h, http.MethodGet, "/api/v1/market/health", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("market/health: %d, want 200 (it must be able to report the absence)", rr.Code)
	}
	var body market.DataHealth
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Configured {
		t.Error("configured = true without credentials")
	}
	if body.PriceOracle.OK {
		t.Error("priceOracle.ok = true without credentials")
	}
	if !strings.Contains(body.PriceOracle.Error, "ALPACA_API_KEY") {
		t.Errorf("priceOracle.error = %q, want the missing variable names", body.PriceOracle.Error)
	}
}

// ==================== REAL DATA PASSTHROUGH ====================

func TestMarketPricesProxyTheUpstreamNumbers(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(twoBarPayload))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	rr := do(h, http.MethodGet, "/api/v1/market/prices", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("prices: %d %s", rr.Code, rr.Body.String())
	}
	var prices []market.PythPriceData
	if err := json.Unmarshal(rr.Body.Bytes(), &prices); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(prices) != 2 || prices[0].Symbol != "NVDA" {
		t.Fatalf("prices = %+v, want NVDA first (sorted)", prices)
	}
	// The numbers must be the upstream's, not a generated series.
	if prices[0].Price != 150.0 || prices[0].PreviousClose != 140.0 || prices[0].ChangePercent != 7.1429 {
		t.Errorf("NVDA = %+v, want 150/140/+7.1429%%", prices[0])
	}
	if prices[0].Synthetic {
		t.Error("synthetic = true for a proxied Alpaca bar")
	}
	if prices[0].Source != market.SourceAlpacaBars {
		t.Errorf("source = %q, want %q", prices[0].Source, market.SourceAlpacaBars)
	}
	// The old payload claimed a Pyth confidence of 0.01 that nothing measured.
	if prices[0].Confidence != 0 {
		t.Errorf("confidence = %v, want 0 (Alpaca publishes none)", prices[0].Confidence)
	}
}

func TestMarketMoversRanksTheUpstreamChanges(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(twoBarPayload))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("movers: %d %s", rr.Code, rr.Body.String())
	}
	var movers market.Movers
	if err := json.Unmarshal(rr.Body.Bytes(), &movers); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(movers.Gainers) != 1 || movers.Gainers[0].Symbol != "NVDA" {
		t.Errorf("gainers = %+v", movers.Gainers)
	}
	if len(movers.Losers) != 1 || movers.Losers[0].Symbol != "TSLA" {
		t.Errorf("losers = %+v", movers.Losers)
	}
	if movers.Synthetic || movers.Source != market.SourceAlpacaBars {
		t.Errorf("provenance = %q synthetic=%v", movers.Source, movers.Synthetic)
	}
}

// Two identical requests must produce identical bytes. The upstream payload is
// a JSON object keyed by symbol, so anything that leaks Go's map iteration
// order into the response would make the leaderboard reshuffle on refresh.
func TestMarketMoversIsStableAcrossRequests(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(twoBarPayload))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	first := do(h, http.MethodGet, "/api/v1/market/movers", "", nil).Body.String()
	for i := 0; i < 10; i++ {
		if got := do(h, http.MethodGet, "/api/v1/market/movers", "", nil).Body.String(); got != first {
			t.Fatalf("round %d: body changed\n first=%s\n  got =%s", i, first, got)
		}
	}
}

// An empty upstream is a 200 with empty boards, and it must not be mistaken for
// a failure — the probe reports that case, this endpoint is just data.
func TestMarketMoversReturnsEmptyBoardsForAnEmptyUpstream(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"bars":{}}`))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("movers: %d %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"gainers":[]`) {
		t.Errorf("body = %s, want an empty gainers array (not null)", rr.Body.String())
	}
	var movers market.Movers
	_ = json.Unmarshal(rr.Body.Bytes(), &movers)
	if movers.UnrankedCount != 2 {
		t.Errorf("unrankedCount = %d, want 2 (both symbols had no bar)", movers.UnrankedCount)
	}
}

func TestMarketPricesDistinguishAbsentSymbolFromUpstreamFailure(t *testing.T) {
	status := http.StatusOK
	body := `{"bars":{"NVDA":[{"t":"2026-10-09T04:00:00Z","c":150}]}}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	// No bar for this symbol: the caller asked for something we do not have.
	if rr := do(h, http.MethodGet, "/api/v1/market/prices?symbol=TSLA", "", nil); rr.Code != http.StatusNotFound {
		t.Errorf("absent symbol: %d, want 404 (%s)", rr.Code, rr.Body.String())
	}

	// The upstream being broken is not the caller's fault, and must not be
	// reported as "not found".
	status = http.StatusForbidden
	body = `{"message":"subscription does not permit querying recent SIP data"}`
	if rr := do(h, http.MethodGet, "/api/v1/market/prices?symbol=NVDA", "", nil); rr.Code != http.StatusBadGateway {
		t.Errorf("upstream 403: %d, want 502 (%s)", rr.Code, rr.Body.String())
	}
	if rr := do(h, http.MethodGet, "/api/v1/market/prices", "", nil); rr.Code != http.StatusBadGateway {
		t.Errorf("upstream 403 (list): %d, want 502", rr.Code)
	}
	if rr := do(h, http.MethodGet, "/api/v1/market/movers", "", nil); rr.Code != http.StatusBadGateway {
		t.Errorf("upstream 403 (movers): %d, want 502", rr.Code)
	}
	if rr := do(h, http.MethodGet, "/api/v1/market/overview", "", nil); rr.Code != http.StatusInternalServerError {
		t.Errorf("upstream 403 (overview): %d, want 500 (the account call is required)", rr.Code)
	}
}

// ==================== TRADE / CLOSE (misconfiguration is not a rejection) ====================

func TestTradeAndCloseReportMissingCredentialsAs503(t *testing.T) {
	// DemoPublicTrading opens the auth gate so the credential path is what is
	// actually under test.
	h := newMarketRouter(t, marketDeps{
		apiURL:   "http://127.0.0.1:1",
		dataURL:  "http://127.0.0.1:1",
		override: func(c *config.Config) { c.DemoPublicTrading = true },
	})

	rr := do(h, http.MethodPost, "/api/v1/market/trade",
		`{"symbol":"NVDA","side":"buy","notionalUSD":100,"leverage":1}`, nil)
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("trade without credentials: %d, want 503 (%s)", rr.Code, rr.Body.String())
	}
	// Same shape as the read endpoints: a fill price or a qty would be a number
	// this deployment never observed. Asserted on the body, not only on the
	// status — the response is the thing a client renders.
	assertRefusal(t, "POST /api/v1/market/trade", rr.Body.Bytes())
	// The old shape was a 200 carrying `success:false`, which reads as "the
	// broker rejected the order".
	if strings.Contains(rr.Body.String(), `"success"`) {
		t.Errorf("body = %s, want a plain error rather than an order result", rr.Body.String())
	}

	rr = do(h, http.MethodPost, "/api/v1/market/close", `{"symbol":"NVDA"}`, nil)
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("close without credentials: %d, want 503", rr.Code)
	}
	assertRefusal(t, "POST /api/v1/market/close", rr.Body.Bytes())
}

// Validation must still bite before anything credential-related is considered:
// a malformed request is the caller's error regardless of configuration.
func TestTradeValidationStillAnswers400WithoutCredentials(t *testing.T) {
	h := newMarketRouter(t, marketDeps{
		apiURL:   "http://127.0.0.1:1",
		dataURL:  "http://127.0.0.1:1",
		override: func(c *config.Config) { c.DemoPublicTrading = true },
	})

	for _, body := range []string{
		`{"symbol":"NVDA","side":"hold","notionalUSD":100,"leverage":1}`,
		`{"symbol":"../x","side":"buy","notionalUSD":100,"leverage":1}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":50000,"leverage":4}`,
	} {
		if rr := do(h, http.MethodPost, "/api/v1/market/trade", body, nil); rr.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", body, rr.Code)
		}
	}
}

// ==================== /health PROBES (GAP-13) ====================

func decodeHealth(t *testing.T, rr *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var body map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode health: %v (%s)", err, rr.Body.String())
	}
	return body
}

func serviceFlag(t *testing.T, body map[string]interface{}, key string) bool {
	t.Helper()
	services, ok := body["services"].(map[string]interface{})
	if !ok {
		t.Fatalf("no services object in %v", body)
	}
	v, ok := services[key]
	if !ok {
		t.Fatalf("service %q missing from %v", key, services)
	}
	return v.(bool)
}

// The negative direction of GAP-13: with credentials configured but a dead
// upstream, `alpaca` must be false. The old implementation returned a literal
// true here — this assertion is what makes the difference observable.
func TestHealthReportsAlpacaFalseWhenTheUpstreamIsDead(t *testing.T) {
	h := newMarketRouter(t, marketDeps{
		apiURL:   "http://127.0.0.1:1",
		dataURL:  "http://127.0.0.1:1",
		override: withCreds,
	})

	rr := do(h, http.MethodGet, "/healthz", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("healthz: %d, want 200 (see the handler's comment on healthCheckPath)", rr.Code)
	}
	body := decodeHealth(t, rr)
	if serviceFlag(t, body, "alpaca") {
		t.Error("services.alpaca = true although the data upstream is unreachable")
	}

	degraded, _ := body["degraded"].([]interface{})
	found := false
	for _, d := range degraded {
		if d == "alpaca" {
			found = true
		}
	}
	if !found {
		t.Errorf("degraded = %v, want it to list alpaca", degraded)
	}
	// There must be evidence attached, or a false verdict is unauditable.
	probes, _ := body["probes"].(map[string]interface{})
	alpaca, _ := probes["alpaca"].(map[string]interface{})
	if msg, _ := alpaca["error"].(string); msg == "" {
		t.Errorf("probes.alpaca carries no error: %v", alpaca)
	}
}

// The positive direction: with a reachable upstream the same key must be true,
// and it must come with the evidence that made it true. Without this half, the
// test above would pass on an implementation that always answers false.
func TestHealthReportsAlpacaTrueOnlyWhenABarIsActuallyRead(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(twoBarPayload))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	rr := do(h, http.MethodGet, "/api/v1/health", "", nil)
	body := decodeHealth(t, rr)

	if !serviceFlag(t, body, "alpaca") {
		t.Errorf("services.alpaca = false although bars were readable: %v", body["probes"])
	}
	probes, _ := body["probes"].(map[string]interface{})
	alpaca, _ := probes["alpaca"].(map[string]interface{})
	if detail, _ := alpaca["detail"].(string); !strings.Contains(detail, "2/2 instruments") {
		t.Errorf("probes.alpaca.detail = %q, want the instrument count", detail)
	}
}

// The 200-with-no-bars trap: reachable, credentialed, and useless. A probe that
// only checks the HTTP status reports healthy here.
func TestHealthReportsAlpacaFalseOnAnEmptyBarsPayload(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"bars":{}}`))
	}))
	t.Cleanup(srv.Close)

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	body := decodeHealth(t, do(h, http.MethodGet, "/healthz", "", nil))
	if serviceFlag(t, body, "alpaca") {
		t.Error("services.alpaca = true on HTTP 200 with an empty bars object")
	}
}

// Without credentials the probe must say false rather than staying silent, and
// it must say why.
func TestHealthReportsAlpacaFalseWithoutCredentials(t *testing.T) {
	h := newMarketRouter(t, marketDeps{apiURL: "http://127.0.0.1:1", dataURL: "http://127.0.0.1:1"})

	body := decodeHealth(t, do(h, http.MethodGet, "/api/v1/health", "", nil))
	if serviceFlag(t, body, "alpaca") {
		t.Error("services.alpaca = true without credentials")
	}
	probes, _ := body["probes"].(map[string]interface{})
	alpaca, _ := probes["alpaca"].(map[string]interface{})
	if msg, _ := alpaca["error"].(string); !strings.Contains(msg, "ALPACA_API_KEY") {
		t.Errorf("probes.alpaca.error = %q, want the missing variable names", msg)
	}
}

// Every key in the services map that is not derived from local state must be
// backed by a probe. `pyth` pointed at a dead port is the check that the v1
// hardcoded `true` is gone from this key too.
func TestHealthProbesEveryRemoteIntegration(t *testing.T) {
	h := newMarketRouter(t, marketDeps{apiURL: "http://127.0.0.1:1", dataURL: "http://127.0.0.1:1", override: withCreds})

	body := decodeHealth(t, do(h, http.MethodGet, "/healthz", "", nil))
	for _, key := range []string{"steam", "github", "alpaca", "pyth"} {
		if serviceFlag(t, body, key) {
			t.Errorf("services.%s = true although its upstream is unreachable", key)
		}
	}
	// Local/configuration-derived keys are unchanged and stay honest: no Stripe
	// key and no database are configured in this test.
	if serviceFlag(t, body, "stripe") {
		t.Error("services.stripe = true with no STRIPE_SECRET_KEY")
	}
	if serviceFlag(t, body, "database") {
		t.Error("services.database = true with no database")
	}
}

// The fifth literal `true`: `services.agentcard` was a constant, so replacing it
// with an unrelated expression (`cfg.StripeSecretKey != ""`) left every test
// green. This is the judgement that notices.
//
// Both directions, because a one-directional assertion is satisfied by a
// constant of the right polarity — the same defect wearing a different value.
// The positive half is also the reason the key stays in `services` at all:
// `agentcard` is a LOCAL module with no upstream, so it must not be smuggled
// into `probes` (which would fabricate a probe), but its absence would be a nil
// dereference on every /api/v1/agentcard/* route.
//
// The second case deliberately configures Stripe: it pins that the two keys are
// not the same fact, so the flag cannot be re-derived from a neighbour's
// expression and still pass.
func TestHealthAgentcardFlagFollowsTheWiring(t *testing.T) {
	t.Run("wired service reports true", func(t *testing.T) {
		h := newMarketRouter(t, marketDeps{apiURL: "http://127.0.0.1:1", dataURL: "http://127.0.0.1:1"})

		if !serviceFlag(t, decodeHealth(t, do(h, http.MethodGet, "/healthz", "", nil)), "agentcard") {
			t.Error("services.agentcard = false although Deps.Cards is wired into the router")
		}
	})

	t.Run("absent service reports false even with Stripe configured", func(t *testing.T) {
		// Same hermeticity rule as newMarketRouter: the two probes that take no
		// cfg are pointed at a dead port, so this case never touches the network.
		origSteam, origGitHub := steamProbeBaseURL, githubProbeBaseURL
		steamProbeBaseURL, githubProbeBaseURL = "http://127.0.0.1:1", "http://127.0.0.1:1"
		t.Cleanup(func() { steamProbeBaseURL, githubProbeBaseURL = origSteam, origGitHub })

		cfg := &config.Config{
			CORSAllowedOrigins: config.ParseOrigins(config.DefaultCORSOrigins),
			APIToken:           opToken,
			PythHermesURL:      "http://127.0.0.1:1",
			AlpacaBaseURL:      "http://127.0.0.1:1",
			AlpacaDataURL:      "http://127.0.0.1:1",
			StripeSecretKey:    "sk_test_not_a_probe_for_agentcard",
		}
		oracle := market.NewPriceOracle("", "")
		oracle.SetSymbols([]string{"NVDA"})

		probeCache.Lock()
		probeCache.entries = map[string]cachedProbe{}
		probeCache.Unlock()

		// Cards is deliberately nil. Every /api/v1/agentcard/* handler would
		// panic on the nil dereference, so `/health` must not advertise it.
		h := NewRouter(Deps{
			Cfg:         cfg,
			Market:      market.NewService(market.NewAlpacaClient(cfg.AlpacaBaseURL, "", ""), oracle, nil),
			PriceOracle: oracle,
		})

		body := decodeHealth(t, do(h, http.MethodGet, "/healthz", "", nil))
		if serviceFlag(t, body, "agentcard") {
			t.Error("services.agentcard = true although Deps.Cards is nil — the flag is not derived from the wiring")
		}
		// ... while the key next to it is true for its own, documented reason.
		if !serviceFlag(t, body, "stripe") {
			t.Error("services.stripe = false although STRIPE_SECRET_KEY is set — the two keys are not the same fact, and this test cannot tell a swapped expression from a correct one unless both are pinned")
		}
	})
}

// The probe is cached for probeTTL, and the cache must expire. A cache that
// never expires reports a failure forever after one bad minute — the same class
// of defect as the hardcoded `true`, pointing the other way.
func TestHealthProbeCacheIsUsedAndExpires(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		_, _ = w.Write([]byte(twoBarPayload))
	}))
	t.Cleanup(srv.Close)

	origTTL := probeTTL
	t.Cleanup(func() { probeTTL = origTTL })

	h := newMarketRouter(t, marketDeps{apiURL: srv.URL, dataURL: srv.URL, override: withCreds})

	decodeHealth(t, do(h, http.MethodGet, "/healthz", "", nil))
	first := atomic.LoadInt32(&calls)
	if first == 0 {
		t.Fatal("the first request made no upstream call")
	}

	// Second request inside the TTL: served from cache, no new upstream call,
	// and it says so.
	body := decodeHealth(t, do(h, http.MethodGet, "/healthz", "", nil))
	if got := atomic.LoadInt32(&calls); got != first {
		t.Errorf("upstream calls = %d after a cached request, want %d", got, first)
	}
	probes, _ := body["probes"].(map[string]interface{})
	alpaca, _ := probes["alpaca"].(map[string]interface{})
	if cached, _ := alpaca["cached"].(bool); !cached {
		t.Errorf("probes.alpaca.cached = false on a cached verdict: %v", alpaca)
	}

	// Past the TTL: probed again.
	probeTTL = 0
	decodeHealth(t, do(h, http.MethodGet, "/healthz", "", nil))
	if got := atomic.LoadInt32(&calls); got <= first {
		t.Errorf("upstream calls = %d after the TTL expired, want more than %d", got, first)
	}
}
