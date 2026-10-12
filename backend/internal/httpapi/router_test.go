package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/koliance/backend/internal/agentcard"
	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/developer"
	"github.com/koliance/backend/internal/game"
	"github.com/koliance/backend/internal/market"
	"github.com/koliance/backend/internal/platform/database"
	"github.com/koliance/backend/internal/platform/stripeclient"
	"github.com/koliance/backend/internal/verifier"
)

const opToken = "test-operator-token"

// testDB returns a database handle that stands in for a live PostgreSQL pool.
//
// It is a MemoryStore marked connected: the routes behind withDB only need to
// know a durable store exists. database.New can no longer hand back a
// memory-backed handle by accident (GAP-49) - reaching the in-memory store now
// takes an explicit NewMemoryOnly() call, which is exactly what a test is.
func testDB() *database.DB {
	db := database.NewMemoryOnly()
	db.IsConnected = true
	return db
}

// newTestRouter builds the router with real services but unreachable
// upstreams. Every test below fails (or succeeds) before any network call.
func newTestRouter(t testing.TB, mutate func(*Deps)) http.Handler {
	t.Helper()
	// The health probes would otherwise call Steam, GitHub, Alpaca and Hermes on
	// every /health request. Pointing them at a closed local port makes the
	// suite hermetic and makes "unreachable" the deterministic outcome (i.e.
	// every probe reports false), rather than whatever the network happens to
	// answer from CI.
	origSteam, origGitHub := steamProbeBaseURL, githubProbeBaseURL
	steamProbeBaseURL, githubProbeBaseURL = "http://127.0.0.1:1", "http://127.0.0.1:1"
	t.Cleanup(func() { steamProbeBaseURL, githubProbeBaseURL = origSteam, origGitHub })

	cfg := &config.Config{
		SteamDomain:        "koliance.oodai.space",
		MonadChainID:       "10143",
		CORSAllowedOrigins: config.ParseOrigins(config.DefaultCORSOrigins),
		APIToken:           opToken,
	}
	d := &Deps{
		Cfg:      cfg,
		DB:       testDB(),
		Game:     game.NewService(game.NewSteamClient(""), nil),
		Cards:    agentcard.NewService(agentcard.NewPermissionGuard(), nil),
		Verifier: verifier.NewNoop(),
	}
	if mutate != nil {
		mutate(d)
	}
	alp := market.NewAlpacaClient("http://127.0.0.1:1", "k", "s")
	oracle := market.NewPriceOracle("k", "s")
	oracle.SetDataBaseURL("http://127.0.0.1:1")
	// cfg.AlpacaConfigured() gates /api/v1/market/*, and the existing tests below
	// exercise trade *validation*, which must still reach the handler and answer
	// 400. Credentials that point at a dead host keep both properties: the gate
	// opens, and nothing can accidentally succeed against a live upstream.
	if cfg.AlpacaAPIKey == "" && cfg.AlpacaAPISecret == "" {
		cfg.AlpacaAPIKey, cfg.AlpacaAPISecret = "test-key", "test-secret"
	}
	probeCache.Lock()
	probeCache.entries = map[string]cachedProbe{}
	probeCache.Unlock()
	d.Market = market.NewService(alp, oracle, nil)
	d.PriceOracle = oracle
	d.Stripe = stripeclient.New("")
	d.Dev = developer.NewService(developer.NewGitHubClient(""))
	return NewRouter(*d)
}

