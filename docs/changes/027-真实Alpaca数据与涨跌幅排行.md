# 027 — GAP-13 / #14 / #16：market 真实 Alpaca 数据接入 + 标的涨跌幅排行 + `/health` 探针去伪

- **日期**：2026-10-11（UTC）
- **环**：02 开发 + 03 测试（01 设计无新决策：未引入依赖、未改路由形状、未改链上契约）
- **类型**：既有缺陷修复（**数据源取证 + fail-closed 改造 + 新端点 + 探针去伪**）
- **关联**：**GAP-13**（`/health` 伪指标 —— 部分关闭：`alpaca`/`pyth`/`steam`/`github` 四个键改为真探活；
  「后端零链上交互」部分**不在本次范围**，见 §未做）· **GAP-12**（凭证硬编码 —— 本次删掉 Alpaca 两处默认值）
  · **GAP-14**（合成行情 —— 后端侧本次关闭；**前端 `/api/market` 的合成路径仍 🔴**，转 **GAP-52**）
  · 需求来源：作者 issue **#14**（Mock → 真实数据）、**#16**（市场页：真实 Alpaca 数据分析、标的涨跌幅排行）
- **分支**：`feat/real-alpaca-data`

> **状态：先写后填（本文件在动手前立）**。§验证 一节为落地后回填的**实测 stdout**。

---

## 1. 取证：哪些是合成的（源码实测，不凭文件名）

**结论：`backend/internal/market/` 里没有一行本地合成/随机数据。** 三个文件逐函数判定：

| 文件:行 | 函数 | 判定 | 依据（实测） |
| --- | --- | --- | --- |
| `alpaca_client.go:84` | `doRequest` | **真实** HTTP | `net/http` 打到 `c.baseURL`（= `ALPACA_BASE_URL`，默认 paper-api） |
| `alpaca_client.go:122/136/150/171` | `GetAccount` / `GetPositions` / `CreateOrder` / `ClosePosition` | **真实** | 分别 GET `/account` · GET `/positions` · POST `/orders` · DELETE `/positions/{sym}` |
| `oracle_pyth.go:62` | `GetAllPrices` | **真实**（**但名字说谎**） | GET `https://data.alpaca.markets/v2/stocks/bars/latest?symbols=NVDA,AAPL,TSLA,SPY` —— **是 Alpaca，不是 Pyth** |
| `oracle_pyth.go:48` | `GetLatestPrice` | **真实** | 复用 `GetAllPrices` 后在内存里筛选 |
| `service.go:46/62/102/106` | `GetMarketOverview` / `ExecuteTrade` / `ClosePosition` / `GetPrice` | **真实** | 全部转发给上面两个客户端 |

`grep -n "math/rand\|rand\.\|Mock\|fake" backend/internal/market/` → **空**（本文件 §验证 有实测命令）。

**真正的「合成」在两处，且都不在 `internal/market`**：

| # | 位置 | 症状 | 本次是否修 |
| --- | --- | --- | --- |
| S1 | `backend/internal/httpapi/router.go:76` | `/health` 把 `"alpaca"` 与 `"pyth"`（还有 `"steam"`、`"github"`）**写死 `true`** —— 没配密钥、上游全挂也报 true | ✅ 本次修（GAP-13 的伪指标部分） |
| S2 | `src/app/api/market/route.ts`（前端） | 上游失败时**本地生成**价格序列并 `source:"synthetic_fallback"` 返回；`MON-USD` 走 `synthetic_curated`；`FALLBACK_MARKET_DATA` 里 NVDA 142.80 等是**硬编码常量** | ⬜ **不在本次范围**（前端组件/路由另派），转 **GAP-52** |

**S2 的证据（实测）**：该文件已有 `synthetic`/`dataCaveat` 字段（`docs/changes/018` 的工作），
即**它自己承认是合成的** —— 所以「伪装成实时」这个缺陷在前端侧**已被标注**，但**数据仍是合成**，
与 #14「替换为真实数据」的诉求仍有差距。**必须与后端侧分开登记**，否则两处不同成熟度（D4）。

