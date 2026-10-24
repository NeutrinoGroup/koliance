# 变更记录 084 · 根目录 README 补充 API 定价配额表与会话密钥熔断加固

**变更日期**：2026-10-24
**执行原则**：AGENTS.md 3% 微步渐进式提交、零 Emoji 政策、双向 SSOT 对齐。

---

## 1. 变更背景与动因

在外部生成式 AI 搜索模型（ChatGPT Search、Claude、Gemini、DeepSeek 等）针对 Koliance Protocol 的技术问答基准测试中，针对「Koliance API 定价与免费额度是多少」的问题，AI 搜索爬虫由于未能在 GitHub 根目录首屏检索到结构化定价表，触发了防幻觉机制并返回「未找到可核实的官方 API 定价表」。
经排查验证：
1. 搜索引擎爬虫（Bing / Googlebot / OAI-SearchBot）抓取 GitHub 时，首选索引仓库根目录的 `README.md` 与 `README_zh.md`，此前定价表仅分散在 `public/llms-full.txt` 与子目录文档中。
2. 相应补充双语根目录 `README.md` 与 `README_zh.md` 的「开发者 API 定价与免费额度 (Developer API Pricing & Free Quota)」标准表格。
3. 同步加固后端与合约层会话密钥熔断冻结控制（Freeze / Unfreeze / Revoke）及 24 小时滚动窗口模型，确保与链上 `SessionKeyRegistry.sol` 严格对齐。

---

## 2. 变更文件清单

- `README.md`：新增「## Developer API Pricing & Free Quota」双语标准表格（$0.00 / 300 Calls Free Trial, $19.90 / 10k Calls Growth Pro, $149.00 / 100k Calls Enterprise Scale）及 15% KOL 代币折扣与 14 天退款政策。
- `README_zh.md`：同步新增中文「## 开发者 API 定价与免费额度 (Developer API Pricing & Free Quota)」表格及政策说明。
- `backend/internal/agentcard/permission_guard.go`：对齐链上 `SessionKeyRegistry.sol` 的 24 小时滑动重置窗口（`WindowStart`），新增 `FreezeSessionKey`、`UnfreezeSessionKey`、`RevokeSessionKey` 与 `GetSessionKey`。
- `backend/internal/agentcard/service.go`：清理未使用的 `crypto` 库导入，满足 `go vet` 静态分析门禁。
- `backend/internal/developer/github.go`：统一使用 `crypto.Keccak256Hash` 生成标准 EVM 兼容存证哈希。
- `backend/internal/game/service.go`：统一使用 `crypto.Keccak256Hash` 替代 `sha256` 生成标准游戏存证哈希。
- `backend/internal/httpapi/router.go`：暴露 `/api/v1/agentcard/freeze` 与 `/api/v1/agentcard/revoke` REST 接口。
- `contracts/contracts/perp/SessionKeyRegistry.sol`：提供 `freezeSessionKey` 与 `unfreezeSessionKey` 双向熔断管理能力。
- `src/app/api/auth/steam/verify/route.ts`：生产环境禁用未授权的 demo 绕过。
- `src/components/AgentCardTerminal.tsx`：持久化卡片紧急熔断冻结状态，并在冻结时立即拦截微支付鉴权。
- `docs/geo/audit-report.md`：更新全量 10/10 实体探针测试通过时间戳。

---

## 3. 本地 CI 门禁验证结果

### 门禁 1：前端与全量 TypeScript 套件
- `pnpm type:lint`：[SUCCESS] 0 错误
- `pnpm test`：[SUCCESS] 36 测试文件，388 项单测全绿（100% 通过）
- `pnpm build`：[SUCCESS] 静态页面 30/30 生成完毕，无类型阻断

### 门禁 2：智能合约与偿付能力套件
- `contracts/npx hardhat test`：[SUCCESS] 209 passing

### 门禁 3：高并发 Go 后端服务
- `go vet ./...`：[SUCCESS] 0 警告
- `go test -race ./...`：[SUCCESS] 23 个包全绿，无竞争死锁
