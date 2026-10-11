"use client";

import React, { useState, useEffect, useRef } from "react";

export function AgentCardShowcase() {
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
        rootMargin: "300px", // Trigger slightly before entering viewport
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={containerRef}
      className="w-full bg-[#050510] text-white border-t border-white/10 select-none relative overflow-hidden"
    >
      {/* 100% Full-Width Edge-to-Edge Neural Scanner Stage (No Header Text) */}
      <div className="w-full h-[720px] sm:h-[820px] md:h-[900px] relative">
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
          <div className="w-full h-full flex flex-col items-center justify-center space-y-3 font-mono text-xs text-slate-500 bg-[#050510]">
            <div className="w-8 h-8 border border-white/10 rounded-md flex items-center justify-center text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            </div>
            <p className="tracking-widest uppercase text-slate-400">[STANDBY // NEURAL SCANNER 100% STAGE]</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default AgentCardShowcase;
