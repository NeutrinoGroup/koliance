# Change Log: 089-真实微支付与Agent自主运行闭环及多权重交易Trust.md

## Rationale
To fulfill Issue #28 ("Realize true micro-payments, Agent autonomous execution closed-loop, and multi-weighted trading Trust score"):
1. Enable low-barrier micro-deposits (1 CNY / 10 CNY) via dual-rail QR scanning:
   - Fiat: WeChat Pay and Alipay via Stripe Checkout Sessions (with WeChat Pay web client options).
   - Web3: Monad Testnet (Chain ID 10143) native MON (1 MON) and EVM USDC (1.5 USDC) with on-chain TX hash verification.
2. Provide virtual card binding (Visa / Mastercard / Dupay / Wise / Revolut) via Stripe SetupIntent with strict autonomous auto-topup guardrails (< $1.00 USD triggers $10.00 USD auto-topup with a $50.00 USD daily ceiling circuit breaker).
3. Deliver zero-friction 3-card hand-off in the Developer Console:
   - Card 1: One-line non-interactive Go CLI installer (`scripts/install-agent-cli.sh`).
   - Card 2: Environment configuration (`.env`) for LangChain, AutoGPT, and Cursor (`OPENAI_BASE_URL` routing through localhost proxy).
   - Card 3: One-line Alpaca paper trading terminal execution (`koliance trade --symbol NVDA --side buy --qty 10 --paper`).
4. Establish a multi-weighted trading-centric Trust scoring engine:
   - 35% Trading Success Rate
   - 25% Trading Volume
   - 25% Asset Proof
   - 15% Fulfillment Rating
   - Tier classifications: `TIER_PRIME` (>= 85.0), `TIER_TRUSTED` (>= 70.0), `TIER_STANDARD` (>= 50.0), `TIER_UNVERIFIED` (< 50.0).
5. Implement an Inference Vault & micro-metered proxy (0.10 CNY/call) returning ADR-006 standard HTTP 402 (`PAYMENT_REQUIRED`) upon balance exhaustion.

## Core Capabilities Delivered
1. **Multi-Weighted Trust Engine (`backend/internal/trust/engine.go`)**:
   - Implemented `Engine` with mathematical weights: Success Rate (0.35), Volume (0.25), Asset Proof (0.25), Fulfillment (0.15).
   - Normalized metrics dynamically and output structured breakdowns with tier attribution.
   - Guarded against `NaN` and `Inf` inputs defensively.
   - Verified with unit tests (`engine_test.go`) covering prime, trusted, standard, unverified, and edge/zero cases.
2. **Inference Vault & Auto-Topup Guardrail (`backend/internal/agentapi/`)**:
   - `InferenceVault`: Tracks balance in CNY and USD, virtual card binding (`CardBrand`, `CardLast4`, `AutoRechargeEnabled`, `DailyLimitUSD`, `SpentTodayUSD`).
   - `DeductInference`: Deducts 0.10 CNY per API call. If balance falls below threshold or call cost and auto-recharge is active, triggers auto-topup *before* deduction to ensure zero interruptions for long-running agents, bounded by the daily cap circuit breaker. Returns `ErrInsufficientBalance` (HTTP 402) if daily limit reached or card unconfigured.
   - `CreditVault` & `BindVaultCard`: Thread-safe operations with default parameters.
   - `InferenceMeteringLog`: Logs wallet address, model, prompt/completion tokens, unit cost, and latency.
3. **Stripe Dual-Rail Checkout & SetupIntent (`backend/internal/platform/stripeclient/`)**:
   - `CreateDepositCheckoutSession`: Generates Stripe Checkout sessions configured for Alipay, WeChat Pay (with `wechat_pay.client = web`), and cards.
   - `CreateSetupIntent`: Prepares Stripe SetupIntent for off-session card authorization with mock fallbacks for offline testing.
4. **Backend Router & Route Inventory (`backend/internal/httpapi/`)**:
   - Registered 10 endpoints:
     - `GET /api/v1/trust/score`
     - `POST /api/v1/trust/evaluate`
     - `POST /api/v1/deposit/checkout`
     - `POST /api/v1/deposit/webhook`
     - `POST /api/v1/deposit/web3-verify`
     - `POST /api/v1/card/setup-intent`
     - `POST /api/v1/card/bind`
     - `GET /api/v1/inference/vault`
     - `POST /api/v1/proxy/chat/completions` (with dynamic DeepSeek/Doubao upstream forwarding and token metering)
     - `GET /api/v1/proxy/models` (OpenAI-compatible model list)
   - Updated `trading` route wrapper so authorized agent keys (`kol_live_...`) can execute paper trades in addition to operator token.
   - Added all routes to `qaRouteInventory` in `qa_degradation_test.go`, passing the AST reverse inventory gate (`GAP-70`).
