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
若在 `next` 返回后设置，响应上就不会有 `X-Request-Id`——`WriteHeader` 之后的头被
net/http 丢弃，结果是 recorder 里有、线上没有，最坏的一种。

> ⚠️ **本节此处原文有一条失实断言，本轮（A7）已更正——原文照录，不删**：
>
> > `middleware.go:33` 的 `Access-Control-Allow-Headers` 列了它，但**响应侧**的
> > `Access-Control-Expose-Headers` 没列……这正是 §3.6「`requestId` 要显示在 UI 上」的前置条件。
>
> **前半句是假的。** 实测（本轮）：`middleware.go:33` 当时的值是
> `"Content-Type, Authorization, X-Requested-With"`，**不含** `X-Request-Id`；
> 且**全仓无 `Access-Control-Expose-Headers`**（`git grep` 只命中本文件这一行）。
> 也就是说，对**唯一有 `Origin` 的调用方（浏览器）**而言，这个头**既发不出去也读不回来**——
> §3.6 的前置条件当时**并不具备**，而原文说它具备。
> **后果不是"少配一个头"**：§3.6 的落地者会照这句话以为前置已满足，
> 于是把 `requestId` 放进信封、在 UI 上渲染，然后在真实跨源环境里拿到 `undefined`，
> 而单元测试**全绿**（`httptest` 不施加 CORS）。
>
> **本轮修法（两件事必须一起做，只做一件等于没做）**：
> ① `middleware.go` 的 `corsAllowHeaders` 加入 `X-Request-Id`（前端才**发得出**）；
> ② 新增 `Access-Control-Expose-Headers: X-Request-Id`（前端才**读得到**）。
> 判据：`TestCORSExposesTheRequestIDToCrossOriginScripts`（`router_test.go`），
> 覆盖 preflight 与实请求两侧，并对**非白名单 origin** 断言两个头都缺席。
> 该判据做过负向对照：去掉 ② 后它变红（实测 stdout 见 §7.4）。

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
| `backend/internal/httpapi/reqlog.go` | **新增** —— 中间件 + request-id + 脱敏 |
| `backend/internal/httpapi/reqlog_test.go` | **新增** —— 正向用例 + **P4/N5 正反两端** |
| `backend/internal/httpapi/router.go` | `Deps` 加 `Logger *slog.Logger`（**留注入缝**）；`NewRouter` 末尾包一层 |
| `backend/cmd/api/main.go` | 装配 logger（`cmd/liquidator/main.go:29` 同一套 idiom），经 `Deps.Logger` 注入 |
| `backend/internal/httpapi/middleware.go` | **A7 追加** —— `corsAllowHeaders` 加入 `X-Request-Id`，并新增 `Access-Control-Expose-Headers` |
| `backend/internal/httpapi/router_test.go` | **A7 追加** —— `TestCORSExposesTheRequestIDToCrossOriginScripts` |

---

## 4. 验证

### 4.1 正向实测（真跑，stdout 回灌）

见 §7。

### 4.2 负向证伪（D3，**真跑**）

| # | 注入 | 判据 | 实测 |
| --- | --- | --- | --- |
| **N5** | 在中间件里 `w.Write` 一个字节（每个方法） | **P4 必须红** | ✅ 见 §7.2 |
| **N5(POST)** | 只在 `r.Method == POST` 时写一个字节 | **P4 的 POST 行必须红**；且 GET-only 比对**必须干净** | ✅ 见 §7.2.1 |
| **P4** | 包装前后 body 逐字节相同（GET/POST/DELETE × 200 / 204 / 400 / 405） | pass | ✅ 见 §7.1 |
| **A7-CORS** | 去掉 `Access-Control-Expose-Headers` | CORS 判据必须红 | ✅ 见 §7.4 |

> **为什么 P4 与 N5 必须成对**：一个"从不写 body"的实现与一个"死掉的实现"
> 在 P4 上**观测等价**（都绿）。只有 N5 仍有牙，才能反推 P4 的绿是**确无改写**，
> 而不是**判据没在跑**（`AGENTS.md` §5 与 §8 的同一条推理）。

**N5 是两阶段的，第二阶段的结论完全依赖第一阶段。**
若变异体本身与真中间件**已经不一致**（复制时漂移了），那"变异体变红"就**同样**
能由漂移解释，**证不出真中间件有任何性质**。故第一阶段先关掉注入、要求二者**逐字节相同**；
只有它绿，第二阶段的红才归因于那一字节的注入（`reqlog_test.go` 的
`TestN5InjectedBodyWriteTurnsP4Red`，含内联说明）。

