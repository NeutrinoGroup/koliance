# 036 — W1 的独立 03 环测试（qa-validator）

> **编号更正（2026-10-11 · 跨分支撞号）**：本文件原名 **`028-…`**，与**并行未合并分支**
> `feat/real-alpaca-data` 的 `docs/changes/028-前端真实行情与涨跌幅排行.md` **撞号**。同批重编：
> **`027 → 035`**（`docs/changes/035-GAP43-44-49-复式记账与ZK插槽与降级显式化.md`）· **`028 → 036`**（本文件）。
> 选号前已做全分支并集复核：`git log --all --name-only --pretty=format: -- docs/changes/` 的并集最大号为 `034`,
> 故 **`035` / `036` 未被任何分支占用**。
> **本文件内所有指向 `027` 的引用已一并改为 `035`**（它们是**指针**——读者要按它打开文件；
> 不改会指到一个不存在的路径）。**正文其余内容逐行未改**（历史留痕）。

- **日期**：2026-10-11（UTC）
- **环**：03 测试（**独立于实现方**——`AGENTS.md` §4.2：实现方自写自验 ≠ 03 环准出）
- **类型**：新增测试（**不改生产代码**）
- **关联**：**GAP-43**（`settlement_ledger`）· **GAP-44**（ZK 插槽）· **GAP-49**（DB 降级显式化）
- **上游**：`docs/changes/035`（W1 实现方自述）· 任务书 `docs/planning/推进方案-Trust-Identity-AI-Infrastructure.md` §3.3 A3/A4 + §3.1 T3
- **分支**：`feat/w1-ai-infra-foundation` @ `ae6ffba`
- **采集环境**：Windows 10 · `go1.25.7 windows/amd64` · 工作树干净（写测试前 `git status --porcelain` 为空）

> **本文件不改写 `035` 的任何结论**。它只回答一个问题：**`035` 的判据，由别人来验，还站得住吗？**

---

## 1. 范围与判据（动手前立）

| 项 | 独立判据 | 结果 |
| --- | --- | --- |
| A3 复式记账 | 借贷平 = **intent 级试算平衡**；能抓「少记一腿」；边界（零额/单腿/极值） | **成立**，见 §3 |
| A4 verifier 插槽 | no-op 契约；调用点边界（空/非法输入）；不得假绿 | **成立**，见 §4 |
| T3 DB 降级 | **枚举全部路由**，判「无 DB 时该 503 还是该 200」；找漏网的落盘路由 | **未击穿**，见 §5 |
| 并发 | `Journal` 高并发 append（`-race`） | **击穿**，见 §6 |

---

## 2. 交付物

| 文件 | 用例数 | 说明 |
| --- | --- | --- |
| `backend/internal/settlement/qa_ledger_test.go` | **22**（21 PASS + 1 SKIP） | 独立于 `ledger_test.go`；**不复用其 helper**（helper 共享 = 同一处错误假设藏两次） |
| `backend/internal/httpapi/qa_degradation_test.go` | **11**（10 PASS + 1 SKIP） | 路由清单**由 `router.go` 的注册项独立推导**（20/20），不复用实现方的 `dbGatedRoutes`（6 条） |

合计独立用例 **33 条**（31 绿 / 2 故意跳过）。

```
$ go test ./internal/settlement/ ./internal/httpapi/ -run TestQA -race -count=1
ok  github.com/koliance/backend/internal/settlement  1.545s
ok  github.com/koliance/backend/internal/httpapi     3.918s
exit=0
```

**全仓回归（含既有用例，混合口径）**：`go test ./... -count=1 -v` → **PASS 129 · FAIL 0 · SKIP 2**
（settlement 44 例，其中独立 22；httpapi 28 例，其中独立 11）。
两条 SKIP 都是**故意跳过的破坏性/环境依赖复现器**，各有显式开关：§6（并发崩进程）与 §5.1（GitHub 回退分支）。

