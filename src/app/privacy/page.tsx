"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { GlobalFooter } from "@/components/GlobalFooter";
import { useKolianceAuth } from "@/components/Providers";
import { Lock, ShieldCheck, Database, EyeOff, Server, FileText } from "lucide-react";

export default function PrivacyPage() {
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
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>DATA PRIVACY & CRYPTOGRAPHIC BOUNDARY SPECIFICATION</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-slate-400">
            Last Updated: October 2026 · Effective Date: October 24, 2026
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">1.</span> Privacy Principles & Zero Plaintext Credential Rule
            </h2>
            <p>
              At Koliance, privacy and self-sovereignty are built directly into our cryptographic architecture. We believe that user data should belong exclusively to the user. We adhere strictly to the following foundational rules:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-md bg-[#090c13] border border-white/5 space-y-1">
                <div className="text-white font-semibold flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4 text-emerald-400" />
                  <span>Zero Private Keys</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  We never solicit, store, or transmit your private keys, seed phrases, or master wallet secrets.
                </p>
              </div>
              <div className="p-3.5 rounded-md bg-[#090c13] border border-white/5 space-y-1">
                <div className="text-white font-semibold flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>Zero Data Reselling</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  We do not sell, rent, monetize, or broker personal identity information to advertising networks or third parties.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">2.</span> Information We Collect & Process
            </h2>
            <p>
              Depending on how you interact with the Koliance Protocol, we may process the following categories of data:
            </p>
            <ul className="space-y-2 list-disc list-inside text-slate-400">
              <li>
                <strong className="text-white">Public Blockchain Data:</strong> Your public Ethereum / Monad wallet address, on-chain transaction hashes, block receipts, token balances, and smart contract event logs. This information is public by nature of decentralized ledgers.
              </li>
              <li>
                <strong className="text-white">Third-Party Social Attestations:</strong> If you connect GitHub, Steam, or Google OAuth via Privy, we only store cryptographic identifiers (e.g. GitHub handle, commit hash proofs, Steam ID) required to mint and verify your on-chain Agent Card trust score.
              </li>
              <li>
                <strong className="text-white">API Usage & Telemetry:</strong> Anonymized request counts, rate-limit indicators, and response status codes to maintain gateway availability and enforce quota limits.
              </li>
            </ul>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">3.</span> Local Storage & Cookie Usage
            </h2>
            <p>
              Koliance uses minimal client-side <code className="text-purple-300">localStorage</code> exclusively for operational and user experience preferences:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-slate-400 text-[11px]">
              <li>Active language preference (<code className="text-cyan-300">en</code> / <code className="text-cyan-300">zh</code>).</li>
              <li>Recently viewed trading pairs and cached market quotes.</li>
              <li>Session state persistence via secure web3 providers (Privy / Wagmi).</li>
            </ul>
            <p className="text-slate-400">
              We do not deploy third-party behavioral tracking cookies or invasive cross-site marketing pixels.
            </p>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">4.</span> Cryptographic Boundary & EIP-712 Session Keys
            </h2>
            <p>
              When delegating session keys to autonomous AI agents:
            </p>
            <ul className="space-y-2 list-disc list-inside text-slate-400">
              <li>
                Session key authorizations are cryptographically signed using EIP-712 structured data and stored in the on-chain smart contract <code className="text-purple-300">SessionKeyRegistry.sol</code>.
              </li>
              <li>
                Temporary session keys are held locally in your browser memory or secure agent runtime and are never exposed in plaintext to centralized loggers.
              </li>
              <li>
                You can revoke or modify delegated session keys on-chain at any time, immediately invalidating downstream transactions.
              </li>
            </ul>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">5.</span> User Rights & Data Deletion
            </h2>
            <p>
              You maintain the right to disconnect your wallet, purge local cache, or request the dissociation of off-chain profile links. Note that data permanently committed to the Monad blockchain cannot be modified or deleted due to decentralized consensus finality.
            </p>
          </section>

          <section className="space-y-3 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="text-cyan-400">6.</span> Security Contact & Inquiries
            </h2>
            <p>
              For data protection questions, privacy audits, or responsible disclosure, please reach out to our security team at <code className="text-cyan-300">developer@koliance.io</code> or <code className="text-cyan-300">iasi777work@gmail.com</code>.
            </p>
          </section>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
