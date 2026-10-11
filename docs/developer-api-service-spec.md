# Koliance 开放服务 API 与控制台架构设计规范 (Developer API & Console Spec)

本文档定义 Koliance 平台对外开放 API 调用的极简架构设计方案，支持外部开发者与自治 Agent 接入核心业务服务、绑定钱包与权限、执行多渠道支付、以及在控制台监控密钥和配额流水。

---

## 1. 最简单解决方案架构分析 (Simplicity & Architecture Trade-off)

为了避免引入复杂的外部 API 网关（如 Kong、APISIX 等外部微服务集群）以及沉重的分布式基础设施，根据仓库既有决策（`ADR-001`、`ADR-004`），我们采用**应用内原生轻量化集成架构**：

1. **统一网关中间件**：在现有 Go 后端（`backend/internal/httpapi`）增加单层 `APIKeyAuth` 中间件与内存令牌桶（Token Bucket）限流器。
2. **轻量持久化**：复用现有 PostgreSQL / In-Memory Store 双模架构（`backend/internal/platform/database`），仅增设 3 张紧凑表。
3. **前端控制台复用**：在现有 Next.js 体系内扩展 `/console` 路由，复用 Tailwind CSS + Wagmi/RainbowKit 钱包连接态。
4. **安全与密钥存储**：
   - 生成格式为 `kol_live_` + 32 字节随机字符串。
   - 数据库仅存储 SHA-256 哈希值，严禁明文落地（符合 `AGENTS.md` 安全规范）。

```
+─────────────────────────────────────────────────────────────+
|               Client (Agent / External Developer)           |
+─────────────────────────────────────────────────────────────+
                               │
               Header: Authorization: Bearer kol_live_xxx
                               ▼
+─────────────────────────────────────────────────────────────+
|                    Koliance API Gateway                     |
|  - APIKey 校验 (SHA-256 查验 & 配额扣减)                      |
|  - 速率控制 (Token Bucket Rate Limiter)                     |
+─────────────────────────────────────────────────────────────+
           │                                      │
           ▼                                      ▼
+──────────────────────+               +──────────────────────+
|   Agent 业务核心服务   |               |   数据分析与计费模块   |
| 1. 钱包与权限绑定     |               | 1. 3 档充值包与免费领 |
| 2. 多渠道支付与上链   |               | 2. 控制台分析监控     |
| 3. 信用证明与永续市场 |               | 3. Monad 批量结算    |
+──────────────────────+               +──────────────────────+
```

---

## 2. 统一接口交互格式

所有对外 API 均采用统一的 JSON 报文封装结构：

### 2.1 成功响应格式
```json
{
  "code": 200,
  "response": "SUCCESS",
  "data": { ... }
}
```

### 2.2 失败响应格式
```json
{
  "code": 400,
  "response": "ERROR_INVALID_PARAMS",
  "data": null
}
```

常见状态码与 Response 枚举：
- `200` / `SUCCESS`: 请求处理成功。
- `400` / `ERROR_INVALID_PARAMS`: 入参格式或业务校验失败。
- `401` / `ERROR_UNAUTHORIZED`: API 密钥不存在或无效。
- `403` / `ERROR_QUOTA_EXHAUSTED`: 接口调用配额已耗尽，需充值。
- `429` / `ERROR_RATE_LIMITED`: 触发频率限制（超出了设定的 QPS/RPM）。
- `500` / `ERROR_INTERNAL`: 系统内部异常。

---

## 3. 核心新增接口定义

### 3.1 接口一：Agent 与钱包绑定接口 (Agent Wallet Binding)

- **路径**: `POST /api/v1/agent/bind`
- **鉴权**: `Authorization: Bearer <API_KEY>`
- **说明**: 将自主 Agent 的元数据、模型、代理钱包、额度与权限护栏关联。

