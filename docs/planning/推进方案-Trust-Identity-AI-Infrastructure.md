# Koliance 阶段性推进方案 — Trust, Identity & AI Infrastructure

> **本文件的地位**：**活的推进文档**（覆盖式更新），把「方向 → 目标 → 取舍 → 未竟项」串成一条可执行的阶段路线。
> **它不承担台账职能**——未竟事项的**唯一事实源仍是 `docs/GAP台账.md`**；本文件只回答
> **「先做什么、为什么是这个顺序、做完长什么样」**。
>
> **时点**：2026-10-11（UTC）· 分支 `docs/ai-infrastructure-roadmap` @ `98a0ad8`（= `upstream/main`）
> **本文件中的路径与行号均经 `git grep` / `git ls-files` 实测**；
> **本轮未跑任何构建/测试命令**，故本文件**不给出行情、覆盖率、用例数一类读数**——
> 它们引用自 `docs/GAP台账.md §7` 或 `docs/changes/021`，并**标明来源与"该读数已落后"**。
> 唯一的数字是**预估人天**，那是计划值，**不冒充实测**。

---

## 0. 与现有文档的关系（先看这张表，避免读串）

| 文档 | 它是什么 | 本文件与它的关系 |
| --- | --- | --- |
| `docs/planning/项目目标.md` | **目标唯一入口**（两条线程 + 一条连接 / 五大核心领域 / P0-P2 / 砍单顺序） | 本文件**逐条对齐它**，不新增目标 |
| `docs/adr/ADR-004-RFC001取舍与项目范围收敛.md` | **取舍总闸**：RFC 降为输入材料，锁定 D1~D5 | 本文件的**范围以它为准**；它说"不做"的，本文件不再排期 |
| `docs/GAP台账.md` | **未竟事项唯一台账**（GAP-43~50 于本轮补登记） | 本文件的每个阶段项都**指向台账编号**；**台账才是状态源** |
| `docs/planning/自治 Agent 交易与链下高性能清结算系统技术架构设计全案.md` | **RFC-001**，输入材料 | 本文件的**技术原语来源**（§1.2 / §3.4 / §4.2.2） |
| `docs/planning/推荐方案-自治Agent清结算.md` | 对 RFC 的评审 | 其 §3 结论已被 `ADR-004` 采纳为决定 |
| **`docs/planning/推进方案.md`** | 旧推进方案（阶段 0~3） | ⚠️ **其排期部分已过时**：它仍是 perp 单线程视角，且 §0 现状盘点（"`Vault.sol` 不存在"等）**早已不成立**。**保留为历史留痕，不回头改写**——新排期以本文件为准 |

> ⚠️ **不改写历史**：`docs/changes/*`、`缺陷分析-审计报告.md`、`推荐方案-*.md`、`执行记录-Phase0.md`
> 都是**时点快照**，里面与现状不符的句子**保持原样**（`docs/changes/010` 的 S-6 纠正已确立该判据）。

---

## 1. 目标三层对齐

```
方向（本文件标题）
  Trust, Identity & AI Infrastructure
        │
        ▼
产品目标层 —— docs/planning/项目目标.md
  两条线程 + 一条连接
    A · 链上可验证的永续
    B · Agent 信任与身份
    连接 · 自治 Agent 用 Session Key 在链上交易
  五大核心领域（In Scope，全部保留）
    Alpaca 交易 · Stripe 计费 · Steam/GitHub 信用证明 · KolToken · 动态委托
        │
        ▼
技术原语层 —— RFC-001 §1.2 的两大原语（ADR-004 裁决其取舍）
  ① 链上身份 + Session Key 细粒度委托授权
  ② 链下高速状态通道预扣 + 双重清结算
```

**三条必须合读的口径**：

1. **RFC-001 是技术原语的来源，不是待实现的规格**。`ADR-004` D1 把它的 P0→P2 排期与目录树降格，
   只保留**三处可复用**：§4.2.2 的 `settlement_ledger` DDL、§3.4 的 ZK Validator 空接口、
   §1.2 的 EIP-712 授权语义。
2. **`ADR-004` 锁定了取舍**：**不采纳 Redis / gRPC / Docker**（D2）。
   故 RFC 的「链下 Redis 状态池 + Lua 原子预扣 + gRPC 契约 + docker-compose」**整体不在本路线图内**；
   额度预扣若确需，用**已有 PG 事务**（`SELECT ... FOR UPDATE`）。
   依据：RFC §4.2.1 的两段 Lua 有 4 个**已实测**缺陷（GAP-18~21）。
