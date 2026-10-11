# 023 — GAP-26 价格层：`backend/internal/oracle/`（DemoFeed 链上读价 + HermesFeed 最小实现）

- **日期**：2026-10-11（UTC）
- **环**：02 开发 + 03 测试
- **类型**：新功能（清算 Bot 价格层，接在 `internal/chain` 之后）
- **关联**：**GAP-26**（部分：价格层）· `docs/adr/ADR-005-引入go-ethereum.md` · `docs/changes/022`（接链层）· `docs/changes/004`（清算 Bot 核心）
- **分支**：`feat/liquidation-bot-chain`

---

## 目标（本步只做价格层）

实现 `backend/internal/oracle/`，给 `position.Table.Scan` 的 `PriceLookup` 喂价：

1. 定义 `PriceFeed` 接口（对齐 `position.PriceLookup`）+ `AsPriceLookup` 适配器。
2. **DemoFeed（演示主路径）**：读链上 `DemoOracle.getPrice(feedId)`（go-ethereum + `IPriceOracle` 单函数 ABI），
   使「前端调 `DemoOracle.setPrice/bumpPrice` 降价 → Bot 读到同一链上价 → 触发清算」成立。
3. **HermesFeed（生产叙事，次要）**：`hermes.pyth.network` 拉最新价，`price+expo` 归一化到 18 位；最小实现，不阻塞演示。

**硬边界（遵守）**：go-ethereum **只进 `internal/chain/` 与 `internal/oracle/`**；不 import 进 `internal/perp/position` / `internal/perp/nonce`（保持零依赖）。
不改 `internal/chain`、不改 `internal/httpapi`、不改 `contracts`、不改 `internal/config`。

---

## 关键设计

### 1. PriceFeed 接口形状（对齐 `position.PriceLookup`）

```go
// oracle.go
type PriceFeed interface {
    Price(ctx context.Context, feedID string) (*big.Int, bool)
}

func AsPriceLookup(ctx context.Context, f PriceFeed) position.PriceLookup
```

- `Price` 的 `(price, ok)` 与 `position.PriceLookup` 语义一致：`ok=false` 表示**无可用价**，由 `Scan` 把该仓位放进 `skipped`，**绝不猜测**（`position.go:194-198` 的既定口径）。
- `AsPriceLookup` 把 ctx 绑定进无 ctx 的 `PriceLookup`（`Scan` 签名里没有 ctx），调用方传扫描请求的 ctx。
- 依赖方向：`oracle` → `perp/position`（边界适配层依赖纯核心），与 `internal/chain` 同向，无环。

### 2. DemoFeed：读链上 DemoOracle，不用本地内存价（理由）

演示的靶心（`推进方案.md` 阶段 3.5 第 4 步）是「大屏点『调低价格』→ <1s 内持仓批量变红」。
若 Bot 读本地注入的内存价，前端 `setPrice` **无法传导**到 Bot——两条控制通道各自为政，
「单一链上事实源」的叙事当场破裂。因此 **DemoFeed 走链上读价**：

- `DemoFeed` 只依赖一个窄接口 `DemoPriceReader{ ReadPrice(ctx, [32]byte) (*big.Int, uint64, error) }`，
  **测试注入 stub、不依赖节点**；生产实现 `ethDemoReader` 用 `ethclient.CallContract` 调 `getPrice(bytes32)`。
- 单函数 ABI 手写为 JSON 常量（**不用 abigen**）：本包只需要 `getPrice` 一个 view 函数，abigen 绑定会为一次调用拖进整套 bind/event 机制。
  selector 用测试钉死（见下），冻结接口再改 → 编译/测试期报错而非运行期错位。
- `Price` 对「id 解不出 / RPC 失败 / 价格 ≤ 0」一律返回 `ok=false`，与 `position` 的「缺价跳过」口径一致。

### 3. HermesFeed：最小实现 + 归一化对拍

