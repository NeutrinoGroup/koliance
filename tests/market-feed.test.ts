import { describe, it, expect, afterEach, vi } from "vitest";
import {
  FAILURE_COPY,
  buildSymbolPayload,
  emptyMovers,
  failureCopy,
  formatBalanceString,
  formatPercent,
  formatSignedUsd,
  formatUsd,
  moversRowCount,
  nullableNumber,
  signClass,
  type MarketFetchReason,
} from "@/lib/marketFeed";
import {
  GO_BACKEND_URL,
  isGoBackendConfigured,
  isLocalEnvironment,
  fetchMarketPrices,
  type MarketPriceRow,
} from "@/lib/api";

/**
 * The helpers in `marketFeed.ts` exist so that "the upstream did not publish
 * this" has exactly one rendering, and so that rendering is not a number.
 *
 * They are tested rather than inlined into JSX because the interesting inputs
 * are all the absent ones. Every function below is reachable with `null` on the
 * live page — that is the normal case for market cap, P/E, volume and the two
 * 52-week bounds, since Alpaca's bars carry none of them.
 */

function row(overrides: Partial<MarketPriceRow> = {}): MarketPriceRow {
  return {
    symbol: "NVDA",
    feedId: "alpaca_daily_bars",
    price: 187.42,
    confidence: 0,
    updatedAt: "2026-10-10T20:00:00Z",
    previousClose: 185.1,
    change: 2.32,
    changePercent: 1.25,
    source: "alpaca_daily_bars",
    synthetic: false,
    ...overrides,
  };
}

describe("formatUsd", () => {
  it("formats a real amount with thousands separators", () => {
    expect(formatUsd(100000)).toBe("100,000.00");
    expect(formatUsd(187.4)).toBe("187.40");
  });

  it("renders null as an absence marker, never as zero", () => {
    // The single most important assertion in this file. `0.00` is a funded,
    // empty account; `---` is an account we could not read. The page shows one
    // of them to an operator deciding whether the deployment works.
    expect(formatUsd(null)).toBe("---");
    expect(formatUsd(undefined)).toBe("---");
    expect(formatUsd(NaN)).toBe("---");
    expect(formatUsd(null)).not.toBe("0.00");
  });
});

describe("formatBalanceString", () => {
  it("formats Alpaca's decimal strings", () => {
    expect(formatBalanceString("100000.00")).toBe("100,000.00");
    expect(formatBalanceString("0")).toBe("0.00");
  });

  it("treats a missing or empty balance as unknown", () => {
    expect(formatBalanceString(null)).toBe("---");
    expect(formatBalanceString(undefined)).toBe("---");
    expect(formatBalanceString("")).toBe("---");
    expect(formatBalanceString("   ")).toBe("---");
    // Not a number: an unparseable balance is unknown, not zero.
    expect(formatBalanceString("n/a")).toBe("---");
  });
});

