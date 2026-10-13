# 066 - 后端非法Code降级时状态码语义同步加固

- **状态**：已完成
- **日期**：2026-10-13 (UTC)
- **关联**：`docs/adr/ADR-006-统一报错处理体系.md` · `docs/changes/063-修复后端闭集收敛与生产路由全可达性.md` · `docs/changes/065-03环复测报告-闭集收敛与503猜测消解.md` · Issue #33
- **作者/执行**：backend-dev (Go / 后端工程专家)

---

## 1. 【准入审查】与改动背景

依据 `AGENTS.md` §3 五段交付规范与 02 开发环工程质量要求：
1. **准入审查**：
   - 处于 02 开发环细节加固阶段；
   - 前置基线：ADR-006 12 错误码闭集词表已冻结，063 建立了闭集强校验与非法 Code 阻断防穿透机制，065 完成了 03 环独立复测；
   - 发现的语义一致性缺陷：此前 `sanitizeErrorCode` 在发现非法 code 时将其纠正为 `CodeInternalError`，但若调用方传入的 HTTP 状态码为 4xx（如 `http.StatusBadRequest` 400 或 404），响应头仍然输出了 400，导致 HTTP 400（客户端错误）与内部错误体 `INTERNAL_ERROR` 出现语义矛盾。
2. **加固目标**：
   - 当 `sanitizeErrorCode` 将非法 code 强制纠正为 `CodeInternalError` 时，如果调用方传入的 status 不是 5xx，强制同步修正为 `http.StatusInternalServerError` (500)；
   - 在 `jsonEnvelopeError` 中发生 fallback 时同样将 `httpStatus` 同步置为 500；
   - 保留调用方原本传入的 5xx 状态（如 502/503 已是服务端故障，不引发 4xx 语义冲突）；
   - 在 `errors_test.go` 中补齐针对上述 HTTP 状态码纠偏的断言与分支覆盖；
   - 验证 `backend/internal/httpapi` 全套件 `-race` 竞态通过。

---

## 2. 【可落地变更】详细实现设计

- **`backend/internal/httpapi/errors.go`**：
  - 增强 `sanitizeErrorCode(r *http.Request, code ErrorCode, status int) (ErrorCode, int)`：
    - 若 `code` 位于 `AllErrorCodes` 闭集中，保持原 `code` 与 `status` 不变；
    - 若 `code` 非法，记录 `slog.WarnContext` 结构化日志，并将 `code` 强制降级为 `CodeInternalError`；
    - 检查 `status`：若 `status < 500 || status > 599`（非 5xx 状态码），强制同步修正为 `http.StatusInternalServerError` (500)；
  - `writeError`：调用 `code, status = sanitizeErrorCode(r, code, status)`，再调用 `w.WriteHeader(status)`；
  - `jsonEnvelopeError`：调用 `errCode, httpStatus = sanitizeErrorCode(r, errCode, httpStatus)`，再调用 `w.WriteHeader(httpStatus)`。

- **`backend/internal/httpapi/errors_test.go`**：
  - 在 `TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode` 中对 `writeError fallback` 与 `jsonEnvelopeError fallback` 增加 `rec.Code == http.StatusInternalServerError` 断言；
  - 增补非 5xx 状态码纠偏（如 404 纠偏为 500）及既有 5xx 状态码保持（如 503 保持为 503）的测试场景。

---

## 3. 【正向实测命令与预期输出】

### 3.1 针对非法 Code 状态码纠偏用例实测
在 `koliance/backend/` 目录下执行命令：
```bash
go test -v -race -count=1 -run TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode ./internal/httpapi/...
```
实测输出：
```text
=== RUN   TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode
=== RUN   TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode/writeError_fallback_corrects_400_to_500
2026/10/13 22:29:27 WARN illegal error code outside closed set; falling back to INTERNAL_ERROR illegalCode=UNKNOWN_ILLEGAL_CODE requestId=bf7cfca95ff5a6577185b4db04aa1a22
=== RUN   TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode/writeError_fallback_corrects_404_to_500
2026/10/13 22:29:27 WARN illegal error code outside closed set; falling back to INTERNAL_ERROR illegalCode=UNKNOWN_ILLEGAL_404 requestId=62e9a07918ab311f468b2f530c092a24
=== RUN   TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode/writeError_fallback_preserves_5xx_status
2026/10/13 22:29:27 WARN illegal error code outside closed set; falling back to INTERNAL_ERROR illegalCode=UNKNOWN_ILLEGAL_503 requestId=ba161d26fd489241ba67bb0b853c36d4
=== RUN   TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode/jsonEnvelopeError_fallback_corrects_400_to_500
2026/10/13 22:29:27 WARN illegal error code outside closed set; falling back to INTERNAL_ERROR illegalCode=UNKNOWN_ILLEGAL_CODE_2 requestId=2fccd8d7b63886cbb781be8c4ecd7d13
--- PASS: TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode (0.01s)
    --- PASS: TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode/writeError_fallback_corrects_400_to_500 (0.01s)
    --- PASS: TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode/writeError_fallback_corrects_404_to_500 (0.00s)
    --- PASS: TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode/writeError_fallback_preserves_5xx_status (0.00s)
    --- PASS: TestWriteErrorAndJsonEnvelopeErrorFallbackOnIllegalCode/jsonEnvelopeError_fallback_corrects_400_to_500 (0.00s)
PASS
ok  	github.com/koliance/backend/internal/httpapi	2.429s
```

### 3.2 `httpapi` 全量套件竞态测试
在 `koliance/backend/` 目录下执行命令：
```bash
go test -v -race -count=1 ./internal/httpapi/...
```
实测输出：全套件通过（ok github.com/koliance/backend/internal/httpapi 5.318s），竞态告警为 0。

---

## 4. 【负向证伪检验】

1. **测试注入非法 Code + 400 状态码**：
   - 证明：`writeError_fallback_corrects_400_to_500` 与 `jsonEnvelopeError_fallback_corrects_400_to_500` 命中，状态码断言 `rec.Code == http.StatusInternalServerError` 成功，避免 HTTP 400 与 INTERNAL_ERROR 语义矛盾。
2. **测试注入非法 Code + 404 状态码**：
   - 证明：`writeError_fallback_corrects_404_to_500` 命中，状态码由 404 被强制纠偏为 500。
3. **测试注入非法 Code + 503 状态码**：
   - 证明：`writeError_fallback_preserves_5xx_status` 命中，状态码保留为 503，保持原有服务端不可用 5xx 语义。
4. **测试合法 Code + 400/404 状态码**：
   - 证明：在 `TestWriteErrorOutputsStandardEnvelope` 与 `TestEveryErrorCodeIsReachable` 中，合法 Code 均保持原有状态码（400/404 等），不被误纠偏。

---

## 5. 【下游同步清单与未竟 GAP】

- [x] 后端 `errors.go` 状态码同步修正
- [x] 后端 `errors_test.go` 纠偏断言补齐
- [x] 运行 `go test -v -race -count=1 ./internal/httpapi/...` 确保全绿
- [x] 建立 `docs/changes/066-后端非法Code降级时状态码语义同步加固.md` 记录
- [ ] 提交当前后端逻辑单元（小步提交）
- [ ] 移交 03 环测试与独立质量审核
