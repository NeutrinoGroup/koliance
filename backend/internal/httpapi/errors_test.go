package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/koliance/backend/internal/agentapi"
	"github.com/koliance/backend/internal/verifier"
)

// TestErrorCopyIsClosedSet asserts ADR-006 §3.6.2 and §4.1 P1:
// 1. Exactly 12 error codes in the closed set.
// 2. errorCopy contains exactly those 12 codes with non-empty, unique copy.
// 3. No copy text contains DSN, URL, credentials, SQL, or other §3.4 prohibited leaks.
// 4. errorCopyFor defaults safely to INTERNAL_ERROR for unknown codes.
func TestErrorCopyIsClosedSet(t *testing.T) {
	const wantCount = 12
	if len(AllErrorCodes) != wantCount {
		t.Fatalf("AllErrorCodes length = %d, want %d", len(AllErrorCodes), wantCount)
	}
	if len(errorCopy) != wantCount {
		t.Fatalf("errorCopy length = %d, want %d", len(errorCopy), wantCount)
	}

	seenCodes := make(map[ErrorCode]bool)
	seenMsgs := make(map[string]ErrorCode)

	sensitiveSubstrings := []string{
		"://", "password", "passwd", "pwd", "token", "secret", "api_key",
		"apikey", "select ", "insert ", "update ", "delete ", "where ",
		"127.0.0.1", "localhost", "10.", "192.168.", "goroutine ", ".go:",
	}

	for _, code := range AllErrorCodes {
		if seenCodes[code] {
			t.Errorf("duplicate ErrorCode in AllErrorCodes: %q", code)
		}
		seenCodes[code] = true

		msg, ok := errorCopy[code]
		if !ok {
			t.Errorf("ErrorCode %q missing from errorCopy map", code)
			continue
		}
		if strings.TrimSpace(msg) == "" {
			t.Errorf("ErrorCode %q has empty business copy", code)
		}

		if existing, exists := seenMsgs[msg]; exists {
			t.Errorf("ErrorCode %q shares duplicate copy with %q: %q", code, existing, msg)
		}
		seenMsgs[msg] = code

		sanitized := sanitizeLogValue(msg)
		if sanitized != msg {
			t.Errorf("ErrorCode %q copy contains text altered by sanitizeLogValue: original %q, sanitized %q", code, msg, sanitized)
		}

		lower := strings.ToLower(msg)
		for _, sens := range sensitiveSubstrings {
			if strings.Contains(lower, sens) {
				t.Errorf("ErrorCode %q copy %q leaks sensitive substring %q", code, msg, sens)
			}
		}
	}

	// Fallback verification for unregistered code
	fallback := errorCopyFor(ErrorCode("NON_EXISTENT_CODE"))
	if fallback != errorCopy[CodeInternalError] {
		t.Errorf("errorCopyFor(NON_EXISTENT_CODE) = %q, want %q", fallback, errorCopy[CodeInternalError])
	}
}

// TestWriteErrorOutputsStandardEnvelope verifies writeError renders the standard closed-set
// envelope {"code", "error", "requestId"} and records the raw error in the request context / errSlot.
func TestWriteErrorOutputsStandardEnvelope(t *testing.T) {
	buf, logger := logSink()

	rawErr := errors.New("upstream failed: connection timeout to remote host")

	handler := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, r, http.StatusBadRequest, CodeInvalidRequest, rawErr)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test/envelope", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}

	contentType := rr.Header().Get("Content-Type")
	if !strings.HasPrefix(contentType, "application/json") {
		t.Errorf("Content-Type = %q, want application/json", contentType)
	}

	var rawObj map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &rawObj); err != nil {
		t.Fatalf("failed to decode JSON response: %v, body: %s", err, rr.Body.String())
	}

	keys := make([]string, 0, len(rawObj))
	for k := range rawObj {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	expectedKeys := []string{"code", "error", "requestId"}
	if !slices.Equal(keys, expectedKeys) {
		t.Fatalf("top-level keys = %v, want exactly %v", keys, expectedKeys)
	}

	codeVal, _ := rawObj["code"].(string)
	errorVal, _ := rawObj["error"].(string)
	reqIDVal, _ := rawObj["requestId"].(string)

	if codeVal != string(CodeInvalidRequest) {
		t.Errorf("code = %q, want %q", codeVal, CodeInvalidRequest)
	}
	if errorVal != errorCopyFor(CodeInvalidRequest) {
		t.Errorf("error = %q, want %q", errorVal, errorCopyFor(CodeInvalidRequest))
	}
	if reqIDVal == "" {
		t.Error("requestId is empty")
	}

	// Verify loggingMiddleware recorded the raw error
	line := logLine(t, buf)
	gotErr := strField(t, line, "err")
	if gotErr == "" {
		t.Fatal("expected err to be logged via errSlot, got empty")
	}
	if !strings.Contains(gotErr, "upstream failed") {
		t.Errorf("logged err does not contain raw error text: %q", gotErr)
	}
}

