"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "en" | "zh";

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "vision.hero_tag": "NEXT-GEN ON-CHAIN AGENT INFRASTRUCTURE",
    "vision.hero_engine": "10,000 TPS Monad Engine",
    "vision.title_prefix": "Make AI Agents",
    "vision.title_highlight": "Trusted Economic Participants",
    "vision.subtitle": "Autonomous AI agents don't just chat—they purchase tools, call APIs, trade assets, and allocate capital. Koliance delivers verifiable identity, attested credit, and scoped financial execution.",
    "vision.register": "Register Identity",
    "vision.explore": "Explore Trust Graph",
    
    // Core Problem
    "problem.title": "What Core Problem Does Koliance Solve?",
    "problem.subtitle": "Future AI agents need economic agency. But for agents to participate safely in the economy, three foundational challenges must be solved:",
    "problem.identity_title": "Identity",
    "problem.identity_desc": "Who is this agent? Who authorized it? On whose behalf does it act?",
    "problem.identity_sol": "Koliance Solution: Cryptographic identities & on-chain delegation credentials.",
    "problem.trust_title": "Trust & Reputation",
    "problem.trust_desc": "Why should counterparties trust it? Can historical actions be verified? How much credit does it deserve?",
    "problem.trust_sol": "Koliance Solution: Verifiable attestations from Steam gameplay, GitHub contributions, and on-chain track records.",
    "problem.access_title": "Financial Access",
    "problem.access_desc": "How much can it spend? Where can it spend? How are permissions revoked or constrained if anomalous behavior occurs?",
    "problem.access_sol": "Koliance Solution: Scoped Session Keys, programmable allowances, circuit breakers, and institutional settlement.",

    "problem.chain_title": "Economic Participation Pipeline",
    "problem.chain_step1": "Verifiable Identity",
    "problem.chain_step2": "Verifiable Credit",
    "problem.chain_step3": "Scoped Financial Controls",
    "problem.chain_step4": "Trusted Autonomous Agency",

    // Functional Matrix
    "matrix.title": "Strategic Architecture & Feature Taxonomy",
    "matrix.subtitle": "Production-grade separation of core infrastructure, credit engines, and experimental environments.",
    "matrix.core_infra": "Core Infrastructure",
    "matrix.credit_inputs": "Credit Inputs & Attestation",
    "matrix.financial_gateway": "Financial Gateway & Execution",
    "matrix.settlement_signals": "Settlement & Alpha Signals",
    
    "matrix.wallet_identity": "Wallet Identity & Koliance.sol",
    "matrix.wallet_identity_role": "Core cryptographic root identity on parallel EVM",
    "matrix.session_registry": "Session Key Registry",
    "matrix.session_registry_role": "Core EIP-712 delegated authorization with monotonic nonce & daily limits",
    "matrix.dynamic_wallet": "Dynamic Wallet Delegation",
    "matrix.dynamic_wallet_role": "Scoped session keys & programmable authorization without exposing master keys",
    "matrix.steam_github": "Steam & GitHub Proofs",
    "matrix.steam_github_role": "Cryptographic zero-knowledge / server-verified developer & gamer credit attestations",
    "matrix.agentcard": "AgentCard Terminal",
    "matrix.agentcard_role": "Primary product interface for programmable agent financial access",
    "matrix.monad_record": "Monad Settlement Layer",
    "matrix.monad_record_role": "Verifiable ledger with sub-second single-slot finality",
    "matrix.nansen_signals": "Nansen Smart Money Signals",
    "matrix.nansen_signals_role": "Early smart money detection to guide algorithmic capital allocation",
    "matrix.alpaca_perp": "Alpaca Equities & Perp Engine",
    "matrix.alpaca_perp_role": "High-throughput collateralized derivative & trading sandbox",
    "matrix.stripe": "Stripe Gateway",
    "matrix.stripe_role": "Fiat on-ramp & future enterprise monetization rails",
    "matrix.kol_token": "KolToken Utility",
    "matrix.kol_token_role": "Ecosystem testnet utility token for gas and staking incentives",
  },
  zh: {
    "vision.hero_tag": "下一代链上自主 AGENT 信任与清结算体系",
    "vision.hero_engine": "10,000 TPS Monad 原生并行引擎",
    "vision.title_prefix": "让 AI 不仅能行动，",
    "vision.title_highlight": "还值得被信任",
    "vision.subtitle": "未来的 AI Agent 不只是聊天机器人。它们会自主购买软件、调用 API、玩游戏、执行交易，甚至管理资金。Koliance 提供可验证身份、可信信用证明与受限金融权限基础设施。",
    "vision.register": "注册链上身份",
    "vision.explore": "探索信任图谱",
    
    // Core Problem
    "problem.title": "我们究竟在解决什么问题？",
    "problem.subtitle": "未来的 AI Agent 不只是聊天机器人。它们会自主参与经济活动。但要让 Agent 真正参与经济，有三个基础问题：",
    "problem.identity_title": "身份 Identity",
    "problem.identity_desc": "这个 Agent 是谁？由谁授权？它代表谁行动？",
    "problem.identity_sol": "Koliance 解法：可验证身份与授权凭证（Koliance.sol / Dynamic Delegation）。",
    "problem.trust_title": "信用 Trust & Reputation",
    "problem.trust_desc": "为什么应该相信它？它过去的行为能否被验证？它可以获得多少信任？",
    "problem.trust_sol": "Koliance 解法：来自游戏记录、开发贡献及其他可信来源的可验证证明。",
    "problem.access_title": "金融能力 Financial Access",
    "problem.access_desc": "它能花多少钱？能在哪里花？出了问题如何限制或撤销权限？",
    "problem.access_sol": "Koliance 解法：受限 Session Key、可编程支出权限、熔断机制及清结算基础设施。",

    "problem.chain_title": "自主经济闭环体系",
    "problem.chain_step1": "可验证身份",
    "problem.chain_step2": "可验证信用",
    "problem.chain_step3": "受控金融权限",
    "problem.chain_step4": "可信的自主经济活动",

    // Functional Matrix
    "matrix.title": "战略功能分类与架构定位",
    "matrix.subtitle": "生产级别分层：区分核心基础设施、信用证明源、受限执行入口与市场信号。",
    "matrix.core_infra": "核心基础设施",
    "matrix.credit_inputs": "信用数据来源与验证入口",
    "matrix.financial_gateway": "金融能力与执行入口",
    "matrix.settlement_signals": "清结算与投资信号",

    "matrix.wallet_identity": "钱包身份与 Koliance 身份合约",
    "matrix.wallet_identity_role": "核心根身份基础设施，支持可验证凭证",
    "matrix.session_registry": "Session Key Registry",
    "matrix.session_registry_role": "核心授权基础设施，支持单调 Nonce 撤销与日限额保护",
    "matrix.dynamic_wallet": "Dynamic 钱包与 Agent 委托",
    "matrix.dynamic_wallet_role": "在用户限定范围内安全执行签名，保护主私钥",
    "matrix.steam_github": "Steam / GitHub 证明",
    "matrix.steam_github_role": "信用数据来源与验证入口，服务端验签拒绝伪造",
    "matrix.agentcard": "AgentCard",
    "matrix.agentcard_role": "Agent 金融能力的产品入口与支出管护",
    "matrix.monad_record": "Monad 链上存证",
    "matrix.monad_record_role": "可验证记录与并行结算基础设施",
    "matrix.nansen_signals": "Nansen 交易投资信号",
    "matrix.nansen_signals_role": "智能资金流向跟踪，先人一步让正确价值回归",
    "matrix.alpaca_perp": "Alpaca 股票与永续交易",
    "matrix.alpaca_perp_role": "实验性金融场景，非核心底座",
    "matrix.stripe": "Stripe 集成",
    "matrix.stripe_role": "未来法币支付与商业化的接入方式",
    "matrix.kol_token": "KolToken 代币",
    "matrix.kol_token_role": "可选激励机制，不作为产品存在前提",
  },
};

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: string) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("koliance_lang");
    if (saved === "zh" || saved === "en") {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("koliance_lang", newLang);
  };

  const t = (key: string) => {
    return translations[lang]?.[key] || translations["en"]?.[key] || key;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

export const useLanguage = () => useContext(I18nContext);