5. **Standalone Go Agent CLI (`backend/cmd/koliance/main.go`)**:
   - Implemented single-file CLI supporting:
     - `koliance auth`: Manage and verify API credentials.
     - `koliance proxy`: Local micro-metered forward proxy (`127.0.0.1:8080`) metering requests at 0.10 CNY with OpenAI compatibility (`/v1/chat/completions`, `/v1/models`).
     - `koliance trade`: Automated paper trading with Alpaca with transparent error handling.
     - `koliance status`: Real-time dashboard of Inference Vault balance, trust tier breakdown, and open paper trading positions.
     - `koliance version`: CLI version and build metadata.
   - Dynamic wallet address discovery when key is configured.
6. **Non-Interactive Installer Script (`scripts/install-agent-cli.sh`)**:
   - Non-interactive script supporting `--key=...` flag.
   - Checks `sudo -n true` without prompting for passwords, cleanly falling back to `~/.local/bin`.
   - Supports pipe execution with `pwd` fallback.
7. **Developer Console UI (`src/components/DeveloperConsole.tsx`)**:
   - Added `trust` tab to console with live 4-weight score evaluation cards, radar/bar visualizers, and an interactive weight simulator.
   - Two-way live data synchronization with `/api/v1/inference/vault` and `/api/v1/trust/score`.
   - Connected Dual-Rail QR modal to `/api/v1/deposit/webhook` and `/api/v1/deposit/web3-verify`.
   - Connected Card Guardrail modal to `/api/v1/card/bind`.
   - Micro-topup strip offering instant 1元 and 10元 topup buttons opening the Dual-Rail QR Modal (WeChat Pay / Alipay / Monad 10143).
   - Card Guardrail Modal configuring virtual card binding (< $1.00 USD auto-topup $10.00 USD, $50.00 daily cap).
   - 3 Zero-Friction Hand-off Cards (Go CLI installer with copy command, `.env` snippet for LangChain/AutoGPT/Cursor, and 1-line Alpaca paper trading).
   - Strictly conforms to modern SaaS geometric directives (`rounded-md` buttons, `rounded-lg`/`rounded-xl` cards, zero oval/pill buttons, zero yellow/amber colors).
8. **Automated Regression Suite (`tests/micro-deposit-trust.test.ts`)**:
   - Verifies 4-weight trust formula parity.
   - Verifies zero emojis across code, components, and scripts.
   - Verifies strict rectangular geometry (no `rounded-full` on buttons/cards).
   - Verifies installer non-interactive sudo guards.

## Touched Files
- `backend/cmd/api/main.go`
- `backend/cmd/koliance/main.go`
- `backend/internal/agentapi/models.go`
- `backend/internal/agentapi/service.go`
- `backend/internal/agentapi/service_test.go`
- `backend/internal/httpapi/inference_proxy_test.go`
- `backend/internal/httpapi/qa_degradation_test.go`
- `backend/internal/httpapi/router.go`
- `backend/internal/platform/stripeclient/stripe.go`
- `backend/internal/platform/stripeclient/stripe_test.go`
- `backend/internal/trust/engine.go`
- `backend/internal/trust/engine_test.go`
- `scripts/install-agent-cli.sh`
- `src/components/DeveloperConsole.tsx`
- `tests/micro-deposit-trust.test.ts`
- `.gitignore`
- `docs/GAP台账.md`
- `docs/changes/089-真实微支付与Agent自主运行闭环及多权重交易Trust.md`

## Verification Commands & Evidence
- Trust Engine Unit Tests:
  `cd backend && go test -race -v ./internal/trust/...` -> [PASS] (all 5 test suites).
- AgentAPI & Vault Unit Tests:
  `cd backend && go test -race -v ./internal/agentapi/...` -> [PASS] (all test cases).
- HTTP API & Proxy Unit Tests:
  `cd backend && go test -race -v -run TestInference ./internal/httpapi/...` -> [PASS].
- QA Route Inventory Gate:
  `cd backend && go test -race -v -run TestQARouteInventory ./internal/httpapi/...` -> [PASS].
- Full Go Backend Test Suite:
  `cd backend && go vet ./... && go test -race ./...` -> [PASS] (all 24 packages passed).
- CLI Compilation & Execution:
  `cd backend && go build -o ../bin/koliance ./cmd/koliance` -> [PASS].
  `bin/koliance version` -> `koliance version 0.8.8 (monad-testnet-10143) [commit: 088-micro-payments]`.
  `bin/koliance status --key kol_demo_agent_test_key` -> Clean dashboard output.
- Installer Script Execution:
  `bash scripts/install-agent-cli.sh --key=kol_demo_installer_key` -> Installed successfully to `~/.local/bin/koliance`.
- Frontend Test Suite:
  `pnpm test` -> 38 test files passed, 407 tests passed.
- Frontend Type & Lint Gate:
  `pnpm type:lint` -> 0 errors.
- Frontend Next.js Production Build Gate:
  `pnpm build` -> Exit code 0 (All 32 static and dynamic routes compiled).
- Smart Contract Suite Gate:
  `cd contracts && npx tsc --noEmit && npx hardhat test` -> [PASS] (209 tests passed).
- Rust Settlement & Parity Engine Gate:
  `cargo test` -> [PASS] (8 passed).
