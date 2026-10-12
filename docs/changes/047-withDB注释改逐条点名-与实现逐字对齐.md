# 047 — `withDB` 注释与实现**逐字对齐**（F-1' 第 2 轮：量化句仍宽 + 两组分类覆盖不全）

> **环**：02 开发（**只改注释**，不动守卫行为、不动任何路由语义）
> **分支**：`feat/w1-ai-infra-foundation`（worktree `koliance-w1`）@ `c9380b9`
> **来源**：`falsifier` **第 2 轮独立证伪**报的 **F-1'**（总控已代跑取证）。
> **取号（D4 / `AGENTS.md` §6）**：全分支并集最大号 `046` → **`047`**（实测见 §5）。
> **先写后填**：本文件在动手前立；§4 落地后回填真跑 stdout。

---

## 1. 缺口（F-1' 复述 + 本轮**加深**的诊断）

`router.go` 的 `withDB` 注释（改前 `:72-102`）在 `docs/changes/045` 里刚收窄过一次，
但**收窄得不彻底**——它把旧的假规则（「every route whose handler persists through the DB handle」）
换成了**另一条同样假的量化句**：

> `What it covers is every route that reaches the pool`（改前 `:99`）

### 1.1 falsifier 已取证的两条

| # | 事实 | 证据 |
| --- | --- | --- |
| F-1'a | `/api/v1/liquidations` **未套 `withDB`**，却**经 `db.Pool` 读回** | 注册处 `router.go:195`；装配 `cmd/api/main.go:90` 用 `liquidation.NewPG(db.Pool)`；`liquidation/store.go:157` 的 `Latest` 读 `liquidation_events`。**它 reaches the pool**，却既不在守卫内、也不在例外清单里 |
| F-1'b | 新注释把被守路由分 `store of record` / `best effort` **两组**，但两组**盖不住** `/api/v1/game/steam/profile` | 该 handler（`game/service.go:147`）读 Steam、**不碰 pool**，两组都不属于 |

### 1.2 本轮读实现后**加深**的诊断（比 F-1' 报告更宽）

逐条读 `game` / `agentcard` 的实现后，**「两组」的分类与事实的偏离不止 `steam/profile` 一条**：

| 被守路由 | 注释称其属于 | 实现事实 | 证据 |
| --- | --- | --- | --- |
| `/api/v1/game/steam/profile` | 两组都不属于 | 读 Steam，**零 pool 读取** | `game/service.go:147-232` 全函数无 `db` 引用 |
| `/api/v1/game/proof` | `store of record` | 写的是 **`db.MemoryStore.AppendProof`**——**内存**，**不是 pool** | `game/service.go:305-306` |
| `/api/v1/agentcard/generate` | `store of record` | 写的是 **`db.MemoryStore.SaveCard`**——**内存** | `agentcard/service.go:131-134` |
| `/api/v1/agentcard/authorize` | `store of record` | 写的是 **`db.MemoryStore.AppendTransaction`**——**内存** | `agentcard/service.go:265-266` |
| `/api/v1/agentcard/batch-settle` | `store of record` | `BatchSettle` 遍历**内存切片** `s.transactions`，**完全不碰 db** | `agentcard/service.go:315-345` |
| `/api/v1/developer/github/proof` | `store of record` | `developer.Service` **不持有 db**，生成哈希即返回 | `developer/github.go:127-133`、`213-238` |
| `/api/v1/developer/keys` | `best effort` | ✅ 属实：goroutine + 丢弃错误的 `Pool.Exec` | `agentapi/service.go:157-169` |

**即：注释说的 `store of record` 组（"the handler's write or read IS the DB handle"）
在它点名的 5 条（`game` / `agentcard` / `developer/github proof`）里，5 条全与实现不符**
（4 条走 `MemoryStore`、2 条连 db 都不碰——`game/proof`、`agentcard/generate`、`agentcard/authorize`
是前者；`batch-settle`、`github/proof` 是后者）。
**被守的 7 条里只有 1 条（`developer/keys`）的分类与实现相符，且它在"另一组"。**

> **这解释了守卫为什么守那 7 条**：它不是「谁碰了 pool 就守谁」，也不是「谁碰了 DB 的就守谁」，而是
> **「谁在 GAP-49 那轮被想到、且无 DB 时拒绝是零成本的」**。`docs/changes/045 §2` 已经写明
> 守卫的判据**不是**「是不是 best-effort」；本轮补上的是**同样不是**「是不是 store of record」。
> **真正的事实只有一个：这 7 条是被挑出来的一批，不是一条规则推导出来的一批。**

---

## 2. 裁定：`/api/v1/liquidations` 该不该守？——**不该（选 b）**

