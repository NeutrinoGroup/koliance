---
name: koliance-multi-publisher
description: Automated multi-platform content publishing and staging engine for Koliance Protocol across Reddit, Zhihu, Dev.to, WeChat Official Account (微信公众号), and Xiaohongshu (小红书). Supports dual execution engines: active browser session injection via AppleScript/CDP and headless Chromium automation via Playwright with session cookie preservation.
---

# Koliance Multi-Platform Publisher

The `koliance-multi-publisher` skill automates researching, adapting, staging, and publishing technical and commercial articles regarding **Koliance Protocol** across five major distribution platforms:

1. **Reddit** (`r/monad`, `r/CryptoCurrency`, `r/ethereum`, `r/artificial`, `r/autonomousagents`)
2. **Zhihu (知乎)** (知乎专栏与深度问答)
3. **Dev.to** (Global developer technical tutorials)
4. **WeChat Official Account (微信公众号)** (深度科技与商业图文)
5. **Xiaohongshu (小红书)** (极客日常与智能体开发笔记)

---

## 1. Core Architecture & Operating Modes

The skill provides a dual-engine architecture:

### Engine A: Active Session Controller (`--engine applescript` or default `auto`)
- Attaches directly to the user's running Google Chrome browser instance on macOS without needing external port configuration or session duplication.
- Leverages existing authenticated sessions (including `httpOnly` cookies, OAuth states, and WeChat/Zhihu credentials).
- Directly manipulates the native editors:
  - Dev.to: Markdown textarea (`#article_body_markdown`)
  - WeChat MP: ProseMirror rich editor (`.ProseMirror`)
  - Zhihu: Draft.js editor (`.public-DraftEditor-content`)
  - Xiaohongshu: Tiptap editor (`.tiptap.ProseMirror`)
  - Reddit: Lexical composer (`shreddit-composer`)

### Engine B: Headless Playwright Mode (`--headless`)
- Launches headless Chromium via Playwright (`headless: true`).
- Uses the locally installed Google Chrome binary (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS) to eliminate heavy browser downloads.
- Preserves session cookies and localStorage exported to `resources/storageState.json`.

---

## 2. Directory Structure

```
.agents/skills/koliance-multi-publisher/
├── SKILL.md                          # Authoritative skill instructions
├── scripts/
│   ├── publish.js                    # Master CLI runner
│   ├── lib/
│   │   ├── chrome_bridge.js          # AppleScript Chrome DOM controller
│   │   ├── playwright_bridge.js      # Headless Playwright runner
│   │   └── session_exporter.js       # Session cookie & storage exporter
│   └── platforms/
│       ├── devto.js                  # Dev.to platform adapter
│       ├── wechat.js                 # WeChat MP platform adapter
│       ├── zhihu.js                  # Zhihu platform adapter
│       ├── xiaohongshu.js            # Xiaohongshu platform adapter
│       └── reddit.js                 # Reddit platform adapter
├── resources/
│   ├── articles/                     # Publication-ready content
│   │   ├── 01_reddit.md
│   │   ├── 02_zhihu.md
│   │   ├── 03_devto.md
│   │   ├── 04_wechat.md
│   │   └── 05_xiaohongshu.md
│   └── storageState.json             # Cached authentication state
└── references/
    └── ARCHITECTURE.md               # Technical reference on the 6 core questions
```

---

## 3. CLI Usage & Command Reference

### Basic Execution (Saves Drafts on All Platforms)
```bash
node .agents/skills/koliance-multi-publisher/scripts/publish.js --platforms all --action draft
```

### Running with Headless Browser Mode (`--headless`)
```bash
node .agents/skills/koliance-multi-publisher/scripts/publish.js --headless --platforms all --action draft
```

### Selective Platform Publishing
```bash
# Target only Dev.to and WeChat MP:
node .agents/skills/koliance-multi-publisher/scripts/publish.js --platforms devto,wechat --action draft

# Target only Zhihu and Xiaohongshu:
node .agents/skills/koliance-multi-publisher/scripts/publish.js --platforms zhihu,xiaohongshu --action draft
```