3. **五大核心领域全部保留**（D5），`ADR-004` 只收敛**执行优先级**，不移除任何领域。
   故本文件的三支柱是**领域的重组**，不是范围的裁剪。

### 1.1 三支柱 ↔ 领域 ↔ 原语的映射

| 支柱 | 对应领域（`项目目标.md §1`） | 对应原语 | 一句话 |
| --- | --- | --- | --- |
| **Trust** | Steam/GitHub 信用证明 · `Koliance.sol` 信任记录 · `agentcard` | ① 的"身份侧" | **凭什么是你**——谁来证明、证明存在哪 |
| **Identity** | 动态委托机制（EIP-712 + Session Key） | ① 的"授权侧" | **你能做什么**——授权边界与额度 |
| **AI Infrastructure** | Alpaca 交易 · Stripe 计费 · KolToken · perp 永续 · 清算 Bot | ② 的"执行与记账侧" | **做完之后账对不对**——执行、结算、审计 |

> **`agentcard` 跨两根支柱**（本表把它放在 Trust，是**展示归属**）：
> 它是「Trust 如何变成可用额度」的落点——`trustTier` 给出额度，`agentcard` 把额度变成可花的委托。
> 讨论 Identity 时**无法绕开它**，故阶段计划里它同时出现在两处。

---

## 2. 现状对照（RFC 两原语）

### 2.1 原语 ① 身份 + Session Key 委托授权 —— **链上已完成**，链下未升级

| 交付物 | 路径（实测存在） | 状态 |
| --- | --- | --- |
| 链上身份 + 可信证明链 | `contracts/contracts/Koliance.sol`（`identities` · `TrustRecord{from,to,action,proof,timestamp}` · `addTrust` :36） | ✅ 已部署（chain 10143） |
| EIP-712 链上委托 | `contracts/contracts/perp/SessionKeyRegistry.sol` + `ISessionKeyRegistry.sol` | ✅ 已建，19 例测试（`docs/changes/013`） |
| **连接**：Agent 用 Session Key 在链上开仓 | `PositionManager.openPositionFor` + `SessionKeyRegistry.chargeSpend` | ✅ **已打通**（`docs/changes/014`）；接口已重新冻结（`docs/changes/017`） |
| 委托链下侧（Go） | `backend/internal/agentcard/permission_guard.go:46` 仍是 `sk_sess_` bearer 字符串 | ⚠️ **未升级**（GAP-24 链下部分）——**卡在「Go 侧重依赖」的人工裁决** |

**结论**：原语 ① 的**链上部分可作为既成资产直接复用**；缺口集中在**链下侧**（GAP-24）与
**信任证明的落链消费**（GAP-46，见 §3.1）。

### 2.2 原语 ② 链下高性能清结算 —— **基本为空**

| RFC 组件 | 路径 | 状态 |
| --- | --- | --- |
| `settlement_ledger` 复式记账（§4.2.2 DDL） | **不存在** | 🔴 **GAP-43**：`backend/migrations/001~003` 的 11 张表里没有它；现有 `card_transactions` 是**单式**记账 |
| ZK Verifier 抽象插槽（§3.4 / §4.3.1） | **不存在** | 🔴 **GAP-44**：`git ls-files "backend/internal/verifier/*"` 实测为空 |
| 订单 FSM（§3.3 `Order FSM Controller`） | **不存在** | ⬜ **不在 `ADR-004` 的复用清单内**——RFC 的中间件层整体未采纳，故**不登记为 GAP**（登记它等于把已裁决不做的范围偷偷加回来） |
| 链下额度预扣（Redis + Lua） | **不存在** | ⬜ **明确不做**（GAP-18~21 / GAP-30，`ADR-004` D2） |
| 清算 Bot | `backend/internal/perp/position` · `backend/internal/perp/nonce` | 🟡 **核心已做 + 接链部分 in-flight** |
| `GET /api/v1/liquidations` | **不存在** | 🔴 **GAP-45**（阻塞于 GAP-26） |

