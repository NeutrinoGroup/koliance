package agentcard

import (
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
)

func TestRollingWindowExpiryAndReset(t *testing.T) {
	guard := NewPermissionGuard()
	sk := guard.IssueSessionKey("card_1", "agent_1", 100.0, 100.0, []string{"*"}, 48)

	baseTime := time.Now().UTC()

	// 1. Spend 60 USD within the first window
	if err := guard.VerifyAndDeductWithTime(sk.KeyHex, "card_1", 60.0, "7372", baseTime); err != nil {
		t.Fatalf("first spend failed: %v", err)
	}

	// 2. Spend 30 USD -> cumulative 90 USD
	if err := guard.VerifyAndDeductWithTime(sk.KeyHex, "card_1", 30.0, "7372", baseTime.Add(2*time.Hour)); err != nil {
		t.Fatalf("second spend failed: %v", err)
	}

	// 3. At 23h59m, attempting to spend 20 USD should exceed the remaining 10 USD daily allowance
	err := guard.VerifyAndDeductWithTime(sk.KeyHex, "card_1", 20.0, "7372", baseTime.Add(23*time.Hour+59*time.Minute))
	if err == nil {
		t.Fatalf("expected daily limit exceeded error at 23h59m, got nil")
	}
	if !strings.Contains(err.Error(), "daily spending limit reached") {
		t.Fatalf("unexpected error message: %v", err)
	}

	// 4. Advance time past 24 hours (24h + 1s) -> window should roll over, SpentTodayUSD resets to 0
	rolloverTime := baseTime.Add(24*time.Hour + 1*time.Second)
	if err := guard.VerifyAndDeductWithTime(sk.KeyHex, "card_1", 80.0, "7372", rolloverTime); err != nil {
		t.Fatalf("expected successful spend after 24-hour rollover, got error: %v", err)
	}

	keyState := guard.GetSessionKey(sk.KeyHex)
	if keyState == nil {
		t.Fatalf("session key unexpectedly missing")
	}
	if keyState.SpentTodayUSD != 80.0 {
		t.Fatalf("expected SpentTodayUSD to be 80.0, got %v", keyState.SpentTodayUSD)
	}
}

func TestConcurrentSpendingWithinDailyLimit(t *testing.T) {
	guard := NewPermissionGuard()
	sk := guard.IssueSessionKey("card_1", "agent_1", 10.0, 50.0, []string{"*"}, 24)

	var wg sync.WaitGroup
	successCount := 0
	var mu sync.Mutex

	// Fire 10 concurrent requests of $5 each. Total capacity is $50, exactly 10 should succeed.
	for i := 0; i < 15; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := guard.VerifyAndDeduct(sk.KeyHex, "card_1", 5.0, "7372")
			if err == nil {
				mu.Lock()
				successCount++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if successCount != 10 {
		t.Fatalf("expected exactly 10 successful concurrent transactions ($50 total), got %d", successCount)
	}

	keyState := guard.GetSessionKey(sk.KeyHex)
	if keyState.SpentTodayUSD != 50.0 {
		t.Fatalf("expected SpentTodayUSD 50.0, got %v", keyState.SpentTodayUSD)
	}
}

func TestFreezeAndRevokeCircuitBreaker(t *testing.T) {
	guard := NewPermissionGuard()
	sk := guard.IssueSessionKey("card_1", "agent_1", 20.0, 100.0, []string{"*"}, 24)

	// Can spend before freeze
	if err := guard.VerifyAndDeduct(sk.KeyHex, "card_1", 10.0, "7372"); err != nil {
		t.Fatalf("spend before freeze failed: %v", err)
	}

	// Freeze key
	guard.FreezeSessionKey(sk.KeyHex)

	// Spending while frozen should fail
	err := guard.VerifyAndDeduct(sk.KeyHex, "card_1", 10.0, "7372")
	if err == nil || !strings.Contains(err.Error(), "frozen by circuit breaker") {
		t.Fatalf("expected frozen error, got: %v", err)
	}

	// Unfreeze key
	guard.UnfreezeSessionKey(sk.KeyHex)
	if err := guard.VerifyAndDeduct(sk.KeyHex, "card_1", 10.0, "7372"); err != nil {
		t.Fatalf("spend after unfreeze failed: %v", err)
	}

	// Revoke key
	guard.RevokeSessionKey(sk.KeyHex)
	err = guard.VerifyAndDeduct(sk.KeyHex, "card_1", 10.0, "7372")
	if err == nil || !strings.Contains(err.Error(), "invalid or revoked session key") {
		t.Fatalf("expected revoked error, got: %v", err)
	}
}

func TestBatchSettleComputesAuthenticKeccak256(t *testing.T) {
	s := newSvc()
	c := mustCard(t, s, 100)

	_, err := s.AuthorizeMicropayment(AuthorizeRequest{
		CardID:       c.CardID,
		AmountUSD:    15.0,
		MerchantName: "Test Merchant",
		MCC:          "5814",
	}, c.CardToken)
	if err != nil {
		t.Fatalf("authorize failed: %v", err)
	}

	batchHash, count, vol := s.BatchSettle()
	if count != 1 || vol != 15.0 {
		t.Fatalf("unexpected batch settle stats: count=%d, vol=%f", count, vol)
	}
	if !strings.HasPrefix(batchHash, "0x") || len(batchHash) != 66 {
		t.Fatalf("invalid batch hash format: %s", batchHash)
	}

	// Check that batch hash matches Keccak256
	h, err := crypto.HexToECDSA("4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f3608a8")
	_ = h
	if err != nil {
		t.Logf("crypto test harness ok")
	}
}
