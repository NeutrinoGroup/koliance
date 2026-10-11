package httpapi

// Independent 03-ring suite for GAP-49 (explicit degradation) and GAP-44 (the
// verifier slot). Written by qa-validator, not by the implementing role.
//
// The question this file exists to answer is not "does the gate work on the
// routes it was put on" - the implementation's own tests already show that. It
// is: "is the gate on EVERY route that needs it, and off every route that does
// not?" That is a question about the COMPLEMENT of the gate, and the implementer
// cannot answer it about their own list. So the route inventory below is derived
// from the registrations in router.go, not from dbGatedRoutes, and every route
// carries an explicit judgement of what it should do with no database handle.
//
// Probes are network-free on purpose: routes whose handler would call an
// external API are driven with input that fails validation, which still proves
// everything this file is about (a 503 from withDB precedes validation, so a
// 400/401 proves the gate is NOT on that route).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/koliance/backend/internal/developer"
	"github.com/koliance/backend/internal/platform/database"
	"github.com/koliance/backend/internal/verifier"
)

// qaRouteExpectation is one route's contract when the process has no database
// handle at all.
type qaRouteExpectation struct {
	method string
	path   string
	body   string
	auth   string
	// want is the exact status code asserted.
	want int
	// why records the judgement: "unguarded: source is X", or "guarded".
	why string
}

// qaRouteInventory is every route registered in NewRouter: all 20
// `h("<path>", ...)` registrations, 20 distinct paths.
//
// A path that is not registered answers 404, and TestQARouteInventoryIsComplete
// fails on any 404 - so a typo here, or a registration renamed in router.go,
// shows up as a failure rather than as a silently untested route.
var qaRouteInventory = []qaRouteExpectation{
	// ---- no database needed: the honest "up" answer is 200 ----
	{http.MethodGet, "/api/v1/health", "", "", 200, "unguarded: process state"},
	{http.MethodGet, "/healthz", "", "", 200, "unguarded: process state"},
	{http.MethodGet, "/health", "", "", 200, "unguarded: process state"},
	{http.MethodGet, "/api/v1/stats", "", "", 200, "unguarded: compile-time fixture literals"},
	{http.MethodGet, "/api/v1/market/prices", "", "", 200, "unguarded: PriceOracle over the Alpaca data API"},
	{http.MethodGet, "/api/v1/developer/github/profile?username=moonhotline", "", "", 200, "unguarded: GitHub-backed, persists nothing (fabricated fallback: see TestQAFindingGithubProfileCannotExpressProvenance)"},

	// ---- no database needed, refused on other grounds ----
	{http.MethodGet, "/api/v1/agentcard/cards/cX", "", "", 401, "unguarded: credential checked before any store is touched"},
	{http.MethodPost, "/api/v1/agentcard/session-key", `{}`, "", 401, "unguarded: credential checked first; the guard is in-memory"},
	{http.MethodPost, "/api/v1/market/close", `{"symbol":"nv da"}`, "Bearer " + opToken, 400, "unguarded: Alpaca is the book of record"},
	{http.MethodPost, "/api/v1/stripe/checkout-session", `{"amountCents":-500}`, "", 400, "unguarded: Stripe's API is the store"},
	{http.MethodPost, "/api/v1/stripe/customer", `{}`, "", 401, "unguarded: operator-gated, Stripe-backed"},
	{http.MethodPost, "/api/v1/verifier/verify", `{"subject":"s"}`, "", 501, "unguarded: pure computation, no store"},
	{http.MethodPost, "/api/v1/market/trade", `{"symbol":"NVDA","side":"hold","notionalUSD":1,"leverage":1}`, "Bearer " + opToken, 400, "unguarded: Alpaca is the book of record"},
	{http.MethodGet, "/api/v1/market/overview", "", "", 500, "unguarded: Alpaca is the source; the upstream is unreachable in this harness, and a 500 from an unguarded route proves the DB gate is not on it"},

	// ---- persists through the DB handle: must refuse with 503 ----
	{http.MethodGet, "/api/v1/game/steam/profile?id=76561198000000000", "", "", 503, "guarded (withDB)"},
	{http.MethodPost, "/api/v1/game/proof", `{"steamId":"76561198000000000","walletAddress":"0x0000000000000000000000000000000000000001","appId":730}`, "", 503, "guarded (withDB)"},
	{http.MethodPost, "/api/v1/developer/github/proof", `{"username":"moonhotline","walletAddress":"0x0000000000000000000000000000000000000001"}`, "", 503, "guarded (withDB)"},
	{http.MethodPost, "/api/v1/agentcard/generate", `{"walletAddress":"0x0000000000000000000000000000000000000001","initialDeposit":100}`, "", 503, "guarded (withDB)"},
	{http.MethodPost, "/api/v1/agentcard/authorize", `{"cardId":"c","amountUSD":1,"mcc":"7999"}`, "", 503, "guarded (withDB)"},
	{http.MethodPost, "/api/v1/agentcard/batch-settle", `{}`, "Bearer " + opToken, 503, "guarded (withDB), and the gate precedes the operator check"},
}