> ### ⚠️ 清算 Bot 的 in-flight 状态（必须合读，否则会重复劳动）
>
> - 本分支（`docs/ai-infrastructure-roadmap` = `upstream/main` @ `98a0ad8`）**只有 Bot 的核心**：
>   `backend/internal/perp/position`（头寸数学镜像）与 `backend/internal/perp/nonce`（本地 nonce 管理器），
>   29 例 `-race` 测试通过（`docs/changes/004-清算Bot核心.md`）。
> - **接链部分（`cmd/liquidator`、`abigen` 绑定、`eth_getLogs` 回填）在另一条未合并分支上**：
>   `feat/liquidation-bot-chain`（实测该分支存在；**分支名已核实，PR 号 #11 未经本文件独立核实**）。
> - **故：不要在 AI Infrastructure 支柱里重开「清算 Bot 接链」这项工作**——
>   先与之合并（或在其上继续），否则两边都改 `PositionManager` 的调用点，冲突且重复。
> - **GAP-45（大屏）并不因 #11 合并而自动解除**：它还需要 Bot 真的跑起来，
>   即 GAP-26 的部署阻塞（`PRIVATE_KEY` + Monad 测试币，§3.0）。

### 2.3 五大核心领域逐项现状（`项目目标.md §1` / `ADR-004` D5）

| # | 领域 | 落点（实测） | 状态 |
| --- | --- | --- | --- |
| 1 | **Alpaca 交易** | 行情：`backend/internal/market/service.go` · `src/app/api/market/route.ts` · `src/components/MarketTerminal.tsx`<br>**下单**：`alpaca_client.go:150 CreateOrder` → `service.go:62 ExecuteTrade` → `router.go:313 /api/v1/market/trade`（`trading` 守卫）→ 前端 `src/lib/api.ts:215 executeMarketTrade` → `MarketTerminal.tsx:220`；平仓同链路（`:339 /market/close`） | ✅ **交易执行链路已打通**（不是"未接"）；🧪 **但走的是合成行情**——真实 Alpaca 成交需 `ALPACA_API_KEY`/`SECRET`，`router.go:69` 的 `/health` 把 `alpaca` **写死为 `true`**，探活不真 |
| 2 | **Stripe 计费与入金** | 服务端：`backend/internal/platform/stripeclient/stripe.go` · `router.go:360 /api/v1/stripe/checkout-session` · `:407 /api/v1/stripe/customer`（`operator` 守卫）<br>前端：`src/lib/api.ts:242 createStripeCheckout` → `src/components/AgentCardTerminal.tsx:256`（充值弹窗） | ✅ **入金链路已打通**（不是"未接"）；🧪 `/health` 的 `stripe` 探针是**真探针**（`cfg.StripeSecretKey != ""`，`router.go:71`）——与 `alpaca` 那条**口径不同**，此处是对的 |
| 3 | **Steam / GitHub 信用证明** | Steam OpenID：`src/app/api/auth/steam/verify/route.ts`（:54 真调 `steamcommunity.com/openid/login`）· GitHub OAuth：`src/app/api/auth/github/exchange/route.ts` · `backend/internal/game/service.go` · `backend/internal/developer/github.go` | 🟡 **验证是真的，但证明既不落库也不落链** → **GAP-46 / GAP-47** |
| 4 | **KolToken** | `contracts/contracts/KolToken.sol`；地址默认值在 `src/lib/contract.ts:41`，`.env.example:5` 亦列出 | ✅ 链上已发行；**台账无对应 GAP**（未发现已知缺口） |
| 5 | **动态委托机制** | `SessionKeyRegistry.sol`（链上）+ `backend/internal/agentcard`（链下，约 70% P0） | 🟡 **链上完成、链下未升级**（GAP-24）；额度口径四处不一致（**GAP-48**） |

**横向读数**：**「执行」侧比文档印象中完整**——Alpaca 与 Stripe 两条链路**都已端到端接好**（上表 #1/#2）。
真正的空心处集中在「**记账与证明**」：`settlement_ledger`（GAP-43）/ ZK 插槽（GAP-44）/
证明落库与落链（GAP-46/47）/ 授信口径（GAP-48）**四项皆空**——而它们正是「可验证性」叙事的支撑物。

> **登记口径说明（本案的取舍，供复核）**：#1 / #2 的"探针不真"**不单独开 GAP**——
> 它们的**功能链路是通的**，缺陷只在 `/health` 的**一个布尔字段**（`alpaca: true` 写死），
> 而该字段属于 **GAP-13**（「后端零链上交互 + `/health` 伪指标」）的**同一议题**。
> 按 D4「登记前先检索、撞车比漏登更糟」，**并入 GAP-13，不新开号**。
> 若复核认为它应独立跟踪，**补开编号即可**——本注即为该判断的留痕。

