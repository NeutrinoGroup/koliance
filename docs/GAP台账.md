# Koliance 质量缺口台账（GAP）

> **用途**：本项目**所有未完成事项的唯一台账**。任何"还没做"的东西都必须出现在这里，
> 否则它就不存在。协作者据此判断现状，不要依赖口头同步。
>
> **编号规则**（`提示词.md` 纪律 §4）：`ADR-` 架构决策 · `MIG-` 数据库迁移 · **`GAP-` 质量缺口** · `INC-` 线上故障 · `DEFER-` 延期债务
>
> **维护要求**：新增缺口立刻编号入表；修完把状态改为 ✅ 并附提交号；**不要删除已完成项**（它们是回归基线）。
>
> **最后更新**：**2026-10-12** · 分支 `feat/w1-ai-infra-foundation`（`dc03b6a`）**二次并入 `upstream/main`（`535214b`，16 个提交）**，
> 本次**只解一个文档冲突**（`docs/GAP台账.md`，两处；`deploy/README.md` 自动合并，**无代码冲突**），
> 并把 W1 侧的 `035/036/038` 让位为 **`039/040/041`**、`GAP-57/58` 让位为 **`GAP-60/61`**；另登记观测项 **`GAP-62/63/64`**。
> **本轮合并与重编的完整记录见 `docs/changes/042`，观测项登记见 `docs/changes/043`。**
> 以下两行是**上一轮（2026-10-11）的留痕**，其号 **`docs/changes/035` / `GAP-57/58` / `§5.7` 均已顺延**：
> **上一轮最后更新**：2026-10-11 · 分支 `feat/w1-ai-infra-foundation`（`1f5f007`）**已并入 `upstream/main`**
> **本轮（W1）**：**GAP-43 / GAP-44 / GAP-49 关闭**（`docs/changes/039`）；新登记 **GAP-60**（迁移未真跑，🔴 阻塞于环境）与 **GAP-61**（DSN 脱敏残余暴露），见 **§5.8**。
> ⚠️ **本行的号已顺延两轮**：`docs/changes/035 → 039`（2026-10-12）· `GAP-57/58 → GAP-60/61`（2026-10-12）· `§5.7 → §5.8`（2026-10-12）——成因与映射见 §1 表后注。
> **上下游轮次（`upstream/main`）**：**GAP-52 ✅ 关闭** ——
> 前端 `/api/market` 由**本地行情生成器**改为**纯代理**（删 `FALLBACK_MARKET_DATA`/`seededRandom`/`synthetic_curated`/
> `synthetic_fallback`，无兜底路径）· `MarketTerminal` 账户/订单/跑马灯**去硬编码** · 新增
> `src/lib/marketFeed.ts` 与 `tests/market-no-synthetic.test.ts`（回归守卫）· **新开 GAP-54**（实测确认审计报告 `U-5`：
> market 页之外仍有多处合成数据，本轮未修）。来源：`docs/changes/028`（前端侧，issue #14/#16）。
> **上下游上一轮（后端侧，`docs/changes/027`）**：market 后端侧改为**真实 Alpaca 或 503**（无合成路径）·
> 新增 **`/api/v1/market/movers` 标的涨跌幅排行** · `/health` 的 `steam`/`github`/`alpaca`/`pyth` 四键**改真探活** ·
> 删 `ALPACA_API_KEY`/`ALPACA_API_SECRET` 两处硬编码默认值；新开 GAP-52 / GAP-53。
> **上游合并轮**：`feat/liquidation-bot-chain`（PR #11，GAP-38~42）
> × `docs/ai-infrastructure-roadmap`（PR #12，`98a0ad8`，GAP-43~50）——**两侧均为台账新增、编号本就错开，故 union 全保留**。
> **上游本轮（PR #11）**：**GAP-41 ✅ 落地**（§5.5，`docs/changes/026`：Bot 镜像纳入资金费）· GAP-26 `/api/v1/liquidations` ✅（`docs/changes/025`）
> **上游本轮（PR #12）**：**补登记 §5.1**——`项目目标.md §5` 的 P2 项与「五大核心领域」此前**只有正文、无编号**，
> 按本项目规矩「不在台账里 = 不存在」补为 **GAP-43~49**（§5.1 有逐条实测依据）；另补 **GAP-50**（§5）。
> **编号避坑**：PR #12 侧新号一律从 **GAP-43** 起——**GAP-38~42 已被 PR #11 的
> `feat/liquidation-bot-chain` 占用**（实测见 §5.1 末注）。
> **上一轮（2026-10-09 · `feat/perp-solvency-and-panel`）**：GAP-37 已关闭（§3.6）；GAP-25 标注已修（§3.7）
> **最新登记**：**GAP-43~50 新开**（§5 / §5.1）· **GAP-42**（§5.6）· **GAP-41 残余**：链上对拍 / 投影指数（§5.5 文末）· **GAP-37 已修**（§3.6）· **GAP-25 标注已修正**（§3.7）· **GAP-06 已关闭**（§3.6）· GAP-36 已修（§3.4）· GAP-16/34 已修（§3.5）
> **§5 小节编号（合并后）**：§5.1 本轮补登记 GAP-43~50 · §5.2 GAP-38 · §5.3 GAP-39 · §5.4 GAP-40 · §5.5 GAP-41 · §5.6 GAP-42
> **§5 后续小节（2026-10-12 二次合并后核对）**：§5.7 README 与文档一致性整合（PR #20，GAP-57~59）· §5.8 W1 的两个新缺口（GAP-60 / GAP-61）· **§5.9 W1 独立证伪新增的七个缺口（GAP-65~71）**。**本节清单须与实际枚举对拍**——前一版只列到 §5.6，而 §5.7 已在 PR #20 时就存在（同 `docs/changes/007` 的「空分母」教训：清单类陈述必须与 `Select-String '^### 5\.\d'` 的输出一致）。
> **旧号顺延（供既有引用对照）**：PR #11 侧 §5.1→§5.2 · §5.2→§5.3 · §5.3→§5.4 · §5.4→§5.5 · §5.5→§5.6；PR #12 侧的 §5.1 **不变**。
>
> **文档一致性整合轮（2026-10-11，ssot-scribe，分支 `docs/consistency` @ `9674f53`）**：
> 本轮**只做结构与索引整合，不新增功能事实**，共四类动作：
> ① **消解 `docs/changes/` 编号撞车**——三个 `022` 中的两个改为 **`030`** / **`031`**（见 `docs/planning/README.md` 的「变更记录」注）；
> ② **补齐 `docs/planning/README.md` 的变更索引**（原只列到 `009`，补到 `031`）并补入 `ADR-005`；
> ③ **修正本文件 §0 的归档表**（原写 `changes/ 001~012`、`adr/ ADR-002/003/004`，均落后十余条）；
> ④ **新开 GAP-57~59**（§5.7）——README 三重漂移 / 地址 provenance / 基准报告 Observations 与数据相反。
> **本轮未跑任何构建或测试命令**，故**不给任何覆盖率、用例数读数**；引用的数字一律标明出处与采集时点。
> **完整取证与未处置项见 `docs/planning/文档一致性核对.md`。**
>
> ⚠️ **本轮的编号被顺延过两次，原因是跨分支撞车——这件事本身是本轮最值得记的产出**：
> `docs/changes/` 的 `030/031` 与本节新开的 `GAP-57~59`，各自都在被写下之后才发现
> **另一条未合并分支 `feat/real-alpaca-data`（`669aece` → `75ccda7`，本轮中还在前进）**
> 已占用先前拟用的号（`027/028`、`029/030` 与 `GAP-52~56`）。
> **"当前分支最大号 +1"在并行分支下必然失效，且失效无声**——
> **这已经是"编号空间无守卫"这个缺陷在同一个项目里的第三次显形**（前两次见 `docs/changes/010` 撤销撞车的 GAP-37、
> 以及上文三个 `022`）。**建议**：给编号加**机械守卫**（hook 级），
> 断言新号在**全部本地分支的并集**里唯一——**不要指望"记得跨分支查"**，它已经失效两次。
> 详见 `docs/changes/030-GAP51-文字深色化与背景自动波动.md` 的文件头（含完整顺延表）。

---

## 0. 归档位置说明（GAP-31 ✅ 已修）

本仓库的文档原先分居两处，规划类文档**不在 git 下**，协作者 clone 后看不到。
**已修正**：规划文档迁入 `docs/planning/`，并附 `docs/planning/README.md` 索引。

当前结构：

| 位置 | 内容 |
| --- | --- |
| `docs/adr/` | 架构决策（**ADR-002 / 003 / 004 / 005**） |
| `docs/changes/` | 每次代码变更的记录（**48 份**，`git ls-files docs/changes/` 于 2026-10-12 实测；编号 `001`~`046`，其中 `027`/`028` **各两份**、`022~026` 为空号）。**本行曾被读到并改对过两次**：上一版写 **43 份**（实际已是 **47 份**），再上一版写 `001~012`——两次都是**行数与实际枚举不等**，即本节自己那条教训（"清单类陈述必须与实际枚举对拍"）**又一次应验**。成因与前次相同：**上游横向合流与本分支各自追加文件，而这一行没人跟着数**。**同一族撞车（`027`/`028`/`035`/`036`/`038`）两轮内发生两次** |
| `docs/planning/` | 目标、方案、审计、情报等规划类文档 + 索引 |
| `docs/benchmarks/` | 外部接口基准报告（`benchmark_report.md` / `benchmark_results.json`） |
| `docs/GAP台账.md` | **本文件**，活的未竟事项台账 |

> **本表曾是错的（2026-10-11 修正）**：它原写 `docs/changes/` 为「**001~012**」、`docs/adr/` 为
> 「**ADR-002 / 003 / 004**」——两者都落后于 HEAD 十几个条目（当时 `changes/` 已到 `026`、
> `adr/` 已到 `005`）。**表格里的行数与实际文件数不一致，是能被机械发现的**：
> `git ls-files docs/changes/ | wc -l` 与 `docs/adr/` 同命令对照即得。
> 教训与 `docs/changes/007` 的「空分母被当成 100%」同族——**清单类陈述必须与实际枚举对拍**。

### 0.1 GAP-31 的残留：迁移后引用未同步（2026-10-08 补修）

文档迁进 `docs/planning/` 时，**别的文档里的引用没有跟着改**——活跃方案文档仍写
`docs/推荐方案-….md`、`docs/项目目标.md` 这类**缺 `planning/` 段**的路径，clone 后打不开。
这与 `ADR-004` 同批修掉的 `prompts/想法记录.md`（`prompts/` 在仓库外）是同一类缺陷。

**已补修**（活跃文档）：`执行方案-自治Agent清结算.md` 5 处、`推进方案.md` 1 处。

> **后续整合轮（2026-10-11，`docs/consistency`）的实测复核**：本轮**没有改动本节提到的任何引用**
> （`git status` 可核）。复核对**全部非 `docs/changes/` 的文档**跑了一遍
> `git grep -n "docs/项目目标\|docs/推进方案\|docs/执行方案\|docs/执行记录\|docs/推荐方案\|docs/缺陷分析\|docs/前沿资讯\|docs/自治 Agent\|docs/ADR-001"`，
> 命中分两类：
>
> | 类 | 命中 | 处置 |
> | --- | --- | --- |
> | **本节的说明文字 / 历史叙事** | 本文件 `:57` `:208` `:387` | 保留（它们本身就是"这个错误存在过"的记录） |
> | **历史快照** | `推荐方案-自治Agent清结算.md`（14 处）· `缺陷分析-审计报告.md`（约 18 处）· `执行记录-Phase0.md`（3 处）· `docs/adr/ADR-002`（3 处）· `docs/adr/ADR-003`（1 处） | 保留（本节已定的四类） |
> | **⚠️ 既非快照、也不在上面的"已补修"清单里——2 处** | `docs/planning/执行方案-后端与合约.md:4` · `docs/planning/执行方案-自治Agent清结算.md:5` | **登记待裁**（见下） |
>
> **这 2 处说明"已补修 5 处"这个说法本身不完整**，且**两处都不是"快照四类"里的**：
> `执行方案-自治Agent清结算.md` 本来就是上一轮**已动过**的那份（`:5` 是它自己漏掉的第 6 处），
> 而 `执行方案-后端与合约.md` **上一轮根本没被列入**（它既非审计报告也非推荐方案，
> 与已被补修的"执行方案-自治Agent清结算"同类）。
> **处置待裁**，理由里有一条是新的：`执行方案-后端与合约.md` 的定位在
> `docs/planning/README.md` 里被写成"参考价值高，**排期部分过时**"——**"部分过时"不是一个可执行的边界**，
> 它没有说清"哪部分算快照、哪部分算待执行指令"。**这正是下面教训的又一例。**
>
> **教训（本节要记的是这个）**：§0.1 的补修清单只写了**数量**（"5 处"）而**没写逐处行号**，
> 于是**无法事后核对是否补全**——漏掉的引用整整留了一轮，**没有任何判据能发现**。
> **下一轮补修请直接列 `git grep -n` 的输出**（逐行号），并写清**改动文件的白名单**，
> 以及**每条"不改"的判据**（是快照？还是待执行指令？）。
> 这与 `docs/changes/007` 的「空分母被当成 100%」同族：**能被证伪的清单才叫清单**。

**历史快照不改**（纪律）：`缺陷分析-审计报告.md`、`推荐方案-*.md`、`执行记录-Phase0.md`
里的旧路径**保持原样**——它们写作时路径是准的，改写快照等于篡改证据链
（判据见 `docs/changes/010` 对 S-6 的纠正）。**只有"待执行的指令"需要准，"已发生的事实"不需要。**

> ⚠️ **不要再在本文件或任何入库文件里写机器绝对路径**（曾出现 `D:\MyDocuments\...`）。
> 本文件的这一行是**唯一**该被允许的例外，因为它本身就在说明这个问题。

---

## 1. 状态总览

| 状态 | 含义 |
| --- | --- |
| ✅ | 已修复，有测试或命令可验证 |
| 🔴 | 未修复，**有明确阻塞**（见"阻塞"列） |
| 🟠 | 未修复，无阻塞，只是没做 |
| ⬜ | 明确不做（有理由） |

