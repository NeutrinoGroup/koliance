package position

import (
	"math/big"
	"sync"
	"testing"
)

// The numbers below are the same ones the Solidity suite uses
// (contracts/test/perp/PositionManager.ts), so agreement here means agreement
// with the contract rather than with a second guess at the same arithmetic.
const e18 = 1_000_000_000_000_000_000

var (
	mmrBps = uint64(100) // 1% maintenance margin
	// Entry price 180e18. Built with usd() because 180e18 does not fit in int64.
	entry180 = usd(180)
	// zeroIndex is the funding index of a feed that has never accrued, and the
	// index a position records when it opens against one.
	zeroIndex = big.NewInt(0)
)

func usd(n int64) *big.Int { return new(big.Int).Mul(big.NewInt(n), big.NewInt(e18)) }

// tenXLong builds a 10x long with 999 USD of collateral at an entry of 180.
// size = 999 * 10 = 9990.
func tenXLong() *Position {
	return &Position{
		ID:                1,
		FeedID:            "NVDA",
		CollateralUSD:     usd(999),
		SizeUSD:           usd(9990),
		EntryPrice:        entry180,
		IsLong:            true,
		EntryFundingIndex: zeroIndex,
	}
}

func tenXShort() *Position {
	p := tenXLong()
	p.IsLong = false
	return p
}

// index returns a funding index delta of n WAD units, as a signed big.Int.
// Indexes are never built by hand in the tests below because the sign is the
// whole point.
func index(n int64) *big.Int { return new(big.Int).Mul(big.NewInt(n), WAD) }

// wadDiv returns 1/d of WAD exactly when WAD is divisible by d, so a fractional
// index can be named without spelling out digits.
func wadDiv(d int64) *big.Int { return new(big.Int).Quo(WAD, big.NewInt(d)) }

// ==================== PNL ====================

func TestPnLLongAndShortMirrorEachOther(t *testing.T) {
	long, short := tenXLong(), tenXShort()

	// +10% on a 9990 notional is +999.
	up := usd(198) // 180 -> 198
	if got := long.PnL(up); got.Cmp(usd(999)) != 0 {
		t.Errorf("long PnL at +10%% = %s, want %s", got, usd(999))
	}
	if got := short.PnL(up); got.Cmp(usd(-999)) != 0 {
		t.Errorf("short PnL at +10%% = %s, want %s", got, usd(-999))
	}

	// And the mirror image below entry.
	down := usd(162) // 180 -> 162, -10%
	if got := long.PnL(down); got.Cmp(usd(-999)) != 0 {
		t.Errorf("long PnL at -10%% = %s, want %s", got, usd(-999))
	}
	if got := short.PnL(down); got.Cmp(usd(999)) != 0 {
		t.Errorf("short PnL at -10%% = %s, want %s", got, usd(999))
	}
}

func TestPnLAtEntryPriceIsExactlyZero(t *testing.T) {
	if got := tenXLong().PnL(entry180); got.Sign() != 0 {
		t.Errorf("PnL at entry = %s, want 0", got)
	}
}

// Signed division must truncate toward zero, not floor. Go's big.Int.Quo does
// the former and Div does the latter; picking the wrong one shifts every losing
// position by one wei and breaks the boundary tests below.
func TestPnLTruncatesTowardZero(t *testing.T) {
	// size 1, entry 3, mark 1 -> (1 * (1-3)) / 3 = -2/3, which must be 0.
	p := &Position{
		CollateralUSD: big.NewInt(1000),
		SizeUSD:       big.NewInt(1),
		EntryPrice:    big.NewInt(3),
		IsLong:        true,
	}
	if got := p.PnL(big.NewInt(1)); got.Sign() != 0 {
		t.Errorf("(-2)/3 truncated toward zero = %s, want 0 (Div would give -1)", got)
	}
}

// ==================== EQUITY FLOOR ====================

func TestEquityFloorsAtZeroRatherThanGoingNegative(t *testing.T) {
	long := tenXLong()

	// A 50% crash costs 4995 against 999 of collateral: a loss of 5x the margin.
	// The contract floors this at zero rather than letting it go negative.
	crash := usd(90)
	if pnl := long.PnL(crash); pnl.Sign() >= 0 {
		t.Fatalf("expected a loss, got %s", pnl)
	}
	if got := long.Equity(crash, zeroIndex); got.Sign() != 0 {
		t.Errorf("equity past bankruptcy = %s, want 0", got)
	}
}

func TestEquityAddsProfitToCollateral(t *testing.T) {
	// +10% on 9990 is +999, so equity is 999 + 999 = 1998.
	if got := tenXLong().Equity(usd(198), zeroIndex); got.Cmp(usd(1998)) != 0 {
		t.Errorf("equity at +10%% = %s, want %s", got, usd(1998))
	}
}

