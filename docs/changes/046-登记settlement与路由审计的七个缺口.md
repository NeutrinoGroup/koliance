# 046 · 登记 settlement / 路由审计的七个缺口（GAP-65~71）

> **环**：02 开发（登记）· 03 测试（判据缺口取证）
> **分支**：`feat/w1-ai-infra-foundation`（worktree `koliance-w1`）
> **类型**：**登记，不修**（除 A8 的复核与两处纯指针修正详见 §4）
> **依据**：`falsifier` 的独立证伪清单（C1 / A1 / A7 / A2 / A9 / C5 / C6 / A8），
> 其中 **C1 与 A1 由本角色另行独立实测复核**（§2.1 / §2.2，非转述）。
> **先写后填**：本文件在改台账前立。
> **关联**：`docs/changes/044`（B1 修复）· `docs/changes/045`（F-1 修复 + C3 收窄）。

---

## 1. 取号（D4 / `AGENTS.md` §6）——**并附一条守卫就绪度体检**

**检索方法**（两轴都跑，且**不用** `git log --all --name-only`——它会漏掉只由 merge 引入的文件）：

```powershell
$refs = git for-each-ref --format='%(refname)'          # 27 个 ref，含全部 remote-tracking
# 轴 A：docs/changes/ 编号并集
foreach ($r in $refs) { git ls-tree -r --name-only $r -- docs/changes/ }
# 轴 B：GAP 号并集
foreach ($r in $refs) { git grep -hoE 'GAP-[0-9]+' $r }
```

**实测读数**：

| 轴 | 并集最大号 | 备注 |
| --- | --- | --- |
| `docs/changes/` | **`045`**（本轮的 044/045 落地后）；选取 044/045 时读数为 `043` | 47 → 49 个文件（含本轮两份） |
| `GAP-` | **`64`** | 占用集合 = `1..64`（连续） |

故本轮取 **`GAP-65` ~ `GAP-71`**（七条，见 §2）。

### 1.1 体检：`GAP-69` 的"占用"是**假的**——它只是一段区间字面量

并集的初次读数是 `1..64, 69`，即 **`69` 看似已被占用**。逐 ref 追下去，它**只有一个来源**：

```
refs/heads/feat/w1-ai-infra-foundation:docs/changes/043-登记三个合并观测项.md:22:
  **实测读数**：`GAP-62`~`GAP-69` **在全部 ref 上零命中**。
```

**那是 `043` 在声称 `62~69` 未被占用**，不是占用了 `69`。
（`043` 当时只登记了 `62/63/64`；它把检索上界写成 `69`，该上界就变成了一个**看起来像占用的字符串**。）

> **这一条对"给编号加机械守卫"是硬信息**：守卫若只做 `grep -oE 'GAP-[0-9]+'`，
> 会把**区间字面量的上界**误判为已占用号——于是守卫本身会**把 65~69 判成撞车**，
> 而事实相反。守卫必须**排除区间字面量**（或只认「台账 §1 表格行」这种结构位置）。
> **本文件不改 `043` 的那句话**：它是**当时的实测陈述**（D4：已发生的事实不改写）。
> 台账里的编号守卫目前仍是**建议**而非条目（`docs/GAP台账.md` 文件头 §1 表后注已写该建议），
> **故本轮不为它另开号**（避免与已有建议重复——D4 里撞车比漏登记更糟）。

### 1.2 一条自查：`GAP-70` / `GAP-71` 被**先引用、后登记**

`docs/changes/045` 与 `router_test.go:315` 在**本次登记之前**就写了「登记为 GAP-70 / GAP-71」。
按本仓口径「不在台账里 = 不存在」，那两个指针在 §2 落盘前是**悬空的**。
**成因**：修 F-1 时顺手把「发现的缺口」写进了注释与记录，而登记动作排在后面。
**纠正**：`GAP-65~71` 随本文件与台账同批落盘，**悬空窗口闭合**。
**教训（写给下一个改这条链的人）**：**先登记、再引用编号**——反过来的话，
任何人在中间那次提交上读代码，都会去找一个不存在的号。

