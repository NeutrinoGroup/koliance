# 025 — GAP-26 清算观测端点：`GET /api/v1/liquidations` + Bot 写库

- **日期**：2026-10-11（UTC）
- **环**：02 开发 + 03 测试
- **类型**：新功能（把清算 Bot 的清算结果落库，经 `/api/v1/liquidations` 暴露给前端大屏滚动展示）
- **关联**：**GAP-26**（`GET /api/v1/liquidations` ✅ 本步落地，剩「Monad 部署」）·
  **GAP-42（新）**（权威 `exit_price`/`reward` 回填，见 §未做）·
  `docs/changes/024`（Bot 装配，本步在其 `scanAndLiquidate` 成功点加写库回调）
- **分支**：`feat/liquidation-bot-chain`

---

## 目标（本步只做观测旁路）

1. **建表**：`liquidation_events`，用现有迁移机制（`cmd/migrate` 的幂等 `CREATE TABLE IF NOT EXISTS`）加迁移。
2. **Bot 写库**：`internal/liquidator` 在每次 `liquidate()` 广播成功后插入一行/仓位；
   `DATABASE_URL` 缺失或写库失败时降级为「只打日志不写库」+ 显式告警，**绝不阻断清算主循环**。
3. **API 端点**：`GET /api/v1/liquidations?limit=50`（默认 50，上限 200），按时间倒序返回 JSON 列表。

**硬边界（遵守）**：不改 `position / nonce / chain / oracle` 四包；对 `liquidator` 只做「清算成功回调写库」的
最小侵入；不改 contracts。

---

## 关键设计

### 1. 迁移机制：沿用「幂等 `CREATE TABLE IF NOT EXISTS`」，DDL 单一事实源

现有迁移是 `cmd/migrate/main.go` 内联一段 `schemaSQL` 一次性 `Exec`（`CREATE ... IF NOT EXISTS`），
`backend/migrations/001_init_and_composite_indexes.sql` 只是同内容的 SQL 副本。**没有**顺序迁移框架
（无版本表、无 `up/down` 目录），所以「加一个迁移文件」在这里反而是第二个真相源。

**选择**：把 `liquidation_events` 的 DDL 作为**导出常量**放进新的 `internal/liquidation` 包
（`SchemaSQL`），由两处幂等引用：

- `cmd/migrate`：`schemaSQL` 之外再 `Exec(liquidation.SchemaSQL)`（迁移的权威入口）；
- `cmd/liquidator`：`PG.EnsureSchema` 在启动时 `Exec` 同一常量（Bot 是独立进程，**不依赖** migrate 已被跑过）。

**理由**：DDL 与它的读写者（`internal/liquidation.PG`）同文件，结构上只有一个真相源（D4）；
两处只是「幂等执行」，不是两份 DDL。表结构因此无法漂移。

### 2. 建表：`liquidation_events`

```sql
CREATE TABLE IF NOT EXISTS liquidation_events (
    id           BIGSERIAL PRIMARY KEY,
    position_id  BIGINT       NOT NULL,
    feed_id      VARCHAR(128) NOT NULL,
    exit_price   NUMERIC(78,0),   -- 18 位定点整数（uint256 范围），wire 上为十进制字符串
    reward       NUMERIC(78,0),   -- 提交时未知 → NULL（GAP-42）
    tx_hash      VARCHAR(66)  NOT NULL,
    block_number BIGINT,          -- 提交时 tx 未上链 → NULL（GAP-42）
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_liquidation_events_created
    ON liquidation_events (created_at DESC, id DESC);
```

- `exit_price`/`reward` 用 `NUMERIC(78,0)`：`uint256` 最大约 `1.15e77`，78 位足够；读取时 `::text` 强转，
  避免依赖 pgx numeric codec 的字符串行为。
- 时间倒序索引支撑大屏轮询。

### 3. Bot 写库：`scanAndLiquidate` 成功点回调，一次往返写整个 chunk

`internal/liquidation` 暴露 `Store` 接口（`Record(ctx, []Event)` / `Latest(ctx, limit)`）与 `PG` 实现。
`Bot` 增加一个可选 `obs liquidation.Store` 字段（nil = 观测关闭）。

`scanAndLiquidate` 在 `sender.Liquidate` 成功后调用 `recordLiquidation`：为 chunk 内**每个仓位**生成一个
`Event`（共享 `feed_id`/`exit_price`/`tx_hash`），一次 `Record` 多行插入。

**降级三件事（任务硬性要求）**：

1. `obs == nil`（`DATABASE_URL` 未设）→ 直接返回，只打启动告警「observations disabled」。
2. 写库失败 / 超时 → `Warn("liquidation events not persisted", ...)`，**不返回、不 panic、不阻断主循环**。
3. 单次 `Record` 用 `context.WithTimeout(ctx, ObsWriteTimeout)`（默认 2s，`LIQUIDATOR_OBS_WRITE_TIMEOUT` 可调），
   **整个 chunk 一次往返**——DB 挂死最多拖慢主循环 2s/chunk，与 chunk 大小无关（不是逐仓位 2s）。

**诚实标注（D1）**：提交时 `exit_price` 存的是**扫描时判定价**（`batch.MarkPrice`），不是链上结算价。
`PositionLiquidated` 事件其实携带权威 `exitPrice`/`reward`，但 `chain.EventHandler` 只传 `id` 且
`chain` 包是冻结四包之一（不可改），故权威值留待 GAP-42。`reward`/`block_number` 提交时未知 → 存 NULL。

