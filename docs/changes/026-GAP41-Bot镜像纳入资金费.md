# 026 — GAP-41：清算 Bot 镜像纳入资金费（逐位对齐 `_fundingFor`）

- **日期**：2026-10-11（UTC）
- **环**：02 开发 + 03 测试
- **类型**：既有缺陷修复（**公式新增 + 事件源新增 + ±1 wei 边界测试**）
- **关联**：**GAP-41**（公式部分关闭；接链集成部分仍 🟠，见 §未做）·
  `docs/changes/021`（GAP-37：前端两条口径的资金费对拍）· `docs/changes/024`（Bot 装配，登记 GAP-41）·
  `ADR-003`（逐块资金费率）· `ADR-005`（引入 go-ethereum，§5 水位/单实例）
- **分支**：`feat/liquidation-bot-chain`

> **状态：先写后填（本文件在动手前立）**。§验证 一节的读数为落地后回填的**实测 stdout**（已回填）。

---

## 问题

`internal/perp/position` 的镜像只有 `collateral + pnl`（`position.go` 原 `Equity`），
而链上 `_isLiquidatable` 是 `_equityAfterFunding` = `clamp(collateral + pnl - funding)`
（`PositionManager.sol:1045-1049`、`:952-960`）。资金费非零时 Bot **低估可清算集合 → 漏清算**。

误差方向是安全的（多报会 revert 烧 gas；少报只是漏），但**演示 seed 把费率设到上限 1e13**
（`contracts/scripts/demo-seed.ts:110-113` + `PerpConstants.sol:105`），且 demo 簿子 14 长/6 空
（skew +0.4，多头付费，`demo-seed.ts:51`），**资金费在演示里显著**——所以这个缺口会咬。

## 铁律（对齐的口径）

镜像的口径**不是自洽的公式，是合约的公式**。合约 `_fundingFor`（`PositionManager.sol:933-939`）：

```
delta      = indexNow - entryFundingIndex
signedSize = isLong ? +size : -size
funding    = (signedSize * delta) / WAD          // WAD = 1e18 (PerpConstants.sol:70)
```

符号：**index 上升 ⟺ 多头拥挤 ⟺ 多头付费**；`funding > 0` 表示交易者**付出**。
故 `equity = collateral + pnl - funding`，**最后**才 floor 到 0
（floor 在 funding 之后：资金费可以把仓位推穿维持保证金，但**不能**把破产仓位救活）。

两个必须逐位对齐的实现细节：

1. **有符号除法截断方向**：`big.Int.Quo`（向零）而非 `Div`（向下取整）。这与既有 `PnL` 同源。
2. **运算顺序**：`collateral + pnl - funding` 一次算完再 clamp，**不是**先 clamp pnl 再减 funding。

## 做法

### 1. `position.Position` 增补 `EntryFundingIndex *big.Int`

`nil` 视为 0——链上未累积过的 feed，其 `cumulativeFundingIndex[feedId]` 就是 0，语义一致。

### 2. 三个方法减去 funding（与合约同序）

| 方法 | 变化 |
| --- | --- |
| `Funding(fundingIndex)` | **新增**：镜像 `_fundingFor`，正数 = 交易者付出 |
| `Equity(markPrice, fundingIndex)` | `clamp(collateral + pnl - funding)`（原来是 `collateral + pnl`） |
| `IsLiquidatable(markPrice, fundingIndex, mmrBps)` | 同上，仍 `equity <= mm` |
| `LiquidationPrice(mmrBps, fundingIndex)` | 解 `collateral + pnl - funding == mm`；`funding = 0` 时**逐位等于原值** |

`LiquidationPrice` 的两个分支即 `src/lib/perp.ts:321-337` 的 `liquidationPriceWithFunding`
（GAP-37 已把该函数钉到链上 48 条含资金费向量）：

```
long :  P = entry * (mm - collateral + funding + size) / size
short:  P = entry * (collateral + size - mm - funding) / size
```

**结构上无法漂移**：`LiquidationPrice(mmr, entryFundingIndex) == LiquidationPrice(mmr, 0)` 逐位相同。
故 GAP-06 的 60 条无资金费黄金向量**顺带**保护了资金费为零这条路径。

### 3. 每 feed 的资金费指数也进了 `Table`（否则 Scan 永远是 funding = 0）

只补 `EntryFundingIndex` 字段**不够**：`Scan` 需要的是 `indexNow`，而这个「当前指数」Bot 侧没有。
故 `Table` 增补每 feed 的**已观测指数**：

