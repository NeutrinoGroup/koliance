package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"slices"
)

// ErrorCode defines the 12 closed-set error codes established in ADR-006 §3.6.2.
type ErrorCode string

const (
	CodeInvalidRequest      ErrorCode = "INVALID_REQUEST"
	CodeInvalidProof        ErrorCode = "INVALID_PROOF"
	CodeUnauthorized        ErrorCode = "UNAUTHORIZED"
	CodeQuotaExhausted      ErrorCode = "QUOTA_EXHAUSTED"
	CodeResourceNotFound    ErrorCode = "RESOURCE_NOT_FOUND"
	CodeMethodNotAllowed    ErrorCode = "METHOD_NOT_ALLOWED"
	CodeRateLimited         ErrorCode = "RATE_LIMITED"
	CodeInternalError       ErrorCode = "INTERNAL_ERROR"
	CodeVerifierUnavailable ErrorCode = "VERIFIER_UNAVAILABLE"
	CodeUpstreamUnavailable ErrorCode = "UPSTREAM_UNAVAILABLE"
	CodeDatabaseUnavailable ErrorCode = "DATABASE_UNAVAILABLE"
	CodeServiceNotConfigured ErrorCode = "SERVICE_NOT_CONFIGURED"
)

// AllErrorCodes lists every valid ErrorCode in ADR-006.
var AllErrorCodes = []ErrorCode{
	CodeInvalidRequest,
	CodeInvalidProof,
	CodeUnauthorized,
	CodeQuotaExhausted,
	CodeResourceNotFound,
	CodeMethodNotAllowed,
	CodeRateLimited,
	CodeInternalError,
	CodeVerifierUnavailable,
	CodeUpstreamUnavailable,
	CodeDatabaseUnavailable,
	CodeServiceNotConfigured,
}

// errorCopy maps each ErrorCode to its unique, immutable English business copy.
// Every string is audited against ADR-006 §3.4 and §3.6.2.
var errorCopy = map[ErrorCode]string{
	CodeInvalidRequest:      "invalid request parameters or payload format",
	CodeInvalidProof:        "cryptographic proof verification failed: invalid proof",
	CodeUnauthorized:        "authentication required or credentials invalid",
	CodeQuotaExhausted:      "developer quota or free claim limit exhausted",
	CodeResourceNotFound:    "requested resource or market symbol not found",
	CodeMethodNotAllowed:    "HTTP method is not allowed for this endpoint",
	CodeRateLimited:         "request rate limit exceeded; please retry later",
	CodeInternalError:       "internal service error; please reference requestId for support",
	CodeVerifierUnavailable: "proof verifier is not configured or scheme is not implemented",
	CodeUpstreamUnavailable: "upstream market data provider failed to respond",
	CodeDatabaseUnavailable: "database is unavailable; this endpoint requires a durable store",
	CodeServiceNotConfigured: "service credentials are not configured on this deployment",
}

// errorCopyFor returns the business copy for code, defaulting to CodeInternalError if unregistered.
func errorCopyFor(code ErrorCode) string {
	if msg, ok := errorCopy[code]; ok {
		return msg
	}
	return errorCopy[CodeInternalError]
}

// sanitizeErrorCode validates that code belongs to the AllErrorCodes closed set.
// If code is not in the closed set, it logs a warning with requestId and falls back to CodeInternalError.
func sanitizeErrorCode(r *http.Request, code ErrorCode) ErrorCode {
	if slices.Contains(AllErrorCodes, code) {
		return code
	}
	var ctx context.Context
	reqID := ""
	if r != nil {
		ctx = r.Context()
		reqID = requestIDFrom(ctx)
	}
	if ctx == nil {
		ctx = context.Background()
	}
	slog.WarnContext(ctx, "illegal error code outside closed set; falling back to INTERNAL_ERROR",
		slog.String("illegalCode", string(code)),
		slog.String("requestId", reqID),
	)
	return CodeInternalError
}

// errorEnvelope is the standard closed-set error envelope answered to API callers.
type errorEnvelope struct {
	Code      string `json:"code"`
	Error     string `json:"error"`
	RequestID string `json:"requestId"`
}

// writeError records the raw error on the request context / errSlot, classifies the failure
// into an audited ErrorCode, and writes the closed-set JSON envelope {"code","error","requestId"}.
func writeError(w http.ResponseWriter, r *http.Request, status int, code ErrorCode, rawErr error) {
	recordError(r, rawErr)
	reqID := requestIDFrom(r.Context())
	code = sanitizeErrorCode(r, code)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorEnvelope{
		Code:      string(code),
		Error:     errorCopyFor(code),
		RequestID: reqID,
	})
}

// jsonEnvelopeError writes developer / agent envelope errors (Output class 3) while preserving
// backward-compatible fields ("code", "response", "data") and adding ADR-006 fields ("errorCode", "error", "requestId").
func jsonEnvelopeError(w http.ResponseWriter, r *http.Request, httpStatus int, codeInt int, errCode ErrorCode, rawErr error) {
	recordError(r, rawErr)
	reqID := requestIDFrom(r.Context())
	errCode = sanitizeErrorCode(r, errCode)
	msg := errorCopyFor(errCode)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"code":      codeInt,
		"errorCode": string(errCode),
		"response":  msg,
		"error":     msg,
		"data":      nil,
		"requestId": reqID,
	})
}
