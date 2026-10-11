# 037 — gitleaks 基线补登 + 凭证卫生修复（CI secrets job）

## 1. 背景

PR #19（#14/#16 真实数据）合并后，CI 的 **`secrets (gitleaks)`** job 红：全历史扫描发现 **5 处** `generic-api-key`。
`frontend` / `contracts` / `backend` 三个 job **全绿**——即功能未坏，坏的是**密钥扫描基线**。

## 2. 5 处的性质（逐条实测）

| # | 文件:行 | 归属 | 值 |
| --- | --- | --- | --- |
| 1 | `src/components/DeveloperConsole.tsx:144` | 作者（`7c4b753`） | 前端演示用的**假** `sk_sess_…` session key |
| 2 | `docs/developer-api-service-spec.md:128` | 作者（`31d1f4f`） | 同上，文档里的假 session key |
| 3 | `src/components/DeveloperConsole.tsx:176` | 作者（`f41f8d8`） | 合成订单状态（非凭证作料的误报） |
| 4 | `backend/internal/config/config.go:96` | **本线（`06dbb2e`）** | `STRIPE_PUBLISHABLE_KEY` 的**硬编码默认值**被重构到新行 |
| 5 | `backend/internal/liquidator/config_test.go:13` | **本线（`3a224bc`）** | 测试里的假私钥 hex，被当 `generic-api-key` |

## 3. 处置

**代码卫生（本线 2 处，值已从 HEAD 移除）**：
- `config.go`：`StripePublishableKey` 的硬编码 `pk_test_…` 默认值 → **空串**（与 `AlpacaAPIKey`/`StripeSecretKey` 同口径——本该如此，属本次修正）。
- `config_test.go`：假私钥改为**运行时拼装**（`"0x" + strings.Repeat("0123456789abcdef", 4)`），源码内不再有 key 形状的字面量。

> ⚠️ **从 HEAD 删除值 ≠ 泄漏撤销**：`.gitleaksignore` 的指纹**钉在历史提交上**，`06dbb2e`/`3a224bc` 里的旧值**仍在 git 历史**。删 HEAD 只是**防止未来再次触发**；历史无法清理（作者文件已确立此口径）。

**基线（5 处全部入 `.gitleaksignore`）**：
- 本线 2 处 → 已从 HEAD 移除值，仅历史指纹在，基线。
- 作者 3 处 → 假演示/规范值，与既有基线里已豁免的同类（如 `src/lib/db.ts:7`）。

## 4. 验证

- `cd backend && go build ./...` → exit 0
- `cd backend && go test -count=1 ./...` → 全绿（13 包 ok，无 FAIL）
- `go test ./internal/config/ ./internal/liquidator/` → `ok`（改后 `testPrivateKeyHex` 仍是 64 位合法 hex）
- **gitleaks 本地不可用**（本机无该二进制）→ 基线是否被接受**只能由 CI 判定**。`[未能验证]`

## 5. 未竟 / 边界

- **值仍在 git 历史**（`06dbb2e`/`3a224bc` 及作者三处）：属既有事实，需**轮换密钥**方能真正撤销（GAP-12）。
- 本记录**不修** `DeveloperConsole.tsx` / `developer-api-service-spec.md` 里的假值（作者文件，非本线作用域；且它们本就在同文件大批同形，基线是正解）。
- 兼修：`docs/changes/032-*.md` 的 H1 原写 `030`（与文件名不符）→ 改为 `032`（gate-auditor 命令 #I 发现）。
