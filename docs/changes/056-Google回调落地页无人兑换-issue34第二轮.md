# 056 — Google 回调落地的页面上没有人兑换授权码（issue **#34**，第二轮）

> **环**：02 开发（前端，`src/` 内）。**不改 `backend/`、不改 `contracts/`。**
> **分支**：`fix/bug3-4-frontend`（worktree）@ `195580a`（`upstream/main`）。
> **来源**：作者 issue **#34**「Google 登录后不显示用户信息，按钮仍为 Sign In」，**用户第二轮实测仍未解决**。
> **取号（D4 / `AGENTS.md` §6）**：全 ref 并集最大号 **`055`**（持有者 `feat/error-handling`，未合并）→ 本轮取 **`056`**。
> 逐 ref 实测见 §5。
> **先写后填的偏离（照实记）**：与 `049` 同样的偏离——本文件在**根因定型之后**落盘。
> 本轮根因是**读到 `src/app/page.tsx:69` 与 `AgentCardTerminal.tsx:137` 的配合**才定型的，
> 动手前写只会把「049 已经修好了」这个后来被证伪的判断写进记录。

---

## 1. 上一轮修了什么，以及为什么它不够

`049`（PR #37）修的是**读的一半**，而且修得对：账户态从「挂载时拍下的快照」改成「每次渲染从
`localStorage` 推导」，写入统一走 `writeAccountState`，写后必发同文档事件
（`storage` 按规范只在**其它文档**触发，登录所在标签页永远收不到自己的写入——这条是 `049` §1.2 的实测结论）。

**但用户在页面上看的是写的一半，而写的一半从来没跑过。**

## 2. 根因（逐条给证据，全部读自源码）

### 2.1 Google 的 `redirect_uri` 是**站点根**，不是发起登录的那一页

`src/components/NavAuthBadges.tsx:313` 与 `GoogleAuthWall.tsx:136`：

```ts
const redirectUri = encodeURIComponent("https://koliance.oodai.space");
```

Google 只接受与注册值**逐字节相同**的 `redirect_uri`，所以 `state` 里那个 `path`
（`NavAuthBadges.tsx:318`）**对 Google 这一支毫无作用**——不管用户从哪一页点的「Sign In」，
Google 一律把他送回 **`https://koliance.oodai.space/?code=…&scope=…`**，即**首页根路径**。

### 2.2 首页根路径上，这个 `?code=` 被**别人**认领了

| # | 事实 | 处 |
| --- | --- | --- |
| 1 | 首页看到 `?code=` 就切到 **DETAIL** 视图 | `src/app/page.tsx:69` |
| 2 | DETAIL 渲染 `TrustConstellation` → `AgentCardTerminal` | `src/app/page.tsx:429` · `TrustConstellation.tsx:15` |
| 3 | `AgentCardTerminal` 的挂载 effect **无条件**把 `?code=` 当成 GitHub 的，切到 GitHub 页签 | `AgentCardTerminal.tsx:137-148`（改前） |
| 4 | 它先试 `relayTarget(origin, code, rawState)`，而 Google 的 `state` 是 `{origin,path,timestamp}` JSON、**不含 `.`**，`parseState` 直接返回 `null` → 不转发 | `oauthState.ts:82-98` |
| 5 | 于是 `setAttestationTab("github")`，**`GoogleAuthWall` 根本没挂载** | `AgentCardTerminal.tsx:113`（默认页签是 `"steam"`） |
| 6 | 全仓唯一会调 `POST /api/auth/google/exchange` 的，就是 `GoogleAuthWall` | `git grep "auth/google/exchange"` → `GoogleAuthWall.tsx:78` **一处** |

**于是：没有人兑换授权码 → 没有人写 `koliance_google_profile` → 导航栏读到的永远是 `null` → Google 那一行永远是 `Sign In`。**

这不是「049 修得不对」，是 **049 修的那条路（写→通知→重渲染）在这条产品路径上根本不被触发**。
`049` §4.3 用无渲染器的判据宣布了完成，而判据测的是「写进去之后读得到」——
**「有没有人写」这一步没有任何判据**（与 **GAP-73** 同族：修复住在组件里，而没有 DOM 的套件够不到它）。

### 2.3 顺带查实的两条（不是根因，但会让症状「看起来像别的问题」）

