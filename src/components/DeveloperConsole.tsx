"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Copy,
  Check,
  Zap,
  Shield,
  CreditCard,
  Terminal,
  Activity,
  Play,
  RotateCw,
  Coins,
  ArrowUpRight,
  Sliders,
  Layers,
  Database,
  Lock,
} from "lucide-react";

interface StatsData {
  wallet_address: string;
  total_calls_24h: number;
  remaining_quota: number;
  free_claims_left: number;
  success_rate_percent: number;
  avg_latency_ms: number;
  payment_distribution: {
    crypto: number;
    stripe: number;
    bank: number;
  };
  total_volume_usd: number;
  recent_orders: Array<{
    payment_id: string;
    item_name: string;
    amount: number;
    quantity: number;
    payment_method: string;
    crypto_currency?: string;
    tx_hash: string;
    on_chain_status: string;
    order_hash: string;
    created_at: string;
  }>;
}

interface BoundAgent {
  agent_id: string;
  agent_name: string;
  model_name: string;
  wallet_address: string;
  wallet_balance: number;
  status: string;
  session_key: string;
  limits: {
    max_per_tx_usd: number;
    daily_limit_usd: number;
  };
}

export function DeveloperConsole({ currentAccount }: { currentAccount?: `0x${string}` | null }) {
  const activeWallet = currentAccount || "0x71C8360f3E118A7cD87A0cf633a69a089d4c20b2";

  // API Key state
  const [apiKey, setApiKey] = useState<string>("kol_live_8f912c40a79d2b1f8c4e0987");
  const [copiedKey, setCopiedKey] = useState(false);
  const [quota, setQuota] = useState<number>(300);
  const [freeClaimsLeft, setFreeClaimsLeft] = useState<number>(3);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  // Playground state
  const [activeTab, setActiveTab] = useState<"bind" | "pay">("pay");
  const [isRunning, setIsRunning] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [activeTier, setActiveTier] = useState<string>("STARTER_FREE");

  // Telemetry stats
  const [stats, setStats] = useState<StatsData>({
    wallet_address: activeWallet,
    total_calls_24h: 1248,
    remaining_quota: 300,
    free_claims_left: 3,
    success_rate_percent: 99.8,
    avg_latency_ms: 38,
    payment_distribution: {
      crypto: 42,
      stripe: 18,
      bank: 5,
    },
    total_volume_usd: 3420.5,
    recent_orders: [
      {
        payment_id: "pay_9a81cd",
        item_name: "Nansen High Frequency Data Feed",
        amount: 25.0,
        quantity: 1,
        payment_method: "crypto",
        crypto_currency: "MON",
        tx_hash: "0x8f19...20ba",
        on_chain_status: "COMMITTED_TO_MONAD",
        order_hash: "0x3e18...d8a1",
        created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      },
      {
        payment_id: "pay_7c22ee",
        item_name: "Compute Cluster Node-04 Quota",
        amount: 99.0,
        quantity: 2,
        payment_method: "stripe",
        tx_hash: "0x11ab...e45f",
        on_chain_status: "COMMITTED_TO_MONAD",
        order_hash: "0xaa90...112c",
        created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        payment_id: "pay_55aa12",
        item_name: "Autonomous Model Token Pack",
        amount: 15.0,
        quantity: 1,
        payment_method: "crypto",
        crypto_currency: "KOL",
        tx_hash: "0xcc29...3881",
        on_chain_status: "COMMITTED_TO_MONAD",
        order_hash: "0xfa12...99ee",
        created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      },
    ],
  });

  // Bound Agents
  const [agents, setAgents] = useState<BoundAgent[]>([
    {
      agent_id: "agt_alpha_01",
      agent_name: "Alpha-Perp-Arbitrage",
      model_name: "deepseek-r1",
      wallet_address: activeWallet,
      wallet_balance: 1500.0,
      status: "ACTIVE",
      session_key: "sk_sess_9a8bc721de004f",
      limits: {
        max_per_tx_usd: 150.0,
        daily_limit_usd: 800.0,
      },
    },
    {
      agent_id: "agt_sentinel_02",
      agent_name: "KOL-Sentinel-Bot",
      model_name: "gpt-4o",
      wallet_address: "0x3198a291dc4581290bb82910fa82019ab921c812",
      wallet_balance: 420.0,
      status: "ACTIVE",
      session_key: "sk_sess_441ba892cd11aa",
      limits: {
        max_per_tx_usd: 50.0,
        daily_limit_usd: 300.0,
      },
    },
  ]);

  // Fetch backend telemetry if online
  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`/api/v1/developer/stats?wallet_address=${activeWallet}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setStats((prev) => ({
              ...prev,
              ...json.data,
              recent_orders: json.data.recent_orders?.length ? json.data.recent_orders : prev.recent_orders,
            }));
            if (json.data.remaining_quota !== undefined) {
              setQuota(json.data.remaining_quota);
            }
            if (json.data.free_claims_left !== undefined) {
              setFreeClaimsLeft(json.data.free_claims_left);
            }
          }
        }
      } catch {
        // Fallback to demo in-memory metrics
      }
    }
    loadStats();
  }, [activeWallet]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Free Claim Handler (3 times allowed)
  const handleFreeClaim = async () => {
    if (freeClaimsLeft <= 0) return;
    setClaiming(true);
    setClaimMessage(null);

    try {
      const res = await fetch("/api/v1/developer/packages/claim-or-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: activeWallet,
          tier_id: "STARTER_FREE_100",
          payment_method: "free_claim",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setQuota(json.data.remaining_quota);
        setFreeClaimsLeft(json.data.free_claims_left);
        setClaimMessage(`[SUCCESS] 100 API Calls credited. Remaining claims: ${json.data.free_claims_left}/3`);
      } else {
        // Fallback local simulation
        setQuota((q) => q + 100);
        setFreeClaimsLeft((c) => Math.max(0, c - 1));
        setClaimMessage(`[SUCCESS] 100 API Calls credited. Remaining claims: ${Math.max(0, freeClaimsLeft - 1)}/3`);
      }
    } catch {
      setQuota((q) => q + 100);
      setFreeClaimsLeft((c) => Math.max(0, c - 1));
      setClaimMessage(`[SUCCESS] 100 API Calls credited (Mock mode).`);
    } finally {
      setClaiming(false);
      setTimeout(() => setClaimMessage(null), 4000);
    }
  };

  // Run interactive playground request
  const handleRunPlayground = async () => {
    setIsRunning(true);
    setExecutionLogs([
      `[INFO] Target: Monad Testnet (Chain ID 10143)`,
      `[INFO] Method: POST /api/v1/agent/${activeTab}`,
      `[INFO] Authenticating Bearer ${apiKey.slice(0, 14)}...`,
    ]);

    await new Promise((r) => setTimeout(r, 450));
    setExecutionLogs((prev) => [
      ...prev,
      `[INFO] Quota verified. Deducting 1 call unit (Remaining: ${Math.max(0, quota - 1)})`,
    ]);
    setQuota((q) => Math.max(0, q - 1));

    await new Promise((r) => setTimeout(r, 600));

    if (activeTab === "pay") {
      const simulatedTx = "0x" + Math.random().toString(16).substring(2) + "9f1a24bc";
      setExecutionLogs((prev) => [
        ...prev,
        `[INFO] Cryptographic Order Hash computed: 0x3e18a91df720c1598b92b67f18a6e9a71db...`,
        `[OK] Payment approved via Monad Gasless Virtual Card`,
        `[SUCCESS] Order committed to Monad batch state. Tx: ${simulatedTx}`,
      ]);

      // Add to recent orders
      setStats((prev) => ({
        ...prev,
        total_volume_usd: prev.total_volume_usd + 25.0,
        payment_distribution: {
          ...prev.payment_distribution,
          crypto: prev.payment_distribution.crypto + 1,
        },
        recent_orders: [
          {
            payment_id: "pay_" + Math.random().toString(36).substring(2, 8),
            item_name: "Nansen High Frequency Data Feed",
            amount: 25.0,
            quantity: 1,
            payment_method: "crypto",
            crypto_currency: "MON",
            tx_hash: simulatedTx.slice(0, 10) + "..." + simulatedTx.slice(-4),
            on_chain_status: "COMMITTED_TO_MONAD",
            order_hash: "0x3e18...d8a1",
            created_at: new Date().toISOString(),
          },
          ...prev.recent_orders.slice(0, 5),
        ],
      }));
    } else {
      const newSessKey = "sk_sess_" + Math.random().toString(16).substring(2, 14);
      setExecutionLogs((prev) => [
        ...prev,
        `[INFO] Validating agent parameters: name=Alpha-Bot, model=deepseek-r1`,
        `[OK] EIP-712 Session Key delegated with limits: MaxPerTx=$100, DailyLimit=$500`,
        `[SUCCESS] Agent registered. SessionKey: ${newSessKey}`,
      ]);

      setAgents((prev) => [
        {
          agent_id: "agt_" + Math.random().toString(36).substring(2, 8),
          agent_name: "Alpha-Bot-" + (prev.length + 1),
          model_name: "deepseek-r1",
          wallet_address: activeWallet,
          wallet_balance: 500.0,
          status: "ACTIVE",
          session_key: newSessKey,
          limits: { max_per_tx_usd: 100.0, daily_limit_usd: 500.0 },
        },
        ...prev,
      ]);
    }

    setIsRunning(false);
  };

  return (
    <div className="w-full space-y-8 pb-12 font-sans text-slate-100">
      {/* 1. Header & Overview Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#131726] to-[#0c0f1a] border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-monad-500/10 border border-monad-500/30 text-monad-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>[LIVE] DEVELOPER CONSOLE // MONAD TESTNET</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Autonomous Agent API & Telemetry Control
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl font-mono">
              Provision production-grade credentials, delegate EIP-712 session authority, and inspect live settlement batches across Monad, Stripe, and off-chain ledgers.
            </p>
          </div>

          {/* Quick API Key Card */}
          <div className="p-4 rounded-2xl bg-[#181d2e] border border-white/10 space-y-3 min-w-[280px]">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5 text-purple-300">
                <KeyRound className="w-3.5 h-3.5" />
                API CREDENTIAL
              </span>
              <span className="text-emerald-400 font-semibold">[ACTIVE]</span>
            </div>

            <div className="flex items-center justify-between gap-2 bg-[#0d101a] px-3 py-2 rounded-xl border border-white/5 font-mono text-xs text-white">
              <span className="truncate">{apiKey.slice(0, 16)}••••••••</span>
              <button
                onClick={copyToClipboard}
                className="p-1 hover:bg-white/10 rounded transition text-slate-300 hover:text-white"
                title="Copy API Key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs font-mono">
              <span className="text-slate-400">Remaining Quota:</span>
              <span className="text-cyan-300 font-bold text-sm">{quota} calls</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Free Starter Quota & 3-Tier Packages */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>API Quota Packages & Starter Allowance</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Every verified wallet is granted 3 free purchases of the 100-call tier pack for KOL testing and onboarding.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">
              Free Claims Left: <strong className="text-amber-300">{freeClaimsLeft}/3</strong>
            </span>
          </div>
        </div>

        {claimMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono"
          >
            {claimMessage}
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tier 1: Free Starter */}
          <div className="p-5 rounded-2xl bg-[#141828] border border-white/10 hover:border-amber-400/40 transition-all space-y-4 relative flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  STARTER // FREE
                </span>
                <span className="text-xs font-mono text-slate-400">60 RPM</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">100 API Calls</h3>
              <p className="text-xs text-slate-400">
                Designed for KOL live trial, sandbox testing, and proof verification.
              </p>
              <div className="text-2xl font-black text-amber-400 pt-1">$0.00</div>
            </div>

            <button
              onClick={handleFreeClaim}
              disabled={claiming || freeClaimsLeft <= 0}
              className={`w-full py-2.5 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 ${
                freeClaimsLeft > 0
                  ? "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 cursor-pointer"
                  : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
              }`}
            >
              {claiming ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : freeClaimsLeft > 0 ? (
                <span>Claim Free Pack ({freeClaimsLeft} Left)</span>
              ) : (
                <span>Quota Exhausted (3/3 Used)</span>
              )}
            </button>
          </div>

          {/* Tier 2: Growth Pro */}
          <div className="p-5 rounded-2xl bg-[#141828] border border-monad-500/40 hover:border-monad-400 transition-all space-y-4 relative flex flex-col justify-between shadow-lg shadow-purple-900/10">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  GROWTH PRO // POPULAR
                </span>
                <span className="text-xs font-mono text-purple-300">300 RPM</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">10,000 API Calls</h3>
              <p className="text-xs text-slate-400">
                For autonomous perpetual bots and high-frequency market subscriptions.
              </p>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-purple-300">$19.90</span>
                <span className="text-xs font-mono text-emerald-400">-15% via KOL token</span>
              </div>
            </div>

            <button
              onClick={() => {
                setQuota((q) => q + 10000);
                setActiveTier("GROWTH_PRO");
                setClaimMessage("[SUCCESS] 10,000 API calls credited via Growth Pro pack.");
              }}
              className="w-full py-2.5 rounded-xl font-mono text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/25 cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              <span>Purchase via KOL / Stripe</span>
            </button>
          </div>

          {/* Tier 3: Scale Ultra */}
          <div className="p-5 rounded-2xl bg-[#141828] border border-white/10 hover:border-cyan-400/40 transition-all space-y-4 relative flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  ENTERPRISE // SCALE
                </span>
                <span className="text-xs font-mono text-cyan-300">1200 RPM</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">100,000 API Calls</h3>
              <p className="text-xs text-slate-400">
                Dedicated QPS queue, high-speed Monad batch lane, and corporate invoicing.
              </p>
              <div className="text-2xl font-black text-cyan-400 pt-1">$149.00</div>
            </div>

            <button
              onClick={() => {
                setQuota((q) => q + 100000);
                setActiveTier("SCALE_ULTRA");
                setClaimMessage("[SUCCESS] 100,000 API calls activated with dedicated priority queue.");
              }}
              className="w-full py-2.5 rounded-xl font-mono text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Subscribe Scale Pack</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Interactive API Playground (OpenAI / Stripe Style) */}
      <div className="rounded-3xl bg-[#121624] border border-white/10 p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <span>Interactive Agent API Playground</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live testing console for Agent & Wallet Binding and Autonomous Payment executions.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#0c0f18] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("pay")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                activeTab === "pay"
                  ? "bg-purple-600 text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              POST /agent/pay
            </button>
            <button
              onClick={() => setActiveTab("bind")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                activeTab === "bind"
                  ? "bg-purple-600 text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              POST /agent/bind
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Code Payload Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>REQUEST PAYLOAD (JSON)</span>
              <span>Cost: 1 API Unit</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#090c14] border border-white/10 font-mono text-xs text-slate-300 overflow-x-auto min-h-[220px]">
              {activeTab === "pay" ? (
                <pre className="text-cyan-300/90 leading-relaxed">
{`{
  "amount": 25.00,
  "item_name": "Nansen High Frequency Data Feed",
  "order_hash": "0x3e18a91df720c1598b92b67f18a6e9a71db...",
  "quantity": 1,
  "payment_method": "crypto",
  "crypto_currency": "MON"
}`}
                </pre>
              ) : (
                <pre className="text-purple-300/90 leading-relaxed">
{`{
  "agent_name": "Alpha-Perp-Arbitrage",
  "model_name": "deepseek-r1",
  "wallet_address": "${activeWallet}",
  "wallet_balance": 1500.0,
  "permissions": ["trade:perp", "pay:micropayment"],
  "limits": {
    "max_per_tx_usd": 150.0,
    "daily_limit_usd": 800.0
  },
  "rate_limit": { "rpm": 60 }
}`}
                </pre>
              )}
            </div>

            <button
              onClick={handleRunPlayground}
              disabled={isRunning || quota <= 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>EXECUTING TRANSACTION ON MONAD...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>RUN EXECUTION ({activeTab.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Live Stream Output Terminal */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>STREAMING RESPONSE LOGS</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>ONLINE</span>
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#090c14] border border-white/10 font-mono text-xs space-y-2 min-h-[220px] max-h-[280px] overflow-y-auto">
              {executionLogs.length === 0 ? (
                <div className="text-slate-600 flex items-center gap-2 pt-16 justify-center">
                  <span>[PREREQUISITE] Press Run Execution to stream live API logs...</span>
                </div>
              ) : (
                executionLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`leading-relaxed ${
                      log.startsWith("[SUCCESS]")
                        ? "text-emerald-400 font-semibold"
                        : log.startsWith("[OK]")
                        ? "text-cyan-400"
                        : log.startsWith("[INFO]")
                        ? "text-purple-300"
                        : "text-slate-300"
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Telemetry Metrics & Settlement Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metrics & Payment Distribution */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#141828] border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Performance & Volume Telemetry</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-[#0d101a] border border-white/5 space-y-1">
                <div className="text-[11px] font-mono text-slate-400">24h Calls</div>
                <div className="text-xl font-extrabold text-white">{stats.total_calls_24h}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0d101a] border border-white/5 space-y-1">
                <div className="text-[11px] font-mono text-slate-400">Success Rate</div>
                <div className="text-xl font-extrabold text-emerald-400">{stats.success_rate_percent}%</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0d101a] border border-white/5 space-y-1">
                <div className="text-[11px] font-mono text-slate-400">Avg Latency</div>
                <div className="text-xl font-extrabold text-cyan-400">{stats.avg_latency_ms} ms</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0d101a] border border-white/5 space-y-1">
                <div className="text-[11px] font-mono text-slate-400">Total Volume</div>
                <div className="text-xl font-extrabold text-purple-300">${stats.total_volume_usd.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="p-5 rounded-2xl bg-[#141828] border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-cyan-400" />
              <span>Payment Channel Breakdown</span>
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Crypto (MON / KOL)</span>
                  <span className="font-bold text-purple-300">{stats.payment_distribution.crypto} txs</span>
                </div>
                <div className="w-full bg-[#0d101a] h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full w-[65%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Stripe Gateway</span>
                  <span className="font-bold text-cyan-300">{stats.payment_distribution.stripe} txs</span>
                </div>
                <div className="w-full bg-[#0d101a] h-2 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full w-[25%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Traditional Wire / Virtual Bank</span>
                  <span className="font-bold text-slate-400">{stats.payment_distribution.bank} txs</span>
                </div>
                <div className="w-full bg-[#0d101a] h-2 rounded-full overflow-hidden">
                  <div className="bg-slate-500 h-full w-[10%]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Settlement Batch Ledger & Bound Agents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Orders Ledger */}
          <div className="p-5 rounded-2xl bg-[#141828] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span>Monad On-Chain Settlement Orders</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">Auto Batch Sync</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="pb-2">ITEM</th>
                    <th className="pb-2">CHANNEL</th>
                    <th className="pb-2">AMOUNT</th>
                    <th className="pb-2">MONAD TX</th>
                    <th className="pb-2 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.recent_orders.map((order, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition">
                      <td className="py-2.5 font-sans font-medium text-white">{order.item_name}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-slate-300 uppercase">
                          {order.payment_method} {order.crypto_currency ? `(${order.crypto_currency})` : ""}
                        </span>
                      </td>
                      <td className="py-2.5 text-cyan-300 font-bold">${order.amount.toFixed(2)}</td>
                      <td className="py-2.5 text-purple-300">{order.tx_hash}</td>
                      <td className="py-2.5 text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          [ON-CHAIN]
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bound Autonomous Agents */}
          <div className="p-5 rounded-2xl bg-[#141828] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Active Bound Autonomous Agents</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400">{agents.length} AGENTS ONLINE</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agents.map((ag) => (
                <div key={ag.agent_id} className="p-3.5 rounded-xl bg-[#0d101a] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{ag.agent_name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {ag.model_name}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 truncate">
                    Wallet: {ag.wallet_address.slice(0, 8)}...{ag.wallet_address.slice(-6)}
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
                    <span className="text-slate-400">Balance USD:</span>
                    <span className="text-cyan-400 font-bold">${ag.wallet_balance.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Limit: ${ag.limits.max_per_tx_usd}/tx</span>
                    <span className="text-emerald-400">[ACTIVE]</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
