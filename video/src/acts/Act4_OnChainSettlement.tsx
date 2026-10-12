import React from 'react';
import { useCurrentFrame, spring } from 'remotion';

export const Act4_OnChainSettlement: React.FC = () => {
  const frame = useCurrentFrame();
  const localFrame = frame - 3600;

  // Transition: Part 4.1 (0 - 500, frame 3600-4100), Part 4.2 (500 - 900, frame 4100-4500)
  const isPart2 = localFrame >= 500;
  const localPart2 = localFrame - 500;

  const part1Spring = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 15, stiffness: 100 },
  });

  const part2Spring = spring({
    frame: localPart2,
    fps: 30,
    config: { damping: 13, stiffness: 100 },
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
        /* PART 4.1: Monad Explorer 真实交易 Hash 存证与合规净资产结算 */
        <div
          style={{
            transform: `scale(${part1Spring})`,
            opacity: part1Spring,
            width: 1240,
            backgroundColor: '#0d1119',
            border: '1px solid rgba(0, 242, 254, 0.4)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(0, 242, 254, 0.2)',
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
                  backgroundColor: 'rgba(0, 242, 254, 0.2)',
                  border: '1px solid #00f2fe',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#00f2fe',
                }}
              >
                MONAD EXPLORER // ON-CHAIN ATTESTATION
              </div>
              <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                TRANSACTION CONSENSUS VERIFICATION
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
              [FINALITY: 0.42s SUB-SECOND]
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 36, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Tx Details Box */}
            <div
              style={{
                backgroundColor: '#070a0f',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 6,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 12 }}>TRANSACTION HASH:</span>
                <span style={{ color: '#00f2fe', fontSize: 12, fontWeight: 700 }}>
                  0x7d3a9f1b4c8e2a05d6e8f9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 12 }}>STATUS:</span>
                <span
                  style={{
                    color: '#10b981',
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  SUCCESS (FINALIZED)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 12 }}>BLOCK NUMBER:</span>
                <span style={{ color: '#f8fafc', fontSize: 12 }}>18,492,014 (Parallel Epoch 289)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 12 }}>CALLER (DELEGATED SESSION KEY):</span>
                <span style={{ color: '#f8fafc', fontSize: 12 }}>0x7a3F9c41E519fBa...e8D2</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 12 }}>TARGET CONTRACT:</span>
                <span style={{ color: '#f8fafc', fontSize: 12 }}>KoliancePerpVault (0x836EF9...)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 12 }}>GAS CONSUMED:</span>
                <span style={{ color: '#00f2fe', fontSize: 12, fontWeight: 700 }}>
                  0.00012 MON ($0.0003 USD)
                </span>
              </div>
            </div>

            {/* Solvency Net Equity Banner */}
            <div
              style={{
                backgroundColor: 'rgba(131, 110, 249, 0.08)',
                border: '1px solid rgba(131, 110, 249, 0.3)',
                borderRadius: 6,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                  NET EQUITY SETTLEMENT VERIFIED (ZERO TRUNCATION DRIFT)
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  全量资产与资金费率（Funding Rate）实现链上精准对拍，零坏账积累，杜绝穿仓隐患
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#836ef9',
                  backgroundColor: 'rgba(131, 110, 249, 0.2)',
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid #836ef9',
                }}
              >
                GAP-06 / GAP-14 AUDITED
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PART 4.2: 点题 Monad 高吞吐并行架构的不可替代性与品牌定妆 */
        <div
          style={{
            transform: `scale(${part2Spring})`,
            opacity: part2Spring,
            width: 1240,
            backgroundColor: '#0d1119',
            border: '1px solid rgba(131, 110, 249, 0.5)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 0 80px rgba(131, 110, 249, 0.3)',
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 52,
              backgroundColor: '#141a26',
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
                  backgroundColor: 'rgba(131, 110, 249, 0.25)',
                  border: '1px solid #836ef9',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#f8fafc',
                }}
              >
                WHY MONAD IS IRREPLACEABLE
              </div>
              <span style={{ fontSize: 13, color: '#00f2fe', fontWeight: 600 }}>
                PARALLEL EVM ARCHITECTURE FOR AUTONOMOUS AGENTS
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
              [BENCHMARK: 10,000 TPS]
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 44, display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* 3 Irreplaceable Pillars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <div
                style={{
                  backgroundColor: '#070a0f',
                  border: '1px solid rgba(131, 110, 249, 0.25)',
                  borderRadius: 6,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, color: '#836ef9', fontWeight: 700 }}>PARALLEL EXECUTION</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>10,000 TPS</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                  传统串行 EVM 面对成千上万并发 Agent 极易发生链上拥堵；Monad 乐观并行调度保证高频微支付零延迟。
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#070a0f',
                  border: '1px solid rgba(0, 242, 254, 0.25)',
                  borderRadius: 6,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, color: '#00f2fe', fontWeight: 700 }}>INSTANT FINALITY</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>&lt; 1-SECOND</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                  单 slot 确定性让 Agent 订单开立、API 扣费与风险熔断在 400ms 内达成共识，消除 MEV 抢跑与穿仓时差。
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#070a0f',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 6,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>SUB-CENT COST</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc' }}>$0.0001 GAS</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                  超低 Gas 成本使得 Agent 每次几美分甚至几厘的微额流式推理结算在经济学上完全可持续。
                </div>
              </div>
            </div>

            {/* Brand Outro Lockup */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                padding: '24px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #836EF9 0%, #00F2FE 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(131, 110, 249, 0.5)',
                  }}
                >
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>K</span>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.05em' }}>
                    KOLIANCE
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    The Sovereign Credit &amp; Asset Layer for Autonomous AI Agents on Monad
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00f2fe' }}>
                  https://koliance.app
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  TESTNET CONTRACTS &amp; AGENT PROTOCOL AUDITED
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
