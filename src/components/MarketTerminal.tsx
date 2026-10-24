"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Check,
  AlertCircle,
  Info,
  Send,
  BarChart3,
} from "lucide-react";
import {
  fetchMarketOverviewChecked,
  fetchMarketPrices,
  fetchMarketMovers,
  fetchMarketHealth,
  executeMarketTrade,
  closeMarketPosition,
  isGoBackendConfigured,
  MarketPosition,
  MarketPriceRow,
  MarketDataHealth,
  MarketOverviewData,
  MarketFetch,
} from "@/lib/api";
import {
  FAILURE_COPY,
  FailureCopy,
  InstrumentChange,
  Movers,
  NO_SERIES_NOTE,
  formatBalanceString,
  formatPercent,
  formatSignedUsd,
  formatUsd,
  moversRowCount,
  signClass,
  type SymbolPayload,
} from "@/lib/marketFeed";

/**
 * The server route's success body: a relayed Alpaca quote plus the two request
 * parameters it was asked for.
 */
type MarketResponse = SymbolPayload & { requestedRange?: string; requestedInterval?: string };

interface MarketTerminalProps {
  onTradeAction?: () => void;
}

interface ExecutedOrder {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  notionalUSD: number;
  leverage: number;
  status: string;
  time: string;
}

const PRESET_SYMBOLS = [
  { symbol: "NVDA" },
  { symbol: "AAPL" },
  { symbol: "TSLA" },
  { symbol: "SPY" },
];

/**
 * Renders one of the four distinct "no data" situations.
 *
 * The four are not interchangeable and the old page showed all of them as an
 * empty space: a deployment without credentials (nobody can fix it by
 * refreshing), an Alpaca outage (retrying helps), a backend that is not running
 * (start it), and a symbol the exchange does not list (ask for another one).
 * Printing which one it is costs one component and is the difference between a
 * page that can be operated and one that can only be stared at.
 */
function FailureNotice({
  failure,
  context,
  code,
  requestId,
}: {
  failure: FailureCopy;
  context?: string;
  code?: string;
  requestId?: string;
}) {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] font-mono text-amber-200/90 space-y-1">
      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-300">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{failure.headline}</span>
        {context && <span className="text-amber-200/50 normal-case tracking-normal">· {context}</span>}
        {code && <span className="text-amber-400/80 bg-amber-400/10 px-1 py-0.5 rounded text-[10px]">[{code}]</span>}
      </div>
      <p className="leading-relaxed">{failure.action}</p>
      {requestId && (
        <p className="text-[10px] text-amber-300/60 font-mono tracking-tight">Request ID: {requestId}</p>
      )}
    </div>
  );
}

/** A metric cell whose value may not be published by the upstream. */
function MetricCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const isAbsent = value === "---";
  return (
    <div>
      <span className="text-slate-400 text-[10px] block uppercase">{label}</span>
      <strong className={`text-sm font-black ${tone || (isAbsent ? "text-slate-500" : "text-white")}`}>{value}</strong>
    </div>
  );
}

