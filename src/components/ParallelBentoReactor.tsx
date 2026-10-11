"use client";

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { Network, Shield, CreditCard, Coins, ArrowRight, Activity } from "lucide-react";
import { NavView } from "@/components/Navbar";

interface ParallelBentoReactorProps {
  onSelectView: (view: NavView) => void;
}

interface ReactorCardProps {
  title: string;
  badge?: string;
  desc: string;
  actionText: string;
  accentColor: "purple" | "cyan" | "indigo" | "emerald";
  icon: React.ReactNode;
  onClick: () => void;
  features?: "constellation" | "scanline" | "hologram" | "halving";
}

function ReactorCard({
  title,
  badge,
  desc,
  actionText,
  accentColor,
  icon,
  onClick,
  features,
}: ReactorCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // 60fps spring damped tilt
    const xTo = gsap.quickTo(card, "rotateY", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(card, "rotateX", { duration: 0.45, ease: "power3.out" });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      yTo(((y - centerY) / centerY) * -8);
      xTo(((x - centerX) / centerX) * 8);

      card.style.setProperty("--mouse-x", `${((x / rect.width) * 100).toFixed(1)}%`);
      card.style.setProperty("--mouse-y", `${((y / rect.height) * 100).toFixed(1)}%`);
    };

    const handleMouseLeave = () => {
      yTo(0);
      xTo(0);
      card.style.setProperty("--mouse-x", "50%");
      card.style.setProperty("--mouse-y", "50%");
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const colorConfig = {
    purple: {
      border: "hover:border-purple-500/70",
      shadow: "hover:shadow-[0_20px_50px_rgba(131,110,249,0.3)]",
      glowBg: "rgba(131, 110, 249, 0.25)",
      iconBg: "from-purple-600 to-indigo-600",
      textAccent: "text-purple-400",
    },
    cyan: {
      border: "hover:border-cyan-400/70",
      shadow: "hover:shadow-[0_20px_50px_rgba(0,242,254,0.3)]",
      glowBg: "rgba(0, 242, 254, 0.25)",
      iconBg: "from-cyan-400 to-teal-500",
      textAccent: "text-cyan-400",
    },
    indigo: {
      border: "hover:border-indigo-400/70",
      shadow: "hover:shadow-[0_20px_50px_rgba(99,102,241,0.3)]",
      glowBg: "rgba(99, 102, 241, 0.25)",
      iconBg: "from-indigo-500 to-purple-600",
      textAccent: "text-indigo-400",
    },
    emerald: {
      border: "hover:border-emerald-400/70",
      shadow: "hover:shadow-[0_20px_50px_rgba(16,185,129,0.3)]",
      glowBg: "rgba(16, 185, 129, 0.25)",
      iconBg: "from-emerald-500 to-teal-600",
      textAccent: "text-emerald-400",
    },
  }[accentColor];

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      style={{ transformStyle: "preserve-3d" }}
      className={`group relative rounded-3xl p-6 bg-[#101422]/90 border border-white/[0.08] ${colorConfig.border} ${colorConfig.shadow} cursor-pointer overflow-hidden transform-gpu will-change-transform transition-all duration-300 shadow-xl flex flex-col justify-between`}
    >
      {/* Ray-traced Specular Follower Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"
        style={{
          background: `radial-gradient(380px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${colorConfig.glowBg}, transparent 75%)`,
        }}
      />

      {/* Cyber Grid Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03] pointer-events-none" />

      {/* Feature A: Laser Scanline (AI Card Scanner) */}
      {features === "scanline" && (
        <div className="pointer-events-none absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 group-hover:opacity-80 transition-opacity top-0 group-hover:animate-pulse" />
      )}

      {/* Feature B: Holographic Sheen (Holographic Verification) */}
      {features === "hologram" && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-transparent opacity-30 group-hover:opacity-100 transition-opacity" />
      )}

      {/* Content Layer (Parallax Z-Depth) */}
      <div className="relative z-10 space-y-4" style={{ transform: "translateZ(18px)" }}>
        <div className="flex items-center justify-between">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorConfig.iconBg} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}
          >
            {icon}
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ONLINE</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white group-hover:text-cyan-300 transition-colors">
                {title}
              </h3>
              {badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {badge}
                </span>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1.5 transition-all" />
          </div>
          <p className="text-xs text-slate-400 font-mono leading-relaxed">{desc}</p>
        </div>
      </div>

      <div
        className="relative z-10 pt-4 mt-2 flex items-center justify-between text-[11px] font-mono border-t border-white/[0.06]"
        style={{ transform: "translateZ(10px)" }}
      >
        <span className={`${colorConfig.textAccent} font-semibold uppercase tracking-wider`}>
          {actionText}
        </span>
        <span className="text-slate-500 group-hover:translate-x-1 transition-transform">&rarr;</span>
      </div>
    </div>
  );
}

export function ParallelBentoReactor({ onSelectView }: ParallelBentoReactorProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-8">
      {/* Section Header with Parallel Pipeline Bus */}
      <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-monad-500/10 border border-monad-500/30 text-monad-300 text-xs font-mono uppercase tracking-widest">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Monad Parallel Execution Mesh</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
            Monad 10,000 TPS Parallel Trust Architecture
          </h2>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 font-bold">SUB-SECOND FINALITY</span>
          </div>
          <span className="text-white/20">|</span>
          <span className="text-slate-300">4-LANE SUPERSCALAR</span>
        </div>
      </div>

      {/* 4 Parallel Reactor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 [perspective:1200px]">
        <ReactorCard
          title="Trust Constellation Graph"
          desc="Multi-cluster trust weights, AI audit agents & consensus metrics."
          actionText="View Detail Topology"
          accentColor="purple"
          icon={<Network className="w-6 h-6" />}
          onClick={() => onSelectView("DETAIL")}
          features="constellation"
        />

        <ReactorCard
          title="Holographic Verification"
          desc="3D holographic identity badge, staking dashboard & biometric protocol."
          actionText="Open Product Studio"
          accentColor="cyan"
          icon={<Shield className="w-6 h-6 text-black" />}
          onClick={() => onSelectView("PRODUCT")}
          features="hologram"
        />

        <ReactorCard
          title="AI Card Scanner"
          desc="Full-stack Neural Asset Processor with 6-card circulating digitization."
          actionText="Launch AI Scanner"
          accentColor="indigo"
          icon={<CreditCard className="w-6 h-6" />}
          onClick={() => onSelectView("AGENTCARD")}
          features="scanline"
        />

        <ReactorCard
          title="KOL Token"
          badge="KOL"
          desc="2^30 Max Supply · 2-year halving · Monad block claiming & transfer."
          actionText="Open Token Hub"
          accentColor="emerald"
          icon={<Coins className="w-6 h-6" />}
          onClick={() => onSelectView("TOKEN")}
          features="halving"
        />
      </div>
    </section>
  );
}
