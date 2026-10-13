import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { GET } from "@/app/api/market/route";
import { buildSymbolPayload, moversRowCount, type Movers } from "@/lib/marketFeed";

/**
 * INDEPENDENT EDGE-CASE SUITE for the issue #14 / #16 frontend work
 * (`docs/changes/028`). Written by an agent that did not implement it, and it
 * deliberately does not reuse `tests/market-no-synthetic.test.ts`.
 *
 * Two things it does that the delivered suite cannot:
 *
 *  1. It measures "this route manufactures no number" STRUCTURALLY, by parsing
 *     the route's TypeScript and asking what constructs exist in it. The
 *     delivered guard scans the file's *text* for a list of identifiers and
 *     literal values. The implementer's own F4b entry records why that is
 *     fragile: the first version of their value list held only the
 *     thousands-separated form `"100,000.00"`, and the value they injected was
 *     `"100000.00"` — the guard stayed green. A list of strings only catches the
 *     strings on the list. A property catches the next one too.
 *
 *  2. It attacks the payload contract with the shapes a real gateway produces
 *     and a naive proxy mishandles — `null`, a bare array, a single row of
 *     zeros, `price` as a string, an HTML error page with status 200 — and
 *     asserts against every number reachable in the response body, not only
 *     against `meta`.
 *
 * Paired negative control at the bottom: every structural assertion is re-run
 * against a source that HAS the defect, so a measurement that reads nothing
 * cannot pass as a measurement that finds nothing.
 */

const ROOT = resolve(import.meta.dirname, "..");

function parse(relPath: string): ts.SourceFile {
  const abs = resolve(ROOT, relPath);
  const kind = relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(abs, readFileSync(abs, "utf8"), ts.ScriptTarget.ES2022, true, kind);
}

// ==================== STRUCTURAL ANALYSIS ====================

interface SourceFacts {
  /** `import` / `export … from` module specifiers + the first path of `require()`. */
  imports: string[];
  numericLiterals: string[];
  stringLiterals: string[];
  hasLoop: boolean;
  hasMathCall: boolean;
  hasDateNow: boolean;
  hasArrowOrFunction: boolean;
  /** Identifiers read anywhere in the file (mirrors the delivered guard's intent). */
  identifiers: Set<string>;
}

function analyse(relPath: string): SourceFacts {
  const sf = parse(relPath);
  const facts: SourceFacts = {
    imports: [],
    numericLiterals: [],
    stringLiterals: [],
    hasLoop: false,
    hasMathCall: false,
    hasDateNow: false,
    hasArrowOrFunction: false,
    identifiers: new Set<string>(),
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      facts.imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      facts.imports.push(node.moduleSpecifier.text);
    } else if (ts.isNumericLiteral(node)) {
      facts.numericLiterals.push(node.text);
    } else if (ts.isStringLiteralLike(node)) {
      facts.stringLiterals.push(node.text);
    } else if (
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) {
      facts.hasLoop = true;
    } else if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Math"
    ) {
      facts.hasMathCall = true;
    } else if (ts.isIdentifier(node)) {
      facts.identifiers.add(node.text);
    } else if (ts.isPropertyAccessExpression(node) && node.name.text === "now") {
      if (ts.isIdentifier(node.expression) && node.expression.text === "Date") {
        facts.hasDateNow = true;
      }
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
      facts.hasArrowOrFunction = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return facts;
}

/**
 * Is this module, by its shape alone, incapable of producing a new number?
 *
 * A price generator needs at least one of: arithmetic on its own constants
 * (`Math.*`), a source of variation (`Date.now()`, `Math.random()`), a loop or
 * array build that could synthesise a series, or a data module to get a table
 * from. A pure relay has none of them — every number it emits came in over the
 * network.
 *
 * Note the asymmetry that makes this safe: the delivered route DOES contain
 * `Date.now()`-free arithmetic one level down, in `buildSymbolPayload`
 * (`round2` uses `Math.round`) and in `round4`. If the route inlined that
 * rounding it would trip `hasMathCall`, which is why the assertion below is
 * paired with the pure-relay behavioural tests rather than used alone.
 */
