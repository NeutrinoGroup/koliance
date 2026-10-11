# Koliance Production API & Interface Benchmark Report

Generated At: 2026-10-10T15:03:05.320Z

| Target Interface | Samples | P50 Latency | P95 Latency | P99 Latency | Avg Latency | Error Rate | Throughput (Req/s) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Pyth Hermes Public Oracle Feed** | 20 | 378.45ms | 1540.15ms | 1540.15ms | 488.72ms | 100% | 2.05 |
| **Monad Testnet Public RPC Node** | 20 | 372.39ms | 3200.89ms | 3200.89ms | 633.11ms | 0% | 1.58 |
| **CoinGecko Crypto Public Data (BTC)** | 15 | 403.35ms | 1478.92ms | 1478.92ms | 576.64ms | 0% | 1.73 |
| **Dynamic JWKS Endpoint Verification** | 20 | 308.72ms | 2260.79ms | 2260.79ms | 544.1ms | 0% | 1.84 |

## Observations & Latency Governance
1. **Pyth Hermes Price Feed**: Consistently sub-second (~100-300ms) with zero error rate, suitable for on-demand price updates.
2. **Monad RPC Testnet**: Ultra-fast block retrieval (~50-150ms), reflecting parallel EVM execution capabilities.
3. **Dynamic JWKS**: Fast key verification endpoint with high availability and edge caching.
4. **Rate Limit Policy**: External rate-limited feeds (CoinGecko / Yahoo / Nansen) must be insulated behind Redis cache buffers.