| 编号 | 标题 | 严重度 | 状态 | 提交 / 阻塞 |
| --- | --- | --- | --- | --- |
| GAP-01 | 平仓/清算付款失败致头寸永久卡死 | 🔴 P0 | ✅ | `0193e3a` |
| GAP-02 | 单笔不可付款污染整批清算 | 🔴 P0 | ✅ | `0193e3a` |
| GAP-03 | LP 抽干本金致盈利交易者被拒付 | 🔴 P0 | ✅ | `0193e3a` |
| GAP-04 | `maxPnlCap` 未实现 + 开仓无偿付护栏 | 🔴 P0 | ✅ | `0193e3a` |
| GAP-05 | 破产头寸清算赏金为 0（激励反向） | 🟠 P1 | ✅ | `0193e3a` |
| GAP-06 | 前端/链上清算价同源无一致性测试 | 🟠 P1 | ✅ | 见 §3.6 |
| GAP-07 | `closePosition` 无价格时效/滑点约束 | 🟠 P1 | ✅ | `c7da777` |
| GAP-08 | `_pushPrices` 字符串签名 + 失败无观测 | 🟡 P2 | ✅ | `c7da777` |
| GAP-09 | `perpConfig.ts` 的 FEEDS 与链上实测矛盾 | 🟡 P2 | ✅ | `df227bf` |
| GAP-10 | 无 CI，全部用例是"门外用例" | 🟡 P2 | ✅ | `2b05f05` |
| GAP-11 | 缺工程骨架目录 | 🟡 P2 | ✅ | `deploy/README.md`（发布环 runbook） |
| GAP-12 | 凭证硬编码（6 处，含 README 明文） | 🟡 P2 | 🔴 | **需人工轮换密钥**；README 已清理；`config.go` 的 Steam / Stripe publishable 默认值仍在，**但 `ALPACA_API_KEY`/`ALPACA_API_SECRET` 两处默认值已删**（`docs/changes/027`） |
| GAP-13 | 后端零链上交互 + `/health` 伪指标 | 🟡 P2 | 🟠 | **伪指标部分 ✅**（`docs/changes/027`：`steam`/`github`/`alpaca`/`pyth` 四个键改真探活）；**「后端零链上交互」部分仍 🟠** |
| GAP-14 | 合成随机行情以"实时数据"形态返回 | 🟡 P2 | ✅ | `docs/changes/018`（前端标注）+ `docs/changes/027`（后端侧：真实 Alpaca 或 503，无合成路径）+ **`docs/changes/028`（前端侧：`/api/market` 改为纯代理，合成序列与兜底表已删除）** —— market 一条链上**已无合成行情**。**残留同类见 GAP-54**（market 页之外的组件） |
| GAP-15 | `docs/changes` 先写后填纪律从未执行 | 🟠 P1 | ✅ | `0193e3a` 起 |
| GAP-16 | `项目目标.md` 交付缺口 | 🔴 P0 | 🟠 | 部分；见 §3 |
| GAP-17 | 负向证伪用例未常驻化 | 🟠 P1 | ✅ | `0193e3a` |
| GAP-18 | RFC `reserve` 无幂等键 → 重复预扣 | 🔴 P0 | ⬜ | 仅采纳 Redis 时激活 |
| GAP-19 | RFC 冻结 TTL 过期 → 资金永久卡死 | 🔴 P0 | ⬜ | 同上 |
| GAP-20 | RFC `HINCRBYFLOAT` 浮点账本漂移 | 🔴 P0 | ⬜ | 同上 |
| GAP-21 | RFC `daily_spent` 无重置机制 | 🟠 P1 | ⬜ | 同上 |
| GAP-22 | RFC 未引用仓库已有 `agentcard` 委托模块 | 🟠 P1 | ⬜ | 设计决策 |
| GAP-23 | RFC 架构与仓库分层不兼容 + 4 处内部矛盾 | 🔴 P0 | ⬜ | 设计决策 |
| GAP-24 | 三套 Session Key 模型互不兼容 | 🟠 P1 | 🟠 | **链上闭环**（`013`+`014`）；Go 侧仍用 `sk_sess_` |
| GAP-25 | 全局锁串行化 vs 10,000 TPS 目标 | 🟠 P1 | 🟠 | **保留、不阻塞**；须先写基准测试量化（`ADR-004`，见 §3.7） |
| GAP-26 | perp 未部署 / 未接线 / 无 Bot | 🔴 P0 | 🟠 | 部分：接链层 + 价格层 + **Bot 装配** + **观测端点**已落地（`022`+`023`+`024`+`025`）；见 §3 |
| GAP-27 | 逐块资金费率未实现（赛道靶心） | 🟠 P1 | ✅ | 本分支 |
| GAP-28 | 双 lockfile，`npm ci` 装过期树 | 🟡 P2 | ✅ | 前提已消失（`docs/changes/020`） |
| GAP-29 | 缺 `deploy/` 目录 | 🟡 P2 | ✅ | `docs/changes/019` |
| GAP-30 | Redis 额度池 | 🟡 P2 | ⬜ | 需先修 GAP-18~21 |
| GAP-31 | 规划文档在仓库外，协作者看不到 | 🟡 P2 | ✅ | `df227bf`（`docs/planning/`） |
| GAP-32 | 覆盖率阈值未配 | 🟡 P2 | ✅ | `506c4ef`（合约侧；前端见 GAP-33） |
| GAP-33 | 前端覆盖率未配 | 🟡 P2 | ✅ | 见 §3.2 |
| GAP-34 | `closePosition` 破坏冻结后未重新冻结 | 🟠 P1 | ✅ | 见 §3.1 |
| GAP-35 | 全库行尾未重规范化（CRLF/LF 混用） | 🟡 P2 | ✅ | 见 §3.3（**推迟理由不成立**） |
| GAP-36 | `.gitignore` 的 `ignition/deployments/` 管不到 `contracts/` 下 → 部署产物误入库 | 🟠 P1 | ✅ | 见 §3.4 |
| GAP-37 | 面板同时显示两条口径的清算状态（一条含资金费、一条不含） | 🟠 P1 | ✅ | 见 §3.6（`docs/changes/021`） |
| GAP-38 | WS 断线重连 + `lastProcessedBlock` 水位持久化（ADR-005 §5.3 P1） | 🟠 P1 | ✅ | 见 §5.2（`docs/changes/024`） |
| GAP-39 | Hermes 生产路径：流式 tick / staleness 边界 / 批量更新 / 置信区间 | 🟡 P2 | 🟠 | 见 §5.3（`docs/changes/023`） |
| GAP-40 | 本地链端到端集成验证（Bot 提交 `liquidate` 回执）未跑 | 🟠 P1 | 🟠 | 见 §5.4（`docs/changes/024`） |
| GAP-41 | Bot 镜像不含资金费 → 低估可清算集合 | 🟠 P1 | ✅ | 见 §5.5（`docs/changes/026`；残余：链上对拍 / 投影指数） |
| GAP-42 | 清算观测 `exit_price` 为判定价、`reward`/`block_number` 恒 NULL | 🟡 P2 | 🟠 | 见 §5.6（`docs/changes/025`） |

> **编号跳号说明（合并后已消解）**：**GAP-38~42 原不在 PR #12 侧**——它们登记在
> `feat/liquidation-bot-chain`（PR #11）上，故 PR #12 侧新号从 **GAP-43** 起，中间的空档不是遗漏。
> **本次合并把两边 §1 行序都保留**（GAP-38~42 与 GAP-43~50 各自成块、连续成表），
> 按原注「合并方需两边都保留」执行；编号区间本就错开，**未重排任何既有行**。

| **GAP-43** | `settlement_ledger` 复式记账未建（无表、无代码） | 🟡 P2 | ✅ | `docs/changes/039`——表 + 校验层 + 借贷平的断言判据均已落。**迁移未在真实 PG 上执行**，见 GAP-60 |
| **GAP-44** | ZK Verifier 抽象插槽不存在（`backend/internal/verifier/` 无此目录） | 🟡 P2 | ✅ | `docs/changes/039`——接口 + no-op + 调用点（`POST /api/v1/verifier/verify`）齐 |
| **GAP-45** | 清算结果大屏未接（`GET /api/v1/liquidations` 不存在） | 🟠 P1 | 🔴 | 见 §5.1；**阻塞于 GAP-26**（Bot 未接链、未部署） |
| **GAP-46** | 信任证明未落链（`addTrust` 手填 proof，不消费 Steam/GitHub 证明） | 🟠 P1 | 🟠 | 见 §5.1 |
| **GAP-47** | Steam / GitHub 证明不落库（Go 侧只进 `MemoryStore`） | 🟠 P1 | 🟠 | 见 §5.1 |
| **GAP-48** | 授信额度纯装饰（各层硬编码，无链上 credit engine） | 🟠 P1 | 🟠 | 见 §5.1 |
| **GAP-49** | 无 Supabase 时 DB 层静默降级内存态 | 🟠 P1 | ✅ | `docs/changes/039`——`New` 返回错误、`main` 非零退出、落盘路由 `withDB` 守卫返回 503 |
| **GAP-50** | 资金费**收费侧**（费率取负）无链上对拍 | 🟡 P2 | 🟠 | 见 §5（`docs/changes/021`「未做（明确）」） |
| **GAP-51** | 核心问题区字体浅色低对比与毛玻璃背景缺乏自主波纹动效 | 🟢 P3 | ✅ | 见 `docs/changes/030-GAP51-文字深色化与背景自动波动.md`；文字深色化与背景自主波纹闭环（**`upstream/main` 侧登记**） |
| **GAP-52** | **前端 `src/app/api/market/route.ts` 仍在本地生成行情序列**（`synthetic_curated` / `synthetic_fallback` / `FALLBACK_MARKET_DATA` 硬编码常量）；且 `MarketTerminal.tsx` 把账户与订单写死 | 🟠 P1 | ✅ | **✅ 关闭**（`docs/changes/028`，issue #14/#16 前端侧）：路由改为**纯代理**（无生成器、无兜底表），数据源＝后端 `/api/v1/market/{prices,movers,health}`；账户/订单/跑马灯去硬编码；`/api/v1/market/movers` 排行已在 market 页呈现。**回归守卫**：`tests/market-no-synthetic.test.ts` |
| **GAP-53** | **GitHub 探测与业务共用同一匿名配额**（60 次/小时）；`/health` 探针已加 20s 缓存压低消耗，但 CI/多实例下仍可能相互挤压 | 🟡 P2 | 🟠 | 见 `docs/changes/027` §未做；正解是 `GITHUB_TOKEN` 或探测独立配额 |
| **GAP-54** | **market 页之外仍有多处「合成数据以实时形态呈现」**（与 GAP-14/GAP-52 同族，**审计报告 `U-5` 当时只是线索，本轮实测确认**）：`EnergyCoreHero.tsx:26/31` 把 `liveTps` 初始化成 `10032` 并每 1.2s 用 `Math.random()` 在 10015~10060 间抖动，而 `lib/api.ts` 的 `fetchBackendStats` 已能取真实 TPS；`AgentCardTerminal.tsx:372-373` 伪造 `slot` 与 `txHash`；`DeveloperConsole.tsx:394/509/526/551/561` 伪造 `simulatedTx` / `payment_id` / `agent_id` / `sessKey`；`IdentityCard.tsx:167` 用 `Math.random()` 造 `ipfs://` metadataHash；`lib/audit.ts:110/117/118` 兜底造 `order_hash`/`tx_hash` | 🟠 P1 | ⬜ | **本轮未修**（超出 #14/#16 范围，且各条需要接不同真实源：链上 / Stripe / AgentCard API）。**注意**：`CursorTrail`/`HeroGsap`/`EnergyCoreBackdrop` 的 `Math.random()` 是**粒子动画**，属正当用途，**不在本项内**（实测区分，避免误伤） |
| **GAP-57** | `README.md` / `README_zh.md` 三重漂移：**幻影文件** + **读数与仓库实测不符** + **过度声称** | 🟠 P1 | 🟠 | 见 §5.7（对外第一眼即失效，未修） |
| **GAP-58** | 已部署合约地址未登记进 `docs/changes/`，无 provenance | 🟡 P2 | 🟠 | 见 §5.7 |
| **GAP-59** | `docs/benchmarks/benchmark_report.md` 的 "Observations" 与同文件数据表**相反** | 🟡 P2 | 🟠 | 见 §5.7 |
| **GAP-60** | `005_settlement_ledger.sql` **未在真实 PostgreSQL 上执行过** | 🟠 P1 | 🔴 | **阻塞于环境**：本机无 docker、无 psql、无 DB 凭据。见 §5.8（**W1 侧登记；编号已顺延两次：51 → 57 → 60**，见下方裁决） |
| **GAP-61** | `sanitizeDSNError` 残余暴露：既非 URL userinfo、又非 `password=` 锚点的口令回显不被脱敏 | 🟡 P2 | 🟠 | 见 §5.8（另：全库 Go 源码存在**既存** gofmt 债务，CI 不跑 gofmt）· **W1 侧登记；编号已顺延两次：52 → 57 → 61** |
| **GAP-62** | `docs/changes/` 仍有 `027` / `028` 两个前缀**各两份**（上游横向合流带入、**非本轮引入**；git **不因文件名前缀相同而报冲突**，故静默） | 🟡 P2 | 🟠 | 见 `docs/changes/043` §2。**本轮只登记未修**——要动上游既有文件命名，需先定口径 |
| **GAP-63** | `deploy/README.md:96` 的 `docs/changes/027` 是**悬空指针**（W1 侧引入；`027→035→039` 两次让位后失效） | 🟡 P2 | 🟠 | 见 `docs/changes/043` §2（首轮已登记，见 `docs/changes/041` §3.2 末条）。**改 `deploy/`，不在 `ssot-scribe` 作用域** |
| **GAP-64** | `docs/planning/README.md` 的变更索引止于 `031`，未含 `032`~`041` | 🟡 P2 | 🟠 | 见 `docs/changes/043` §2。该文件**在 `docs/` 内、可直接派 `ssot-scribe`**，但**不属于本轮分派**，故先登记 |
| **GAP-65** | `cmd/api` 的**启动 fail-fast（GAP-49 的核心）无任何自动化判据** —— 变异回静默内存降级后**全套仍绿** | 🟠 P1 | 🟠 | 见 §5.9（**本轮独立实测复核**，非转述）；`cmd/api` 至今**没有测试文件** |
| **GAP-66** | `005` 触发器**允收自带 `ledger_seq`**（与自身注释矛盾），且产出的 `balance_after` **会被本仓 `CheckEntries` 拒收** | 🟠 P1 | 🟠 | 见 §5.9。**Go 侧已实测**（`ErrBalanceAfterMismatch: stored 7, replayed 10`）；**PG 侧未实测**，阻塞于 **GAP-60** |
| **GAP-67** | DDL `NUMERIC(36,18)` **静默舍入** vs Go `ParseAmount` **拒收** 19 位小数 —— 两道门对同一字面量给出不同答案 | 🟡 P2 | 🟠 | 见 §5.9。Go 侧已实测；**PG 舍入未实测**（GAP-60） |
| **GAP-68** | `user_address` **不参与任何不变量**：无格式 CHECK、无 FK、余额作用域不含它（Go 侧同样只查非空） | 🟡 P2 | 🟠 | 见 §5.9。**是口径决策**（归属 vs 标注），非 bug |
| **GAP-69** | `settlement_ledger` **无 UPDATE/DELETE 守卫**（RLS 只挡 `anon`，应用是 owner），**且无运行判据读回审计** | 🟡 P2 | 🟠 | 见 §5.9。「只可追加」目前只是**命名**，不是约束；守卫与判据**两样都缺** |
| **GAP-70** | qa 路由清单**无「路由 → 清单」反向对拍** —— **新增路由会静默免测** | 🟡 P2 | 🟠 | 见 §5.9。**刚发生过一次**：`/api/v1/developer/keys` 就住在缝里（`docs/changes/045` §3.1） |
| **GAP-71** | `IsConnected` **运行期不会被翻 false** —— 断连后 `withDB` 放行，答 500 而非 503+`Retry-After` | 🟡 P2 | 🟠 | 见 §5.9。`withDB` 的第二道检查**恒不成立**；已有一条用例在守一个**不可能发生的状态** |