`go build ./...` exit=0 · `go vet ./...` exit=0 · 两个新文件 `gofmt -l` 空输出（仓库另有既存 gofmt 债务，见 GAP-58 附注，**未顺手重排**）。

---

## 3. A3：复式记账不变量——**实现方的判据成立**

**判据原文（`ledger.go:365-378`）**：不变量是 **per-intent 试算平衡**（借方合计 == 贷方合计），
**刻意不是**前缀式逐笔平衡。独立复验结论：**成立，且理由与实现方所述一致**。

| # | 用例 | 预期信号 | 实测 |
| --- | --- | --- | --- |
| A1 | 三腿凭证 `100 = 98 + 2` | 绿 | ✅ `balanced=true`，前三腿逐笔本就必然不平 |
| A2 | 四腿 `100 = 97 + 2 + 1`（两笔费用腿） | 绿 | ✅ |
| A3 | 单腿（正常转账少记贷方） | 红 `ErrNotBalanced`，且错误点名 intent | ✅ |
| A4 | 三腿凭证**漏记费用腿**（留两条合法分录） | 红 | ✅ `debit total 100 != credit total 98` |
| A5 | 三腿凭证里 **1e-18** 的差额 | 红 | ✅ `100 != 99.999999999999999999` |
| A6 | 自平 intent（借贷同一账户，各 100） | 绿（**算术判据，非语义判据**） | ✅ 余额归零 |
| A7 | 零额两腿 | 红 `ErrSingleSided` | ✅ 与 DDL 的 `ck_settlement_ledger_single_sided` 同口径 |
| A8 | **50 个 intent 里第 17 个少一腿** | 红，且**点名 `qa-many-17`** | ✅ |
| A9 | 两个 intent 反向不平、**全局净额为零** | 红（全局净额不是充分判据） | ✅ 且错误点名 |
| A10 | `balance_after` 用**错账户口径** | 红 `ErrBalanceAfterMismatch` | ✅ |
| A11 | `balance_after` 写成**发生额**而非**累计余额** | 红 | ✅ |
| A12 | 列宽边界（18+18 位）可用；各多一位则 `ErrBadAmount` | 绿/红 | ✅ |
| A13 | `0100.000` == `100`（前导/尾随零） | 绿 | ✅ |
| A14 | 非 ASCII 数字 `١٠٠` / `１００`、`+100`、`1e3`、`.5`、`100.`、`1_000`、U+2212 `−100` | 红 `ErrBadAmount` | ✅ 全部拒绝 |
| A15 | `ParseAmount("")` = 0（"未用列"的书写法） | 绿 | ✅ |
| A16 | `seq` = 0 / 负 / `MinInt64` → 红；`MaxInt64` 位置可用 | ✅ | ✅ |
| A17 | **两个 intent 用同一 `ledger_seq`** | 红 `ErrDuplicateSeq` | ✅ 与 DDL 的 `UNIQUE` 一致 |
| A18 | `Summary()` 承载证据（含 `balanced=true` 与各账户余额） | 绿 | ✅ |

### 3.1 判据**抓不住**什么——写成可执行的限制（`TestQATrialBalanceCannotSeeWhichPairIsIncomplete`）

这是本节的**主结论**，**实现方的判据没错，但它有边界**：

> 试算平衡是**每个 intent 的合计**比较，因此**无法区分**「一条合法的四腿凭证」与
> 「两个事件共用一个 `intent_id`」。只要合计仍相等，**其中一个事件少了一腿，会被另一个事件多出的一腿抵消**。

最小反例（实测**被判为 `balanced=true`**）：

```
seq 1  AVAILABLE_BALANCE    debit  100
seq 2  SETTLEMENT_CLEARING  credit 100     <- 事件 X，完整
seq 3  FROZEN_ESCROW        debit  100     <- 事件 Y 的借方，其贷方从未写入
seq 4  FEE_REVENUE          credit 100     <- 这条贷方可以让总额相消，且无从判断它属于谁

settlement: 1 intent(s), total debit 200
  intent=qa-merged entries=4 debit=200 credit=200 balanced=true
```

