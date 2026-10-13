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

 ✓ tests/auth-state.test.ts (47 tests) 205ms
 ✓ tests/google-callback.test.ts (14 tests) 32ms
 ✓ tests/steam-auth.test.ts (5 tests) 48ms
 ✓ tests/market-feed.test.ts (34 tests) 112ms
 ✓ tests/market-route.test.ts (23 tests) 131ms
 ✓ tests/google-auth.test.ts (20 tests) 92ms
 ✓ tests/github-auth.test.ts (5 tests) 92ms
 ✓ tests/user-profile-security.test.ts (10 tests) 86ms
 ✓ tests/performance-benchmark.test.ts (2 tests) 538ms
 ✓ tests/market-movers.test.ts (12 tests) 29ms
 ✓ tests/perp.test.ts (19 tests) 28ms
 ✓ tests/oauth-state.test.ts (6 tests) 27ms
 ✓ tests/market-independence.test.ts (29 tests) 469ms
 ✓ tests/liquidation-parity.test.ts (4 tests) 23ms
 ✓ tests/wallet-login.test.ts (16 tests) 30ms
 ✓ tests/market-no-synthetic.test.ts (13 tests) 573ms
 ✓ tests/navbar-responsive.test.ts (5 tests) 14ms
 ✓ tests/liquidation-funding-parity.test.ts (5 tests) 20ms
 ✓ tests/schema-indexes.test.ts (2 tests) 6ms
 ✓ tests/quantum-bootloader.test.ts (1 test) 29ms
 ✓ tests/api-key-db.test.ts (4 tests) 5247ms
 ✓ tests/auth-providers.test.ts (3 tests) 39ms
 ✓ tests/contact-modal.test.ts (5 tests) 53ms
 ✓ tests/console-api-keys-route.test.ts (4 tests) 8144ms

 Test Files  24 passed (24)
      Tests  288 passed (288)
   Start at  00:04:43
   Duration  10.30s (transform 5.16s, setup 0ms, import 26.63s, tests 16.07s, environment 6ms)
```

- 24 个测试文件全部通过（24/24 passed）
- 288 个测试用例全部通过（288/288 passed，新增 11 个用例）
- 5 状态错误分类、动态网关 URL、本地/生产环境配置判断及代理路由/终端组件分流全部覆盖通过。

---

## 5. Falsifier 审查意见与加固记录

根据 Falsifier 独立证伪审查（针对判据脆弱性与前置门禁缺失的攻击向量），完成以下针对性加固：

### 5.1 代理路由增加前置门禁 (`src/app/api/market/route.ts`)
- **脆弱点**：原逻辑仅在 `fetch` 抛出网络异常时的 `catch` 块中检测 `!isGoBackendConfigured()`。若生产环境网关未配，但网络环境中有代理或 mock 误返回 200，则会绕过未配置拒绝。
- **加固**：在发起 `fetch` 之前，增加前置门禁断言：
  ```ts
  if (!isGoBackendConfigured()) {
    return refuse(503, "gateway-unconfigured", `Market gateway is not configured for this environment: ${GO_BACKEND_URL}. No synthetic series is generated in its place.`, { symbol });
  }
  ```
- **AST 完整性**：503 位于 `tests/market-independence.test.ts` 的 AST 白名单（`0, 200, 400, 404, 502, 503`）内，零 AST 破损。

### 5.2 客户端适配层加固与环回正则拦截 (`src/lib/api.ts`)
- **`marketGet` 前置拦截**：在向后端发起网络请求前，直接检查 `if (!isGoBackendConfigured())`，立即短路返回 `{ ok: false, reason: "gateway-unconfigured", ... }`，阻止外发调用。
- **环回正则与 URL 解析**：将 `isGoBackendConfigured()` 中原有的简单字面量判断升级为：
  ```ts
  const trimmed = envUrl.trim();
  if (/^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|\[::1\])/i.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]" ||
      /^127\.\d+\.\d+\.\d+$/.test(host)
    ) {
      return false;
    }
  } catch {
    return false;
  }
  ```
  彻底封死 `127.0.0.2`、`[::1]` 等环回变体绕过。

### 5.3 路由攻击测试用例 (`tests/market-route.test.ts`)
- 新增攻击用例：在生产环境未配置网关（或指向 `127.0.0.2`）时，即使模拟 upstream 返回 200，route 依然在发起 `fetch` 前被前置门禁拦截并返回 503 `gateway-unconfigured`，且断言外发 `fetch` spy 从未被调用。

### 5.4 测试判据去条件化与环回全覆盖 (`tests/market-feed.test.ts`)
- 移除了所有 `if (!localRes.ok)` 等脆弱的条件式包裹断言，改为无条件断言 `expect((localRes as { reason?: unknown }).reason).toBe(...)`，防止因 `ok` 为真时断言被静默跳过。
- 补全 `127.0.0.1`、`127.0.0.2`、`0.0.0.0`、`[::1]` 等全套生产环回拦截断言。
- 增加 `marketGet` 在生产未配网关时即使 `fetch` 成功也短路拦截的断言。

---

## 6. 与 upstream/main (PR #44 ADR-006) 合流与冲突解决

### 6.1 合流背景
`upstream/main` 刚合并了 PR #44（commit `66149ea`，Track 1: ADR-006 统一报错处理体系）。本分支执行 `git merge upstream/main` 进行合流，并在保持各自责任契约与质量门禁的前提下完成冲突解决。

### 6.2 冲突解决清单
1. **`src/app/api/market/route.ts`**：
   - 导入合并：同时保留本分支新增的 `isGoBackendConfigured` 与上游引入的 `classifyStatus`，均统一从 `@/lib/api` 导入，严格遵守模块导入白名单（`@/lib/api`、`@/lib/marketFeed`、`next/server`）。
   - 保留前置门禁：在发起网络请求前，完整保留 `if (!isGoBackendConfigured()) return refuse(503, "gateway-unconfigured", ...);`。
   - 保留 catch 块分流：异常捕获中区分 `unreachable` 与 `gateway-unconfigured`。
   - 融合 ADR-006 错误信封：对于 upstream 非 2xx 响应，优先提取 `code` 与 `requestId`，经 `classifyStatus` 语义保真分类后透传状态码。
   - 严格遵循 AST 守卫：未引入任何新数字字面量，503 位于允许白名单内。
2. **`src/components/MarketTerminal.tsx`**：
   - 在 `fetchMarketData` catch 块中，统一收敛两方改动：
     ```ts
     const reasonKey = isGoBackendConfigured() ? "unreachable" : "gateway-unconfigured";
     setQuoteFailure(FAILURE_COPY[reasonKey]);
     setQuoteEnvelope(null);
     ```
   - 保留徽标基于 `!isGoBackendConfigured()` 的 `GATEWAY UNCONFIGURED` / `GATEWAY UNREACHABLE` 区分呈现。
   - 保留上游 `FailureNotice` 接收与渲染 `code` 与 `requestId` 的能力。

### 6.3 合流后全量验证结果
- `npx tsc --noEmit`：退出码 0，全仓类型检查无错误。
- `npx vitest run tests/market-independence.test.ts`：29/29 测试用例全部通过，AST 守卫与零合成数据结构约束 100% 保持。
- `npm test`：25 个测试文件、314 个测试用例全部通过（25/25 passed, 314/314 passed）。



