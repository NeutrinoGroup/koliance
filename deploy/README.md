# 发布（Deployment）

> **本目录是六环流水线中「**发布**」环的可执行步骤**（其余五环见 `docs/planning/`）。
> `想法记录.md` #4 把运维/故障/迭代划给平台，但**发布**在范围内 —— 所以它有据可循，而不是靠记。

---

## 0. Prerequisite: Rotate and Exclude Plaintext Secrets (GAP-12)

**在部署之前**，`render.yaml` 里有**明文密钥**：

| 键 | 现状 |
| --- | --- |
| `STEAM_API_KEY` | 明文（`config.go` 里仍是 `getEnv` 的默认值） |
| `ALPACA_API_KEY` / `ALPACA_API_SECRET` | [OK] **代码侧已消除**：`docs/changes/027` 删掉了 `config.go` 的两处默认值，未配置即 503；`render.yaml` 里两项本就是 `sync: false`。**但历史里的值仍须轮换** |
| `STRIPE_PUBLISHABLE_KEY` | 明文（公开键，风险较低；`config.go` 里仍是默认值） |
| `STRIPE_SECRET_KEY` / `DATABASE_URL` | [OK] 已是 `sync: false`（读自 Render 面板） |
| `ALPACA_DATA_URL` / `ALPACA_DATA_FEED` / `PYTH_HERMES_URL` | [OK] 非密钥，`render.yaml` 里是显式 `value` |

**泄露已成事实**——这些值在 git 历史里，删掉当前行**不会**让它们重新变成秘密。**必须去各后台轮换**
（Steam / Alpaca / Stripe），这是**人工操作，无法用代码完成**。

轮换后，把 `render.yaml` 里那几行改成与同文件既有写法一致的形态：

```yaml
      - key: STEAM_API_KEY
        sync: false          # 值放 Render 面板，不进仓库
```

> [WARN] **改之前必须确认**：这些值**已经存在于 Render 的面板**里。
> `autoDeploy: true`，所以改动一推上去就会触发重新部署；
> 若面板里没有这些值，改成 `sync: false` 会让**线上后端拿不到密钥而挂掉**。
> **这正是本次没有单方面改它的原因** —— 代码侧把改动准备好，落地时机由你定。

---

## 1. 合约 → Monad 测试网（10143）

```bash
cd contracts
npx hardhat compile
npx hardhat ignition deploy ignition/modules/PerpStack.ts      --network monadTestnet
npx hardhat ignition deploy ignition/modules/SessionKeyRegistry.ts --network monadTestnet
```

**前置**：`contracts/.env` 里有 `PRIVATE_KEY`（且该地址有测试币）。

> **这是 GAP-26 唯一剩余的阻塞**：perp 栈与 `SessionKeyRegistry` 的 ignition 模块**都已就绪**
> （本地已验证可部署），只差凭证与测试币。

**验收**：Monad 浏览器上能看到地址；`ignition/deployments/` 产物**不进仓库**（GAP-36 已修，
可用 `git status` 确认它们没出现——**这正是那次修复的真实回归**）。

## 2. 灌入演示数据

```bash
cd contracts
npx hardhat run scripts/demo-seed.ts --network monadTestnet
```

打印四个地址与状态。**注意它会把资金费率设到上限 1e13**，
使演示自带约 **42 分钟的资金费时钟**（实测，见 `docs/changes/016`）——
演示若拖长，拥挤侧会在无人调价的情况下自己清算。

## 3. 前端环境变量 → Vercel

把上一步打印的地址填进 Vercel 的环境变量（与 `.env.example` 同名）：

完整清单**以 `.env.example` 为准**（本次已补齐其中缺失的 4 个）。与 perp 相关的四项：

```
NEXT_PUBLIC_KOLIANCE_ADDRESS=          # 身份合约
NEXT_PUBLIC_KOL_TOKEN_ADDRESS=          # KOL 代币
NEXT_PUBLIC_PERP_USDC=                 # 第 2 步打印
NEXT_PUBLIC_PERP_ORACLE=
NEXT_PUBLIC_PERP_VAULT=
NEXT_PUBLIC_PERP_POSITION_MANAGER=
```

> **`SessionKeyRegistry` 的地址目前没有前端消费方。** 合约已建、已测（`docs/changes/013`），
> 但**前端还没有授权面板**去读它，所以**不需要**环境变量。
> 等面板落地时再加 `NEXT_PUBLIC_SESSION_KEY_REGISTRY`——**不要现在预先加上**，
> 一个没有人读的变量只会让人以为它生效了。

认证与后端另需：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
`NEXT_PUBLIC_GITHUB_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GO_BACKEND_URL`。

**未配置时的行为**：`PERP_IS_CONFIGURED` 为假，`/perp` 与演示控制台会显示
「Perp 模块未配置」。**这是设计行为，不是 bug** —— 面板拒绝显示任何数字，因为没有真实数据可显示。

## 4. 后端 → Render

`render.yaml` 已定义（`rootDir: backend`，`go build -o api cmd/api/main.go`）。
推送即 `autoDeploy`。

> ⚠️ **`DATABASE_URL` 现在是硬前置**（`docs/changes/027` / GAP-49）：缺失或连不上时进程
> **非零退出并打印明确错误**，**不再**回落到内存态。故本次变更后：
> **`render.yaml` 里 `DATABASE_URL` 若未在面板配好，后端会直接起不来**——这是有意行为
> （此前它"起来了"，但所有业务路由 200 而什么都不落盘）。
> 见 `backend/README.md` 的「数据库：启动即失败」一节。
>
> 同批：`cmd/migrate` 在**一个 `.sql` 都没读到**时也改为报错退出，不再打印"全部应用成功"。

## 5. 发布后核验

```bash
# 合约：四个参数 getter 读回的就是实际部署值（不会被配置文件的旧值骗到）
cast call <POSITION_MANAGER> "maintenanceMarginBps()(uint256)" --rpc-url https://testnet-rpc.monad.xyz
cast call <POSITION_MANAGER> "maxLeverageBps()(uint256)"       --rpc-url https://testnet-rpc.monad.xyz
```

浏览器侧：打开 `/perp`，应看到**真实链上数字**（不是 mock）；
开一笔仓 → 用演示控制台调低价格 → 一键清算 → 流水区出现记录。

---

## 演示彩排清单（`推进方案.md` §3.5）

| 步 | 动作 | 由谁验证 |
| --- | --- | --- |
| 1 | 冷启动 → 连钱包 → 自动切到 10143 | 人工 |
| 2 | 灌入流动性 | `demo-seed.ts` |
| 3 | 开 20 笔混合方向仓位 | `demo-seed.ts` |
| 4 | 点「调低价格」→ 头寸变红 → 一键清算 → 出块确认 | `DemoControlPanel` |
| 5 | 全程 90 秒内走完，无手动补救 | 人工 |

**前四步已被自动化覆盖**：`contracts/test/perp/DemoRehearsal.ts` 把整条序列跑成测试
（含"恰好 14 笔多头可清算、6 笔空头幸免"与"清算是**一次**调用而非二十次"）。
**第 5 步只能人工** —— 但它现在是唯一需要人工的一步。

---

## 回滚

合约**不可升级**，没有链上回滚。回滚的含义是：

1. 前端回退到上一个 Vercel 部署（面板会因地址变更而显示"未配置"，好过显示错误的数字）；
2. 合约重新部署，**换新地址**，前端环境变量随之更新。

**这也是为什么 `PERP_IS_CONFIGURED` 是硬门禁**：地址变了而前端没跟上时，
面板会**拒绝显示**，而不是把旧地址的数据当新的展示。