### 4.3 ⚠️ 初版的 P4/N5 **只跑 GET**——两半一起瞎（**A1，本轮修**）

**实测**：在真中间件里注入 `if r.Method == http.MethodPost { sw.Write([]byte("!")) }`，
`TestLoggingMiddlewareDoesNotAlterBody` 与 `TestN5InjectedBodyWriteTurnsP4Red`
**双双全绿（exit 0）**。

**为什么这是最重的一处**：`router.go` 有 **15 个 POST 路由**（`grep -c 'methodOnly(http.MethodPost'`），
且**所有写端点都是 POST**。所以这条判据在**它专门要保护的流量**上**恰好是瞎的**——
而它自己的注释写着"P4 钉死了中间件不改 body"。
更糟的是**负向对照与它一起瞎**：N5 也 GET-only，于是"注入没触发"与"判据没牙"
在观测上不可分（`AGENTS.md` §5 对进度页 hook 的同一句推理）。

**修法（两件一起）**：
① P4 的用例表**加方法维**：GET / POST(带 body) / POST(400 拒绝) / POST(204) / DELETE(405)；
② 新增 `TestN5PostOnlyInjectedBodyWriteTurnsP4Red`，断言三件事——
GET 不变（证明确实是**方法**开关而非空操作）· POST 变红 · **GET-only 比对在该变异体上干净**
（把那个盲点本身写成断言）。

**负向实测（正反两端）**：
- 正端（无变异）：8 行全绿，见 §7.1。
- 反端（在**真中间件**注入 POST-only 一字节）：**4 行转红**，且 `N5InjectedBodyWriteTurnsP4Red`
  仍绿——**这正说明旧判据抓不住它**。原文见 §7.2.1。注入已还原。

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
- **§3.4 的脱敏**：初版的自陈是"路径/主机名是**开放形态**，正则永远漏一项"。
  **实测表明这句话把残余说小了**（**A4，本轮修**）。逐条读正则对每一类做形态枚举，
  当时**整类漏网**的有：#1 包内函数名 · #2 `relation "x"` 与 `SQLSTATE:`（冒号）·
  #3 keyword 形 DSN · #5 无 `=` 的裸值 · #6 被截断的第三方 body · #7 无前导空格的路径 ·
  #7 IPv6 / 下划线主机 / `localhost:5432`。
  **本轮能补的正则形态全部补上**（逐条对应 `reqlog.go` 的 `reGoStack` / `reSQL` / `reDSN` /
  `reSecretValue` / `reFilePathRel` / `reHost`），每条配一个**断言密钥缺席**的用例
  （`TestSanitizeLogValue` 的 "was missed" 行）。
  **补不干净的如实列出，并固化为判据**——见下一条。
  残余风险**不新开号**，并入 **GAP-74**（它是同一条解除条件的组成部分）。
- **§3.4 的残余边界（修正后的自陈，逐条可复核）**：

  | 残余 | 为何补不掉 | 钉住它的判据 |
  | --- | --- | --- |
  | **#6 被截断的第三方 body**（**整类**，且是多数情形） | 客户端在 256/512 字符处截断（`alpaca_client.go:192`、`price_oracle.go:209`），**截断恰好破坏闭合 `}`/`]`**——而初版注释正是拿"截断有界"论证这一条安全的。**截断本身就是失配原因**，且无任何形态能识别一个未闭合的 JSON body | `TestSanitizeLogValueKnownResiduals/truncated_third-party_body` |
  | **#6 字符串值里含 `}`** | 第一个 `}` 提前收尾，尾部残留 | `.../third-party_body_with_a_brace_inside_a_string_value` |
  | **#7 无端口的裸单标签主机**（`db_internal`） | 与普通标识符**同形**；`errors.Unwrap` 必须留在网外，故只在 `name:port` 上触发 | `.../bare_single-label_hostname_with_no_port` |
  | **#5 无标签、无已知前缀的裸值**（`the credential is hunter2`） | 一条对任意短 token 生效的值规则会吃掉普通散文 | `.../bare_credential_value_with_no_label_and_no_known_prefix` |

  **这张表本身是判据，不是说明**：`TestSanitizeLogValueKnownResiduals` 断言这些残余
  **仍然存在**。哪天有人补上了其中一条，那条会**变红**，红就是"把这一行从边界表挪进上表"的提示。
  理由与 `AGENTS.md` §8 对自指陈述的判断同源：**散文不参与构建，错了不会响**。
  **未闭合的 #6 不是正则问题**——收口它意味着**根本不把 body 放进错误串**，
  那是 handler 的职责（ADR-006 §3.5），不是一条正则能做的。
