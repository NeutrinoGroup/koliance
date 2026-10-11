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