export function MarketTerminal({ onTradeAction }: MarketTerminalProps) {
  const [selectedSymbol, setSelectedSymbol] = useState("NVDA");
  const [selectedRange, setSelectedRange] = useState("1mo");
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketResponse | null>(null);
  // Set whenever the quote request produced no quote. `marketData` is null in
  // that case, and this says which of the four reasons it was.
  const [quoteFailure, setQuoteFailure] = useState<FailureCopy | null>(null);
  const [quoteEnvelope, setQuoteEnvelope] = useState<{ code?: string; requestId?: string } | null>(null);

  // ==================== ALPACA PAPER TRADING STATE ====================
  //
  // Every one of these starts empty. They used to start at `"100,000.00"`,
  // `"400,000.00"` and a fabricated `ord_init_aapl` fill, which meant the page
  // displayed a funded account and a completed trade before it had spoken to
  // anything (GAP-52).
  const [account, setAccount] = useState<MarketOverviewAccount | null>(null);
  const [accountFailure, setAccountFailure] = useState<FailureCopy | null>(null);
  const [accountEnvelope, setAccountEnvelope] = useState<{ code?: string; requestId?: string } | null>(null);
  const [priceRows, setPriceRows] = useState<MarketPriceRow[]>([]);
  const [pricesFailure, setPricesFailure] = useState<FailureCopy | null>(null);
  const [movers, setMovers] = useState<Movers | null>(null);
  const [moversFailure, setMoversFailure] = useState<FailureCopy | null>(null);
  const [health, setHealth] = useState<MarketDataHealth | null>(null);
  const [healthFailure, setHealthFailure] = useState<FailureCopy | null>(null);

  const [alpacaPositions, setAlpacaPositions] = useState<MarketPosition[]>([]);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeLeverage, setTradeLeverage] = useState<number>(4);
  const [tradeAmount, setTradeAmount] = useState<number>(100);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeToast, setTradeToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  // Starts empty: a session that has not traded has no orders, and saying so is
  // more informative than showing one that never happened.
  const [recentOrders, setRecentOrders] = useState<ExecutedOrder[]>([]);

  const unwrap = useCallback(<T,>(res: MarketFetch<T>): T | null => (res.ok ? res.data : null), []);

  /**
   * Pulls every market surface from the Go gateway, in parallel, each with its
   * own failure state.
   *
   * They degrade independently on purpose. The Alpaca *trading* host and the
   * Alpaca *data* host fail separately, so an account read that fails must not
   * blank out the price tape, and a movers ranking that fails must not pretend
   * the board is empty.
   */
  const loadBackendData = useCallback(async () => {
    const [overviewRes, pricesRes, moversRes, healthRes] = await Promise.all([
      fetchMarketOverviewChecked(),
      fetchMarketPrices(),
      fetchMarketMovers(),
      fetchMarketHealth(),
    ]);

    if (overviewRes.ok) {
      setAccount(overviewRes.data.account ?? null);
      setAlpacaPositions(overviewRes.data.positions ?? []);
      setAccountFailure(null);
      setAccountEnvelope(null);
    } else {
      // Not zeroed: an unreported balance is unknown, and `---` says so.
      setAccount(null);
      setAccountFailure(FAILURE_COPY[overviewRes.reason]);
      setAccountEnvelope({ code: overviewRes.code, requestId: overviewRes.requestId });
    }

    if (pricesRes.ok) {
      setPriceRows(pricesRes.data);
      setPricesFailure(null);
    } else {
      setPriceRows([]);
      setPricesFailure(FAILURE_COPY[pricesRes.reason]);
    }

    if (moversRes.ok) {
      setMovers(moversRes.data);
      setMoversFailure(null);
    } else if (overviewRes.ok && overviewRes.data.movers) {
      // The overview carries the same backend ranking from the same request
      // family. Using it is not a fallback to invented data — it is the same
      // number from a call that did succeed.
      setMovers(overviewRes.data.movers);
      setMoversFailure(null);
    } else {
      setMovers(null);
      setMoversFailure(FAILURE_COPY[moversRes.reason]);
    }

    if (healthRes.ok) {
      setHealth(healthRes.data);
      setHealthFailure(null);
    } else {
      setHealth(null);
      setHealthFailure(FAILURE_COPY[healthRes.reason]);
    }
  }, []);

  useEffect(() => {
    loadBackendData();
  }, [loadBackendData]);

  const handleClosePosition = async (sym: string) => {
    setTradeLoading(true);
    try {
      const res = await closeMarketPosition(sym);
      if (!res.error) {
        setTradeToast({ msg: `平仓成功：标的 ${sym} 已全部平仓结算`, type: "success" });
        await loadBackendData();
      } else {
        const parts = [`平仓异常: ${res.error}`];
        if (res.code) parts.push(`[${res.code}]`);
        if (res.requestId) parts.push(`(Req ID: ${res.requestId})`);
        setTradeToast({ msg: parts.join(" "), type: "error" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTradeToast({ msg: `平仓失败: ${msg}`, type: "error" });
    } finally {
      setTradeLoading(false);
      setTimeout(() => setTradeToast(null), 4000);
    }
  };

  /**
   * Fetches the selected symbol's quote from the server route, which relays the
   * gateway's answer. A non-2xx answer is a refusal and is displayed as one.
   */
  const fetchMarketData = useCallback(async (sym: string, range: string = selectedRange) => {
    setLoading(true);
    setSearchError(null);
    setQuoteFailure(null);
    try {
      const res = await fetch(`/api/market?symbol=${encodeURIComponent(sym)}&range=${encodeURIComponent(range)}`);
      const json = await res.json();
      if (!res.ok) {
        setMarketData(null);
        setQuoteFailure(FAILURE_COPY[(json?.reason as keyof typeof FAILURE_COPY) || "upstream-error"]);
        setQuoteEnvelope({ code: json?.code, requestId: json?.requestId });
        if (res.status === 400 && typeof json?.error === "string") {
          const parts = [json.error];
          if (json.code) parts.push(`[${json.code}]`);
          if (json.requestId) parts.push(`(Req ID: ${json.requestId})`);
          setSearchError(parts.join(" "));
        }
        return;
      }
      setQuoteEnvelope(null);
      setMarketData(json as MarketResponse);
    } catch (err: unknown) {
      setMarketData(null);
      const reasonKey = isGoBackendConfigured() ? "unreachable" : "gateway-unconfigured";
      setQuoteFailure(FAILURE_COPY[reasonKey]);
      setQuoteEnvelope(null);
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    fetchMarketData(selectedSymbol, selectedRange);
  }, [selectedSymbol, selectedRange, fetchMarketData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (!clean) return;

    const regex = /^[A-Z0-9.\-]{1,10}$/;
    if (!regex.test(clean)) {
      setSearchError("Gatekeeper: Invalid symbol. Only letters, numbers, '.', '-' (max 10 chars).");
      return;
    }

    setSelectedSymbol(clean);
    setSearchInput("");
  };

  // ==================== EXECUTE ALPACA TRADE ====================
  const handleExecuteAlpacaTrade = async () => {
    setTradeLoading(true);
    setTradeToast(null);
    try {
      // Map crypto symbol if needed (e.g. BTC-USD -> BTC/USD or equity)
      const cleanSym = selectedSymbol.replace("-USD", "");
      const res = await executeMarketTrade(cleanSym, tradeSide, tradeAmount, tradeLeverage);

      // Two distinct failure shapes reach here and both used to be mishandled:
      // a rejected order answers `{success:false, message}`, while a refusal —
      // 503 with no Alpaca credentials — is answered by the router's error
      // helper as `{error}` with no `message` at all. Reading only `message`
      // rendered "Alpaca 提示：undefined" in exactly the case an operator needs
      // to read, and it looks like a broker rejection rather than a missing
      // credential.
      const detail = res.error || res.message;
      if (res.success && !res.error) {
        setRecentOrders((prev) => [
          {
            id: res.order?.id || `ord_${Date.now()}`,
            symbol: cleanSym,
            side: tradeSide,
            notionalUSD: tradeAmount * tradeLeverage,
            leverage: tradeLeverage,
            // Alpaca's own status, or an explicit unknown. This used to default
            // to the string "ACCEPTED", which invented the most encouraging
            // possible status for an order we could not confirm — and the row
            // is rendered as if it were the broker's word.
            status: String(res.order?.status || "STATUS UNKNOWN").toUpperCase(),
            time: "刚刚",
          },
          ...prev.slice(0, 4),
        ]);
        setTradeToast({
          msg: `Alpaca 订单已提交：${tradeSide.toUpperCase()} ${cleanSym} (保证金 $${tradeAmount} USD · ${tradeLeverage}x 杠杆 · 实际建仓 $${(tradeAmount * tradeLeverage).toFixed(2)} USD)`,
          type: "success",
        });
        await loadBackendData();
      } else {
        const parts = [`订单未成交：${detail || "后端未返回失败原因"}`];
        if (res.code) parts.push(`[${res.code}]`);
        if (res.requestId) parts.push(`(Req ID: ${res.requestId})`);
        setTradeToast({
          msg: parts.join(" "),
          type: "error",
        });
      }
    } catch (err: unknown) {
      // No order is recorded on this path. This branch used to append a local
      // `ord_local_…` marked ACCEPTED and announce "本地快速成交模拟成功" — an
      // execution record for an order that was never placed, which is the same
      // defect as a synthetic price with a different subject.
      const msg = err instanceof Error ? err.message : String(err);
      setTradeToast({ msg: `订单提交失败（未产生任何成交记录）: ${msg}`, type: "error" });
    } finally {
      setTradeLoading(false);
      setTimeout(() => setTradeToast(null), 5000);
    }
  };

  // SVG Chart points calculation.
  //
  // Kept as-is, and it is not dead code: the backend publishes no series today,
  // so `closes` is empty and this returns null — the note below the headline
  // explains that. Should a series endpoint appear, the relayed points render
  // here with nothing else to change.
  const chartCoordinates = useMemo(() => {
    if (!marketData || !marketData.chart.closes.length) return null;
    const closes = marketData.chart.closes;
    if (closes.length < 2) return null;
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const width = 640;
    const height = 180;
    const padding = 15;

    const points = closes.map((price, idx) => {
      const x = padding + (idx / (closes.length - 1)) * (width - padding * 2);
      const y = height - padding - ((price - min) / range) * (height - padding * 2);
      return { x, y, price, timestamp: marketData.chart.timestamps[idx] };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { points, pathD, areaD, min, max, width, height };
  }, [marketData]);

  // Sign of the selected symbol's change, or null when the upstream published
  // no change for it.
  const changeSign = signClass(marketData?.meta.regularMarketChangePercent ?? null);
  const isPositive = (marketData?.meta.regularMarketChangePercent ?? 0) >= 0;
  const quotePrice = marketData ? formatUsd(marketData.meta.regularMarketPrice) : "---";

  /**
   * The integration badge, derived from a real probe.
   *
   * `/api/v1/market/health` answers 200 without credentials and reports
   * `configured`, which is why it is the first thing this page asks. The badge
   * used to read "ACTIVE / 已连接" unconditionally — an assertion about an
   * integration produced by a process that had never contacted it (GAP-13).
   */
  const badge = (() => {
    if (healthFailure) {
      return !isGoBackendConfigured()
        ? { label: "GATEWAY UNCONFIGURED", tone: "bg-amber-500/20 text-amber-300 border-amber-500/40" }
        : { label: "GATEWAY UNREACHABLE", tone: "bg-red-500/20 text-red-300 border-red-500/40" };
    }
    if (!health) {
      return { label: "CHECKING", tone: "bg-white/10 text-slate-300 border-white/20" };
    }
    if (!health.configured) {
      return { label: "NOT CONFIGURED", tone: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
    }
    if (!health.priceOracle.ok) {
      return { label: "UPSTREAM DEGRADED", tone: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
    }
    return { label: "ACTIVE", tone: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  })();

  return (
    <div className="w-full space-y-6 font-sans">
      {/* 1. Ticker Tape Header — real prices from /api/v1/market/prices */}
      <div className="rounded-md bg-[#121622]/90 border border-white/[0.08] p-3 shadow-md backdrop-blur-md overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider pr-3 border-r border-white/10">
            <Activity className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>Alpaca Daily Bars Tape</span>
          </div>

          {priceRows.length === 0 && (
            <span className="text-slate-500">
              {pricesFailure ? `[INFO] ${pricesFailure.headline}` : "Loading quotes..."}
            </span>
          )}

          {priceRows.map((item) => {
            const isSelected = selectedSymbol === item.symbol;
            const tone = signClass(item.changePercent);
            return (
              <button
                key={item.symbol}
                onClick={() => setSelectedSymbol(item.symbol)}
                title={`source: ${item.source}${item.synthetic ? " (synthetic)" : ""}`}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md transition ${
                  isSelected ? "bg-white text-black font-bold shadow-sm" : "hover:bg-white/[0.06] text-slate-300"
                }`}
              >
                <span>{item.symbol}</span>
                <span className={isSelected ? "text-black" : "text-white"}>{formatUsd(item.price)}</span>
                <span className={isSelected ? "text-black" : tone}>{formatPercent(item.changePercent)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Alpaca Account Status Banner — status from /api/v1/market/health */}
      <div className="rounded-lg bg-gradient-to-r from-[#141b2d] via-[#162238] to-[#121a2b] border border-emerald-500/30 p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-md bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-sm">
            <DollarSign className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Alpaca 美股纸盘 (Paper Trading)</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.tone}`}>{badge.label}</span>
            </div>
            <p className="text-xs text-slate-400">
              {healthFailure
                ? healthFailure.action
                : health && !health.configured
                ? "后端未配置 ALPACA_API_KEY / ALPACA_API_SECRET。本页不显示任何行情数字，也不以合成数据填补。"
                : health && !health.priceOracle.ok
                ? `行情源读取失败：${health.priceOracle.error || "上游未返回可用 bar"}`
                : health
                ? `${health.priceOracle.instruments}/${health.priceOracle.symbols.length} 个标的已取到日线${
                    health.priceOracle.latestBar ? ` · 最新 bar ${health.priceOracle.latestBar}` : ""
                  }`
                : "正在向后端核实行情源状态..."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs bg-black/40 px-5 py-3 rounded-md border border-white/10 shrink-0">
          <MetricCell label="可用现金余额" value={account ? formatBalanceString(account.cash) : "---"} />
          <div className="hidden sm:block h-6 w-px bg-white/10" />
          <MetricCell
            label="多头持仓总值"
            value={account ? formatBalanceString(account.long_market_value) : "---"}
            tone={account ? "text-emerald-300" : undefined}
          />
          <div className="hidden sm:block h-6 w-px bg-white/10" />
          <MetricCell
            label="空头融券头寸"
            value={account ? formatBalanceString(account.short_market_value) : "---"}
            tone={account ? "text-red-300" : undefined}
          />
          <div className="hidden sm:block h-6 w-px bg-white/10" />
          <MetricCell
            label="总购买力"
            value={account ? formatBalanceString(account.buying_power) : "---"}
            tone={account ? "text-cyan-400" : undefined}
          />
        </div>
      </div>

      {accountFailure && <FailureNotice failure={accountFailure} context="账户 / 持仓" code={accountEnvelope?.code} requestId={accountEnvelope?.requestId} />}

      {/* 3. Search & Range Bar */}
      <div className="rounded-lg bg-[#121622]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>{selectedSymbol}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-white/10 text-white border border-white/20 font-mono">
                {/* No exchange is guessed when the upstream does not name one. */}
                {marketData?.meta.exchangeName || "交易所未标注"}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-mono mt-1">
              {marketData?.meta.name || selectedSymbol} ·{" "}
              {marketData?.synthetic ? "Synthetic upstream data" : "Real market data (Alpaca daily bars)"}
            </p>
            {marketData && (
              <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-md border border-white/15 bg-white/[0.03] px-2 py-1 text-[10px] leading-relaxed text-slate-300">
                <span className="font-mono uppercase tracking-wider text-slate-400">{marketData.source}</span>
                {marketData.dataCaveat && <span>{marketData.dataCaveat}</span>}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESET_SYMBOLS.map((item) => (
              <button
                key={item.symbol}
                onClick={() => setSelectedSymbol(item.symbol)}
                className={`px-3 py-1.5 rounded-md font-mono text-xs transition ${
                  selectedSymbol === item.symbol
                    ? "bg-white text-black font-bold shadow-sm"
                    : "bg-white/[0.06] hover:bg-white/10 text-slate-300"
                }`}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search US Stock (e.g. MSFT, GOOGL, AMD, SPY)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-md bg-[#0d1017] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-400 font-mono focus:outline-none focus:border-white/30 transition"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-6 rounded-md bg-white hover:bg-slate-100 text-black font-semibold text-xs sm:text-sm font-mono transition shadow-sm active:scale-[0.98]"
          >
            Search
          </button>
        </form>

        {searchError && (
          <p className="text-[11px] font-mono text-red-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{searchError}</span>
          </p>
        )}
      </div>

      {/* 4. Chart & Alpaca Execution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-lg bg-[#121622]/90 border border-white/[0.08] p-6 space-y-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-white">${quotePrice}</div>
              <div className={`flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold mt-1 ${changeSign}`}>
                {marketData?.meta.regularMarketChangePercent !== null &&
                  marketData?.meta.regularMarketChangePercent !== undefined &&
                  (isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />)}
                <span>
                  {formatSignedUsd(marketData?.meta.regularMarketChange ?? null)} (
                  {formatPercent(marketData?.meta.regularMarketChangePercent ?? null)})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#0d1017] p-1 rounded-lg border border-white/[0.08]">
              {["1d", "5d", "1mo", "1y"].map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setSelectedRange(r);
                    fetchMarketData(selectedSymbol, r);
                  }}
                  title={
                    selectedRange === r && (!marketData?.chart.closes || marketData.chart.closes.length < 2)
                      ? "该区间的序列需上游提供历史序列；当前上游仅返回最新价与前收。"
                      : `切换至 ${r.toUpperCase()} 真实时序走势`
                  }
                  className={`px-3 py-1 rounded-md text-xs font-mono transition ${
                    selectedRange === r ? "bg-white text-black font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Chart area, or the reason there is none */}
          <div className="min-h-[12rem] w-full relative flex items-center justify-center">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Loading Chart Data...</span>
              </div>
            ) : quoteFailure ? (
              <FailureNotice failure={quoteFailure} context={selectedSymbol} code={quoteEnvelope?.code} requestId={quoteEnvelope?.requestId} />
            ) : chartCoordinates ? (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 640 180">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? "#34d399" : "#f87171"} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={isPositive ? "#34d399" : "#f87171"} stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={chartCoordinates.areaD} fill="url(#areaGradient)" />
                <path
                  d={chartCoordinates.pathD}
                  fill="none"
                  stroke={isPositive ? "#34d399" : "#f87171"}
                  strokeWidth="2.5"
                />
              </svg>
            ) : (
              <p className="text-[11px] font-mono text-slate-400 leading-relaxed border border-white/10 rounded-md bg-black/30 px-3 py-2">
                {NO_SERIES_NOTE}
              </p>
            )}
          </div>

          {/* Published-or-absent metrics. See the note: these are not estimated. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-white/[0.08] pt-4 font-mono text-xs">
            <MetricCell label="52 周最高" value={formatUsd(marketData?.meta.fiftyTwoWeekHigh ?? null)} />
            <MetricCell label="52 周最低" value={formatUsd(marketData?.meta.fiftyTwoWeekLow ?? null)} />
            <MetricCell label="日内最高" value={formatUsd(marketData?.meta.regularMarketDayHigh ?? null)} />
            <MetricCell label="日内最低" value={formatUsd(marketData?.meta.regularMarketDayLow ?? null)} />
            <MetricCell
              label="成交量"
              value={
                marketData?.meta.regularMarketVolume === null || marketData?.meta.regularMarketVolume === undefined
                  ? "---"
                  : marketData.meta.regularMarketVolume.toLocaleString("en-US")
              }
            />
            <MetricCell label="市值" value={marketData?.meta.marketCap || "---"} />
            <MetricCell
              label="相对前收"
              value={formatPercent(marketData?.meta.regularMarketChangePercent ?? null)}
              tone={changeSign}
            />
            <MetricCell
              label="市盈率"
              value={marketData?.meta.peRatio === null || marketData?.meta.peRatio === undefined ? "---" : String(marketData.meta.peRatio)}
            />
          </div>
          <p className="text-[10px] font-mono text-slate-500 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              [INFO] 显示为 --- 的字段，是上游（Alpaca 日线）**不提供**的字段。此处不按系数估算、
              也不填默认值：一个编出来的 52 周高点与一个编出来的价格是同一个错误。
            </span>
          </p>
        </div>

        {/* Right Column: trade panel (unchanged mechanics; no fabricated fills) */}
        <div className="lg:col-span-5 rounded-lg bg-[#121622]/90 border border-emerald-500/30 p-6 space-y-5 shadow-2xl backdrop-blur-xl font-mono flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Alpaca 多空下单控制台 (KISS)</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${badge.tone}`}>{badge.label}</span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 block uppercase">交易方向 (Side)</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTradeSide("buy")}
                  className={`py-2.5 rounded-md font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                    tradeSide === "buy"
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]"
                      : "bg-white/[0.04] text-slate-300 border-white/10 hover:border-white/30"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>BUY (做多)</span>
                </button>

                <button
                  onClick={() => setTradeSide("sell")}
                  className={`py-2.5 rounded-md font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                    tradeSide === "sell"
                      ? "bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.4)]"
                      : "bg-white/[0.04] text-slate-300 border-white/10 hover:border-white/30"
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>SELL (做空)</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 block uppercase">杠杆倍数 (Leverage)</span>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 4].map((lev) => (
                  <button
                    key={lev}
                    onClick={() => setTradeLeverage(lev)}
                    className={`py-2 rounded-md text-xs font-bold transition border ${
                      tradeLeverage === lev
                        ? "bg-white text-black border-white"
                        : "bg-white/[0.04] text-slate-300 border-white/10 hover:border-white/20"
                    }`}
                  >
                    {lev}x 杠杆
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 block uppercase">保证金金额 (Margin USD)</span>
              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTradeAmount(amt)}
                    className={`py-2 rounded-md text-xs font-bold transition border ${
                      tradeAmount === amt
                        ? "bg-cyan-400 text-black border-cyan-400"
                        : "bg-white/[0.04] text-slate-300 border-white/10 hover:border-white/20"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(Number(e.target.value))}
                min={1}
                className="w-full mt-1.5 px-3 py-2 rounded-md bg-[#0d1017] border border-white/10 text-white text-xs focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="p-3.5 rounded-md bg-black/60 border border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>占用保证金 (Margin):</span>
                <span className="text-white font-bold">${tradeAmount.toFixed(2)} USD</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>杠杆放大:</span>
                <span className="text-cyan-400 font-bold">{tradeLeverage}x 购买力</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
                <span className="text-white font-bold">实际建仓总头寸 (Exposure):</span>
                <span className="text-emerald-400 font-black text-sm">
                  ${(tradeAmount * tradeLeverage).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
                </span>
              </div>
              <p className="text-[11px] leading-relaxed pt-0.5">
                {tradeSide === "buy" ? (
                  <span className="text-emerald-300 flex items-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      多头建仓 (Long)：借入购买力做多 {(tradeAmount * tradeLeverage).toFixed(0)} USD {selectedSymbol}
                      。标的上涨即可放大获利！
                    </span>
                  </span>
                ) : (
                  <span className="text-red-300 flex items-center gap-1.5">
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>
                      融券做空 (Short)：融券借出并卖空 -{(tradeAmount * tradeLeverage).toFixed(0)} USD{" "}
                      {selectedSymbol}。标的下跌即可放大获利！
                    </span>
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={handleExecuteAlpacaTrade}
              disabled={tradeLoading || tradeAmount <= 0}
              className={`w-full h-10 rounded-md font-mono text-xs font-semibold transition border flex items-center justify-center gap-2 active:scale-[0.98] ${
                tradeSide === "buy"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "bg-red-500 hover:bg-red-400 text-white border-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
              }`}
            >
              {tradeLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>正在向 Alpaca 提交订单...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    提交 Alpaca 订单 ({tradeSide.toUpperCase()} {selectedSymbol} 敞口 $
                    {(tradeAmount * tradeLeverage).toFixed(0)} USD)
                  </span>
                </>
              )}
            </button>

            {tradeToast && (
              <div
                className={`p-3 rounded-md text-xs flex items-center gap-2 border ${
                  tradeToast.type === "success"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-red-500/20 text-red-300 border-red-500/40"
                }`}
              >
                {tradeToast.type === "success" ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{tradeToast.msg}</span>
              </div>
            )}
          </div>

          {/* Execution history: only orders this session actually placed. */}
          <div className="pt-3 border-t border-white/[0.08] space-y-1.5">
            <span className="text-[10px] text-slate-400 block uppercase">本次会话成交流水</span>
            <div className="space-y-1">
              {recentOrders.length === 0 && (
                <p className="text-[11px] text-slate-500 py-2">
                  本次会话尚无成交记录。（此前这里预置了一条从未发生的 AAPL 成交。）
                </p>
              )}
              {recentOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-2 rounded-md bg-black/40 border border-white/[0.06] flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-bold uppercase ${ord.side === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                      {ord.side}
                    </span>
                    <span className="text-white font-bold">{ord.symbol}</span>
                    <span className="text-slate-400">
                      ${ord.notionalUSD} ({ord.leverage}x)
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {ord.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Movers board — issue #16 标的涨跌幅排行, ranked by the backend */}
      <MoversBoard
        movers={movers}
        failure={moversFailure}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
        onRefresh={loadBackendData}
      />

      {/* 6. Alpaca Active Open Positions Table */}
      <div className="rounded-lg bg-[#121622]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-xl space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-white">Alpaca 实时持仓头寸与浮动盈亏 (Open Positions)</h3>
            <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-white">
              {alpacaPositions.length} 个活跃持仓
            </span>
          </div>
          <button
            onClick={loadBackendData}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>刷新持仓</span>
          </button>
        </div>

        {alpacaPositions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400 text-[10px]">
                  <th className="py-2 px-3">标的代码</th>
                  <th className="py-2 px-3">方向</th>
                  <th className="py-2 px-3">持有股数</th>
                  <th className="py-2 px-3">开仓均价</th>
                  <th className="py-2 px-3">当前市价</th>
                  <th className="py-2 px-3">持仓市值 (USD)</th>
                  <th className="py-2 px-3">未实现浮动盈亏 (USD)</th>
                  <th className="py-2 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {alpacaPositions.map((pos) => {
                  const isProfitable = Number(pos.unrealized_pl) >= 0;
                  return (
                    <tr key={pos.symbol} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 font-bold text-white">{pos.symbol}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pos.side.toLowerCase() === "long"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {pos.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-200">{Number(pos.qty).toFixed(2)} 股</td>
                      <td className="py-3 px-3 text-slate-400">${Number(pos.avg_entry_price || 0).toFixed(2)}</td>
                      <td className="py-3 px-3 text-slate-200">${Number(pos.current_price || 0).toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold text-white">
                        ${Number(pos.market_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-bold">
                        <span className={isProfitable ? "text-emerald-400" : "text-red-400"}>
                          {isProfitable ? "+" : ""}${Number(pos.unrealized_pl).toFixed(2)} (
                          {isProfitable ? "+" : ""}
                          {(Number(pos.unrealized_plpc) * 100).toFixed(2)}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleClosePosition(pos.symbol)}
                          disabled={tradeLoading}
                          className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[11px] font-bold transition active:scale-95"
                        >
                          平仓
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs space-y-1">
            <p>暂无活跃美股持仓头寸</p>
            <p className="text-[11px] text-slate-600">
              在上方控制台选择标的、杠杆并提交做多 (BUY) 或做空 (SELL) 订单即可自动撮合成交并生成持仓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** One column of the ranking board. */
function MoversColumn({
  title,
  rows,
  tone,
  selectedSymbol,
  onSelectSymbol,
  emptyLabel,
}: {
  title: string;
  rows: InstrumentChange[];
  tone: string;
  selectedSymbol: string;
  onSelectSymbol: (s: string) => void;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-black/30 overflow-hidden">
      <div className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b border-white/[0.08] ${tone}`}>
        {title} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {rows.map((row) => (
            <li key={row.symbol}>
              <button
                onClick={() => onSelectSymbol(row.symbol)}
                className={`w-full px-3 py-2 flex items-center justify-between text-[11px] transition hover:bg-white/[0.04] ${
                  selectedSymbol === row.symbol ? "bg-white/[0.06]" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-bold text-white">{row.symbol}</span>
                  <span className="text-slate-400">{formatUsd(row.price)}</span>
                </span>
                <span className={`font-bold ${signClass(row.changePercent)}`}>
                  {formatPercent(row.changePercent)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The 标的涨跌幅排行 board (issue #16).
 *
 * Ranked by `market.RankMovers` on the backend and rendered in the order it
 * arrives — this component never re-sorts, because a second ordering
 * implementation would be a second source of truth for the same ranking (D4).
 */
function MoversBoard({
  movers,
  failure,
  selectedSymbol,
  onSelectSymbol,
  onRefresh,
}: {
  movers: Movers | null;
  failure: FailureCopy | null;
  selectedSymbol: string;
  onSelectSymbol: (s: string) => void;
  onRefresh: () => void;
}) {
  const rowCount = moversRowCount(movers);

  return (
    <div className="rounded-lg bg-[#121622]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-xl space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-sm text-white">标的涨跌幅排行 (Movers)</h3>
          <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-white">{rowCount} 个标的已排名</span>
          {movers?.synthetic && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-200 border border-purple-400/30">
              synthetic
            </span>
          )}
        </div>
        <button onClick={onRefresh} className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>刷新排行</span>
        </button>
      </div>

      {failure && <FailureNotice failure={failure} context="涨跌幅排行" />}

      {!failure && movers && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MoversColumn
              title="涨幅榜"
              rows={movers.gainers}
              tone="text-emerald-300"
              selectedSymbol={selectedSymbol}
              onSelectSymbol={onSelectSymbol}
              emptyLabel="无上涨标的"
            />
            <MoversColumn
              title="跌幅榜"
              rows={movers.losers}
              tone="text-red-300"
              selectedSymbol={selectedSymbol}
              onSelectSymbol={onSelectSymbol}
              emptyLabel="无下跌标的"
            />
            <MoversColumn
              title="持平"
              rows={movers.unchanged}
              tone="text-slate-300"
              selectedSymbol={selectedSymbol}
              onSelectSymbol={onSelectSymbol}
              emptyLabel="无持平标的"
            />
          </div>

          {/*
            `unrankedCount` is shown separately and never folded into "持平".
            "It did not move" and "we cannot tell whether it moved" are different
            facts; collapsing them is how a ranking starts lying.
          */}
          {movers.unrankedCount > 0 && (
            <p className="text-[11px] text-amber-200/80 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>
                另有 {movers.unrankedCount} 个标的因缺少前一交易日收盘价而
                <strong className="font-bold">无法计算涨跌幅</strong>，故未参与排名（不计入「持平」）。
              </span>
            </p>
          )}

          <p className="text-[10px] text-slate-500">
            来源 <span className="text-slate-400">{movers.source || "unknown"}</span>
            {movers.asOf ? ` · 数据时间 ${movers.asOf}` : ""} · 排名由后端计算，前端不重排
          </p>
        </>
      )}
    </div>
  );
}

/** The account subset the banner renders. */
type MarketOverviewAccount = MarketOverviewData["account"];