- **脱敏的判据受 GAP-61 限制**：`db.go:141` 的 `sanitizeDSNError` 已有同类残余
  （锚点之外的口令回显不脱敏）。本中间件在写日志**前**调用它，**不是替代它**。
- **本判据须独立审**：按 D3「自己写的判据不得自己审」，§4.2 是我自己的负向用例，
  它证明判据**有牙**，**不**证明脱敏**够全**。后者只能由外部质疑。

---

## 6.1 ⚠️ 实测推翻了一条写进源码的理由，并更正了本条自己的归因（**须独立复核**）

`reqlog.go:47-57` 给 hex 编码写的理由是：

> `market_test.go:166` 的 `priceShapedInText`（`\d+\.\d{2,}|\d{3,}`）会咬住 `\d{3,}`……
> 16 字节 = 32 位 hex，**不透明且无数字串**。

**"无数字串"是错的。** 实测（10 万次 `newRequestID()`，判据同 `priceShapedInText`）：

```
ids containing a priceShapedInText match: 99203/100000 = 99.2030%
first example: 28bf4eff3907e1e32e64e2d9c282ae09 -> 3907
```

连续三位十六进制数字太常见，**99.2% 的 id 都命中**。

### 6.1.1 ⚠️ 更正：红的不是 `:199-201`，是 `:182-184`（**A5，本轮修**）

**本节初版把成因归到了错的行。** 逐条读 `assertRefusal`（`market_test.go:168-212`），
它做的是**两条彼此独立**的检查：

| 行 | 检查 | 加一个 `requestId`（**字符串**）会怎样 |
| --- | --- | --- |
| `market_test.go:182-184` | 顶层**键集**必须恰好是 `[error]` | **红**——多了一个键。**与 id 是不是数字串无关** |
| `market_test.go:199-201` | 拒绝体**零 JSON 数字** | **不会红**——hex 是字符串，不是 JSON number |

而且 `priceShapedInText` 只被施加于 **`error` 值的文案**（`market_test.go:188`），
**从不施加于 id**。所以 `:199-201` 这条判据**根本看不见 id**。

**为什么这个区别不是咬文嚼字**：它决定**怎么修**。
"id 的形态把它弄红了"会引导人去改 id 形态（找一个无数字串的编码）——**这条路走不通**：
十六进制字母表里有六个数字字符，32 位 id 出现三位连续数字的概率就是 ~0.992。
"键集把它弄红了"才指向真正要改的东西：**键的允许集**，那是 03 环的判据变更，
且必须带负向对照（ADR-006 §6 负面后果 4 已经这么写了）。
**照初版归因去修，改的是 id，红的是键集——改完照旧红。**

### 6.1.2 那条判据原本**没有分辨力**（A5，本轮修）

初版把它"钉成地板（要求 ≥90%）"。以真实命中率 0.992 对地板 0.90 计算：
需要命中率**塌掉约 9 个百分点**才会触发，`P(失败) ≈ 0`。
**一条永远不可能失败的判据不是判据**——它与"脚本死了"在观测上等价
（`AGENTS.md` §5 对进度页 hook 的同一句推理）。

**修法**：地板改成**区间** `[0.97, 1.0]`（1000 次抽样）。对真值 0.992 留约 2.2 个百分点的
抽样余量（`P(因噪声失败) ≈ 1e-9`），而 id 形态**一旦真变**，两个方向都会立刻触发。
实测：`993/1000`，band `[970, 1000]`。

### 6.1.3 它看不见的两件事（如实标注，不是补充说明）

- **它调用的是同包标识符**：`newRequestID` 与 `priceShapedInText` 都来自 `httpapi` 包。
  改这两个中的任何一个，这条判据会**跟着一起变**。它钉住的是**两者之间的关系**，
  **不是** id 的一条独立性质。
- **它是测量，不是性质断言**：它不拿真实的拒绝信封去跑 `assertRefusal`。
  做那件事的判据是 `market_test.go` 的，且在 §3.6 落地之前**无法从本文件驱动**。

