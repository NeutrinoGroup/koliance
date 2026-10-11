import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

/**
 * The market surface must stay free of locally produced market data.
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
 * ---------------------------------------------------------------------------
 * THIS FILE MEASURES PROPERTIES, NOT VALUES. (The F3b correction.)
 *
 * The first version of this guard held a **list of literals**:
 *
 *     const FABRICATED_VALUES = ['"100,000.00"', '"400,000.00"', "142.8", …];
 *
 * and asserted the source did not contain them. A list only catches the strings
 * on the list. An independent `qa-validator` measured the consequence
 * (`docs/changes/029`, row F3b): injecting the three values
 * `"98500.00"` / `"ord_seed_first"` / `"+7.25%"` — none of which were on the
 * list — left this file **entirely green** (13/13, and the full suite 19 files,
 * exit 0). The list had grown once already for exactly this reason (`028` §4.4
 * F4b: the first version held only `"100,000.00"`, and the injected value was
 * `"100000.00"`), which is the tell: a value list is the wrong *kind* of
 * judgement, so patching it again would only move the hole.
 *
 * So the question this file asks is no longer "is this string on the list"
 * but **"is this thing shaped like a market fact"**, over the parsed source:
 *
 *   1. a written number that is market-sized in its own string literal,
 *   2. an identifier named after fabrication (`fallback`, `seed`, `tape`, …),
 *   3. a foreign `snake_case` data-source name (`synthetic_curated`, …),
 *   4. a minted order/fill id (`ord_seed_first`, `ord_local_…`),
 *   5. a legal entity name ("… Corporation", "… Inc."),
 *   6. a JSX attribute named like a reported fact carrying a written number.
 *
 * Every threshold below was measured against the real surface before being
 * written down: each property reports **zero** hits on the current sources, and
 * every vector the F3b test used — plus every vector the old list carried — is
 * reported by at least one property. Both directions are asserted, because a
 * scanner that reads nothing also reports nothing (`AGENTS.md` D3: a probe that
 * cannot fail proves nothing).
 *
 * On method, two things carried over from the first version:
 *
 *  - **Comments are blanked before scanning.** These files explain the defect
 *    they fixed, in prose, and name the deleted identifiers while doing so — a
 *    guard over raw text would fire on the documentation of its own removal.
 *    (An AST scan is immune to comment text by construction; the blanking is
 *    kept explicit rather than relied upon, and it preserves every byte offset,
 *    so reported line numbers still point at the real file.)
 *  - **A self-check runs first**, asserting the scan read real content from
 *    every file. Without it, a wrong path or a stripper that eats a file makes
 *    every assertion below pass vacuously.
 *
 * Known bound, stated rather than left to be discovered: the property scan
 * judges **whole** literals and `$`-free adjacency, not numbers embedded
 * mid-sentence. A fabricated quote written inside a longer prose string is not
 * caught. Every vector this defect ever took, on this surface, was a whole
 * literal in a data structure or a state initialiser.
 */

const MARKET_SURFACE = [
  "../src/app/api/market/route.ts",
  "../src/components/MarketTerminal.tsx",
  "../src/lib/marketFeed.ts",
  "../src/lib/api.ts",
] as const;

type MarketFile = (typeof MARKET_SURFACE)[number];

function read(relPath: string): string {
  return readFileSync(resolve(import.meta.dirname, relPath), "utf8");
}

/**
 * Blanks comments **in place**: every removed character becomes a space and
 * newlines are kept, so byte offsets, line and column numbers are unchanged.
 *
 * Not a plain delete, for two measured reasons: a failure message must point at
 * the real file, and a delete would shift every offset after the first comment,
 * making a reported line number a lie. The `(^|[^:])` guard keeps the `//` of a
 * URL inside a string literal from starting a comment.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

/**
 * The market surface of `lib/api.ts`, and only that.
 *
 * That file also holds Steam, AgentCard, Stripe, GitHub and Steam-proof
 * adapters. Two measured reasons the scan must not read them:
 *
 *  - `generateDeveloperProof` legitimately calls `Math.random()` to build a
 *    *simulated* proof hash, outside the market concerns;
 *  - `authorizeMicropayment` defaults `mcc` to `"7999"`, an ISO 18245 merchant
 *    category code — a four-digit integer that any "market-sized number" rule
 *    reports, and a real false positive this guard produced on its first run.
 *
 * So everything outside the region between the MARKET banner and the next one
 * is **blanked, not sliced**: blanking keeps every byte offset, hence every
 * line number a failure reports, pointing at the real file. The other three
 * files on the surface are market-only and are scanned whole.
 */
