import React from 'react';
import { interpolate, useCurrentFrame, spring } from 'remotion';
import { DigitRoll } from '../lib/DigitRoll';

export const Act2_IdentityAndCredit: React.FC = () => {
  const frame = useCurrentFrame();
  const localFrame = frame - 900;

  // Scene transition: Part 2.1 (0 - 650, frame 900-1550), Part 2.2 (650 - 1350, frame 1550-2250)
  const isPart2 = localFrame >= 650;
  const localPart2 = localFrame - 650;

  // Spring animation for part 1 & part 2
  const part1Spring = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 15, stiffness: 100 },
  });

  const part2Spring = spring({
    frame: localPart2,
    fps: 30,
    config: { damping: 15, stiffness: 100 },
  });

  // Credit quota interpolation
  const quota = Math.min(
    5000,
    Math.round(
      interpolate(localPart2, [40, 160], [0, 5000], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    )
  );

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
        /* PART 2.1: 前端演示 Steam / GitHub 身份关联与去中心化验真 */
        <div
          style={{
            transform: `scale(${part1Spring})`,
            opacity: part1Spring,
            width: 1240,
            backgroundColor: '#0d1119',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(0, 242, 254, 0.15)',
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
                  backgroundColor: 'rgba(0, 242, 254, 0.15)',
                  border: '1px solid #00f2fe',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#00f2fe',
                }}
              >
                DEVELOPER CONSOLE // IDENTITY REPUTATION HARBOR
              </div>
              <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                WEB2 IDENTITY ATTESTATION & SYBIL RESISTANCE
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              SOURCE: src/components/DeveloperConsole.tsx
            </div>
          </div>

          {/* Dual Identity Cards */}
          <div style={{ padding: 36, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* GitHub Developer Card */}
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 4,
                        backgroundColor: '#1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f8fafc',
                        fontWeight: 700,
                      }}
                    >
                      GH
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>GitHub Developer Wall</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>OAuth 2.0 PKCE Verified</div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    [VERIFIED: ACTIVE]
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ backgroundColor: '#090d14', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>COMMITS (1YR)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>1,428</div>
                  </div>
                  <div style={{ backgroundColor: '#090d14', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>PUBLIC REPOS</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>36</div>
                  </div>
                  <div style={{ backgroundColor: '#090d14', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>DEV LEVEL</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#00f2fe', marginTop: 4 }}>SOVEREIGN</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  链上证明 Hash: 0x82f4...d19e · 验证权重大于 450 分
                </div>
              </div>

              {/* Steam Game Card */}
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 4,
                        backgroundColor: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#38bdf8',
                        fontWeight: 700,
                      }}
                    >
                      ST
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>Steam Identity Wall</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>OpenID Valve Authentication</div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    [VERIFIED: ACTIVE]
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ backgroundColor: '#090d14', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>ACCOUNT AGE</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>7.8 YRS</div>
                  </div>
                  <div style={{ backgroundColor: '#090d14', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>GAMES OWNED</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>142</div>
                  </div>
                  <div style={{ backgroundColor: '#090d14', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>ANTI-SYBIL</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#00f2fe', marginTop: 4 }}>TIER-A</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  链上证明 Hash: 0x39a1...bb42 · 极高抗女巫真人行为特征
                </div>
              </div>
            </div>

            {/* Bottom Pipeline Status */}
            <div
              style={{
                backgroundColor: 'rgba(0, 242, 254, 0.04)',
                border: '1px solid rgba(0, 242, 254, 0.2)',
                borderRadius: 6,
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
              }}
            >
              <span style={{ color: '#94a3b8' }}>
                [ZERO-KNOWLEDGE PIPELINE] 身份隐私脱敏完成 -&gt; 正在聚合链上信用指标计算...
              </span>
              <span style={{ color: '#00f2fe', fontWeight: 600 }}>READY FOR ON-CHAIN SCORING</span>
            </div>
          </div>
        </div>
      ) : (
        /* PART 2.2: 链上信用评级与授信配额生成 (Odometer Digit Roll) */
        <div
          style={{
            transform: `scale(${part2Spring})`,
            opacity: part2Spring,
            width: 1240,
            backgroundColor: '#0d1119',
            border: '1px solid rgba(131, 110, 249, 0.4)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(131, 110, 249, 0.2)',
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
                  backgroundColor: 'rgba(131, 110, 249, 0.2)',
                  border: '1px solid #836ef9',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#f8fafc',
                }}
              >
                ON-CHAIN TRUST ATTESTATION // VERDICT
              </div>
              <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                CREDIT SCORE &amp; AGENTCARD ALLOWANCE ALLOCATION
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
              [CONSENSUS VERIFIED]
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              {/* Left: DigitRoll Score Counter */}
              <div
                style={{
                  backgroundColor: '#090d14',
                  border: '1px solid rgba(131, 110, 249, 0.3)',
                  borderRadius: 6,
                  padding: 30,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ fontSize: 12, color: '#94a3b8', letterSpacing: '0.1em' }}>
                  COMPUTED ON-CHAIN CREDIT SCORE
                </div>
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                  }}
                >
                  <DigitRoll value="820" delay={10} fontSize={72} color="#00f2fe" />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      padding: '4px 12px',
                      borderRadius: 4,
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    TIER: AAA PRIME AGENT
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>TOP 1% REPUTATION</span>
                </div>
              </div>

              {/* Right: AgentCard Allowance & Key Delegation */}
              <div
                style={{
                  backgroundColor: '#090d14',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>AUTHORIZED CREDIT LINE (OVERDRAFT)</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
                    ${quota.toLocaleString()}.00 USD
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Session Key Address:</span>
                    <span style={{ color: '#00f2fe' }}>0x7a3F9c...e8D2</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Delegation Method:</span>
                    <span style={{ color: '#f8fafc' }}>EIP-712 Structured Digest</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Session Key Expiry:</span>
                    <span style={{ color: '#f8fafc' }}>24 Hours (Rolling Auto-Recharge)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Permitted Actions:</span>
                    <span style={{ color: '#10b981' }}>Perp Market + Compute Billing Only</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Proof Hash Bar */}
            <div
              style={{
                backgroundColor: 'rgba(131, 110, 249, 0.08)',
                border: '1px solid rgba(131, 110, 249, 0.25)',
                borderRadius: 4,
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
              }}
            >
              <span style={{ color: '#94a3b8' }}>
                EIP-712 ATTESTATION SIGNATURE: 0x48f93...b14e [MONAD TESTNET SESSION ACTIVATED]
              </span>
              <span style={{ color: '#836ef9', fontWeight: 700 }}>CREDIT LINE READY FOR AGENT</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
