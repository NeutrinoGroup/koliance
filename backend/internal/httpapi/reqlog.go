// Request logging middleware — ADR-006 §3.2 (裁定 2).
//
// It does exactly three things:
//
//  1. request-id: reuse `X-Request-Id` when the caller sent a well-formed one,
//     otherwise generate one; echo it back on the response.
//  2. write one structured JSON line per request via log/slog:
//     {requestId, method, path, status, durationMs, err}
//  3. sanitize the raw error text (ADR-006 §3.4) before it reaches that line.
//
// What it deliberately does NOT do (ADR-006 §3.2, "中间件明确不负责"):
//
//   - It never reads or rewrites the response body. There is no Write call in
//     this file. That is a property, not a promise: it is what makes the
//     byte-for-byte judgement (P4) decidable, and N5 (inject a Write and P4
//     must go red) is the proof that the judgement still has teeth.
//   - It never changes the status code. statusWriter only observes the code the
//     handler already wrote.
//   - It never classifies the error. Classification belongs to the handler and
//     the error types (ADR-006 §3.5); this middleware only records.
//
// The reason for the hard "does not alter the body" boundary is in ADR-006
// §3.2: a middleware that rewrites the body must buffer it, which breaks
// streaming, 204 and every multi-path writer at once — and "the middleware
// corrupted the body" is silent, it just changes what one endpoint returns. A
// write-only middleware can be pinned by a byte-for-byte judgement; a
// rewriting one cannot.

package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// requestIDHeader is both the inbound and the outbound header name. One
// constant so the two cannot drift.
const requestIDHeader = "X-Request-Id"

// requestIDBytes is the entropy per generated id: 16 bytes = 32 hex characters.
//
// Hex, not a decimal counter. The reason recorded here for that choice was
// wrong, and the correction is part of the record rather than a rewrite of it.
// The claim used to be: market_test.go:166 defines `priceShapedInText` as
// `\d+\.\d{2,}|\d{3,}`, so an id with no `\d{3,}` run would not trip the
// refusal-shape judgement when ADR-006 §3.6 puts `requestId` in the response
// envelope — "16 bytes of hex is opaque and carries no digit run".
//
// The second half is false. Measured over 100000 ids, 99.2030% contain a
// `\d{3,}` run; three consecutive hex digits are simply common. So §3.6 will
// turn market_test.go:182-184 red, and it will do so because the envelope gains
// a KEY, not because of the id's digits — a hex string is not a JSON number, and
// priceShapedInText is only applied to the `error` value's prose
// (market_test.go:188), never to the id. Correcting the attribution matters
// because it changes the fix: the allowed-key set is what must move, and no id
// format can avoid the key.
//
// The encoding stays hex anyway, for the reason that was always true: it is
// opaque, unique and unguessable, which is what an id needs to be. What changed
// is that the comment no longer claims a property it does not have.
// TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement pins the 99.2% as a
// band, so the day this text and the measurement disagree, a test says so.
const requestIDBytes = 16

// maxRequestIDLen bounds an accepted inbound id. Beyond the length, an
// unbounded caller-supplied string ends up in every log line.
const maxRequestIDLen = 128

type ctxKeyRequestID struct{}

// newRequestID returns a fresh opaque request id. It is the only place an id is
// minted, so the shape cannot vary between call sites.
//
// crypto/rand.Read never returns an error as of Go 1.24 (it panics on failure
// instead), but the signature still returns one; rather than ignore it and
// emit a silently empty id, a failure degrades to a fixed, obviously-not-an-id
// marker that still keeps the field non-empty.
func newRequestID() string {
	b := make([]byte, requestIDBytes)
	if _, err := rand.Read(b); err != nil {
		return "unavailable"
	}
	return hex.EncodeToString(b)
}

// validRequestID reports whether a caller-supplied id may be echoed back and
// logged. Only an opaque token is accepted.
//
// This is not decoration. The id is caller-controlled and lands in two sinks:
// a response header and a log line. A value carrying CR/LF is a header-splitting
// attempt, and while net/http drops such headers on write and slog escapes
// control characters inside JSON strings, accepting the value at all means
// depending on two other packages to notice. Anything outside the token
// alphabet is simply not an id we sent anyone, so it is replaced rather than
// trusted.
func validRequestID(s string) bool {
	if s == "" || len(s) > maxRequestIDLen {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9':
		case c == '-', c == '_', c == '.':
		default:
			return false
		}
	}
	return true
}

// requestIDFrom returns the id attached to this request's context, or "" when
// the middleware is not installed.
func requestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(ctxKeyRequestID{}).(string)
	return id
}

