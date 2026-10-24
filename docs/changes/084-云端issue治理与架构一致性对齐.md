# 084 · 云端 GitHub Issue 治理与架构一致性对齐（GAP-85）

## 1. 变更背景与动机 (Context & Motivation)

仓库在长期高频迭代过程中积累了 26 项云端未决 Issue。经过逐项排查与实测审计：
1. 部分 Issue 为已完成或已过期的历史遗留（如 #15 冲刺倒计时已截止，#16 市场行情模拟盘与 Alpaca 真实数据已在 PR #45 与 GAP-82 完全闭环）。
2. 部分 Issue 揭示了关键的文档与代码架构一致性断裂问题：
   - Issue #71: `dailyLimitUSD` 声称 24 小时滚动窗口，但 Go 侧 `SpentTodayUSD` 只增不减，触顶后永久拒绝。
   - Issue #70: README 与注释声称 Keccak256 证明，但三处生成点实际使用 SHA-256。
   - Issue #58: Steam 验证接口在生产环境可传 `demo: true` 绕过 Valve 签名并获得有效身份。
   - Issue #69: 紧急熔断在合约层缺少别名函数 `freezeSessionKey` / `revokeSessionKey`，后端无对应 HTTP 路由，前端按钮未连接真实熔断。
   - Issue #74 & #75: README 漏报全仓最硬的实现（清算 parity 双向对拍、Perp 全栈引擎、28 条挂载 API 路由仅报 14 条），并宣称了仓内不存在的幻影组件（Cloudflare、Foundry、Python SDK），将已删除合成行情说反为缺陷。

本轮迭代针对上述问题进行系统化治理与修复，并形成可证伪的自动化测试防护。

---

## 2. 变更详情 (Changes Details)

### 2.1 Issue #15 & #16 结单治理
- **Issue #15**: 黑客松最终冲刺倒计时已过期且成果全部交付，使用规范零 Emoji 评注关闭。
- **Issue #16**: 行情路由 `/market`、Alpaca 真实时序 K 线与动态 movers 涨跌幅榜、模拟盘资金与仓位管理已于 PR #45、commit `aca3f34`、GAP-80、GAP-82 完整落地，关闭并附带证明依据。

### 2.2 Issue #71: 24 小时动态滚动窗口闭环
- 修改 `backend/internal/agentcard/permission_guard.go`：
  - `SessionKey` 结构体新增 `WindowStart time.Time` 字段，并在密钥签发时记录初始 UTC 时间戳。
  - `VerifyAndDeduct` 与 `VerifyAndDeductWithTime`：每次调用时对比当前时间与 `WindowStart`。若跨越 24 小时（`now.Sub(WindowStart) >= 24*time.Hour`），原子重置 `SpentTodayUSD = 0` 并推进 `WindowStart = now`，与链上 `SessionKeyRegistry.sol` 保持数学一致。
- 新增单元测试 `backend/internal/agentcard/permission_guard_test.go`：
  - `TestRollingWindowExpiryAndReset`: 验证首日消费累加、23h59m 边界精确拦截、24h+1s 滚动重置恢复额度。
  - `TestConcurrentSpendingWithinDailyLimit`: 15 并发请求下精确消费 $50 上限并拒绝超额请求。

### 2.3 Issue #70: 切换至真实 Keccak-256 密码学证明
- 修改 `backend/internal/developer/github.go`、`backend/internal/game/service.go`、`backend/internal/agentcard/service.go`：
  - 引入 `github.com/ethereum/go-ethereum/crypto`。
  - 将所有 proof 生成与 batch commitment 哈希由 `sha256.Sum256` 统一升级为 `crypto.Keccak256Hash([]byte(raw)).Hex()`。
  - 修正误导性注释，使链下生成的 `proofHash` 与 Monad / EVM 智能合约（`bytes32` 原语）实现 100% 密码学兼容。

### 2.4 Issue #58: Steam 演示验证接口生产级安全门禁
- 修改 `src/app/api/auth/steam/verify/route.ts`：
  - 对 `demo: true` 分支施加严格环境变量拦截：非生产环境 (`NODE_ENV !== "production"`) 或显式配置 `ALLOW_STEAM_DEMO === "true"` 时才允许，生产环境一律 403 阻断。
  - 增加 17 位 SteamID 格式校验正则。
- 修改 `src/components/AgentCardTerminal.tsx`：
  - 检查回调返回的 `verification.synthetic` 标志；若为真，明确提示沙箱测试模式，不向本地持久化账号状态，更不赋予真实链上信用额度。
- 修改 `tests/steam-auth.test.ts`：新增生产环境拦截测试用例。

### 2.5 Issue #69: 紧急熔断全链路闭环
- 修改 `contracts/contracts/perp/SessionKeyRegistry.sol`：
  - 增加 `freezeSessionKey` 与 `revokeSessionKey` 别名接口，与既有 `freeze` / `revoke` 逻辑完全对齐。
- 修改 `backend/internal/agentcard/service.go` 与 `router.go`：
  - 挂载 `POST /api/v1/agentcard/freeze` 与 `POST /api/v1/agentcard/revoke` 路由。
  - 纳入 `backend/internal/httpapi/qa_degradation_test.go` 的 `qaRouteInventory` 审计清单。
- 修改 `src/components/AgentCardTerminal.tsx`：
  - 冻结开关从纯本地 useState 升级为持久化及调用后端熔断接口，并在已冻结状态下拦截模拟微支付。

### 2.6 Issue #74 & #75: README 技术栈与架构宣称对齐
- 修改 `README.md` 与 `README_zh.md`：
  - 补充「确定性清算对齐 (Liquidation Parity)」深度技术章节，标明 `tests/liquidation-parity.test.ts` 与 `contracts/test/perp/LiquidationParity.ts` 双向对拍。
  - 补充「永续合约全栈撮合引擎 (Full-Stack Perpetual DEX)」技术章节。
  - API 表从 14 条扩展为全部 28 条已挂载路由，修正 `/api/v1/market/prices` 的说明，明确标注严禁伪造假数据的 fail-closed 策略。
  - 剔除 Cloudflare、Foundry、Python SDK 等仓内不存在的幻影组件；Go 依赖表补全 `go-ethereum v1.16.9`。
  - 修正合约覆盖率徽标为 88% CI 门槛，Vitest 徽标修正为 389 项测试全通过。

---

## 3. 验证与门禁检查 (Verification & Gates)

1. **Gate 1: 前端与 TypeScript 全量测试**
   ```bash
   pnpm type:lint  # [OK] tsc & eslint 0 错误通过
   pnpm test       # [OK] 36 个测试文件，389 项用例全部通过
   pnpm build      # [OK] Next.js 生产环境构建通过，30/30 静态页面渲染完成
   ```

2. **Gate 2: 智能合约与覆盖率门禁**
   ```bash
   cd contracts
   npx tsc --noEmit                                                 # [OK] TypeScript 类型检查通过
   npx hardhat test --coverage && npx tsx scripts/check-coverage.ts # [OK] 209 项合约用例通过，行覆盖率 88.92% (>= 88% 门槛)
   ```

3. **Gate 3: 后端高并发微服务验证**
   ```bash
   cd backend
   go vet ./...            # [OK] 无代码缺陷
   go test -race ./...     # [OK] 竞态探测全包通过
   ```
