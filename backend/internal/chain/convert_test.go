package chain

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/koliance/backend/internal/chain/bindings"
)

// usd returns an 18-decimal USD amount.
func usd(n int64) *big.Int {
	return new(big.Int).Mul(big.NewInt(n), big.NewInt(1_000_000_000_000_000_000))
}

// feedBytes returns the deterministic bytes32 0x0001..1f.
func feedBytes() [32]byte {
	var f [32]byte
	for i := range f {
		f[i] = byte(i)
	}
	return f
}

func TestPositionFromOpened(t *testing.T) {
	owner := common.HexToAddress("0x1111111111111111111111111111111111111111")
	feed := feedBytes()
	ev := &bindings.IPositionManagerPositionOpened{
		PositionId:    big.NewInt(42),
		Owner:         owner,
		FeedId:        feed,
		CollateralUsd: usd(999),
		SizeUsd:       usd(9990),
		EntryPrice:    usd(180),
		IsLong:        true,
		Raw:           types.Log{BlockNumber: 1234},
	}

	p := PositionFromOpened(ev, usd(10989), 1_700_000_000, big.NewInt(5_000))

	if p.ID != 42 {
		t.Errorf("ID = %d, want 42", p.ID)
	}
	if p.Owner != "0x1111111111111111111111111111111111111111" {
		t.Errorf("Owner = %s, want the all-digits EIP-55 address", p.Owner)
	}
	wantFeed := "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
	if p.FeedID != wantFeed {
		t.Errorf("FeedID = %s, want %s", p.FeedID, wantFeed)
	}
	if p.CollateralUSD.Cmp(usd(999)) != 0 {
		t.Errorf("CollateralUSD = %s, want %s", p.CollateralUSD, usd(999))
	}
	if p.SizeUSD.Cmp(usd(9990)) != 0 {
		t.Errorf("SizeUSD = %s, want %s", p.SizeUSD, usd(9990))
	}
	if p.EntryPrice.Cmp(usd(180)) != 0 {
		t.Errorf("EntryPrice = %s, want %s", p.EntryPrice, usd(180))
	}
	if !p.IsLong {
		t.Errorf("IsLong = false, want true")
	}
	if p.PayoutCapUSD.Cmp(usd(10989)) != 0 {
		t.Errorf("PayoutCapUSD = %s, want %s", p.PayoutCapUSD, usd(10989))
	}
	if p.OpenedAt != 1_700_000_000 {
		t.Errorf("OpenedAt = %d, want 1700000000", p.OpenedAt)
	}
	if p.EntryFundingIndex == nil || p.EntryFundingIndex.Cmp(big.NewInt(5_000)) != 0 {
		t.Errorf("EntryFundingIndex = %v, want 5000", p.EntryFundingIndex)
	}
}

// The entryFundingIndex argument is optional because a feed with no observed
// accrual has nothing to record. Nil is the honest "unknown", not zero.
func TestPositionFromOpenedWithoutAFundingIndex(t *testing.T) {
	ev := &bindings.IPositionManagerPositionOpened{
		PositionId:    big.NewInt(1),
		Owner:         common.HexToAddress("0x1111111111111111111111111111111111111111"),
		FeedId:        feedBytes(),
		CollateralUsd: usd(100),
		SizeUsd:       usd(1000),
		EntryPrice:    usd(10),
		IsLong:        true,
	}
	p := PositionFromOpened(ev, usd(1100), 0, nil)
	if p.EntryFundingIndex != nil {
		t.Errorf("EntryFundingIndex = %s, want nil", p.EntryFundingIndex)
	}
}

// The returned Position must not alias the event's big.Int fields: mutating the
// result must not change the event, and vice versa. The caller-supplied entry
// index is copied for the same reason — it is a snapshot, and the feed's seed
// map will overwrite its value on the next accrual.
func TestPositionFromOpenedDoesNotAlias(t *testing.T) {
	ev := &bindings.IPositionManagerPositionOpened{
		PositionId:    big.NewInt(1),
		Owner:         common.HexToAddress("0x1111111111111111111111111111111111111111"),
		FeedId:        feedBytes(),
		CollateralUsd: usd(100),
		SizeUsd:       usd(1000),
		EntryPrice:    usd(10),
		IsLong:        true,
	}
	entryIndex := big.NewInt(4242)
	payoutCap := usd(1100)
	p := PositionFromOpened(ev, payoutCap, 0, entryIndex)

	p.CollateralUSD.SetUint64(0)
	p.SizeUSD.SetUint64(0)
	p.EntryPrice.SetUint64(0)
	p.PayoutCapUSD.SetUint64(0)
	p.EntryFundingIndex.SetUint64(0)

	if ev.CollateralUsd.Cmp(usd(100)) != 0 {
		t.Errorf("event CollateralUsd mutated via aliasing")
	}
	if ev.SizeUsd.Cmp(usd(1000)) != 0 {
		t.Errorf("event SizeUsd mutated via aliasing")
	}
	if ev.EntryPrice.Cmp(usd(10)) != 0 {
		t.Errorf("event EntryPrice mutated via aliasing")
	}
	if payoutCap.Cmp(usd(1100)) != 0 {
		t.Errorf("caller's payoutCap mutated via aliasing")
	}
	if entryIndex.Cmp(big.NewInt(4242)) != 0 {
		t.Errorf("caller's entryFundingIndex mutated via aliasing: %s", entryIndex)
	}
}

func TestPayoutCapUSD(t *testing.T) {
	// MAX_PROFIT_BPS = 10_000 -> cap = collateral + size.
	if got := payoutCapUSD(usd(999), usd(9990), big.NewInt(10_000)); got.Cmp(usd(999+9990)) != 0 {
		t.Errorf("payoutCapUSD = %s, want %s", got, usd(999+9990))
	}
	// A non-100% cap: 1000 + (1000*5000)/10000 = 1500.
	if got := payoutCapUSD(usd(1000), usd(1000), big.NewInt(5_000)); got.Cmp(usd(1500)) != 0 {
		t.Errorf("payoutCapUSD = %s, want %s", got, usd(1500))
	}
	// Truncation: 1 wei * 1 bps / 10000 = 0, plus 1 wei collateral -> 1.
	one := big.NewInt(1)
	if got := payoutCapUSD(one, one, one); got.Cmp(one) != 0 {
		t.Errorf("payoutCapUSD truncation = %s, want 1", got)
	}
}