> **⚠️ 编号撞车与重编裁决（2026-10-11 首轮合并，2026-10-12 二次重编）**（D4）：
> W1 分支与 `upstream/main` **各自**把新缺口登记为 GAP-51 / GAP-52，**双方在本合并前各自都是对的**
> （登记前检索各自零命中），**合并后才产生同号两义**。按本项目口径「**登记前先检索、撞车比漏登记更糟**」，
> **本合并一次重编到位**，不留待后续。**但这一"到位"只对当次合并成立**——见下条。
>
> **第一轮（2026-10-11，合并 `1f5f007` 时）**，W1 侧让号 `GAP-51 → 57` · `GAP-52 → 58`：
>
> | 原（W1 分支） | 首轮重编为 | 内容 | 保留者 |
> | --- | --- | --- | --- |
> | GAP-51 | GAP-57 | `005_settlement_ledger.sql` 未在真实 PG 上执行过（🔴） | W1 |
> | GAP-52 | GAP-58 | `sanitizeDSNError` 残余暴露（🟠） | W1 |
> | GAP-51 | **GAP-51（不变）** | 前端字体/波纹动效（✅） | `upstream/main` |
> | GAP-52 | **GAP-52（不变）** | 前端 `/api/market` 合成行情（✅） | `upstream/main` |
>
> **⚠️ 首轮的重编只解决了当次合并——它又被下一次上游推进撞毁了（第二次显形）**：
> `upstream/main` 随后并入 **PR #20（`docs/consistency`）**，该分支**独立**新开了 **`GAP-57/58/59`**
> （README 三重漂移 / 地址 provenance / 基准报告 Observations 与数据表相反，见 §5.7）。
> 与 W1 的 `GAP-57/58` **再次同号两义**。**同号两义在合并后再次出现，且成因完全相同**
> ——两条线各自从当时的最大号 +1 取号，谁也看不到对方。
>
> **第二轮（2026-10-12，合并 `535214b` 时）：W1 侧再次让号**，因为
> **`upstream/main` 是最先并入的那一侧（先合并者），且 `GAP-57/58/59` 已随 PR #20 落定**：
>
> | 原（W1 分支） | 二次重编为 | 内容 |
> | --- | --- | --- |
> | GAP-57 | **GAP-60** | `005_settlement_ledger.sql` 未在真实 PG 上执行过（🔴） |
> | GAP-58 | **GAP-61** | `sanitizeDSNError` 残余暴露（🟠） |
>
> **取号口径（D4 / `AGENTS.md` §6.1）**：**全分支并集**复核——
> `git log --all -p -- docs/` 的 `GAP-\d+` 并集与 `--all --name-only` 的 `docs/changes/` 并集，
> **最大号均为 `GAP-59`**，故 **`GAP-60` / `GAP-61` 为下一对可用号**（实测，非推断）；
> **`GAP-55 / GAP-56` 仍未被占用**（它们在未合并分支 `feat/real-alpaca-data` 的 `docs/changes/029` 里被**提议**，
> 但**从未进本台账**，故不构成占用——**本文件是唯一台账**）。
> **本仓任何分支若出现 `GAP-55~59`，合并时须再行检索**（D4）。
>
> **首轮 57/58 的取号理由"不新占号（取代 55/56）"已被本轮推翻**：59 号已由 PR #20 用掉，
> 故本轮 **实际新占 60/61 两号**，不再有"不新占号"之说。
>
> 全套重编落在：本文件（§1 两行、§5 表两行、§5.8 两节正文与标题、§5 末注、§7 表一行）、
> `docs/changes/039`（原 `035`，5 处）、`docs/changes/040`（原 `036`，2 处）。
> 首轮合并本身见 **`docs/changes/041`**（原 `038`；**历史快照**，其正文按纪律不改写，
> 顶部已加号映射；读者若在其中读到 `035`/`036`/`038`/`GAP-57`/`GAP-58`，那是**首轮当时的号**）。
> **本轮（第二轮）合并与其完整重编映射见 `docs/changes/042`。**

---

## 2. 已修复项的验证方式（回归基线）

这些**不要删**。它们是"曾经真实坏过"的证据。

### GAP-01~05 + GAP-17 → `contracts/test/perp/SolvencyGuards.ts`（8 条）

其中 **6 条在修复前实测为红**（另 2 条是控制组）：

| 用例 | 修复前失败原因 |
| --- | --- |
| LP 不能抽干池子（PROBE-F） | `reserve 999e18 must cover the obligation 2197.8e18` |
| 容量不足拒绝开仓（PROBE2） | `Missing expected rejection` |
| 权益截断为 0 USDC 仍能平仓（PROBE-A） | `writeContract` revert |
| 超上限利润封顶而非卡死 | `a payout cap must exist` |
| 单笔不污染整批（PROBE-C） | revert 于 `PositionManager.sol:276` |
| 破产头寸仍有赏金 | `got 0` |

**验证命令**：
```powershell
cd contracts; npx hardhat test test/perp/SolvencyGuards.ts   # 期望 8 passing
```

### GAP-27 → `contracts/test/perp/Funding.ts`（18 条）

核心一条：`can push a position through its maintenance margin on its own` ——
50x 多单、**价格完全不动**，1,500 块后仅凭持仓成本跌破维持保证金。

**验证命令**：
```powershell
cd contracts; npx hardhat test test/perp/Funding.ts          # 期望 18 passing
```

### GAP-10 → `.github/workflows/ci.yml`

三个 job（contracts / frontend / backend），135 个合约用例 + 23 个 vitest + Go 全部入矩阵。

**验证命令**：
```powershell
Test-Path .github/workflows/ci.yml    # 期望 True
```

> ⚠️ **workflow 本身尚未在 GitHub Actions 上跑过**（本地只验证了它调用的每条命令）。
> 首次真实运行才能确认，尤其 `forge-std` 从 GitHub 拉取这一步。
> **另需在仓库设置里手动开启分支保护（required check）**，无法用代码提交完成。

---

## 3. 🔴 有明确阻塞的未竟项

### GAP-16 / GAP-26：perp 模块的交付缺口

`docs/项目目标.md` 要求的五件事，逐项现状：

| 目标要求 | 现状 | 阻塞 |
| --- | --- | --- |
| `Vault.sol` / `PositionManager.sol` | ✅ 已实现，138 用例通过 | — |
| Pyth 拉取式预言机 | ✅ `PythOracleAdapter` 已实现；**美股 feed 在 Monad 上不可用**（`执行方案-后端与合约.md:29-46` 实测） | 外部事实，非缺陷 |
| 前端交易面板 | ✅ `/perp` 页面 + `PositionPanel`，读链不读 mock | — |
| **Go 清算 Bot** | 🟠 **核心已做**（`internal/perp/{position,nonce}`）；**接链层已做**（`internal/chain`，`022`）；**价格层已做**（`internal/oracle`，`023`）；**交易发送 + `cmd/liquidator` 装配已做**（`internal/liquidator`，16 测试 `-race` 通过，`024`） | ⛔ **端到端回执**需本地链集成（GAP-40）+ 已部署的 `PositionManager` 地址 |
| **链上部署** | 🔴 **未做** | ⛔ **需要 `PRIVATE_KEY` + Monad 测试币** |
| `GET /api/v1/liquidations` | ✅ 已做（`docs/changes/025`） | — |

**为什么接链部分没写**：写了也无法验证，只会变成"看起来完成了"的代码。
按 `提示词.md` 纪律 §1「读到才算，严禁推断」，**在能跑通之前不写**。

**解除阻塞后要做的**（命令已备好）：

```powershell
cd contracts
npx hardhat ignition deploy ignition/modules/PerpStack.ts --network monadTestnet
npx hardhat run scripts/demo-seed.ts --network monadTestnet
# 把输出的 4 个地址填入根 .env.local
```

然后才轮到：`eth_getLogs` 回填 → WebSocket 订阅 → `abigen` 绑定 → `cmd/liquidator/main.go`。

> **注意**：在地址配置前，`/perp` 页面会显示"Perp 模块未配置"提示。
> **这是设计行为，不是 bug** —— 面板拒绝显示任何数字，因为没有真实数据可显示。

### GAP-12：凭证硬编码

6 处：`config.go:38-44`、`render.yaml:17-28`、`README.md:16-33`、
`src/app/api/auth/github/exchange/route.ts:29,33`。

**阻塞**：轮换密钥需要外部后台操作（Steam / Alpaca / Stripe / GitHub），无法用代码完成。

**已完成的部分**（`50c51d8`）：`README.md` 的明文凭证已移除，改为环境变量清单表。
**但 git 历史无法清理**，所以泄露已成事实，**必须轮换**。

**建议顺序**（不可颠倒）：
1. 轮换四组密钥（**外部操作**）
2. 再改 `config.go` / `render.yaml`，把默认值改为空串（缺失即启动失败）
3. 最后处理 `exchange/route.ts` 的 OAuth secret fallback

顺序颠倒会得到"用一个缺失的配置换掉了一个已泄露的密钥"，服务直接挂。

---

### 3.1 GAP-34：`closePosition` 破坏冻结后未重新冻结

`推进方案.md:40` 把 `closePosition(uint256, bytes[])` 定为**冻结接口**，
目的是让前端与 Go Bot 能并行开发。

GAP-07 加了 `minOutUsd` 与 `deadline`（`c7da777`），**冻结被破坏**。

**核查过的代价**（所以是可接受的）：
- 消费方只有本仓库的测试与前端面板，均已同批更新；
- Go Bot 的接链部分不存在（GAP-26）；
- **perp 模块从未部署**（`deployed_addresses.json` 只有身份合约）。

**未竟**：接口现在处于"**已破冻结、未重新冻结**"的状态。
`IPositionManager.sol` 的 natspec 已写明这一点，并警告消费方"预期它还会变"。

**已完成**（`docs/changes/017`）：接口已按现在的签名**重新冻结**，`推进方案.md:34-37` 已对齐实际签名，`IPositionManager.sol` 文件头新增**权威冻结清单**
（20 函数 + 5 事件，并注明「与规划文档冲突时以本清单为准」），并由 `contracts/test/perp/FrozenSurface.ts` **机械守住**（含变异测试）。

**消费方现在可以按该接口并行开发。** 但注意：模块**仍未部署**，这是对接口形状的承诺，不是「地址已存在」。

---

### 3.2 GAP-33：前端覆盖率门禁（已关闭）

合约侧的地板在 `007` 配好，前端侧一直空着。现已配上（`docs/changes/011`）。

**关键发现：`70.35%` 是个假象**。v8 不加 `include` 时**只统计被测试 import 过的文件**——
实测全树只有 226 行参与统计。这意味着**新增一个谁都没 import 的组件，数字一点都不会降**，
门禁会长期全绿而生产代码在无人测量地增长。加 `include: ['src/**']` 后真相是 **7.89% / 2015 行**。

**范围决策**：两个极端都不可用（全树 7.89% 只说明"demo 外壳没测试"，已知且非门禁职责），
故门禁范围取 **perp 逻辑核心** `src/lib/perp.ts` + `perpConfig.ts`，**对齐合约侧
`INCLUDED_PREFIXES` 的同样做法**（那边也只门禁 perp 模块，不是全树）。

| 指标 | 实测 | 阈值 |
| --- | --- | --- |
| Lines | 76.74% | **72** |
| Branches | 60% | **55** |

**刻意低于实测**——贴着实测值定的地板会在下一次无关重构时变红、然后被赶时间的人删掉
（`check-coverage.ts` 的注释里有这条教训的原始出处）。v8 有 branch 数据，故 branches 一并门禁
（合约侧因 Hardhat 不输出 `BRDA` 只能门禁 lines）。

**范围有意留窄**：`PositionPanel.tsx`(659 行)、`/perp` 路由、`api/market` 均不在内。
它们确实无测试，但拉进来只会得到 25% 的地板、抓不住任何东西。
**要覆盖 UI，正确做法是先补组件测试再纳入，而不是先降阈值。**

**CI 侧的关键点**：`coverage.thresholds` **只在采集覆盖率时生效**，故 CI 的
`npx vitest run` 已改为 `npx vitest run --coverage`——否则配置里的地板在 CI 上根本不生效，
本地绿 CI 也绿，而门禁从未运行。

**负向证伪（已实跑）**：往 `perp.ts` 追加约 20 行无覆盖代码 →
Lines 76.74%→**68.04%**、Branches 60%→**50.76%**，**两条阈值同时报错，exit=1**；工作区已还原。

---

### 3.3 GAP-35：全库行尾未重规范化

**问题**：`.gitattributes` 是本次才加的（`f6ec42d`），此前仓库对行尾没有任何约束，
Windows 工作树是 CRLF、CI 是 LF。

**已经造成的实际伤害**：覆盖率门禁的阈值**基于本机的 CRLF 读数**定成了 93%，
而 CI 在 LF 下读到 89.22% —— **首次真实 CI 运行因此失败**。
详见 `docs/changes/007-覆盖率门禁.md`。

**已修的部分**：`.gitattributes` 把 `*.sol` / `*.ts` 等固定为 `eol=lf`，
**只对后续**检出生效；覆盖率阈值改以 LF 口径为准（88%）。

**未做的部分**：现有文件在工作树里仍是 CRLF。重规范化需要
`git add --renormalize . && git checkout -- .`，会在这个已经很宽的 PR 里
**混入成千上万行行尾噪声，使真正的改动无法评审**。因此留给独立的小 PR。

**风险**：任何在旧 Windows 检出上做覆盖率读数的人仍会读到偏高约 5 个点的值。
脚本注释已写明这一点。

---

### 3.4 GAP-36：`.gitignore` 规则作用于错误的路径层级（2026-10-08 新发现，已修）

> **与 GAP-16 的关系（重要）**：`contracts/lib/perpConfig.ts` 这个幻影路径**不是新发现**。
> `缺陷分析-审计报告.md` 的 **S-6** 早已识别它（`触发 GAP-16`），本台账 §3 的 GAP-16 亦已覆盖。
> 建立框架时我一度把它登记成 **GAP-37**，**经逐行核对后撤销**——那是重复编号，
> 正是纪律 D4 要消灭的漂移。**教训：登记新缺口前必须 `git grep` 全仓检索是否已被识别；
> 与既有编号撞车比漏登记更糟。**

**GAP-36 — `.gitignore` 里这条规则从未命中过**

`.gitignore` 写的是 `ignition/deployments/`，**带内部斜杠且无前导 `**/`**，因此它是**根锚定**模式，
只匹配仓库根下的 `ignition/deployments/`。而 ignition 的实际输出在 `contracts/ignition/deployments/`，
**规则从未命中**，3 个部署产物已被提交：

```
$ git check-ignore -v --no-index contracts/ignition/deployments/chain-10143/deployed_addresses.json
(exit=1，无输出 = 未命中)

$ git ls-files | grep ignition/deployments
contracts/ignition/deployments/chain-10143/build-info/solc-0_8_31-*.json
contracts/ignition/deployments/chain-10143/deployed_addresses.json
contracts/ignition/deployments/chain-10143/journal.jsonl
```