describe("formatPercent", () => {
  it("always shows the sign of a real move", () => {
    expect(formatPercent(1.25)).toBe("+1.25%");
    expect(formatPercent(-0.8)).toBe("-0.80%");
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("distinguishes a flat zero from an unknown change", () => {
    // 0.00% = measured, did not move. --- = not measured. Collapsing these is
    // how the backend's own `unranked` bucket would start lying.
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(null)).toBe("---");
    expect(formatPercent(undefined)).toBe("---");
  });
});

describe("formatSignedUsd", () => {
  it("signs a real P/L", () => {
    expect(formatSignedUsd(2.32)).toBe("+$2.32");
    expect(formatSignedUsd(-15.5)).toBe("-$15.50");
  });

  it("does not invent a zero P/L", () => {
    expect(formatSignedUsd(null)).toBe("---");
  });
});

describe("nullableNumber", () => {
  it("passes finite numbers through, including zero", () => {
    expect(nullableNumber(0)).toBe(0);
    expect(nullableNumber(-1.5)).toBe(-1.5);
  });

  it("maps absent and non-finite values to null", () => {
    expect(nullableNumber(null)).toBeNull();
    expect(nullableNumber(undefined)).toBeNull();
    expect(nullableNumber(NaN)).toBeNull();
    expect(nullableNumber(Infinity)).toBeNull();
  });
});

describe("signClass", () => {
  it("colours a measured direction", () => {
    expect(signClass(1)).toBe("text-emerald-400");
    expect(signClass(-1)).toBe("text-red-400");
    expect(signClass(0)).toBe("text-emerald-400");
  });

  it("uses a neutral tone when the direction is unknown", () => {
    // Not red and not green: the page must not imply a direction it did not
    // measure.
    expect(signClass(null)).toBe("text-slate-400");
    expect(signClass(undefined)).toBe("text-slate-400");
  });
});

describe("buildSymbolPayload", () => {
  it("relays the upstream price and provenance", () => {
    const payload = buildSymbolPayload(row());

    expect(payload.meta.symbol).toBe("NVDA");
    expect(payload.meta.regularMarketPrice).toBe(187.42);
    expect(payload.source).toBe("alpaca_daily_bars");
    expect(payload.synthetic).toBe(false);
    expect(payload.dataCaveat).toBeNull();
  });

  it("never publishes a chart, because the upstream has no series", () => {
    const payload = buildSymbolPayload(row());

    expect(payload.chart.closes).toEqual([]);
    expect(payload.chart.timestamps).toEqual([]);
    expect(payload.analysis.available).toBe(false);
  });

  it("keeps unpublished metrics null instead of estimating them", () => {
    const payload = buildSymbolPayload(row());

    for (const field of [
      "fiftyTwoWeekHigh",
      "fiftyTwoWeekLow",
      "regularMarketDayHigh",
      "regularMarketDayLow",
      "regularMarketVolume",
      "marketCap",
      "peRatio",
      "exchangeName",
    ] as const) {
      expect(payload.meta[field]).toBeNull();
    }
  });

  it("does not name the instrument after a company it was not told about", () => {
    // The old route hardcoded "NVIDIA Corporation" / "Apple Inc." and, for
    // MON-USD, "Monad Ecosystem Token (Parallel EVM)". None of those came from
    // a data source.
    expect(buildSymbolPayload(row()).meta.name).toBe("NVDA");
    expect(buildSymbolPayload(row({ symbol: "MON-USD" })).meta.name).toBe("MON-USD");
  });

  it("rounds to cents", () => {
    expect(buildSymbolPayload(row({ price: 187.4259 })).meta.regularMarketPrice).toBe(187.43);
  });

  it("flags a synthetic upstream row and says so", () => {
    const payload = buildSymbolPayload(row({ synthetic: true, source: "synthetic_something" }));

    expect(payload.synthetic).toBe(true);
    expect(payload.source).toBe("synthetic_something");
    expect(payload.dataCaveat).toMatch(/not a market quote/i);
  });

  it("names an unknown source rather than leaving it blank", () => {
    expect(buildSymbolPayload(row({ source: "" })).source).toBe("unknown");
  });
});

describe("failure copy", () => {
  it("has a distinct entry for every reason the client can produce", () => {
    const reasons: MarketFetchReason[] = [
      "not-configured",
      "gateway-unconfigured",
      "upstream-error",
      "unreachable",
      "invalid-symbol",
    ];

    for (const reason of reasons) {
      expect(FAILURE_COPY[reason]).toBeDefined();
      expect(FAILURE_COPY[reason].headline.length).toBeGreaterThan(0);
      expect(FAILURE_COPY[reason].action.length).toBeGreaterThan(10);
    }
  });

  it("gives five different explanations, not one shared message", () => {
    // Five distinct failure states with different root causes and remediation paths.
    const headlines = new Set(Object.values(FAILURE_COPY).map((c) => c.headline));
    expect(headlines.size).toBe(5);
  });

  it("dynamically includes GO_BACKEND_URL in unreachable action copy", () => {
    expect(FAILURE_COPY.unreachable.action).toContain(GO_BACKEND_URL);
  });

  it("names the missing environment variables for both unconfigured cases", () => {
    expect(FAILURE_COPY["not-configured"].action).toContain("ALPACA_API_KEY");
    expect(FAILURE_COPY["gateway-unconfigured"].action).toContain("NEXT_PUBLIC_GO_BACKEND_URL");
  });

  it("falls back to a defined message for an unrecognised reason", () => {
    // Guards the `json.reason` cast in the terminal: a future backend reason,
    // or a proxy returning HTML, must not render `undefined`.
    const copy = failureCopy("some-new-reason" as MarketFetchReason);
    expect(copy).toBeDefined();
    expect(copy.headline.length).toBeGreaterThan(0);
  });
});

describe("gateway configuration and catch classification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("correctly identifies local test environment", () => {
    expect(isLocalEnvironment()).toBe(true);
  });

  it("identifies non-local environments in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalEnvironment()).toBe(false);
  });

  it("detects local browser hostname via window", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(isLocalEnvironment()).toBe(true);

    vi.stubGlobal("window", { location: { hostname: "koliance.app" } });
    expect(isLocalEnvironment()).toBe(false);
  });

  it("considers local default backend configured unless explicitly cleared", () => {
    expect(isGoBackendConfigured()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_GO_BACKEND_URL", "");
    expect(isGoBackendConfigured()).toBe(false);
  });

  it("flags unconfigured or localhost backend in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GO_BACKEND_URL", "");
    expect(isGoBackendConfigured()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_GO_BACKEND_URL", "http://localhost:8080");
    expect(isGoBackendConfigured()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_GO_BACKEND_URL", "https://api.koliance.xyz");
    expect(isGoBackendConfigured()).toBe(true);
  });

  it("marketGet catch distinguishes unreachable vs gateway-unconfigured", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("ECONNREFUSED")));

    // 1. In local environment, connection failure -> unreachable
    const localRes = await fetchMarketPrices("NVDA");
    expect(localRes.ok).toBe(false);
    if (!localRes.ok) {
      expect(localRes.reason).toBe("unreachable");
    }

    // 2. In production without remote URL, connection failure -> gateway-unconfigured
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GO_BACKEND_URL", "");
    const prodRes = await fetchMarketPrices("NVDA");
    expect(prodRes.ok).toBe(false);
    if (!prodRes.ok) {
      expect(prodRes.reason).toBe("gateway-unconfigured");
    }
  });
});


