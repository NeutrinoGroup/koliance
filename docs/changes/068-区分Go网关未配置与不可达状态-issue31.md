# 068 — 区分 Go 网关未配置与不可达状态（issue #31）

> **环**：02 开发（前端 `src/` 与 `tests/`）
> **来源**：Issue #31 `Market 模块区分 Go 网关未配置与不可达`
> **先写后填**：本文在改动前立；§4 落地后回灌 `tsc --noEmit` 与 `npm test` 的真实 stdout。

---

## 1. 缺陷定位与现状分析

在之前的实现中，前端 Market 模块对于请求 Go 网关失败的情况仅有一层通用的捕获处理，通常统一归类为 `unreachable`（“后端不可达”）。其展示的文案为：
```
未能连接到 Go 网关（默认 http://localhost:8080）；请确认后端进程已启动。
```

然而在实际部署（特别是 Vercel 生产环境）中，存在两种本质完全不同的故障场景：
1. **网关未配置 (`gateway-unconfigured`)**：在生产环境中，环境变量 `NEXT_PUBLIC_GO_BACKEND_URL` 未配置，或者被直接套用了 `.env.example` 中的 `http://localhost:8080`（线上前端/服务端无法访问客户端本地回环）。此时并非后端服务崩溃或离线，而是前端缺少有效的公网 Go 网关地址配置。向用户提示“确认后端进程已启动”误导性极高。
2. **网关不可达 (`unreachable`)**：已正确配置了对应环境的网关地址（如本地开发时的 `http://localhost:8080` 或生产环境已配置的公网 API 域名），但向该地址发起网络请求时出现连接被拒（`ECONNREFUSED`）、超时或网络断开。此时才是真正的后端服务未启动或网络故障。

此外：
- `FAILURE_COPY.unreachable` 的文案中硬编码了 `(默认 http://localhost:8080)`，当开发者配置了非默认端口（如 `http://localhost:18099`）或公网域名时，文案无法动态反映实际的目标地址。
- `.env.example` 缺少对本地开发与生产部署配置差异的明确说明，容易导致开发者直接照抄本地地址到线上环境。

---

## 2. 方案设计与分流逻辑

### 2.1 环境判断与网关配置状态检测 (`src/lib/api.ts`)
- **`isLocalEnvironment(): boolean`**：
  - 浏览器端：检测 `window.location.hostname` 是否为 `localhost`、`127.0.0.1`、`0.0.0.0`、`::1` 或 `*.local`。
  - 服务端/Node：检测 `process.env.NODE_ENV !== "production"`。
- **`isGoBackendConfigured(): boolean`**：
  - 非本地（生产）环境：`NEXT_PUBLIC_GO_BACKEND_URL` 必须显式配置，且不能包含 `localhost` / `127.0.0.1` / `0.0.0.0` / `::1` 等本地回环地址。
  - 本地环境：默认 `http://localhost:8080` 有效，除非被显式设置为空字符串。
- **`MarketFetchReason` 扩充**：
  从 4 种状态扩充为 5 种状态：
  `"not-configured" | "gateway-unconfigured" | "upstream-error" | "unreachable" | "invalid-symbol"`
- **`marketGet` catch 分流**：
  在 `fetch` 抛出异常时，根据 `isGoBackendConfigured()` 判定为 `"unreachable"` 还是 `"gateway-unconfigured"`。

### 2.2 失败文案与动态 URL (`src/lib/marketFeed.ts`)
- `FAILURE_COPY` 补充 `"gateway-unconfigured"`：
  - `headline`: `"Go 网关未配置"`
  - `action`: `"环境变量 NEXT_PUBLIC_GO_BACKEND_URL 未配置或指向本地地址；生产环境请配置有效的 Go 后端服务地址。"`
- `FAILURE_COPY.unreachable` 动态拼接 `${GO_BACKEND_URL}`：
  - `action`: ``未能连接到 Go 网关（${GO_BACKEND_URL}）；请确认后端进程已启动。``

### 2.3 代理路由区分处理 (`src/app/api/market/route.ts`)
- `upstream` fetch 抛出异常时，检查 `isGoBackendConfigured()`：
  - 若未配置：返回 HTTP 503 与 `reason: "gateway-unconfigured"`。
  - 若已配置但不可达：返回 HTTP 502 与 `reason: "unreachable"`。

