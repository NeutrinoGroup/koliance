# 086: IM 聊天图标切换为 MessagesSquare 双气泡风格

**Date**: 2026-10-24
**Scope**: Frontend UI & Navigation Icons
**Author**: Antigravity Pair Programming

---

## 1. 变更背景与用户决策 (Background & User Selection)

- **用户需求**: 用户希望更换顶部导航栏及 IM 相关区域的聊天图标，并从多种候选风格中进行选择。
- **决策结论**: 用户通过交互式选项选中了 **`MessagesSquare` (Slack / Feishu 双层会话气泡风格)**，以突出多人通讯、常用联系人与企业级即时消息属性。

---

## 2. 变更范围与改动细节 (Touched Files & Changes)

1. **`src/components/NavAuthBadges.tsx`**:
   - 将 `MessageSquare` 替换为 `MessagesSquare`。
   - 顶部导航栏直达按钮：`<MessagesSquare className="w-4 h-4" />`。
   - 统一账户中心下拉菜单快捷入口：`<MessagesSquare className="w-3.5 h-3.5 text-blue-400" />`。
   - 账户中心双列网格入口：`<MessagesSquare className="w-3 h-3 text-blue-400" />`。

2. **`src/app/im/page.tsx`**:
   - 将 `MessageSquare` 替换为 `MessagesSquare`。
   - 顶部状态栏图标徽章：`<MessagesSquare className="w-4 h-4" />`。
   - 会话流空状态插画：`<MessagesSquare className="w-10 h-10 text-zinc-500 opacity-60" />`。
   - 访客/未选中状态终端居中图标：`<MessagesSquare className="w-7 h-7" />`。

3. **`src/components/TransferModal.tsx`**:
   - 将 `MessageSquare` 替换为 `MessagesSquare`。
   - 转账成功后聊天凭证快捷跳转：`<MessagesSquare className="w-3.5 h-3.5 text-purple-300" />`（同时清理原 `#00f2fe` 霓虹配色，严格遵循 AGENTS.md 规范）。
   - 联系人卡片快捷聊天按钮与地址栏直达聊天按钮同步更新。

4. **`tests/im-page.test.ts`**:
   - 同步测试断言为 `expect(navAuthContent).toContain("<MessagesSquare");`，保证回归测试 100% 通过。

---

## 3. 门禁验证结果 (Verification Gates)

- **Gate 1 (TypeScript & Lint)**:
  ```bash
  pnpm type:lint # Passed (0 errors)
  pnpm test      # Passed (36 test files, 395/395 passed)
  pnpm build     # Passed (Next.js 15.5.27, 32/32 routes compiled)
  ```
- **Gate 2 (Contracts)**:
  ```bash
  cd contracts && npx tsc --noEmit # Passed
  ```
- **Gate 3 (Go Backend)**:
  ```bash
  cd backend && go vet ./... && go test -race ./... # Passed
  ```
- **Browser Visual Verification**:
  - `screenshot_new_chat_icon_navbar.png`: 验证首页顶部导航栏常驻双气泡图标及蓝点提示。
  - `screenshot_new_chat_icon_im_page.png`: 验证 `/im` 页面标题栏及中心卡片双气泡图标生效。
