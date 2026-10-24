# 074-gitleaks基线补充与公开合约地址误报消解

## 1. 变更背景与动机 (Context & Rationale)

在推送主干提交 `347898a` 与 `dd20ad3` 至 GitHub 后，GitHub Actions 中的 `secrets (gitleaks)` 任务失败。排查日志发现，Gitleaks 的 `generic-api-key` 启发式规则将已在 Monad 测试网上线的公钥合约地址 `0xCb7f48F455a19778fC75afb0564aaA88b64FA004` 与 `0x4cadb6f0e1b83ccb7207db4786b2a1500f066328` 判定为高熵密钥，触发了 7 处误报（False Positives）。

依据仓库 CI 纪律规范（`.github/workflows/ci.yml:41-50` 与 `docs/changes/037`），历史已提交的误报指纹必须注册在 `.gitleaksignore` 中进行基线抑制，以保障全历史（`fetch-depth: 0`）扫描通过。

---

## 2. 涉及文件 (Touched Files)

- [`.gitleaksignore`](file:///Users/alexander/bwa/koliance/.gitleaksignore): 增加 `347898a` 与 `dd20ad3` 中 7 处 Monad 公共合约地址的误报抑制指纹。
- [`docs/changes/074-gitleaks基线补充与公开合约地址误报消解.md`](file:///Users/alexander/bwa/koliance/docs/changes/074-gitleaks基线补充与公开合约地址误报消解.md): 本记录。

---

## 3. 本地验证与实测依据 (Verification Record)

使用 CI 相同版本 Gitleaks 8.30.1 进行全历史扫描：
```bash
$ /tmp/gitleaks git --redact --no-banner --verbose .
12:21PM INF 242 commits scanned.
12:21PM INF scanned ~6187959 bytes (6.19 MB) in 607ms
12:21PM INF no leaks found
```
退出码为 0，零泄露误报。