**第二个缺口（同族，本次一并修）**：**凭据缺失时的行为没有定义**。

```
config.go:56   AlpacaAPIKey:    getEnv("ALPACA_API_KEY",    "<提交过的真实密钥，此处已打码>")
config.go:57   AlpacaAPISecret: getEnv("ALPACA_API_SECRET", "<同上>")
```

> **为什么打码而不是照抄**：把值抄进本文件会让**一次新提交重新包含该密钥**，
> 按 `.gitleaksignore` 的说明，那是**新指纹**，CI 的 secrets 作业会直接红。
> 修密钥泄漏的动作本身若泄漏一次密钥，等于没修。需要看原文请 `git show` 历史版本。

**密钥被当成 `getEnv` 的默认值**（`ADR-005` 已点名）。于是：未配 env 时不是「明确失败」，
而是拿**仓库里泄漏的旧密钥**去打真实 API —— 失败则前端拿到合成数据。**这是 #14 的核心诉求所在**：
「凭据缺失」必须是一个**可观测、可阻断**的状态，而不是一条通往合成数据的暗道。

---

## 2. 做了什么

### 2.1 银弹：`ALPACA_API_KEY` / `ALPACA_API_SECRET` 缺失 → **fail closed（503）**

- `config.go`：两处**硬编码默认值删除**（GAP-12 的一部分），并新增 `Config.AlpacaConfigured()`；
  `Load()` 在凭据缺失时打印明确日志（**不是** warning 后继续跑）。
  > **并发陷阱，实测踩到**：`SteamAPIKey` / `StripePublishableKey` 的默认值**本次不改**
  > （超出范围），故 `config.go` 现在**同时存在**「有默认值」与「无默认值」两种写法——
  > 这正是 README 里「凭证泄露已成事实、必须人工轮换」那句话**仍然成立**的原因，
  > `deploy/README.md` §0 已按此更新（此前那张表说 Alpaca 两项是"明文"，
  > 在本次改动后**已过期**，属 D4 的两处不同成熟度）。
- `market` 包新增哨兵错误 `ErrAlpacaCredentialsMissing`，**所有**上游入口首先校验凭据：
  `AlpacaClient.doRequest` · `PriceOracle.GetAllPrices`。缺失即返回该错误，**不返回任何行情**。
- 路由新增中间件 `marketData`：`!cfg.AlpacaConfigured()` → **503** + 明确文案，
  作用于 `/api/v1/market/{overview,prices,movers}`；**但 `/api/v1/market/health` 不设门**
  （它必须能报告 `configured:false` 这个事实）。
- `trade`/`close` 保持既有 `trading` 守卫在**外层**（否则会顶掉 `router_test.go` 的 401/503 断言），
  并在错误包装里识别哨兵错误 → **503**（而不是 200 + `success:false`）。

**这条的性质**：它把「拿不到真实数据」变成**一个响亮的状态**，而不是一次静默降级。
「不返回合成数据」不是靠自觉，是**结构上没有合成数据可返回**（`internal/market` 里没有任何生成器）。

### 2.2 涨跌幅排行（#16 的「标的涨跌幅排行」）

**数据来源**（真实）：把 `bars/latest`（单条最新 bar）换成**同一族**的
`GET {ALPACA_DATA_URL}/v2/stocks/bars?symbols=…&timeframe=1Day&limit=2&sort=desc&feed=iex`
—— 每标的取最近 **2 根日线**，于是「最新收盘」与「前一交易日收盘」**来自同一次请求**。

> 换端点的理由：「涨跌幅」在数学上需要**两个点**，`bars/latest` 只给一个；
> 而 Alpaca 的 bar 对象**不含** `pc`（previous close）字段 —— 靠单条 bar 算不出涨跌幅。
> 用 `limit=2&sort=desc` 拿两根，比「`bars/latest` + 另一路取前收」少一次往返、且两点同源。

计算（`market.ChangeFromBars`，纯函数、可测）：

```
change        = lastClose - prevClose
changePercent = change / prevClose * 100      // prevClose <= 0 → 不参与排行
```

排行（`market.RankMovers`，**纯函数**）：