**为什么 `artifacts/` 没同样出问题**（同文件、同区域，却是对的）：
`artifacts/` / `cache/` / `typechain/` **没有内部斜杠**，按 gitignore 规则可在**任意层级**匹配，
所以它们对 `contracts/` 下同样生效。**只有 `ignition/deployments/` 这一条因为多了个斜杠而失效。**
这正是"看起来一视同仁的清单里藏了一条特例"。

> ⚠️ **`check-ignore` 的陷阱**：对**已入库**的文件，`git check-ignore -v <path>` 也返回 exit=1
> （即使规则本应忽略它），因为 git 跳过已跟踪文件。判定规则是否命中**必须加 `--no-index`**，
> 否则会把 GAP-36 误判成"规则没问题"。

**取消跟踪不丢信息**：身份合约地址已另有 4 处记录（`README.md:51`、`src/lib/contract.ts:31`、
`docs/planning/推进方案.md:18`、`docs/planning/执行方案-自治Agent清结算.md:193`），
且 CI 不部署、代码零引用（`git grep` 实测）。

**解除条件**：根 `.gitignore` 的 `ignition/deployments/` → `**/ignition/deployments/`，
再 `git rm --cached -r contracts/ignition/deployments`。

---

### 3.5 GAP-16 幻影路径 —— 已修，并纠正 S-6 的误判范围（2026-10-08）

**现状**：`contracts/lib/perpConfig.ts` 这个幻影路径在**活跃文档中已清零**（`git grep` 实测）。

| 文件 | 状态 |
| --- | --- |
| `docs/planning/推进方案.md:41` | ✅ 已改指 `src/lib/perpConfig.ts` |
| `docs/planning/推进方案.md:133` | ✅ 同上 |
| `docs/planning/执行方案-后端与合约.md:151` | ✅ 同上（S-6 **漏列**了这处） |
| `src/lib/perp.ts:4` | ✅ 注释改为 `./perpConfig`（与 `:33` 的实际 `from "./perpConfig"` 一致） |

**⚠️ S-6 的待改清单里有 2 处不该改 —— 这是对审计报告本身的纠正**：

S-6 把 `docs/执行记录-Phase0.md:205-207, 272` 列为"应改为 `src/lib/perpConfig.ts`"。**这是误判**：

- `执行记录-Phase0.md:205` 是**历史叙事**——「写共享常量时，我**最初**放在 `contracts/lib/perpConfig.ts`（因为 `推进方案.md` 第 41 行就是这么写的），前端反向导入」。
  **它描述的正是当初放错、随后发现并迁走的过程**。把它改成 `src/` 会**抹掉问题本身**，让这条记录失去意义。
- `:223` 同理，是"问题 2"里**回放的错误代码片段**。
- `:272` 是那次提交的**文件清单**，`src/lib/perpConfig.ts` 本就正确。

**结论**：历史记录与审计快照**不改**。修文档时"活跃方案"与"历史留痕"必须区分——
**前者是待执行指令，后者是既有事实**。把历史改成现状，等于篡改证据链。
（`docs/planning/缺陷分析-审计报告.md` 本身亦然：它是**时点审计结论**，
其 `:368` 的「不存在」当时为真，不改；仅**未竟清单**的条目按本节结论视为已了结。）

> **另：`GAP-34` 的错误指针已顺带修正**。`GAP-34` 引用「`推进方案.md:40`」指代接口冻结，
> 但实测 `:40` 是「部署 `MockUSDC` + `DemoOracle`」，接口冻结描述在 **`:34-37`**。
> `git show 8f69995:docs/planning/推进方案.md` 证实**引入 GAP-34 的那个提交里 `:40` 就已经是这行**，
> 即该指针**自始即错**、非文档后续漂移。本文件 `:197` 与 `:331` 已改为 `:34-37`。

---

**常量 SSOT 的正确表述**（供各 Agent 统一口径）：

| 角色 | 文件 | 说明 |
| --- | --- | --- |
| 链上编译期消费者 | `contracts/contracts/perp/PerpConstants.sol` | 定义 fee/margin/leverage bps |
| 链下消费者 SSOT | `src/lib/perpConfig.ts` | **镜像**上者；Pyth feedId 只在此定义 |
| **最终裁决者** | 部署实例的 `IPositionManager` getter 读回值 | 唯一不会过期的口径 |

---

### 3.6 GAP-06 已关闭；并发现 GAP-37（面板的两条清算口径）

**GAP-06 关闭**（`docs/changes/015`）。原判「需要链上部署」**是错的**——一致性在进程内
hardhat 链上即可验证。做法是**黄金向量**：前端算出 60 条强平价落成文件，
合约测试读同一份文件在链上重放，两侧任一漂移都会失败。

**验证结论**：前端注释声称的「bit-for-bit 一致」**成立**（资金费为零的口径下，60 条全部对上边界）。

**变异测试证明判据有牙齿**：给多头分支注入 1% 偏差 → 前端对拍变红；
即使用 `UPDATE_VECTORS=1` 重新生成向量把前端测试"洗白"，**合约对拍仍然抓住**
（`chain says NOT liquidatable`）。两侧各司其职，一条都不能少。

> **另一处判断修正**：GAP-06 与 GAP-34 的「需要链上部署」阻塞是**误判**。
> 合约逻辑的验证从来不需要部署到任何网络——hardhat 进程内链即可。

---

**新发现 GAP-37 —— 面板上并排显示两个不同口径的数字**

实测 `src/components/PositionPanel.tsx`：

| 位置 | 数据 | 口径 |
| --- | --- | --- |
| `:236` `liquidatable` | **读链上** `isLiquidatable` | **含**资金费（合约判定） |
| `:260` `liqPrice` | **本地算** `liquidationPrice()` | **不含**资金费（只有价格公式） |

**后果**：有持仓且资金费非零时，面板可能出现「显示为未达清算、但链上已判定可清算」
——**同一屏上两个数字互相矛盾**。这正是 `推进方案.md` 风险表所说「可信度崩」的另一种形态。

**且 `:258-259` 的注释原先是失实的**：它称该值「由 `tests/perp.test.ts` 保障」，
而那个文件的往返断言是**资金费盲**的（本地自洽、抓不到此偏离）。注释已改为指向
`LiquidationParity.ts` 并写明资金费这一保留项。

**已修**（2026-10-09，`docs/changes/021`）：**产品决策为「两个口径都保留、各自标清」**。

- `src/lib/perp.ts` 新增 `liquidationPriceWithFunding()`；`liquidationPrice()` 改为**其资金费为零的特例**，
  故二者**结构上无法漂移**，GAP-06 的 60 条向量**顺带**保护了这条不变量。
- 面板：「预估强平价」→「强平价（纯价格）」，并新增「强平价（含资金费）」，网格 4 列 → 5 列。
- **并给资金费项补上跨边界对拍**（此前完全没有）：`tests/liquidation-funding-parity.test.ts`（前端）+
  `contracts/test/perp/FundingLiquidationParity.ts`（合约），48 条向量。

> **为何必须补对拍**：`docs/changes/015` 的合约对拍**刻意把资金费率设为 0**，且它自己记下
> `tests/perp.test.ts` 的往返断言是**资金费盲且自洽**的。故资金费项**既无链上对拍、又只有自洽测试**——
> 只加公式不加对拍，等于上一个**没有验证的财务公式**（D3）。
>
> **证伪记录**：丢弃资金费项后，前端对拍红；**但合约对拍仍绿**——因为合约侧的输入是**向量文件**、不是 `perp.ts`。
> 必须**连同向量一起重生成**才红（已实测）。这说明两道门**互相独立，只跑一道会漏**。

---

### 3.7 GAP-25 的 §1 标注与 §4 裁决相矛盾（2026-10-09 发现并修正）

**发现**：同一个文件里，GAP-25 有三处口径，其中两处**语义相反**：

| 位置 | 标注 | 含义 |
| --- | --- | --- |
| **§1 状态总览** | `⬜` | 按 §1 图例 = 「**明确不做**（有理由）」 |
| **§4（ADR-004 裁决表）** | 「**保留、不阻塞**……需先写基准测试量化」 | 保留 = **不是**不做 |
| **§5（无阻塞但未做）** | 「`agentcard` 全局锁 → 需先写基准测试量化，**1 天**」 | **可直接开工** |

**权威源是 §4**：它引 `ADR-004` 的原文裁决——
「**保留、不阻塞**：需先写基准测试量化，再见真章。10,000 TPS 的**叙事目标已放弃**」。

**修正**（只改 §1 的标注，**未动 §4 与 §5**——它们与 `ADR-004` 一致，是对的）：

- §1 中 GAP-25 的 `⬜` → **`🟠`**；理由列由「无基准测试」改为
  「**保留、不阻塞**；须先写基准测试量化（`ADR-004`）」。
- 依据：`ADR-004` 说「保留」→ 故**不是**「明确不做」；说「不阻塞」→ 故按 §1 图例是 **🟠**（未修复、无阻塞）。

> **教训（并入 D4 口径）**：**同一份台账内、相隔三百行的两处标注也能互相矛盾**。
> §1 状态总览是**派生视图**；改它时必须回头核对**裁决正文**，而不是照着上一版总览改。
> 这与 D4「禁止两处不同成熟度的事实」是同一类缺陷——只是这次两处**在同一个文件里**。

---

## 4. RFC-001 相关项（GAP-18~25）—— **已由 `ADR-004` 裁决**

> ✅ **本节四个悬置项（GAP-22~25）原标"需要谁决策：架构"，现已裁决**（`docs/adr/ADR-004`，2026-10-08）。
> **结论：不按 RFC-001 原样落地**，RFC 降格为**输入材料**。

| GAP | 冲突 | **裁决（ADR-004）** |
| --- | --- | --- |
| GAP-22 | RFC 把"从零建委托系统"当前提，但 `backend/internal/agentcard` 已有约 70% 的 P0（限额/日限/白名单/冻结/批次归集） | **复用 `agentcard`，并排新建 = 不做**（D3）。消除新增第二套委托系统的风险 |
| GAP-23 | RFC 要求 Redis + gRPC + proto + Docker；仓库只有 `net/http` + pgx。且 RFC 内部 4 处自相矛盾 | **三者均不采纳**（D2）。额度预扣若确需，先用已有 PG 事务（`SELECT ... FOR UPDATE`） |
| GAP-24 | 三套 Session Key 模型（`sk_sess_` 字符串 / PG 地址 / EIP-712）互不兼容，**无代码把内存态写入 PG** | **部分进展**（`docs/changes/013`）：EIP-712 模型**已落链上**（`SessionKeyRegistry.sol`）并有 `viem` 摘要互操作测试。**但 Go 侧 `agentcard` 仍用 `sk_sess_` bearer 字符串**（`permission_guard.go:46`），未升级。接上需 Go 侧引入 `go-ethereum` 或最小 secp256k1 依赖——**重依赖，需先决策**（与 `ADR-001` 同源） |
| GAP-25 | `agentcard/service.go:95` 全程持全局锁 → 所有用户授权全局串行化；RFC 要 10,000 TPS | **保留、不阻塞**（§4 后果）：需先写基准测试量化，再见真章。10,000 TPS 的**叙事目标已放弃**——6 天内没有评委能验证 TPS |

**GAP-18~21（RFC 的 Lua 脚本缺陷）** 已实测复现（重复预扣致资金卡死、TTL 丢账、浮点漂移 5e-12、`daily_spent` 永不重置）。
**本次不采纳 Redis，故这四条不激活**（D2）；若将来采纳，**必须先修**——
修正规格见 `推荐方案` §3.4 的 F-01~F-06（该节仍是有效规格，未被 ADR-004 否决）。

**RFC-001 只复用三处**（ADR-004 D1）：`settlement_ledger` DDL（§4.2.2）、
ZK Validator 空接口（§3.4）、EIP-712 授权语义（改为升级 `agentcard`）。

---

## 5. 无阻塞但未做（可直接开工）

| 编号 | 事项 | 起点 | 预估 |
| --- | --- | --- | --- |
| GAP-25 | `agentcard` 全局锁 → 需先写基准测试量化 | `backend/internal/agentcard` | 1 天 |
| GAP-13 | ~~后端接 go-ethereum，`/health` 改为真实探活~~ **探活部分 ✅**（`docs/changes/027`）；**接链部分待做**（依赖 GAP-26 的部署） | `backend/`（接链）+ `/health`（已完成） | 接链残余 1 天 |
| GAP-52 | ~~前端 `/api/market` 改真实数据源（撤掉 `synthetic_*` 生成序列与 `FALLBACK_MARKET_DATA`）+ 账户数字去硬编码~~ **✅ 已落地**（`docs/changes/028`）；残余见 §未做 | `src/app/api/market/route.ts` · `src/components/MarketTerminal.tsx` · `src/lib/api.ts` | 已用 1 天 |
| GAP-53 | GitHub 探测改用 `GITHUB_TOKEN`（现与业务共用 60/h 匿名配额） | `backend/internal/httpapi/health.go` · `backend/internal/developer/github.go` | 0.5 天 |
| GAP-54 | 前端其余组件的合成数据接真实源（`liveTps` → `fetchBackendStats` · AgentCard `slot`/`txHash` · DeveloperConsole 的 `payment_id`/`agent_id`/`sessKey` · IdentityCard 的 `metadataHash` · `audit.ts` 的 hash 兜底） | `src/components/{EnergyCoreHero,AgentCardTerminal,DeveloperConsole,IdentityCard}.tsx` · `src/lib/audit.ts` | 1.5 天 |
| GAP-39 | Hermes 生产路径：SSE/WS 流式 tick、staleness 边界（镜像 `getPriceNoOlderThan`）、批量更新、置信区间 | `backend/internal/oracle/hermes.go`（最小 REST 已就位） | 0.5 天 |
| GAP-40 | 本地链端到端集成验证（见 §5.4） | `contracts/`（`npx hardhat node` + `demo-seed.ts`）+ `cmd/liquidator` | 0.5 天 |
| GAP-41 | ~~Bot 镜像纳入资金费（见 §5.5）~~ **✅ 已落地**（`docs/changes/026`）；残余见 §5.5 文末 | `backend/internal/perp/position` + `internal/chain` | 残余 0.5 天 |
| GAP-42 | 清算观测回填权威 `exit_price`/`reward`/`block_number`（见 §5.6） | `backend/internal/chain`（`EventHandler` 增补字段）+ `internal/liquidation` | 0.5 天 |
| GAP-46 | 信任证明落链（证明哈希 → `Koliance.addTrust`） | `src/app/page.tsx` · `src/components/TrustAttestationCard.tsx` | 1 天 |
| GAP-47 | Steam / GitHub 证明落 PG（现只进 `MemoryStore`） | `backend/internal/game/service.go` · `backend/internal/developer/github.go` | 1 天 |
| GAP-48 | 授信额度口径统一（现四处硬编码且互不相同） | `src/lib/trustTier.ts` · `contracts/contracts/Koliance.sol` | 1~2 天 |
| GAP-50 | 资金费收费侧链上对拍（需两腿簿子复现 skew） | `contracts/test/perp/` · `tests/` | 0.5 天 |
| GAP-57 | `README.md` / `README_zh.md` 三重漂移（见 §5.7） | `README.md` · `README_zh.md` | 0.5 天（**口径需人先定**） |
| GAP-58 | 已部署地址补 provenance 记录（见 §5.7） | `docs/changes/` 新增一份 | 0.5 天（**需人给部署出处**） |
| GAP-59 | 基准报告的静态 Observations 与数据表脱钩（见 §5.7） | `scripts/benchmark-apis.ts:196-199` · `docs/benchmarks/benchmark_report.md` | 0.5 天 |
| **GAP-60** | `005_settlement_ledger.sql` 未在真实 PG 上执行过（见 §5.8） | `backend/migrations/005_settlement_ledger.sql` | **阻塞于环境**（需任意 PG 实例） |
| **GAP-61** | `sanitizeDSNError` 残余暴露（见 §5.8） | `backend/internal/platform/database` | 0.5 天（**需先有一条非 URL 非 keyword 的口令回显样本**） |
| **GAP-62** | `docs/changes/` 仍有 `027`/`028` 两个前缀**各两份**（上游横向合流带入，非本轮引入） | `docs/changes/`（重命名 2 份） | 0.5 天（**要动上游既有命名，需先定口径**） |
| **GAP-63** | `deploy/README.md:96` 的 `docs/changes/027` 是**悬空指针**（W1 侧引入；`027→035→039` 两次让位后失效） | `deploy/README.md:96` | 0.1 天（**改 `deploy/`，不在 `ssot-scribe` 作用域**） |
| **GAP-64** | `docs/planning/README.md` 的变更索引止于 `031`，未含 `032`~`041` | `docs/planning/README.md` | 0.3 天（**该文件在 `docs/` 内，可直接派 `ssot-scribe`**） |
| **GAP-65** | `cmd/api` 启动 fail-fast 无自动化判据（见 §5.9） | 新增 `backend/cmd/api/main_test.go`（`run(&config.Config{DATABASE_URL:""})` 必须返回 `ErrDatabaseURLRequired`） | 0.5 天 |
| **GAP-66** | `005` 触发器允收自带 `ledger_seq` + 产出的 `balance_after` 被本仓判据拒收（见 §5.9） | `backend/migrations/005_settlement_ledger.sql` | **阻塞于 GAP-60**（需真 PG；两条解除路径需人裁） |
| **GAP-67** | `NUMERIC(36,18)` 静默舍入 vs Go 拒收（见 §5.9） | 同上 | **阻塞于 GAP-60** |
| **GAP-68** | `user_address` 不参与任何不变量（见 §5.9） | 同上 + `internal/settlement/ledger.go` | **需人先裁口径**（归属 vs 标注）+ GAP-60 |
| **GAP-69** | `settlement_ledger` 无 UPDATE/DELETE 守卫、无读回审计（见 §5.9） | 同上 | **阻塞于 GAP-60**（守卫与判据须成对，只做守卫等于没做） |
| **GAP-70** | qa 路由清单无「路由 → 清单」反向对拍（见 §5.9） | `internal/httpapi/router.go`（注册形式收敛）+ `qa_degradation_test.go` | 0.5 天 |
| **GAP-71** | `IsConnected` 运行期不翻 false（见 §5.9） | `internal/platform/database/db.go` + `internal/httpapi/router.go` | 0.5 天（**需先定口径**：探活，还是删掉那道恒不成立的检查并写明） |

