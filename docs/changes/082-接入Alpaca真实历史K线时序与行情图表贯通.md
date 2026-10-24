# 082 · 接入 Alpaca 真实历史 K 线时序与行情图表贯通

## 1. 变更背景与根因分析

### 1.1 现状与用户反馈
用户在终端 `/market` 页面查看标的行情时，点击时间周期按钮（`1D`、`5D`、`1MO`、`1Y`），折线图区域显示如下占位提示：
```text
[INFO] The upstream for this symbol publishes only the latest close and the previous close (two observations). No series is available to plot, so none is drawn — this view does not generate an illustrative curve.
```
用户提出疑问：“这里是不是 alapa 的 startdata 有问题？修复”。

### 1.2 根因定位与技术事实
1. **并非参数传错，而是全链路缺乏历史时序端点**：
   - 过去后端在 `PriceOracle.PriceChange` 中，为了计算单日涨跌幅（`Price - PreviousClose`），特意针对单标的设置了 `limit = 2`；
   - 过去后端仅提供 `GET /api/v1/market/prices` 接口，仅返回单个标的现价与前收盘价 DTO (`PythPriceData`)，完全没有提供历史 K 线时序（Bars/Series）接口；
   - 前端 `/api/market` 代理路由过去只向后端索取单点报价；在 PR 028 中为贯彻 Zero Synthetic 假数据治理（GAP-14），前端删除了本地伪造的随机游走折线，在无后端时序端点时输出该事实说明（`NO_SERIES_NOTE`）；
   - 前端代码及注释已预留了 `chartCoordinates` 的 SVG 折线与面积图绘制逻辑，并说明：*"Should a series endpoint appear, the relayed points render here with nothing else to change."*
2. **Alpaca API 原生支持历史时间序列**：
   - Alpaca `/v2/stocks/bars` 原生支持通过 `symbols`、`timeframe`、`start`、`limit`、`sort` 查询真实历史 K 线；
   - 本次变更打通后端到前端的真实历史 K 线通道，彻底解决有按钮无曲线的遗留状态。

---

## 2. 变更内容与架构设计

### 2.1 后端时序端点与 Alpaca 参数映射
- **数据结构与方法** (`backend/internal/market/price_oracle.go`):
  - 定义 `SymbolBarsDTO`：
    ```go
    type SymbolBarsDTO struct {
        Symbol     string    `json:"symbol"`
        Timeframe  string    `json:"timeframe"`
        Timestamps []int64   `json:"timestamps"`
        Closes     []float64 `json:"closes"`
        Source     string    `json:"source"`
        Synthetic  bool      `json:"synthetic"`
    }
    ```
  - 实现 `mapRangeToAlpacaParams(rangeParam string)`：
    - `1d`: `timeframe=15Min`, `start` 为 3 天前（覆盖周末），`limit=100`, `sort=asc`
    - `5d`: `timeframe=1Hour`, `start` 为 7 天前，`limit=100`, `sort=asc`
    - `1mo`: `timeframe=1Day`, `start` 为 35 天前，`limit=50`, `sort=asc`
    - `1y`: `timeframe=1Day`, `start` 为 370 天前，`limit=365`, `sort=asc`
  - 实现 `(p *PriceOracle) GetBars(ctx context.Context, symbol, rangeParam string) (*SymbolBarsDTO, error)`：发起真实 Alpaca 请求，提取时间戳与收盘价。
- **服务层与路由暴露** (`backend/internal/market/service.go`, `backend/internal/httpapi/router.go`):
  - 在 `market.Service` 暴露 `GetBars`；
  - 注册 `GET /api/v1/market/bars` 路由，接入 `marketData` 凭据守护门禁。
- **QA 降级门禁与路由清单对齐** (`backend/internal/httpapi/qa_degradation_test.go`, `market_test.go`):
  - 将 `/api/v1/market/bars` 纳入 `qaRouteInventory` 覆盖清单与无凭据 503 守护断言。

### 2.2 BFF 路由与时序贯通
- **`src/lib/marketFeed.ts`**:
  - 放宽 `MarketAnalysis.available: boolean`；
  - `buildSymbolPayload` 增加可选入参 `bars?: { timestamps: number[]; closes: number[] }`；
  - 当存在时序数据（`closes.length >= 2`）时，填充至 `payload.chart`，并将 `analysis.available` 设为 `true`。
- **`src/app/api/market/route.ts`**:
  - 在获取现价后，向下游 `/api/v1/market/bars?symbol=...&range=...` 获取真实 K 线；
  - 若获取成功，将真实序列传入 `buildSymbolPayload`；若失败或无数据，优雅降级为 `{ timestamps: [], closes: [] }` 并附带说明。
  - 严格保持无伪造数字约束（通过 `tests/market-independence.test.ts` AST 检验）。

### 2.3 前端图表交互与状态联动
- **`src/components/MarketTerminal.tsx`**:
  - `fetchMarketData` 支持传入 `range` 参数；
  - `1D`、`5D`、`1MO`、`1Y` 按钮点击时触发对应区间的真实数据重拉取；
  - 获得真实序列时，SVG 折线图与渐变面积图正常渲染；无序列时优雅展示 `NO_SERIES_NOTE`。

---

## 3. 影响文件清单

- `backend/internal/market/price_oracle.go`
- `backend/internal/market/service.go`
- `backend/internal/httpapi/router.go`
- `backend/internal/market/market_test.go`
- `backend/internal/httpapi/market_test.go`
- `backend/internal/httpapi/qa_degradation_test.go`
- `src/lib/marketFeed.ts`
- `src/app/api/market/route.ts`
- `src/components/MarketTerminal.tsx`
- `tests/market-route.test.ts`

---

## 4. 验证记录

```bash
# 后端 Go 门禁验证
cd backend
go vet ./...
go test -race ./...
# [SUCCESS] 全部通过

# 前端 TypeScript 与测试门禁
pnpm type:lint
pnpm test
pnpm build
# [SUCCESS] 全部通过 (36 test files, 388 tests passed)
```
