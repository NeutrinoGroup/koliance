# 072 - Demo Video Re-creation with Real Live DApp Textures and 2.5D PageCam

## 1. Background & Rationale
In accordance with user feedback ("删除这个视频；html完全没有加载你就截图；还没有动效； https://koliance.oodai.space/ 这是我们的dapp web； 重新生产视频"), the previous video draft contained placeholder flat CSS mockups without loading real live DApp pages or authentic dynamic 2.5D camera moves.

To achieve hackathon top-tier visual standards and showcase Koliance on Monad Parallel EVM:
1. Captured 2x high-resolution (3840x2160) real textures directly from live DApp `https://koliance.oodai.space/`:
   - `textures/live/home.png` & `home_full.png` (Landing page hero and full bento architecture)
   - `textures/live/console.png` & `console_full.png` (Developer Console, Web2 OAuth PKCE attestation, recent settlement stream)
   - `textures/live/agentcard.png` & `agentcard_full.png` (AI Card Scanner, KIMI / Anthropic neural cards, quota issuance)
   - `textures/live/market.png` & `market_full.png` (MarketTerminal, Alpaca / Monad Perp execution, leverage slider, order book)
2. Implemented `PageCam` 2.5D perspective camera movements (`rotX`, `rotY`, `rotZ`, `persp`, `zoom`, `cx`, `cy`) across all 4 acts.
3. Designed floating HUD cyber consoles with zero oval geometry (`rounded-md`, `rounded-lg`) adhering strictly to AGENTS.md directives.

---

## 2. 4-Act Narrative Structure (150s Total / 4500 Frames @ 30fps)

### Act 1: 痛点与破局 (0:00 - 0:30, Frames 0 - 900)
- **Part 1.1 (0 - 450)**: Camera pans across live home page with red danger vignette and shake effect. Displays raw unconstrained private key breach and `$33,333.33` real-time treasury drain simulation.
- **Part 1.2 (450 - 900)**: Camera sweeps down into Koliance Protocol Defense. Displays EIP-712 Session Key, Max per-tx limit ($100), Daily allowance cap ($500), and instant circuit breaker protection.

### Act 2: 身份与信用锚定 (0:30 - 1:15, Frames 900 - 2250)
- **Part 2.1 (900 - 1550)**: Camera rotates across the live Developer Console (`textures/live/console.png`). Features GitHub Developer (+420 pts) and Steam Community (+400 pts) OAuth 2.0 PKCE verification with cryptographic Merkle proof hashes.
- **Part 2.2 (1550 - 2250)**: Camera zooms in 2.5D on the live AgentCard Terminal (`textures/live/agentcard.png`). Features `DigitRoll` jumping to 820 AAA credit score, dynamic $5,000 synthetic credit allowance allocation, and policy whitelisting.

### Act 3: Agent 自主开仓与支付 (1:15 - 2:00, Frames 2250 - 3600)
- **Part 3.1 (2250 - 2950)**: Camera tracks across the live MarketTerminal (`textures/live/market.png`). Displays autonomous AI Agent autopilot loop executing 5x Long MON positions, micro-billing inference streams ($0.0012/req), and live telemetry.
- **Part 3.2 (2950 - 3600)**: Simulates runaway / malicious agent attempt. Triggers frequency limit (>10 req/s) and per-tx limit ($2,500 > $100 cap). Engages instant circuit breaker freeze with zero root capital loss.

### Act 4: 链上存证与架构 (2:00 - 2:30, Frames 3600 - 4500)
- **Part 4.1 (3600 - 4100)**: Camera sweeps over Developer Console Settlement Stream (`textures/live/console.png`). Verifies real Monad Explorer transaction hash, sub-second 0.42s consensus finality, sub-cent gas fee, and net equity solvency balance.
- **Part 4.2 (4100 - 4500)**: Panoramic sweep over full landing page architecture (`textures/live/home_full.png`). Emphasizes Monad 10,000 TPS parallel EVM, MonadDb state trie, and final Koliance protocol brand lockup.

---

## 3. Touched Files
- `video/public/textures/live/*.png`: Real live screenshots captured from `https://koliance.oodai.space/`
- `video/src/acts/Act1_PainAndSolution.tsx`: 2.5D PageCam over live home texture
- `video/src/acts/Act2_IdentityAndCredit.tsx`: 2.5D PageCam over live console and agentcard textures
- `video/src/acts/Act3_AgentAutonomousTrading.tsx`: 2.5D PageCam over live market texture with autopilot telemetry & circuit breaker
- `video/src/acts/Act4_OnChainSettlement.tsx`: 2.5D PageCam over live console settlement & full home architecture
- `video/src/lib/PageCam.tsx`: Dark background and layout-scale 2.5D rendering
- `video/src/components/AudioLayer.tsx`: Multi-track SFX + tech house BGM orchestration
- `video/src/components/SubtitleOverlay.tsx`: 4-act synchronized lower-third subtitles
- `video/out/koliance_demo.mp4`: Final output 1080p 30fps MP4 video

---

## 4. Verification
1. QA Still Frames Rendered & Inspected:
   - Frame 200: Live Home Hero + Raw Key Breach Alert
   - Frame 600: Live Architecture Bento + 4 Security Pillars
   - Frame 1100: Live Developer Console + Web2 Identity Attestation
   - Frame 1800: Live AgentCard Scanner + 820 AAA Credit Score Jump
   - Frame 2500: Live MarketTerminal + Agent Autopilot Execution
   - Frame 3200: Live Market + Instant Circuit Breaker Enforcement
   - Frame 3800: Live Console Settlement Stream + Monad Explorer Consensus
   - Frame 4300: Live Architecture Bento + 10,000 TPS Parallel EVM Climax
2. Remotion Video Render:
   - Output: `video/out/koliance_demo.mp4`
   - Verification command: `ffprobe -hide_banner video/out/koliance_demo.mp4`
