# 086 - Keepalive 定时保活时段优化与 Rust 高性能清算求解器

## 1. 变更背景与用户核心诉求
- **Render 保活定时时段精细化治理**：此前 GitHub Actions `.github/workflows/keepalive.yml` 设定全天 24 小时每 10 分钟一次 ping，导致 Render 后端全月 744 小时常驻运行，存在月中耗尽 750 小时免费实例额度并停机的隐患。按用户诉求将保活时段严格限定为**北京时间上午 10:00 至晚上 21:59（UTC 02:00 至 13:59）**。调整后每日运行约 12 小时，全月仅消耗约 372 实例小时（占比 ~49.6%），留存超 50% 冗余安全缓冲。
- **Rust 高性能结算与清算求解引擎（crates/koliance-solver）**：为满足 Monad 高吞吐公链（10,000 TPS、1 秒确认）对清算套利和代理 Session Key 鉴权的微秒级延迟要求，引入系统级 Rust 求解器模块。采用 `ethnum` 原生 256 位大数数学（`U256`, `I256`）与原生 Keccak-256 哈希，杜绝任何浮点漂移或整数截断失真，在零 GC 停顿下达成单机 **1046 万次/秒** 清算评估吞吐量（平均延迟仅 **95.63 ns**），且 100% 通过 contracts 目录下 60 个黄金清算向量与 24 个资金费清算向量的严苛对拍。

---

## 2. 核心代码变更清单

### 2.1 Keepalive 定时保活与运维脚本
- `.github/workflows/keepalive.yml`:
  - 调度 Cron 表达式调整为 `cron: '*/10 2-13 * * *'`（UTC 02:00 至 13:59，对应北京时间 10:00 至 21:59）。
  - 执行步增加当前 UTC 与北京时间实时计算日志回显，明确标注文档化额度管理依据。
- `scripts/keepalive-render.sh`:
  - 增加时间窗口校验函数 `is_within_active_window`，原生支持北京时间 10:00 - 21:59 时段识别。
  - 增加 `--force` 选项支持任意时段单次强制探活，在非活跃窗口执行跳过探测并记录日志，避免本地或守护进程意外唤醒容器。

### 2.2 Rust 高性能结算求解器（`crates/koliance-solver`）
- `Cargo.toml`:
  - 根目录声明 workspace，统一纳入 `crates/koliance-solver`。
- `crates/koliance-solver/Cargo.toml`:
  - 引入 `ethnum`（256 位大数）、`tiny-keccak`（EVM 标准 Keccak-256）、`serde`/`serde_json`、`clap`、`hex`。
- `crates/koliance-solver/src/types.rs`:
  - 严格镜像 `PerpConstants.sol` 常量（`BPS_DENOMINATOR = 10,000`, `MAINTENANCE_MARGIN_BPS = 100`, `LIQUIDATOR_REWARD_BPS = 500`, `OPEN_FEE_BPS = 10` 等）。
  - 定义 `Position`、`DelegationTerms`、`FundingMath` 数据结构与 0x 十六进制地址解析器。
- `crates/koliance-solver/src/liquidation.rs`:
  - 实现 `position_size_usd`, `net_collateral_usd`, `unrealized_pnl`, `liquidation_price_with_funding`, `liquidation_price`, `equity_with_funding`, `is_liquidatable`, `liquidation_reward`。
  - 保持与 Solidity / TypeScript 严格一致的运算顺序与截断规则。
- `crates/koliance-solver/src/funding.rs`:
  - 实现未平仓多空偏差 `funding_skew_wad`、每区块费率增量 `funding_delta_wad` 及持仓资金费结算 `funding_owed`。
- `crates/koliance-solver/src/eip712.rs`:
  - 严格实现 EIP-712 Domain Separator（`EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)`）与 `AgentDelegation` 结构体哈希编码。
  - 计算 66 字节 `\x19\x01` 签名摘要，并提供快速本地有效性/每日额度/窗口交易次数熔断校验。
- `crates/koliance-solver/src/main.rs`:
  - CLI 命令行工具，提供 `verify-vectors`、`benchmark`、`eip712-digest`、`version` 四项交互指令。
- `crates/koliance-solver/tests/golden_vectors_test.rs`:
  - 读取并测试 `contracts/test/perp/fixtures/liquidation-vectors.json` 中的全部 60 个黄金向量，断言 100% 比特级一致。
  - 读取并测试 `contracts/test/perp/fixtures/liquidation-funding-vectors.json` 中的全部 24 个资金费清算向量，断言 100% 比特级一致。
  - 验证 EIP-712 Domain Separator 与 Struct Hash 计算一致性及超额防线。

### 2.3 CI 门禁与协作规范集成
- `.github/workflows/ci.yml`:
  - 新增 `solver: name: solver (rust)` 独立作业，执行 `cargo check` 与 `cargo test`。
- `AGENTS.md` / `README.md` / `README_zh.md`:
  - 本地门禁矩阵升级为四阶门禁（Gate 1 前端、Gate 2 合约、Gate 3 Go 后端、Gate 4 Rust 求解器）。
- `package.json`:
  - 增加便捷脚本：`test:rust`, `solver:verify`, `solver:bench`。
- `.gitignore`:
  - 补充忽略 `target/` 构建产物与 `Cargo.lock`。

---

## 3. 门禁验证结果

### Gate 1: Frontend & Full TypeScript Suite
- `pnpm type:lint`: 通过（0 错误，0 告警）
- `pnpm test`: 36 测试套件通过（395/395 通过）
- `pnpm build`: 32/32 静态页面与路由打包成功

### Gate 2: Smart Contracts & Solvency Suite
- `cd contracts && npx tsc --noEmit`: 通过
- `cd contracts && npx hardhat test --coverage`: 209 测试用例全部通过，覆盖率达到 88.92%（高于 88% 基线要求）
- `cd contracts && npx tsx scripts/check-coverage.ts`: 通过

### Gate 3: High-Concurrency Backend Service
- `cd backend && go vet ./...`: 通过
- `cd backend && go test -race ./...`: 23 个包全部通过数据竞态检测

### Gate 4: Rust Settlement & Parity Engine
- `cargo check`: 通过
- `cargo test`: 5 个测试用例全部通过（涵盖 60 个黄金清算向量 + 24 个资金费清算向量 + EIP-712 签名计算）
- `cargo run --release --bin koliance-solver -- benchmark --iterations 5000000`:
  - 吞吐量：10.46 Million ops/sec
  - 延迟：95.63 ns / op