---

## 2. 七条缺口（逐条给依据与解除条件）

| 号 | 标题 | 严重度 | 状态 | 一句话 |
| --- | --- | --- | --- | --- |
| **GAP-65** | `cmd/api` 的 fail-fast **无任何自动化判据** | 🟠 P1 | 🟠 | 把它变异回 GAP-49 的静默降级，全套仍绿 |
| **GAP-66** | `005` 触发器**允收自带 `ledger_seq`**，且产出的 `balance_after` 会被本仓 `CheckEntries` 拒收 | 🟠 P1 | 🟠 | 与自身注释矛盾；两道门口径不一致 |
| **GAP-67** | DDL `NUMERIC(36,18)` **静默舍入** vs Go 拒收 19 位小数 | 🟡 P2 | 🟠 | 两道门对同一字面量给出不同答案 |
| **GAP-68** | `user_address` 不参与任何不变量、无格式 CHECK、余额作用域不含它 | 🟡 P2 | 🟠 | 一列 `NOT NULL` 的地址，没有任何东西校验它 |
| **GAP-69** | `settlement_ledger` **无 UPDATE/DELETE 守卫**，也无运行判据读回审计 | 🟡 P2 | 🟠 | 「只可追加」只是命名，不是约束 |
| **GAP-70** | qa 路由清单**无「路由 → 清单」反向对拍** | 🟡 P2 | 🟠 | 新增路由会静默免测 |
| **GAP-71** | `IsConnected` **运行期不会被翻 false** | 🟡 P2 | 🟠 | 断连后 `withDB` 放行，答 500 而非 503+Retry-After |

> **七条的共同性质**：它们**都不是"算错了"**，而是**"没人能发现它错了"**——
> 正是 D3 与 `docs/changes/007`「空分母被当成 100%」的同族。
> **除 GAP-65 外，其余六条全部需要真实 PostgreSQL 才能取证或解除**（见 §7 的未验证清单）。

### 2.1 C1 → **GAP-65** · `cmd/api` 的 fail-fast 无自动化判据（**本轮独立实测复核**）

**判据**：把 `cmd/api/main.go` 的 fail-fast 变异回 GAP-49 之前的**静默内存降级**，
断言「至少有一条用例变红」。

**变异**（本轮真跑）：`database.New` 的错误不再返回，改为退回 `NewMemoryOnly()`：

```
$ # cmd/api/main.go 变异为：
$ #   db, _ := database.New(ctx, cfg.DatabaseURL)   /   if db == nil { db = database.NewMemoryOnly() }
$ go build ./...     exit=0
$ go vet ./...       exit=0
$ go test -race -count=1 ./...
?   	github.com/koliance/backend/cmd/api	[no test files]
TEST_EXIT_WITH_MUTATION=0
```

**结论：整套测试**完全无法区分**「启动即拒绝」与「静默降级到内存」**——
`cmd/api` **没有任何测试文件**，而这条 fail-fast **只在 `cmd/api` 里**，
路由层的 `withDB` 只是它的纵深防御、**不是它本身的判据**。
即：把 GAP-49 的修复整个回退，CI **仍然全绿**。（随后已还原，`git diff` 空。）

| 项 | 内容 |
| --- | --- |
| **解除条件** | 一条能驱动 `run(cfg)` 的用例：无 `DATABASE_URL` → 断言返回 `ErrDatabaseURLRequired`（且**不**返回 nil error、**不**监听端口）。需要把 `run` 的可观测面（返回 error 而非 `log.Fatalf`）**保持可测**——它已经是 `func run(cfg *config.Config) error`，**故用例可写**：`cmd/api/main_test.go` 直接调 `run(&config.Config{DatabaseURL: ""})` |
| **为何本轮不做** | 不在派发范围内（本职是 B1/F-1 + 登记）；且它牵涉「启动路径要不要可注入」的小设计 |

