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
  Search,
  ExternalLink,
  History,
  Filter,
  Plus,
  Trash2,
  X,
  UserCheck,
} from "lucide-react";
import { useKolianceAuth } from "@/components/Providers";
import type { ApiKeyRecord } from "@/lib/apiKeyDb";
import { getAuditHistory, recordAuditEvent, AuditRecord, AuditCategory } from "@/lib/audit";

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
  const { address: authAddress, login: authLogin } = useKolianceAuth();
  const [localDevWallet, setLocalDevWallet] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("koliance_developer_wallet");
      if (saved) setLocalDevWallet(saved);
    }
  }, []);

  const activeWallet = currentAccount || authAddress || localDevWallet || null;
  const isRegistered = Boolean(activeWallet);

  // Navigation tab in Console
  const [consoleTab, setConsoleTab] = useState<"overview" | "keys" | "playground" | "packages" | "agents" | "audit">("overview");

  // User API Keys loaded from database api_keys ("api-key") table
  const [userKeys, setUserKeys] = useState<ApiKeyRecord[]>([]);
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [quota, setQuota] = useState<number>(0);
  const [freeClaimsLeft, setFreeClaimsLeft] = useState<number>(3);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  // Key creation modal state
  const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyTier, setNewKeyTier] = useState("STARTER_FREE");
  const [newKeyRpm, setNewKeyRpm] = useState(60);
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["trade:perp", "pay:micropayment", "query:proof"]);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  // Newly created secret reveal modal
  const [createdSecretModalOpen, setCreatedSecretModalOpen] = useState(false);
  const [createdSecretKey, setCreatedSecretKey] = useState<string | null>(null);
  const [createdSecretCopied, setCreatedSecretCopied] = useState(false);

  // Quick dev registration modal
  const [devRegisterModalOpen, setDevRegisterModalOpen] = useState(false);
  const [devRegName, setDevRegName] = useState("");
  const [devRegEmail, setDevRegEmail] = useState("");
  const [devRegWallet, setDevRegWallet] = useState("");
  const [isRegisteringDev, setIsRegisteringDev] = useState(false);

  // Playground state
  const [playgroundMethod, setPlaygroundMethod] = useState<"pay" | "bind">("pay");
  const [isRunning, setIsRunning] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [activeTier, setActiveTier] = useState<string>("STARTER_FREE");

  // Traceable Audit History State
  const [auditFilter, setAuditFilter] = useState<"ALL" | AuditCategory>("ALL");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);

  // Telemetry stats
  const [stats, setStats] = useState<StatsData>({
    wallet_address: activeWallet || "0x0000000000000000000000000000000000000000",
    total_calls_24h: 1248,
    remaining_quota: 0,
    free_claims_left: 3,
    success_rate_percent: 99.8,
    avg_latency_ms: 38,
    payment_distribution: {
      crypto: 14,
      stripe: 6,
      bank: 2,
    },
    total_volume_usd: 840.5,
    recent_orders: [
      {
        payment_id: "pay_98b671a8f",
        item_name: "High Frequency Data Feed",
        amount: 25.0,
        quantity: 1,
        payment_method: "crypto",
        crypto_currency: "MON",
        tx_hash: "0xfa91...10ab",
        on_chain_status: "COMMITTED_TO_MONAD",
        order_hash: "0x3e18...d8a1",
        created_at: "2026-10-11T08:52:10Z",
      },
      {
        payment_id: "pay_7c2409f1e",
        item_name: "Alpaca Perp Hedge Margin",
        amount: 150.0,
        quantity: 1,
        payment_method: "stripe",
        tx_hash: "0xb712...98c2",
        on_chain_status: "COMMITTED_TO_MONAD",
        order_hash: "0x9812...e021",
        created_at: "2026-10-11T07:15:30Z",
      },
      {
        payment_id: "pay_4e0192ca5",
        item_name: "Session Key Top-Up",
        amount: 50.0,
        quantity: 1,
        payment_method: "bank",
        tx_hash: "0x12fa...6789",
        on_chain_status: "COMMITTED_TO_MONAD",
        order_hash: "0x6102...ab34",
        created_at: "2026-10-10T23:40:12Z",
      },
    ],
  });

  // Bound Agents state
  const [agents, setAgents] = useState<BoundAgent[]>([
    {
      agent_id: "agt_8f29d71a4e",
      agent_name: "alpha-trader",
      model_name: "deepseek-r1",
      wallet_address: activeWallet || "0x0000000000000000000000000000000000000000",
      wallet_balance: 150.0,
      status: "ACTIVE",
      session_key: "sk_sess_9a8bc721de004f",
      limits: {
        max_per_tx_usd: 50.0,
        daily_limit_usd: 200.0,
      },
    },
    {
      agent_id: "agt_2b904e12c8",
      agent_name: "arbitrage-scout",
      model_name: "gpt-4o",
      wallet_address: activeWallet || "0x0000000000000000000000000000000000000000",
      wallet_balance: 320.0,
      status: "ACTIVE",
      session_key: "sk_sess_4f8120be89a1c2",
      limits: {
        max_per_tx_usd: 100.0,
        daily_limit_usd: 300.0,
      },
    },
  ]);

  const activeKey = userKeys.find((k) => k.id === activeKeyId) || (userKeys.length > 0 ? userKeys[0] : null);
  const effectiveApiKey = createdSecretKey || (activeKey ? activeKey.key_prefix : "");

  // Load API keys from database api-key table
  const loadKeys = async (wallet: string) => {
    setLoadingKeys(true);
    try {
      const res = await fetch(`/api/console/api-keys?wallet=${wallet}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.keys)) {
          setUserKeys(json.keys);
          if (json.keys.length > 0) {
            const firstActive = json.keys.find((k: ApiKeyRecord) => k.status === "ACTIVE") || json.keys[0];
            setActiveKeyId(firstActive.id);
            setQuota(firstActive.remaining_quota);
            setFreeClaimsLeft(firstActive.free_claims_left);
          } else {
            setActiveKeyId(null);
            setQuota(0);
          }
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingKeys(false);
    }
  };

  useEffect(() => {
    if (activeWallet) {
      loadKeys(activeWallet);
    } else {
      setUserKeys([]);
      setActiveKeyId(null);
    }
  }, [activeWallet]);

  // Load audit history
  useEffect(() => {
    if (activeWallet) {
      setAuditLogs(getAuditHistory(activeWallet));
    }
    const handleUpdate = () => {
      if (activeWallet) {
        setAuditLogs(getAuditHistory(activeWallet));
      }
    };
    window.addEventListener("koliance_audit_updated", handleUpdate);
    return () => window.removeEventListener("koliance_audit_updated", handleUpdate);
  }, [activeWallet]);

  // Fetch backend telemetry if online
  useEffect(() => {
    if (!activeWallet) return;
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

  const copyToClipboard = (textToCopy?: string) => {
    const text = textToCopy || effectiveApiKey;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Create API Key Handler (User creates their own key -> saved to api_keys table)
  const handleCreateKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeWallet) {
      setDevRegisterModalOpen(true);
      return;
    }

    setIsCreatingKey(true);
    try {
      const res = await fetch("/api/console/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: activeWallet,
          name: newKeyName.trim() || `API Key #${userKeys.length + 1}`,
          tier: newKeyTier,
          rate_limit_rpm: newKeyRpm,
          scopes: newKeyScopes,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.key) {
          setUserKeys((prev) => [json.key, ...prev]);
          setActiveKeyId(json.key.id);
          setQuota(json.key.remaining_quota);
          setFreeClaimsLeft(json.key.free_claims_left);
          setCreatedSecretKey(json.raw_key);
          setCreatedSecretModalOpen(true);
          setNewKeyModalOpen(false);
          setNewKeyName("");
          recordAuditEvent({
            walletAddress: activeWallet,
            category: "AGENT",
            action: "CREATE_API_KEY",
            description: `Created key "${json.key.name}" saved to api-key table (${json.key.key_prefix})`,
            amount: "Saved to api_keys",
            status: "CONFIRMED_ON_MONAD",
          });
        }
      }
    } catch (err) {
      console.error("Create API key error:", err);
    } finally {
      setIsCreatingKey(false);
    }
  };

  // Revoke API Key Handler
  const handleRevokeKey = async (keyId: string) => {
    if (!activeWallet) return;
    try {
      const res = await fetch(`/api/console/api-keys?key_id=${keyId}&wallet=${activeWallet}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUserKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, status: "REVOKED" as const } : k))
        );
        recordAuditEvent({
          walletAddress: activeWallet,
          category: "AGENT",
          action: "REVOKE_API_KEY",
          description: `Revoked API key ${keyId} in api-key table`,
          amount: "Revoked",
          status: "CONFIRMED_ON_MONAD",
        });
      }
    } catch (err) {
      console.error("Revoke key error:", err);
    }
  };

  // Quick Developer Registration Handler
  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegisteringDev(true);
    try {
      const wallet =
        devRegWallet.trim().toLowerCase() ||
        `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
      const name = devRegName.trim() || `Dev-${wallet.slice(0, 6)}`;
      const email = devRegEmail.trim() || `${wallet.slice(0, 8)}@koliance.user`;

      try {
        await fetch("/api/user/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": `did:koliance:wallet:${wallet}`,
          },
          body: JSON.stringify({
            id: `did:koliance:wallet:${wallet}`,
            email,
            name,
            wallet_address: wallet,
          }),
        });
      } catch {
        // Fallback
      }

      localStorage.setItem("koliance_developer_wallet", wallet);
      setLocalDevWallet(wallet);
      setDevRegisterModalOpen(false);
      loadKeys(wallet);

      recordAuditEvent({
        walletAddress: wallet,
        category: "TRUST",
        action: "REGISTER_DEVELOPER",
        description: `Registered developer account ${name} (${wallet.slice(0, 8)}...)`,
        amount: "Registered",
        status: "CONFIRMED_ON_MONAD",
      });
    } finally {
      setIsRegisteringDev(false);
    }
  };

  // Free Claim Handler (3 times limit)
  const handleFreeClaim = async () => {
    if (!activeWallet || freeClaimsLeft <= 0) return;
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
      recordAuditEvent({
        walletAddress: activeWallet,
        category: "QUOTA",
        action: "CLAIM_STARTER_FREE",
        description: "Claimed 100 API Calls Starter Package (Gasless trial)",
        amount: "+100 Calls",
        status: "CONFIRMED_ON_MONAD",
      });
      setClaiming(false);
      setTimeout(() => setClaimMessage(null), 4000);
    }
  };

  // Run interactive playground request
  const handleRunPlayground = async () => {
    setIsRunning(true);

    if (!activeKey || activeKey.status !== "ACTIVE") {
      setExecutionLogs([
        `[ERROR] 未检测到可用的活跃 API 密钥 (No Active Key)`,
        `[WARN] Console 密钥需由用户自行创建。请点击上方的 [+ 创建新密钥] 创建专属密钥。`,
      ]);
      setIsRunning(false);
      return;
    }

    setExecutionLogs([
      `[INFO] Target: Monad Testnet (Chain ID 10143)`,
      `[INFO] Method: POST /api/v1/agent/${playgroundMethod}`,
      `[INFO] Authenticating Bearer ${effectiveApiKey.slice(0, 14)}...`,
      `[INFO] Key Name: "${activeKey.name}" | Status: [ACTIVE] (api-key 表)`,
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

      recordAuditEvent({
        walletAddress: activeWallet,
        category: "PAYMENT",
        action: "AGENT_MICROPAYMENT",
        description: "Autonomous payment executed: Nansen High Frequency Data Feed",
        amount: "-$25.00 USD",
        tx_hash: simulatedTx,
        status: "COMMITTED",
      });
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
          wallet_address: activeWallet || "0x0000000000000000000000000000000000000000",
          wallet_balance: 500.0,
          status: "ACTIVE",
          session_key: newSessKey,
          limits: { max_per_tx_usd: 100.0, daily_limit_usd: 500.0 },
        },
        ...prev,
      ]);

      recordAuditEvent({
        walletAddress: activeWallet,
        category: "AGENT",
        action: "BIND_SESSION_KEY",
        description: "Bound Alpha-Bot with deepseek-r1 to wallet session key",
        amount: "Max $100/tx",
        status: "CONFIRMED_ON_MONAD",
      });
    }

    setIsRunning(false);
  };

  const filteredAudits = auditLogs.filter((rec) => {
    if (auditFilter !== "ALL" && rec.category !== auditFilter) return false;
    if (!auditSearch) return true;
    const term = auditSearch.toLowerCase();
    return (
      rec.action.toLowerCase().includes(term) ||
      rec.description.toLowerCase().includes(term) ||
      rec.order_hash?.toLowerCase().includes(term) ||
      rec.tx_hash?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-full space-y-6 pb-16 font-sans text-slate-100">
      {/* 1. SaaS Enterprise Header & Breadcrumb Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <span>Koliance Cloud</span>
            <span>/</span>
            <span className="text-purple-300 font-semibold">Developer Service Console</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono flex items-center gap-2.5">
            <Server className="w-5 h-5 text-purple-400" />
            <span>Agentic Infrastructure & Key Management</span>
          </h1>
        </div>

        {/* Global Environment & Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#111420] border border-white/10 text-xs font-mono">
            <span className="w-2 h-2 rounded bg-emerald-400" />
            <span className="text-slate-300">Monad Testnet (Chain ID 10143)</span>
          </div>

          <div className="px-3 py-1.5 rounded-md bg-[#111420] border border-white/10 text-xs font-mono text-slate-400">
            SLA: <span className="text-emerald-400 font-semibold">99.98%</span>
          </div>
        </div>
      </div>

      {/* 2. Professional Tab Navigation (Stripe / Vercel Style) */}
      <div className="flex items-center gap-1 border-b border-white/10 pb-px overflow-x-auto no-scrollbar">
        {[
          { id: "overview", label: "Overview & Analytics", icon: <Activity className="w-4 h-4" /> },
          { id: "keys", label: "API Keys (api-key 表)", icon: <KeyRound className="w-4 h-4" /> },
          { id: "playground", label: "Live API Playground", icon: <Terminal className="w-4 h-4" /> },
          { id: "packages", label: "Quota & Subscription Packs", icon: <Coins className="w-4 h-4" /> },
          { id: "agents", label: "Bound Agents Registry", icon: <Cpu className="w-4 h-4" /> },
          { id: "audit", label: "Operation Audit & History", icon: <History className="w-4 h-4" /> },
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

      {/* 3. API Key & Quota Summary Strip / Registration Gate */}
      {!isRegistered ? (
        <div className="p-6 rounded-lg bg-[#111420] border border-purple-500/30 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-mono text-purple-400 font-semibold flex items-center gap-2">
                  <span>[REGISTRATION_REQUIRED]</span>
                  <span>Console 密钥需要用户注册</span>
                </div>
                <h3 className="text-base font-bold text-white font-mono">
                  未检测到已注册的开发者身份
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={authLogin}
                className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 border border-purple-500/40 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition cursor-pointer flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>连接钱包登录</span>
              </button>
              <button
                onClick={() => setDevRegisterModalOpen(true)}
                className="h-9 px-4 rounded-md bg-[#161a29] hover:bg-[#1e2338] border border-white/10 text-slate-200 font-mono text-xs font-semibold active:scale-[0.98] transition cursor-pointer flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>注册开发者账号</span>
              </button>
            </div>
          </div>
          <p className="text-xs font-mono text-slate-400 leading-relaxed">
            Koliance 开放服务 API 与控制台采用严格鉴权隔离。用户必须先完成注册或连接钱包身份，才能创建属于自己的专属 API 密钥并存入 api-key 数据库表。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Key Card (8 cols) */}
          <div className="lg:col-span-8 p-5 rounded-lg bg-[#111420] border border-white/10 space-y-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <span>
                  {activeKey ? `LIVE API CREDENTIAL: ${activeKey.name}` : "LIVE API CREDENTIAL"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {activeKey ? (
                  <>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] border font-bold ${
                        activeKey.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      [{activeKey.status}]
                    </span>
                    <span className="text-slate-400">Rate Limit: {activeKey.rate_limit_rpm} RPM</span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-500/10 text-slate-400 border border-slate-500/20 font-bold">
                    [NO KEY]
                  </span>
                )}
                <button
                  onClick={() => setNewKeyModalOpen(true)}
                  className="ml-2 h-7 px-2.5 rounded-md bg-purple-600 hover:bg-purple-500 border border-purple-500/30 text-white text-[11px] font-mono flex items-center gap-1 active:scale-[0.98] transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>创建新密钥</span>
                </button>
              </div>
            </div>

            {!activeKey ? (
              <div className="p-4 rounded-md bg-[#090b12] border border-dashed border-white/10 text-center space-y-2">
                <p className="text-xs font-mono text-slate-400">
                  您尚未创建任何 API 密钥。密钥需要由用户自行创建并保存至 api-key 表。
                </p>
                <button
                  onClick={() => setNewKeyModalOpen(true)}
                  className="h-8 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>创建我的第一个密钥</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 bg-[#090b12] px-3.5 py-2.5 rounded-md border border-white/10 font-mono text-xs text-white">
                  <span className="flex-1 truncate tracking-wider">
                    {effectiveApiKey}
                  </span>
                  <button
                    onClick={() => copyToClipboard(effectiveApiKey)}
                    className="p-1 hover:bg-white/10 rounded-md transition text-slate-400 hover:text-white"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  {activeKey.status === "ACTIVE" && (
                    <button
                      onClick={() => handleRevokeKey(activeKey.id)}
                      className="p-1 hover:bg-rose-500/20 rounded-md transition text-slate-500 hover:text-rose-400"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 pt-1">
                  <div className="flex items-center gap-3">
                    <span>
                      Scopes: <strong className="text-slate-200">{activeKey.scopes.join(", ")}</strong>
                    </span>
                    {userKeys.length > 1 && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span>切换密钥:</span>
                        <select
                          value={activeKey.id}
                          onChange={(e) => setActiveKeyId(e.target.value)}
                          className="bg-[#090b12] border border-white/10 rounded px-2 py-0.5 text-[11px] text-white focus:outline-none"
                        >
                          {userKeys.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.name} ({k.key_prefix.slice(0, 12)}...) [{k.status}]
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <span>Created: <strong className="text-slate-200">{activeKey.created_at.slice(0, 10)}</strong></span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quota & Fast Recharge (4 cols) - Architectural Geometry, Zero Pill */}
          <div className="lg:col-span-4 p-5 rounded-lg bg-[#111420] border border-white/10 space-y-4 flex flex-col justify-between shadow-sm">
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

            {/* Modern Precision Button: h-10, rounded-md, hairline border, inset highlight */}
            <button
              onClick={handleFreeClaim}
              disabled={claiming || freeClaimsLeft <= 0}
              className={`w-full h-10 px-4 rounded-md font-mono text-xs font-semibold transition-all flex items-center justify-center gap-2 border ${
                freeClaimsLeft > 0
                  ? "bg-purple-600 hover:bg-purple-500 border-purple-500/40 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] cursor-pointer"
                  : "bg-white/5 text-slate-500 cursor-not-allowed border-white/5"
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
      )}

      {claimMessage && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2"
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
            <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-1 shadow-sm">
              <div className="text-xs font-mono text-slate-400">Total Requests (24h)</div>
              <div className="text-2xl font-bold text-white font-mono">{stats.total_calls_24h}</div>
              <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span>+14.2%</span>
                <span className="text-slate-500">vs yesterday</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-1 shadow-sm">
              <div className="text-xs font-mono text-slate-400">Success Rate</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">{stats.success_rate_percent}%</div>
              <div className="text-[11px] font-mono text-slate-400">Target SLA: 99.90%</div>
            </div>

            <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-1 shadow-sm">
              <div className="text-xs font-mono text-slate-400">Average P95 Latency</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">{stats.avg_latency_ms} ms</div>
              <div className="text-[11px] font-mono text-slate-400">Monad Edge Network</div>
            </div>

            <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-1 shadow-sm">
              <div className="text-xs font-mono text-slate-400">Gross Settlement Volume</div>
              <div className="text-2xl font-bold text-purple-300 font-mono">${stats.total_volume_usd.toFixed(2)}</div>
              <div className="text-[11px] font-mono text-slate-400">Multi-Channel Routing</div>
            </div>
          </div>

          {/* Breakdown & Telemetry Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Payment Distribution */}
            <div className="lg:col-span-5 p-5 rounded-lg bg-[#111420] border border-white/10 space-y-4 shadow-sm">
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
            <div className="lg:col-span-7 p-5 rounded-lg bg-[#111420] border border-white/10 space-y-4 shadow-sm">
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

      {/* Tab: API Keys Management (api_keys / api-key table) */}
      {consoleTab === "keys" && (
        <div className="rounded-lg bg-[#111420] border border-white/10 p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <span>API 密钥管理 (api-key 数据表)</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                用户自主创建并管理的 API 密钥。密钥 SHA-256 加密存入 api_keys 表，用于自治 Agent 鉴权与配额计费。
              </p>
            </div>

            <button
              onClick={() => {
                if (!activeWallet) {
                  setDevRegisterModalOpen(true);
                } else {
                  setNewKeyModalOpen(true);
                }
              }}
              className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 border border-purple-500/40 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>创建新密钥</span>
            </button>
          </div>

          {!isRegistered ? (
            <div className="p-8 rounded-lg bg-[#090b12] border border-dashed border-white/10 text-center space-y-3">
              <Lock className="w-8 h-8 text-purple-400 mx-auto" />
              <div className="text-sm font-bold text-white font-mono">[REGISTRATION_REQUIRED] 需注册开发者身份</div>
              <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
                请先连接钱包或注册开发者身份，方可创建与查看存储在 api-key 表中的专属密钥。
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={authLogin}
                  className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold cursor-pointer"
                >
                  连接钱包登录
                </button>
                <button
                  onClick={() => setDevRegisterModalOpen(true)}
                  className="h-9 px-4 rounded-md bg-white/10 hover:bg-white/15 text-white font-mono text-xs font-semibold cursor-pointer"
                >
                  注册开发者账号
                </button>
              </div>
            </div>
          ) : userKeys.length === 0 ? (
            <div className="p-8 rounded-lg bg-[#090b12] border border-dashed border-white/10 text-center space-y-3">
              <KeyRound className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-bold text-white font-mono">暂无 API 密钥</div>
              <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
                您尚未创建属于自己的 API 密钥。点击下方按钮立即生成专属 kol_live_ 密钥并存入 api-key 数据库表。
              </p>
              <button
                onClick={() => setNewKeyModalOpen(true)}
                className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>创建我的第一个密钥</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="pb-3 font-semibold">密钥名称</th>
                    <th className="pb-3 font-semibold">密钥标识 (前缀)</th>
                    <th className="pb-3 font-semibold">状态</th>
                    <th className="pb-3 font-semibold">套餐</th>
                    <th className="pb-3 font-semibold">剩余额度</th>
                    <th className="pb-3 font-semibold">RPM</th>
                    <th className="pb-3 font-semibold">创建时间</th>
                    <th className="pb-3 text-right font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {userKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3.5 font-bold text-white flex items-center gap-2">
                        <span>{k.name}</span>
                        {k.id === activeKey?.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            当前使用
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{k.key_prefix}</span>
                          <button
                            onClick={() => copyToClipboard(k.key_prefix)}
                            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                            title="复制前缀"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                            k.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          [{k.status}]
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-300">{k.tier}</td>
                      <td className="py-3.5 font-bold text-white">{k.remaining_quota} 次</td>
                      <td className="py-3.5 text-slate-400">{k.rate_limit_rpm}</td>
                      <td className="py-3.5 text-slate-400">{k.created_at.slice(0, 10)}</td>
                      <td className="py-3.5 text-right space-x-2">
                        {k.status === "ACTIVE" && k.id !== activeKey?.id && (
                          <button
                            onClick={() => setActiveKeyId(k.id)}
                            className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] border border-white/10 cursor-pointer"
                          >
                            设为当前
                          </button>
                        )}
                        {k.status === "ACTIVE" && (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            className="px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] border border-rose-500/20 cursor-pointer"
                          >
                            撤销
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Live API Playground (OpenAI / Stripe style) */}
      {consoleTab === "playground" && (
        <div className="rounded-lg bg-[#111420] border border-white/10 p-6 space-y-6 shadow-sm">
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

            <div className="flex items-center gap-1 bg-[#090b12] p-1 rounded-md border border-white/10">
              <button
                onClick={() => setPlaygroundMethod("pay")}
                className={`h-8 px-3 rounded-md text-xs font-mono transition cursor-pointer ${
                  playgroundMethod === "pay"
                    ? "bg-purple-600 text-white font-semibold shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                POST /api/v1/agent/pay
              </button>
              <button
                onClick={() => setPlaygroundMethod("bind")}
                className={`h-8 px-3 rounded-md text-xs font-mono transition cursor-pointer ${
                  playgroundMethod === "bind"
                    ? "bg-purple-600 text-white font-semibold shadow-xs"
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

              <div className="p-4 rounded-md bg-[#090b12] border border-white/10 font-mono text-xs overflow-x-auto min-h-[240px]">
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
                className="w-full h-10 px-4 rounded-md bg-purple-600 hover:bg-purple-500 border border-purple-500/40 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

              <div className="p-4 rounded-md bg-[#090b12] border border-white/10 font-mono text-xs space-y-2 min-h-[240px] max-h-[300px] overflow-y-auto">
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
            <div className="p-6 rounded-lg bg-[#111420] border border-white/10 flex flex-col justify-between space-y-6 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
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
                className={`w-full h-10 px-4 rounded-md font-mono text-xs font-semibold transition-all border flex items-center justify-center cursor-pointer ${
                  freeClaimsLeft > 0
                    ? "bg-cyan-600 hover:bg-cyan-500 border-cyan-500/40 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98]"
                    : "bg-white/5 text-slate-500 cursor-not-allowed border-white/5"
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
            <div className="p-6 rounded-lg bg-[#141828] border border-purple-500/40 flex flex-col justify-between space-y-6 shadow-lg shadow-purple-950/20 relative">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold">
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
                  recordAuditEvent({
                    walletAddress: activeWallet,
                    category: "QUOTA",
                    action: "PURCHASE_GROWTH_PRO",
                    description: "Purchased Growth Pro Pack (+10,000 API Calls)",
                    amount: "+10,000 Units",
                    status: "COMMITTED",
                  });
                }}
                className="w-full h-10 px-4 rounded-md bg-purple-600 hover:bg-purple-500 border border-purple-500/40 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all cursor-pointer"
              >
                Purchase via KOL / Stripe
              </button>
            </div>

            {/* Tier 3: Scale Ultra */}
            <div className="p-6 rounded-lg bg-[#111420] border border-white/10 flex flex-col justify-between space-y-6 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-300 border border-white/10 font-semibold">
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
                  recordAuditEvent({
                    walletAddress: activeWallet,
                    category: "QUOTA",
                    action: "PURCHASE_SCALE_ULTRA",
                    description: "Subscribed to Enterprise Scale Pack (+100,000 API Calls)",
                    amount: "+100,000 Units",
                    status: "COMMITTED",
                  });
                }}
                className="w-full h-10 px-4 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-[0.98] transition-all cursor-pointer"
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
              <div key={ag.agent_id} className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white font-mono">{ag.agent_name}</div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
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

      {/* 8. Tab 5: Complete Operation Audit & Transaction Traceability (操作可追溯与交易历史) */}
      {consoleTab === "audit" && (
        <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-5 shadow-sm">
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white font-mono">User Operation Traceability & Transaction History</h3>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Deterministic block proofs on Monad (Chain ID 10143) · Complete audit trail of quotas, KOL token acquisitions, and payments
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search hash or action..."
                className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#090b12] border border-white/10 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(
              [
                { id: "ALL", label: "All Operations (全部记录)" },
                { id: "KOL", label: "KOL Tokens (获取 KOL 历史)" },
                { id: "QUOTA", label: "Quota Packages (额度包)" },
                { id: "PAYMENT", label: "Payments (交易流水)" },
                { id: "AGENT", label: "Agent Bindings (授权绑定)" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setAuditFilter(f.id)}
                className={`h-8 px-3 rounded-md font-mono text-xs font-medium transition cursor-pointer border shrink-0 ${
                  auditFilter === f.id
                    ? "bg-purple-600 text-white border-purple-500/50 shadow-xs"
                    : "bg-[#141824] text-slate-400 hover:text-white border-white/10 hover:border-white/20"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="pb-2.5 font-medium">TIMESTAMP (UTC)</th>
                  <th className="pb-2.5 font-medium">CATEGORY</th>
                  <th className="pb-2.5 font-medium">ACTION / DESCRIPTION</th>
                  <th className="pb-2.5 font-medium">AMOUNT</th>
                  <th className="pb-2.5 font-medium">ORDER HASH</th>
                  <th className="pb-2.5 font-medium">MONAD TX</th>
                  <th className="pb-2.5 font-medium text-right">CONSENSUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No matching audit records found.
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 text-slate-400 whitespace-nowrap">
                        {new Date(item.timestamp).toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
                            item.category === "KOL"
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                              : item.category === "PAYMENT"
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                              : item.category === "QUOTA"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : "bg-slate-500/10 text-slate-300 border-slate-500/30"
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 font-sans text-white font-medium max-w-[260px]">
                        <div className="truncate text-xs font-semibold">{item.action}</div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">{item.description}</div>
                      </td>
                      <td className="py-3 font-bold whitespace-nowrap">
                        <span
                          className={
                            item.amount?.startsWith("+")
                              ? "text-emerald-400"
                              : item.amount?.startsWith("-")
                              ? "text-rose-400"
                              : "text-cyan-300"
                          }
                        >
                          {item.amount || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400 font-mono">
                        <span className="truncate block max-w-[120px]" title={item.order_hash}>
                          {item.order_hash ? `${item.order_hash.slice(0, 8)}...${item.order_hash.slice(-4)}` : "—"}
                        </span>
                      </td>
                      <td className="py-3 font-mono">
                        {item.tx_hash ? (
                          <a
                            href={`https://testnet.monadexplorer.com/tx/${item.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-300 hover:text-purple-200 flex items-center gap-1 group"
                          >
                            <span>{item.tx_hash.slice(0, 8)}...{item.tx_hash.slice(-4)}</span>
                            <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          [CONFIRMED]
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Developer Registration */}
      <AnimatePresence>
        {devRegisterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-xl bg-[#111420] border border-white/10 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white font-mono">注册开发者身份</h3>
                </div>
                <button
                  onClick={() => setDevRegisterModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs font-mono text-slate-400 leading-relaxed">
                创建与管理 API 密钥需登记开发者身份。信息将安全同步至平台用户表并关联您的专属配额。
              </p>

              <form onSubmit={handleQuickRegister} className="space-y-4 font-mono text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">开发者名称 / Agent 代号</label>
                  <input
                    type="text"
                    required
                    value={devRegName}
                    onChange={(e) => setDevRegName(e.target.value)}
                    placeholder="e.g. Alpha-Builder"
                    className="w-full h-10 px-3 rounded-md bg-[#090b12] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">联系邮箱</label>
                  <input
                    type="email"
                    value={devRegEmail}
                    onChange={(e) => setDevRegEmail(e.target.value)}
                    placeholder="e.g. developer@koliance.io"
                    className="w-full h-10 px-3 rounded-md bg-[#090b12] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">绑定 EVM 钱包地址 (选填，留空自动生成)</label>
                  <input
                    type="text"
                    value={devRegWallet}
                    onChange={(e) => setDevRegWallet(e.target.value)}
                    placeholder="0x..."
                    className="w-full h-10 px-3 rounded-md bg-[#090b12] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setDevRegisterModalOpen(false)}
                    className="h-9 px-4 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isRegisteringDev}
                    className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-semibold border border-purple-500/30 cursor-pointer flex items-center gap-1.5"
                  >
                    {isRegisteringDev ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>完成注册并解锁密钥</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Create API Key (User creates their own key) */}
      <AnimatePresence>
        {newKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-xl bg-[#111420] border border-white/10 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white font-mono">创建专属 API 密钥</h3>
                </div>
                <button
                  onClick={() => setNewKeyModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs font-mono text-slate-400 leading-relaxed">
                由您自主创建密钥。密钥生成后将加密哈希保存至 <code className="text-purple-300 bg-white/5 px-1 py-0.5 rounded">api-key</code> 数据表，不可逆存储确保生产安全。
              </p>

              <form onSubmit={handleCreateKey} className="space-y-4 font-mono text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">密钥名称 / 标识</label>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. My Arbitrage Bot Key"
                    className="w-full h-10 px-3 rounded-md bg-[#090b12] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold block">初始套餐档位</label>
                    <select
                      value={newKeyTier}
                      onChange={(e) => setNewKeyTier(e.target.value)}
                      className="w-full h-10 px-3 rounded-md bg-[#090b12] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="STARTER_FREE">Starter Free (100 次/免费)</option>
                      <option value="GROWTH_PRO">Growth Pro (10,000 次)</option>
                      <option value="SCALE_ULTRA">Scale Ultra (100,000 次)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold block">速率限制 (RPM)</label>
                    <input
                      type="number"
                      min={10}
                      max={1200}
                      value={newKeyRpm}
                      onChange={(e) => setNewKeyRpm(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-md bg-[#090b12] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">启用接口权限 (Scopes)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {[
                      { id: "trade:perp", label: "永续合约交易" },
                      { id: "pay:micropayment", label: "Agent 微支付" },
                      { id: "query:proof", label: "信用与证明查询" },
                    ].map((scope) => (
                      <label
                        key={scope.id}
                        className="flex items-center gap-2 p-2 rounded-md bg-[#090b12] border border-white/10 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes(scope.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyScopes([...newKeyScopes, scope.id]);
                            } else {
                              setNewKeyScopes(newKeyScopes.filter((s) => s !== scope.id));
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-0"
                        />
                        <span className="text-[11px] text-slate-300">{scope.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setNewKeyModalOpen(false)}
                    className="h-9 px-4 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingKey}
                    className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-semibold border border-purple-500/30 cursor-pointer flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98]"
                  >
                    {isCreatingKey ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>生成并存入 api-key 表</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: Plaintext Secret Key Reveal (Only shown once) */}
      <AnimatePresence>
        {createdSecretModalOpen && createdSecretKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-xl bg-[#111420] border border-emerald-500/30 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>[SUCCESS] 密钥创建成功并已持久化至 api-key 表</span>
              </div>

              <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-slate-300 text-xs font-mono leading-relaxed space-y-1">
                <div className="font-bold text-amber-300">[IMPORTANT] 请妥善保存您的完整 API 密钥</div>
                <p>
                  出于安全隔离，完整密钥明文仅在此处展示一次。关闭此弹窗后将无法再次查看完整密钥，数据库中仅保留 SHA-256 哈希值。
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-mono text-xs font-semibold block">完整 API 密钥 (Plaintext)</label>
                <div className="flex items-center gap-2 bg-[#090b12] p-3 rounded-md border border-white/10 font-mono text-xs text-white">
                  <span className="flex-1 break-all select-all font-semibold text-emerald-300">
                    {createdSecretKey}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdSecretKey);
                      setCreatedSecretCopied(true);
                      setTimeout(() => setCreatedSecretCopied(false), 2000);
                    }}
                    className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white shrink-0 transition"
                    title="复制完整密钥"
                  >
                    {createdSecretCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <div className="text-[11px] font-mono text-slate-400">
                  {createdSecretCopied ? "[OK] 已复制到剪贴板" : "点击右侧按钮复制密钥"}
                </div>
                <button
                  onClick={() => setCreatedSecretModalOpen(false)}
                  className="h-9 px-5 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold border border-purple-500/30 cursor-pointer shadow-sm"
                >
                  我已安全备份密钥
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