func do(h http.Handler, method, path, body string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func TestCORSAllowList(t *testing.T) {
	h := newTestRouter(t, nil)
	rr := do(h, http.MethodGet, "/api/v1/stats", "", map[string]string{"Origin": "https://koliance.oodai.space"})
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "https://koliance.oodai.space" {
		t.Errorf("allowed origin not reflected: %q", got)
	}
	rr = do(h, http.MethodGet, "/api/v1/stats", "", map[string]string{"Origin": "https://evil.vercel.app"})
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("disallowed origin got ACAO %q", got)
	}
	rr = do(h, http.MethodOptions, "/api/v1/agentcard/authorize", "", map[string]string{"Origin": "https://evil.example"})
	if rr.Code != http.StatusForbidden {
		t.Errorf("preflight from disallowed origin: %d", rr.Code)
	}
	rr = do(h, http.MethodOptions, "/api/v1/agentcard/authorize", "", map[string]string{"Origin": "http://localhost:3000"})
	if rr.Code != http.StatusNoContent || rr.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("preflight from localhost: %d %v", rr.Code, rr.Header())
	}
	if strings.Contains(rr.Header().Get("Access-Control-Allow-Origin"), "*") {
		t.Errorf("wildcard ACAO")
	}
}

// TestCORSExposesTheRequestIDToCrossOriginScripts pins the half of the CORS
// contract that has nothing to do with Access-Control-Allow-Origin, and which
// therefore survived the allow-list rewrite untouched.
//
// A browser applies two independent rules to a cross-origin response, and a
// server can satisfy either one while failing the other:
//
//	Access-Control-Allow-Headers  — may the script SEND X-Request-Id?
//	Access-Control-Expose-Headers — may the script READ it back?
//
// The middleware in reqlog.go reads the inbound header and sets the outbound
// one, so with neither list naming it the id existed on the wire and was
// unreachable from the only caller that has an Origin. Both directions are
// asserted here, and both are asserted as membership in a comma-separated list
// rather than as a substring — `X-Requested-With` CONTAINS `X-Requested`,
// so a substring check would go green against a list that merely looks close.
func TestCORSExposesTheRequestIDToCrossOriginScripts(t *testing.T) {
	h := newTestRouter(t, nil)

	// A real preflight carries these two headers; without them the request is
	// not a preflight and the browser would never send it.
	rr := do(h, http.MethodOptions, "/api/v1/agentcard/authorize", "", map[string]string{
		"Origin":                        "https://koliance.oodai.space",
		"Access-Control-Request-Method": http.MethodPost,
		"Access-Control-Request-Headers": requestIDHeader,
	})
	if rr.Code != http.StatusNoContent {
		t.Fatalf("preflight from an allowed origin: %d, want 204", rr.Code)
	}
	if !headerListContains(rr.Header().Get("Access-Control-Allow-Headers"), requestIDHeader) {
		t.Errorf("Access-Control-Allow-Headers = %q, does not name %s — a browser will refuse to send the id",
			rr.Header().Get("Access-Control-Allow-Headers"), requestIDHeader)
	}
	if !headerListContains(rr.Header().Get("Access-Control-Expose-Headers"), requestIDHeader) {
		t.Errorf("Access-Control-Expose-Headers = %q, does not name %s — the response header is on the wire and invisible to JS",
			rr.Header().Get("Access-Control-Expose-Headers"), requestIDHeader)
	}

	// The expose list is a response-header rule and applies to the actual
	// request, not only to the preflight. Set on the same branch as ACAO, it
	// must be there on the 200 too, or a client that skipped the preflight
	// (same-origin-ish flows, a cached preflight) reads nothing.
	got := do(h, http.MethodGet, "/api/v1/stats", "", map[string]string{"Origin": "https://koliance.oodai.space"})
	if !headerListContains(got.Header().Get("Access-Control-Expose-Headers"), requestIDHeader) {
		t.Errorf("GET response Access-Control-Expose-Headers = %q, does not name %s",
			got.Header().Get("Access-Control-Expose-Headers"), requestIDHeader)
	}
	if v := got.Header().Get(requestIDHeader); v == "" {
		t.Errorf("the response carries no %s to expose", requestIDHeader)
	}

	// And the negative side: an origin that is not on the allow-list gets none
	// of it. Widening the CORS surface to any origin is the failure mode a
	// "just add the header" change invites.
	denied := do(h, http.MethodGet, "/api/v1/stats", "", map[string]string{"Origin": "https://evil.vercel.app"})
	if v := denied.Header().Get("Access-Control-Expose-Headers"); v != "" {
		t.Errorf("disallowed origin got Access-Control-Expose-Headers %q", v)
	}
}

