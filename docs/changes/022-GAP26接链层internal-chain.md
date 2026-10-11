# 022 — GAP-26 接链层：`backend/internal/chain/`（go-ethereum 客户端 + abigen 绑定 + 事件→Position 转换）

- **日期**：2026-10-11（UTC）
- **环**：02 开发 + 03 测试
- **类型**：新功能（**接链基础设施**，ADR-005 方案 A 的第一步落地）
- **关联**：**GAP-26**（部分：接链层）· `docs/adr/ADR-005-引入go-ethereum.md`（§5.4 成块配置 + chainId fail-fast · §5.3 水位/重连为**下一步**）· `docs/changes/004`（清算 Bot 核心）
- **分支**：`feat/liquidation-bot-chain`

---

## 目标（本步只做接链层）

实现 `backend/internal/chain/`：

1. 引入 `github.com/ethereum/go-ethereum`，pin 稳定版本 `v1.16.9`（go.mod/go.sum）。
2. 从 `IPositionManager` 的冻结 ABI 生成 **abigen 绑定**（`.go` + ABI 快照 + `go:generate` 留痕）。
3. ethclient 封装：HTTP（`eth_getLogs` 回填）+ WebSocket（`eth_subscribe` 订阅），把事件转成 `position.Position`。
4. **事件 → `position.Position` 转换函数为核心**，单测覆盖 indexed 字段、FeedID/Address → hex string、18 位 `*big.Int` 保留。

**硬边界（遵守）**：go-ethereum **只进 `internal/chain/`**；不 import 进 `internal/perp/position` / `internal/perp/nonce`（保持零依赖）。
不改 httpapi、不改 contracts、不做价格获取（internal/oracle）、不做清算扫描（cmd/liquidator）。

---

## 关键设计

### 1. 事件缺两个字段，边界必须补全（否则拿不完整 Position 过界）

冻结事件 `PositionOpened` 只带 `positionId / owner / feedId / collateralUsd / sizeUsd / entryPrice / isLong`，
**不带** `payoutCapUsd` 与 `openedAt`（`PositionManager.sol:449-459` 才写全）。而 `position.Position` 两者都有。

实测确认（D1）：

- `PositionManager.sol:231-232`：`maxProfitBps()` 是 **pure**，返回常量 `PerpConstants.MAX_PROFIT_BPS`（`PerpConstants.sol:55` = **10_000**）。
- `PositionManager.sol:979-981`：`_payoutCapUsd = collateralUsd + (sizeUsd * MAX_PROFIT_BPS) / BPS_DENOMINATOR`。
- `PositionManager.sol:457`：`openedAt = block.timestamp`。

因此这两个字段**都在接链层内可解**，且 `maxProfitBps` 启动时从合约读回、**不硬编码**（`IPositionManager.sol:179-180` 的既定口径）：

- `payoutCapUsd`：启动读一次 `maxProfitBps()` → 每事件 `collateral + size*maxProfitBps/1e4`（`convert.go` 的 `payoutCapUSD`）。
- `openedAt`：按日志 `BlockNumber` 取区块头 `Time`（`client.go` 的 `fetchBlockTime`）。

### 2. 转换函数签名（核心）

```go
// convert.go
func PositionFromOpened(ev *bindings.IPositionManagerPositionOpened, payoutCapUSD *big.Int, openedAt uint64) *position.Position
func payoutCapUSD(collateralUSD, sizeUSD, maxProfitBps *big.Int) *big.Int
```

- `FeedID`：`common.BytesToHash(ev.FeedId[:]).Hex()`（0x 前缀小写 64 hex，canonical）。
- `Owner`：`ev.Owner.Hex()`（EIP-55 checksummed）。
- 18 位 `*big.Int` **逐个 `new(big.Int).Set(...)` 拷贝**，不 alias 事件字段（事件可被解码器复用）。

### 3. 事件回填/订阅的接口形状

```go
// chain.go
type EventHandler interface {
    HandleOpened(p *position.Position)
    HandleClosed(id uint64)
    HandleLiquidated(id uint64)
}

// client.go
func (c *Client) Backfill(ctx context.Context, from, to uint64, h EventHandler) error
func (c *Client) Subscribe(ctx context.Context, h EventHandler) error
```

