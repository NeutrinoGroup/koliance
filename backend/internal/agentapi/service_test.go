package agentapi

import (
	"testing"
)

func TestAPIKeyGenerationAndValidation(t *testing.T) {
	svc := NewService(nil)
	wallet := "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2"

	created, err := svc.GenerateAPIKey(wallet, "STARTER_FREE")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if created.RawKey == "" || created.KeyID == "" {
		t.Fatalf("expected non-empty key and ID, got: %+v", created)
	}
	if created.FreeClaimsLeft != 3 {
		t.Fatalf("expected 3 free claims initially, got: %d", created.FreeClaimsLeft)
	}

	// Should reject unauthorized without quota
	_, err = svc.ValidateAndDeductKey(created.RawKey, 1)
	if err != ErrQuotaExhausted {
		t.Fatalf("expected ErrQuotaExhausted, got: %v", err)
	}
}

func TestFreeStarterClaimsAndRecharge(t *testing.T) {
	svc := NewService(nil)
	wallet := "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2"

	created, err := svc.GenerateAPIKey(wallet, "STARTER_FREE")
	if err != nil {
		t.Fatalf("generate key err: %v", err)
	}

	// Claim 1
	resp1, err := svc.ClaimOrPurchasePackage(wallet, PackageClaimRequest{
		TierID:        "STARTER_FREE_100",
		PaymentMethod: "free_claim",
	})
	if err != nil {
		t.Fatalf("claim 1 err: %v", err)
	}
	if resp1.AddedQuota != 100 || resp1.RemainingQuota != 100 || resp1.FreeClaimsLeft != 2 {
		t.Fatalf("unexpected claim 1 resp: %+v", resp1)
	}

	// Deduct 1 call
	cred, err := svc.ValidateAndDeductKey(created.RawKey, 1)
	if err != nil {
		t.Fatalf("deduct key err: %v", err)
	}
	if cred.RemainingQuota != 99 {
		t.Fatalf("expected 99 remaining, got: %d", cred.RemainingQuota)
	}

	// Claim 2
	resp2, err := svc.ClaimOrPurchasePackage(wallet, PackageClaimRequest{TierID: "STARTER_FREE_100"})
	if err != nil || resp2.FreeClaimsLeft != 1 {
		t.Fatalf("claim 2 failed: %v", err)
	}

	// Claim 3
	resp3, err := svc.ClaimOrPurchasePackage(wallet, PackageClaimRequest{TierID: "STARTER_FREE_100"})
	if err != nil || resp3.FreeClaimsLeft != 0 {
		t.Fatalf("claim 3 failed: %v", err)
	}

	// Claim 4 should fail (only 3 allowed)
	_, err = svc.ClaimOrPurchasePackage(wallet, PackageClaimRequest{TierID: "STARTER_FREE_100"})
	if err != ErrFreeClaimsExhausted {
		t.Fatalf("expected ErrFreeClaimsExhausted, got: %v", err)
	}

	// Growth tier recharge
	growthResp, err := svc.ClaimOrPurchasePackage(wallet, PackageClaimRequest{TierID: "GROWTH_PRO_10K"})
	if err != nil {
		t.Fatalf("growth package purchase failed: %v", err)
	}
	if growthResp.AddedQuota != 10000 {
		t.Fatalf("expected 10000 added, got: %d", growthResp.AddedQuota)
	}
}

func TestAgentBinding(t *testing.T) {
	svc := NewService(nil)
	wallet := "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2"

	req := BindAgentRequest{
		AgentName:     "alpha-bot",
		ModelName:     "deepseek-r1",
		WalletAddress: wallet,
		WalletBalance: 500.0,
		Permissions:   []string{"trade:perp", "pay:micropayment"},
		Limits: LimitsConfig{
			MaxPerTxUSD:   50.0,
			DailyLimitUSD: 200.0,
		},
		RateLimit: RateLimitConfig{RPM: 60},
	}

	binding, err := svc.BindAgent(wallet, req)
	if err != nil {
		t.Fatalf("bind agent err: %v", err)
	}
	if binding.AgentID == "" || binding.SessionKey == "" {
		t.Fatalf("expected generated agentID and sessionKey, got %+v", binding)
	}
	if binding.Status != "ACTIVE" {
		t.Fatalf("expected ACTIVE status, got %s", binding.Status)
	}

	agents := svc.ListBoundAgents()
	if len(agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(agents))
	}
}

func TestProcessPayment(t *testing.T) {
	svc := NewService(nil)
	wallet := "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2"

	// 1. Crypto payment
	cryptoOrder, err := svc.ProcessPayment(wallet, PaymentRequest{
		Amount:         15.5,
		ItemName:       "High-Frequency Market Oracle Access",
		OrderHash:      "0xabc1237890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
		Quantity:       1,
		PaymentMethod:  "crypto",
		CryptoCurrency: "MON",
	})
	if err != nil {
		t.Fatalf("crypto payment err: %v", err)
	}
	if cryptoOrder.OnChainStatus != "COMMITTED_TO_MONAD" || cryptoOrder.TxHash == "" {
		t.Fatalf("expected Monad commitment, got %+v", cryptoOrder)
	}

	// 2. Stripe payment
	stripeOrder, err := svc.ProcessPayment(wallet, PaymentRequest{
		Amount:        99.0,
		ItemName:      "Compute Cluster GPU Time",
		OrderHash:     "0xdef4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef34",
		Quantity:      2,
		PaymentMethod: "stripe",
	})
	if err != nil {
		t.Fatalf("stripe payment err: %v", err)
	}
	if stripeOrder.PaymentMethod != "stripe" {
		t.Fatalf("expected stripe method, got %s", stripeOrder.PaymentMethod)
	}

	// Check console stats
	stats := svc.GetConsoleStats(wallet)
	if stats.PaymentDistribution["crypto"] != 1 || stats.PaymentDistribution["stripe"] != 1 {
		t.Fatalf("unexpected stats distribution: %+v", stats.PaymentDistribution)
	}
	expectedVolume := 15.5*1 + 99.0*2
	if stats.TotalVolumeUSD != expectedVolume {
		t.Fatalf("expected volume %.2f, got %.2f", expectedVolume, stats.TotalVolumeUSD)
	}
}