// ==================== FUNDING ====================
//
// The sign convention is the thing to get right, and it is mirrored from
// PositionManager._fundingFor: the index rises when longs dominate, so a long
// pays when delta is positive and a short is paid. Getting this backwards makes
// the bot liquidate exactly the positions that are being credited.

func TestFundingSignsAndScale(t *testing.T) {
	// delta = +0.001 WAD. size 9990 USD -> 9990 * 0.001 = 9.99 USD.
	delta := new(big.Int).Quo(WAD, big.NewInt(1000))
	want := new(big.Int).Quo(usd(999), big.NewInt(100)) // 9.99

	long := tenXLong()
	if got := long.Funding(delta); got.Cmp(want) != 0 {
		t.Errorf("long funding on a rising index = %s, want %s (positive = pays)", got, want)
	}

	short := tenXShort()
	negWant := new(big.Int).Neg(want)
	if got := short.Funding(delta); got.Cmp(negWant) != 0 {
		t.Errorf("short funding on a rising index = %s, want %s (negative = receives)", got, negWant)
	}

	// A falling index flips both: the crowded short side pays.
	falling := new(big.Int).Neg(delta)
	if got := long.Funding(falling); got.Cmp(negWant) != 0 {
		t.Errorf("long funding on a falling index = %s, want %s", got, negWant)
	}
	if got := short.Funding(falling); got.Cmp(want) != 0 {
		t.Errorf("short funding on a falling index = %s, want %s", got, want)
	}
}

func TestFundingIsZeroWhenTheIndexHasNotMoved(t *testing.T) {
	// Not a tautology: the entry index is non-zero here, so a mirror that
	// subtracted zero instead of the entry index would report a charge.
	p := tenXLong()
	p.EntryFundingIndex = index(5)
	if got := p.Funding(index(5)); got.Sign() != 0 {
		t.Errorf("funding with an unmoved index = %s, want 0", got)
	}
}

func TestFundingTruncatesTowardZeroLikeSolidity(t *testing.T) {
	// A payer's obligation truncates toward zero, so a delta smaller than one
	// WAD of the position's notional rounds to zero rather than to -1.
	p := &Position{
		CollateralUSD:     usd(1000),
		SizeUSD:           big.NewInt(1),
		EntryPrice:        usd(100),
		IsLong:            true,
		EntryFundingIndex: big.NewInt(0),
	}
	// 1 * 1 / 1e18 = 0.
	if got := p.Funding(big.NewInt(1)); got.Sign() != 0 {
		t.Errorf("funding = %s, want 0", got)
	}
	// Size 1, delta 1e18 -> exactly 1.
	if got := p.Funding(WAD); got.Cmp(big.NewInt(1)) != 0 {
		t.Errorf("funding at delta=WAD = %s, want 1", got)
	}
}

// Truncation direction on a NEGATIVE funding value. Solidity's signed division
// truncates toward zero, so -(1e18+1) / 1e18 is -1. big.Int.Div would floor it
// to -2, charging the receiver a whole wei more than the contract does — and
// that one wei is exactly the kind of difference that moves a verdict at the
// threshold.
func TestFundingTruncatesTowardZeroOnACredit(t *testing.T) {
	p := &Position{
		CollateralUSD:     usd(1000),
		SizeUSD:           big.NewInt(1),
		EntryPrice:        usd(100),
		IsLong:            true,
		EntryFundingIndex: big.NewInt(0),
	}

	// A long's credit is a falling index: delta = -(WAD+1), product = -(WAD+1).
	delta := new(big.Int).Neg(new(big.Int).Add(WAD, big.NewInt(1)))
	got := p.Funding(delta)
	if got.Cmp(big.NewInt(-1)) != 0 {
		t.Errorf("funding at delta=-(WAD+1) = %s, want -1 (Div would give -2)", got)
	}
}

func TestNilEntryFundingIndexReadsAsZero(t *testing.T) {
	// The contract's cumulativeFundingIndex for a feed that never accrued is
	// zero, so nil and zero must mean the same thing here.
	zero := tenXLong()
	zero.EntryFundingIndex = big.NewInt(0)

	nilIdx := tenXLong()
	nilIdx.EntryFundingIndex = nil

	if a, b := nilIdx.Funding(index(1)), zero.Funding(index(1)); a.Cmp(b) != 0 {
		t.Errorf("nil entry index gives funding %s, zero gives %s; they must agree", a, b)
	}
	if a, b := nilIdx.Equity(entry180, index(2)), zero.Equity(entry180, index(2)); a.Cmp(b) != 0 {
		t.Errorf("nil vs zero entry index disagree on equity: %s vs %s", a, b)
	}
	if a, b := nilIdx.LiquidationPrice(mmrBps, index(0)), zero.LiquidationPrice(mmrBps, index(0)); a.Cmp(b) != 0 {
		t.Errorf("nil vs zero entry index disagree on liquidation price: %s vs %s", a, b)
	}
}

