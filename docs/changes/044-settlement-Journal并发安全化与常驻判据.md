# 044 · `settlement.Journal` 并发安全化 + 常驻并发判据

> **环**：02 开发（修 B1）· 03 测试（把「默认跳过」的复现器换成 CI 会跑的判据）
> **分支**：`feat/w1-ai-infra-foundation`（worktree `koliance-w1`）
> **来源**：`docs/changes/040 §6`（qa-validator 独立 03 环）**击穿**项——`Journal` 并发 append 以
> **不可 recover 的 `fatal error`** 终止进程。本轮为**实现方修复 + 判据常驻化**。
> **取号（D4 / `AGENTS.md` §6）**：详见 §5，`044` 为全分支并集下的下一个可用号。
> **不塞回 `040`**：那是 qa-validator 的**历史快照**（D4：已发生的事实不改写），本轮的修与测**单独成篇**。

---

## 1. 缺口与判据（动手前立）

| 项 | 事实（实测） |
| --- | --- |
| **缺口** | `Journal` / `checker` 无互斥、无并发契约。`Append` 走 `c.apply`：读 `c.seenSeq`（`:260`）的同时另一个 goroutine 写 `c.states`（`:303`）→ Go 运行时把它变成 **`fatal error: concurrent map writes`**，**不是可 recover 的 panic**，会带走整个测试二进制 |
| **原判据的洞** | 唯一复现器 `TestQAJournalConcurrentAppendCrashesTheProcess` **由 env 开关默认 `t.Skip`** → **CI 永远看不见它**（`go test -race ./...` 里它是一次 SKIP）。D3 要的是**有牙**的判据 |
| **修法选择** | **加锁**（选它，理由见 §2），**不是**「文档化成非并发安全契约」 |
| **判据常驻化** | 复现器**不是**判据：实测 **20 次里 3 次假绿**（§3.2）。必须换成**确定性断言**，见 §3.3 |

---

## 2. A · 修 B1：为什么是「加锁」而不是「文档化」

两条路都合规，选**加锁**，理由是**这个包自己已经把自己定位成并发组件**，文档化会与它自身的定位冲突：

| 依据 | 出处（已读） |
| --- | --- |
| `ledger_seq` 由 **sequence** 分配、理由是「rows written concurrently commit out of order」 | `backend/migrations/005_settlement_ledger.sql:74-79` |
| 迁移的触发器为此专门加 **事务级 advisory lock** 串行化同一 intent 的并发写入 | 同上 `:131-133`、`:142` |
| 所以「一个 `Journal` 被并发 append 时**不崩进程**」是**契约**，不是可选优化 | 与 `docs/changes/040 §6.1` 的裁定一致 |

**反方向的代价也算了**：选「文档化成非并发安全」需要同时给出**在 CI 会跑的契约判据**
（否则等于把 D3 的洞从「未验证」挪成「已文档化但仍未验证」），而契约判据本身就得并发跑——
**那就已经是在测并发安全了**。故加锁是更省、也更诚实的一步。

**改动**（`backend/internal/settlement/ledger.go`）：

1. `Journal` 增 `sync.Mutex`；`Append` / `Close` 各自在**进入即取锁、`defer` 释放**。
   选 `sync.Mutex` 而非 `RWMutex`：`Close()` **不是**纯读——它返回的 `*Report` 与内部状态共享
   （见第 3 点），把「读」也串行化是**为了让它成为真读**。
2. **刻意未做**：nil `*Journal` 守卫。包内两条入口本来都会 panic，加守卫等于发明一条没人要求的契约；
   `Append` 的**契约变更仅限于并发**。
3. `close()` 改为返回 **快照**：`Total` / `DebitTotal` / `CreditTotal` / 每个 `AccountBalance.Balance`
   一律 `new(big.Rat).Set(...)` 拷贝。

### 2.1 第 3 点不是顺手加戏——它是一个**可观测的错误数字**

原 `close()` 把内部 `*big.Rat` **直接交给调用方**（`rep.Total = c.total`、`DebitTotal: st.debitTotal`、
`Balance: st.balances[acc]`）。于是：

```
rep1, _ := j.Close()     // 拿到 Report
j.Append(第二笔)          // 同一 intent 的下一对腿，合法
rep1.Total               // ← 跟着变了
```