### 6.1.4 其余

- **id 本身不算错**：不透明、唯一、不可猜，这是 id 该有的性质。**错的是写给它的那条理由**，
  以及由此产生的预期偏差。本轮已把 `reqlog.go` 那段注释改写为**照录错误理由 + 更正**
  （保留"曾经这么写、为什么错"，而不是抹掉）。
- **与 ADR-006 §6 负面后果 4 是同一条**：ADR 已写明 `market_test.go:182-184` 会先红，
  且**处置属 03 环**（改判据要带负向对照，不许直接删）。本条**更正了它的成因**——
  ADR 那处**本来就是对的**，错的是本文件 §6.1 的初版。
- **为什么只能由外部裁**：这是"我推翻我自己上一轮写的注释"。判据是我写的，
  读数是本机实测的，**两者都不构成独立证据**（D3）。请独立复核下面这条命令的输出。
- **复核命令**（仓库内即可复跑，不依赖任何临时脚本）：

  ```
  cd backend && go test -count=1 -v -run TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement ./internal/httpapi/
  ```

  它打印的 `N/1000 generated ids match priceShapedInText, band [970, 1000]` 就是上面 99.2% 的
  同口径读数（1000 次抽样的期望命中约 992）。上表那行 10 万次的读数由一次性探针得出，
  **未入库**；入库的是这条判据，它把同一件事变成了**每次 CI 都跑**的测量。

**未登记新编号**：本条不是新的"还没做"，而是 ADR-006 §3.6 落地时必须处理的
**既有冲突的新增成因**，故并入 **GAP-74**（与 §6 其它残余同一口径，不另开号）。

---

## 7. 附：真跑 stdout 原文（回灌，未编辑）

> **§7.1 是本轮（A1/A4/A5/A7）修完之后的复跑读数**，不是初版那次。
> §7.2 起的标题保留初版编号，新加的段落以 `.1` 后缀插入，**不改旧段的编号**——
> 旧读数仍然对应它当时的那份代码，改写它等于篡改证据链（`AGENTS.md` §5）。

### 7.1 全量（`go build` / `go vet` / `go test -race -count=1 ./...`）

```
$ go build ./...                                     -> exit 0
$ go vet ./...                                       -> exit 0
$ go test -race -count=1 ./...
?   	github.com/koliance/backend/cmd/api	[no test files]
?   	github.com/koliance/backend/cmd/liquidator	[no test files]
?   	github.com/koliance/backend/cmd/migrate	[no test files]
ok  	github.com/koliance/backend/internal/agentapi	2.660s
ok  	github.com/koliance/backend/internal/agentcard	1.658s
ok  	github.com/koliance/backend/internal/chain	2.814s
?   	github.com/koliance/backend/internal/chain/bindings	[no test files]
ok  	github.com/koliance/backend/internal/config	1.501s
?   	github.com/koliance/backend/internal/developer	[no test files]
ok  	github.com/koliance/backend/internal/game	3.258s
ok  	github.com/koliance/backend/internal/httpapi	6.499s
ok  	github.com/koliance/backend/internal/liquidation	1.704s
ok  	github.com/koliance/backend/internal/liquidator	2.533s
ok  	github.com/koliance/backend/internal/market	2.781s
?   	github.com/koliance/backend/internal/model	[no test files]
ok  	github.com/koliance/backend/internal/oracle	2.225s
ok  	github.com/koliance/backend/internal/perp/nonce	1.548s
ok  	github.com/koliance/backend/internal/perp/position	1.630s
ok  	github.com/koliance/backend/internal/platform/database	2.935s
?   	github.com/koliance/backend/internal/platform/stripeclient	[no test files]
ok  	github.com/koliance/backend/internal/settlement	1.815s
ok  	github.com/koliance/backend/internal/verifier	1.587s
ok  	github.com/koliance/backend/scripts/coverage-gate	1.578s
                                                     -> exit 0
```

### 7.2 P4 正向 + N5 负向（`-race -v`，节选原文）

> ⚠️ **本段是初版的读数，保留原样。** 它记录的是**GET-only** 的那一版——
> 也就是 §4.3 所说的"两半一起瞎"的那一版。**保留它的理由正是这个**：
> 它下面 `=== RUN` 的行里**没有一行 POST**，而这在当时**看起来是全绿的**。
> 修完之后的读数见 §7.2.1。

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

### 7.2.1 P4 / N5 / N5(POST)（修后复跑，`-race -v` 原文）