| 桶 | 规则 | 排序 |
| --- | --- | --- |
| `gainers` | `changePercent > 0` | 降序（涨得最多在前） |
| `losers` | `changePercent < 0` | 升序（跌得最惨在前） |
| `unchanged` | `changePercent == 0` | 按 symbol 升序 |
| `unranked` | 无前收（`prevClose <= 0`）→ **不计入任何桶**，只计数 | — |

**决定性细节**：Alpaca 的 bars 是 **map**（`map[string][…]Bar`），**Go map 迭代顺序随机**。
故所有排序都带 **symbol 升序**做 tie-break —— 否则同涨跌幅的两只标的会在两次请求间换位，
而前端是一个「排行榜」。`unranked` 显式计数，而不是把「算不出涨跌幅」混进 `unchanged`
（那是**两个不同的事实**：一个是真的没动，一个是不知道）。

`Movers` 顶层带 `source:"alpaca_daily_bars"` · `synthetic:false` · `asOf`，让「真数据」也是机器可读的。

### 2.3 `/health` 探针去伪（GAP-13 的伪指标部分）

四个写死 `true` 的键改为**真实探活**，并行、带超时、**失败即 `false`**：

| 键 | true 的语义（严格定义） | 探针 |
| --- | --- | --- |
| `alpaca` | 用**已配置凭据**能读到 Alpaca 行情 bar | 复用 `PriceOracle.PriceChange`（`…/v2/stocks/bars?…&limit=2`）→ 200 **且至少一根 bar 有收盘价** |
| `pyth` | Hermes `/v2/updates/price/latest` 返回**可解析**的价格 | 同一 `PYTH_HERMES_URL`，feed id 与 `src/lib/perpConfig.ts:148` 同源（BTC/USD） |
| `steam` | 用**已配置 key** 调 Steam Web API 并**取回玩家档案**（403 = key 无效） | `ISteamUser/GetPlayerSummaries/v0002/?key=…&steamids=…` |
| `github` | GitHub API 可达 **且剩余配额 > 0** | `GET https://api.github.com/rate_limit` → `core.remaining > 0` |

- `steam`/`github` 的**语义升级**是刻意的：`200` 只证明「网络通」，而这两个端点的成败取决于
  **key/配额**。旧代码的 `true` 恰恰是「网络通」这个更弱命题被当成「能给出真数据」。
- 响应**新增** `degraded: [失败的键]` 与 `probes: {键: {ok, latencyMs, error}}`。
  **`status` 仍为 `"healthy"`、HTTP 仍 200** —— `/healthz` 是 Render 的 `healthCheckPath`，
  让它因**数据源**降级而被判死会**摘掉整个服务**（前端也探它）。数据源的降级是**可观测**，不是**致命**。
- 探针**并行**（各自 goroutine + 4s 超时），故 `/health` 的延迟 ≈ 最慢的一个探针，不是四个之和；
  结果经**带缓冲 channel** 回传，故超时被放弃的 goroutine 仍能安全退出（**不是**共享变量 —— 那在
  "上游挂起"这条路径上就是数据竞争，而"上游挂起"正是 `/health` 存在的理由）。
- 探针结果**缓存 20s**（`probeTTL`）：Render 高频 ping `/healthz`，逐次探活会打光 GitHub 的
  60 次/小时匿名配额，**进而打断应用自己的 GitHub 功能**；缓存带上 `cached`/`ageMs` 两个字段，
  保证"这条判断是**近期**真实调用的结果"这点仍然可查。见 §4.1 的实测依据。
- 探针**绝不返回合成真值**：未配置凭据 → `false`（不是 `true`，也不是"跳过"）。

### 2.4 其余一致性改动

- **Context 贯穿**：`AlpacaClient` / `PriceOracle` / `market.Service` 的四个方法全部接受 `ctx`
  （原来 `doRequest` 用的是 `http.NewRequest`，**不带 ctx** —— 客户端断连后上游请求仍在跑）。
  路由传 `r.Context()`。HTTP 路径与响应形状**不变**。
