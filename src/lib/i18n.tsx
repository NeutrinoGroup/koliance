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
    // Top Navigation
    "nav.index": "INDEX",
    "nav.console": "CONSOLE",
    "nav.token": "TOKEN",
    "nav.detail": "DETAIL",
    "nav.product": "PRODUCT",
    "nav.market": "MARKET",
    "nav.perp": "PERP",
    "nav.agentcard": "AGENTCARD",

    // User Center & Auth Badges
    "auth.user_center": "User Center",
    "auth.edit_profile": "Edit Profile",
    "auth.connect_wallet": "Connect Wallet",
    "auth.wallet_unconnected": "Not Connected",
    "auth.onchain_wallet": "Monad On-Chain Wallet",
    "auth.developer_default": "Koliance Developer",
    "auth.google_unlinked": "Google Account Unlinked",
    "auth.copy_address": "Copy Address",
    "auth.copied": "Copied",
    "auth.copy": "Copy",
    "auth.view_explorer": "View on Explorer",
    "auth.transfer_kol": "Transfer KOL",
    "auth.transfer_mon": "Transfer MON",
    "auth.disconnect": "Disconnect",
    "auth.steam_proof": "Steam Gaming Proof",
    "auth.github_badge": "GitHub Developer Badge",
    "auth.google_auth": "Google Identity Auth",
    "auth.verified": "Verified",
    "auth.to_bind": "Bind Now",
    "auth.to_login": "Sign In",
    "auth.instant_demo": "Synthetic Demo Mode",
    "auth.logout": "Sign Out",

    // Hero Section
    "vision.hero_tag": "NEXT-GEN ON-CHAIN AGENT INFRASTRUCTURE",
    "vision.hero_engine": "10,000 TPS Monad Engine",
    "vision.title_prefix": "Make AI agents",
    "vision.title_highlight": "trusted economic participants.",
    "vision.subtitle": "Autonomous AI agents don't just chat—they purchase tools, call APIs, trade assets, and allocate capital. Koliance delivers verifiable identity, attested credit, and scoped financial execution.",
    "vision.register": "Register Identity",
    "vision.explore": "Explore Trust Graph",
    
    // Core Problem
    "problem.title": "What Core Problem Does Koliance Solve?",
    "problem.subtitle": "Future AI agents need economic agency. But for agents to participate safely in the economy, three foundational challenges must be solved:",
    "problem.identity_title": "Identity",
    "problem.identity_desc": "Who is this agent? Who authorized it? On whose behalf does it act?",
    "problem.identity_sol": "Koliance Solution: Cryptographic identities & on-chain delegation credentials (Koliance.sol / Dynamic Delegation).",
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

    // Minimalist Gateway Rails
    "gateway.tag": "[PARALLEL EXECUTION RAILS]",
    "gateway.title": "Protocol Architecture",
    "gateway.hint": "SELECT NAVIGATION RAIL TO ENGAGE",
    "gateway.r1_title": "TRUST CONSTELLATION GRAPH",
    "gateway.r1_desc": "Multi-cluster trust weights, AI audit agents & parallel consensus metrics.",
    "gateway.r2_title": "HOLOGRAPHIC VERIFICATION",
    "gateway.r2_desc": "3D holographic identity badge, staking dashboard & biometric protocol.",
    "gateway.r3_title": "NEURAL CARD SCANNER",
    "gateway.r3_desc": "Full-stack Neural Asset Processor with 6-card circulating digitization.",
    "gateway.r4_title": "KOL HALVING TOKEN HUB",
    "gateway.r4_desc": "2^30 Max Supply · 2-year halving · Monad block claiming & transfer.",

    // Agent Narrative Flow
    "narrative.tag": "[AUTONOMOUS LIFECYCLE EXECUTION]",
    "narrative.title": "Autonomous AI Agent Workflow",
    "narrative.subtitle": "From cryptographic identity registration to sub-second Monad finality settlement.",
    "narrative.autoplay": "Auto Play",
    "narrative.paused": "Paused",
    "narrative.open_console": "Open Developer Console",
    "narrative.step1_title": "1. AI Agent Identity Generation",
    "narrative.step1_desc": "Agent registers identity with designated model weight and deterministic cryptographic fingerprint.",
    "narrative.step2_title": "2. GitHub & Gaming Reputation Proof",
    "narrative.step2_desc": "BUIDL metrics, code commits, and gaming telemetry attestations are ingested and verified without exposing private data.",
    "narrative.step3_title": "3. EIP-712 Session Key Delegation",
    "narrative.step3_desc": "Card owner signs cryptographic session delegation with strict single-transaction ($100) and daily ($500) limit guardrails.",
    "narrative.step4_title": "4. Autonomous Micro-Payment Execution",
    "narrative.step4_desc": "Agent pays compute clusters, data oracles, or APIs via gasless virtual cards, streaming real-time ledger updates.",
    "narrative.step5_title": "5. Monad 10,000 TPS Batch Settlement",
    "narrative.step5_desc": "High-frequency micropayments and order hashes are aggregated and settled deterministically onto the Monad execution layer.",

    // Token Studio
    "token.title": "KOL Token (KOL)",
    "token.deployed": "Deployed",
    "token.desc": "Koliance native utility token, symbol KOL. Total supply hard cap 2^30 (1,073,741,824), governed by Bitcoin-style 2-year halving emission.",
    "token.disclaimer": "[DISCLAIMER] Koliance Testnet Utility Token (No Monetary Value) — Strictly for testing agent escrow fees and credit stake weight.",
    "token.add_metamask": "Add KOL to MetaMask",
    "token.view_explorer": "View on Monad Explorer",
    "token.my_balance": "My KOL Balance",
    "token.native_mon": "Native MON",
    "token.total_supply": "Total Minted Supply",
    "token.hard_cap": "Hard Cap: 1,073,741,824 (2^30)",
    "token.halving_era": "Halving Era",
    "token.era_prefix": "Era",
    "token.era_suffix": "",
    "token.halving_cycle": "Cycle: 50% halving every 2 years (730 days)",
    "token.reward_rate": "Current Block Reward Rate",
    "token.per_sec": "/sec",
    "token.single_slot": "Single-slot finality real-time emission",
    "token.faucet_tab": "Airdrop Faucet / Claim Mining",
    "token.faucet_desc": "Claim 100 KOL from the on-chain minting pool for testnet gas and agent staking testing.",
    "token.claim_btn": "Claim 100 KOL",
    "token.claiming": "Claiming on Monad...",
    "token.transfer_tab": "Transfer KOL / MON",
    "token.transfer_desc": "Send KOL or native MON to another Monad testnet address with sub-second finality.",
    "token.recipient_label": "Recipient Address (0x...)",
    "token.amount_label": "Transfer Amount",
    "token.transfer_btn": "Confirm Transfer",
    "token.transferring": "Submitting Transfer...",
    "token.audit_logs": "Recent Audit Trail",
    "token.no_logs": "No transfer records yet",

    // Developer Console
    "console.title": "Developer Console",
    "console.subtitle": "Autonomous Agent API Gateway & Credential Orchestration",
    "console.tab_overview": "Overview",
    "console.tab_keys": "API Keys",
    "console.tab_playground": "Playground",
    "console.tab_packages": "Packages & Quotas",
    "console.tab_agents": "Agent Fleet",
    "console.tab_audit": "Audit Trail",
    "console.calls_24h": "Total Invocations (24h)",
    "console.remaining_quota": "Remaining Quota",
    "console.success_rate": "Success Rate",
    "console.avg_latency": "Average Latency",
    "console.bound_agents": "Active Bound Agents",
    "console.create_key": "Create New API Key",
    "console.key_name": "Key Name",
    "console.generate_key": "Generate Key",
    "console.secret_notice": "Secret Key (Only shown once)",
    "console.copy_key": "Copy Key",
    "console.revoke": "Revoke",
    "console.no_keys": "No active API keys found",
    "console.claim_free": "Claim Daily Free API Quota",
    "console.free_claims_left": "Free Claims Remaining",

    // Common
    "common.loading": "Loading...",
    "common.success": "Success",
    "common.error": "Error",
    "common.confirm": "Confirm",
    "common.cancel": "Cancel",
    "common.explorer": "Explorer",
    "common.status": "Status",
    "common.action": "Action",
  },
  zh: {
    // Top Navigation
    "nav.index": "首页",
    "nav.console": "控制台",
    "nav.token": "代币",
    "nav.detail": "身份图谱",
    "nav.product": "凭证工作台",
    "nav.market": "交易市场",
    "nav.perp": "永续合约",
    "nav.agentcard": "Agent名片",

    // User Center & Auth Badges
    "auth.user_center": "个人中心",
    "auth.edit_profile": "编辑资料",
    "auth.connect_wallet": "连接钱包",
    "auth.wallet_unconnected": "未连接",
    "auth.onchain_wallet": "Monad 链上钱包",
    "auth.developer_default": "Koliance 开发者",
    "auth.google_unlinked": "未登录谷歌账户",
    "auth.copy_address": "复制地址",
    "auth.copied": "已复制",
    "auth.copy": "复制",
    "auth.view_explorer": "在区块浏览器查看",
    "auth.transfer_kol": "转账 KOL",
    "auth.transfer_mon": "转账 MON",
    "auth.disconnect": "断开",
    "auth.steam_proof": "Steam 信用证明",
    "auth.github_badge": "GitHub 开发者勋章",
    "auth.google_auth": "Google 身份认证",
    "auth.verified": "已验证",
    "auth.to_bind": "去绑定",
    "auth.to_login": "去登录",
    "auth.instant_demo": "沙盒模拟登录",
    "auth.logout": "退出登录",

    // Hero Section
    "vision.hero_tag": "下一代链上自主 AGENT 信任与清结算体系",
    "vision.hero_engine": "10,000 TPS Monad 原生并行引擎",
    "vision.title_prefix": "让 AI 不仅能行动，",
    "vision.title_highlight": "还值得被信任。",
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

    // Minimalist Gateway Rails
    "gateway.tag": "[并行执行通道]",
    "gateway.title": "协议核心架构",
    "gateway.hint": "选择导航通道进入模块",
    "gateway.r1_title": "信用星系图谱",
    "gateway.r1_desc": "多集群信任权重、AI审计代理与并行共识指标。",
    "gateway.r2_title": "全息身份与质押",
    "gateway.r2_desc": "3D全息身份勋章、质押面板与生物识别协议。",
    "gateway.r3_title": "神经资产扫描器",
    "gateway.r3_desc": "全栈神经资产处理器与六卡循环数字化展示。",
    "gateway.r4_title": "KOL 减半代币中心",
    "gateway.r4_desc": "2^30 硬顶总量 · 2年减半周期 · Monad区块产出与转账。",

    // Agent Narrative Flow
    "narrative.tag": "[自主生命周期执行流]",
    "narrative.title": "自主 AI Agent 业务闭环",
    "narrative.subtitle": "从密码学身份注册到亚秒级 Monad 确定性结算的完整闭环。",
    "narrative.autoplay": "自动播放",
    "narrative.paused": "已暂停",
    "narrative.open_console": "进入开发者控制台",
    "narrative.step1_title": "1. AI Agent 身份生成",
    "narrative.step1_desc": "Agent 注册具有指定模型权重与确定性密码学指纹的链上身份。",
    "narrative.step2_title": "2. GitHub 贡献与游戏声誉证明",
    "narrative.step2_desc": "BUIDL 指标、代码提交与游戏遥测证明在不暴露隐私数据的前提下被摄取并验证。",
    "narrative.step3_title": "3. EIP-712 Session Key 授权委托",
    "narrative.step3_desc": "持卡人签署密码学会话委托，严格限定单笔支出上限（$100）与每日限额（$500）。" ,
    "narrative.step4_title": "4. 自主微支付流水执行",
    "narrative.step4_desc": "Agent 通过免 Gas 虚拟卡向算力集群、预言机或 API 支付费用，实时广播账本流水。",
    "narrative.step5_title": "5. Monad 10,000 TPS 批量最终结算",
    "narrative.step5_desc": "高频微支付与订单哈希被聚合并以确定性方式在 Monad 执行层完成最终结算。",

    // Token Studio
    "token.title": "KOL 代币 (KOL)",
    "token.deployed": "已部署",
    "token.desc": "Koliance 原生代币，名称 kol，符号 KOL。总硬顶恒定 2^30 (1,073,741,824) 枚，遵循比特币式每 2 年减半释放模型。",
    "token.disclaimer": "[免责声明] Koliance 测试网效用代币（无货币价值）— 仅用于测试 Agent 托管费与信用质押权重。",
    "token.add_metamask": "添加 KOL 到 MetaMask",
    "token.view_explorer": "Monad Explorer 查看",
    "token.my_balance": "我的 KOL 余额",
    "token.native_mon": "原生 MON",
    "token.total_supply": "当前已产出总量",
    "token.hard_cap": "硬顶: 1,073,741,824 (2^30)",
    "token.halving_era": "减半纪元 (Era)",
    "token.era_prefix": "第",
    "token.era_suffix": "纪元",
    "token.halving_cycle": "周期: 每 2 年 (730 天) 减半 50%",
    "token.reward_rate": "当前区块产出速率",
    "token.per_sec": "/秒",
    "token.single_slot": "单槽最终确定性实时产出",
    "token.faucet_tab": "空投领水 / 挖矿奖励",
    "token.faucet_desc": "从链上铸造池领取 100 KOL，用于测试网 Gas 消耗及 Agent 质押体验。",
    "token.claim_btn": "免费领取 100 KOL",
    "token.claiming": "正在链上领取...",
    "token.transfer_tab": "转账 KOL / MON",
    "token.transfer_desc": "将 KOL 或原生 MON 发送到其他 Monad 测试网地址，亚秒级确认。",
    "token.recipient_label": "接收地址 (0x...)",
    "token.amount_label": "转账数量",
    "token.transfer_btn": "确认转账",
    "token.transferring": "转账提交中...",
    "token.audit_logs": "近期审计历史",
    "token.no_logs": "暂无交易记录",

    // Developer Console
    "console.title": "开发者控制台",
    "console.subtitle": "自主 Agent API 网关与凭证调度中心",
    "console.tab_overview": "概览",
    "console.tab_keys": "API 密钥",
    "console.tab_playground": "演练台",
    "console.tab_packages": "套餐配额",
    "console.tab_agents": "Agent 舰队",
    "console.tab_audit": "审计追踪",
    "console.calls_24h": "24小时调用量",
    "console.remaining_quota": "剩余可用配额",
    "console.success_rate": "请求成功率",
    "console.avg_latency": "平均响应延迟",
    "console.bound_agents": "已绑定 Agent",
    "console.create_key": "创建新 API 密钥",
    "console.key_name": "密钥名称",
    "console.generate_key": "生成密钥",
    "console.secret_notice": "密钥密文 (仅展示一次)",
    "console.copy_key": "复制密钥",
    "console.revoke": "吊销",
    "console.no_keys": "暂无活跃 API 密钥",
    "console.claim_free": "领取每日免费 API 额度",
    "console.free_claims_left": "剩余免费领取次数",

    // Common
    "common.loading": "加载中...",
    "common.success": "成功",
    "common.error": "错误",
    "common.confirm": "确认",
    "common.cancel": "取消",
    "common.explorer": "区块浏览器",
    "common.status": "状态",
    "common.action": "操作",
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