> **GAP-60 / GAP-61 由 §1 登记，此处一并列出自可开工清单**（W1 侧两条，编号已顺延两轮，见 §1 表后注）。
> **GAP-62 / GAP-63 / GAP-64 是 2026-10-12 二次合并 `upstream/main` 时实测发现的观测项**，
> 本轮**只登记、未修**——逐条取证见 `docs/changes/043`。三项的处置均需总控派发。

> **本节原列的三项已于 W1 关闭，移出本表**（保留在 §1 状态总览作回归基线，不删）：
> **GAP-43 / GAP-44 / GAP-49 → ✅**，依据 `docs/changes/039`。
> **GAP-43 带一个残留**：迁移**未在真实 PG 上跑过**（**GAP-60**，🔴 阻塞于环境），故"表已能建"**不等于**"表已存在"。
> **GAP-49 的口径**：`database.New` 无凭据即返回错误；`cmd/api` 非零退出；落盘路由加 `withDB` 守卫（503）。
> `health` / `stats` / `market/*` **不在**守卫内——它们的数据源不是 PostgreSQL，一并 503 会把"没有数据库"说成"服务全挂"。

> **GAP-45（清算大屏）不在此表**——它**有明确阻塞**（依赖 GAP-26 的 Bot 接链与部署），见 §5.1。

---

### 5.1 本轮补登记：`项目目标.md §5` 的 P2 与「五大核心领域」此前无编号（2026-10-11）

**为什么补**：`项目目标.md §5` 明列 P2「复式记账 `settlement_ledger` → ZK Verifier 抽象插槽」，
`ADR-004` D1 也把这两项定为「**可复用的三处之二**」，但**两者此前都没有编号**。
按本项目规矩——**不在台账里的"还没做"等于不存在**——协作者据此会以为它们已做完或压根不存在。
§1.2「五大核心领域」同理。故一次性补为 **GAP-43~49**。

**登记前已 `git grep` 全仓检索**（D4）：`settlement_ledger` / `ZK` / `Verifier` / `大屏` 的命中
**全部是 RFC 正文、`ADR-004`、`项目目标.md`、`推荐方案` 与 `docs/changes/012`、`020` 的引用**，
**无一条给出编号**；`GAP-4x` 在本分支**零命中**（见下方「编号避坑」）。

| 编号 | 标题 | 状态 | 实测依据（read-only 检索，未跑命令） |
| --- | --- | --- | --- |
| **GAP-43** | `settlement_ledger` 复式记账未建 | 🟠 | `git grep -n "settlement_ledger" -- backend/ src/` → **零命中**；`backend/migrations/001~003` 的 `CREATE TABLE` 清单为 `cards` / `card_transactions` / `session_keys` / `game_proofs` / `market_orders` / `google_accounts` / `users` / `agent_cards` / `trading_accounts` / `idempotency_keys` / `system_configs`——**无 `settlement_ledger`**。现有 `card_transactions` 是**单式**记账（RFC §4.2.2 要的是复式 `debit`/`credit`/`balance_after`）。 |
| **GAP-44** | ZK Verifier 抽象插槽不存在 | 🟠 | `git ls-files "backend/internal/verifier/*"` → **空**；RFC §4.3.1 规划的是 `internal/verifier/zk_interface.go`。`ADR-004` D1 的处置是「**只留接口**」——即**一个空接口也还没写**。 |
| **GAP-45** | 清算结果大屏未接 | 🔴 | `backend/internal/httpapi/router.go` 已注册的路由中**无 `/api/v1/liquidations`**（`git grep -n "api/v1" -- backend/` 实测）；前端 `src/components/DemoControlPanel.tsx:152` 的 `readLiquidations` 是**直接 `eth_getLogs` 读链**，不经后端。大屏滚动所需的「Bot 最近清算列表」**没有数据源**。 |
| **GAP-46** | 信任证明未落链（`addTrust` 的 proof 是**本地自造**的哈希，不消费 Steam/GitHub 证明） | 🟠 | `Koliance.sol:36` 的 `addTrust(address,string,bytes32)` 只有前端调用点 `src/app/page.tsx:299 handleAddTrust`；而 proof 的**产生处**是 `src/components/TrustAttestationCard.tsx:31` → `generateProof(rawProofText \|\| \`${account}->${toAddress}:${finalAction}:${Date.now()}\`)`（模板串在反引号里，此处转义显示）。即**链上写的是客户端自己拼的字符串的哈希**，`action` 亦取自自由文本（`:24` `PRESET_ACTIONS` / `:25` `customAction`）。**服务端验证过的 Steam/GitHub 结果从未进入该值**——链上"信任记录"目前是**自证**，不是**他证**。 |
| **GAP-47** | Steam / GitHub 证明不落库 | 🟠 | `backend/internal/game/service.go:306` 与 `backend/internal/agentcard/service.go:134,266` 走的是 `db.MemoryStore.AppendProof` / `SaveCard` / `AppendTransaction`；`git grep -n "INSERT INTO" -- backend/` **只有 `system_configs` 一处**（`db.go:146`）。即 `game_proofs` / `cards` / `card_transactions` / `session_keys` / `agent_cards` / `trading_accounts` 这些表**没有任何写入路径**。 |
| **GAP-48** | 授信额度纯装饰 | 🟠 | 同一「额度」在四处硬编码且**互不相同**：`src/lib/trustTier.ts:14` = **600**、`src/components/GoogleAuthWall.tsx:147` = **1200**、`src/app/api/auth/github/exchange/route.ts:157-165` = **500 / 1000 / 2500**、`src/components/NavAuthBadges.tsx:132` 读 localStorage。**没有任何合约或服务端把「授信」变成真实可支取的额度**。 |
| **GAP-49** | DB 降级静默 | 🟠 | `backend/internal/platform/database/db.go:56,66,71` 在无 Supabase 凭据时返回 `&DB{Pool: nil, IsConnected: false, MemoryStore: mem}`——**不报错、不阻断**。`/api/v1/health`（`router.go:72`）把 `database` 的 `connected` 如实暴露，**但只有 `health` 一个地方**；所有业务路由照常 200。 |

> **编号避坑（实测）**：**登记前** `git grep -n "GAP-3[89]\|GAP-4[0-9]"` 在**本分支全仓零命中**
> （登记后当然会命中本节的 GAP-43~50——这正是"先检索、再登记"的意义：**检索的是登记前的那一瞬**）；
> 但在未合并分支 `feat/liquidation-bot-chain`（PR #11）上，`docs/` 内命中
> `GAP-38` / `GAP-39` / `GAP-40` / `GAP-41` / `GAP-42`。
> 两个分支各自的台账**都改 `docs/GAP台账.md`**，合并时是**必然冲突**。
> 故**本分支一律从 GAP-43 起**，且**不重排 §1 的既有行序**以减少冲突面。

---

### 5.2 GAP-38：WS 断线重连与事件水位（ADR-005 §5.3 P1）—— ✅ 已落地

> ✅ **已落地**（`docs/changes/024`，`internal/liquidator`）。实现口径见该文档 §关键设计 3：
> **保守水位 + 回填提交点原子推进**（tmp+rename 持久化 `lastProcessedBlock`；`chain.EventHandler` 边界不带区块号，
> 故推进粒度放宽到回填提交点，满足同一「不重不漏」不变量）。原 D3 负向判据（kill 本地链 → 发事件 → 再拉起，
> 断言零丢事件）**并入 GAP-40 的本地链集成验证**（见 §5.4）。

`internal/chain`（`docs/changes/022`）只提供 `Backfill(ctx, from, to, h)` 与 `Subscribe(ctx, h)` 两个**原语**，
刻意不自愈。ADR-005 §5.3 的架构不变量——**持久化 `lastProcessedBlock` 水位** + **指数退避重连** +
**重连后先回填、再切回实时订阅**——落在 `cmd/liquidator` 装配层：

- 启动：从 `lastProcessedBlock+1`（空水位则从部署区块）回填到链头；
- 运行：每处理一个区块**原子推进水位**（不重不漏）；
- 重连：从 `lastProcessedBlock+1` 重新回填，堵断线空窗。

**负向判据（D3，落地时必须真跑）**：kill 本地 `npx hardhat node` → 发若干事件 → 再拉起，断言回填后**零丢事件**
（本地 `PositionOpened` 计数 == 链上事件数）。这是"失败即无声"的高危项，判据必须有牙。

### 5.3 GAP-39：Hermes 生产路径（价格层的最小实现遗留）

`internal/oracle`（`docs/changes/023`）的 `HermesFeed` 是**演示不阻塞的最小实现**：单次
`/v2/updates/price/latest` REST GET + `price/expo` 归一化（`NormalizeHermesPrice` 已逐行镜像
`PythOracleAdapter._normalize` 并有对拍测试）。生产叙事还差：

- **SSE/WS 流式 tick**：现为每价一次轮询式 GET，无订阅、无缓存。
- **staleness 边界**：镜像 `PythOracleAdapter.getPriceNoOlderThan`——拉取式预言机上，测试网 feed
  可能**月级陈旧**却仍返回一个价；现实现不拒绝陈旧价，对保证金系统是错误失败模式。
- **批量更新 / 置信区间**：现实现逐 feed 取、丢弃 `conf` 字段。

**演示不受影响**：演示主路径是 `DemoFeed`（链上 `DemoOracle`，owner 可调、无 staleness 语义），`HermesFeed` 只作生产叙事。

### 5.4 GAP-40：本地链端到端集成验证（Bot 提交 `liquidate` 回执）未跑

`cmd/liquidator` 装配与单测已落地（`docs/changes/024`），但**端到端回执尚未在本地链上跑过**——
按 D1 不得伪装成已跑。本地工具链已就位（`contracts/node_modules` 存在、`ignition/modules/PerpStack.ts` 与
`scripts/demo-seed.ts` 存在），命令如下（本子代理未执行，留待集成）：

```powershell
# 终端 A：起本地链（HTTP + WS 同端口 8545，chain 31337，账户带测试币）
cd contracts
npx hardhat node

# 终端 B：部署 + 注入流动性 + 开 20 笔混合仓位（14 long / 6 short @ 50x，入场价 180）
npx hardhat run scripts/demo-seed.ts --network localhost
# 记录输出的 NEXT_PUBLIC_PERP_POSITION_MANAGER / NEXT_PUBLIC_PERP_ORACLE 地址

# 终端 B：写一个 drop-price 脚本（或复用 DemoControlPanel 的 setPrice），把 NVDA 价从 180 打到多头强平价下
# （多头 50x、entry 180 → 强平价 ≈ 163.6）

# 终端 C：起 Bot（私钥取 hardhat node 输出的任一 funded 账户私钥）
cd backend
$env:LIQUIDATOR_RPC="http://127.0.0.1:8545"
$env:LIQUIDATOR_WS="ws://127.0.0.1:8545"
$env:LIQUIDATOR_CHAIN_ID="31337"
$env:LIQUIDATOR_POSITION_MANAGER="<pm 地址>"
$env:LIQUIDATOR_DEMO_ORACLE="<oracle 地址>"
$env:LIQUIDATOR_FEED="demo"
$env:LIQUIDATOR_PRIVATE_KEY="<funded 账户私钥，无 0x 也可>"
$env:LIQUIDATOR_START_BLOCK="1"
go run ./cmd/liquidator

# 判据：Bot 结构化日志出现 "liquidate submitted"（tx=0x…），且硬链接收到 PositionLiquidated 回执；
# 附带 D3 负向：kill 终端 A 的 node → 发若干事件 → 再拉起 node + Bot，断言本地 PositionOpened 计数 == 链上事件数（零丢）。
```

**还差的最小件**：一个「调低 DemoOracle 价」的脚本（`demo-seed.ts` 不降价；`DemoControlPanel.tsx` 是前端按钮，
headless 集成需要一个等价脚本或 `cast send` 一行）。

### 5.5 GAP-41：Bot 镜像不含资金费 → 低估可清算集合 —— ✅ 已落地（残余见文末）