- `Table.ApplyFundingIndex(feedID string, index *big.Int)`：并发安全（`ApplyOpen` 同锁），**写入时拷贝**；
- `Scan` 取该 feed 的指数作为 `indexNow` 传给 `IsLiquidatable`；无观测值 → `nil` → funding 0（回退到今天的行为，不 panic）。

### 4. `entryFundingIndex` 从哪来：选 **(a) 跟踪 `FundingAccrued` 事件**

| 方案 | 代价 | 判定 |
| --- | --- | --- |
| **(a) 跟踪 `FundingAccrued`（选定）** | 0 次额外 RPC；`EventHandler` 增一个方法 | ✅ |
| (b) 开仓时 `getPosition(id)` 读回 | **每个仓位一次 RPC**，且在事件回放中是**同步阻塞**调用 | ❌ |

**选 (a) 的理由（决定性的是顺序，不是省 RPC）**：

`_openPosition` 在 `PositionOpened` **之前**先 `accrueFunding(feedId)`
（`PositionManager.sol:427` 对 `:476`）。`accrueFunding` **每次都 emit `FundingAccrued`**
（含首次「只播种时钟、delta = 0」的那次，`:265`）。同一 tx 内日志序号因此**必然**是先
`FundingAccrued` 后 `PositionOpened`，而 `eth_getLogs` 按 (block, logIndex) 排序——
**回放到 open 时，该 feed 的 entry 指数一定已经拿到**。

于是 (a) 的精度是**精确**的，前提只有一个：回填窗口覆盖该 feed 的首次开仓 tx。
Bot 的 `LIQUIDATOR_START_BLOCK` 语义就是部署区块，正常配置下成立。
（(b) 的收益是「不依赖窗口」，代价是每仓位一次 RPC——在回填/订阅的热路径上同步阻塞，
按 `ADR-005` §5.3 的水位口径，回填必须快且可重放，故不取。）

**两条使 (a) 站得更稳的性质**（都不是巧合，是日志顺序的直接推论）：

1. **回填与实时订阅在 Bot 的控制流里不并发**：`indexLoop` 先 `Subscribe` 返回、再 `catchUp`
   （`bot.go`），二者不重叠，所以「先看到区块 15 的指数、再回放到区块 13 的开仓」这种交错不存在；
   而 `seedMu` 把这条性质在**包内**也兜住了，不靠调用方的时序假设。
2. **回填会自我纠正**：`Table.ApplyOpen` 按 id 覆盖，重连后的回填会用正确的 entry 指数
   重新写入同一仓位——即便某次实时转换用了过期的种子，也会被随后的回填抹平。

**`EventHandler` 接口变化（保持内部一致）**：

```go
type EventHandler interface {
	HandleOpened(p *position.Position)
	HandleClosed(id uint64)
	HandleLiquidated(id uint64)
	HandleFundingAccrued(feedID string, index *big.Int)   // 新增
}
```

- `chain.Client`：`eventTopics()` 增第 4 个 topic；`filterQuery` 的 OR 组 3 → 4；
  `dispatch` 增 `case c.fundingTopic` → `HandleFundingAccrued(feedIDHex, index)`；
- `Client` 内部维护 `seeds map[string]*big.Int`（mutex 保护），`positionFromEvent` 用它填 `EntryFundingIndex`；
- `liquidator.tableHandler` 实现新方法 → `table.ApplyFundingIndex`。
- `client.go` 里「Funding events are deliberately absent: the mirror has no use for them」的注释**已不成立**，改写（否则是两处不同成熟度的陈述，D4）。

### 5. `PositionFromOpened` 增第 4 个参数

`entryFundingIndex *big.Int`（event 不带，由 `chain` 边界供给），与既有 `payoutCapUSD` / `openedAt` 同性质。

## 文件清单

| 文件 | 内容 |
| --- | --- |
| `backend/internal/perp/position/position.go` | `WAD` · `EntryFundingIndex` · `Funding` · `Equity/IsLiquidatable/LiquidationPrice` 减 funding · `Table.ApplyFundingIndex` + `Scan` 取 indexNow |
| `backend/internal/perp/position/position_test.go` | 资金费符号/尺度/截断 · 资金费单独推穿保证金 · **±1 index-wei 边界** · 资金费为零逐位不变 · Scan 接线（含负向对照） |
| `backend/internal/chain/chain.go` | `EventHandler.HandleFundingAccrued` · `fundingTopic` · `seeds` + `feedIDHex` |
| `backend/internal/chain/client.go` | `filterQuery` 4 topic · `dispatch` 解 `FundingAccrued` · `positionFromEvent` 填 entry index |
| `backend/internal/chain/convert.go` | `PositionFromOpened(..., entryFundingIndex)` |
| `backend/internal/chain/chain_test.go` · `convert_test.go` | topic 钉死加 `FundingAccrued` · filterQuery 4 topic · dispatch 解码 · **种子顺序**（先 accrual 后 open）· 别名测试覆盖新字段 |
| `backend/internal/liquidator/bot.go` | `tableHandler.HandleFundingAccrued` |

