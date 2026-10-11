package agentapi

import (
	"time"
)

// APIResponse represents the unified platform envelope for all external developer endpoints.
type APIResponse struct {
	Code     int         `json:"code"`
	Response string      `json:"response"`
	Data     interface{} `json:"data"`
}

// LimitsConfig defines spending safeguards for an autonomous agent.
type LimitsConfig struct {
	MaxPerTxUSD   float64 `json:"max_per_tx_usd"`
	DailyLimitUSD float64 `json:"daily_limit_usd"`
}

// RateLimitConfig defines execution frequency constraints.
type RateLimitConfig struct {
	RPM int `json:"rpm"`
}

// BindAgentRequest defines the input payload for agent-wallet binding.
type BindAgentRequest struct {
	AgentName     string          `json:"agent_name"`
	ModelName     string          `json:"model_name"`
	WalletAddress string          `json:"wallet_address"`
	WalletBalance float64         `json:"wallet_balance"`
	Permissions   []string        `json:"permissions"`
	Limits        LimitsConfig    `json:"limits"`
	RateLimit     RateLimitConfig `json:"rate_limit"`
}

// AgentBindingView represents the bound agent information returned to callers.
type AgentBindingView struct {
	AgentID       string          `json:"agent_id"`
	AgentName     string          `json:"agent_name"`
	ModelName     string          `json:"model_name"`
	WalletAddress string          `json:"wallet_address"`
	WalletBalance float64         `json:"wallet_balance"`
	Permissions   []string        `json:"permissions"`
	Limits        LimitsConfig    `json:"limits"`
	RateLimit     RateLimitConfig `json:"rate_limit"`
	Status        string          `json:"status"`
	BoundAt       time.Time       `json:"bound_at"`
	SessionKey    string          `json:"session_key"`
}

// PaymentRequest defines the input payload for autonomous agent payments.
type PaymentRequest struct {
	Amount         float64 `json:"amount"`
	ItemName       string  `json:"item_name"`
	OrderHash      string  `json:"order_hash"`
	Quantity       int     `json:"quantity"`
	PaymentMethod  string  `json:"payment_method"` // "crypto", "bank", "stripe"
	CryptoCurrency string  `json:"crypto_currency,omitempty"` // "MON", "KOL", "USDC"
}

// PaymentOrderView represents the confirmed transaction and its on-chain settlement status.
type PaymentOrderView struct {
	PaymentID      string    `json:"payment_id"`
	Status         string    `json:"status"`
	Amount         float64   `json:"amount"`
	ItemName       string    `json:"item_name"`
	OrderHash      string    `json:"order_hash"`
	Quantity       int       `json:"quantity"`
	PaymentMethod  string    `json:"payment_method"`
	CryptoCurrency string    `json:"crypto_currency,omitempty"`
	TxHash         string    `json:"tx_hash"`
	OnChainStatus  string    `json:"on_chain_status"`
	ReceiptURL     string    `json:"receipt_url"`
	CreatedAt      time.Time `json:"created_at"`
}

// PackageClaimRequest specifies the tier and purchase method for API quotas.
type PackageClaimRequest struct {
	TierID        string `json:"tier_id"`        // "STARTER_FREE_100", "GROWTH_PRO_10K", "SCALE_ULTRA_100K"
	PaymentMethod string `json:"payment_method"` // "free_claim", "crypto_kol", "crypto_mon", "stripe"
}

// PackageClaimResponse is returned upon successful tier activation or quota top-up.
type PackageClaimResponse struct {
	TierID         string `json:"tier_id"`
	AddedQuota     int    `json:"added_quota"`
	RemainingQuota int    `json:"remaining_quota"`
	FreeClaimsLeft int    `json:"free_claims_left"`
}

// APIKeyCredential represents the persisted key metadata and quota ledger.
type APIKeyCredential struct {
	KeyID          string    `json:"key_id"`
	WalletAddress  string    `json:"wallet_address"`
	KeyPrefix      string    `json:"key_prefix"`
	KeyHash        [32]byte  `json:"-"`
	Tier           string    `json:"tier"`
	RemainingQuota int       `json:"remaining_quota"`
	FreeClaimsLeft int       `json:"free_claims_left"`
	RateLimitRPM   int       `json:"rate_limit_rpm"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	LastUsedAt     time.Time `json:"last_used_at"`
}

// CreatedAPIKey is returned once at key generation time with the plaintext bearer token.
type CreatedAPIKey struct {
	APIKeyCredential
	RawKey string `json:"raw_key"`
}

// ConsoleStatsView summarizes usage, quota, and payment analytics for the console.
type ConsoleStatsView struct {
	WalletAddress       string                      `json:"wallet_address"`
	TotalCalls24h       int                         `json:"total_calls_24h"`
	RemainingQuota      int                         `json:"remaining_quota"`
	FreeClaimsLeft      int                         `json:"free_claims_left"`
	SuccessRatePercent  float64                     `json:"success_rate_percent"`
	AvgLatencyMs        int                         `json:"avg_latency_ms"`
	PaymentDistribution map[string]int              `json:"payment_distribution"` // e.g. "crypto": 12, "stripe": 5, "bank": 1
	TotalVolumeUSD      float64                     `json:"total_volume_usd"`
	RecentOrders        []*PaymentOrderView         `json:"recent_orders"`
}