> ✅ **公式与事件源部分已落地**（`docs/changes/026`，2026-10-11）。
> `internal/perp/position` 增补 `EntryFundingIndex` / `Funding` / `WAD`，
> `Equity` / `IsLiquidatable` / `LiquidationPrice` 按合约口径减去资金费，
> `Table` 增补每 feed 的已观测指数（`ApplyFundingIndex`）并由 `Scan` 取用。
> `entryFundingIndex` 的来源**选跟踪 `FundingAccrued` 事件**（而非 open 时 `getPosition` 读回）：
> 合约在 `PositionOpened` **之前**于同一 tx 内 emit `FundingAccrued`（`PositionManager.sol:427` 对 `:476`），
> 日志顺序保证回放时种子已在手，零额外 RPC。
> 连带 `internal/chain`（**冻结四包之一，本次显式解冻**）：`EventHandler` 增 `HandleFundingAccrued`、
> `filterQuery` 3 → 4 topic、`PositionFromOpened` 增一参。

**原始记录（保留，D4 不篡改已发生的事实）**：

`internal/perp/position.Position` **无 `entryFundingIndex`**（该包设计于 ADR-003 逐块资金费之前，
`position.go:32-35` 明写「liquidator 无用的字段省略」）。故 `position.Scan` 按**纯价格**判清算，而链上
`_isLiquidatable` 是 `collateral + pnl - funding`（`PositionManager.sol:1045-1049`）。

**后果（安全方向，演示不阻塞）**：资金费非零时，Bot **低估可清算集合**——漏清算（资金费把仓位推过线时 Bot 看不到）；
反向（Bot 认为可清算、链上因负资金费不可清算）时链上 `liquidate` 对不可清算仓位 `continue` 静默跳过，**不会 revert**。

**残余（未做，本步明确不做）**：

1. **链上对拍**：Bot 的判定 vs `PositionManager.isLiquidatable` 的实链读数，**未跑**。
   属 GAP-40 的端到端集成范围——本步只保证「镜像口径对齐合约」，没保证「镜像读数等于链上读数」。
2. **`indexNow` 是已观测指数，不是链上投影值**：合约用 `_projectedFundingIndex`（投影到当前区块，
   `PositionManager.sol:866-872`），Bot 用 `FundingAccrued` 的存量指数，两次累积之间**滞后**。
   方向与本 GAP 同向（欠报），幅度更小。要逐位消除需在 Bot 侧镜像 `_skewWad` / `_fundingDelta` /
   `lastFundingBlock`——那是第二份资金费模型，**本步不做**。
3. **回填窗口**：`LIQUIDATOR_START_BLOCK` 晚于某 feed 首次开仓 tx 时，该 feed 无种子 → entry 指数按 nil=0。
   演示路径（从部署区块回填）不受影响。

**解除条件（原文，已被上条落地满足）**：`position.Position` 增补 `EntryFundingIndex`，`chain.positionFromEvent`
从 `PositionOpened` 事件之外补该字段（事件本身不携带它，需在 open 时按 `cumulativeFundingIndex` 快照或改事件）；
`Scan` 的判定与 `_isLiquidatable` 对齐。属 `internal/perp/position` + `internal/chain` 的改动，超出 `024` 装配范围。

### 5.6 GAP-42：清算观测的权威值回填（`exit_price`/`reward`/`block_number`）

`docs/changes/025` 落地的 `/api/v1/liquidations` 在 Bot **提交成功点**写库，此时只有判定价与 tx 哈希：

- `exit_price` 存的是 `batch.MarkPrice`（扫描时判定价），**不是**链上结算价；
- `reward` / `block_number` 恒为 NULL（tx 尚未上链，结算赏金未知）。

而 `PositionLiquidated` 事件**确实携带**权威 `exitPrice`/`reward`
（`internal/chain/bindings/ipositionmanager.go:1327` 已解码），但 `chain.Client` 在
`client.go:98` 只把 `positionId` 传给 `EventHandler.HandleLiquidated`，丢弃了这两个字段；
`chain` 属冻结四包，`025` 不改。

**解除条件**：给 `chain.EventHandler` 增补 `exitPrice`/`reward`（连带 `HandleLiquidated` 签名与
`tableHandler`），在事件侧补写/回填这三列；或 Bot 侧独立监听 `PositionLiquidated` 回填。
属 `internal/chain` + `internal/liquidation` 的改动。

---

### 5.7 README 与文档一致性整合新开的三项（2026-10-11）

> **登记前已检索**（D4）：`git grep -n "GAP-5[2-9]|GAP-6[0-9]"` 在合并后的 HEAD 上**零命中**——
> **下面当时据此选了 `GAP-52`。这个判断是错的，原因不在检索没做，而在检索的"面"不覆盖未合并分支。**
> 这一句原文保留在这里，因为它正是缺陷的第一手证据。

> ⚠️ **编号被顺延两次，最终为 `GAP-57` / `GAP-58` / `GAP-59`（留痕，请按新号引用）**：
> 本节初稿用的是 `GAP-52/53/54`，**在该号被写进本文件之后**才发现
> **另一条未合并分支 `feat/real-alpaca-data`（`669aece` → `75ccda7`）已占用 `GAP-52~56`**
> （含其 `029-独立验证-14-16-判据缺口取证.md` 里独立提议的 `GAP-55` / `GAP-56`）。
>
> | 轮次 | 拟用 | 撞上谁 |
> | --- | --- | --- |
> | 1 | `GAP-52/53/54` | 该分支的 `GAP-52/53/54` |
> | 2 | `GAP-55/56/57` | 该分支的 `GAP-55/56`（**该分支在本轮中前进，多占了两号**） |
> | 3 | **`GAP-57/58/59`** | 实测为空（本地与该分支均已核） |
>
> **"登记前已检索"这句本身是对的，但它检索的面不够**：`git grep` 只看**当前检出**，
> 而号是**跨分支共享**的。**两次撞车都不是检索没做，而是检索的范围不覆盖对方分支。**
> **根治方向（建议，未在本轮实施）**：把登记前检索改成
> `for b in $(git branch --format='%(refname:short)'); do git grep -n "GAP-5" $b -- docs/; done`
> ——**或者，更好的做法是让编号守卫（hook）替人做这件事**：
> 单靠"记得跨分支查"已经失效两次了。
> **本节以下正文已按最终号改写**；被顺延的中间号**不留残余引用**。

> 本节三项**全部未修**——它们要么改的是对外门面（README），要么需要人能拿到原始出处。
> **本次只做了文档结构与索引的整合**（`docs/planning/README.md` 的索引补齐、`docs/changes/` 编号撞车消解、
> 台账归档表修正、`ADR-005` 进索引），逐条见 `docs/planning/文档一致性核对.md`。

#### GAP-57：`README.md` / `README_zh.md` 的三重漂移（**未修，P1**）

**为什么它是 P1**：README 是**外部读者的第一眼**，而它同时存在三类缺陷——
**幻影文件**、**读数与仓库实测不符**、**过度声称**。三类都由实测坐实：

| 类型 | 实测证据 |
| --- | --- |
| **幻影文件** | ① README 徽标链接 `contracts/coverage`（EN `:24` / ZH `:23`），`Test-Path` → **False**，且被 `contracts/.gitignore:20` 的 `/coverage` 忽略，**永不入库**；② 许可证徽标链接 `LICENSE`（EN `:27` / ZH `:26`），`Test-Path LICENSE` → **False**，`git ls-files` 无匹配，**仓内根本没有 LICENSE**（[WARN] 需人补授权文件或去掉徽标）；③ 技术栈 §4 整表标题为 `requirements.txt`（EN `:236` / ZH `:233`），`git log --all --diff-filter=D -- requirements.txt` **无输出（从未存在）**，`git ls-files "*.py"` **零命中** |
| **读数与仓库实测不符** | 徽标合约覆盖率写 **90.12%**（EN `:24` / ZH `:23`，两份 README 一致），而仓库侧的实测读数是 **89.29%（LF 口径）**——见 `docs/GAP台账.md §7`、`docs/changes/020`、`docs/changes/021`。**矛盾不在 README 内部**（它只有一个覆盖率数），而在**徽标与仓库记录之间**。CI 地板实测 = **88**（`contracts/scripts/check-coverage.ts:91` `const MIN_LINE_PCT = 88`）——**90.12% 既非地板、也无任何记录能证明它对应哪次运行** |
| **过度声称**（①已部署地址数） | README 称合约"**已部署至 Monad Testnet**"并列 5 行，但台账 §3 明写 perp「**链上部署 🔴 未做**」；`git grep -nE "0x[0-9a-fA-F]{40}"` 实测全仓**只有两个真实合约地址**（`Koliance` / `KolToken`，EN `:194-195` / ZH `:191-192`）——`SessionKeyRegistry` / `PositionManager` / `Vault` 三行的"部署地址"列写的是"由 … 模块管理"，**不是地址**，故**自称 5 个，实际只有 2 个** |
| **过度声称**（②**活路径指向不存在的端点**，本条最该先修） | README API 表（EN `:322` / ZH `:319`）列了 `POST /api/v1/game/steam/verify`，且 `src/lib/api.ts:159` **确实在调它**（`fetch(\`${GO_BACKEND_URL}/api/v1/game/steam/verify\`)`），而 `backend/internal/httpapi/router.go` 实测 **26 条挂载路由里没有这一条**。**初稿把来源误记为 `src/app/api/auth/steam/verify/route.ts:54`——实测 `:54` 调的是 `steamcommunity.com/openid/login`（对 Steam 的第一步），与 Go 端点无关**；已更正为 `src/lib/api.ts:159` |

**为什么②最该先修**：它不只是文档错——它是一条**活路径指向不存在的端点**，
且失败模式是**静默降级**（取不到 → `return { valid: false, error: … }`，与"Steam 验证没过"**在调用方看来完全一样**）。
这正是 D3 警惕的「失败即无声」：**没人会因为 404 而收到告警，只会看到"验证失败"**。
**处置二选一**（需人裁决）：补 `router.go` 的路由，或删掉 `src/lib/api.ts` 的这条 fallback。
**二选一之前不要在 README 里改这个端点的写法**——否则会把"代码少了一条路由"这件事**从文档上抹掉**。 |

> **一处更正（本 GAP 初稿的错误，留痕不删）**：初稿把 `POST /api/v1/perp/orders` 列为"README 过度声称"的证据。
> **实测不成立**——`git grep -n "perp/orders"` 全仓只命中 `docs/developer-api-service-spec.md:193`，
> **README 里没有它**。那一项属 `GAP-57` 之外的另一个问题（见核对报告 §3.4），已改挂该处。
> 记录在此以免读者按初稿去找一个不存在的 README 行。

**为何不本次修**：README 是对外门面，改动等于对外改口径；且三处需要**人先给出口径**——
授权文件（有无 LICENSE）、部署事实（perp 是否已部署 / 地址从何而来）、覆盖率采集时点。
另：`90.12%` 的原始出处**只在本文件与 README 徽标里出现**（`git grep "90.12"` 全仓仅此三处，
其中一处是本节的引用），**无任何记录能证明它对应哪次运行**。
**按纪律「登记新缺口，不擅自顺手改对」**——它需要能接触到原始读数与部署记录的人先定口径。

#### GAP-58：已部署合约地址无 provenance（**未修，P2**）

`README.md:194` / `README_zh.md:191` / `src/lib/contract.ts` / `.env.example` / 台账 §3.4 的四处指针
都在用 `0x32fDd6B096EE14246b5b6971135286Bad01F4928`（`Koliance Core`）与
`0x4cadb6f0e1b83ccb7207db4786b2a1500f066328`（`KolToken`），
但**没有任何 `docs/changes/` 记录这两个地址是哪次部署产生、由哪个 account / 哪个 commit 签的**。

**这同时暴露台账 §3.4 的一处**行号**漂移**（登记在案以便一并修）：
`GAP-36` 的「取消跟踪不丢信息」一节写身份地址另有 4 处记录，列的是
「`README.md:51`、`src/lib/contract.ts:31`、`docs/planning/推进方案.md:18`、`docs/planning/执行方案-自治Agent清结算.md:193`」。
**逐条实测**：`:51` 与 `src/lib/contract.ts:31` **均已失效**（前者现在是 `---` 分隔线，后者是 `},`），
准确的应是 **`README.md:194`** 与 **`src/lib/contract.ts:42`**（`git grep` 实测，见核对报告 §2）。
**地址本身没丢**，丢的是**指针**——这正是本项目 `GAP-34` 已记录过的同一类缺陷（自始即错的引用）。

#### GAP-59：`benchmark_report.md` 的 Observations 与数据表相反（**未修，P2**）

`docs/benchmarks/benchmark_report.md` 的数据表实测 **Pyth Hermes error rate = 100%**（20 样本），
而**同文件 §Observations 第 1 条**写「Consistently sub-second (~100-300ms) with **zero error rate**」。

**根因（已定位到行）**：那几条 Observations 是 `scripts/benchmark-apis.ts:196-199` 里的**静态文本**，
每次重跑都会被原样写回报告，**无论实测结果如何**。即"结论"与"数据"由两段互不相关的东西生成——
一种**判据夹缝**（D3）。样本仅 20，不宜据此下任何结论；但**结论与数据相反应无条件修**。

---

### 5.8 W1 落地时暴露的两个新缺口（2026-10-11 自 §5.2 迁入；同日让位至 §5.7；2026-10-12 再次让位至 §5.8）

**登记前检索**（D4）：`git grep -n "GAP-51\|GAP-52" -- .` 在本分支**零命中**；
`docs/changes/` 编号 `022~026` 亦**零命中**（本分支从 `021` 直接跳到 `027`，见下方"编号说明"）。

> ⚠️ **（2026-10-11 首次合并 `upstream/main`）**：`upstream/main` 侧**同时**占用了 GAP-51 / GAP-52，
> 故本节两条**先重编为 GAP-57 / GAP-58**（撞号裁决见 §1 表后注）。
> **（2026-10-12 二次合并 `upstream/main`，`535214b`）**：`upstream/main` 并入 PR #20 后又**独立**新开了
> `GAP-57 / GAP-58 / GAP-59`，且 PR #20 自己的缺口小节也占了 `§5.7` 号位（见 §5.7），
> 与本节的 `GAP-57 / GAP-58` **再次同号两义**——故本节两条**再次顺延为 `GAP-60` / `GAP-61`**，
> 标题从 `§5.7` 让位到 `§5.8`（**先合并者为准**，同首轮口径）。
> **顺延留痕（两轮）**：`GAP-51 → 57 → 60` · `GAP-52 → 58 → 61`。**两轮都不是写错号，而是选号时看不到对方。**
> 上一段里出现的 `GAP-51\|GAP-52` 是**检索当时的字符串**，保留不改写——它与下面那句
> 「`022~026` 零命中」一样，是**登记当时的事实**，不是现状。

#### GAP-60 · `005_settlement_ledger.sql` 未在真实 PostgreSQL 上执行过（🔴 阻塞于环境）

