package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/koliance/backend/internal/verifier"
)

// stubVerifier stands in for a real proof system. Its point is to prove the
// route reaches the injected implementation: if the endpoint were a hard-coded
// 200 (or a hard-coded 501), the assertions below could not both hold.
type stubVerifier struct {
	scheme verifier.Scheme
	fn     func(context.Context, verifier.Request) error
	calls  int
}

func (s *stubVerifier) Scheme() verifier.Scheme { return s.scheme }

func (s *stubVerifier) Verify(ctx context.Context, req verifier.Request) error {
	s.calls++
	if s.fn == nil {
		return nil
	}
	return s.fn(ctx, req)
}

const validProofHex = "0xdeadbeef"

// The injected verifier decides. A proof it approves gets 200; the same
// request through a verifier that rejects it gets 400 with valid=false.
func TestVerifyRouteUsesInjectedVerifier(t *testing.T) {
	approve := &stubVerifier{scheme: verifier.SchemeZK}
	h := newTestRouter(t, func(d *Deps) { d.Verifier = approve })

	rr := do(h, http.MethodPost, "/api/v1/verifier/verify",
		`{"scheme":"ZK","subject":"agent-1","proof":"`+validProofHex+`"}`, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("approved proof: %d %s", rr.Code, rr.Body.String())
	}
	var ok struct {
		Valid  bool            `json:"valid"`
		Scheme verifier.Scheme `json:"scheme"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &ok)
	if !ok.Valid || ok.Scheme != verifier.SchemeZK {
		t.Errorf("response = %s", rr.Body.String())
	}
	if approve.calls != 1 {
		t.Fatalf("verifier called %d times, want 1; the route did not reach it", approve.calls)
	}

	// N5: the same request, a verifier that rejects it. A hard-coded 200
	// cannot produce this.
	reject := &stubVerifier{scheme: verifier.SchemeZK, fn: func(context.Context, verifier.Request) error {
		return fmt.Errorf("%w: signature mismatch", verifier.ErrInvalidProof)
	}}
	h = newTestRouter(t, func(d *Deps) { d.Verifier = reject })
	rr = do(h, http.MethodPost, "/api/v1/verifier/verify",
		`{"scheme":"ZK","subject":"agent-1","proof":"`+validProofHex+`"}`, nil)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("rejected proof: %d %s, want 400", rr.Code, rr.Body.String())
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &ok); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if ok.Valid {
		t.Errorf("rejected proof reported valid: %s", rr.Body.String())
	}
	if reject.calls != 1 {
		t.Fatalf("rejecting verifier called %d times, want 1", reject.calls)
	}
}

// N6: the default no-op must never approve. This is the regression guard for
// "the endpoint answers 200 because nobody wired anything".
func TestVerifyRouteWithNoopIs501(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) { d.Verifier = verifier.NewNoop() })
	for _, body := range []string{
		`{"scheme":"ZK","subject":"agent-1","proof":"` + validProofHex + `"}`,
		`{"scheme":"ZK","subject":"agent-1","proof":""}`,
		`{"subject":"agent-1"}`,
		`{}`,
	} {
		rr := do(h, http.MethodPost, "/api/v1/verifier/verify", body, nil)
		if rr.Code == http.StatusOK {
			t.Fatalf("no-op approved %s: %s", body, rr.Body.String())
		}
	}
	// The well-formed request is the one that must be specifically 501: "the
	// slot is empty" is a different answer from "your payload is malformed".
	rr := do(h, http.MethodPost, "/api/v1/verifier/verify",
		`{"scheme":"ZK","subject":"agent-1","proof":"`+validProofHex+`"}`, nil)
	if rr.Code != http.StatusNotImplemented {
		t.Errorf("no-op on a well-formed request: %d, want 501", rr.Code)
	}
}

// A verifier that fails for a non-proof reason must not be reported as an
// invalid proof, nor as success.
func TestVerifyRouteTechnicalFailureIs501Not400(t *testing.T) {
	broken := &stubVerifier{scheme: verifier.SchemeZK, fn: func(context.Context, verifier.Request) error {
		return errors.New("dependency unavailable")
	}}
	h := newTestRouter(t, func(d *Deps) { d.Verifier = broken })
	rr := do(h, http.MethodPost, "/api/v1/verifier/verify",
		`{"scheme":"ZK","subject":"agent-1","proof":"`+validProofHex+`"}`, nil)
	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("technical failure: %d %s, want 501", rr.Code, rr.Body.String())
	}
}

// Input validation runs before the verifier, and it must not be skippable.
func TestVerifyRouteInputValidation(t *testing.T) {
	called := &stubVerifier{scheme: verifier.SchemeZK}
	h := newTestRouter(t, func(d *Deps) { d.Verifier = called })

	bad := []string{
		`{"scheme":"ZK","proof":"deadbeef"}`,                 // no subject
		`{"scheme":"ZK","subject":"   ","proof":"deadbeef"}`, // blank subject
		`{"scheme":"ZK","subject":"a","proof":"not-hex"}`,    // bad proof encoding
		`{"scheme":"ZK","subject":"a","publicInputs":"zz"}`,  // bad public inputs
		`not json`, // malformed body
	}
	for _, body := range bad {
		rr := do(h, http.MethodPost, "/api/v1/verifier/verify", body, nil)
		if rr.Code != http.StatusBadRequest {
			t.Errorf("%s: %d %s, want 400", body, rr.Code, rr.Body.String())
		}
	}
	if called.calls != 0 {
		t.Errorf("verifier ran %d times on invalid input; validation must come first", called.calls)
	}

	if rr := do(h, http.MethodGet, "/api/v1/verifier/verify", "", nil); rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET verify: %d, want 405", rr.Code)
	}
}

// A deployment that forgot to wire the slot gets a clear 503, not a panic.
func TestVerifyRouteWithoutVerifierIs503(t *testing.T) {
	h := newTestRouter(t, func(d *Deps) { d.Verifier = nil })
	rr := do(h, http.MethodPost, "/api/v1/verifier/verify",
		`{"scheme":"ZK","subject":"agent-1","proof":"`+validProofHex+`"}`, nil)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("unwired slot: %d %s, want 503", rr.Code, rr.Body.String())
	}
}

// The subject must reach the verifier: a verifier that binds a proof to a
// subject has nothing to bind if the route drops the field.
func TestVerifyRoutePassesSubjectToVerifier(t *testing.T) {
	var seen verifier.Request
	capture := &stubVerifier{scheme: verifier.SchemeEIP712, fn: func(_ context.Context, req verifier.Request) error {
		seen = req
		return nil
	}}
	h := newTestRouter(t, func(d *Deps) { d.Verifier = capture })
	rr := do(h, http.MethodPost, "/api/v1/verifier/verify",
		`{"scheme":"eip712","subject":"0xabc","proof":"0x0102","publicInputs":"0x03"}`, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("verify: %d %s", rr.Code, rr.Body.String())
	}
	if seen.Subject != "0xabc" {
		t.Errorf("subject = %q, want 0xabc", seen.Subject)
	}
	if seen.Scheme != verifier.SchemeEIP712 {
		t.Errorf("scheme = %q, want EIP712 (lower-case input must be normalised)", seen.Scheme)
	}
	if string(seen.Proof) != "\x01\x02" || string(seen.PublicInputs) != "\x03" {
		t.Errorf("payload not hex-decoded: proof=%x publicInputs=%x", seen.Proof, seen.PublicInputs)
	}

	// The empty proof must arrive as nil, which is what the no-op and any real
	// verifier treats as "nothing to check".
	if rr := do(h, http.MethodPost, "/api/v1/verifier/verify", `{"scheme":"ZK","subject":"s","proof":""}`, nil); rr.Code != http.StatusOK {
		t.Fatalf("empty proof: %d", rr.Code)
	}
	if seen.Proof != nil {
		t.Errorf("empty proof decoded to %#v, want nil", seen.Proof)
	}
}