// TestJsonEnvelopeErrorOutputsCompatibleEnvelope verifies jsonEnvelopeError produces Output Class 3
// envelope with both legacy and ADR-006 fields.
func TestJsonEnvelopeErrorOutputsCompatibleEnvelope(t *testing.T) {
	buf, logger := logSink()

	rawErr := errors.New("proof verifier backend is down")

	handler := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jsonEnvelopeError(w, r, http.StatusBadRequest, -1, CodeInvalidProof, rawErr)
	}))

	req := httptest.NewRequest(http.MethodPost, "/test/agent", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}

	var rawObj map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &rawObj); err != nil {
		t.Fatalf("failed to decode JSON response: %v, body: %s", err, rr.Body.String())
	}

	keys := make([]string, 0, len(rawObj))
	for k := range rawObj {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	expectedKeys := []string{"code", "data", "error", "errorCode", "requestId", "response"}
	if !slices.Equal(keys, expectedKeys) {
		t.Fatalf("top-level keys = %v, want exactly %v", keys, expectedKeys)
	}

	if rawObj["errorCode"] != string(CodeInvalidProof) {
		t.Errorf("errorCode = %v, want %s", rawObj["errorCode"], CodeInvalidProof)
	}
	if rawObj["error"] != errorCopyFor(CodeInvalidProof) {
		t.Errorf("error = %v, want %s", rawObj["error"], errorCopyFor(CodeInvalidProof))
	}

	line := logLine(t, buf)
	if strField(t, line, "err") == "" {
		t.Error("raw error was not recorded in logLine")
	}
}

