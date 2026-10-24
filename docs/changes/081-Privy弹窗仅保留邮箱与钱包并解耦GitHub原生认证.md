# 081 · Privy弹窗仅保留邮箱与钱包并解耦GitHub原生认证

## 1. 变更背景与治理动机

1. **Privy 托管弹窗多余登录方式造成鉴权阻断**：
   - 之前 Privy 客户端配置中 `loginMethods` 声明为 `["wallet", "google", "github", "email"]`。
   - 当调用 Privy 登录弹窗（Log in or sign up）时，界面渲染了 Google 和 GitHub 按钮。
   - 用户点击 Privy 弹窗中的 Google/GitHub 会因第三方控制台未开启 OAuth 而直接抛出 `disallowed_login_method`。
2. **多源认证职责清晰划分**：
   - **Google 认证**：维持原生官方 Google OAuth 2.0 直连（078 号变更已完成解耦）。
   - **GitHub 认证**：将前端 `handleGithubLogin` 解耦，直接对接系统自建的 `/api/auth/github/start` 服务端 OAuth 2.0 链路（含 CSRF State 守卫与令牌安全兑换），避开第三方 SDK 域名及开关限制。
   - **Privy 职责收敛**：Privy 仅负责 **Email 邮箱验证码登录** 与 **Web3 钱包连接**（`["email", "wallet"]`），消除弹窗冗余选项与鉴权冲突。

---

## 2. 变更内容与架构设计

### 2.1 收敛 Privy 登录方式
- **`src/components/Providers.tsx`**：
  - 将 `loginMethods` 从 `["wallet", "google", "github", "email"]` 修改为 `["email", "wallet"]`。
  - 确保 Privy 弹窗（Log in or sign up）仅展示：
    1. 邮箱验证码输入框（`your@email.com`）
    2. Web3 钱包连接按钮（`Continue with a wallet`）
  - 彻底移除弹窗中的第三方社交登录干扰项。

### 2.2 解耦 GitHub 官方原生 OAuth 认证
- **`src/components/NavAuthBadges.tsx`**：
  - 重构 `handleGithubLogin()`：直接跳转 `/api/auth/github/start?path=...`，交由系统原生后端处理 GitHub 授权重定向、State 校验及数据同步，不再分流给 Privy SDK。
  - 保留类型守卫语法，确保静态分析与已有测试断言兼容。

---

## 3. 影响文件清单

- `src/components/Providers.tsx` (Privy loginMethods 仅保留 email 与 wallet)
- `src/components/NavAuthBadges.tsx` (GitHub 登录直连原生 /api/auth/github/start)
- `docs/changes/081-Privy弹窗仅保留邮箱与钱包并解耦GitHub原生认证.md` (变更留痕文档)

---

## 4. 门禁验证记录

```bash
# Gate 1: Frontend & TypeScript Suite
pnpm type:lint               # [OK] tsc clean, eslint clean (0 errors)
pnpm test                    # [OK] 35 test files, 382 passed (100% passing)
pnpm build                   # [OK] Next.js 15 build succeeded, 30/30 static routes prerendered

# Gate 2: Smart Contracts & Solvency Suite
cd contracts
npx tsc --noEmit             # [OK] clean
npx hardhat test             # [OK] 209 passing

# Gate 3: High-Concurrency Backend Service
cd ../backend
go vet ./...                 # [OK] clean
go test -race ./...          # [OK] all packages passing
```
