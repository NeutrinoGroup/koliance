# 038 · 合并 `upstream/main`（union 解冲突）+ GAP-51/52 撞号重编

> **环**：02 开发（合并解冲突）
> **分支**：`feat/w1-ai-infra-foundation`（worktree `koliance-w1`）
> **合并目标**：`upstream/main`
> **性质**：**两侧都保留（union）**，不删任何一侧功能。**无一处采用"取一边"**。

---

## 1. 冲突的四个文件与解法

| 文件 | 冲突点 | 解法 |
| --- | --- | --- |
| `backend/cmd/api/main.go` | `Deps` 装配：HEAD 加 `Verifier`，上游加 `Liquidations`/`AgentAPI` | **union**：保留 `proofVerifier := verifier.NewNoop()` 与 `agentAPIService := agentapi.NewService(db)` 两个装配；`Deps` 字面量同时给 `Verifier`/`Liquidations`/`AgentAPI` 三字段。上游侧字段对齐（gofmt） |
| `backend/internal/httpapi/router.go` | import（`encoding/hex` vs `encoding/json`） | **union**：两个都留（`hex` 供 `decodeHexField`，`json` 供 `jsonEnvelope`） |
| 同上 | `Deps` 结构 | **union**：`Verifier` 在 HEAD 段、`Liquidations`+`AgentAPI` 在上游段，**剥掉冲突标记后自然共存**，未重排 |
| 同上 | 守卫函数 | **union**：`withDB`（HEAD，GAP-49）**与** `marketData`（上游，GAP-14）两个闭包**并存**——二者互补，叠加在**不同**路由上 |
| 同上 | 路由段 | **union**：`==================== VERIFIER ====================`（含 `/api/v1/verifier/verify`）**与** `==================== AGENT API & DEVELOPER SERVICES ====================`（含 `jsonEnvelope`、`/api/v1/agent/{bind,pay}`、`/api/v1/developer/{packages/claim-or-purchase,keys,stats,agents}`）**整段并存** |
| `backend/internal/httpapi/router_test.go` | `newTestRouter` 签名（`func(*Deps)` vs `func(*config.Config)`） | 见 §3「语义冲突 1」——**非纯机械冲突** |
| 同上 | 尾部用例 | **union**：HEAD 的 `dbGatedRoutes`/GAP-49 三个用例**与**上游的 `TestAgentAPIRoutes_BindAndPay` 并存 |
| `docs/GAP台账.md` | 四处 | 见 §3「语义冲突 2」——**非纯机械冲突** |

**路由并集核验**（`router.go` 注册表实测 **29** 条 = 25 条 `methodOnly` + 4 条裸注册）：

| 侧 | 代表路由 | 在合并结果中 |
| --- | --- | --- |
| HEAD (W1) | `/api/v1/verifier/verify` | ✅ |
| 上游 | `/api/v1/liquidations` · `/api/v1/market/movers` · `/api/v1/agent/bind` · `/api/v1/agent/pay` · `/api/v1/developer/{keys,stats,agents,packages/claim-or-purchase}` | ✅ |

---

## 2. 真跑的验证（命令与读数均为实测，非转述）

在工作树根 `backend/` 下执行：

| 命令 | exit | 结果 |
| --- | --- | --- |
| `gofmt -l ./internal/httpapi/ ./cmd/api/` | 0 | **空输出**（本次改动的文件全部干净） |
| `go build ./...` | 0 | 通过 |
| `go vet ./...` | 0 | 通过 |
| `go test -count=1 ./...` | 0 | **全部 `ok`**，**15 个包有测试 · 7 个 `[no test files]`**（共 22 行），**0 FAIL** |
| `go test -race -count=1 ./...` | 0 | **全部 `ok`**，无 `DATA RACE` |

**`go test -count=1 ./...` 的包级读数**（节选，全量见命令输出）：

```
ok  github.com/koliance/backend/internal/agentapi      1.338s
ok  github.com/koliance/backend/internal/agentcard     1.069s
ok  github.com/koliance/backend/internal/chain         1.178s
ok  github.com/koliance/backend/internal/config        0.654s
ok  github.com/koliance/backend/internal/game          1.459s
ok  github.com/koliance/backend/internal/httpapi       3.457s
ok  github.com/koliance/backend/internal/liquidation   0.759s
ok  github.com/koliance/backend/internal/liquidator    1.221s
ok  github.com/koliance/backend/internal/market        1.400s
ok  github.com/koliance/backend/internal/oracle        1.158s
ok  github.com/koliance/backend/internal/perp/nonce    0.619s
ok  github.com/koliance/backend/internal/perp/position 0.660s
ok  github.com/koliance/backend/internal/platform/database 1.201s
ok  github.com/koliance/backend/internal/settlement    0.649s
ok  github.com/koliance/backend/internal/verifier      0.627s
```