const MARKET_BANNER = "// ==================== MARKET ====================";

/** Blanks every character but keeps newlines, so offsets and line numbers hold. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, " ");
}

/** The MARKET banner's span in `lib/api.ts`, or a loud failure. */
function marketSectionBounds(rawSource: string): { start: number; end: number } {
  const start = rawSource.indexOf(MARKET_BANNER);
  if (start < 0) {
    // Thrown at collection time on purpose: a guard that cannot find the code
    // it is supposed to be guarding must fail loudly, not pass vacuously.
    throw new Error("MARKET banner not found in lib/api.ts — the guard cannot locate the code it scans");
  }
  const rest = rawSource.slice(start + MARKET_BANNER.length);
  const nextBanner = rest.indexOf("// ====================");
  return { start, end: nextBanner === -1 ? rawSource.length : start + MARKET_BANNER.length + nextBanner };
}

/** `lib/api.ts` with everything outside the MARKET section blanked. */
function marketSectionOfApiTs(rawSource: string): string {
  const { start, end } = marketSectionBounds(rawSource);
  return blank(rawSource.slice(0, start)) + rawSource.slice(start, end) + blank(rawSource.slice(end));
}

/** The complement: the MARKET section blanked, the other adapters left readable. */
function blankOutsideMarket(rawSource: string): string {
  const { start, end } = marketSectionBounds(rawSource);
  return rawSource.slice(0, start) + blank(rawSource.slice(start, end)) + rawSource.slice(end);
}

/**
 * Comment-blanked, position-preserving, market-only source for every file.
 *
 * `lib/api.ts` gets the banner scoping first and the comment blanking second:
 * the banner is itself a comment, so stripping first would delete the marker
 * being searched for. (Measured — the first version of this file did exactly
 * that and failed with "MARKET banner not found".)
 */
const SOURCES = new Map<string, string>(
  MARKET_SURFACE.map((p) => [
    p,
    p.endsWith("lib/api.ts") ? stripComments(marketSectionOfApiTs(read(p))) : stripComments(read(p)),
  ])
);

// ==================== THE PROPERTIES ====================

/**
 * A number written the way a market number is written down.
 *
 * Measured against every numeric string literal on the surface. The thresholds
 * are not decoration — this file is rendered inside a Tailwind + SVG component,
 * where `"0.25"` (an opacity), `"100%"` (a gradient stop) and `"2.5"` (a stroke
 * width) are legitimate presentation constants. Hence four real market markers:
 *
 *   a sign          `+7.25%`, `-3.14`      — a change; a geometry constant is unsigned
 *   a `$`           `$234.00`              — cannot be anything but money
 *   comma grouping  `100,000.00`           — a human-written amount
 *   cents           `142.8`, `98500.00`    — two or more integer digits with a fraction
 *   four digits     `65420`, `10000`       — `0`, `1`, `100` are not market numbers
 *
 * Deliberately NOT market-sized: `0`, `1`, `2.5`, `0.25`, `0.0`, `0%`, `100%`.
 * Measured: the loose form of this check (any `\d+\.\d+`) fires on 30 Tailwind
 * class strings and 5 SVG attributes in `MarketTerminal.tsx` — a guard that
 * cries wolf on `stopOpacity="0.25"` is one that gets deleted.
 */
const NUMERIC_TOKEN = /^([+-]?)(\$?)(\d[\d,]*)(?:\.(\d+))?(%?)$/;

function looksLikeAMarketNumber(text: string): boolean {
  const match = NUMERIC_TOKEN.exec(text.trim());
  if (!match) return false;
  const [, sign, currency, integer, fraction, percent] = match;
  if (sign !== "" || currency !== "") return true;
  if (integer.includes(",")) return true;
  const integerDigits = integer.replace(/^0+/, "").length;
  if (fraction !== undefined) {
    if (integerDigits >= 2) return true;
    return percent !== "" && fraction.length >= 2;
  }
  return integerDigits >= 4;
}

