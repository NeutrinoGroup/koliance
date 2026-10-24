"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { GlobalFooter } from "@/components/GlobalFooter";
import { useKolianceAuth } from "@/components/Providers";
import {
  Terminal,
  BookOpen,
  Code2,
  ShieldCheck,
  Cpu,
  KeyRound,
  ExternalLink,
  Layers,
  Check,
  Copy,
  Activity,
  Coins,
  Network,
} from "lucide-react";

export default function DocsPage() {
  const router = useRouter();
  const { address: authAddress, login: authLogin, logout: authLogout } = useKolianceAuth();
  const [activeSection, setActiveSection] = useState("quickstart");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleSelectView = (view: NavView) => {
    if (view === "INDEX") {
      router.push("/");
    } else if (view === "TOKEN") {
      router.push("/token");
    } else if (view === "PERP") {
      router.push("/perp");
    } else if (view === "MARKET") {
      router.push("/market");
    } else if (view === "CONSOLE") {
      router.push("/console");
    } else {
      router.push(`/?view=${view}`);
    }
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const SECTIONS = [
    { id: "quickstart", label: "1. Quickstart & Sandbox" },
    { id: "architecture", label: "2. Protocol Architecture" },
    { id: "session-keys", label: "3. EIP-712 Session Keys" },
    { id: "api-reference", label: "4. Developer API Reference" },
    { id: "smart-contracts", label: "5. Smart Contracts & Addresses" },
    { id: "error-handling", label: "6. Error Handling (ADR-006)" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col font-sans selection:bg-purple-500/30">
      <CursorTrail />
      <Navbar
        currentView={"INDEX" as NavView}
        onSelectView={handleSelectView}
        account={authAddress || null}
        balance="0.00"
        onConnect={authLogin}
        onDisconnect={authLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header Strip */}
        <div className="mb-10 pb-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono">
              <BookOpen className="w-3.5 h-3.5" />
              <span>KOLIANCE DEVELOPER SPECIFICATION V1.0</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
              Documentation & API Reference
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              The verifiable trust, dynamic neural agent cards, and cryptographic settlement layer on Monad parallel EVM.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/console"
              className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98]"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Launch Console</span>
            </Link>
            <Link
              href="/pricing"
              className="h-9 px-4 rounded-md bg-[#161a29] hover:bg-[#1e2337] border border-white/10 text-slate-200 font-mono text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <Coins className="w-3.5 h-3.5 text-cyan-400" />
              <span>Pricing & Quota</span>
            </Link>
          </div>
        </div>

        {/* Two-Column Docs Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sticky Sidebar */}
          <aside className="lg:col-span-1 space-y-2 lg:sticky lg:top-28 h-fit">
            <div className="text-xs font-mono font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
              Table of Contents
            </div>
            <nav className="space-y-1 font-mono text-xs">
              {SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => {
                    setActiveSection(sec.id);
                    document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between cursor-pointer ${
                    activeSection === sec.id
                      ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-purple-400"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{sec.label}</span>
                </button>
              ))}
            </nav>

            <div className="pt-6 border-t border-white/10 space-y-3">
              <div className="text-xs font-mono text-slate-400 px-3">Network Status</div>
              <div className="p-3 rounded-lg bg-[#111420] border border-white/10 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain:</span>
                  <span className="text-white font-semibold">Monad Testnet</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain ID:</span>
                  <span className="text-cyan-300">10143</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target TPS:</span>
                  <span className="text-emerald-400">10,000 TPS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block Time:</span>
                  <span className="text-purple-300">~1.0 Second</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Main Content */}
          <div className="lg:col-span-3 space-y-14 font-mono text-xs">
            {/* 1. Quickstart & Sandbox */}
            <section id="quickstart" className="space-y-4 scroll-mt-28">
              <div className="border-b border-white/10 pb-2">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span>1. Quickstart & Sandbox Testing</span>
                </h2>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Developers can interact with Koliance via our RESTful BFF Gateway or directly query Monad smart contracts. To get started without billing credentials, every newly connected wallet receives 3 free Starter Claims (100 calls each).
              </p>

              <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Step 1: Test Market Query via Curl</span>
                  <button
                    onClick={() => handleCopy(`curl -X GET "https://koliance.vercel.app/api/market?symbol=NVDA" -H "Accept: application/json"`, "curl-quick")}
                    className="h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 text-[11px] transition"
                  >
                    {copiedCode === "curl-quick" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode === "curl-quick" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-md bg-[#090c13] text-cyan-300 overflow-x-auto text-[11px] leading-relaxed border border-white/5">
                  <code>{`curl -X GET "https://koliance.vercel.app/api/market?symbol=NVDA" \\
  -H "Accept: application/json"`}</code>
                </pre>
                <div className="text-slate-400 text-[11px]">
                  Sample JSON Output:
                </div>
                <pre className="p-3 rounded-md bg-[#090c13] text-slate-300 overflow-x-auto text-[11px] leading-relaxed border border-white/5">
                  <code>{`{
  "code": 200,
  "message": "Market quote retrieved successfully",
  "data": {
    "symbol": "NVDA",
    "price": 142.50,
    "source": "ALPACA_REALTIME",
    "timestamp": 1729761200
  }
}`}</code>
                </pre>
              </div>
            </section>

            {/* 2. Protocol Architecture */}
            <section id="architecture" className="space-y-4 scroll-mt-28">
              <div className="border-b border-white/10 pb-2">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-400" />
                  <span>2. Protocol Architecture & Monad Parallel EVM</span>
                </h2>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Koliance is engineered to exploit the parallel execution pipeline and sub-second finality of Monad (Chain ID 10143). By segregating state writes across isolated account paths, high-frequency AI agent settlements and dynamic attestation mints bypass typical EVM gas spikes and mempool contention.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Cryptographic Identity Layer</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Dynamic neural Agent Cards attest Web3 wallet activity, GitHub commit velocity, and Steam achievements into deterministic on-chain trust scores.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>Autonomous Settlement Rails</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Perpetual contract positions, oracle aggregation (Pyth & Alpaca), and session-delegated transaction batching provide sub-second solvency validation.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. EIP-712 Session Keys */}
            <section id="session-keys" className="space-y-4 scroll-mt-28">
              <div className="border-b border-white/10 pb-2">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-400" />
                  <span>3. EIP-712 Session Key Delegation</span>
                </h2>
              </div>
              <p className="text-slate-300 leading-relaxed">
                To allow AI agents to trade and consume computational resources without holding primary private keys or prompting manual wallet signatures, Koliance enforces typed structured EIP-712 session key delegations via <code className="text-purple-300">SessionKeyRegistry.sol</code>.
              </p>

              <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-2">
                <div className="text-white font-semibold">Strict Cryptographic Security Constraints:</div>
                <ul className="space-y-1.5 text-slate-300 text-[11px]">
                  <li>• <strong className="text-white">maxPerTxUSD:</strong> Strict single-transaction expenditure ceiling.</li>
                  <li>• <strong className="text-white">dailyLimitUSD:</strong> 24-hour rolling cumulative consumption cap.</li>
                  <li>• <strong className="text-white">allowedMCCs:</strong> Whitelisted Merchant Category Codes / Smart Contract methods.</li>
                  <li>• <strong className="text-white">Emergency Circuit Breaker:</strong> Account owners can freeze or revoke session keys instantly on-chain.</li>
                </ul>
              </div>
            </section>

            {/* 4. Developer API Reference */}
            <section id="api-reference" className="space-y-4 scroll-mt-28">
              <div className="border-b border-white/10 pb-2">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-purple-400" />
                  <span>4. Developer API Reference</span>
                </h2>
              </div>
              <p className="text-slate-300 leading-relaxed">
                All API endpoints accept JSON payloads and authenticate via the <code className="text-cyan-300">x-api-key</code> request header or EIP-712 bearer signatures.
              </p>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold text-[10px]">GET</span>
                    <span className="text-white font-bold">/api/market</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Fetch live price quotes, 24h change, and Pyth / Alpaca oracle status.
                  </p>
                  <div className="text-slate-500 text-[10px]">
                    Parameters: <code className="text-cyan-300">symbol</code> (e.g. NVDA, AAPL, BTC, ETH)
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold text-[10px]">GET</span>
                    <span className="text-white font-bold">/api/console/api-keys</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Query remaining API quota, tier status, active session keys, and 24h volume.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#111420] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[10px]">POST</span>
                    <span className="text-white font-bold">/api/v1/settlement/commit</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Commit an autonomous agent payment transaction with Monad block receipt validation.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. Smart Contracts & Addresses */}
            <section id="smart-contracts" className="space-y-4 scroll-mt-28">
              <div className="border-b border-white/10 pb-2">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <span>5. Smart Contracts & Monad Testnet Addresses</span>
                </h2>
              </div>
              <p className="text-slate-300 leading-relaxed">
                The authoritative trust registries and settlement contracts deployed on Monad Testnet (Chain ID 10143):
              </p>

              <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#111420]">
                <table className="w-full text-left font-mono text-[11px] text-slate-300">
                  <thead className="bg-[#161a29] text-white border-b border-white/10">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Contract</th>
                      <th className="py-2.5 px-4 font-semibold">Address on Monad Testnet</th>
                      <th className="py-2.5 px-4 font-semibold">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-white">Koliance Core Trust Registry</td>
                      <td className="py-2.5 px-4 text-cyan-300">0x6291C790dbB41198c69781B2B7a01d674843b0C5</td>
                      <td className="py-2.5 px-4">
                        <a
                          href="https://testnet.monadexplorer.com/address/0x6291C790dbB41198c69781B2B7a01d674843b0C5"
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-300 hover:text-white flex items-center gap-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-white">SessionKeyRegistry (EIP-712)</td>
                      <td className="py-2.5 px-4 text-cyan-300">0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D</td>
                      <td className="py-2.5 px-4">
                        <a
                          href="https://testnet.monadexplorer.com/address/0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D"
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-300 hover:text-white flex items-center gap-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-white">PositionManager (Perp Engine)</td>
                      <td className="py-2.5 px-4 text-cyan-300">0x3fCeD0662657e0C3a2aF8A80e3A4cDb8A7d1d2C4</td>
                      <td className="py-2.5 px-4">
                        <a
                          href="https://testnet.monadexplorer.com/address/0x3fCeD0662657e0C3a2aF8A80e3A4cDb8A7d1d2C4"
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-300 hover:text-white flex items-center gap-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 6. Error Handling (ADR-006) */}
            <section id="error-handling" className="space-y-4 scroll-mt-28">
              <div className="border-b border-white/10 pb-2">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>6. Standardized Error Handling (ADR-006)</span>
                </h2>
              </div>
              <p className="text-slate-300 leading-relaxed">
                In compliance with architectural decision record ADR-006, all gateway errors return closed-set status codes with machine-parseable error descriptors:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 rounded-md bg-[#111420] border border-white/10">
                  <span className="font-bold text-white">400 Bad Request:</span>
                  <p className="text-slate-400">Malformed parameter, invalid signature, or zero address.</p>
                </div>
                <div className="p-3 rounded-md bg-[#111420] border border-white/10">
                  <span className="font-bold text-white">401 Unauthorized:</span>
                  <p className="text-slate-400">Missing or expired API key or invalid session signature.</p>
                </div>
                <div className="p-3 rounded-md bg-[#111420] border border-white/10">
                  <span className="font-bold text-white">429 Rate Limit Exceeded:</span>
                  <p className="text-slate-400">Exceeded tier RPM limit (60, 300, or 1,200 RPM).</p>
                </div>
                <div className="p-3 rounded-md bg-[#111420] border border-white/10">
                  <span className="font-bold text-white">503 Service Unavailable:</span>
                  <p className="text-slate-400">Upstream RPC degradation or Go gateway unreachable.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
