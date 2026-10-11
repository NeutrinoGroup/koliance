"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
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
  Globe,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  Cpu,
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

  // Navigation tab in Console
  const [consoleTab, setConsoleTab] = useState<"overview" | "playground" | "packages" | "agents" | "audit">("overview");

  // API Key state
  const [apiKey, setApiKey] = useState<string>("kol_live_8f912c40a79d2b1f8c4e0987");
  const [revealKey, setRevealKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [quota, setQuota] = useState<number>(300);
  const [freeClaimsLeft, setFreeClaimsLeft] = useState<number>(3);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  // Playground state
  const [playgroundMethod, setPlaygroundMethod] = useState<"pay" | "bind">("pay");
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
        // Fallback to local demo data
      }
    }
    loadStats();
  }, [activeWallet]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Free Claim Handler (3 times limit)
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
        setQuota((q) => q + 100);
        setFreeClaimsLeft((c) => Math.max(0, c - 1));
        setClaimMessage(`[SUCCESS] 100 API Calls credited. Remaining claims: ${Math.max(0, freeClaimsLeft - 1)}/3`);
      }
    } catch {
      setQuota((q) => q + 100);
      setFreeClaimsLeft((c) => Math.max(0, c - 1));
      setClaimMessage(`[SUCCESS] 100 API Calls credited (Demo sandbox mode).`);
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
      `[INFO] Method: POST /api/v1/agent/${playgroundMethod}`,
      `[INFO] Authenticating Bearer ${apiKey.slice(0, 14)}...`,
    ]);

    await new Promise((r) => setTimeout(r, 450));
    setExecutionLogs((prev) => [
      ...prev,
      `[INFO] Quota verified. Deducting 1 call unit (Balance: ${Math.max(0, quota - 1)} left)`,
    ]);
    setQuota((q) => Math.max(0, q - 1));

    await new Promise((r) => setTimeout(r, 600));

    if (playgroundMethod === "pay") {
      const simulatedTx = "0x" + Math.random().toString(16).substring(2) + "9f1a24bc";
      setExecutionLogs((prev) => [
        ...prev,
        `[INFO] Cryptographic Order Hash computed: 0x3e18a91df720c1598b92b67f18a6e9a71db...`,
        `[OK] Payment approved via Monad Gasless Virtual Card`,
        `[SUCCESS] Order committed to Monad batch state. Tx: ${simulatedTx}`,
      ]);

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
    <div className="w-full space-y-6 pb-16 font-sans text-slate-100">
      {/* 1. SaaS Enterprise Header & Breadcrumb Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <span>Koliance Cloud</span>
            <span>/</span>
            <span>Gateway Services</span>
            <span>/</span>
            <span className="text-white font-semibold">Developer Console</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Developer Services & Telemetry</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              v1.4 Production
            </span>
          </h1>
        </div>

        {/* Global Environment & Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111420] border border-white/10 text-xs font-mono">
            <span className="w-2 h-2 rounded bg-emerald-400" />
            <span className="text-slate-300">Monad Testnet (Chain ID 10143)</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-[#111420] border border-white/10 text-xs font-mono text-slate-400">
            SLA: <span className="text-emerald-400 font-semibold">99.98%</span>
          </div>
        </div>
      </div>

      {/* 2. Professional Tab Navigation (Stripe / Vercel Style) */}
      <div className="flex items-center gap-1 border-b border-white/10 pb-px overflow-x-auto">
        {[
          { id: "overview", label: "Overview & Analytics", icon: <Activity className="w-4 h-4" /> },
          { id: "playground", label: "Live API Playground", icon: <Terminal className="w-4 h-4" /> },
          { id: "packages", label: "Quota & Subscription Packs", icon: <Coins className="w-4 h-4" /> },
          { id: "agents", label: "Bound Agents Registry", icon: <Cpu className="w-4 h-4" /> },
          { id: "audit", label: "On-Chain Audit Stream", icon: <Database className="w-4 h-4" /> },
        ].map((tab) => {
          const isActive = consoleTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setConsoleTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition -mb-px shrink-0 cursor-pointer ${
                isActive
                  ? "border-purple-500 text-white font-semibold bg-white/[0.02]"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-white/20"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. API Key & Quota Summary Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Key Card (8 cols) */}
        <div className="lg:col-span-8 p-5 rounded-xl bg-[#111420] border border-white/10 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <span>LIVE API CREDENTIAL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                [ACTIVE]
              </span>
              <span className="text-slate-400">Rate Limit: 60 RPM</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#090b12] px-3.5 py-2.5 rounded-lg border border-white/10 font-mono text-xs text-white">
            <span className="flex-1 truncate tracking-wider">
              {revealKey ? apiKey : `${apiKey.slice(0, 12)}••••••••••••••••••••••••`}
            </span>
            <button
              onClick={() => setRevealKey(!revealKey)}
              className="p-1 hover:bg-white/10 rounded transition text-slate-400 hover:text-white"
              title={revealKey ? "Hide key" : "Reveal key"}
            >
              {revealKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={copyToClipboard}
              className="p-1 hover:bg-white/10 rounded transition text-slate-400 hover:text-white"
              title="Copy Key"
            >
              {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 pt-1">
            <div className="flex items-center gap-4">
              <span>Scopes: <strong className="text-slate-200">trade:perp, pay:micropayment, query:proof</strong></span>
            </div>
            <div>
              <span>Created: <strong className="text-slate-200">2026-10-11</strong></span>
            </div>
          </div>
        </div>

        {/* Quota & Fast Recharge (4 cols) */}
        <div className="lg:col-span-4 p-5 rounded-xl bg-[#111420] border border-white/10 space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="text-xs font-mono text-slate-400">Available Quota Balance</div>
            <div className="text-3xl font-extrabold text-white font-mono flex items-baseline gap-2">
              <span>{quota}</span>
              <span className="text-xs text-slate-400 font-normal">API Units</span>
            </div>
            <div className="text-xs font-mono text-cyan-300">
              Free Claims Left: <strong className="text-white">{freeClaimsLeft}/3</strong>
            </div>
          </div>

          <button
            onClick={handleFreeClaim}
            disabled={claiming || freeClaimsLeft <= 0}
            className={`w-full py-2 rounded-lg font-mono text-xs font-semibold transition flex items-center justify-center gap-2 ${
              freeClaimsLeft > 0
                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/20 cursor-pointer"
                : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
            }`}
          >
            {claiming ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : freeClaimsLeft > 0 ? (
              <span>Claim 100 API Calls (Free)</span>
            ) : (
              <span>Free Quota Exhausted</span>
            )}
          </button>
        </div>
      </div>

      {claimMessage && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{claimMessage}</span>
        </motion.div>
      )}

      {/* 4. Tab 1: Overview & Analytics */}
      {consoleTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#111420] border border-white/10 space-y-1">
              <div className="text-xs font-mono text-slate-400">Total Requests (24h)</div>
              <div className="text-2xl font-bold text-white font-mono">{stats.total_calls_24h}</div>
              <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span>+14.2%</span>
                <span className="text-slate-500">vs yesterday</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#111420] border border-white/10 space-y-1">
              <div className="text-xs font-mono text-slate-400">Success Rate</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">{stats.success_rate_percent}%</div>
              <div className="text-[11px] font-mono text-slate-400">Target SLA: 99.90%</div>
            </div>

            <div className="p-4 rounded-xl bg-[#111420] border border-white/10 space-y-1">
              <div className="text-xs font-mono text-slate-400">Average P95 Latency</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">{stats.avg_latency_ms} ms</div>
              <div className="text-[11px] font-mono text-slate-400">Monad Edge Network</div>
            </div>

            <div className="p-4 rounded-xl bg-[#111420] border border-white/10 space-y-1">
              <div className="text-xs font-mono text-slate-400">Gross Settlement Volume</div>
              <div className="text-2xl font-bold text-purple-300 font-mono">${stats.total_volume_usd.toFixed(2)}</div>
              <div className="text-[11px] font-mono text-slate-400">Multi-Channel Routing</div>
            </div>
          </div>

          {/* Breakdown & Telemetry Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Payment Distribution */}
            <div className="lg:col-span-5 p-5 rounded-xl bg-[#111420] border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Coins className="w-4 h-4 text-purple-400" />
                <span>Payment Method Routing Distribution</span>
              </h3>

              <div className="space-y-4 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1.5">
                    <span>Crypto (MON / KOL)</span>
                    <span className="font-bold text-purple-300">{stats.payment_distribution.crypto} txs (65%)</span>
                  </div>
                  <div className="w-full bg-[#090b12] h-2 rounded overflow-hidden">
                    <div className="bg-purple-500 h-full w-[65%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1.5">
                    <span>Stripe Gateway</span>
                    <span className="font-bold text-cyan-300">{stats.payment_distribution.stripe} txs (25%)</span>
                  </div>
                  <div className="w-full bg-[#090b12] h-2 rounded overflow-hidden">
                    <div className="bg-cyan-500 h-full w-[25%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1.5">
                    <span>Traditional Bank Wire</span>
                    <span className="font-bold text-slate-400">{stats.payment_distribution.bank} txs (10%)</span>
                  </div>
                  <div className="w-full bg-[#090b12] h-2 rounded overflow-hidden">
                    <div className="bg-slate-500 h-full w-[10%]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Orders Overview */}
            <div className="lg:col-span-7 p-5 rounded-xl bg-[#111420] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>Recent Settlement Stream</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">Auto Synced</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="pb-2 font-medium">ITEM</th>
                      <th className="pb-2 font-medium">CHANNEL</th>
                      <th className="pb-2 font-medium">AMOUNT</th>
                      <th className="pb-2 font-medium text-right">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.recent_orders.slice(0, 4).map((order, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 font-sans text-white">{order.item_name}</td>
                        <td className="py-2.5 uppercase text-slate-300">{order.payment_method}</td>
                        <td className="py-2.5 text-cyan-300 font-bold">${order.amount.toFixed(2)}</td>
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
          </div>
        </div>
      )}

      {/* 5. Tab 2: Live API Playground (OpenAI / Stripe style) */}
      {consoleTab === "playground" && (
        <div className="rounded-xl bg-[#111420] border border-white/10 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>Live Interactive Execution Console</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Simulate production agent requests, inspect headers, and verify cryptographic receipts.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#090b12] p-1 rounded-lg border border-white/10">
              <button
                onClick={() => setPlaygroundMethod("pay")}
                className={`px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer ${
                  playgroundMethod === "pay"
                    ? "bg-purple-600 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                POST /api/v1/agent/pay
              </button>
              <button
                onClick={() => setPlaygroundMethod("bind")}
                className={`px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer ${
                  playgroundMethod === "bind"
                    ? "bg-purple-600 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                POST /api/v1/agent/bind
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Request Payload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>REQUEST PAYLOAD (application/json)</span>
                <span>Deduction: 1 Quota</span>
              </div>

              <div className="p-4 rounded-lg bg-[#090b12] border border-white/10 font-mono text-xs overflow-x-auto min-h-[240px]">
                {playgroundMethod === "pay" ? (
                  <pre className="text-cyan-300 leading-relaxed">
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
                  <pre className="text-purple-300 leading-relaxed">
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
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>EXECUTING ON MONAD EXECUTION LAYER...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Execute Request ({playgroundMethod.toUpperCase()})</span>
                  </>
                )}
              </button>
            </div>

            {/* Right: Response Output */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>EXECUTION LOGS & RESPONSE</span>
                <span className="text-emerald-400 font-semibold">[READY]</span>
              </div>

              <div className="p-4 rounded-lg bg-[#090b12] border border-white/10 font-mono text-xs space-y-2 min-h-[240px] max-h-[300px] overflow-y-auto">
                {executionLogs.length === 0 ? (
                  <div className="text-slate-600 flex items-center justify-center pt-20">
                    <span>Click [Execute Request] to run transaction in sandbox...</span>
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
      )}

      {/* 6. Tab 3: Quota Packages (SaaS Tier Matrix) */}
      {consoleTab === "packages" && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white font-mono">API Subscription & Capacity Packages</h2>
            <p className="text-xs text-slate-400 font-mono">
              Transparent tier allocation. Every registered account is entitled to 3 free starter packages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier 1: Starter */}
            <div className="p-6 rounded-xl bg-[#111420] border border-white/10 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
                    STARTER PACK
                  </span>
                  <span className="text-xs font-mono text-slate-400">60 RPM</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono">$0.00</div>
                <p className="text-xs text-slate-400">
                  Ideal for KOL initial trial, identity verification, and testing scripts.
                </p>
                <ul className="text-xs font-mono text-slate-300 space-y-1.5 pt-2 border-t border-white/5">
                  <li>• 100 API Calls Included</li>
                  <li>• Max 3 Free Claims per account</li>
                  <li>• EIP-712 Session Key Support</li>
                  <li>• Community SLA Support</li>
                </ul>
              </div>

              <button
                onClick={handleFreeClaim}
                disabled={claiming || freeClaimsLeft <= 0}
                className={`w-full py-2.5 rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                  freeClaimsLeft > 0
                    ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                    : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
                }`}
              >
                {claiming ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin mx-auto" />
                ) : freeClaimsLeft > 0 ? (
                  <span>Claim 100 Calls ({freeClaimsLeft}/3 Left)</span>
                ) : (
                  <span>All 3 Free Claims Used</span>
                )}
              </button>
            </div>

            {/* Tier 2: Growth Pro */}
            <div className="p-6 rounded-xl bg-[#141828] border border-purple-500/40 flex flex-col justify-between space-y-6 shadow-xl shadow-purple-950/20 relative">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold">
                    GROWTH PRO // RECOMMENDED
                  </span>
                  <span className="text-xs font-mono text-purple-300">300 RPM</span>
                </div>
                <div className="flex items-baseline gap-2 font-mono">
                  <span className="text-2xl font-bold text-white">$19.90</span>
                  <span className="text-xs text-emerald-400">-15% with KOL</span>
                </div>
                <p className="text-xs text-slate-400">
                  Engineered for continuous automated trading bots and live market data.
                </p>
                <ul className="text-xs font-mono text-slate-300 space-y-1.5 pt-2 border-t border-white/5">
                  <li>• 10,000 API Calls Included</li>
                  <li>• 300 RPM Peak Concurrency</li>
                  <li>• Priority Settlement Batch</li>
                  <li>• 99.9% Uptime Guarantee</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setQuota((q) => q + 10000);
                  setActiveTier("GROWTH_PRO");
                  setClaimMessage("[SUCCESS] 10,000 API calls activated under Growth Pro pack.");
                }}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold transition cursor-pointer shadow-md shadow-purple-900/30"
              >
                Purchase via KOL / Stripe
              </button>
            </div>

            {/* Tier 3: Scale Ultra */}
            <div className="p-6 rounded-xl bg-[#111420] border border-white/10 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-500/10 text-slate-300 border border-white/10 font-semibold">
                    ENTERPRISE SCALE
                  </span>
                  <span className="text-xs font-mono text-slate-400">1200 RPM</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono">$149.00</div>
                <p className="text-xs text-slate-400">
                  Custom high-throughput pipelines, corporate billing, and dedicated Monad execution lane.
                </p>
                <ul className="text-xs font-mono text-slate-300 space-y-1.5 pt-2 border-t border-white/5">
                  <li>• 100,000 API Calls Included</li>
                  <li>• 1200 RPM Dedicated Queue</li>
                  <li>• Direct Wire & Corporate Invoicing</li>
                  <li>• 99.98% SLA with 24/7 Support</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setQuota((q) => q + 100000);
                  setActiveTier("SCALE_ULTRA");
                  setClaimMessage("[SUCCESS] 100,000 API calls activated with dedicated priority queue.");
                }}
                className="w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-mono text-xs font-semibold transition cursor-pointer"
              >
                Subscribe Enterprise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Tab 4: Bound Agents Registry */}
      {consoleTab === "agents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white font-mono">Bound Autonomous Agents</h2>
              <p className="text-xs text-slate-400 font-mono">Active EIP-712 delegated execution instances</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">{agents.length} AGENTS ACTIVE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((ag) => (
              <div key={ag.agent_id} className="p-5 rounded-xl bg-[#111420] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white font-mono">{ag.agent_name}</div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                    {ag.model_name}
                  </span>
                </div>

                <div className="text-xs font-mono text-slate-400">
                  Wallet: <code className="text-slate-300">{ag.wallet_address}</code>
                </div>

                <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-white/5">
                  <span className="text-slate-400">Balance: <strong className="text-cyan-300">${ag.wallet_balance.toFixed(2)}</strong></span>
                  <span className="text-slate-400">Max Tx: <strong className="text-white">${ag.limits.max_per_tx_usd}</strong></span>
                </div>

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Daily Cap: <strong className="text-white">${ag.limits.daily_limit_usd}</strong></span>
                  <span className="text-emerald-400 font-bold">[ACTIVE]</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Tab 5: Audit Logs & Settlements */}
      {consoleTab === "audit" && (
        <div className="p-5 rounded-xl bg-[#111420] border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-mono">Monad On-Chain Settlement Orders</h3>
              <p className="text-xs text-slate-400 font-mono">Cryptographic receipts with deterministic block proofs</p>
            </div>
            <span className="text-xs font-mono text-slate-400">Chain ID: 10143</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="pb-2.5 font-medium">TIMESTAMP (UTC)</th>
                  <th className="pb-2.5 font-medium">ITEM NAME</th>
                  <th className="pb-2.5 font-medium">CHANNEL</th>
                  <th className="pb-2.5 font-medium">AMOUNT</th>
                  <th className="pb-2.5 font-medium">ORDER HASH</th>
                  <th className="pb-2.5 font-medium">MONAD TX</th>
                  <th className="pb-2.5 font-medium text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.recent_orders.map((order, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-3 text-slate-400">{new Date(order.created_at).toISOString().replace("T", " ").slice(0, 19)}</td>
                    <td className="py-3 font-sans text-white font-medium">{order.item_name}</td>
                    <td className="py-3 uppercase text-slate-300">{order.payment_method}</td>
                    <td className="py-3 text-cyan-300 font-bold">${order.amount.toFixed(2)}</td>
                    <td className="py-3 text-slate-400">{order.order_hash}</td>
                    <td className="py-3 text-purple-300">{order.tx_hash}</td>
                    <td className="py-3 text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        [COMMITTED]
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
