# 028-hero-badge-cleanup-top-right-i18n-expansion.md

## 1. Rationale & Requirements Alignment (背景与目标)

User request:
1. Remove hero section badge containing:
   `NEXT-GEN ON-CHAIN AGENT INFRASTRUCTURE // 10,000 TPS Monad Engine` and the `EN / ZH` button.
2. Move the bilingual language switcher (EN / ZH) to the top right corner of the application navbar.
3. Expand Chinese-English dictionary mappings extensively across multiple pages and components rather than limiting translations solely to the index hero/problem section.

## 2. Changes Made (改动明细)

1. `src/components/HeroGsap.tsx`:
   - Deleted the top pill badge and inline language switcher button.
   - Removed `badgeRef` and cleaned up entrance GSAP timeline to begin cleanly from `headlineRef`.
   - Cleaned up unused imports and states (`Globe`, `lang`, `setLang`).

2. `src/components/Navbar.tsx`:
   - Added modern rectangular language switcher button (`h-9`, `rounded-md`, border `border-white/15`, inset highlight) to the top right corner beside `NavAuthBadges`.
   - Connected `useLanguage()` to render bilingual labels for top navigation items (`INDEX`, `CONSOLE`, `TOKEN`, `DETAIL`, `PRODUCT`, `MARKET`, `PERP`, `AGENTCARD`).

3. `src/lib/i18n.tsx`:
   - Extended dictionary with rich mappings across navigation (`nav.*`), user auth center (`auth.*`), architecture rails (`gateway.*`), narrative flow (`narrative.*`), token studio (`token.*`), developer console (`console.*`), and general actions (`common.*`).

4. `src/components/NavAuthBadges.tsx`:
   - Replaced hardcoded text in User Center trigger and modal dropdown with bilingual i18n-aware strings (Profile, Wallet, Transfers, Multi-Rail Credentials, etc.).

5. `src/components/MinimalistGatewayRails.tsx`:
   - Wired `useLanguage()` to render bilingual titles and descriptions for protocol execution rails.

6. `src/components/AgentNarrativeFlow.tsx`:
   - Wired `useLanguage()` to render bilingual step descriptions, titles, controls, and narrative headers.

7. `src/components/TokenStudio.tsx`:
   - Translated banner titles, halving disclaimers, stat cards, block mining claim forms, transfer consoles, and audit history tables.

8. `src/components/DeveloperConsole.tsx`:
   - Translated console breadcrumb, header bar, 6 major navigation tabs, registration required gate, API key creation banners, and quota cards.

9. `tests/console-api-keys-route.test.ts`:
   - Configured explicit test timeouts (15000ms) for async DB route tests.

## 3. Verification & CI Matrix (验证结果)

- Gate 1: Frontend & Full TypeScript Suite
  - `pnpm type:lint`: [SUCCESS] (0 errors, 0 type issues)
  - `pnpm test`: [SUCCESS] (16 test suites, 100/100 tests passed)
  - `pnpm build`: [SUCCESS] (all 18 static/dynamic routes compiled cleanly)
- Gate 2: Smart Contracts
  - `npx hardhat test`: [SUCCESS] (202/202 tests passed)
- Gate 3: Go Backend
  - `go vet ./... && go test -race ./...`: [SUCCESS]