**即：一个已经「关闭」的报告会在调用方手里被后续 append 改数**。加锁**挡不住**它——
锁只保证临界区互斥，不保证返回值的所有权。对一本**账**而言，「报告被悄悄改写」正是 D3 要防的
「错了不会响」：它不会崩、不会报错，只是数字变成另一个。

**实测（判据 + 负向对照均真跑，见 §3.4）**：把 `close()` 的拷贝去掉，该用例**红**
（`first.Total = 200, want 100`）；加回即绿。

---

## 3. 判据（真跑，回灌 stdout）

### 3.1 修复前：缺口可复现

```
$env:QA_CONCURRENT_JOURNAL='1'
$ go test ./internal/settlement/ -run TestQAJournalConcurrentAppendCrashesTheProcess -count=1
fatal error: concurrent map read and map write
goroutine 37 [running]:
github.com/koliance/backend/internal/settlement.(*checker).apply(0xc00008aa40, {0x3a, ...})
exit=1
```

### 3.2 复现器**不是**判据——先量它的假绿率（这条是本轮最该带走的事实）

同一开关连跑 20 次：

```
reproducer over 20 runs: PASS=3 FAIL=17
```

**`PASS=3` 的含义是：一个真的会崩进程的竞态，有约 15% 的概率「跑绿」。**
故「跑一次复现器」**不构成**判据；把它挂进 CI 会得到一个**间歇性**的守卫，
而间歇的守卫在本项目的口径里等于没有（`docs/changes/040` 原文：「默认 skip，CI 永远看不见」→
**开开关只是把「永远看不见」换成「三分之一看得见」**，不解决 D3）。

### 3.3 常驻判据（**无开关、无 skip、CI 会跑**）——确定性断言

`TestQAConcurrentAppendToASharedJournalAdmitsExactlyOnePostingPerReplayPosition`：
8 轮 × 64 goroutine（起跑栅栏对齐）**同时 append 同一笔**（同 `ledger_seq`、同 intent）到**同一个** `Journal`。

| 断言 | 为什么它是确定性的 |
| --- | --- |
| 每轮**恰好 1 个** append 返回 `nil` | 有锁时「查 `seenSeq` 与写 `seenSeq`」是原子的，故后来者**必然**看到重复 → 精确计数；**失败者一律是 `ErrDuplicateSeq`**（`apply` 先查重、后查序，故不会串到 `ErrOutOfOrder`） |
| 其余 63 个错误**必须**是 `ErrDuplicateSeq` | 白名单化错误集，任何别的错误都报错 |
| 全部轮次结束后 `Close()` **必须**是 `ErrNotBalanced` | 每轮只落进一条单腿，试算平衡**必然**拒绝——不依赖时序 |

**没有锁时会怎样**（**已实测，不是预测**）：把 `Journal` 的锁去掉（变异：`Append`/`Close` 回到
`return j.c.apply(e)` / `j.c.close()`，`j.mu` 只剩字段声明），同一用例连跑 10 次：

```
MUTATION2 (no Journal mutex) over 10 runs: ABORT=7 RED=3 GREEN=0
```

- **7 次**：`fatal error: concurrent map read and map write` @ `(*checker).apply(...)` → 进程倒地。
- **3 次**：没倒地，被**计数断言**抓住——

```
qa_ledger_test.go:565: round 0: 3 of 64 concurrent appends of ledger_seq 1 were accepted, want exactly 1;
                       the duplicate check and the fold are not one atomic step (ledger.go)
qa_ledger_test.go:565: round 2: 2 of 64 concurrent appends of ledger_seq 3 were accepted, want exactly 1;
```

即 **2~3 个 goroutine 同时通过了查重**（丢失更新），正是「查重与落册不是一步」的直接观测。

> **本轮最该带走的一对数字**：同一份坏代码，**旧复现器 20 次里 3 次假绿（15%）**，
> **新判据 10 次里 0 次假绿（0%）**。差别不在"跑了并发"，而在**断言是不是确定性的**。
>
> **诚实标注**：本用例的**断言**对正确代码是确定性的——
> **实测：修复后带 `-race` 连跑 20 次，`PASS=20 FAIL=0`**（不抖）。
> 但其**发现回归的能力**与竞态一样带概率——64 goroutine × 8 轮 + 两条独立出口（计数 / 进程倒地）
> 把假绿压到**实测 0/10**（上）。**这不等于"证明无竞态"**：它给的是"要么绿得稳，要么红得响"。
>
> 两个数字要**合读**：`0/10 假绿`（坏代码会红）与 `20/20 稳定绿`（好代码不会无故红）**缺一不可**——
> 只有前者会得到一个乱红的守卫，只有后者会得到一个死掉的守卫。

