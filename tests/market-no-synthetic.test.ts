import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The market surface must stay free of locally produced prices.
 *
 * Why a second, source-reading test exists on top of the behavioural ones:
 * `tests/market-route.test.ts` is thorough about the route, and the route is
 * where prices were generated. But `MarketTerminal.tsx` also carried hardcoded
 * numbers — a ticker tape with literal quotes, an account initialised to
 * `"100,000.00"` / `"400,000.00"`, and a preset `ord_init_aapl` fill — none of
 * which any behavioural test here renders, because the suite runs in the `node`
 * environment with no DOM.
 *
 * That gap was measured, not assumed. Injecting those exact values back into
 * the component and running the full suite reddened **nothing**; only an
 * ad-hoc probe caught them. A guard that has to be written by hand for the
 * occasion is not a guard, so this file keeps it.
 *
 * A note on method: comments are stripped before scanning. These files explain
 * the defect they fixed, in prose, and name the deleted identifiers while doing
 * so — and a `not.toContain("FALLBACK_MARKET_DATA")` over raw text would fail
 * on the documentation of its own removal. That is a real trap in this
 * repository, where the reasoning lives next to the code. It also means this
 * test checks code, not comments, which is the intent.
 */

const MARKET_SURFACE = [
  "../src/app/api/market/route.ts",
  "../src/components/MarketTerminal.tsx",
  "../src/lib/marketFeed.ts",
  "../src/lib/api.ts",
] as const;

function read(relPath: string): string {
  return readFileSync(resolve(import.meta.dirname, relPath), "utf8");
}

/** Removes block and line comments so prose cannot trip a code assertion. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The MARKET section of `lib/api.ts`.
 *
 * That file also holds Steam, AgentCard, Stripe, GitHub and Steam-proof
 * adapters, one of which (`generateDeveloperProof`) legitimately calls
 * `Math.random()` to build a *simulated* proof hash outside the market
 * concerns. Scanning the whole file would flag it, so the scan is scoped to the
 * section between the MARKET banner and the next one.
 *
 * The section is cut from the RAW source and only then stripped: the banner is
 * itself a comment, so stripping first would delete the marker being searched
 * for. (Measured — the first version of this file did exactly that and failed
 * with "MARKET banner not found".)
 */
function marketSectionOfApiTs(rawSource: string): string {
  const marker = "// ==================== MARKET ====================";
  const start = rawSource.indexOf(marker);
  expect(start, `MARKET banner not found in lib/api.ts`).toBeGreaterThanOrEqual(0);
  const rest = rawSource.slice(start + marker.length);
  const nextBanner = rest.indexOf("// ====================");
  const section = nextBanner === -1 ? rest : rest.slice(0, nextBanner);
  return stripComments(section);
}

const stripped = new Map<string, string>(
  MARKET_SURFACE.map((p) => [p, stripComments(read(p))])
);

/** Identifiers and literals that existed only to fabricate market data. */
const FABRICATION_MARKERS = [
  "FALLBACK_MARKET_DATA",
  "seededRandom",
  "utcDaySeed",
  "synthetic_curated",
  "synthetic_fallback",
  "TICKER_TAPE",
  "ord_init_aapl",
  "monad_oracle_gatekeeper",
  "cached_calibrated_mirror",
];

/** The literal values from the deleted fallback table and the preset order. */
const FABRICATED_VALUES = [
  // Both written forms: the status banner used the thousands-separated form,
  // while an API-shaped payload would carry the bare one. Guarding only the
  // first was measured to be insufficient — reinjecting the account as
  // `cash: "100000.00"` passed the scan.
  '"100,000.00"',
  '"400,000.00"',
  '"100000.00"',
  '"400000.00"',
  "142.8",
  "234.5",
  "258.4",
  "65420",
  "2640.5",
];

describe("market surface — no fabrication markers survive", () => {
  it("scanned real content from every file", () => {
    // Self-check. If a path is wrong or a stripper eats a file, every
    // assertion below passes vacuously — which is the failure mode this whole
    // exercise is about ("a probe that cannot fail proves nothing").
    for (const path of MARKET_SURFACE) {
      expect(stripped.get(path)!.length, `${path} produced no content`).toBeGreaterThan(200);
    }
    expect(stripped.get("../src/app/api/market/route.ts")).toContain("export async function GET");
  });

  for (const path of MARKET_SURFACE) {
    describe(path, () => {
      it("contains no fabrication identifier", () => {
        const source = stripped.get(path)!;
        for (const marker of FABRICATION_MARKERS) {
          expect(source, `${path} still references ${marker}`).not.toContain(marker);
        }
      });

      it("contains no hardcoded quote from the deleted fallback table", () => {
        const source = stripped.get(path)!;
        for (const value of FABRICATED_VALUES) {
          expect(source, `${path} still hardcodes ${value}`).not.toContain(value);
        }
      });
    });
  }

  it("never calls the random number generator in the market path", () => {
    // `Math.random()` is the root of the original defect: two refreshes of the
    // same page showed two different price histories, and one of them was the
    // one a judge would be asked to verify.
    const randomCall = /Math\s*\.\s*random\s*\(/;
    for (const path of MARKET_SURFACE) {
      const source = path.endsWith("lib/api.ts")
        ? marketSectionOfApiTs(read(path))
        : stripped.get(path)!;
      expect(randomCall.test(source), `${path} calls Math.random()`).toBe(false);
    }
  });

  it("does not name a company the upstream never mentioned", () => {
    // The old route hardcoded display names: "NVIDIA Corporation",
    // "Apple Inc.", "Monad Ecosystem Token (Parallel EVM)".
    const source = stripped.get("../src/app/api/market/route.ts")!;
    expect(source).not.toContain("NVIDIA Corporation");
    expect(source).not.toContain("Apple Inc.");
    expect(source).not.toContain("Monad Ecosystem Token");
  });
});

describe("market surface — the provenance fields stay on the wire", () => {
  it("the route and the client both carry source and synthetic", () => {
    // The relay is only auditable if provenance travels with the number. Drop
    // these from the payload and a caller can no longer tell a real quote from
    // a flagged one.
    const route = stripped.get("../src/app/api/market/route.ts")!;
    expect(route).toContain("buildSymbolPayload");

    const feed = stripped.get("../src/lib/marketFeed.ts")!;
    expect(feed).toContain("synthetic");
    expect(feed).toContain("dataCaveat");
  });

  it("the terminal renders the value absences instead of substituting defaults", () => {
    // The `|| "NASDAQ"` and `|| "NVIDIA Corporation"` fallbacks were removed
    // because a guessed exchange is a fabricated field, indistinguishable on
    // screen from a reported one.
    const terminal = stripped.get("../src/components/MarketTerminal.tsx")!;
    expect(terminal).toContain("交易所未标注");
    expect(terminal).not.toContain('|| "NASDAQ"');
    expect(terminal).not.toContain("NVIDIA Corporation");
  });
});
