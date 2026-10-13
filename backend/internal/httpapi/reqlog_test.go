// Judgements for the request-logging middleware (ADR-006 §3.2; §4.1 P4, §4.2 N5).
//
// Two of these carry weight beyond the usual "does it work", and they only work
// as a pair:
//
//	P4 — the middleware does not alter the response body, asserted byte-for-byte
//	     against the same handler served without the middleware.
//	N5 — the same comparison, run against a middleware mutated to write one byte
//	     into the body, and REQUIRED to fail.
//
// P4 on its own cannot be trusted, for the reason AGENTS.md §5 records about the
// progress hook: a middleware that never touches the body and a middleware that
// is not running at all are observationally identical under a byte comparison —
// both green. Only N5 still having teeth is what lets P4's green be read as
// "nothing was rewritten" rather than "the judgement is dead". ADR-006 §4.2
// names N5 as the mutation that would refute the ADR itself, which is why it is
// run here rather than described.
//
// N5 carries a second, less obvious guard: phase 1 runs the mutant with the
// injection switched OFF and requires it to agree with the real middleware
// byte-for-byte. Without that, "the mutated copy went red" would be
// indistinguishable from "the copy had drifted from the thing it copies", and
// the red would prove nothing about the real middleware.
package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"slices"
	"strings"
	"testing"
	"time"
)

// reqIDShapeRe is the shape a generated request id must have: requestIDBytes
// (16) of crypto/rand, hex encoded. Pinned as a shape rather than an example
// because the value is random by construction.
var reqIDShapeRe = regexp.MustCompile(`^[0-9a-f]{32}$`)

// logSink captures the middleware's output. The handler is JSON, so the line
// can be decoded and asserted field by field instead of substring-matched.
func logSink() (*bytes.Buffer, *slog.Logger) {
	buf := &bytes.Buffer{}
	return buf, slog.New(slog.NewJSONHandler(buf, nil))
}

// logLine decodes the single JSON object the middleware wrote.
//
// "Exactly one" is part of the judgement, not a convenience: a middleware that
// logs twice per request doubles the log volume and makes the requestId no
// longer identify one line, and nothing else in this file would notice.
func logLine(t *testing.T, buf *bytes.Buffer) map[string]any {
	t.Helper()
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 1 {
		t.Fatalf("want exactly one log line per request, got %d:\n%s", len(lines), buf.String())
	}
	var obj map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &obj); err != nil {
		t.Fatalf("log line is not a JSON object: %v (%s)", err, lines[0])
	}
	return obj
}

func strField(t *testing.T, obj map[string]any, key string) string {
	t.Helper()
	v, ok := obj[key]
	if !ok {
		t.Fatalf("log line has no %q field: %v", key, obj)
	}
	s, ok := v.(string)
	if !ok {
		t.Fatalf("log field %q = %#v, want a string", key, v)
	}
	return s
}

// headerKeysOnlyIn returns the keys present in a but not in b.
func headerKeysOnlyIn(a, b http.Header) []string {
	var only []string
	for k := range a {
		if _, ok := b[k]; !ok {
			only = append(only, k)
		}
	}
	slices.Sort(only)
	return only
}

// responseDiff is the P4 comparison, in one place so that the positive and the
// negative half of the judgement cannot drift apart: if the mutant's write stops
// being visible here, the negative control below fails and says so.
//
// It returns the differences between a response served bare and the same
// response served through a wrapper, as text, so a caller can both assert
// "none" and print what it saw.
func responseDiff(bare, wrapped *httptest.ResponseRecorder) []string {
	var diffs []string
	if bare.Code != wrapped.Code {
		diffs = append(diffs, fmt.Sprintf("status: wrapped %d, bare %d", wrapped.Code, bare.Code))
	}
	if !bytes.Equal(bare.Body.Bytes(), wrapped.Body.Bytes()) {
		diffs = append(diffs, fmt.Sprintf("body: wrapped %q, bare %q", wrapped.Body.Bytes(), bare.Body.Bytes()))
	}
	for k, want := range bare.Header() {
		if got := wrapped.Header().Values(k); !slices.Equal(got, want) {
			diffs = append(diffs, fmt.Sprintf("header %s: wrapped %v, bare %v", k, got, want))
		}
	}
	// The wrapper may add the request id and nothing else. A wrapper that also
	// set Content-Type or Content-Length would be deciding what the handler
	// meant, which is the class of change P4 exists to catch.
	if only := headerKeysOnlyIn(wrapped.Header(), bare.Header()); !slices.Equal(only, []string{requestIDHeader}) {
		diffs = append(diffs, fmt.Sprintf("wrapped response adds headers %v, want exactly [%s]", only, requestIDHeader))
	}
	if only := headerKeysOnlyIn(bare.Header(), wrapped.Header()); len(only) != 0 {
		diffs = append(diffs, fmt.Sprintf("wrapped response is missing headers %v the bare one had", only))
	}
	return diffs
}

// ---------------------------------------------------------------------------
// P4 — the middleware does not alter the response body (ADR-006 §4.1)
// ---------------------------------------------------------------------------

