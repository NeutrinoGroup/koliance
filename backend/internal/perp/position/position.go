// Package position mirrors the on-chain position maths so the liquidator can
// decide what to liquidate without an RPC round-trip per position.
//
// The mirror is the hazard here. If this disagrees with PositionManager by even
// one wei at the threshold, the bot submits liquidations that revert (burning
// gas) or skips positions that are in fact liquidatable. That is the same class
// of bug as the frontend's estimated liquidation price, and it gets the same
// treatment: the same operation order as Solidity, and boundary tests at ±1 wei.
//
// Operation order matters and is load-bearing:
//
//   - PnL is `size * (exit - entry) / entry` — one division, on the delta.
//   - Signed division truncates toward zero. Go's big.Int.Quo does the same,
//     but big.Int.Div does NOT (it rounds toward negative infinity), so Quo is
//     the only correct choice here.
//   - The maintenance margin is `size * mmrBps / 10000`, computed BEFORE the
//     equity comparison, so the division truncation is part of the verdict.
//   - Funding is `signedSize * (indexNow - entryFundingIndex) / WAD`, applied
//     BEFORE the zero floor. Flooring the PnL first would let funding revive a
//     bankrupt position, which the contract goes out of its way not to do.
//
// Nothing in this package talks to a chain. That is deliberate: it is the part
// that most needs testing and the part that can be tested without a node.
package position

import (
	"math/big"
	"sort"
	"sync"
)

// BPSDenominator mirrors PerpConstants.BPS_DENOMINATOR.
const BPSDenominator = 10000

// WAD mirrors PerpConstants.WAD, the fixed-point denominator for the funding
// index. It is the one scale in this package that is not 1e18 USD: the funding
// index is WAD-scaled and signed, not a USD amount.
var WAD = big.NewInt(1_000_000_000_000_000_000)

// Position mirrors the on-chain Position struct, minus the fields the
// liquidator has no use for. Owner and FeedID are hex strings rather than
// go-ethereum types so this package stays dependency-free and unit-testable.
type Position struct {
	ID            uint64
	Owner         string
	FeedID        string
	CollateralUSD *big.Int // 18 decimals
	SizeUSD       *big.Int // 18 decimals
	PayoutCapUSD  *big.Int // 18 decimals
	EntryPrice    *big.Int // 18 decimals
	IsLong        bool
	OpenedAt      uint64

	// EntryFundingIndex is the feed's cumulative funding index at the moment
	// this position was opened, WAD-scaled and signed. Nil means "never set",
	// which is read as zero — the same value the contract holds for a feed that
	// has never accrued.
	//
	// This is what makes funding part of the verdict (PositionManager.sol:427
	// accrues before the open records the index at :458). Without it the mirror
	// sees a position that is always charged the whole index from zero.
	EntryFundingIndex *big.Int
}

// PnL is the unrealised profit or loss at markPrice, in 18-decimal USD.
//
// Mirrors PositionManager._pnl. Returns a fresh value; the receiver is not
// mutated.
func (p *Position) PnL(markPrice *big.Int) *big.Int {
	if markPrice.Cmp(p.EntryPrice) == 0 {
		return big.NewInt(0)
	}

	delta := new(big.Int).Sub(markPrice, p.EntryPrice)
	if !p.IsLong {
		delta.Neg(delta)
	}

	// Quo truncates toward zero, matching Solidity's signed division. Div would
	// floor and disagree for negative deltas.
	return new(big.Int).Quo(new(big.Int).Mul(p.SizeUSD, delta), p.EntryPrice)
}

