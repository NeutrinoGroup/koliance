"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n";
import { 
  ShieldCheck, 
  Award, 
  CreditCard, 
  ArrowRight, 
  Key, 
  Cpu, 
  Wallet, 
  Gamepad2, 
  GitBranch, 
  TrendingUp, 
  DollarSign, 
  Coins, 
  Layers, 
  CheckCircle2
} from "lucide-react";

export function CoreValueFramework() {
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 space-y-20">
      {/* 1. Core Problem & Value Proposition */}
      <div className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5" />
            <span>Problem Definition & Thesis</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            {t("problem.title")}
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            {t("problem.subtitle")}
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* Pillar 1: Identity */}
          <div className="rounded-3xl p-7 bg-[#121622]/90 border border-white/10 hover:border-cyan-500/40 transition-all duration-300 space-y-5 relative overflow-hidden shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{t("problem.identity_title")}</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                {t("problem.identity_desc")}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-300 font-mono">
              {t("problem.identity_sol")}
            </div>
          </div>

          {/* Pillar 2: Trust & Reputation */}
          <div className="rounded-3xl p-7 bg-[#121622]/90 border border-white/10 hover:border-purple-500/40 transition-all duration-300 space-y-5 relative overflow-hidden shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Award className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{t("problem.trust_title")}</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                {t("problem.trust_desc")}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-300 font-mono">
              {t("problem.trust_sol")}
            </div>
          </div>

          {/* Pillar 3: Financial Access */}
          <div className="rounded-3xl p-7 bg-[#121622]/90 border border-white/10 hover:border-emerald-500/40 transition-all duration-300 space-y-5 relative overflow-hidden shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{t("problem.access_title")}</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                {t("problem.access_desc")}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-300 font-mono">
              {t("problem.access_sol")}
            </div>
          </div>
        </div>

        {/* Sequential Progression Bar */}
        <div className="rounded-2xl bg-[#0e121c] border border-white/[0.08] p-6 shadow-inner">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-widest text-center mb-6">
            {t("problem.chain_title")}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold w-full md:w-auto justify-center">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>1. {t("problem.chain_step1")}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block" />
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold w-full md:w-auto justify-center">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              <span>2. {t("problem.chain_step2")}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block" />
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold w-full md:w-auto justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>3. {t("problem.chain_step3")}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block" />
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold w-full md:w-auto justify-center">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>4. {t("problem.chain_step4")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Strategic Functional Taxonomy Matrix */}
      <div className="space-y-8">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Column 1: Core Infrastructure */}
          <div className="rounded-3xl p-6 bg-[#121622]/80 border border-cyan-500/20 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider pb-2 border-b border-white/10">
              <Wallet className="w-4 h-4" />
              <span>{t("matrix.core_infra")}</span>
            </div>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.wallet_identity")}</div>
                <div className="text-xs text-slate-400">{t("matrix.wallet_identity_role")}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.session_registry")}</div>
                <div className="text-xs text-slate-400">{t("matrix.session_registry_role")}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.dynamic_wallet")}</div>
                <div className="text-xs text-slate-400">{t("matrix.dynamic_wallet_role")}</div>
              </div>
            </div>
          </div>

          {/* Column 2: Credit Inputs & Attestation */}
          <div className="rounded-3xl p-6 bg-[#121622]/80 border border-purple-500/20 space-y-4">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider pb-2 border-b border-white/10">
              <Gamepad2 className="w-4 h-4" />
              <span>{t("matrix.credit_inputs")}</span>
            </div>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.steam_github")}</div>
                <div className="text-xs text-slate-400">{t("matrix.steam_github_role")}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.nansen_signals")}</div>
                <div className="text-xs text-slate-400">{t("matrix.nansen_signals_role")}</div>
              </div>
            </div>
          </div>

          {/* Column 3: Financial Gateway */}
          <div className="rounded-3xl p-6 bg-[#121622]/80 border border-emerald-500/20 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider pb-2 border-b border-white/10">
              <CreditCard className="w-4 h-4" />
              <span>{t("matrix.financial_gateway")}</span>
            </div>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.agentcard")}</div>
                <div className="text-xs text-slate-400">{t("matrix.agentcard_role")}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.stripe")}</div>
                <div className="text-xs text-slate-400">{t("matrix.stripe_role")}</div>
              </div>
            </div>
          </div>

          {/* Column 4: Settlement & Sandbox */}
          <div className="rounded-3xl p-6 bg-[#121622]/80 border border-amber-500/20 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider pb-2 border-b border-white/10">
              <TrendingUp className="w-4 h-4" />
              <span>{t("matrix.settlement_signals")}</span>
            </div>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.monad_record")}</div>
                <div className="text-xs text-slate-400">{t("matrix.monad_record_role")}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.alpaca_perp")}</div>
                <div className="text-xs text-slate-400">{t("matrix.alpaca_perp_role")}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-sm font-bold text-white">{t("matrix.kol_token")}</div>
                <div className="text-xs text-slate-400">{t("matrix.kol_token_role")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