**硬边界遵守**：`internal/perp/position` **零依赖**（`go list -deps` 复核，见 §验证）；
**不改** `contracts/`。

## 验证（落地后回填，真实 stdout）

工作目录 `koliance/backend`，本机 Windows 10 + Go（`go.mod` 的 `go 1.25.0`）。

| 命令 | 结果 |
| --- | --- |
| `go build ./...` | **exit 0** |
| `go vet ./...` | **exit 0** |
| `go test ./...` | **exit 0**（全包 ok；`internal/perp/position` / `internal/chain` / `internal/liquidator` 全绿） |
| `go test -race ./...` | **exit 0** |
| 内层包依赖复核 | `go list -deps ./internal/perp/position/ \| Select-String ethereum` → **空输出**，`internal/perp/position` 仍**零 go-ethereum** |

**用例数（`go test -v -count=1`，按 `^--- PASS` 计数）**：

| 包 | 改前 | 改后 | 新增 |
| --- | --- | --- | --- |
| `internal/perp/position` | 19 | **37 PASS / 0 FAIL** | **+18** |
| `internal/chain` | 11 | **17 PASS / 0 FAIL** | **+6** |
| 后端合计（`go test -v ./...`） | — | **122 PASS** | — |

新增位置包用例：`TestFundingSignsAndScale` · `TestFundingIsZeroWhenTheIndexHasNotMoved` ·
`TestFundingTruncatesTowardZeroLikeSolidity` · `TestFundingTruncatesTowardZeroOnACredit` ·
`TestNilEntryFundingIndexReadsAsZero` · `TestNilCurrentFundingIndexReadsAsZero` ·
`TestFundingAloneCanMakeAPositionLiquidatable` · `TestLiquidatableAtExactlyTheFundingThreshold` ·
`TestFundingBoundaryForAShort` · `TestFundingIsAppliedBeforeTheZeroFloor` ·
`TestZeroFundingReproducesTheFundingFreeValue` · `TestLiquidationPriceMovesWithFunding` ·
`TestLiquidationPriceIsExactUnderFunding` · `TestApplyFundingIndexCopies` ·
`TestApplyFundingIndexIgnoresNil` · `TestUnobservedFeedScansAsFundingFree` ·
`TestScanPicksUpAPositionFundingPushedThroughTheMargin` · `TestScanFundingIsPerFeed`。

新增链包用例：`TestDispatchFundingAccrued` · `TestFundingAccruedPrecedesOpenedAndSeedsTheEntryIndex` ·
`TestOpenedWithoutAnAccrualLeavesTheEntryIndexNil` · `TestLaterAccrualDoesNotMutateAnExistingPosition` ·
`TestFundingAccruedIndexIsAnAbsoluteAccumulator` · `TestPositionFromOpenedWithoutAFundingIndex`。

**核心断言（GAP-41 的「症状」用例）**：

- `TestFundingAloneCanMakeAPositionLiquidatable`：**价格完全不动**（mark == entry == 180），
  仅凭指数 +0.09 WAD（funding = 899.1 USD 对 mm = 99.9 USD）判为可清算；同一仓位**在 entry 指数下健康**
  （对照组）。
- `TestScanPicksUpAPositionFundingPushedThroughTheMargin`：端到端走 `Table.Scan`。价格不动，
  `ApplyFundingIndex` 后 `Scan` 返回该仓位；**负向对照**：同一仓位不喂指数 → 0 个批次。
- `TestScanFundingIsPerFeed`：只有 NVDA 被捞出，BTC（无观测值）不受影响。

### 负向证伪（D3，逐条真跑，非声称）

每条都是「注入一个具体的镜像错误 → 指定用例必红」，跑完即还原。**7/7 全部真红**：

