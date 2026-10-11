# CI/CD 待完成清单 —— 需作者在外部平台补充的信息

> **一句话边界**：**AI 协同方不参与 CI/CD**——不配置、不修改任何流水线、不碰任何平台配置。
> 本文件只做一件事：**列出「只能由作者在 GitHub / Render / Vercel / Monad 等外部平台操作」的信息缺口**，
> 以及每条缺口的**实测依据、不补的后果、是否阻塞当前进度**。

- **仓库**：`moonhotline/koliance`（本分支 `docs/cicd-todo`，基于 `upstream/main`）
- **取证基线**：HEAD = `9674f53`；全部行号与命令输出为 **2026-10-11（UTC）在本分支实测**（D1）。
- **本文件的性质**：它是一条**待执行指令**，不是历史记录——故**必须与仓库实测一致**。
  若某条与仓库实测不符，**以实测为准并更新本文件**（D4）。

---

## 0. 怎么用这份清单

1. 每行是一件事，**只做「在哪里补」那一列**。
2. `谁做` 只有两种取值：**作者**（人，外部后台）或**平台**（托管方自动完成）。
   **没有一条是 AI 协同方能代办的**——这正是本文件存在的原因。
3. `阻塞` 列只标**是否阻塞当前可交付款**；`阻塞=否` 不等于「不必做」，只等于「现在不做也能跑」。
4. **本文件不列已经配好的项**（如 `render.yaml` 里已写死值的 `PORT` / `ENVIRONMENT` / `MONAD_*`），
   也不列**实测确认不需要**的项——后者仍单列出来（A-2），免得有人去配一堆多余的 secret。

---

## 1. 总览：缺什么 / 在哪补 / 为什么 / 不补的后果

> 依据列的文件路径**均在仓库内**（本仓即框架，见 `AGENTS.md` §5 入库策略），clone 后可直接打开核对。

### A. GitHub Actions（平台：仓库 Settings → Secrets and variables → Actions）

| 编号 | 缺什么 | 在哪补 | 实测依据 | 不补的后果 | 谁做 | 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| **A-1** | `BACKEND_API_URL` | GitHub 仓库 secret | `.github/workflows/keepalive.yml:15` 读 `secrets.BACKEND_API_URL` | 回落到硬编码默认 `https://koliance-backend.onrender.com`（同文件 `:15`，即 `render.yaml` 的服务名 `koliance-backend`）。**后端换域名时会静默探错地址**——keepalive 报 `[WARN]` 却不拦任何东西（`:22`），即**失败无声** | 作者 | 否 |
| **A-2** | **不需要任何 secret**（**已核实，勿加**） | — | `git grep -n "secrets\\." -- .github/` → **仅命中 `keepalive.yml:15` 一处**；`ci.yml` 的四个 job（`secrets:60` / `contracts:82` / `frontend:134` / `backend:169`）**零 `secrets.` 引用** | 多配 secret 无害但也无用；**且容易让人以为「CI 需要 PRIVATE_KEY」**——它不需要（见 A-3） | — | 否 |
| **A-3** | `PRIVATE_KEY` / `ETHERSCAN_API_KEY` **不进 CI** | 不要放进 CI secrets | `ci.yml:113-132` 的四步（compile / tsc / test --coverage / 覆盖率地板）**全部在进程内 hardhat 链上跑**，不联网部署；`contracts/hardhat.config.ts:24,30` 的两个 `configVariable("PRIVATE_KEY")` 只在 `monadTestnet` / `monadMainnet` 两个 http 网络下才求值 | 若误把部署私钥放进 CI secret，等于**让任何能改 workflow 的 PR 拿到出金私钥**。这两者属 §D 的本地/人工部署凭证 | 作者（不要做） | 否 |

### B. Render 后端环境变量（平台：Render dashboard；`render.yaml` 是 blueprint）

> `render.yaml:10-11` 为 `autoDeploy: true` + `healthCheckPath: /healthz`，故**任何改动一推即生效**。