#### 请求参数 (Input)
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `agent_name` | string | 是 | Agent 名称（如 "arbitrage-bot-01"） |
| `model_name` | string | 是 | 使用的大模型名称（如 "deepseek-r1", "gpt-4o", "claude-3-5-sonnet"） |
| `wallet_address` | string | 是 | 绑定的 EVM 钱包地址（0x 开头，42 字符） |
| `wallet_balance` | number | 是 | 授权/托管金额（单位：USD 或代币精度折算） |
| `permissions` | array[string] | 是 | 可用权限列表，如 `["trade:perp", "pay:micropayment", "query:proof"]` |
| `limits` | object | 是 | 额度限制配置 |
| `limits.max_per_tx_usd` | number | 是 | 单笔最大金额限制（USD） |
| `limits.daily_limit_usd` | number | 是 | 每日累计最大消费限制（USD） |
| `rate_limit` | object | 是 | 频率限制配置 |
| `rate_limit.rpm` | integer | 是 | 每分钟最大调用次数限制（Requests Per Minute） |

#### 请求示例
```json
{
  "agent_name": "alpha-trader",
  "model_name": "deepseek-r1",
  "wallet_address": "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2",
  "wallet_balance": 1000.0,
  "permissions": [
    "trade:perp",
    "pay:micropayment"
  ],
  "limits": {
    "max_per_tx_usd": 100.0,
    "daily_limit_usd": 500.0
  },
  "rate_limit": {
    "rpm": 60
  }
}
```

#### 响应参数 (Output)
```json
{
  "code": 200,
  "response": "SUCCESS",
  "data": {
    "agent_id": "agt_8f29d71a4e",
    "agent_name": "alpha-trader",
    "wallet_address": "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2",
    "status": "ACTIVE",
    "bound_at": "2026-10-11T08:50:00Z",
    "session_key": "sk_sess_9a8bc721de004f"
  }
}
```

---

### 3.2 接口二：Agent 支付接口 (Agent Payment)

- **路径**: `POST /api/v1/agent/pay`
- **鉴权**: `Authorization: Bearer <API_KEY>`
- **说明**: 支持自主 Agent 执行商品采购或服务消费，支持加密货币（MON / KOL）、传统银行虚拟结算、Stripe 聚合支付等多渠道，支持将订单 Hash 记录上链。

#### 请求参数 (Input)
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `amount` | number | 是 | 支付金额（法定货币折合 USD 或对应代币数量） |
| `item_name` | string | 是 | 商品/服务名称（如 "API-Cluster-Node-01", "Model Token Quota"） |
| `order_hash` | string | 是 | 业务订单哈希值（用于对账与 Monad / EVM 上链存储） |
| `quantity` | integer | 是 | 购买订单数量（必须大于等于 1） |
| `payment_method` | string | 是 | 支付方式：`crypto` (MON/KOL), `bank` (传统银行转账/虚拟卡), `stripe` (Stripe 聚合支付) |
| `crypto_currency` | string | 否 | 当 payment_method 为 crypto 时的代币标识，如 `MON`, `KOL`, `USDC` |

#### 请求示例
```json
{
  "amount": 25.00,
  "item_name": "Nansen High Frequency Data Feed",
  "order_hash": "0x3e18a91df720c1598b92b67f18a6e9a71db902ef018274d7c0828590bf70d8a1",
  "quantity": 1,
  "payment_method": "crypto",
  "crypto_currency": "MON"
}
```

#### 响应参数 (Output)
```json
{
  "code": 200,
  "response": "SUCCESS",
  "data": {
    "payment_id": "pay_98b671a8f",
    "status": "CONFIRMED",
    "amount": 25.00,
    "item_name": "Nansen High Frequency Data Feed",
    "order_hash": "0x3e18a91df720c1598b92b67f18a6e9a71db902ef018274d7c0828590bf70d8a1",
    "tx_hash": "0xfa9102c81d830bf9827018ae671092dc018276f50198273019827019827010ab",
    "on_chain_status": "COMMITTED_TO_MONAD",
    "receipt_url": "https://koliance.io/receipt/pay_98b671a8f",
    "created_at": "2026-10-11T08:52:10Z"
  }
}
```

