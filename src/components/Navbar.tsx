"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Globe,
  Network,
  CreditCard,
  TrendingUp,
  Coins,
  Activity,
  Terminal,
  Menu,
  X,
} from "lucide-react";
import { BrandIcon } from "@/components/BrandIcon";
import { NavAuthBadges } from "@/components/NavAuthBadges";
import { useLanguage } from "@/lib/i18n";

export type NavView =
  | "INDEX"
  | "DETAIL"
  | "PRODUCT"
  | "MARKET"
  | "AGENTCARD"
  | "TOKEN"
  | "PERP"
  | "CONSOLE"
  | "IM";

interface NavbarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  account: `0x${string}` | null;
  balance: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Navbar({
  currentView,
  onSelectView,
  account,
  balance,
  onConnect,
  onDisconnect,
}: NavbarProps) {
  const { lang, setLang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: NavView; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: "INDEX", label: t("nav.index"), icon: <Globe className="w-3.5 h-3.5" /> },
    { id: "CONSOLE", label: t("nav.console"), icon: <Terminal className="w-3.5 h-3.5" />, badge: "API" },
    { id: "TOKEN", label: t("nav.token"), icon: <Coins className="w-3.5 h-3.5" />, badge: "KOL" },
    { id: "DETAIL", label: t("nav.detail"), icon: <Network className="w-3.5 h-3.5" />, badge: "AGENT" },
    { id: "PRODUCT", label: t("nav.product"), icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "MARKET", label: t("nav.market"), icon: <TrendingUp className="w-3.5 h-3.5" />, badge: "LIVE" },
    { id: "PERP", label: t("nav.perp"), icon: <Activity className="w-3.5 h-3.5" />, badge: "ONCHAIN" },
    { id: "AGENTCARD", label: t("nav.agentcard"), icon: <CreditCard className="w-3.5 h-3.5" />, badge: "AI" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-8 py-2.5 backdrop-blur-2xl transition-all bg-[#0d1017] border-b border-white/15 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand / Logo (High-End White Aesthetic) */}
        <div
          onClick={() => {
            onSelectView("INDEX");
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0"
        >
          <div className="relative group-hover:scale-105 transition-transform duration-300">
            <BrandIcon size={32} glow />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0d1017] animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold text-base sm:text-lg tracking-wider text-white">
              KOLIANCE
            </span>
          </div>
        </div>

        {/* Navigation Switcher (Desktop: >= xl)
            Breakpoint measured in a browser, not guessed (issue #40). The header
            container caps at `max-w-7xl` (1280px), so the nav's share of the row
            stops growing at **805px** however wide the window gets; the brand
            takes ~127px and the account pill plus the language switch ~282px.
            Against that ceiling the eight items measured, in the order they were
            changed:

              - `px-3.5` with badges: **1000px** - so even at 1600px the nav was
                still clipping PERP and AGENTCARD off the right edge;
              - badges removed: **770px** - which still overflowed by 29px at
                exactly 1280, where the nav only gets 741px;
              - padding trimmed to `px-2.5`: **706px** - fits at 1280 with 35px
                to spare.

            Hence three changes, all decided by those numbers rather than by
            taste: the badges leave the desktop nav (they are decoration; the
            drawer below still carries them), the item padding drops, and the
            boundary moves from `md` (768px, where the nav got 229px and clipped
            six of the eight items) to `xl` (1280px, where it fits all eight).

            `overflow-x-auto` stays, deliberately unaccompanied: it is the
            guarantee that no item is ever unreachable, and the scrollbar-hiding
            utilities that used to sit next to it are exactly what made a clipped
            item silent. Nothing should overflow here now; if something does, it
            will be visible. */}
        <nav className="hidden xl:flex items-center p-1 rounded-2xl bg-[#141824] border border-white/15 shadow-inner overflow-x-auto">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`relative px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium tracking-wide transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-white-pill"
                    className="absolute inset-0 bg-[#252c40] border border-white/30 rounded-xl shadow-md"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* `itemCount` is the nav's declaration of how many items it must show.
            It is carried in the DOM so a test can assert the number *rendered*
            against it, rather than against a literal that a future item would
            leave behind (issue #40). */}
        <span data-testid="desktop-nav-item-count" className="hidden" aria-hidden="true">
          {navItems.length}
        </span>

        {/* Unified Account Center, Language Switcher & Mobile Menu Trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* User Account / Profile Center: Avatar, Edit Profile, Connect Wallet, Transfer MON, Identity Badges */}
          <NavAuthBadges
            walletAddress={account}
            balance={balance}
            onConnectWallet={onConnect}
            onDisconnectWallet={onDisconnect}
          />

          {/* Desktop Language Switcher (>= xl; matches the nav's own breakpoint,
              because the two compete for the same row - a switch on one and not
              the other is how the row overflowed in the first place) */}
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "zh" : "en")}
            className="hidden xl:flex h-9 px-2.5 sm:px-3 rounded-md bg-[#141824] hover:bg-[#1e2337] border border-white/15 hover:border-white/30 text-xs font-mono text-slate-200 hover:text-white transition-all items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-[0.98] cursor-pointer"
            title={lang === "en" ? "切换为中文 (Switch to Chinese)" : "Switch to English"}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold tracking-wider">
              <span className={lang === "en" ? "text-cyan-400 font-bold" : "text-slate-400"}>EN</span>
              <span className="text-white/20 mx-1">/</span>
              <span className={lang === "zh" ? "text-cyan-400 font-bold" : "text-slate-400"}>中</span>
            </span>
          </button>

          {/* Mobile Hamburger Drawer Trigger (< xl) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden h-9 w-9 rounded-md bg-[#141824] hover:bg-[#1e2337] border border-white/15 hover:border-white/30 text-slate-200 hover:text-white transition-all flex items-center justify-center active:scale-[0.98] cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4 text-cyan-400" />
            ) : (
              <Menu className="w-4 h-4 text-slate-200" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu (< xl) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="xl:hidden overflow-hidden border-t border-white/10 mt-2.5 pt-2.5 pb-2"
          >
            <div className="flex flex-col gap-1 max-w-7xl mx-auto">
              {navItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs font-mono transition-all active:scale-[0.98] ${
                      isActive
                        ? "bg-[#252c40] text-white border border-white/30 font-semibold shadow-sm"
                        : "bg-[#141824] text-slate-300 hover:text-white hover:bg-[#1b2133] border border-white/10"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/15 text-white font-mono border border-white/20">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Mobile Language Switcher Row */}
              <div className="pt-2 mt-1 border-t border-white/10 flex items-center justify-between px-1">
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Language / 语言</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLang("en");
                      setMobileMenuOpen(false);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all border ${
                      lang === "en"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 font-bold"
                        : "bg-[#141824] text-slate-400 border-white/10 hover:text-white"
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLang("zh");
                      setMobileMenuOpen(false);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all border ${
                      lang === "zh"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 font-bold"
                        : "bg-[#141824] text-slate-400 border-white/10 hover:text-white"
                    }`}
                  >
                    中文
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