| 编号 | 缺什么 | 在哪补 | 实测依据 | 不补的后果 | 谁做 | 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| **B-1** | `DATABASE_URL` | Render 面板（`render.yaml:31-32` 已声明 `sync: false`） | 读取处 `backend/internal/config/config.go:53`；同文件 `:53` 默认空串 | 后端**不报错、不阻断**，静默切内存态（`backend/internal/platform/database/db.go:56,66,71`）——即 **GAP-49** | 作者 | 否 |
| **B-2** | `KOLIANCE_API_TOKEN` | Render 面板（`render.yaml:44-45`） | 读取处 `config.go:67`；**缺失即 fail-closed**（`config.go:69-71` 打日志，operator 端点一律 503） | `batch-settle` / Stripe customer / Alpaca 写操作**全部 503**；演示的运营侧动作做不了 | 作者 | **是**（演示运营路径） |
| **B-3** | `STEAM_API_KEY` | Render 面板（`render.yaml:17-18`） | 读取处 `config.go:54`，**该行带明文默认值** | 后端不再从面板取值，**静默回落到已泄露的旧密钥**——正是 GAP-12 要拆掉的那条路 | 作者 | 否 |
| **B-4** | `ALPACA_API_KEY` / `ALPACA_API_SECRET` | Render 面板（`render.yaml:21-24`） | 读取处 `config.go:56-57`，**两行均带明文默认值** | 同 B-3：静默回落到已泄露的旧值；Alpaca 侧一旦轮换，**线上行情/下单直接失效** | 作者 | 否 |
| **B-5** | `STRIPE_SECRET_KEY` | Render 面板（`render.yaml:29-30`） | 读取处 `config.go:60`，**默认空串** | Stripe checkout / customer 调用失败（充值路径不可用） | 作者 | 否 |
| **B-6** | `STRIPE_PUBLISHABLE_KEY` | Render 面板（`render.yaml:27-28`） | 读取处 `config.go`，~~带明文默认值~~ 已移除默认值，仅从环境变量读取 | 同 B-3（可发布键，风险较低，但轮换后仍需同步） | 作者 | 否 |
| **B-7** | `CORS_ALLOWED_ORIGINS` | **已配**（`render.yaml:40-41` 有值） | 读取处 `config.go:66`；默认值 `config.go:42` | 仅当前端域名变更时需改；**改动即影响浏览器能否调后端** | 作者 | 否 |
| **B-8** | `DEMO_PUBLIC_TRADING` 的**取值裁定** | Render 面板或 `render.yaml:49-50` | 读取处 `config.go:68`；`render.yaml:49-50` 现为 `"true"` | 现值 `true` = **浏览器无需 operator token 即可下 Alpaca paper 单**（`render.yaml:46-48` 的注释即此意）。演示后若要收回，**这是要改的那一行** | 作者（需裁定） | 否 |
| **B-9** | `STEAM_DOMAIN` 是否仍为 `koliance.oodai.space` | Render 面板 / `render.yaml:19-20` | 该值被用于 **Stripe 成功/取消回跳**（`backend/internal/httpapi/router.go:428,434`），非仅显示 | 域名变更而不改此值 → Stripe 回跳到旧域；且 `SteamDomain` 的命名与用途已不符（**命名误导，非缺陷**） | 作者 | 否 |

### C. Vercel 前端环境变量（平台：Vercel 项目 Settings → Environment Variables）

> `.vercelignore:2-5` 把 `contracts/`、`backend/`、`.env*`、`*.sol` 排除在 Vercel 构建之外，
> 故**前端只拿 Vercel 面板里的变量**，读不到仓库里的任何 `.env`。

