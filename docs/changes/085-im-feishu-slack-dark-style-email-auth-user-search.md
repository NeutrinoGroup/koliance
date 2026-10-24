# 085 - IM 即时通讯 Feishu/Slack 沉静暗色重构、邮箱快速注册与用户模糊搜索

## 1. 变更背景与用户核心诉求
- **拒接霓虹配色**：全面废弃高饱和青色（#00f2fe）与紫色发光晕染，对齐飞书（Lark）、Slack、Discord 等现代化企业级 IM 沉静高对比暗色规范。
- **用户名与邮箱用户搜索**：支持在添加好友面板中实时通过用户名、邮箱或 0x 钱包地址模糊检索全站注册用户，并支持一键添加为常用联系人。
- **邮箱账户注册与即时体验**：解耦 IM 页面对外部 Monad 钱包的强制依赖，支持通过邮箱快速注册/登录生成安全会话（HMAC-SHA256 会话令牌），允许在无外部钱包注入环境下流畅进行双向图文通信与红包测试。

## 2. 核心代码变更清单
- `src/app/im/page.tsx`:
  - 界面色调重构：采用 `#18191c` / `#232529` / `#2b2d31` 沉静灰黑层级，移除所有青色弥散阴影与霓虹发光。
  - 消息气泡：发送方采用飞书/Telegram 经典科技蓝（`#2563eb`），接收方采用极简中性灰（`#2b2d31` + `#383a40` 微边框）。
  - 用户搜索面板：集成防抖实时检索接口 `GET /api/user/search?q=...`，展示匹配用户姓名、邮箱、头像及绑定钱包，支持一键锁定添加。
  - 身份解耦：优先采用 `effectiveWalletAddress || state.google?.email || user?.id` 统一会话标识，解除邮箱登录用户的通讯录访问拦截。
  - 滚动行为修复：由 DOM 原生 `scrollIntoView` 改造为容器内部滚动 `scrollTop = scrollHeight`，彻底杜绝全局视口抖动。
- `src/components/NavAuthBadges.tsx`:
  - 顶栏 IM 图标与下拉菜单条目移除 `#00f2fe` 霓虹高亮，重构为飞书蓝与中性灰现代几何风格。
- `src/lib/friendsDb.ts`:
  - 扩展 `addFriend` 校验规则，除标准 0x 地址外，原生支持合规邮箱（`user@domain.com`）与统一身份标识（DID）。
- `src/lib/directMessagesDb.ts`:
  - 增加 `userAliases` 别名映射与双向解析，确保邮箱前缀/完整 DID 在消息历史记录查询中无缝穿透关联。
- `src/lib/db.ts`:
  - 新增 `searchPublicUsers(query, excludeUserId)` 方法，按用户名、邮箱、钱包地址模糊匹配，仅暴露安全公共字段。
- `src/app/api/user/search/route.ts`:
  - 新增受保护的用户模糊检索端点，需携带合法 Bearer 会话令牌。
- `src/app/api/auth/email/route.ts`:
  - 新增邮箱免密快速注册/登录端点，自动分配 `did:koliance:email:...` 并签发有效 Session Token。
- `tests/data-layers.test.ts` & `tests/user-api-routes.test.ts` & `tests/im-page.test.ts`:
  - 补充测试用例，覆盖邮箱添加好友、用户模糊搜索、邮箱身份注册、零霓虹色规范校验。

## 3. 门禁验证结果
- **Gate 1 (Frontend & TypeScript)**:
  - `pnpm type:lint`: 通过 (0 错误, 0 类型缺失)
  - `pnpm test`: 36 个测试文件全部通过 (395/395 测试通过)
  - `pnpm build`: Next.js 生产环境构建打包成功 (32/32 静态页面及动态路由编译正常)
- **Gate 2 (Smart Contracts)**:
  - `cd contracts && npx tsc --noEmit`: 通过
- **Gate 3 (Backend Service)**:
  - `cd backend && go vet ./... && go test -race ./...`: 通过
