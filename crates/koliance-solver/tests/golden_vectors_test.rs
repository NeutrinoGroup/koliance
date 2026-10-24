use ethnum::{I256, U256};
use koliance_solver::{
    build_domain_separator, delegation_digest, hash_delegation,
    liquidation_price, liquidation_price_with_funding, net_collateral_usd,
    verify_delegation_limits, DelegationTerms, Position,
};
use serde::Deserialize;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Deserialize)]
struct GoldenVectorFile {
    vectors: Vec<VectorItem>,
}

#[derive(Deserialize)]
struct VectorItem {
    #[serde(rename = "leverageBps")]
    leverage_bps: String,
    #[serde(rename = "collateralUsdc")]
    collateral_usdc: String,
    #[serde(rename = "entryPrice")]
    entry_price: String,
    #[serde(rename = "isLong")]
    is_long: bool,
    #[serde(rename = "liqPrice")]
    liq_price: String,
}

#[derive(Deserialize)]
struct FundingVectorFile {
    vectors: Vec<FundingVectorItem>,
}

#[derive(Deserialize)]
struct FundingVectorItem {
    #[serde(rename = "leverageBps")]
    leverage_bps: String,
    #[serde(rename = "collateralUsdc")]
    collateral_usdc: String,
    #[serde(rename = "entryPrice")]
    entry_price: String,
    #[serde(rename = "isLong")]
    is_long: bool,
    #[serde(rename = "fundingOwedUsd")]
    funding_owed_usd: String,
    #[serde(rename = "liqPrice")]
    liq_price: String,
}

#[test]
fn test_all_60_golden_liquidation_vectors() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let fixture_path = Path::new(manifest_dir)
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("contracts/test/perp/fixtures/liquidation-vectors.json");

    assert!(fixture_path.exists(), "liquidation-vectors.json fixture must exist");

    let file = File::open(&fixture_path).expect("open vector file");
    let reader = BufReader::new(file);
    let parsed: GoldenVectorFile = serde_json::from_reader(reader).expect("parse JSON");

    assert_eq!(parsed.vectors.len(), 60, "expected exactly 60 golden vectors");

    for (idx, v) in parsed.vectors.iter().enumerate() {
        let c_usdc: u128 = v.collateral_usdc.parse().expect("valid collateral");
        let gross_usd = U256::from(c_usdc) * U256::new(1_000_000_000_000_000_000);
        let collateral_usd = net_collateral_usd(gross_usd);

        let entry_price: U256 = v.entry_price.parse().expect("valid entry price");
        let leverage_bps: U256 = v.leverage_bps.parse().expect("valid leverage bps");
        let expected_liq: U256 = v.liq_price.parse().expect("valid liq price");

        let pos = Position {
            collateral_usd,
            entry_price,
            leverage_bps,
            is_long: v.is_long,
        };

        let computed_liq = liquidation_price(&pos);

        assert_eq!(
            computed_liq, expected_liq,
            "Vector #{}: mismatch for lev={} c={} isLong={}",
            idx, v.leverage_bps, v.collateral_usdc, v.is_long
        );
    }
}

#[test]
fn test_all_24_funding_liquidation_vectors() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let fixture_path = Path::new(manifest_dir)
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("contracts/test/perp/fixtures/liquidation-funding-vectors.json");

    assert!(fixture_path.exists(), "liquidation-funding-vectors.json fixture must exist");

    let file = File::open(&fixture_path).expect("open vector file");
    let reader = BufReader::new(file);
    let parsed: FundingVectorFile = serde_json::from_reader(reader).expect("parse JSON");

    assert_eq!(parsed.vectors.len(), 24, "expected exactly 24 funding vectors");

    for (idx, v) in parsed.vectors.iter().enumerate() {
        let c_usdc: u128 = v.collateral_usdc.parse().expect("valid collateral");
        let gross_usd = U256::from(c_usdc) * U256::new(1_000_000_000_000_000_000);
        let collateral_usd = net_collateral_usd(gross_usd);

        let entry_price: U256 = v.entry_price.parse().expect("valid entry price");
        let leverage_bps: U256 = v.leverage_bps.parse().expect("valid leverage bps");
        let funding_owed: I256 = v.funding_owed_usd.parse().expect("valid funding owed");
        let expected_liq: U256 = v.liq_price.parse().expect("valid liq price");

        let pos = Position {
            collateral_usd,
            entry_price,
            leverage_bps,
            is_long: v.is_long,
        };

        let computed_liq = liquidation_price_with_funding(&pos, funding_owed);

        assert_eq!(
            computed_liq, expected_liq,
            "Funding Vector #{}: mismatch for lev={} c={} isLong={}",
            idx, v.leverage_bps, v.collateral_usdc, v.is_long
        );
    }
}

#[test]
fn test_eip712_delegation_hashing() {
    let chain_id = U256::new(10143); // Monad testnet
    let verifying_contract = [0x42u8; 20];

    let domain_sep = build_domain_separator(chain_id, verifying_contract);
    assert_ne!(domain_sep, [0u8; 32]);

    let terms = DelegationTerms {
        user: [0x11u8; 20],
        agent: [0x22u8; 20],
        session_key: [0x33u8; 20],
        max_spend_per_tx: U256::new(50_000_000), // 50 USDC
        daily_spend_limit: U256::new(200_000_000), // 200 USDC
        max_tx_per_window: 10,
        tx_window_seconds: 60,
        valid_until: 1800000000,
        nonce: 1,
    };

    let struct_hash = hash_delegation(&terms);
    assert_ne!(struct_hash, [0u8; 32]);

    let digest = delegation_digest(domain_sep, struct_hash);
    assert_ne!(digest, [0u8; 32]);

    // Test limits verification
    assert!(verify_delegation_limits(&terms, 1700000000, U256::new(30_000_000), U256::new(50_000_000)).is_ok());
    assert!(verify_delegation_limits(&terms, 1900000000, U256::new(30_000_000), U256::new(50_000_000)).is_err()); // expired
    assert!(verify_delegation_limits(&terms, 1700000000, U256::new(60_000_000), U256::new(50_000_000)).is_err()); // exceeds maxPerTx
    assert!(verify_delegation_limits(&terms, 1700000000, U256::new(30_000_000), U256::new(180_000_000)).is_err()); // exceeds daily
}