```
$ go test -race -count=1 -v -run "TestLoggingMiddlewareDoesNotAlterBody|TestStatusWriterKeepsResponseControllerWorking|TestN5" ./internal/httpapi/

=== RUN   TestLoggingMiddlewareDoesNotAlterBody
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/GET_200_via_jsonResponse
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/GET_503_refusal_via_jsonError
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/GET_204_with_no_body
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/GET_body_written_in_two_calls,_implicit_200
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/POST_with_a_request_body,_200
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/POST_with_a_request_body,_400_refusal
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/POST_204_with_no_body
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/DELETE_405_from_methodOnly
--- PASS: TestLoggingMiddlewareDoesNotAlterBody (0.02s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/GET_200_via_jsonResponse (0.01s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/GET_503_refusal_via_jsonError (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/GET_204_with_no_body (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/GET_body_written_in_two_calls,_implicit_200 (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/POST_with_a_request_body,_200 (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/POST_with_a_request_body,_400_refusal (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/POST_204_with_no_body (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/DELETE_405_from_methodOnly (0.00s)
=== RUN   TestStatusWriterKeepsResponseControllerWorking
--- PASS: TestStatusWriterKeepsResponseControllerWorking (0.00s)
=== RUN   TestN5InjectedBodyWriteTurnsP4Red
    reqlog_test.go:432: N5 injection: handler produced "{\"status\":\"healthy\"}\n", the mutated middleware produced "!{\"status\":\"healthy\"}\n"
--- PASS: TestN5InjectedBodyWriteTurnsP4Red (0.00s)
=== RUN   TestN5PostOnlyInjectedBodyWriteTurnsP4Red
    reqlog_test.go:493: N5(POST) injection: handler produced "{\"orderId\":\"ord-1\",\"success\":true}\n", the mutated middleware produced "!{\"orderId\":\"ord-1\",\"success\":true}\n"
    reqlog_test.go:504: a GET-only comparison over the POST-only mutant is CLEAN — that is the blind spot the method-crossed P4 table closes
--- PASS: TestN5PostOnlyInjectedBodyWriteTurnsP4Red (0.00s)
PASS
ok  	github.com/koliance/backend/internal/httpapi	2.371s
                                                     -> exit 0
```

### 7.2.2 ⚠️ A1 负向对照：往**真中间件**里注入 POST-only 一字节（**真跑，已还原**）

注入的不是变异体，是 `reqlog.go` 的 `loggingMiddleware` 本体：

```go
sw := &statusWriter{ResponseWriter: w}
if r.Method == http.MethodPost {
	_, _ = sw.Write([]byte("!"))
}
next.ServeHTTP(sw, r)
```

```
$ go test -count=1 -v -run "TestLoggingMiddlewareDoesNotAlterBody|TestN5InjectedBodyWriteTurnsP4Red" ./internal/httpapi/

=== RUN   TestLoggingMiddlewareDoesNotAlterBody
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/GET_200_via_jsonResponse
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/GET_503_refusal_via_jsonError
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/GET_204_with_no_body
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/GET_body_written_in_two_calls,_implicit_200
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/POST_with_a_request_body,_200
    reqlog_test.go:265: body: wrapped "!{\"orderId\":\"ord-1\",\"success\":true}\n", bare "{\"orderId\":\"ord-1\",\"success\":true}\n"
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/POST_with_a_request_body,_400_refusal
    reqlog_test.go:265: status: wrapped 200, bare 400
    reqlog_test.go:265: body: wrapped "!{\"error\":\"notionalUSD: must be positive\"}\n", bare "{\"error\":\"notionalUSD: must be positive\"}\n"
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/POST_204_with_no_body
    reqlog_test.go:265: status: wrapped 200, bare 204
    reqlog_test.go:265: body: wrapped "!", bare ""
    reqlog_test.go:265: wrapped response adds headers [Content-Type X-Request-Id], want exactly [X-Request-Id]
=== RUN   TestLoggingMiddlewareDoesNotAlterBody/DELETE_405_from_methodOnly
--- FAIL: TestLoggingMiddlewareDoesNotAlterBody (0.01s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/GET_200_via_jsonResponse (0.01s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/GET_503_refusal_via_jsonError (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/GET_204_with_no_body (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/GET_body_written_in_two_calls,_implicit_200 (0.00s)
    --- FAIL: TestLoggingMiddlewareDoesNotAlterBody/POST_with_a_request_body,_200 (0.00s)
    --- FAIL: TestLoggingMiddlewareDoesNotAlterBody/POST_with_a_request_body,_400_refusal (0.00s)
    --- FAIL: TestLoggingMiddlewareDoesNotAlterBody/POST_204_with_no_body (0.00s)
    --- PASS: TestLoggingMiddlewareDoesNotAlterBody/DELETE_405_from_methodOnly (0.00s)
=== RUN   TestN5InjectedBodyWriteTurnsP4Red
    reqlog_test.go:432: N5 injection: handler produced "{\"status\":\"healthy\"}\n", the mutated middleware produced "!{\"status\":\"healthy\"}\n"
--- PASS: TestN5InjectedBodyWriteTurnsP4Red (0.00s)
FAIL
FAIL	github.com/koliance/backend/internal/httpapi	0.898s
                                                     -> exit 1
```