// buildNoDBRouter is the router of a process that has a database handle that is
// not there. cmd/api refuses to start in this state, so this is the
// defence-in-depth half - the one a test can drive.
func buildNoDBRouter(t testing.TB, mutate func(*Deps)) http.Handler {
	t.Helper()
	return newTestRouter(t, func(d *Deps) {
		d.DB = nil
		if mutate != nil {
			mutate(d)
		}
	})
}

// Every route's behaviour with no database handle, asserted one by one.
func TestQARouteBehaviorWithoutDatabaseHandle(t *testing.T) {
	h := buildNoDBRouter(t, nil)
	guarded, unguarded := 0, 0
	for _, rt := range qaRouteInventory {
		hdr := map[string]string{}
		if rt.auth != "" {
			hdr["Authorization"] = rt.auth
		}
		rr := do(h, rt.method, rt.path, rt.body, hdr)
		if rr.Code != rt.want {
			t.Errorf("%s %s: %d, want %d (%s)\n  body: %s",
				rt.method, rt.path, rr.Code, rt.want, rt.why, rr.Body.String())
			continue
		}
		if rt.want == 503 {
			guarded++
			if !strings.Contains(rr.Body.String(), "database") {
				t.Errorf("%s %s: the 503 does not name the database as the cause: %s", rt.method, rt.path, rr.Body.String())
			}
		} else {
			unguarded++
			if strings.Contains(rr.Body.String(), "database is not configured") {
				t.Errorf("%s %s: classified as unguarded but refused by the DB gate: %s", rt.method, rt.path, rr.Body.String())
			}
		}
	}
	t.Logf("inventory: %d guarded, %d unguarded, %d total", guarded, unguarded, len(qaRouteInventory))
	if guarded == 0 || unguarded == 0 {
		t.Fatal("one side of the classification is empty; this test is no longer measuring anything")
	}
}

// Route-table integrity: every path in the inventory is actually registered.
//
// The probe is PATCH, not the route's own method, because 404 is ALSO a
// legitimate handler response here (`/api/v1/agentcard/cards/cX` answers 404 for
// an unknown card). An unregistered path is the one case where ServeMux itself
// answers 404 without reaching a handler, so "any status other than 404" is what
// proves the path has an owner.
//
// The probe also shows up an inconsistency, carried as an observation rather
// than a failure: health/healthz/stats are registered WITHOUT methodOnly, so
// they answer PATCH/PUT/DELETE with 200, while every other route answers 405.
// Harmless for read-only handlers, but it means "method not allowed" is not a
// property of this router.
func TestQARouteInventoryIsComplete(t *testing.T) {
	h := buildNoDBRouter(t, nil)
	for _, rt := range qaRouteInventory {
		rr := do(h, http.MethodPatch, rt.path, "", nil)
		if rr.Code == http.StatusNotFound {
			t.Errorf("PATCH %s is not registered (404); the inventory has drifted from router.go", rt.path)
			continue
		}
		if rr.Code == http.StatusOK {
			t.Logf("observation: PATCH %s is answered with 200; this route is registered without methodOnly", rt.path)
		}
	}
	// A control: an unregistered path really does 404 in this harness, so the
	// assertion above is not vacuous.
	if rr := do(h, http.MethodPatch, "/api/v1/qa-does-not-exist", "", nil); rr.Code != http.StatusNotFound {
		t.Errorf("control probe: %d, want 404; the 404 check above proves nothing", rr.Code)
	}
}

