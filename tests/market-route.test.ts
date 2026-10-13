import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/market/route";

/**
 * /api/market must REFUSE when the gateway refuses, and must never answer with
 * a series of its own.
 *
 * This file previously asserted the opposite: that the route's locally
 * generated fallback series was deterministic, labelled `synthetic_fallback`,
 * and stable within a UTC day. Those were reasonable assertions about a data
 * generator. They are not assertions about a market page, and the thing they
 * protected — a reproducible random walk presented as a quote — was the defect
 * (GAP-14, GAP-52).
 *
 * The suite is therefore inverted rather than deleted. The properties worth
 * pinning now are absences:
 *
 *   1. with no reachable gateway, the response is a refusal with no price field
 *      anywhere in it;
 *   2. a gateway refusal is relayed with its own status and a machine-readable
 *      reason;
 *   3. a gateway price is relayed verbatim, with its provenance attached;
 *   4. the fields the upstream does not publish stay null rather than becoming
 *      estimated numbers;
 *   5. the gatekeeping that ran before any outbound call still runs.
 *
 * Every negative case here fails if someone reintroduces a fallback: a fallback
 * answers 200, and every one of these asserts a non-2xx or a null.
 */

function req(symbol: string, range: string = "1mo") {
  return new NextRequest(`http://localhost/api/market?symbol=${symbol}&range=${range}&interval=1d`);
}