// A nil CURRENT index means "this feed has not been observed", which Scan passes
// for a feed it has never seen an accrual for. It must read as zero funding
// rather than panic — a nil dereference here would take the liquidation loop
// down, and it would do it only on a book the bot had not fully backfilled.
func TestNilCurrentFundingIndexReadsAsZero(t *testing.T) {
	p := tenXLong()
	p.EntryFundingIndex = big.NewInt(0)

	if got := p.Funding(nil); got.Sign() != 0 {
		t.Errorf("funding with a nil index = %s, want 0", got)
	}
	if got := p.Equity(entry180, nil); got.Cmp(usd(999)) != 0 {
		t.Errorf("equity with a nil index = %s, want %s (collateral alone)", got, usd(999))
	}
	if got := p.LiquidationPrice(mmrBps, nil); got.Cmp(p.LiquidationPrice(mmrBps, zeroIndex)) != 0 {
		t.Errorf("liquidation price with a nil index = %s, want the same as a zero index", got)
	}

	// A non-zero entry index with a nil current one is the same degenerate case:
	// funding delta = 0 - entry, which is a credit, not a crash.
	p.EntryFundingIndex = index(1)
	if got, want := p.Funding(nil), new(big.Int).Neg(usd(9990)); got.Cmp(want) != 0 {
		t.Errorf("funding with entry=1 WAD and a nil current index = %s, want %s", got, want)
	}
}

// The point of the whole change: funding alone, with the price NOT moving, can
// push a position through its maintenance margin. This is the case the bot was
// blind to.
func TestFundingAloneCanMakeAPositionLiquidatable(t *testing.T) {
	// 10x long, 999 collateral, size 9990, entry 180, price unchanged at 180.
	p := &Position{
		CollateralUSD:     usd(999),
		SizeUSD:           usd(9990),
		EntryPrice:        entry180,
		IsLong:            true,
		EntryFundingIndex: index(100),
	}
	atEntry := entry180

	// mm = 9990 * 1% = 99.9, so equity must fall from 999 to <= 99.9:
	//   funding >= 999 - 99.9 = 899.1 USD
	//   funding = size * delta / WAD = 9990 * delta / 1e18
	//   => delta = 899.1 / 9990 = 0.09 -> index 0.09 above the entry index.
	centiWad := new(big.Int).Quo(WAD, big.NewInt(100)) // 0.01 WAD
	delta := new(big.Int).Mul(big.NewInt(9), centiWad) // 0.09 WAD
	idx := new(big.Int).Add(p.EntryFundingIndex, delta)

	wantFunding := new(big.Int).Quo(usd(8991), big.NewInt(10)) // 899.1 USD
	if got := p.Funding(idx); got.Cmp(wantFunding) != 0 {
		t.Fatalf("funding at delta 0.09 WAD = %s, want %s", got, wantFunding)
	}
	if !p.IsLiquidatable(atEntry, idx, mmrBps) {
		t.Errorf("funding alone must be able to breach the maintenance margin at an unchanged price")
	}

	// And without the funding term the same position is healthy — which is the
	// bug this test exists for.
	if p.IsLiquidatable(atEntry, p.EntryFundingIndex, mmrBps) {
		t.Errorf("control: at its entry index the position must be healthy")
	}
}

// ==================== FUNDING BOUNDARY (±1 index wei) ====================

// fundingToHitEquity is the funding (in USD wei) that lands equity exactly on
// `want`, for a position whose price has not moved: funding == collateral - want.
// Constructing the threshold this way avoids guessing at index values.
func fundingToHitEquity(collateral, want *big.Int) *big.Int {
	return new(big.Int).Sub(collateral, want)
}

// indexForFunding inverts `funding = size * delta / WAD` (Quo, truncating
// toward zero) by ceiling division, so the constructed index reproduces the
// target funding exactly instead of landing a wei short of it.
func indexForFunding(size, target *big.Int) *big.Int {
	num := new(big.Int).Mul(target, WAD)
	// ceil(num / size) for positive operands.
	num.Add(num, new(big.Int).Sub(size, big.NewInt(1)))
	return num.Quo(num, size)
}

// maintenanceMargin is `size * mmrBps / 10000`, mirroring the contract.
func maintenanceMargin(p *Position, mmrBps uint64) *big.Int {
	return new(big.Int).Quo(
		new(big.Int).Mul(p.SizeUSD, new(big.Int).SetUint64(mmrBps)),
		big.NewInt(BPSDenominator),
	)
}