// TestLoggingMiddlewareDoesNotAlterBody is P4.
//
// The claim under test is a property of the middleware, so the control is the
// same handler served without it: same request, same handler, one response
// through loggingMiddleware and one without, compared byte-for-byte.
//
// The table crosses the handler shapes with the REQUEST METHODS, and the second
// axis is the load-bearing one. This judgement used to run GET-only, and a
// mutation that wrote one byte into the body only when `r.Method == POST`
// passed it — and passed N5 too, which was GET-only for the same reason.
// Measured, not argued: the mutation left `TestLoggingMiddlewareDoesNotAlterBody`
// and `TestN5InjectedBodyWriteTurnsP4Red` both green. That is not a hypothetical
// gap — the router has 15 POST routes (router.go: `methodOnly(http.MethodPost`,
// counted by grep) and every write endpoint in the API is one of them, so the
// judgement was blind on exactly the traffic it was written to protect.
// TestN5PostOnlyInjectedBodyWriteTurnsP4Red is the negative control that keeps
// the POST rows honest.
//
// Status and headers are compared as well as the body. The ADR's "不改状态码"
// is a separate sentence from "不改响应体", and a middleware that answered 200
// for a handler's 503 would pass a body-only comparison whenever the body was
// empty.
func TestLoggingMiddlewareDoesNotAlterBody(t *testing.T) {
	cases := []struct {
		name   string
		handle http.HandlerFunc
		req    func() *http.Request
	}{
		{
			name: "GET 200 via jsonResponse",
			handle: func(w http.ResponseWriter, r *http.Request) {
				jsonResponse(w, http.StatusOK, map[string]string{"status": "healthy"})
			},
			req: func() *http.Request {
				return httptest.NewRequest(http.MethodGet, "/api/v1/market/prices?symbol=BTCUSD", nil)
			},
		},
		{
			name: "GET 503 refusal via jsonError",
			handle: func(w http.ResponseWriter, r *http.Request) {
				jsonError(w, http.StatusServiceUnavailable, "market data unavailable")
			},
			req: func() *http.Request {
				return httptest.NewRequest(http.MethodGet, "/api/v1/market/prices", nil)
			},
		},
		{
			// The shape a buffering middleware breaks first: there is no body to
			// buffer, and net/http treats a 204 as "no content" on the wire.
			name: "GET 204 with no body",
			handle: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			},
			req: func() *http.Request {
				return httptest.NewRequest(http.MethodGet, "/api/v1/stats", nil)
			},
		},
		{
			// Two Write calls with no explicit WriteHeader: the implicit 200 is
			// net/http's, and statusWriter.observeStatus has to report that same
			// 200 rather than a zero.
			name: "GET body written in two calls, implicit 200",
			handle: func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte(`{"part":`))
				_, _ = w.Write([]byte(`1}`))
			},
			req: func() *http.Request {
				return httptest.NewRequest(http.MethodGet, "/api/v1/stats", nil)
			},
		},
		{
			// The write path, with a request body — the shape the GET-only
			// judgement could not see.
			name: "POST with a request body, 200",
			handle: func(w http.ResponseWriter, r *http.Request) {
				jsonResponse(w, http.StatusOK, map[string]any{"success": true, "orderId": "ord-1"})
			},
			req: func() *http.Request {
				return httptest.NewRequest(http.MethodPost, "/api/v1/market/trade",
					strings.NewReader(`{"symbol":"NVDA","side":"buy","notionalUSD":100,"leverage":1}`))
			},
		},
		{
			// A refused write: the 400 body is where a caller reads why, and it
			// is also the path a body-rewriting middleware corrupts invisibly.
			name: "POST with a request body, 400 refusal",
			handle: func(w http.ResponseWriter, r *http.Request) {
				jsonError(w, http.StatusBadRequest, "notionalUSD: must be positive")
			},
			req: func() *http.Request {
				return httptest.NewRequest(http.MethodPost, "/api/v1/market/trade",
					strings.NewReader(`{"symbol":"NVDA","notionalUSD":-1}`))
			},
		},
		{
			// A bodiless POST, where the body comparison is vacuous and only the
			// status/header half of the judgement can speak.
			name: "POST 204 with no body",
			handle: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			},
			req: func() *http.Request {
				return httptest.NewRequest(http.MethodPost, "/api/v1/agentcard/authorize", strings.NewReader(`{}`))
			},
		},
		{
			// POST is not the only other method the mux serves: a wrong-method
			// request is answered by methodOnly with a 405 and an Allow header,
			// and that path must survive the wrapper too.
			name: "DELETE 405 from methodOnly",
			handle: func(w http.ResponseWriter, r *http.Request) {
				methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
					jsonResponse(w, http.StatusOK, map[string]string{"ok": "yes"})
				})(w, r)
			},
			req: func() *http.Request {
				req := httptest.NewRequest(http.MethodDelete, "/api/v1/liquidations", nil)
				req.Header.Set(requestIDHeader, "dummy-req-id")
				ctx := context.WithValue(req.Context(), ctxKeyRequestID{}, "dummy-req-id")
				return req.WithContext(ctx)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf, logger := logSink()

			bare := httptest.NewRecorder()
			tc.handle(bare, tc.req())

			wrapped := httptest.NewRecorder()
			loggingMiddleware(logger, tc.handle).ServeHTTP(wrapped, tc.req())

			for _, d := range responseDiff(bare, wrapped) {
				t.Errorf("%s", d)
			}

			// And the line was actually written. A middleware that silently skipped
			// logging would satisfy every assertion above.
			line := logLine(t, buf)
			if got := strField(t, line, "path"); got != tc.req().URL.Path {
				t.Errorf("logged path = %q, want %q", got, tc.req().URL.Path)
			}
		})
	}
}

// TestStatusWriterKeepsResponseControllerWorking pins the reason statusWriter
// carries an Unwrap method.
//
// http.NewResponseController walks `Unwrap() http.ResponseWriter` to reach the
// underlying writer (net/http/responsecontroller.go). Without it, Flush/Hijack/
// SetWriteDeadline answer http.ErrNotSupported through the wrapper — which for
// a streaming endpoint is a silent behaviour change: the code path simply takes
// its "not supported" branch and nobody is told. Asserting the error is nil is
// the whole judgement; a test that only compared bodies would pass against a
// wrapper without Unwrap.
func TestStatusWriterKeepsResponseControllerWorking(t *testing.T) {
	buf, logger := logSink()

	var flushErr error
	handle := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		flushErr = http.NewResponseController(w).Flush()
		_, _ = w.Write([]byte("chunk"))
	})

	rr := httptest.NewRecorder()
	loggingMiddleware(logger, handle).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/stream", nil))

	if flushErr != nil {
		t.Fatalf("Flush through the middleware: %v — statusWriter.Unwrap is not being followed", flushErr)
	}
	if !rr.Flushed {
		t.Error("the underlying writer was never flushed: the wrapper swallowed the Flush")
	}
	if got := rr.Body.String(); got != "chunk" {
		t.Errorf("body = %q, want %q", got, "chunk")
	}
	_ = logLine(t, buf)
}

// ---------------------------------------------------------------------------
// N5 — inject a body write and P4 must go red (ADR-006 §4.2)
// ---------------------------------------------------------------------------

// n5WriteBody is the injection switch for mutatedLoggingMiddleware. False makes
// the mutant a faithful copy; true adds the single byte.
var n5WriteBody bool

// n5WriteBodyOn is the METHOD switch, and it is the second axis for a reason
// that was measured rather than imagined.
//
// The first version of this file injected unconditionally, and its two halves
// ran GET only. A mutation of the shape `if r.Method == http.MethodPost {
// w.Write(one byte) }` therefore passed both: the injection never fired on the
// requests the judgement sent, so P4 stayed green AND N5 stayed green — the
// negative control was as blind as the thing it was guarding. Since every write
// endpoint in this router is a POST, that is the whole class of traffic a
// body-rewriting middleware would damage.
//
// nil means "every request". Setting it to a method makes the mutant write only
// on that method, which is what turns a POST-only injection into a red.
var n5WriteBodyOn *string