// statusWriter records the status code the handler wrote without changing it.
//
// It writes no header of its own and no body. The Unwrap method is what keeps
// the wrapper transparent for everything else: `http.NewResponseController`
// (net/http/responsecontroller.go:42-53) walks `Unwrap() ResponseWriter` to
// find Flush/Hijack/SetWriteDeadline on the underlying writer, so wrapping does
// not disable streaming, WebSocket upgrades or deadline control. Without
// Unwrap those would fail with http.ErrNotSupported — a silent behaviour change
// for exactly the endpoints that cannot tolerate one.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	// Only the first call counts, which is net/http's own rule (a second
	// WriteHeader on the real writer logs "superfluous" and is ignored). Not
	// copying that rule here would make the log disagree with the wire.
	if w.status == 0 {
		w.status = status
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// observeStatus returns the code the handler wrote. A handler that never calls
// WriteHeader is answered by net/http with 200, so the log says 200 too.
func (w *statusWriter) observeStatus() int {
	if w.status == 0 {
		return http.StatusOK
	}
	return w.status
}

// loggingMiddleware is the request logger. `logger` is injected rather than
// read from slog.Default() at call time so a test can capture the line without
// touching global state (cmd/api owns the production logger).
func loggingMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		id := strings.TrimSpace(r.Header.Get(requestIDHeader))
		if !validRequestID(id) {
			id = newRequestID()
		}
		// Set before the handler runs, not after. A header set after
		// next.ServeHTTP has already written is dropped ("superfluous
		// WriteHeader"), so a late Set would produce a header that is present
		// in the recorder and absent on the wire — the worst of both.
		w.Header().Set(requestIDHeader, id)

		r = r.WithContext(context.WithValue(r.Context(), ctxKeyRequestID{}, id))

		sw := &statusWriter{ResponseWriter: w}
		next.ServeHTTP(sw, r)

		recordRequest(logger, r, id, sw.observeStatus(), time.Since(start))
	})
}

// recordRequest writes the one line. Every field the ADR names is always
// present: a consumer parsing these lines must not have to branch on a key
// that appears only sometimes.
func recordRequest(logger *slog.Logger, r *http.Request, id string, status int, duration time.Duration) {
	if logger == nil {
		// NewRouter substitutes a default, so this is unreachable through the
		// router; it stays because a nil logger would otherwise panic inside
		// the request path, which is a worse failure than a missing line.
		return
	}

	errText := ""
	if err := requestError(r.Context()); err != nil {
		errText = sanitizeLogErr(err)
	}

	logger.LogAttrs(r.Context(), slog.LevelInfo, "http request",
		slog.String("requestId", id),
		slog.String("method", r.Method),
		// Path, never RequestURI: the query string is where a token ends up
		// (?token=…), and this line is written for every request.
		slog.String("path", sanitizeLogValue(r.URL.Path)),
		slog.Int("status", status),
		slog.Int64("durationMs", duration.Milliseconds()),
		slog.String("err", errText),
	)
}

// requestError returns the error the handler recorded for this request, or nil.
//
// This is the seam between the middleware and the handlers that will follow it.
// The handlers in this round still answer with jsonError(w, status, err.Error())
// and record nothing, so this returns nil and `err` is empty — which is the
// honest reading of "no raw error was recorded for this request", not a
// stand-in for "nothing went wrong".
func requestError(ctx context.Context) error {
	err, _ := ctx.Value(errContextKey{}).(error)
	return err
}

// errContextKey keys the handler-recorded error in the request context.
//
// It exists now, with no writer in this package yet, because it is the only
// way the middleware can see a raw error at all without reading the response
// body — and reading the body is exactly what §3.2 forbids. When the handler
// migration round lands, the writer is one line at the jsonError call site;
// until then the seam is exercised by this package's own tests.
type errContextKey struct{}

// errorChainText renders the raw error and its unwrap chain.
//
// err.Error() already flattens a `%w` chain into one string, so the appended
// links are structural redundancy — deliberately, because ADR-006 §3.2 asks
// for the chain expanded with errors.Unwrap, and a reader grepping for the
// innermost cause should find it as its own segment rather than as a suffix of
// punctuation.
//
// The walk is bounded. Unwrap is implemented by the error value, and a
// self-referential wrapper would spin forever; an unbounded walk over an
// arbitrary error is a denial of service wearing a logging hat.
func errorChainText(err error) string {
	const maxDepth = 32

	var b strings.Builder
	b.WriteString(err.Error())

	depth := 0
	for e := errors.Unwrap(err); e != nil && depth < maxDepth; e = errors.Unwrap(e) {
		depth++
		b.WriteString(" | caused by: ")
		b.WriteString(e.Error())
	}
	if depth == maxDepth {
		b.WriteString(" | (chain truncated)")
	}
	return b.String()
}

// sanitizeLogErr renders and redacts an error for the log line.
func sanitizeLogErr(err error) string {
	return sanitizeLogValue(errorChainText(err))
}

