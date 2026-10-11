# ADR-005：清算 Bot 接链 —— 引入 `github.com/ethereum/go-ethereum`

- **状态**：Accepted（已决定 —— 采用方案 A：go-ethereum）
- **日期**：2026-10-11
- **触发**：GAP-26（perp 未部署 / Bot 未接链，已完成部分：头寸数学镜像 + 本地 nonce 管理器）
- **互审**：sre-operator —— 裁决「有保留」：同意方案 A，要求补 4 项 P1 + 3 项 P2 运行/部署约束；本轮已并入 §5（正文）与 §6（后果精确化），**维持 Accepted**。
- **输入**：
  - `backend/go.mod`（实测：直接依赖仅 `jackc/pgx/v5`、`joho/godotenv`、`stripe/stripe-go/v78`，**无 go-ethereum**）
  - `backend/internal/perp/position/position.go`（头寸镜像 + 清算判定，已实现、**零依赖**）
  - `backend/internal/perp/nonce/manager.go`（本地 nonce 管理器，已实现、**零依赖**）
  - `contracts/contracts/perp/interfaces/IPositionManager.sol`（顶部冻结清单：函数签名 + 事件 `PositionOpened` / `PositionClosed` / `PositionLiquidated` / `FundingAccrued` / `FundingSettled`）
  - `docs/planning/推进方案.md` 阶段 2（`internal/chain/` = "go-ethereum 客户端 + abigen 生成的合约绑定"）
- **影响范围**：`backend/go.mod` / `backend/go.sum`（新增依赖）· `backend/internal/chain/`（新增：ethclient 封装 + abigen 绑定）·
  **运行/部署约束决策**（§5：私钥策略 / 运行宿主 / 水位与重连 / 单实例，本次只定架构、不落代码）。
  **不改**：`backend/internal/perp/position` · `backend/internal/perp/nonce`（保持零依赖）· `contracts/` · 其他文档。

---

## 1. 决策

**为清算 Bot 的接链部分引入官方 `github.com/ethereum/go-ethereum`：**

1. 用 **abigen** 从冻结的 `IPositionManager` ABI 生成类型安全的合约绑定（写函数 + 事件结构体）；
2. 用 **ethclient** 完成 `eth_getLogs` 事件回填、WebSocket 新区块/日志订阅、`NonceAt` 取确认 nonce 作种子；
3. 依赖**不进入** `internal/perp/position` 与 `internal/perp/nonce`——二者继续零依赖、单测可跑。
   `internal/chain/` 在边界处把 go-ethereum 的事件类型转成纯 `position.Position` 结构，再交给既有核心；
4. **运行/部署约束**（私钥、宿主、事件水位与 WS 重连、按网络成块配置、单实例）为本次决策的一部分，详见 §5——
   SRE 互审要求，不允许降为「实现细节」。

---

## 2. 背景：为什么现在必须定

GAP-26 是「perp 未部署 / 未接线 / 无 Bot」。已交付的核心数学（`position` + `nonce`）是**刻意零依赖**的：
`position.go:19-21`「Nothing in this package talks to a chain」，`position.go:33-34` 用 hex string 而非
go-ethereum 类型「so this package stays dependency-free and unit-testable」。这条边界是本决策的**前置约束**，不能破坏。

缺失的是接链部分：连 Monad RPC、`eth_getLogs` 回填 `PositionOpened` / `PositionClosed`、WS 订阅新区块增量更新、
abigen 生成绑定（`推进方案.md` 阶段 2，2 天预算）。

接口已冻结，且**事件签名与函数签名同等冻结**（`IPositionManager.sol` 顶部）：
「An off-chain indexer backfills from them, so a signature change there is as breaking as a function change.」
Bot 侧绑定必须与冻结 ABI 严格对齐——一旦错位，不是崩溃而是**静默漏清算**，正是本框架 D3 警惕的「失败即无声」。

另一处前科与本决策直接相关：GAP-12 记录了明文凭证入 commit 的历史
（`render.yaml:17-28` 明文 `ALPACA_API_SECRET` 等 6 处、`config.go:54-59` 把密钥当 `getEnv` 默认值）。
清算 Bot 会新增**一把能发交易的私钥**，若沿用这套「明文 + 默认值」习惯，等于把 GAP-12 的坑原样复制一遍——§5.1 反向设计。

---

## 3. 需求实测清单（阶段 2 硬要求 → 依赖能力对照）