**这不是"实现方漏了一条检查"，而是"D3 意义上的判据边界"**：schema 里**没有凭证键**
（`SETTLEMENT_CLEARING` 是**唯一**被两个事件共享的账户，故账户本身也不能当键）。
实现方在 `ledger.go:365-378` 说明的正是这一点。**故本条不判「判据有洞」，判「判据有边界」**，
但**边界必须先写下来**——否则下一个读代码的人会以为「平了」就等于「每条腿都在」。

**已就位**：该用例**断言当前行为**，并在 `err != nil` 时以 `t.Fatalf` 报「限制已被关掉，请反转本条」。
即：**收紧判据的人会看到它红**，不会静默漏过。

---

## 4. A4：verifier 插槽——**未击穿**

| # | 用例 | 预期信号 | 实测 |
| --- | --- | --- | --- |
| B1 | 插槽未注入 → 503（且点名 verifier，不是 panic） | 绿 | ✅ |
| B2 | no-op 对 7 类输入**一律非 200** | 绿 | ✅ 501 或 400 |
| B3 | 18 项边界：`0x`/`0X` 前缀、空/纯空白/裸 `0x` → nil、奇数长十六进制、非 hex、未知 scheme、缺/空白 subject、坏 `publicInputs`、null 字段、类型错、空 body、GET/PUT → 405 | 绿 | ✅ 逐项通过 |
| B4 | **超长 body**（1.4 MB > 1 MiB 上限） | 非 200 | ✅ 400 |
| B5 | 注入「已查验且不通过」→ **400**；注入「技术故障」→ **501** | 两者**不得塌成一个** | ✅ `valid:false` vs 501 |
| B6 | 校验先于插槽（非法输入时 verifier **调用次数 = 0**） | 绿 | ✅ 逐项断言 `calls` |
| B7 | **typed nil 插槽**（`var p *verifier.Noop`） | 记录边界 | ⚠️ **绕过 `== nil` 检查**，返回 501 而非 503；**未 panic**（`Noop` 的方法不解引用接收者）。`cmd/api` 恒注入 `verifier.NewNoop()`，**不可达** |

> B7 判定：**不是活缺陷，是判据的边界**（`d.Verifier == nil` 抓不到 typed nil）。
> 若将来某个实现要在 `Verify` 里读接收者字段，同一模式会 panic。**已写成用例留痕**。

---

## 5. T3：DB 降级覆盖面——**枚举全部路由，未找到漏网的落盘路由**

**方法**：路由清单**从 `router.go` 的注册项独立推导**（`h("…")` 实测 **20 条注册 / 20 条唯一路径**，
清单**20/20 全覆盖**），逐条判「无 DB 时该 503 还是该 200」，
并对**已注册性**做机械校验（`PATCH` 探针：未注册 → 404，注册 → 非 404；**控制组**：不存在的路径确实 404，证明该校验非空转）。

```
$ go test ./internal/httpapi/ -run TestQARouteBehaviorWithoutDatabaseHandle -v
    qa_degradation_test.go:121: inventory: 6 guarded, 14 unguarded, 20 total
--- PASS
```

