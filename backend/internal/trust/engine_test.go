package trust

import (
	"context"
	"math"
	"sync"
	"testing"
)

func TestCalculateWeights(t *testing.T) {
	// Full marks test: 100% success, 50 trades, $1000 assets, 5.0 rating
	full := RawMetrics{
		SuccessRate: 1.0,
		TradeCount:  50,
		AssetUSD:    1000.0,
		Rating:      5.0,
	}
	bd := Calculate(full)
	if bd.SuccessRateScore != 35.0 {
		t.Errorf("SuccessRateScore = %v, want 35.0", bd.SuccessRateScore)
	}
	if bd.TradeVolumeScore != 25.0 {
		t.Errorf("TradeVolumeScore = %v, want 25.0", bd.TradeVolumeScore)
	}
	if bd.AssetProofScore != 25.0 {
		t.Errorf("AssetProofScore = %v, want 25.0", bd.AssetProofScore)
	}
	if bd.RatingScore != 15.0 {
		t.Errorf("RatingScore = %v, want 15.0", bd.RatingScore)
	}

	total := bd.SuccessRateScore + bd.TradeVolumeScore + bd.AssetProofScore + bd.RatingScore
	if total != 100.0 {
		t.Errorf("Total = %v, want 100.0", total)
	}
}

func TestCalculateEdgeCases(t *testing.T) {
	// Zero values
	zero := RawMetrics{
		SuccessRate: 0.0,
		TradeCount:  0,
		AssetUSD:    0.0,
		Rating:      0.0,
	}
	bdZero := Calculate(zero)
	if bdZero.SuccessRateScore != 0 || bdZero.TradeVolumeScore != 0 || bdZero.AssetProofScore != 0 || bdZero.RatingScore != 0 {
		t.Errorf("Expected all zeros, got %+v", bdZero)
	}

	// Saturated values (exceeding maximums)
	excess := RawMetrics{
		SuccessRate: 1.5,
		TradeCount:  200,
		AssetUSD:    50000.0,
		Rating:      10.0,
	}
	bdExcess := Calculate(excess)
	if bdExcess.SuccessRateScore != 35.0 {
		t.Errorf("SuccessRateScore saturated = %v, want 35.0", bdExcess.SuccessRateScore)
	}
	if bdExcess.TradeVolumeScore != 25.0 {
		t.Errorf("TradeVolumeScore saturated = %v, want 25.0", bdExcess.TradeVolumeScore)
	}
	if bdExcess.AssetProofScore != 25.0 {
		t.Errorf("AssetProofScore saturated = %v, want 25.0", bdExcess.AssetProofScore)
	}
	if bdExcess.RatingScore != 15.0 {
		t.Errorf("RatingScore saturated = %v, want 15.0", bdExcess.RatingScore)
	}

	// Negative values
	neg := RawMetrics{
		SuccessRate: -0.5,
		TradeCount:  -10,
		AssetUSD:    -500.0,
		Rating:      -2.0,
	}
	bdNeg := Calculate(neg)
	if bdNeg.SuccessRateScore != 0 || bdNeg.TradeVolumeScore != 0 || bdNeg.AssetProofScore != 0 || bdNeg.RatingScore != 0 {
		t.Errorf("Expected negative values clamped to 0, got %+v", bdNeg)
	}
}

func TestDetermineTier(t *testing.T) {
	tests := []struct {
		score       float64
		wantTier    string
		wantLev     int
		wantLimit   float64
	}{
		{95.0, TierPrime, 20, 5000.0},
		{80.0, TierPrime, 20, 5000.0},
		{79.9, TierTrusted, 10, 2000.0},
		{60.0, TierTrusted, 10, 2000.0},
		{59.9, TierStandard, 5, 500.0},
		{40.0, TierStandard, 5, 500.0},
		{39.9, TierUnverified, 2, 100.0},
		{10.0, TierUnverified, 2, 100.0},
		{0.0, TierUnverified, 2, 100.0},
	}

	for _, tt := range tests {
		tier, lev, limit, _ := DetermineTier(tt.score)
		if tier != tt.wantTier || lev != tt.wantLev || limit != tt.wantLimit {
			t.Errorf("DetermineTier(%v) = (%v, %v, %v), want (%v, %v, %v)",
				tt.score, tier, lev, limit, tt.wantTier, tt.wantLev, tt.wantLimit)
		}
	}
}

func TestEngineEvaluateAndConcurrency(t *testing.T) {
	engine := NewEngine()
	wallet := "0x1111111111111111111111111111111111111111"

	// First get should return default evaluation
	evalDefault := engine.GetEvaluation(context.Background(), wallet)
	if evalDefault.WalletAddress != wallet {
		t.Errorf("wallet mismatch: got %v", evalDefault.WalletAddress)
	}
	if evalDefault.TotalScore <= 0 {
		t.Errorf("expected positive baseline score, got %v", evalDefault.TotalScore)
	}

	// Update evaluation
	metrics := RawMetrics{
		SuccessRate: 0.90,
		TradeCount:  40,
		AssetUSD:    800.0,
		Rating:      4.5,
	}
	evalUpdated := engine.Evaluate(wallet, metrics)
	if evalUpdated.TotalScore < 80.0 {
		t.Errorf("expected high score for strong metrics, got %v", evalUpdated.TotalScore)
	}

	// Concurrent evaluations
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			w := wallet
			if idx%2 == 0 {
				engine.GetEvaluation(context.Background(), w)
			} else {
				engine.Evaluate(w, metrics)
			}
		}(i)
	}
	wg.Wait()
}

func TestCalculateWithNaNAndInf(t *testing.T) {
	metrics := RawMetrics{
		SuccessRate: math.NaN(),
		TradeCount:  -10,
		AssetUSD:    math.Inf(1),
		Rating:      math.NaN(),
	}
	breakdown := Calculate(metrics)
	if math.IsNaN(breakdown.SuccessRateScore) || math.IsNaN(breakdown.AssetProofScore) || math.IsNaN(breakdown.RatingScore) {
		t.Fatalf("expected finite scores for NaN/Inf inputs, got: %+v", breakdown)
	}

	tier, maxLev, credit, _ := DetermineTier(math.NaN())
	if tier != TierUnverified || maxLev != 2 || credit != 100.0 {
		t.Fatalf("expected baseline unverified tier for NaN score, got tier=%s maxLev=%d credit=%v", tier, maxLev, credit)
	}
}