// The ADR-006 §3.4 classes, as shapes. Each pattern is matched against the
// rendered text and the match is replaced by a labelled marker, so a reader can
// still tell WHAT was removed without seeing it.
//
// This is a shape filter, not a denylist of known strings, and it is honest
// about being incomplete: file paths and hostnames are open-ended, so some
// residual is expected. That residual is registered under GAP-74 rather than
// covered up with a heuristic — the same call the DSN sanitizer made in
// internal/platform/database/db.go:141, whose anchors leave the same kind of
// residue (GAP-61). This function runs BEFORE that one in the log path; it does
// not replace it.
//
// Every marker uses angle brackets, never square ones: the third-party-body
// rule matches `[...]` and `{...}`, so a marker in those shapes would be
// rewritten by a later pass and the label would stop naming the class it
// removed.
var (
	// §3.4 #1 — Go stack frame signatures.
	reGoStack = regexp.MustCompile(`(?m)goroutine\s+\d+\s*\[[^\]]*\]|[\w./\\-]+\.go:\d+|^\s+[\w./\\-]+\([^)]*\)$`)

	// §3.4 #2 — SQL text, constraint names, driver names.
	reSQL = regexp.MustCompile(`(?i)\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b|\bSELECT\b[\w*,\s()]*\bFROM\b|\bpgx\b|\blibpq\b|\bSQLSTATE\s*[0-9A-Z]{5}\b|\bconstraint\s+"[^"]*"`)

	// §3.4 #3 — DSNs and connection strings. The whole URI is consumed, host
	// and path included, so the credential cannot survive as a tail that no
	// other rule was written to catch.
	reDSN = regexp.MustCompile(`(?i)\b[a-z][a-z0-9+.-]*://\S*|\bpassword\s*=\s*\S+`)

	// §3.4 #4/#5 — environment variable names, and `NAME=value` pairs where
	// the value must never be written out. The name pattern requires at least
	// one underscore so that ordinary CamelCase identifiers in error text
	// (ErrDatabaseUnavailable) are not mistaken for env names.
	reEnvAssign = regexp.MustCompile(`\b[A-Z][A-Z0-9_]{2,}\s*=\s*\S+`)
	reEnvName   = regexp.MustCompile(`\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b`)

	// §3.4 #6 — third-party response bodies embedded in an error. Clients
	// truncate them to 256/512 chars (market/alpaca_client.go:192,
	// market/price_oracle.go:209); truncation bounds the size, not the
	// sensitivity. JSON is the shape those bodies arrive in.
	reThirdPartyBody = regexp.MustCompile(`\{[^{}]*\}|\[[^\[\]]*\]`)

	// §3.4 #7 — file paths, hostnames, internal addresses.
	//
	// The path pattern requires either an explicit file:// / drive form or a
	// leading space, which is how a path appears inside prose
	// (fmt.Errorf("open %s: ...")). It deliberately does NOT match a bare
	// "/a/b/c": r.URL.Path is the single most useful field in this log line,
	// and a pattern loose enough to swallow it would redact the diagnostic
	// value along with the leak.
	//
	// The host pattern requires either a dotted quad or at least three labels,
	// which keeps `db.go` and `errors.Unwrap` out of it — a single-dot rule
	// would redact every file name and package qualifier in the message.
	reFilePath = regexp.MustCompile(`(?i)\bfile://\S+|\b[A-Za-z]:\\[^\s]*|\s/[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)+`)
	reHost     = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.){2,}[a-z]{2,}(?::\d+)?\b`)
)

// The markers. Each names the class it removed.
const (
	markStack    = "<REDACTED:stack>"
	markSQL      = "<REDACTED:sql>"
	markDSN      = "<REDACTED:dsn>"
	markEnv      = "<REDACTED:env>"
	markEnvName  = "<REDACTED:env-name>"
	markUpstream = "<REDACTED:upstream-body>"
	markPath     = "<REDACTED:path>"
	markHost     = "<REDACTED:host>"
)

// sanitizeLogValue redacts every §3.4 class from a string bound for the log.
//
// Order matters and is not arbitrary: the credential-bearing URI form is
// removed before the generic `NAME=value` rule, so a password cannot survive
// as the tail of a rule that only meant to drop an env assignment.
func sanitizeLogValue(s string) string {
	if s == "" {
		return s
	}
	for _, r := range []struct {
		re *regexp.Regexp
		to string
	}{
		{reGoStack, markStack},
		{reDSN, markDSN},
		{reSQL, markSQL},
		{reEnvAssign, markEnv},
		{reEnvName, markEnvName},
		{reThirdPartyBody, markUpstream},
		{reFilePath, markPath},
		{reHost, markHost},
	} {
		s = r.re.ReplaceAllString(s, r.to)
	}
	return s
}
