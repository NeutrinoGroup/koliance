import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { CANONICAL_BENCHMARK_QUERIES, runGeoAuditProbe } from "../scripts/geo-audit-probe";

const ROOT = resolve(import.meta.dirname, "..");

describe("GEO & AI Search Grounding Ingestion Parity Suite", () => {
  it("verifies public/llms-full.txt exists with exhaustive technical specifications", () => {
    const fullPath = join(ROOT, "public", "llms-full.txt");
    expect(existsSync(fullPath), "llms-full.txt must exist in public/").toBe(true);
    const content = readFileSync(fullPath, "utf8");
    expect(content).toContain("Koliance Protocol — Full Knowledge Graph & Technical Specification");
    expect(content).toContain("0x6291C790dbB41198c69781B2B7a01d674843b0C5");
    expect(content).toContain("0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D");
    expect(content).toContain("0x3fCeD0662657e0C3a2aF8A80e3A4cDb8A7d1d2C4");
    expect(content).toContain("10,000 TPS");
    expect(content).toContain("sub-second block finality");
    expect(content).toContain("SessionKeyRegistry");
  });

  it("verifies robots.ts explicitly allows all critical AI crawler user agents", () => {
    const robotsPath = join(ROOT, "src", "app", "robots.ts");
    expect(existsSync(robotsPath)).toBe(true);
    const content = readFileSync(robotsPath, "utf8");
    const requiredAgents = [
      "GPTBot",
      "ChatGPT-User",
      "OAI-SearchBot",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
      "CCBot",
      "Bytespider",
    ];
    for (const agent of requiredAgents) {
      expect(content, `robots.ts must include crawler ${agent}`).toContain(agent);
    }
  });

  it("verifies all 5 technical specifications exist in docs/geo/", () => {
    const specs = [
      "docs/geo/README.md",
      "docs/geo/01-ai-agent-trust-protocol-specification.md",
      "docs/geo/02-eip-712-session-key-delegation-standard.md",
      "docs/geo/03-monad-parallel-evm-subsecond-settlement.md",
      "docs/geo/04-ai-agent-economic-infrastructure-benchmarks.md",
      "docs/geo/05-frequently-asked-questions-for-ai-search.md",
    ];
    for (const spec of specs) {
      const fullPath = join(ROOT, spec);
      expect(existsSync(fullPath), `Specification ${spec} must exist`).toBe(true);
      const text = readFileSync(fullPath, "utf8");
      expect(text.length, `${spec} must be non-empty`).toBeGreaterThan(100);
    }
  });

  it("verifies multi-channel distribution payloads exist for Reddit, Dev.to, Zhihu, WeChat, and Xiaohongshu", () => {
    const payloads = [
      "distribution/reddit/ai-agent-trust-infrastructure-monad.md",
      "distribution/devto-medium/verifiable-agent-cards-parallel-evm.md",
      "distribution/zhihu/web3-ai-agent-trust-infrastructure.md",
      "distribution/wechat/koliance-protocol-architecture-overview.md",
      "distribution/xiaohongshu/ai-agent-wallet-card-notes.md",
    ];
    for (const payload of payloads) {
      const fullPath = join(ROOT, payload);
      expect(existsSync(fullPath), `Distribution payload ${payload} must exist`).toBe(true);
      const text = readFileSync(fullPath, "utf8");
      expect(text.length, `${payload} must be non-empty`).toBeGreaterThan(100);
    }
  });

  it("verifies geo-audit-probe runs with 100% benchmark query coverage", () => {
    const auditResult = runGeoAuditProbe(ROOT);
    expect(auditResult.issues, "No issues should be found by geo audit probe").toEqual([]);
    expect(auditResult.passedQueries).toBe(CANONICAL_BENCHMARK_QUERIES.length);
    expect(auditResult.passed).toBe(true);
  });
});