// TestEveryErrorCodeIsReachable asserts ADR-006 §4.1 P3 & §4.2 N4 (full reachability of closed set):
// 1. Every one of the 12 ErrorCodes is covered by at least one HTTP route/handler case.
// 2. Each case triggers an HTTP response with the audited HTTP status code.
// 3. The response body is valid JSON with Content-Type application/json.
// 4. The response body contains the matching code / errorCode, immutable business copy, and non-empty requestId.
// 5. The raw error is recorded by loggingMiddleware.
// 6. Direct writeError contract verification ensures all 12 ErrorCodes emit the exact standard 3-key envelope.
func TestEveryErrorCodeIsReachable(t *testing.T) {
	cases := []struct {
		name       string
		code       ErrorCode
		wantStatus int
		exec       func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder
	}{
		{
			name:       "INVALID_REQUEST (400 via liquidations route with bad param)",
			code:       CodeInvalidRequest,
			wantStatus: http.StatusBadRequest,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				h := newTestRouter(t, func(d *Deps) { d.Logger = logger })
				return do(h, http.MethodGet, "/api/v1/liquidations?limit=-1", "", nil)
			},
		},
		{
			name:       "INVALID_PROOF (400 via verifier route with invalid proof)",
			code:       CodeInvalidProof,
			wantStatus: http.StatusBadRequest,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				reject := &stubVerifier{
					scheme: verifier.SchemeZK,
					fn: func(context.Context, verifier.Request) error {
						return verifier.ErrInvalidProof
					},
				}
				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
					d.Verifier = reject
				})
				return do(h, http.MethodPost, "/api/v1/verifier/verify",
					`{"scheme":"ZK","subject":"agent-1","proof":"0xdeadbeef"}`, nil)
			},
		},
		{
			name:       "UNAUTHORIZED (401 via agentcard route with no bearer token)",
			code:       CodeUnauthorized,
			wantStatus: http.StatusUnauthorized,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				h := newTestRouter(t, func(d *Deps) { d.Logger = logger })
				return do(h, http.MethodGet, "/api/v1/agentcard/cards/card-test", "", nil)
			},
		},
		{
			name:       "QUOTA_EXHAUSTED (403 via agent bind route with zero-quota key)",
			code:       CodeQuotaExhausted,
			wantStatus: http.StatusForbidden,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				agentSvc := agentapi.NewService(nil)
				key, err := agentSvc.GenerateAPIKey("0x1111111111111111111111111111111111111111", "STARTER_FREE", "quota-test")
				if err != nil {
					t.Fatalf("GenerateAPIKey: %v", err)
				}
				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
					d.AgentAPI = agentSvc
				})
				return do(h, http.MethodPost, "/api/v1/agent/bind",
					`{"walletAddress":"0x1111111111111111111111111111111111111111","agentId":"agent-1","name":"Agent One"}`,
					map[string]string{"Authorization": "Bearer " + key.RawKey})
			},
		},
		{
			name:       "RESOURCE_NOT_FOUND (404 via market prices route with invalid symbol)",
			code:       CodeResourceNotFound,
			wantStatus: http.StatusNotFound,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte(`{"bars":{}}`))
				}))
				t.Cleanup(srv.Close)

				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
					d.Cfg.AlpacaDataURL = srv.URL
				})
				return do(h, http.MethodGet, "/api/v1/market/prices?symbol=INVALID_SYMBOL_XYZ", "", nil)
			},
		},
		{
			name:       "METHOD_NOT_ALLOWED (405 via liquidations route with DELETE method)",
			code:       CodeMethodNotAllowed,
			wantStatus: http.StatusMethodNotAllowed,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				h := newTestRouter(t, func(d *Deps) { d.Logger = logger })
				return do(h, http.MethodDelete, "/api/v1/liquidations", "", nil)
			},
		},
		{
			name:       "RATE_LIMITED (429 via agent bind route with exhausted rate limit)",
			code:       CodeRateLimited,
			wantStatus: http.StatusTooManyRequests,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				agentSvc := agentapi.NewService(nil)
				key, err := agentSvc.GenerateAPIKey("0x1111111111111111111111111111111111111111", "STARTER_FREE", "ratelimit-test")
				if err != nil {
					t.Fatalf("GenerateAPIKey: %v", err)
				}
				for i := 0; i < 100; i++ {
					if _, err := agentSvc.ValidateAndDeductKey(key.RawKey, 1); errors.Is(err, agentapi.ErrRateLimited) {
						break
					}
				}
				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
					d.AgentAPI = agentSvc
				})
				return do(h, http.MethodPost, "/api/v1/agent/bind",
					`{"walletAddress":"0x1111111111111111111111111111111111111111","agentId":"agent-1","name":"Agent One"}`,
					map[string]string{"Authorization": "Bearer " + key.RawKey})
			},
		},
		{
			name:       "INTERNAL_ERROR (500 via market overview route when upstream account fails)",
			code:       CodeInternalError,
			wantStatus: http.StatusInternalServerError,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
				})
				return do(h, http.MethodGet, "/api/v1/market/overview", "", nil)
			},
		},
		{
			name:       "VERIFIER_UNAVAILABLE (503 via verifier route with nil verifier)",
			code:       CodeVerifierUnavailable,
			wantStatus: http.StatusServiceUnavailable,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
					d.Verifier = nil
				})
				return do(h, http.MethodPost, "/api/v1/verifier/verify",
					`{"scheme":"ZK","subject":"agent-1","proof":"0xdeadbeef"}`, nil)
			},
		},
		{
			name:       "UPSTREAM_UNAVAILABLE (502 via market movers route when upstream fails)",
			code:       CodeUpstreamUnavailable,
			wantStatus: http.StatusBadGateway,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
				})
				return do(h, http.MethodGet, "/api/v1/market/movers", "", nil)
			},
		},
		{
			name:       "DATABASE_UNAVAILABLE (503 via game proof route with nil database)",
			code:       CodeDatabaseUnavailable,
			wantStatus: http.StatusServiceUnavailable,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
					d.DB = nil
				})
				return do(h, http.MethodPost, "/api/v1/game/proof", `{}`, nil)
			},
		},
		{
			name:       "SERVICE_NOT_CONFIGURED (503 via market prices route without credentials)",
			code:       CodeServiceNotConfigured,
			wantStatus: http.StatusServiceUnavailable,
			exec: func(t *testing.T, logger *slog.Logger) *httptest.ResponseRecorder {
				h := newTestRouter(t, func(d *Deps) {
					d.Logger = logger
					d.Cfg.AlpacaAPIKey = "present-key"
					d.Cfg.AlpacaAPISecret = "" // missing secret triggers unconfigured gate without tripping both-empty default in router_test.go
				})
				return do(h, http.MethodGet, "/api/v1/market/prices", "", nil)
			},
		},
	}

	seenCodes := make(map[ErrorCode]bool)
	for _, tc := range cases {
		tc := tc
		seenCodes[tc.code] = true
		t.Run(tc.name, func(t *testing.T) {
			buf, logger := logSink()
			rr := tc.exec(t, logger)

			if rr.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tc.wantStatus)
			}

			ct := rr.Header().Get("Content-Type")
			if !strings.HasPrefix(ct, "application/json") {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}

			var rawObj map[string]interface{}
			if err := json.Unmarshal(rr.Body.Bytes(), &rawObj); err != nil {
				t.Fatalf("failed to decode JSON response: %v, body: %s", err, rr.Body.String())
			}

			codeVal, _ := rawObj["code"].(string)
			if codeVal == "" {
				codeVal, _ = rawObj["errorCode"].(string)
			}
			if codeVal != string(tc.code) {
				t.Errorf("response code = %q, want %q", codeVal, tc.code)
			}

			errVal, _ := rawObj["error"].(string)
			wantCopy := errorCopyFor(tc.code)
			if errVal != wantCopy {
				t.Errorf("response error = %q, want %q", errVal, wantCopy)
			}

			reqIDVal, _ := rawObj["requestId"].(string)
			if strings.TrimSpace(reqIDVal) == "" {
				t.Errorf("response requestId is empty: body = %s", rr.Body.String())
			}

			line := logLine(t, buf)
			if strField(t, line, "err") == "" {
				t.Errorf("raw error was not recorded in log line for %s", tc.code)
			}
		})
	}

	if len(seenCodes) != len(AllErrorCodes) {
		t.Fatalf("covered %d ErrorCodes, want exactly %d", len(seenCodes), len(AllErrorCodes))
	}
	for _, code := range AllErrorCodes {
		if !seenCodes[code] {
			t.Errorf("ErrorCode %q was not covered by any reachability case", code)
		}
	}

	// Direct writeError envelope contract test across all 12 ErrorCodes
	for _, code := range AllErrorCodes {
		t.Run("writeError/"+string(code), func(t *testing.T) {
			buf, logger := logSink()
			rawErr := fmt.Errorf("underlying failure details: code test")
			h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				writeError(w, r, http.StatusBadRequest, code, rawErr)
			}))
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/test/"+strings.ToLower(string(code)), nil)
			h.ServeHTTP(rec, req)

			var obj map[string]interface{}
			if err := json.Unmarshal(rec.Body.Bytes(), &obj); err != nil {
				t.Fatalf("failed to decode JSON: %v", err)
			}
			keys := make([]string, 0, len(obj))
			for k := range obj {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			wantKeys := []string{"code", "error", "requestId"}
			if !slices.Equal(keys, wantKeys) {
				t.Errorf("envelope keys = %v, want %v", keys, wantKeys)
			}
			if obj["code"] != string(code) {
				t.Errorf("code = %v, want %s", obj["code"], code)
			}
			if obj["error"] != errorCopyFor(code) {
				t.Errorf("error = %v, want %s", obj["error"], errorCopyFor(code))
			}
			if str, _ := obj["requestId"].(string); str == "" {
				t.Error("requestId is empty")
			}
			line := logLine(t, buf)
			if !strings.Contains(strField(t, line, "err"), "underlying failure details") {
				t.Errorf("logged err does not contain raw error: %q", strField(t, line, "err"))
			}
		})
	}
}

// TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode verifies that any ErrorCode
// outside the AllErrorCodes closed set is safely forced to CodeInternalError and logged with a warning,
// and any non-5xx HTTP status code is synchronously corrected to http.StatusInternalServerError.
func TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode(t *testing.T) {
	t.Run("writeError fallback corrects 400 to 500", func(t *testing.T) {
		buf, logger := logSink()
		h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeError(w, r, http.StatusBadRequest, ErrorCode("UNKNOWN_ILLEGAL_CODE"), errors.New("raw failure"))
		}))
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/test/fallback", nil)
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
		}

		var obj map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &obj); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if obj["code"] != string(CodeInternalError) {
			t.Errorf("code = %v, want %s", obj["code"], CodeInternalError)
		}
		if obj["error"] != errorCopyFor(CodeInternalError) {
			t.Errorf("error = %v, want %s", obj["error"], errorCopyFor(CodeInternalError))
		}
		_ = logLine(t, buf)
	})

	t.Run("writeError fallback corrects 404 to 500", func(t *testing.T) {
		buf, logger := logSink()
		h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeError(w, r, http.StatusNotFound, ErrorCode("UNKNOWN_ILLEGAL_404"), errors.New("not found failure"))
		}))
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/test/fallback_404", nil)
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
		}

		var obj map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &obj); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if obj["code"] != string(CodeInternalError) {
			t.Errorf("code = %v, want %s", obj["code"], CodeInternalError)
		}
		_ = logLine(t, buf)
	})

	t.Run("writeError fallback preserves 5xx status", func(t *testing.T) {
		buf, logger := logSink()
		h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeError(w, r, http.StatusServiceUnavailable, ErrorCode("UNKNOWN_ILLEGAL_503"), errors.New("upstream service error"))
		}))
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/test/fallback_503", nil)
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusServiceUnavailable {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
		}

		var obj map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &obj); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if obj["code"] != string(CodeInternalError) {
			t.Errorf("code = %v, want %s", obj["code"], CodeInternalError)
		}
		_ = logLine(t, buf)
	})

	t.Run("jsonEnvelopeError fallback corrects 400 to 500", func(t *testing.T) {
		buf, logger := logSink()
		h := loggingMiddleware(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			jsonEnvelopeError(w, r, http.StatusBadRequest, 400, ErrorCode("UNKNOWN_ILLEGAL_CODE_2"), errors.New("raw failure"))
		}))
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/test/fallback", nil)
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
		}

		var obj map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &obj); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if obj["errorCode"] != string(CodeInternalError) {
			t.Errorf("errorCode = %v, want %s", obj["errorCode"], CodeInternalError)
		}
		if obj["error"] != errorCopyFor(CodeInternalError) {
			t.Errorf("error = %v, want %s", obj["error"], errorCopyFor(CodeInternalError))
		}
		if obj["response"] != errorCopyFor(CodeInternalError) {
			t.Errorf("response = %v, want %s", obj["response"], errorCopyFor(CodeInternalError))
		}
		_ = logLine(t, buf)
	})
}

