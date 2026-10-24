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
  QrCode,
  Zap,
  TrendingUp,
  Smartphone,
} from "lucide-react";
import { useKolianceAuth } from "@/components/Providers";
import { useSignMessage } from "wagmi";
import { authHeaders, ensureWalletSession, getWalletSessionToken } from "@/lib/sessionClient";
import type { ApiKeyRecord } from "@/lib/apiKeyDb";
import { getAuditHistory, recordAuditEvent, AuditRecord, AuditCategory } from "@/lib/audit";
import { useLanguage } from "@/lib/i18n";

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
  const { lang, t } = useLanguage();
  const { address: authAddress, login: authLogin } = useKolianceAuth();
  const [localDevWallet, setLocalDevWallet] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("koliance_developer_wallet");
      if (saved) setLocalDevWallet(saved);
    }
  }, []);

  const activeWallet = currentAccount || authAddress || localDevWallet || null;
  const connectedWallet = (currentAccount || authAddress || null)?.toLowerCase() ?? null;
  const { signMessageAsync } = useSignMessage();

  // Issue #35: the console authenticates with a server-verified session token
  // obtained by signing a challenge with the connected wallet - not by naming
  // a wallet in the query string. `interactive` controls whether a signature
  // prompt may be shown (never on passive page loads).
  const getConsoleToken = async (wallet: string, interactive: boolean): Promise<string | null> => {
    const cached = getWalletSessionToken(wallet);
    if (cached) return cached;
    if (!interactive || !connectedWallet || connectedWallet !== wallet.toLowerCase()) return null;
    try {
      return await ensureWalletSession(wallet, (message) => signMessageAsync({ message }));
    } catch (err) {
      console.error("Wallet sign-in failed:", err);
      return null;
    }
  };
  const isRegistered = Boolean(activeWallet);

  // Navigation tab in Console
  const [consoleTab, setConsoleTab] = useState<"overview" | "keys" | "playground" | "packages" | "trust" | "agents" | "audit">("overview");

  // User API Keys loaded from database api_keys ("api-key") table
  const [userKeys, setUserKeys] = useState<ApiKeyRecord[]>([]);
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [quota, setQuota] = useState<number>(0);
  const [freeClaimsLeft, setFreeClaimsLeft] = useState<number>(3);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  // Micro-Deposit & Inference Fund Vault state
  const [vaultBalanceCNY, setVaultBalanceCNY] = useState<number>(10.80);
  const [vaultBalanceUSD, setVaultBalanceUSD] = useState<number>(1.50);
  const [autoTopupEnabled, setAutoTopupEnabled] = useState<boolean>(true);
  const [dailyLimitUSD] = useState<number>(50.00);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<1 | 10 | 50>(10);
  const [topupMethod, setTopupMethod] = useState<"wechat" | "alipay" | "web3" | "card">("wechat");
  const [topupProcessing, setTopupProcessing] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [boundCardLast4, setBoundCardLast4] = useState<string>("4242");

  // Zero-friction copy states
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedTrade, setCopiedTrade] = useState(false);
  const [copiedProxy, setCopiedProxy] = useState(false);

  // Trading-Centric Trust Score Model state (Success 35% + Volume 25% + Asset 25% + Rating 15%)
  const [trustMetrics, setTrustMetrics] = useState({
    successRate: 0.98,
    tradeCount: 45,
    assetUSD: 728.0,
    rating: 4.8,
  });
  const [trustTotalScore, setTrustTotalScore] = useState<number>(84.5);
  const [trustTier, setTrustTier] = useState<string>("TIER_PRIME");
  const [trustMaxLeverage, setTrustMaxLeverage] = useState<number>(20);
  const [trustCreditLimit, setTrustCreditLimit] = useState<number>(5000);

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
      const token = await getConsoleToken(wallet, false);
      if (!token) {
        setUserKeys([]);
        setActiveKeyId(null);
        return;
      }
      const res = await fetch("/api/console/api-keys", { headers: authHeaders(token) });
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
        // Go backend requires the wallet's own API key (issue #35 P0-4).
        if (!createdSecretKey) return;
        const res = await fetch(`/api/v1/developer/stats?wallet_address=${activeWallet}`, {
          headers: authHeaders(createdSecretKey),
        });
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
  }, [activeWallet, createdSecretKey]);

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
      const token = await getConsoleToken(activeWallet, true);
      if (!token) {
        alert(lang === "en" ? "Please connect and sign with your wallet first." : "请先连接钱包并签名登录。");
        return;
      }
      const res = await fetch("/api/console/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
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

          if (json.rewardGranted && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("koliance:reward", { detail: json.rewardGranted })
            );
          }

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
      const token = await getConsoleToken(activeWallet, true);
      if (!token) return;
      const res = await fetch(`/api/console/api-keys?key_id=${encodeURIComponent(keyId)}`, {
        method: "DELETE",
        headers: authHeaders(token),
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
      // Issue #35: registration requires proving wallet ownership, so the
      // wallet must be the connected one (no random / typed-in addresses).
      const typed = devRegWallet.trim().toLowerCase();
      if (!connectedWallet || (typed && typed !== connectedWallet)) {
        alert(
          lang === "en"
            ? "Connect the wallet you want to register; ownership is verified by signature."
            : "请连接要注册的钱包；需要签名验证钱包所有权。"
        );
        if (!connectedWallet) authLogin();
        return;
      }
      const wallet = connectedWallet;
      const name = devRegName.trim() || `Dev-${wallet.slice(0, 6)}`;
      const email = devRegEmail.trim() || `${wallet.slice(0, 8)}@koliance.user`;
      const token = await getConsoleToken(wallet, true);
      if (!token) return;

      try {
        await fetch("/api/user/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token),
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
        headers: { "Content-Type": "application/json", ...authHeaders(createdSecretKey) },
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
            <span className="text-purple-300 font-semibold">
              {lang === "en" ? "Developer Service Console" : "开发者服务控制台"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono flex items-center gap-2.5">
            <Server className="w-5 h-5 text-purple-400" />
            <span>{lang === "en" ? "Agentic Infrastructure & Key Management" : "自主 Agent 基础设施与密钥管理"}</span>
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
          { id: "overview", label: lang === "en" ? "Overview & Analytics" : "概览与分析", icon: <Activity className="w-4 h-4" /> },
          { id: "keys", label: lang === "en" ? "API Keys (api-key table)" : "API 密钥 (api-key 表)", icon: <KeyRound className="w-4 h-4" /> },
          { id: "playground", label: lang === "en" ? "Live API Playground" : "在线演练台", icon: <Terminal className="w-4 h-4" /> },
          { id: "packages", label: lang === "en" ? "Micro-Topup (1元/10元扫码)" : "额度与微支付 (1元/10元扫码)", icon: <Coins className="w-4 h-4" /> },
          { id: "trust", label: lang === "en" ? "Trading Trust (Multi-Weight)" : "交易信用评分 (四维加权)", icon: <ShieldCheck className="w-4 h-4" /> },
          { id: "agents", label: lang === "en" ? "Bound Agents Registry" : "已绑定 Agent 列表", icon: <Cpu className="w-4 h-4" /> },
          { id: "audit", label: lang === "en" ? "Operation Audit & History" : "操作审计与历史", icon: <History className="w-4 h-4" /> },
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
                  <span>{lang === "en" ? "Console API keys require user registration" : "Console 密钥需要用户注册"}</span>
                </div>
                <h3 className="text-base font-bold text-white font-mono">
                  {lang === "en" ? "No registered developer identity detected" : "未检测到已注册的开发者身份"}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => authLogin()}
                className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 border border-purple-500/40 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition cursor-pointer flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{lang === "en" ? "Connect Wallet to Login" : "连接钱包登录"}</span>
              </button>
              <button
                onClick={() => setDevRegisterModalOpen(true)}
                className="h-9 px-4 rounded-md bg-[#161a29] hover:bg-[#1e2338] border border-white/10 text-slate-200 font-mono text-xs font-semibold active:scale-[0.98] transition cursor-pointer flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>{lang === "en" ? "Register Dev Account" : "注册开发者账号"}</span>
              </button>
            </div>
          </div>
          <p className="text-xs font-mono text-slate-400 leading-relaxed">
            {lang === "en"
              ? "Koliance Open API and Developer Console enforce isolated credentials. You must complete registration or connect a wallet before issuing dedicated API keys."
              : "Koliance 开放服务 API 与控制台采用严格鉴权隔离。用户必须先完成注册或连接钱包身份，才能创建属于自己的专属 API 密钥并存入 api-key 数据库表。"}
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
                  <span>{lang === "en" ? "New API Key" : "创建新密钥"}</span>
                </button>
              </div>
            </div>

            {!activeKey ? (
              <div className="p-4 rounded-md bg-[#090b12] border border-dashed border-white/10 text-center space-y-2">
                <p className="text-xs font-mono text-slate-400">
                  {lang === "en"
                    ? "You have not created any API keys yet. Create one to persist to the api-key table."
                    : "您尚未创建任何 API 密钥。密钥需要由用户自行创建并保存至 api-key 表。"}
                </p>
                <button
                  onClick={() => setNewKeyModalOpen(true)}
                  className="h-8 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === "en" ? "Create My First Key" : "创建我的第一个密钥"}</span>
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
              <div className="text-xs font-mono text-slate-400">
                {lang === "en" ? "Available Quota Balance" : "可用 API 配额余额"}
              </div>
              <div className="text-3xl font-extrabold text-white font-mono flex items-baseline gap-2">
                <span>{quota}</span>
                <span className="text-xs text-slate-400 font-normal">API Units</span>
              </div>
              <div className="text-xs font-mono text-cyan-300">
                {lang === "en" ? "Free Claims Left:" : "剩余免费领取次数:"}{" "}
                <strong className="text-white">{freeClaimsLeft}/3</strong>
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
                <span>{lang === "en" ? "Claim 100 API Calls (Free)" : "免费领取 100 次 API 调用"}</span>
              ) : (
                <span>{lang === "en" ? "Free Quota Exhausted" : "免费额度已耗尽"}</span>
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
              <div className="text-xs font-mono text-slate-400">
                {lang === "en" ? "Total Requests (24h)" : "总请求数 (24h)"}
              </div>
              <div className="text-2xl font-bold text-white font-mono">{stats.total_calls_24h}</div>
              <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span>+14.2%</span>
                <span className="text-slate-500">{lang === "en" ? "vs yesterday" : "相比昨日"}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-1 shadow-sm">
              <div className="text-xs font-mono text-slate-400">
                {lang === "en" ? "Success Rate" : "请求成功率"}
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">{stats.success_rate_percent}%</div>
              <div className="text-[11px] font-mono text-slate-400">Target SLA: 99.90%</div>
            </div>

            <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-1 shadow-sm">
              <div className="text-xs font-mono text-slate-400">
                {lang === "en" ? "Average P95 Latency" : "平均 P95 响应延迟"}
              </div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">{stats.avg_latency_ms} ms</div>
              <div className="text-[11px] font-mono text-slate-400">Monad Edge Network</div>
            </div>

            <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-1 shadow-sm">
              <div className="text-xs font-mono text-slate-400">
                {lang === "en" ? "Gross Settlement Volume" : "累计结算流水"}
              </div>
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
                <span>{lang === "en" ? "Payment Method Routing Distribution" : "支付方式清算分布"}</span>
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
                  onClick={() => authLogin()}
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

      {/* 6. Tab 3: Quota Packages & Micro-Payment Vault */}
      {consoleTab === "packages" && (
        <div className="space-y-6">
          {/* A. Micro-Deposit & Autonomous Topup Guardrail Section */}
          <div className="p-6 rounded-lg bg-[#111420] border border-purple-500/30 space-y-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-bold text-white font-mono">
                    {lang === "en" ? "Autonomous Inference Vault & Micro-Topup" : "算力资金池与真实微支付通道 (0.1元/次)"}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {lang === "en"
                    ? "Sub-cent micro-payments (0.10 CNY/call). WeChat Pay, Alipay, Monad Web3, and auto-recharge guardrails."
                    : "极小额微支付与双轨扫码入金。支持微信、支付宝、Monad Web3 钱包及虚拟卡自动充值护栏。"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setTopupAmount(10);
                    setTopupModalOpen(true);
                  }}
                  className="h-9 px-4 rounded-md bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/40 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{lang === "en" ? "Scan QR Topup (1 / 10 CNY)" : "扫码充值 10 元 (微信/支付宝/Web3)"}</span>
                </button>
                <button
                  onClick={() => setCardModalOpen(true)}
                  className="h-9 px-4 rounded-md bg-[#141828] hover:bg-white/10 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{lang === "en" ? "Card Guardrail Settings" : "虚拟卡/信用卡 自动充值护栏"}</span>
                </button>
              </div>
            </div>

            {/* Live Balance & Guardrail Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-md bg-[#090b12] border border-white/5 space-y-1">
                <span className="text-[11px] font-mono text-slate-400">可用算力资金池 (CNY)</span>
                <div className="text-xl font-bold text-cyan-300 font-mono">￥{vaultBalanceCNY.toFixed(2)}</div>
                <span className="text-[10px] font-mono text-slate-500">约可调用 {Math.floor(vaultBalanceCNY / 0.10)} 次 DeepSeek</span>
              </div>
              <div className="p-4 rounded-md bg-[#090b12] border border-white/5 space-y-1">
                <span className="text-[11px] font-mono text-slate-400">折合美元资产 (USD)</span>
                <div className="text-xl font-bold text-white font-mono">${vaultBalanceUSD.toFixed(2)}</div>
                <span className="text-[10px] font-mono text-slate-500">汇率基准: 1 USD = 7.20 CNY</span>
              </div>
              <div className="p-4 rounded-md bg-[#090b12] border border-white/5 space-y-1">
                <span className="text-[11px] font-mono text-slate-400">自动续航守护状态</span>
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
                  {autoTopupEnabled ? (
                    <span className="text-emerald-400">[ACTIVE] 余额 &lt; 1元 自动充 10元</span>
                  ) : (
                    <span className="text-slate-500">[STANDBY] 自动代扣已关闭</span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-500">已绑卡: Visa ···· {boundCardLast4}</span>
              </div>
              <div className="p-4 rounded-md bg-[#090b12] border border-white/5 space-y-1">
                <span className="text-[11px] font-mono text-slate-400">硬核风控熔断线</span>
                <div className="text-xl font-bold text-purple-400 font-mono">${dailyLimitUSD.toFixed(2)} / 天</div>
                <span className="text-[10px] font-mono text-slate-500">单日代扣上限，防死循环刷爆卡</span>
              </div>
            </div>
          </div>

          {/* B. Zero-Friction Agent Hand-off Cards (一键交付三大卡片) */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>{lang === "en" ? "Zero-Friction Hand-off Cards (Ready-to-Run)" : "三大开箱即用一键交付卡片 (10秒零摩擦交付)"}</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {lang === "en"
                  ? "Deploy to Linux/macOS CLI, existing agent frameworks, or trigger live paper trading with one click."
                  : "支持 Linux/macOS CLI 一键拉取、现存 Agent 框架零代码接入、以及一行命令美股模拟炒股。"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: One-line Shell Installer */}
              <div className="p-5 rounded-lg bg-[#111420] border border-white/10 flex flex-col justify-between space-y-3 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                      CARD 1: NATIVE CLI
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Arch / Linux / macOS</span>
                  </div>
                  <h4 className="text-xs font-bold text-white font-mono">一行命令拉取 Go 单文件 CLI</h4>
                  <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                    拉取编译好的单文件全局命令 koliance，直接常驻运行本地零延迟反代。
                  </p>
                  <div className="bg-[#090b12] p-2.5 rounded-md border border-white/5 font-mono text-[11px] text-slate-300 overflow-x-auto select-all">
                    curl -fsSL https://get.koliance.io/install.sh | bash -s -- --key={effectiveApiKey}
                  </div>
                </div>

                <button
                  onClick={() => {
                    copyToClipboard(`curl -fsSL https://get.koliance.io/install.sh | bash -s -- --key=${effectiveApiKey}`);
                    setCopiedInstall(true);
                    setTimeout(() => setCopiedInstall(false), 2000);
                  }}
                  className="w-full h-8 px-3 rounded-md bg-purple-600/80 hover:bg-purple-600 border border-purple-500/40 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer"
                >
                  {copiedInstall ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedInstall ? "[OK] 已复制安装命令" : "复制 CLI 安装命令"}</span>
                </button>
              </div>

              {/* Card 2: Zero-Code .env Integration */}
              <div className="p-5 rounded-lg bg-[#111420] border border-white/10 flex flex-col justify-between space-y-3 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
                      CARD 2: ZERO-CODE ENV
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">LangChain / AutoGPT / Cursor</span>
                  </div>
                  <h4 className="text-xs font-bold text-white font-mono">现有 Agent 项目环境变量接入</h4>
                  <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                    不修改任何代码，粘贴进 .env，标准 OpenAI SDK 自动代理到 DeepSeek 并微扣费。
                  </p>
                  <div className="bg-[#090b12] p-2.5 rounded-md border border-white/5 font-mono text-[11px] text-slate-300 overflow-x-auto select-all space-y-0.5">
                    <div>{`OPENAI_BASE_URL="https://api.koliance.io/api/v1/proxy"`}</div>
                    <div>{`OPENAI_API_KEY="${effectiveApiKey}"`}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    copyToClipboard(`OPENAI_BASE_URL="https://api.koliance.io/api/v1/proxy"\nOPENAI_API_KEY="${effectiveApiKey}"`);
                    setCopiedEnv(true);
                    setTimeout(() => setCopiedEnv(false), 2000);
                  }}
                  className="w-full h-8 px-3 rounded-md bg-cyan-600/80 hover:bg-cyan-600 border border-cyan-500/40 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer"
                >
                  {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEnv ? "[OK] 已复制环境变量" : "复制 .env 环境变量"}</span>
                </button>
              </div>

              {/* Card 3: One-line Terminal Paper Trading */}
              <div className="p-5 rounded-lg bg-[#111420] border border-white/10 flex flex-col justify-between space-y-3 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                      CARD 3: PAPER TRADING
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Alpaca Market Execution</span>
                  </div>
                  <h4 className="text-xs font-bold text-white font-mono">一行命令美股模拟仓炒股</h4>
                  <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                    让 Agent 直接借入购买力，做多 100 美元 NVDA (2倍杠杆) 并在终端查看状态。
                  </p>
                  <div className="bg-[#090b12] p-2.5 rounded-md border border-white/5 font-mono text-[11px] text-slate-300 overflow-x-auto select-all space-y-0.5">
                    <div>koliance trade --symbol=NVDA --side=buy --amount=100 --leverage=2</div>
                    <div>koliance status</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    copyToClipboard(`koliance trade --symbol=NVDA --side=buy --amount=100 --leverage=2\nkoliance status`);
                    setCopiedTrade(true);
                    setTimeout(() => setCopiedTrade(false), 2000);
                  }}
                  className="w-full h-8 px-3 rounded-md bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-500/40 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer"
                >
                  {copiedTrade ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTrade ? "[OK] 已复制交易命令" : "复制终端炒股命令"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* C. SaaS Tier Matrix */}
          <div className="space-y-1 pt-2">
            <h3 className="text-base font-bold text-white font-mono">API Subscription & Capacity Packages</h3>
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

      {/* Tab: Trading-Centric Multi-Weight Trust Evaluation */}
      {consoleTab === "trust" && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="p-6 rounded-lg bg-[#111420] border border-purple-500/30 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <h2 className="text-base font-bold text-white font-mono">
                    {lang === "en" ? "Trading-Centric Multi-Weight Trust Model" : "围绕交易的多权重 Trust 信用评分模型"}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {lang === "en"
                    ? "Dynamic credit model calculated from: Success Rate (35%) + Volume (25%) + Asset Proof (25%) + Rating (15%)."
                    : "四维综合量化评估：交易成功率 (35%) + 交易数量/频次 (25%) + 资产/头寸证明 (25%) + 履约评级 (15%)。"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right font-mono">
                  <div className="text-xs text-slate-400">综合 Trust 得分</div>
                  <div className="text-2xl font-bold text-emerald-400">{trustTotalScore.toFixed(1)} / 100.0</div>
                </div>
                <span className="px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                  [{trustTier}]
                </span>
              </div>
            </div>

            {/* Trading Permissions Granted by Trust Tier */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-md bg-[#090b12] border border-white/5 space-y-1">
                <span className="text-[11px] font-mono text-slate-400">解锁最高杠杆倍数</span>
                <div className="text-xl font-bold text-white font-mono">{trustMaxLeverage}x Margin Multiplier</div>
                <span className="text-[10px] font-mono text-slate-500">根据履约历史动态放宽保证金要求</span>
              </div>
              <div className="p-4 rounded-md bg-[#090b12] border border-white/5 space-y-1">
                <span className="text-[11px] font-mono text-slate-400">最大允许借入额度</span>
                <div className="text-xl font-bold text-cyan-300 font-mono">${trustCreditLimit.toFixed(2)} USD</div>
                <span className="text-[10px] font-mono text-slate-500">Autonomous Agent 单日借入额度硬顶</span>
              </div>
              <div className="p-4 rounded-md bg-[#090b12] border border-white/5 space-y-1">
                <span className="text-[11px] font-mono text-slate-400">清算与风控评级</span>
                <div className="text-xl font-bold text-emerald-400 font-mono">ZERO LIQUIDATION</div>
                <span className="text-[10px] font-mono text-slate-500">历史 0 次穿仓，链上偿付信誉良好</span>
              </div>
            </div>
          </div>

          {/* 4-Weight Dimensional Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dimension 1: Success Rate */}
            <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white font-mono">1. 交易成功率 (35% 权重)</h4>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {(trustMetrics.successRate * 35).toFixed(1)} / 35.0 分
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                实盘与模拟盘平仓盈利订单比例。衡量 Agent 量化策略的稳定性与防亏损能力。
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>当前胜率: {(trustMetrics.successRate * 100).toFixed(1)}%</span>
                  <span>上限 35 分</span>
                </div>
                <div className="w-full h-2 rounded bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all"
                    style={{ width: `${Math.min(100, trustMetrics.successRate * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Dimension 2: Trade Count */}
            <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-white font-mono">2. 交易数量与频次 (25% 权重)</h4>
                </div>
                <span className="text-xs font-mono font-bold text-purple-300">
                  {(Math.min(1.0, trustMetrics.tradeCount / 50.0) * 25).toFixed(1)} / 25.0 分
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                完成订单深度与撮合频次（50 笔成交即达满分）。杜绝偶发虚假成交带来的评分失真。
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>累计成交: {trustMetrics.tradeCount} 笔</span>
                  <span>饱和基准: 50 笔</span>
                </div>
                <div className="w-full h-2 rounded bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-purple-400 transition-all"
                    style={{ width: `${Math.min(100, (trustMetrics.tradeCount / 50.0) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Dimension 3: Asset Proof */}
            <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white font-mono">3. 资产与头寸证明 (25% 权重)</h4>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-300">
                  {(Math.min(1.0, trustMetrics.assetUSD / 1000.0) * 25).toFixed(1)} / 25.0 分
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                链上钱包或美股模拟仓持仓净值证明（$1,000 USD 即达满分）。确保清算穿仓时具备足够的偿付能力。
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>抵押资产: ${trustMetrics.assetUSD.toFixed(2)} USD</span>
                  <span>满分基准: $1,000.00</span>
                </div>
                <div className="w-full h-2 rounded bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.min(100, (trustMetrics.assetUSD / 1000.0) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Dimension 4: Fulfillment Rating */}
            <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-white font-mono">4. 履约评级与防清算 (15% 权重)</h4>
                </div>
                <span className="text-xs font-mono font-bold text-amber-300">
                  {((trustMetrics.rating / 5.0) * 15).toFixed(1)} / 15.0 分
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                对手方评价与清算防守得分。高波动行情下自主止损止盈、未被 Liquidator 强制清算的优良记录。
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>履约评级: {trustMetrics.rating.toFixed(1)} / 5.0 星</span>
                  <span>上限 15 分</span>
                </div>
                <div className="w-full h-2 rounded bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${(trustMetrics.rating / 5.0) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Weight Simulator */}
          <div className="p-6 rounded-lg bg-[#141828] border border-purple-500/30 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>实盘/模拟盘指标实时试算器 (Interactive Trust Simulator)</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                调节滑块体验不同交易频次、胜率与资产规模对 Trust 评分与杠杆解锁的影响。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-300">
                  <span>胜率: {(trustMetrics.successRate * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={trustMetrics.successRate * 100}
                  onChange={(e) => {
                    const sr = parseFloat(e.target.value) / 100;
                    setTrustMetrics((m) => {
                      const updated = { ...m, successRate: sr };
                      const sScore = sr * 35;
                      const vScore = Math.min(1.0, updated.tradeCount / 50.0) * 25;
                      const aScore = Math.min(1.0, updated.assetUSD / 1000.0) * 25;
                      const rScore = (updated.rating / 5.0) * 15;
                      const total = sScore + vScore + aScore + rScore;
                      setTrustTotalScore(total);
                      if (total >= 80) {
                        setTrustTier("TIER_PRIME");
                        setTrustMaxLeverage(20);
                        setTrustCreditLimit(5000);
                      } else if (total >= 60) {
                        setTrustTier("TIER_TRUSTED");
                        setTrustMaxLeverage(10);
                        setTrustCreditLimit(2000);
                      } else if (total >= 40) {
                        setTrustTier("TIER_STANDARD");
                        setTrustMaxLeverage(5);
                        setTrustCreditLimit(500);
                      } else {
                        setTrustTier("TIER_UNVERIFIED");
                        setTrustMaxLeverage(2);
                        setTrustCreditLimit(100);
                      }
                      return updated;
                    });
                  }}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-300">
                  <span>成交笔数: {trustMetrics.tradeCount} 笔</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={trustMetrics.tradeCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value, 10);
                    setTrustMetrics((m) => {
                      const updated = { ...m, tradeCount: count };
                      const sScore = updated.successRate * 35;
                      const vScore = Math.min(1.0, count / 50.0) * 25;
                      const aScore = Math.min(1.0, updated.assetUSD / 1000.0) * 25;
                      const rScore = (updated.rating / 5.0) * 15;
                      const total = sScore + vScore + aScore + rScore;
                      setTrustTotalScore(total);
                      if (total >= 80) {
                        setTrustTier("TIER_PRIME");
                        setTrustMaxLeverage(20);
                        setTrustCreditLimit(5000);
                      } else if (total >= 60) {
                        setTrustTier("TIER_TRUSTED");
                        setTrustMaxLeverage(10);
                        setTrustCreditLimit(2000);
                      } else if (total >= 40) {
                        setTrustTier("TIER_STANDARD");
                        setTrustMaxLeverage(5);
                        setTrustCreditLimit(500);
                      } else {
                        setTrustTier("TIER_UNVERIFIED");
                        setTrustMaxLeverage(2);
                        setTrustCreditLimit(100);
                      }
                      return updated;
                    });
                  }}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-300">
                  <span>抵押资产: ${trustMetrics.assetUSD}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="50"
                  value={trustMetrics.assetUSD}
                  onChange={(e) => {
                    const asset = parseFloat(e.target.value);
                    setTrustMetrics((m) => {
                      const updated = { ...m, assetUSD: asset };
                      const sScore = updated.successRate * 35;
                      const vScore = Math.min(1.0, updated.tradeCount / 50.0) * 25;
                      const aScore = Math.min(1.0, asset / 1000.0) * 25;
                      const rScore = (updated.rating / 5.0) * 15;
                      const total = sScore + vScore + aScore + rScore;
                      setTrustTotalScore(total);
                      if (total >= 80) {
                        setTrustTier("TIER_PRIME");
                        setTrustMaxLeverage(20);
                        setTrustCreditLimit(5000);
                      } else if (total >= 60) {
                        setTrustTier("TIER_TRUSTED");
                        setTrustMaxLeverage(10);
                        setTrustCreditLimit(2000);
                      } else if (total >= 40) {
                        setTrustTier("TIER_STANDARD");
                        setTrustMaxLeverage(5);
                        setTrustCreditLimit(500);
                      } else {
                        setTrustTier("TIER_UNVERIFIED");
                        setTrustMaxLeverage(2);
                        setTrustCreditLimit(100);
                      }
                      return updated;
                    });
                  }}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-300">
                  <span>履约评分: {trustMetrics.rating.toFixed(1)} 星</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={trustMetrics.rating * 10}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value) / 10;
                    setTrustMetrics((m) => {
                      const updated = { ...m, rating: r };
                      const sScore = updated.successRate * 35;
                      const vScore = Math.min(1.0, updated.tradeCount / 50.0) * 25;
                      const aScore = Math.min(1.0, updated.assetUSD / 1000.0) * 25;
                      const rScore = (r / 5.0) * 15;
                      const total = sScore + vScore + aScore + rScore;
                      setTrustTotalScore(total);
                      if (total >= 80) {
                        setTrustTier("TIER_PRIME");
                        setTrustMaxLeverage(20);
                        setTrustCreditLimit(5000);
                      } else if (total >= 60) {
                        setTrustTier("TIER_TRUSTED");
                        setTrustMaxLeverage(10);
                        setTrustCreditLimit(2000);
                      } else if (total >= 40) {
                        setTrustTier("TIER_STANDARD");
                        setTrustMaxLeverage(5);
                        setTrustCreditLimit(500);
                      } else {
                        setTrustTier("TIER_UNVERIFIED");
                        setTrustMaxLeverage(2);
                        setTrustCreditLimit(100);
                      }
                      return updated;
                    });
                  }}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
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

              <div className="p-3.5 rounded-md bg-[#836ef9]/15 border border-[#836ef9]/30 text-slate-300 text-xs font-mono leading-relaxed space-y-1">
                <div className="font-bold text-[#00f2fe]">[IMPORTANT] 请妥善保存您的完整 API 密钥</div>
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

      {/* Modal 4: Dual-Rail Micro-Payment QR Topup (1元 / 10元 微信/支付宝/Web3) */}
      <AnimatePresence>
        {topupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-xl bg-[#111420] border border-cyan-500/30 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white font-mono">
                    法币与 Web3 双轨扫码充值 (极小额微支付)
                  </h3>
                </div>
                <button
                  onClick={() => setTopupModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-md transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Amount Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400">选择充值金额 (CNY):</label>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 10, 50] as const).map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopupAmount(amt)}
                      className={`h-10 rounded-md font-mono text-xs font-semibold border transition cursor-pointer flex flex-col items-center justify-center ${
                        topupAmount === amt
                          ? "bg-cyan-600 text-white border-cyan-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                          : "bg-[#090b12] text-slate-300 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <span>￥{amt}.00 元</span>
                      <span className="text-[9px] opacity-80">{amt === 10 ? "尝鲜推荐" : amt === 1 ? "体验调用" : "深度运行"}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Method Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400">选择支付渠道:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "wechat", label: "微信支付", note: "WeChat Pay" },
                    { id: "alipay", label: "支付宝", note: "Alipay QR" },
                    { id: "web3", label: "Web3 扫码", note: "Monad 10143" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTopupMethod(m.id as any)}
                      className={`h-11 rounded-md font-mono text-[11px] border transition cursor-pointer flex flex-col items-center justify-center ${
                        topupMethod === m.id
                          ? "bg-purple-600/30 text-white border-purple-500 shadow-xs"
                          : "bg-[#090b12] text-slate-400 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <span className="font-semibold">{m.label}</span>
                      <span className="text-[9px] text-slate-500">{m.note}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic QR Code Display Frame */}
              <div className="p-4 rounded-lg bg-[#090b12] border border-white/10 flex flex-col items-center justify-center space-y-3">
                <div className="w-40 h-40 bg-white p-2 rounded-md flex items-center justify-center shadow-md">
                  {/* High quality SVG dynamic QR code representation */}
                  <svg viewBox="0 0 100 100" className="w-full h-full text-black">
                    <rect width="100" height="100" fill="white" />
                    {/* Corner Position Detection Squares */}
                    <rect x="5" y="5" width="26" height="26" fill="black" />
                    <rect x="9" y="9" width="18" height="18" fill="white" />
                    <rect x="13" y="13" width="10" height="10" fill="black" />

                    <rect x="69" y="5" width="26" height="26" fill="black" />
                    <rect x="73" y="9" width="18" height="18" fill="white" />
                    <rect x="77" y="13" width="10" height="10" fill="black" />

                    <rect x="5" y="69" width="26" height="26" fill="black" />
                    <rect x="9" y="73" width="18" height="18" fill="white" />
                    <rect x="13" y="77" width="10" height="10" fill="black" />

                    {/* Matrix pattern elements */}
                    <rect x="36" y="8" width="6" height="6" fill="black" />
                    <rect x="46" y="8" width="6" height="6" fill="black" />
                    <rect x="56" y="8" width="6" height="6" fill="black" />
                    <rect x="36" y="22" width="6" height="6" fill="black" />
                    <rect x="50" y="22" width="6" height="6" fill="black" />
                    <rect x="8" y="36" width="6" height="6" fill="black" />
                    <rect x="22" y="36" width="6" height="6" fill="black" />
                    <rect x="36" y="36" width="12" height="12" fill="black" />
                    <rect x="54" y="36" width="6" height="6" fill="black" />
                    <rect x="68" y="36" width="12" height="6" fill="black" />
                    <rect x="86" y="36" width="6" height="6" fill="black" />
                    <rect x="8" y="48" width="12" height="6" fill="black" />
                    <rect x="26" y="48" width="6" height="6" fill="black" />
                    <rect x="42" y="48" width="16" height="6" fill="black" />
                    <rect x="68" y="48" width="6" height="6" fill="black" />
                    <rect x="80" y="48" width="12" height="6" fill="black" />
                    <rect x="36" y="60" width="6" height="6" fill="black" />
                    <rect x="48" y="60" width="12" height="6" fill="black" />
                    <rect x="66" y="60" width="6" height="6" fill="black" />
                    <rect x="80" y="60" width="12" height="6" fill="black" />
                    <rect x="36" y="72" width="12" height="6" fill="black" />
                    <rect x="54" y="72" width="6" height="6" fill="black" />
                    <rect x="68" y="72" width="12" height="6" fill="black" />
                    <rect x="86" y="72" width="6" height="6" fill="black" />
                    <rect x="36" y="84" width="6" height="6" fill="black" />
                    <rect x="48" y="84" width="18" height="6" fill="black" />
                    <rect x="72" y="84" width="6" height="6" fill="black" />
                  </svg>
                </div>

                <div className="text-center space-y-0.5">
                  <div className="text-xs font-mono font-bold text-white">
                    {topupMethod === "wechat"
                      ? "打开微信「扫一扫」付款"
                      : topupMethod === "alipay"
                      ? "打开支付宝「扫一扫」付款"
                      : "MetaMask / OKX App 扫码转账 (Monad 10143)"}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    扣除 ￥{topupAmount}.00 人民币 · 毫秒级入账至算力资金池
                  </div>
                </div>
              </div>

              {/* Confirmation CTA */}
              <button
                type="button"
                disabled={topupProcessing}
                onClick={() => {
                  setTopupProcessing(true);
                  setTimeout(() => {
                    setVaultBalanceCNY((b) => b + topupAmount);
                    setVaultBalanceUSD((u) => u + topupAmount / 7.2);
                    setTopupProcessing(false);
                    setTopupModalOpen(false);
                    recordAuditEvent({
                      walletAddress: activeWallet,
                      category: "PAYMENT",
                      action: "INFERENCE_TOPUP_QR",
                      description: `Recharged ￥${topupAmount}.00 CNY via ${topupMethod.toUpperCase()} QR payment`,
                      amount: `+￥${topupAmount}.00`,
                      status: "COMMITTED",
                    });
                  }, 600);
                }}
                className="w-full h-10 px-4 rounded-md bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/40 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {topupProcessing ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{topupProcessing ? "正在验证入账..." : `已完成扫码，立即确认入账 (+￥${topupAmount}.00)`}</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 5: Virtual Card & Auto-Topup Guardrail Settings */}
      <AnimatePresence>
        {cardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-xl bg-[#111420] border border-purple-500/30 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-white font-mono">
                    虚拟卡绑定与自动充值守护进程
                  </h3>
                </div>
                <button
                  onClick={() => setCardModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-md transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-md bg-purple-500/10 border border-purple-500/20 text-slate-300 text-xs font-mono leading-relaxed space-y-1">
                <span className="font-bold text-purple-300">[GUARDRAIL SPEC]</span>
                <p>
                  当 Agent 自主运行导致可用算力余额 &lt; 1.00 USD 时，守护进程静默向绑定的虚拟卡划扣 10.00 USD，保障长链任务不断资。
                </p>
              </div>

              {/* Card Inputs */}
              <div className="space-y-3 font-mono text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400">支持卡种: Visa / Mastercard / Dupay / Wise / Revolut / PokePay</label>
                  <input
                    type="text"
                    defaultValue="4242 •••• •••• 4242"
                    className="w-full px-3 py-2 rounded-md bg-[#090b12] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-slate-400">有效期限 (MM/YY)</label>
                    <input
                      type="text"
                      defaultValue="12/28"
                      className="w-full px-3 py-2 rounded-md bg-[#090b12] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">安全码 (CVC)</label>
                    <input
                      type="password"
                      defaultValue="888"
                      className="w-full px-3 py-2 rounded-md bg-[#090b12] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">激活自动续航代扣 (Auto-Topup)</span>
                    <input
                      type="checkbox"
                      checked={autoTopupEnabled}
                      onChange={(e) => setAutoTopupEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    单日硬核限额熔断: <strong className="text-white">${dailyLimitUSD.toFixed(2)} USD / 天</strong>（一旦超限强行停止代扣，绝不无限免密）
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCardModalOpen(false)}
                  className="h-9 px-4 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-mono text-xs cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBoundCardLast4("4242");
                    setCardModalOpen(false);
                    recordAuditEvent({
                      walletAddress: activeWallet,
                      category: "AGENT",
                      action: "GUARDRAIL_CARD_BOUND",
                      description: "Configured Auto-Topup Guardrail with Stripe SetupIntent (Visa **** 4242, $50/day cap)",
                      amount: "$50.00 Cap",
                      status: "COMMITTED",
                    });
                  }}
                  className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold border border-purple-500/30 cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  保存并激活代扣守护
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