// mutatedLoggingMiddleware is a copy of loggingMiddleware (reqlog.go:151-172)
// with exactly one statement added, guarded by n5WriteBody/n5WriteBodyOn: a
// one-byte Write into the response body, from inside the middleware.
//
// It is a copy rather than a wrapper around the real middleware, and the reason
// is not pedantry. A wrapper that wrote after next.ServeHTTP returned would be
// an injection from outside — "the middleware wrote the body" is the claim
// under test, so the write has to happen on the same path the handler's output
// takes. The cost of copying is drift, and phase 1 of the tests below pays it
// down: with the switch off the copy must produce byte-identical responses to
// the real middleware. If this copy stops resembling the one in reqlog.go, that
// comparison goes red and says so, instead of quietly making the red in phase 2
// unattributable.
func mutatedLoggingMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		id := strings.TrimSpace(r.Header.Get(requestIDHeader))
		if !validRequestID(id) {
			id = newRequestID()
		}
		w.Header().Set(requestIDHeader, id)

		r = r.WithContext(context.WithValue(r.Context(), ctxKeyRequestID{}, id))

		sw := &statusWriter{ResponseWriter: w}
		if n5WriteBody && (n5WriteBodyOn == nil || *n5WriteBodyOn == r.Method) {
			// The injection. One byte, and the handler is untouched.
			_, _ = sw.Write([]byte("!"))
		}
		next.ServeHTTP(sw, r)

		recordRequest(logger, r, id, sw.observeStatus(), time.Since(start))
	})
}

// n5Reset puts both injection switches back to "off, on every method" so one
// test's mutation cannot leak into another's reading.
func n5Reset(t *testing.T) {
	t.Helper()
	n5WriteBody = false
	n5WriteBodyOn = nil
	t.Cleanup(func() {
		n5WriteBody = false
		n5WriteBodyOn = nil
	})
}

// TestN5InjectedBodyWriteTurnsP4Red is N5.
//
// Phase 1 (control): with the injection off, the mutant must agree with the
// real middleware byte-for-byte. Without this, a red in phase 2 could equally
// mean "the copy drifted" — and a mutation test that cannot tell those apart
// proves nothing about the code under test.
//
// Phase 2 (the judgement): with the injection on, the same P4 comparison must
// FAIL. If it still passes, P4 has no teeth and its green in the test above is
// worthless.
func TestN5InjectedBodyWriteTurnsP4Red(t *testing.T) {
	handle := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]string{"status": "healthy"})
	})
	req := func() *http.Request {
		return httptest.NewRequest(http.MethodGet, "/api/v1/stats", nil)
	}

	_, logger := logSink()

	// Phase 1 — the mutant is a faithful copy of the real middleware.
	n5Reset(t)

	real := httptest.NewRecorder()
	loggingMiddleware(logger, handle).ServeHTTP(real, req())
	copied := httptest.NewRecorder()
	mutatedLoggingMiddleware(logger, handle).ServeHTTP(copied, req())

	if !bytes.Equal(real.Body.Bytes(), copied.Body.Bytes()) || real.Code != copied.Code {
		t.Fatalf("control failed: the mutated copy does not match the real middleware even with the injection off\n real   %d %q\n copy   %d %q\n"+
			"fix the copy before reading anything into phase 2",
			real.Code, real.Body.Bytes(), copied.Code, copied.Body.Bytes())
	}
	if diffs := responseDiff(bareFor(handle, req), wrappedFor(mutatedLoggingMiddleware(logger, handle), req)); len(diffs) != 0 {
		t.Fatalf("control failed: with the injection off the copy already reads as altered — the comparison is not measuring the injection: %v", diffs)
	}

	// Phase 2 — inject one byte and require the comparison to notice.
	n5WriteBody = true
	if diffs := responseDiff(bareFor(handle, req), wrappedFor(mutatedLoggingMiddleware(logger, handle), req)); len(diffs) == 0 {
		t.Fatal("N5 FAILED: a middleware that writes one byte into the response body still passes the byte-for-byte comparison, " +
			"so P4 (TestLoggingMiddlewareDoesNotAlterBody) has no teeth and its green proves nothing")
	}

	// Named explicitly, so the failure mode is not just "something differed":
	// one byte, and the body is no longer the handler's. Logged rather than
	// only asserted, so the difference is readable in the stdout of any run.
	handlerBody := `{"status":"healthy"}` + "\n"
	got := wrappedFor(mutatedLoggingMiddleware(logger, handle), req)
	t.Logf("N5 injection: handler produced %q, the mutated middleware produced %q", handlerBody, got.Body.String())
	if got.Body.String() != "!"+handlerBody {
		t.Errorf("the injected write did not land where expected: %q", got.Body.String())
	}
}

