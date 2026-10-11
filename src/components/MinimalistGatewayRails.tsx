"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import { NavView } from "@/components/Navbar";
import { useLanguage } from "@/lib/i18n";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface MinimalistGatewayRailsProps {
  onSelectView: (view: NavView) => void;
}

export function MinimalistGatewayRails({ onSelectView }: MinimalistGatewayRailsProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  const rails = [
    {
      index: "01",
      title: t("gateway.r1_title"),
      tag: "TOPOLOGY",
      desc: t("gateway.r1_desc"),
      view: "DETAIL" as NavView,
      spec: "10,000 TPS CLUSTERS",
    },
    {
      index: "02",
      title: t("gateway.r2_title"),
      tag: "STUDIO",
      desc: t("gateway.r2_desc"),
      view: "PRODUCT" as NavView,
      spec: "EIP-712 & ATTESTATION",
    },
    {
      index: "03",
      title: t("gateway.r3_title"),
      tag: "SCANNER",
      desc: t("gateway.r3_desc"),
      view: "AGENTCARD" as NavView,
      spec: "NEURAL ASSET DIGITIZER",
    },
    {
      index: "04",
      title: t("gateway.r4_title"),
      tag: "TOKEN",
      desc: t("gateway.r4_desc"),
      view: "TOKEN" as NavView,
      spec: "2^30 MAX SUPPLY",
    },
  ];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll<HTMLElement>(".gateway-rail-row");

    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        {
          opacity: 0,
          y: 30,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: container,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="max-w-7xl mx-auto px-4 sm:px-8 py-24 space-y-12 select-none">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="space-y-1">
          <div className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase font-bold">
            {t("gateway.tag")}
          </div>
          <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase font-mono">
            {t("gateway.title")}
          </h3>
        </div>
        <div className="text-xs font-mono text-slate-400">
          {t("gateway.hint")}
        </div>
      </div>

      <div className="divide-y divide-white/[0.08]">
        {rails.map((rail) => (
          <div
            key={rail.index}
            onClick={() => onSelectView(rail.view)}
            className="gateway-rail-row group relative py-8 sm:py-10 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer transition-all duration-300 hover:pl-4 will-change-transform"
          >
            {/* Background Hover Glow Sweep */}
            <div className="pointer-events-none absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 rounded-lg" />

            {/* Left: Index & Title & Desc */}
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-cyan-400 font-bold">
                  {rail.index}
                </span>
                <span className="text-white/20 text-xs font-mono">{"//"}</span>
                <span className="text-xs font-mono text-slate-400 tracking-wider">
                  {rail.spec}
                </span>
              </div>
              <h4 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white group-hover:text-cyan-300 transition-colors font-mono tracking-tight uppercase">
                {rail.title}
              </h4>
              <p className="text-xs sm:text-sm text-slate-400 font-mono leading-relaxed">
                {rail.desc}
              </p>
            </div>

            {/* Right: Technical Tag & Action */}
            <div className="flex items-center gap-4 self-start md:self-auto shrink-0">
              <span className="px-3 py-1 rounded-md border border-white/10 text-[11px] font-mono text-slate-300 group-hover:border-cyan-400/50 group-hover:text-cyan-300 transition-colors">
                [{rail.tag}]
              </span>
              <div className="w-10 h-10 rounded-md border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:border-white/40 group-hover:translate-x-1.5 transition-all">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MinimalistGatewayRails;
