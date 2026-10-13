package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"sort"
	"strings"
	"testing"
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