| # | 需求 | 出处 | go-ethereum 对应能力 |
| --- | --- | --- | --- |
| R1 | 启动时 `eth_getLogs` 回填 `PositionOpened` / `PositionClosed` | `推进方案.md` 阶段 2.1 | `ethclient.FilterLogs` + `accounts/abi/bind` 的 `Filter*` |
| R2 | WebSocket 订阅新区块增量更新 | `推进方案.md` 阶段 2.1 | `ethclient.SubscribeNewHead` / `SubscribeFilterLogs` |
| R3 | 批量清算 `liquidate(uint256[], bytes[])`，单价格快照 | `推进方案.md` 阶段 2.2；`IPositionManager.sol:165` | abigen 生成的 `Session.Liquidate(opts, ids, updates)` |
| R4 | nonce 种子取**确认** nonce，非 pending | `nonce/manager.go:53-58`（`NewManager(start)` 应喂 `NonceAt(addr, nil)`） | `ethclient.NonceAt(ctx, addr, nil)` |
| R5 | 事件主题解码（indexed 字段 + data 字段拆分） | `IPositionManager.sol` 冻结事件 | abigen 生成的 `*Parse` 事件结构体 |

---

## 4. 替代方案权衡

### 方案 A：go-ethereum（推荐）

**决定性结构事实**：abigen 生成的绑定**本身 import go-ethereum**（`accounts/abi` / `accounts/abi/bind` /
`common` / `core/types` / `crypto` / `event` / `ethclient`）。所以「要 abigen 但不要 go-ethereum 运行时」**不成立**——
选 abigen 即选 A。决策由此收敛为二选一：**要 abigen 的绑定质量，还是全手写**。

**优点**：
- R1~R5 全部现成；`NonceAt`（确认 nonce）与本地 nonce 管理器的设计口径**直接对上**（`manager.go:53-58` 明确要
  `NonceAt(addr, nil)` 而非 `PendingNonceAt`）。
- ABI 编解码（含 R3 的 `bytes[]` 这种「动态数组套动态字节」参数）、事件 topic keccak 哈希与 indexed/data 拆分，均为久经检验的现成实现。
- 冻结接口一旦再改动，**编译期报错**（重生成绑定后类型不匹配），而不是运行期静默错位——这是 D3 想要的护栏。

**代价**：
- 依赖树大（module graph 大：crypto / rlp / trie / leveldb 等）。但 Go 的「模块图」与「编译产物」是**两个口径**：
  **二进制只包含被 import 的包**（ethclient / abi / core/types / crypto 等），不打包未引用的 leveldb / trie。
  精确的本地/远端成本拆分见 §6.2。
- 上游 **LGPL-3.0** 许可（本仓未 vendor，属上游事实）：开源 demo 不阻塞，闭源分发是长期合规考量。

### 方案 B：最小 secp256k1 依赖 + 手写 JSON-RPC 客户端

**优点**：依赖面最小、二进制最小、完全可控。

**代价**：
- 需手写：ABI 编解码（含 R3 的 `bytes[]` 动态参数）、事件 topic 哈希 + indexed/data 拆分、`eth_getLogs` 分页、
  WS 订阅断线重连、EIP-1559 交易签名、`eth_getTransactionCount` 供 nonce 种子。
- 其中**事件解码错位 = 静默失败**：漏掉一个 `PositionOpened` 不崩、不报错，只是少清算一笔——正是 D3 说的
  「错了不会响」。手写这批代码，在阶段 2 的 **2 天预算**内风险最高。
- 冻结接口即便「已冻结」仍可能再 refreeze（历史上有过一次，`IPositionManager.sol:126-133`），
  手写解码要人肉同步，**无编译期护栏**。

### 方案 C：轻量第三方客户端（如 `umbracle/ethgo`）/ 跨语言 sidecar

- **C1 轻量第三方客户端**：二进制更小，但无 abigen 等价物、事件订阅生态与成熟度低于 go-ethereum；
  省下的体积对本仓（ADR-004 D2 **不引入 Docker**，无容器化交付）不构成收益。
- **C2 跨语言 sidecar**（Bot 不接链，链 I/O 交给 contracts 的 Node/viem 层）：
  引入第二进程 + IPC，且并发清算的 nonce 控制与 16–32 goroutine worker pool（`推进方案.md` 阶段 2.2）
  **必须由持有私钥的单一 Go 进程完成**——跨进程会破坏这一前提，与阶段 2 架构直接冲突。

| 方案 | 依赖成本 | abigen 级绑定 | 事件解码/订阅 | nonce 种子对齐 | 2 天预算内风险 |
| --- | --- | --- | --- | --- | --- |
| **A go-ethereum** | 高（模块图） | ✅ 现成 | ✅ 现成 | ✅ `NonceAt` | **低** |
| B 手写 | 低 | ❌ 手写 | ❌ 手写（静默失败高危） | 需手写 `eth_getTransactionCount` | 高 |
| C 轻量 / sidecar | 中 | ❌ | 部分 | 需自建 | 中 |