**三行读数就是 A1 的全部证据**：

1. **4 个 POST 行转红，4 个 GET 行仍绿**——方法维确实是新判据抓到的，不是噪声。
2. **`TestN5InjectedBodyWriteTurnsP4Red` 仍然是 `--- PASS`**——**旧的那对判据在这个变异体上依旧全绿**。
   这正是 §4.3 说的"两半一起瞎"：负向对照没有牙，于是 P4 的绿**证明不了任何事**。
3. 修完之后 `MUTANT_EXIT=1`（红），**还原后复跑 exit 0**（绿）——见 §7.1。

### 7.2.3 A4 脱敏：修后全表（`-v` 原文，节选）

```
$ go test -count=1 -v -run "TestSanitizeLogValue" ./internal/httpapi/

--- PASS: TestSanitizeLogValue (0.00s)
    --- PASS: TestSanitizeLogValue/keyword_DSN_(host/user/dbname,_no_://) (0.00s)
    --- PASS: TestSanitizeLogValue/keyword_DSN_with_only_a_password (0.00s)
    --- PASS: TestSanitizeLogValue/in-package_function_name (0.00s)
    --- PASS: TestSanitizeLogValue/qualified_function_name (0.00s)
    --- PASS: TestSanitizeLogValue/sql_quoted_relation_name (0.00s)
    --- PASS: TestSanitizeLogValue/sqlstate_with_a_colon (0.00s)
    --- PASS: TestSanitizeLogValue/credential_value_with_no_NAME= (0.00s)
    --- PASS: TestSanitizeLogValue/file_path_with_no_leading_space (0.00s)
    --- PASS: TestSanitizeLogValue/windows_file_path (0.00s)
    --- PASS: TestSanitizeLogValue/ipv6_internal_address (0.00s)
    --- PASS: TestSanitizeLogValue/single-label_host_with_a_port (0.00s)
    --- PASS: TestSanitizeLogValue/localhost_with_a_port (0.00s)
    --- PASS: TestSanitizeLogValue/hostname_with_an_underscore (0.00s)
    --- PASS: TestSanitizeLogValue/control:_a_bare_url_path_is_left_alone (0.00s)
    --- PASS: TestSanitizeLogValue/control:_ordinary_prose_is_left_alone (0.00s)
    --- PASS: TestSanitizeLogValue/control:_a_package_qualifier_is_left_alone (0.00s)
--- PASS: TestSanitizeLogValueKnownResiduals (0.00s)
    --- PASS: TestSanitizeLogValueKnownResiduals/truncated_third-party_body (0.00s)
    --- PASS: TestSanitizeLogValueKnownResiduals/third-party_body_with_a_brace_inside_a_string_value (0.00s)
    --- PASS: TestSanitizeLogValueKnownResiduals/bare_single-label_hostname_with_no_port (0.00s)
    --- PASS: TestSanitizeLogValueKnownResiduals/bare_credential_value_with_no_label_and_no_known_prefix (0.00s)
PASS
ok  	github.com/koliance/backend/internal/httpapi	0.883s
                                                     -> exit 0
```

> **两个 `control:` 行是本节的要点，不是陪衬。** 放宽路径规则（补 `reFilePathRel`）与
> 放宽主机规则（补 IPv6 / 下划线 / 端口）**都有可能吃掉 URL 路径或包限定名**——
> 前者是本中间件最有排查价值的字段，后者是初版注释承诺不动的。
> 这两个控制行**就是为那两处放宽准备的**：`/api/v1/market/prices` 必须原样留下，
> `errors.Unwrap` 必须原样留下。**去掉任意一条放宽，对应控制行不会红**（它是控制，不是断言），
> 所以它们的作用是**防止过度脱敏**，与"密钥必须消失"是**两个方向**的判据。