// TestLiquidatableAtExactlyTheFundingThreshold pins the `<=` in the verdict
// when the breach comes from funding rather than from price.
func TestLiquidatableAtExactlyTheFundingThreshold(t *testing.T) {
	p := tenXLong()
	p.EntryFundingIndex = big.NewInt(0)

	// Land equity exactly on mm (99.9 USD) via funding alone.
	target := maintenanceMargin(p, mmrBps)
	funding := fundingToHitEquity(p.CollateralUSD, target)
	idx := indexForFunding(p.SizeUSD, funding)

	if got := p.Funding(idx); got.Cmp(funding) != 0 {
		t.Fatalf("constructed funding = %s, want %s", got, funding)
	}
	if eq := p.Equity(entry180, idx); eq.Cmp(target) != 0 {
		t.Fatalf("constructed equity = %s, want %s", eq, target)
	}

	// equity == mm -> liquidatable (`<=`).
	if !p.IsLiquidatable(entry180, idx, mmrBps) {
		t.Errorf("equity exactly at mm (%s) must be liquidatable", target)
	}

	// One index wei MORE funding is a deeper breach, so still liquidatable...
	if more := new(big.Int).Add(idx, big.NewInt(1)); !p.IsLiquidatable(entry180, more, mmrBps) {
		t.Errorf("one wei more funding must stay liquidatable")
	}

	// ...and one index wei LESS funding must clear it. This is the assertion
	// with teeth: a mirror that dropped the funding term, applied it after the
	// floor, or used Div instead of Quo flips it.
	if less := new(big.Int).Sub(idx, big.NewInt(1)); p.IsLiquidatable(entry180, less, mmrBps) {
		t.Errorf("one wei less funding must NOT be liquidatable (equity %s > mm %s)",
			p.Equity(entry180, less), target)
	}
}

// The same ±1 index-wei sweep for a short. The funding term's sign flips, so a
// mirror with the side multiplier wrong passes the long case and fails this one.
func TestFundingBoundaryForAShort(t *testing.T) {
	p := tenXShort()
	p.EntryFundingIndex = big.NewInt(0)

	target := maintenanceMargin(p, mmrBps)
	funding := fundingToHitEquity(p.CollateralUSD, target) // positive = owed

	// A short PAYS when the index FALLS, so the index delta is negative.
	idx := new(big.Int).Neg(indexForFunding(p.SizeUSD, funding))

	if got := p.Funding(idx); got.Cmp(funding) != 0 {
		t.Fatalf("short funding = %s, want %s", got, funding)
	}
	if !p.IsLiquidatable(entry180, idx, mmrBps) {
		t.Errorf("short at exactly mm must be liquidatable")
	}
	if deeper := new(big.Int).Sub(idx, big.NewInt(1)); !p.IsLiquidatable(entry180, deeper, mmrBps) {
		t.Errorf("one wei further down must stay liquidatable")
	}
	if back := new(big.Int).Add(idx, big.NewInt(1)); p.IsLiquidatable(entry180, back, mmrBps) {
		t.Errorf("one wei back toward entry must clear the breach")
	}
}

// Funding is applied BEFORE the zero floor, and this is what that ordering buys.
//
// A wrong mirror that clamped collateral+pnl first and then subtracted funding
// would pay a bankrupt position its credit out of thin air: equity would come
// back as the credit itself, above the maintenance margin, and the bot would
// skip a position the contract liquidates.
//
// The magnitudes are the demo's, not a stress case: a 0.1 WAD index move on a
// 9,990 notional is 999 USD, the whole collateral.
func TestFundingIsAppliedBeforeTheZeroFloor(t *testing.T) {
	p := tenXLong()
	p.EntryFundingIndex = big.NewInt(0)

	crash := usd(90) // PnL -4995 against 999 of collateral: bankrupt before funding
	if got := p.Equity(crash, p.EntryFundingIndex); got.Sign() != 0 {
		t.Fatalf("expected a bankrupt position, got %s", got)
	}

	// A credit for a LONG is a FALLING index, so the index itself is negative
	// here: funding = +size * (index - entry) / WAD = 9990 * -0.1 = -999.
	credit := new(big.Int).Neg(wadDiv(10))
	if got, want := p.Funding(credit), new(big.Int).Neg(usd(999)); got.Cmp(want) != 0 {
		t.Fatalf("credit = %s, want %s", got, want)
	}
	if got := p.Equity(crash, credit); got.Sign() != 0 {
		t.Errorf("equity = %s, want 0: funding must be applied before the floor", got)
	}
	if !p.IsLiquidatable(crash, credit, mmrBps) {
		t.Errorf("a funding credit resurrected a bankrupt position")
	}

	// A charge (a rising index, so the long pays) keeps it at zero as well:
	// equity never goes below the floor, so the verdict cannot flip from
	// underneath either.
	charge := wadDiv(10)
	if got, want := p.Funding(charge), usd(999); got.Cmp(want) != 0 {
		t.Fatalf("charge = %s, want %s", got, want)
	}
	if got := p.Equity(crash, charge); got.Sign() != 0 {
		t.Errorf("equity under a charge = %s, want 0", got)
	}
	if !p.IsLiquidatable(crash, charge, mmrBps) {
		t.Errorf("a bankrupt position must stay liquidatable under a charge")
	}
}

