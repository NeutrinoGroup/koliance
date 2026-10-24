//! Canonical types and constants for Koliance Perp and SessionKey delegation.
//! Bit-for-bit parity with `PerpConstants.sol` and `SessionKeyRegistry.sol`.

use ethnum::{I256, U256};
use serde::{Deserialize, Serialize};

/// Basis point denominator (100% = 10,000 bps).
pub const BPS_DENOMINATOR: U256 = U256::new(10_000);

/// 0.1% charged on open, deducted from collateral and paid into the Vault.
pub const OPEN_FEE_BPS: U256 = U256::new(10);

/// 0.1% charged on close.
pub const CLOSE_FEE_BPS: U256 = U256::new(10);

/// 1% maintenance margin threshold (100 bps).
pub const MAINTENANCE_MARGIN_BPS: U256 = U256::new(100);

/// 5% of position's collateral paid to the liquidator (500 bps).
pub const LIQUIDATOR_REWARD_BPS: U256 = U256::new(500);

/// Profit ceiling in bps (10,000 bps = 100% notional).
pub const MAX_PROFIT_BPS: U256 = U256::new(10_000);

/// 50x ceiling (500,000 bps).
pub const MAX_LEVERAGE_BPS: U256 = U256::new(500_000);

/// 1x floor (10,000 bps).
pub const MIN_LEVERAGE_BPS: U256 = U256::new(10_000);

/// Standard 18-decimal fixed-point scale (1 WAD = 10^18).
pub const WAD: U256 = U256::new(1_000_000_000_000_000_000);

/// 6-decimal fixed-point scale for USDC (10^6).
pub const USDC_SCALE: U256 = U256::new(1_000_000);

/// Perp position representation for zero-drift margin and liquidation math.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
    /// Net collateral in 18-decimal USD (after open fee).
    pub collateral_usd: U256,
    /// Entry price in 18-decimal USD.
    pub entry_price: U256,
    /// Leverage in basis points (e.g. 10_000 for 1x, 500_000 for 50x).
    pub leverage_bps: U256,
    /// Position direction: true for Long, false for Short.
    pub is_long: bool,
}

impl Position {
    pub fn new(collateral_usd: U256, entry_price: U256, leverage_bps: U256, is_long: bool) -> Self {
        Self {
            collateral_usd,
            entry_price,
            leverage_bps,
            is_long,
        }
    }
}

/// Accrued funding terms for a position.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct FundingMath {
    pub size_usd: U256,
    pub is_long: bool,
    pub entry_funding_index: I256,
}

/// EIP-712 Agent delegation parameters committed by user signature.
/// Mirrors `SessionKeyRegistry.DelegationTerms`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DelegationTerms {
    pub user: [u8; 20],
    pub agent: [u8; 20],
    pub session_key: [u8; 20],
    pub max_spend_per_tx: U256,
    pub daily_spend_limit: U256,
    pub max_tx_per_window: u64,
    pub tx_window_seconds: u64,
    pub valid_until: u64,
    pub nonce: u64,
}

impl DelegationTerms {
    pub fn parse_address(addr_hex: &str) -> Result<[u8; 20], String> {
        let clean = addr_hex.trim_start_matches("0x");
        if clean.len() != 40 {
            return Err(format!("Invalid address length: expected 40 hex chars, got {}", clean.len()));
        }
        let bytes = hex::decode(clean).map_err(|e| format!("Invalid hex: {}", e))?;
        let mut out = [0u8; 20];
        out.copy_from_slice(&bytes);
        Ok(out)
    }
}