describe("movers", () => {
  const change = (symbol: string) => ({
    symbol,
    price: 100,
    previousClose: 99,
    change: 1,
    changePercent: 1.01,
    asOf: "2026-10-10T20:00:00Z",
    currency: "USD",
    source: "alpaca_daily_bars",
    synthetic: false,
    unranked: false,
  });

  it("counts rows across all three buckets", () => {
    const m = emptyMovers();
    expect(moversRowCount(m)).toBe(0);

    m.gainers = [change("A")];
    m.losers = [change("B")];
    m.unchanged = [change("C")];
    expect(moversRowCount(m)).toBe(3);
  });

  it("does not count unranked rows as ranked", () => {
    // `unrankedCount` is deliberately outside the three buckets. Folding it in
    // is how "we cannot tell whether it moved" becomes "it did not move".
    const m = { ...emptyMovers(), unrankedCount: 2 };
    expect(moversRowCount(m)).toBe(0);
  });

  it("counts nothing for a missing board rather than throwing", () => {
    expect(moversRowCount(null)).toBe(0);
    expect(moversRowCount(undefined)).toBe(0);
  });

  it("starts with empty, non-null buckets so the UI never maps over null", () => {
    const m = emptyMovers();
    expect(m.gainers).toEqual([]);
    expect(m.losers).toEqual([]);
    expect(m.unchanged).toEqual([]);
    // An empty board and an unavailable ranking are different: the terminal
    // renders a failure notice for the latter.
    expect(m.unrankedCount).toBe(0);
  });
});
