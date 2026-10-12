# 055 — ADR-006 §3.2 请求日志中间件（只写日志 · 不改响应体）

> **环**：02 开发（ADR-006 实施依赖顺序 §8 的第 ① 步）
> **分支**：`feat/error-handling`（基于 `upstream/main @ 195580a`）
> **来源**：`docs/adr/ADR-006-统一报错处理体系.md` **§3.2**（裁定 2）+ §3.4（脱敏清单）
> **取号（D4 / `AGENTS.md` §6.1）**：全 ref 并集最大 `054` → **`055`**（实测见 §5）
> **先写后填**：本文件在动手前立；§4 落地后回填真跑 stdout。
> **范围**：**只做 §3.2 的中间件**。**不做** §3.3 词表、§3.6 信封、51 处调用点迁移、前端、`contracts/`。

---

## 1. 缺口

`docs/GAP台账.md` §5.12 的 **GAP-74** 解除条件 1 的 **①**：

> `backend/internal/httpapi/` 落请求级中间件（记录 raw error + request-id + 脱敏，**且不改响应体**）

实测现状（本分支 HEAD）：

| 事实 | 证据 |
| --- | --- |
| 无任何 request-id | `git grep` 实测 `backend/internal/httpapi/` 无 `RequestID` / `X-Request-Id` / `slog` |
| 无结构化请求日志 | 结构化日志目前只在 `cmd/liquidator/main.go:29` |
| `cmd/api/main.go` 只有 `fmt.Printf`，**无 slog** | `cmd/api/main.go:106-118` |

**为什么先做中间件**：ADR-006 §8 的顺序不可颠倒——中间件是 §3.3 词表与 §3.6 信封的**前置**，
且它是**唯一**能把 raw error 从"可能入日志"变成"必然入日志"的部件（§6 负面后果 1）。

---

## 2. 三条职责与硬边界（逐条对应 ADR-006 §3.2）

| # | 职责 | 落点 |
| --- | --- | --- |
| 1 | request-id：入 `X-Request-Id` 头取，无则生成；**出写回响应头** | `reqlog.go` `newRequestID` / `loggingMiddleware` |
| 2 | 一行 JSON 日志 `{requestId, method, path, status, durationMs, err}` | `reqlog.go` `recordRequest` |
| 3 | 写日志**前**脱敏（§3.4 七类） | `reqlog.go` `sanitizeLogValue` |

**明确不做**（ADR-006 §3.2 的"中间件明确不负责"三条）：

- **不读也不改响应体** —— 本实现**没有任何 `Write` 调用**（判据 P4 钉死）。
- **不改状态码** —— `statusWriter` 只**观察** handler 已写的码，不覆盖它。
- **不做分类** —— 中间件不判断错误的类别，只记录。

### 2.1 三个具体设计决定（都带"为什么不这么做"）

**① request-id 用 `crypto/rand` 的 hex，不用数字串。**
`market_test.go:166` 的 `priceShapedInText`（`\d+\.\d{2,}|\d{3,}`）会咬住 `\d{3,}`；
`market_test.go:199-201` 又断言拒绝体里**零 JSON 数字**。当前中间件不往 body 写，
但 §3.6 的 `requestId` **要显示在 UI 上**（ADR-006 §3.6 明写），届时一个数字串 id
会让那条判据在**看不见的地方**变红。16 字节 = 32 位 hex，不透明且无数字串。

**② 响应头在 `next.ServeHTTP` **之前**设置，不是之后。**
若在 `next` 返回后设置，`Access-Control-Allow-Origin` 里就没有 `X-Request-Id`
（`middleware.go:33` 的 `Access-Control-Allow-Headers` 列了它，但**响应侧**的
`Access-Control-Expose-Headers` 没列）——浏览器里的前端将**读不到**这个头。
这正是 §3.6「`requestId` 要显示在 UI 上」的前置条件。