---

## 5. 运行与部署约束（SRE 互审新增：4×P1 + 3×P2）

### 5.1 【P1】私钥管理：独立账户、无默认值、fail-fast

- Bot 持一把**独立、仅够测试网 gas 的 funded EOA**，**不与合约部署者 / 后端 Render 服务共享密钥**——
  bot 密钥泄露不暴露部署者私钥，反之亦然。
- 私钥**只从环境变量注入**（运行宿主的 gitignored `.env`），**永不写进 `render.yaml` / 代码 / 文档**。
- 代码内**不得有默认私钥值**：缺失即 fail-fast（启动校验，缺 key 直接退出，而不是用空串/占位继续跑）。
- **依据（前科）**：GAP-12 实测 `render.yaml:17-28` 明文 `ALPACA_API_SECRET` 等 6 处、`config.go:54-59`
  用 `getEnv(key, "明文默认值")` 把密钥当默认值——本仓有明文凭证入 commit 的既有事故。清算私钥**反向设计**：
  无明文、无默认值、无 render.yaml。

### 5.2 【P1】运行宿主：Bot 不在 Render

- `render.yaml:2-7` 实测只有 `type: web` + `buildCommand: go build -o api cmd/api/main.go`——**只构建/运行 `cmd/api`，Bot 不在 Render 上**。
- **决策：Bot 运行在演示者本机或专用小 VPS，不新增 Render worker。** 三条理由：
  1. 开发/测试循环依赖 `npx hardhat node`（localhost），托管 worker 无法触达；
  2. 避免把清算私钥放进 Render env（§5.1 的 GAP-12 类风险回归）；
  3. Bot 是 single-flight 单实例进程（§5.6），不是可水平伸缩的 web 服务，Render 的 autoDeploy/重启模型与单实例约束相冲。
- 后果：**私钥放运行宿主的 gitignored `.env`；进程守护放运行宿主的 supervisor**（§5.6）。
- 备选（不推荐）：新增 Render `type: worker`。可行，但需把私钥放 Render env，且无法触达本地 hardhat node；
  仅当需要「永不关机的常驻 bot」时才重新评估。

### 5.3 【P1】事件水位与 WS 重连：架构，不是实现细节

`ethclient` 的底层 `rpc.Client` 订阅**不自动自愈**（只给原语，不给重连）。因此重连与水位是架构不变量：

- **持久化 `lastProcessedBlock` 水位**，与 R1 启动回填**共享同一水位**：
  - 启动：`eth_getLogs` 从 `lastProcessedBlock+1`（空水位则从部署区块）回填到当前链头；
  - 运行：WS 每处理一个区块，**原子推进水位**（不重不漏）；
  - 重连：从 `lastProcessedBlock+1` 重新回填，堵住断线空窗。
- **指数退避重连** + **重连后先回填、再切回实时订阅**。
- **负向验证（D3）**：kill 本地 `npx hardhat node` → 发若干事件 → 再拉起，断言回填后**零丢事件**
  （本地 `PositionOpened` 计数 == 链上事件数）。判据必须有牙，不能「看起来正常」。

### 5.4 【P2】按网络成块配置 + ChainID fail-fast

- 配置按 **network 成块**：`{rpc, ws, chainId, contractAddress}` 四元组一块。
  现状：`config.go:62-64` 已有 RPC / chainId / contract，**缺 ws URL**（`推进方案.md:123` 的
  `wss://testnet-rpc.monad.xyz` 是独立端点，不能从 https RPC 推出来）。
- 启动时 `client.ChainID(ctx)` 与配置 `chainId` **比对 fail-fast**：不一致即退出。
  防「指错链静默跑」——地址格式在任意链都合法，abigen 绑定不会报错，只会静默打空气或误触发。

### 5.5 【P2】可观测性黄金信号

| 信号 | 指标 | 来源 |
| --- | --- | --- |
| Errors | **清算成功率**（提交数 vs 成功回执 / revert 率） | 收据回读 |
| Saturation | **worker pool 队列深度** + `nonce.Manager.Issued()` 前移量 | `nonce/manager.go:110-114`（已实现） |
| Latency | **链头 lag**（本地已处理区块 vs 订阅链头差） | 水位对比 |
| 缺价跳过 | `position.Scan` 的 `skipped` 列表长度 | `position.go:217` |