| 路由 | 无 DB 时 | 该当如何 | 判定 |
| --- | --- | --- | --- |
| `/api/v1/game/steam/profile` · `/api/v1/game/proof` · `/api/v1/developer/github/proof` · `/api/v1/agentcard/generate` · `/api/v1/agentcard/authorize` · `/api/v1/agentcard/batch-settle` | **503** | 503 | ✅ **6/6 落盘路由全覆盖**，且 503 body 都点名 `database` |
| `/health` `/healthz` `/api/v1/health` `/api/v1/stats` | 200 | 200 | ✅ 进程态/常量，503 会把「没库」说成「全挂」 |
| `/api/v1/agentcard/cards/` · `/api/v1/agentcard/session-key` | 401 | 401 | ✅ 先验凭据，且凭据在内存 `tokenHashes`，**不碰库** |
| `/api/v1/market/trade` · `/api/v1/market/close` | 400 / 401 | 非 503 | ✅ 账本在 Alpaca，`market.Service.db` **全包仅赋值、从未读取**（`git grep` 实测） |
| `/api/v1/market/overview` | 500 | 非 503 | ✅ 同上（本机 Alpaca 不可达；**它答 500 恰好证明 DB 守卫不在它身上**） |
| `/api/v1/market/prices` | 200 | 200 | ✅ Alpaca Data API |
| `/api/v1/developer/github/profile` | 200 | 非 503 | ✅ GitHub 数据源、不落盘（**但回退数据无标记，见 §5.1**） |
| `/api/v1/stripe/checkout-session` `/api/v1/stripe/customer` | 400 / 401 | 非 503 | ✅ 账本在 Stripe |
| `/api/v1/verifier/verify` | 501 | 非 503 | ✅ 纯计算 |

**结论：未找到漏网的落盘路由。** 实现方「`withDB` 刻意不覆盖 `health`/`stats`/`market/*`」的口径**成立**，
且**不该覆盖的其他路由（`cards`/`session-key`/`stripe/*`/`verifier`）也确实没被覆盖**——
**两个方向都验了**，不是只验了实现方自己列的那 6 条。

补充实测（实现方未列）：
- **门序**：`withDB` **先于**输入校验与 operator 校验（`not json` / 无 token / 错 token → 仍是 503）。✅
- **未连接句柄**（`IsConnected=false`）→ 503 且带 `Retry-After: 5`；nil 句柄则**不带**（永久故障 vs 瞬时故障）。✅
  实测：`503 Retry-After="5" body={"error":"database is not reachable; ..."}`
- **观察（非阻断）**：`/api/v1/health` `/healthz` `/health` `/api/v1/stats` **未套 `methodOnly`**，
  `PATCH` 也返回 200，而其余路由 405。「方法不允许」不是本路由器的属性——只读 handler 下无害，**记录在案**。

### 5.1 补记：相邻的一条同族缺口（**已存在，非 W1 引入**）

`/api/v1/developer/github/profile` **不在 `withDB` 内**，这一点**是对的**（它不落盘）。
但它的**数据来源**是另一回事：GitHub 不可达时 `developer.Service.GetDeveloperStats`
返回 `err == nil` + HTTP 200 + **硬编码的 repos/stars/CreditAllowanceUSD**（`developer/github.go:144-163`），
**与真实读数同形同域**——即 `docs/changes/018` 关掉的 **GAP-14**（合成数据以实时形态返回）**同一类缺陷**，
而且**响应类型里根本没有能表达来源的字段**：

```
$ go test ./internal/httpapi/ -run TestQAFindingGithubProfileCannotExpressProvenance -v
    qa_degradation_test.go: FINDING EVIDENCE - the 200 body ... carries no way to say whether the numbers
    were read from GitHub or fabricated:
      {"username":"...","publicRepos":13,"followers":4,"totalStars":4,...,"buidlTier":"CORE BUIDLER","creditAllowanceUSD":1000}
```

**判据缺口性质**：可证伪，**已给出运行级证据**（决定性复现，不依赖外网）：

```
$env:HTTPS_PROXY='http://127.0.0.1:1'; $env:QA_GITHUB_OFFLINE='1'
$ go test ./internal/httpapi/ -run TestQARuntimeGithubFallbackIsFabricated -v -count=1
    RUNTIME EVIDENCE (5/5 hard-coded literals present) - GitHub unreachable, still HTTP 200, no marker:
    {"username":"qa-definitely-not-a-real-user-zzz", ..., "company":"AI Friendly","location":"Earth",
     "publicRepos":13,"followers":3,"totalStars":5,...,"buidlTier":"CORE BUIDLER","creditAllowanceUSD":1000}
--- PASS
exit=0
```

