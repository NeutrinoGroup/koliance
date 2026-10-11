"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLanguage } from "@/lib/i18n";
import { GlassBackground } from "@/components/GlassBackground";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function QuantumProtocolStream() {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);

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
    const cardsContainer = cardsContainerRef.current;
    const progressBar = progressBarRef.current;
    if (!section || !cardsContainer) return;

    const cards = Array.from(cardsContainer.querySelectorAll<HTMLElement>(".quantum-phase-card"));

    const ctx = gsap.context(() => {
      // Set initial state without blur distortion: card 0 fully visible, cards 1 & 2 invisible and offset
      gsap.set(cards[0], { opacity: 1, y: 0, pointerEvents: "auto" });
      gsap.set(cards.slice(1), { opacity: 0, y: 50, pointerEvents: "none" });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=300%",
          pin: true,
          scrub: 0.8,
          onUpdate: (self) => {
            const p = self.progress;
            if (progressBar) {
              progressBar.style.width = `${Math.min(100, Math.max(0, p * 100))}%`;
            }
            if (p < 0.35) {
              setActivePhaseIndex(0);
            } else if (p < 0.70) {
              setActivePhaseIndex(1);
            } else {
              setActivePhaseIndex(2);
            }
          },
        },
      });

      // Segment 1 -> Clean cross-fade transition from Card 0 to Card 1 (no blur)
      tl.to(cards[0], {
        opacity: 0,
        y: -40,
        pointerEvents: "none",
        duration: 1,
        ease: "power2.inOut",
      })
      .fromTo(
        cards[1],
        { opacity: 0, y: 50, pointerEvents: "none" },
        { opacity: 1, y: 0, pointerEvents: "auto", duration: 1, ease: "power2.inOut" },
        "-=0.6"
      )
      // Pause on Card 1
      .to({}, { duration: 0.5 })
      // Segment 2 -> Clean cross-fade transition from Card 1 to Card 2 (no blur)
      tl.to(cards[1], {
        opacity: 0,
        y: -40,
        pointerEvents: "none",
        duration: 1,
        ease: "power2.inOut",
      })
      .fromTo(
        cards[2],
        { opacity: 0, y: 50, pointerEvents: "none" },
        { opacity: 1, y: 0, pointerEvents: "auto", duration: 1, ease: "power2.inOut" },
        "-=0.6"
      )
      // Rest on Card 2
      .to({}, { duration: 0.5 });

    }, section);

    return () => ctx.revert();
  }, [t]);

  const activePhase = phases[activePhaseIndex];

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-screen bg-transparent flex flex-col justify-center px-4 sm:px-8 select-none overflow-hidden"
    >
      {/* Scoped Shader Glass Background starting specifically at "What Core Problem Does Koliance Solve?" */}
      <GlassBackground
        className="absolute inset-0 pointer-events-none -z-10 overflow-hidden"
        opacity="opacity-45"
      />

      <div className="max-w-7xl mx-auto w-full flex flex-col justify-between h-[82vh] py-6 z-10">
        {/* Top Minimalist Hairline Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.12] pb-6 font-mono text-xs text-slate-700">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-sm bg-cyan-600 animate-ping" />
            <span className="text-black font-extrabold tracking-widest uppercase">
              {t("problem.title")}
            </span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-slate-700 tracking-wider">
            <span className="transition-all duration-300 font-mono text-slate-900 font-semibold">
              {activePhase.coordinates}
            </span>
            <span className="text-black/25">{"//"}</span>
            <span className="text-cyan-700 font-bold">
              PHASE [{activePhase.index}/03]
            </span>
          </div>
        </div>

        {/* Central Stage: Overlapping Progressive Disclosure Cards (Sharp, Crisp Glass - No Blur) */}
        <div ref={cardsContainerRef} className="relative flex-1 flex items-center justify-center my-6">
          {phases.map((phase) => (
            <div
              key={phase.index}
              className="quantum-phase-card absolute inset-0 flex flex-col justify-center space-y-6 will-change-transform will-change-opacity"
            >
              <div className="text-xs font-mono tracking-widest text-purple-800 font-bold uppercase">
                {phase.spec}
              </div>
              <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-black leading-none uppercase font-mono drop-shadow-sm">
                {phase.code}
              </h2>
              <div className="max-w-3xl space-y-4 pt-4">
                <p className="text-lg sm:text-2xl text-slate-900 font-medium leading-relaxed">
                  {phase.question}
                </p>
                <div className="pt-2 text-sm sm:text-base font-mono text-cyan-950 font-semibold leading-relaxed border-l-2 border-cyan-600 pl-4 bg-cyan-100/60 py-2.5 rounded-r-md border border-cyan-300/40 shadow-sm">
                  {phase.solution}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progressive Hairline Timeline Tracker */}
        <div className="space-y-4 pt-6 border-t border-black/[0.12]">
          <div className="w-full h-0.5 bg-black/15 rounded-full overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full bg-gradient-to-r from-cyan-600 via-purple-600 to-indigo-600 w-0 transition-[width] duration-75"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              {phases.map((p, idx) => (
                <div
                  key={p.index}
                  className={`text-xs font-mono px-3.5 py-1.5 rounded-md border transition-all duration-300 ${
                    activePhaseIndex === idx
                      ? "bg-black text-white border-black font-bold shadow-md"
                      : "bg-white/50 text-slate-700 border-black/15 hover:border-black/35 hover:text-black"
                  }`}
                >
                  {p.index} {"//"} {p.code}
                </div>
              ))}
            </div>

            <div className="font-mono text-xs text-slate-700 flex items-center gap-2">
              <span className="text-cyan-700 font-bold">[SPECIFICATION]</span>
              <span className="text-slate-900 font-semibold">{activePhase.metric}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default QuantumProtocolStream;