- `realtimePrices` 的 `confidence` 字段：Alpaca **不提供**置信区间。旧值 `0.01` 是**编的**；
  改为 `0` 并在注释里写明「该字段对 Alpaca 无意义，仅为保持既有响应形状」。
- 价格列表按 symbol 排序（原来是 map 随机顺序 —— 下拉/列表每次刷新换位置）。
- `PYTH_HERMES_URL` 从「配了但从未被调用」变为**真的被调用**（探针）。

## 3. 文件清单

| 文件 | 内容 |
| --- | --- |
| `backend/internal/config/config.go` | 删 Alpaca 两处硬编码默认值 · `AlpacaConfigured()` · `AlpacaDataURL`/`AlpacaDataFeed` · 缺失时的明确日志 |
| `backend/internal/market/alpaca_client.go` | ctx 贯穿 · 凭据哨兵错误 · 错误/成功记录（供探针取真）· `Health(ctx)` |
| `backend/internal/market/price_oracle.go` | **新增**：`PriceOracle`（真实 Alpaca bars）+ 涨跌幅字段 + `SetDataBaseURL`/`SetFeed`/`SetHTTPClient`（沿用 `game.Service` 的可测注入惯例） |
| `backend/internal/market/oracle_pyth.go` | **删除**：其内容一分为二 —— 真实 HTTP 部分迁入 `price_oracle.go`，文件名/类型名的误导写进文件头注释与 GAP-52 |
| `backend/internal/market/ranking.go` | **新增**：`InstrumentChange` / `Movers` / `RankMovers` / `MoversFromPrices`（纯函数） |
| `backend/internal/market/service.go` | `PythPriceData` 增 `previousClose`/`change`/`changePercent`/`source`/`synthetic` · `MarketOverview` 增 `movers` · `GetMovers(ctx)` · `GetDataHealth(ctx)` |
| `backend/internal/httpapi/health.go` | **新增**：`marketData` 中间件 + `runProbe`/四探针并行 + 20s 探针缓存 |
| `backend/internal/httpapi/router.go` | `/health` 用真探针 · `/api/v1/market/*` 挂 `marketData` · **新增** `/api/v1/market/movers` 与 `/api/v1/market/health` · trade/close 的哨兵错误 → 503 |
| `backend/cmd/api/main.go` | 装配 `AlpacaDataURL`/feed，打印凭据是否配置（**不打印值**） |
| `backend/internal/market/market_test.go` | **新增 26 例**：排行正/负向 · 真实 bars 解析 · 无凭据零返回 · 上下文取消 · 探针状态机 |
| `backend/internal/httpapi/market_test.go` | **新增 16 例**：无凭据 503 且**无载荷** · 真实透传 · `/health` 四键有牙 · 探针缓存命中与过期 |
| `backend/internal/config/config_test.go` | **新增 4 例**：凭据无默认值 · 半套凭据不算配置 · 数据主机 ≠ 交易主机 |
| `backend/README.md` | 访问控制表补两个新端点 · 环境变量与 `market/*` 的 fail-closed 口径 |
| `render.yaml` | 补 `ALPACA_DATA_URL` / `ALPACA_DATA_FEED` / `PYTH_HERMES_URL`（**值，非密钥**）；`ALPACA_API_KEY`/`SECRET` 保持 `sync:false` |
| `docs/GAP台账.md` | GAP-12 部分关闭 · GAP-13 探活部分关闭 · GAP-14 后端侧关闭 · **新开 GAP-52/53** |

---

## 4. 验证（落地后回填，真实 stdout）

工作目录 `koliance/backend`，本机 Windows 10 + `go version go1.25.7 windows/amd64`（`go.mod` 声明 `go 1.25.0`）。

| 命令 | 结果 |
| --- | --- |
| `go build ./...` | **exit 0** |
| `go vet ./...` | **exit 0** |
| `go test ./...` | **exit 0**（全包 ok） |
| `go test -race ./...` | **exit 0** |
| `go test -v -count=1 ./...` | **196 PASS / 0 FAIL**（`--- PASS` 计数含子测试） |
| `gofmt -l ./internal/httpapi/ ./internal/market/ ./internal/config/` | **空输出** |
| `git grep -n FALSIFY -- backend` | **空输出**（无残留标记） |