// Funding is what this position owes at fundingIndex, in 18-decimal USD.
//
// Mirrors PositionManager._fundingFor (PositionManager.sol:933-939):
//
//	delta      = indexNow - entryFundingIndex
//	signedSize = isLong ? +size : -size
//	funding    = signedSize * delta / WAD
//
// Positive means the trader PAYS, and equity subtracts it. The side multiplier
// is not optional: without it both sides are charged identically and the thin
// side is never paid, so funding stops being a transfer between the two sides
// and becomes a fee. Note the direction lives in the index (longs crowding push
// it up) while the side lives in the multiplier, so a short-heavy book works
// out symmetrically.
//
// Quo, not Div: Solidity's signed division truncates toward zero, and a Div here
// would round a payer's obligation down a wei in a way the contract does not.
//
// The receiver is not mutated; the returned value is fresh.
//
// A nil fundingIndex means "no index observed for this feed" and reads as zero,
// the same value the contract holds for a feed that never accrued. Callers get
// that for free from Table.Scan, which passes nil for a feed it has not seen.
func (p *Position) Funding(fundingIndex *big.Int) *big.Int {
	delta := new(big.Int).Sub(indexOrZero(fundingIndex), p.entryFundingIndex())
	if delta.Sign() == 0 {
		return big.NewInt(0)
	}

	signedSize := new(big.Int).Set(p.SizeUSD)
	if !p.IsLong {
		signedSize.Neg(signedSize)
	}
	// Quo truncates toward zero, matching Solidity.
	return new(big.Int).Quo(new(big.Int).Mul(signedSize, delta), WAD)
}

// Equity is collateral plus PnL minus funding, floored at zero.
//
// Mirrors PositionManager._equityAfterFunding (PositionManager.sol:952-960):
//
//	equity = clamp(collateral + pnl - funding)
//
// The ordering is observable, not cosmetic. Funding is applied BEFORE the floor
// and the floor is the last step, so:
//
//   - the cost of carry alone can push a position through its maintenance
//     margin, which is the mechanism ADR-003's per-block rate exists for; and
//   - a mirror that clamped `collateral + pnl` first and subtracted funding
//     afterwards would hand a bankrupt position its credit as fresh equity
//     (equity = the credit, above the margin) and skip a liquidation the
//     contract performs. TestFundingIsAppliedBeforeTheZeroFloor pins this.
//
// Note what the ordering does NOT mean: a funding credit can still lift a
// bankrupt position's equity above zero, because the clamp is on the final sum
// rather than a cap on how far the credit may reach. That is the contract's
// behaviour, mirrored faithfully.
func (p *Position) Equity(markPrice, fundingIndex *big.Int) *big.Int {
	pnl := p.PnL(markPrice)

	// collateral + pnl - funding, in one signed sum, then the floor. Computing
	// this as two unsigned steps would need a branch per sign and would not
	// reproduce the contract's order.
	equity := new(big.Int).Add(p.CollateralUSD, pnl)
	equity.Sub(equity, p.Funding(fundingIndex))
	if equity.Sign() < 0 {
		return big.NewInt(0)
	}
	return equity
}

// IsLiquidatable reports whether the position breaches the maintenance margin.
//
// Mirrors PositionManager._isLiquidatable exactly (PositionManager.sol:1045-1049):
//
//	mm     = size * mmrBps / 10000
//	equity = collateral + pnl - funding, floored at 0
//	verdict = equity <= mm
//
// Note `<=`, not `<`: a position sitting exactly on the threshold IS
// liquidatable, and the boundary tests pin that down.
//
// fundingIndex is the feed's CURRENT cumulative index, not the entry one.
func (p *Position) IsLiquidatable(markPrice, fundingIndex *big.Int, mmrBps uint64) bool {
	mm := new(big.Int).Quo(
		new(big.Int).Mul(p.SizeUSD, new(big.Int).SetUint64(mmrBps)),
		big.NewInt(BPSDenominator),
	)
	return p.Equity(markPrice, fundingIndex).Cmp(mm) <= 0
}