最低要求：四信号**结构化日志化**；其中 `Issued()` **必须接入**（已存在、零成本，它持续变大 = 交易没落地）。

### 5.6 【P2】单实例约束 + 进程守护 + 批量按 gas 分块

- **单实例（single-flight）**：同一私钥**禁双实例**——两个进程各持 `nonce.Manager` 从同一确认 nonce 起步，
  会复现 `nonce/manager.go:1-28` 描述的非 nonce 冲突（该包防的是单进程内并发，防不住跨进程）。
  启动时用锁文件（O_EXCL / flock）**持有失败即退出**。
- **进程守护**：运行宿主的 supervisor（systemd / supervisord / 简单重启循环）是**唯一启动点**，
  避免手工起第二个实例。
- **批量按 gas 估算分块**：`liquidate(uint256[])` 一批可能超区块 gas 上限。提交前按 `EstimateGas` 分块，
  **分块必须保持 `position.Scan` 的 per-feed 单价格快照不变式**（`position.go:207-216`）——
  每块仍是同 feed 同快照，跨块可切 feed、不可混快照。

---

## 6. 后果

### 正面
- R1~R5 一次到位，阶段 2 的 2 天预算大部分可投在并发清算与演示打磨，而非重写客户端。
- 冻结 ABI 有编译期护栏：改接口 → 重生成绑定 → 编译报错，而非运行期错位。
- `position` / `nonce` 两包**保持零依赖**，既有 ±1 wei 边界测试不受影响（类型转换收口在 `internal/chain/` 边界）。
- §5 把 GAP-12 类风险挡在清算私钥之外（无明文、无默认值、无 render.yaml），并把「指错链 / 断线丢事件 / 双实例 nonce 冲突」三类静默失败转成显式 fail-fast 或负向判据。

### 负面 / 代价
- **本地 vs Render 的成本拆分（精确化）**：
  - 二进制体积与链接时间**只**在本地 `cmd/liquidator` 上升（它 import ethclient / abi / core/types 等）；
  - `cmd/api` **不 import go-ethereum**（实测 `cmd/api/main.go` 的 import 全为 internal/stdlib）——其编译产物与链接时间**不变**；
  - 但**每次 Render deploy 仍付模块图解析/拉取**：`go.mod` 新增 go-ethereum 后，即使 `cmd/api` 不编译其包，
    构建仍要解析并下载 go-ethereum（庞大的）`go.mod` 模块图，`go.sum` 同步增长。
  - **显式承认的 tradeoff**：Docker layer cache（缓存 Go 模块层）可缓解这一拉取，但与 ADR-004 D2
    「本次不引入 Docker」**冲突**——本 ADR 接受：不引 Docker，每次 deploy 多付一次模块图拉取。
- LGPL-3.0 上游许可的长期合规考量（demo 不阻塞，闭源分发需再评估）。

### 遗留（`docs/changes/022` 已落地）

- **abigen 生成产物的入仓策略**：已定——**入库**（`backend/internal/chain/bindings/ipositionmanager.go`）+ **ABI 快照入库**（`ipositionmanager.abi.json`）+ **`go:generate` 留痕**（`doc.go`，`go run github.com/ethereum/go-ethereum/cmd/abigen@v1.16.9`）。见 `docs/changes/022`。
- **版本 pin**：已锁定 `github.com/ethereum/go-ethereum v1.16.9`（go.mod/go.sum；`go list -m -versions` 实测最新 1.17.8，选 1.16 线最新补丁）。见 `docs/changes/022`。

> WS 断线重连与水位已**升入正文 §5.3**（P1 架构），不再作「遗留」。

---

## 7. 与其他 ADR / 台账 的关系

| 项 | 关系 |
| --- | --- |
| `ADR-001`（不引入 Web 框架，`docs/planning/ADR-001-是否引入Web框架.md`） | **同源判据**：新增依赖必须换来可验证价值。go-ethereum 换来 R1~R5 五个接链原语 + 编译期护栏；它是**库**，不是框架，与「不引入框架栈」不冲突 |
| `ADR-004`（范围收敛） | 其 D2「不引入 Docker」决定了体积不是 gating 项，但也**锁死了**「不引 Docker 缓解模块图拉取」这条退路（§6.2 已显式承认） |
| `ADR-002` / `ADR-003` | 清算演示（线程 A 靶心）的前置：Bot 接链后，GAP-26 只剩「Monad 部署」一项 |
| `GAP-12`（凭证硬编码） | §5.1 的反面教材：清算私钥的注入/默认值策略**必须**与 GAP-12 的修复口径一致，不得重蹈 `render.yaml` 明文 / `config.go` 默认值覆辙 |
