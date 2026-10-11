/**
 * Market feed types, response shaping and display helpers.
 *
 * This file exists because of a specific failure it is meant to make
 * impossible. `src/app/api/market/route.ts` used to carry its own price
 * generator: a hardcoded `FALLBACK_MARKET_DATA` table, a seeded random walk,
 * and two `synthetic_*` branches that answered a failed upstream with a
 * plausible-looking series. The page rendered those numbers under the words
 * "Real-time Technical Analysis" (GAP-14, GAP-52).
 *
 * The replacement has one rule: **this layer never invents an observation.** It
 * either relays a price the backend actually read from Alpaca, or it says it
 * has nothing. Every field below is either sourced or explicitly nullable —
 * there is no default value a later reader could mistake for a quote.
 *
 * The types live here rather than inside the route so that the route, the
 * component and the tests share one declaration. When they are duplicated, a
 * change to one silently stops constraining the others (D4).
 */

import type { MarketFetchReason, MarketPriceRow } from "@/lib/api";

// Re-exported so callers that only need the presentation vocabulary (the
// terminal, the display tests) do not have to reach into the transport module
// for one type name.
export type { MarketFetchReason };

/**
 * What the route can say about derived indicators.
 *
 * There is no `rsi` number here at all, and that is the point. The old payload
 * carried `rsi: 55`, `healthScore: 92`, `agentCardViability: "A+ (Tier 1
 * Instant Monad Settlement)"` and an `aiVerdict` paragraph — values produced by
 * no measurement, formatted to look like the output of one.
 *
 * Two things are needed to compute an RSI: a series and enough of it. The
 * upstream publishes neither, so the only truthful analytic payload is an
 * absence plus its reason. When a series endpoint exists, this type grows an
 * `rsi: number | null` back and the calculation behind it can be reinstated
 * with tests.
 */
export interface MarketAnalysis {
  available: false;
  reason: string;
}

export function unavailableAnalysis(reason: string): MarketAnalysis {
  return { available: false, reason };
}

/**
 * The payload `/api/market` answers with.
 *
 * `meta`'s nullable fields are deliberate and load-bearing. Alpaca's bar
 * object carries open/high/low/close/volume for the bars we request and nothing
 * else: it has no 52-week range, no market cap and no P/E. The old route filled
 * those slots by multiplying the current price by fixed factors
 * (`fiftyTwoWeekHigh: currentPrice * 1.15`, `regularMarketVolume: 15000000`,
 * `marketCap: "3.51T"`).
 *
 * They are kept as `null` rather than deleted so the compiler forces every
 * render site to handle their absence. A deleted field still gets rendered — as
 * `$NaN` — by a call site nobody revisited.
 */
export interface MarketMeta {
  symbol: string;
  name: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  regularMarketDayHigh: number | null;
  regularMarketDayLow: number | null;
  regularMarketVolume: number | null;
  exchangeName: string | null;
  marketCap: string | null;
  peRatio: number | null;
}

export interface MarketChart {
  /** Unix seconds. Empty when the upstream provides no series — see below. */
  timestamps: number[];
  closes: number[];
}

export interface SymbolPayload {
  /** Relayed from the backend row, never synthesised here. */
  source: string;
  synthetic: boolean;
  /** Present when `synthetic` is true, so a caller cannot miss it. */
  dataCaveat: string | null;
  meta: MarketMeta;
  chart: MarketChart;
  analysis: MarketAnalysis;
}

/**
 * Shown under the chart when, and only when, there is no series to draw.
 *
 * This sentence is a deliverable of the change, not an apology for one. A page
 * that silently omits a chart invites the reader to assume one is loading; a
 * page that says which endpoint would have to exist to produce one cannot be
 * misread that way.
 */
export const NO_SERIES_NOTE =
  "[INFO] The upstream for this symbol publishes only the latest close and the previous close " +
  "(two observations). No series is available to plot, so none is drawn — this view does not " +
  "generate an illustrative curve.";

/**
 * Builds the `/api/market` response from a real backend price row
 * (`GET /api/v1/market/prices?symbol=…`, one `PythPriceData` object).
 *
 * `chart` is empty on purpose, and empty here is the correct representation of
 * what the upstream published rather than a placeholder for "not implemented
 * yet". That endpoint returns two observations per symbol because that is what
 * a daily change needs; it publishes no series, and deriving the two points'
 * timestamps would itself be an invention. Filling the gap with a generated
 * curve is precisely the defect this change removes, so the chart carries
 * nothing and the UI says why. If a series endpoint is added later it comes
 * through here verbatim — no smoothing, no back-fill.
 */
export function buildSymbolPayload(row: MarketPriceRow): SymbolPayload {
  return {
    source: row.source || "unknown",
    synthetic: row.synthetic === true,
    dataCaveat:
      row.synthetic === true
        ? "Upstream flagged this row as synthetic. It is not a market quote."
        : null,
    meta: {
      symbol: row.symbol,
      // The backend publishes no display name, so the symbol is the label. The
      // old route hardcoded "NVIDIA Corporation" for NVDA and "Monad Ecosystem
      // Token (Parallel EVM)" for MON-USD; neither came from a data source.
      name: row.symbol,
      currency: "USD",
      regularMarketPrice: round2(row.price),
      regularMarketChange: nullableNumber(row.change),
      regularMarketChangePercent: nullableNumber(row.changePercent),
      // See MarketMeta: not published by Alpaca bars, so absent rather than estimated.
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      regularMarketDayHigh: null,
      regularMarketDayLow: null,
      regularMarketVolume: null,
      exchangeName: null,
      marketCap: null,
      peRatio: null,
    },
    chart: { timestamps: [], closes: [] },
    analysis: unavailableAnalysis(NO_SERIES_NOTE),
  };
}

