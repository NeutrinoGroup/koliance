# 035-mobile-responsive-navbar-and-touch-guard.md

## 1. Rationale & Requirements Alignment (背景与目标)

User request:
1. Navbar 抽屉折叠 (Hamburger Drawer):
   - 桌面端 (>= md): 保持现有的高端长条胶囊导航栏，不破坏既有设计。
   - 移动端 (< md):
     - 隐藏中间的 8 项横向导航条，彻底解决小屏空间挤压与水平溢出；
     - 右侧保留账户头像图标与现代轻量汉堡菜单触发器 (Menu / X 按钮)；
     - 点击汉堡按钮后展开垂直全宽抽屉，展示 8 个导航项与语言切换，点击后自动收起并切换视图。
2. 弹窗/模态框视口自适应 (vw Safe Bounds):
   - 解决账户卡片超界截断问题，确保移动端小屏两侧保持安全边距 (`fixed inset-x-3 top-14`，自适应 `100vw - 24px`，带 `max-h-[85vh]` 滚动与空白处遮罩点击关闭)。
3. 触屏端静默停用鼠标动效 (Touch Guard):
   - 触屏设备上跳过 `CursorTrail` 动画主循环与 `mousemove` 全局事件监听，并在移动端添加 `hidden md:block` 消除性能浪费与潜在卡顿。

## 2. Changes Made (改动明细)

1. `src/components/Navbar.tsx`:
   - 桌面端保留原有微动效与长条胶囊容器 (`hidden md:flex`)。
   - 桌面端保留右上角语言切换 (`hidden md:flex`)。
   - 移动端增加轻量汉堡菜单按钮 (`md:hidden`, `rounded-md`)。
   - 新增基于 `framer-motion` 的移动端折叠抽屉 (`AnimatePresence`)，垂直呈现 8 个导航项与独立的语言切换行，点击后自动关闭抽屉并跳转视图。

2. `src/components/NavAuthBadges.tsx`:
   - 改造个人中心浮层容器为双模态定位：移动端 `fixed inset-x-3 top-14` 保证 100vw 视口安全，桌面端保持 `sm:absolute sm:right-0 sm:w-88`。
   - 增加全屏透明点击遮罩 (`fixed inset-0 z-40 bg-transparent`)，点击任意空白区域自动收起。
   - 增加 `max-h-[85vh] overflow-y-auto` 防溢出滚动。
   - 圆角规范化调整为几何风格 `rounded-xl`。

3. `src/components/EditProfileModal.tsx`:
   - 增加 `max-h-[90vh] overflow-y-auto` 保证小屏输入时键盘不阻碍表单滚动。

4. `src/components/CursorTrail.tsx`:
   - 增加 Touch Guard 判定：触屏环境 (`ontouchstart` / `pointer: coarse`) 静默退出，不挂载监听器或粒子渲染循环。
   - canvas 容器添加 `hidden md:block` 确保移动端不占用任何渲染图层。

## 3. Verification & CI Matrix (验证结果)

- Gate 1: Frontend & Full TypeScript Suite
  - `pnpm type-check`: [SUCCESS] (0 errors)
  - `pnpm test`: [SUCCESS] (20 test suites, 195/195 tests passed)
  - `pnpm type:lint`: [SUCCESS] (0 errors)
  - `pnpm build`: [SUCCESS] (all 18 static/dynamic routes compiled cleanly)