**冲突标记清零**：对 `git ls-files` 全部文件逐个扫 `^(<<<<<<<|>>>>>>>) ` → **零命中**。

---

## 3. 两处**语义冲突**（非纯机械，已解，附理由）

### 3.1 语义冲突 1 · `router_test.go` 的 `newTestRouter` 助手被两侧改成**不同签名**

**两侧改的是同一个函数、但改的是不同维度**：

| 侧 | 签名 | 目的 |
| --- | --- | --- |
| HEAD (W1) | `newTestRouter(t, mutate func(*Deps))` | 让用例能改 `Deps`（`d.DB = nil`、`d.Verifier = nil`）以驱动 GAP-49 的 `withDB` 判据 |
| 上游 | `newTestRouter(t, mutate func(*config.Config))` | 让用例能改 `cfg`（设 `AlpacaAPIKey/Secret`）以打开 `marketData` 闸门 |

**这不是"取一边"能解的**：选 HEAD 则上游的 `market_test.go` / `market_edge_qa_test.go` 编译不过；
选上游则 W1 的 `qa_degradation_test.go` / GAP-49 用例编译不过。

**解法（union 的两侧能力都保住）**：取 **HEAD 的 `func(*Deps)` 签名**（`Deps` 内含 `Cfg`，
故 `*Deps` **严格强于** `*config.Config`——上游的实际用法 `mutate(cfg)` 可由 `mutate(d.Cfg)` 表达），
并**保留上游** `newTestRouter` 函数体的**全部新内容**：

- `oracle.SetDataBaseURL(...)`（上游为 `marketData` 闸门加的）
- `cfg.AlpacaAPIKey/Secret` 的测试默认值（上游加，注释保留了它为何不破坏 trade 校验用例）
- `probeCache` 重置（上游加，health 探针缓存）

两侧**无一处被丢弃**；下游调用点两侧都无需改动。

### 3.2 语义冲突 2 · GAP 编号 **GAP-51 / GAP-52 在两侧各有一义**

**实测依据**（`git merge-base HEAD MERGE_HEAD` = `1f5f007`）：合并基线 `1f5f007` 的台账
**最高号是 GAP-50**。故两侧各自**从 GAP-51 起取号**，且**各自登记前检索都零命中**——
**双方在本合并前都是对的**，**同号两义是合并后才出现的**：

| 原号 | W1 侧含义 | 上游侧含义 |
| --- | --- | --- |
| GAP-51 | `005_settlement_ledger.sql` 未在真实 PG 上执行过（🔴） | 核心问题区字体浅色低对比 + 背景无自主波纹（✅，`docs/changes/022`） |
| GAP-52 | `sanitizeDSNError` 残余暴露（🟠） | 前端 `/api/market` 本地生成行情（✅，`docs/changes/028`） |

**裁决**（按本仓 D4「**登记前先检索、撞车比漏登记更糟**」与台账既有口径「以先合并者为准重编」）：

- **W1 侧让号**：`GAP-51 → GAP-57` · `GAP-52 → GAP-58`（`upstream/main` 是已合并的上游，先合并者）
- 上游侧 **GAP-51 / GAP-52 不变**（`docs/changes/022` 与 `028` 里对它们的引用因此**无需改动**）
- 重编**不新占号**：57/58 取代原本会取到的 55/56，故 **GAP-55 / GAP-56 未被占用**

**同一批落地**（否则就是"两处不同成熟度的事实"）：

| 落点 | 处数 | 内容 |
| --- | --- | --- |
| `docs/GAP台账.md` | 2（§1 表两行）+ 2（§5 表两行）+ 2（§5.7 标题）+ 1（§1 GAP-43 行内引用）+ 1（§5 末注） | 见下 |
| `docs/changes/035` | 5 | §5.4 附注、§5.6 表两行、§6 自述、§未做表 |
| `docs/changes/036` | 2 | §5 gofmt 附注、§7 表第 5 行 |

**结构性调整（非重编号）**：W1 的缺口小节原为 **§5.2**，与上游的 `### 5.2 GAP-38` **号位相同**。
合并后**独立成节并让位**：**W1 的 §5.2 → §5.7**（迁至 §5.6 之后）。上游 §5.2~§5.6 **号位不动**。

**保留不改写的**（历史快照纪律，与前例 `027/028 → 035/036` 同口径）：

- `docs/changes/035` §5.8 的 `?? docs/changes/027-*.md`（**当时的 `git status` 命令输出**）
- `docs/GAP台账.md` §5.7 的 `git grep -n "GAP-51\|GAP-52"`（**当时的检索命令**，已加一行注明"这是检索当时的字符串"）