### 2.4 终端组件 catch 区分 (`src/components/MarketTerminal.tsx`)
- `fetchMarketData` catch 分支：使用 `isGoBackendConfigured() ? "unreachable" : "gateway-unconfigured"` 获取对应的 `FAILURE_COPY`。
- 顶部徽标 `badge` 相应细化：不可达且未配置时提示 `"GATEWAY UNCONFIGURED"`（amber），已配置不可达时提示 `"GATEWAY UNREACHABLE"`（red）。

### 2.5 配置指南完善 (`.env.example`)
- 注释明确区分本地开发（默认 `http://localhost:8080`）与生产部署（必须配置公网 HTTPS 域名，警告禁止照抄 localhost）。

---

## 3. 改动清单

| 文件 | 改动说明 |
| --- | --- |
| `src/lib/api.ts` | 增加 `isLocalEnvironment()`、`isGoBackendConfigured()`；扩充 `MarketFetchReason` 为 5 态；`marketGet` 捕获异常区分两态 |
| `src/lib/marketFeed.ts` | `FAILURE_COPY` 补充 `gateway-unconfigured`；`unreachable` 动态拼接 `GO_BACKEND_URL` |
| `src/app/api/market/route.ts` | 扩充 `RouteReason`；fetch 失败捕获区分 `gateway-unconfigured` (503) 与 `unreachable` (502) |
| `src/components/MarketTerminal.tsx` | `fetchMarketData` catch 区分两种状态；徽标状态细化 |
| `.env.example` | 完善 `NEXT_PUBLIC_GO_BACKEND_URL` 本地 vs 生产部署指引与防踩坑说明 |
| `tests/market-feed.test.ts` | 更新 5 状态断言、动态 URL 断言、环境与配置判断单元测试 |
| `tests/market-route.test.ts` | 增加生产未配置/指向 localhost 时的 `gateway-unconfigured` 503 拒绝测试 |

---

## 4. 验证命令与结果回灌

### 4.1 TypeScript 类型静态检查 (`npx tsc --noEmit`)
```
$ npx tsc --noEmit
Proxy enabled
Exit code: 0 (clean, no errors)
```

### 4.2 前端全量测试套件 (`npm test`)
```
$ npm test

 ✓ tests/google-callback.test.ts (14 tests) 38ms
 ✓ tests/market-feed.test.ts (34 tests) 92ms
 ✓ tests/steam-auth.test.ts (5 tests) 44ms
 ✓ tests/market-route.test.ts (21 tests) 106ms
 ✓ tests/auth-state.test.ts (47 tests) 201ms
 ✓ tests/google-auth.test.ts (20 tests) 96ms
 ✓ tests/github-auth.test.ts (5 tests) 64ms
 ✓ tests/user-profile-security.test.ts (10 tests) 84ms
 ✓ tests/performance-benchmark.test.ts (2 tests) 481ms
 ✓ tests/market-movers.test.ts (12 tests) 32ms
 ✓ tests/wallet-login.test.ts (16 tests) 29ms
 ✓ tests/market-no-synthetic.test.ts (13 tests) 567ms
 ✓ tests/liquidation-funding-parity.test.ts (5 tests) 22ms
 ✓ tests/perp.test.ts (19 tests) 29ms
 ✓ tests/liquidation-parity.test.ts (4 tests) 35ms
 ✓ tests/market-independence.test.ts (29 tests) 595ms
 ✓ tests/navbar-responsive.test.ts (5 tests) 13ms
 ✓ tests/oauth-state.test.ts (6 tests) 23ms
 ✓ tests/schema-indexes.test.ts (2 tests) 7ms
 ✓ tests/api-key-db.test.ts (4 tests) 2776ms
 ✓ tests/quantum-bootloader.test.ts (1 test) 36ms
 ✓ tests/auth-providers.test.ts (3 tests) 49ms
 ✓ tests/contact-modal.test.ts (5 tests) 58ms
 ✓ tests/console-api-keys-route.test.ts (4 tests) 6859ms

 Test Files  24 passed (24)
      Tests  286 passed (286)
   Start at  23:47:56
   Duration  9.04s (transform 5.48s, setup 0ms, import 28.49s, tests 12.34s, environment 6ms)
```

- 24 个测试文件全部通过（24/24 passed）
- 286 个测试用例全部通过（286/286 passed，新增 9 个用例）
- 5 状态错误分类、动态网关 URL、本地/生产环境配置判断及代理路由/终端组件分流全部覆盖通过。