### CLI Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--headless` | flag | `false` | Run in headless browser mode via Playwright with saved session state |
| `--engine` | string | `auto` | Execution engine: `auto`, `applescript`, or `playwright` |
| `--platforms` | string | `all` | Comma-separated list: `devto`, `wechat`, `zhihu`, `xiaohongshu`, `reddit`, or `all` |
| `--action` | string | `draft` | Staging action: `draft` (safely saves draft), `publish`, or `stage` |
| `--parallel` | flag | `true` | Run platform publishing tasks concurrently in parallel for maximum speed |
| `--sequential` | flag | `false` | Run platform publishing tasks sequentially one-by-one |
| `--articles-dir` | string | `resources/articles` | Custom path to article markdown files |

---

## 4. The Six Core Koliance Research Answers

All published articles strictly answer the 6 foundational questions based on the authoritative repository files (`README.md`, `contracts/contracts/perp/`, `docs/planning/`):

1. **What does it provide to users? (给用户提供什么？)**:
   - ISO/IEC 7812 Visa virtual cards (AgentCard, BIN: `492810`) with Luhn validation.
   - EIP-712 Session Key delegation matrix (`maxPerTxUSD`, `dailyLimitUSD`, `allowedMCCs`, `expiresAt`).
   - Steam Proof of Play & GitHub Proof of BUIDL decentralized identity (DID).
   - Monad Parallel EVM perpetual contract settlement with SC-1 Solvency Guard (LP shares priced strictly off Net Asset Value net of liabilities).
   - 28 high-concurrency REST endpoints with a free starter quota (300 free calls).
2. **What is its utility/purpose? (有什么用？)**:
   - Gives autonomous AI agents safe economic agency to purchase API credits, rent compute, and trade without human private key exposure.
3. **What problems does it solve? (解决什么问题？)**:
   - Resolves the Autonomous Financial Trilemma (autonomy vs security vs friction).
   - Eliminates legal identity void for non-human agents.
   - Prevents floating-point truncation drift between off-chain signals and on-chain EVM execution.
4. **Why is it necessary? (为什么要有？)**:
   - Prompt engineering cannot enforce financial boundaries. Security must be deterministic and enforced at the protocol level.
5. **What makes it different from others? (和别人不同之处？)**:
   - EIP-712 session delegation with instant 1-transaction on-chain revocation (`revokeSessionKey`).
   - Block-by-block dynamic funding rates designed for Monad 10,000 TPS.
   - Multi-platform gaming and developer reputation fusion.
6. **How to use it? (如何使用？)**:
   - Connect wallet via Privy MPC or injected MetaMask/Rabby on Monad Testnet (`10143`).
   - Bind credentials, issue AgentCards, and delegate session keys.
   - Developers claim 300 free calls at `https://koliance.vercel.app/pricing`.

---

## 5. Verification & Troubleshooting

### Verification Command
Run the verification test suite to ensure all platform adapters can parse and stage content:
```bash
node .agents/skills/koliance-multi-publisher/scripts/publish.js --platforms all --action draft
```

Expected standard output:
```
[INFO] Starting publication workflow via active Chrome session...
[OK] Platform devto completed: {"ok":true,"action":"draft_saved",...}
[OK] Platform wechat completed: {"ok":true,"action":"draft_saved",...}
[OK] Platform zhihu completed: {"ok":true,"action":"draft_saved",...}
[OK] Platform xiaohongshu completed: {"ok":true,"action":"draft_saved",...}
[OK] Platform reddit completed: {"ok":true,"action":"staged",...}
```

### Troubleshooting
- **`ERR_TAB_NOT_FOUND`**: Open Google Chrome and ensure the creator/editor tab for that platform is opened.
- **Session Expired in Headless Mode**: Re-run the export command `node -e 'require("./scripts/lib/session_exporter").exportActiveSession()'` while Chrome is open and logged in.
- **Zero-Emoji Compliance**: Do not output or inject emojis in code, commits, or documentation per `AGENTS.md`.