---

## 4. 开放的核心业务服务清单 (Core Business Endpoints)

外部 Agent 与开发者在获得 API 密钥后，可按需调用以下经过平台安全护栏封装的核心服务：

| 业务领域 | 接口路径 | 作用说明 | 扣除配额 |
| :--- | :--- | :--- | :--- |
| **信用与画像验证** | `POST /api/v1/developer/github/proof` | 生成 GitHub 开发者 BUIDL 证明与链上验签 | 1 次 / 调 |
| **信用与画像验证** | `POST /api/v1/game/proof` | 生成 Steam 游戏真实成就与战绩证明 | 1 次 / 调 |
| **实时行情与预言机** | `GET /api/v1/market/prices` | 获取 Pyth / 合成指数行情与多资产费率 | 1 次 / 调 |
| **永续市场执行** | `POST /api/v1/perp/orders` | 提交链上杠杆持仓委托（委托 Session Key 签名） | 2 次 / 调 |
| **AgentCard 虚拟信用卡** | `POST /api/v1/agentcard/authorize` | 执行无感知小额授权（商户 MCC + 额度校验） | 1 次 / 调 |
| **批量上链归档** | `POST /api/v1/agentcard/batch-settle` | 将多笔微支付流水汇聚上链至 Monad | 5 次 / 调 |

---

## 5. 充值包与免费配额机制 (Quota Packages & 3 Free Claims)

为实现以下双重目标：
1. **验证 KOL 使用与冷启动活跃度**：免押金体验，降低 Agent 接入门槛；
2. **商业化收费与服务防刷**：透明套餐阶梯与链上资金结算。

### 5.1 免费领取权益 (Free Starter Allowance)
- **规则**：任何已连接钱包或绑定 GitHub 身份的独立用户，拥有 **免费 3 次领取 100 次 API 调用包** 的权限。
- **总赠送额度**：3 x 100 = 300 次调用。
- **领取防刷机制**：
  - 绑定钱包地址签名（EIP-712 或标准 SignMessage）；
  - 数据库字段 `free_claims_left` 初始值为 3，每次成功领取扣减 1，减至 0 则无法重复领取。

### 5.2 三档套餐体系 (3-Tier Package Architecture)

| 套餐档位 | 配额次数 | 价格 | 推荐适用场景 | 支付方式 |
| :--- | :--- | :--- | :--- | :--- |
| **1. KOL 免费试用包 (Starter)** | 100 次 / 包 | **$0.00**（限领 3 次） | KOL 达人验证、开发者接入联调、测试脚本 | 免费点击直领（钱包验签） |
| **2. 开发者增长包 (Growth)** | 10,000 次 / 包 | **$19.90** | 个人高频 Bot、实时行情订阅、中小型 Agent 托管 | MON / KOL 代币 (享受 15% 折扣) 或 Stripe |
| **3. 企业专享包 (Scale)** | 100,000 次 / 包 | **$149.00** | 机构套利、大规模群控 Agent、定制高频 QPS 通道 | Crypto / 传统银行对公转账 / Stripe |

### 5.3 充值/领取接口规范
- **路径**: `POST /api/v1/developer/packages/claim-or-purchase`
- **请求体**:
```json
{
  "tier_id": "STARTER_FREE_100",
  "payment_method": "free_claim"
}
```
- **响应体**:
```json
{
  "code": 200,
  "response": "SUCCESS",
  "data": {
    "tier_id": "STARTER_FREE_100",
    "added_quota": 100,
    "remaining_quota": 280,
    "free_claims_left": 2
  }
}
```

---

## 6. Console 控制台设计方案 (Developer Console)

控制台页面集成在 Next.js 前端路由 `/console`（或 `/developer`），提供可视化的分析与运营工具。

### 6.1 功能模块规划

