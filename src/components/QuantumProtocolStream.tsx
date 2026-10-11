"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLanguage } from "@/lib/i18n";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function QuantumProtocolStream() {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePhase, setActivePhase] = useState<0 | 1 | 2>(0);

  const phases = [
    {
      index: "01",
      code: "IDENTITY",
      spec: "EIP-712 DELEGATION // CRYPTOGRAPHIC ROOT",
      question: t("problem.identity_desc"),
      solution: t("problem.identity_sol"),
      metric: "ZERO MASTER KEY EXPOSURE",
      coordinates: "MONAD:0x01 // IDENTITY_ROOT",
    },
    {
      index: "02",
      code: "REPUTATION",
      spec: "ZK-PROOFS // STEAM & GITHUB ATTESTATION",
      question: t("problem.trust_desc"),
      solution: t("problem.trust_sol"),
      metric: "DETERMINISTIC CREDIT MATRIX",
      coordinates: "PROOF:0x02 // ATTESTATION_STREAM",
    },
    {
      index: "03",
      code: "EXECUTION",
      spec: "PROGRAMMABLE SESSIONS // CIRCUIT BREAKERS",
      question: t("problem.access_desc"),
      solution: t("problem.access_sol"),
      metric: "MONOTONIC REVOCATION & DAILY LIMITS",
      coordinates: "SETTLE:0x03 // FINANCIAL_GUARD",
    },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    const container = containerRef.current;
    if (!section || !container) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "+=220%",
        pin: true,
        scrub: 0.6,
        onUpdate: (self) => {
          const progress = self.progress;
          if (progress < 0.33) {
            setActivePhase(0);
          } else if (progress < 0.66) {
            setActivePhase(1);
          } else {
            setActivePhase(2);
          }
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  const cur = phases[activePhase];

  return (
    <section ref={sectionRef} className="relative w-full min-h-screen bg-transparent flex flex-col justify-center px-4 sm:px-8 py-20 select-none">
      <div ref={containerRef} className="max-w-7xl mx-auto w-full space-y-16">
        {/* Top Minimalist Hairline Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6 font-mono text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-white font-bold tracking-widest uppercase">
              {t("problem.title")}
            </span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-slate-400 tracking-wider">
            <span>{cur.coordinates}</span>
            <span className="text-white/20">{"//"}</span>
            <span className="text-cyan-400 font-bold">PHASE [{cur.index}/03]</span>
          </div>
        </div>

        {/* Big Kinetic Phase Typography */}
        <div className="space-y-6">
          <div className="text-xs font-mono tracking-widest text-monad-400 uppercase">
            {cur.spec}
          </div>
          <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white leading-none uppercase font-mono">
            {cur.code}
          </h2>
          <div className="max-w-3xl space-y-4 pt-4">
            <p className="text-lg sm:text-2xl text-slate-300 font-light leading-relaxed">
              {cur.question}
            </p>
            <div className="pt-2 text-sm sm:text-base font-mono text-cyan-300 leading-relaxed border-l-2 border-cyan-400 pl-4 bg-cyan-950/10 py-2">
              {cur.solution}
            </div>
          </div>
        </div>

        {/* Phase Indicator Track */}
        <div className="pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {phases.map((p, idx) => (
              <button
                key={p.index}
                onClick={() => setActivePhase(idx as 0 | 1 | 2)}
                className={`text-xs font-mono px-4 py-2 rounded-full border transition-all cursor-pointer ${
                  activePhase === idx
                    ? "bg-white text-black border-white font-bold"
                    : "bg-transparent text-slate-400 border-white/10 hover:border-white/30"
                }`}
              >
                {p.index} {"//"} {p.code}
              </button>
            ))}
          </div>

          <div className="font-mono text-xs text-slate-400 flex items-center gap-2">
            <span className="text-cyan-400 font-semibold">[SPECIFICATION]</span>
            <span>{cur.metric}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
