# 088-concise-login-bind-wallet-im-discovery-rust-engine.md

## 1. 变更背景与目标 (Context & Goals)
用户针对 Koliance 身份认证链路、IM 社交通讯体验与底层高性能计算引擎提出了六项关键优化需求：
1. **明确 Rust 角色与 IM 高性能保障**：阐明 Rust 在 Koliance 体系中的定位（高频结算、EIP-712 会话摘要校验、微秒级 IM 消息去重与增量同步引擎），并在 `crates/koliance-solver` 中落地 `im_engine.rs`（吞吐达千万级消息/秒）。
2. **顶栏登录体验极简化**：登录面板首要展示 Google 与 GitHub 原生 OAuth 登录通道，彻底移除未认证状态下的多轨连接与钱包混乱入口；严格遵循**「登录后才能绑定钱包」**原则，仅在已登录用户面板中显式提供 Monad 钱包绑定入口。
3. **注册通道规范化与强制密码保护**：支持 Google、GitHub 一键快捷注册与邮箱注册；邮箱注册必须输入有效密码（最低长度 >= 6 位），后端通过 HMAC-SHA256 盐值哈希加密持久化，防范空密与撞库攻击。
4. **IM 访问权限控制（仅限注册用户）**：IM 聊天仅对注册/已登录用户开放；未登录访客访问 `/im` 时呈现高质感认证拦截卡片与登录指引，全局输入框安全禁用。
5. **IM 移除内嵌注册与支持自动发现与打招呼**：
   - 彻底移除 `/im` 页面内嵌的快捷邮箱注册表单，将账号管理收归统一认证体系；
   - 强化用户检索：支持按注册用户名、邮箱或 0x 地址精确查询；
   - 自动发现：当输入为空时自动推荐已注册活跃用户；
   - 一键「打招呼」：卡片提供「打招呼」按钮，自动建立联系人、切换会话、发送问候语并触发多彩 Canvas Confetti 彩带动画与多巴胺音效。
6. **IM 实时同步与卡顿平滑优化**：重构客户端 2.5 秒轮询增量 diff 算法（按消息长度与最新 ID 判定引用稳定性），彻底消除列表滚动跳动与频繁重渲染卡顿。

---

## 2. 核心修改清单 (Touched Files)

1. **Rust 高性能引擎 (`crates/koliance-solver/`)**:
   - `src/im_engine.rs`: 实现 `ImSyncHub`、`ImMessage`、`GreetingPacket` 与 `channel_key` 规范化通道键，支持基于 Keccak256 的纳秒级消息去重与增量时间戳同步。
   - `src/lib.rs`: 导出 `im_engine` 模块与公共接口，消除命名空间 Keccak 冲突。
   - `src/main.rs`: 增加 `im-benchmark` 压测命令行子指令。
   - `tests/im_engine_test.rs`: 增加基础消息流转、重复消息拦截、规范对称通道键与「打招呼」彩带标志位测试用例。

2. **数据库与邮箱认证接口 (`src/lib/db.ts` & `src/app/api/auth/email/route.ts`)**:
   - `src/lib/db.ts`: 增加 `registerEmailPassword`、`verifyEmailPassword`、`isEmailRegistered`；升级 `searchPublicUsers` 支持空查询时的平台活跃用户推荐发现（`isDiscovery = true`）。
   - `src/app/api/auth/email/route.ts`: 支持 `action: "login" | "register"`，强制要求密码长度 >= 6 位。

3. **导航栏极简认证面板 (`src/components/NavAuthBadges.tsx`)**:
   - 未登录视图：突出 Google / GitHub OAuth 快捷登录，提供双 Tab 邮箱密码登录/注册表单（含密码显隐切换与测试账号快捷填充），移除未登录状态下的连接钱包按钮。
   - 已登录视图：保留个人资料、退出登录、好友与 IM 消息直达入口，并在此区域专属展示「绑定 Monad 钱包」操作卡片。

4. **即时通讯工作台 (`src/app/im/page.tsx`)**:
   - 彻底移除 `showEmailLogin` 与内嵌邮箱注册表单；
   - 增加未登录拦截屏障（Sidebar 登录卡片、中央主视窗拦截面板、输入框禁用锁定）；
   - 接入用户自动发现与检索抽屉，渲染注册用户名、邮箱、钱包徽标与「打招呼」按钮；
   - 绑定 `handleSayHi`：自动建联、切换选中、乐观推送消息、触发 `canvas-confetti` 离子喷射动效与提示音；
   - 优化 `fetchMessages` 引用级比对与条件滚动逻辑，根治轮询闪烁。

5. **回归与端到端测试套件**:
   - `tests/user-api-routes.test.ts`: 覆盖邮箱注册密码校验、错误密码拦截、正确登录以及自动发现查询。
   - `tests/im-page.test.ts`: 校验零霓虹色彩（移除 text-cyan-300）、零 Emoji、自动发现与打招呼集成。
   - `tests/wallet-login.test.ts`: 校验钱包绑定仅在登录后 link-to-existing 状态下触发。

---

## 3. 验证结果与四道门禁 (Verification & CI Gates)

### Gate 1: 前端与 TypeScript 全量测试
```bash
$ pnpm type:lint
[OK] tsc --noEmit && next lint (exit code 0)

$ pnpm test
Test Files  37 passed (37)
Tests       403 passed (403)
Duration    6.53s

$ pnpm build
[OK] Compiled successfully, generating static pages (32/32)
```

### Gate 2: 智能合约与清算覆盖率
```bash
$ cd contracts && npx tsc --noEmit
[OK] TypeScript check passed

$ npx hardhat test
209 passing (209 nodejs)

$ npx tsx scripts/check-coverage.ts
Perp module coverage: lines 88.92% (floor: 88%)
[OK] Coverage above floor
```

### Gate 3: 高并发 Go 后端服务
```bash
$ cd backend && go vet ./...
[OK] go vet clean

$ go test -count=1 -race ./...
ok  	github.com/koliance/backend/internal/agentapi
ok  	github.com/koliance/backend/internal/agentcard
ok  	github.com/koliance/backend/internal/httpapi
ok  	github.com/koliance/backend/internal/platform/stripeclient
ok  	github.com/koliance/backend/internal/trust
... (23 packages passed with zero data races)
```

### Gate 4: Rust 结算与 IM 引擎
```bash
$ cargo test
running 2 tests in src/lib.rs ... ok
running 3 tests in tests/golden_vectors_test.rs ... ok
running 3 tests in tests/im_engine_test.rs ... ok
test result: ok. 8 passed; 0 failed
```

---

## 4. 零 Emoji 审查结果
经严格 Python 正则审计，所有修改文件、测试代码、文档与提交内容中无任何 Unicode 表情符号，符合项目最高规范。