| 编号 | 缺什么 | 在哪补 | 实测依据 | 不补的后果 | 谁做 | 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| **C-1** | 客户端五项：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_GITHUB_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_PRIVY_APP_ID` | Vercel 面板（同名，`.env.example:16,17,18,19,21`） | 读取处：`src/lib/db.ts:6,8`、`src/lib/authConfig.ts:8,12`、`src/components/Providers.tsx:140` | 每一项都有**硬编码兜底**，故**不会报错**，只会**静默用旧值**；Privy 另有长度校验（`Providers.tsx:141-142`，App ID 必须 25 字符），不满足即**静默禁用 Privy** | 作者 | 否 |
| **C-2** | 服务端密钥四项：`GITHUB_CLIENT_SECRET` / `GOOGLE_CLIENT_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_GO_BACKEND_URL` | Vercel 面板 | `src/app/api/auth/github/exchange/route.ts:51`（回落 `:53` 硬编码）、`src/app/api/auth/google/exchange/route.ts:46`（回落 `:16` 混淆拼接的明文）、`src/lib/supabaseServer.ts:11`（回落 `:13` 占位串）、`src/lib/api.ts:3`（默认 `http://localhost:8080`） | 前三个回落=**线上用泄露的旧凭据**；第四个不配 = **线上前端去调 localhost**（真数据全无）。注意 `.env.example:28` 该变量本身也写的是 `localhost:8080`——**照抄 `.env.example` 进 Vercel 是个陷阱**。`supabaseServer.ts:8-9` 明写该键**不得**带 `NEXT_PUBLIC_` 前缀 | 作者 | **是**（后端数据联调） |
| **C-3** | Perp 四地址：`NEXT_PUBLIC_PERP_USDC` / `_ORACLE` / `_VAULT` / `_POSITION_MANAGER` | Vercel 面板（`.env.example:8-11`） | 读取处 `src/lib/perpConfig.ts:95-98`；门禁 `PERP_IS_CONFIGURED` 在 `:102-106` | 面板**拒绝显示任何数字**，`/perp` 与演示控制台显示「Perp 模块未配置」（`src/components/PositionPanel.tsx:409-417`、`src/components/DemoControlPanel.tsx:278-283`）。**这是设计行为，不是 bug** | 作者（值来自 §D） | **是**（阻塞于 D-1） |
| **C-4** | `NEXT_PUBLIC_OAUTH_RELAY_ORIGINS`（可选） | Vercel 面板（`.env.example:25`） | `src/lib/oauthState.ts:22-27` 硬编码默认白名单 = `koliance.oodai.space` / `koliance.vercel.app` / localhost:3000 / 127.0.0.1:3000；`:38-40` 为**精确匹配** | **若 Vercel 生产域名不是上面四个之一**（例如 `koliance-git-xxx.vercel.app`），GitHub OAuth 跨域回跳会被拒（`:126`）；此时**必须**用本变量显式加白 | 作者 | **是**（仅当域名不在默认白名单内） |
| **C-5** | `NEXT_PUBLIC_KOLIANCE_ADDRESS` / `NEXT_PUBLIC_KOL_TOKEN_ADDRESS` | Vercel 面板（`.env.example:4-5`） | 读取处 `src/lib/contract.ts:41,45`，两者均有已部署地址兜底 | 不配也能跑；**但兜底值是身份合约的旧地址**——合约重新部署（见 `deploy/README.md:124-132` 的回滚段）后必须同步 | 作者 | 否 |

### D. 部署阻塞：合约 → Monad 测试网

| 编号 | 缺什么 | 在哪补 | 实测依据 | 不补的后果 | 谁做 | 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| **D-1** | `PRIVATE_KEY`（**该地址还需有 Monad 测试币**） | 本地 `contracts/.env`（模板 `contracts/.env.example:1`） | `contracts/hardhat.config.ts:24,30` 用 `configVariable("PRIVATE_KEY")`；`deploy/README.md:45-48` 明写「这是 GAP-26 唯一剩余的阻塞」；`docs/GAP台账.md:185` 同判 | perp 栈与 `SessionKeyRegistry` **一个都没部署**；连带 **GAP-26**（perp 未部署）、**GAP-45**（清算大屏无数据源）、§C-3（前端四地址无从取值）；`/perp` 永久显示「未配置」 | 作者 | **是**（P0，最大单点） |
| **D-2** | `ETHERSCAN_API_KEY` | 本地 `contracts/.env`（模板 `contracts/.env.example:2`） | `contracts/hardhat.config.ts:40`（`verify.etherscan.enabled: true`，`:38`） | 合约**验证**这一步不可用。`hardhat.config.ts:17-33`（`networks`）与 `:34-46`（`verify`）是两段独立配置；本文件**只断言 verify 需要该 key**，**不断言 ignition 部署是否受影响**——二者关系**未实测**，[未能验证] | 作者 | 否 |

### E. 凭证轮换（GAP-12）—— 纯外部后台操作，AI 无法代办

> **判据**：`git grep -l -E "<值>"` 在本分支实测，明文值**当前仍在**下列文件里；且 git 历史不可清理 →
> **泄露已成事实，删掉当前行不会让它们重新变成秘密**（`deploy/README.md:19-20` 同判）。
>
> **范围更正（实测）**：`config.go:54-60` **仍在**带明文默认值；而 `render.yaml` **已不再有**
> ——`git grep -n -E "745B577|PK2SMWL|Eh8yhX5|pk_test_51" -- render.yaml` → **exit=1（零命中）**。
> 这与 `deploy/README.md:8-32` 的描述不符，详见 §3。

