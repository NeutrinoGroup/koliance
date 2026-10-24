# Change Log: 087-koliance-multi-platform-publisher-skill.md

## Rationale
To provide autonomous AI agents and core contributors with a reliable, standardized, and high-performance multi-platform publishing engine. This capability enables automated dissemination of in-depth Koliance research and architectural analyses across five major platforms: Reddit, Zhihu, Dev.to, WeChat Official Account, and Xiaohongshu.

## Core Capabilities Delivered
1. **In-Depth Codebase Research & Core Architectural Answers**:
   - Synthesized authoritative answers across all 6 foundational questions (Asset Provisioning, Core Utility, Problem Solving, Necessity Rationale, Differentiators, Usage Steps).
   - Authored five tailored, platform-specific articles adhering strictly to the zero-emoji directive.
2. **Dual-Engine Execution & Resilient Adapters**:
   - Active Chrome Session Bridge via AppleScript: Directly operates on active browser sessions without credential re-entry or 2FA hurdles.
   - Headless Mode via Playwright (`--headless`): Supports first-class headless operation with preserved cookie/localStorage state and intelligent DOM auth detection (`AUTH_REQUIRED`).
   - Platform Adapters:
     - Dev.to: Automatically navigates from preview back to editor, populates markdown frontmatter and body, saves draft.
     - Xiaohongshu: Handles overview, editor, and draft list states, enters editor, populates title and rich text, saves draft.
     - Zhihu: Navigates from question/waiting to zhuanlan editor, populates Draft.js editor, triggers auto-save.
     - WeChat Official Account: Formats markdown to semantic HTML paragraphs, inserts into ProseMirror, saves draft.
     - Reddit: Populates Shadow DOM `faceplate-textarea-input` title and `shreddit-composer` content, stages post.
3. **High-Speed Parallel Execution**:
   - Added `--parallel` execution by default with `Promise.allSettled`, reducing total staging time across all 5 platforms to under 4 seconds.
4. **Automated Verification Suite**:
   - Added `tests/multi-publisher.test.ts` covering file integrity, zero emojis, frontmatter parsing, ProseMirror/Tiptap formatting, and dimension coverage.

## Touched Files
- `.agents/skills/koliance-multi-publisher/SKILL.md`
- `.agents/skills/koliance-multi-publisher/scripts/publish.js`
- `.agents/skills/koliance-multi-publisher/scripts/lib/session_exporter.js`
- `.agents/skills/koliance-multi-publisher/scripts/platforms/devto.js`
- `.agents/skills/koliance-multi-publisher/scripts/platforms/xiaohongshu.js`
- `.agents/skills/koliance-multi-publisher/scripts/platforms/zhihu.js`
- `.agents/skills/koliance-multi-publisher/scripts/platforms/reddit.js`
- `.agents/skills/koliance-multi-publisher/scripts/platforms/wechat.js`
- `tests/multi-publisher.test.ts`
- `.gitignore`

## Verification Commands & Evidence
- Active Chrome Session Publishing:
  `node .agents/skills/koliance-multi-publisher/scripts/publish.js --platforms all --action draft` -> [SUCCESS] across all 5 platforms (WeChat, Zhihu, Reddit, Xiaohongshu, Dev.to).
- Headless Mode Auth Detection:
  `node .agents/skills/koliance-multi-publisher/scripts/publish.js --headless --platforms devto,reddit --action draft` -> Clean [AUTH_REQUIRED] status without hanging.
- Unit Test Suite:
  `npx vitest run tests/multi-publisher.test.ts` -> 8 passed (8).
- Full Test Suite:
  `pnpm test` -> 37 test files passed, 403 tests passed.
- Type & Lint Gate:
  `pnpm type:lint` -> 0 errors.