// headerListContains reports whether a comma-separated header list names want,
// compared case-insensitively because HTTP header names are.
func headerListContains(list, want string) bool {
	for _, f := range strings.Split(list, ",") {
		if strings.EqualFold(strings.TrimSpace(f), want) {
			return true
		}
	}
	return false
}

func TestOperatorEndpointsFailClosed(t *testing.T) {
	noToken := newTestRouter(t, func(d *Deps) { d.Cfg.APIToken = "" })
	for _, p := range []string{"/api/v1/agentcard/batch-settle", "/api/v1/stripe/customer", "/api/v1/market/trade", "/api/v1/market/close"} {
		rr := do(noToken, http.MethodPost, p, `{}`, map[string]string{"Authorization": "Bearer anything"})
		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("%s without configured token: %d, want 503", p, rr.Code)
		}
	}
	h := newTestRouter(t, nil)
	for _, p := range []string{"/api/v1/agentcard/batch-settle", "/api/v1/stripe/customer", "/api/v1/market/trade", "/api/v1/market/close"} {
		if rr := do(h, http.MethodPost, p, `{}`, nil); rr.Code != http.StatusUnauthorized {
			t.Errorf("%s no auth: %d, want 401", p, rr.Code)
		}
		if rr := do(h, http.MethodPost, p, `{}`, map[string]string{"Authorization": "Bearer wrong"}); rr.Code != http.StatusUnauthorized {
			t.Errorf("%s wrong token: %d, want 401", p, rr.Code)
		}
	}
	rr := do(h, http.MethodPost, "/api/v1/agentcard/batch-settle", "", map[string]string{"Authorization": "Bearer " + opToken})
	if rr.Code != http.StatusOK {
		t.Errorf("batch-settle with operator token: %d", rr.Code)
	}
	if rr := do(h, http.MethodGet, "/api/v1/agentcard/batch-settle", "", map[string]string{"Authorization": "Bearer " + opToken}); rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET batch-settle: %d", rr.Code)
	}
}

func TestTradeValidation(t *testing.T) {
	// Public demo trading enabled: auth passes, validation must still bite.
	h := newTestRouter(t, func(d *Deps) { d.Cfg.DemoPublicTrading = true })
	bad := []string{
		`{"symbol":"NVDA","side":"buy","notionalUSD":-100,"leverage":1}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":0,"leverage":1}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":100,"leverage":10}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":50000,"leverage":4}`,
		`{"symbol":"NVDA","side":"hold","notionalUSD":100,"leverage":1}`,
		`{"symbol":"../x","side":"buy","notionalUSD":100,"leverage":1}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":"abc"}`,
	}
	for _, b := range bad {
		if rr := do(h, http.MethodPost, "/api/v1/market/trade", b, nil); rr.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", b, rr.Code)
		}
	}
	if rr := do(h, http.MethodPost, "/api/v1/market/close", `{"symbol":"nv da"}`, nil); rr.Code != http.StatusBadRequest {
		t.Errorf("close bad symbol: %d", rr.Code)
	}
}

func TestStripeCheckoutValidation(t *testing.T) {
	h := newTestRouter(t, nil)
	bad := []string{
		`{"amountCents":-500}`,
		`{"amountCents":0}`,
		`{"amountCents":10}`,
		`{"amountCents":100000000}`,
		`{"amountCents":1000,"currency":"eur"}`,
		`{"amountCents":1000,"successUrl":"https://evil.example/x"}`,
		`{"amountCents":1000,"cancelUrl":"javascript:alert(1)"}`,
	}
	for _, b := range bad {
		if rr := do(h, http.MethodPost, "/api/v1/stripe/checkout-session", b, nil); rr.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", b, rr.Code)
		}
	}
}

