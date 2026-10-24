"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { GlobalFooter } from "@/components/GlobalFooter";
import { useKolianceAuth } from "@/components/Providers";
import { ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, Lock, Mail, Bug } from "lucide-react";

export default function RefundAndSecurityPage() {
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
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>TRANSPARENCY, REFUND & SECURITY DISCLOSURE SPECIFICATION</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Refund & Security Policy
          </h1>
          <p className="text-slate-400">
            Last Updated: October 2026 · Effective Date: October 24, 2026
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-slate-300 leading-relaxed">
          {/* Part A: Refund Policy */}
          <section className="space-y-4 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span>Part I: Subscription & Quota Package Refund Policy</span>
            </h2>

            <div className="space-y-3 text-slate-300">
              <p>
                We strive for absolute transparency in our developer billing. Our refund framework is structured as follows:
              </p>

              <div className="space-y-2.5 pt-1">
                <div className="p-3.5 rounded-md bg-[#090c13] border border-white/5 space-y-1">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>14-Day Unused Quota Refund Window</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    If you purchase a Growth Pro ($19.90) or Enterprise Scale ($149.00) package and determine that the service does not meet your technical requirements, you may request a pro-rata or full refund within 14 calendar days of purchase, provided that the majority of the API calls remain unconsumed.
                  </p>
                </div>

                <div className="p-3.5 rounded-md bg-[#090c13] border border-white/5 space-y-1">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Free Starter Pack (Zero Financial Liability)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    The Starter Pack ($0.00 / 100 API Calls) is 100% complimentary and requires no payment method. Because no monetary charge is incurred, no refund process applies.
                  </p>
                </div>

                <div className="p-3.5 rounded-md bg-[#090c13] border border-white/5 space-y-1">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
                    <span>On-Chain Finality & Gas Fee Exclusions</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Transactions broadcast to the Monad Testnet (such as contract deployments, liquidity staking, or DEX trading fees) consume decentralized validator gas and execute via immutable smart contracts. On-chain gas fees and realized trading PnL cannot be refunded or reversed.
                  </p>
                </div>
              </div>

              <div className="pt-2 text-slate-400">
                To initiate a quota refund inquiry, send your purchase receipt, wallet address, and Order Hash to <code className="text-cyan-300">developer@koliance.io</code>. Requests are processed within 3 business days.
              </div>
            </div>
          </section>

          {/* Part B: Security Architecture */}
          <section className="space-y-4 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span>Part II: Security Engineering & Risk Architecture</span>
            </h2>

            <p>
              Security and cryptographic solvency are paramount in Koliance. Our protocol enforces rigorous defensive engineering principles:
            </p>

            <ul className="space-y-2 list-disc list-inside text-slate-400">
              <li>
                <strong className="text-white">Strict BigInt Math Parity:</strong> Off-chain liquidation calculations in TypeScript and Go match on-chain smart contract thresholds with zero truncation drift (GAP-06 / GAP-14 compliance).
              </li>
              <li>
                <strong className="text-white">Session Key Circuit Breakers:</strong> Every EIP-712 delegated session key is bound by strict parameters (<code className="text-cyan-300">maxPerTxUSD</code>, <code className="text-cyan-300">dailyLimitUSD</code>). Account owners can freeze or revoke keys on-chain immediately in the event of an agent anomaly.
              </li>
              <li>
                <strong className="text-white">Database Least Privilege:</strong> High-concurrency backend services operate with stripped database privileges; client-facing endpoints cannot directly alter user trust tiers or credit balances.
              </li>
            </ul>
          </section>

          {/* Part C: Responsible Disclosure & Bug Bounty */}
          <section className="space-y-4 p-5 rounded-lg bg-[#111420] border border-white/10">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Bug className="w-4 h-4 text-emerald-400" />
              <span>Part III: Vulnerability Disclosure & Bug Bounty (Safe Harbor)</span>
            </h2>

            <p>
              We welcome independent security researchers, smart contract auditors, and developers to test our infrastructure. We commit to a comprehensive Safe Harbor policy for whitehat disclosures.
            </p>

            <div className="p-3.5 rounded-md bg-[#090c13] border border-white/5 space-y-2">
              <div className="text-white font-semibold">Responsible Disclosure Protocol:</div>
              <ol className="space-y-1.5 list-decimal list-inside text-slate-400 text-[11px]">
                <li>Report discovered vulnerabilities confidentially to <code className="text-cyan-300">developer@koliance.io</code> or <code className="text-cyan-300">iasi777work@gmail.com</code> before making any public disclosure.</li>
                <li>Include a reproducible proof of concept (PoC) and clear technical steps.</li>
                <li>Avoid privacy violations, destruction of data, or interruption of service to other network participants.</li>
                <li>Allow our engineering team up to 48 hours for initial triage and assessment.</li>
              </ol>
            </div>

            <p className="text-slate-400 text-[11px]">
              Critical vulnerabilities in smart contracts or solvency mechanisms that are reported in accordance with this policy are eligible for rewards and public recognition in our security acknowledgements.
            </p>
          </section>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