**用例数（对照 `9674f53` 的干净 worktree 实测，非推算）**：

| 包 | 基线 | 现在 | 新增 |
| --- | --- | --- | --- |
| `internal/market` | **0**（`[no test files]`） | **26 PASS / 0 FAIL** | **+26** |
| `internal/httpapi` | **14 PASS** | **30 PASS / 0 FAIL** | **+16** |
| 后端合计 | **150 PASS** | **196 PASS / 0 FAIL** | **+46** |

> **「这个包过去零测试」是本次实测出来的，不是印象**：基线 worktree 里 `go test ./...` 输出
> `? github.com/koliance/backend/internal/market [no test files]` —— 即整个 market 数据路径
> （账户/持仓/下单/行情）**一行被测代码都没有**，而它是 `/market` 页面的全部数据来源。

### 4.1 端到端实测（真实进程、真实网络，无凭据）

`PORT=18099`、**不设** `ALPACA_API_KEY`/`ALPACA_API_SECRET`（工作区无 `.env`，实测 `Test-Path` 三处皆 absent）：

```
GET /healthz  -> 200
{"degraded":["alpaca","pyth"],
 "probes":{"steam":{"ok":true,"latencyMs":2777,"detail":"profile 76561197960435530 read"},
           "github":{"ok":true,"latencyMs":1383,"detail":"rate limit 7/60 remaining"},
           "alpaca":{"ok":false,"latencyMs":0,"error":"ALPACA_API_KEY/ALPACA_API_SECRET not set"},
           "pyth":{"ok":false,"latencyMs":1528,"error":"hermes status 401"}},
 "services":{"agentcard":true,"alpaca":false,"database":false,"github":true,"pyth":false,"steam":true,"stripe":false},
 "status":"healthy","timestamp":"2026-10-11T12:51:11.4602915Z"}

GET /api/v1/market/movers -> 503（**响应体为空**，无任何价格字段）
GET /api/v1/market/health -> 200
{"configured":false,"alpaca":{"observed":false,"ok":false},
 "priceOracle":{"ok":false,
   "error":"alpaca credentials not configured: set ALPACA_API_KEY and ALPACA_API_SECRET (no synthetic market data is served)",
   "symbols":["NVDA","AAPL","TSLA","SPY"],"instruments":0},
 "source":"alpaca_daily_bars","synthetic":false}
```

进程启动日志（**只打印是否配置，不打印值**）：

```
   ├─ Alpaca Paper API: Active (https://paper-api.alpaca.markets/v2), credentials configured: false
   ├─ Alpaca Market Data: https://data.alpaca.markets (feed iex) — /api/v1/market/* fails closed (503) without credentials
```

**探针缓存同场实测**（同一进程，相隔 1.1s 的两次 `GET /healthz`）：

```
第 1 次：steam{ok:true,latencyMs:751} github{ok:true,latencyMs:979,"rate limit 30/60 remaining"} alpaca{ok:false} pyth{ok:false,"hermes status 401"}
第 2 次：四个探针全部 "cached":true,"ageMs":1100 —— 总耗时 ~120ms（第 1 次 ~1s）
```

**这次实测抓到两个只有真跑才会暴露的问题**（都已修，见 §2.3 与 `health.go` 注释）：

1. **3s 探针超时不够**：Steam 探针第一次实测 **2777ms**（占 3s 预算的 92%；同一端点第二次 751ms）。
   正常条件下超时会把一个健康集成报成坏的，而**会抖的 degraded 列表等于没人看**。已放宽到 4s。
2. **GitHub 匿名配额 60 次/小时**：两次实测读到 `remaining 7/60` 与 `30/60`——**确实在被消耗**。
   Render 会高频 ping `/healthz`；**逐次探活会打光配额，然后连带打断应用自己的 GitHub 功能**
   （GAP-47 就在这条链上）。已加 **20s 探针缓存**（上面就是它的实测），并新增
   `TestHealthProbeCacheIsUsedAndExpires`（既验证命中，**也验证过期**——永不过期的缓存
   等于把一次失败永久钉住，是同一个缺陷的反方向）。

