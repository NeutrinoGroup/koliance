# 069 — 补两条判据缺口：`cmd/api` 启动守卫（GAP-65）与路由清单反向对拍（GAP-70）

> **环**：03 测试（独立于实现方的判据补齐）
> **来源**：`docs/GAP台账.md §5.9` 的两条登记缺口 —— **GAP-65**（`cmd/api` 启动 fail-fast 无任何自动化判据）· **GAP-70**（qa 路由清单无「路由 → 清单」反向对拍）
> **先写后填**：本文在改动前立；§3、§4 落地后回灌真实 stdout。
> **基线**：`upstream/main` @ `d72cf26`；工作分支 `work/main`。

---

## 1. 为什么做这两条（而不是 W2 的 Trust 支柱）

`docs/planning/推进方案-Trust-Identity-AI-Infrastructure.md §3.4` 把 **W2（T1/T2/T4）** 列为下一波，
但那一波（GAP-46/47/48）规模为多天、跨 `src/` + `backend/` + 迁移，且含一条**口径待裁**（proof 哈希的规范化与 `action` 绑定口径）。
本轮选择**先做台账里已登记、且判据本身可自证的两条缺口**（GAP-65 / GAP-70）：

- 二者都由**台账自己**给出了可证伪的解除条件（§5.9 逐条写明「负向对照」），**无需任何口径裁决**；
- 二者都是 **D3 点名的那一类**——「判据缺失，而非缺陷存在」。生产行为是对的，缺的是「它坏了会被发现」；
- 二者**不改任何生产行为**，只新增判据，回归面最小、可独立回滚。

> **口径说明**：本轮**不关闭** W2 的 T1/T2/T4，也**不改写** §3.4 的波次建议——它们仍是下一步。
> 本文只把「手头能自证的缺口」做掉，并如实登记每一条的**残余边界**。

---

## 2. GAP-65 · `cmd/api` 启动 fail-fast 的判据

### 2.1 缺口事实（台账 §5.9 原文的复现）

GAP-49 的修复分两半：`cmd/api` 启动即拒绝（主）· 落盘路由 `withDB` 守卫（纵深防御）。
**第二半有 6 条用例；第一半一条都没有**——因为它在 `cmd/api` 里，而 `cmd/api` **没有测试文件**。
台账记录的变异是：把 fail-fast 退回静默内存降级后，`go build` / `go vet` / `go test -race ./...` **仍全绿**。

### 2.2 判据设计（`backend/cmd/api/main_test.go`，新增）

两条用例，**第二条是负向对照**：

| 用例 | 断言 |
| --- | --- |
| `TestRun_RefusesToStartWithoutDatabaseURL` | `run(&config.Config{})` **非 nil**，且 `errors.Is(err, database.ErrDatabaseURLRequired)` |
| `TestRun_RefusesBeforeBindingPort` | **持有一个临时端口**再交给 `run`；仍必须返回 `ErrDatabaseURLRequired` —— 证明拒绝发生在**任何端口绑定之前** |

**负向对照为什么必须持有端口**：不持有端口时，「返回了 sentinel」与「一个已经成功绑定了端口、随后才失败的 run」在观测上不可分。
持有端口后，一个失去 fail-fast 的 `run` 会撞上 `EADDRINUSE`、返回**绑定错误**——断言 sentinel 即红。
两条用例因此断言的是**两个独立性质**（拒绝了 · 拒绝得早），不是同一条的两次。

**一个刻意的边界**：`run` 会自建 10s context 并调真实 `database.New`，故测例必须是**在任何网络 I/O 之前就失败**的那种——
空 `DATABASE_URL` 正是此类。**且 `run` 不可注入**：判据只能推到「拒绝、错误正确、未碰端口」，其**之后的接线（Deps、handler 链）不在覆盖内**（需要活库）。

### 2.3 实测（真实 stdout）

```
$ cd backend && go test -race -count=1 ./cmd/api/...
ok  	github.com/koliance/backend/cmd/api	3.105s
```

`cmd/api` 在 `go test ./...` 中**不再打印 `[no test files]`**（见 §4 全量输出）。

### 2.4 负向证伪（D3，真跑）

把 `run` 退化回 GAP-49 之前的静默内存降级：

