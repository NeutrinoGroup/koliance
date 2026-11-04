use clap::{Parser, Subcommand};
use ethnum::U256;
use koliance_solver::{
    build_domain_separator, delegation_digest, hash_delegation, liquidation_price,
    net_collateral_usd, solver_version, DelegationTerms, Position,
};
use serde::Deserialize;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Parser)]
#[command(name = "koliance-solver")]
#[command(about = "Koliance High-Performance Settlement & Parity Engine", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Replay and verify bit-for-bit liquidation parity against golden vectors
    VerifyVectors {
        /// Path to liquidation vectors JSON file
        #[arg(short, long, default_value = "contracts/test/perp/fixtures/liquidation-vectors.json")]
        path: PathBuf,
    },
    /// Benchmark raw liquidation calculation throughput (million ops/sec)
    Benchmark {
        /// Number of iterations
        #[arg(short, long, default_value_t = 1_000_000)]
        iterations: usize,
    },
    /// Generate sample EIP-712 domain separator, struct hash, and delegation digest
    Eip712Digest {
        /// Chain ID (default: 10143 for Monad testnet)
        #[arg(short, long, default_value = "10143")]
        chain_id: String,
        /// Registry contract address
        #[arg(long, default_value = "0x89b0b4676C7598816c8028f804791E44910cf947")]
        registry: String,
    },
    /// Benchmark real-time IM message sync and deduplication throughput
    ImBenchmark {
        /// Number of messages
        #[arg(short, long, default_value_t = 1_000_000)]
        iterations: usize,
    },
    /// Display active solver version and build metadata
    Version,
}

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

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Version => {
            println!("[INFO] Koliance Settlement Engine v{}", solver_version());
        }
        Commands::VerifyVectors { path } => {
            println!("[INFO] Loading golden vectors from: {}", path.display());
            let file = match File::open(&path) {
                Ok(f) => f,
                Err(e) => {
                    eprintln!("[ERROR] Failed to open vector file: {}", e);
                    std::process::exit(1);
                }
            };

            let reader = BufReader::new(file);
            let parsed: GoldenVectorFile = match serde_json::from_reader(reader) {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("[ERROR] Failed to parse JSON: {}", e);
                    std::process::exit(1);
                }
            };

            println!("[INFO] Replaying {} golden vectors through Rust liquidation solver...", parsed.vectors.len());
            let mut matched = 0;
            let mut failed = 0;

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

                if computed_liq == expected_liq {
                    matched += 1;
                } else {
                    failed += 1;
                    eprintln!(
                        "[FAIL] Vector #{}: lev={} c={} isLong={} -> computed={}, expected={}",
                        idx, v.leverage_bps, v.collateral_usdc, v.is_long, computed_liq, expected_liq
                    );
                }
            }

            if failed == 0 {
                println!("[SUCCESS] All {} vectors verified with 100% bit-for-bit parity! Zero truncation drift.", matched);
            } else {
                eprintln!("[ERROR] {}/{} vectors failed parity verification!", failed, parsed.vectors.len());
                std::process::exit(1);
            }
        }
        Commands::Benchmark { iterations } => {
            println!("[INFO] Running benchmark for {} liquidation evaluations...", iterations);
            let pos = Position {
                collateral_usd: net_collateral_usd(U256::new(100) * U256::new(1_000_000_000_000_000_000)),
                entry_price: U256::new(200) * U256::new(1_000_000_000_000_000_000),
                leverage_bps: U256::new(100_000), // 10x
                is_long: true,
            };

            let start = Instant::now();
            let mut dummy = U256::ZERO;
            for _ in 0..iterations {
                dummy += liquidation_price(&pos);
            }
            let elapsed = start.elapsed();

            let ns_per_op = elapsed.as_nanos() as f64 / iterations as f64;
            let ops_per_sec = (iterations as f64 / elapsed.as_secs_f64()) / 1_000_000.0;

            println!("[OK] Benchmark completed in {:?}", elapsed);
            println!("[INFO] Latency per evaluation: {:.2} ns", ns_per_op);
            println!("[INFO] Throughput: {:.2} Million ops/sec (Checksum: {:x})", ops_per_sec, dummy);
        }
        Commands::Eip712Digest { chain_id, registry } => {
            let cid: U256 = chain_id.parse().expect("valid chain id");
            let reg_addr = DelegationTerms::parse_address(&registry).expect("valid registry address");
            let domain_sep = build_domain_separator(cid, reg_addr);

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
            let digest = delegation_digest(domain_sep, struct_hash);

            println!("[INFO] EIP-712 Domain Separator: 0x{}", hex::encode(domain_sep));
            println!("[INFO] AgentDelegation Struct Hash: 0x{}", hex::encode(struct_hash));
            println!("[SUCCESS] Full Signing Digest: 0x{}", hex::encode(digest));
        }
        Commands::ImBenchmark { iterations } => {
            println!("[INFO] Running IM real-time sync benchmark for {} messages...", iterations);
            let mut hub = koliance_solver::ImSyncHub::new(10_000);
            let start = Instant::now();

            for i in 0..iterations {
                let sender = "0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7";
                let recipient = "0x6b6b83ff4e1f8009b9dbe6f46ad4e75f33f98a0290";
                let content = "Hello from high-concurrency Monad IM channel";
                let _ = hub.ingest_message(sender, recipient, "TEXT", content, i as u64);
            }

            let elapsed = start.elapsed();
            let ns_per_msg = elapsed.as_nanos() as f64 / iterations as f64;
            let msgs_per_sec = (iterations as f64 / elapsed.as_secs_f64()) / 1_000_000.0;

            println!("[OK] IM sync benchmark completed in {:?}", elapsed);
            println!("[INFO] Latency per message ingest & deduplication: {:.2} ns", ns_per_msg);
            println!("[INFO] Throughput: {:.2} Million messages/sec (Capacity: {})", msgs_per_sec, hub.total_messages());
        }
    }
}
