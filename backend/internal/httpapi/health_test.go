package httpapi

import (
	"context"
	"fmt"
	"strings"
	"testing"
)

// TestRunProbePanicRedacted verifies SEC-P0-1: panic message is sanitized to a fixed string
// without exposing internal recover values or stack traces.
func TestRunProbePanicRedacted(t *testing.T) {
	res := runProbe(context.Background(), func(ctx context.Context) (string, error) {
		panic("internal secret panic: sensitive_db_password_123")
	})

	if res.OK {
		t.Fatal("expected probe to fail on panic")
	}
	if res.Error != "probe panicked" {
		t.Errorf("expected res.Error to be exactly 'probe panicked', got %q", res.Error)
	}
	if strings.Contains(res.Error, "sensitive_db_password_123") {
		t.Errorf("panic message leaked internal secret: %q", res.Error)
	}
}

// TestRunProbeURLQueryAndSecretStripped verifies SEC-P0-1: URL query parameters (like Steam API key)
// and §3.4 sensitive items are stripped/redacted from probe errors.
func TestRunProbeURLQueryAndSecretStripped(t *testing.T) {
	secretKey := "STEAM_SECRET_KEY_998877"
	targetURL := "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" + secretKey + "&steamids=76561197960435530"

	res := runProbe(context.Background(), func(ctx context.Context) (string, error) {
		return "", fmt.Errorf("Get %q: dial tcp 10.0.3.7:443: connection refused via postgres://user:pwd@db.internal:5432/koliance", targetURL)
	})

	if res.OK {
		t.Fatal("expected probe to fail")
	}
	if strings.Contains(res.Error, secretKey) {
		t.Errorf("probe error still leaks URL query parameter key: %s", res.Error)
	}
	if strings.Contains(res.Error, "?key=") {
		t.Errorf("probe error still contains query string: %s", res.Error)
	}
	if strings.Contains(res.Error, "pwd") {
		t.Errorf("probe error still leaks password: %s", res.Error)
	}
	if strings.Contains(res.Error, "10.0.3.7") {
		t.Errorf("probe error still leaks internal IP: %s", res.Error)
	}
	if !strings.Contains(res.Error, markDSN) {
		t.Errorf("expected markDSN in sanitized probe error, got: %s", res.Error)
	}
}