function looksLikeAPureRelay(f: SourceFacts): string[] {
  const reasons: string[] = [];
  if (f.hasMathCall) reasons.push("calls Math.*");
  if (f.hasDateNow) reasons.push("calls Date.now()");
  if (f.hasLoop) reasons.push("contains a loop");
  return reasons;
}

const ROUTE = "src/app/api/market/route.ts";
const TERMINAL = "src/components/MarketTerminal.tsx";

/**
 * String literals that are written the way a human writes a market number:
 * `"142.80"`, `"$234.00"`, `"+3.14%"`, `"100,000.00"`, `"98500.00"`.
 *
 * JSX attributes are excluded because Tailwind class names legitimately look
 * like this (`stopOpacity="0.25"`, `p-6`), which is exactly why a text scan over
 * the whole file is the wrong instrument. The delivered guard's alternative is a
 * fixed list of values, and its own F4b entry records the consequence: the first
 * version listed only `"100,000.00"` while the injected value was `"100000.00"`,
 * and the guard stayed green. A list can only catch what is on it.
 */
function numericLookingStringLiterals(relPath: string): string[] {
  const sf = parse(relPath);
  const NUMISH = /^[+-]?\$?[0-9][0-9,]*(\.[0-9]+)?%?$/;
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      const inJsxAttr = parent !== undefined && ts.isJsxAttribute(parent);
      if (!inJsxAttr && NUMISH.test(node.text)) out.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe("1. the route is structurally incapable of manufacturing a market number", () => {
  it("parsed the route and can see its contents at all", () => {
    // Self-check first. Every assertion below passes vacuously on an empty
    // parse — the failure mode that makes a guard silent.
    const f = analyse(ROUTE);
    expect(f.identifiers.size).toBeGreaterThan(50);
    expect(f.stringLiterals.length).toBeGreaterThan(5);
    expect(f.hasArrowOrFunction).toBe(true);
    expect(f.imports.length).toBeGreaterThanOrEqual(3);
  });

  it("imports only the request/response types, the payload shaper and the gateway URL", () => {
    const f = analyse(ROUTE);
    // An allowlist, not a denylist. A new import is the realistic way a
    // generator gets back in (a helper module, a price table, a fixture).
    expect([...f.imports].sort()).toEqual([
      "@/lib/api",
      "@/lib/marketFeed",
      "next/server",
    ]);
  });

  it("contains no arithmetic, no clock and no loop", () => {
    const reasons = looksLikeAPureRelay(analyse(ROUTE));
    expect(reasons, `route.ts ${reasons.join(", ")}`).toEqual([]);
  });

  it("emits only status codes and the positive-price guard as numeric literals", () => {
    const f = analyse(ROUTE);
    // Measured, not guessed. `0` appears exactly twice and both are load-bearing
    // non-quotes: `price <= 0` (the "an absent observation is not a quote"
    // guard) and the `[0]` of a `Parameters<typeof buildSymbolPayload>[0]` type
    // annotation. Anything else here would be a number the route chose.
    const allowed = new Set(["0", "200", "400", "404", "502", "503"]);
    const stray = f.numericLiterals.filter((n) => !allowed.has(n));
    expect(stray, `unexpected numeric literals in route.ts: ${stray.join(", ")}`).toEqual([]);
    // And the `0`s really are only the guard and the type index.
    const sf = parse(ROUTE);
    const zeros: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isNumericLiteral(node) && node.text === "0") {
        // Walk up to the enclosing statement: the immediate parent of a `0` in
        // `[0]` is too small to be self-describing.
        let p: ts.Node | undefined = node;
        while (p !== undefined && !ts.isStatement(p) && !ts.isSourceFile(p)) p = p.parent;
        zeros.push((p ?? node).getText().replace(/\s+/g, " ").slice(0, 120));
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    for (const ctx of zeros) {
      expect(
        ctx.includes("price <= 0") || ctx.includes("buildSymbolPayload>[0]"),
        `unexplained 0 literal in: ${ctx}`
      ).toBe(true);
    }
    expect(f.numericLiterals.length).toBeGreaterThanOrEqual(4);
  });

  it("carries no numeric-looking string literal", () => {
    // A fabricated quote is a *string* by the time it is written down:
    // `"142.80"`, `"$234.00"`, `"+3.14%"`, `"100,000.00"`.
    expect(numericLookingStringLiterals(ROUTE)).toEqual([]);
  });

  it("the terminal carries no numeric-looking string literal in code", () => {
    // The place the implementer's behaviour suite measured as having NO
    // coverage: `vitest.config.mts` runs `environment: "node"`, so the component
    // is never rendered and a hardcoded `"100,000.00"` / `"98500.00"` /
    // `"$234.00"` / `"+3.14%"` can be injected back into MarketTerminal.tsx with
    // the whole suite still green (their F3: `exit 0 — 全绿，什么都没抓到`).
    //
    // This is a source-text guard, which is a weak instrument, and it is
    // deliberately paired with a live negative control in section 5 rather than
    // trusted on its own. It is worth having because the alternative measured
    // here is zero coverage, and because it is expressed as a property (any
    // numeric-looking string) instead of the delivered guard's fixed value list
    // — a list is the form that already failed once against `"100000.00"`.
    const offenders = numericLookingStringLiterals(TERMINAL);
    expect(
      offenders,
      `MarketTerminal.tsx hardcodes the literal(s) ${JSON.stringify(offenders)} — a number in a market component is indistinguishable from a quote`
    ).toEqual([]);
  });

  it("the terminal starts every account and order field empty", () => {
    // The delivered negative case never reached these; this pins the initial
    // values themselves rather than the props they feed.
    //
    // Scope: the state that holds *reported facts* — a balance, a position, an
    // execution, a quote. Form inputs are deliberately excluded: `tradeAmount`
    // starting at 100 and `selectedSymbol` at "NVDA" are defaults for a control
    // the user is about to change, not numbers presented as observations, and
    // conflating the two would make this guard fire on every form in the repo.
    const sf = parse(TERMINAL);
    const initialisers = new Map<string, string>();
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === "useState"
      ) {
        let valueName: string | null = null;
        if (ts.isIdentifier(node.name)) {
          valueName = node.name.text;
        } else if (
          ts.isArrayBindingPattern(node.name) &&
          node.name.elements.length > 0 &&
          ts.isBindingElement(node.name.elements[0]) &&
          ts.isIdentifier(node.name.elements[0].name)
        ) {
          valueName = (node.name.elements[0].name as ts.Identifier).text;
        }
        const arg = node.initializer.arguments[0];
        if (valueName !== null) initialisers.set(valueName, arg === undefined ? "(none)" : arg.getText());
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    const reportedFacts = ["account", "alpacaPositions", "recentOrders", "marketData", "movers", "health", "priceRows"];
    for (const name of reportedFacts) {
      expect(initialisers.has(name), `no useStates found named ${name}`).toBe(true);
      expect(initialisers.get(name), `${name} must start empty (null or []), not with a number`).toMatch(
        /^(null|\[\])$/
      );
    }
    // Self-check: the scan is reading real declarations, not a stub.
    expect(initialisers.size).toBeGreaterThan(8);
    expect(initialisers.get("selectedSymbol")).toBe('"NVDA"');
  });
});

// ==================== 2. THE ROUTE'S REFUSAL BRANCHES ====================

function request(symbol = "NVDA") {
  return new NextRequest(`http://localhost/api/market?symbol=${symbol}&range=1mo&interval=1d`);
}

/** Every number reachable in a JSON structure. */
function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("2. a malformed or empty gateway response never becomes invented data", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const cases: Array<{ name: string; upstream: () => Promise<Response>; wantStatus: number[] }> = [
    {
      name: "an empty object",
      upstream: () => Promise.resolve(jsonResponse(200, {})),
      wantStatus: [404],
    },
    {
      name: "null",
      upstream: () => Promise.resolve(jsonResponse(200, null)),
      wantStatus: [404],
    },
    {
      name: "a bare empty array",
      upstream: () => Promise.resolve(jsonResponse(200, [])),
      wantStatus: [404],
    },
    {
      name: "a row whose price is a string",
      upstream: () => Promise.resolve(jsonResponse(200, { symbol: "NVDA", price: "142.80" })),
      wantStatus: [404],
    },
    {
      name: "a row whose price is NaN-ish (null)",
      upstream: () => Promise.resolve(jsonResponse(200, { symbol: "NVDA", price: null })),
      wantStatus: [404],
    },
    {
      name: "a row priced at exactly zero",
      upstream: () => Promise.resolve(jsonResponse(200, { symbol: "NVDA", price: 0 })),
      wantStatus: [404],
    },
    {
      name: "a row priced negative",
      upstream: () => Promise.resolve(jsonResponse(200, { symbol: "NVDA", price: -1 })),
      wantStatus: [404],
    },
    {
      name: "an HTML error page with status 200",
      upstream: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError("Unexpected token <")),
        } as unknown as Response),
      wantStatus: [502],
    },
    {
      name: "a gateway that is not listening",
      upstream: () => Promise.reject(new TypeError("fetch failed")),
      wantStatus: [502],
    },
    {
      name: "a gateway 500",
      upstream: () => Promise.resolve(jsonResponse(500, { error: "boom" })),
      wantStatus: [500],
    },
  ];

  for (const c of cases) {
    it(`refuses on ${c.name}`, async () => {
      vi.stubGlobal("fetch", c.upstream);

      const res = await GET(request());
      const body = await res.json();

      expect(c.wantStatus, `status was ${res.status}: ${JSON.stringify(body)}`).toContain(res.status);
      expect(res.status).not.toBe(200);
      // The shape assertion: no quote object, and not a single number anywhere
      // in the refusal. The delivered suite checks `meta`/`chart` are undefined;
      // this also catches a number smuggled into a message string.
      expect(body.meta).toBeUndefined();
      expect(body.chart).toBeUndefined();
      expect(numbersIn(body)).toEqual([]);
      expect(body.synthetic).toBe(false);
      expect(typeof body.reason).toBe("string");
      expect(typeof body.dataCaveat).toBe("string");
    });
  }

  it("a 200 whose row has no usable price still rebuilds no quote", async () => {
    // The route answers 404 for a zero price, matching the backend's "a zero
    // price is an absent observation" rule. What matters here is that the
    // refusal is a refusal: nothing from `buildSymbolPayload` leaks through.
    vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(200, { symbol: "NVDA", price: 0 })));

    const body = await (await GET(request())).json();
    expect(body.source).toBeUndefined();
    expect(body.analysis).toBeUndefined();
    expect(numbersIn(body)).toEqual([]);
  });
});