### 2.2 A1 → **GAP-66** · `005` 触发器允收自带 `ledger_seq`，产出的账会被本仓判据拒收

**两半，都实测。**

**（a）注释与代码矛盾**（`005_settlement_ledger.sql`）：

- `:126-129` 注释：「ledger_seq is allocated here rather than by the writer so that **a client cannot pick its own replay position**」
- `:138-140` 代码：`IF NEW.ledger_seq IS NULL OR NEW.ledger_seq = 0 THEN NEW.ledger_seq := nextval(...)` —
  即**只在「没给」或「给了 0」时才分配**，**客户给了非零值就原样收下**。

**（b）后果：两条门对同一批行给出相反结论**（**本轮真跑，Go 侧**）：
若写入方自带 `ledger_seq` 且**按 seq 逆序插入**，触发器的 `balance_after` 是**插入时刻**的累计值，
而**后插入的更小 seq 会改变「前者应有的累计值」，已写下的行却不会被重算**。
用触发器会盖出的两个值喂进本仓判据：

```
stored balance_after（trigger 盖的）     seq 10 -> 7,  seq 5 -> 3
PROBE A1: CheckEntries(journal as stamped by the trigger) -> err=
  settlement: balance_after does not match the replayed balance:
  intent a1 seq 10 account AVAILABLE_BALANCE: stored 7, replayed 10
PROBE A1: errors.Is(err, ErrBalanceAfterMismatch) = true
PROBE A1: ErrOutOfOrder=false ErrDuplicateSeq=false ErrNotBalanced=false
```

即：**触发器写下的账，本仓自己的校验层拒收**。两条门**都在场**，却给出相反答案——
`schema` 侧说「合法」，`Go` 侧说「余额对不上」。这正是 `docs/changes/021` 的反面：
那边是「只跑一道门会漏」，这边是「两道门互相矛盾，谁也不知道该信哪道」。

| 项 | 内容 |
| --- | --- |
| **严重度** | 🟠 P1。当前**无生产写入方**（`git grep` 零命中），故非活缺陷；但它是**两条门的口径分歧**，一旦有写入方，账与校验会各说各话 |
| **两条解除路径（需人选）** | ①**收紧触发器**：非空且非 0 的 `NEW.ledger_seq` 直接 `RAISE EXCEPTION`（把"客户端不能自选位置"从注释变成约束）；②**收宽判据**：允许 `balance_after` 由 DB 单方面决定（但那就放弃了「篡改可发现」的能力） |
| **为何本轮不做** | 需真 PG 实证（**GAP-60** 同因：本机无 docker / psql / `DATABASE_URL`）；且属 `005` 的口径变更，牵涉 GAP-60 的解除 |
| **已实测 / 未实测** | **Go 侧已实测**（上面的 stdout）；**PG 侧未实测**（`balance_after` 的两个值是按触发器逻辑推出的，**未在真 PG 上盖出来**）——按 D1 明确标注 |

### 2.3 A7 → **GAP-67** · `NUMERIC(36,18)` 静默舍入 vs Go 拒收

- `005` 的 `debit` / `credit` / `balance_after` 均为 `NUMERIC(36, 18)`（`:87-88`、`:95`）。
- Go 侧 `ParseAmount` **主动拒收**超过 18 位小数的字面量（`ledger.go:126-128`，`ErrBadAmount`），
  整数位超过 18 位也一样（`:123-125`）。**已在既有用例里钉住**（`ledger_test.go:386`、`qa_ledger_test.go:347`）。
- **分歧**：同一个 `0.0000000000000000001`（19 位小数），**Go 拒收**；而 `NUMERIC(36,18)` 会**静默舍入**
  到 18 位（甚至舍成 0，进而撞上 `ck_settlement_ledger_single_sided`）。**一个拒绝、一个改写。**