| 现象 | 实测 |
| --- | --- |
| **线上部署的包不是 `049` 之后的代码** | 直接抓线上 chunk：`1-928f2fd7880fdca8.js` 里 Google 行的 Unlink 仍是 `localStorage.removeItem("koliance_google_profile")`、Demo 按钮仍是 `localStorage.setItem(...)`，且 `handleGoogleLogin` 仍是 **`linkGoogle` 优先**（`p?void p():void h()`）。`git log -S "koliance-account-changed"` 显示该事件由 `9407467`（PR #37）引入，**线上 24 个 chunk 零命中**。→ **线上跑的是 #37 之前的构建** |
| **线上客户端 bundle 没有内联 `NEXT_PUBLIC_*`——而本机构建复现了同一件事，故这不是部署独有的问题** | 线上 chunk `7237-3a6f66acb9aff4fc.js` 里有 webpack 的 `process` 垫片 `u.title="browser",u.browser=!0,u.env={},u.argv=[]`，且 `1062-…js` 里 Privy 判断是**运行时查找** `o=x.env.NEXT_PUBLIC_PRIVY_APP_ID\|\|""`。**本机 `npx next build`（无 `.env`）产出逐字同形的代码**：`k.env.NEXT_PUBLIC_PRIVY_APP_ID\|\|"";return"string"==typeof i&&25===i.length?…`，且共享 chunk 哈希 `7237-3a6f66acb9aff4fc.js` **与线上完全相同**。→ 本仓客户端读的 `process.env.NEXT_PUBLIC_*` **就是运行时的空对象**，浏览器端一律 `undefined`。**直接后果：`isPrivyEnabled === false`，跑的是非 Privy 的直连 OAuth 支；`NEXT_PUBLIC_GOOGLE_CLIENT_ID` 为 `undefined`，但 `authConfig.ts:7-9` 有硬编码兜底，所以 Google 登录本身仍能走通** |

> 这两条**都不是 `src/` 能修的**（前者是部署，后者是构建期环境变量），但它们解释了**为什么用户第二轮实测看到的
> 仍是最初的症状**：线上既没有 `049` 的代码，也没有 Privy。**如实标 `[未能验证]`，见 §6。**
>
> ⚠️ **一处自查（照实写，并据此更正了本文第一版）**：第一版把「没有内联」写成了**部署平台的配置问题**，
> 依据是「本机若跑 `next build` 就会内联」。**跑了一次就发现不成立**——本机构建与线上产出同形，
> 连共享 chunk 哈希都一样。故结论改为：**`NEXT_PUBLIC_*` 在本仓的客户端 bundle 里就是运行时查找**，
> 与部署平台无关。**这条更正正是 D1 要的形状**：第一版是**推断**（"Next 会内联"），
> 第二版是**实测**（两次构建的产物逐字对比）。

## 3. 改动清单（只动 `src/`）

| 文件 | 改动 |
| --- | --- |
| `src/lib/googleAuth.ts`（**新增**） | 回调的**唯一事实源**：`isGoogleOAuthCallback()`（判别 Google 的 `?code=` 与 GitHub 的）· `parseGoogleCallback()`（三态：`google` / `not-google` / `no-code`）· `exchangeGoogleCode()`（**唯一**的兑换请求，`redirect_uri` 取 `authConfig.OAUTH_REDIRECT_URI` 常量）· `recordGoogleProfile()`（唯一写入点）· `GoogleProfile` 类型 |
| `src/components/GoogleAuthCallback.tsx`（**新增**） | 挂在 **layout**（不是某一页）上的兑换器。①只认 Google 的码；②授权码**单次可用**，故用模块级 `claimedCode` 挡 Strict Mode 的二次挂载（重复兑换会被 Google 拒，用户会看到一个「已经成功了的登录」的报错）；③**先清地址栏再兑换**；④失败**显式报错**，不静默 |
| `src/app/layout.tsx` | 在 `KolianceAuthProvider` **之内**、`children` 之前挂 `<GoogleAuthCallback />` |
| `src/components/GoogleAuthWall.tsx` | `handleExchangeCode` 改调共享的 `exchangeGoogleCode()` + `recordGoogleProfile()`；回调 effect 改用共享判别式；`GoogleProfile` 改为从 `lib/googleAuth` re-export（`AgentCardTerminal` 的 import 不变） |
| `src/components/AgentCardTerminal.tsx` | `?code=` 分支加 `!isGoogleOAuthCallback(params)` 守卫——**这一条是 2.2 的直接修补** |
| `src/components/GitHubDevWall.tsx` | 同一守卫。Google 的码被拿去打 `/api/auth/github/exchange` 必失败，而**码是一次性的**，那次失败会把正在进行的登录一起毁掉 |
| `tests/google-callback.test.ts`（**新增**） | 14 例，见 §4 |