| # | 注入 | 命令 | 实测结果（摘） |
| --- | --- | --- | --- |
| **F1** | `LiquidationPrice` 长分支丢掉 funding 项 | `go test ./internal/perp/position/` | **exit 1**：`a paying long's liquidation price 163800000000000000000 must be ABOVE the funding-free 163800000000000000000`（两值相等 = 资金费被吞） |
| **F2** | `Funding` 的 `Quo` 换成 `Div`（截断方向错） | 同上 | **exit 1**：`funding at delta=-(WAD+1) = -2, want -1 (Div would give -2)` —— 只有**负值**用例抓得住 |
| **F3** | 丢掉 `signedSize` 的 side 乘子（多空同费） | 同上 | **exit 1**：`short funding on a rising index = 999…, want -999…`；`TestFundingBoundaryForAShort` 亦红 |
| **F4** | `Equity` 里 funding 恒为 0（= 修复前的镜像） | 同上 | **exit 1**：`funding alone must be able to breach the maintenance margin` + `TestScanPicksUpAPositionFundingPushedThroughTheMargin: batches = []` |
| **F5** | **先 floor 再减 funding**（运算顺序错） | 同上 | **exit 1**：`equity = 999000000000000000000, want 0: funding must be applied before the floor` + `a funding credit resurrected a bankrupt position` |
| **F6** | `Scan` 取到指数却传 `nil` | 同上 | **exit 1**：`batches = [], want the single position liquidated on funding alone` |
| **F7** | `chain.positionFromEvent` 不传种子（传 nil） | `go test ./internal/chain/` | **exit 1**：`EntryFundingIndex is nil: the accrual was not carried into the open` |

还原后复核：`go build ./... && go vet ./... && go test ./... && go test -race ./...` **全 exit 0**；
`Select-String -Path *.go -Pattern FALSIFY` → **空输出**（无残留）。

> **F5 值得单记**：它不是「算错一个数」，而是**把一个破产仓位救活**——
> 先 clamp 到 0 再减一个负的 funding，equity 从 0 变成 +999，越过 mm 变成「健康」。
> 这正是合约注释（`PositionManager.sol:950-951`）点名要避免的那种写法，而**只有专门为此写的用例抓得住**。

> **F2 值得单记**：只有**负 funding**（空头/收费侧）才暴露 `Div` 与 `Quo` 的差别。
> 若只写正向用例，`Div` 会**全绿通过**——判据夹缝的教科书例子。

> **一处被测试纠正的错误预期（诚实标注）**：本节初稿断言「资金费贷方不能把破产仓位的 equity 抬离 0」。
> **实测为假**：合约的 `_equityAfterFunding` 是 `clamp(collateral + pnl - funding)`，
> 不是 `min(未计资金费权益, clamp(...))`——一张巨大的指数贷方**确实**会把 equity 抬过 mm。
> 这是**合约的行为，不是镜像的 bug**；该断言已改写为现在真正成立的两条：
> ①**运算顺序**（floor 在 funding 之后，见 F5）；②**地板不可下穿**（`equity < 0` 恒为 0）。
> 初版那条断言本质上是「发明合约没有的性质来测试镜像」——D3 的反面。

## 下游同步

- `docs/GAP台账.md`：**GAP-41 状态 🟠 → ✅（公式与事件源部分）**，并保留残余（链上对拍、投影指数）。
- **`chain` 是冻结四包之一**：本次按任务书显式解冻并改其契约
  （`EventHandler` 增一个方法、`filterQuery` 3 → 4 topic、`PositionFromOpened` 增一参）。
  **下游连带**：`internal/liquidator.tableHandler` 已同步实现新方法；`022`/`024`/`025` 文档里
  「`chain` 包是冻结四包之一，不可改」的**结论性陈述已过期**——
  `025` 的 GAP-42 解除条件正是「给 `chain.EventHandler` 增补字段」，与本步同性质。
  **本次不改那些历史快照**（已发生的事实），但**新任务不得再引用「chain 不可改」作为依据**。
- 进度页与 `memory.md`：由总控同步（本子代理不改）。

## 未做（明确，登记回台账）

- **`indexNow` 是「已观测指数」而非链上投影值**：合约判定用 `_projectedFundingIndex`
  （`PositionManager.sol:866-872`，把指数**投影到当前区块**）。Bot 用的 `FundingAccrued` 里的存量指数
  在两次累积之间会**滞后**。方向与 GAP-41 今日同向（欠报 → 可能漏清算），但幅度小得多。
  要逐位消除，得在 Bot 侧镜像 `_skewWad` / `_fundingDelta` / `lastFundingBlock` ——**那是第二份资金费模型**，
  本步不做（登记在 GAP-41 残余）。
- **回填窗口**：若 `LIQUIDATOR_START_BLOCK` 晚于某 feed 的首次开仓 tx，该 feed 无种子 → entry 指数按 nil=0 处理。
  演示路径（从部署区块回填）不受影响。
- **端到端回执**（GAP-40）仍未跑：本步只把「镜像口径」对齐，**没有**链上对拍（Bot 的判定 vs
  `PositionManager.isLiquidatable` 的实链读数）。这是 GAP-41 剩下的另一半。