**③ 路径脱敏刻意**不**吞掉 `/api/v1/...` 本身。**
§3.4 第 7 项要的是**文件路径 / 主机名 / 内网地址**，不是 URL 路径——URL 路径是本中间件的
主要排查价值（"哪个端点出错"）。故只吞 `file://` · `C:\` · 盘符 · 以及**前有空格**的
`/a/b/c`（`fmt.Errorf("... /etc/foo")` 那种形态）。**不吞 `r.URL.Path`**（它不含空格）。
代价已登记：见 §6。

**④ 不改响应体**，故 `http.MaxBytesReader`（`middleware.go:113`）的 413 不受影响。
**实测 stdlib 源码**（不是推断）：`$GOROOT/src/net/http/request.go:1246-1248` ——
`l.w.(requestTooLarger).requestTooLarge()` 只调 `w.WriteHeader(StatusRequestEntityTooLarge)`
**并直接返回，不写 body**。故中间件在 body 上**可观测地为空**。

---

## 3. 改动清单

| 文件 | 改动 |
| --- | --- |
| `backend/internal/httpapi/reqlog.go` | **新增** —— 中间件 + request-id + 脱敏（新文件，`middleware.go` 一行未动） |
| `backend/internal/httpapi/reqlog_test.go` | **新增** —— 正向用例 + **P4/N5 正反两端** |
| `backend/internal/httpapi/router.go` | `Deps` 加 `Logger *slog.Logger`（**留注入缝**）；`NewRouter` 末尾包一层 |
| `backend/cmd/api/main.go` | 装配 logger（`cmd/liquidator/main.go:29` 同一套 idiom），经 `Deps.Logger` 注入 |

---

## 4. 验证

### 4.1 正向实测（真跑，stdout 回灌）

见 §7。

### 4.2 负向证伪（D3，**真跑**）

| # | 注入 | 判据 | 实测 |
| --- | --- | --- | --- |
| **N5** | 在中间件里 `w.Write` 一个字节 | **P4 必须红** | ✅ 见 §7.2 |
| **P4** | 包装前后 body 逐字节相同（200 / 204 / 错误路径） | pass | ✅ 见 §7.1 |

> **为什么 P4 与 N5 必须成对**：一个"从不写 body"的实现与一个"死掉的实现"
> 在 P4 上**观测等价**（都绿）。只有 N5 仍有牙，才能反推 P4 的绿是**确无改写**，
> 而不是**判据没在跑**（`AGENTS.md` §5 与 §8 的同一条推理）。

**N5 是两阶段的，第二阶段的结论完全依赖第一阶段。**
若变异体本身与真中间件**已经不一致**（复制时漂移了），那"变异体变红"就**同样**
能由漂移解释，**证不出真中间件有任何性质**。故第一阶段先关掉注入、要求二者**逐字节相同**；
只有它绿，第二阶段的红才归因于那一字节的注入（`reqlog_test.go` 的
`TestN5InjectedBodyWriteTurnsP4Red`，含内联说明）。

---

## 5. 取号实测（D4 / `AGENTS.md` §6.1）

命令（在 `$REPO` 执行；`$REPO` 见 `AGENTS.md` §0.0）：

```
git log --all --diff-filter=A --name-only --pretty=format: | Select-String "docs/changes/055"
```

**输出为空 → `055` 全 ref 未被占用。** 全 ref 并集的最大编号为 `054`
（`docs/changes/054-第五次合并upstream-main-union解GAP台账三处冲突.md`，在本分支工作树内）。
`git for-each-ref` 实测 37 个 ref（含 10 个本地分支 + 19 个远端跟踪分支 + `publish`）。

**必须用 `--all`**：只查当前分支会漏掉别的分支上已经取走的号——
本仓真实发生过编号撞车（`AGENTS.md` §8），而撞车比漏登记更糟（D4）。

---

## 6. 未竟 / 已知代价（不在本页解决）

- **§3.3 词表 · §3.6 信封 · 51 处调用点迁移**：**本轮不做**，仍是 GAP-74 的未竟部分。
- **§3.4 第 7 项只做了形态级脱敏**：路径/主机名是**开放形态**，正则永远漏一项。
  残余风险**不新开号**，并入 **GAP-74**（它是同一条解除条件的组成部分）。
- **脱敏的判据受 GAP-61 限制**：`db.go:141` 的 `sanitizeDSNError` 已有同类残余
  （锚点之外的口令回显不脱敏）。本中间件在写日志**前**调用它，**不是替代它**。
- **本判据须独立审**：按 D3「自己写的判据不得自己审」，§4.2 是我自己的负向用例，
  它证明判据**有牙**，**不**证明脱敏**够全**。后者只能由外部质疑。

---

## 6.1 ⚠️ 实测推翻了一条写进源码的理由（**须独立复核**）

`reqlog.go:47-57` 给 hex 编码写的理由是：

> `market_test.go:166` 的 `priceShapedInText`（`\d+\.\d{2,}|\d{3,}`）会咬住 `\d{3,}`……
> 16 字节 = 32 位 hex，**不透明且无数字串**。

**"无数字串"是错的。** 实测（10 万次 `newRequestID()`，判据同 `priceShapedInText`）：

```
ids containing a priceShapedInText match: 99203/100000 = 99.2030%
first example: 28bf4eff3907e1e32e64e2d9c282ae09 -> 3907
```

连续三位十六进制数字太常见，**99.2% 的 id 都命中**。故 §3.6 一旦把 `requestId` 放进响应体，
`market_test.go:199-201`（"拒绝体零 JSON 数字"）会**因为 id 本身**而红——
**不是**因为中间件改了什么，而是因为这条 id 就长这样。

- **id 本身不算错**：不透明、唯一、不可猜，这是 id 该有的性质。**错的是写给它的那条理由**，
  以及由此产生的预期偏差——§3.6 的落地者会撞上一条**与本改动无关**的红。
- **已固化为判据**：`TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement`
  （`reqlog_test.go`）把 99.2% 这个读数**钉成地板**（要求 ≥90%）。它不是在断言一条性质，
  而是**在记录一个测量**：哪天 id 变成真的无数字串，它会**变红**，那时该改的是
  `reqlog.go:47-57` 的注释——这是让一条**错误理由**体面退场的唯一方式。
- **与 ADR-006 §6 负面后果 4 是同一条**：ADR 已写明 `market_test.go:182-184` 会先红，
  且**处置属 03 环**（改判据要带负向对照，不许直接删）。本条**收窄了它的成因**。
- **为什么只能由外部裁**：这是"我推翻我自己上一轮写的注释"。判据是我写的，
  读数是本机实测的，**两者都不构成独立证据**（D3）。请独立复核上面那两行命令的输出。

**未登记新编号**：本条不是新的"还没做"，而是 ADR-006 §3.6 落地时必须处理的
**既有冲突的新增成因**，故并入 **GAP-74**（与 §6 其它残余同一口径，不另开号）。

---

## 7. 附：真跑 stdout 原文（回灌，未编辑）

### 7.1 全量（`go build` / `go vet` / `go test -race -count=1 ./...`）

```
$ go build ./...                                     -> exit 0
$ go vet ./...                                       -> exit 0
$ go test -race -count=1 ./...
?   	github.com/koliance/backend/cmd/api	[no test files]
?   	github.com/koliance/backend/cmd/liquidator	[no test files]
?   	github.com/koliance/backend/cmd/migrate	[no test files]
ok  	github.com/koliance/backend/internal/agentapi	2.632s
ok  	github.com/koliance/backend/internal/agentcard	1.955s
ok  	github.com/koliance/backend/internal/chain	2.891s
?   	github.com/koliance/backend/internal/chain/bindings	[no test files]
ok  	github.com/koliance/backend/internal/config	1.553s
?   	github.com/koliance/backend/internal/developer	[no test files]
ok  	github.com/koliance/backend/internal/game	2.283s
ok  	github.com/koliance/backend/internal/httpapi	4.903s
ok  	github.com/koliance/backend/internal/liquidation	1.524s
ok  	github.com/koliance/backend/internal/liquidator	1.962s
ok  	github.com/koliance/backend/internal/market	2.054s
?   	github.com/koliance/backend/internal/model	[no test files]
ok  	github.com/koliance/backend/internal/oracle	1.990s
ok  	github.com/koliance/backend/internal/perp/nonce	1.462s
ok  	github.com/koliance/backend/internal/perp/position	1.479s
ok  	github.com/koliance/backend/internal/platform/database	2.429s
?   	github.com/koliance/backend/internal/platform/stripeclient	[no test files]
ok  	github.com/koliance/backend/internal/settlement	1.455s
ok  	github.com/koliance/backend/internal/verifier	1.392s
ok  	github.com/koliance/backend/scripts/coverage-gate	1.732s
                                                     -> exit 0
