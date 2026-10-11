# 变更记录 031 — 控制台 API 密钥用户注册、自主创建与 api-key 数据库表持久化

> **编号更正（2026-10-11，ssot-scribe 文档一致性整合）**：本文件原编号为 **022**，
> 与 `022-GAP26接链层internal-chain.md`、`022-GAP51-文字深色化与背景自动波动.md`（现 **030**）**三号撞车**。
> 撞车成因是**合并次序**：本文件落地于 `9674f53`（2026-10-11T19:44+08:00），是三个 `022` 中最晚的一个。
> 最终按落地时间序重编号为 **`031`**；接链层 `022` 保持不动（它是 `023/024/025/026` 的引用锚点）。
>
> ⚠️ **本号被顺延了两次**（`028` → `029` → `031`）：每一轮拟用的号都被
> **另一条未合并分支 `feat/real-alpaca-data`** 占着（该分支在本轮中还前进了：`669aece` → `75ccda7`）。
> **详细的顺延表与教训见 `030-GAP51-…md` 的文件头**——那是本轮真正的产出：
> **"当前分支最大号 +1"在并行分支下必然失效，且失效无声**。
> **本文件的内容一字未改**——只改了编号与引用。

- **日期**: 2026-10-11
- **目标**: 落实 Console 密钥安全与身份规范：
  1. 密钥管理前置用户注册 / 登录鉴权，未注册/未登录拒绝直接操作；
  2. 支持用户自主创建专属 API 密钥（自定义名称、套餐档位、权限 scopes、RPM 速率限制）；
  3. 密钥落库保存至 `api_keys` 表（并提供 `"api-key"` 视图别名兼容），明文仅在创建时单次展示并提供复制告警。

---

## 1. 架构与改动内容

### 1.1 数据库结构与迁移 (`backend/migrations/004_create_api_keys_table.sql`)
- 创建 `api_keys` 表，包含字段：
  - `id`: VARCHAR(64) PRIMARY KEY
  - `user_id`: VARCHAR(128)
  - `wallet_address`: VARCHAR(128)
  - `name`: VARCHAR(128)
  - `key_prefix`: VARCHAR(32)
  - `key_hash`: VARCHAR(64) UNIQUE (SHA-256)
  - `tier`: VARCHAR(32) DEFAULT 'STARTER_FREE'
  - `remaining_quota`: INT DEFAULT 100
  - `free_claims_left`: INT DEFAULT 3
  - `rate_limit_rpm`: INT DEFAULT 60
  - `status`: VARCHAR(16) DEFAULT 'ACTIVE'
  - `scopes`: JSONB
- 创建视图别名 `CREATE OR REPLACE VIEW "api-key" AS SELECT * FROM api_keys;`，兼容各类对 `api-key` 表名及 `api_keys` 表名的查询。
- 开启 Row Level Security (RLS) 与权限隔离。

### 1.2 TypeScript 服务层与路由 (`src/lib/apiKeyDb.ts`, `src/app/api/console/api-keys/route.ts`)
- `apiKeyDb.ts`:
  - `generateSecureKey()`: 生成 `kol_live_` + 24 字节随机十六进制密钥及 SHA-256 哈希；
  - `createUserApiKey(...)`: 写入数据库 `api_keys` 表，并返回只展示一次的明文 `raw_key`；
  - `listUserApiKeys(...)`: 按 user_id 及 wallet_address 检索用户密钥列表；
  - `revokeUserApiKey(...)`: 更新密钥状态为 `REVOKED`。
- `route.ts`:
  - `GET /api/console/api-keys`: 校验用户身份，未登录/未注册返回 `401 UNAUTHORIZED_REGISTRATION_REQUIRED`，已登录返回密钥列表；
  - `POST /api/console/api-keys`: 用户自主创建密钥接口，验证登录并写入 `api_keys` 表；
  - `DELETE /api/console/api-keys`: 密钥撤销。

### 1.3 后端 Go 服务增强 (`backend/internal/agentapi`, `backend/internal/httpapi`)
- `APIKeyCredential` 模型新增 `Name` 与 `UserID` 字段；
- `GenerateAPIKey` 支持自定义密钥名称，并在连接 PostgreSQL 连接池时异步落库至 `api_keys` 表；
- `/api/v1/developer/keys` 支持接收 `name` 参数。

### 1.4 前端控制台重构 (`src/components/DeveloperConsole.tsx`)
- 移除硬编码预制密钥，全面接入动态用户密钥管理：
  - **未登录/未注册态**: 顶部展示 `[REGISTRATION_REQUIRED]` 卡片，引导用户连接钱包或一键登记开发者身份；
  - **自主创建密钥**: 提供专属创建弹窗，支持设置名称、套餐、RPM、权限，创建后弹窗展示完整明文并提示复制（单次显示安全告警）；
  - **密钥管理列表**: 在导航中新增 `API Keys (api-key 表)` 标签页，支持查看前缀、状态、额度、设为当前密钥及撤销；
  - **Playground 联动**: 动态检查当前密钥有效性，被撤销或未创建时阻止调用并提示用户。
- 遵循零 Emoji 规范与现代矩形微圆角几何设计（`rounded-md` 按钮、`rounded-xl` 卡片）。

---

## 2. 影响文件清单

- `backend/migrations/004_create_api_keys_table.sql`
- `src/lib/apiKeyDb.ts`
- `src/app/api/console/api-keys/route.ts`
- `src/components/DeveloperConsole.tsx`
- `backend/internal/agentapi/models.go`
- `backend/internal/agentapi/service.go`
- `backend/internal/httpapi/router.go`
- `tests/api-key-db.test.ts`
- `tests/console-api-keys-route.test.ts`

---

## 3. 本地门禁验证记录 (Local CI Matrix)

- **Gate 1: 前端全量 TypeScript 校验、ESLint、Vitest 与 Next.js 生产构建**:
  - `pnpm type:lint`: 通过 (0 errors)
  - `pnpm test`: 通过 (16 test files passed, 100 tests passed)
  - `pnpm build`: 通过 (18/18 static & dynamic pages generated)
- **Gate 2: 智能合约全套覆盖率与偿付套件**:
  - `cd contracts && npx tsc --noEmit && npx hardhat test --coverage && npx tsx scripts/check-coverage.ts`: 通过 (202 passing, coverage 90.99% > 88.00% floor)
- **Gate 3: 高并发后端 Go 单元测试与 Race 检测**:
  - `cd backend && go vet ./... && go test -race -count=1 ./...`: 通过