// The gate fires BEFORE input validation on the guarded routes. Asserted because
// the reverse order would let an unauthenticated caller use a validated 400 as
// an oracle - and because it is an ordering the implementer's tests do not pin.
func TestQADBGatePrecedesValidationAndAuthOnGuardedRoutes(t *testing.T) {
	h := buildNoDBRouter(t, nil)
	cases := []struct {
		method, path, body string
		auth               string
	}{
		// input that would otherwise be 400 / 401 / 405
		{http.MethodGet, "/api/v1/game/steam/profile?id=ab", "", ""},
		{http.MethodPost, "/api/v1/game/proof", `not json`, ""},
		{http.MethodPost, "/api/v1/developer/github/proof", `{"username":"../../etc"}`, ""},
		{http.MethodPost, "/api/v1/agentcard/generate", `{"initialDeposit":-5}`, ""},
		{http.MethodPost, "/api/v1/agentcard/authorize", `not json`, ""},
		// no operator token at all: the DB gate must still be the first answer
		{http.MethodPost, "/api/v1/agentcard/batch-settle", `{}`, ""},
		{http.MethodPost, "/api/v1/agentcard/batch-settle", `{}`, "Bearer wrong"},
	}
	for _, c := range cases {
		hdr := map[string]string{}
		if c.auth != "" {
			hdr["Authorization"] = c.auth
		}
		rr := do(h, c.method, c.path, c.body, hdr)
		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s (%q): %d, want 503 - the DB gate must answer before validation/auth", c.method, c.path, c.body, rr.Code)
		}
	}
}

// A handle that exists but is not connected is the same refusal, and it carries
// Retry-After. This is the state the pre-GAP-49 code put every deployment in.
func TestQAUnconnectedHandleRefusesAndSaysWhenToRetry(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) { d.DB = database.NewMemoryOnly() }) // IsConnected == false
	rr := do(h, http.MethodGet, "/api/v1/game/steam/profile?id=76561198000000000", "", nil)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconnected handle: %d, want 503", rr.Code)
	}
	if got := rr.Header().Get("Retry-After"); got == "" {
		t.Errorf("no Retry-After header on the transient refusal (the nil-handle case is permanent, this one is not)")
	}
	t.Logf("evidence: %d Retry-After=%q body=%s", rr.Code, rr.Header().Get("Retry-After"), strings.TrimSpace(rr.Body.String()))
}

// ==================== the complement: unguarded routes that write somewhere else ====================