// LiquidationPrice is the mark price at which IsLiquidatable flips to true.
//
// Mirrors src/lib/perp.ts liquidationPriceWithFunding (which GAP-37 pinned to
// the chain with 48 funding-non-zero vectors). Solves `collateral + pnl -
// funding == mm` for price:
//
//	long : P = entry * (mm - collateral + funding + size) / size
//	short: P = entry * (collateral + size - mm - funding) / size
//
// That is the funding-free rearrangement with `funding` added to the numerator,
// so LiquidationPrice(mmr, 0) is bit-for-bit the funding-free value — the same
// structural property the frontend relies on, and the reason the 60 golden
// vectors that pin the funding-free case transitively pin this one.
//
// Two integer divisions, in that order — mm first, then the final divide. The
// contract does the same two, so the results agree. Returns zero when the
// numerator is non-positive, meaning collateral alone already covers the margin
// (only reachable at 1x) or, for a short, that the position is already through
// it.
func (p *Position) LiquidationPrice(mmrBps uint64, fundingIndex *big.Int) *big.Int {
	if p.SizeUSD.Sign() == 0 {
		return big.NewInt(0)
	}

	mm := new(big.Int).Quo(
		new(big.Int).Mul(p.SizeUSD, new(big.Int).SetUint64(mmrBps)),
		big.NewInt(BPSDenominator),
	)
	funding := p.Funding(fundingIndex)

	var numerator *big.Int
	if p.IsLong {
		// mm - collateral + funding + size
		numerator = new(big.Int).Add(mm, funding)
		numerator.Add(numerator, p.SizeUSD)
		numerator.Sub(numerator, p.CollateralUSD)
	} else {
		// collateral + size - mm - funding
		numerator = new(big.Int).Add(p.CollateralUSD, p.SizeUSD)
		numerator.Sub(numerator, mm)
		numerator.Sub(numerator, funding)
	}
	if numerator.Sign() <= 0 {
		return big.NewInt(0)
	}

	return new(big.Int).Quo(new(big.Int).Mul(p.EntryPrice, numerator), p.SizeUSD)
}

// entryFundingIndex reads the field with nil as zero. A feed that has never
// accrued has index zero on chain, so the two spellings mean the same thing and
// callers never have to check.
func (p *Position) entryFundingIndex() *big.Int {
	return indexOrZero(p.EntryFundingIndex)
}

// indexOrZero is the nil-as-zero rule, in one place. Both the stored entry index
// and the caller-supplied current index go through it, so neither can panic on a
// nil that means "unknown".
func indexOrZero(v *big.Int) *big.Int {
	if v == nil {
		return big.NewInt(0)
	}
	return v
}

// Table is a concurrency-safe view of open positions, built from chain events.
//
// It also carries the most recent funding index observed per feed, because the
// verdict needs `indexNow` and the position events do not carry it. The two live
// under one lock on purpose: a scan that read the book and the indexes under
// separate locks could mix a position from before an accrual with the index from
// after it. The window is one block wide at most, but it is the same class of
// inconsistency (a verdict computed against a torn snapshot) that the batching
// in Scan exists to avoid.
type Table struct {
	mu        sync.RWMutex
	positions map[uint64]*Position
	funding   map[string]*big.Int
}

// NewTable returns an empty table.
func NewTable() *Table {
	return &Table{
		positions: make(map[uint64]*Position),
		funding:   make(map[string]*big.Int),
	}
}

// ApplyOpen records a newly opened position.
func (t *Table) ApplyOpen(p *Position) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.positions[p.ID] = p
}

// ApplyFundingIndex records the latest cumulative funding index for a feed.
//
// The value is copied rather than stored by reference: the caller (an event
// decoder) may reuse or mutate the buffer, and a shared *big.Int that quietly
// changes under the scanner is exactly the kind of silent mirror drift this
// package exists to prevent.
//
// nil is ignored rather than stored. An unobserved feed and a feed whose index
// is genuinely zero are different claims, and only the second one is evidence;
// accepting nil would let a decoder erase a real observation and silently
// revert the verdict to funding-free.
func (t *Table) ApplyFundingIndex(feedID string, index *big.Int) {
	if index == nil {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	t.funding[feedID] = new(big.Int).Set(index)
}

// ApplyClose removes a position that was closed or liquidated.
//
// Idempotent: a close for an id the table never saw is a no-op, because the
// backfill and the live subscription can legitimately race and deliver the same
// close twice.
func (t *Table) ApplyClose(id uint64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.positions, id)
}