| 项 | 内容 |
| --- | --- |
| **缺口** | 迁移文件已落盘并**通过 SQL 静态审查**，但**从未被任何 PostgreSQL 实例执行过**。 |
| **为何是缺口而非"已完成"** | 表结构、`CHECK`、触发器里可能的**方言/顺序/权限**问题**只有真跑才会暴露**。本仓已有先例：`docs/changes/021` 实测"两道门只跑一道会漏"。**"写了迁移"与"迁移能跑"是两件事。** |
| **阻塞** | 本机**无 docker、无 psql、无 `DATABASE_URL`**（`docker version` 失败、`Get-Command psql` 为空、无 `.env`）——**实测**，非推断。 |
| **解除条件** | 一次真实执行：`cd backend && DATABASE_URL=... go run cmd/migrate/main.go`（要求 exit 0 且 `[OK] All canonical migrations applied successfully!`）。任何 PG 实例均可。 |
| **已做的替代验证（不构成解除）** | SQL 静态审查；Go 侧同一套不变量由 `internal/settlement` 以 23 个用例机械守住。**二者都不执行 DDL。** |
| **一个已知的、静态审查**抓到**的坑（已修）** | 两个同时机 `BEFORE INSERT` 触发器按**名字母序**触发，`.._balance_after` 会**先于** `.._fill_seq` 运行 → 对 `NULL` 的 `ledger_seq` 取"前一笔"永远取不到 → 每一行都把自己的发生额当余额。**已改为单函数单触发器**消除名字序依赖（见该文件的注释）。**此坑正是"未跑过"的证据**：它不会被任何 Go 单测发现。 |

#### GAP-61 · `sanitizeDSNError` 的残余暴露（🟠）

| 项 | 内容 |
| --- | --- |
| **缺口** | 脱敏按**锚点**替换：① URL 的 userinfo（`postgres://user:pass@` → `postgres://REDACTED@`）② `password=<v>`。**若某条错误把口令以两种锚点之外的形式回显**，它不会被脱敏。 |
| **为何不用兜底替换** | 第一版实现就是"把口令字符串全局替换"。它**更糟**：对单字符口令（`postgres://u:x@db.example`）会把 `db.example` 改成 `db.eREDACTEDample`；对口令含未转义 `@` 的 DSN，"被替换的字符串"只是首字符，**真口令原样留下**——即**判据看起来在防、实则没防**。故**刻意保留**这一残余暴露并登记，而不是用一个长度阈值把它盖住。 |
| **解除条件** | 需要一条**既非 URL 也非 keyword** 的口令回显样本（当前未知是哪种 error 会这样）。若有，按锚点补规则并加用例。 |
| **顺带发现（不单开号）** | 全库 Go 源码存在**既存** gofmt 债务（`internal/config/config.go`、`internal/model/types.go`、`internal/platform/stripeclient/stripe.go` 等**未被本次改动触及**的文件亦不合格）。CI（`.github/workflows/ci.yml`）**不跑 gofmt**，故它一直没红。本次**只**保证**自己新增/改动的文件** gofmt 干净，**未**顺手重排无关文件（那会把 diff 撑大且与 W1 无关）。 |

**编号说明**：`docs/changes/` 从 `021` 跳到 `027`——`022~026` 为空号，**不是漏登**。
本分支在不重排既有行序的前提下追加；若与他分支撞号，**合并方以先合并者为准重编**。

> **补记（2026-10-11 · 跨分支撞号已消除）**：上文两处「`021` 直接跳到 `027`」**保留不改写**（它们是**当时的**取号事实）。
> 但 `027` 与 `028` **确实撞上了**：并行未合并分支 `feat/real-alpaca-data` 的
> `docs/changes/027-真实Alpaca数据与涨跌幅排行.md` / `028-前端真实行情与涨跌幅排行.md` 已占这两个号。
> 按上文口径「**以先合并者为准重编**」，**本分支让号**：
> **`027 → 035`**（`docs/changes/035-GAP43-44-49-复式记账与ZK插槽与降级显式化.md`）·
> **`028 → 036`**（`docs/changes/036-W1独立03环测试-settlement-verifier-DB降级.md`）。
> 选号前已按 `AGENTS.md` §6「登记前先检索」做**全分支并集**复核：
> `git log --all --name-only --pretty=format: -- docs/changes/` 的并集最大号为 **`034`**，**`035`/`036` 未被任何分支占用**（**该判断当时成立；`035`/`036` 后于 2026-10-12 再让到 `039`/`040`**）。
> 上文本节「从 `021` 跳到 `027`」的**表述因此在读者侧略显过时**：本分支 `022~026` 仍为空号，
> 而 `027`/`028` 在本分支**已不再占用**（它们属于 `feat/real-alpaca-data`）。
>
> **同批改到 / 未改到的引用**（本次 `git grep -n "changes/027\|changes/028" -- .` 全仓实测，**零剩余**指向本分支该记录）：
> - **已改**：本文件 5 处（`docs/changes/027` → `035`，当时行 `11`/`106`/`107`/`112`/`486`）· `docs/changes/036` 内 **9 处**（`027` → `035`，含 §7 标题与表头）。
> - **有意不改（历史快照）**：`docs/changes/035`（今 `039`）§5.8 的 `?? docs/changes/027-*.md`——它是**当时的 `git status` 命令输出**，改写即篡改证据链。
> - **⚠️ 未改到（不在本次硬边界内，交总控裁定，勿当已解决）**：两处**活跃指针**仍写 `docs/changes/027`，
>   在本分支上**已指向不存在的路径**——`deploy/README.md:95` 与
>   `backend/internal/settlement/qa_ledger_test.go:524`。二者**不在 `docs/`**，改动落在代码 / 部署文档侧，
>   故本次**只登记、不代改**（D4「发现漂移先登记，不擅自顺手改对」）。
>
> **补记（2026-10-12 · 二次重编：`035/036/038` → `039/040/041`）**：与上一轮**同族**的撞车又发生了一次——
> `upstream/main` 并入 PR #20 时新增 `035-mobile-responsive-navbar-and-touch-guard.md`、
> `036-strip-cyan-borders-and-accents-from-solution-stage.md`、`038-demo-video-shotcraft-autonomous-creation.md`，
> 与本分支的 `035`/`036`/`038` **逐一同号**。
> 按同一口径「**以先合并者为准重编**」，**本分支再次让号**：
> **`035 → 039`** · **`036 → 040`** · **`038 → 041`**（`038` 是首轮的合并记录，为保持 `035→039`/`036→040` 的映射可读一并让位）。
> 三份文件**正文逐行未改**，只在**顶部加编号更正说明**、**指针型引用**（`docs/changes/035` → `039` 等）跟着改。
> 复核：`git log --all --name-only --pretty=format: -- docs/changes/` 的**全分支并集**最大号为 `038`，
> 故 **`039`/`040`/`041` 未被任何分支占用**（实测）。**两轮完整映射见 `docs/changes/042`**。
> **又一次同族教训**：号是跨分支共享的，两次重编之间只隔一天——**"选号时看不到对方"没有解药，只有守卫。**

---

### 5.9 W1 独立证伪新增的七个缺口（2026-10-12，GAP-65~71）

> **来源**：`falsifier` 的独立 03 环证伪清单，其中 **C1 与 A1 由 `backend-dev` 本轮独立复跑**
> （不是转述——见下方逐条的 stdout）。**完整取证与其未验证项见 `docs/changes/046`。**
> **取号（D4）**：`GAP-` 全分支并集（27 个 ref，`git grep -hoE 'GAP-[0-9]+'` 逐 ref）最大号为 **`64`**，
> 故自 **`65`** 起。**一条坑记在这里**：并集初读出现过 `69`，追下去只来自
> `docs/changes/043:22` 的**区间字面量**「`GAP-62`~`GAP-69` 在全部 ref 上零命中」——
> **那是"69 未被占用"的陈述，不是占用**。**未来的编号守卫必须排除区间字面量**，
> 否则它会把 `65~69` 误判成撞车（守卫本身变成假红）。

> **七条的共同性质**：都**不是"算错了"**，而是**"没人能发现它错了"**——D3 同族（参 `docs/changes/007` 的「空分母被当成 100%」）。
> **除 GAP-65 外，其余六条的取证或解除全部需要真实 PostgreSQL**，而本机**无 docker / psql / `DATABASE_URL`**（即 **GAP-60**）。
> 故下面凡涉 PG 的半边，**一律标注为"未实测"**，不伪装成结论。

#### GAP-65 · `cmd/api` 的启动 fail-fast 无任何自动化判据（🟠 P1）

**GAP-49 的修复分两半**：`cmd/api` 启动即拒绝（主）· 落盘路由 `withDB` 守卫（纵深防御）。
**第二半有判据（6 条用例）；第一半一条都没有**——因为它**只在 `cmd/api` 里**，而 `cmd/api` **没有测试文件**。

**本轮的变异实测**（把 fail-fast 退回 GAP-49 之前的静默内存降级）：

```
$ # cmd/api/main.go 变异：db, _ := database.New(...) / if db == nil { db = database.NewMemoryOnly() }
$ go build ./...              exit=0
$ go vet ./...                exit=0
$ go test -race -count=1 ./...
?   	github.com/koliance/backend/cmd/api	[no test files]
exit=0
```

**即：把 GAP-49 的核心修复整个回退，CI 仍然全绿。**（已还原。）

| 项 | 内容 |
| --- | --- |
| **解除条件** | 新增 `cmd/api/main_test.go`，直接调 `run(&config.Config{DatabaseURL: ""})`，断言返回 `ErrDatabaseURLRequired`、**不**返回 nil、**不**监听端口。`run` 已是 `func run(cfg) error`，**故用例可写**（无需改生产签名） |
| **为何是判据缺口而非"已坏"** | 生产行为**是对的**；缺的是"它坏了会被发现" |

#### GAP-66 · `005` 触发器允收自带 `ledger_seq`，产出的账被本仓判据拒收（🟠 P1）

**两半，都实测。**

**（a）注释与代码矛盾**（`backend/migrations/005_settlement_ledger.sql`）：

- `:126-129` 注释：「ledger_seq is allocated here rather than by the writer so that **a client cannot pick its own replay position**」
- `:138-140` 代码：`IF NEW.ledger_seq IS NULL OR NEW.ledger_seq = 0 THEN NEW.ledger_seq := nextval(...)`
  → **只在"没给"或"给了 0"时才分配；客户给了非零值就原样收下**。

**（b）后果：两道门对同一批行给出相反结论**（**Go 侧本轮实测**）。写入方自带 `ledger_seq` 且**按 seq 逆序插入**时，
触发器的 `balance_after` 是**插入那一刻**的累计值，**后插入的更小 seq 不会让前者被重算**：

```
PROBE A1: CheckEntries(journal as stamped by the trigger) -> err=
  settlement: balance_after does not match the replayed balance:
  intent a1 seq 10 account AVAILABLE_BALANCE: stored 7, replayed 10
PROBE A1: errors.Is(err, ErrBalanceAfterMismatch) = true
PROBE A1: ErrOutOfOrder=false ErrDuplicateSeq=false ErrNotBalanced=false
```

**触发器写下的账，本仓自己的校验层拒收。** 这与 `docs/changes/021` 是反面：
那边是「只跑一道门会漏」，这边是「**两道门互相矛盾，谁也不知道该信哪道**」。

| 项 | 内容 |
| --- | --- |
| **两条解除路径（需人裁）** | ①**收紧触发器**：非空且非 0 的 `NEW.ledger_seq` 直接 `RAISE EXCEPTION`；②**收宽判据**：承认 `balance_after` 由 DB 单方面决定（代价：放弃「篡改可发现」）。 |
| **未实测** | **PG 侧**：`stored 7 / replayed 10` 两个值是**按触发器逻辑推出**的，**未在真 PG 上盖出来**（无 PG）。 |
| **严重度** | 当前**无生产写入方**（`git grep` 零命中），故非活缺陷 |

#### GAP-67 · `NUMERIC(36,18)` 静默舍入 vs Go 拒收（🟡 P2）

`debit`/`credit`/`balance_after` 均为 `NUMERIC(36, 18)`（`005:87-88`、`:95`）。
Go 的 `ParseAmount` **主动拒收**超 18 位小数与超 18 位整数（`ledger.go:123-128`，`ErrBadAmount`），
**已有用例钉住**（`ledger_test.go:386`、`qa_ledger_test.go:347`）。

**分歧**：`0.0000000000000000001`（19 位小数）→ **Go 拒收**；`NUMERIC(36,18)` 会**静默舍入**到 18 位
（甚至舍成 0，进而撞上 `ck_settlement_ledger_single_sided`）。**一个拒绝、一个改写。**

直连 INSERT 的写入方（迁移注释明确设想的场景）**看不到任何错误**，只会拿到被悄悄改过的金额。
**金额被静默改写是账本里最不该静默的一件事。**

**未实测**：PG 的舍入行为（无 PG）。**Go 侧拒收已实测。**

#### GAP-68 · `user_address` 不参与任何不变量（🟡 P2）

| 位置 | 实测 |
| --- | --- |
| DDL `:85` | `user_address VARCHAR(42) NOT NULL`——**无格式 CHECK、无 FK** |
| DDL 触发器 `:144-150` | 前序余额只按 `intent_id` + `account_type`；**`user_address` 不在作用域内** |
| DDL `:101-103` | 唯一的行级 `CHECK` 是单边性，与地址无关 |
| Go `ledger.go:266-268` | 只要求非空（空则 `ErrMalformedEntry`）——**同样不校验格式** |
| Go `checker` | 状态键是 `IntentID`（`:295`）与 `Account`（`:311`），**地址不参与任何键** |
| 对照 | 本仓**别处有现成的地址校验**：`agentapi.ValidateWallet`（`:93-104`，42 字符 + `0x` + 40 hex）、`game.ValidateWallet`——**结算账本没用它** |

**后果**：`user_address` 可任意填（只要非空），账仍然"平"，**没有任何东西会发现这条腿不属于这个地址**。
而「复式记账」的业务意义正是**归属**。

**解除条件**：人先裁一条——它是**权威归属**（加格式 CHECK + 与 `settlement_intents.user_address` 的一致性约束）
还是**冗余标注**（那就写明它不参与不变量，并考虑删列）。**属口径决策，非 bug。**

#### GAP-69 · `settlement_ledger` 无 UPDATE/DELETE 守卫、无读回审计（🟡 P2）

| 判据 | 实测 |
| --- | --- |
| 防改约束 | **没有**。`005` 只有**一个 `BEFORE INSERT` 触发器**（`:162-165`），无 UPDATE/DELETE 触发器、无 `RULE`、无列级权限 |
| RLS 挡得住应用吗 | **挡不住**。`:175-177` 是 `ENABLE ROW LEVEL SECURITY`（**刻意不加 `FORCE`**，文件里写明理由），策略**只对 `anon` 角色**建（`:184-189`）。应用以 owner / `service_role` 连接 → 策略不适用 → `UPDATE`/`DELETE` 畅通 |
| 运行期读回审计 | **没有**。`CheckEntries`/`Journal` **只吃内存 `[]Entry`**；`git grep -n "settlement_ledger" -- backend/` 的命中**全是注释与 DDL，无一条 SELECT** |

**「只可追加」目前只体现在命名上，不体现在约束上。** 更关键的是第二行：
**即使加了守卫，也没有任何判据在运行期证明它是只可追加的**——守卫与判据**两样都缺**。

