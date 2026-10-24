"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Award, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";

export interface RewardCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewardAmount: number;
  rewardCurrency?: string;
  actionType?: string;
  title?: string;
  subtitle?: string;
  onContinue?: () => void;
}

/**
 * Web Audio API synthesizer for instant zero-latency harmonic chime
 */
export function playCelebrationAudio() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    // Major 5th & octave chime: C5, E5, G5, C6
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const startAt = now + idx * 0.05;
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.12, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.7);
    });
  } catch {
    // Audio autoplay restrictions gracefully handled
  }
}

export function RewardCelebrationModal({
  isOpen,
  onClose,
  rewardAmount,
  rewardCurrency = "KOL",
  actionType = "WALLET_BIND",
  title,
  subtitle,
  onContinue,
}: RewardCelebrationModalProps) {
  const [displayNumber, setDisplayNumber] = useState(0);
  const audioPlayedRef = useRef(false);

  // Derive human-readable labels
  const actionLabels: Record<string, { title: string; subtitle: string }> = {
    WALLET_BIND: {
      title: "Wallet Verified & Bound",
      subtitle: "Official Monad testnet identity initialized. +100 KOL credited to your ecosystem vault.",
    },
    FIRST_CARD: {
      title: "First AgentCard Minted",
      subtitle: "Autonomous Visa debit capabilities enabled. +150 KOL credited to your vault.",
    },
    FIRST_API_KEY: {
      title: "Developer Key Created",
      subtitle: "High-frequency API gateway access unlocked. +50 KOL credited to your vault.",
    },
    CARD_CASHBACK_10: {
      title: "10% AgentCard Cashback",
      subtitle: "Autonomous payment transaction executed. 10% value rewarded in KOL.",
    },
    STRIPE_TOPUP: {
      title: "Stripe Deposit Bonus",
      subtitle: "USD liquidity settled. 100% matched at 1 USD : 10 KOL.",
    },
    GIFT: {
      title: "P2P Token Gift Unlocked",
      subtitle: "Token gift received and credited to your vault account.",
    },
  };

  const defaultMeta = actionLabels[actionType] || {
    title: "Ecosystem Reward Credited",
    subtitle: `Earned ${rewardAmount} ${rewardCurrency} for completing high-value ecosystem activity.`,
  };

  const finalTitle = title || defaultMeta.title;
  const finalSubtitle = subtitle || defaultMeta.subtitle;

  useEffect(() => {
    if (!isOpen) {
      setDisplayNumber(0);
      audioPlayedRef.current = false;
      return;
    }

    // 1. Audio synthesis
    if (!audioPlayedRef.current) {
      playCelebrationAudio();
      audioPlayedRef.current = true;
    }

    // 2. Mobile haptic pulse
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate([25, 40, 25]);
      } catch {
        // Ignored
      }
    }

    // 3. Canvas confetti burst (Monad purple, cyber cyan, emerald, white)
    import("canvas-confetti")
      .then((m) => {
        const confetti = m.default;
        confetti({
          particleCount: 85,
          spread: 75,
          origin: { y: 0.52 },
          colors: ["#836EF9", "#00F2FE", "#10B981", "#FFFFFF"],
        });
      })
      .catch(() => {});

    // 4. Smooth rolling counter animation
    const durationMs = 800;
    const steps = 30;
    const stepTime = durationMs / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      // ease-out quad
      const eased = progress * (2 - progress);
      const current = Math.round(eased * rewardAmount);
      setDisplayNumber(current);

      if (step >= steps) {
        setDisplayNumber(rewardAmount);
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isOpen, rewardAmount]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window: Rectangular with micro-radii rounded-xl */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-md overflow-hidden rounded-xl border border-purple-500/30 bg-[#0c0d14] p-6 shadow-2xl z-10"
        >
          {/* Subtle Top Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#836ef9] to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center pt-2">
            {/* Top Indicator Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#836ef9]/15 border border-[#836ef9]/30 text-[#00f2fe] text-xs font-mono mb-4">
              <Sparkles className="w-3.5 h-3.5 text-[#00f2fe]" />
              <span>[REWARD UNLOCKED]</span>
            </div>

            {/* Icon / Emblem */}
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#836ef9]/20 to-[#00f2fe]/20 border border-[#836ef9]/40 flex items-center justify-center mb-4">
              <Award className="w-8 h-8 text-[#836ef9]" />
            </div>

            {/* Rolling Counter */}
            <div className="flex items-baseline justify-center gap-1.5 mb-2">
              <span className="text-4xl font-mono font-bold tracking-tight text-white">
                +{displayNumber}
              </span>
              <span className="text-xl font-mono font-semibold text-[#00f2fe]">
                {rewardCurrency}
              </span>
            </div>

            {/* Title & Description */}
            <h3 className="text-lg font-mono font-semibold text-white mb-1.5">
              {finalTitle}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-6 font-mono">
              {finalSubtitle}
            </p>

            {/* Details Box */}
            <div className="w-full rounded-md border border-white/10 bg-white/[0.02] p-3 text-left mb-6 font-mono text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Distribution Method:</span>
                <span className="text-slate-200">Ecosystem Vault Ledger</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Withdrawal Eligibility:</span>
                <span className="text-emerald-400 font-medium">Accumulative (≥ 50 KOL)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Action Reference:</span>
                <span className="text-purple-300 font-medium">{actionType}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={onClose}
                className="flex-1 h-10 px-4 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-mono font-medium text-slate-300 transition-all active:scale-[0.98]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  if (onContinue) onContinue();
                }}
                className="flex-1 h-10 px-4 py-2 rounded-md border border-purple-500/40 bg-[#836ef9] hover:bg-[#725aeb] text-xs font-mono font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
