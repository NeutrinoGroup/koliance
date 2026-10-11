# Koliance Go Backend Service

Koliance 的高性能 Go 后端服务，负责处理链下索引、元数据缓存、信任图谱分析与高速 REST/GraphQL API。

## 目录结构
```
backend/
├── cmd/
│   └── api/
│       └── main.go       # HTTP API 服务入口 (内置 CORS 与标准路由)
├── internal/
│   ├── model/            # 数据结构 (与 Koliance.sol 严格对齐)
│   ├── indexer/          # 链上事件监听器 (规划集成 go-ethereum)
│   └── service/          # 业务逻辑与图谱计算
├── go.mod
└── README.md
```

## 运行方式
```bash
cd backend
go run cmd/api/main.go
```
服务将在 `http://localhost:8080` 启动，默认包含：
- `GET /api/v1/health` - 服务与 Monad 节点健康状态
- `GET /api/v1/stats` - 链上身份与信任总览统计
- `GET /api/v1/identities/:address` - 身份详情查询

## 与 Next.js 前端连接
前端 `src/lib/api.ts` 已内置适配器，只需在前端 `.env.local` 设置：
```env
NEXT_PUBLIC_GO_BACKEND_URL=http://localhost:8080
```
前端即可自动平滑切换至 Go 极速索引器服务。

## 访问控制与配置（安全加固）

| 类别 | 端点 | 凭证 |
|---|---|---|
| 公开（只读） | `health`、`stats`、`game/steam/profile`、`developer/github/profile`、`market/overview`、`market/prices`、`market/movers`、`market/health` | 无（`market/*` 另需 Alpaca 凭证，见下） |
| 公开（演示写入，参数严格校验） | `agentcard/generate`、`game/proof`、`developer/github/proof`、`stripe/checkout-session` | 无 |
| 卡主 | `GET agentcard/cards/{id}`、`agentcard/session-key`、`agentcard/authorize`（不带 sessionKey 时） | `Authorization: Bearer <cardToken>`（只在 `generate` 响应中返回一次，服务端仅存 SHA-256） |
| Agent | `agentcard/authorize`（带 sessionKey） | 为**该卡**签发的 `sk_sess_…` |
| 运营方 | `agentcard/batch-settle`、`stripe/customer`；以及 `market/trade`、`market/close`（除非 `DEMO_PUBLIC_TRADING=true`） | `Authorization: Bearer $KOLIANCE_API_TOKEN`；未配置时返回 503（fail closed） |

- 卡片接口不再返回完整卡号与 CVV，只返回 `formattedNumber`（`4928 **** **** 1234`）与 `last4`；`cardId` 为随机值，不再由卡号派生。
- 所有动账金额必须是有限正数且不超过 100000。
- 环境变量：
  - `CORS_ALLOWED_ORIGINS`：逗号分隔的精确 origin 列表，默认 `https://koliance.oodai.space,http://localhost:3000,http://127.0.0.1:3000`，不支持 `*`。
  - `KOLIANCE_API_TOKEN`：运营方令牌。
  - `DEMO_PUBLIC_TRADING`：`true` 时允许浏览器直接下 Alpaca 模拟盘订单（仍有参数上限），默认 `false`。
  - `ALPACA_API_KEY` / `ALPACA_API_SECRET`：**无默认值**（此前回退到仓库里提交过的密钥，等于泄漏 + 把误配置伪装成可用）。**未配置时 `/api/v1/market/*` 一律 503**，不做任何合成降级。
  - `ALPACA_DATA_URL`：行情数据主机，默认 `https://data.alpaca.markets`（**不是** `ALPACA_BASE_URL` 的 paper-api 主机——两者是不同服务）。
  - `ALPACA_DATA_FEED`：行情 feed，默认 `iex`（免费层可用；`sip` 需付费订阅，否则一律 403）。

## 市场数据端点（issue #14 / #16）

| 端点 | 返回 |
|---|---|
| `GET /api/v1/market/health` | 行情子系统自检：`configured`、`alpaca` 最近一次调用的结果、`priceOracle` 的实探结果（含 `instruments` 计数）。**未配置凭据时返回 200 + `configured:false`**，因为它必须能报告"没配"这个事实 |
| `GET /api/v1/market/prices` | 各标的真实 Alpaca 日线派生价（含 `previousClose` / `change` / `changePercent` / `source` / `synthetic:false`），按 symbol 排序 |
| `GET /api/v1/market/movers` | **标的涨跌幅排行**（issue #16）：`gainers`（降序）/ `losers`（升序）/ `unchanged` / `unrankedCount` |
| `GET /api/v1/market/overview` | 账户 + 持仓 + 上述价格 + `movers`（排行复用同一批数据，不额外请求） |

- 涨跌幅取 `GET {ALPACA_DATA_URL}/v2/stocks/bars?timeframe=1Day&limit=2&sort=desc`：**两根日线**才够算"涨跌"（Alpaca 的 bar 不含前收字段）。
- 排序一律带 **symbol 升序**做 tie-break——上游 bars 是 JSON object，Go 侧即 map，**迭代顺序随机**，不钉死就会让排行榜每次刷新换位。
- 无前收（只有一根 bar）的标的计入 `unrankedCount`，**不进 `unchanged`**：「没动」与「不知道动没动」是两回事。

`/health` 的 `steam` / `github` / `alpaca` / `pyth` 四个键是**真探活**（此前写死 `true`），并行执行、4s 超时、20s 缓存（Render 会高频 ping `/healthz`，逐次探活会打光 GitHub 匿名配额），并附 `degraded` 列表与 `probes` 明细。**`status` 恒为 `healthy`、HTTP 恒 200**：数据源降级是**可观测**，不是**致命**——`/healthz` 是 Render 的 `healthCheckPath`，让它因上游降级而判死会摘掉整个服务。