- 最小：`/v2/updates/price/latest?ids[]=<feedId>` 单次 REST GET，解析 `parsed[].price{price,expo}`。
- **归一化是难点，也是本步唯一真正实现的生产逻辑**：`NormalizeHermesPrice(price int64, expo int32)` 逐行镜像
  `PythOracleAdapter._normalize`（`price<=0` 拒绝 · `|shift|>36` 拒绝 · `shift>=0` 乘 / 否则除）。expo 从响应读、**不硬编码**
  （BTC -8 vs 美股 -5，硬编码会错三个数量级）。
- **未做（明确）**：SSE/WS 流式 tick、staleness 边界（镜像 `getPriceNoOlderThan`）、批量更新、置信区间——记 **GAP-39**。

---

## 做法（文件清单）

| 文件 | 内容 |
| --- | --- |
| `backend/internal/oracle/oracle.go` | 包 doc · `PriceFeed` · `AsPriceLookup` · `ParseFeedID` |
| `backend/internal/oracle/reader.go` | `DemoPriceReader` · `ethDemoReader`（IPriceOracle ABI + `CallContract`） |
| `backend/internal/oracle/demofeed.go` | `DemoFeed`（`NewDemoFeed` / `NewDemoFeedFromRPC` / `Price` / `Close`） |
| `backend/internal/oracle/hermes.go` | `HermesFeed` · `NormalizeHermesPrice` · Hermes 响应解析 |
| `backend/internal/oracle/oracle_test.go` | `AsPriceLookup` · `ParseFeedID` 正/负向 |
| `backend/internal/oracle/reader_test.go` | selector 钉死 · ABI 输出解包往返 · nil client / 零地址负向 |
| `backend/internal/oracle/demofeed_test.go` | stub reader 注入：正向 / 四类「无价」负向 / 非法 feedId |
| `backend/internal/oracle/hermes_test.go` | 归一化表驱动（含除断截断/超界）· `httptest` 解析正向 + 4 类负向 |

---

## 验证（已回填，真实 stdout）

| 项 | 结果 |
| --- | --- |
| `cd backend && go build ./...` | exit 0 |
| `cd backend && go vet ./...` | exit 0 |
| `cd backend && go test ./...` | exit 0（`ok internal/oracle 0.865s`） |
| `cd backend && go test -race -v ./internal/oracle/...` | exit 0，**12 passing**（4 个顶层用例 + 9 个子用例） |
| `cd backend && go test -race ./...` | exit 0（全后端） |

**负向证伪（已实跑，非声称）**：

1. **selector 钉死有牙**：把 `ipriceOracleABI` 的函数名 `getPrice` → `getPriceX`，
   `go test -run TestIPriceOracleSelectorPinned ./internal/oracle/` → **FAIL，exit 1**：

   ```
   --- FAIL: TestIPriceOracleSelectorPinned (0.00s)
       reader_test.go:30: selector length = 0, want 4
   ```

2. **归一化 `price<=0` 拒绝有牙**：把 `NormalizeHermesPrice` 的 `price <= 0` 放宽成 `price < 0`，
   `go test -run 'TestNormalizeHermesPrice/zero_price' ./internal/oracle/` → **FAIL，exit 1**：

   ```
   --- FAIL: TestNormalizeHermesPrice/zero_price (0.00s)
       hermes_test.go:39: NormalizeHermesPrice(0, -8) = 0, want error
   ```

   两条变异均已还原，`go build && go vet && go test ./...` 复绿。

---

## 下游同步

- `docs/GAP台账.md`：GAP-26 状态更新（接链层 + **价格层**已落地，剩「交易发送 + cmd/liquidator 装配 + Monad 部署」）；**新登记 GAP-39**。
- `docs/adr/ADR-005-引入go-ethereum.md`：无改动（价格层属其 §3 R1~R5 之外的新增消费方，依赖边界一致）。
- 进度页：由总控同步（本子代理不改 memory.md / 进度页）。

## 未做（明确）

- **GAP-39（新）**：Hermes 生产路径——SSE/WS 流式、staleness 边界（`getPriceNoOlderThan` 镜像）、批量更新、置信区间。
- DemoFeed 的 chainId fail-fast（ADR §5.4）留到 `cmd/liquidator` 装配时由成块网络配置统一处理（GAP-26 剩余）。
