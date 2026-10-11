"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Github,
  KeyRound,
  CreditCard,
  Database,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Play,
  RotateCw,
  Activity,
} from "lucide-react";

interface AgentNarrativeFlowProps {
  onOpenConsole?: () => void;
}

export function AgentNarrativeFlow({ onOpenConsole }: AgentNarrativeFlowProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [balance, setBalance] = useState<number>(120.42);
  const [transactions, setTransactions] = useState<Array<{ id: string; desc: string; amount: string; positive: boolean }>>([
    { id: "tx-1", desc: "Nansen Query", amount: "-$3.00", positive: false },
    { id: "tx-2", desc: "Steam Attestation Reward", amount: "+$10.00", positive: true },
    { id: "tx-3", desc: "GitHub Proof Rebate", amount: "+$5.00", positive: true },
  ]);

  const steps = [
    {
      id: 0,
      title: "1. AI Agent Identity Generation",
      tag: "STEP 01 // IDENTITY",
      icon: <Cpu className="w-4 h-4 text-cyan-400" />,
      desc: "Agent registers identity with designated model weight (deepseek-r1 / gpt-4o) and deterministic cryptographic fingerprint.",
      badge: "[IDENTITY VERIFIED]",
    },
    {
      id: 1,
      title: "2. GitHub & Gaming Reputation Proof",
      tag: "STEP 02 // REPUTATION",
      icon: <Github className="w-4 h-4 text-purple-400" />,
      desc: "BUIDL metrics, code commits, and gaming telemetry attestations are ingested and verified without exposing private data.",
      badge: "[CREDIT ATTESTED]",
    },
    {
      id: 2,
      title: "3. EIP-712 Session Key Delegation",
      tag: "STEP 03 // DELEGATION",
      icon: <KeyRound className="w-4 h-4 text-purple-400" />,
      desc: "Card owner signs cryptographic session delegation with strict single-transaction ($100) and daily ($500) limit guardrails.",
      badge: "[SESSION ACTIVE]",
    },
    {
      id: 3,
      title: "4. Autonomous Micro-Payment Execution",
      tag: "STEP 04 // PAYMENT",
      icon: <CreditCard className="w-4 h-4 text-emerald-400" />,
      desc: "Agent pays compute clusters, data oracles, or APIs via gasless virtual cards, streaming real-time ledger updates.",
      badge: "[PAYMENT CLEARED]",
    },
    {
      id: 4,
      title: "5. Monad 10,000 TPS Batch Settlement",
      tag: "STEP 05 // MONAD SETTLEMENT",
      icon: <Database className="w-4 h-4 text-cyan-400" />,
      desc: "High-frequency micropayments and order hashes are aggregated and settled deterministically onto the Monad execution layer.",
      badge: "[ON-CHAIN 10143]",
    },
  ];

  // Auto-play progression
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [autoPlay, steps.length]);

  // Dynamic balance and transaction effect
  useEffect(() => {
    if (currentStep === 3) {
      setBalance((b) => Number((b - 3.0).toFixed(2)));
      setTransactions((prev) => [
        { id: "tx-" + Date.now(), desc: "Model API Unit", amount: "-$3.00", positive: false },
        ...prev.slice(0, 3),
      ]);
    } else if (currentStep === 4) {
      setTransactions((prev) => [
        { id: "tx-" + Date.now(), desc: "Monad Batch Settle", amount: "+$25.00", positive: true },
        ...prev.slice(0, 3),
      ]);
      setBalance((b) => Number((b + 25.0).toFixed(2)));
    }
  }, [currentStep]);

  return (
    <section className="relative w-full py-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-8 select-none">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <Activity className="w-3.5 h-3.5" />
            <span>[NARRATIVE FLOW] SCROLL-DRIVEN AGENT SETTLEMENT</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Autonomous Agent Lifecycle & Trust Pipeline
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-mono max-w-2xl">
            From zero identity to verified reputation, EIP-712 session delegation, autonomous payment, and deterministic Monad on-chain settlement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className="px-3 py-1.5 rounded-lg bg-[#141824] border border-white/10 text-xs font-mono text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            {autoPlay ? <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoPlay ? "Auto-Play [ON]" : "Play"}</span>
          </button>

          {onOpenConsole && (
            <button
              onClick={onOpenConsole}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-mono text-white font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-900/30"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Launch API Console</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Narrative Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Step Stepper Navigation (5 Columns) */}
        <div className="lg:col-span-6 space-y-3">
          {steps.map((step, idx) => {
            const isActive = currentStep === idx;
            return (
              <div
                key={step.id}
                onClick={() => {
                  setAutoPlay(false);
                  setCurrentStep(idx);
                }}
                className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "bg-[#161a29] border-purple-500/60 shadow-xl shadow-purple-900/20 translate-x-1"
                    : "bg-[#0e111a]/80 border-white/5 hover:border-white/20 opacity-75 hover:opacity-100"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2 rounded-lg mt-0.5 border ${
                      isActive
                        ? "bg-purple-500/20 border-purple-500/40 text-white"
                        : "bg-white/5 border-white/10 text-slate-400"
                    }`}
                  >
                    {step.icon}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono tracking-wider text-purple-300 font-semibold">
                        {step.tag}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          {step.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white">{step.title}</h3>
                    <p className="text-xs text-slate-400 font-mono leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Holographic Dynamic Agent Card & Live Transactions */}
        <div className="lg:col-span-6">
          <div className="relative rounded-lg bg-gradient-to-br from-[#181d2e] via-[#111422] to-[#0a0d16] border border-white/15 p-6 sm:p-8 shadow-sm space-y-6 overflow-hidden">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Bar of Holographic Card */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                  <div className="text-xs font-mono text-purple-300 font-bold">ALPHA-AGENT // DEEPSEEK-R1</div>
                  <div className="text-[11px] font-mono text-slate-400">0x71C8360f...4c20b2</div>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
                <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400 animate-pulse" />
                <span>[RUNNING]</span>
              </div>
            </div>

            {/* Rolling Balance & Quota Counter */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0b0e17] border border-white/10 space-y-1">
                <div className="text-xs font-mono text-slate-400">Delegated Balance</div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-1">
                  <span>${balance.toFixed(2)}</span>
                  <span className="text-xs text-slate-400 font-normal">USD</span>
                </div>
                <div className="text-[10px] font-mono text-emerald-400">Limit: $100/tx | $500/day</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0b0e17] border border-white/10 space-y-1">
                <div className="text-xs font-mono text-slate-400">Settlement Target</div>
                <div className="text-base sm:text-lg font-bold text-cyan-300 font-mono truncate">
                  Monad Testnet
                </div>
                <div className="text-[10px] font-mono text-slate-400">Batch ID: #monad-98402</div>
              </div>
            </div>

            {/* Real-time Flying Transactions Stream */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>RECENT REAL-TIME TRANSACTIONS</span>
                <span className="text-purple-300">Auto Settled</span>
              </div>

              <div className="space-y-2">
                <AnimatePresence>
                  {transactions.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: 25 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -25 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#0f121d] border border-white/5 font-mono text-xs hover:border-white/10 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-sm bg-purple-400" />
                        <span className="text-slate-200">{tx.desc}</span>
                      </div>
                      <span
                        className={`font-bold ${
                          tx.positive ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {tx.amount}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom Proof Commitment Footer */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-white/10">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>EIP-712 Session Key Verified</span>
              </span>
              <span>Tx Hash: 0x9f1a...20bc</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
