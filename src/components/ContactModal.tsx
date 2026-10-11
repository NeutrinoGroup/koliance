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
  Bot,
  Sparkles,
} from "lucide-react";
import { GlassBackground } from "@/components/GlassBackground";

export interface TeamMemberContact {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: string;
  badge: string;
  badgeColor: string;
  githubUrl: string;
}

const AI_BUILDERS: TeamMemberContact[] = [
  {
    id: "moonhotline",
    name: "moonhotline",
    handle: "leek",
    email: "moonhotline@outlook.com",
    role: "Full-Stack Web3 & Autonomous Agent Architect",
    badge: "[AI PROTOCOL BUILDER]",
    badgeColor: "border-purple-500/30 text-purple-300 bg-purple-500/10",
    githubUrl: "https://github.com/moonhotline",
  },
  {
    id: "yotoha",
    name: "Yotoha Lin",
    handle: "Yotoha0303",
    email: "player159263@gmail.com",
    role: "Smart Contracts & Perp Solvency Engine",
    badge: "[AI CONTRACT BUILDER]",
    badgeColor: "border-cyan-500/30 text-cyan-300 bg-cyan-500/10",
    githubUrl: "https://github.com/Yotoha0303",
  },
  {
    id: "iasi777",
    name: "iasi777",
    handle: "iasi777",
    email: "iasi777work@gmail.com",
    role: "Cryptographic Security & Autonomous Risk Auditing",
    badge: "[AI SECURITY BUILDER]",
    badgeColor: "border-emerald-500/30 text-emerald-300 bg-emerald-500/10",
    githubUrl: "https://github.com/iasi777",
  },
];

const ECOSYSTEM_CONTACT = {
  id: "ecosystem",
  name: "Koliance Ecosystem",
  handle: "developer",
  email: "developer@koliance.io",
  role: "Protocol Inquiries & Agentic Integration",
  badge: "[AI ECOSYSTEM]",
  badgeColor: "border-slate-500/30 text-slate-300 bg-slate-500/10",
  githubUrl: "https://github.com/moonhotline/koliance",
};

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        {/* Backdrop dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative z-10 w-full max-w-xl rounded-xl bg-[#0a0d14]/90 border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.14)] overflow-hidden"
        >
          {/* Glass background stream effect inside modal */}
          <GlassBackground
            className="absolute inset-0 pointer-events-none -z-10 overflow-hidden"
            opacity="opacity-35"
          />

          {/* Top aesthetic accent hairline */}
          <div className="h-0.5 w-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400" />

          {/* Modal Header */}
          <div className="p-5 pb-3 border-b border-white/10 flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border border-purple-500/30 text-purple-300 bg-purple-500/10 flex items-center gap-1">
                  <Bot className="w-3 h-3 text-cyan-400" />
                  <span>[AI BUILDERS NETWORK]</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-cyan-400" />
                  <span>Monad Osaka Testnet 10143</span>
                </span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>Koliance Team &amp; Contacts</span>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Decentralized AI Builders &amp; Protocol Core Maintainers
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body - No scrollbars, clean and compact */}
          <div className="p-4 sm:p-5 space-y-2.5 relative z-10">
            {AI_BUILDERS.map((member, index) => {
              const isCopied = copiedId === member.id;
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="p-3 rounded-lg bg-[#0e121d]/80 hover:bg-[#121725]/90 border border-white/10 hover:border-purple-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 font-mono text-xs font-bold shrink-0">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white font-mono">
                          {member.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          (@{member.handle})
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md border ${member.badgeColor}`}>
                          {member.badge}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300/80 truncate">
                        {member.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <a
                      href={member.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 px-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-mono text-xs flex items-center gap-1 transition"
                      title={`View @${member.handle} on GitHub`}
                    >
                      <span>GH</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>

                    <button
                      onClick={() => handleCopyEmail(member.id, member.email)}
                      className={`h-8 px-2.5 rounded-md font-mono text-xs font-medium border flex items-center gap-1 cursor-pointer active:scale-[0.98] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
                        isCopied
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-purple-600 hover:bg-purple-500 text-white border-purple-500/40"
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-300" />
                          <span>[COPIED]</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`mailto:${member.email}`}
                      className="h-8 w-8 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-[0.98]"
                      title={`Mail to ${member.email}`}
                    >
                      <Send className="w-3 h-3 text-cyan-400" />
                    </a>
                  </div>
                </motion.div>
              );
            })}

            {/* Ecosystem channel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.16 }}
              className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-mono text-xs font-bold shrink-0">
                  <Mail className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white font-mono">
                      {ECOSYSTEM_CONTACT.name}
                    </span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md border ${ECOSYSTEM_CONTACT.badgeColor}`}>
                      {ECOSYSTEM_CONTACT.badge}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-cyan-300/80 truncate">
                    {ECOSYSTEM_CONTACT.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => handleCopyEmail(ECOSYSTEM_CONTACT.id, ECOSYSTEM_CONTACT.email)}
                  className={`h-8 px-2.5 rounded-md font-mono text-xs font-medium border flex items-center gap-1 cursor-pointer active:scale-[0.98] transition-all ${
                    copiedId === ECOSYSTEM_CONTACT.id
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500/40"
                  }`}
                >
                  {copiedId === ECOSYSTEM_CONTACT.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      <span>[COPIED]</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <a
                  href={`mailto:${ECOSYSTEM_CONTACT.email}`}
                  className="h-8 w-8 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-[0.98]"
                  title={`Mail to ${ECOSYSTEM_CONTACT.email}`}
                >
                  <Send className="w-3 h-3 text-cyan-400" />
                </a>
              </div>
            </motion.div>
          </div>

          {/* Modal Footer - sleek, compact */}
          <div className="px-5 py-3 bg-black/50 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400 relative z-10">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cryptographic AI Agent &amp; Contributor Verification</span>
            </div>

            <button
              onClick={onClose}
              className="h-7 px-3 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-mono text-xs cursor-pointer transition active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
export default ContactModal;