- 回填与订阅**共用一条 OR topic 的 filter query**（只收 `PositionOpened/Closed/Liquidated` 三事件，不收 funding 事件），
  共用 `dispatch`（按 `Topics[0]` 分派 → `Parse*` 解码 → 补全 → `Handler`）。
- `Subscribe` 是**阻塞原语**（直到 ctx 取消 / 订阅出错返回）；**重连与水位是调用方（cmd/liquidator）的循环**，不在本层自愈（ADR §5.3）。

### 4. 按网络成块配置 + chainId fail-fast 落点

```go
// chain.go
type Network struct {
    RPC             string
    WS              string
    ChainID         *big.Int
    ContractAddress common.Address
}
func (c *Client) New(ctx, cfg Network) ...
```

`New` 内：dial HTTP → dial WS → **`validateChainID`**（`client.ChainID(ctx)` 与 `cfg.ChainID` 比对，不一致即关闭两个 client 返回错误）→ 读 `maxProfitBps()`。
`validateChainID` 抽成 `chainIDReader` 接口，可无节点单测（负向：链 id 不符必须报错）。

---

## 做法（文件清单）

| 文件 | 内容 |
| --- | --- |
| `backend/go.mod` / `go.sum` | 新增 `github.com/ethereum/go-ethereum v1.16.9`（+ 间接依赖） |
| `backend/internal/chain/bindings/ipositionmanager.go` | abigen 生成绑定（入库） |
| `backend/internal/chain/bindings/ipositionmanager.abi.json` | ABI 快照（重新生成的输入，入库） |
| `backend/internal/chain/bindings/doc.go` | 包说明 + `//go:generate` 留痕 |
| `backend/internal/chain/convert.go` | `PositionFromOpened` + `payoutCapUSD` |
| `backend/internal/chain/chain.go` | `Network` / `EventHandler` / `Client` / `New` / `validateChainID` |
| `backend/internal/chain/client.go` | `Backfill` / `Subscribe` / `dispatch` / `fetchBlockTime` |
| `backend/internal/chain/convert_test.go` | 转换单测 |
| `backend/internal/chain/chain_test.go` | chainId 负向 / filter query 三 topic / dispatch 全链路（raw log → Position） |

---

## 验证（已回填，真实 stdout）

| 项 | 结果 |
| --- | --- |
| `cd backend && go build ./...` | exit 0 |
| `cd backend && go vet ./...` | exit 0 |
| `cd backend && go test ./...` | exit 0（`ok internal/chain 0.746s`） |
| `cd backend && go test -race -v ./internal/chain/...` | exit 0，**10 passing**（chain 包） |
| `cd backend && go test -race ./...` | exit 0（全后端） |
| 依赖 | `github.com/ethereum/go-ethereum v1.16.9`（`go list -m -versions` 实测最新 1.17.8；选 1.16 线最新补丁，GoVersion 1.24.0，比 1.17.8 的 1.25.0 更宽） |

**负向证伪（已实跑，非声称）**：把 `validateChainID` 的比较逻辑删掉（只读不比对），跑
`go test -run TestValidateChainID ./internal/chain/` → **FAIL，exit 1**：

```
--- FAIL: TestValidateChainID (0.00s)
    chain_test.go:32: mismatched chain id did not fail
```

证明 chainId fail-fast 判据有牙；随后还原，全量 `go build && go vet && go test ./...` 复绿。

---

## 下游同步

- `docs/GAP台账.md`：GAP-26 状态更新（接链层已落地，剩「Monad 部署 + cmd/liquidator 装配」）；**新登记 GAP-38**。
- `docs/adr/ADR-005-引入go-ethereum.md` §6「遗留」：版本 pin 与 abigen 入仓策略**已落地**（v1.16.9 · 入库 + ABI 快照 + go:generate）。
- 进度页：由总控同步（本子代理不改 memory.md / 进度页）。

## 未做（明确）

- **GAP-38（新）**：WS 断线重连 + `lastProcessedBlock` 水位持久化（ADR §5.3 P1）——`internal/chain` 只给 `Backfill`/`Subscribe` 原语，重连循环与水位落在 `cmd/liquidator` 装配时。
- 交易发送 / nonce 种子（`NonceAt`）/ 私钥注入 / 单实例锁 / 按 gas 分块——仍属 **GAP-26** 的「Bot 装配」剩余，不在本步。
