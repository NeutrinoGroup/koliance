package chain

import (
	"math/big"

	"github.com/koliance/backend/internal/chain/bindings"
	"github.com/koliance/backend/internal/perp/position"
)

// PositionFromOpened converts a decoded PositionOpened event into the pure
// position.Position mirror type that internal/perp/position consumes.
//
// The frozen event does not carry payoutCapUsd, openedAt or entryFundingIndex
// (they are stored on chain at open time, PositionManager.sol:449-459, but not
// emitted), so the caller supplies them:
//
//   - payoutCapUSD is `collateral + size * maxProfitBps / 1e4`, fixed at open.
//   - openedAt is the block timestamp of the log that emitted the event.
//   - entryFundingIndex is the feed's cumulative funding index at open. The
//     contract accrues it in the same transaction, immediately before emitting
//     this event (:427), and emits FundingAccrued from that accrual, so a
//     replaying caller has it in hand. Nil is "not observed" and the mirror
//     reads it as zero.
//
// Every big.Int field is copied, never aliased: the returned Position does not
// share storage with the event, which the log decoder may reuse.
func PositionFromOpened(
	ev *bindings.IPositionManagerPositionOpened,
	payoutCapUSD *big.Int,
	openedAt uint64,
	entryFundingIndex *big.Int,
) *position.Position {
	p := &position.Position{
		ID:            ev.PositionId.Uint64(),
		Owner:         ev.Owner.Hex(),
		FeedID:        feedIDHex(ev.FeedId),
		CollateralUSD: new(big.Int).Set(ev.CollateralUsd),
		SizeUSD:       new(big.Int).Set(ev.SizeUsd),
		PayoutCapUSD:  new(big.Int).Set(payoutCapUSD),
		EntryPrice:    new(big.Int).Set(ev.EntryPrice),
		IsLong:        ev.IsLong,
		OpenedAt:      openedAt,
	}
	if entryFundingIndex != nil {
		p.EntryFundingIndex = new(big.Int).Set(entryFundingIndex)
	}
	return p
}

// payoutCapUSD mirrors PositionManager._payoutCapUsd exactly:
//
//	collateralUsd + (sizeUsd * maxProfitBps) / BPS_DENOMINATOR
//
// The division truncates (unsigned Solidity division), and big.Int.Quo does
// the same for non-negative operands. maxProfitBps is read back from the
// contract at startup rather than hardcoded (IPositionManager.sol:179-180).
func payoutCapUSD(collateralUSD, sizeUSD, maxProfitBps *big.Int) *big.Int {
	num := new(big.Int).Mul(sizeUSD, maxProfitBps)
	num.Quo(num, big.NewInt(position.BPSDenominator))
	return new(big.Int).Add(collateralUSD, num)
}