### 3.4 快照判据（确定性，负向已实测）

`TestQAReportIsASnapshotNotAViewOfLiveState`：关闭后继续 append，断言**第一次**的报告不被改写。

```
$ go test ./internal/settlement/ -run 'TestQAReportIsASnapshotNotAViewOfLiveState' -v -count=1
=== RUN   TestQAReportIsASnapshotNotAViewOfLiveState
    qa_ledger_test.go: first report: total=100 entries=2 ; after a further balanced pair: first.total=100 (unchanged), second.total=200 entries=4
--- PASS
```

**负向对照（真跑）**：临时把 `close()` 的 4 处 `copyRat(...)` 换回直接赋值，同一用例：

```
    qa_ledger_test.go: the first report was rewritten by a later append: total = 200, want 100
--- FAIL
```

随即还原（`git diff` 空）。

### 3.5 全档

```
$ go build ./...        exit=0
$ go vet ./...          exit=0
$ go test -race -count=1 ./...    exit=0   （读数见 §6）
```

---

## 4. 未做 / 明确不做

| 项 | 处置 |
| --- | --- |
| nil `*Journal` 守卫 | **不做**（§2 第 2 点）：发明没被要求的契约 |
| `checker` 本身导出/并发 | **不做**：它是包私有实现，锁加在唯一的并发入口 `Journal` 上 |
| `CheckEntries` 加锁 | **不做**：它自建 checker 且不逃逸，无共享状态 |
| 「证明无竞态」 | **不做，也做不到**：见 §3.3 的诚实标注 |

---

## 5. 取号（D4）

**登记前检索**（全分支并集，两条都跑）：

```powershell
# docs/changes/ 编号并集：逐 ref ls-tree（不用 git log --all --name-only，
# 它会漏掉只由 merge 引入的文件）
foreach ($r in (git for-each-ref --format='%(refname)')) { git ls-tree -r --name-only $r -- docs/changes/ }
# → 最大号 043
```

**实测**：`docs/changes/` 全分支并集（27 个 ref，含全部 remote-tracking）**47 个文件**，最大号 **`043`**；
本分支 HEAD 亦为 `043`。故 **`044` 可用**。
（`GAP-` 号的并集另见 `docs/changes/046`——那边的并集最大号是 64，**与本文的 43 无关**，
两条序列各自独立取号。）

---

## 6. 实测读数（本轮，供引用）

```
$ go test -race -count=1 ./...
ok  github.com/koliance/backend/internal/settlement  1.4s
（全仓 21 个包，见 §6 的回灌全文）
```

- 修复前：`Journal` 并发 append → `fatal error`，20 次跑 17 次倒地。
- 修复后：同一复现形状（64 goroutine 抢同一 `ledger_seq`）**10 次变异跑 0 次假绿**（§3.3），
  常驻判据本身在 `-race` 下**全绿**；且**不再需要**那个开关——判据已在 CI 里跑。

---

## 7. 下游同步清单与未竟

| # | 事项 | 承载 |
| --- | --- | --- |
| 1 | `qa_ledger_test.go` 是 qa-validator 的独立文件，本轮**由实现方改**了两处（换掉默认跳过项、新增快照用例）——**属判据变更，须由 `falsifier` 重新独立复核** | 本文件 §3.3 / §3.4 |
| 2 | `005` 迁移 §21-25 的注释仍是「任意前缀」口径，与 `ledger.go` 的 per-intent 试算平衡不同成熟度 | **已在 `docs/changes/040 §7` 登记过**，本轮**复核仍然成立**、**不重复取号**；见 `docs/changes/046` |
| 3 | 迁移未在真实 PG 上执行 | **GAP-60**（既有） |
| 4 | **`docs/changes/040 §6` 里的那条命令现在会「零测试运行」** | **有意不改**：`040` 是**历史快照**（D4：已发生的事实不改写），它记录的是**当时的复现方式**。读者按它跑会看到 `testing: warning: no tests to run`——**那不是错误，是那条命令已被本文件取代**。指针即本文件。 |
| 5 | `backend/internal/platform/database/db.go:135`、`db_test.go:106` 仍把 GAP-61 写成 `GAP-51`（`docs/changes/042` 重编号后未跟着改） | 本轮**顺带修正**（纯指针），见 `docs/changes/046` |