**为什么挂在 layout 而不是首页**：`redirect_uri` 决定落在哪一页，不决定用户从哪一页点的。
挂在首页今天能跑，**改天有人注册一个更深的 `redirect_uri` 就静默失效**；挂在 layout 与它无关。

**为什么不给 `GoogleAuthCallback` 加 `releaseUnlinkedIdentity()`**：解绑闸门
（`authState.ts:334`）是**模块级**状态，一次真实的 OAuth 往返必然**整页加载**、模块状态清零，
所以闸门不可能跨过 Google 往返存活。加一次调用是**永不生效的代码**——正是 D3 说的「看起来有牙、其实没有」。

## 4. 判据与实测（真跑 stdout，采集 2026-10-12）

### 4.1 正向

```
$ npx tsc --noEmit
TSC_EXIT=0

$ npx vitest run
 Test Files  23 passed (23)
      Tests  272 passed (272)
   Duration  39.31s
```

（基线：改动前 `npx tsc --noEmit` exit 0，`npx vitest run` **22 files / 258 tests** 全绿。
本轮 **+1 file / +14 tests**，无既有用例被改。）

### 4.2 新判据在钉什么（14 例）

| 组 | 钉住的事实 |
| --- | --- |
| **两种 `?code=` 的分辨** | Google 的带 `googleapis` scope → `true`；GitHub 的只有 `state` 没有 `scope` → `false`；`scope` 不是 Google 的 → `false`；空 `code` / 无 `code` → `false`；三态判别式把「不是 Google 的回调」与「压根没有回调」**分开**（合成一个 `null` 正是误认领的成因）；再从**真实 URL**（`new URL` + 百分号编码）走一遍 |
| **兑换请求** | 打到唯一的端点常量；`redirect_uri` **等于** `authConfig.OAUTH_REDIRECT_URI`（写死两遍就是漂移，而漂移的后果是登录永远完不成、且直到用户回到页面才看得见）；`wallet_address` 缺省时**不发空串**；路由的错误原文**透传**而不是换成通用文案；`200` 但**没有 profile** 要判失败（改前 `setProfile(data.profile)` 无守卫，会把 `undefined` 存进身份键） |
| **写入到达导航栏读的那条通道** | `recordGoogleProfile()` 之后 `readAccountState().google` 非空，姓名/邮箱/**头像**齐；落盘的 key 就是 `STORAGE_KEYS.google`，字节等于 `JSON.stringify(profile)` |
| **挂载位置（结构性，已标注）** | `<GoogleAuthCallback />` 在 `layout.tsx` 里、且**在 `<KolianceAuthProvider>` 之后**；`AgentCardTerminal` 与 `GitHubDevWall` **都**引用了判别式**并且**把它绑在读上（`if (x && !isGoogleOAuthCallback(`）——只 import 不绑定不算数 |

### 4.3 负向证伪（**四次变异，各自让对应判据变红**；均已还原）

| # | 变异（把缺陷放回去） | 读数 |
| --- | --- | --- |
| ① | 判别式砍掉 scope 那一半（`Boolean(code && scope && scope.includes(...))` → `Boolean(code)`），即**2.2 的误认领本身** | `Tests 3 failed \| 11 passed (14)` |
| ② | 兑换请求的 `redirect_uri` 置空 | `Tests 1 failed \| 13 passed (14)` |
| ③ | `AgentCardTerminal` 的守卫退回改前形态 `if (githubCode) {` | `Tests 1 failed \| 13 passed (14)` |
| ④ | 把 `<GoogleAuthCallback />` 从 `layout.tsx` 摘掉 | `Tests 1 failed \| 13 passed (14)` |
| — | 全部还原后复跑 | `Tests 14 passed (14)` |

**四处各只让「对应那一条」变红**，没有一条是「随便改点什么都红」。

### 4.4 端到端（**真跑浏览器，对生产构建**）——本轮的**关键读数**

`docs/changes/049` 把真机验证标成 `[未能验证]` 并给了「本机无浏览器可驱动」的理由。
**那个理由不成立**（见 §7 的更正）：本机有 `chromium-1234`，`chromium.launch({ executablePath })` 可直接驱动。
于是本轮的端到端**跑到了**，做法是**把 Google 的回调原样伪造到根路径上**：

```
npx next build && npx next start -p 3222
GET http://localhost:3222/?code=4%2F0AY0e-g7testcode
      &scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email%20...
      &authuser=0
（用 page.route 拦 /api/auth/google/exchange，返回一份真实形状的 profile）
```

**结果（真 stdout）：**

```
exchangeCalls = 1
afterLoad     = {"url":"", "stored":"{\"id\":\"did:koliance:google:109842839210492819283\",
                  \"googleId\":\"109842839210492819283\",\"email\":\"ada@example.com\",…}"}
ui            = { "hasAdaName": true, "hasAdaEmail": true, "googleRowStillSignIn": false }

账户中心（展开后读 innerText）：
  "Koliance Unified Account & Asset Center"
  "Google Identity\nada@example.com\nUnlink\nGitHub BUIDL\n+$1,000 USD\n…"
  hasSignOut = true · hasEditProfile = true
```

**逐条对上 issue #34 的两个症状：**

| issue #34 的症状 | 改后读数 |
| --- | --- |
| 「不显示已登录状态与信息」 | 胶囊显示 **Ada Lovelace / ada@example.com**；账户中心里 Google 行显示 `ada@example.com` 与 `Unlink`；出现 `Sign Out` 与 `Edit Profile` |
| 「Google 那行的按钮仍是 `Sign In`」 | **`googleRowStillSignIn = false`**（正则 `/Google Identity[\s\S]{0,200}?Sign In/` 不命中） |
| （改前的机制：没人兑换） | `exchangeCalls = 1`，且地址栏 `?code=` 被清空（`url: ""`） |

**负向对照（同一次运行）**：把 URL 换成 **GitHub 的形状**（`?code=gho_github_code&state=Zm9v.e30`，无 `scope`）
→ **`calls: 0`**，地址栏**保留** `?code=`（留给 GitHub 流程）。
即：判别式在**真实浏览器里**确实把两种回调分开了，不是只在单元测试里分开。

> **仍未验证的那一段**：真实 Google 同意页（需要能走完授权的凭据）与线上部署。
> 上面的端到端**伪造了回调本身**，验证的是「回调到达之后到 UI 变化」这一整段——
> 那正是 `049` 三轮都没验到的一段。**"回调怎么来的"仍靠人工，见 §7。**

## 5. 取号复核（D4：登记前先检索）

逐 ref（`git for-each-ref` + `git ls-tree`，**不用 `git log --all --name-only`**——它会漏 merge 带进来的文件）：

```
refs/heads/feat/error-handling        max=55   <- 055 的持有者（未合并）
refs/remotes/origin/feat/error-handling max=55
refs/heads/fix/bug3-4-frontend        max=54
refs/remotes/upstream/main            max=54
其余 ref                              max<=53
并集最大号 = 055  →  本轮取 056
```

`GAP-77` / `78` / `79` / `80` 在全部 ref 上**零命中**（`docs/changes/054:124` 的既有实测），
但**本轮不新开 GAP 号**——理由见 §6 第 1 条。

## 6. 下游同步清单与未竟

| # | 事项 | 去向 |
| --- | --- | --- |
| 1 | **不新开 GAP 号**：本轮暴露的缺口（「修复所在的那条路径根本不会被走到」）**就是 `GAP-73` 的登记内容**，且已是它的**第四轮实例**（`049` → F1/F5/F7 → 本轮）。按 D4「与既有编号撞车比漏登记更糟」，**并入 `GAP-73`，只追加实例** | `docs/GAP台账.md` §5.11 与汇总表 `GAP-73` 行 |
| 2 | **线上部署落后于 `upstream/main`**：实测线上 24 个 chunk 里 `koliance-account-changed` **零命中**，而该事件由 PR #37（`9407467`）引入；线上 Google 行的 Unlink 仍是 `localStorage.removeItem`。**本仓 `src/` 无法修**，须由作者重新构建/部署 | **`[未能验证]`**，见 §7 |
| 3 | **构建期缺 `NEXT_PUBLIC_*`**：线上 bundle 残留 webpack 的 `process` 垫片（`u.env={}`）且 Privy 判断是运行时查找 → `isPrivyEnabled === false`，跑的是**非 Privy 直连 OAuth**。**本机 `npx next build` 复现同一形态**（同形代码 + 同哈希 `7237-3a6f66acb9aff4fc.js`），故这不是部署平台独有的问题。`authConfig.ts` 的硬编码兜底让 Google 登录仍可用，但 `NEXT_PUBLIC_PRIVY_APP_ID` 事实上没生效 | **构建期环境变量**（在 CI/部署平台注入），不在 `src/` |
| 4 | **组件事件链**（挂载 → 兑换 → 写入 → 导航栏文案变化）**已在本轮用真浏览器验到**（§4.4，对生产构建），但**不在 CI 里**——CI 的 `frontend` job 无 Playwright 步骤，本仓 vitest 又是 `node` 环境无 DOM | 并入 **GAP-73**（不新开号） |
| 5 | `GoogleAuthWall` 的**非 Privy** 分支（`handleLaunchGoogleLogin`）与「快速模拟认证」不经 layout 的回调器，是各自独立的写入点；本轮已让它们与回调器**共用**同一个 `recordGoogleProfile()`，但**未加判据** | 并入 **GAP-73** |
| 6 | 后端 `/api/auth/google/exchange` | **一字未动** |
| 7 | `memory.md` | **未改**（子代理不得改） |

## 7. 未竟 / 明确不做（含人工复核步骤）

| 项 | 处置 |
| --- | --- |
| **线上真机端到端**（Google OAuth 全链路 + 导航栏文案变化） | **未能验证**：真实 Google 客户端 + 可达回调域 + 一个**已完成授权的账号**三者不齐（本机能驱动浏览器，见下方更正；缺的是**能走完 Google 同意页的凭据**），且**线上跑的是 #37 之前的构建**。人工复核步骤见下 |
| ~~本机无浏览器可驱动~~ **（更正）** | 上一轮记的「本机无浏览器可驱动」**不准确**：`@playwright/test` 自带的那份要 `chromium_headless_shell-1248`（本机没装），但本机有 `chromium-1234`，**用 `chromium.launch({ executablePath: "C:\\Users\\Yotoha\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe" })` 可直接驱动**——§4.4 的端到端就是这么跑的。**同一台机器上"跑不了"与"没找对可执行文件"在观测上不可分**（与 `AGENTS.md` §8「工具名被静默丢弃」同族） |
| **`isPrivyEnabled` 在线上为 `false`** | **已坐实**：线上 bundle 与**本机 `npx next build` 的产物同形**（`env.NEXT_PUBLIC_PRIVY_APP_ID\|\|""` 的运行时查找 + 共享 chunk 哈希 `7237-3a6f66acb9aff4fc.js` 相同），故客户端读到的就是 `process.env` 垫片的空对象 → `isPrivyEnabled === false`。**仍未能验证的是**：部署平台是否另有环境变量注入路径（若要坐实，需在部署平台核对 `NEXT_PUBLIC_PRIVY_APP_ID` 是否已配置） |

**人工复核步骤（四步；第 4 步不需要真实 Google 凭据）**

1. **确认部署是否已更新**（这一步先做，否则后面两步都会读到旧包）：
   打开 `https://koliance.oodai.space/`，F12 → Network，任取一个 `/_next/static/chunks/*.js`，
   搜索 `koliance-account-changed`。**搜不到 = 线上仍是 #37 之前的构建，本轮修复尚未上线。**
2. **确认线上跑的是哪一支**：同一 bundle 里搜 `NEXT_PUBLIC_PRIVY_APP_ID`。
   它**以源码形式出现**（而不是一段 `cl…` 的 25 位字面量）= 构建期该变量不在环境里，走非 Privy 直连 OAuth。
3. **走一遍登录**：点右上角头像 → Google 那一行 `Sign In` → 完成 Google 授权 →
   回到站点后应看到：**页面顶部出现绿色「Google 身份验证通过，账户已绑定。」**（失败则是红色并带路由原文）；
   头像胶囊显示 Google 姓名/头像；展开后 Google 行显示 `解除`/`Unlink`，且出现 `Sign Out`。
   **地址栏里的 `?code=` 应当已经消失**（回调器先清后兑）。
4. **（可选）本机复跑 §4.4 的端到端**——不需要真实 Google 凭据：
   ```
   npx next build && npx next start -p 3222
   # 另开一个终端：
   $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE="C:\Users\Yotoha\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe"
   node <伪造回调的脚本>   # 见 §4.4：page.route 拦 exchange + goto "/?code=…&scope=…googleapis…"
   ```
   判据：`exchangeCalls = 1`、`googleRowStillSignIn = false`、Google 行出现 `Unlink`。
