# Title: Introducing Koliance: How We Built an On-Chain Trust & Economic Sovereignty Layer for Autonomous AI Agents on Monad (10k TPS)

**Target Subreddits**: r/monad, r/CryptoCurrency, r/ethereum, r/artificial, r/autonomousagents

---

## The AI Agent Financial Dilemma

As Large Language Models evolve from passive chat interfaces into autonomous software agents capable of browsing the web, executing code, and transacting, builders hit an immediate brick wall:

**Autonomous AI agents lack cryptographic identity, financial credit, and provably bounded delegation boundaries.**

Currently, giving an autonomous agent economic capabilities requires one of two flawed choices:
1. **The Dangerous Route**: Give the agent raw credit card details or unconstrained ECDSA private keys. One prompt injection, hallucination, or infinite loop can drain the wallet or max out the credit card.
2. **The Paralyzed Route**: Require a human in the loop for every $0.05 micro-payment, destroying autonomy and throughput.

To solve this, we built **Koliance Protocol** (https://koliance.vercel.app), deployed natively on the **Monad Parallel EVM Testnet (Chain ID: 10143)**.

---

## 1. What Koliance Provides to Users and Developers

Koliance is an on-chain trust and economic sovereignty infrastructure engineered around five core technical pillars:

### Pillar 1: AgentCard (Cryptographic Virtual Card System)
- **ISO/IEC 7812 Compliance**: Automatically provisions 16-digit Visa virtual payment cards under BIN `492810`. Every card number is strictly validated against the Luhn (MOD 10) checksum algorithm.
- **EIP-712 Session Key Delegation Matrix**:
  - `maxPerTxUSD`: Hard ceiling per transaction. Any excess triggers Visa decline code 57 (`Transaction not permitted to cardholder`).
  - `dailyLimitUSD`: 24-hour rolling cumulative limit.
  - `allowedMCCs`: Strict Merchant Category Code allowlist filtering (e.g., `5734` for cloud computing & software, `7999` for digital gaming, `5814` for quick service).
  - `expiresAt`: Ephemeral UNIX timestamp after which the session key becomes permanently unspendable.
- **Dual-Layer Circuit Breakers**:
  - User revocation: Instant zero-knowledge invalidation through `revokeSessionKey(key)`.
  - Protocol circuit breaker: Administrative freeze through `freezeSessionKey(key)` protecting funds during anomalous network events.

### Pillar 2: Decentralized Identity & Multi-Platform Reputation (DID)
- **Steam Proof of Play**: Authenticates gameplay history and achievements via cryptographically signed Steam OpenID 2.0 payloads. Hashes achievements into Keccak256 state commitments registered in `Koliance.sol` to unlock decentralized credit tiers.
- **GitHub Proof of BUIDL**: Ingests public developer contributions, repository star distributions, and language footprints (Solidity, TypeScript, Go) via OAuth 2.0. Verifiable proofs establish algorithmic credit limits without intrusive KYC.

### Pillar 3: Sub-Second Perpetual DEX & SC-1 Solvency Engine
- **Parallel Execution**: Designed specifically for Monad's parallel EVM, supporting up to 50x long and short leveraged positions on crypto and real-world equities (NVDA, TSLA, BTC).
- **SC-1 Solvency Guard**: Liquidity pool deposits and redemptions (`Vault.sol`) are priced strictly against Net Asset Value (NAV) net of open trader position liabilities. First-depositor dilution attacks and run-on-the-bank exploits are mathematically mitigated.
- **Deterministic Liquidation Parity**: Off-chain TypeScript models and on-chain Solidity contracts share exact integer basis point rules (`BPS_DENOMINATOR = 10,000`), guaranteeing zero liquidation boundary drift.
- **Block-by-Block Continuous Funding**: Dynamically refreshes funding rate every block (~1.0s) according to long/short open interest skew (ADR-003).

### Pillar 4: Developer Microservices & Transparent Pricing
- 28 high-concurrency REST endpoints in a Go 1.25 modular monolith.
- Transparent SaaS tiers: Starter Pack (100% free sandbox, up to 300 free calls across 3 claims), Growth Pro ($19.90, 10,000 calls, -15% discount with KOL token), and Enterprise Scale ($149.00, 100,000 calls).

---

## 2. What Problems Koliance Solves

1. **The Financial Vulnerability Trilemma in Autonomous Systems**:
   Koliance eliminates the tradeoff between zero financial agency and catastrophic security risk. Agents receive cryptographic allowances that are mathematically impossible to exceed.
2. **The Non-Human Identity Void**:
   AI agents cannot pass traditional bank KYC or hold passports. Koliance provides autonomous DID anchored to real-world developer and user activity.
3. **DeFi Liquidity Vulnerability & Inaccurate Liquidation Drift**:
   By using integer BigInt math (`BPS_DENOMINATOR = 10,000`) and the SC-1 Solvency Guard, Koliance ensures that off-chain trading signals and on-chain liquidation contracts reach identical verdicts with zero floating-point drift.
4. **Throughput Bottlenecks in Machine-to-Machine Settlements**:
   Standard L1s cannot process continuous sub-second agent payments or block-by-block funding. Monad's 10,000 TPS parallel EVM provides the required execution bandwidth.

---

## 3. Why Is Koliance Necessary?

We are crossing the threshold from conversational AI to agentic execution. An agent that cannot pay for its own compute, API calls, or data streams is fundamentally disabled. Conversely, an agent with unfettered financial access is an existential liability.

Security cannot be solved purely at the model prompt layer. Prompt injections are probabilistic; cryptography and smart contract constraints are deterministic. Koliance enforces security at the protocol boundary.

---

## 4. Key Differentiators: How Koliance Stands Out

| Vector | Unrestricted Traditional Agents | Raw Crypto Bot Scripts | Koliance Sovereign Protocol |
| :--- | :--- | :--- | :--- |
| **Identity Verification** | Web2 cookie / API key only | Bare ECDSA private key | Decoupled DID with Multi-Platform Reputation |
| **Payment Delegation** | Full plaintext credit card disclosure | Unbounded wallet draining risk | ISO/IEC 7812 Visa Virtual Card with EIP-712 Limits |
| **Transaction Bounds** | No programmatic ceiling | Unlimited gas / ERC20 transfer | Hard Per-Tx (`maxPerTxUSD`) & Daily Rolling Caps |
| **Category Control** | None (Any vendor can charge) | None (Contract addresses only) | Strict Merchant Category Code (`allowedMCCs`) Enforced |
| **Emergency Circuit Breaker** | Manual bank cancellation | Transfer gas to sweep wallet | On-chain 1-tx `revokeSessionKey` & Owner Freeze |
| **Economic Settlement** | Centralized chargeback | High L1 latency & slippage | Monad 10,000 TPS Parallel EVM with Zero-Drift Math |

---

## 5. How to Use Koliance Right Now

### For Users & Traders
1. Visit the Live DApp: https://koliance.vercel.app
2. Connect your wallet via Privy embedded MPC wallet (Email/Google login) or injected MetaMask/Rabby on Monad Testnet (Chain ID `10143`).
3. Connect GitHub and Steam to anchor your reputation and unlock higher credit allowances.
4. Issue an AgentCard or delegate an EIP-712 Session Key to your autonomous agent.
5. Trade crypto and real-world equities with up to 50x leverage on `/perp`.

### For Developers & AI Agents
1. Claim your starter quota: Claim 100 free calls (up to 3 times / 300 calls total) at https://koliance.vercel.app/pricing.
2. Query live market quotes:
   `curl https://koliance.vercel.app/api/market?symbol=NVDA -H "x-api-key: your_key"`
3. Authorize agent spend with EIP-712:
   Call `/api/v1/agentcard/session-key` and execute bounded transactions via `/api/v1/agent/pay`.
4. Inspect verified smart contracts on Monad Testnet:
   - Koliance Core: `0x6291C790dbB41198c69781B2B7a01d674843b0C5`
   - SessionKeyRegistry: `0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D`
   - PositionManager: `0x3fCeD0662657e0C3a2aF8A80e3A4cDb8A7d1d2C4`

Full documentation and developer guides are available at https://koliance.vercel.app/docs.
Source code: https://github.com/NeutrinoGroup/koliance (MIT Licensed).
