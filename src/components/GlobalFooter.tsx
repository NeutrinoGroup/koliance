"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";
import { ContactModal } from "@/components/ContactModal";
import { ExternalLink, Mail, ShieldCheck } from "lucide-react";

interface GlobalFooterProps {
  className?: string;
  onOpenContact?: () => void;
}

export function GlobalFooter({ className = "", onOpenContact }: GlobalFooterProps) {
  const [internalContactOpen, setInternalContactOpen] = useState(false);

  const handleContactClick = () => {
    if (onOpenContact) {
      onOpenContact();
    } else {
      setInternalContactOpen(true);
    }
  };

  return (
    <>
      <footer className={`border-t border-white/10 py-10 px-4 sm:px-8 mt-16 bg-[#0d1017]/90 backdrop-blur-md ${className}`}>
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Main Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 font-mono text-xs text-slate-400">
            {/* Column 1: Brand & Identity */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <BrandIcon size={24} />
                <span className="font-extrabold text-white text-sm tracking-wider">KOLIANCE</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Verifiable on-chain identity, autonomous agent trust delegation, and high-concurrency settlement infrastructure powered by Monad Parallel EVM.
              </p>
              <div className="pt-1 flex items-center gap-2 text-slate-500 text-[10px]">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Monad Testnet Chain ID: 10143</span>
              </div>
            </div>

            {/* Column 2: Core Platform */}
            <div className="space-y-2.5">
              <h4 className="text-white font-semibold tracking-wider text-[11px] uppercase">Platform & Services</h4>
              <ul className="space-y-2 text-[11px]">
                <li>
                  <Link href="/market" className="hover:text-cyan-300 transition">Market Terminal</Link>
                </li>
                <li>
                  <Link href="/perp" className="hover:text-cyan-300 transition">Perp Engine & Solvency</Link>
                </li>
                <li>
                  <Link href="/agentcard" className="hover:text-cyan-300 transition">Agent Card Scanner</Link>
                </li>
                <li>
                  <Link href="/token" className="hover:text-cyan-300 transition">KOL Token & Staking</Link>
                </li>
                <li>
                  <Link href="/console" className="hover:text-cyan-300 transition">Developer Console (API)</Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Resources & Transparency */}
            <div className="space-y-2.5">
              <h4 className="text-white font-semibold tracking-wider text-[11px] uppercase">Transparency & Docs</h4>
              <ul className="space-y-2 text-[11px]">
                <li>
                  <Link href="/pricing" className="text-cyan-400 hover:text-cyan-300 font-semibold transition">
                    Pricing & Quota Plans
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="hover:text-white transition">
                    Documentation & API Specs
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/NeutrinoGroup/koliance"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition inline-flex items-center gap-1"
                  >
                    <span>Open Source (GitHub)</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://testnet.monadexplorer.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition inline-flex items-center gap-1"
                  >
                    <span>Monad Block Explorer</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
                <li>
                  <a
                    href="/llms.txt"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition inline-flex items-center gap-1"
                  >
                    <span>llms.txt Index</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Compliance & Legal */}
            <div className="space-y-2.5">
              <h4 className="text-white font-semibold tracking-wider text-[11px] uppercase">Compliance & Trust</h4>
              <ul className="space-y-2 text-[11px]">
                <li>
                  <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/refund" className="hover:text-white transition">Refund & Security Policy</Link>
                </li>
                <li>
                  <button
                    onClick={handleContactClick}
                    className="text-slate-300 hover:text-cyan-300 transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Contact Team & Support</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Sub-footer Bar */}
          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-slate-500">
            <div>
              &copy; {new Date().getFullYear()} Koliance Network. MIT Licensed Open Source Trust Infrastructure.
            </div>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-slate-400 transition">Terms</Link>
              <span>·</span>
              <Link href="/privacy" className="hover:text-slate-400 transition">Privacy</Link>
              <span>·</span>
              <Link href="/refund" className="hover:text-slate-400 transition">Security & Refund</Link>
              <span>·</span>
              <Link href="/pricing" className="hover:text-slate-400 transition">Pricing</Link>
              <span>·</span>
              <Link href="/docs" className="hover:text-slate-400 transition">Docs</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Internal Contact Modal fallback */}
      <ContactModal
        isOpen={internalContactOpen}
        onClose={() => setInternalContactOpen(false)}
      />
    </>
  );
}
