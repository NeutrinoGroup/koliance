import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

describe("Generative Engine Optimization (GEO) & Machine Readability Suite (GAP-84)", () => {
  it("verifies public/llms.txt conforms to the Answer.AI llms.txt standard", () => {
    const llmsPath = join(ROOT, "public", "llms.txt");
    expect(existsSync(llmsPath), "public/llms.txt must exist").toBe(true);

    const content = readFileSync(llmsPath, "utf8");
    expect(content.startsWith("# Koliance"), "Must start with H1 title").toBe(true);
    expect(content).toContain("> Decentralized Identity");
    expect(content).toContain("## Core Pages");
    expect(content).toContain("## Deep Context for Models");
    expect(content).toContain("## Guidelines for AI Models & Citations");
    expect(content).toContain("https://koliance.vercel.app/llms-full.txt");
  });

  it("verifies public/llms-full.txt provides exhaustive machine-readable context for deep AI reasoning", () => {
    const fullPath = join(ROOT, "public", "llms-full.txt");
    expect(existsSync(fullPath), "public/llms-full.txt must exist").toBe(true);

    const content = readFileSync(fullPath, "utf8");
    expect(content).toContain("Koliance Protocol — Full Knowledge Graph & Technical Specification");
    expect(content).toContain("0x6291C790dbB41198c69781B2B7a01d674843b0C5");
    expect(content).toContain("0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D");
    expect(content).toContain("0x3fCeD0662657e0C3a2aF8A80e3A4cDb8A7d1d2C4");
    expect(content).toContain("Starter Pack");
    expect(content).toContain("$0.00");
    expect(content).toContain("Growth Pro");
    expect(content).toContain("$19.90");
    expect(content).toContain("Enterprise Scale");
    expect(content).toContain("$149.00");
    expect(content).toContain("EIP-712 Session Keys");
    expect(content).toContain("ADR-006");
    expect(content).toContain("Model Directives & Citation Guidelines for Generative Engines");
  });

  it("verifies robots.ts grants explicit indexing access to leading generative AI search crawlers", () => {
    const robotsPath = join(ROOT, "src", "app", "robots.ts");
    expect(existsSync(robotsPath)).toBe(true);

    const content = readFileSync(robotsPath, "utf8");
    const requiredBots = [
      "GPTBot",
      "ChatGPT-User",
      "OAI-SearchBot",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
      "Applebot-Extended",
      "Meta-ExternalAgent",
      "cohere-ai",
    ];

    for (const bot of requiredBots) {
      expect(content, `robots.ts must explicitly allow crawler ${bot}`).toContain(`"${bot}"`);
    }
    expect(content).toContain("/llms.txt");
    expect(content).toContain("/llms-full.txt");
  });

  it("verifies layout.tsx head links both llms.txt and llms-full.txt for autonomous agent discovery", () => {
    const layoutPath = join(ROOT, "src", "app", "layout.tsx");
    expect(existsSync(layoutPath)).toBe(true);

    const content = readFileSync(layoutPath, "utf8");
    expect(content).toContain('<link rel="author" href="/llms.txt" />');
    expect(content).toContain('<link rel="alternate" type="text/plain" href="/llms-full.txt" title="Full LLM Knowledge Base" />');
  });

  it("verifies layout.tsx Schema.org Knowledge Graph contains DefinedTermSet, Dataset, and expanded FAQPage", () => {
    const layoutPath = join(ROOT, "src", "app", "layout.tsx");
    const content = readFileSync(layoutPath, "utf8");

    expect(content).toContain('"@type": "DefinedTermSet"');
    expect(content).toContain('"@type": "DefinedTerm"');
    expect(content).toContain('name: "Agent Card"');
    expect(content).toContain('name: "EIP-712 Session Key"');
    expect(content).toContain('name: "Monad Parallel EVM"');
    expect(content).toContain('name: "KOL Token"');

    expect(content).toContain('"@type": "Dataset"');
    expect(content).toContain('name: "Koliance Multi-Asset Oracle Quotes"');

    expect(content).toContain('"@type": "FAQPage"');
    expect(content).toContain("How does EIP-712 Session Key Delegation work in Koliance?");
    expect(content).toContain("What are the Koliance API pricing packages and is there a free trial?");
    expect(content).toContain("What official smart contracts are deployed on Monad Testnet?");
    expect(content).toContain("What is the Koliance refund and vulnerability disclosure policy?");
  });

  it("verifies next.config.ts configures Global Edge Caching & CORS headers for AI crawlers", () => {
    const configPath = join(ROOT, "next.config.ts");
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, "utf8");
    expect(content).toContain("llms.txt|llms-full.txt");
    expect(content).toContain("Access-Control-Allow-Origin");
    expect(content).toContain("Cache-Control");
    expect(content).toContain("s-maxage=86400");
  });
});