| 选项 | 说明 | 判定 |
| --- | --- | --- |
| **(a) 纳入 `withDB`** | 无 DB → 该路由 503 | ❌ **否** |
| **(b) 保持不守，把注释改准** | 显式列为例外 + 修正两组覆盖不全 | ✅ **采纳** |

### 2.1 选 (b) 的理由（逐条落在已读到的代码/文档上）

1. **nil → 200 空列表是 `docs/changes/025 §4` 的显式设计决定，不是缺陷。**
   原文标题即「**API 端点：公共只读，空库/无库均返回空列表**」，
   且 `024`/`025` 的目标第 2 条明写：`DATABASE_URL` 缺失时**降级为只打日志**、
   **绝不阻断清算主循环**——观测是**旁路**（`liquidation/store.go:1-9` 的包注释同口径）。
2. **该口径已被 qa 独立清单显式判为「如实」，且带理由。**
   `qa_degradation_test.go:70`：`"unguarded: nil store degrades to an empty list, and an empty list
   is the truth when no bot has written one"`。**选 (a) 要同步改这份独立判据与它的理由**——
   那是**推翻一条已成立的 03 环判断**，需要的是新证据而不是一句更严的注释。
3. **它的 200 没有"说谎的方向"。** 与 `developer/keys` 恰恰相反：后者无 DB 时回
   `raw_key: kol_live_…` 而 `api_keys` 里没有这一行（**调用方拿到一把查不回来的钥匙**，
   `docs/changes/045 §2`）；而「没有清算事件」在**无观测 store** 时**就是空列表这件事本身**。
   响应形状里没有"我存到了某处"的隐含承诺。
4. **它的降级路径是显式的，不是静默的。** `Store` 是接口、`NewPG(nil)` **返回 nil**
   （`liquidation/store.go:86-91`）、`Deps.Liquidations` 的注释**明写**
   「Nil (no DATABASE_URL) degrades to an empty list」（`router.go:41-43`）。
   静默降级是**没说出口的降级**，这里说出口了。
5. **`withDB` 在它身上并非零成本。** 它会引入一条**无 DB 即 503** 的新契约——
   而该端点是**前端大屏轮询**用的观测面（`025 §4`），503 会让"没有观测数据"与
   "服务不可用"**塌成同一个信号**——正是 `router.go:96-99` 自己反对的那种塌缩。

> **与 `developer/keys` 的对照（一句话）**：那条守，因为它的 200 承诺了一件没发生的事；
> 这条不守，因为它的 200 **没有承诺任何没发生的事**。

### 2.2 `store of record` / `best effort` 两组怎么办？——**废掉这两组**

两组的问题**不是"覆盖不全，补一条就行"**，而是**分类法本身是错的**（§1.2：6 条里错 5 条）。
把它们补齐会得到一个**仍然以假前提命名**的分类。故改为：
**守卫集合 = 逐条点名的一张完整清单**（7 条注册），再把「为什么这几条」如实说成
**"被挑出来的一批，不是一条规则"**，并显式写下**两版假量化句**（原句 + 045 那句）与它们的反例。

例外侧**不再宣称穷尽**——只列「读者最可能误判为漏洞的几条」（`liquidations` / `health…` / `market/*`），
并以 `including` 式措辞给例，**不写 `every`**。

---

## 3. 改动清单（只改注释，零行为变更）

| 文件 | 行 | 改动 |
| --- | --- | --- |
| `backend/internal/httpapi/router.go` | `:72-118` | **整段重写 `withDB` 的注释**：删掉 `every route that reaches the pool`；废掉两组分类；改为**被守 7 条逐条点名** + 例外侧给例不给全称；写明两版假量化句的反例 |
| `docs/changes/047-*.md` | 本文件 | 记录 |

**未改（有意）**：

| 项 | 为何 |
| --- | --- |
| `withDB` 的**函数体** | 本轮只治"注释比事实宽"；守卫行为一字不动 |
| `/api/v1/liquidations` 的**注册** | 选 (b)：保持 best-effort（§2） |
| `qa_degradation_test.go` | 该套件**属 03 环独立判据**（`AGENTS.md` §4.1「自己写的判据不得自己审」）；其分类**未变**，**不该由实现方改** |
| `router_test.go` 的 `dbGatedRoutes` 注释 | `045 §3.1` 已改准（"a record of the routes somebody thought about"）——**与本轮结论一致**，无需再动 |
| `docs/changes/045 §2.2` 的两组表 | **历史快照不改写**（`AGENTS.md` §5「已发生的事实不需要准」）；其结论已被本文件与本轮注释取代，指针见 §6 第 2 条 |

---

## 4. 判据与实测（真跑 stdout，采集 2026-10-12）