### 7.2.4 A5 与 A7（`-race -v` 原文）

```
$ go test -race -count=1 -v -run "TestGeneratedRequestID" ./internal/httpapi/
    reqlog_test.go:709: 994/1000 generated ids match priceShapedInText, band [970, 1000] (example: 53d0ebec9e38677c1342190f9b937c78 -> "38677") — a measurement, not a property; see the doc comment
--- PASS: TestGeneratedRequestIDWouldBreakTheRefusalShapeJudgement (0.02s)
ok  	github.com/koliance/backend/internal/httpapi	2.367s
                                                     -> exit 0

$ go test -race -count=1 -v -run "TestCORS" ./internal/httpapi/
--- PASS: TestCORSAllowList (0.01s)
--- PASS: TestCORSExposesTheRequestIDToCrossOriginScripts (0.00s)
PASS
ok  	github.com/koliance/backend/internal/httpapi	2.366s
                                                     -> exit 0
```

### 7.4 A7 负向对照：去掉 `Access-Control-Expose-Headers`（**真跑，已还原**）

```
$ # 把 middleware.go 的 Set("Access-Control-Expose-Headers", corsExposeHeaders) 注释掉
$ go test -count=1 -run "TestCORSExposesTheRequestIDToCrossOriginScripts" ./internal/httpapi/
--- FAIL: TestCORSExposesTheRequestIDToCrossOriginScripts (0.01s)
    router_test.go:153: Access-Control-Expose-Headers = "", does not name X-Request-Id — the response header is on the wire and invisible to JS
    router_test.go:163: GET response Access-Control-Expose-Headers = "", does not name X-Request-Id
FAIL
FAIL	github.com/koliance/backend/internal/httpapi	1.017s
                                                     -> exit 1

$ # 还原后
$ go test -count=1 -run "TestCORSExposesTheRequestIDToCrossOriginScripts" ./internal/httpapi/
ok  	github.com/koliance/backend/internal/httpapi	1.002s
                                                     -> exit 0
```

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

#### 7.3.1 A4/A7 修后的复跑读数（**本轮**，取代上一节的现值口径）

```
$ go test -count=1 -covermode=atomic "-coverprofile=coverage/coverage.out" "./..."
ok  	github.com/koliance/backend/internal/httpapi	3.477s	coverage: 81.7% of statements
                                                     -> exit 0

$ go run ./scripts/coverage-gate
   81.75  76.00    542/663    internal/httpapi               router, middleware, handlers (604 stmts)
────────────────────────────────────────────────────────────────────────────────────────
   72.61  69.00   1811/2494   TOTAL (gated)                  excludes generated + untested-by-design
[OK] Coverage above every floor
                                                     -> exit 0
```

- **`httpapi` 从 `541/662` 变成 `542/663`：+1 条语句，来源是 `middleware.go` 新增的
  `w.Header().Set("Access-Control-Expose-Headers", …)`（A7）**，且它被新判据覆盖，
  故命中数与总数同步 +1。`TOTAL` 同理 `1810/2493 → 1811/2494`。
- ⚠️ **上一节 `541/662` 那行取自一份过期 profile，必须说明**：本机 PowerShell 5.1 下
  `go test -coverprofile=coverage/coverage.out ./...` **不加引号会被拆坏**——
  它凭空多出一个名为 `.out` 的包并 `FAIL [setup failed]`，`go test` 以非零退出、
  **profile 未刷新**，于是门禁读到的是**上一轮的旧文件**，却打印得像一次新鲜读数。
  把整个参数写成 `"-coverprofile=coverage/coverage.out"` 即正常。
  **这不是覆盖率问题，是"读数可能来自旧文件"的问题**——与 `AGENTS.md` §7
  "超过一次提交必须重新实测"同源：**一条读数要能说清它取自哪次运行**。

---

## 8. 改动清单与提交

### 8.1 初版

