"use client";

import React, { useState } from "react";
import { Navbar, NavView } from "@/components/Navbar";
import { CursorTrail } from "@/components/CursorTrail";
import { MarketTerminal } from "@/components/MarketTerminal";
import { GlobalFooter } from "@/components/GlobalFooter";
import { useRouter } from "next/navigation";
import { ExternalLink, Github } from "lucide-react";

export default function MarketPage() {
  const router = useRouter();
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [balance, setBalance] = useState("0.00");

  const handleSelectView = (view: NavView) => {
    if (view === "MARKET") return;
    router.push(`/?view=${view}`);
  };

  const handleTradeAction = () => {
    router.push(`/?view=DETAIL`);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-purple-500 selection:text-white bg-[#0d1017] text-white relative">
      <CursorTrail />

      {/* Top Fixed Navigation */}
      <Navbar
        currentView="MARKET"
        onSelectView={handleSelectView}
        account={account}
        balance={balance}
        onConnect={() => {}}
        onDisconnect={() => setAccount(null)}
      />

      {/* Main Market Terminal Container */}
      <main className="flex-1 w-full pt-20 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <MarketTerminal onTradeAction={handleTradeAction} />
      </main>

      {/* Global Footer */}
      <GlobalFooter />
    </div>
  );
}