### 3.3 语义冲突 3（**合并后才暴露**，非 git 冲突）· QA 路由清单与 `router.go` 漂移

**这是本次合并第二个"测试全绿 ≠ 被测的东西被覆盖"的实例**，单独记下：

`internal/httpapi/qa_degradation_test.go`（W1 侧 `docs/changes/036` 的产物）自称
"inventory 是**从 `router.go` 推导**的**每一条**注册路由"。但它写于 W1 分支，
**枚举的是当时那 20 条**。合并进上游的 9 条路由后，**它的注释成了假话**——
而它**自己不会响**：`TestQARouteBehaviorWithoutDatabaseHandle` 对新路由**一无所知**，
照样全绿；`TestQARouteInventoryIsComplete` 只遍历**清单内**的路径，**不会反向发现缺项**。

**真实报错（实测 stdout，非推断）**——它有牙的那一半确实响了，但响的是**另一条**路由：

```
--- FAIL: TestQARouteBehaviorWithoutDatabaseHandle (2.66s)
    qa_degradation_test.go:106: GET /api/v1/market/prices: 502, want 200 (unguarded: PriceOracle over the Alpaca data API)
          body: {"error":"market: alpaca bars: Get \"http://127.0.0.1:1/...\": dial tcp 127.0.0.1:1: connectex: ..."}
    qa_degradation_test.go:122: inventory: 6 guarded, 13 unguarded, 20 total
```

**根因（两条独立的口径漂移在此叠加）**：

1. `/api/v1/market/prices` 现在**在 `marketData` 闸门之内**。该闸门要求
   `cfg.AlpacaConfigured()`；W1 的 `newTestRouter` **不设** Alpaca 凭据，闸门关闭 → 503；
   而上游那份 `newTestRouter` **设了**（它正是为此）。§3.1 的 union 已把这一设置取回，
   但清单里仍写 `want 200`。
2. 该路由在**上游侧**的真实契约是 **502**（上游 `do` 上游不可达 → 断言 502，
   见 `market_test.go:441` 与 `market_edge_qa_test.go:871`），不是 200。
   **W1 的 200 是在"该路由还没有 `marketData` 闸门、且 Alpaca 可达"的旧世界里的读数。**

**处置**：清单**按 `router.go` 重推**，补入上游的 9 条，并修正 3 条 market 路由的期望值
（`prices`/`movers` → **502**、`overview` → **500**，均以**上游自己的用例**为口径源，不自创）。

**负向确认（D3）——修正后的清单仍有牙**，实测：

```
    qa_degradation_test.go:145: inventory: 6 guarded, 23 unguarded, 29 total
--- PASS: TestQARouteBehaviorWithoutDatabaseHandle (0.91s)
```

两侧**都不为空**（`guarded==0 || unguarded==0` 会 `t.Fatal`），且总数 **29 == `router.go` 实测的 29**——
清单与注册表**同口径**，不再是"看起来在覆盖"。

---

## 4. 未竟（已登记台账，本记录不另立编号）

| # | 事项 | 归属 |
| --- | --- | --- |
| 1 | `005_settlement_ledger.sql` 仍未在真实 PG 上执行 | **GAP-57**（🔴，阻塞于环境：本机无 docker/psql/凭据）。本轮合并**未改变**其状态 |
| 2 | `sanitizeDSNError` 残余暴露 | **GAP-58**（🟠） |
| 3 | `docs/changes/022`、`027`、`028` 各存在**两个同名不同号**的文件（上游合并带入，非本次引入） | **未处理**——本次硬边界是"解 `git` 冲突标记 + 让 build/test 全绿"，**不改上游既有的文件命名**。此处只作**观察记录**，若需收口由总控另行派发 |
| 4 | 全库 Go 源码**既存** gofmt 债务（CI 不跑 gofmt） | GAP-58 的附注（既有） |

---

## 5. 本记录的口径声明

- **本记录取号 038，`037` 让号**：`037` 已被并行分支的
  `docs/changes/037-gitleaks基线补登与凭证卫生.md` 占用（`git log --all --name-only -- docs/changes/` 实测）。
  取号前已按 `AGENTS.md` §6 做**全分支并集**复核：并集最大号为 `037`，**`038` 未被任何分支占用**。
  这与本仓既有口径「以先合并者为准重编」一致（前例：W1 的 `027/028 → 035/036`）。
- 本文所有命令**均真跑**，读数取自真实 stdout / exit code，**无一条为推断**（D1）。
- 两侧功能**各保留**，**无"取一边"的处置**；两处语义冲突的解**都写明"为何不能取一边"**（D2/D3）。
- **`memory.md` 未改动**（子代理不得改运行态，由总控沉淀）。
