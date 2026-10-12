// Package httpapi wires the HTTP routes of the Go gateway. It lives outside
// cmd/api so the routing, CORS and auth rules can be exercised with httptest.
package httpapi

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

const maxBodyBytes = 1 << 20 // 1 MiB

// corsAllowHeaders is the request-header allow-list answered to a preflight.
//
// It is a named constant, and X-Request-Id is on it, because of the middleware
// in reqlog.go: that middleware reads `X-Request-Id` off the request and echoes
// it back, and a browser will not put a header on a cross-origin request unless
// the preflight names it. Before this list carried it, a cross-origin caller
// could not have sent the id at all — so the response header the middleware
// sets was, for the only caller that has an Origin, unreachable in both
// directions.
const corsAllowHeaders = "Content-Type, Authorization, X-Requested-With, " + requestIDHeader

// corsExposeHeaders names the response headers a cross-origin caller is allowed
// to READ. Without it the browser hands the script a response whose
// X-Request-Id is present on the wire and invisible in JS — the two halves are
// separate rules and satisfying one does not satisfy the other.
const corsExposeHeaders = requestIDHeader

// cors only reflects origins on the configured allow-list. It replaces the
// previous `Access-Control-Allow-Origin: *`. Requests without an Origin header
// (curl, server-to-server) are not affected by CORS at all; CORS is a browser
// read-protection, which is why the write endpoints below also authenticate.
func cors(allowed []string, next http.HandlerFunc) http.HandlerFunc {
	set := make(map[string]struct{}, len(allowed))
	for _, o := range allowed {
		set[o] = struct{}{}
	}
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		origin := r.Header.Get("Origin")
		_, ok := set[strings.TrimRight(origin, "/")]
		if origin != "" && ok {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", corsAllowHeaders)
			w.Header().Set("Access-Control-Expose-Headers", corsExposeHeaders)
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			if origin != "" && !ok {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// bearer extracts the token from `Authorization: Bearer <token>`.
func bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if len(h) > 7 && strings.EqualFold(h[:7], "Bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

// isOperator compares in constant time. An empty configured token never
// matches anything (fail closed).
func isOperator(configured string, r *http.Request) bool {
	if configured == "" {
		return false
	}
	got := bearer(r)
	if got == "" {
		return false
	}
	a := sha256.Sum256([]byte(configured))
	b := sha256.Sum256([]byte(got))
	return subtle.ConstantTimeCompare(a[:], b[:]) == 1
}

// requireOperator gates operator-only endpoints. 503 when no token is
// configured (the endpoint is disabled, not open), 401 on a missing/wrong one.
func requireOperator(configured string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if configured == "" {
			jsonError(w, http.StatusServiceUnavailable, "operator endpoint disabled: KOLIANCE_API_TOKEN is not configured")
			return
		}
		if !isOperator(configured, r) {
			w.Header().Set("WWW-Authenticate", `Bearer realm="koliance"`)
			jsonError(w, http.StatusUnauthorized, "operator token required")
			return
		}
		next(w, r)
	}
}

func methodOnly(method string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			w.Header().Set("Allow", method)
			jsonError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		next(w, r)
	}
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, status int, msg string) {
	jsonResponse(w, status, map[string]string{"error": msg})
}

// decodeJSON reads a bounded body and refuses malformed JSON. An empty body is
// treated as `{}` so endpoints with all-optional fields keep working.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil && !errors.Is(err, io.EOF) {
		jsonError(w, http.StatusBadRequest, "invalid payload")
		return false
	}
	return true
}