/** Rounds to cents, the way a quote is published. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns a finite number or null. A missing field is `null`, never `0`:
 * a zero change and an unknown change are different facts, and the page prints
 * them differently.
 */
export function nullableNumber(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ==================== DISPLAY HELPERS ====================
//
// These are pure and unit-tested rather than inlined in JSX, because the
// interesting cases are all the missing ones: every one of them receives null
// whenever the upstream does not publish the field, and the whole change turns
// on those cases rendering as "not available" instead of as a number.

/**
 * Formats a USD amount, or an explicit absence marker.
 *
 * `null` never becomes `"0.00"`. A zero balance and an unreported balance look
 * very different to someone deciding whether the account is funded.
 */
export function formatUsd(value: number | null | undefined, decimals: number = 2): string {
  const n = nullableNumber(value);
  if (n === null) return "---";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Formats a raw decimal balance string from Alpaca (e.g. `"100000.00"`).
 *
 * Takes `null`/`undefined` so callers can pass a not-yet-loaded account without
 * a truthiness dance. An unparseable string is also absent, not zero.
 */
export function formatBalanceString(raw: string | null | undefined, decimals: number = 2): string {
  if (raw === null || raw === undefined || String(raw).trim() === "") return "---";
  return formatUsd(Number(raw), decimals);
}

/** Formats a signed percent, or an absence marker. */
export function formatPercent(value: number | null | undefined, decimals: number = 2): string {
  const n = nullableNumber(value);
  if (n === null) return "---";
  return `${n > 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

/**
 * Formats a signed amount with its currency, or an absence marker.
 *
 * The sign goes outside the currency symbol (`-$15.50`, not `$-15.50`): the
 * second form reads as a malformed positive number at a glance, and this is the
 * P/L column a viewer scans for losses.
 */
export function formatSignedUsd(value: number | null | undefined, decimals: number = 2): string {
  const n = nullableNumber(value);
  if (n === null) return "---";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${formatUsd(Math.abs(n), decimals)}`;
}

/** `true` / `false` / `null` — `null` means the direction is unknown. */
export function isPositive(value: number | null | undefined): boolean | null {
  const n = nullableNumber(value);
  if (n === null) return null;
  return n >= 0;
}

/** Tailwind colour class for a value whose sign may be unknown. */
export function signClass(value: number | null | undefined): string {
  const positive = isPositive(value);
  if (positive === null) return "text-slate-400";
  return positive ? "text-emerald-400" : "text-red-400";
}

// ==================== FETCH-FAILURE VOCABULARY ====================

export interface FailureCopy {
  headline: string;
  /** What the operator would have to change, in one sentence. */
  action: string;
}

/**
 * Maps a transport-level failure reason to what the page displays.
 *
 * The old adapters collapsed all of these into `null` and the page rendered one
 * generic "暂无数据". That makes four different situations indistinguishable:
 * a deployment with no credentials, an upstream outage, a backend that is not
 * running, and a symbol the exchange does not list. Only one of them is fixed
 * by retrying, and only one of them is the operator's mistake — so the page
 * has to say which one it is.
 */
export const FAILURE_COPY: Record<MarketFetchReason, FailureCopy> = {
  "not-configured": {
    headline: "行情数据源未配置",
    action: "后端未配置 ALPACA_API_KEY / ALPACA_API_SECRET，故不提供任何行情；本页也不会用合成数据填补。",
  },
  "upstream-error": {
    headline: "上游行情源返回错误",
    action: "后端已配置凭据，但读取 Alpaca 失败；下方数字为空白，重试可能恢复。",
  },
  unreachable: {
    headline: "后端不可达",
    action: "未能连接到 Go 网关（默认 http://localhost:8080）；请确认后端进程已启动。",
  },
  "invalid-symbol": {
    headline: "上游无此标的的行情",
    action: "该代码可能不在交易所的标的列表内，或当前没有可用日线。",
  },
};

export function failureCopy(reason: MarketFetchReason): FailureCopy {
  return FAILURE_COPY[reason] || FAILURE_COPY.unreachable;
}

// ==================== MOVERS (issue #16) ====================
//
// These mirror `backend/internal/market/ranking.go`. The frontend deliberately
// does NOT re-sort: `RankMovers` is a tested pure function on the backend, and
// a second implementation here would be two sources of truth for one order
// (D4). The frontend renders `gainers`/`losers` in the order it receives them.

/** One instrument's move over the most recent session. */
export interface InstrumentChange {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  asOf: string;
  currency: string;
  source: string;
  synthetic: boolean;
  /** True when the change is unknown (no previous close). Counted, not ranked. */
  unranked: boolean;
}

export interface Movers {
  gainers: InstrumentChange[];
  losers: InstrumentChange[];
  unchanged: InstrumentChange[];
  /** Rankable instruments are what a caller acts on; this counts the rest. */
  unrankedCount: number;
  asOf: string;
  source: string;
  synthetic: boolean;
}

/** An empty board, used only before the first fetch resolves. */
export function emptyMovers(): Movers {
  return {
    gainers: [],
    losers: [],
    unchanged: [],
    unrankedCount: 0,
    asOf: "",
    source: "",
    synthetic: false,
  };
}

/** Total rows the board is showing, across all three buckets. */
export function moversRowCount(m: Movers | null | undefined): number {
  if (!m) return 0;
  return m.gainers.length + m.losers.length + m.unchanged.length;
}
