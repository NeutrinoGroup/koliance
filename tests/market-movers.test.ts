import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchMarketHealth,
  fetchMarketMovers,
  fetchMarketOverviewChecked,
  fetchMarketPrices,
} from "@/lib/api";

/**
 * The market adapters must report WHY a read produced nothing.
 *
 * They used to answer `T | null`, which made four different situations
 * indistinguishable: a deployment with no Alpaca credentials, an Alpaca
 * outage, a Go gateway that is not running, and a symbol the exchange does not
 * list. Three of those are transient or nobody's fault; one is a deployment
 * mistake that retrying will never fix. A page handed `null` cannot tell a user
 * which one happened, and a page that cannot say which one happened cannot be
 * operated — only stared at.
 *
 * The classification is the unit under test here. Note in particular that
 * `fetch(` does NOT reject on 503, so "check res.ok" is not the same check:
 * a 503 answered by the credential guard must not be reported as a success
 * whose body happens to be an error message.
 */

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("market adapters — failure classification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies the gateway's 503 as not-configured and keeps its words", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        jsonResponse(503, {
          code: "SERVICE_NOT_CONFIGURED",
          error: "service credentials are not configured on this deployment",
          requestId: "req-test-movers-503",
        })
      )
    );

    const res = await fetchMarketMovers();

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.reason).toBe("not-configured");
    expect(res.code).toBe("SERVICE_NOT_CONFIGURED");
    expect(res.requestId).toBe("req-test-movers-503");
    expect(res.detail).toContain("service credentials are not configured");
  });

  it("classifies a 404 as invalid-symbol, not as a generic failure", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(404, { error: "no market data: ZZZZ" })));

    const res = await fetchMarketPrices("ZZZZ");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.reason).toBe("invalid-symbol");
  });

  it("classifies a 502 as upstream-error", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(502, { error: "alpaca bars status 503" })));

    const res = await fetchMarketOverviewChecked();

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.reason).toBe("upstream-error");
  });

  it("classifies a connection refusal as unreachable", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));

    const res = await fetchMarketHealth();

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.reason).toBe("unreachable");
    expect(res.detail).toContain("Failed to fetch");
  });

  it("classifies a 200 with an unreadable body as unreachable, not as empty data", async () => {
    // A proxy returning an HTML error page with status 200 is the realistic
    // case. Treating it as "the market has no instruments" is exactly the
    // silent degradation this classification exists to prevent.
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token <")),
      } as unknown as Response)
    );

    const res = await fetchMarketMovers();

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.reason).toBe("unreachable");
    expect(res.detail).toContain("unreadable");
  });

  it("falls back to the status line when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("not json")),
      } as unknown as Response)
    );

    const res = await fetchMarketOverviewChecked();

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.detail).toBe("HTTP 500");
  });
});

describe("market adapters — success shapes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the price array from the list endpoint", async () => {
    const rows = [
      { symbol: "NVDA", price: 187.42, source: "alpaca_daily_bars", synthetic: false },
      { symbol: "AAPL", price: 233.1, source: "alpaca_daily_bars", synthetic: false },
    ];
    vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(200, rows)));

    const res = await fetchMarketPrices();

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected success");
    expect(res.data.map((r) => r.symbol)).toEqual(["NVDA", "AAPL"]);
  });

  it("normalises the single-symbol object into a one-element array", async () => {
    // The gateway answers an object for `?symbol=` and an array otherwise. The
    // adapter smooths that over so callers never branch on the response shape.
    vi.stubGlobal("fetch", () =>
      Promise.resolve(jsonResponse(200, { symbol: "NVDA", price: 187.42, source: "alpaca_daily_bars" }))
    );

    const res = await fetchMarketPrices("NVDA");

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected success");
    expect(res.data).toHaveLength(1);
    expect(res.data[0].symbol).toBe("NVDA");
  });

  it("returns the backend's movers buckets in the backend's order", async () => {
    const body = {
      gainers: [
        { symbol: "ZZZZ", changePercent: 9, unranked: false },
        { symbol: "AAAA", changePercent: 9, unranked: false },
      ],
      losers: [{ symbol: "TSLA", changePercent: -4.2, unranked: false }],
      unchanged: [],
      unrankedCount: 1,
      asOf: "2026-10-10T20:00:00Z",
      source: "alpaca_daily_bars",
      synthetic: false,
    };
    vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(200, body)));

    const res = await fetchMarketMovers();

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected success");
    // Not re-sorted. The backend breaks ties by symbol; a second sort here
    // would be a second source of truth for one ranking.
    expect(res.data.gainers.map((g) => g.symbol)).toEqual(["ZZZZ", "AAAA"]);
    expect(res.data.unrankedCount).toBe(1);
  });

  it("reports market health as a success even without credentials", async () => {
    const body = {
      configured: false,
      alpaca: { observed: false, ok: false },
      priceOracle: { ok: false, error: "ALPACA_API_KEY/ALPACA_API_SECRET not set", symbols: ["NVDA"], instruments: 0 },
      source: "alpaca_daily_bars",
      synthetic: false,
    };
    vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(200, body)));

    const res = await fetchMarketHealth();

    // A 200 carrying `configured: false` is a successful answer to "is this
    // deployment wired up", and it is the only call that can distinguish that
    // from "the market source is down".
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected success");
    expect(res.data.configured).toBe(false);
  });

  it("requests the paths the Go router actually registers", async () => {
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(jsonResponse(200, [])));
    vi.stubGlobal("fetch", fetchSpy);

    await fetchMarketPrices();
    await fetchMarketMovers();
    await fetchMarketHealth();

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("/api/v1/market/prices");
    expect(urls[1]).toContain("/api/v1/market/movers");
    expect(urls[2]).toContain("/api/v1/market/health");
  });

  it("never serves a cached market read", async () => {
    // Quotes are time-sensitive; a cached price is a stale quote with no
    // indication that it is stale.
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(jsonResponse(200, [])));
    vi.stubGlobal("fetch", fetchSpy);

    await fetchMarketPrices();

    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });
});