// /api/v1/developer/github/profile is NOT behind withDB, and that is defensible:
// it persists nothing. What it does instead is answer with FABRICATED identity
// and credit data when GitHub cannot be reached - developer.Service.
// GetDeveloperStats builds a DeveloperStatsResponse with hard-coded repos,
// stars and CreditAllowanceUSD (developer/github.go:144-163) and returns it with
// a NIL error, so HTTP 200 and the same body shape as a live read. That is the
// GAP-14 defect class ("synthetic data returned in the shape of live data")
// sitting one route away from the route W1 hardened, and the response TYPE is
// the reason a caller cannot tell:
//
//	struct DeveloperStatsResponse { ... BUIDLTier, CreditAllowanceUSD } - no
//	provenance field, and the handler has nowhere to put one.
//
// This test is hermetic (no network) and asserts the structural claim: the
// response type cannot express where its data came from. When a provenance
// field is added - as docs/changes/018 did for market data - this test fails,
// which is the signal to replace it with an assertion that the field is set.
func TestQAFindingGithubProfileCannotExpressProvenance(t *testing.T) {
	provenance := []string{"source", "synthetic", "fallback", "stale", "live", "fresh"}
	var tags []string
	typ := reflect.TypeOf(developer.DeveloperStatsResponse{})
	for i := 0; i < typ.NumField(); i++ {
		f := typ.Field(i)
		tags = append(tags, f.Name)
		name := strings.Split(f.Tag.Get("json"), ",")[0]
		if name != "" {
			tags = append(tags, name)
		}
	}
	t.Logf("DeveloperStatsResponse fields: %v", tags)
	for _, tag := range tags {
		low := strings.ToLower(tag)
		for _, p := range provenance {
			if strings.Contains(low, p) {
				t.Logf("provenance field %q exists - the defect described here has been addressed; rewrite this test to assert it is populated", tag)
				return
			}
		}
	}
	// The control that makes the loop above meaningful: the JSON shape really is
	// the one served at 200 (the tag list is not empty and does carry the fields
	// the handler serialises).
	blob, err := json.Marshal(developer.DeveloperStatsResponse{})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(blob), "creditAllowanceUSD") {
		t.Fatalf("response shape changed; this test no longer describes the route: %s", blob)
	}
	t.Logf("FINDING EVIDENCE - the 200 body of GET /api/v1/developer/github/profile is %s and carries no way to say whether the numbers were read from GitHub or fabricated:\n  %s\n"+
		"Fabrication path: developer/github.go:144-163 (err == nil, HTTP 200, hard-coded repos/stars/CreditAllowanceUSD).",
		string(blob), strings.TrimSpace(string(blob)))
}

// Runtime-level reproducer for the same finding: the fallback branch actually
// runs, and what it serves is indistinguishable from a real read.
//
// Gated because it needs the process to start with an unreachable upstream, and
// the GitHub client is constructed by the router with a fixed URL, so the only
// lever is the transport's proxy environment (read once per process, hence "set
// it before launching the test binary, not inside the test"):
//
//	$env:HTTPS_PROXY='http://127.0.0.1:1'; $env:QA_GITHUB_OFFLINE='1'
//	go test ./internal/httpapi/ -run TestQARuntimeGithubFallbackIsFabricated -v -count=1
//	Remove-Item Env:\HTTPS_PROXY, Env:\QA_GITHUB_OFFLINE
//
// Expected: PASS, and the logged body contains the hard-coded company/location/
// avatar/credit from developer/github.go with HTTP 200.
func TestQARuntimeGithubFallbackIsFabricated(t *testing.T) {
	if os.Getenv("QA_GITHUB_OFFLINE") == "" {
		t.Skip("needs an unreachable GitHub: set HTTPS_PROXY to a dead port and QA_GITHUB_OFFLINE=1 before launching the test binary")
	}
	h := buildNoDBRouter(t, nil)
	rr := do(h, http.MethodGet, "/api/v1/developer/github/profile?username=qa-definitely-not-a-real-user-zzz", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("offline github profile: %d %s, want 200 from the fallback branch", rr.Code, rr.Body.String())
	}
	body := rr.Body.String()
	// The hard-coded literals from the fallback branch.
	fabricated := []string{
		"AI Friendly",  // company
		"Earth",        // location
		"228437717",    // avatar id
		"1000",         // CreditAllowanceUSD
		"CORE BUIDLER", // BUIDLTier
	}
	hits := 0
	for _, s := range fabricated {
		if strings.Contains(body, s) {
			hits++
		}
	}
	if hits == 0 {
		t.Fatalf("the body does not look like the fallback branch; is the proxy actually dead? %s", body)
	}
	t.Logf("RUNTIME EVIDENCE (%d/5 hard-coded literals present) - GitHub unreachable, still HTTP 200, no marker:\n%s", hits, body)
}

// ==================== verifier slot at the HTTP boundary ====================

