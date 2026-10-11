"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Zap, ShieldCheck, Cpu } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function KineticScrollBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const track1Ref = useRef<HTMLDivElement>(null);
  const track2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const track1 = track1Ref.current;
    const track2 = track2Ref.current;
    if (!container || !track1 || !track2) return;

    const ctx = gsap.context(() => {
      // Track 1: Streams from right to left on scroll down
      gsap.to(track1, {
        xPercent: -28,
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      });

      // Track 2: Streams from left to right on scroll down
      gsap.fromTo(
        track2,
        { xPercent: -24 },
        {
          xPercent: 0,
          ease: "none",
          scrollTrigger: {
            trigger: container,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        }
      );
    }, container);

    return () => ctx.revert();
  }, []);

  const marqueeText1 = [
    "MONAD 10,000 TPS",
    "PARALLEL TRUST ARCHITECTURE",
    "AUTONOMOUS AGENT ECONOMIC AGENCY",
    "EIP-712 SESSION KEYS",
    "SUB-SECOND FINALITY",
  ];

  const marqueeText2 = [
    "ZERO MASTER KEY EXPOSURE",
    "PROGRAMMABLE ALLOWANCES",
    "STEAM & GITHUB ATTESTATION",
    "NEURAL ASSET DIGITIZER",
    "CIRCUIT BREAKER ARBITRATION",
  ];

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden py-10 select-none pointer-events-none border-y border-white/[0.06] bg-black/40"
    >
      {/* Background cyber grid gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(#836ef9_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

      {/* Track 1: Right-to-Left Kinetic Scroll Stream */}
      <div className="flex whitespace-nowrap mb-3 will-change-transform" ref={track1Ref}>
        {[...Array(4)].map((_, groupIdx) => (
          <div key={`group1-${groupIdx}`} className="flex items-center gap-6 shrink-0 pr-6">
            {marqueeText1.map((item, idx) => (
              <span key={`t1-${groupIdx}-${idx}`} className="inline-flex items-center gap-3">
                <span className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white/90 uppercase font-mono">
                  {item}
                </span>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-400/20 text-cyan-400">
                  <Zap className="w-3.5 h-3.5" />
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Track 2: Left-to-Right Counter Kinetic Scroll Stream */}
      <div className="flex whitespace-nowrap will-change-transform" ref={track2Ref}>
        {[...Array(4)].map((_, groupIdx) => (
          <div key={`group2-${groupIdx}`} className="flex items-center gap-6 shrink-0 pr-6">
            {marqueeText2.map((item, idx) => (
              <span key={`t2-${groupIdx}-${idx}`} className="inline-flex items-center gap-3">
                <span className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-monad-400/80 uppercase font-mono">
                  {item}
                </span>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20 text-purple-300">
                  <ShieldCheck className="w-3 h-3" />
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