// With funding zero the mirrored numbers must be bit-for-bit what they were
// before funding existed, or the 60 golden vectors from GAP-06 no longer pin
// this path.
func TestZeroFundingReproducesTheFundingFreeValue(t *testing.T) {
	p := tenXLong()
	withZero := p.LiquidationPrice(mmrBps, zeroIndex)

	if withNil := p.LiquidationPrice(mmrBps, nil); withNil.Cmp(withZero) != 0 {
		t.Errorf("nil index gives liquidation price %s, zero gives %s; they must agree", withNil, withZero)
	}
	// The hand-computed 10x long boundary the Solidity suite asserts.
	lo, hi := usd(163), usd(164)
	if withZero.Cmp(lo) <= 0 || withZero.Cmp(hi) >= 0 {
		t.Errorf("funding-free liquidation price = %s, want strictly between 163 and 164", withZero)
	}
	if got := p.Equity(usd(198), zeroIndex); got.Cmp(usd(1998)) != 0 {
		t.Errorf("funding-free equity = %s, want %s", got, usd(1998))
	}
}

// A payer is liquidated sooner; a receiver, later. Both branches move in the
// direction PerpConstants documents.
//
// The credit is deliberately small: a large enough one drives the numerator
// non-positive and the helper correctly returns 0 ("not at a positive price"),
// which would satisfy a naive `<` comparison for the wrong reason.
func TestLiquidationPriceMovesWithFunding(t *testing.T) {
	small := wadDiv(100) // 0.01 WAD

	long := tenXLong()
	base := long.LiquidationPrice(mmrBps, zeroIndex)
	if base.Sign() == 0 {
		t.Fatal("the funding-free boundary must be a real price")
	}

	paying := long.LiquidationPrice(mmrBps, small) // long pays when the index rises
	receiving := long.LiquidationPrice(mmrBps, new(big.Int).Neg(small))

	if receiving.Sign() == 0 {
		t.Fatal("a modest credit must still leave a real boundary, not the zero short-circuit")
	}
	if paying.Cmp(base) <= 0 {
		t.Errorf("a paying long's liquidation price %s must be ABOVE the funding-free %s", paying, base)
	}
	if receiving.Cmp(base) >= 0 {
		t.Errorf("a receiving long's liquidation price %s must be BELOW the funding-free %s", receiving, base)
	}

	short := tenXShort()
	sbase := short.LiquidationPrice(mmrBps, zeroIndex)
	spaying := short.LiquidationPrice(mmrBps, new(big.Int).Neg(small)) // short pays when the index falls
	if spaying.Cmp(sbase) >= 0 {
		t.Errorf("a paying short's liquidation price %s must be BELOW the funding-free %s", spaying, sbase)
	}
}

// The liquidation price must be the price at which the verdict actually flips,
// ±1 wei of PRICE, with funding non-zero. That is the property the bot relies on
// when it decides how close a position is to the line.
func TestLiquidationPriceIsExactUnderFunding(t *testing.T) {
	p := tenXLong()
	idx := index(1)

	liq := p.LiquidationPrice(mmrBps, idx)
	if liq.Sign() == 0 {
		t.Fatal("expected a non-zero liquidation price")
	}

	if !p.IsLiquidatable(liq, idx, mmrBps) {
		t.Errorf("at the funding-aware liquidation price %s the position must be liquidatable", liq)
	}
	above := new(big.Int).Add(liq, big.NewInt(1))
	if p.IsLiquidatable(above, idx, mmrBps) {
		t.Errorf("one wei of price above the funding-aware boundary (%s) must clear it", above)
	}
}

// ==================== LIQUIDATION THRESHOLD (price ±1 wei) ====================

func TestLiquidatableAtExactlyTheThreshold(t *testing.T) {
	p := tenXLong()
	liq := p.LiquidationPrice(mmrBps, zeroIndex)

	if liq.Sign() == 0 {
		t.Fatal("expected a non-zero liquidation price")
	}
	// The verdict is `equity <= mm`, so the threshold itself is liquidatable.
	if !p.IsLiquidatable(liq, zeroIndex, mmrBps) {
		t.Errorf("position at its liquidation price %s must be liquidatable", liq)
	}
}

// This is the test that actually pins the mirror down. One wei above the
// threshold the verdict must flip — if it does not, the bot and the contract
// disagree about which positions are liquidatable, and the bot burns gas on
// reverting calls.
func TestNotLiquidatableOneWeiAboveTheThreshold(t *testing.T) {
	p := tenXLong()
	liq := p.LiquidationPrice(mmrBps, zeroIndex)

	above := new(big.Int).Add(liq, big.NewInt(1))
	if p.IsLiquidatable(above, zeroIndex, mmrBps) {
		t.Errorf("one wei above the liquidation price (%s) must NOT be liquidatable", above)
	}
}

