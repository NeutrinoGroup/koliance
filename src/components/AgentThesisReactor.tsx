"use client";

import React, { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { ShieldCheck, Award, CreditCard, ArrowRight, CheckCircle2, Cpu, Activity, Lock, Terminal } from "lucide-react";

export function AgentThesisReactor() {
  const { t } = useLanguage();
  const [activePillar, setActivePillar] = useState<0 | 1 | 2>(0);

  const pillars = [
    {
      id: 0,
      icon: <ShieldCheck className="w-6 h-6" />,
      tag: "PILLAR 01",
      title: t("problem.identity_title"),
      desc: t("problem.identity_desc"),
      solution: t("problem.identity_sol"),
      color: "cyan",
      spec: "EIP-712 ROOT DELEGATION · MONOTONIC NONCE",
      badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    },
    {
      id: 1,
      icon: <Award className="w-6 h-6" />,
      tag: "PILLAR 02",
      title: t("problem.trust_title"),
      desc: t("problem.trust_desc"),
      solution: t("problem.trust_sol"),
      color: "purple",
      spec: "STEAM & GITHUB ATTESTATION · ZK-PROOF VERIFIED",
      badgeColor: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    },
    {
      id: 2,
      icon: <CreditCard className="w-6 h-6" />,
      tag: "PILLAR 03",
      title: t("problem.access_title"),
      desc: t("problem.access_desc"),
      solution: t("problem.access_sol"),
      color: "emerald",
      spec: "MAX $500/TX · CIRCUIT BREAKER REVOCATION",
      badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    },
  ];

  const pipelineSteps = [
    { num: "01", label: t("problem.chain_step1"), detail: "EIP-712 Master & Ephemeral Nonce" },
    { num: "02", label: t("problem.chain_step2"), detail: "Cross-Platform Proof Validation" },
    { num: "03", label: t("problem.chain_step3"), detail: "Scoped Budgets & Emergency Freeze" },
    { num: "04", label: t("problem.chain_step4"), detail: "Autonomous Settlement on Monad" },
  ];

  return (
    <div className="space-y-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono uppercase tracking-wider">
          <Cpu className="w-3.5 h-3.5" />
          <span>Problem Definition &amp; Thesis</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          {t("problem.title")}
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
          {t("problem.subtitle")}
        </p>
      </div>

      {/* 3 Pillars Interactive Console */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {pillars.map((p) => {
          const isSelected = activePillar === p.id;
          return (
            <div
              key={p.id}
              onClick={() => setActivePillar(p.id as 0 | 1 | 2)}
              className={`rounded-3xl p-7 transition-all duration-300 cursor-pointer space-y-5 relative overflow-hidden border shadow-xl flex flex-col justify-between ${
                isSelected
                  ? "bg-[#141928] border-cyan-400/80 shadow-[0_15px_40px_rgba(0,242,254,0.15)] ring-1 ring-cyan-400/40"
                  : "bg-[#101422]/80 border-white/[0.08] hover:border-white/20 hover:bg-[#121626]"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-300 scale-105"
                        : "bg-white/[0.05] text-slate-400"
                    }`}
                  >
                    {p.icon}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 font-semibold">{p.tag}</span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>{p.title}</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono leading-relaxed">{p.desc}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs font-mono text-cyan-300 leading-relaxed">
                  {p.solution}
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>{p.spec}</span>
                {isSelected ? (
                  <span className="text-cyan-400 font-bold">[ACTIVE]</span>
                ) : (
                  <span className="text-slate-600">[SELECT]</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Economic Participation Pipeline Bus */}
      <div className="rounded-3xl bg-[#0c0f18] border border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Dynamic Glowing Bus Trace */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 opacity-60" />

        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-300">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>{t("problem.chain_title")}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">MONAD HIGH-THROUGHPUT PIPELINE</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {pipelineSteps.map((st) => (
            <div
              key={st.num}
              className="group relative p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-cyan-400/40 hover:bg-white/[0.04] transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400">STAGE {st.num}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white">{st.label}</div>
              <div className="text-[11px] font-mono text-slate-400">{st.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