---

## 3. 三支柱阶段计划

> **可派角色**一列只写**角色注册表内已登记**的角色（`prompts/角色契约.md` 第二部分）
> 与框架附带的三实现（`falsifier` / `gate-auditor` / `ssot-scribe`）。
> **未实例化的角色按注册制不可派发**——需要时先新建 `.claude/agents/<角色名>.md`，
> **不得**拿现有角色顶替（`AGENTS.md` §4.0 / §4.1）。
> **并发上限 3**（`AGENTS.md` §4.0），且**任一环的准出未满足即阻断下一环**（D2）。
> **每项的 DoD 都必须是可证的**——纯文档类 DoD 不成立，必须落到命令或测试（D3）。
>
> ⚠️ **另一个必须写明的边界**（否则计划会落空）：`falsifier` / `gate-auditor` **只读、无 shell**，
> **跑不了任何命令**（`AGENTS.md` §4.1）。故凡"负向用例必须红"的 DoD，
> **实际执行一律由总控代跑**、再把真实 stdout 回灌给它们判分。
> 表中把 `falsifier` 列为可派角色，指的是**由它出攻击清单与判分**，**不是**由它执行。
>
> ⚠️ **候选角色要先核对是否已实例化**：`backend-dev` / `sec-auditor` / `data-engineer` /
> `qa-validator` / `sre-operator` / `system-architect` / `pm-spec-driver` 在框架的 `.claude/agents/` 下
> **均有实现文件**；但**本项目的工作目录是 `koliance/`，其下无 `.claude/agents/`**（实测）。
> 派发前须确认**角色实现对本会话可见**（Claude Code 只向启动目录及**上层**扫描）——
> **不可见即不可派**，按"禁止静默降级"须明说，不得由总控代做。

### 3.0 阶段 0（前置，人工解锁）—— **它阻塞两个支柱，不先解就白排**

| 项 | 现状 | 需要谁 |
| --- | --- | --- |
| **Go 侧引入 `go-ethereum` / secp256k1 依赖** | 未决策。它决定 Identity 支柱能否开工（GAP-24 链下部分、GAP-13） | **人工裁决**（与 `ADR-001`「不引入 Web 框架」同源：新增依赖必须换来可验证价值） |
| **`PRIVATE_KEY` + Monad 测试币** | 未提供。它阻塞 perp 部署（GAP-26）→ 进而阻塞 GAP-45 | **人工提供**（`deploy/README.md` 第 0 步） |
| **凭证轮换**（4 组：Steam / Alpaca / Stripe / GitHub） | 未做。**顺序不可颠倒**：先轮换、再改默认值 | **人工在外部后台操作**（GAP-12） |

> `项目目标.md §3` 明确：**AI 可请求人类按需进行系统设计**，遇到需要架构裁决的问题**主动提出、不擅自决定**。
> 上面第一项正是这一类。**本文件不替人裁决**——它只把「不裁决的代价」写明：Identity 支柱停在第 0 步。

---

### 3.1 支柱一 · Trust（凭什么是你）

