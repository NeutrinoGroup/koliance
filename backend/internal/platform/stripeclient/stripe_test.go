package stripeclient

import (
	"testing"
)

func TestMockDepositCheckoutSession(t *testing.T) {
	// Client without secret key operates in mock mode
	cli := New("")

	session, err := cli.CreateDepositCheckoutSession(
		"https://app.koliance.io/success",
		"https://app.koliance.io/cancel",
		1000,
		"cny",
		"10 RMB Deposit",
		"0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2",
		[]string{"card", "alipay", "wechat_pay"},
	)
	if err != nil {
		t.Fatalf("unexpected error in mock deposit session: %v", err)
	}
	if session == nil || session.URL == "" {
		t.Fatalf("expected non-empty session URL, got %+v", session)
	}

	// Setup intent mock
	intent, err := cli.CreateSetupIntent("cus_test123")
	if err != nil {
		t.Fatalf("unexpected error in mock setup intent: %v", err)
	}
	if intent.ClientSecret == "" {
		t.Fatalf("expected non-empty client secret, got %+v", intent)
	}
}