// Len is the number of open positions.
func (t *Table) Len() int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return len(t.positions)
}

// Get returns a position by id.
func (t *Table) Get(id uint64) (*Position, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	p, ok := t.positions[id]
	return p, ok
}

// Snapshot returns a copy of the open positions, ordered by id.
func (t *Table) Snapshot() []*Position {
	t.mu.RLock()
	defer t.mu.RUnlock()

	return sortedCopy(t.positions)
}

// snapshotWithFunding returns the open positions together with the observed
// funding index per feed, both read under ONE lock hold. Scan is the only
// caller, and it needs the pair to be consistent with each other.
func (t *Table) snapshotWithFunding() ([]*Position, map[string]*big.Int) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	positions := sortedCopy(t.positions)

	funding := make(map[string]*big.Int, len(t.funding))
	for feed, idx := range t.funding {
		funding[feed] = idx // already a private copy from ApplyFundingIndex
	}
	return positions, funding
}

// sortedCopy copies the position values out of the map and orders them by id.
// The caller must hold at least a read lock.
func sortedCopy(m map[uint64]*Position) []*Position {
	out := make([]*Position, 0, len(m))
	for _, p := range m {
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// PriceLookup resolves a feed id to a mark price. The bool is false when the
// feed has no usable price, and such positions are skipped rather than guessed
// at — a missing price must never be treated as "not liquidatable" silently,
// which is why the caller gets to decide what to do about it.
type PriceLookup func(feedID string) (price *big.Int, ok bool)

// Batch is one liquidate() call's worth of work.
type Batch struct {
	FeedID      string
	PositionIDs []uint64
	MarkPrice   *big.Int
}

// Scan collects liquidatable positions grouped into per-feed batches.
//
// Grouping by feed is not cosmetic: `liquidate(ids, updates)` values every
// position in one call against a SINGLE price snapshot, so positions sharing a
// call must share a feed and a price. Mixing feeds in one call would need the
// contract to hold several snapshots, which it does not do.
//
// The verdict includes funding, using the index each feed was last observed at
// (ApplyFundingIndex). The contract's own verdict uses an index PROJECTED to the
// current block (PositionManager._projectedFundingIndex); this mirror uses the
// last observed one, so between accruals it lags and can under-report. That is
// the same direction as the gap this method closes, and it is recorded as a
// known residual rather than papered over with a second funding model (see
// docs/changes/026).
//
// Positions whose feed has no price are returned in `skipped` rather than
// dropped, so the caller can log the gap instead of quietly missing a
// liquidation.
func (t *Table) Scan(mmrBps uint64, lookup PriceLookup) (batches []Batch, skipped []uint64) {
	positions, funding := t.snapshotWithFunding()

	byFeed := make(map[string][]uint64)
	prices := make(map[string]*big.Int)

	for _, p := range positions {
		price, ok := prices[p.FeedID]
		if !ok {
			var found bool
			price, found = lookup(p.FeedID)
			if !found {
				skipped = append(skipped, p.ID)
				continue
			}
			prices[p.FeedID] = price
		}

		// nil (no observation) reads as funding of zero, which is the mirror's
		// pre-GAP-41 verdict rather than a guess at a non-zero index.
		if p.IsLiquidatable(price, funding[p.FeedID], mmrBps) {
			byFeed[p.FeedID] = append(byFeed[p.FeedID], p.ID)
		}
	}

	// Deterministic order so a run is reproducible and testable.
	feeds := make([]string, 0, len(byFeed))
	for f := range byFeed {
		feeds = append(feeds, f)
	}
	sort.Strings(feeds)

	for _, f := range feeds {
		ids := byFeed[f]
		sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
		batches = append(batches, Batch{FeedID: f, PositionIDs: ids, MarkPrice: prices[f]})
	}

	sort.Slice(skipped, func(i, j int) bool { return skipped[i] < skipped[j] })
	return batches, skipped
}
