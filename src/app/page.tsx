"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
} from "viem";
import {
  Shield,
  Layers,
  Sparkles,
  KeyRound,
  ExternalLink,
  Cpu,
  Github,
  Server,
  Activity,
  CheckCircle2,
  Terminal,
  Zap,
  Network,
  ArrowRight,
  Database,
  Lock,
  CreditCard,
  Coins,
} from "lucide-react";
import { BrandIcon } from "@/components/BrandIcon";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { HeroGsap } from "@/components/HeroGsap";
import { EnergyCoreHero } from "@/components/EnergyCoreHero";
import { TrustConstellation } from "@/components/TrustConstellation";
import { ProductStudio } from "@/components/ProductStudio";
import { MarketTerminal } from "@/components/MarketTerminal";
import { IdentityCard } from "@/components/IdentityCard";
import { KineticScrollBanner } from "@/components/KineticScrollBanner";
import { QuantumProtocolStream } from "@/components/QuantumProtocolStream";
import { MinimalistGatewayRails } from "@/components/MinimalistGatewayRails";
import { TrustAttestationCard } from "@/components/TrustAttestationCard";
import { TrustStream } from "@/components/TrustStream";
import { NetworkModal } from "@/components/NetworkModal";
import { TokenStudio } from "@/components/TokenStudio";
import { DeveloperConsole } from "@/components/DeveloperConsole";
import { AgentNarrativeFlow } from "@/components/AgentNarrativeFlow";
import {
  monadTestnet,
  KOLIANCE_ADDRESS,
  KOLIANCE_ABI,
  IdentityData,
  TrustRecordData,
} from "@/lib/contract";
import { checkBackendHealth } from "@/lib/api";
import { useKolianceAuth } from "@/components/Providers";

function MainContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialView =
    (searchParams.get("view") as NavView) ||
    (searchParams.get("openid.claimed_id") || searchParams.get("status") || searchParams.get("code") ? "DETAIL" : "INDEX");

  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [balance, setBalance] = useState("0.00");
  const [chainId, setChainId] = useState<number | null>(null);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);

  const {
    address: authAddress,
    login: authLogin,
    logout: authLogout,
  } = useKolianceAuth();

  useEffect(() => {
    if (authAddress) {
      setAccount(authAddress);
    }
  }, [authAddress]);

  // Top Nav View: INDEX | DETAIL | PRODUCT | AGENTCARD
  const [currentView, setCurrentView] = useState<NavView>(initialView);
  const [hasVisitedAgentCard, setHasVisitedAgentCard] = useState(initialView === "AGENTCARD");

  useEffect(() => {
    if (currentView === "AGENTCARD") {
      setHasVisitedAgentCard(true);
    }
  }, [currentView]);

  // Sub-tab under Product Studio (for direct contract transactions)
  const [contractStudioOpen, setContractStudioOpen] = useState(false);

  // Contract State
  const [identity, setIdentity] = useState<IdentityData | null>(null);
  const [records, setRecords] = useState<TrustRecordData[]>([
    {
      from: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      to: "0x250b7305986c7C0D0190Fe0141a0F911b333E43D",
      action: "ENDORSE_CORE_DEV",
      proof: "0xa3872c9167b5e40e2d1d07c089207e4d82b3d81b312783709b119c43bcae619a",
      timestamp: BigInt(Math.floor(Date.now() / 1000) - 3600),
    },
    {
      from: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      to: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      action: "SECURITY_AUDIT_VERIFIED",
      proof: "0x77c25143329977aa5386da6dd4b61a7a24558e8b0108be65e0ebc5cbe82e0e0a",
      timestamp: BigInt(Math.floor(Date.now() / 1000) - 7200),
    },
    {
      from: "0x1Db3439a222C519ab44bb1144fC23CC7c1405e98",
      to: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      action: "COMMUNITY_CONTRIBUTOR",
      proof: "0xfe31889c0993d0d866a27e792c3a502c38d4f40f06579bb8d2efebc8b05619d4",
      timestamp: BigInt(Math.floor(Date.now() / 1000) - 14400),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState(false);

  // Setup Monad Public Client
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
  });

  // Switch or Add Monad Testnet to wallet
  const handleSwitchNetwork = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${monadTestnet.id.toString(16)}` }],
      });
      setNetworkModalOpen(false);
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${monadTestnet.id.toString(16)}`,
                chainName: monadTestnet.name,
                rpcUrls: monadTestnet.rpcUrls.default.http,
                nativeCurrency: monadTestnet.nativeCurrency,
                blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
              },
            ],
          });
          setNetworkModalOpen(false);
        } catch (addError) {
          console.error("Failed to add Monad Testnet", addError);
        }
      }
    }
  };

  // Connect Wallet (via Privy / Wagmi / injected fallback)
  const handleConnect = async () => {
    try {
      authLogin();
    } catch {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          const accounts = (await (window as any).ethereum.request({
            method: "eth_requestAccounts",
          })) as string[];
          if (accounts && accounts.length > 0) {
            setAccount(accounts[0] as `0x${string}`);
          }
        } catch (err) {
          console.error("Direct wallet connect error:", err);
        }
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await authLogout();
    } finally {
      setAccount(null);
      setBalance("0.00");
      setIdentity(null);
    }
  };

  // Fetch account balance and contract data
  const fetchData = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const bal = await publicClient.getBalance({ address: account });
      setBalance(parseFloat(formatEther(bal)).toFixed(4));

      if (KOLIANCE_ADDRESS && KOLIANCE_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        try {
          const idData = (await publicClient.readContract({
            address: KOLIANCE_ADDRESS,
            abi: KOLIANCE_ABI,
            functionName: "identities",
            args: [account],
          })) as [boolean, bigint, string];

          setIdentity({
            exists: idData[0],
            createdAt: idData[1],
            metadataHash: idData[2],
          });

          const onchainRecords = (await publicClient.readContract({
            address: KOLIANCE_ADDRESS,
            abi: KOLIANCE_ABI,
            functionName: "getAllRecords",
          })) as any[];

          if (onchainRecords && onchainRecords.length > 0) {
            setRecords(
              onchainRecords.map((r) => ({
                from: r.from,
                to: r.to,
                action: r.action,
                proof: r.proof,
                timestamp: r.timestamp,
              }))
            );
          }
        } catch (contractErr) {
          console.warn("Contract read warning:", contractErr);
        }
      }
    } catch (e) {
      console.error("Fetch data error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [account, publicClient]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    checkBackendHealth().then(setBackendHealthy);

    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) handleDisconnect();
        else setAccount(accounts[0] as `0x${string}`);
      };
      const handleChainChanged = (newChainIdHex: string) => {
        const id = parseInt(newChainIdHex, 16);
        setChainId(id);
        if (id !== monadTestnet.id) setNetworkModalOpen(true);
        else setNetworkModalOpen(false);
      };

      window.ethereum.on?.("accountsChanged", handleAccountsChanged);
      window.ethereum.on?.("chainChanged", handleChainChanged);

      return () => {
        window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
        window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
      };
    }
  }, []);

  // Contract Actions: Register
  const handleRegister = async (metadataHash: string) => {
    if (!account || !window.ethereum) return;
    try {
      const walletClient = createWalletClient({
        chain: monadTestnet,
        transport: custom(window.ethereum),
      });

      if (KOLIANCE_ADDRESS && KOLIANCE_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        const hash = await walletClient.writeContract({
          address: KOLIANCE_ADDRESS,
          abi: KOLIANCE_ABI,
          functionName: "register",
          args: [metadataHash],
          account,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await fetchData();
        return hash;
      }
    } catch (err: any) {
      alert(`Registration failed: ${err?.shortMessage || err?.message || err}`);
    }
  };

  // Contract Actions: Add Trust
  const handleAddTrust = async (to: `0x${string}`, action: string, proof: `0x${string}`) => {
    if (!account || !window.ethereum) return;
    try {
      const walletClient = createWalletClient({
        chain: monadTestnet,
        transport: custom(window.ethereum),
      });

      if (KOLIANCE_ADDRESS && KOLIANCE_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        const hash = await walletClient.writeContract({
          address: KOLIANCE_ADDRESS,
          abi: KOLIANCE_ABI,
          functionName: "addTrust",
          args: [to, action, proof],
          account,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await fetchData();
        return hash;
      }
    } catch (err: any) {
      alert(`Trust attestation failed: ${err?.shortMessage || err?.message || err}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-purple-500 selection:text-white relative">
      {/* World-Class Cursor Trail Particle Ribbon */}
      <CursorTrail />

      {/* Top Fixed Navigation: INDEX | DETAIL | PRODUCT | AGENTCARD */}
      <Navbar
        currentView={currentView}
        onSelectView={(view) => {
          // PERP and MARKET are separate routes, not tabs on this page. Without
          // this redirect the nav item would select a view that renders nothing.
          if (view === "PERP") {
            router.push("/perp");
            return;
          }
          if (view === "MARKET") {
            router.push("/market");
            return;
          }
          setCurrentView(view);
        }}
        account={account}
        balance={balance}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Dynamic View Panels */}
      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          {/* TAB 1: INDEX (Option 1: 3D Crystalline Energy Core + 10,000 TPS Speedometer) */}
          {currentView === "INDEX" && (
            <motion.div
              key="view-index"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="w-full"
            >
              {/* Official Production Hero with Vision and Language Switcher */}
              <HeroGsap
                onRegisterClick={() => setCurrentView("PRODUCT")}
                onExploreClick={() => setCurrentView("DETAIL")}
              />

              {/* Kinetic Scroll Typography Marquee */}
              <KineticScrollBanner />

              {/* Scroll-Driven Agent Narrative Flow & Living Holographic Card */}
              <AgentNarrativeFlow onOpenConsole={() => setCurrentView("CONSOLE")} />

              {/* Full-Screen Pinned ScrollTrigger Protocol Trilogy */}
              <QuantumProtocolStream />

              {/* Minimalist Swiss Hairline Gateway Rails */}
              <MinimalistGatewayRails onSelectView={setCurrentView} />
            </motion.div>
          )}

          {/* TAB: TOKEN (KolToken KOL on Monad Testnet) */}
          {currentView === "TOKEN" && (
            <motion.div
              key="view-token"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-20 max-w-7xl mx-auto px-2 sm:px-6 py-4"
            >
              <TokenStudio
                account={account}
                nativeBalance={balance}
                onRefreshBalance={fetchData}
              />
            </motion.div>
          )}

          {/* TAB 2: DETAIL (1:1 Replica of Image 2) */}
          {currentView === "DETAIL" && (
            <motion.div
              key="view-detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-20 max-w-7xl mx-auto px-2 sm:px-6 py-4"
            >
              <TrustConstellation currentAccount={account} records={records} />
            </motion.div>
          )}

          {/* TAB 3: PRODUCT (1:1 Replica of Image 3 + Web3 Contract Studio) */}
          {currentView === "PRODUCT" && (
            <motion.div
              key="view-product"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-6"
            >
              {/* 1:1 Image 3 Dashboard & Holographic Certs */}
              <ProductStudio
                account={account}
                onStakeAction={() => setContractStudioOpen(true)}
                onRegisterAction={() => setContractStudioOpen(true)}
              />

              {/* Direct On-Chain Contract Studio Drawer/Section */}
              <div className="rounded-3xl bg-[#121622]/90 border border-white/10 p-6 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Shield className="w-5 h-5 text-cyan-400" />
                      <span>Monad On-Chain Smart Contract Attestation</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Direct contract: <code className="text-purple-300">{KOLIANCE_ADDRESS}</code> (Chain ID 10143)
                    </p>
                  </div>

                  <a
                    href={`${monadTestnet.blockExplorers.default.url}/address/${KOLIANCE_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-[#181d2c] border border-white/10 text-xs font-mono text-white hover:border-purple-400 transition flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>Sourcify Verified</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  </a>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <IdentityCard
                    account={account}
                    identity={identity}
                    isLoading={isLoading}
                    onRegister={handleRegister}
                  />

                  <TrustAttestationCard
                    account={account}
                    onAddTrust={handleAddTrust}
                  />
                </div>

                <TrustStream
                  records={records}
                  isLoading={isLoading}
                  onRefresh={fetchData}
                />
              </div>

              {/* Minimalist Gateway Rails */}
              <MinimalistGatewayRails onSelectView={setCurrentView} />
            </motion.div>
          )}

          {/* TAB 4: MARKET (Alpaca & Pyth Multi-Asset Terminal & Gatekeeper) */}
          {currentView === "MARKET" && (
            <motion.div
              key="view-market"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 py-4"
            >
              <MarketTerminal onTradeAction={() => setCurrentView("DETAIL")} />
            </motion.div>
          )}

          {/* TAB 5: AGENTCARD (6-Card Circulating Neural Asset Processor) */}
          {currentView === "AGENTCARD" && (
            <motion.div
              key="view-agentcard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-16 w-full h-[calc(100vh-64px)]"
            >
              <iframe
                src="/agentcard/index.html"
                className="w-full h-full border-0"
                title="AI Card Scanner // Neural Asset Processor"
              />
            </motion.div>
          )}

          {/* TAB 8: CONSOLE (Developer API, Quota Recharge, Playground & Telemetry) */}
          {currentView === "CONSOLE" && (
            <motion.div
              key="view-console"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 py-4"
            >
              <DeveloperConsole currentAccount={account} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Footer (shown when not in full-screen AGENTCARD scanner) */}
      {currentView !== "AGENTCARD" && (
        <footer className="border-t border-white/10 py-6 px-4 sm:px-8 mt-12 bg-[#0d1017]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-3">
              <BrandIcon size={24} />
              <span className="font-extrabold text-white tracking-wider">KOLIANCE</span>
              <span className="text-white/20">|</span>
              <span>&copy; {new Date().getFullYear()} Monad Ecosystem Trust Architecture.</span>
            </div>

            <div className="flex items-center gap-5">
              <button onClick={() => setCurrentView("INDEX")} className="hover:text-white transition">
                INDEX
              </button>
              <button onClick={() => setCurrentView("DETAIL")} className="hover:text-white transition">
                DETAIL
              </button>
              <button onClick={() => setCurrentView("PRODUCT")} className="hover:text-white transition">
                PRODUCT
              </button>
              <button onClick={() => setCurrentView("MARKET")} className="hover:text-white transition">
                MARKET
              </button>
              <button onClick={() => setCurrentView("AGENTCARD")} className="text-cyan-400 hover:text-cyan-300 transition">
                AGENTCARD
              </button>
              <a
                href="https://docs.monad.xyz"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition flex items-center gap-1"
              >
                <span>Docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://testnet.monadexplorer.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition flex items-center gap-1"
              >
                <span>Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://github.com/monad-developers/hardhat3-monad"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition flex items-center gap-1"
              >
                <Github className="w-3.5 h-3.5" />
                <span>Hardhat</span>
              </a>
            </div>
          </div>
        </footer>
      )}

      {/* Network Switch Modal */}
      <NetworkModal
        isOpen={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
        onSwitch={handleSwitchNetwork}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1017] text-white flex items-center justify-center font-mono">Loading Koliance...</div>}>
      <MainContent />
    </Suspense>
  );
}