func TestSteamProfileShortIDIs400NotPanic(t *testing.T) {
	h := newTestRouter(t, nil)
	rr := do(h, http.MethodGet, "/api/v1/game/steam/profile?id=ab", "", nil)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("?id=ab: %d %s", rr.Code, rr.Body.String())
	}
}

func TestProofInputValidation(t *testing.T) {
	h := newTestRouter(t, nil)
	if rr := do(h, http.MethodPost, "/api/v1/game/proof", `{"steamId":"ab","walletAddress":"0x0000000000000000000000000000000000000001"}`, nil); rr.Code != http.StatusBadRequest {
		t.Errorf("game proof bad id: %d", rr.Code)
	}
	if rr := do(h, http.MethodPost, "/api/v1/developer/github/proof", `{"username":"../../orgs","walletAddress":"0x0000000000000000000000000000000000000001"}`, nil); rr.Code != http.StatusBadRequest {
		t.Errorf("github proof bad user: %d", rr.Code)
	}
	if rr := do(h, http.MethodGet, "/api/v1/developer/github/profile?username=a/b", "", nil); rr.Code != http.StatusBadRequest {
		t.Errorf("github profile bad user: %d", rr.Code)
	}
}

// End-to-end card flow over HTTP: issue, masked lookup, auth on every
// sensitive step, and the -5000 regression.
func TestAgentCardFlow(t *testing.T) {
	h := newTestRouter(t, nil)

	for _, b := range []string{`{"initialDeposit":-5}`, `{"initialDeposit":0}`, `not json`} {
		if rr := do(h, http.MethodPost, "/api/v1/agentcard/generate", b, nil); rr.Code != http.StatusBadRequest {
			t.Errorf("generate %s: %d", b, rr.Code)
		}
	}

	rr := do(h, http.MethodPost, "/api/v1/agentcard/generate", `{"walletAddress":"0x0000000000000000000000000000000000000001","initialDeposit":100}`, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("generate: %d %s", rr.Code, rr.Body.String())
	}
	body := rr.Body.String()
	for _, f := range []string{`"cvv"`, `"cardNumber"`} {
		if strings.Contains(body, f) {
			t.Errorf("generate response exposes %s", f)
		}
	}
	var created struct {
		CardID    string `json:"cardId"`
		CardToken string `json:"cardToken"`
		Last4     string `json:"last4"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &created)
	if created.CardToken == "" || len(created.Last4) != 4 {
		t.Fatalf("missing token/last4: %s", body)
	}
	auth := map[string]string{"Authorization": "Bearer " + created.CardToken}
	cardPath := "/api/v1/agentcard/cards/" + created.CardID

	if rr := do(h, http.MethodGet, cardPath, "", nil); rr.Code != http.StatusUnauthorized {
		t.Errorf("card lookup without token: %d", rr.Code)
	}
	if rr := do(h, http.MethodGet, cardPath, "", map[string]string{"Authorization": "Bearer ct_wrong"}); rr.Code != http.StatusNotFound {
		t.Errorf("card lookup wrong token: %d", rr.Code)
	}
	rr = do(h, http.MethodGet, cardPath, "", auth)
	if rr.Code != http.StatusOK || strings.Contains(rr.Body.String(), "cvv") || strings.Contains(rr.Body.String(), "cardToken") {
		t.Errorf("card lookup: %d %s", rr.Code, rr.Body.String())
	}
	if rr := do(h, http.MethodGet, cardPath, "", map[string]string{"Authorization": "Bearer " + opToken}); rr.Code != http.StatusOK {
		t.Errorf("operator card lookup: %d", rr.Code)
	}

	charge := func(amount string, hdr map[string]string) *httptest.ResponseRecorder {
		return do(h, http.MethodPost, "/api/v1/agentcard/authorize", `{"cardId":"`+created.CardID+`","amountUSD":`+amount+`,"merchantName":"m","mcc":"7999"}`, hdr)
	}
	if rr := charge("1", nil); rr.Code != http.StatusUnauthorized {
		t.Errorf("charge without credential: %d", rr.Code)
	}
	if rr := charge("-5000", auth); rr.Code != http.StatusBadRequest {
		t.Errorf("negative charge: %d", rr.Code)
	}
	if rr := charge("0", auth); rr.Code != http.StatusBadRequest {
		t.Errorf("zero charge: %d", rr.Code)
	}
	rr = do(h, http.MethodGet, cardPath, "", auth)
	var view struct {
		BalanceUSD float64 `json:"balanceUSD"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &view)
	if view.BalanceUSD != 100 {
		t.Fatalf("balance after rejected charges = %v, want 100", view.BalanceUSD)
	}

	// Session key: requires the card token, then works as the agent credential.
	skBody := `{"cardId":"` + created.CardID + `","agentId":"a1","maxPerTxUSD":10,"dailyLimitUSD":20,"ttlHours":1}`
	if rr := do(h, http.MethodPost, "/api/v1/agentcard/session-key", skBody, nil); rr.Code != http.StatusUnauthorized {
		t.Errorf("session-key without token: %d", rr.Code)
	}
	rr = do(h, http.MethodPost, "/api/v1/agentcard/session-key", skBody, auth)
	if rr.Code != http.StatusOK {
		t.Fatalf("session-key: %d %s", rr.Code, rr.Body.String())
	}
	var sk struct {
		KeyHex string `json:"keyHex"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &sk)
	rr = do(h, http.MethodPost, "/api/v1/agentcard/authorize", `{"cardId":"`+created.CardID+`","sessionKey":"`+sk.KeyHex+`","amountUSD":5,"mcc":"7999"}`, nil)
	var ar struct {
		Success      bool    `json:"success"`
		RemainingUSD float64 `json:"remainingUSD"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &ar)
	if rr.Code != http.StatusOK || !ar.Success || ar.RemainingUSD != 95 {
		t.Errorf("agent charge: %d %s", rr.Code, rr.Body.String())
	}
	if strings.Contains(rr.Body.String(), sk.KeyHex) {
		t.Errorf("authorize response echoes the session key")
	}
}