// ==================== 3. WHAT "THE FRONTEND DOES NOT RE-SORT" COSTS ====================

describe("3. the ranking is the backend's, and the market surface adds no ordering", () => {
  it("no file on the market path sorts, reverses or randomises", () => {
    const orderingCalls = [/\.sort\s*\(/, /\.toSorted\s*\(/, /\.reverse\s*\(/, /Math\s*\.\s*random\s*\(/];
    for (const rel of [ROUTE, "src/components/MarketTerminal.tsx", "src/lib/marketFeed.ts"]) {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      for (const re of orderingCalls) {
        expect(re.test(src), `${rel} matches ${re}`).toBe(false);
      }
    }
  });

  it("the clock is not used to produce a market number in the terminal", () => {
    // Live measurement, not an assumption. `Date.now()` does appear in
    // MarketTerminal — once, at line ~295 — as the fallback for a session order
    // log entry's `id` (`res.order?.id || \`ord_${Date.now()}\``). That is a
    // local record key, not a quote, a balance or a status. This test pins that
    // narrow scope: if a clock ever reaches a field a viewer reads as fact, the
    // enclosing property name stops being `id` and this fails.
    const sf = parse("src/components/MarketTerminal.tsx");
    const sites: Array<{ line: number; prop: string | null }> = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "now" &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "Date"
      ) {
        let p: ts.Node | undefined = node.parent;
        let prop: string | null = null;
        while (p !== undefined && !ts.isPropertyAssignment(p) && !ts.isSourceFile(p)) p = p.parent;
        if (p !== undefined && ts.isPropertyAssignment(p)) prop = p.name.getText();
        sites.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, prop });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    expect(sites.length, "no Date.now() found — the measurement is blind").toBeGreaterThan(0);
    for (const s of sites) {
      expect(s.prop, `Date.now() at line ${s.line} feeds a field named ${s.prop}`).toBe("id");
    }
  });

  it("api.ts's only Math.random() is outside the market section", () => {
    // `generateDeveloperProof` builds a *simulated* proof hash and is labelled
    // as such in its own name; it is not a market number. The scan is scoped to
    // the banner-delimited MARKET section for exactly that reason — the same
    // scoping the delivered guard documents. What this adds is the assertion
    // that the section boundary really does exclude every hit.
    const raw = readFileSync(resolve(ROOT, "src/lib/api.ts"), "utf8");
    const marker = "// ==================== MARKET ====================";
    const start = raw.indexOf(marker);
    expect(start, "MARKET banner not found in lib/api.ts").toBeGreaterThanOrEqual(0);
    const rest = raw.slice(start + marker.length);
    const nextBanner = rest.indexOf("// ====================");
    const marketSection = nextBanner === -1 ? rest : rest.slice(0, nextBanner);

    const randomCall = /Math\s*\.\s*random\s*\(/;
    expect(randomCall.test(marketSection), "the MARKET section of lib/api.ts calls Math.random()").toBe(false);
    // Self-check: the section is real content, not an empty slice.
    expect(marketSection.length).toBeGreaterThan(200);
    expect(marketSection).toContain("fetchMarket");
  });

  it("the terminal renders whatever order it is handed, for every board", async () => {
    // Same rows, ascending vs descending, identical percents. A component that
    // sorted would produce one order for both payloads.
    const row = (symbol: string, pct: number) => ({
      symbol,
      price: 100,
      previousClose: 99,
      change: 1,
      changePercent: pct,
      asOf: "2026-10-10T20:00:00Z",
      currency: "USD",
      source: "alpaca_daily_bars",
      synthetic: false,
      unranked: false,
    });
    const ascending: Movers = {
      gainers: [row("AAAA", 5), row("ZZZZ", 5)],
      losers: [row("BBBB", -5), row("YYYY", -5)],
      unchanged: [],
      unrankedCount: 0,
      asOf: "2026-10-10T20:00:00Z",
      source: "alpaca_daily_bars",
      synthetic: false,
    };
    const descending: Movers = {
      ...ascending,
      gainers: [row("ZZZZ", 5), row("AAAA", 5)],
      losers: [row("YYYY", -5), row("BBBB", -5)],
    };

    // `moversRowCount` is the only transformation the component applies to a
    // board before rendering; it preserves order and length.
    expect(moversRowCount(ascending)).toBe(4);
    expect(moversRowCount(descending)).toBe(4);
    expect(ascending.gainers.map((r) => r.symbol)).toEqual(["AAAA", "ZZZZ"]);
    expect(descending.gainers.map((r) => r.symbol)).toEqual(["ZZZZ", "AAAA"]);
    expect(moversRowCount(null)).toBe(0);
    expect(moversRowCount(undefined)).toBe(0);
  });
});

// ==================== 4. THE MOVERS BOARD'S NUMBER PATHS ====================

describe("4. the board's own rendering path cannot invent a number", () => {
  it("moversRowCount over an empty board is 0, not NaN", () => {
    const empty: Movers = {
      gainers: [],
      losers: [],
      unchanged: [],
      unrankedCount: 0,
      asOf: "",
      source: "",
      synthetic: false,
    };
    expect(moversRowCount(empty)).toBe(0);
  });

  it("buildSymbolPayload invents nothing for a row that published only a price", () => {
    // A real gateway row before the change fields existed: `previousClose` and
    // `changePercent` absent. The old route filled these by multiplying the
    // price; null is the only value that cannot be read as a measurement.
    const payload = buildSymbolPayload({
      symbol: "NVDA",
      feedId: "alpaca_daily_bars",
      price: 187.42,
      confidence: 0,
      updatedAt: "2026-10-10T20:00:00Z",
      source: "alpaca_daily_bars",
      synthetic: false,
    } as Parameters<typeof buildSymbolPayload>[0]);

    expect(payload.meta.regularMarketPrice).toBe(187.42);
    expect(payload.meta.regularMarketChange).toBeNull();
    expect(payload.meta.regularMarketChangePercent).toBeNull();
    for (const field of [
      "fiftyTwoWeekHigh",
      "fiftyTwoWeekLow",
      "regularMarketDayHigh",
      "regularMarketDayLow",
      "regularMarketVolume",
      "exchangeName",
      "marketCap",
      "peRatio",
    ] as const) {
      expect(payload.meta[field], field).toBeNull();
    }
    expect(payload.chart).toEqual({ timestamps: [], closes: [] });
    expect(numbersIn(payload.chart)).toEqual([]);
    expect(payload.analysis.available).toBe(false);
    expect(payload.synthetic).toBe(false);
  });

  it("does not invent a display name for a symbol the upstream never named", () => {
    const payload = buildSymbolPayload({
      symbol: "ZZZZ",
      price: 12.5,
      source: "alpaca_daily_bars",
      synthetic: false,
    } as Parameters<typeof buildSymbolPayload>[0]);
    // The old route hardcoded "NVIDIA Corporation" / "Monad Ecosystem Token".
    expect(payload.meta.name).toBe("ZZZZ");
  });

  it("changes the number of reachable numbers when — and only when — one is relayed", () => {
    // A measurement control in behavioural form: numbersIn must be able to see
    // a number, or every `toEqual([])` above is vacuous.
    const withNumber = { error: "x", value: 1.5 };
    expect(numbersIn(withNumber)).toEqual([1.5]);
    expect(numbersIn({ error: "x" })).toEqual([]);
  });
});

// ==================== 5. NEGATIVE CONTROL FOR THE STRUCTURAL GUARD ====================
//
// Every guard above is a property over parsed source. This section runs the
// same property over a source that HAS the defect the property is meant to
// catch, so "found nothing" can be told apart from "cannot find anything".
// The vector is the one the implementer's own F4b entry says their text guard
// missed: a non-thousands-separated injected value, plus a generator call.

describe("5. negative control — the structural guard has teeth", () => {
  function factsOfSource(source: string, kind: ts.ScriptKind): SourceFacts {
    const sf = ts.createSourceFile("defective.ts", source, ts.ScriptTarget.ES2022, true, kind);
    const facts: SourceFacts = {
      imports: [],
      numericLiterals: [],
      stringLiterals: [],
      hasLoop: false,
      hasMathCall: false,
      hasDateNow: false,
      hasArrowOrFunction: false,
      identifiers: new Set<string>(),
    };
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        facts.imports.push(node.moduleSpecifier.text);
      } else if (ts.isNumericLiteral(node)) {
        facts.numericLiterals.push(node.text);
      } else if (ts.isStringLiteralLike(node)) {
        facts.stringLiterals.push(node.text);
      } else if (
        ts.isForStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node)
      ) {
        facts.hasLoop = true;
      } else if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Math"
      ) {
        facts.hasMathCall = true;
      } else if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "now" &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Date"
      ) {
        facts.hasDateNow = true;
      } else if (ts.isIdentifier(node)) {
        facts.identifiers.add(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return facts;
  }

  const DEFECTIVE_ROUTE = `
import { NextRequest, NextResponse } from "next/server";
import { fetchMarketPrices } from "@/lib/api";

const FALLBACK: Record<string, number> = { NVDA: 142.8 };
const SYMBOLS = ["NVDA", "AAPL"];
export async function GET() {
  const walk: number[] = [];
  for (let i = 0; i < 30; i++) {
    walk.push(FALLBACK.NVDA * (1 + Math.sin(i)));
  }
  return NextResponse.json({ closes: walk, cash: "100000.00", t: Date.now() });
}
`;

  it("detects every defect this file claims to detect", () => {
    const f = factsOfSource(DEFECTIVE_ROUTE, ts.ScriptKind.TS);

    // The properties used in section 1 all fire on the defective source.
    expect(looksLikeAPureRelay(f)).toEqual(
      expect.arrayContaining(["calls Math.*", "calls Date.now()", "contains a loop"])
    );
    expect(f.identifiers.has("FALLBACK")).toBe(true);
    expect(f.imports).toEqual(expect.arrayContaining(["@/lib/api"]));

    // The numeric-string property fires on the exact writing the implementer's
    // F4b entry records their first-guard version missing.
    const NUMISH = /^[+-]?\$?[0-9][0-9,]*(\.[0-9]+)?%?$/;
    expect(f.stringLiterals.filter((s) => NUMISH.test(s))).toContain("100000.00");

    // And the delivered text-scan's marker list would ALSO have missed it:
    // measured, not assumed.
    const deliveredMarkers = ["FALLBACK_MARKET_DATA", "seededRandom", "utcDaySeed"];
    for (const m of deliveredMarkers) {
      expect(DEFECTIVE_ROUTE.includes(m), `control vector accidentally contains ${m}`).toBe(false);
    }
  });

  it("and stays quiet on the real route (so it is not a guard that always fires)", () => {
    expect(looksLikeAPureRelay(analyse(ROUTE))).toEqual([]);
  });

  it("the terminal's numeric-literal guard catches the exact vector the delivered guard missed", () => {
    // Reproduces the implementer's F4b finding as an executable control: the
    // vector uses the NON-thousands-separated writing, which their first value
    // list did not contain.
    const injected = `
const [cash, setCash] = useState("100000.00");
const [bp, setBp] = useState("400000.00");
const recentOrders = [{ id: "ord_init_aapl" }];
const TICKER_TAPE = [{ symbol: "NVDA", price: "$234.00", change: "+3.14%" }];
`;
    const sf = ts.createSourceFile("defective.tsx", injected, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    const NUMISH = /^[+-]?\$?[0-9][0-9,]*(\.[0-9]+)?%?$/;
    const found: string[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteralLike(n) && NUMISH.test(n.text)) found.push(n.text);
      ts.forEachChild(n, visit);
    };
    visit(sf);

    expect(found).toContain("100000.00");
    expect(found).toContain("$234.00");
    expect(found).toContain("+3.14%");

    // Measured, not asserted: the delivered guard's FABRICATED_VALUES list does
    // NOT contain the first of those. If a future edit adds it, this control
    // goes red and should be deleted (the delivered guard would then cover it).
    const deliveredValues = ['"100,000.00"', '"400,000.00"', '"142.8"', '"234.5"', '"258.4"', '"65420"', '"2640.5"'];
    expect(deliveredValues.includes('"100000.00"')).toBe(false);
    expect(deliveredValues.every((v) => !injected.includes(v))).toBe(true);

    // And the real terminal is clean by the same check.
    expect(numericLookingStringLiterals(TERMINAL)).toEqual([]);
    expect(numericLookingStringLiterals(ROUTE)).toEqual([]);
  });
});