| 编号 | 缺什么 | 在哪补 | 实测依据（值仍在） | 不补的后果 | 谁做 | 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| **E-1** | Steam Web API Key 轮换 | Steam 后台 | `backend/internal/config/config.go:54` | 密钥对任何 clone 者公开 | 作者 | 否 |
| **E-2** | Alpaca Key + Secret 轮换 | Alpaca 后台 | `config.go:56-57` | 可被他人以你的账号下 paper 单 | 作者 | 否 |
| **E-3** | Stripe Publishable Key 轮换 | Stripe 后台 | `config.go:59`（`deploy/README.md:16` 标为「公开键，风险较低」） | 低 | 作者 | 否 |
| **E-4** | GitHub OAuth Client Secret 轮换 | GitHub OAuth App | `src/app/api/auth/github/exchange/route.ts:53`（明文兜底） | 可伪造授权码交换 | 作者 | 否 |
| **E-5** | Google OAuth Client Secret 轮换 | Google Cloud Console | `src/app/api/auth/google/exchange/route.ts:16`（以数组拼接"混淆"，**非加密**） | 同 E-4 | 作者 | 否 |
| **E-6** | Supabase Service Role Key 核实 | Supabase 后台 | `src/lib/supabaseServer.ts:13` 的兜底串（`sb_service_role_secret_koliance` 形态） | 若该串曾是真值，则**它绕过 RLS**（`:8-9` 的注释即此意） | 作者 | 否 |
| **E-7** | **顺序不可颠倒**（做 E-1~E-6 的前置约束） | — | `docs/GAP台账.md:215-220` | 先改代码后轮换 = 「用一个缺失的配置换掉一个已泄露的密钥」，服务直接挂 | 作者 | 否 |

### F. 仓库设置（GitHub，**无法用代码提交完成**）

| 编号 | 缺什么 | 在哪补 | 实测依据 | 不补的后果 | 谁做 | 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| **F-1** | 分支保护 required check（把 CI 设为必需） | GitHub 仓库 Settings → Branches | `docs/changes/003-CI门禁.md:98`、`docs/changes/009-CI首跑修复.md:234`、`docs/GAP台账.md:169` 三处均明写「无法用代码提交完成」；`docs/planning/执行方案-自治Agent清结算.md:405` 把「required check 绿」定为 03 环准出的**唯一凭据** | CI 会跑，但**不拦合并**——红灯 PR 照样能合。**这是「判据没有牙」的典型**（D3） | 作者 | **是**（03 环准出） |
| **F-2** | 上游仓开启 Actions | GitHub 仓库 Settings → Actions | `ci.yml:22-30` 的注释：fork 的 `pull_request` 运行**需要上游仓开启 Actions 且 base 分支上已有该 workflow** | 贡献者从 fork 提的 PR **看不到 CI 结果**；现有 `push: branches: ["**"]`（`ci.yml:31-32`）已绕开这条依赖，故**不补也能跑**，补了才算完整 | 作者 | 否 |
| **F-3** | `.gitleaksignore` 的持续维护 | 仓库文件（16 行，实测存在） | `ci.yml:47-50` 的口径：抑制项是 `<commit>:<file>:<rule>:<line>` **指纹**，钉在旧提交上；**:45-46** 说明为何扫全历史（`fetch-depth: 0`）而非只扫推送区间 | **把旧密钥的值复制/移动到任何新提交 = 新指纹 = CI 红**（`ci.yml:49-50`）。故交付物里**一律不得再出现这些值**；如确需豁免，由作者补登记 | 作者 | 否（但会让 CI 红） |

---

## 2. 与既有台账的对应

| 本文件条目 | 对应台账编号 | 说明 |
| --- | --- | --- |
| E-1 ~ E-6 | **GAP-12**（`docs/GAP台账.md:77`, §3 详述于 `:205-220`） | 状态标 `红色`（见台账 §1 图例），阻塞列写的就是「需人工轮换密钥」 |
| D-1 | **GAP-26**（`docs/GAP台账.md:91,185`） | 状态标 `橙色`（见台账 §1 图例）；「链上部署」一行明确「需要 `PRIVATE_KEY` + Monad 测试币」 |
| D-1 → C-3 | **GAP-45**（`docs/GAP台账.md:116`，§5.1） | 「清算结果大屏未接」**阻塞于 GAP-26** |
| B-1 | **GAP-49**（`docs/GAP台账.md:496`） | 无 Supabase 凭据时 DB 层静默降级内存态 |
| F-1 | 无独立编号（散在 `docs/changes/003` / `009` / `GAP台账` §2） | **本次不新开编号**：它是既有三处已记录事项，重开属编号撞车（D4） |

