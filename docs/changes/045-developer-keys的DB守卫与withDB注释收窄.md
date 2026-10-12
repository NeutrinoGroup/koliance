# 045 · `POST /api/v1/developer/keys` 未套 `withDB`（F-1）+ `withDB` 注释收窄（C3）

> **环**：02 开发（修 F-1 / C3）· 03 测试（判据随之改口径，**含负向对照**）
> **分支**：`feat/w1-ai-infra-foundation`（worktree `koliance-w1`）
> **来源**：`falsifier` 独立证伪报的 **F-1**，经总控代跑复核。
> **取号（D4 / `AGENTS.md` §6）**：`docs/changes/` 全分支并集最大号 `043`，`044` 已被本轮的 settlement 记录占用 → **`045`**。
> **先写后填**：本文件在动手前立，落地后回填实测（§4 全是真跑 stdout）。

---

## 1. 缺口

| 事实 | 证据 |
| --- | --- |
| `router.go` 注册 `/api/v1/developer/keys` 时**没有** `withDB(...)` | 改前 `:748`（现 `:776`） |
| 而它调的 `agentapi.GenerateAPIKey` **写 `api_keys` 表**，经 `s.db.Pool.Exec` | `agentapi/service.go:157-169` |
| 被守的 6 条 | `router.go` 的 `:205/:218/:258/:288/:364/:383` |
| **这是唯一一条经 `db.Pool` 落盘却未守的路由** | 见 §3 的审计 |

**为什么它躲过了 GAP-49 那一轮**：它的写是 **best-effort**——`GenerateAPIKey` 把 INSERT 放进
**goroutine** 且**丢弃错误**（`agentapi/service.go:158-168`）。于是它在「无 DB」时**不会报错、不会 500**，
只会**返回 200 + 一个谁也查不回来的 key**。这正是 GAP-49 要消灭的形状（"成功了但什么都没落盘"），
只是它藏在「best-effort」这个理由后面。

---

## 2. 裁定：它该 fail-closed 吗？——**该**

两个候选：

| 选项 | 判据 |
| --- | --- |
| **（A）加 `withDB`** | 需要能说清「无 DB 时它不该工作」 |
| （B）维持 best-effort，只修 `withDB` 的注释（C3） | 需要能说清「设计上就该无 DB 也工作」 |

**选（A）**，三条理由，逐条落在已读到的代码上：

1. **进程本来就起不来。** `cmd/api` 在无 `DATABASE_URL` 时**非零退出**（`database.New` 返回错误 →
   `log.Fatalf`）。所以「无 DB 仍服务此路由」**在任何真实部署里都不可达**；
   `withDB` 在这个路由上是**零成本的**（不牺牲任何实际可达的能力）。
2. **它的 200 在说谎的方向上。** 无 DB 时它回 `code:200` + `raw_key:kol_live_…`，
   而 `api_keys` 里没有这一行。**调用方拿到的是一把查不回来的钥匙**——
   「失败即无声」的标准形状（D3）。对照：`/api/v1/developer/stats`、`/agent/bind`、
   `/packages/claim-or-purchase` 的**全部状态都在内存**，它们回 200 是**如实的**。
3. **它与会话内其他路由同类，不是特例。** `/api/v1/agent/bind` 与 `/agent/pay` 已在
   **bearer key** 上失败闭合（会去 `ValidateAndDeductKey`），而这个路由是**发 key 的入口**——
   整条 key 生命周期的源头反而没有守卫，说不通。

**代价（已核）**：无。`cmd/api` 恒注入非 nil 的 `agentapi.Service` 且恒有 DB，
故**生产路径的 200 行为不变**；变红的只有「无 DB 却仍 200」这一条不可能之路。

### 2.1 为什么不选（B）——因为（B）**不完整**

（B）声称「设计上就 best-effort」。但注释（C3）与**事实**的差距不是「宽了一点」，而是**说反了**：

- 现注释说 `withDB` 覆盖的是 **`every route whose handler persists through the DB handle`**。
- 事实是：**7 条经 `db.Pool` 落盘**（`market/price_oracle.go:139` 之外，见 §3），
  而改前守卫是 **6 条**；且持 `MemoryStore` 却经 `db` 句柄写的 `game` / `agentcard`
  走的是 **`db.MemoryStore`**、不碰 pool（那是 GAP-47，另一件事）。
- 即：**「是不是 best-effort」根本不是那道守卫的判据**——守卫守的是**「路由有没有碰到 pool」**，
  而这句注释用了一个**它没有实现**的规则去描述自己。