### 4. API 端点：公共只读，空库/无库均返回空列表

`httpapi.Deps` 增加 `Liquidations liquidation.Store`（nil 时端点返回 `{"liquidations":[]}`，不 panic）。
端点：

- `limit` 缺失 → 50；`< 1` / 非整数 → 400；`> 200` → 400（**拒绝而非静默钳制**，fail-loud）；
- 读到 500 时把 store 错误原文返回（缺表时能看到 `relation liquidation_events does not exist`）。

wire 契约（前端大屏消费）：`{"liquidations":[{...}]}`，字段 camelCase，
`exitPrice` 为 18 位定点整数的**十进制字符串**（`src/lib/perp.ts formatUsd` 的输入口径），
`reward`/`blockNumber` 为 `null`。

---

## 做法（文件清单）

| 文件 | 内容 |
| --- | --- |
| `backend/internal/liquidation/store.go` | `Event` / `Store` 接口 / `PG` 实现 / `SchemaSQL` 常量 / `Record` / `Latest` / `EnsureSchema` / `Close` |
| `backend/internal/liquidation/store_test.go` | `Event` JSON wire 契约（camelCase + null + 定点字符串） |
| `backend/internal/liquidator/bot.go` | `Bot.obs` 字段 + `New(..., obs)` 签名 + `recordLiquidation` + `scanAndLiquidate` 成功点回调 |
| `backend/internal/liquidator/config.go` | `ObsWriteTimeout` 字段（默认 2s，env `LIQUIDATOR_OBS_WRITE_TIMEOUT`） |
| `backend/internal/liquidator/observer_test.go` | 降级路径单测：nil store 无副作用 / store 失败只告警不返回 / 一仓位一行 fan-out |
| `backend/internal/liquidator/config_test.go` | `ObsWriteTimeout` 默认值断言 |
| `backend/cmd/liquidator/main.go` | `connectObservationStore`（`DATABASE_URL` → pool → ping → EnsureSchema，全失败降级）+ `New(..., obs)` |
| `backend/cmd/migrate/main.go` | 追加 `liquidation.SchemaSQL` 到迁移 + 表清单打印 |
| `backend/internal/httpapi/router.go` | `Deps.Liquidations` + `GET /api/v1/liquidations`（limit 解析 + nil store 空列表 + 错误 500） |
| `backend/internal/httpapi/liquidations_test.go` | 端点单测：默认/自定义 limit、非法 limit、nil store、store 错误、405 |
| `backend/cmd/api/main.go` | 装配 `Liquidations: liquidation.NewPG(db.Pool)` |

---

## 验证（已回填，真实 stdout）

| 项 | 结果 |
| --- | --- |
| `go build ./...` | exit 0 |
| `go vet ./...` | exit 0 |
| `go test ./...` | exit 0（新增 `internal/liquidation` / `internal/liquidator` / `internal/httpapi` 全绿） |
| `go test -race ./...` | exit 0 |
| 新用例明细 | `TestEventJSONShape` · `TestRecordLiquidation{NoStoreIsNoop,DegradesOnStoreFailure,FansOutOneEventPerPosition}` · `TestLiquidations{DefaultsAndPassthrough,CustomLimit,RejectsBadLimit,NilStoreReturnsEmptyList,StoreErrorIs500,MethodNotAllowed}` 全 PASS |

**负向证伪（已实跑，非声称）**：

1. **limit 上限有牙**：把 `if n > 200` 变异成 `if n > 100000`，
   `go test -run TestLiquidationsRejectsBadLimit ./internal/httpapi/` → **FAIL，exit 1**：
   `liquidations_test.go:89: limit=201: 200, want 400`。已还原，复绿。
2. **写库降级有牙**：把 `recordLiquidation` 的错误分支从「`Warn` 后继续」变异成 `panic(err)`，
   `go test -run TestRecordLiquidationDegradesOnStoreFailure ./internal/liquidator/` → **FAIL，exit 1**：
   `panic: dial timeout`。已还原，复绿。

> **未实跑项（D1 不伪装）**：`PG.Record`/`Latest`/`EnsureSchema` 的真实 SQL 未对活库执行
> （本机无 `DATABASE_URL`）。`go build/vet/test` 只证明**编译正确**，不证明 SQL 运行时行为；
> 首次对 Supabase 跑 `go run ./cmd/migrate` 才是 SQL 的首次真实执行。

---

## 下游同步

- `docs/GAP台账.md`：GAP-26 状态更新（`GET /api/v1/liquidations` ✅，剩「Monad 部署」）；**新登记 GAP-42**。
- 前端大屏轮询端点：契约见 §关键设计 4（本步不改前端）。
- 进度页：由总控同步（本子代理不改 memory.md / 进度页）。

## 未做（明确）

- **GAP-42（新）**：`liquidation_events.exit_price` 现为**扫描时判定价**（`batch.MarkPrice`），
  `reward`/`block_number` 恒 NULL。`PositionLiquidated` 事件携带权威 `exitPrice`/`reward`
  （`ipositionmanager.go:1327` 已解码），但 `chain.EventHandler.HandleLiquidated` 只传 `id`
  （`client.go:98` 丢弃），而 `chain` 是冻结四包之一。**解除条件**：给 `chain.EventHandler`
  增补 `exitPrice`/`reward`（或 Bot 侧独立监听 `PositionLiquidated`）后，在事件侧补写/回填这三列。
- 活库 SQL 首次实跑：`go run ./cmd/migrate`（需 `DATABASE_URL`）。
