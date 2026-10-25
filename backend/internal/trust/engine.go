package trust

import (
	"context"
	"math"
	"sync"
	"time"
)

// Weight constants for multi-dimensional trust score calculation.
// Sum of weights = 1.00 (100%).
const (
	WeightSuccessRate = 0.35 // 35%: Trade success and profitable execution rate
	WeightTradeVolume = 0.25 // 25%: Completed trade frequency and order depth
	WeightAssetProof  = 0.25 // 25%: Capital/collateral backing and position proof
	WeightRating      = 0.15 // 15%: Fulfillment compliance and peer feedback
)

// Trust tier designations based on composite score (0-100).
const (
	TierPrime      = "TIER_PRIME"      // 80.0 - 100.0: High liquidity, 20x max leverage
	TierTrusted    = "TIER_TRUSTED"    // 60.0 - 79.9: Reliable trader, 10x max leverage
	TierStandard   = "TIER_STANDARD"   // 40.0 - 59.9: Emerging trader, 5x max leverage
	TierUnverified = "TIER_UNVERIFIED" //  0.0 - 39.9: Initial state, 2x max leverage
)

// RawMetrics contains user trade activity metrics.
type RawMetrics struct {
	SuccessRate float64 `json:"success_rate"` // 0.0 - 1.0
	TradeCount  int     `json:"trade_count"`  // Total executed trades
	AssetUSD    float64 `json:"asset_usd"`    // Equity / collateral in USD
	Rating      float64 `json:"rating"`       // Fulfillment rating 0.0 - 5.0
}

// ScoreBreakdown represents the dimensional score contribution.
type ScoreBreakdown struct {
	SuccessRateScore float64    `json:"success_rate_score"` // Max 35.0
	TradeVolumeScore float64    `json:"trade_volume_score"` // Max 25.0
	AssetProofScore  float64    `json:"asset_proof_score"`  // Max 25.0
	RatingScore      float64    `json:"rating_score"`       // Max 15.0
	RawMetrics       RawMetrics `json:"raw_metrics"`
}

// Evaluation represents the final trust score, tier, and execution capabilities.
type Evaluation struct {
	WalletAddress  string         `json:"wallet_address"`
	TotalScore     float64        `json:"total_score"`      // 0.0 - 100.0
	Tier           string         `json:"tier"`             // TIER_PRIME, TIER_TRUSTED, etc.
	MaxLeverage    int            `json:"max_leverage"`     // 2x, 5x, 10x, 20x
	CreditLimitUSD float64        `json:"credit_limit_usd"` // Maximum allowable borrowing power
	EvaluatedAt    time.Time      `json:"evaluated_at"`
	Breakdown      ScoreBreakdown `json:"breakdown"`
	Recommendation string         `json:"recommendation"`
}

// Engine calculates multi-weighted trust scores and persists evaluated profiles.
type Engine struct {
	mu       sync.RWMutex
	profiles map[string]*Evaluation
}

// NewEngine creates a new trading trust evaluation engine.
func NewEngine() *Engine {
	return &Engine{
		profiles: make(map[string]*Evaluation),
	}
}

// Calculate computes the multi-weighted trust score from raw trade metrics.
func Calculate(metrics RawMetrics) ScoreBreakdown {
	// 1. Success Rate (35%): clamped to [0.0, 1.0]
	sr := metrics.SuccessRate
	if sr < 0 {
		sr = 0
	} else if sr > 1.0 {
		sr = 1.0
	}
	successScore := math.Round(sr*WeightSuccessRate*100.0*10) / 10

	// 2. Trade Count / Frequency (25%): 50 completed trades saturates full 25 points
	countRatio := float64(metrics.TradeCount) / 50.0
	if countRatio > 1.0 {
		countRatio = 1.0
	} else if countRatio < 0 {
		countRatio = 0
	}
	volumeScore := math.Round(countRatio*WeightTradeVolume*100.0*10) / 10

	// 3. Asset Proof / Collateral (25%): $1,000 USD saturates full 25 points
	assetRatio := metrics.AssetUSD / 1000.0
	if assetRatio > 1.0 {
		assetRatio = 1.0
	} else if assetRatio < 0 {
		assetRatio = 0
	}
	assetScore := math.Round(assetRatio*WeightAssetProof*100.0*10) / 10

	// 4. Fulfillment Rating (15%): 5.0 scale
	rating := metrics.Rating
	if rating < 0 {
		rating = 0
	} else if rating > 5.0 {
		rating = 5.0
	}
	ratingScore := math.Round((rating/5.0)*WeightRating*100.0*10) / 10

	return ScoreBreakdown{
		SuccessRateScore: successScore,
		TradeVolumeScore: volumeScore,
		AssetProofScore:  assetScore,
		RatingScore:      ratingScore,
		RawMetrics: RawMetrics{
			SuccessRate: math.Round(sr*1000) / 1000,
			TradeCount:  metrics.TradeCount,
			AssetUSD:    math.Round(metrics.AssetUSD*100) / 100,
			Rating:      math.Round(rating*10) / 10,
		},
	}
}

// DetermineTier maps total score to trust tier and leverage parameters.
func DetermineTier(score float64) (tier string, maxLeverage int, creditLimitUSD float64, recommendation string) {
	switch {
	case score >= 80.0:
		return TierPrime, 20, 5000.00, "[PRIME] High-frequency autonomous agent trading permitted. Maximum leverage unlocked."
	case score >= 60.0:
		return TierTrusted, 10, 2000.00, "[TRUSTED] Verified trading history with strong execution solvency."
	case score >= 40.0:
		return TierStandard, 5, 500.00, "[STANDARD] Established trader with moderate position limits."
	default:
		return TierUnverified, 2, 100.00, "[UNVERIFIED] Introductory trading tier. Complete more trades to elevate trust."
	}
}

// Evaluate computes and caches a wallet's trust score.
func (e *Engine) Evaluate(wallet string, metrics RawMetrics) Evaluation {
	breakdown := Calculate(metrics)
	totalScore := math.Round((breakdown.SuccessRateScore+breakdown.TradeVolumeScore+breakdown.AssetProofScore+breakdown.RatingScore)*10) / 10
	if totalScore > 100.0 {
		totalScore = 100.0
	}

	tier, maxLev, creditLimit, rec := DetermineTier(totalScore)

	eval := Evaluation{
		WalletAddress:  wallet,
		TotalScore:     totalScore,
		Tier:           tier,
		MaxLeverage:    maxLev,
		CreditLimitUSD: creditLimit,
		EvaluatedAt:    time.Now().UTC(),
		Breakdown:      breakdown,
		Recommendation: rec,
	}

	e.mu.Lock()
	e.profiles[wallet] = &eval
	e.mu.Unlock()

	return eval
}

// GetEvaluation retrieves the cached evaluation or generates a baseline score.
func (e *Engine) GetEvaluation(ctx context.Context, wallet string) Evaluation {
	e.mu.RLock()
	existing, ok := e.profiles[wallet]
	e.mu.RUnlock()

	if ok {
		return *existing
	}

	// Default baseline metrics for new wallets
	defaultMetrics := RawMetrics{
		SuccessRate: 0.65,
		TradeCount:  5,
		AssetUSD:    150.0,
		Rating:      4.2,
	}
	return e.Evaluate(wallet, defaultMetrics)
}