```
cmd/api/main.go 变异：db, err := database.New(...) ; if err != nil { db = database.NewMemoryOnly() }
$ go build ./...                                      exit=0     # 变异体编译得过
$ go test -race -count=1 -timeout 60s ./cmd/api/...
--- FAIL: TestRun_RefusesToStartWithoutDatabaseURL (3.00s)
--- FAIL: TestRun_RefusesBeforeBindingPort (3.00s)
FAIL	github.com/koliance/backend/cmd/api	7.657s         # 两条同时红
```

**且红不是挂起**：首版判据没有超时，变异后 `run` 会走到 `ListenAndServe` **永久阻塞**——
那不是可用的红色信号（CI 里表现为超时而非失败）。故加了 `runBounded`（3s 上限，独立 goroutine），
把「退化成服务器循环」变成一条**显式失败**：`run did not return within 3s ... (GAP-49 regression)`。
**这条自证本身就是 GAP-65 的形状**：一个会在 CI 里挂起而不是变红的判据，等于没有判据。

已还原（`git diff --stat` 空）。

---

## 3. GAP-70 · 路由清单的反向对拍

### 3.1 缺口事实（台账 §5.9 原文）

`qaRouteInventory` 驱动 `TestQARouteInventoryIsComplete`，只做**清单 → 路由**一个方向：
清单里每条路径必须真的已注册。**反方向（已注册的路由必须出现在清单里）没有任何判据**——
于是**新增一条路由不会出现在任何清单里，从而不会被任何用例覆盖——静默免测**。
`router_test.go` 的 `dbGatedRoutes` 注释已用文字承认同一件事（"the absence is registered as GAP-70"）。

### 3.2 判据设计（`backend/internal/httpapi/qa_route_inventory_test.go`，新增）

**注册集用 AST 解析 `router.go` 得到**，不靠打一个活 mux：要抓的是「源码里有、清单里没有」的路由，
解析法天然与「该路由是否需要数据库」无关。

| 组件 | 职责 |
| --- | --- |
| `routeRegistrationPaths(src)` | 解析 `router.go`，**按形状**识别注册辅助函数（`h := func(path string, …) { mux.HandleFunc(path, …) }`），产出其**首个字符串实参**的集合。**识别的是被赋值的变量名（`h`），不是它的形参名（`path`）** |
| `pathCovered(registered, covered)` | 前缀路由（尾随 `/`）由**其下的具体子路径**覆盖；精确路由只由精确匹配覆盖 |
| `unlistedRoutes(...)` | 抽出的纯函数，供负向对照用合成输入驱动 |
| `TestQARouteInventoryCoversEveryRoute` | 反向主判据：注册集 ⊆ 清单集 |
| `TestRouteRegistrationPaths_DetectsARegistration` | 对**检测器本身**的负向对照：合成源码里塞一条探针注册，必须被检出 |
| `TestUnlistedRoutes_FlagsANewRoute` | 对**反向判定**的负向对照：未列出的必须被标红；**已列出的、以及被具体子路径覆盖的前缀路由**，必须**不**被标红 |

**两道防真空守卫**（缺一，该判据就会「假绿」）：
1. `routeRegistrationPaths` 找不到辅助函数时**返回错误**，不返回空表——空表会让主判据**真空通过**；
2. 主判据断言**注册集规模 ≥ 20**（当前 ~30）——检测器一坏就红，而不是静默变空。

### 3.3 开发中实测到的两个真实陷阱（照实记录）

| 陷阱 | 现象 | 处置 |
| --- | --- | --- |
| **取错标识符** | 首版取的是 FuncLit 的**形参名** `path`，于是找到 **0 条**注册 | 改为取**赋值左侧变量名** `h`。**守卫 2 当场报红**（`found only 0 paths`）——这正是它存在的意义 |
| **前缀路由假红** | 首版把尾随 `/` 去掉后，`/api/v1/agentcard/cards/` 与清单里的具体子路径 `/api/v1/agentcard/cards/cX` 对不上 → **误报 1 条孤儿** | 改为**保留尾随 `/`** 并让前缀路由由子路径覆盖。**这个假红是判据自己的缺陷，不是路由的**——已在 §3.2 的 `pathCovered` 里修掉，并补了一条对应用例 |

> **这两条都不是"写错了改一下"，而是这条判据的两种典型失效**：取错标识符 → **假绿**（最危险）；
> 过度归一化 → **假红**（会诱使人把判据删掉）。二者都在本轮真跑出来并被各自的对应用例钉住。

