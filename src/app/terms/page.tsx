"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { GlobalFooter } from "@/components/GlobalFooter";
import { useKolianceAuth } from "@/components/Providers";
import { Shield, FileText, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export default function TermsPage() {
  const router = useRouter();
  const { address: authAddress, login: authLogin, logout: authLogout } = useKolianceAuth();

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

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-28 pb-16 font-mono text-xs">
        {/* Header */}
        <div className="space-y-3 mb-10 pb-6 border-b border-white/10">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
            <FileText className="w-3.5 h-3.5" />
            <span>LEGAL & COMPLIANCE SPECIFICATION</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-slate-400">
            Last Updated: October 2026 · Effective Date: October 24, 2026
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">1.</span> Acceptance of Terms
            </h2>
            <p>
              By accessing, browsing, interacting with smart contracts, or utilizing APIs provided by Koliance (&quot;Protocol&quot;, &quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you must immediately cease accessing the Protocol and refrain from calling our smart contract interfaces or APIs.
            </p>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">2.</span> Decentralized Protocol & Smart Contract Interaction
            </h2>
            <p>
              Koliance provides decentralized identity attestations, neural Agent Cards, perpetual trading solvency rails, and EIP-712 session key delegation infrastructure deployed on Monad Testnet (Chain ID: 10143).
            </p>
            <ul className="space-y-2 list-disc list-inside text-slate-400">
              <li>
                <strong className="text-white">Self-Custodial Architecture:</strong> You maintain sole custody and control over your cryptographic private keys, seed phrases, and delegated session keys. We never store, transmit, or hold plaintext private keys.
              </li>
              <li>
                <strong className="text-white">On-Chain Finality:</strong> All transactions committed to Monad testnet or mainnet are immutable, irreversible, and subject to native gas fees and validator consensus rules.
              </li>
              <li>
                <strong className="text-white">Session Key Authorization:</strong> When you delegate signing authority via <code className="text-purple-300">SessionKeyRegistry.sol</code>, you explicitly authorize designated autonomous agents to initiate transactions within pre-configured bounds (<code className="text-cyan-300">maxPerTxUSD</code>, <code className="text-cyan-300">dailyLimitUSD</code>, and whitelisted contract methods).
              </li>
            </ul>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">3.</span> Developer API Services & Quota Usage
            </h2>
            <p>
              Access to the Koliance BFF Developer Gateway, real-time Pyth / Alpaca market quotes, and quota packages is governed by the following rules:
            </p>
            <ul className="space-y-2 list-disc list-inside text-slate-400">
              <li>
                <strong className="text-white">Fair Usage & Rate Limiting:</strong> Requests exceeding your allocated tier limits (Starter: 60 RPM; Growth Pro: 300 RPM; Enterprise Scale: 1,200 RPM) will be gated with standard HTTP 429 status codes.
              </li>
              <li>
                <strong className="text-white">API Key Security:</strong> You are responsible for safeguarding your API keys. Any action taken via your API credentials will be deemed executed by your account.
              </li>
              <li>
                <strong className="text-white">Quota Allocation:</strong> Starter free packages are limited to 3 claims per unique wallet. Fraudulent sybil claims or denial-of-service abuse will result in immediate API key suspension.
              </li>
            </ul>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">4.</span> Disclaimers & Limitation of Liability
            </h2>
            <p>
              THE PROTOCOL, APIS, AND SMART CONTRACTS ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
            </p>
            <p className="text-slate-400">
              In no event shall Koliance contributors, authors, or affiliates be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including loss of funds, smart contract exploits, liquidation events, or network downtime) arising out of or in connection with the use or inability to use the Protocol.
            </p>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">5.</span> Open Source License & Intellectual Property
            </h2>
            <p>
              Koliance smart contracts, documentation, and frontend client code are distributed under the standard <strong className="text-white">MIT License</strong>. You are permitted to inspect, fork, modify, and audit the repository in accordance with open-source software practices.
            </p>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">6.</span> Amendments & Contact
            </h2>
            <p>
              We reserve the right to update these Terms at any time. Changes will be effective immediately upon publication on this page with an updated timestamp. For legal inquiries or clarifications, contact <code className="text-cyan-300">developer@koliance.io</code>.
            </p>
          </section>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
