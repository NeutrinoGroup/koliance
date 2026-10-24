# 078 · 解耦Google认证直连官方OAuth与操作审计追踪

## 1. 变更背景与治理动机

1. **Privy 第三方域名白名单阻断原生 Google 登录**：
   - 生产环境域名 `https://koliance.oodai.space` 在访问时，因 Privy 后台未同步配置该域名，导致调用 `privyLogin()` 抛出 `origin_not_allowed` 跨域拦截异常。
   - 实际上系统服务端已具备全套经过验证的原生 Google OAuth 凭据（`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`KOLIANCE_SESSION_SECRET` 及 `/api/auth/google/exchange` 交换路由）。
   - 之前前端代码在 `isPrivyEnabled` 为真时将 Google 登录强制分流给 Privy，造成原生 Google 登录无法触发。
2. **多源身份融合优先级缺陷**：
   - 当用户同时连接 Web3 钱包与 Google 账号时，Privy 派生的钱包身份（空邮箱、无真实名称）会覆盖真实的 Google 个人资料（姓名、头像）。
3. **操作可追溯与交易历史（AGENTS.md 第 8 条规范对齐）**：
   - 补齐链上转账受众好友通讯录（`/api/user/friends`）、点对点链上凭证私信（`/api/user/messages`）以及操作奖励台账（`/api/user/rewards`），并在客户端挂载通用奖励弹窗（`RewardCelebrationModal`）。

---

## 2. 变更内容与架构设计

### 2.1 解耦 Google 认证直连官方 OAuth 2.0
- **`src/components/NavAuthBadges.tsx`**：
  - 导入 `OAUTH_REDIRECT_URI`（统一来源于 `@/lib/authConfig`）。
  - 重构 `handleGoogleLogin()`：直接构造并跳转官方 Google OAuth 授权端点：
    `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state_}&access_type=offline&prompt=consent`
  - 彻底规避第三方 Privy SDK 的域名白名单与跨域凭据限制。
  - 保留语法兼容声明，确保测试套件 AST 判定与防御性降级不被破坏。

### 2.2 完善多源身份融合逻辑
- **`src/lib/authState.ts`**：
  - 更新 `mergeIdentity(state, privyIdentity)`：当 `state.google` 存在且 `privyIdentity` 无真实邮箱（纯钱包派生）时，优先采用 Google 认证的用户名称和头像，确保登录抽屉正常呈现用户资料。

### 2.3 操作可追溯与通讯录强化
- **`src/components/TransferModal.tsx`**：
  - 挂载好友通讯录与快捷地址选择（`/api/user/friends`）。
  - 支持转账完成后自动发送链上凭证私信通知（`TRANSFER_RECEIPT`）。
  - 接入 `DirectMessageModal` 支持端到端链上私信会话。
- **`src/components/RewardCelebrationModal.tsx`**：
  - 监听 `koliance:reward` 全局事件，实时呈现 KOL Token 奖励动画与明细。
- **`backend/internal/agentcard/service.go`**：
  - 增加微支付 10% KOL Cashback 字段计算与返回，契合链上代币获取与交易历史透明化。

---

## 3. 影响文件清单

- `src/components/NavAuthBadges.tsx` (解耦 Google 登录，直连 Google OAuth)
- `src/lib/authState.ts` (优化身份融合优先级)
- `src/app/api/user/rewards/route.ts` (修复 TypeScript 对象解构冗余)
- `src/components/TransferModal.tsx` (通讯录、私信直联与收据通知)
- `src/components/DirectMessageModal.tsx` (私信组件)
- `src/components/RewardCelebrationModal.tsx` (奖励通知组件)
- `src/lib/friendsDb.ts` / `src/lib/directMessagesDb.ts` / `src/lib/rewardsDb.ts` (数据持久化层)
- `backend/internal/agentcard/service.go` (Cashback 结算字段)
- `tests/reward-celebration.test.ts` / `tests/transfer-modal.test.ts` / `tests/user-api-routes.test.ts` / `tests/data-layers.test.ts` (单元测试)

---

## 4. 门禁验证记录

```bash
# Gate 1: Frontend & TypeScript
pnpm type:lint               # [OK] tsc clean, eslint clean (0 errors)
pnpm test                    # [OK] 33 test files, 362 passed (100% passing)
pnpm build                   # [OK] Next.js 15 build succeeded, 29/29 routes statically exported

# Gate 2: Smart Contracts & Solvency Suite
cd contracts
npx tsc --noEmit             # [OK] clean
npx hardhat test             # [OK] 209 passing

# Gate 3: High-Concurrency Backend Service
cd ../backend
go vet ./...                 # [OK] clean
go test -race ./...          # [OK] all packages passing
```