### 4.2 `[未能验证]` —— 真实 Alpaca 数据（诚实标注，未伪装）

**本次未能跑通带凭据的真实 Alpaca 调用**，原因是凭据不可得：
`ALPACA_API_KEY`/`ALPACA_API_SECRET` 在本机、在 CI、在本次会话都**没有配置**
（`render.yaml` 里两者是 `sync:false`，只存在于 Render 控制台）。

已**实测**的部分（证明网络路径真的存在，且未配凭据确实被拒）：

| 探测 | 命令 | 实测 |
| --- | --- | --- |
| Alpaca 行情端点可达 | `GET https://data.alpaca.markets/v2/stocks/bars/latest?symbols=NVDA,AAPL` | **HTTP 401**（端点存在、要求认证） |
| Pyth Hermes 可达 | `GET https://hermes.pyth.network/v2/updates/price/latest?ids[]=crypto.BTC%2FUSD`（也试了 `0xe62df6c8…`） | **HTTP 401**（未知是需 API key 还是本机网络被挡；`hermes.go` 走同一 URL） |
| GitHub 可达 | `GET https://api.github.com/rate_limit` | **200** |
| Steam 可达 | `GET https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/` | **200** |

**待人工在有凭据的环境执行（这些是唯一能证明"真实数据接入"的命令）**：

```powershell
# 1) 配好凭据后启动（PowerShell：env 变量在此进程内有效）
$env:ALPACA_API_KEY="<key>"; $env:ALPACA_API_SECRET="<secret>"; cd backend; go run cmd/api/main.go
# 2) 期望：以下三条均为 200，且数字来自 Alpaca（不是本地生成）
curl.exe http://localhost:8080/api/v1/market/prices
curl.exe http://localhost:8080/api/v1/market/movers   # 期望 gainers/losers 非空、synthetic=false
curl.exe http://localhost:8080/api/v1/market/health   # 期望 configured=true, priceOracle.ok=true, instruments=4
# 3) /health 的 alpaca 键期望 true，degraded 不含 "alpaca"
curl.exe http://localhost:8080/healthz
```

**未验证项的边界（写清楚，免得被读成已验证）**：协议形状（`bars` 为
`{symbol: [bar…]}`、`limit=2&sort=desc&timeframe=1Day`、`feed=iex`）**取自 Alpaca 公开文档**，
并由 httptest 桩**逐字段对拍**（`TestPriceOracleDerivesChangeFromTwoDailyBars` 断言了
请求 query 的四个参数与响应解析）；但**没有一次真实 200 响应**证明这些参数被真实端点接受。
若首次真跑发现参数名/形状不符，改动点集中在 `price_oracle.go` 一处（`PriceChange`）。

### 4.3 负向证伪（D3，逐条真跑，跑完即还原）

每条都是「注入一个具体缺陷 → 指定用例必红」。**6/6 全部真红，且抓到的都是该缺陷而非别的**：

| # | 注入 | 命令 | 实测结果（摘） |
| --- | --- | --- | --- |
| **F1** | `marketData` 在无凭据时**合成一条行情**返回 200 | `go test ./internal/httpapi/ -run "Refuse\|MarketHealth"` | **exit 1**：`GET /api/v1/market/overview without credentials: 200, want 503` + `leaked market payload "150": [{"change":10,…}]`（**三条路径全中**） |
| **F2** | `RankMovers` **去掉 symbol tie-break** | `go test ./internal/market/ -run "Stable\|Tie"` | **exit 1**：`round 4: ordering changed with input order  want [ZZZZ AAAA MMMM]  got [AAAA MMMM ZZZZ]` |
| **F3** | `/health` 的 `alpaca` 键**改回写死 `true`** | `go test ./internal/httpapi/ -run Health` | **exit 1**：4 条用例红，含 `services.alpaca = true although the data upstream is unreachable`、`… on HTTP 200 with an empty bars object`、`… without credentials` |
| **F4** | `probeAlpaca` 把「200 但 0 根 bar」当成功 | `go test ./internal/httpapi/ -run "EmptyBars"` | **exit 1**：`services.alpaca = true on HTTP 200 with an empty bars object` |
| **F5** | `RankMovers` 把 **unknown 涨跌幅**当 0 一并排进 `unchanged` | `go test ./internal/market/ -run Unknown` | **exit 1**：`unrankedCount = 0, want 2` + `unchanged = [FLAT NEW NOPREV], want [FLAT]` |
| **F6** | `changeForSymbol` **假定上游按 `sort=desc` 返回**（不做时间戳比较） | `go test ./internal/market/ -run Ascending` | **exit 1**：`ASC = {Price:100 PreviousClose:0 Unranked:true}, want price 110 up from 100 (+10%)` |