### 4.1 注释 → 实现的逐字对照（选 (b) 的验收核心）

**被守集合**——注释点名的 7 条 ↔ `router.go` 里真正被 `withDB` 包裹的注册项。
判据是把**注册项**与**注释清单**分别机械列出再求交：

```
$ Select-String -Path backend/internal/httpapi/router.go -Pattern 'h\("/api|h\("/health|withDB\('
 240: h("/api/v1/game/steam/profile",  methodOnly(http.MethodGet,  withDB(func(...
 253: h("/api/v1/game/proof",          methodOnly(http.MethodPost, withDB(func(...
 293: h("/api/v1/developer/github/proof", methodOnly(http.MethodPost, withDB(func(...
 323: h("/api/v1/agentcard/generate",  methodOnly(http.MethodPost, withDB(func(...
 399: h("/api/v1/agentcard/authorize", methodOnly(http.MethodPost, withDB(func(...
 418: h("/api/v1/agentcard/batch-settle", methodOnly(http.MethodPost, withDB(operator(func(...
 792: h("/api/v1/developer/keys",      methodOnly(http.MethodPost, withDB(func(...
```

`withDB(` 的**出现次数 = 7**，且**逐条与注释点名一致**（顺序亦一致）。
**关键控制组**：`/api/v1/verifier/verify`（`:622`）**无 `withDB`**——注释**未**把它列入被守集合
（本轮起草时曾误列，已在提交前撤掉，见 §4.3 的说明）；`/api/v1/liquidations`（`:211`）同样无 `withDB`，
注释把它**显式写在例外侧**。

**例外集合**——注释在「Not gated」段**举例**（`health`/`healthz`/`stats`/`market/*`/`liquidations`），
措辞为 `including at least` + 结尾明写 `examples, not an enumeration - do not read "including" as "only"`，
**不含任何全称量词**（`every` / `all` / `only` 均不出现于例外句）。

> **判据的诚实边界**：§4.1 是**人工比对**（两条命令的输出），**不是机械守卫**——
> 注册项与注释清单之间**没有**自动对拍。这正是 **GAP-70**，本轮不做（§7）。

### 4.2 正向

```
$ go build ./...                          exit=0
$ go vet ./...                            exit=0
$ gofmt -l internal/httpapi/router.go     （空输出）exit=0
$ go test -race -count=1 ./...
ok  github.com/koliance/backend/internal/agentapi       2.544s
ok  github.com/koliance/backend/internal/agentcard      1.575s
ok  github.com/koliance/backend/internal/chain          2.615s
ok  github.com/koliance/backend/internal/config         1.492s
ok  github.com/koliance/backend/internal/game           3.116s
ok  github.com/koliance/backend/internal/httpapi        4.143s
ok  github.com/koliance/backend/internal/liquidation    1.633s
ok  github.com/koliance/backend/internal/liquidator     1.963s
ok  github.com/koliance/backend/internal/market         2.246s
ok  github.com/koliance/backend/internal/oracle         2.212s
ok  github.com/koliance/backend/internal/perp/nonce     1.490s
ok  github.com/koliance/backend/internal/perp/position  1.568s
ok  github.com/koliance/backend/internal/platform/database 2.557s
ok  github.com/koliance/backend/internal/settlement     1.662s
ok  github.com/koliance/backend/internal/verifier       1.514s
exit=0
```

**这条全绿说明的是"注释改动没碰行为"，不是"注释改对了"**——注释的文本没有任何编译器或运行时判据。
故 §4.3 是必需的。

### 4.3 负向（**两条变异，各自证明一侧的边界有判据**）

> **说明**：注释文本本身**不可机械验真**（这正是 D3 点名的"错了不会响"）。
> 故负向验证的目标不是"注释对不对"，而是**注释两侧的边界是否都处在有牙的判据之下**：
> 若边界移动，**是否会有测试变红**。两侧都验了。

**变异 ①：按选项 (a) 给 `/api/v1/liquidations` 套上 `withDB`。**

```
$ # 变异：h("/api/v1/liquidations", methodOnly(http.MethodGet, func(...
$ #       → h("/api/v1/liquidations", methodOnly(http.MethodGet, withDB(func(...
$ go test ./internal/httpapi/ -run 'TestQARouteBehaviorWithoutDatabaseHandle|TestLiquidationsNilStoreReturnsEmptyList' -count=1
--- FAIL: TestLiquidationsNilStoreReturnsEmptyList
    liquidations_test.go:98: nil store: 503
--- FAIL: TestQARouteBehaviorWithoutDatabaseHandle
    qa_degradation_test.go:134: GET /api/v1/liquidations: 503, want 200 (unguarded: nil store
      degrades to an empty list, and an empty list is the truth when no bot has written one)
          body: {"error":"database is not configured; this endpoint cannot serve requests without it"}
    qa_degradation_test.go:150: inventory: 7 guarded, 21 unguarded, 29 total
FAIL
exit=1
```

