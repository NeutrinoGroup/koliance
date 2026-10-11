"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { DeveloperConsole } from "@/components/DeveloperConsole";
import { useKolianceAuth } from "@/components/Providers";

export default function ConsolePage() {
  const router = useRouter();
  const { address: authAddress, login: authLogin, logout: authLogout } = useKolianceAuth();
  const [balance] = useState("0.00");

  const handleSelectView = (view: NavView) => {
    if (view === "CONSOLE") return;
    if (view === "INDEX") {
      router.push("/");
    } else if (view === "TOKEN") {
      router.push("/token");
    } else if (view === "PERP") {
      router.push("/perp");
    } else if (view === "MARKET") {
      router.push("/market");
    } else {
      router.push(`/?view=${view}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col font-sans selection:bg-purple-500/30">
      <CursorTrail />
      <Navbar
        currentView={"CONSOLE" as NavView}
        onSelectView={handleSelectView}
        account={authAddress || null}
        balance={balance}
        onConnect={authLogin}
        onDisconnect={authLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-12">
        <DeveloperConsole currentAccount={authAddress || null} />
      </main>

      <footer className="border-t border-white/10 py-6 px-4 sm:px-8 bg-[#0d1017]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>
            <span className="font-extrabold text-white tracking-wider">KOLIANCE</span>
            <span className="ml-2 text-slate-400">{"//"} Autonomous Agent Trust & Settlement Layer</span>
          </div>
          <div>Monad Testnet (Chain ID 10143)</div>
        </div>
      </footer>
    </div>
  );
}