func TestLiquidatableOneWeiBelowTheThreshold(t *testing.T) {
	p := tenXLong()
	liq := p.LiquidationPrice(mmrBps, zeroIndex)

	below := new(big.Int).Sub(liq, big.NewInt(1))
	if !p.IsLiquidatable(below, zeroIndex, mmrBps) {
		t.Errorf("one wei below the liquidation price (%s) must be liquidatable", below)
	}
}

func TestLiquidationPriceForTenXLongMatchesTheContract(t *testing.T) {
	// The Solidity suite asserts ~163.80 by hand:
	//   180 * (99.9 - 999 + 9990) / 9990
	liq := tenXLong().LiquidationPrice(mmrBps, zeroIndex)

	lo, hi := usd(163), usd(164)
	if liq.Cmp(lo) <= 0 || liq.Cmp(hi) >= 0 {
		t.Errorf("10x long liquidation price = %s, want it strictly between 163 and 164 USD", liq)
	}
}

func TestLiquidationPriceForShortSitsAboveEntry(t *testing.T) {
	liq := tenXShort().LiquidationPrice(mmrBps, zeroIndex)
	if liq.Cmp(entry180) <= 0 {
		t.Errorf("short liquidation price %s must be above the entry %s", liq, entry180)
	}
}

func TestOneXPositionIsLiquidatableOnlyNearZero(t *testing.T) {
	// At 1x, collateral equals size, so mm = size/100 is covered by collateral
	// alone until the price almost halves. Guards against the numerator going
	// non-positive and the helper silently returning 0.
	p := &Position{
		CollateralUSD: usd(1000),
		SizeUSD:       usd(1000),
		EntryPrice:    usd(100),
		IsLong:        true,
	}
	if p.IsLiquidatable(usd(50), zeroIndex, mmrBps) {
		t.Error("1x long should survive a 50% drop")
	}
	if !p.IsLiquidatable(usd(1), zeroIndex, mmrBps) {
		t.Error("1x long should be liquidatable near zero")
	}
}

// ==================== TABLE ====================

func TestTableApplyOpenAndClose(t *testing.T) {
	tbl := NewTable()
	p := tenXLong()
	tbl.ApplyOpen(p)

	if tbl.Len() != 1 {
		t.Fatalf("Len = %d, want 1", tbl.Len())
	}
	if got, ok := tbl.Get(p.ID); !ok || got != p {
		t.Fatal("Get did not return the stored position")
	}

	tbl.ApplyClose(p.ID)
	if tbl.Len() != 0 {
		t.Errorf("Len after close = %d, want 0", tbl.Len())
	}
}

// ApplyFundingIndex must copy. A shared *big.Int that mutates under the scanner
// would be invisible mirror drift, which is the failure mode this package
// exists to prevent.
func TestApplyFundingIndexCopies(t *testing.T) {
	tbl := NewTable()
	src := index(3)
	tbl.ApplyFundingIndex("NVDA", src)

	src.SetInt64(999) // the event decoder may reuse its buffer

	tbl.mu.RLock()
	stored := tbl.funding["NVDA"]
	tbl.mu.RUnlock()

	if stored.Cmp(index(3)) != 0 {
		t.Errorf("stored index = %s, want %s (the caller's buffer must not be shared)", stored, index(3))
	}
}

// A nil index is "no observation", not "the index is zero": accepting it would
// erase a real reading and silently revert the verdict to funding-free.
func TestApplyFundingIndexIgnoresNil(t *testing.T) {
	tbl := NewTable()
	tbl.ApplyFundingIndex("NVDA", index(7))
	tbl.ApplyFundingIndex("NVDA", nil)

	tbl.mu.RLock()
	stored, ok := tbl.funding["NVDA"]
	tbl.mu.RUnlock()

	if !ok || stored.Cmp(index(7)) != 0 {
		t.Errorf("nil overwrote a real observation: ok=%v value=%v", ok, stored)
	}
}

// An unobserved feed must produce the funding-free verdict, not a panic and not
// an invented index. This is the state a bot is in before it has backfilled a
// feed, so it is a real state, not a corner case.
func TestUnobservedFeedScansAsFundingFree(t *testing.T) {
	tbl := NewTable()
	p := tenXLong()
	p.FeedID = "NVDA"
	tbl.ApplyOpen(p)

	// A price that does NOT breach on its own (the boundary is ~163.8).
	lookup := func(string) (*big.Int, bool) { return usd(170), true }
	batches, skipped := tbl.Scan(mmrBps, lookup)

	if len(skipped) != 0 {
		t.Fatalf("skipped = %v, want none", skipped)
	}
	if len(batches) != 0 {
		t.Errorf("no observed index must read as funding-free, got %+v", batches)
	}
}