/** Names that exist only to fabricate data. */
const FABRICATION_NAME = /(fallback|fabricat|hardcod|pretend|seed(?:ed)?|ticker_?tape)/i;

/** A `snake_case` literal: a data-source name, never a Tailwind class. */
const FOREIGN_SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

/**
 * A locally minted order or fill id.
 *
 * The trailing `[A-Za-z0-9]` is load-bearing: the terminal legitimately builds
 * `` `ord_${Date.now()}` `` as a local record key, whose quasi is exactly
 * `"ord_"`. Requiring a literal fragment after the separator distinguishes that
 * key from a seeded fill (`ord_init_aapl`, `ord_seed_first`, `ord_local_…`).
 */
const MINTED_LOCAL_ID = /^(?:ord|order|fill|trade|pos|position)[_-][A-Za-z0-9]/;

/**
 * A legal entity suffix: a display name no upstream published.
 *
 * The delimiters are `(?:^|[^\w])` … `(?=$|[^\w])` rather than `\b` … `\b`:
 * a trailing `\b` cannot match after `Inc.`, because the character before the
 * end of the string is a dot, not a word character. Measured — the `\b` form
 * silently failed to recognise `"Apple Inc."`, the very name this rule exists
 * for, and the negative control caught it.
 */
const LEGAL_ENTITY =
  /(?:^|[^\w])(?:Inc\.|Incorporated|Corporation|Corp\.|LLC|Ltd\.?|Limited|Holdings|PLC|GmbH)(?=$|[^\w])/;

/**
 * JSX attributes whose *name* says "this prop is a reported fact".
 *
 * A class of names, not a list of values — and the reason the numeric check
 * waives JSX attributes for everything else. Two attributes on this surface are
 * written numbers by design: `offset="100%"` and `stopOpacity="0.25"` on the
 * chart gradient. Waiving the whole position is what makes the guard live; this
 * rule keeps the one channel where such a waiver would hide a real defect — a
 * fabricated quote passed as a prop (`<MetricCell value="98500.00" />`), which
 * is exactly how a hardcoded number re-enters a component that later stopped
 * receiving it from data.
 */
const REPORTED_FACT_ATTRIBUTE =
  /^(?:value|price|amount|balance|equity|cash|qty|quantity|notional|pnl|change|changePercent|percent|percentChange|total|cost|open|high|low|close|volume|marketCap|leverage|apy|rate|fee|reward)$/i;

// ==================== THE SCANNER ====================

interface FabricationHit {
  /** Which property fired. */
  property: string;
  text: string;
  line: number;
}

interface ScanResult {
  hits: FabricationHit[];
  /** Counts, so the caller can prove the scan read real content. */
  identifiers: number;
  literals: number;
  jsxAttributes: number;
}

/**
 * Runs all six properties over one source text.
 *
 * Takes text rather than a path on purpose: the negative controls below run the
 * *same* function over injected sources. One predicate, two applications — if
 * the controls called a copy, they would be proving something about the copy.
 */