// ==================== GAP-49: no silent degradation ====================

// dbGatedRoutes is the list of routes whose handler reaches the DB pool.
//
// Read the claim carefully, because the previous version of this comment
// over-claimed: it said the list was "data, not prose, so a new persisted route
// that forgets withDB shows up as a test failure". It does not. Adding a route
// to router.go does not add it to this list, and these two tests only iterate
// the list, so a new persisted route is silently untested - /api/v1/developer/keys
// lived in exactly that gap until docs/changes/045.
//
// What the list is: a record of the routes somebody thought about. What would
// make the original claim true is a check in the other direction (walk the
// registrations in router.go and require each to appear here or be explicitly
// exempted); there is none, and the absence is registered as GAP-70.
var dbGatedRoutes = []struct {
	method string
	path   string
	body   string
}{
	{http.MethodGet, "/api/v1/game/steam/profile?id=76561198000000000", ""},
	{http.MethodPost, "/api/v1/game/proof", `{"steamId":"76561198000000000","walletAddress":"0x0000000000000000000000000000000000000001","appId":730}`},
	{http.MethodPost, "/api/v1/developer/github/proof", `{"username":"moonhotline","walletAddress":"0x0000000000000000000000000000000000000001"}`},
	{http.MethodPost, "/api/v1/agentcard/generate", `{"walletAddress":"0x0000000000000000000000000000000000000001","initialDeposit":100}`},
	{http.MethodPost, "/api/v1/agentcard/authorize", `{"cardId":"c","amountUSD":1,"mcc":"7999"}`},
	{http.MethodPost, "/api/v1/agentcard/batch-settle", `{}`},
	// The only agentapi route that reaches db.Pool (docs/changes/045).
	{http.MethodPost, "/api/v1/developer/keys", `{"wallet_address":"0x0000000000000000000000000000000000000001","tier":"STARTER_FREE"}`},
}

