# 024 — GAP-26 清算 Bot 装配：`backend/cmd/liquidator` + `internal/liquidator`

- **日期**：2026-10-11（UTC）
- **环**：02 开发 + 03 测试
- **类型**：新功能（清算 Bot 装配，把 position / nonce / chain / oracle 四包接成可运行进程）
- **关联**：**GAP-26**（部分：交易发送 + cmd/liquidator 装配已落地，剩「Monad 部署 + `/api/v1/liquidations`」）·
  **GAP-38**（✅ 本步落地：WS 断线重连 + `lastProcessedBlock` 水位持久化）·
  `docs/adr/ADR-005-引入go-ethereum.md` §5（本步必须落地的硬约束）·
  `docs/changes/004`（核心数学 + nonce）· `022`（接链层）· `023`（价格层）
- **分支**：`feat/liquidation-bot-chain`

---

## 目标（本步只做装配）

实现 `backend/cmd/liquidator/main.go`（薄入口）+ `backend/internal/liquidator/`（可单测的装配逻辑），
把已完成的三个包接起来：

1. **主循环**：启动回填（`chain.Client.Backfill`）→ `Subscribe` 增量更新 → 价格 tick →
   `position.Table.Scan(mmrBps, oracle.AsPriceLookup(...))` 分桶 → 每桶一次 `liquidate(ids, updates)`。
2. **交易发送**：abigen `bindings.IPositionManager` 的 `Session` + `TransactOpts`（私钥构造）调 `Liquidate`；
   nonce 在**广播前一刻** `nonce.Manager.Allocate()` 取，`NonceAt`（确认 nonce）作种子。
3. **ADR §5.3**：WS 断线重连 + `lastProcessedBlock` 水位持久化 + 指数退避 + 重连后先回填。
4. **ADR §5.6**：单实例锁（禁双实例）+ 崩溃/断线外部守护说明。
5. **ADR §5.1**：私钥只从 env 读、无默认值、缺失 fail-fast；独立 funded 账户。
6. **ADR §5.5**：`nonce.Manager.Issued()` 接入结构化日志（Saturation 信号）。

**硬边界（遵守）**：不改 `internal/perp/position` / `internal/perp/nonce` / `internal/chain` / `internal/oracle`
四包（除 go.mod 把 `golang.org/x/sys` 提为直接依赖，见 §做法）。go-ethereum 仍只进 `internal/chain` /
`internal/oracle` / `internal/liquidator`（sender 装配层），不进 `internal/perp/*`。

---

## 关键设计

### 1. 装配分层：`internal/liquidator`（可测） + `cmd/liquidator`（薄壳）

```go
cmd/liquidator/main.go        // env 加载 → 单实例锁 → New → Run → 信号退出
internal/liquidator/
  config.go                   // Config + LoadConfig + loadPrivateKey（§5.1 fail-fast）
  watermark.go                // LoadWatermark / SaveWatermark（§5.3 水位持久化）
  lock.go + lock_{unix,windows}.go  // AcquireLock（§5.6 单实例锁，flock / LockFileEx）
  batch.go                    // toBigIntIDs + chunkIDs（§5.6 按规模分块）
  sender.go                   // Sender：abigen Session + TransactOpts + nonce 广播前分配
  bot.go                      // Bot.New / Run / catchUp / indexLoop / priceLoop
```

### 2. 两套客户端：事件索引（chain.Client）与交易后端（bot 自己的 ethclient）分离

`chain.Client`（`docs/changes/022`）只做**事件读取**（HTTP `eth_getLogs` + WS `eth_subscribe`），且不暴露其
底层 client。而发交易需要 `bind.ContractBackend`（`ethclient`）、`NonceAt` 种子、`EstimateGas`、
`maintenanceMarginBps()` 读回——因此 Bot 自己再拨一个 HTTP `ethclient` 作**写后端**：

- 边界内不为此改动 `chain` 包（任务硬边界）；
- `maintenanceMarginBps`（`Scan` 的 `mmrBps`）从合约**读回**而非硬编码（`PositionManager.sol:219-221` 是
  pure getter；ADR 既定口径「读回值 = 唯一不会过期的口径」）。

### 3. 水位与重连（ADR §5.3）——保守水位 + 回填提交点推进