| 项 | 内容 |
| --- | --- |
| **为何是缺口** | 直连 INSERT 的写入方（迁移注释明确设想的场景）**不会看到任何错误**，只会拿到一个被悄悄改过的金额。金额被静默改写在账本里是**最不该静默**的一件事 |
| **解除条件** | 真 PG 上实测三种字面量（19 位小数 / 19 位整数 / 恰 36 位）的落库结果，再决定是加 `CHECK`、加 `ROUND` 断言，还是让 DDL 与 Go 同口径 |
| **已实测 / 未实测** | **Go 侧已实测**（既有用例；本轮复核其存在与内容）；**PG 舍入行为未实测**（无 PG），故本条的 PG 半边按 D1 标注为**未验证** |

### 2.4 A2 → **GAP-68** · `user_address` 不参与任何不变量

| 位置 | 实测 |
| --- | --- |
| DDL `:85` | `user_address VARCHAR(42) NOT NULL`——**无格式 CHECK**、**无 FK**（既非指向 `settlement_intents.user_address`，也无 users 表可指） |
| DDL 触发器 `:144-150` | 前序余额的 `WHERE` 只按 `intent_id` + `account_type`；**`user_address` 不在作用域内** |
| DDL `:101-103` | 唯一的行级 `CHECK` 是单边性，与地址无关 |
| Go `ledger.go:266-268` | 只要求 `UserAddress != ""`（空则 `ErrMalformedEntry`）——**同样不校验格式** |
| Go `checker` | 状态键是 `IntentID`（`:295`）与 `Account`（`:311`），**地址不参与任何键** |
| 对照 | 本仓**别处**有现成的地址校验：`agentapi.ValidateWallet`（`:93-104`，42 字符 + `0x` + 40 hex）、`game.ValidateWallet`——**结算账本没有用它** |

**后果**：一个 `user_address` 可以任意填写（只要非空），账仍然"平"，余额仍然算得出，
**没有任何东西会发现这条腿不属于这个地址**。而「复式记账」的业务意义正是**归属**。

| 项 | 内容 |
| --- | --- |
| **解除条件** | 至少要人先裁一条：`user_address` 是**权威归属**（加格式 CHECK + 与 `settlement_intents.user_address` 的一致性约束/FK），还是**冗余标注**（那就写明它不参与任何不变量，并考虑删列） |
| **为何本轮不做** | 是**口径决策**（归属 vs 标注），不是 bug 修复；且加 FK 需真 PG 验证迁移可跑（GAP-60） |

### 2.5 A9 → **GAP-69** · `settlement_ledger` 无 UPDATE/DELETE 守卫、无读回审计

| 判据 | 实测 |
| --- | --- |
| 有没有防改的约束 | **没有**。`005` 只有 **一个 `BEFORE INSERT` 触发器**（`:162-165`），**没有** `BEFORE UPDATE/DELETE` 触发器、没有 `RULE`、没有列级权限 |
| RLS 挡得住吗 | **挡不住应用自己**。`:175-177` 是 `ENABLE ROW LEVEL SECURITY`（**刻意不加 `FORCE`**，文件里写明了理由），而策略只对 **`anon`** 角色建（`:184-189`）。应用以 owner / `service_role` 连接 → **策略不适用** → `UPDATE` / `DELETE` 畅通 |
| 有没有运行期读回审计 | **没有**。`CheckEntries` / `Journal` **只吃内存里的 `[]Entry`**，本仓**没有任何代码从 `settlement_ledger` 读回并重跑不变量**（`git grep -n "settlement_ledger" -- backend/` 的命中全是注释/DDL，**无 SELECT**） |

**后果**：`entry_id` / `ledger_seq` / `balance_after` 全是**可被就地改写**的。
一个"只可追加"的账本，其**不可追加性只体现在命名上**，不体现在约束上。
而**更关键的是第二行**：即使加了守卫，**也没有任何判据在运行期证明它是只可追加的**——
守卫与判据**两样都缺**。