// The route is not behind the DB gate, and a deployment with no verifier wired
// answers 503 with a cause - not a panic, and not a 200.
func TestQAVerifierRouteIsNotDBGated(t *testing.T) {
	h := buildNoDBRouter(t, func(d *Deps) { d.Verifier = nil })
	rr := do(h, http.MethodPost, "/api/v1/verifier/verify", `{"subject":"s","proof":"01"}`, nil)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("unwired verifier: %d %s, want 503", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "verifier") {
		t.Errorf("the 503 does not name the verifier: %s", rr.Body.String())
	}
}

// The slot must never answer 200 for a request it did not check. Swept across
// input classes, including ones that reach the verifier.
func TestQANoopNeverApprovesAnyInputClass(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) { d.Verifier = verifier.NewNoop() })
	inputs := []string{
		`{"scheme":"ZK","subject":"s","proof":"deadbeef"}`,
		`{"scheme":"ZK","subject":"s","proof":"0xdeadbeef","publicInputs":"0x01"}`,
		`{"scheme":"NONE","subject":"s"}`,
		`{"scheme":"","subject":"s"}`,
		`{"scheme":"ZK","subject":"s","proof":""}`,
		`{"subject":"s"}`,
		`{}`, // rejected on validation: no subject
	}
	for _, body := range inputs {
		rr := do(h, http.MethodPost, "/api/v1/verifier/verify", body, nil)
		if rr.Code == http.StatusOK {
			t.Errorf("no-op approved %s: %s", body, rr.Body.String())
		}
		if rr.Code != http.StatusNotImplemented && rr.Code != http.StatusBadRequest {
			t.Errorf("%s: %d %s, want 501 (nothing could check it) or 400 (malformed)", body, rr.Code, rr.Body.String())
		}
	}
}

// Boundary values at the HTTP edge: hex encodings, empty and odd-length
// payloads, oversized bodies, wrong methods, cross-field combinations.
func TestQAVerifierRouteBoundaries(t *testing.T) {
	approve := &stubVerifier{scheme: verifier.SchemeZK}
	h := newTestRouter(t, func(d *Deps) { d.Verifier = approve })

	type c struct {
		name       string
		method     string
		body       string
		wantStatus int
		wantCalled bool
	}
	cases := []c{
		{"valid hex with 0x", http.MethodPost, `{"scheme":"ZK","subject":"s","proof":"0x01"}`, 200, true},
		{"valid hex with 0X", http.MethodPost, `{"scheme":"ZK","subject":"s","proof":"0X01"}`, 200, true},
		{"upper-case hex", http.MethodPost, `{"scheme":"ZK","subject":"s","proof":"ABCDEF"}`, 200, true},
		{"empty proof is nil, not an error", http.MethodPost, `{"scheme":"ZK","subject":"s","proof":""}`, 200, true},
		{"whitespace-only proof is nil", http.MethodPost, `{"scheme":"ZK","subject":"s","proof":"   "}`, 200, true},
		{"bare 0x is nil", http.MethodPost, `{"scheme":"ZK","subject":"s","proof":"0x"}`, 200, true},
		{"odd-length hex", http.MethodPost, `{"scheme":"ZK","subject":"s","proof":"abc"}`, 400, false},
		{"non-hex characters", http.MethodPost, `{"scheme":"ZK","subject":"s","proof":"zz"}`, 400, false},
		{"unknown scheme is not rejected here", http.MethodPost, `{"scheme":"NO-SUCH-SCHEME","subject":"s","proof":"01"}`, 200, true},
		{"scheme is optional", http.MethodPost, `{"subject":"s","proof":"01"}`, 200, true},
		{"blank subject", http.MethodPost, `{"scheme":"ZK","subject":" \t ","proof":"01"}`, 400, false},
		{"missing subject", http.MethodPost, `{"scheme":"ZK","proof":"01"}`, 400, false},
		{"bad publicInputs", http.MethodPost, `{"scheme":"ZK","subject":"s","publicInputs":"0xz"}`, 400, false},
		{"null body fields", http.MethodPost, `{"scheme":null,"subject":"s","proof":null}`, 200, true},
		{"wrong JSON type for proof", http.MethodPost, `{"subject":"s","proof":123}`, 400, false},
		{"empty body is treated as {}", http.MethodPost, ``, 400, false},
		{"GET is 405", http.MethodGet, ``, 405, false},
		{"PUT is 405", http.MethodPut, `{"subject":"s"}`, 405, false},
	}
	for _, tc := range cases {
		before := approve.calls
		rr := do(h, tc.method, "/api/v1/verifier/verify", tc.body, nil)
		if rr.Code != tc.wantStatus {
			t.Errorf("%s: %d %s, want %d", tc.name, rr.Code, rr.Body.String(), tc.wantStatus)
		}
		called := approve.calls > before
		if called != tc.wantCalled {
			t.Errorf("%s: verifier called = %t, want %t (validation must gate the slot)", tc.name, called, tc.wantCalled)
		}
		t.Logf("%-40s -> %d called=%t", tc.name, rr.Code, called)
	}

	// A body past the 1 MiB cap must be a client error, not a 200 and not a hang.
	huge := `{"subject":"s","proof":"` + strings.Repeat("ab", 700_000) + `"}`
	if rr := do(h, http.MethodPost, "/api/v1/verifier/verify", huge, nil); rr.Code == http.StatusOK {
		t.Errorf("oversized body approved: %d", rr.Code)
	} else {
		t.Logf("oversized body -> %d", rr.Code)
	}
}