// Backfill and the live subscription can both deliver the same close, so a
// duplicate must not corrupt the table.
func TestApplyCloseIsIdempotent(t *testing.T) {
	tbl := NewTable()
	tbl.ApplyOpen(tenXLong())

	tbl.ApplyClose(1)
	tbl.ApplyClose(1)
	tbl.ApplyClose(999) // never seen

	if tbl.Len() != 0 {
		t.Errorf("Len = %d, want 0", tbl.Len())
	}
}

func TestSnapshotIsOrderedByID(t *testing.T) {
	tbl := NewTable()
	for _, id := range []uint64{3, 1, 2} {
		p := tenXLong()
		p.ID = id
		tbl.ApplyOpen(p)
	}

	got := tbl.Snapshot()
	for i, p := range got {
		if p.ID != uint64(i+1) {
			t.Fatalf("snapshot[%d].ID = %d, want %d", i, p.ID, i+1)
		}
	}
}

// The table is read by the price loop while the event subscription writes to
// it, so it must be safe under -race. The funding index map is written by the
// same subscription and read by the same scan, so it is exercised here too.
func TestTableIsConcurrencySafe(t *testing.T) {
	tbl := NewTable()
	var wg sync.WaitGroup

	for w := 0; w < 8; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				id := uint64(i)
				p := tenXLong()
				p.ID = id
				tbl.ApplyOpen(p)
				tbl.ApplyFundingIndex("NVDA", big.NewInt(int64(i)))
				_ = tbl.Snapshot()
				tbl.Scan(mmrBps, func(string) (*big.Int, bool) { return usd(180), true })
				tbl.ApplyClose(id)
			}
		}(w)
	}
	wg.Wait()
}

// ==================== BATCH SCAN ====================

func TestScanGroupsByFeed(t *testing.T) {
	tbl := NewTable()
	for i, feed := range []string{"NVDA", "BTC", "NVDA"} {
		p := tenXLong()
		p.ID = uint64(i + 1)
		p.FeedID = feed
		tbl.ApplyOpen(p)
	}

	// Both feeds crash hard enough to liquidate everything.
	lookup := func(string) (*big.Int, bool) { return usd(50), true }
	batches, skipped := tbl.Scan(mmrBps, lookup)

	if len(skipped) != 0 {
		t.Fatalf("skipped = %v, want none", skipped)
	}
	if len(batches) != 2 {
		t.Fatalf("got %d batches, want 2 (one per feed)", len(batches))
	}
	// Deterministic order: BTC before NVDA.
	if batches[0].FeedID != "BTC" || batches[1].FeedID != "NVDA" {
		t.Errorf("batch order = %s,%s; want BTC,NVDA", batches[0].FeedID, batches[1].FeedID)
	}
	if len(batches[1].PositionIDs) != 2 {
		t.Errorf("NVDA batch has %d ids, want 2", len(batches[1].PositionIDs))
	}
	// Every position in one call is valued against this single snapshot.
	if batches[1].MarkPrice.Cmp(usd(50)) != 0 {
		t.Errorf("batch mark price = %s, want %s", batches[1].MarkPrice, usd(50))
	}
}

func TestScanLeavesHealthyPositionsAlone(t *testing.T) {
	tbl := NewTable()
	tbl.ApplyOpen(tenXLong())

	// Price barely moved; the 10x long's threshold is ~163.8.
	lookup := func(string) (*big.Int, bool) { return usd(180), true }
	batches, _ := tbl.Scan(mmrBps, lookup)

	if len(batches) != 0 {
		t.Errorf("got %d batches for a healthy position, want 0", len(batches))
	}
}

// A feed with no price must be reported, not treated as "not liquidatable".
// Silently skipping would make a stalled oracle look like a healthy book.
func TestScanReportsPositionsWithNoPrice(t *testing.T) {
	tbl := NewTable()
	a, b := tenXLong(), tenXLong()
	a.ID, a.FeedID = 1, "NVDA"
	b.ID, b.FeedID = 2, "UNKNOWN"
	tbl.ApplyOpen(a)
	tbl.ApplyOpen(b)

	lookup := func(feed string) (*big.Int, bool) {
		if feed == "NVDA" {
			return usd(50), true
		}
		return nil, false
	}
	batches, skipped := tbl.Scan(mmrBps, lookup)

	if len(skipped) != 1 || skipped[0] != 2 {
		t.Errorf("skipped = %v, want [2]", skipped)
	}
	if len(batches) != 1 || batches[0].FeedID != "NVDA" {
		t.Errorf("batches = %+v, want one NVDA batch", batches)
	}
}

