# AGENTS.md — Agent & Contributor Collaboration Guide

This document defines the operational directives for Autonomous AI Agents and human developers collaborating on the Koliance codebase.

---

## 1. Core Operating Directive: High-Frequency 3% Incremental Commits

All autonomous agents and developers working with agents must adhere to the **Micro-Iteration Principle**:

- **High-Frequency Commits**: Commit changes in small, continuous batches rather than monolithic merges.
- **3% Rule**: Each commit should represent an incremental optimization or improvement of approximately 3% of a target capability, refactor, or test surface.
- **Never Batch Unrelated Work**: Keep diffs tight, focused, and independently reviewable.
- **Immediate Verification**: Every 3% increment must pass the test suite before being committed. Broken commits must never enter the git history.

### Commit Cadence Flowchart

```
[Inspect Target Problem]
           │
           ▼
[Apply ~3% Incremental Improvement]
           │
           ▼
[Run Local Test & Lint Verification]
           │
    Pass? ─┴─► Fail: Revert or Fix in Place
           │
           ▼ (Pass)
[Atomic Git Commit with Conventional Commit Message]
           │
           ▼
[Iterate Next 3% Improvement]
```

---

## 2. Strict Formatting and Style Directive: Zero Emojis

- **No Emojis Policy**: Do not include Unicode emojis in code, log messages, commit messages, console output, comments, or documentation.
- Use structured textual indicators: `[INFO]`, `[WARN]`, `[ERROR]`, `[OK]`, `[SUCCESS]`, `[PREREQUISITE]`.

---

## 3. Mandatory Pre-Commit Gate (Local CI Matrix)

Before staging and committing any changes, run and verify the following gates:

```bash
# Gate 1: Frontend & Full TypeScript Suite
pnpm type:lint
pnpm test
pnpm build

# Gate 2: Smart Contracts & Solvency Suite
cd contracts
npx tsc --noEmit
npx hardhat test --coverage
npx tsx scripts/check-coverage.ts

# Gate 3: High-Concurrency Backend Service
cd ../backend
go vet ./...
go test -race ./...
```

---

## 4. Security & Cryptographic Boundary Guidelines

1. **Zero Plaintext Credentials**:
   - Secrets, private keys, API keys, and session tokens must never be written to repository files.
   - Always load from environment variables (`.env`, platform panels, KMS).

2. **Session Key Delegation & Limits**:
   - AI Agent spending on chain must use EIP-712 delegated session keys via `SessionKeyRegistry.sol`.
   - Never bypass `maxPerTxUSD`, `dailyLimitUSD`, or `allowedMCCs` limits.
   - Circuit breakers (`freezeSessionKey` / `revokeSessionKey`) must remain functional.

3. **Database Privilege Stripping**:
   - Never allow user-facing endpoints to update `trust_tier` or `credit_allowance_usd`.
   - All client queries must respect Row Level Security (RLS).

---

## 5. Parity & Math Integrity

- **Exact Precision**: On-chain smart contract verdicts are the authoritative source of truth.
- Financial arithmetic must use integer / BigInt representation (Wei / 6-decimal USDC / 18-decimal shares).
- Off-chain estimations in TypeScript and Go must match on-chain liquidation thresholds within zero truncation drift (GAP-06 / GAP-14).

---

## 6. Strict Geometric Directive: Ban on Oval/Pill Cards & Buttons (拒接椭圆形卡片与按钮)

To maintain a top-tier developer SaaS aesthetic (comparable to Stripe, Vercel, Linear, and Supabase):

1. **Zero Oval / Capsule / Pill Geometry**:
   - **Interactive Buttons**: MUST use modern rectangular geometry with micro-radii: `rounded-md` (6px / 0.375rem).
   - **Cards & Modals**: MUST use architectural geometry: `rounded-lg` (8px / 0.5rem) or `rounded-xl` (12px / 0.75rem).
   - **Strictly FORBIDDEN**: `rounded-full` on buttons/badges/cards, `rounded-3xl` (24px) or bubbly `rounded-2xl` on cards and buttons.
2. **Modern Button Component Specification (shadcn/ui Standard)**:
   - Base sizing: `h-9` or `h-10` with `px-4 py-2 text-xs font-mono font-medium`.
   - Hairline borders: `border border-white/10` or `border border-purple-500/30`.
   - Inset highlight: `shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]`.
   - Press micro-interaction: `active:scale-[0.98] transition-all`.
   - Palette: Zero yellow/amber. Use deep Monad purple (`#836ef9`), cyber cyan (`#00f2fe`), emerald (`#10b981`), or slate.

---

## 7. Traceability & User Operation Audit Directive (操作可追溯与交易历史)

All user-facing workflows must maintain complete audit transparency:

1. **Operation Traceability (操作可追溯)**:
   - Every state-altering user action (quota claims, package purchases, agent wallet bindings, key rotations, trust attestations) must produce a timestamped audit record.
   - History must be accessible and inspectable directly within the user console.
2. **Transaction & Acquisition History (每笔交易与KOL获取历史)**:
   - Full visibility into KOL Token acquisition events (block claims, mining rewards, transfers).
   - Full visibility into autonomous payment streams, including Order Hash, on-chain TX Hash, Monad testnet consensus state, and receipt links.
   - All records must persist per user account (syncing local state with backend telemetry).