| 项 | 内容 |
| --- | --- |
| **解除条件** | ①DDL 层：`BEFORE UPDATE OR DELETE ... FOR EACH ROW EXECUTE FUNCTION raise_exception()`（或把 `UPDATE/DELETE` 权限从应用角色撤掉）；②判据层：一条能在真 PG 上跑的**负向用例**——`UPDATE settlement_ledger SET debit = ...` **必须失败**。**只做①不做②等于没做**（D3：判据必须有牙，且这道判据天生"失败即静默"） |
| **为何本轮不做** | 需真 PG（GAP-60）；且属 `005` 的口径变更 |

### 2.6 C5 → **GAP-70** · qa 路由清单无「路由 → 清单」反向对拍

| 方向 | 现状 |
| --- | --- |
| 清单 → 路由 | **有**。`TestQARouteInventoryIsComplete` 用 `PATCH` 探针逐条断言「清单里的路径确实已注册」（控制组：不存在的路径确实 404） |
| 路由 → 清单 | **没有**。没有任何判据读 `router.go` 的注册项并检查「它出现在清单里」 |
| 后果 | **新增一条路由，它不会出现在任何清单里，于是不会被任何用例覆盖——静默免测** |

**这条不是推测，它刚刚发生过**：`/api/v1/developer/keys` 就在这个缝里
（`docs/changes/045` §3.1）。同一形状在**实现方**的清单上也有一份：
`router_test.go` 的 `dbGatedRoutes`，其注释原称「新落盘路由会作为测试失败暴露」——
**不成立**（两个用例只遍历清单）。**本轮只把注释改成实情，反向检查本身登记在此。**

| 项 | 内容 |
| --- | --- |
| **解除条件** | 一条**机械**判据：从 `router.go` 抽出全部 `h("<path>", ...)` 注册（可对源码做正则，或把注册收敛成一个可枚举的表），与 qa 清单求差集；差集非空即红。**并且这条判据要有负向对照**（往 `router.go` 加一条假路由 → 必须红） |
| **为何本轮不做** | 属测试基建，超出本轮派发范围；且"从源码正则抽注册"需要先把注册形式收敛（现在有 25 条 `methodOnly` + 4 条裸注册） |

### 2.7 C6 → **GAP-71** · `IsConnected` 运行期不会被翻 false

| 判据 | 实测 |
| --- | --- |
| 谁写 `IsConnected` | 只有两处：`db.go:72`（`NewMemoryOnly` → `false`）与 `db.go:110`（`New` 成功 → `true`） |
| 谁把它翻回 false | **没有**。连接池中途断开**不会**改变这个字段（pgxpool 会自行重连，字段保持 `true`） |
| 于是 `withDB` 的第二道检查 | `router.go:90` 的 `if !d.DB.IsConnected` **在运行期永远不成立**——它只覆盖「构造时就未连接」这一种状态 |
| 后果 | DB 中途不可用时，落盘路由**不会**返回 503 + `Retry-After: 5`，而是把请求放进去，由 `pgx` 返回错误 → 路由各自的错误路径（多为 **500**）。**同一个故障，重构前后给出两种答案**——而 503+Retry-After 才是"瞬时故障"的正确答案 |

> **判据缺口而非活缺陷**：`Retry-After: 5` 这条契约**已有一条用例在守**
> （`TestQAUnconnectedHandleRefusesAndSaysWhenToRetry`，用的是 `NewMemoryOnly`）——
> 它守的是"构造时未连接"。**没有任何用例能构造"连接中途失效"**，
> 因为 `IsConnected` 压根没法在运行期改变。**判据覆盖了一个不可能发生的状态。**

| 项 | 内容 |
| --- | --- |
| **解除条件** | 要么给 `DB` 一个**探活**（如 `pool.Ping(ctx)` 或 `Pool.Stat()` 的空闲连接数），让 `withDB` 判的是**当下可达性**而非构造期快照；要么**删掉这道检查**并写明「本进程只区分『无 DB 句柄』与『有 DB 句柄』，运行期断连由各 handler 的错误路径负责」。**两条都比"留着一个恒不成立的检查"诚实** |
| **为何本轮不做** | 是 `database.DB` 的行为变更（牵涉其它 3 处 `IsConnected` 用法），需 architect/owner 定口径 |

