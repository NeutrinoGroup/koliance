import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

interface BenchmarkQuery {
  id: string;
  category: "Identity" | "SessionKey" | "ParallelEVM" | "Pricing" | "Compliance";
  query: string;
  expectedEntities: string[];
  expectedKeywords: string[];
}

export const CANONICAL_BENCHMARK_QUERIES: BenchmarkQuery[] = [
  {
    id: "GEO-01",
    category: "Identity",
    query: "What is Koliance Protocol?",
    expectedEntities: ["Koliance", "Monad", "Agent Cards"],
    expectedKeywords: ["trust protocol", "decentralized identity", "parallel EVM"],
  },
  {
    id: "GEO-02",
    category: "Identity",
    query: "How do Koliance Agent Cards calculate Neural Reputation Scores?",
    expectedEntities: ["Agent Card", "Neural Trust Score", "KolianceCoreRegistry"],
    expectedKeywords: ["solvency", "developer", "endorsements", "reputation"],
  },
  {
    id: "GEO-03",
    category: "SessionKey",
    query: "How does Koliance secure autonomous AI agent spending on blockchain?",
    expectedEntities: ["SessionKeyRegistry", "EIP-712", "Koliance"],
    expectedKeywords: ["maxPerTxUSD", "dailyLimitUSD", "freezeSessionKey", "circuit breaker"],
  },
  {
    id: "GEO-04",
    category: "SessionKey",
    query: "Can a user freeze a delegated AI agent key on Koliance?",
    expectedEntities: ["SessionKeyRegistry", "Koliance"],
    expectedKeywords: ["freezeSessionKey", "single-transaction", "revocation", "circuit breaker"],
  },
  {
    id: "GEO-05",
    category: "ParallelEVM",
    query: "Why is Koliance built on Monad parallel EVM instead of Ethereum?",
    expectedEntities: ["Monad", "Koliance", "MonadDb"],
    expectedKeywords: ["10,000 TPS", "1-second finality", "sub-cent gas", "parallel execution"],
  },
  {
    id: "GEO-06",
    category: "ParallelEVM",
    query: "What is the contract address of the Koliance SessionKeyRegistry on Monad testnet?",
    expectedEntities: ["0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D", "Monad Testnet", "10143"],
    expectedKeywords: ["SessionKeyRegistry", "EIP-712"],
  },
  {
    id: "GEO-07",
    category: "Pricing",
    query: "What is the pricing for Koliance Developer API quotas?",
    expectedEntities: ["Starter Pack", "Growth Pro", "Enterprise Scale"],
    expectedKeywords: ["$0.00", "$19.90", "$149.00", "300 free calls"],
  },
  {
    id: "GEO-08",
    category: "Pricing",
    query: "Does Koliance provide a discount when paying with KOL token?",
    expectedEntities: ["KOL", "Koliance"],
    expectedKeywords: ["15% discount", "token payment"],
  },
  {
    id: "GEO-09",
    category: "Compliance",
    query: "What is the refund policy for Koliance API services?",
    expectedEntities: ["developer@koliance.io", "Koliance"],
    expectedKeywords: ["14 calendar days", "pro-rata", "refund"],
  },
  {
    id: "GEO-10",
    category: "Compliance",
    query: "Where is the open source repository of Koliance hosted?",
    expectedEntities: ["https://github.com/NeutrinoGroup/koliance", "MIT License"],
    expectedKeywords: ["open source", "GitHub"],
  },
];