> **本文件不改台账、不新开编号**（AI 协同方不在本文件的作用域内新增/变更编号）。

---

## 3. 实测发现的一处漂移（[WARN] 需作者裁决）

**`deploy/README.md` §0（`:8-32`）描述的 `render.yaml` 明文密钥，在 HEAD 上已不成立。**

| 项 | `deploy/README.md:8-32` 的陈述 | HEAD 实测 |
| --- | --- | --- |
| `render.yaml` 中的 `STEAM_API_KEY` / `ALPACA_API_KEY` / `ALPACA_API_SECRET` / `STRIPE_PUBLISHABLE_KEY` | 「**明文**」 | **已是 `sync: false`**（`render.yaml:17-18`、`:21-24`、`:27-28`） |
| 复核命令 | — | `git grep -n -E "745B577\|PK2SMWL\|Eh8yhX5\|pk_test_51" -- render.yaml` → **exit=1，零命中** |

- **改动它的提交**：`ffc13f4`（该提交是**与上游 `main` 的合并**，经 `git merge-base --is-ancestor ffc13f4 HEAD` 实测为 HEAD 祖先，exit=0）；
  `render.yaml` 在本分支共有 4 个提交，明文形态见于最早的 `ff5df6a`。
- **结论**：`deploy/README.md:22-27` 教的改法（改为 `sync: false`）**已经落地**；
  `:29-32` 那条风险告诫（「改之前必须确认这些值已存在于 Render 面板，否则线上后端会挂」）**其后果已无法回退**。
- **[未能验证]**：Render 面板里**是否真的有**这些值——本项**只能由作者在 Render 面板核对**，
  仓库侧没有任何判据。若面板里没有，**线上后端此刻可能已经在用 `config.go` 里的明文兜底值**（E-1~E-3）。
- **处置**：按纪律「发现漂移**先登记，不擅自顺手改对**」，**本文件不改 `deploy/README.md`**——
  改它=改设计文档，需人确认。

---

## 4. 本文件不覆盖什么（边界重述）

| 不做 | 理由 |
| --- | --- |
| 不配置 / 不修改任何 CI/CD 流水线与平台配置 | **AI 协同方不做 CI/CD**（用户裁定） |
| 不改 `.github/`、`render.yaml`、`vercel.json`、`.vercelignore` | 同上；且属平台配置面 |
| 不在仓库任何文件里写密钥值 | `ci.yml:60-80`（gitleaks 全历史扫描）+ `.gitleaksignore` 指纹机制 |
| 不新开 GAP 编号 | 上述缺口**均已被既有编号覆盖**（§2） |
| 不代替作者做平台侧核对 | Render / Vercel / GitHub Settings / Steam / Alpaca / Stripe / Google Cloud 均**无仓库侧判据** |

---

## 5. 取证命令（可复跑，供复核）

```powershell
# 0) 定位仓库根与基线
git rev-parse --show-toplevel; git rev-parse --short HEAD

# A) CI 是否需要 secret
git grep -n "secrets\." -- .github/                      # 期望：仅 keepalive.yml:15
git grep -n -E "^  [a-z-]+:$" -- .github/workflows/ci.yml  # 期望：secrets/contracts/frontend/backend 四 job

# B/C) 环境变量清单是否与代码读取一致
git grep -n -o -E "NEXT_PUBLIC_[A-Z0-9_]+" -- src/        # 与 .env.example 逐条比对
git grep -n -E "Getenv\(" -- backend/internal/config/config.go   # 后端读取的全部键

# D) 部署凭证的读取处
git grep -n "configVariable" -- contracts/hardhat.config.ts

# E) 明文值是否仍在当前树中（只列文件，不打印值）
git grep -l -E "745B577BC3554647B4FA40BE9635E838" -- .

# 3) 漂移复核：render.yaml 是否还有明文
git grep -n -E "745B577|PK2SMWL|Eh8yhX5|pk_test_51" -- render.yaml  # 期望 exit=1
```

> **命令的诚实标注**：以上命令**本文件撰写时已逐条跑过**（`git grep` / `git rev-parse` / `Test-Path`），
> 输出已用于填写依据列。**涉及平台面板的结论一律标 `[未能验证]`**——
> 平台侧状态**不在本仓库的判据范围内**，仓库里也没有任何能替代它的读数（D1）。
