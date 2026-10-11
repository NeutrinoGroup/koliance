"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, X, ExternalLink } from "lucide-react";
import { monadTestnet } from "@/lib/contract";

interface NetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: () => void;
}

export function NetworkModal({ isOpen, onClose, onSwitch }: NetworkModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="glass-panel-glow rounded-lg p-6 sm:p-8 max-w-md w-full border border-purple-500/40 shadow-xl relative"
        >
          <button
            onClick={onClose}
            className="absolute right-5 top-5 text-monad-400 hover:text-white p-1 rounded-lg hover:bg-monad-500/20 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-md bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-5">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">Switch to Monad Testnet</h3>
          <p className="text-sm text-monad-200/80 mb-6 leading-relaxed">
            Koliance operates on the Monad high-throughput parallel EVM Testnet (Chain ID 10143). Please switch networks in
            your wallet to interact with on-chain identity and trust contracts.
          </p>

          <div className="p-4 rounded-md bg-monad-950/70 border border-monad-500/20 space-y-2 mb-6 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-monad-400">Network Name:</span>
              <span className="text-white font-bold">Monad Testnet</span>
            </div>
            <div className="flex justify-between">
              <span className="text-monad-400">Chain ID:</span>
              <span className="text-cyber-accent">10143</span>
            </div>
            <div className="flex justify-between">
              <span className="text-monad-400">Currency:</span>
              <span className="text-emerald-400">MON</span>
            </div>
            <div className="flex justify-between">
              <span className="text-monad-400">RPC URL:</span>
              <span className="text-monad-300 truncate max-w-[200px]">https://testnet-rpc.monad.xyz</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onSwitch}
              className="w-full h-10 px-6 rounded-md bg-purple-600 hover:bg-purple-500 border border-purple-500/40 text-white font-mono text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Add / Switch to Monad</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="https://testnet.monadexplorer.com"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono text-monad-400 hover:text-white transition"
            >
              <span>View Monad Explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
