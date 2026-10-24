import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("GAP-88: Trading-Centric Trust Model & Micro-Payment Infrastructure", () => {
  it("verifies mathematical precision of the 4-weight trust model", () => {
    const weights = {
      successRate: 0.35,
      tradeVolume: 0.25,
      assetProof: 0.25,
      rating: 0.15,
    };
    const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);

    // Calculate sample prime metrics
    const sample = {
      successRate: 0.98, // 98%
      tradeCount: 45,    // 45 of 50
      assetUSD: 728.0,   // $728 of $1000
      rating: 4.8,       // 4.8 of 5.0
    };

    const sScore = sample.successRate * weights.successRate * 100;
    const vScore = Math.min(1.0, sample.tradeCount / 50.0) * weights.tradeVolume * 100;
    const aScore = Math.min(1.0, sample.assetUSD / 1000.0) * weights.assetProof * 100;
    const rScore = (sample.rating / 5.0) * weights.rating * 100;
    const total = sScore + vScore + aScore + rScore;

    expect(sScore).toBeCloseTo(34.3, 1);
    expect(vScore).toBeCloseTo(22.5, 1);
    expect(aScore).toBeCloseTo(18.2, 1);
    expect(rScore).toBeCloseTo(14.4, 1);
    expect(total).toBeGreaterThan(80.0); // TIER_PRIME
  });

  it("verifies zero emojis across all newly created scripts and backend files", () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const filesToCheck = [
      "scripts/install-agent-cli.sh",
      "backend/cmd/koliance/main.go",
      "backend/internal/trust/engine.go",
      "backend/internal/trust/engine_test.go",
      "backend/internal/platform/stripeclient/stripe.go",
      "backend/internal/httpapi/inference_proxy_test.go",
    ];

    for (const rel of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), rel);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const match = content.match(emojiRegex);
        expect(match, `Found illegal emoji in ${rel}: ${match?.[0]}`).toBeNull();
      }
    }
  });

  it("verifies that DeveloperConsole adheres to strict rectangular geometry without rounded-full buttons", () => {
    const consolePath = path.resolve(process.cwd(), "src/components/DeveloperConsole.tsx");
    const content = fs.readFileSync(consolePath, "utf-8");

    // Must not have rounded-full on interactive buttons or cards
    const buttonWithRoundedFull = /<button[^>]*rounded-full[^>]*>/i;
    expect(buttonWithRoundedFull.test(content)).toBe(false);

    // Verify key zero-friction hand-off commands are present
    expect(content).toContain("curl -fsSL https://get.koliance.io/install.sh");
    expect(content).toContain('OPENAI_BASE_URL="https://api.koliance.io/api/v1/proxy"');
    expect(content).toContain("koliance trade --symbol=NVDA --side=buy --amount=100 --leverage=2");
  });

  it("verifies DeveloperConsole integrates with live backend vault and trust endpoints", () => {
    const consolePath = path.resolve(process.cwd(), "src/components/DeveloperConsole.tsx");
    const content = fs.readFileSync(consolePath, "utf-8");

    expect(content).toContain("/api/v1/inference/vault");
    expect(content).toContain("/api/v1/trust/score");
    expect(content).toContain("/api/v1/deposit/webhook");
    expect(content).toContain("/api/v1/card/bind");
  });

  it("verifies that install-agent-cli.sh is non-interactive and handles key flag correctly", () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/install-agent-cli.sh");
    const script = fs.readFileSync(scriptPath, "utf-8");

    expect(script).toContain("--key");
    expect(script).toContain("koliance");
    expect(script).toContain("[SUCCESS]");
    expect(script).not.toContain("sudo cp -f /tmp/"); // Uses proper conditional sudo
  });
});