// TestN5PostOnlyInjectedBodyWriteTurnsP4Red is the control that gives P4's POST
// rows their teeth, and it exists because the first version of this file had a
// hole that nothing could see.
//
// The mutation is the one that got away: write a single byte into the body ONLY
// when the request is a POST. Run against the GET-only P4 and GET-only N5 that
// this file used to carry, that mutation left BOTH green — the injection never
// fired on the requests they sent, and a judgement that is never given the
// chance to fail is indistinguishable from one that cannot fail (AGENTS.md §5,
// the same reading as the progress hook).
//
// So the assertions here are the mirror image of the first control's:
//
//	GET  — the mutant must NOT alter a GET response (it does not write on GET)
//	POST — the mutant MUST alter a POST response, and P4's POST rows are the
//	       rows that catch it
//
// The first assertion is what stops this test from passing for the wrong
// reason: if the method switch were ignored and the byte were written on every
// request, "POST went red" would prove nothing about POST coverage in
// particular. The second is the point. And the third states the hole directly:
// a GET-only comparison over the same mutant must come out CLEAN, which is
// exactly the blind spot the method-crossed table closes.
func TestN5PostOnlyInjectedBodyWriteTurnsP4Red(t *testing.T) {
	post := http.MethodPost
	handle := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{"success": true, "orderId": "ord-1"})
	})
	getReq := func() *http.Request {
		return httptest.NewRequest(http.MethodGet, "/api/v1/stats", nil)
	}
	postReq := func() *http.Request {
		return httptest.NewRequest(http.MethodPost, "/api/v1/market/trade",
			strings.NewReader(`{"symbol":"NVDA","side":"buy","notionalUSD":100,"leverage":1}`))
	}

	_, logger := logSink()
	n5Reset(t)
	n5WriteBody = true
	n5WriteBodyOn = &post
	mutant := mutatedLoggingMiddleware(logger, handle)

	// 1. GET is untouched: the switch is a method switch, not a no-op.
	if diffs := responseDiff(bareFor(handle, getReq), wrappedFor(mutant, getReq)); len(diffs) != 0 {
		t.Fatalf("the POST-only mutant altered a GET response, so this is not a POST-only injection: %v", diffs)
	}

	// 2. POST is altered, and the difference is the one byte — the same
	//    comparison P4 makes on its POST rows.
	diffs := responseDiff(bareFor(handle, postReq), wrappedFor(mutant, postReq))
	if len(diffs) == 0 {
		t.Fatal("N5(POST) FAILED: a middleware that writes one byte into a POST response passes the byte-for-byte comparison, " +
			"so P4 is still blind on the method every write endpoint in this router uses")
	}
	got := wrappedFor(mutant, postReq)
	t.Logf("N5(POST) injection: handler produced %q, the mutated middleware produced %q", bareFor(handle, postReq).Body.String(), got.Body.String())
	if !strings.HasPrefix(got.Body.String(), "!") {
		t.Errorf("the injected byte did not land at the head of the body: %q", got.Body.String())
	}

	// 3. The hole, stated as an assertion. A GET-only comparison over this same
	//    mutant is clean — which is precisely why the table above had to grow a
	//    method axis rather than a fifth handler shape.
	if diffs := responseDiff(bareFor(handle, getReq), wrappedFor(mutant, getReq)); len(diffs) != 0 {
		t.Fatalf("a GET-only comparison caught the POST-only mutant: %v — then this test is not demonstrating the gap it claims", diffs)
	}
	t.Log("a GET-only comparison over the POST-only mutant is CLEAN — that is the blind spot the method-crossed P4 table closes")
}

// bareFor serves a request through the handler with no middleware, and
// wrappedFor serves the same request through a wrapper. Factored out because
// every control above has to run the identical comparison.
func bareFor(h http.Handler, req func() *http.Request) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req())
	return rr
}

func wrappedFor(w http.Handler, req func() *http.Request) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	w.ServeHTTP(rr, req())
	return rr
}

// ---------------------------------------------------------------------------
// request-id behaviour
// ---------------------------------------------------------------------------

// TestRequestIDEchoedGeneratedAndReplaced covers the three outcomes the
// middleware can produce for the id, and the two sinks it must agree across.
//
// The hostile rows are the point of the table. The id is caller-controlled and
// lands in a response header and a log line; a value carrying CR/LF is a header
// splitting attempt, and a value with no bound is an unbounded caller-supplied
// string in every log line. "Replaced" is asserted as "the response header does
// not contain what was sent", not as "the response header is non-empty" —
// the weaker form passes against a middleware that echoes anything it is given.
func TestRequestIDEchoedGeneratedAndReplaced(t *testing.T) {
	const wellFormed = "0123456789abcdef0123456789abcdef"

	cases := []struct {
		name     string
		sent     string
		set      bool
		wantEcho bool
	}{
		{name: "absent header", set: false},
		{name: "well-formed token", sent: wellFormed, set: true, wantEcho: true},
		{name: "token alphabet: hyphen underscore dot", sent: "req-1_A.B", set: true, wantEcho: true},
		{name: "boundary: exactly maxRequestIDLen", sent: strings.Repeat("a", maxRequestIDLen), set: true, wantEcho: true},
		{name: "empty header", sent: "", set: true},
		{name: "whitespace only", sent: "   ", set: true},
		{name: "CRLF header splitting attempt", sent: "abc\r\nX-Injected: 1", set: true},
		{name: "bare LF", sent: "abc\nX-Injected: 1", set: true},
		{name: "one past the length bound", sent: strings.Repeat("a", maxRequestIDLen+1), set: true},
		{name: "space inside", sent: "abc def", set: true},
		{name: "double quote", sent: `abc"def`, set: true},
		{name: "semicolon", sent: "abc;def", set: true},
		{name: "non-ascii", sent: "abc\u00e9def", set: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf, logger := logSink()

			var seenByHandler string
			h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				seenByHandler = requestIDFrom(r.Context())
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(http.MethodGet, "/api/v1/stats", nil)
			if tc.set {
				req.Header.Set(requestIDHeader, tc.sent)
			}
			rr := httptest.NewRecorder()
			h.ServeHTTP(rr, req)

			got := rr.Header().Get(requestIDHeader)
			if got == "" {
				t.Fatalf("no %s on the response", requestIDHeader)
			}
			if tc.wantEcho {
				if got != tc.sent {
					t.Errorf("well-formed id was not echoed: sent %q, got %q", tc.sent, got)
				}
			} else {
				// Not echoed means replaced by a freshly minted id, not merely
				// "something non-empty" — the weaker form passes against a
				// middleware that reflects anything it is handed.
				if got == tc.sent {
					t.Errorf("hostile id was echoed back verbatim: %q", got)
				}
				if !reqIDShapeRe.MatchString(got) {
					t.Errorf("replacement id = %q, want 32 lowercase hex characters", got)
				}
			}
			if strings.ContainsAny(got, "\r\n") {
				t.Errorf("response %s carries a line break: %q", requestIDHeader, got)
			}
			// One id across all three places it is observable, or the id does not
			// join the log line to the response the caller is holding.
			if seenByHandler != got {
				t.Errorf("handler saw requestIDFrom = %q, response header = %q", seenByHandler, got)
			}
			if id := strField(t, logLine(t, buf), "requestId"); id != got {
				t.Errorf("log requestId = %q, response header = %q", id, got)
			}
		})
	}
}

// TestNewRequestIDIsOpaqueAndUnique pins the shape of a generated id: full
// entropy, no collisions, and not a counter.
//
// The uniqueness half is not decoration. A counter would be cheaper than
// crypto/rand and would satisfy "32 hex characters" too, and the property it
// breaks — two requests sharing an id — is invisible until someone greps a log
// line and gets several.
func TestNewRequestIDIsOpaqueAndUnique(t *testing.T) {
	const n = 256
	seen := make(map[string]struct{}, n)
	for i := 0; i < n; i++ {
		id := newRequestID()
		if !reqIDShapeRe.MatchString(id) {
			t.Fatalf("id %d = %q, want 32 lowercase hex characters", i, id)
		}
		if _, dup := seen[id]; dup {
			t.Fatalf("id %q was generated twice in %d draws", id, n)
		}
		seen[id] = struct{}{}
	}
}

// TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement records a measured
// defect rather than asserting a property, and it is written this way on
// purpose.
//
// reqlog.go:47-57 justifies the hex encoding with a claim: that a hex id
// carries no `\d{3,}` run, so when ADR-006 §3.6 puts `requestId` into the
// response envelope and on the UI, market_test.go's "a refusal carries no JSON
// number" assertion will not trip. The claim is false. Measured over 100000
// generated ids, 99203 (99.2030%) contain a `\d{3,}` run, because three
// consecutive hex digits are common; the first id this test ever produced was
// "0c7e264530aad5c50531ea8b082181ea", carrying "264530".
//
// # Which assertion actually goes red (corrected — see docs/changes/055 §6.1)
//
// The first version of this comment, and of 055 §6.1, named the wrong one. Read
// at the source, assertRefusal makes two independent checks:
//
//	market_test.go:182-184  the TOP-LEVEL KEY SET must be exactly [error]
//	market_test.go:199-201  the body must carry ZERO JSON numbers
//
// Adding a `requestId` STRING to the refusal envelope adds a key. The key-set
// check is what fails, and it fails for every id — not just the 99.2% that also
// match priceShapedInText. The number check is not reached, because a hex string
// is not a JSON number and `priceShapedInText` is only applied to the `error`
// value's prose (market_test.go:188), never to the id.
//
// The distinction is not pedantry: it changes the fix. "The id's shape broke it"
// invites a search for an id format with no digits, which hex cannot provide —
// the alphabet has six of them and a 32-character id contains a run of three
// with probability ~0.992. "The key set broke it" points at the thing that must
// actually change: the allowed-key set, which is a 03-环 judgement change and
// needs a negative control (ADR-006 §6 负面后果 4 already says so).
//
// # What this test can and cannot see
//
// It is a MEASUREMENT, not a property. The floor is a band, deliberately narrow
// because a floor with no discriminating power is not a judgement: the first
// version asserted `>= 0.90` against a true rate of 0.992, which needs a ~9-point
// collapse to fire — P(fail) ≈ 0, so it could never have said anything. The band
// is now [0.97, 1.0] over 1000 draws, which is ~2.2 points of slack for sampling
// noise (P(fail) by noise ≈ 1e-9) and fires the moment the id shape actually
// changes, in either direction.
//
// Two things it structurally cannot see, stated here rather than left implied:
//
//   - It calls this package's own newRequestID and priceShapedInText. If either
//     changes, this test changes with it. It pins the relationship between the
//     two, not an independent property of the id.
//   - It measures the SHAPE that would break the refusal judgement. It does not
//     run assertRefusal against a real envelope; the judgement that does is
//     market_test.go's, and it cannot be driven from here without landing §3.6.
func TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement(t *testing.T) {
	const draws = 1000
	// The band. Low enough to absorb sampling noise, high enough that any real
	// change in the id shape moves it.
	const floorPct = 0.97

	matching := 0
	var example string
	for i := 0; i < draws; i++ {
		id := newRequestID()
		m := priceShapedInText.FindString(id)
		if m == "" {
			continue
		}
		matching++
		if example == "" {
			example = fmt.Sprintf("%s -> %q", id, m)
		}
	}
	low := int(draws * floorPct)
	if matching < low || matching > draws {
		t.Fatalf("measured %d/%d generated ids containing a priceShapedInText match, outside the band [%d, %d] "+
			"(example: %s). The rate is expected to be ~99.2%% because three consecutive hex digits are common. "+
			"If it has DROPPED, the id shape changed and the comment at reqlog.go:47-57 may now be true — update the comment, then re-pin this band",
			matching, draws, low, draws, example)
	}
	t.Logf("%d/%d generated ids match priceShapedInText, band [%d, %d] (example: %s) — a measurement, not a property; see the doc comment",
		matching, draws, low, draws, example)
}

// TestValidRequestIDBoundaries pins the predicate directly, including the two
// ends of the length bound that the table above can only reach through the
// middleware.
func TestValidRequestIDBoundaries(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"", false},
		{"a", true},
		{strings.Repeat("a", maxRequestIDLen), true},
		{strings.Repeat("a", maxRequestIDLen+1), false},
		{"abc\r\n", false},
		{"abc\ndef", false},
		{"abc\tdef", false},
		{"abc/def", false},
		{"abc+def", false},
		{"-_.-_.", true},
	}
	for _, tc := range cases {
		if got := validRequestID(tc.in); got != tc.want {
			t.Errorf("validRequestID(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// the log line
// ---------------------------------------------------------------------------

// TestMiddlewareLogsOneJSONLinePerRequest pins the field set and, in the same
// test, the field that must NOT be there.
//
// The path is logged as r.URL.Path and never r.URL.RequestURI: the query string
// is where a token ends up (?token=…), and this line is written for every
// request. Asserting the token's absence is what makes that a judgement rather
// than a comment.
func TestMiddlewareLogsOneJSONLinePerRequest(t *testing.T) {
	buf, logger := logSink()

	h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusTeapot, map[string]string{"ok": "yes"})
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/v1/market/prices?symbol=BTCUSD&token=sk-live-do-not-log", nil))

	line := logLine(t, buf)

	if got := strField(t, line, "method"); got != http.MethodGet {
		t.Errorf("method = %q, want GET", got)
	}
	if got := strField(t, line, "path"); got != "/api/v1/market/prices" {
		t.Errorf("path = %q, want the path without the query string", got)
	}
	if got := strField(t, line, "requestId"); !reqIDShapeRe.MatchString(got) {
		t.Errorf("requestId = %q, want 32 lowercase hex characters", got)
	}
	if got := strField(t, line, "err"); got != "" {
		t.Errorf("err = %q, want the empty string when the handler recorded no error", got)
	}
	if got, ok := line["status"].(float64); !ok || int(got) != http.StatusTeapot {
		t.Errorf("status = %#v, want %d", line["status"], http.StatusTeapot)
	}
	if got, ok := line["durationMs"].(float64); !ok || got < 0 {
		t.Errorf("durationMs = %#v, want a non-negative number", line["durationMs"])
	}
	if strings.Contains(buf.String(), "sk-live-do-not-log") {
		t.Errorf("the query string reached the log line: %s", buf.String())
	}
	// Every field the ADR names is present every time; a consumer must not have
	// to branch on a key that only sometimes exists.
	for _, key := range []string{"requestId", "method", "path", "status", "durationMs", "err"} {
		if _, ok := line[key]; !ok {
			t.Errorf("log line is missing %q: %v", key, line)
		}
	}
}

// TestMiddlewareLogsTheStatusTheHandlerWrote covers observeStatus on both
// branches: an explicit WriteHeader, and the implicit 200 a body-only handler
// gets from net/http. A middleware that reported 0 for the second case would be
// describing a response that never went out.
func TestMiddlewareLogsTheStatusTheHandlerWrote(t *testing.T) {
	cases := []struct {
		name   string
		handle http.HandlerFunc
		want   int
	}{
		{
			name:   "explicit status",
			handle: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusCreated) },
			want:   http.StatusCreated,
		},
		{
			name:   "implicit 200 from a body-only handler",
			handle: func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte("ok")) },
			want:   http.StatusOK,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf, logger := logSink()
			rr := httptest.NewRecorder()
			loggingMiddleware(logger, tc.handle).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/x", nil))

			if rr.Code != tc.want {
				t.Errorf("response status = %d, want %d", rr.Code, tc.want)
			}
			line := logLine(t, buf)
			if got, ok := line["status"].(float64); !ok || int(got) != tc.want {
				t.Errorf("logged status = %#v, want %d", line["status"], tc.want)
			}
		})
	}
}