**注意**：请求的是一个**不存在的用户名**，GitHub 必答 404 → 客户端返回错误 → 回退分支接管 →
**HTTP 200 + 硬编码身份与授信额度**。`"username":"qa-definitely-not-a-real-user-zzz"` 与
`"company":"AI Friendly"` 同时出现在一个 200 响应里，**调用方无从分辨**。

另有一条**不依赖网络**的判据（`TestQAFindingGithubProfileCannotExpressProvenance`）：
对 `developer.DeveloperStatsResponse` 做**反射**，断言**没有任何字段/JSON tag 能表达来源**
（`source` / `synthetic` / `fallback` / `stale` / `live` / `fresh` 全部不命中），
控制组是「该类型序列化后确实含 `creditAllowanceUSD`」——**证明上面那段扫描不是空转**。

---

## 6. 并发：**击穿**——`Journal` 并发 append 会以不可恢复的 `fatal error` 终止进程

```
$env:QA_CONCURRENT_JOURNAL='1'
$ go test ./internal/settlement/ -run TestQAJournalConcurrentAppendCrashesTheProcess -count=1
fatal error: concurrent map writes
  ...(*checker).apply(...)   ledger.go:295 (read: c.seenSeq / c.states)
  ...(*checker).apply(...)   ledger.go:303 (write: c.states[e.IntentID] = st)
  ...(*Journal).Append(...)  ledger.go:408
exit=-1
```

- **复现率**：**5 / 5 次全崩**（`-count=1`，64 goroutine，起跑栅栏对齐）。故障在
  `concurrent map writes` 与 `concurrent map read and map write` 之间交替。
- **`-race` 亦直接判定 DATA RACE**（`mapassign_faststr` @ `ledger.go:303` vs `mapaccess1_faststr` @ `ledger.go:295`）。
- **性质**：`fatal error` **不是可 recover 的 panic**，它会**终止整个测试二进制**，
  把同一次运行里其他用例的结果一起带走。**实现方的 22 条用例之所以没想到它**，
  正是因为它们全部单线程串行调用 `Append`——**没有一条并发用例**。

### 6.1 严重度裁定：**Latent-High，当前不可达**

| 判据 | 事实 | 依据 |
| --- | --- | --- |
| 有没有生产写入方 | **没有** | `git grep -n "settlement\.\(CheckEntries\|NewJournal\|Journal\|Entry\)"` **全仓零命中**（非测试代码） |
| 那算缺陷吗 | **算** | 包**自己**的注释写明 `ledger_seq` 由 sequence 分配、"rows written concurrently commit out of order"（`005` 迁移 §3 注释），即**它把自己定位成一个为并发准备的组件**；而「并发 append 不 panic」是一个**契约**，不是"可选的优化"。`AGENTS.md` D3 的反面正是"错了不会响"——这一条**会响，但响得让整个进程倒掉** |

**故不判「已坏」，判「判据缺口」**：`docs/changes/035` 的 **§5.7「未验证项」没有列这一条**——
它列了 PG 未跑、SQL 方言未知、脱敏残余，**唯独没写"Journal 无并发契约、无并发用例"**。
按 D1/D3，**未验证必须写明**；这一条属于「未验证」而非「已验证通过」。

### 6.2 已就位的旁证：**契约内**的并发是干净的

`TestQAIndependentJournalsAreRaceClean`：64 个 goroutine 各持**独立** `Journal`，
共享工厂/解析器/账户枚举，`-race` 下 **64×8 笔全绿**。
→ 说明**共享的无状态部分没有 race**，问题**只在 `Journal`/`checker` 的实例状态**上。
这条把 §6 的结论收窄了：**不是"整个包没法并发用"，是"一个 Journal 不能被并发 append，而这件事没写下来、没测"**。

---

## 7. 与 `035` 的对照：**采信 / 未采信**