| 阶段 | 项 | 目标 | 起点文件 | 预估 | DoD（可证） | 可派角色 |
| --- | --- | --- | --- | --- | --- | --- |
| **T1** | **GAP-46 信任证明落链** | 让**服务端验证过**的 Steam/GitHub 证明成为链上 `TrustRecord.proof` 的真值来源，替掉**本地自造**的哈希 | `src/components/TrustAttestationCard.tsx:31`（现为 `generateProof(...Date.now())`，**这是要换掉的源头**）· `src/app/page.tsx:299`（`handleAddTrust`）· `src/app/api/auth/steam/verify/route.ts` · `src/app/api/auth/github/exchange/route.ts` · `contracts/contracts/Koliance.sol:36`（`addTrust`） | **1 天** | 一个 Steam/GitHub 验证通过的用户**一键**把服务端算出的证明哈希写入链上；`getAllRecords()` 读回 == 该哈希，**且该哈希可由第三方仅从服务端证明数据复算**（这才是"可验证"）。**负向**：把哈希改成另一平台的证明 → 校验必须红（`falsifier` 出用例） | `backend-dev` + `sec-auditor`（验签口径）· `falsifier`（负向） |
| **T2** | **GAP-47 证明落库** | Steam/GitHub 证明进 `game_proofs` 等**已存在但无写入路径**的表，不再只进 `MemoryStore` | `backend/internal/game/service.go:306` · `backend/internal/agentcard/service.go:134,266` · `backend/migrations/001_init_and_composite_indexes.sql` | **1 天** | 重启后端后证明仍可查（PG 读回）；**负向**：把 DB 连接断开 → 写入必须**显式失败**而非静默进内存（与 GAP-49 同一判据） | `backend-dev` + `data-engineer`（索引/约束） |
| **T3** | **GAP-49 降级显式化** | 无 Supabase 凭据时**报错/阻断**，不静默切 `MemoryStore` | `backend/internal/platform/database/db.go:56,66,71` | **0.5 天** | 无凭据启动 → 明确错误；**负向**：故意清空凭据 → 业务路由**不得**返回 200 | `backend-dev` + `falsifier` |
| **T4** | **GAP-48 授信口径统一** | 四处硬编码（600 / 1200 / 500-1000-2500 / localStorage）收敛为**一处 SSOT** | `src/lib/trustTier.ts:14` · `src/components/GoogleAuthWall.tsx:147` · `src/app/api/auth/github/exchange/route.ts:157-165` · `src/components/NavAuthBadges.tsx:132` | **1~2 天** | 改一处即可改全部读数；**负向**：测试必须能抓到"某一处仍是旧值" | `pm-spec-driver`（口径定义）+ `backend-dev`（实现） |
| **T5** | **`agentcard` 展示**（跨 Identity） | 委托额度、卡状态、批次归集在前端可见 | `src/components/AgentCardTerminal.tsx` · `backend/internal/agentcard/visa_generator.go` · `backend/internal/httpapi/router.go:177-272`（`/agentcard/generate` · `/cards/` · `/session-key` · `/authorize` · `/batch-settle`） | **1 天** | 面板读数与后端 `/api/v1/agentcard/cards/` 一致；**负向**：把后端某张卡的额度改掉 → 面板必须跟着变（证明它真在读接口，而非本地状态） | `backend-dev` + `sre-operator` |

> **T1 为什么排第一**：它是**唯一一条把 `项目目标.md` 的"核心交付"与"叙事"接起来的工作**——
> 线程 B 的链上身份已经在了（§2.1），但**它写进链的 proof 是客户端自己拼的**（`TrustAttestationCard.tsx:31`），
> **与任何真实平台的验证结果无关**。不修它，"Agent 信任与身份"只能是**自证**——
> 评委问一句"这哈希凭什么可信"，现场没有任何东西能回答。

---

### 3.2 支柱二 · Identity（你能做什么）

| 阶段 | 项 | 目标 | 起点文件 | 预估 | DoD（可证） | 可派角色 |
| --- | --- | --- | --- | --- | --- | --- |
| **I0** | **阶段 0 前置** | Go 侧依赖决策（见 §3.0） | — | **待裁决** | 有人裁决并落 ADR | **人工** |
| **I1** | **GAP-24 链下委托升级为 EIP-712** | Go 侧 `agentcard` 验签从 `sk_sess_` bearer 升为 EIP-712，与链上 `SessionKeyRegistry` **同一套语义** | `backend/internal/agentcard/permission_guard.go:46` · `backend/internal/agentcard/service.go` · `contracts/contracts/perp/SessionKeyRegistry.sol` · `docs/changes/013` | **2~3 天**（含依赖引入） | 一个链上登记过的委托，链下**同签名**可验；**负向**：改一位签名 → 两侧都必须拒 | `system-architect` + `sec-auditor`（**成对互审**，`AGENTS.md` §4.0）+ `backend-dev` |
| **I2** | **动态限额对齐**（五大领域之五） | `agentcard` 的限额/日窗口/白名单/冻结与链上 `chargeSpend` 的**口径一致**（现为两套） | `backend/internal/agentcard/*` · `contracts/contracts/perp/SessionKeyRegistry.sol` · `src/lib/perpConfig.ts` | **1 天** | 同一笔委托，链下预检与链上扣减**对同一额度得出同一结论**；用**跨边界对拍**（参照 `docs/changes/015` 的黄金向量做法） | `data-engineer` + `backend-dev` · `falsifier` |
| **I3** | **GAP-25 全局锁量化** | `agentcard` 全程持全局锁 → 先写**基准测试**量化，再见真章 | `backend/internal/agentcard/service.go:91`（`mu sync.RWMutex`） | **1 天** | 有 `-race` 基准读数，且**能复现**串行化（不是"看上去很快"） | `qa-validator` + `sre-operator` |
| **I4** | **GAP-13 后端接链** | `/health` 从伪指标改为真实链上探活 | `backend/internal/httpapi/router.go:77-89`（现 `TotalIdentities: 128` / `LiveTPS: 9840` 为**写死值**） | **1 天** | 断言 `REVISION`-式一致性：接口读回值来自链而非常量；**负向**：链不可达 → `/health` 必须非 200 | `backend-dev` + `sre-operator` |

