//! # Koliance High-Performance Settlement & Parity Engine
//!
//! Ultra-low latency liquidation parity solver and EIP-712 session key validator
//! for Koliance on Monad.
//!
//! Enforces zero-truncation parity with `PositionManager.sol` and `SessionKeyRegistry.sol`.

pub mod types;
pub mod liquidation;
pub mod funding;
pub mod eip712;
pub mod im_engine;

pub use types::*;
pub use liquidation::*;
pub use funding::*;
pub use eip712::*;
pub use im_engine::*;

pub fn solver_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants_match() {
        assert_eq!(BPS_DENOMINATOR, ethnum::U256::new(10_000));
        assert_eq!(MAINTENANCE_MARGIN_BPS, ethnum::U256::new(100));
        assert_eq!(LIQUIDATOR_REWARD_BPS, ethnum::U256::new(500));
    }

    #[test]
    fn test_eip712_typehash_validity() {
        let domain_hash = keccak256(DOMAIN_TYPE_STRING);
        let delegation_hash = keccak256(AGENT_DELEGATION_TYPE_STRING);
        assert_ne!(domain_hash, [0u8; 32]);
        assert_ne!(delegation_hash, [0u8; 32]);
    }
}