| `035` 的陈述 | 本轮的独立结论 |
| --- | --- |
| M1~M5 变异测试让判据变红 | **采信**（未复跑变异；本轮以**独立用例**从另一侧逼近同一批判据） |
| §5.6 偏离①：判据从「任意前缀」改为「intent 试算平衡」 | **采信，并复验**：三腿凭证 ✅ 通过，证明原表述确实会**拒绝正确凭证** |
| §5.7「`settlement_ledger` 当前没有生产写入方」 | **采信**：`git grep` 零命中，独立复核一致 |
| §5.7「未做/未验证」清单 | **不完整**：**缺「`Journal` 并发契约缺失、无并发用例」**（§6） |
| §5.8「硬边界自查：既有路由语义未改」 | **采信**：18 条路由逐条比对，行为与守卫位置一致 |
| `005` 迁移 §21-25 的注释「任意前缀…必须为零」 | **过期陈述**：该表述**已被实现在落地时否掉**（`ledger.go:365-378`），但迁移文件里的注释**没改**。同一不变量**两处不同成熟度**（D4）。实现方已在 `035 §1` 的警告里指向 §5.6，**但它指向的是变更记录，不是那块会被人当规格读的 DDL 注释** |

---

## 8. 下游同步清单与未竟

| # | 事项 | 承载 |
| --- | --- | --- |
| 1 | `Journal` 并发契约：要么加锁/加文档（"非并发安全"），要么给并发用例 | **待登记 GAP-53**（编号前须 `git grep`，见下） |
| 2 | `005_settlement_ledger.sql:21-25` 的注释与 `ledger.go` 的实际判据不同成熟度 | 本轮**不改**（不在硬边界内，且属他人文件的陈述）；建议由持有该文件的一方改 |
| 3 | `/api/v1/developer/github/profile` 回退数据无 provenance 标记 | 建议并入 **GAP-47**（同文件同函数的落库缺口）或新登记 |
| 4 | `health`/`stats` 未套 `methodOnly`（PATCH → 200） | 观察项，无严重度 |
| 5 | `005` 迁移仍未在真实 PG 上执行 | **GAP-57**（既有，🔴；登记时原文为 GAP-51，2026-10-11 合并时因撞号重编）——本轮同样**无 PG 可用**，未改变其状态 |

> **编号动作留给总控**：本轮**未**写入 `docs/GAP台账.md`（硬边界：`memory.md` 与台账由总控沉淀）。
> 已实测 `GAP-5[0-9]` 当前占用 **50/51/52**，故**下一个可用号为 GAP-53**（`git grep -ho "GAP-[0-9]\+"` 全仓实测）。

---

## 9. 硬边界自查

```
$ git status --porcelain
?? backend/internal/httpapi/qa_degradation_test.go
?? backend/internal/settlement/qa_ledger_test.go
```

- **生产代码零改动** ✅（`go build` / `go vet` / 全仓 `go test` 与写测试前同样通过）
- `contracts/` 零改动 ✅ · `internal/perp/` 零改动 ✅
- `memory.md` 未改 ✅ · `docs/GAP台账.md` 未改 ✅（编号建议见 §8）
- `docs/changes/035` 未改 ✅（**历史快照不改写**；2026-10-11 的重编号只改了它的文件名与顶部说明，**正文逐行未动**）

### [未能验证] 清单（**明确，不伪装**）

| 项 | 为何 |
| --- | --- |
| `005_settlement_ledger.sql` 在真实 PG 上的行为 | 本机**无 docker、无 psql、无 `DATABASE_URL`**（与 `035 §5.7` 同因）。**DDL 层的"前缀 vs 试算平衡"分歧在 SQL 侧仍不可验证** |
| `035` 的 M1~M5 变异读数 | 未复跑（属"复核他人读数"，非"独立测试"）。本轮的独立用例从另一侧覆盖了同一批判据 |
| typed nil 插槽在"会解引用接收者"的实现下是否 panic | 只验到 `*verifier.Noop` 不解引用 → 不 panic。**未构造**会解引用的替身去复现 panic（无生产影响，未投入） |