/** A minimal stand-in for the backend's PythPriceData row. */
function backendRow(overrides: Record<string, unknown> = {}) {
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

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Collects every numeric value reachable in a JSON structure. */
function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

describe("market route — relays real data or refuses, never generates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("when the gateway cannot be reached", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", () => Promise.reject(new Error("ECONNREFUSED")));
    });

    it("refuses instead of returning a generated series", async () => {
      const res = await GET(req("NVDA"));
      const body = await res.json();

      expect(res.status).toBe(502);
      expect(body.error).toContain("unreachable");
      // The load-bearing assertion. The old route answered 200 here, with 30
      // generated closes and source "synthetic_fallback".
      expect(res.status).not.toBe(200);
    });

    it("carries no price series and no chart object at all", async () => {
      const body = await (await GET(req("NVDA"))).json();

      expect(body.chart).toBeUndefined();
      expect(body.meta).toBeUndefined();
      // Nothing in the refusal is a number that could be read as a quote.
      expect(numbersIn(body)).toEqual([]);
    });

    it("says in words that no synthetic series was substituted", async () => {
      const body = await (await GET(req("NVDA"))).json();
      expect(body.dataCaveat).toMatch(/no synthetic series/i);
      expect(body.synthetic).toBe(false);
      expect(body.reason).toBe("unreachable");
    });
  });

  describe("when the gateway has no credentials (503)", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", () =>
        Promise.resolve(
          jsonResponse(503, {
            error: "market data unavailable: ALPACA_API_KEY/ALPACA_API_SECRET are not configured",
          })
        )
      );
    });

    it("relays the refusal as 503 with reason not-configured", async () => {
      const res = await GET(req("NVDA"));
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.reason).toBe("not-configured");
      expect(body.error).toContain("ALPACA_API_KEY");
    });

    it("does not fall back to the FALLBACK_MARKET_DATA table", async () => {
      const body = await (await GET(req("NVDA"))).json();

      // 142.80 was NVDA's hardcoded price in the deleted table. If a fallback
      // is ever reinstated, this is the number that comes back.
      expect(numbersIn(body)).not.toContain(142.8);
      expect(body.meta).toBeUndefined();
      expect(body.chart).toBeUndefined();
    });

    it("does not special-case MON-USD into a curated series", async () => {
      // The old route had a dedicated branch that random-walked a series for
      // MON-USD and pinned its last point to the hardcoded 3.45.
      const res = await GET(req("MON-USD"));
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.source).toBeUndefined();
      expect(numbersIn(body)).not.toContain(3.45);
    });
  });

  describe("when the gateway errors", () => {
    it("relays 502 as upstream-error, not as an empty market", async () => {
      vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(502, { error: "alpaca bars status 500" })));

      const res = await GET(req("NVDA"));
      const body = await res.json();

      expect(res.status).toBe(502);
      expect(body.reason).toBe("upstream-error");
      expect(body.error).toContain("alpaca bars");
    });

    it("treats a 200 with an unparseable body as a failure", async () => {
      vi.stubGlobal("fetch", () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new Error("Unexpected token < in JSON")),
        } as unknown as Response)
      );

      const res = await GET(req("NVDA"));
      expect(res.status).toBe(502);
      expect((await res.json()).reason).toBe("upstream-error");
    });

    it("treats a zero price as an absent observation, not a quote", async () => {
      // The upstream answering with price 0 means "no bar", and a zero quote
      // rendered on the page is indistinguishable from a market that collapsed.
      vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(200, backendRow({ price: 0 }))));

      const res = await GET(req("NVDA"));
      expect(res.status).toBe(404);
      expect((await res.json()).reason).toBe("invalid-symbol");
    });

    it("reports a symbol the exchange does not list as 404", async () => {
      vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(404, { error: "no market data: ZZZZ" })));

      const res = await GET(req("ZZZZ"));
      expect(res.status).toBe(404);
      expect((await res.json()).reason).toBe("invalid-symbol");
    });
  });

  describe("when the gateway has a real quote", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(200, backendRow())));
    });

    it("relays the price and change verbatim", async () => {
      const body = await (await GET(req("NVDA"))).json();

      expect(body.meta.regularMarketPrice).toBe(187.42);
      expect(body.meta.regularMarketChange).toBe(2.32);
      expect(body.meta.regularMarketChangePercent).toBe(1.25);
      expect(body.synthetic).toBe(false);
      expect(body.source).toBe("alpaca_daily_bars");
    });

    it("asks the gateway for the requested symbol", async () => {
      const seenUrls: string[] = [];
      vi.stubGlobal("fetch", (url: string) => {
        seenUrls.push(String(url));
        return Promise.resolve(jsonResponse(200, backendRow()));
      });

      await GET(req("tsla"));

      expect(seenUrls[0]).toContain("/api/v1/market/prices");
      // Uppercased by the gatekeeper before it reaches the upstream.
      expect(seenUrls[0]).toContain("symbol=TSLA");
    });

    it("leaves fields the upstream does not publish null rather than estimating", async () => {
      const body = await (await GET(req("NVDA"))).json();

      // The old route produced these by multiplying the price by fixed factors
      // (fiftyTwoWeekHigh = price * 1.15, volume = 15000000). Null is the only
      // value here that cannot be mistaken for a measurement.
      expect(body.meta.fiftyTwoWeekHigh).toBeNull();
      expect(body.meta.fiftyTwoWeekLow).toBeNull();
      expect(body.meta.regularMarketDayHigh).toBeNull();
      expect(body.meta.regularMarketDayLow).toBeNull();
      expect(body.meta.regularMarketVolume).toBeNull();
      expect(body.meta.marketCap).toBeNull();
      expect(body.meta.peRatio).toBeNull();
      expect(body.meta.exchangeName).toBeNull();
    });

    it("returns an empty chart rather than a generated curve", async () => {
      const body = await (await GET(req("NVDA"))).json();

      expect(body.chart.closes).toEqual([]);
      expect(body.chart.timestamps).toEqual([]);
      // The two points the backend published are not a series, and turning them
      // into one would need invented timestamps.
      expect(numbersIn(body.chart)).toEqual([]);
    });

    it("describes the missing series instead of implying one is loading", async () => {
      const body = await (await GET(req("NVDA"))).json();

      expect(body.analysis.available).toBe(false);
      expect(body.analysis.reason).toContain("two observations");
      // No RSI: the old route returned the constant 55 for a short series,
      // which reads as "neutral market" while meaning "not measured".
      expect(body.analysis.rsi).toBeUndefined();
    });

    it("relays a synthetic upstream flag instead of hiding it", async () => {
      vi.stubGlobal(
        "fetch",
        () =>
          Promise.resolve(
            jsonResponse(200, backendRow({ synthetic: true, source: "some_synthetic_source" }))
          ) as unknown as Promise<Response>
      );

      const body = await (await GET(req("NVDA"))).json();

      expect(body.synthetic).toBe(true);
      expect(body.source).toBe("some_synthetic_source");
      expect(body.dataCaveat).toMatch(/not a market quote/i);
    });
  });

  describe("gatekeeping still runs before anything leaves the process", () => {
    it("rejects a traversal attempt with 400 and performs no outbound call", async () => {
      const seenUrls: string[] = [];
      vi.stubGlobal("fetch", (url: string) => {
        seenUrls.push(String(url));
        return Promise.resolve(jsonResponse(200, backendRow()));
      });

      const res = await GET(new NextRequest("http://localhost/api/market?symbol=../etc/passwd"));

      expect(res.status).toBe(400);
      expect((await res.json()).reason).toBe("invalid-symbol");
      expect(seenUrls).toEqual([]);
    });

    it("rejects an over-long symbol", async () => {
      const res = await GET(req("THISISTOOLONG"));
      expect(res.status).toBe(400);
    });

    it("clamps an unknown range instead of forwarding it", async () => {
      vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(200, backendRow())));

      const body = await (await GET(req("NVDA", "bogus"))).json();
      expect(body.requestedRange).toBe("1mo");
    });
  });
});
