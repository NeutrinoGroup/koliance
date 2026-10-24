//! Accrued per-block funding rate calculations matching `PositionManager.sol`.

use ethnum::{I256, U256};
use crate::types::{FundingMath, WAD};

/// Signed open-interest skew in WAD: `(long - short) * WAD / (long + short)`.
pub fn funding_skew_wad(long_oi_usd: U256, short_oi_usd: U256) -> I256 {
    let total = long_oi_usd + short_oi_usd;
    if total == U256::ZERO {
        return I256::ZERO;
    }

    if long_oi_usd >= short_oi_usd {
        let diff = long_oi_usd - short_oi_usd;
        let num = (diff * WAD) / total;
        i256_from_u256(num)
    } else {
        let diff = short_oi_usd - long_oi_usd;
        let num = (diff * WAD) / total;
        -i256_from_u256(num)
    }
}

/// Per-block index delta for `elapsed` blocks at `rate_per_block_wad`.
/// Exact Solidity order of operations: `(elapsed * rate * skew) / WAD`.
pub fn funding_delta_wad(elapsed: U256, rate_per_block_wad: U256, skew_wad: I256) -> I256 {
    if skew_wad == 0 || elapsed == U256::ZERO || rate_per_block_wad == U256::ZERO {
        return I256::ZERO;
    }

    let elapsed_rate = elapsed * rate_per_block_wad;
    let elapsed_rate_i = i256_from_u256(elapsed_rate);
    let wad_i = i256_from_u256(WAD);
    (elapsed_rate_i * skew_wad) / wad_i
}

/// Funding owed by a position, positive meaning the trader pays.
/// Mirrors `PositionManager._fundingFor`.
pub fn funding_owed(p: &FundingMath, index_now: I256) -> I256 {
    let delta = index_now - p.entry_funding_index;
    if delta == 0 || p.size_usd == U256::ZERO {
        return I256::ZERO;
    }

    let size_i = i256_from_u256(p.size_usd);
    let signed_size = if p.is_long { size_i } else { -size_i };
    let wad_i = i256_from_u256(WAD);
    (signed_size * delta) / wad_i
}

#[inline(always)]
fn i256_from_u256(val: U256) -> I256 {
    let bytes = val.to_be_bytes();
    I256::from_be_bytes(bytes)
}
