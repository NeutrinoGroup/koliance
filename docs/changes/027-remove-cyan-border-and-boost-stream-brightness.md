# 027 - Remove Cyan Border from Solution Card and Boost Stream Brightness

## 1. Background & Rationale
- User feedback indicated that the solution callout card (`Koliance 解法：可验证身份与授权凭证`) in the `QuantumProtocolStream` trilogy component displayed an intrusive blue-green / cyan border (`border-l-2 border-cyan-600` and `border-cyan-300/40`), and the overall brightness was too dim due to low shader opacity (`opacity-45` on a dark base).
- Per AGENTS.md geometry standards (rectangular micro-radius `rounded-md`, zero pill, high-contrast crisp developer aesthetic), we eliminated the cyan border styling, replaced the background with high-luminance crisp white (`bg-white/95`), and increased shader backdrop opacity to `opacity-85` for superior readability and luminous presentation.

## 2. Changes Summary
- File modified: `src/components/QuantumProtocolStream.tsx`
  - Replaced `border-l-2 border-cyan-600 pl-4 bg-cyan-100/60 py-2.5 rounded-r-md border border-cyan-300/40 shadow-sm text-cyan-950` with `px-4 py-3 bg-white/95 rounded-md shadow-md backdrop-blur-md text-slate-900`.
  - Increased `GlassBackground` opacity from `opacity-45` to `opacity-85` to boost overall section stage brightness.

## 3. Verification Commands
- `pnpm type:lint`: Passed (zero TypeScript or ESLint errors)
- `pnpm test`: Passed (16 test suites, 100/100 tests passed)
- `pnpm build`: Passed (Production Next.js build clean)
