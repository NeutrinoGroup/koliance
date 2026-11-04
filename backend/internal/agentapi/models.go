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
	UserID         string    `json:"user_id,omitempty"`
	WalletAddress  string    `json:"wallet_address"`
	Name           string    `json:"name,omitempty"`
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

// InferenceVault maintains a user's micro-payment inference fund pool and auto-topup guardrails.
type InferenceVault struct {
	WalletAddress       string    `json:"wallet_address"`
	BalanceUSD          float64   `json:"balance_usd"`
	BalanceCNY          float64   `json:"balance_cny"`
	TotalDepositedUSD   float64   `json:"total_deposited_usd"`
	AutoRechargeEnabled bool      `json:"auto_recharge_enabled"`
	DailyLimitUSD       float64   `json:"daily_limit_usd"`
	SpentTodayUSD       float64   `json:"spent_today_usd"`
	StripeCustomerID    string    `json:"stripe_customer_id,omitempty"`
	PaymentMethodID     string    `json:"payment_method_id,omitempty"`
	CardLast4           string    `json:"card_last4,omitempty"`
	CardBrand           string    `json:"card_brand,omitempty"`
	LastRechargedAt     time.Time `json:"last_recharged_at"`
	LastResetDay        string    `json:"last_reset_day"`
}

// DepositRequest specifies topup parameters.
type DepositRequest struct {
	WalletAddress string  `json:"wallet_address"`
	AmountCNY     float64 `json:"amount_cny"`
	Currency      string  `json:"currency"`       // "cny", "usd"
	PaymentMethod string  `json:"payment_method"` // "wechat_pay", "alipay", "card", "crypto_mon"
	TxHash        string  `json:"tx_hash,omitempty"`
}

// CardBindRequest configures virtual or physical card auto-recharge.
type CardBindRequest struct {
	WalletAddress       string  `json:"wallet_address"`
	CustomerID          string  `json:"customer_id"`
	PaymentMethodID     string  `json:"payment_method_id"`
	CardLast4           string  `json:"card_last4"`
	CardBrand           string  `json:"card_brand"`
	AutoRechargeEnabled bool    `json:"auto_recharge_enabled"`
	DailyLimitUSD       float64 `json:"daily_limit_usd"`
}

// InferenceMeteringLog records an autonomous agent inference deduction.
type InferenceMeteringLog struct {
	ID               string    `json:"id"`
	WalletAddress    string    `json:"wallet_address"`
	Model            string    `json:"model"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	TotalTokens      int       `json:"total_tokens"`
	CostCNY          float64   `json:"cost_cny"`
	CostUSD          float64   `json:"cost_usd"`
	Timestamp        time.Time `json:"timestamp"`
}

