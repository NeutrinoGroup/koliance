"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { GlobalFooter } from "@/components/GlobalFooter";
import { useKolianceAuth } from "@/components/Providers";
import {
  Check,
  Zap,
  Shield,
  Layers,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Terminal,
  Activity,
  CreditCard,
  Lock,
} from "lucide-react";

export default function PricingPage() {
  const router = useRouter();
  const { address: authAddress, login: authLogin, logout: authLogout } = useKolianceAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

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

  const TIERS = [
    {
      id: "starter",
      name: "STARTER PACK",
      badge: "FREE TRIAL",
      badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
      price: "$0.00",
      period: "forever / 3 claims",
      description: "Ideal for individual developers, AI agent trial testing, and smart contract identity verification.",
      quota: "100 API Calls per claim (Up to 300 Free Calls)",
      rpm: "60 RPM",
      features: [
        "100 API Calls Included per claim",
        "3 Free Starter Claims per registered wallet",
        "EIP-712 Session Key Delegation support",
        "Public Monad Testnet (Chain ID 10143) RPC access",
        "Real-time Alpaca & Pyth Market Quotes",
        "Community & GitHub Discussions support",
      ],
      ctaText: "Start Free Now",
      ctaLink: "/console",
      ctaPrimary: false,
      recommended: false,
    },
    {
      id: "growth",
      name: "GROWTH PRO",
      badge: "RECOMMENDED // POPULAR",
      badgeColor: "bg-purple-500/10 text-purple-300 border-purple-500/30",
      price: "$19.90",
      period: "per 10,000 calls",
      discount: "15% discount when settled via KOL Token",
      description: "Engineered for high-frequency trading bots, autonomous agents, and production application backends.",
      quota: "10,000 API Calls",
      rpm: "300 RPM Peak Concurrency",
      features: [
        "10,000 Verified API Requests included",
        "300 RPM Peak Concurrency lane",
        "Priority Settlement Batch with Monad Parallel EVM",
        "Custom Session Key spend limits ($100/tx, $300/day)",
        "Zero-truncation price feed synchronization",
        "99.9% API Uptime SLA Guarantee",
        "Dedicated Developer Email & Discord ticketing",
      ],
      ctaText: "Get Growth Pro",
      ctaLink: "/console",
      ctaPrimary: true,
      recommended: true,
    },
    {
      id: "enterprise",
      name: "ENTERPRISE SCALE",
      badge: "ENTERPRISE",
      badgeColor: "bg-slate-500/10 text-slate-300 border-white/10",
      price: "$149.00",
      period: "per 100,000 calls",
      description: "Custom high-throughput pipelines, institutional market access, and dedicated Monad execution infrastructure.",
      quota: "100,000 API Calls",
      rpm: "1,200 RPM Dedicated Queue",
      features: [
        "100,000 Verified API Requests included",
        "1,200 RPM Dedicated Queue with isolated rate limiter",
        "Custom Monad execution lane & sub-second finality priority",
        "Unlimited Session Key Delegation & custom MCC whitelisting",
        "Direct Corporate Wire & Invoicing via Stripe",
        "99.98% High-Availability SLA",
        "24/7 Dedicated Technical Architect support",
      ],
      ctaText: "Subscribe Enterprise",
      ctaLink: "/console",
      ctaPrimary: false,
      recommended: false,
    },
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
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>TRANSPARENT TIER ALLOCATION · NO HIDDEN FEES</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-mono">
            Predictable Pricing for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300">Autonomous Web3 & AI Agents</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 font-mono leading-relaxed">
            Scale seamlessly from hackathons to enterprise autonomous trading. Every registered account includes 3 free Starter packs with zero credit card required.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-20">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`p-6 sm:p-8 rounded-lg flex flex-col justify-between space-y-6 transition-all duration-200 border ${
                tier.recommended
                  ? "bg-[#141828] border-purple-500/40 shadow-xl shadow-purple-950/20 ring-1 ring-purple-500/30 relative"
                  : "bg-[#111420] border-white/10 hover:border-white/20 shadow-md"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-mono px-2.5 py-1 rounded-md border font-semibold ${tier.badgeColor}`}>
                    {tier.badge}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{tier.rpm}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-4xl font-extrabold text-white tracking-tight">{tier.price}</span>
                    <span className="text-xs text-slate-400 font-normal">/ {tier.period}</span>
                  </div>
                  {tier.discount && (
                    <div className="text-xs font-mono text-emerald-400 font-medium">
                      {tier.discount}
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                  {tier.description}
                </p>

                <div className="pt-3 border-t border-white/10 space-y-2.5">
                  <div className="text-xs font-mono text-cyan-300 font-semibold">
                    Capacity: {tier.quota}
                  </div>
                  <ul className="text-xs font-mono text-slate-300 space-y-2">
                    {tier.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <Link
                href={tier.ctaLink}
                className={`w-full h-10 px-4 rounded-md font-mono text-xs font-semibold transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                  tier.ctaPrimary
                    ? "bg-purple-600 hover:bg-purple-500 border-purple-500/40 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98]"
                    : "bg-[#181d2e] hover:bg-[#20273d] border-white/10 hover:border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-[0.98]"
                }`}
              >
                <span>{tier.ctaText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Feature Comparison Matrix */}
        <div className="mb-20 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight">
              Feature & Capability Comparison
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Detailed technical specifications across API rate limits, EIP-712 security bounds, and settlement guarantees.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#111420]">
            <table className="w-full text-left font-mono text-xs text-slate-300">
              <thead className="bg-[#161a29] text-white border-b border-white/10">
                <tr>
                  <th className="py-3 px-4 font-semibold">Capability</th>
                  <th className="py-3 px-4 font-semibold">Starter ($0)</th>
                  <th className="py-3 px-4 font-semibold text-purple-300">Growth Pro ($19.90)</th>
                  <th className="py-3 px-4 font-semibold">Enterprise ($149)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-3 px-4 font-medium text-white">Included API Calls</td>
                  <td className="py-3 px-4">100 / claim (Max 300 free)</td>
                  <td className="py-3 px-4 font-bold text-white">10,000 calls</td>
                  <td className="py-3 px-4 font-bold text-white">100,000 calls</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-white">Peak Rate Limit (RPM)</td>
                  <td className="py-3 px-4">60 RPM</td>
                  <td className="py-3 px-4">300 RPM</td>
                  <td className="py-3 px-4">1,200 RPM Dedicated</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-white">EIP-712 Session Keys</td>
                  <td className="py-3 px-4">Supported (Standard)</td>
                  <td className="py-3 px-4 text-emerald-400">Supported (Custom Caps)</td>
                  <td className="py-3 px-4 text-emerald-400">Unlimited / Multi-Agent</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-white">Monad 10,000 TPS Settlement</td>
                  <td className="py-3 px-4">Standard lane</td>
                  <td className="py-3 px-4">Priority batch</td>
                  <td className="py-3 px-4 font-bold text-cyan-300">Dedicated execution lane</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-white">Market Quotes & Gatekeeper</td>
                  <td className="py-3 px-4">Alpaca & Pyth feeds</td>
                  <td className="py-3 px-4">Zero-truncation real-time</td>
                  <td className="py-3 px-4">Institutional streaming</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-white">SLA Uptime Commitment</td>
                  <td className="py-3 px-4">Community best-effort</td>
                  <td className="py-3 px-4">99.9% Uptime</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">99.98% High Availability</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-white">Payment Methods</td>
                  <td className="py-3 px-4">Free testnet claim</td>
                  <td className="py-3 px-4">KOL Token (-15%) / Stripe</td>
                  <td className="py-3 px-4">Corporate Wire / Stripe / KOL</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing FAQ Section */}
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Everything you need to know about Koliance API subscriptions, session keys, and billing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-2">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>How does the Free Starter Pack work?</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Every newly registered wallet address is entitled to 3 free claims of the Starter Pack. Each claim credits 100 verified API calls (total 300 calls) directly into your developer account, valid for test scripts, agent prototyping, and market queries.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-2">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Can I pay with KOL Tokens?</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Yes. Paying for Growth Pro or Enterprise packages via native KOL tokens unlocks an automatic 15% discount. Transactions are settled autonomously on Monad Testnet with immediate on-chain audit receipts.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-2">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>What happens when my quota is exhausted?</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                When remaining quota reaches 0, non-essential API endpoints will return standard 429 / 402 HTTP error codes according to ADR-006. Essential read calls to public smart contract state remain accessible via standard Monad RPC endpoints.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#111420] border border-white/10 space-y-2">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>What is the refund and cancellation policy?</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                We maintain an unspent balance refund policy within 14 calendar days of package purchase. Detailed terms and security guarantees are documented in our public Refund & Security Policy.
              </p>
            </div>
          </div>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