### 2.8 A8 · `005` 注释「任意前缀」与 `ledger.go` 不同成熟度 —— **复核成立，不重复取号**

**已登记**：`docs/changes/040 §7` 的对照表倒数第二行（「过期陈述」）。
**本轮复核**（D1，两条都读了）：

| 位置 | 原文口径 |
| --- | --- |
| `005_settlement_ledger.sql:21-25` | 「replaying the postings of one intent in ledger_seq order, the running total of (credit - debit) must be **zero after every single posting**」→ **任意前缀** |
| `ledger.go:364-378`（`CheckEntries` 的 doc） | 明确**否掉**前缀式：三腿凭证 `100 = 98 + 2`「is unbalanced after its second leg and balanced after its third」，故取 **per-intent 试算平衡** |

**复核结论：成立，且仍在。** 该句在迁移文件里**逐字未改**，而它**会被当规格读**（它就是那份 DDL 的抬头）。
**故不重复取号**（已在 `040` 名下），本条只作**复核留痕**。
`docs/changes/040 §7` 已写「实现方已在 `035 §1` 的警告里指向 §5.6，但它指向的是变更记录，不是那块会被人当规格读的 DDL 注释」——
本轮**同意该判断**，且**本轮仍不改**（`005` 的注释修改与 GAP-60/GAP-66 同批更合适：都要在真 PG 上定稿）。

---

## 3. 台账改动（本批次，三处）

`docs/GAP台账.md`：

| # | 位置 | 动作 |
| --- | --- | --- |
| 1 | §1 状态总览（`GAP-64` 行之后） | 追加 `GAP-65`~`GAP-71` 七行 |
| 2 | §5「无阻塞但未做」表的 GAP-64 行之后 | 追加七行（起点 / 预估） |
| 3 | §5.9（**新增小节**）+ 文件头「§5 小节编号」枚举行 | 逐条取证落盘；**枚举行同步改**（`§5.1 … §5.9`）——该文件自己写过「清单类陈述必须与实际枚举对拍」 |
| 4 | §0 归档表 `docs/changes/` 行 | **改对一个已漂移的读数**：原写「**43 份**」，实测（`git ls-files docs/changes/`）**在本轮两份落地前已是 47**，落地后 **48** → 改为 **48 份**，并把「上一版写 43」留痕 |

> **第 4 条是同一个缺陷的第三次应验，值得单列**：§0 归档表这一行
> **曾经**写 `001~012`（落后十余条，2026-10-11 修），修正后写「43 份」——
> 而**实测在改之前就已是 47 份**。即**"修一次"并没有让它变成会自己保持正确的行**：
> 上游横向合流与本分支各自追加文件，**没有任何东西在数这一行**。
> 与 §5.1 的「补修清单只写数量、没写行号」是同一个教训：
> **能被证伪的清单才叫清单**——只写一个数字的清单，**没人能核对**。
> **故本行的新写法同时给出：命令、时点、与"上一版是多少"**，让下一个人能机械地对拍。

> **不重排既有行序**（沿用该文件对跨分支合并的口径），只追加。**迁移未跑（GAP-60）不解除**，
> 故 §2 六条里的 PG 半边**一律标未验证**。

---

## 4. 顺带的两处**纯指针**修正（+ 一处**明确不改**）

**编号重编会留下悬空指针**——`docs/changes/042` 把 W1 侧的 `GAP-51/58 → GAP-60/61`，
但**代码里有两处注释没跟着改**，它们现在指向**别人的缺口**（`GAP-51` 在全分支并集里
是 `upstream/main` 的「前端字体/波纹动效」，与脱敏毫无关系）：