**解除条件**：①DDL 加 `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`（或撤掉应用角色的 `UPDATE`/`DELETE` 权限）；
②一条**负向**用例：真 PG 上 `UPDATE settlement_ledger ...` **必须失败**。
**只做①不做②等于没做**（这道判据天生"失败即静默"，正是 D3 点名的类型）。

#### GAP-70 · qa 路由清单无「路由 → 清单」反向对拍（🟡 P2）

| 方向 | 现状 |
| --- | --- |
| 清单 → 路由 | **有**：`TestQARouteInventoryIsComplete` 用 `PATCH` 探针逐条断言「清单里的路径确实已注册」（控制组：不存在的路径确实 404） |
| 路由 → 清单 | **没有**：没有任何判据读 `router.go` 的注册项并检查它出现在清单里 |
| 后果 | **新增一条路由不会出现在任何清单里，于是不会被任何用例覆盖——静默免测** |

**这条不是推测，它刚发生过**：`/api/v1/developer/keys` 就住在这个缝里（`docs/changes/045` §3.1）。
**同一形状在实现方的清单上也有一份**：`router_test.go` 的 `dbGatedRoutes`，
其注释原称「新落盘路由会作为测试失败暴露」——**不成立**（两个用例只遍历清单）。
`045` 已把该注释改成实情，**反向检查本身登记在此**。

**解除条件**：一条**机械**判据——从 `router.go` 抽出全部 `h("<path>", ...)` 注册，
与 qa 清单求差集，非空即红；**且要有负向对照**（加一条假路由 → 必须红）。

#### GAP-71 · `IsConnected` 运行期不会被翻 false（🟡 P2）

| 判据 | 实测 |
| --- | --- |
| 谁写 `IsConnected` | 只有两处：`db.go:72`（`NewMemoryOnly` → `false`）与 `db.go:110`（`New` 成功 → `true`） |
| 谁翻回 false | **没有**。连接池中途断开**不改变**该字段 |
| 于是 `withDB` 的第二道检查 | `router.go:90` 的 `if !d.DB.IsConnected` **运行期恒不成立** |
| 后果 | DB 中途不可用时，落盘路由**不返回 503 + `Retry-After: 5`**，而是把请求放进去，由 `pgx` 报错 → 各自错误路径（多为 **500**）。**同一故障两种答案**，而 503+Retry-After 才是"瞬时故障"的正确答案 |

**判据缺口而非活缺陷**：`Retry-After: 5` 这条契约**已有用例在守**
（`TestQAUnconnectedHandleRefusesAndSaysWhenToRetry`，用 `NewMemoryOnly`）——它守的是「构造时未连接」。
**没有任何用例能构造「连接中途失效」**，因为 `IsConnected` **压根没法在运行期改变**：
**判据覆盖了一个不可能发生的状态。**

**解除条件（需先定口径）**：要么给 `DB` 一个**探活**（`pool.Ping(ctx)` / `Pool.Stat()`），
让 `withDB` 判**当下可达性**；要么**删掉这道检查**并写明「本进程只区分有无 DB 句柄，运行期断连由各 handler 的错误路径负责」。
**两条都比"留着一个恒不成立的检查"诚实。**

#### 5.9.1 A8 的复核：`005` 注释「任意前缀」——**成立，不重复取号**

**已登记**在 `docs/changes/040 §7`（对照表「过期陈述」行）。**本轮复核（两条都读了）**：

| 位置 | 口径 |
| --- | --- |
| `005_settlement_ledger.sql:21-25` | 「the running total of (credit - debit) must be zero **after every single posting**」→ **任意前缀** |
| `ledger.go:364-378` | **明确否掉**前缀式（三腿凭证 `100 = 98 + 2`「unbalanced after its second leg and balanced after its third」），取 **per-intent 试算平衡** |

**复核结论：成立，且仍在**（该句在迁移文件里逐字未改，而它**会被当规格读**——它就是那份 DDL 的抬头）。
**不重复取号**；`docs/changes/046` §2.8 有留痕。**本轮仍不改**：与 GAP-66/67/69 同批在真 PG 上定稿更合适。

#### 5.9.2 本次登记的一处自查：`GAP-70`/`GAP-71` 被**先引用、后登记**

`docs/changes/045` 与 `router_test.go:315` 在**本次登记之前**就写了「登记为 GAP-70 / GAP-71」。
按「不在台账里 = 不存在」，那两个指针在 §5.9 落盘前是**悬空的**；随本次登记**闭合**。
**教训：先登记、再引用编号**——反过来会让中间那次提交上的读者去找一个不存在的号。

---

## 6. 明确不做（⬜，附理由）

| 编号 | 事项 | 理由 |
| --- | --- | --- |
| GAP-30 | Redis 额度池 | `想法记录.md:4` 划定范围为"只完成立项/需求/设计/开发/测试和发布"；且 RFC 的 Lua 有 4 个实测缺陷（GAP-18~21），本次不值得引入 |
| GAP-18~21 | 修 RFC Lua 缺陷 | 不采纳 Redis 即不激活。**若将来采纳，必须先修这四条** |
| 05~10 环 | 运维/故障/迭代/自动化 | `想法记录.md:4` 明确不做，"交由平台处理" |
| **04 构建环** | 容器镜像 Digest / `REVISION` 运行时断言 | 本仓无 Dockerfile、无 `REVISION` 断言。**人工决定：不处理、不标记**（`ADR-004` D4 / `docs/changes/010`） |

---

## 7. 当前质量基线（用于回归）

> ⚠️ **本节已落后于 HEAD（2026-10-11 标注）**：下表是分支 `feat/perp-solvency-and-panel`
> 时点的读数（合约 146 / 前端 23）。此后 `docs/changes/021` 记录了**更晚的读数**：
> 合约 **189 passing**、前端 **36 passing**、合约覆盖率 **89.29%（LF）**、前端 lines **80.45%**。
> **本表未在本轮复跑**，故不把上述数值提升为"本轮实测"——**要引用就按 `docs/changes/021` 原文引，
> 或当场重跑下表命令**（`AGENTS.md` D1：任何数字在引用前若超过一次提交，必须重新实测）。

分支 `feat/perp-solvency-and-panel`，**本地与 CI 均已实测**：

| 指标 | 数值 | 命令 |
| --- | --- | --- |
| 合约测试 | **146 passing**（3 solidity, 143 nodejs） | `cd contracts && npx hardhat test` |
| 合约覆盖率 | **89.22% 行**（LF 口径；门禁 88%） | `cd contracts && npx hardhat test --coverage && npx tsx scripts/check-coverage.ts` |
| 合约类型检查 | exit 0 | `cd contracts && npx tsc --noEmit` |
| 前端单测 | **23 passing**（3 files） | `npx vitest run` |
| 前端类型检查 | exit 0 | `npx tsc --noEmit` |
| 前端 lint | exit 0 | `npx next lint` |
| 前端构建 | ✓ 成功，含 `○ /perp` | `npx next build` |
| 后端构建/静态检查 | exit 0 | `cd backend && go build ./... && go vet ./...` |
| 后端测试 | **29 passing**，`-race` | `cd backend && go test -race ./...` |

**CI 状态**：`.github/workflows/ci.yml` 三个 job **全部通过**（run `37623974490`）。

> ⚠️ **覆盖率读数必须取自 LF 检出**（重新 clone 或在 `.gitattributes` 生效后重新检出）。
> 长期存在的 Windows 工作树会读到**偏高约 5 个点**的值——这正是首次 CI 失败的原因（GAP-35）。

**本轮基线变化**：合约 111 → **146**（+35），前端单测 9 → **23**（+14），后端 0 → **29**。
覆盖率从 0 → **89.22%（LF）**，带门禁。

---

## 8. 本轮提交

| 提交 | 内容 |
| --- | --- |
| `0193e3a` | 修 GAP-01~05：出金上限 + 逐笔容错 + 赏金基数（ADR-002） |
| `2c0e353` | `scripts/demo-seed.ts` 按出金上限定容 |
| `36fc5be` | 前端接线：`/perp` + `PositionPanel` + `perpAbi` |
| `2b05f05` | CI 门禁（GAP-10）+ 修 3 个既有类型错误（2 个非本人引入） |
| `8d9c715` | 清算 Bot 核心：头寸数学镜像 + 本地 nonce 管理器（GAP-26 部分） |
| `1e85092` | 逐块资金费率（GAP-27，ADR-003）+ 本台账 |
| `df227bf` | 规划文档迁入仓库（GAP-31）+ 修 FEEDS 矛盾（GAP-09） |
| `50c51d8` | 删陈旧 lockfile（GAP-28）+ README 去明文凭证（GAP-12 部分） |
| `506c4ef` | 覆盖率门禁（GAP-32） |
| `c7da777` | 平仓退出保护（GAP-07）+ 推送可观测（GAP-08） |
| `8f69995` | 台账更新（新开 GAP-33/34） |
| `42e41fc` | 修 14 处失效文档路径 |
| `1ac689a` | CI 改为**所有分支**触发（原来只 main，导致 fork 分支无 CI） |
| `e48ed61` | **CI 步骤顺序**：先 compile 再 tsc（artifacts 被 gitignore，否则 110 个类型错误） |
| `f6ec42d` | 覆盖率按 **LF 口径** + 新增 `.gitattributes`（GAP-35） |
| `822488e` | 台账记录 GAP-35 与两个"只有 CI 能发现"的失败 |

**详细复盘见 `docs/changes/009-CI首跑修复.md`** —— 三个问题**本机全部是绿的**。

**新一轮（仓库文档与 gitignore 修复）**：修 GAP-36（`.gitignore` 根锚定→`**/`）
+ 修 GAP-16 幻影路径（活跃文档 4 处）+ 修 GAP-34 错误指针 + 撤销 GAP-37（编号撞车）。
详见 `docs/changes/010-gitignore锚定与文档路径修复.md`。

**再一轮（03 环收口）**：前端覆盖率门禁（GAP-33 ✅）——`vitest.config.mts` 加
带 `include` 范围的阈值 + `coverage/` 入忽略 + CI 改跑 `--coverage`。详见 `docs/changes/011-前端覆盖率门禁.md`。

**再一轮（线程 B）**：EIP-712 链上委托 `SessionKeyRegistry.sol`（`推荐方案` P1-b）
+ 19 例测试（7 正向 / 12 证伪）+ 纳入覆盖率门禁 + ignition 模块。详见 `docs/changes/013-线程B-EIP712链上委托.md`。

**再一轮（打通连接）**：`openPositionFor` + `SessionKeyRegistry.chargeSpend`（具名消费方，两入口一套规则）
——Agent 持 session key 在链上开仓，用户签一次后不再碰钱包。178 用例通过。详见 `docs/changes/014-打通连接-Agent链上开仓.md`。

**再一轮（对拍）**：GAP-06 关闭 —— 前端强平价与链上判定黄金向量对拍（60 条），
含变异测试证明判据有牙齿；并发现 GAP-37（面板两条清算口径）。详见 `docs/changes/015-GAP06-强平价对拍.md`。

**再一轮（演示可运行）**：新增 `DemoControlPanel.tsx`（演示扳机，直接读链不经 Bot）
+ `DemoRehearsal.ts`（把彩排变成测试）；补前端 ABI 缺失的 `PositionLiquidated`。
**发现演示自带 42 分钟资金费时钟**（seed 把费率设到上限 1e13）。详见 `docs/changes/016-演示可运行-控制台与彩排.md`。

**再一轮（重新冻结）**：GAP-34 关闭 —— `IPositionManager` 接口重新冻结，
文件头加权威冻结清单（20 函数 + 5 事件），并新增机械守卫 `FrozenSurface.ts`（含变异测试）。
详见 `docs/changes/017-GAP34-接口重新冻结.md`。

**再一轮（可信度）**：GAP-14 关闭 —— 合成行情改用**确定性种子**（同请求恒定、跨天推进），
来源名改为如实（`synthetic_curated` / `synthetic_fallback`），并让 UI **显示**来源与说明。
详见 `docs/changes/018-GAP14-合成行情标注.md`。

**再一轮（发布环）**：GAP-11 / GAP-29 关闭 —— `deploy/README.md` 成为**发布环 runbook**
（含第 0 步：GAP-12 轮换凭证，附就绪改动与风险说明）；并补齐 `.env.example` 缺失的 4 个变量。
详见 `docs/changes/019-GAP11-发布环与env补齐.md`。

**再一轮（行尾 + lockfile）**：GAP-35 / GAP-28 关闭 —— **索引早已全是 LF，无需任何重规范化提交**；
真正的问题是属性生效前检出的**工作树副本**（`.sol` 16/22 仍 CRLF）。刷新工作树后全库 235/235 LF，**零提交**。
实测后果：覆盖率 LF 读数 **89.29%**（此前报的 90.92% 是 **CRLF 虚高**）。详见 `docs/changes/020-GAP35-行尾与GAP28-lockfile.md`。

**PR**：[moonhotline/koliance#5](https://github.com/moonhotline/koliance/pull/5)
（16 提交，52 文件，CI 三 job 全绿）

---

## 9. 修复过程中引入又修掉的真实回归（供参考）

这些是**修 A 引入 B** 的案例，值得记下来，因为它们都是"读代码看不出来、跑测试才暴露"的：

| 提交 | 引入的回归 | 抓到它的测试 | 根因 |
| --- | --- | --- | --- |
| `1e85092` | 资金费无侧向符号 → 两侧被收同样的费，空头永远收不到钱 | `charges the crowded side and pays the thin side` | 资金费退化为手续费 |
| `1e85092` | `_equityAfterFunding` 漏了 `collateral` | `Pays a winning long out of the pool` | 权益凭空少一整个抵押品 |
| `506c4ef` | 覆盖率脚本在**无分支数据**的报告上打印"branches 100%" | 自己怀疑那个 100% 并 grep 原始文件 | 空分母被当成 100% |
| `c7da777` | 类型化调用打到无代码地址 → **每笔平仓 revert** | `Does not block a close when the price updater is not a contract` | `try/catch` **不捕获**"目标无代码" |
| `e48ed61` | CI 先 tsc 后 compile → **110 个类型错误**（本地却全绿） | 首次真实 CI 运行 | `artifacts/` 被 gitignore，viem 的合约类型从它推导 |
| `f6ec42d` | 覆盖率阈值按 CRLF 本机读数定 → **CI 失败** | 首次真实 CI 运行 | 覆盖率插桩按字节偏移，行尾改变测量结果 |
| `1ac689a` | workflow 从未被触发（`branches: [main]` 不覆盖 feature 分支） | `gh pr checks` 零 check-run | fork 的 PR 运行需要 base 分支已有 workflow |

**共性**：六条都不是逻辑想错，而是**对一个库/语言/环境行为的错误假设**
（整数除法舍入、try/catch 的边界、空分母、返回值的字段顺序、
构建产物被 gitignore、行尾对测量结果的影响）。

**其中三条只有真实 CI 才能发现** —— 本机怎么跑都是绿的。
**这是"CI 到底值不值"这个问题的答案，由 CI 自己给出。**
详见 `docs/changes/009-CI首跑修复.md`。
