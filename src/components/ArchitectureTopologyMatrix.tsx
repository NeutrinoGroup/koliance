"use client";

import React, { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Wallet, Gamepad2, CreditCard, TrendingUp, Layers } from "lucide-react";

export function ArchitectureTopologyMatrix() {
  const { t } = useLanguage();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const tiers = [
    {
      id: "core",
      title: t("matrix.core_infra"),
      badge: "ROOT LAYER",
      color: "cyan",
      icon: <Wallet className="w-4 h-4 text-cyan-400" />,
      items: [
        {
          key: "wallet_identity",
          name: t("matrix.wallet_identity"),
          desc: t("matrix.wallet_identity_role"),
          spec: "Solidity 0.8.31 / EVM Root",
        },
        {
          key: "session_registry",
          name: t("matrix.session_registry"),
          desc: t("matrix.session_registry_role"),
          spec: "EIP-712 Monotonic Revocation",
        },
        {
          key: "dynamic_wallet",
          name: t("matrix.dynamic_wallet"),
          desc: t("matrix.dynamic_wallet_role"),
          spec: "Zero Master Key Exposure",
        },
      ],
    },
    {
      id: "credit",
      title: t("matrix.credit_inputs"),
      badge: "PROOF ENGINE",
      color: "purple",
      icon: <Gamepad2 className="w-4 h-4 text-purple-400" />,
      items: [
        {
          key: "steam_github",
          name: t("matrix.steam_github"),
          desc: t("matrix.steam_github_role"),
          spec: "ZK-Attested Gamer & Dev Graph",
        },
        {
          key: "nansen_signals",
          name: t("matrix.nansen_signals"),
          desc: t("matrix.nansen_signals_role"),
          spec: "Smart Money Capital Router",
        },
      ],
    },
    {
      id: "gateway",
      title: t("matrix.financial_gateway"),
      badge: "EXECUTION RAILS",
      color: "emerald",
      icon: <CreditCard className="w-4 h-4 text-emerald-400" />,
      items: [
        {
          key: "agentcard",
          name: t("matrix.agentcard"),
          desc: t("matrix.agentcard_role"),
          spec: "6-Card Neural Asset Digitizer",
        },
        {
          key: "stripe",
          name: t("matrix.stripe"),
          desc: t("matrix.stripe_role"),
          spec: "Enterprise Fiat Settlement",
        },
      ],
    },
    {
      id: "settlement",
      title: t("matrix.settlement_signals"),
      badge: "CONSENSUS FINALITY",
      color: "amber",
      icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
      items: [
        {
          key: "monad_record",
          name: t("matrix.monad_record"),
          desc: t("matrix.monad_record_role"),
          spec: "10,000 TPS Single-Slot Ledger",
        },
        {
          key: "alpaca_perp",
          name: t("matrix.alpaca_perp"),
          desc: t("matrix.alpaca_perp_role"),
          spec: "Real-time Collateral Derivatives",
        },
        {
          key: "kol_token",
          name: t("matrix.kol_token"),
          desc: t("matrix.kol_token_role"),
          spec: "2^30 Max Supply · 2-Year Halving",
        },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-mono uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5" />
          <span>Architecture Taxonomy</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          {t("matrix.title")}
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
          {t("matrix.subtitle")}
        </p>
      </div>

      {/* 4 Connected Rack Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="rounded-3xl p-6 bg-[#111523]/80 border border-white/[0.08] hover:border-white/20 transition-all duration-300 space-y-4 shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                  {tier.icon}
                  <span>{tier.title}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400">
                  {tier.badge}
                </span>
              </div>

              <div className="space-y-3">
                {tier.items.map((item) => {
                  const isHovered = hoveredNode === item.key;
                  return (
                    <div
                      key={item.key}
                      onMouseEnter={() => setHoveredNode(item.key)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className={`p-3.5 rounded-2xl transition-all duration-200 border cursor-pointer space-y-1.5 ${
                        isHovered
                          ? "bg-white/[0.08] border-cyan-400/60 shadow-[0_0_20px_rgba(0,242,254,0.15)] translate-x-1"
                          : "bg-white/[0.02] border-white/[0.05] hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{item.name}</span>
                        <span className="text-[9px] font-mono text-cyan-400 px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20">
                          ACTIVE
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 leading-relaxed">{item.desc}</div>
                      <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-white/[0.04]">
                        {item.spec}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>SECURITY LEVEL: AUDITED</span>
              <span className="text-emerald-400 font-semibold">[VERIFIED]</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