**两条独立判据同时变红**（实现方的 `liquidations_test.go` + qa 独立清单）。
即：**(a) 不是一个"改个注释就完事"的选项**——它要么推翻 `docs/changes/025 §4` 的设计决定，
要么让上述两条判据连同它们的理由一起改。这正是 §2 选 (b) 的**可执行依据**，不是偏好。
（已还原。）

**变异 ②：从 `/api/v1/game/proof` 摘掉 `withDB`**（即让"注释的被守集合"比实现多一条）。

```
$ go test ./internal/httpapi/ -run 'TestPersistedRoutesRefuseWithoutDBHandle|TestQARouteBehaviorWithoutDatabaseHandle' -count=1
--- FAIL: TestQARouteBehaviorWithoutDatabaseHandle
    qa_degradation_test.go:134: POST /api/v1/game/proof: 200, want 503 (guarded (withDB))
    qa_degradation_test.go:150: inventory: 6 guarded, 22 unguarded, 29 total
--- FAIL: TestPersistedRoutesRefuseWithoutDBHandle
    router_test.go:341: POST /api/v1/game/proof without a DB handle: 200 {...}, want 503
FAIL
exit=1
```

**两侧对称**：把守卫**移出**被守集合（变异 ②）与把新路由**移入**（变异 ①）
**都会让判据变红**。故本注释列举的被守集合**不是自由文本**——它被两条独立用例钉住。
（已还原，复跑 §4.2 全绿。）

> **一处自查（写下来，因为它差一步就重演本轮的缺陷）**：起草时曾把
> `/api/v1/verifier/verify` 写进被守清单（"pure computation, no store"），
> 而它**并没有** `withDB`（`router.go:622`）。这是**同一个缺陷类的第三次发作**——
> 注释列了一条实现没有的项。由**机械列出注册项**（§4.1 的 `Select-String`）当场抓到并撤掉。
> **教训**：本轮的方法（先列注册项、再写注释）**本身就是判据**；凭记忆写清单会以 1/7 的概率再犯。

`docs/changes/047` 的最终 diff：`router.go` **+42 / -26**，**全部落在注释块内**（`gofmt` 空输出可证
其结构未变）；生产逻辑**零改动**。

---

## 5. 取号复核（D4：登记前先检索）

```
$ git log --all --name-only --pretty=format: -- docs/changes/ \
    | Where-Object { $_ -match 'docs/changes/\d{3}' } | ... | Sort-Object -Unique | Select-Object -Last 6
036 037 038 044 045 046        → 全分支并集最大号 = 046，未被占用 → 047

$ git grep -ho "GAP-[0-9]\+" -- docs/ | ... | Sort-Object -Unique | Select-Object -Last 5
67 68 69 70 71                 → 最大号 = 071 → 本轮**无需**新号
```

本轮**不新增 `GAP-` 编号**：§7 的三条未竟事项全部落在**既有**编号（`GAP-47` / `GAP-70`）内，
按 D4「撞车比漏登记更糟」**不新开号**。

---

## 6. 下游同步清单与未竟

| # | 事项 | 承载 |
| --- | --- | --- |
| 1 | `withDB` 注释已与实现逐字对齐；**"注释宣称一条它没实现的规则"这一缺陷类在本处闭合** | 本文件 §4.1 |
| 2 | `docs/changes/045 §2.2` 的 `store of record` / `best effort` 两组**已被本轮的逐条点名取代**（该处保留为历史快照） | 指针即本条 |
| 3 | **`/api/v1/liquidations` 是唯一"reaches the pool 却不守"的路由**——本轮**判为应当如此**（§2），但**判据是散文式的** | 见 §7 |
| 4 | 让"被守集合 = 注释清单"**机械化**（即 `GAP-70` 的反向对拍） | **GAP-70**（既有，本轮不做） |

---

## 7. 未竟 / 明确不做

| 项 | 处置 |
| --- | --- |
| 反向对拍（`router.go` 注册 ↔ 注释/清单） | **不做，GAP-70**。本轮把**守卫集合写成一张完整清单**，已把"将来加路由"的暴露面**收窄到与 `dbGatedRoutes` 同级**；机械化仍待 GAP-70 |
| `game`/`agentcard` 的 `MemoryStore` 写入不落 PG | **不做**（`GAP-47`，另一件事）。本轮**只在注释里点名它**，以免读者把"被守"误读成"已落库" |
| 给 `liquidations` 加 `withDB` | **不做**，见 §2 |