// TestStatusWriterKeepsOnlyTheFirstWriteHeader pins net/http's own rule: a
// second WriteHeader is superfluous and ignored on the wire, so the log must
// report the first one. Copying the last value instead would make the log
// disagree with the response the caller received.
func TestStatusWriterKeepsOnlyTheFirstWriteHeader(t *testing.T) {
	rr := httptest.NewRecorder()
	sw := &statusWriter{ResponseWriter: rr}

	sw.WriteHeader(http.StatusNotFound)
	sw.WriteHeader(http.StatusInternalServerError)

	if got := sw.observeStatus(); got != http.StatusNotFound {
		t.Errorf("observeStatus = %d, want the first code written (%d)", got, http.StatusNotFound)
	}
	if sw.Unwrap() != http.ResponseWriter(rr) {
		t.Error("Unwrap does not return the wrapped writer")
	}
}

// TestMiddlewareLogsHandlerRecordedErrorRedacted exercises the seam
// (errContextKey / requestError) the handler-migration round will write into,
// and the redaction that must happen before the text reaches the sink.
//
// The handler has to mutate the request in place — `*r = *r.WithContext(...)` —
// and that is a finding, not a trick: the middleware reads r.Context() on the
// same *http.Request it handed down, and a derived request returned by
// r.WithContext does not travel back up. Any handler that records an error must
// therefore either mutate the struct it was given or go through a helper. See
// docs/changes/055 §6.
func TestMiddlewareLogsHandlerRecordedErrorRedacted(t *testing.T) {
	buf, logger := logSink()

	raw := errors.New("alpaca refused: ALPACA_API_KEY=sk-live-do-not-log via postgres://koliance:hunter2@db.internal.example:5432/koliance")
	h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*r = *r.WithContext(context.WithValue(r.Context(), errContextKey{}, raw))
		jsonError(w, http.StatusBadGateway, "upstream unavailable")
	}))

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/v1/market/prices", nil))

	line := logLine(t, buf)
	got := strField(t, line, "err")
	if got == "" {
		t.Fatal("the handler recorded an error but the log line's err field is empty")
	}
	for _, secret := range []string{"sk-live-do-not-log", "hunter2", "db.internal.example"} {
		if strings.Contains(got, secret) {
			t.Errorf("logged err still carries %q: %q", secret, got)
		}
	}
	if !strings.Contains(got, markEnv) || !strings.Contains(got, markDSN) {
		t.Errorf("logged err = %q, want the env-assignment and DSN markers %q/%q", got, markEnv, markDSN)
	}
	// The recorded error must not change the response: recording is not
	// classifying (ADR-006 §3.2, "中间件不做分类").
	if rr.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want the handler's own %d", rr.Code, http.StatusBadGateway)
	}
	if body := rr.Body.String(); strings.Contains(body, "ALPACA_API_KEY") {
		t.Errorf("response body carries the raw error: %s", body)
	}
}

// TestRecordRequestWithNilLoggerDoesNotPanic covers the nil guard. It is
// unreachable through NewRouter (which substitutes a default) and stays because
// the alternative is a panic inside the request path.
func TestRecordRequestWithNilLoggerDoesNotPanic(t *testing.T) {
	recordRequest(nil, httptest.NewRequest(http.MethodGet, "/x", nil), "id", http.StatusOK, time.Millisecond)
}

// ---------------------------------------------------------------------------
// sanitization (ADR-006 §3.4)
// ---------------------------------------------------------------------------