**F2 的教训值得单记**：该用例的**第一版是全绿的废判据**——它把固定切片跑 50 次，
而 `sort.Slice` 对固定输入本就确定，**判据因此毫无牙齿**。改成**每轮从 map 重建输入顺序**后，
F2 立刻红。这正是"判据必须可证伪"要防的东西：**一条永远绿的用例比没有用例更危险**。

**F6 也值得单记**：它抓的不是算错数，而是**信任上游字段顺序**。
`sort=desc` 是我们请求的参数，不是上游的承诺；一旦它不生效，
价格会静默地取到**昨天**那一根，涨跌幅**符号可能反**——而且全程没有任何错误。

**还原后复核**：`go build ./... && go vet ./... && go test ./... && go test -race ./...` 全 **exit 0**；
`git grep -n FALSIFY -- backend` **空输出**（无残留）。

### 4.4 未做的验证（明确）

- **浏览器端未验**：前端组件不在本次范围（硬边界）。`/api/v1/market/movers` 由后端 curl 验证，
  **没有任何前端代码消费它**（`src/lib/api.ts` 无 `movers` 字段）——这是 **GAP-52** 的工作。
- **未跑 `npx vitest` / `next build`**：本次未改任何 TS/TSX 文件（见 §3 文件清单），
  故前端套件与本变更无关；为避免把"没改的东西"报成"已验证"，此处不列其读数。

## 5. 未做（明确，登记回台账）

1. **GAP-52（🟠 P1）前端仍在合成行情**。`src/app/api/market/route.ts` 保留
   `synthetic_curated`（MON-USD）/ `synthetic_fallback`（上游失败）/ `FALLBACK_MARKET_DATA` 硬编码常量，
   且 `MarketTerminal.tsx` **把账户与订单写死**（实测 `:113` `"100,000.00"`、`:114` `"400,000.00"`、
   `:123` `ord_init_aapl`、`:80-81` ticker 价格常量）。issue #14 的前端侧**尚未满足**。
   **本文不夸大**：后端侧现在是"真实或 503"，前端那条路径仍会生成数字。
2. **GAP-53（🟡 P2）GitHub 探测与业务共用匿名配额**。20s 缓存只是一层缓冲，不是解；
   正解是 `GITHUB_TOKEN`（`developer.NewGitHubClient("")` 现在传的就是空 token）。
3. **`PythPriceData` / `feedId` 命名仍是误导**（`feedId: "alpaca_daily_bars"`、`confidence: 0`）。
   JSON key 被前端 `MarketOverviewData` 类型钉住，改名要前后端同改 → 与 GAP-52 一并做。
4. **`/health` 的 `agentcard` 键**仍是写死 `true`，**本次有意不改**：它断言的是
   "进程内模块已装配"，而该模块由 `NewRouter` 无条件构造，`true` 是其实情况的正确陈述。
   `stripe`/`database` 同理（配置存在性 / 真实连接标志）。**"探活"只对远程集成有意义**，
   给本地模块编一个假探针才是伪指标。
5. **GAP-13 的「后端零链上交互」**未动（依赖 GAP-26 的部署，超出本任务范围）。
6. **`ALPACA_DATA_FEED` 默认 `iex` 未经真实调用验证**：免费层该用什么 feed 是**文档结论**，
   见 §4.2；若真跑发现 403，改 `ALPACA_DATA_FEED` 即可（无需改代码）。
