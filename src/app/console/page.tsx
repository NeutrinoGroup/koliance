"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { DeveloperConsole } from "@/components/DeveloperConsole";
import { GlobalFooter } from "@/components/GlobalFooter";
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

      <GlobalFooter />
    </div>
  );
}
