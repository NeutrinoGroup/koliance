# 073 - 链上 PositionManager 与 SessionKeyRegistry 绑定与环境配置

## 1. 背景与根因

在推进线上生产部署与缺陷收敛过程中，核验链上拓扑与配置状态发现：
1. **主干对齐与历史收敛**：本地 `main` 分支落后 `origin/main` 90 处提交（含 PR #37 ~ #51）。经 `git pull --rebase origin main` 完成无冲突重基，并将本地视频资产记录顺延为 `docs/changes/072`，彻底消解与既有 `039` 编号冲突。
2. **链上合约互认断联**：Monad 测试网（Chain ID 10143）上已存在部署并初始化的 Perp 合约群（Vault、PositionManager、DemoOracle、MockUSDC）以及 SessionKeyRegistry（`0xCb7f48F455a19778fC75afb0564aaA88b64FA004`）。但 `PositionManager.sessionKeyRegistry()` 读数为 `address(0)`，尚未在链上绑定，阻断了 Agent 委托开仓消费路径。
3. **配置示例不全**：`.env.example` 中缺少已部署的 Monad 测试网合约地址；且 PR #46 为封堵 Issue #35 移除了凭证硬编码兜底后，新增的必需服务端环境变量（`KOLIANCE_SESSION_SECRET`、`KOLIANCE_ALLOWED_ORIGINS`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`GOOGLE_CLIENT_SECRET`、`GITHUB_CLIENT_SECRET`）未在示例文件中清晰列出，导致本地初始化和生产部署缺乏标准参照。

---

## 2. 变更内容 (What Changed)

1. **链上绑定脚本与执行** (`contracts/scripts/wire-session-registry.ts`):
   - 编写链上自动核验与绑定工具，支持状态探测、权限甄别与双向授权验证。
   - 增加 `--check` 只读验证模式，在无私钥时输出完备的链上绑定诊断，并在 CI/验证场景提供确定性退出码。
   - 使用部署者钱包（`0x7C8C5E295E00d3169A49874b439Fb3F85A2535Dc`）向 Monad 测试网广播事务：
     - 调用 `PositionManager(0x82040c06da6efc60e9505f2efee0099e909b15c5).setSessionKeyRegistry(0xCb7f48F455a19778fC75afb0564aaA88b64FA004)`。
     - **上链交易哈希**: `0x6b6b83ff4e1f8009b9dbe6f46ad4e75f33f98a02900592516c0053d6efb72799`。
     - **确认区块高度**: `73582682`。
     - **链上核验读数**: `PositionManager.sessionKeyRegistry()` 成功返回 `0xCb7f48F455a19778fC75afb0564aaA88b64FA004`。
2. **环境变量规范模板** (`.env.example`、`backend/.env.example`、`contracts/.env.example`):
   - 填入 Monad 测试网权威部署合约地址：`NEXT_PUBLIC_KOLIANCE_ADDRESS`、`NEXT_PUBLIC_KOL_TOKEN_ADDRESS`、`NEXT_PUBLIC_PERP_USDC`、`NEXT_PUBLIC_PERP_ORACLE`、`NEXT_PUBLIC_PERP_VAULT`、`NEXT_PUBLIC_PERP_POSITION_MANAGER`、`SESSION_KEY_REGISTRY`。
   - 补齐 PR #46 要求的全部服务端凭据与安全跨域模板（`KOLIANCE_SESSION_SECRET`、`KOLIANCE_ALLOWED_ORIGINS`、`NEXT_PUBLIC_SITE_URL`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`GITHUB_CLIENT_SECRET`、`GOOGLE_CLIENT_SECRET`）。
   - 同步补齐 `backend/.env.example`（`KOLIANCE_API_TOKEN`、`CORS_ALLOWED_ORIGINS`、`LIQUIDATOR_*`）与 `contracts/.env.example`（`RPC_URL`、`CHAIN_ID`、`POSITION_MANAGER`、`SESSION_KEY_REGISTRY`）。
3. **配置防漂移回归守卫** (`tests/env-parity.test.ts`):
   - 新增 4 项自动化判据，断言 Monad 测试网合约地址、PR #46 必需凭证及后端/合约环境模板严丝合缝，阻断配置静默漂移。
4. **CI/CD 待完成清单核实** (`docs/CICD-待完成.md`):
   - 更新 `D-1` 状态为 `[OK 已闭环]`，明确链上部署与绑定事务已完成，消解阻断。
   - 更新 `C-3` 项说明，明确前端需要的 4 个 Perp 地址已明确收敛至 `.env.example`，等待 Vercel 控制台录入。
5. **质量缺口台账** (`docs/GAP台账.md`):
   - 在 §1 状态总表补齐 `GAP-79`，并登记 §5.17，收口链上合约绑定与配置同步；更新 `GAP-26` 链上部署状态。

---

## 3. 验证记录 (Verification Record)

### 3.1 链上事务执行与核对
- 执行命令: `cd contracts && npx tsx scripts/wire-session-registry.ts --check`
- 结果:
  - PositionManager Owner: `0x7C8C5E295E00d3169A49874b439Fb3F85A2535Dc` (匹配)
  - 链上核验读数: `PositionManager.sessionKeyRegistry == 0xCb7f48F455a19778fC75afb0564aaA88b64FA004` [OK]
  - Check 模式退出码: 0

### 3.2 工业化三道质量门禁验证 (AGENTS.md §4)
- **Gate 1 (前端全量类型、代码风格、单测与生产构建)**:
  - `pnpm type:lint`: exit 0
  - `pnpm test`: 28 个测试文件全绿，331/331 用例通过 (0 regressions)
  - `pnpm build`: 成功输出 21 个静态与动态路由（含 `/perp`、`/market`、`/console` 等）
- **Gate 2 (智能合约类型检查、单元测试与行覆盖率门禁)**:
  - `cd contracts && npx tsc --noEmit`: exit 0
  - `cd contracts && npx hardhat test --coverage && npx tsx scripts/check-coverage.ts`: 209/209 通过，覆盖率 91.23%（高于 88% 地板门禁）
- **Gate 3 (高并发 Go 后端检查与竞态测试)**:
  - `cd backend && go vet ./...`: exit 0
  - `cd backend && go test -count=1 -race ./...`: 全部 23 个 package 通过，0 race warning

---

## 4. 残余边界 (Remaining Action Items)

- `SessionKeyRegistry.spendConsumer` 当前为 `address(0)`，其 Owner 为外部地址 `0xe0EF754161f38F9595780238FDfA11029b172d59`。若需启用模块级 `openPositionFor` 自动记账，需由该 Owner 钱包执行一次 `setSpendConsumer(0x82040c06da6efc60e9505f2efee0099e909b15c5)`。
- 外部托管平台（Vercel 与 Render）环境变量录入须由系统管理员在对应网页控制台手动填入（见 `docs/CICD-待完成.md`）。