| 提交 | 内容 |
| --- | --- |
| `2d1f169` | `cmd/api/main.go`：建 logger（`cmd/liquidator/main.go:29` 同款 idiom）+ `slog.SetDefault` + 经 `Deps.Logger` 注入 |
| `e36d5bb` | `internal/httpapi/reqlog_test.go`：P4 / N5 / request-id / 脱敏 / 错误链判据（840 行，新增文件） |
| `8ac17c2` / `0240d2e` | 本文件：回填实测 + 补一条可复跑命令 |
| `18e8dfe` | `internal/httpapi/reqlog.go`（新增）· `internal/httpapi/router.go`（`Deps.Logger` + 末尾包一层） |

`SetDefault` **不是装饰**：`NewRouter` 在 `Deps.Logger` 为 nil 时回落到 `slog.Default()`，
没有这一行，回落目标就是 stdlib 的**文本 handler + stderr**——同一个进程产出**两种形状**的日志流。
`cmd/api` 的启动横幅仍是 `fmt.Printf`（**未动**，硬边界），故**同一进程的 stdout 上
文本横幅与 JSON 日志并存**；横幅只出现在启动瞬间、服务器开始服务之前，故当前无消费方受影响。
若将来有采集器按行解析 stdout，这是要先处理的一处——**登记在此，不另开号**。

### 8.2 四处独立证伪的修复（A1 / A4 / A5 / A7，**本轮**）

按 `AGENTS.md` §5「小步提交」，四处**各自一个提交**，每个都带自己的负向对照：

| # | 提交 | 改了什么 | 负向对照 |
| --- | --- | --- | --- |
| **A7** | 见 §8.2 表下注 | `middleware.go`：`corsAllowHeaders` 加 `X-Request-Id` + 新增 `Access-Control-Expose-Headers`；`router_test.go` 加 `TestCORSExposesTheRequestIDToCrossOriginScripts`；本文件 §2.1② 更正失实断言 | 去掉 Expose 头 → 判据红（§7.4） |
| **A1** | 同上 | `reqlog_test.go`：P4 用例表**加方法维**（GET/POST×3/DELETE）；`n5WriteBodyOn` 方法开关；新增 `TestN5PostOnlyInjectedBodyWriteTurnsP4Red`；抽出 `responseDiff` | 真中间件注入 POST-only 一字节 → 4 个 POST 行红、N5 仍绿（§7.2.2） |
| **A5** | 同上 | `reqlog_test.go`：地板改区间 `[0.97,1.0]`；doc 更正为 `:182-184`；`reqlog.go` 注释改写为"照录错误理由 + 更正"；本文件 §6.1 更正归因 | 判据的分辨力用区间表达，不再需要单独注入（§6.1.2） |
| **A4** | 同上 | `reqlog.go`：补 #1 包内函数名 / #2 `relation "x"` 与 `SQLSTATE:` / #3 keyword DSN / #5 裸值 / #7 无前导空格路径 · IPv6 · 下划线主机 · `name:port`；新增 `reSecretValue` / `reFilePathRel` / `reFilePathURI`；`reqlog_test.go` 每形态一行 + `TestSanitizeLogValueKnownResiduals`；本文件 §6 边界表重写 | 每行断言密钥缺席（正向）+ 残余表断言**仍然漏**（反向） |

> **提交哈希以 `git log` 为准**（本表在提交后回填时可能滞后于 rebase）。
> 四处**只碰** `backend/internal/httpapi/{middleware.go,reqlog.go,reqlog_test.go,router_test.go}`
> 与本文件，**未碰** `market_test.go`（`priceShapedInText` 只被**读取**）。

---

## 9. 硬边界声明

**未碰**：`ADR-006 §3.3` 词表 · `§3.6` 响应体信封 · `router.go` 的 **51 处** `jsonError` 调用点 ·
前端（`src/`）· `contracts/` · `memory.md` · `health.go` · `validate.go` · `market_test.go` ·
`cmd/liquidator`。

**A7 之后 `middleware.go` 不再"一行未动"**——这是初版 §9 的陈述，本轮被自己的改动推翻。
改的只有 CORS 头这一处（`cors` 函数），`decodeJSON` / `jsonResponse` / `jsonError` /
`methodOnly` / `requireOperator` 一行未动。

**§3.6 落地者必读**：见 §6.1.1 —— 会红的是 `market_test.go:182-184`（**顶层键集**），
**不是** `:199-201`（JSON 数字）。**成因就是"多了一个键"，不是 id 的形态**；
初版那句"成因之一是 id 自身的形态"是错的（A5）。照错的那句去改 id 形态，改完**照旧红**——
要改的是**键的允许集**，且属 03 环、须带负向对照。
