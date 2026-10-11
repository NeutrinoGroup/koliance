import React from 'react';
import { useCurrentFrame } from 'remotion';

interface SubtitleItem {
  start: number;
  end: number;
  badge: string;
  cn: string;
  en: string;
}

const SUBTITLES: SubtitleItem[] = [
  // Act 1 (0 - 900)
  {
    start: 0,
    end: 220,
    badge: 'ACT 01 // 资产安全危机',
    cn: '传统 AI Agent 困境：直接交付无限制私钥，面临 Prompt 注入穿仓与资产洗劫风险',
    en: 'The Agent Dilemma: Delegating unrestricted raw private keys risks instant liquidation cascades',
  },
  {
    start: 220,
    end: 450,
    badge: 'ACT 01 // 灾难取证',
    cn: '模拟黑客攻击或 Agent 逻辑死循环：高频恶意刷单，金库余额瞬间归零',
    en: 'Simulated Drain Attack: Infinite loop orders trigger catastrophic capital loss',
  },
  {
    start: 450,
    end: 680,
    badge: 'ACT 01 // KOLIANCE 破局',
    cn: 'Koliance 破局之道：基于 Monad 的 EIP-712 Session Key + AgentCard 双重风控装甲',
    en: 'The Koliance Shield: EIP-712 Session Keys + AgentCard on Monad Parallel EVM',
  },
  {
    start: 680,
    end: 900,
    badge: 'ACT 01 // 策略边界',
    cn: '链上强约束：单笔限额、日累计上限、MCC 消费白名单与微秒级熔断断路器',
    en: 'On-Chain Bounds: MaxPerTx limits, daily allowance caps, MCC whitelists, and circuit breakers',
  },

  // Act 2 (900 - 2250)
  {
    start: 900,
    end: 1200,
    badge: 'ACT 02 // 身份锚定',
    cn: '开发者控制台：将真实 Web2 身份（GitHub / Steam）与 Agent 智能体链上绑定',
    en: 'Identity Anchoring: Verifying developer GitHub & Steam credentials to bootstrap trust',
  },
  {
    start: 1200,
    end: 1550,
    badge: 'ACT 02 // 零知识凭证',
    cn: '去中心化证明生成：将开发者历史贡献与信用度转化为抗女巫凭证',
    en: 'Zero-Knowledge Proofs: Transforming developer reputation into Sybil-resistant on-chain credit',
  },
  {
    start: 1550,
    end: 1900,
    badge: 'ACT 02 // 信用评级计算',
    cn: '链上信用评分跃迁：由 0 跃升至 820 AAA 级，获得 Monad 链上无抵押信用配额',
    en: 'Dynamic Credit Scoring: Score jumps from 0 to 820 AAA, unlocking on-chain credit lines',
  },
  {
    start: 1900,
    end: 2250,
    badge: 'ACT 02 // 授权会话密钥',
    cn: '一键生成 EIP-712 委托会话密钥，授予 AgentCard $5,000 USD 信用授信额度',
    en: 'Deploying EIP-712 Session Key, granting the AgentCard a governed $5,000 USD credit allowance',
  },

  // Act 3 (2250 - 3600)
  {
    start: 2250,
    end: 2600,
    badge: 'ACT 03 // 自主开仓交易',
    cn: 'AI 智能体在预设策略内自主调用 Session Key，在 Monad Perp 实时开立多头仓位',
    en: 'Autonomous Trading: AI Agent invokes Session Key to open long positions on Monad Perp',
  },
  {
    start: 2600,
    end: 2950,
    badge: 'ACT 03 // 小额高频微支付',
    cn: '流式 API 计算服务结算：每秒微额扣费实时上链，零感知平滑扣划',
    en: 'Micro-Payment Streams: Sub-cent compute billing settled instantaneously on-chain',
  },
  {
    start: 2950,
    end: 3300,
    badge: 'ACT 03 // 限频限额拦截网',
    cn: '风控压测：模拟异常并发调用与超限单，触发智能合约限频保护与熔断规则',
    en: 'Security Test: Simulating high-frequency spam and oversized orders triggers contract rate limits',
  },
  {
    start: 3300,
    end: 3600,
    badge: 'ACT 03 // 资产防穿仓生效',
    cn: 'SessionKey 实时冻结！单笔超限直接回滚，资金库毫发无损，完美阻断穿仓风险',
    en: 'Circuit Breaker Active: Instant session freeze prevents malicious drawdown completely',
  },

  // Act 4 (3600 - 4500)
  {
    start: 3600,
    end: 3900,
    badge: 'ACT 04 // 链上真实存证',
    cn: 'Monad Explorer 链上核验：全部交易 Hash 真实可查，亚秒级最终确定性落地',
    en: 'On-Chain Verification: Inspecting real Monad transaction hashes with sub-second block finality',
  },
  {
    start: 3900,
    end: 4200,
    badge: 'ACT 04 // 合规净资产结算',
    cn: '链上智能金库严格对拍：杜绝坏账与截断漂移，实现企业级合规净资产结算',
    en: 'Solvency Attestation: Zero bad-debt liquidation audit with exact mathematical parity',
  },
  {
    start: 4200,
    end: 4500,
    badge: 'ACT 04 // Monad 并行基石',
    cn: '依托 Monad 10,000 TPS 并行 EVM 执行架构，构筑未来百万自主 Agent 的金融主权基石',
    en: 'Powered by Monad: Parallel EVM delivering 10,000 TPS for the autonomous AI economy',
  },
];

export const SubtitleOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  const current = SUBTITLES.find((s) => frame >= s.start && frame < s.end);
  if (!current) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 36,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 1400,
        backgroundColor: 'rgba(11, 14, 20, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        padding: '16px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 60,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'ui-monospace, monospace',
            color: '#00f2fe',
            letterSpacing: '0.08em',
          }}
        >
          {current.badge}
        </div>
        <div
          style={{
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
            color: '#64748b',
          }}
        >
          [STRICT_AUDIT_ENABLED]
        </div>
      </div>

      <div style={{ fontSize: 20, fontWeight: 600, color: '#f8fafc', lineHeight: 1.3 }}>
        {current.cn}
      </div>

      <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.2, fontFamily: 'ui-sans-serif, sans-serif' }}>
        {current.en}
      </div>
    </div>
  );
};
