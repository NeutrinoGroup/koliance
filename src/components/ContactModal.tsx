"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Send,
  Terminal,
  Users,
  Code2,
} from "lucide-react";

export interface TeamMemberContact {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: string;
  specialty: string;
  badge: string;
  badgeColor: string;
  commitsCount: string;
  githubUrl: string;
}

const TEAM_MEMBERS: TeamMemberContact[] = [
  {
    id: "moonhotline",
    name: "moonhotline",
    handle: "leek",
    email: "moonhotline@outlook.com",
    role: "Core Lead & Protocol Architect",
    specialty: "Full-Stack Web3, Parallel EVM Orchestration & Identity Verification",
    badge: "[LEAD ARCHITECT]",
    badgeColor: "border-purple-500/30 text-purple-400 bg-purple-500/10",
    commitsCount: "84+ Commits",
    githubUrl: "https://github.com/moonhotline",
  },
  {
    id: "yotoha",
    name: "Yotoha",
    handle: "Yotoha0303",
    email: "103411612+Yotoha0303@users.noreply.github.com",
    role: "Smart Contracts & Perp Solvency Core",
    specialty: "Solidity 0.8.31 (Osaka), PositionManager & Solvency Safeguards",
    badge: "[SMART CONTRACTS]",
    badgeColor: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10",
    commitsCount: "41+ Commits",
    githubUrl: "https://github.com/Yotoha0303",
  },
  {
    id: "iasi777",
    name: "iasi777",
    handle: "iasi777",
    email: "24803815+iasi777@users.noreply.github.com",
    role: "Security & Risk Auditing Lead",
    specialty: "Gitleaks Baseline, LP Liability Dilution Fixes & Risk Isolation",
    badge: "[SECURITY AUDIT]",
    badgeColor: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    commitsCount: "5+ Commits",
    githubUrl: "https://github.com/iasi777",
  },
];

const ECOSYSTEM_CONTACT = {
  id: "ecosystem",
  name: "Koliance Protocol Ecosystem",
  handle: "developer",
  email: "developer@koliance.io",
  role: "Developer Relations & Partnerships",
  specialty: "Institutional Onboarding, Monad Ecosystem & Integrations",
  badge: "[ECOSYSTEM]",
  badgeColor: "border-slate-500/30 text-slate-300 bg-slate-500/10",
  githubUrl: "https://github.com/moonhotline/koliance",
};

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCopyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        {/* Backdrop click dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative z-10 w-full max-w-2xl rounded-xl bg-[#0c0f17] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)] overflow-hidden"
        >
          {/* Top aesthetic accent hairline */}
          <div className="h-0.5 w-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400" />

          {/* Modal Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-white/10 flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border border-purple-500/30 text-purple-300 bg-purple-500/10">
                  [CORE CONTRIBUTORS]
                </span>
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Monad Osaka Testnet 10143</span>
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
                <span>Koliance Team & Direct Contacts</span>
              </h3>
              <p className="text-xs font-mono text-slate-400 leading-relaxed">
                Source: Git Commit History & Monad Protocol Maintainers. Direct cryptographic developer communication channels.
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Team Members List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Engineering Core Team</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  3 Verified Git Authors
                </span>
              </div>

              {TEAM_MEMBERS.map((member) => {
                const isCopied = copiedId === member.id;
                return (
                  <div
                    key={member.id}
                    className="p-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-purple-500/30 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 font-mono text-xs font-bold">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-mono">
                              {member.name}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              (@{member.handle})
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${member.badgeColor}`}
                            >
                              {member.badge}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-purple-300/80">
                            {member.role}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5">
                          {member.commitsCount}
                        </span>
                        <a
                          href={member.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-mono text-xs flex items-center gap-1 transition"
                          title={`View @${member.handle} on GitHub`}
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          <span>GitHub</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </a>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 font-sans leading-relaxed">
                      {member.specialty}
                    </div>

                    {/* Email Action Bar */}
                    <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-300 bg-black/40 px-3 py-1.5 rounded-md border border-white/5 overflow-hidden">
                        <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate select-all text-slate-200">
                          {member.email}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleCopyEmail(member.id, member.email)}
                          className={`h-8 px-3 rounded-md font-mono text-xs font-medium border flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
                            isCopied
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-purple-600 hover:bg-purple-500 text-white border-purple-500/40"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              <span>[COPIED]</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Email</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`mailto:${member.email}`}
                          className="h-8 px-3 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-mono text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98]"
                        >
                          <Send className="w-3 h-3 text-cyan-400" />
                          <span>Mail</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* General Protocol & Ecosystem Email */}
            <div className="p-4 rounded-lg bg-cyan-950/20 border border-cyan-500/20 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">
                      {ECOSYSTEM_CONTACT.name}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${ECOSYSTEM_CONTACT.badgeColor}`}>
                      {ECOSYSTEM_CONTACT.badge}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    {ECOSYSTEM_CONTACT.role} - {ECOSYSTEM_CONTACT.specialty}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyEmail(ECOSYSTEM_CONTACT.id, ECOSYSTEM_CONTACT.email)}
                    className={`h-8 px-3 rounded-md font-mono text-xs font-medium border flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all ${
                      copiedId === ECOSYSTEM_CONTACT.id
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500/40"
                    }`}
                  >
                    {copiedId === ECOSYSTEM_CONTACT.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>[COPIED]</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`mailto:${ECOSYSTEM_CONTACT.email}`}
                    className="h-8 px-3 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-mono text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98]"
                  >
                    <Send className="w-3 h-3 text-cyan-400" />
                    <span>Mail</span>
                  </a>
                </div>
              </div>

              <div className="font-mono text-xs text-slate-300 bg-black/40 px-3 py-1.5 rounded-md border border-white/5 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{ECOSYSTEM_CONTACT.email}</span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 bg-black/40 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Verifiable Git Contributor Identity & PGP/EIP-712 Ready</span>
            </div>

            <button
              onClick={onClose}
              className="h-8 px-4 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-mono text-xs font-medium cursor-pointer transition active:scale-[0.98] self-end sm:self-auto"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