function scan(sourceText: string, kind: ts.ScriptKind): ScanResult {
  const sf = ts.createSourceFile("scanned", sourceText, ts.ScriptTarget.ES2022, true, kind);
  const hits: FabricationHit[] = [];
  let identifiers = 0;
  let literals = 0;
  let jsxAttributes = 0;

  const report = (property: string, text: string, node: ts.Node): void => {
    hits.push({
      property,
      text,
      line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      identifiers += 1;
      if (FABRICATION_NAME.test(node.text)) report("fabrication-name", node.text, node);
    } else if (ts.isPropertyAccessExpression(node)) {
      if (FABRICATION_NAME.test(node.name.text)) report("fabrication-member", `.${node.name.text}`, node);
    }

    if (ts.isJsxAttribute(node)) {
      jsxAttributes += 1;
      if (
        node.initializer !== undefined &&
        ts.isStringLiteral(node.initializer) &&
        REPORTED_FACT_ATTRIBUTE.test(node.name.getText()) &&
        /\d/.test(node.initializer.text)
      ) {
        report("reported-fact-attribute", `${node.name.getText()}="${node.initializer.text}"`, node);
      }
    } else if (ts.isStringLiteralLike(node)) {
      literals += 1;
      const inAttribute = node.parent !== undefined && ts.isJsxAttribute(node.parent);
      if (!inAttribute) {
        if (looksLikeAMarketNumber(node.text)) report("market-number", node.text, node);
        if (FOREIGN_SNAKE_CASE.test(node.text)) report("foreign-source-name", node.text, node);
        if (LEGAL_ENTITY.test(node.text)) report("legal-entity", node.text, node);
        if (MINTED_LOCAL_ID.test(node.text)) report("minted-order-id", node.text, node);
      }
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      literals += 1;
      if (looksLikeAMarketNumber(node.text)) report("market-number", node.text, node);
      if (MINTED_LOCAL_ID.test(node.text)) report("minted-order-id", node.text, node);
    } else if (ts.isJsxText(node)) {
      literals += 1;
      const text = node.text.trim();
      if (text !== "") {
        if (looksLikeAMarketNumber(text)) report("market-number", text, node);
        if (LEGAL_ENTITY.test(text)) report("legal-entity", text, node);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);
  return { hits, identifiers, literals, jsxAttributes };
}

function scriptKindOf(relPath: string): ts.ScriptKind {
  return relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

/** One real, code-only token per file, used to prove the stripper kept the code. */
const KEPT_CODE_TOKEN: Record<MarketFile, string> = {
  "../src/app/api/market/route.ts": "export async function GET",
  "../src/components/MarketTerminal.tsx": "export function MarketTerminal",
  "../src/lib/marketFeed.ts": "export function buildSymbolPayload",
  "../src/lib/api.ts": "export async function fetchMarketMovers",
};

/** Measured: every one of these is reported by at least one property below. */
const F3B_VECTORS = ["98500.00", "ord_seed_first", "+7.25%"] as const;

function formatHits(hits: FabricationHit[]): string {
  return hits.map((h) => `${h.property} ${JSON.stringify(h.text)} @${h.line}`).join("; ");
}

describe("market surface — no fabricated market fact survives", () => {
  it("scanned real content from every file", () => {
    // Self-check. If a path is wrong or the stripper eats a file, every
    // assertion below passes vacuously — which is the failure mode this whole
    // exercise is about ("a probe that cannot fail proves nothing").
    for (const path of MARKET_SURFACE) {
      const scanned = scan(SOURCES.get(path)!, scriptKindOf(path));
      expect(SOURCES.get(path)!.length, `${path} produced no content`).toBeGreaterThan(500);
      expect(scanned.identifiers, `${path} yielded no identifiers`).toBeGreaterThan(50);
      expect(scanned.literals, `${path} yielded no string literals`).toBeGreaterThan(10);
      expect(SOURCES.get(path)!, `${path} lost its code to the comment stripper`).toContain(
        KEPT_CODE_TOKEN[path]
      );
    }
    // And the route is recognisably the route.
    expect(SOURCES.get("../src/app/api/market/route.ts")).toContain("export async function GET");
    expect(scan(SOURCES.get("../src/components/MarketTerminal.tsx")!, ts.ScriptKind.TSX).jsxAttributes)
      .toBeGreaterThan(50);
  });

  for (const path of MARKET_SURFACE) {
    it(`${path} contains no fabricated value, source name, order id or entity`, () => {
      const scanned = scan(SOURCES.get(path)!, scriptKindOf(path));
      expect(
        scanned.hits,
        `${path} carries fabricated market data — ${formatHits(scanned.hits)}`
      ).toEqual([]);
    });
  }

  it("never calls the random number generator in the market path", () => {
    // `Math.random()` is the root of the original defect: two refreshes of the
    // same page showed two different price histories, and one of them was the
    // one a judge would be asked to verify.
    //
    // The negative-control side of this test is that the pattern itself must be
    // able to match: `lib/api.ts` outside the MARKET banner does call it, which
    // is what makes the banner scoping load-bearing rather than decorative.
    const randomCall = /Math\s*\.\s*random\s*\(/;
    for (const path of MARKET_SURFACE) {
      const source = SOURCES.get(path)!;
      expect(randomCall.test(source), `${path} calls Math.random()`).toBe(false);
    }
    expect(
      randomCall.test(blankOutsideMarket(read("../src/lib/api.ts"))),
      "the control is blind: no Math.random() outside the MARKET section either"
    ).toBe(true);
  });

  it("does not name a company the upstream never mentioned", () => {
    // Three display names the old route invented: "NVIDIA Corporation",
    // "Apple Inc." and "Monad Ecosystem Token (Parallel EVM)".
    //
    // Two of them carry a legal suffix, which is the shape `LEGAL_ENTITY`
    // recognises; their own recognition is asserted below, because a pin whose
    // predicate no longer matches it is a pin that has quietly stopped pinning.
    //
    // The third is pinned as a literal only, and that is a stated bound rather
    // than a finished property: "Monad Ecosystem Token" has no legal suffix, and
    // the obvious generalisation — "two or more capitalised words" — was
    // measured to fire on this surface's legitimate copy ("Alpaca Daily Bars
    // Tape", "Loading Chart Data..."). Catching it by shape needs a rule this
    // surface does not yet justify, so it stays a pin. The route it lived in is
    // scanned for that pin on every run.
    const source = SOURCES.get("../src/app/api/market/route.ts")!;
    const pinned = ["NVIDIA Corporation", "Apple Inc.", "Monad Ecosystem Token"];
    for (const name of pinned) {
      expect(source, `route.ts names the fabricated company ${JSON.stringify(name)}`).not.toContain(name);
    }

    expect(LEGAL_ENTITY.test("NVIDIA Corporation"), "NVIDIA Corporation").toBe(true);
    expect(LEGAL_ENTITY.test("Apple Inc."), "Apple Inc.").toBe(true);
    // The bound, asserted so it cannot rot into a false belief: the suffixless
    // one is NOT recognised by the property.
    expect(LEGAL_ENTITY.test("Monad Ecosystem Token (Parallel EVM)"), "suffixless name").toBe(false);
  });
});

describe("market surface — the provenance fields stay on the wire", () => {
  it("the route and the client both carry source and synthetic", () => {
    // The relay is only auditable if provenance travels with the number. Drop
    // these from the payload and a caller can no longer tell a real quote from
    // a flagged one.
    const route = SOURCES.get("../src/app/api/market/route.ts")!;
    expect(route).toContain("buildSymbolPayload");

    const feed = SOURCES.get("../src/lib/marketFeed.ts")!;
    expect(feed).toContain("synthetic");
    expect(feed).toContain("dataCaveat");
  });

  it("the terminal renders the value absences instead of substituting defaults", () => {
    // The `|| "NASDAQ"` and `|| "NVIDIA Corporation"` fallbacks were removed
    // because a guessed exchange is a fabricated field, indistinguishable on
    // screen from a reported one.
    const terminal = SOURCES.get("../src/components/MarketTerminal.tsx")!;
    expect(terminal).toContain("交易所未标注");
    expect(terminal).not.toContain('|| "NASDAQ"');
    expect(terminal).not.toContain("NVIDIA Corporation");
  });
});

// ==================== NEGATIVE CONTROLS (D3) ====================
//
// Every property above is a predicate over parsed source. This section runs the
// same predicate over sources that HAVE the defect, so "found nothing" can be
// told apart from "cannot find anything". The vectors are the ones the deleted
// value list is measured to have missed.

describe("market surface — the property scan has teeth", () => {
  it("fires on the exact vectors the deleted value list did not know", () => {
    // The F3b finding, as an executable fact: a component that seeds a quote, an
    // order id and a percent with values nobody had enumerated.
    const injection = `
export function InjectedSeed() {
  const [cash] = useState("98500.00");
  const [orderId] = useState("ord_seed_first");
  const [move] = useState("+7.25%");
  return <div data-order={orderId}>{move}{cash}</div>;
}
`;
    // Appended to the real component: the closest reproduction of the
    // `qa-validator` injection, which reddened the failing guard's sibling
    // (`market-independence.test.ts`) while leaving this file green.
    const real = read(MARKET_SURFACE[1]);
    const { hits } = scan(stripComments(real + injection), ts.ScriptKind.TSX);
    for (const vector of F3B_VECTORS) {
      expect(
        hits.some((h) => h.text.includes(vector)),
        `the property scan missed ${vector} — hits were ${formatHits(hits)}`
      ).toBe(true);
    }

    // Measured, and the reason this file was rewritten: the deleted list held
    // none of the three. If a future edit reintroduces such a list containing
    // them, this control has served its purpose and should be replaced by the
    // assertion that the list is gone.
    const deletedList = ['"100,000.00"', '"400,000.00"', '"100000.00"', '"400000.00"', "142.8", "234.5", "258.4", "65420", "2640.5"];
    for (const vector of F3B_VECTORS) {
      expect(deletedList.includes(vector), `deleted list unexpectedly held ${vector}`).toBe(false);
    }
    expect(deletedList.some((v) => injection.includes(v))).toBe(false);
  });

  it("fires on every vector the deleted list DID hold", () => {
    // The other direction, so the rewrite is a strict improvement and not a
    // trade: nothing the old list could see became invisible.
    const injection = `
const FALLBACK_MARKET_DATA = { NVDA: "142.8", AAPL: "234.5", MON: "258.4" };
const TICKER_TAPE = [
  { symbol: "NVDA", price: "$234.00", change: "+3.14%", volume: "65420", cap: "2640.5" },
];
const id = "ord_init_aapl";
const account = { cash: "100,000.00", buyingPower: "100000.00", equity: "400,000.00" };
const source = "synthetic_curated";
const other = "cached_calibrated_mirror";
const legacy = "monad_oracle_gatekeeper";
const name = "NVIDIA Corporation";
`;
    const { hits } = scan(injection, ts.ScriptKind.TSX);
    const vectors = [
      "142.8",
      "234.5",
      "258.4",
      "$234.00",
      "+3.14%",
      "65420",
      "2640.5",
      "ord_init_aapl",
      "100,000.00",
      "100000.00",
      "400,000.00",
      "synthetic_curated",
      "cached_calibrated_mirror",
      "monad_oracle_gatekeeper",
      "NVIDIA Corporation",
      "FALLBACK_MARKET_DATA",
      "TICKER_TAPE",
    ];
    const missed = vectors.filter((v) => !hits.some((h) => h.text.includes(v)));
    expect(missed, `the property scan missed ${JSON.stringify(missed)}`).toEqual([]);
  });

  it("fires on a fabricated quote hiding in a prop named like a reported fact", () => {
    // The JSX-attribute route into a component. This is the one channel the
    // numeric property waives (gradient stops and stroke widths live there), so
    // it has its own rule and its own control.
    const injection = `<MetricCell label="市值" value="98500.00" />`;
    const { hits } = scan(injection, ts.ScriptKind.TSX);
    expect(hits.map((h) => h.property)).toContain("reported-fact-attribute");
    expect(hits[0].text).toContain("98500.00");

    // And the waiver is not a hole for the markers: the same attribute split
    // across two attributes, one of which is a reported fact, still fires.
    const { hits: mixed } = scan(`<Stop offset="100%" stopOpacity="0.25" value={fmt(x)} />`, ts.ScriptKind.TSX);
    expect(mixed, `geometric attributes must not fire — ${formatHits(mixed)}`).toEqual([]);
  });

  it("stays quiet on the real surface, and reports a hit for each property", () => {
    // Paired so the three controls above cannot be satisfied by a matcher that
    // fires on everything.
    for (const path of MARKET_SURFACE) {
      const { hits } = scan(SOURCES.get(path)!, scriptKindOf(path));
      expect(hits, `${path} — ${formatHits(hits)}`).toEqual([]);
    }

    const seen = new Set<string>();
    const probes: Array<[string, ts.ScriptKind]> = [
      ["const FALLBACK_MARKET_DATA = {};", ts.ScriptKind.TS],
      ['const source = "synthetic_curated";', ts.ScriptKind.TS],
      ['const id = "ord_seed_first";', ts.ScriptKind.TS],
      ['const name = "Apple Inc.";', ts.ScriptKind.TS],
      ['const name = "NVIDIA Corporation";', ts.ScriptKind.TS],
      ['const quote = "142.80";', ts.ScriptKind.TS],
      ["const el = <MetricCell value=\"98500.00\" />;", ts.ScriptKind.TSX],
    ];
    for (const [source, kind] of probes) {
      for (const hit of scan(source, kind).hits) seen.add(hit.property);
    }
    expect([...seen].sort()).toEqual([
      "fabrication-name",
      "foreign-source-name",
      "legal-entity",
      "market-number",
      "minted-order-id",
      "reported-fact-attribute",
    ]);
  });
});