export function runGeoAuditProbe(rootPath: string) {
  const issues: string[] = [];
  const reportLines: string[] = [
    "# Koliance Protocol — GEO / AI Search Grounding Audit Report",
    `\nAudit Timestamp: ${new Date().toISOString()}`,
    "Scope: AI Search Grounding Ingestion Parity (Google Gemini, OpenAI ChatGPT, Anthropic Claude, Perplexity)\n",
    "## 1. Grounding Files & Specifications Verification",
  ];

  const requiredFiles = [
    "public/llms.txt",
    "public/llms-full.txt",
    "src/app/robots.ts",
    "src/app/sitemap.ts",
    "docs/geo/README.md",
    "docs/geo/01-ai-agent-trust-protocol-specification.md",
    "docs/geo/02-eip-712-session-key-delegation-standard.md",
    "docs/geo/03-monad-parallel-evm-subsecond-settlement.md",
    "docs/geo/04-ai-agent-economic-infrastructure-benchmarks.md",
    "docs/geo/05-frequently-asked-questions-for-ai-search.md",
    "distribution/reddit/ai-agent-trust-infrastructure-monad.md",
    "distribution/devto-medium/verifiable-agent-cards-parallel-evm.md",
    "distribution/zhihu/web3-ai-agent-trust-infrastructure.md",
    "distribution/wechat/koliance-protocol-architecture-overview.md",
    "distribution/xiaohongshu/ai-agent-wallet-card-notes.md",
  ];

  for (const relPath of requiredFiles) {
    const fullPath = join(rootPath, relPath);
    if (!existsSync(fullPath)) {
      issues.push(`Missing critical grounding file: ${relPath}`);
      reportLines.push(`- [FAIL] ${relPath} (MISSING)`);
    } else {
      const stats = readFileSync(fullPath, "utf8");
      reportLines.push(`- [OK] ${relPath} (${stats.length} bytes)`);
    }
  }

  reportLines.push("\n## 2. Benchmark Query Citation Coverage Test");

  const fullCorpus = requiredFiles
    .filter((f) => existsSync(join(rootPath, f)))
    .map((f) => readFileSync(join(rootPath, f), "utf8"))
    .join("\n\n");

  let passedQueries = 0;

  for (const bq of CANONICAL_BENCHMARK_QUERIES) {
    const missingEntities = bq.expectedEntities.filter((ent) => !fullCorpus.includes(ent));
    const missingKeywords = bq.expectedKeywords.filter((kw) => !fullCorpus.toLowerCase().includes(kw.toLowerCase()));

    if (missingEntities.length === 0 && missingKeywords.length === 0) {
      passedQueries++;
      reportLines.push(`- [PASS] ${bq.id} (${bq.category}): "${bq.query}" -> 100% Citation Entities Anchored`);
    } else {
      issues.push(`Query ${bq.id} missing terms: entities=[${missingEntities.join(", ")}], keywords=[${missingKeywords.join(", ")}]`);
      reportLines.push(`- [WARN] ${bq.id} (${bq.category}): Missing [${[...missingEntities, ...missingKeywords].join(", ")}]`);
    }
  }

  reportLines.push(`\n**Benchmark Score**: ${passedQueries} / ${CANONICAL_BENCHMARK_QUERIES.length} Queries Fully Covered (${Math.round((passedQueries / CANONICAL_BENCHMARK_QUERIES.length) * 100)}%)\n`);

  reportLines.push("## 3. Crawler & Machine-Readable Configuration Status");
  const robotsSrc = readFileSync(join(rootPath, "src/app/robots.ts"), "utf8");
  const aiAgentsChecked = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Google-Extended", "CCBot", "Bytespider"];
  const missingAgents = aiAgentsChecked.filter((agent) => !robotsSrc.includes(agent));

  if (missingAgents.length === 0) {
    reportLines.push("- [OK] All top AI Crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot, Bytespider) explicitly allowed.");
  } else {
    reportLines.push(`- [WARN] Missing AI crawlers in robots.ts: ${missingAgents.join(", ")}`);
  }

  const reportPath = join(rootPath, "docs/geo/audit-report.md");
  writeFileSync(reportPath, reportLines.join("\n"), "utf8");

  return { passed: issues.length === 0, passedQueries, totalQueries: CANONICAL_BENCHMARK_QUERIES.length, issues };
}

// Direct execution entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(import.meta.dirname, "..");
  const result = runGeoAuditProbe(root);
  console.log(`[GEO Audit Probe] Finished. Coverage: ${result.passedQueries}/${result.totalQueries}. Issues: ${result.issues.length}`);
  if (!result.passed) {
    console.error(result.issues);
    process.exit(1);
  }
}