> **I1 是整个 Identity 支柱的咽喉**。它与 `ADR-001` 同源（不轻易加依赖），
> 故**必须先拿到裁决再动手**——否则做出来的是"又一个没人批准的依赖"。

---

### 3.3 支柱三 · AI Infrastructure（做完之后账对不对）

| 阶段 | 项 | 目标 | 起点文件 | 预估 | DoD（可证） | 可派角色 |
| --- | --- | --- | --- | --- | --- | --- |
| **A0** | **GAP-26 部署** | perp 栈上 Monad 测试网，地址入 `.env.local` | `contracts/ignition/modules/PerpStack.ts` · `deploy/README.md` · `.env.example:8-11` | **0.5 天**（**阻塞**：`PRIVATE_KEY` + 测试币） | 浏览器可查 4 个地址；`/perp` 页不再显示"未配置" | `sre-operator`——⚠️ **该角色的 `tools` 不含 shell，跑不了部署命令**（`AGENTS.md` §4.1：只读角色的执行**一律由总控代跑**）。故本项的**部署命令由人工/总控执行**，`sre-operator` 只出检查清单与验收判据 |
| **A1** | **GAP-26 Bot 接链**（**in-flight，勿重开**） | `cmd/liquidator` + `abigen` 绑定 + `eth_getLogs` 回填 + WS 订阅 | `backend/internal/perp/position` · `backend/internal/perp/nonce` · **未合并分支 `feat/liquidation-bot-chain`** | **已在另一分支** | 与 `feat/liquidation-bot-chain` 合并后：前端调价 → 1 秒内出现 N 笔成功回执 | `backend-dev` + `sre-operator`（**与 #11 合并，不并行重写**） |
| **A2** | **GAP-45 清算结果大屏** | `GET /api/v1/liquidations` + 前端滚动展示 | `backend/internal/httpapi/router.go`（**现无该路由**）· `backend/cmd/api/main.go` · `src/components/DemoControlPanel.tsx:152`（现直接 `eth_getLogs` 读链） | **1 天** | Bot 的最近清算列表经后端暴露且前端可滚动；**负向**：Bot 停 → 列表必须有"数据陈旧"标记而非静默显示旧数据 | `backend-dev` + `sre-operator` |
| **A3** | **GAP-43 `settlement_ledger`** | 复式记账表落盘（RFC §4.2.2 DDL 可直接用） | 新建 `backend/migrations/00N_*.sql`（现有 001~003 无此表）· RFC §4.2.2 | **0.5 天** | `debit`/`credit`/`balance_after` 三栏齐；**借贷必须平**——用一条**断言测试**机械守住（**空分母不得算 100%**，见 `docs/changes/007` 的教训） | `data-engineer` + `falsifier` |
| **A4** | **GAP-44 ZK Verifier 插槽** | 按 `ADR-004` D1「只留接口」建 `verifier` 包 | 新建 `backend/internal/verifier/`（实测不存在） | **0.5 天** | 接口 + 一个 no-op 实现 + 一处调用点（**避免死代码**：无调用点的接口是叙事道具，不是插槽） | `system-architect` + `backend-dev` |
| **A5** | **GAP-50 收费侧对拍** | 资金费**为负**时（收费侧）的链上对拍 | `contracts/test/perp/FundingLiquidationParity.ts`（读向量）· `tests/liquidation-funding-parity.test.ts` · 向量 `contracts/test/perp/fixtures/liquidation-funding-vectors.json` · `docs/changes/021`「未做（明确）」 | **0.5 天** | 两腿簿子精确复现 skew；**负向**：丢弃资金费项 → 对拍必须红（**且须连向量一起重生成**，否则合约侧仍绿——`docs/changes/021` 实测） | `qa-validator` + `falsifier` |
| **A6** | **前端演示打磨** | `/perp` 面板与演示控制台（已可运行）持续对齐 | `src/app/perp/page.tsx` · `src/components/PositionPanel.tsx` · `src/components/DemoControlPanel.tsx` · `src/lib/perp.ts` | 持续 | 强平价两条口径都标清（GAP-37 已关闭，`docs/changes/021`）；**结构上无法漂移** | `pm-spec-driver` + `backend-dev` |

