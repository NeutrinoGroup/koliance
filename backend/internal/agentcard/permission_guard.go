package agentcard

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"
)

type SessionKey struct {
	KeyHex        string    `json:"keyHex"`
	CardID        string    `json:"cardId"`
	AgentID       string    `json:"agentId"`
	MaxPerTxUSD   float64   `json:"maxPerTxUSD"`
	DailyLimitUSD float64   `json:"dailyLimitUSD"`
	SpentTodayUSD float64   `json:"spentTodayUSD"`
	WindowStart   time.Time `json:"windowStart"`
	AllowedMCCs   []string  `json:"allowedMCCs"` // e.g. ["7999", "5814", "5734"] (Games, Dining, Digital goods)
	ExpiresAt     time.Time `json:"expiresAt"`
	IsFrozen      bool      `json:"isFrozen"`
	CreatedAt     time.Time `json:"createdAt"`
}

type PermissionGuard struct {
	mu          sync.RWMutex
	sessionKeys map[string]*SessionKey
}

func NewPermissionGuard() *PermissionGuard {
	return &PermissionGuard{
		sessionKeys: make(map[string]*SessionKey),
	}
}

// IssueSessionKey creates a new scoped delegated key for an AI Agent
func (g *PermissionGuard) IssueSessionKey(cardID, agentID string, maxPerTx, dailyLimit float64, allowedMCCs []string, ttlHours int) *SessionKey {
	g.mu.Lock()
	defer g.mu.Unlock()

	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("crypto/rand unavailable: %v", err))
	}
	keyHex := "sk_sess_" + hex.EncodeToString(b)

	if ttlHours <= 0 {
		ttlHours = 24
	}

	now := time.Now().UTC()
	sk := &SessionKey{
		KeyHex:        keyHex,
		CardID:        cardID,
		AgentID:       agentID,
		MaxPerTxUSD:   maxPerTx,
		DailyLimitUSD: dailyLimit,
		SpentTodayUSD: 0,
		WindowStart:   now,
		AllowedMCCs:   allowedMCCs,
		ExpiresAt:     now.Add(time.Duration(ttlHours) * time.Hour),
		IsFrozen:      false,
		CreatedAt:     now,
	}

	g.sessionKeys[keyHex] = sk
	return sk
}

// VerifyAndDeduct verifies permission rules and updates daily consumption atomically.
// Follows on-chain SessionKeyRegistry.sol 24-hour rolling window model.
func (g *PermissionGuard) VerifyAndDeduct(keyHex, cardID string, amountUSD float64, mcc string) error {
	return g.VerifyAndDeductWithTime(keyHex, cardID, amountUSD, mcc, time.Now().UTC())
}

// VerifyAndDeductWithTime allows deterministic time-injected verification of the rolling 24-hour window.
func (g *PermissionGuard) VerifyAndDeductWithTime(keyHex, cardID string, amountUSD float64, mcc string, now time.Time) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if math.IsNaN(amountUSD) || math.IsInf(amountUSD, 0) || amountUSD <= 0 {
		return errors.New("amount must be greater than zero")
	}

	sk, exists := g.sessionKeys[keyHex]
	if !exists || sk.CardID != cardID {
		return errors.New("invalid or revoked session key")
	}

	if sk.IsFrozen {
		return errors.New("session key is frozen by circuit breaker")
	}

	if now.After(sk.ExpiresAt) {
		return errors.New("session key has expired")
	}

	// 24-hour rolling window check (matches on-chain SessionKeyRegistry.sol windowStart logic)
	if now.Sub(sk.WindowStart) >= 24*time.Hour {
		sk.SpentTodayUSD = 0
		sk.WindowStart = now
	}

	if amountUSD > sk.MaxPerTxUSD {
		return fmt.Errorf("transaction amount $%.2f exceeds per-transaction limit $%.2f", amountUSD, sk.MaxPerTxUSD)
	}

	if sk.SpentTodayUSD+amountUSD > sk.DailyLimitUSD {
		return fmt.Errorf("daily spending limit reached: $%.2f / $%.2f", sk.SpentTodayUSD+amountUSD, sk.DailyLimitUSD)
	}

	if len(sk.AllowedMCCs) > 0 {
		mccAllowed := false
		for _, m := range sk.AllowedMCCs {
			if m == mcc || m == "*" {
				mccAllowed = true
				break
			}
		}
		if !mccAllowed {
			return fmt.Errorf("merchant category code (MCC %s) is not permitted by session scope", mcc)
		}
	}

	sk.SpentTodayUSD += amountUSD
	return nil
}

// FreezeSessionKey disables the session key in case of anomaly (circuit breaker)
func (g *PermissionGuard) FreezeSessionKey(keyHex string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if sk, ok := g.sessionKeys[keyHex]; ok {
		sk.IsFrozen = true
	}
}

// UnfreezeSessionKey restores a frozen session key
func (g *PermissionGuard) UnfreezeSessionKey(keyHex string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if sk, ok := g.sessionKeys[keyHex]; ok {
		sk.IsFrozen = false
	}
}

// RevokeSessionKey permanently revokes and deletes a delegated session key
func (g *PermissionGuard) RevokeSessionKey(keyHex string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.sessionKeys, keyHex)
}

// GetSessionKey returns a copy of the session key, or nil if not found
func (g *PermissionGuard) GetSessionKey(keyHex string) *SessionKey {
	g.mu.RLock()
	defer g.mu.RUnlock()
	if sk, ok := g.sessionKeys[keyHex]; ok {
		copy := *sk
		return &copy
	}
	return nil
}