// The price lookup must be called once per distinct feed per scan, not once per
// position. At 20 positions across 3 feeds that is 3 oracle reads, not 20.
func TestScanResolvesEachFeedOnce(t *testing.T) {
	tbl := NewTable()
	for i := 0; i < 10; i++ {
		p := tenXLong()
		p.ID = uint64(i + 1)
		p.FeedID = "NVDA"
		tbl.ApplyOpen(p)
	}

	calls := 0
	lookup := func(string) (*big.Int, bool) {
		calls++
		return usd(50), true
	}
	tbl.Scan(mmrBps, lookup)

	if calls != 1 {
		t.Errorf("price lookup called %d times for 10 positions on 1 feed, want 1", calls)
	}
}

// ==================== SCAN WITH FUNDING ====================

// This is the end-to-end version of GAP-41: a book that is healthy on price
// alone, driven through its maintenance margin by cost of carry, must be picked
// up by Scan. Before the fix this returned zero batches.
func TestScanPicksUpAPositionFundingPushedThroughTheMargin(t *testing.T) {
	tbl := NewTable()

	p := tenXLong() // 999 collateral, size 9990, entry 180, long
	p.EntryFundingIndex = index(100)
	tbl.ApplyOpen(p)

	// mm = 99.9; needs funding >= 899.1 for the index to breach it.
	// indexForFunding inverts the truncation so this lands exactly on mm.
	funding := fundingToHitEquity(p.CollateralUSD, maintenanceMargin(p, mmrBps))
	now := new(big.Int).Add(p.EntryFundingIndex, indexForFunding(p.SizeUSD, funding))
	tbl.ApplyFundingIndex(p.FeedID, now)

	// The price has not moved at all.
	atEntry := func(string) (*big.Int, bool) { return entry180, true }

	batches, skipped := tbl.Scan(mmrBps, atEntry)
	if len(skipped) != 0 {
		t.Fatalf("skipped = %v, want none (the price is available)", skipped)
	}
	if len(batches) != 1 || len(batches[0].PositionIDs) != 1 || batches[0].PositionIDs[0] != p.ID {
		t.Fatalf("batches = %+v, want the single position liquidated on funding alone", batches)
	}

	// Negative control: with the same position but no observed index, the
	// funding term is absent and the verdict flips back. Without this, the test
	// above would pass on a stale reason (e.g. the price actually breaching).
	blind := NewTable()
	blindP := tenXLong()
	blindP.EntryFundingIndex = index(100)
	blind.ApplyOpen(blindP) // note: no ApplyFundingIndex

	blindBatches, _ := blind.Scan(mmrBps, atEntry)
	if len(blindBatches) != 0 {
		t.Errorf("no observed index must read as funding-free (0 batches), got %+v", blindBatches)
	}
}

// A feed's index must reach only the positions on that feed. A table that keyed
// the index globally would liquidate every other feed's book.
func TestScanFundingIsPerFeed(t *testing.T) {
	tbl := NewTable()

	long := tenXLong()
	long.ID, long.FeedID = 1, "NVDA"
	long.EntryFundingIndex = big.NewInt(0)

	other := tenXLong()
	other.ID, other.FeedID = 2, "BTC"
	other.EntryFundingIndex = big.NewInt(0)

	tbl.ApplyOpen(long)
	tbl.ApplyOpen(other)

	// Push NVDA's index far past its maintenance margin.
	funding := fundingToHitEquity(long.CollateralUSD, maintenanceMargin(long, mmrBps))
	tbl.ApplyFundingIndex("NVDA", indexForFunding(long.SizeUSD, funding))

	// BTC is left with no observation at all.
	lookup := func(string) (*big.Int, bool) { return entry180, true }
	batches, _ := tbl.Scan(mmrBps, lookup)

	if len(batches) != 1 || batches[0].FeedID != "NVDA" {
		t.Fatalf("batches = %+v, want only NVDA", batches)
	}
	if len(batches[0].PositionIDs) != 1 || batches[0].PositionIDs[0] != 1 {
		t.Errorf("NVDA batch ids = %v, want [1]", batches[0].PositionIDs)
	}
}

// ==================== BENCHMARKS ====================

func BenchmarkPositionPnL(b *testing.B) {
	long := tenXLong()
	mark := usd(198)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = long.PnL(mark)
	}
}

func BenchmarkTableScan(b *testing.B) {
	tbl := NewTable()
	feeds := []string{"NVDA", "AAPL", "BTC", "ETH", "SOL"}
	// Populate 500 positions across 5 feeds
	for i := 0; i < 500; i++ {
		p := tenXLong()
		p.ID = uint64(i + 1)
		p.FeedID = feeds[i%len(feeds)]
		tbl.ApplyOpen(p)
	}

	prices := map[string]*big.Int{
		"NVDA": usd(50),  // liquidated
		"AAPL": usd(200), // healthy
		"BTC":  usd(150), // borderline
		"ETH":  usd(180), // at entry
		"SOL":  usd(30),  // liquidated
	}
	lookup := func(feed string) (*big.Int, bool) {
		p, ok := prices[feed]
		return p, ok
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = tbl.Scan(mmrBps, lookup)
	}
}