**两个口径都改**：`withDB` 的注释按**实际覆盖范围**重写（§2.2），这条路由按同一口径**纳入守卫**。
这样「注释」与「事实」**此后无法漂移**——因为守卫的边界与注释的边界是同一句话。

### 2.2 新注释（`router.go:72` 起）

不再宣称一条规则，而是**列出两组**并说明读 503 的方式：

| 组 | 含义 | 例 |
| --- | --- | --- |
| `store of record` | 处理器**只能**经 DB 句柄给出答案 | `game` / `agentcard` / `developer/github proof` |
| `best effort` | 内存作答，DB 写**在 goroutine 里且错被丢弃** | `agentapi` 的 `api_keys` 插入 |

并显式写下**旧注释错在哪**（原句与 `developer/keys` 这个反例），
以免下一个人凭那句「every route」推出一条不存在的保证。

---

## 3. 审计：还有别的「经 DB 句柄落盘却未守」的路由吗？——**没有，只此一条**

方法不是「读实现方列的清单」，而是：**把 `db.Pool` 的全部使用点找出来，再逐个映射回路由**。

```
$ git grep -n "INSERT INTO|UPDATE |DELETE FROM|Pool\.(Exec|Query|QueryRow)" -- backend/
backend/migrations/005_settlement_ledger.sql:38   INSERT INTO settlement_accounts   (迁移，非请求路径)
backend/migrations/003_idempotency_and_configs.sql:25 INSERT INTO system_configs   (迁移，非请求路径)
backend/internal/agentapi/service.go:161          s.db.Pool.Exec  -> INSERT INTO api_keys        ← 本轮的洞
backend/internal/liquidation/store.go:124         INSERT INTO liquidation_events                ← 见下
backend/internal/platform/database/db.go:210      INSERT INTO system_configs                    ← 见下
```

`db.Pool` 的**全部**接触点（含读）：

```
$ git grep -n "Pool\." -- backend/ --and -e "db\.Pool"
```

| 使用点 | 谁调的 | 有请求路由吗 | 结论 |
| --- | --- | --- | --- |
| `agentapi/service.go:161` | `GenerateAPIKey` | **`POST /api/v1/developer/keys`** | **本轮修** |
| `liquidation/store.go:124` | `liquidation.Store.Record` | **没有**——只有 `cmd/liquidator` 调；HTTP 侧只有 `Latest`（读） | 不在「落盘路由」内。`/api/v1/liquidations` 是**读**路由，且 nil store → 空列表是**如实**的（没有 Bot 写过就是没有）。**已另行登记为 GAP-71 的相邻观察**（见 `docs/changes/046`） |
| `database/db.go:186/210` | `DB.GetConfig` / `DB.SetConfig` | **没有**调用方（`git grep` 零命中） | 死代码，不是路由 |
| `db.MemoryStore.*` | `game/service.go:306`、`agentcard/service.go:134/266` | 是 | **不碰 pool**（内存），属 **GAP-47**（证明不落库），**不在本审计范围** |
| `market.Service.db` | `market/service.go:22` 赋值 | — | **全包仅赋值、从未读取**（实测；与 `docs/changes/040 §5` 的读数一致） |

**结论**：**`developer/keys` 是唯一一条**。审计的覆盖面是**双向**的——
既查「守卫里的路由是否真的需要」（是的），也查「需要守卫的路由是否都在里面」（改前**不是**，改后是）。

### 3.1 顺带发现：`dbGatedRoutes` 的注释也是同一类过度声称（C3 的同族）

`router_test.go:303` 原写：

> `The list is data, not prose, so a new persisted route that forgets withDB shows up as a test failure`

**这句不成立**：新路由只加进 `router.go`，**不会**自动进这个清单；两个用例只遍历清单，
所以**新落盘路由会静默免测**——`developer/keys` 就住在这个缝里。
本轮**把注释改成实情**（并写明「要让它成立，需要一条反向检查」），
**反向检查本身登记为 GAP-70**（不是本轮做）。

> 这一条值得单独记：**同一个缺陷类（"注释比事实宽"）在一轮里出现了两次**
> ——`withDB` 的注释、`dbGatedRoutes` 的注释。两处都是**看起来在承诺一件机械保证的事，
> 而那件保证不存在**。这类东西**不会被任何测试发现**，因为测试正是被它描述的那个清单驱动的。

