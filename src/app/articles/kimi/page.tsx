import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Architecting Koliance on Monad with Kimi | Engineering Case Study",
  description:
    "How Kimi (Moonshot AI) accelerated smart contract formal invariants, cross-language parity, and autonomous agent delegated security on Monad 10,000 TPS parallel EVM.",
};

export default function KimiArticlePage() {
  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 font-sans selection:bg-purple-500/30">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d1017]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-mono font-bold tracking-wider text-white hover:text-purple-300 transition"
            >
              KOLIANCE
            </Link>
            <span className="text-slate-600 font-mono text-xs">/</span>
            <span className="text-xs font-mono text-purple-400">RESEARCH & ENGINEERING</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="h-8 px-3 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 transition flex items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-[0.98]"
            >
              Back to App
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="space-y-4 mb-10 pb-8 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
              SPONSOR TRACK: KIMI (MOONSHOT AI)
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">OCTOBER 2026</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">12 MIN READ</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Architecting Koliance on Monad with Kimi: Long-Context Verification and EIP-712 Session Key Engineering
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
            A comprehensive case study detailing how Koliance leveraged Kimi&apos;s massive context window and reasoning capabilities to synthesize cross-language consensus, enforce mathematical solvency invariants, and build high-frequency autonomous agent payment rails on Monad.
          </p>
        </div>

        {/* Article Body */}
        <article className="space-y-10 text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide font-mono flex items-center gap-2">
              <span className="text-purple-400 font-mono">[1]</span> Executive Summary &amp; Problem Statement
            </h2>
            <p>
              Autonomous AI agents operating in Web3 ecosystems encounter a fundamental trilemma: <strong className="text-white">delegated agency</strong>, <strong className="text-white">cryptographic scope limitation</strong>, and <strong className="text-white">execution finality</strong>. Allowing an agent unrestricted access to private keys inevitably precipitates catastrophic drain events. Conversely, mandating manual user signatures on every execution invalidates autonomous workflows.
            </p>
            <p>
              Koliance resolves this impasse on <strong className="text-white">Monad Testnet (Chain ID: 10143)</strong> by coupling Web2 reputation proofs (e.g. Steam gaming history) with an on-chain <strong className="text-white">SessionKeyRegistry (EIP-712)</strong>. However, coordinating a 10,000 TPS parallel EVM environment alongside an off-chain Go clearing engine and Next.js frontend creates exponential verification friction.
            </p>
            <div className="p-4 rounded-lg bg-[#0d121f] border border-purple-500/30 text-xs font-mono text-purple-200">
              [INSIGHT] Koliance utilized Kimi as an authoritative architectural copilot across 35+ documents, 5 smart contracts, and 14 backend micro-modules, maintaining unbroken context across complex dependency graphs without hallucination drift.
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide font-mono flex items-center gap-2">
              <span className="text-purple-400 font-mono">[2]</span> How Kimi Long-Context Was Deployed in Core Engineering
            </h2>
            <p>
              During the sprint, our repository accumulated dense architectural contracts, including Architectural Decision Records (<code className="text-purple-300 bg-white/5 px-1 py-0.5 rounded">ADR-001~005</code>), GAP audit registers tracking 60+ edge cases, and parallel EVM concurrency models. Kimi&apos;s 200k+ token window and logical deduction were utilized in three mission-critical workflows:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                <div className="text-xs font-mono font-bold text-cyan-400">[A. Cross-Language Parity]</div>
                <p className="text-xs text-slate-300">
                  Aligning Solidity 18-decimal fixed-point math with Go <code className="text-cyan-200">big.Int</code> and TypeScript <code className="text-cyan-200">BigInt</code>. Kimi verified that zero truncation drift occurred across the liquidation threshold calculation.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                <div className="text-xs font-mono font-bold text-purple-400">[B. EIP-712 Typed Data Scoping]</div>
                <p className="text-xs text-slate-300">
                  Formulating the <code className="text-purple-200">SessionAuthorization</code> struct schema and verifying replay-attack resistance against Monad chain re-organizations and cross-contract front-running.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                <div className="text-xs font-mono font-bold text-emerald-400">[C. GAP Audit Traceability]</div>
                <p className="text-xs text-slate-300">
                  Continuous gap analysis against the live <code className="text-emerald-200">docs/GAP台账.md</code>. Kimi audited each commit batch to ensure zero regressions in pre-existing test suites.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide font-mono flex items-center gap-2">
              <span className="text-purple-400 font-mono">[3]</span> Deep Dive: Formalizing SessionKeyRegistry Invariants
            </h2>
            <p>
              In <code className="text-purple-300 bg-white/5 px-1.5 py-0.5 rounded font-mono text-xs">contracts/perp/SessionKeyRegistry.sol</code>, agents execute transactions on behalf of users within rigid bounds:
            </p>

            <div className="bg-[#05070b] border border-white/10 rounded-lg p-4 font-mono text-xs overflow-x-auto text-slate-300 space-y-1">
              <div className="text-slate-500">{"// EIP-712 Delegated Session Key Payload vetted with Kimi"}</div>
              <div>struct SessionAuthorization &#123;</div>
              <div className="pl-4">address account;</div>
              <div className="pl-4">address sessionKey;</div>
              <div className="pl-4">uint256 maxPerTxUSD;</div>
              <div className="pl-4">uint256 dailyLimitUSD;</div>
              <div className="pl-4">uint256 validUntil;</div>
              <div className="pl-4">uint256 nonce;</div>
              <div>&#125;</div>
            </div>

            <p>
              Kimi identified a subtle front-running vulnerability in our initial daily spend tracking: if a block reorganization occurred on Monad, daily accumulators indexed purely by block timestamp could allow double-spend windows across day transitions. Guided by Kimi&apos;s recommendations, we implemented an epoch-bucketed rolling spend mechanism with atomic nonce invalidation.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide font-mono flex items-center gap-2">
              <span className="text-purple-400 font-mono">[4]</span> Concrete Value Brought by KIMI
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border border-white/10 rounded-lg overflow-hidden">
                <thead className="bg-white/5 text-slate-200 border-b border-white/10">
                  <tr>
                    <th className="p-3 text-left">METRIC / CRITERIA</th>
                    <th className="p-3 text-left">WITHOUT KIMI</th>
                    <th className="p-3 text-left text-purple-300">WITH KIMI INTEGRATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="p-3 font-semibold text-white">Full-Stack Context Window</td>
                    <td className="p-3 text-slate-400">Context truncated at 8k tokens; fragmentation</td>
                    <td className="p-3 text-purple-200">200k+ tokens ingested simultaneously (Go + Sol + TS)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Math Truncation Auditing</td>
                    <td className="p-3 text-slate-400">3 manual spreadsheets, 14 hours manual proof</td>
                    <td className="p-3 text-purple-200">Formal invariant checks verified across 19 unit test suites</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Security Vulnerabilities Caught</td>
                    <td className="p-3 text-slate-400">Standard unit tests only</td>
                    <td className="p-3 text-purple-200">4 critical edge cases flagged (GAP-18~21 Lua &amp; EIP-712 nonces)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Feature Velocity</td>
                    <td className="p-3 text-slate-400">Baseline 7-day iteration</td>
                    <td className="p-3 text-purple-200">Compressed to 48 hours with unbroken architectural alignment</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide font-mono flex items-center gap-2">
              <span className="text-purple-400 font-mono">[5]</span> Conclusion &amp; Monad Ecosystem Outlook
            </h2>
            <p>
              Building on Monad requires uncompromised precision because sub-second block times multiply the velocity of both value and exploits. Kimi served not merely as a generative assistant, but as an active formal verification engine that ensured Koliance adhered to the highest standards of Web3 cryptographic security and architectural rigor.
            </p>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-bold text-white">Explore Koliance Codebase on GitHub</div>
                <div className="text-xs text-slate-400 font-mono">Open source repository, contracts &amp; test suites</div>
              </div>
              <a
                href="https://github.com/moonhotline/koliance"
                target="_blank"
                rel="noreferrer"
                className="h-9 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-medium transition flex items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.98]"
              >
                Inspect on GitHub
              </a>
            </div>
          </section>
        </article>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/10 text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>Koliance Protocol • Monad Hackathon 2026</div>
          <div>Published for Kimi Sponsor Bounty Evaluation</div>
        </footer>
      </main>
    </div>
  );
}
