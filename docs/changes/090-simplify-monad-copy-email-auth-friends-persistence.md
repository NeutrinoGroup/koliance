# 变更记录 090 — Monad文案精简、邮箱密码直登注册、好友添加闭环与全层数据落盘持久化

- **日期**：2026-10-25
- **分支**：`feat/simplify-auth-friends-persistence-monad-copy`
- **对应 GAP 缺口**：`GAP-90`
- **目标**：响应用户指令「monad字数可以删除多一点； 以及目前koliance这里要支持邮箱注册； 我发现无法添加其他用户好友；目前users表和messages表格是否持久化数据； 修复这些问题； 化繁为简 /goal」

---

## 1. 现状痛点与根因排查

1. **Monad 文案冗余与界面视觉负担（「monad字数可以删除多一点」）**：
   - 导航栏与账号下拉框中充斥重复的 "Monad 链上钱包以启用资产充提、KOL 代币结算与信用背书"、"Monad 10,000 TPS 原生并行引擎" 等冗余长文。
   - IM 控制台头部标语带有硬编码 `[LIVE · MONAD TESTNET]` 及过多公链介绍，偏离极简即时通讯工具核心价值。

2. **邮箱直登注册缺失（「koliance这里要支持邮箱注册」）**：
   - 用户在访问 `/im` 或主站时，若未配置 Privy 第三方 OAuth，缺乏直观、一键式的邮箱注册与登录通道。

3. **无法添加好友的核心故障（「我发现无法添加其他用户好友」）**：
   - **种子账号地址错位**：`seed2`（Monad Alpha Trader）的 `wallet_address` 误填为 66 字符的链上交易 Hash（`0x6b6b...2799`），导致 `isAddress` 与 `isValidWalletAddress` 严格正则校验失败，点击打招呼直接报非法地址。
   - **用户名与昵称解析阻断**：前端 `executeAddFriend` 及后端 `addFriend` 仅接受 `0x`、`email` 或 `did:`，直接输入用户名被前端直接拒收。
   - **误杀自身的字符串匹配 Bug**：旧逻辑使用 `normalizedUser.includes(normalizedWallet)`，导致任何与用户邮箱/DID 含有公共子串的搜索项被误判为「不能添加自己为好友」。
   - **Session Token 鉴权缺失导致 401**：Privy 或 GitHub 授权登录后未同步签发 `koliance_session_token`，发送 `/api/user/friends` 请求因缺少 Bearer 凭证返回 401 UNAUTHORIZED。

4. **数据持久化缺失（「users表和messages表格是否持久化数据」）**：
   - Supabase 仅配置了 Anon Key，缺乏 Service Role Key，且远端表未完全初始化时，系统降级为纯内存 `Map`，服务器冷重启或进程漂移会导致用户、消息、好友与奖励数据彻底丢失。

---

## 2. 核心架构重构与改动清单

### 2.1 磁盘原子落盘引擎 (`src/lib/storagePersistence.ts`)
- 落地基于本地 JSON 文件持久化引擎，支持 `users`、`credentials`、`friends`、`direct_messages`、`rewards`。
- 实现临时文件写入 + 原子重命名（Atomic Tempfile Rename），彻底防止高并发覆写破损。
- 启动时自动从磁盘加载已有数据，保证掉电与冷启动零数据丢失。

### 2.2 数据层接驳与种子账号修正 (`src/lib/db.ts`)
- 修正 `seed2` 钱包地址为合法 42 字符 EVM 地址 `0x6b6b83ff4e1f8009b9dbe6f46ad4e75f33f98a02`。
- 新增通用身份检索函数 `findUserByIdentifier(identifier)`，支持通过 ID、邮箱、钱包地址、显示名称或 GitHub 用户名全向反查用户。
- 用户注册与个人资料同步接入 `savePersistentRecord`。

### 2.3 好友系统健壮性重构 (`src/lib/friendsDb.ts`)
- 好友表初始化接入 `loadPersistentCollection<FriendRecord>("friends")`。
- `addFriend` 支持通过用户名直接反查并添加好友。
- 重构防添加自己逻辑：精确比对 DID、钱包及邮箱，消除 `includes` 模糊子串误判。
- 好友增删接入 `savePersistentRecord` 与 `deletePersistentRecord`。

### 2.4 私信与激励表持久化 (`src/lib/directMessagesDb.ts` & `src/lib/rewardsDb.ts`)
- `memoryMessages` 与 `memoryRewards` 全面接入磁盘持久化。
- 发送即时消息与发放奖励动作即刻落盘。

### 2.5 统一会话凭证桥接接口 (`src/app/api/auth/session/route.ts`)
- 新增 `POST /api/auth/session` 与 `GET /api/auth/session`。
- 无论通过 Privy、Google、GitHub 还是邮箱注册，均可签发经 HMAC-SHA256 签名的标准 `sessionToken`。
- GitHub OAuth 回调 `exchange` 增加用户自动建档与 `sessionToken` 返还。
- `Providers.tsx` 增加 `PrivyAuthBridge` 会话自动签发守卫，确保客户端始终具备有效 `koliance_session_token`。

### 2.6 文案精简与 IM 交互化繁为简 (`src/components/NavAuthBadges.tsx` & `src/app/im/page.tsx`)
- 导航栏及账号中心文案全面精简，删除冗余宣传词，采用简约现代的技术栈文案（如「链上钱包」、「绑定钱包」）。
- IM 控制台头部标语精简为 `[LIVE]`，剔除过剩公链文本。
- IM 控制台上线原生「邮箱注册 / 登录」弹窗，未登录用户可一键输入邮箱、密码及昵称完成注册，无需跳转外部平台。
- 「打招呼」与「添加好友」前自动补全会话凭据，消除 401 失败隐患。

---

## 3. 验证与门禁检查

### 3.1 专用测试套件
新增 `tests/persistence-auth-friends.test.ts`，覆盖 11 项核心验证：
1. 本地存储持久化与重启加载验证。
2. 种子账号钱包合法性与名称双向反查。
3. 邮箱密码注册、防重与登录验密。
4. 钱包/邮箱/用户名添加好友与防自加误判。
5. 会话签发接口 HMAC 鉴权。
6. 私信收发与奖励防刷单次领用。

### 3.2 四道强制 CI 门禁矩阵
- **Gate 1 (前端与类型全集)**：
  - `pnpm type:lint`：PASS (0 errors)
  - `pnpm test`：PASS (39 测试套件，419 项用例全部通过)
  - `pnpm build`：PASS (33 个静态路由生成完毕，生产构建成功)
- **Gate 2 (智能合约与清算套件)**：
  - `cd contracts && npx tsc --noEmit && npx hardhat test && npx tsx scripts/check-coverage.ts`：PASS (209 用例通过，88.92% 覆盖率高于 88.00% 门禁)
- **Gate 3 (高并发 Go 后端)**：
  - `cd backend && go vet ./... && go test -count=1 -race ./...`：PASS (24 个包全部通过且零数据竞争)
- **Gate 4 (Rust 清算与求解器)**：
  - `cargo test`：PASS (全部向量测试与 IM 引擎测试通过)

---

## 4. 遵守纪律声明
- **Zero Emojis 守卫**：全量代码、日志、测试、提交信息严格禁止任何 Unicode 表情符号。
- **现代化几何规范**：按钮统一采用 `rounded-md`，卡片与弹窗采用 `rounded-lg`，严禁任何椭圆胶囊/Pill 设计。
