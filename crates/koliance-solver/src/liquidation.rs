//! High-precision zero-drift liquidation engine matching `PositionManager.sol` and `src/lib/perp.ts`.

use ethnum::{I256, U256};
use crate::types::{
    Position, BPS_DENOMINATOR, CLOSE_FEE_BPS, LIQUIDATOR_REWARD_BPS,
    MAINTENANCE_MARGIN_BPS, MAX_PROFIT_BPS, OPEN_FEE_BPS,
};

/// Applies basis point scaling: `(val * bps) / 10_000`.
#[inline(always)]
pub fn apply_bps(val: U256, bps: U256) -> U256 {
    (val * bps) / BPS_DENOMINATOR
}

/// Notional size in USD: `collateral * leverage`.
#[inline(always)]
pub fn position_size_usd(p: &Position) -> U256 {
    apply_bps(p.collateral_usd, p.leverage_bps)
}

/// Net collateral after open fee: `gross - (gross * 10 / 10_000)`.
#[inline(always)]
pub fn net_collateral_usd(gross_usd: U256) -> U256 {
    gross_usd - apply_bps(gross_usd, OPEN_FEE_BPS)
}

/// Maximum payout cap for a position in 18-decimal USD.
#[inline(always)]
pub fn payout_cap_usd(p: &Position) -> U256 {
    p.collateral_usd + apply_bps(position_size_usd(p), MAX_PROFIT_BPS)
}

/// Unrealized PnL at mark price in 18-decimal USD.
/// long : size * (mark - entry) / entry
/// short: size * (entry - mark) / entry
pub fn unrealized_pnl(p: &Position, mark_price: U256) -> I256 {
    let size = position_size_usd(p);
    if size == U256::ZERO || p.entry_price == U256::ZERO {
        return I256::ZERO;
    }

    let (delta, is_positive) = if p.is_long {
        if mark_price >= p.entry_price {
            (mark_price - p.entry_price, true)
        } else {
            (p.entry_price - mark_price, false)
        }
    } else {
        if p.entry_price >= mark_price {
            (p.entry_price - mark_price, true)
        } else {
            (mark_price - p.entry_price, false)
        }
    };

    let pnl_magnitude = (size * delta) / p.entry_price;
    if is_positive {
        i256_from_u256(pnl_magnitude)
    } else {
        -i256_from_u256(pnl_magnitude)
    }
}

/// Liquidation price including accrued funding owed.
/// Bit-for-bit exact parity with `PositionManager._isLiquidatable`.
///
/// Long formula:  P = entry * (mm - collateral + funding + size) / size
/// Short formula: P = entry * (collateral + size - mm - funding) / size
pub fn liquidation_price_with_funding(p: &Position, funding_owed_usd: I256) -> U256 {
    let size = position_size_usd(p);
    if size == U256::ZERO {
        return U256::ZERO;
    }
    let mm = apply_bps(size, MAINTENANCE_MARGIN_BPS);

    if p.is_long {
        let num_terms = i256_from_u256(mm) - i256_from_u256(p.collateral_usd) + funding_owed_usd + i256_from_u256(size);
        if num_terms <= 0 {
            return U256::ZERO;
        }
        let numerator = u256_from_positive_i256(num_terms);
        (p.entry_price * numerator) / size
    } else {
        let num_terms = i256_from_u256(p.collateral_usd) + i256_from_u256(size) - i256_from_u256(mm) - funding_owed_usd;
        if num_terms <= 0 {
            return U256::ZERO;
        }
        let numerator = u256_from_positive_i256(num_terms);
        (p.entry_price * numerator) / size
    }
}

/// Liquidation price ignoring funding (cost of carry = 0).
#[inline(always)]
pub fn liquidation_price(p: &Position) -> U256 {
    liquidation_price_with_funding(p, I256::ZERO)
}

/// Equity including collateral, PnL, and funding, floored at zero.
pub fn equity_with_funding(collateral_usd: U256, pnl: I256, funding: I256) -> U256 {
    let total = i256_from_u256(collateral_usd) + pnl - funding;
    if total <= 0 {
        U256::ZERO
    } else {
        u256_from_positive_i256(total)
    }
}

/// Evaluates if position is liquidatable at `mark_price` with `funding_owed_usd`.
pub fn is_liquidatable_with_funding(
    p: &Position,
    mark_price: U256,
    funding_owed_usd: I256,
) -> bool {
    let size = position_size_usd(p);
    if size == U256::ZERO {
        return false;
    }
    let pnl = unrealized_pnl(p, mark_price);
    let equity = equity_with_funding(p.collateral_usd, pnl, funding_owed_usd);
    let mm = apply_bps(size, MAINTENANCE_MARGIN_BPS);
    equity <= mm
}

/// Evaluates if position is liquidatable without funding.
pub fn is_liquidatable(p: &Position, mark_price: U256) -> bool {
    is_liquidatable_with_funding(p, mark_price, I256::ZERO)
}

/// Liquidator bounty: 5% of collateral.
#[inline(always)]
pub fn liquidation_reward(collateral_usd: U256) -> U256 {
    apply_bps(collateral_usd, LIQUIDATOR_REWARD_BPS)
}

/// Entry fee on position open.
#[inline(always)]
pub fn open_fee(collateral_usd: U256) -> U256 {
    apply_bps(collateral_usd, OPEN_FEE_BPS)
}

/// Close fee on position close.
#[inline(always)]
pub fn close_fee(collateral_usd: U256) -> U256 {
    apply_bps(collateral_usd, CLOSE_FEE_BPS)
}

// -----------------------------------------------------------------------------
// Internal conversions
// -----------------------------------------------------------------------------

#[inline(always)]
fn i256_from_u256(val: U256) -> I256 {
    let bytes = val.to_be_bytes();
    I256::from_be_bytes(bytes)
}

#[inline(always)]
fn u256_from_positive_i256(val: I256) -> U256 {
    let bytes = val.to_be_bytes();
    U256::from_be_bytes(bytes)
}