```

### 7.2 P4 正向 + N5 负向（`-race -v`，节选原文）

```
$ go test -race -count=1 -v -run "TestLoggingMiddlewareDoesNotAlterBody|TestStatusWriterKeepsResponseControllerWorking|TestN5InjectedBodyWriteTurnsP4Red|TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement" ./internal/httpapi/

=== RUN   TestLoggingMiddlewareDoesNotAlterBody
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/200_via_jsonResponse
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/503_refusal_via_jsonError
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/204_with_no_body
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/body_written_in_two_calls,_implicit_200
--- PASS: TestLoggingMiddlewareDoesNotAlterBody (0.01s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/200_via_jsonResponse (0.01s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/503_refusal_via_jsonError (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/204_with_no_body (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/body_written_in_two_calls,_implicit_200 (0.00s)
=== RUN   TestStatusWriterKeepsResponseControllerWorking
--- PASS: TestStatusWriterKeepsResponseControllerWorking (0.00s)
=== RUN   TestN5InjectedBodyWriteTurnsP4Red
    reqlog_test.go:338: N5 injection: handler produced "{\"status\":\"healthy\"}\n", the mutated middleware produced "!{\"status\":\"healthy\"}\n"
--- PASS: TestN5InjectedBodyWriteTurnsP4Red (0.00s)
=== RUN   TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement
    reqlog_test.go:498: 997/1000 generated ids match priceShapedInText (example: f5844bded57a6ded89b60e30bf85a3ae -> "5844") — see the doc comment above
--- PASS: TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement (0.02s)
PASS
ok  	github.com/koliance/backend/internal/httpapi	2.363s
                                                     -> exit 0
```

**N5 那一行是这条判据的全部要点**：同一 handler、同一请求，
**唯一差别是中间件里多了一次 `Write`**，响应体就从 `{"status":"healthy"}\n`
变成 `!{"status":"healthy"}\n`——**P4 的比对必须能看见这个差别，而它确实看见了**
（若看不见，`TestN5InjectedBodyWriteTurnsP4Red` 会在 `t.Fatal` 处失败）。

### 7.3 覆盖率门禁（`go run ./scripts/coverage-gate`，节选原文）

```
$ go test -count=1 -covermode=atomic -coverprofile=coverage/coverage.out ./...
ok  	github.com/koliance/backend/internal/httpapi	4.353s	coverage: 81.7% of statements

$ go run ./scripts/coverage-gate
   81.72  76.00    541/662    internal/httpapi               router, middleware, handlers (604 stmts)
────────────────────────────────────────────────────────────────────────────────────────
   72.60  69.00   1810/2493   TOTAL (gated)                  excludes generated + untested-by-design
[OK] Coverage above every floor
                                                     -> exit 0
```

> ⚠️ **两处需总控复验的读数**（都是"数字变了"，不是"门禁绿了"）：
> ① `httpapi` 的 `measured` 仍是 `80.13 / 604 stmts`，而本轮实测是 **`81.72 / 662 stmts`**；
> ② `TOTAL (gated)` 的 `measured` 仍是 `71.99`，实测 **`72.60`**。
> 二者都是**向上**漂移，不影响判绿（`scripts/coverage-gate/main.go:196-201` 的
> `measured` 只是**取地板时的历史读数**，供人看，不参与判定）。**但 `main.go:196` 的
> 注释说"每个地板取自本表读数"**——注释与表已经不一致。**改门禁表的注释属 03/10 环**，
> 本轮**不动**（硬边界），**在此点名**。
> ③ 逐函数实测：`reqlog.go` 12 个函数中 11 个 **100%**，唯一例外是
> `newRequestID` **75%** —— 未覆盖的是 `rand.Read` 失败分支。该分支在 Go 1.24+
> **不可达**（`crypto/rand.Read` 失败时 panic），`reqlog.go:68-71` 已写明。
> 这是**接受的残余**，不是遗漏。

---

## 8. 改动清单与提交

| 提交 | 内容 |
| --- | --- |
| `2d1f169` | `cmd/api/main.go`：建 logger（`cmd/liquidator/main.go:29` 同款 idiom）+ `slog.SetDefault` + 经 `Deps.Logger` 注入 |
| `e36d5bb` | `internal/httpapi/reqlog_test.go`：P4 / N5 / request-id / 脱敏 / 错误链判据（840 行，新增文件） |
| （上一轮，未提交） | `internal/httpapi/reqlog.go`（新增）· `internal/httpapi/router.go`（`Deps.Logger` + 末尾包一层） |

`SetDefault` **不是装饰**：`NewRouter` 在 `Deps.Logger` 为 nil 时回落到 `slog.Default()`，
没有这一行，回落目标就是 stdlib 的**文本 handler + stderr**——同一个进程产出**两种形状**的日志流。
`cmd/api` 的启动横幅仍是 `fmt.Printf`（**本轮未动**，硬边界），故**同一进程的 stdout 上
文本横幅与 JSON 日志并存**；横幅只出现在启动瞬间、服务器开始服务之前，故当前无消费方受影响。
若将来有采集器按行解析 stdout，这是要先处理的一处——**登记在此，不另开号**。

---

## 9. 硬边界声明（本轮）

**未碰**：`ADR-006 §3.3` 词表 · `§3.6` 响应体信封 · `router.go` 的 **51 处** `jsonError` 调用点 ·
前端（`src/`）· `contracts/` · `memory.md`。
本轮**只**新建 `internal/httpapi/reqlog_test.go`、改 `cmd/api/main.go`，并回填本文件。
`middleware.go` / `health.go` / `validate.go` / `market_test.go` **一行未动**
（`reqlog_test.go` 只**读取** `market_test.go` 的 `priceShapedInText`，不改它）。

**§3.6 落地者必读**：见 §6.1 —— `market_test.go:182-184` 会红，且**成因之一是 id 自身的形态**，
不只是"多了一个键"。
