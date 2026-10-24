# AGENTS.md — Agent & Contributor Collaboration Guide

This document defines the operational directives for Autonomous AI Agents and human developers collaborating on the Koliance codebase.

---

## 1. Context Alignment & Pre-Execution Synchronization Directive (执行前文档同步与现状分析)

Before executing any instructions, modifying code, or designing architecture, all autonomous agents and developers MUST follow the **Documentation-Driven Synchronization Protocol**:

### 1.1 Mandatory Pre-Execution Document Reading (每次执行前必须读取 docs 目录)
- **Zero-Assumption Principle**: Never execute based on unverified assumptions or out-of-date context.
- **Reading Scope**: Before taking action, inspect and reference the authoritative documents in `docs/`:
  - `docs/planning/`: Master roadmaps, architectural design documents, ADR references, and target definitions (e.g., `README.md`, `推进方案-Trust-Identity-AI-Infrastructure.md`, `项目目标.md`).
  - `docs/GAP台账.md`: The single source of truth for all tracked defects, pending items, blockers, and Definitions of Done (DoD).
  - `docs/changes/`: The sequential record of past modifications (`001-...md` through latest), capturing rationale, touched files, and verification commands.
  - `docs/adr/`: Architectural Decision Records governing system constraints and patterns.

### 1.2 State Analysis: What is Done vs. What is NOT Done (现状深度分析：已完成 vs 未完成)
- **Analyze "What is Done" (已完成现状)**:
  - Identify existing implemented features, passing test suites, deployed smart contracts, and closed GAP items.
  - Treat completed code and verification suites as non-negotiable regression baselines. Never rewrite, duplicate, or dismantle working functionality without explicit architectural mandate.
- **Analyze "What is NOT Done" (未完成与阻塞项)**:
  - Cross-check user instructions against open items in `docs/GAP台账.md` and pending phases in `docs/planning/`.
  - Distinguish between actionable items (ready to implement) and blocked items (`[WARN] Blocked`, external dependency wait, missing cryptographic parameters).
  - Define the exact, tight ~3% scope of what needs to be addressed in the current step.

### 1.3 Division of Responsibilities: `docs/planning/` vs `docs/changes/` (计划与变更的协同分工)
- **`docs/planning/` (The Strategic Plan / 目标与演进计划)**:
  - Answers: **"Where are we going, why, and what is the architecture specification?"**
  - Contains overall milestones, target specifications, interface freeze documents, and multi-phase roadmaps.
  - Acts as the architectural compass and reference for task alignment.
- **`docs/changes/` (The Change Audit Trail / 每次修改留痕)**:
  - Answers: **"What specifically was altered in this iteration, why, and how was it verified?"**
  - Follows the "Document Before/With Code" rule: Every incremental modification batch must record its purpose, exact diff summary, and verification logs in `docs/changes/NNN-*.md`.
  - Preserves immutable evidence of past state transitions and regressions guards.
- **Dual-Anchor Synchronization**: `docs/planning/` sets the plan; `docs/changes/` logs the step-by-step progress. This structure guarantees that multi-agent threads and human contributors can hand off tasks seamlessly without context loss or drift.

---

## 2. Core Operating Directive: High-Frequency 3% Incremental Commits

All autonomous agents and developers working with agents must adhere to the **Micro-Iteration Principle**:

- **High-Frequency Commits**: Commit changes in small, continuous batches rather than monolithic merges.
- **3% Rule**: Each commit should represent an incremental optimization or improvement of approximately 3% of a target capability, refactor, or test surface.
- **Never Batch Unrelated Work**: Keep diffs tight, focused, and independently reviewable.
- **Immediate Verification**: Every 3% increment must pass the test suite before being committed. Broken commits must never enter the git history.

### Commit Cadence Flowchart

```
[Pre-Execution: Read docs/ (planning, changes, GAP台账)]
           │
           ▼
[Analyze Current State: What is Done vs. What is NOT Done]
           │
           ▼
[Select Target & Apply ~3% Incremental Improvement]
           │
           ▼
[Run Local Test & Lint Verification]
           │
    Pass? ─┴─► Fail: Revert or Fix in Place
           │
           ▼ (Pass)
[Record Increment in docs/changes/ & Update GAP台账 / planning]
           │
           ▼
[Atomic Git Commit with Conventional Commit Message]
           │
           ▼
[Iterate Next 3% Improvement]
```

---

## 3. Strict Formatting and Style Directive: Zero Emojis

- **No Emojis Policy**: Do not include Unicode emojis in code, log messages, commit messages, console output, comments, or documentation.
- Use structured textual indicators: `[INFO]`, `[WARN]`, `[ERROR]`, `[OK]`, `[SUCCESS]`, `[PREREQUISITE]`.

---

## 4. Mandatory Pre-Commit Gate (Local CI Matrix)

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

## 5. Security & Cryptographic Boundary Guidelines

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

## 6. Parity & Math Integrity

- **Exact Precision**: On-chain smart contract verdicts are the authoritative source of truth.
- Financial arithmetic must use integer / BigInt representation (Wei / 6-decimal USDC / 18-decimal shares).
- Off-chain estimations in TypeScript and Go must match on-chain liquidation thresholds within zero truncation drift (GAP-06 / GAP-14).

---

## 7. Strict Geometric Directive: Ban on Oval/Pill Cards & Buttons (拒接椭圆形卡片与按钮)

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

## 8. Traceability & User Operation Audit Directive (操作可追溯与交易历史)

All user-facing workflows must maintain complete audit transparency:

1. **Operation Traceability (操作可追溯)**:
   - Every state-altering user action (quota claims, package purchases, agent wallet bindings, key rotations, trust attestations) must produce a timestamped audit record.
   - History must be accessible and inspectable directly within the user console.
2. **Transaction & Acquisition History (每笔交易与KOL获取历史)**:
   - Full visibility into KOL Token acquisition events (block claims, mining rewards, transfers).
   - Full visibility into autonomous payment streams, including Order Hash, on-chain TX Hash, Monad testnet consensus state, and receipt links.
   - All records must persist per user account (syncing local state with backend telemetry).

## 禁止模版卡片放无意义文本和霓虹色彩配色 需要思考审美




## 对于并行任务可以创建worktree，任务完成可以关闭worktree
## subagent将问题进行拆分，并行子agent处理任务，代码需要模块化，职责独立
## 接口测试，回归测试，端到端测试验证结果 
## 任务结束时review代码
## commit没有问题就提交pr，仓库的greptile会进行review
## 完成任务后可以关闭issue