// TestSanitizeLogValue walks the seven §3.4 classes plus the controls.
//
// The controls matter more than the hits. A sanitizer that redacted everything
// would pass every "the secret is gone" assertion in this file while destroying
// the diagnostic value the log exists for — and the controls below are the
// specific things the patterns claim to leave alone (a bare URL path, and
// ordinary prose with no secret in it).
//
// # The second half of the table
//
// An independent review read the patterns against the classes they claim to
// cover and found whole FORMS passing through — not exotic spellings, the
// ordinary ones: a quoted `relation "x"`, a `SQLSTATE:` with a colon, the
// keyword DSN (`host=… user=…`), an in-package function name, a credential
// value with no `=`, a path with no leading space, an IPv6 literal, a host with
// an underscore or a port. Every one of those has a row below and every row
// asserts the secret itself is absent, so the row is a negative control for the
// fix rather than a demonstration of it: remove the corresponding pattern and
// the row goes red.
//
// The rows marked "was missed" are the ones that were green-by-absence before —
// they were not in the table, because the pattern they need did not exist.
//
// What is NOT here is as deliberate. The §3.4 #6 truncated body has no row,
// because no shape identifies an unterminated JSON body and pretending otherwise
// would be a rule that passes its own test and catches nothing in production.
// TestSanitizeLogValueKnownResiduals pins that gap instead, so the boundary
// stated in docs/changes/055 §6 cannot rot into a claim that the class is closed.
func TestSanitizeLogValue(t *testing.T) {
	cases := []struct {
		name       string
		in         string
		wantExact  string
		wantMarker string
		absent     []string
	}{
		{
			name:       "env assignment",
			in:         "ALPACA_API_KEY=sk-live-do-not-log",
			wantExact:  markEnv,
			wantMarker: markEnv,
			absent:     []string{"sk-live-do-not-log"},
		},
		{
			name:       "env name without a value",
			in:         "ALPACA_API_KEY/ALPACA_API_SECRET are not configured",
			wantExact:  markEnvName + "/" + markEnvName + " are not configured",
			wantMarker: markEnvName,
			absent:     []string{"ALPACA_API_KEY"},
		},
		{
			name:       "DSN with an inline password",
			in:         "postgres://koliance:hunter2@db.internal.example:5432/koliance",
			wantExact:  markDSN,
			wantMarker: markDSN,
			absent:     []string{"hunter2", "db.internal.example"},
		},
		{
			// was missed: the keyword DSN has neither `://` nor a `password=`,
			// and is what libpq and every Go driver accept.
			name:       "keyword DSN (host/user/dbname, no ://)",
			in:         "host=db.internal.example user=koliance dbname=koliance sslmode=disable",
			wantExact:  markDSN,
			wantMarker: markDSN,
			absent:     []string{"db.internal.example", "koliance"},
		},
		{
			name:       "keyword DSN with only a password",
			in:         "password=hunter2",
			wantExact:  markDSN,
			wantMarker: markDSN,
			absent:     []string{"hunter2"},
		},
		{
			name:       "DSN enclosed in backticks",
			in:         "`postgres://koliance:hunter2@db.internal.example:5432/koliance`",
			wantMarker: markDSN,
			absent:     []string{"hunter2", "db.internal.example"},
		},
		{
			name:       "DSN enclosed in double quotes",
			in:         `"postgres://koliance:hunter2@db.internal.example:5432/koliance"`,
			wantMarker: markDSN,
			absent:     []string{"hunter2", "db.internal.example"},
		},
		{
			name:       "DSN enclosed in parentheses",
			in:         "(postgres://koliance:hunter2@db.internal.example:5432/koliance)",
			wantMarker: markDSN,
			absent:     []string{"hunter2", "db.internal.example"},
		},
		{
			name:       "truncated alpaca API error body (SEC-P0-3)",
			in:         `alpaca API error [422]: {"message":"invalid symbol","code":401100`,
			wantMarker: markUpstream,
			absent:     []string{"invalid symbol"},
		},
		{
			name:       "truncated alpaca bars status body (SEC-P0-3)",
			in:         `alpaca bars status 500: {"error":"internal failure`,
			wantMarker: markUpstream,
			absent:     []string{"internal failure"},
		},
		{
			name:       "go stack frame",
			in:         "goroutine 1 [running]:",
			wantMarker: markStack,
			absent:     []string{"goroutine 1"},
		},
		{
			name:       "go source location",
			in:         "panic at /usr/local/go/src/runtime/panic.go:770",
			wantMarker: markStack,
			absent:     []string{"panic.go:770"},
		},
		{
			// was missed: ADR-006 §3.4 #1 names "包内函数名" explicitly, and a
			// pointer receiver is how the runtime renders one.
			name:       "in-package function name",
			in:         "database.(*DB).Connect: connection refused",
			wantMarker: markStack,
			absent:     []string{"(*DB).Connect"},
		},
		{
			name:       "qualified function name",
			in:         "internal/platform/database.(*DB).Ping: timeout",
			wantMarker: markStack,
			absent:     []string{"(*DB).Ping"},
		},
		{
			name:       "sql text and constraint name",
			in:         `duplicate key value violates unique constraint "cards_pkey" (SQLSTATE 23505)`,
			wantMarker: markSQL,
			absent:     []string{"cards_pkey", "23505"},
		},
		{
			// was missed: PostgreSQL's missing-table message says `relation`,
			// and the original rule only knew `constraint`.
			name:       "sql quoted relation name",
			in:         `pq: relation "api_keys" does not exist`,
			wantMarker: markSQL,
			absent:     []string{"api_keys"},
		},
		{
			// was missed: the separator is a colon here, and the original rule
			// required whitespace.
			name:       "sqlstate with a colon",
			in:         "duplicate key (SQLSTATE: 23505)",
			wantMarker: markSQL,
			absent:     []string{"23505"},
		},
		{
			// was missed: #5 is "the VALUE of an env var", and a value with its
			// label in lowercase prose matched none of the env rules.
			name:       "credential value with no NAME=",
			in:         "upstream rejected the request: token sk-live-do-not-log",
			wantMarker: markSecret,
			absent:     []string{"sk-live-do-not-log"},
		},
		{
			name:       "third-party response body",
			in:         `{"message":"invalid symbol","code":40110000}`,
			wantExact:  markUpstream,
			wantMarker: markUpstream,
			absent:     []string{"invalid symbol"},
		},
		{
			name:       "file path in prose",
			in:         "open /var/lib/koliance/keys.pem: permission denied",
			wantMarker: markPath,
			absent:     []string{"/var/lib/koliance/keys.pem"},
		},
		{
			// was missed: the original rule required a leading space, and this
			// is the form an error string actually carries.
			name:       "file path with no leading space",
			in:         "open/var/lib/koliance/keys.pem: permission denied",
			wantMarker: markPath,
			absent:     []string{"/var/lib/koliance/keys.pem"},
		},
		{
			name:       "windows file path",
			in:         `open C:\koliance\keys.pem: permission denied`,
			wantMarker: markPath,
			absent:     []string{`C:\koliance\keys.pem`},
		},
		{
			name:       "internal address",
			in:         "dial tcp 10.0.3.7:5432: connect: connection refused",
			wantMarker: markHost,
			absent:     []string{"10.0.3.7"},
		},
		{
			name:       "internal hostname",
			in:         "lookup db.internal.example: no such host",
			wantMarker: markHost,
			absent:     []string{"db.internal.example"},
		},
		{
			// was missed: an IPv6 literal is bracketed, and the original rule
			// only knew dotted quads.
			name:       "ipv6 internal address",
			in:         "dial tcp [fd00::1]:5432: connect: connection refused",
			wantMarker: markHost,
			absent:     []string{"fd00::1"},
		},
		{
			// was missed: a single-label host carries no dot, so the three-label
			// rule could not see it. The port is what makes it a host rather
			// than an identifier.
			name:       "single-label host with a port",
			in:         "dial tcp db_internal:5432: connect: connection refused",
			wantMarker: markHost,
			absent:     []string{"db_internal:5432"},
		},
		{
			name:       "localhost with a port",
			in:         "dial tcp localhost:5432: connect: connection refused",
			wantMarker: markHost,
			absent:     []string{"localhost:5432"},
		},
		{
			// was missed: Docker and Kubernetes both mint underscored names, and
			// the DNS-strict character class rejected them.
			name:       "hostname with an underscore",
			in:         "lookup db_internal.example.com: no such host",
			wantMarker: markHost,
			absent:     []string{"db_internal.example.com"},
		},
		{
			// Control 1: the diagnostic value the middleware keeps. If a future
			// rule starts matching a bare URL path, the log line stops saying which
			// endpoint failed.
			name:      "control: a bare url path is left alone",
			in:        "/api/v1/market/prices",
			wantExact: "/api/v1/market/prices",
		},
		{
			// Control 2: prose with no secret in it must survive verbatim, or the
			// sanitizer has become a redaction machine.
			name:      "control: ordinary prose is left alone",
			in:        "market data unavailable: upstream did not answer",
			wantExact: "market data unavailable: upstream did not answer",
		},
		{
			// Control 3: the bare-value rule is keyword-anchored for a reason.
			// `errors.Unwrap` is the identifier the host rule's comment promises
			// to keep out, and a bare-value rule loose enough to eat any short
			// token would have taken it.
			name:      "control: a package qualifier is left alone",
			in:        "errors.Unwrap returned a nil cause",
			wantExact: "errors.Unwrap returned a nil cause",
		},
		{
			name:      "empty string",
			in:        "",
			wantExact: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := sanitizeLogValue(tc.in)
			if tc.wantExact != "" || tc.in == "" {
				if got != tc.wantExact {
					t.Errorf("sanitizeLogValue(%q) = %q, want %q", tc.in, got, tc.wantExact)
				}
			}
			if tc.wantMarker != "" && !strings.Contains(got, tc.wantMarker) {
				t.Errorf("sanitizeLogValue(%q) = %q, want the %s marker", tc.in, got, tc.wantMarker)
			}
			for _, secret := range tc.absent {
				if strings.Contains(got, secret) {
					t.Errorf("sanitizeLogValue(%q) = %q still carries %q", tc.in, got, secret)
				}
			}
		})
	}
}