### 3.4 实测（真实 stdout）

```
$ cd backend && go test -race -count=1 -run "TestQARouteInventoryCoversEveryRoute|TestRouteRegistrationPaths_DetectsARegistration|TestUnlistedRoutes_FlagsANewRoute" -v ./internal/httpapi/...
=== RUN   TestQARouteInventoryCoversEveryRoute
--- PASS: TestQARouteInventoryCoversEveryRoute (0.01s)
=== RUN   TestRouteRegistrationPaths_DetectsARegistration
--- PASS: TestRouteRegistrationPaths_DetectsARegistration (0.00s)
=== RUN   TestUnlistedRoutes_FlagsANewRoute
--- PASS: TestUnlistedRoutes_FlagsANewRoute (0.00s)
PASS
ok  	github.com/koliance/backend/internal/httpapi	2.408s
```

### 3.5 负向证伪（D3，真跑）

往 `router.go` 注入一条**不在清单里**的新路由：

```
internal/httpapi/router.go 变异：在 h("/health", …) 之后插入 h("/api/v1/qa-unlisted-probe", …)
$ go build ./...            exit=0
$ go test -count=1 -run TestQARouteInventoryCoversEveryRoute ./internal/httpapi/...
--- FAIL: TestQARouteInventoryCoversEveryRoute (0.00s)
    router.go registers 1 path(s) absent from qaRouteInventory — a new route is silently untested (GAP-70). Add each to qaRouteInventory with its expected status, or register an exemption:
          /api/v1/qa-unlisted-probe
FAIL
```

**这正是台账说它刚发生过的那一幕**（`/api/v1/developer/keys` 住在缝里）——现在它会当场变红。
已还原（`git diff --stat` 空）。

---

## 4. 全量回归（本机实测）

```
$ cd backend
$ gofmt -l cmd/api/main_test.go internal/httpapi/qa_route_inventory_test.go     # 空 = 已格式化
$ go build ./...                                                                 exit=0
$ go vet ./...                                                                   exit=0
$ go test -race -count=1 ./...
ok  	github.com/koliance/backend/cmd/api	4.015s          # ← 本轮新增（此前为 [no test files]）
ok  	github.com/koliance/backend/internal/httpapi	5.776s
ok  	…（其余各包全 ok，0 data race）
```

**新增判据数**：`cmd/api` **2 条** + `internal/httpapi` **3 条** = **5 条**，均入 CI 矩阵（`go test ./...` 覆盖）。

---

## 5. 残余边界（不关闭的部分，照实登记）

| 项 | 边界 | 归属 |
| --- | --- | --- |
| **GAP-65 的覆盖上限** | 判据只到「启动拒绝」。`run` 的后续接线（`Deps` 组装、handler 链、`ListenAndServe`）**无判据**——需活库或注入 | 本项**部分解除**；剩余部分并入 GAP-60（需真实 PG） |
| **GAP-70 的豁免机制** | 判据是「注册集 ⊆ 清单集」，**没有显式豁免语法**（孤儿一律红）。若将来确需豁免，加一张 `routeInventoryExemptions` 白名单即可，但**豁免本身也应可审计** | 设计选择，非缺陷 |
| **GAP-70 的检测面** | 依赖 `router.go` 的注册**一律走辅助函数**。若有人直接 `mux.HandleFunc(...)` 绕过辅助函数，**该路由不会被检出**——这是**假绿**方向，故在 `routeRegistrationPaths` 的文档里写明该前提 | 已写明；若被绕过需重定判据 |
| **GAP-70 未覆盖其他清单** | 只对拍了 `qaRouteInventory`。`router_test.go` 的 `dbGatedRoutes` **仍是单向的**（它自己那条注释指向 GAP-70，但本轮只接了 qa 清单） | 残余，后续可同一手法接上 |

---

## 6. 与台账的关系

- 本轮把 `docs/GAP台账.md` 的 **GAP-65** 与 **GAP-70** 由 🟠 改为 **✅（部分）**，附本文编号 `069`；
- **不新开 GAP 编号**（两条都已被既有编号覆盖，符合 D4「与既有编号撞车比漏登记更糟」）；
- **§5.9 的"其余六条取证或解除需要真实 PostgreSQL"一句不变**——本轮两条恰好是**不需要 PG 的那两条**。