| 文件:行 | 改前 | 改后 | 为何改 |
| --- | --- | --- | --- |
| `backend/internal/platform/database/db.go:135` | `registered as GAP-51` | `GAP-61` | 重编后 `GAP-61` 才是「`sanitizeDSNError` 残余暴露」 |
| `backend/internal/platform/database/db_test.go:106` | `registered as GAP-51` | `GAP-61` | 同上 |

**明确不改（并给出理由）**：

| 位置 | 为什么不改 |
| --- | --- |
| `backend/internal/market/price_oracle.go:25` / `:139` 的 `GAP-52` | **指对了**。该文件由 `upstream/main` 引入（`06dbb2e`），其 `GAP-52` 指上游的「前端 `/api/market` 合成行情（✅）」——该号在合并后的树里**未变**。**W1 侧从未在 `price_oracle.go` 写过注释**（`git log --all -S` 实测）。**改它才是引入错误** |
| `docs/changes/040` 里的 `GAP-51` / `GAP-53` 与那条已失效的命令 | **历史快照**（D4：已发生的事实不改写）。`040 §8` 的「待登记 GAP-53」是**当时的取号建议**，它**已被顺延两次**（53 → … → 60），台账 §1 表后注有完整映射 |
| `docs/changes/043:22` 的 `GAP-62~GAP-69` | **当时的实测陈述**（见 §1.1：它反而成了守卫的一个坑，**记录在案比改掉它有用**） |

---

## 5. 与 `docs/changes/045` 的交叉

`045` 的审计结论（**`developer/keys` 是唯一一条经 `db.Pool` 落盘却未守的路由**）
与 `GAP-70` / `GAP-71` 是**同一批审计的三个产物**：

| 产物 | 载体 |
| --- | --- |
| 缺口已修（F-1） | `045`（代码 + 判据） |
| 注释过度声称已收窄（C3） | `045`（`router.go` + `router_test.go`） |
| **没有机械守卫来防止它再发生** | **本文件 `GAP-70`** |
| **守卫判的是构造期快照而非当下可达性** | **本文件 `GAP-71`** |

即：**F-1 修的是那一条路由，GAP-70/71 记的是"这类路由还会再来"的两种方式。**

---

## 6. 未做 / 明确不做

| 项 | 处置 |
| --- | --- |
| 修 §2 的任一条（除指针） | **不做**：本轮派发范围是 B1/F-1 + 登记；且六条需真 PG |
| 给编号加机械守卫 | **不做，且不另开号**：台账文件头已有该**建议**（见 §1.1），登记会与它撞车 |
| 改 `005_settlement_ledger.sql`（GAP-66/67/69 的 DDL 半边） | **不做**：与 GAP-60 同批更合适（都要在真 PG 上定稿） |
| 改 `docs/changes/040` / `043` 里的历史号 | **不做**：历史快照不改写（D4） |

---

## 7. `[未能验证]` 清单（明确，不伪装）

| 项 | 为何 |
| --- | --- |
| GAP-66 的 **PG 半边**：触发器在两个 ref 上盖出的 `balance_after` 实际值 | 本机**无 docker、无 psql、无 `DATABASE_URL`**（与 GAP-60 同因）。本轮实测的是**Go 侧反应**（喂入按触发器逻辑推出的值 → `ErrBalanceAfterMismatch`），**不是**在真 PG 上盖出那两个值 |
| GAP-67 的 PG 舍入行为 | 同上。Go 侧拒收已实测；PG 侧"静默舍入"是**列类型 + PG 文档语义**的推断，**未实测** |
| GAP-68 / GAP-69 的解除效果 | 加约束/加守卫后的行为需真 PG 才能验 |
| GAP-71 的"运行期翻 false" | **无法构造**：`IsConnected` 没有任何运行期写点（这本身就是该条的内容）——故它是**阅读实测**而非运行实测 |
| `docs/changes/` 的编号并集 | 覆盖**全部 27 个本地 ref**（含 remote-tracking）；**未覆盖未 fetch 的远端分支**。按 D4，本仓任何分支若出现 `GAP-65~71`，合并时须再行检索 |