// A router built without a DB handle must refuse the persisted routes. This is
// the in-process half of "no credentials -> no 200"; the startup half is
// database.New returning ErrDatabaseURLRequired, which cmd/api treats as
// fatal.
func TestPersistedRoutesRefuseWithoutDBHandle(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) { d.DB = nil })
	for _, rt := range dbGatedRoutes {
		hdr := map[string]string{"Authorization": "Bearer " + opToken}
		rr := do(h, rt.method, rt.path, rt.body, hdr)
		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s without a DB handle: %d %s, want 503", rt.method, rt.path, rr.Code, rr.Body.String())
		}
		if !strings.Contains(rr.Body.String(), "database") {
			t.Errorf("%s %s: refusal does not name the cause: %s", rt.method, rt.path, rr.Body.String())
		}
	}
}

// A handle that exists but is not connected is the same refusal. This is the
// state the old code put deployments in by default.
func TestPersistedRoutesRefuseWhenNotConnected(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) { d.DB = database.NewMemoryOnly() }) // IsConnected == false
	for _, rt := range dbGatedRoutes {
		hdr := map[string]string{"Authorization": "Bearer " + opToken}
		rr := do(h, rt.method, rt.path, rt.body, hdr)
		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s with an unconnected DB: %d, want 503", rt.method, rt.path, rr.Code)
		}
	}
}

// The gate is deliberately narrow: health and stats depend on process state,
// not on storage, so they must keep answering. A blanket 503 would turn "no
// database" into "the service is down", which is a different and false claim.
func TestHealthAndStatsStayUpWithoutDB(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) { d.DB = nil })
	for _, p := range []string{"/healthz", "/api/v1/health", "/api/v1/stats"} {
		rr := do(h, http.MethodGet, p, "", nil)
		if rr.Code != http.StatusOK {
			t.Errorf("%s with no DB: %d, want 200", p, rr.Code)
		}
	}
	rr := do(h, http.MethodGet, "/api/v1/health", "", nil)
	if !strings.Contains(rr.Body.String(), `"database":false`) {
		t.Errorf("health does not report the missing database honestly: %s", rr.Body.String())
	}
}

