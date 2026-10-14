# 070 — 同步 `docs/CICD-待完成.md`：PR #46 把 4 组环境变量从「可选」变成「必需」

> **环**：发布 / 运维文档（不改任何生产代码）
> **来源**：作者 PR #46（修 issue #35 全部 P0）**删除全部凭证兜底**，使若干变量由「有默认值」变为「缺失即失败」。
> **本文件的性质**：它改的是 `docs/CICD-待完成.md` —— 该文件的**自定章程**是
> 「它是一条**待执行指令**，不是历史记录，故**必须与仓库实测一致**；若某条与实测不符，**以实测为准并更新本文件**（D4）」。
> 故本轮**不是"顺手改文档"**，而是**履行该文件自己写下的维护义务**。
> **基线**：`upstream/main` @ `d72cf26`；分支 `docs/cicd-sync-pr46-env`。

---

## 1. 为什么这条是"部署会踩的坑"，不是格式问题

PR #46 移除了所有凭证兜底 —— 这**正是** issue #35 P0-5 的修法。代价是：

| 变量 | PR #46 之前 | PR #46 之后 | 代码依据 |
| --- | --- | --- | --- |
| `KOLIANCE_SESSION_SECRET` | **不存在** | **必需，≥32 字符**，无兜底 | `src/lib/session.ts:34-37` |
| `KOLIANCE_ALLOWED_ORIGINS` | **不存在**（CORS 曾为 `*`） | **必需**，白名单制 | `src/lib/cors.ts:9-14` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 有占位兜底 | **必需**，缺失抛 `SupabaseConfigError` | `src/lib/supabaseServer.ts:17,23-27` |
| `GOOGLE_CLIENT_SECRET` | 有混淆拼接的明文兜底 | **必需**，缺失返回 `needsConfig` | `src/app/api/auth/google/exchange/route.ts:42,87` |

**为什么它值得单开一条记录**：旧文档把这些描述为「**有硬编码兜底，故不会报错，只会静默用旧值**」（C-2 原话）。
**在 PR #46 之后这句话是反的**——现在它们**会报错**。若作者照旧清单部署，
遇到的现象会是「线上 503」而不是「静默用旧值」，而旧文档**对这个现象只字未提**。
**一份"待执行指令"若与实测相反，它就会把人指向错误的现场**（这正是 D1 禁止的"照过期上下文执行"）。

---

## 2. 本轮的实测（可复跑，供复核）

```powershell
# 1) 两个新变量在代码里确实是硬要求（无兜底）
git grep -n "KOLIANCE_SESSION_SECRET|KOLIANCE_ALLOWED_ORIGINS" upstream/main -- src/
#   src/lib/session.ts:34,37   ← !secret || length < 32 → throw
#   src/lib/cors.ts:9,10       ← 只读 env，无默认

# 2) PR #46 之前的两处兜底确已删除
git show upstream/main:src/lib/supabaseServer.ts | Select-String "SupabaseConfigError|service_role_secret_koliance"
#   → 只剩 throw；占位串不再出现
git show upstream/main:src/app/api/auth/google/exchange/route.ts | Select-String "GOCSPX|clientSecret"
#   → const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";  ← 无混淆兜底

# 3) 旧文档确实没有这两个变量
git grep -n "KOLIANCE_SESSION_SECRET|KOLIANCE_ALLOWED_ORIGINS" upstream/main -- docs/CICD-待完成.md
#   → 零命中（exit=1）
```

**外加一条线上侧实测（供作者判断"部署到底生效没有"）**：

```powershell
Invoke-WebRequest "https://koliance.oodai.space/api/auth/wallet?address=0x0000000000000000000000000000000000000000"
# 2026-10-14 01:30Z 实测 → 404：该路由由 PR #46 新增，404 即"线上构建早于 PR #46"
# 重新部署后的预期读数：405（路由存在，方法是 POST）
```

> **口径**：这一步是**外部探测**，不是仓库读数；它只说明「线上构建落后」，
> **不**说明「作者没部署」——可能仍在构建中或构建失败。已在文中照此措辞，不替作者下结论。

---

## 3. 改了什么（逐处）

| 处 | 改动 |
| --- | --- |
| §0 顶部 | 新增「**2026-10-14 增量**」块：4 组变量的新旧对照表 + 凭证轮换提醒 + **线上 404 的部署新鲜度探测** |
| §0.1 | 「阻塞 6 项」→「**阻塞 8 项**」，增补 **C-6 / C-7**；`29 项` → `31 项` |
| §C 表 | 新增 **C-6**（`KOLIANCE_SESSION_SECRET`）· **C-7**（`KOLIANCE_ALLOWED_ORIGINS`）两行，各带代码依据与后果 |
| §2 对应表 | 新增 C-6/C-7 → `GAP-12` 的对应行；并为 **C-2 补一条更正**（其「有兜底故不会报错」的描述自 2026-10-14 起不成立） |
| 头部基线 | `moonhotline/koliance` → `NeutrinoGroup/koliance`（仓库已迁移）；`9674f53` 读数**保留不改写**，另标本次增量时点 |

> **保留不改写**：原文所有 `9674f53` 时点的行号与读数**逐字保留**——它们是**当时的证据**。
> 只在头部标明「引用行号前请重跑」。这与 `docs/GAP台账.md §5`「历史快照不改写」同一口径。

---

## 4. 本文件不改什么（边界）

- **不配置任何平台**（Vercel / Render / GitHub Settings）——AI 协同方不做 CI/CD（用户裁定）。
- **不动 `.env.example`**：它列的是**本地开发**变量；`KOLIANCE_SESSION_SECRET` 是**服务端**秘密，
  写进 `.env.example` 反而会诱导人把秘密放进 `NEXT_PUBLIC_` 面。是否在 `.env.example` 加一行
  **说明性注释**（不带值）属另一处取舍，**本轮不改**，留待作者或后续轮次。
- **不新开 GAP 编号**：C-6/C-7 是 GAP-12 的续（同源：移除兜底是代码侧，轮换是后台侧）。

---

## 5. 与台账的关系

- **不新开编号**；`docs/GAP台账.md` 的 **GAP-12** 状态**不变**（仍 🔴，阻塞在人工轮换）——
  本轮只是把「PR #46 之后新增了哪两把钥匙」这件事补进**给作者的清单**。
- 台账侧**不需要同步改动**：它记的是「凭证硬编码」这个缺口本身，与「清单要列全」是两件事。