---

## 4. 判据与实测（真跑，回灌）

### 4.1 正向

```
$ go build ./...        exit=0
$ go vet ./...          exit=0
$ go test ./internal/httpapi/ -race -count=1
ok  github.com/koliance/backend/internal/httpapi   3.390s
```

路由清单（qa 独立套件）改口径后：

```
$ go test ./internal/httpapi/ -run 'TestQA|TestPersistedRoutes' -race -count=1 -v
--- PASS: TestQARouteBehaviorWithoutDatabaseHandle
    qa_degradation_test.go:150: inventory: 7 guarded, 22 unguarded, 29 total
--- PASS: TestQARouteInventoryIsComplete
--- PASS: TestQADBGatePrecedesValidationAndAuthOnGuardedRoutes
--- PASS: TestPersistedRoutesRefuseWithoutDBHandle
--- PASS: TestPersistedRoutesRefuseWhenNotConnected
ok  github.com/koliance/backend/internal/httpapi   2.732s
```

**`6 guarded → 7 guarded`，`29 total` 不变**——路由数没变，变的是分类。

### 4.2 负向（**这条是本轮的证据核心**）

把刚加的 `withDB` 摘掉（变异），**三条判据同时变红**：

```
$ go test ./internal/httpapi/ -run 'TestQARouteBehaviorWithoutDatabaseHandle|TestPersistedRoutesRefuseWithoutDBHandle|TestQADBGatePrecedesValidationAndAuthOnGuardedRoutes' -count=1
--- FAIL: TestQARouteBehaviorWithoutDatabaseHandle
    POST /api/v1/developer/keys: 200, want 503 (guarded (withDB): the only agentapi route that reaches db.Pool)
    inventory: 6 guarded, 22 unguarded, 29 total
--- FAIL: TestQADBGatePrecedesValidationAndAuthOnGuardedRoutes
    POST /api/v1/developer/keys ({"wallet_address":"0x0000...0001"}): 200, want 503
    POST /api/v1/developer/keys ("not json"): 400, want 503
--- FAIL: TestPersistedRoutesRefuseWithoutDBHandle
    POST /api/v1/developer/keys without a DB handle: 200 {"code":200,"data":{"key_id":"key_85e9a9d5c429",
    ...,"raw_key":"kol_live_85e9a9d5c4292730dee1dfeecd7234a3b7f69c09671ebf39"},"response":"SUCCESS"}
    POST /api/v1/developer/keys: refusal does not name the cause: {...}
FAIL
exit=1
```

**这段 200 响应体就是缺陷本身的白描**：无数据库、仍回 `code:200`、
并给出 `raw_key: kol_live_…`（真值已在此截断展示，原输出为完整 48 字节十六进制）——
**而 `api_keys` 里没有这一行**。随后还原，`-race` 全绿。

**两条判据是独立的**：一条读**清单分类**（qa 的独立套件），一条读**实现方自己的清单**
（`dbGatedRoutes`）。两条都抓到了；只跑一条也能抓到，但**只保留一条就少一层**。

---

## 5. 未做 / 明确不做

| 项 | 处置 |
| --- | --- |
| 让 `api_keys` 的插入**不再是** best-effort（改成同步 + 报错） | **不做**：那是**改 GAP-49 之外的持久化语义**（成功/失败的边界会变），属 product/architect 决策；本轮的口径是「守卫到位，注释如实」 |
| 反向检查「`router.go` 的每条注册 ↔ 清单」的机械守卫 | **不做，登记 GAP-70** |
| `db.MemoryStore` 落盘（game/agentcard）纳入 `withDB` | **不做**：它们**不碰 pool**，纳入会与 GAP-47 的真实缺口混为一谈 |
| `IsConnected` 运行期不变 | **不做，登记 GAP-71**（见 `docs/changes/046`） |

---

## 6. 下游同步清单

| # | 事项 | 承载 |
| --- | --- | --- |
| 1 | `qa_degradation_test.go`（qa 独立套件）改了口径：`developer/keys` 从 unguarded/400 移入 guarded/503，并在「门序」用例里补两条 | 本文件 §4.1；**属判据变更，须由 `falsifier` 复核** |
| 2 | `router_test.go` 的 `dbGatedRoutes` 补入该路由，并把过度声称的注释改成实情 | 本文件 §3.1 |
| 3 | 反向检查缺失 | **GAP-70** |
| 4 | `IsConnected` 运行期不变 | **GAP-71** |
