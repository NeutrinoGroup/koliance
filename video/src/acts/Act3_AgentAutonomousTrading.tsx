import React from 'react';
import { useCurrentFrame, spring } from 'remotion';

export const Act3_AgentAutonomousTrading: React.FC = () => {
  const frame = useCurrentFrame();
  const localFrame = frame - 2250;

  // Transition: Part 3.1 (0 - 700, frame 2250-2950), Part 3.2 (700 - 1350, frame 2950-3600)
  const isPart2 = localFrame >= 700;
  const localPart2 = localFrame - 700;

  const part1Spring = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 15, stiffness: 100 },
  });

  const part2Spring = spring({
    frame: localPart2,
    fps: 30,
    config: { damping: 14, stiffness: 110 },
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 100px 140px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {!isPart2 ? (
        /* PART 3.1: Agent 在授权策略内，调用 Session Key 自主开仓与小额高频支付 */
        <div
          style={{
            transform: `scale(${part1Spring})`,
            opacity: part1Spring,
            width: 1240,
            backgroundColor: '#0d1119',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(16, 185, 129, 0.15)',
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 52,
              backgroundColor: '#131926',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#10b981',
                }}
              >
                AUTONOMOUS EXECUTION // ACTIVE TRADE &amp; BILLING
              </div>
              <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                EIP-712 SESSION KEY IN ACTION (MONAD TESTNET)
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#00f2fe', fontWeight: 600 }}>
              POLICY BOUND: MAX $100/TX · 10 REQ/SEC
            </div>
          </div>

          {/* Split Screen: Left AI Brain Console, Right Market Execution */}
          <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Left: AI Agent Brain Loop */}
            <div
              style={{
                backgroundColor: '#070a0f',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 6,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>AGENT TELEMETRY LOG</span>
                <span style={{ fontSize: 10, color: '#10b981' }}>STATUS: LOOP_EXECUTION</span>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#cbd5e1',
                  lineHeight: 1.6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ color: '#64748b' }}>&gt; [T+0.1s] Analysing market depth on MON/USDC...</div>
                <div style={{ color: '#00f2fe' }}>
                  &gt; [T+0.3s] Signal: Funding arbitrage detected. Profit probability: 94.2%
                </div>
                <div style={{ color: '#f8fafc' }}>
                  &gt; [T+0.5s] Signing EIP-712 payload with delegated sub-key 0x7a3F...e8D2
                </div>
                <div style={{ color: '#10b981', fontWeight: 700 }}>
                  &gt; [T+0.7s] CALL executeTx(Order: LONG $45.00 MON_PERP, 5x lev) -&gt; SUCCESS
                </div>
                <div style={{ color: '#94a3b8' }}>
                  &gt; [T+0.9s] Streaming micro-payment: $0.015 USDC for AI Inference tokens
                </div>
                <div style={{ color: '#10b981' }}>
                  &gt; [T+1.1s] Both calls within authorized quota. On-chain receipt confirmed!
                </div>
              </div>
            </div>

            {/* Right: Market Terminal & Live Position Panel */}
            <div
              style={{
                backgroundColor: '#070a0f',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 6,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>MONAD PERP TERMINAL</span>
                <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 700 }}>MON/USD: $24.85 (+6.4%)</span>
              </div>

              {/* Active Position Box */}
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 4,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#94a3b8' }}>POSITION SIZE:</span>
                  <span style={{ color: '#f8fafc', fontWeight: 700 }}>$225.00 USD (5x LEV)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#94a3b8' }}>ENTRY PRICE:</span>
                  <span style={{ color: '#f8fafc' }}>$24.50</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#94a3b8' }}>UNREALIZED PnL:</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>+$3.80 USD (+8.44%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#94a3b8' }}>DELEGATED SPEND:</span>
                  <span style={{ color: '#00f2fe' }}>$45.015 / $500.00 (Daily Cap)</span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: '#64748b' }}>
                Tx Hash: 0x94b1...e73c · 延迟: 420ms · 智能体自主结算完成
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PART 3.2: 压测与防穿仓机制 —— 触发链上限频与熔断断路器保护 */
        <div
          style={{
            transform: `scale(${part2Spring})`,
            opacity: part2Spring,
            width: 1240,
            backgroundColor: '#0d1119',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(239, 68, 68, 0.25)',
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 52,
              backgroundColor: '#1c151c',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid #ef4444',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#ef4444',
                }}
              >
                SECURITY STRESS TEST // ANOMALOUS ATTEMPT
              </div>
              <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                RATE LIMIT &amp; CIRCUIT BREAKER INTERCEPTION
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
              [CIRCUIT BREAKER: TRIGGERED]
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 36, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Interception Boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 6,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                  [RULE 1 BREACH DETECTED]
                </div>
                <div style={{ fontSize: 18, color: '#f8fafc', fontWeight: 700 }}>
                  MaxPerTxUSD Limit Exceeded
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                  Agent 尝试发起 $1,500.00 USD 单笔巨额委托（远超策略上限 $100.00）。智能合约在执行前强制 Revert！
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 6,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                  [RULE 2 BREACH DETECTED]
                </div>
                <div style={{ fontSize: 18, color: '#f8fafc', fontWeight: 700 }}>
                  RateLimit Threshold Exceeded
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                  模拟高频死循环攻击（50 请求/秒，超过 10 req/s 阈值）。底层限频桶自动触发熔断阻断。
                </div>
              </div>
            </div>

            {/* Verdict Highlight */}
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 6,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                  SESSION KEY FROZEN AUTOMATICALLY // 0% CAPITAL AT RISK
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                  SessionKeyRegistry 合约即刻将该子密钥置为 Frozen。主钱包金库与已有资产 100% 毫发无损！
                </div>
              </div>

              <div
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#10b981',
                  borderRadius: 4,
                  color: '#070a0f',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                ZERO OVER-LEVERAGE
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
