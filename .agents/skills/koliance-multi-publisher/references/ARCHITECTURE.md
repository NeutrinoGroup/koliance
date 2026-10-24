# Koliance Multi-Platform Publisher Architecture & Technical Reference

> Authoritative reference for multi-platform content publishing across Reddit, Zhihu, Dev.to, WeChat Official Account, and Xiaohongshu.
> Adheres strictly to AGENTS.md: zero emojis, structured logging, mathematical precision.

---

## 1. Six Foundational Research Questions & Koliance Ground Truths

### 1.1 What does Koliance provide to users? (给用户提供什么？)
- **AgentCard Virtual Card System**: Automatically provisions 16-digit Visa virtual payment cards (BIN: `492810`) adhering to ISO/IEC 7812, pre-validated via the Luhn (MOD 10) algorithm.
- **EIP-712 Delegated Session Key Matrix**: Cryptographic authorization structure executed on-chain via `SessionKeyRegistry.sol`:
  - `maxPerTxUSD`: Hard per-transaction ceiling. Exceeding transactions fail with Visa decline code 57 (`Transaction not permitted to cardholder`).
  - `dailyLimitUSD`: 24-hour rolling cumulative limit.
  - `allowedMCCs`: Strict merchant category code filter (e.g. `5734` for cloud computing/software, `7999` for gaming).
  - `expiresAt`: Ephemeral expiration timestamp; expired keys become unspendable.
- **Dual-Layer Circuit Breakers**:
  - User revocation: Instant zero-knowledge invalidation through `revokeSessionKey(key)`.
  - Protocol circuit breaker: Administrative freeze through `freezeSessionKey(key)` protecting funds during anomalous network events.
- **Multi-Platform Decentralized Identity & Reputation (DID)**:
  - Steam Proof of Play: Keccak256 state commitments from Steam OpenID 2.0 achievements.
  - GitHub Proof of BUIDL: OAuth 2.0 verification of developer commit history, star distribution, and language footprints (Solidity, Go, TypeScript).
- **Sub-Second Perpetual DEX Engine**:
  - Deployed natively on Monad Parallel EVM (Chain ID: `10143`).
  - Up to 50x long and short leverage on crypto and real-world equities (NVDA, TSLA, BTC).
  - SC-1 Solvency Guard: `Vault.sol` prices LP shares strictly on Net Asset Value (NAV) net of open trader position liabilities.
  - Deterministic Liquidation Parity: Integer basis point math (`BPS_DENOMINATOR = 10,000`) shared across TypeScript and Solidity.
  - Block-by-block dynamic funding rates (ADR-003).
- **Developer Microservices**:
  - 28 REST endpoints in a Go 1.25 modular monolith.
  - Free starter quota: 300 free calls across 3 claims on Monad Testnet.

### 1.2 What is its utility/purpose? (有什么用？)
- Enables Autonomous AI Agents (AutoGPT, Claude Computer Use, LangChain, Browser-Use) to execute payments and trade autonomously within bounded budgets.
- Eliminates the binary tradeoff between unconstrained financial exposure and manual human approval for every micro-transaction.
- Provides developers and enterprises with programmable spending sandboxes for multi-agent workflows.

### 1.3 What problems does it solve? (解决什么问题？)
- **Financial Vulnerability Trilemma**: Autonomy, security, and low friction are unified via deterministic cryptographic bounds.
- **Identity Void for Non-Humans**: AI agents lack legal identity and bank accounts; Koliance provides verifiable DID and virtual cards.
- **DeFi Solvency & Liquidation Drift**: Eliminates floating-point conversion errors between off-chain engines and on-chain EVM state.

### 1.4 Why is it necessary? (为什么要有？)
- Natural language prompts cannot provide financial security. Prompt injection and hallucinations easily bypass verbal rules. Security must be enforced deterministically at the protocol and cryptographic boundary.

### 1.5 What makes it different from others? (和别人不同之处？)
- Unlike Web2 corporate cards, Koliance provides instant 1-transaction on-chain revocation and EIP-712 typed limits.
- Unlike raw crypto bots, the master private key remains completely unexposed; only bounded ephemeral session keys are held by agents.
- Unlike generic perp DEXes, funding rates update block-by-block on Monad, and LP shares are strictly solvency-guaranteed against Net Asset Value.

### 1.6 How to use it? (如何使用？)
- Live DApp: `https://koliance.vercel.app`
- Connect wallet via Privy MPC or injected MetaMask/Rabby on Monad Testnet (`10143`).
- Bind GitHub / Steam credentials to unlock credit allowances.
- Generate AgentCards and delegate session keys.
- Developers claim free quota (300 calls) at `/pricing` and access REST endpoints.

---

## 2. Platform Publishing Specifications

| Platform | Target Audience | Content Focus | Editor Mechanism | Staging / Publish Action |
| :--- | :--- | :--- | :--- | :--- |
| **Reddit** | Web3 builders, r/monad, r/crypto | Protocol architecture, parallel EVM, code examples | Lexical editor inside `shreddit-composer` | Populates title & body; stages for submit |
| **Zhihu** | Chinese tech geeks, researchers | In-depth architectural evaluation, 6 core questions | Draft.js rich editor on `zhuanlan.zhihu.com/write` | Auto-saves draft URL (`zhuanlan.zhihu.com/p/.../edit`) |
| **Dev.to** | Fullstack engineers, TypeScript/Solidity | Hands-on code integration, EIP-712 signing guide | Native markdown editor (`#article_body_markdown`) | Injects title, tags, and markdown; triggers Save Draft |
| **WeChat MP** | Industry leaders, investors | Deep narrative analysis, business and technical impact | ProseMirror rich text container (`.ProseMirror`) | Injects semantic HTML; clicks `#js_submit` to save draft |
| **Xiaohongshu**| Young creators, indie hackers | Punchy 3-minute guide, pain point breakdown | Tiptap ProseMirror editor (`.tiptap.ProseMirror`) | Injects structured notes; clicks `.save-btn` to save draft |

---

## 3. Dual Execution Engine

### Engine 1: Active Chrome Session (`chrome_bridge.js`)
- Communicates directly with the user's running Google Chrome instance on macOS via Apple Events / AppleScript.
- Reuses authenticated sessions, logged-in cookies, and localStorage without locking conflicts.
- High speed, zero overhead, immune to anti-bot captchas or session drops.

### Engine 2: Headless Playwright Mode (`playwright_bridge.js`)
- Runs Playwright Chromium in headless mode (`headless: true`).
- Uses system-installed Google Chrome binary to avoid downloading redundant browser packages.
- Automatically exports session state to `resources/storageState.json` for persistence.