// TestSanitizeLogValueKnownResiduals asserts the residuals are STILL there.
//
// This looks backwards and is not. docs/changes/055 §6 declares the boundary of
// the sanitizer in prose, and prose does not fail a build: the day someone
// closes one of these gaps, the declaration goes stale and nothing says so —
// the exact failure mode AGENTS.md §8 records for self-referential statements
// ("错了不会响，只会静默地错").
//
// So each declared residual is pinned as a measurement, in the same style as
// TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement. When a residual
// closes, THIS test goes red, and the red is the prompt to move the row out of
// the declaration and into the table above.
//
// The first two are the §3.4 #6 gap, and it is the largest one: the pattern
// needs a closing brace, and the client truncates at 256/512 characters, so the
// truncated body — the case the code comment cites as the reason truncation is
// safe — is the case that goes through whole.
func TestSanitizeLogValueKnownResiduals(t *testing.T) {
	cases := []struct {
		name    string
		in      string
		present string
		why     string
	}{
		{
			name:    "truncated third-party body (generic non-alpaca)",
			in:      `upstream API error [422]: {"message":"invalid symbol","code":401100`,
			present: "invalid symbol",
			why:     "no closing brace survives truncation, so no shape identifies the body",
		},
		{
			name:    "third-party body with a brace inside a string value",
			in:      `{"message":"bad } symbol","code":1}`,
			present: `symbol","code":1`,
			why:     "the first `}` ends the match, and the tail is left behind",
		},
		{
			name:    "bare single-label hostname with no port",
			in:      "lookup db_internal: no such host",
			present: "db_internal",
			why:     "a bare identifier and a bare hostname are the same shape; the port is what separates them",
		},
		{
			name:    "bare credential value with no label and no known prefix",
			in:      "the credential is hunter2",
			present: "hunter2",
			why:     "a value rule that fires on any short token would eat ordinary prose",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := sanitizeLogValue(tc.in); !strings.Contains(got, tc.present) {
				t.Errorf("this residual is now REDACTED, so the declaration in docs/changes/055 §6 is stale:\n"+
					" in   %q\n got  %q\n want %q still present (%s)\n"+
					"move this row into TestSanitizeLogValue and update the §6 boundary",
					tc.in, got, tc.present, tc.why)
			}
		})
	}
}

// TestErrorChainTextExpandsAndBounds covers both halves of errorChainText: the
// %w chain is rendered with its links named, and the walk stops.
//
// The bound is a denial-of-service guard, not tidiness: Unwrap is implemented
// by the error value, so a self-referential wrapper would spin forever inside a
// request. The deep case below is 40 links against a maxDepth of 32
// (reqlog.go:235).
func TestErrorChainTextExpandsAndBounds(t *testing.T) {
	base := errors.New("disk full")
	wrapped := fmt.Errorf("write audit log: %w", base)

	want := "write audit log: disk full | caused by: disk full"
	if got := errorChainText(wrapped); got != want {
		t.Errorf("errorChainText = %q, want %q", got, want)
	}

	deep := errors.New(base.Error())
	for i := 0; i < 40; i++ {
		deep = fmt.Errorf("layer %d: %w", i, deep)
	}
	got := errorChainText(deep)
	if !strings.HasSuffix(got, "| (chain truncated)") {
		t.Errorf("a 40-link chain was not truncated: %q", got)
	}
	if n := strings.Count(got, "| caused by: "); n != 32 {
		t.Errorf("rendered %d links, want the maxDepth of 32", n)
	}
}

// TestRecordErrorSlotMutationSurvivesAcrossLayers verifies that recordError correctly
// mutates the errSlot pointer in the request context and survives handler stack execution.
func TestRecordErrorSlotMutationSurvivesAcrossLayers(t *testing.T) {
	buf, logger := logSink()

	raw := errors.New("upstream failed: SQLSTATE 23505 duplicate key")
	h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recordError(r, raw)
		writeError(w, r, http.StatusBadGateway, CodeUpstreamUnavailable, raw)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/market/prices", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	line := logLine(t, buf)
	gotErr := strField(t, line, "err")
	if gotErr == "" {
		t.Fatal("expected err to be logged via errSlot, got empty string")
	}
	if strings.Contains(gotErr, "23505") {
		t.Errorf("logged err contains SQLSTATE: %q", gotErr)
	}
	if !strings.Contains(gotErr, markSQL) {
		t.Errorf("logged err missing markSQL: %q", gotErr)
	}
}