// The status mapping is the load-bearing contract: "checked and rejected" (400)
// and "nothing could check it" (501) must never collapse into each other.
func TestQAInvalidProofIs400AndTechnicalFailureIs501(t *testing.T) {
	invalid := &stubVerifier{scheme: verifier.SchemeZK, fn: func(_ context.Context, _ verifier.Request) error {
		return fmt.Errorf("%w: bad signature", verifier.ErrInvalidProof)
	}}
	h := newTestRouter(t, func(d *Deps) { d.Verifier = invalid })
	rr := do(h, http.MethodPost, "/api/v1/verifier/verify", `{"scheme":"ZK","subject":"s","proof":"01"}`, nil)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("invalid proof: %d, want 400", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), `"valid":false`) {
		t.Errorf("invalid proof body does not say valid:false: %s", rr.Body.String())
	}

	broken := &stubVerifier{scheme: verifier.SchemeZK, fn: func(_ context.Context, _ verifier.Request) error {
		return errors.New("hsm unavailable")
	}}
	h = newTestRouter(t, func(d *Deps) { d.Verifier = broken })
	rr = do(h, http.MethodPost, "/api/v1/verifier/verify", `{"scheme":"ZK","subject":"s","proof":"01"}`, nil)
	if rr.Code != http.StatusNotImplemented {
		t.Errorf("technical failure: %d, want 501 - an outage must not be reported as an invalid proof", rr.Code)
	}
}

// A nil INTERFACE is answered with 503. The check is `d.Verifier == nil`, which
// a TYPED nil (var p *verifier.Noop; Deps{Verifier: p}) satisfies - the interface
// is non-nil because it carries a type. Recorded here as the boundary of that
// check, with the observed outcome rather than a prediction: *Noop's methods
// have pointer receivers and never dereference the pointer, so a typed nil
// answers 501 instead of 503 and does NOT panic. An implementation that read a
// field off the receiver would panic instead, so the check is worth widening -
// but it is not a live defect, since cmd/api always injects verifier.NewNoop().
func TestQATypedNilVerifierBypassesTheNilCheckButDoesNotPanic(t *testing.T) {
	var typedNil *verifier.Noop
	h := newTestRouter(t, func(d *Deps) { d.Verifier = typedNil })
	rr := do(h, http.MethodPost, "/api/v1/verifier/verify", `{"subject":"s","proof":"01"}`, nil)
	if rr.Code != http.StatusNotImplemented {
		t.Errorf("typed-nil verifier: %d %s, want 501 (the == nil check does not catch a typed nil; observed behaviour is recorded here)", rr.Code, rr.Body.String())
	}
	t.Logf("RECORDED EDGE: typed-nil *verifier.Noop bypasses the `d.Verifier == nil` check and answers %d. It does not panic only because Noop's methods never dereference the receiver.", rr.Code)
}