> **A3 / A4 是 `ADR-004` D1 明确留下的两处「可直接用」**——它们是**成本最低、叙事收益最高**的两项
> （各 0.5 天），却在台账里**一直没有编号**，直到本轮（GAP-43 / GAP-44）。
> **先做它们，比先做 I1 更划算**：不依赖任何人工裁决、不引入依赖。

---

### 3.4 跨支柱排期建议（**不要按支柱顺序做**）

三支柱是**并列维度**，不是先后阶段。真实排序依据是 `项目目标.md §5` 的**砍单顺序**
（先砍 → 死保，倒过来读就是优先级）：

```
死保 ↑   修 P0 合约缺陷 ✅ → 部署 → 清算 Bot → 逐块资金费率 ✅ → EIP-712 ✅(链上) → 清算大屏
     ↓    → 复式记账 → Redis 预扣 ⬜ → ZK 插槽 ← 先砍
```

据此给出**建议波次**（每波并发 ≤ 3 角色）：

| 波次 | 内容 | 依赖 | 说明 |
| --- | --- | --- | --- |
| **W1** | **A3（GAP-43）+ A4（GAP-44）+ T3（GAP-49）** | 零依赖 | 三项都在 0.5~1 天，**不碰任何阻塞**，先把手头能做的做掉 |
| **W2** | **T1（GAP-46）+ T2（GAP-47）+ T4（GAP-48）** | T2 依赖 T3 的降级判据 | Trust 支柱收口——让"信任"有真值来源 |
| **W3** | **A0（部署）+ A1（Bot 接链，**与 PR #11 合并**）** | **人工解锁**（`PRIVATE_KEY` + 测试币） | 死保项；不合并 #11 就等着冲突 |
| **W4** | **A2（GAP-45 大屏）+ A5（GAP-50）** | A2 依赖 W3 | 演示收口 |
| **W5** | **I1（GAP-24 链下）+ I2 + I3** | **待人工裁决 Go 依赖** | Identity 支柱整体后置——**不是不重要，是被前置决策卡住** |
| **W6** | I4 · T5 · A6 | — | 打磨与一致性 |

> **W1 的选取逻辑**：**先做「无阻塞且高性价比」的**。
> A3/A4 各 0.5 天、T3 0.5 天——三者加起来 1.5 天，却能把 `ADR-004` 留下的两处复用**真正落地**。
> 反过来，**W5 整波被一个未裁决的依赖问题卡住**：这正是 §3.0 之所以是"阶段 0"的原因。

---

## 4. 本文件不做什么（边界，避免与台账重复）

1. **不登记缺口**——缺口一律进 `docs/GAP台账.md`，本文件只**引用编号**。
2. **不改写历史快照**（`docs/changes/*`、审计报告等）。
3. **不替人裁决**——§3.0 的三项都是人工事項；本文件只写「不裁决的代价」。
4. **不写未实测的数字**——本文件**唯一的数字是"预估人天"**（那是计划值，不冒充实测）；
   行情/覆盖率/用例数等**一律不给**，要引用请回 `docs/GAP台账.md §7`（**注意该节自带的"已落后"警告**）
   或当场重跑。本文件引用的所有**路径与行号**则都是 `git grep` / `git ls-files` 实查过的。

## 5. 维护约定

- **本文件是覆盖式的**（像 `memory.md`）：状态变化时**改本文件**，不去追加"第 N 版"。
- **每次改动同步更新 `docs/planning/README.md` 的索引**（本文件已列入 §1）。
- **本轮的对应台账变更**：`docs/GAP台账.md §5.1` 新开 **GAP-43~50**（§5 表同步）。
- **闭环时**：某阶段项完成后，**先改台账状态（附提交号），再改本文件的阶段表**——
  台账是源，本文件是投影（与 `record.md` → 进度页 同一口径，`AGENTS.md` §5）。