// The routes that need no database keep answering, and they are exactly the
// ones whose data source is not PostgreSQL:
//
//	health/healthz/stats - process state and fixture counters
//	market/trade, market/close - Alpaca's paper API (market.Service's db field
//	  is never read; market state lives at Alpaca, not in this database)
//
// The DoD wording is "business routes must not return 200". That is asserted
// exactly where it carries meaning - the persisted routes above, which refuse
// with 503 - and not by forcing these three to 503 as well. Turning "no
// database" into "the whole service is down" would be a different and false
// claim, and market/trade's 200 already says success:false in its body.
func TestRoutesWithoutDatabaseKeepAnswering(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) {
		d.Cfg.DemoPublicTrading = true
		d.DB = nil
	})
	for _, p := range []string{"/healthz", "/api/v1/health", "/api/v1/stats"} {
		if rr := do(h, http.MethodGet, p, "", nil); rr.Code != http.StatusOK {
			t.Errorf("%s with no DB: %d, want 200", p, rr.Code)
		}
	}

	// Alpaca is unreachable in this harness, so the trade must not be reported
	// as a success. If someone ever made ExecuteTrade claim Success on an
	// upstream failure, this is the assertion that catches it.
	rr := do(h, http.MethodPost, "/api/v1/market/trade", `{"symbol":"NVDA","side":"buy","notionalUSD":10,"leverage":1}`, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("market/trade: %d %s", rr.Code, rr.Body.String())
	}
	var res struct {
		Success bool   `json:"success"`
		Order   any    `json:"order"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("unmarshal trade result: %v", err)
	}
	if res.Success {
		t.Errorf("trade reported success while Alpaca is unreachable: %s", rr.Body.String())
	}
	if res.Order != nil {
		t.Errorf("failed trade carries an order: %s", rr.Body.String())
	}
	if res.Message == "" {
		t.Errorf("failed trade carries no reason: %s", rr.Body.String())
	}
}

// ==================== BENCHMARKS ====================

func BenchmarkRouterHealthz(b *testing.B) {
	h := newTestRouter(b, nil)
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			b.Fatalf("expected 200, got %d", rr.Code)
		}
	}
}

func BenchmarkRouterStats(b *testing.B) {
	h := newTestRouter(b, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/stats", nil)
	req.Header.Set("Origin", "https://koliance.oodai.space")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			b.Fatalf("expected 200, got %d", rr.Code)
		}
	}
}

func TestAgentAPIRoutes_BindAndPay(t *testing.T) {
	h := newTestRouter(t, nil)
	wallet := "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2"

	// 1. Generate Key
	keyRec := do(h, http.MethodPost, "/api/v1/developer/keys", `{"wallet_address":"`+wallet+`","tier":"STARTER_FREE"}`, nil)
	if keyRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on key gen, got %d: %s", keyRec.Code, keyRec.Body.String())
	}
	var keyResp struct {
		Code int `json:"code"`
		Data struct {
			RawKey string `json:"raw_key"`
		} `json:"data"`
	}
	if err := json.Unmarshal(keyRec.Body.Bytes(), &keyResp); err != nil {
		t.Fatalf("json unmarshal key gen err: %v", err)
	}
	rawKey := keyResp.Data.RawKey

	// 2. Claim free package
	claimRec := do(h, http.MethodPost, "/api/v1/developer/packages/claim-or-purchase", `{"wallet_address":"`+wallet+`","tier_id":"STARTER_FREE_100","payment_method":"free_claim"}`, nil)
	if claimRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on package claim, got %d: %s", claimRec.Code, claimRec.Body.String())
	}

	// 3. Bind Agent with Bearer auth
	bindBody := `{
		"agent_name": "arbitrage-bot",
		"model_name": "deepseek-r1",
		"wallet_address": "` + wallet + `",
		"wallet_balance": 1000.0,
		"permissions": ["trade:perp", "pay:micropayment"],
		"limits": {"max_per_tx_usd": 100.0, "daily_limit_usd": 500.0},
		"rate_limit": {"rpm": 60}
	}`
	bindRec := do(h, http.MethodPost, "/api/v1/agent/bind", bindBody, map[string]string{
		"Authorization": "Bearer " + rawKey,
	})
	if bindRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on agent bind, got %d: %s", bindRec.Code, bindRec.Body.String())
	}

	// 4. Autonomous Payment with Bearer auth
	payBody := `{
		"amount": 25.5,
		"item_name": "Nansen Data Stream",
		"order_hash": "0x3e18a91df720c1598b92b67f18a6e9a71db902ef018274d7c0828590bf70d8a1",
		"quantity": 1,
		"payment_method": "crypto",
		"crypto_currency": "MON"
	}`
	payRec := do(h, http.MethodPost, "/api/v1/agent/pay", payBody, map[string]string{
		"Authorization": "Bearer " + rawKey,
	})
	if payRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on agent pay, got %d: %s", payRec.Code, payRec.Body.String())
	}

	// 5. Query stats & agents
	statsRec := do(h, http.MethodGet, "/api/v1/developer/stats?wallet_address="+wallet, "", nil)
	if statsRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on stats, got %d: %s", statsRec.Code, statsRec.Body.String())
	}

	agentsRec := do(h, http.MethodGet, "/api/v1/developer/agents", "", nil)
	if agentsRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on agents, got %d: %s", agentsRec.Code, agentsRec.Body.String())
	}
}
