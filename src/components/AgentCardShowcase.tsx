"use client";

import React, { useState, useEffect, useRef } from "react";
import { CreditCard, ExternalLink, Activity, Sparkles, RefreshCw } from "lucide-react";
import { NavView } from "@/components/Navbar";

interface AgentCardShowcaseProps {
  onOpenDedicated?: () => void;
}

export function AgentCardShowcase({ onOpenDedicated }: AgentCardShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "300px", // Trigger slightly before it enters the viewport
        threshold: 0.05,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={containerRef} className="w-full bg-[#080b12] text-white border-t border-white/10 py-20 select-none relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-8">
        {/* Showcase Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>[PROGRESSIVE DISCLOSURE] GRAND FINALE ASSET MATRIX</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-mono uppercase">
              6-Card Circulating Neural Scanner
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-mono max-w-2xl leading-relaxed">
              Real-time physical asset digitization, holographic conversion stream, and deterministic Monad testnet ledger binding.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onOpenDedicated && (
              <button
                onClick={onOpenDedicated}
                className="h-10 px-4 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-mono transition flex items-center gap-2 shadow-xs active:scale-[0.98]"
              >
                <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                <span>全屏独立工作台</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Scanner Stage Container with Architectural Geometry */}
        <div className="relative w-full h-[680px] sm:h-[760px] md:h-[820px] rounded-xl border border-white/10 bg-[#050510] overflow-hidden shadow-2xl">
          {isInView ? (
            <>
              {!isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050510] z-20 space-y-3 font-mono text-xs text-slate-400">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-md animate-spin" />
                  <p className="text-slate-300 tracking-wider">[INITIALIZING 6-CARD NEURAL MATRIX]</p>
                </div>
              )}
              <iframe
                src="/agentcard/index.html"
                className="w-full h-full border-0 relative z-10"
                title="AI Card Scanner // 6-Card Circulating Neural Asset Processor"
                onLoad={() => setIsLoaded(true)}
              />
            </>
          ) : (
            /* Standby Placeholder for 0 CPU / 0 GPU overhead */
            <div className="w-full h-full flex flex-col items-center justify-center space-y-4 text-center px-4 font-mono">
              <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
                <CreditCard className="w-6 h-6 text-purple-400" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-purple-300 font-bold tracking-widest uppercase">
                  [STANDBY // IN-VIEW LAZY LOAD ACTIVE]
                </div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Neural asset processor stage remains idle until scrolled into view to preserve zero CPU/GPU overhead.
                </p>
              </div>
              <button
                onClick={() => setIsInView(true)}
                className="h-9 px-4 rounded-md bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-mono transition flex items-center gap-2 active:scale-[0.98]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>立即挂载运行</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default AgentCardShowcase;
