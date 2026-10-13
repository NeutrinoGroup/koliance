import { NextRequest, NextResponse } from "next/server";
import { buildSymbolPayload, type SymbolPayload } from "@/lib/marketFeed";
import { GO_BACKEND_URL, isGoBackendConfigured } from "@/lib/api";

/**
 * GET /api/market?symbol=…&range=…&interval=…
 *
 * This route used to be a market-data generator. It held a hardcoded
 * `FALLBACK_MARKET_DATA` table (NVDA 142.80, AAPL 234.50, …), a seeded random
 * walk, a `synthetic_curated` branch for MON-USD and a `synthetic_fallback`
 * branch that answered an unreachable upstream with a generated 30-point
 * series. A page rendered it under the words "Real-time Technical Analysis"
 * (GAP-14), and the backend change that removed the same pattern server-side
 * left it here (GAP-52).
 *
 * It is now a proxy with a gate. It asks the Go gateway for the symbol's price
 * and relays what comes back. **It has no code path that produces a number.**
 * That is the structural guarantee, not a promise: there is no fallback table
 * to fall back to, and no generator to call.
 *
 * When the gateway refuses — 503 for a deployment with no Alpaca credentials,
 * 404 for a symbol the exchange does not list, 5xx for an upstream failure —
 * this answers with the same refusal and a machine-readable reason. It does not
 * turn a refusal into a 200 with invented prices.
 *
 * What it deliberately keeps: the symbol and range gatekeeping, which ran
 * before any outbound request and is pinned by tests.
 */

// Gatekeeping: whitelist allowed ranges & intervals.
//
// Retained from the previous implementation. They now validate a request that
// ends in a proxied upstream call rather than one that selects a formula, but
// the reason is unchanged: an unvalidated symbol is interpolated into an
// outbound URL.
const ALLOWED_RANGES = new Set(["1d", "5d", "1mo", "6mo", "1y"]);
const ALLOWED_INTERVALS = new Set(["5m", "15m", "1d", "1wk"]);
const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,10}$/;

/** Same vocabulary the client adapter uses, so both halves read alike. */
type RouteReason = "not-configured" | "gateway-unconfigured" | "upstream-error" | "unreachable" | "invalid-symbol";

/**
 * Answers a refusal without a price in it.
 *
 * `symbol` is echoed for the client's convenience but no `meta`/`chart` object
 * is emitted: the previous route's failure branch returned a full payload with
 * `synthetic: true`, and a caller that only looked at `meta` had no way to tell
 * it apart from a quote.
 */
function refuse(status: number, reason: RouteReason, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: message, reason, synthetic: false, dataCaveat: message, ...extra },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol") || "NVDA";
  const rawRange = searchParams.get("range") || "1mo";
  const rawInterval = searchParams.get("interval") || "1d";

  // Gatekeeping Rule 1: symbol sanitization, before anything leaves the process.
  const symbol = rawSymbol.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    return refuse(
      400,
      "invalid-symbol",
      "Security Gatekeeper: Invalid symbol format. Allowed: alphanumeric, '.', '-', max 10 chars."
    );
  }

  // Gatekeeping Rule 2: range & interval clamp. Still accepted and validated so
  // the existing URL contract keeps working; the upstream call this route now
  // makes is a single latest-price read and takes neither parameter. They are
  // reported back rather than silently dropped, so a caller can see that the
  // chart-level request was accepted and is simply not servable from a
  // two-observation source.
  const range = ALLOWED_RANGES.has(rawRange) ? rawRange : "1mo";
  const interval = ALLOWED_INTERVALS.has(rawInterval) ? rawInterval : "1d";

  // Gatekeeping Rule 3: gateway configuration check before outbound fetch.
  if (!isGoBackendConfigured()) {
    return refuse(
      503,
      "gateway-unconfigured",
      `Market gateway is not configured for this environment: ${GO_BACKEND_URL}. No synthetic series is generated in its place.`,
      { symbol }
    );
  }

  // Rule 4: ask the gateway. It serves real Alpaca data or refuses; there is no
  // third answer, and none is manufactured here.
  let upstream: Response;
  try {
    upstream = await fetch(
      `${GO_BACKEND_URL}/api/v1/market/prices?symbol=${encodeURIComponent(symbol)}`,
      { cache: "no-store" }
    );
  } catch (err) {
    if (!isGoBackendConfigured()) {
      return refuse(
        503,
        "gateway-unconfigured",
        `Market gateway is not configured for this environment: ${GO_BACKEND_URL}. No synthetic series is generated in its place.`,
        { symbol }
      );
    }
    return refuse(
      502,
      "unreachable",
      `Market gateway unreachable at ${GO_BACKEND_URL}: ${err instanceof Error ? err.message : String(err)}. ` +
        "No synthetic series is generated in its place.",
      { symbol }
    );
  }

  if (!upstream.ok) {
    let detail = `HTTP ${upstream.status}`;
    try {
      const body = await upstream.json();
      if (body && typeof body.error === "string" && body.error) detail = body.error;
    } catch {
      // Non-JSON body: the status line is the detail.
    }

    // The gateway's own status decides the reason, and every branch is a
    // refusal. 503 is the no-credentials case the old code used to answer with
    // a generated series.
    const reason: RouteReason =
      upstream.status === 503 ? "not-configured" : upstream.status === 404 ? "invalid-symbol" : "upstream-error";
    const status = upstream.status === 404 ? 404 : 503;
    return refuse(status, reason, detail, { symbol });
  }

  let row: unknown;
  try {
    row = await upstream.json();
  } catch (err) {
    return refuse(
      502,
      "upstream-error",
      `Gateway returned an unreadable body: ${err instanceof Error ? err.message : String(err)}`,
      { symbol }
    );
  }

  // A row with no positive price is an absent observation, not a zero price.
  // The backend already filters these out of its list endpoint; this is the
  // guard for the single-symbol shape, and it refuses rather than passing a
  // zero-valued quote downstream.
  const price = (row as { price?: unknown } | null)?.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return refuse(404, "invalid-symbol", `No market data for ${symbol}: the upstream returned no usable price.`, {
      symbol,
    });
  }

  const payload: SymbolPayload = buildSymbolPayload(row as Parameters<typeof buildSymbolPayload>[0]);
  return NextResponse.json(
    { ...payload, requestedRange: range, requestedInterval: interval },
    { status: 200 }
  );
}