`chain.EventHandler`（`HandleOpened/Closed/Liquidated`）**不携带区块号**（`docs/changes/022` 刻意把区块号
用掉后丢弃）。因此水位在**每次回填完成点原子推进**（写文件 = tmp + rename），而不是逐事件推进：

- 启动 / 每次重连：`eth_getLogs [watermark+1, head]` → 全部入表 → **原子写 `watermark = head`**。
- 断线空窗：`Subscribe` 出错返回 → 指数退避 → **先回填再重订阅**，堵住空窗。
- **不重不漏论证**：回填范围按「已提交水位 +1」起算，断线期间的事件**必定**被重拉（不漏）；
  与已处理事件重叠的部分因 `Table.ApplyOpen/ApplyClose` 幂等（`position.go:156-160` 已写明）而无害（不重）。
- 链重置 / reorg 到水位之下：`from > head` 时**显式回退到 StartBlock 重扫**并告警，不卡在不可达区间。

> **偏离说明（已写清楚，不是悄悄改）**：ADR §5.3 字面写「WS 每处理一个区块原子推进水位」。本实现把推进粒度
> 放宽到「回填提交点」，因为 `EventHandler` 边界不带区块号、本步不改 `chain` 包。二者满足同一不变量
> （重启/重连后从 `watermark+1` 重拉即不漏），只是推进更粗。若要逐区块推进，需给 `chain.EventHandler`
> 增加区块号参数——已记为后续改进（见 §未做）。

### 4. 交易发送：nonce 广播前一刻分配（`docs/changes/004` 的死保项）

`Sender.Liquidate` 先 `nonce.Allocate()`（非构造批次时），再拷贝 `TransactOpts` 填 `Nonce`，再
`Session.Liquidate`。批次被放弃不烧 nonce；「nonce too low」（他人共享密钥抢跑）触发 `Resync(NonceAt)` 追平。

### 5. 单实例锁（ADR §5.6）——进程退出即释放

`AcquireLock` 在 `main` 里、**任何拨号/交易之前**持有：Unix 用 `flock(LOCK_EX|LOCK_NB)`、Windows 用
`LockFileEx(FAIL_IMMEDIATELY)`。两者都在**进程退出时由 OS 释放**（fd 关闭），不像 `O_EXCL` 会留陈锁挡住
supervisor 自动重启。持有失败 → 立即退出。

**崩溃/断线守护模型（ADR §5.6）**：Bot 自身**不自守护**——致命错误即退出，由运行宿主的 supervisor
（systemd / supervisord / 简单重启循环）作**唯一启动点**拉起；断线由 `indexLoop` 进程内自愈（§关键设计 3），
进程崩溃则靠「锁随 fd 关闭自动释放 + 水位持久化」使重启后从 `watermark+1` 无缝续跑，不丢事件。

### 6. 结构化日志（ADR §5.5）

`log/slog`（stdlib，零依赖）JSON 输出。每次扫描打 `nonce_issued`（`nonce.Manager.Issued()`，Saturation 前移量）
+ `nonce_next` + `positions`/`batches`/`skipped`；每次提交打 `tx` 哈希；断线/回填/重连各打一条。

---

## 做法（文件清单）

| 文件 | 内容 |
| --- | --- |
| `backend/cmd/liquidator/main.go` | 薄入口：信号 + env + 单实例锁 + `New`/`Run` |
| `backend/internal/liquidator/config.go` | `Config` / `LoadConfig(getenv)` / `loadPrivateKey`（无默认值 fail-fast） |
| `backend/internal/liquidator/watermark.go` | 水位持久化（缺文件=冷启动；坏文件=fail loud；写=tmp+rename 原子） |
| `backend/internal/liquidator/lock.go` | `AcquireLock` 导出包装 + 单实例语义文档 |
| `backend/internal/liquidator/lock_unix.go` | `flock(LOCK_EX\|LOCK_NB)` 实现（`//go:build !windows`） |
| `backend/internal/liquidator/lock_windows.go` | `LockFileEx(FAIL_IMMEDIATELY)` 实现（`//go:build windows`，`golang.org/x/sys/windows`） |
| `backend/internal/liquidator/batch.go` | `toBigIntIDs`（uint64→`[]*big.Int`）+ `chunkIDs`（按规模分块，保 per-feed 快照） |
| `backend/internal/liquidator/sender.go` | `Sender`（abigen `Session`+`TransactOpts`，nonce 广播前分配，nonce too low 追平） |
| `backend/internal/liquidator/bot.go` | `Bot.New` / `Run` / `catchUp` / `indexLoop`（退避+重连）/ `priceLoop` / `tableHandler` |
| `backend/internal/liquidator/*_test.go` | 单测：水位 / 批量构建 / 私钥 fail-fast / 单实例锁 / 退避 / sender opts |
| `backend/go.mod` | `golang.org/x/sys` 提为直接依赖（lock_windows 直接 import） |