```
+───────────────────────────────────────────────────────────────────────────+
|                           KOLIANCE DEVELOPER CONSOLE                      |
+───────────────────────────────────────────────────────────────────────────+
| [概览卡片]                                                                 |
| API Key: kol_live_9f**...[复制]   剩余配额: 280 次   免费领取机会: 2/3 次 [免费领]  |
+───────────────────────────────────────────────────────────────────────────+
| [模块一: API 密钥管理]                                                      |
| - 创建密钥 / 重置密钥 / 禁用密钥                                            |
| - 设定默认 RPM 速率限制与 IP 白名单                                        |
+───────────────────────────────────────────────────────────────────────────+
| [模块二: 调用监控与统计]                                                    |
| - 24 小时调用量折线图 (按接口: /agent/bind, /agent/pay, /market/prices 统计) |
| - 成功率 (200 OK vs 429 RateLimit vs 403 NoQuota)                          |
| - 平均响应耗时 (P50 / P95 / P99 毫秒)                                      |
+───────────────────────────────────────────────────────────────────────────+
| [模块三: Agent 支付与流水看板]                                             |
| - 支付渠道占比 (饼图: MON / KOL 代币 vs Stripe vs 银行卡)                  |
| - 订单上链状态 (Monad Batch Tx Hash 超链接查询)                            |
| - 交易明细表 (时间 | 商品名称 | 支付方式 | 金额 | 订单 Hash | 状态)     |
+───────────────────────────────────────────────────────────────────────────+
| [模块四: 充值与套餐中心]                                                    |
| - 3 档套餐直接选购 (支持一键使用 KOL 代币抵扣或 Stripe Checkout)           |
+───────────────────────────────────────────────────────────────────────────+
```

---

## 7. 数据库表结构极简设计 (Minimal DDL)

直接支持 PostgreSQL 与现有高可靠内存表：

```sql
-- 1. API 密钥与用户配额表
CREATE TABLE IF NOT EXISTS api_credentials (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    tier VARCHAR(32) NOT NULL DEFAULT 'STARTER_FREE',
    remaining_quota INT NOT NULL DEFAULT 0,
    free_claims_left INT NOT NULL DEFAULT 3,
    rate_limit_rpm INT NOT NULL DEFAULT 60,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agent 与钱包绑定信息表
CREATE TABLE IF NOT EXISTS agent_wallet_bindings (
    agent_id VARCHAR(64) PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    agent_name VARCHAR(64) NOT NULL,
    model_name VARCHAR(64) NOT NULL,
    wallet_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_per_tx_usd NUMERIC(18, 4) NOT NULL DEFAULT 100,
    daily_limit_usd NUMERIC(18, 4) NOT NULL DEFAULT 500,
    rate_limit_rpm INT NOT NULL DEFAULT 60,
    session_key VARCHAR(128),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Agent 支付与上链订单记录表
CREATE TABLE IF NOT EXISTS agent_payment_orders (
    payment_id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64),
    amount NUMERIC(18, 4) NOT NULL,
    item_name VARCHAR(128) NOT NULL,
    order_hash VARCHAR(66) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    payment_method VARCHAR(32) NOT NULL, -- crypto / bank / stripe
    crypto_currency VARCHAR(16),
    on_chain_tx_hash VARCHAR(66),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. 实施路径 (Incremental Implementation Steps)

根据 `AGENTS.md` 的 3% 小步快跑与本地门禁准则：

1. **Step 1: 规范与数据模型注入**：在 Go 后端中加入 `api_credentials`、`agent_bindings` 及配额统计。
2. **Step 2: 绑定与支付接口交付**：在 `backend/internal/httpapi/router.go` 挂载 `/api/v1/agent/bind` 与 `/api/v1/agent/pay`，编写单元测试。
3. **Step 3: 配额扣减与 3 次免费包发放**：实现 `free_claims_left` 校验与配额扣减拦截中间件。
4. **Step 4: 前端 Console 页面上线**：在 Next.js 构建 `/console` 仪表盘，支持密钥创建、免费包领取与支付图表展示。
5. **Step 5: 门禁验证**：执行全套 `pnpm type:lint`、`pnpm test` 及 `go test -race ./...`。
