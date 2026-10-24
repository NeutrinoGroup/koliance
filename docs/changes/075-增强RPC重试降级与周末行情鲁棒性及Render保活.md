# 075 - 增强 RPC 重试降级与周末行情鲁棒性及 Render 保活

## 1. 背景与根因

在生产环境和外部联调中，用户反馈了以下两项致命阻断与稳定性需求：
1. **Perp 终端 RPC 请求失败 (`RPC Request failed.`)**：
   - **根因 1 (缺乏超时重试与降级)**：[`src/lib/perpChain.ts`](file:///Users/alexander/bwa/koliance/src/lib/perpChain.ts) 中，客户端直接绑定到单一公共节点 `https://testnet-rpc.monad.xyz`，未复用 [`src/lib/contract.ts`](file:///Users/alexander/bwa/koliance/src/lib/contract.ts) 的 `monadRpcTransport()`，且未配置请求超时（`timeout`）与重试次数（`retryCount`）。
   - **根因 2 (瞬时并发风暴)**：[`src/components/PositionPanel.tsx`](file:///Users/alexander/bwa/koliance/src/components/PositionPanel.tsx) 打开时向链上连续发起 125+ 次瞬时并发调用（5 个池指标 + 20 个 `isOpen` + 20 仓位 × 5 项详情）。
   - **根因 3 (无故障隔离导致全盘归零)**：全量请求置于单一 `Promise.all` 中，一旦跨境网络丢包或遭遇公共节点频控，直接抛出 `RPC Request failed.` 并跳过池状态更新，将资产流动性显示为 `$0.00`。
2. **Market 行情休市 404 降级 (`RESOURCE_NOT_FOUND` / `UPSTREAM DEGRADED`)**：
   - **根因 1 (Alpaca 默认时间窗口机制)**：Alpaca `/v2/stocks/bars` 接口未传 `start` 参数时，默认取当前自然日 00:00:00 UTC。周六、周日以及非美股交易时间无当日 K 线，Alpaca 返回空数据集 `{"bars":{}}`。
   - **根因 2 (多标的分页截断)**：请求参数 hardcode 了 `limit=2`。在 Alpaca 规范中 `limit` 为整页标的总条数，导致多标的查询时仅第一个标的获 2 根 K 线，其余标的全被截断为空。
   - **根因 3 (Fail-Closed 严格映射)**：后端严格遵守 Zero-Mock 原则（不捏造虚假价格），返回 404 导致标的卡片报错、`/healthz` 标记 Alpaca 探活失败并弹出顶部黄色告警横幅。
3. **Render 后端免费容器休眠**：
   - GitHub Actions 原定时探活频次为 5 分钟（`*/5`），在公共工作流池中常被延迟或合并跳过；缺少专门的 10 分钟稳定保活脚本。

---

## 2. 变更内容 (What Changed)

1. **RPC 传输层容错加固与主备降级** ([`src/lib/contract.ts`](file:///Users/alexander/bwa/koliance/src/lib/contract.ts) 与 [`src/lib/perpChain.ts`](file:///Users/alexander/bwa/koliance/src/lib/perpChain.ts)):
   - `monadRpcTransport()` 升级为支持参数注入并默认启用弹性防护：默认 10 秒超时（`timeout: 10_000`）、3 次自动指数退避重试（`retryCount: 3, retryDelay: 500`）及批量支持（`batch: true`）。
   - `createPerpPublicClient()` 迁移为复用 `monadRpcTransport()`，在主节点 `testnet-rpc.monad.xyz` 抖动时自动并发无缝切换至备用节点，并在本地模式和自定义 RPC 场景保持平滑降级。
   - 维持 `tests/monad-rpc-order.test.ts` SSOT 规范，未引入端点字面量重复。
2. **Perp 终端防风暴按需加载与故障隔离** ([`src/components/PositionPanel.tsx`](file:///Users/alexander/bwa/koliance/src/components/PositionPanel.tsx)):
   - **解耦池流动性指标与仓位扫描**：偿付能力池资产（`totalAssets`、`reservedAssets`、`availableAssets`）优先读取并立即可见，历史仓位网络抖动绝不波及池资产展示。
   - **倒序按需分页加载 (Lazy Load)**：默认仅优先读取最新的 10 笔活跃仓位，大幅减少初次载入时的并发查询数量；当总仓位数大于载入数时，提供「加载更多历史仓位」交互按需扩展。
   - **单仓位级别异常隔离**：针对仓位详情读取采用单项容错捕获，个别仓位在清算临界点或网络微抖动时不会导致整个页面崩溃。
   - **UI 几何与微交互规范**：按钮严格遵循 `AGENTS.md` 规范，采用现代微圆角矩形（`rounded-md`）与微投影，严禁胶囊椭圆设计。
3. **Alpaca 行情时间窗口与多标的分页累积** ([`backend/internal/market/price_oracle.go`](file:///Users/alexander/bwa/koliance/backend/internal/market/price_oracle.go)):
   - 显式计算并追加 7 天起始窗口参数 `start=YYYY-MM-DD`（`time.Now().UTC().AddDate(0, 0, -7)`），确保在周末休市、节假日长假期间均能稳健获取最近两个交易日的真实收盘价。
   - 动态调整 `limit`：单标的维持精准读取，多标的扩展为单页批量读取（`limit=100`）；同时实现 `NextPageToken` 分页累积循环（最多 3 页），彻底解决多标的截断问题。
   - 新增针对性自动化单测 `TestPriceOracleLookbackWindowAndPagination`，验证时间参数与跨页解析逻辑。
4. **Render 10 分钟常驻保活与探活脚本** ([`.github/workflows/keepalive.yml`](file:///Users/alexander/bwa/koliance/.github/workflows/keepalive.yml) 与 [`scripts/keepalive-render.sh`](file:///Users/alexander/bwa/koliance/scripts/keepalive-render.sh)):
   - GitHub Actions keepalive 工作流调度调整为 GitHub 官方推荐的 `*/10 * * * *` 稳定周期。
   - 探活目标同时覆盖 `/healthz` 健康探活与 `/api/v1/market/movers` 真实业务接口，全面预热后端容器与行情缓存。
   - 独立新增可执行脚本 `scripts/keepalive-render.sh`，支持单次执行与 `--loop` 常驻守护模式。

---

## 3. 验证记录 (Verification Record)

### 3.1 工业化三道质量门禁验证 (AGENTS.md §4)
- **Gate 1 (前端全量 TypeScript 类型、代码风格、单测与构建)**:
  - `pnpm type:lint`: 通过 (0 errors, 0 warnings)
  - `pnpm test`: 28 个测试文件全绿，331/331 用例通过 (0 regressions)
  - `pnpm build`: 成功输出 21 个静态与动态路由（含 `/perp`、`/market`、`/console` 等）
- **Gate 2 (智能合约类型检查、单元测试与行覆盖率门禁)**:
  - `cd contracts && npx tsc --noEmit`: exit 0
  - `cd contracts && npx hardhat test --coverage && npx tsx scripts/check-coverage.ts`: 209/209 通过，覆盖率 91.23%（高于 88% 地板门禁）
- **Gate 3 (高并发 Go 后端检查与竞态测试)**:
  - `cd backend && go vet ./...`: exit 0
  - `cd backend && go test -race ./...`: 全部 23 个 package 通过，0 race warning；新加用例 `TestPriceOracleLookbackWindowAndPagination` 毫秒级通过。
- **Gate 4 (密钥防泄露与高熵扫描)**:
  - `/tmp/gitleaks git --redact --no-banner --verbose .`: 扫描 243 处提交，0 leaks found。

### 3.2 真实接口与保活探测
- 执行命令: `./scripts/keepalive-render.sh`
- 结果:
  - `/healthz` 响应码: `200`
  - `/api/v1/market/movers` 响应码: `200`
  - 判定: `[OK] Backend container is active and healthy.`