---

## 验证（已回填，真实 stdout）

| 项 | 结果 |
| --- | --- |
| `cd backend && go build ./...` | exit 0 |
| `cd backend && go vet ./...` | exit 0 |
| `cd backend && go test ./...` | exit 0（`ok internal/liquidator 0.618s`；全后端绿） |
| `cd backend && go test -race -v ./internal/liquidator/...` | exit 0，**16 个顶层用例 + 10 个子用例**全绿 |
| `cd backend && go test -race ./...` | exit 0（全后端） |
| 二进制 fail-fast 冒烟 | `go run ./cmd/liquidator`（无 env）→ **exit 1**：`{"level":"ERROR","msg":"config","err":"liquidator: LIQUIDATOR_CHAIN_ID is required"}` |

**负向证伪（已实跑，非声称）**：

1. **私钥缺失 fail-fast 有牙**：把 `validate()` 的 `if c.PrivateKeyHex == ""` 变异成 `&& false`，
   `go test -run 'TestLoadConfigMissingFieldFailsFast/private_key' ./internal/liquidator/` → **FAIL，exit 1**：
   `config_test.go:68: missing LIQUIDATOR_PRIVATE_KEY did not fail`。已还原，复绿。
2. **单实例锁有牙**：把 `AcquireLock` 变异成 `return func(){}, nil`（去掉锁），
   `go test -run TestAcquireLockExclusiveAndReusable ./internal/liquidator/` → **FAIL，exit 1**：
   `lock_test.go:18: second acquire of a held lock did not fail`。已还原，复绿。
3. **水位坏文件 fail-loud 有牙**：把 `LoadWatermark` 的 `ParseUint` 错误路径变异成 `return 0, nil`，
   `go test -run TestLoadWatermarkCorruptFailsLoud ./internal/liquidator/` → **FAIL，exit 1**：
   `watermark_test.go:48: corrupt watermark did not fail`。已还原，复绿。

---

## 下游同步

- `docs/GAP台账.md`：GAP-26 状态更新（交易发送 + cmd/liquidator 装配已落地，剩「Monad 部署 + `/api/v1/liquidations`」）；
  GAP-38 ✅（本步落地）；**新登记 GAP-40 / GAP-41**。
- `docs/adr/ADR-005-引入go-ethereum.md`：无改动（§5 全部落地于本步；§5.3 推进粒度偏离已在本文档 §关键设计 3 写清）。
- 进度页：由总控同步（本子代理不改 memory.md / 进度页）。

## 未做（明确）

- **GAP-40（新）**：本地链端到端集成验证未跑（`npx hardhat node` → 部署 PerpStack → 开仓 → 降价 → 断言 Bot 提交
  `liquidate` 回执）。命令已备好，见台账 §5.3；本步只交付可单测装配 + 已备好的集成命令，**不伪装成已跑**（D1）。
- **GAP-41（新）**：Bot 镜像不含资金费——`position.Position` 无 `entryFundingIndex`（设计于 ADR-003 之前），
  `Scan` 按纯价格判清算，而链上 `_isLiquidatable` 含资金费。后果是**低估可清算集合**（漏清算，不会误报 revert：
  链上 `liquidate` 对不可清算仓位 `continue` 静默跳过）。安全方向、演示不阻塞，但需登记跟踪。
- 逐区块水位推进（需给 `chain.EventHandler` 加区块号）——见 §关键设计 3 的偏离说明，与 GAP-40 一并验证。
- Hermes 生产路径的 `pythUpdateData`（含签名价格更新）仍属 GAP-39；本步 `updates` 走 no-op（demo 路径
  `priceUpdater==0`，`_pushPrices` 直接返回）。
