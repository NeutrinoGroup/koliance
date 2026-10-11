import React from 'react';
import { interpolate, useCurrentFrame, spring } from 'remotion';
import { PageCam, type CamKey } from '../lib/PageCam';
import { DigitRoll } from '../lib/DigitRoll';

const CAM_KEYS_CONSOLE: CamKey[] = [
  { frame: 0, cx: 960, cy: 420, zoom: 1.05, rotX: 8, rotY: -5, rotZ: 0, persp: 1300 },
  { frame: 300, cx: 700, cy: 480, zoom: 1.28, rotX: 6, rotY: -2, rotZ: 0.3, persp: 1300 },
  { frame: 650, cx: 1150, cy: 520, zoom: 1.22, rotX: 9, rotY: 4, rotZ: -0.3, persp: 1300 },
];

const CAM_KEYS_AGENTCARD: CamKey[] = [
  { frame: 650, cx: 960, cy: 400, zoom: 1.06, rotX: 10, rotY: 6, rotZ: 0, persp: 1300 },
  { frame: 950, cx: 720, cy: 460, zoom: 1.32, rotX: 6, rotY: 2, rotZ: 0.4, persp: 1300 },
  { frame: 1350, cx: 1200, cy: 490, zoom: 1.26, rotX: 5, rotY: -3, rotZ: -0.2, persp: 1300 },
];

export const Act2_IdentityAndCredit: React.FC = () => {
  const frame = useCurrentFrame();

  // Part 2.1 (0 - 650) vs Part 2.2 (650 - 1350)
  const isPart2 = frame >= 650;
  const localPart1 = frame;
  const localPart2 = frame - 650;

  // Spring animation for part 1 HUD entrance
  const part1Spring = spring({
    frame: localPart1,
    fps: 30,
    config: { damping: 14, stiffness: 110 },
  });

  // Spring animation for part 2 HUD entrance
  const part2Spring = spring({
    frame: localPart2,
    fps: 30,
    config: { damping: 14, stiffness: 110 },
  });

  // Credit quota interpolation in Part 2.2 ($0 -> $5,000)
  const quota = Math.min(
    5000,
    Math.round(
      interpolate(localPart2, [60, 200], [0, 5000], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    )
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {!isPart2 ? (
        /* PART 2.1: 真实 Developer Console 页面上的 Steam / GitHub 身份关联与去中心化验真 */
        <>
          <PageCam
            src="textures/live/console.png"
            pageH={1080}
            keys={CAM_KEYS_CONSOLE}
            frame={frame}
          >
            {/* Subtle Cyber Grid Vignette */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 242, 254, 0.04)',
                boxShadow: 'inset 0 0 120px rgba(0, 242, 254, 0.25)',
                pointerEvents: 'none',
              }}
            />
          </PageCam>

          {/* Floating Verification Stream HUD (Screen Viewport Space) */}
          <div
            style={{
              position: 'absolute',
              top: 100,
              left: 80,
              transform: `scale(${part1Spring})`,
              opacity: part1Spring,
              width: 620,
              backgroundColor: 'rgba(13, 17, 25, 0.95)',
              border: '1px solid rgba(0, 242, 254, 0.45)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 242, 254, 0.2)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'ui-monospace, monospace',
              zIndex: 30,
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 42,
                backgroundColor: 'rgba(19, 25, 38, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#00f2fe' }} />
                <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>
                  [ATTESTATION] WEB2 OAUTH REPUTATION ANCHOR
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 700,
                }}
              >
                SYBIL-RESISTANT: VERIFIED
              </div>
            </div>

            {/* Content Details */}
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      backgroundColor: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#f8fafc',
                    }}
                  >
                    GH
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>GitHub Developer Identity</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>OAuth 2.0 PKCE · 2,840+ Public Contributions</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>+420 PTS</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      backgroundColor: '#172554',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#60a5fa',
                    }}
                  >
                    ST
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>Steam Community Level</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>OpenID 2.0 Auth · Level 42 · 1,400+ Hours</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>+400 PTS</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: 11,
                }}
              >
                <span style={{ color: '#94a3b8' }}>ATTESTATION PROOF HASH</span>
                <span style={{ color: '#00f2fe', fontFamily: 'monospace' }}>
                  0x71f8...3e9a [VERIFIED BY MONAD STATE]
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* PART 2.2: 真实 AgentCard 页面上的信用评级 (0 -> 820 AAA) 与 $5,000 配额生成 */
        <>
          <PageCam
            src="textures/live/agentcard.png"
            pageH={1080}
            keys={CAM_KEYS_AGENTCARD}
            frame={frame}
          >
            {/* Subtle Monad Purple Vignette */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(131, 110, 249, 0.05)',
                boxShadow: 'inset 0 0 120px rgba(131, 110, 249, 0.3)',
                pointerEvents: 'none',
              }}
            />
          </PageCam>

          {/* Floating On-Chain Credit Rating & Allowance Terminal (Screen Viewport Space) */}
          <div
            style={{
              position: 'absolute',
              top: 100,
              right: 80,
              transform: `scale(${part2Spring})`,
              opacity: part2Spring,
              width: 580,
              backgroundColor: 'rgba(13, 17, 25, 0.95)',
              border: '1px solid rgba(131, 110, 249, 0.45)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(131, 110, 249, 0.25)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'ui-monospace, monospace',
              zIndex: 30,
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 42,
                backgroundColor: 'rgba(21, 18, 38, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#836ef9' }} />
                <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>
                  ON-CHAIN CREDIT SCORING &amp; ALLOWANCE
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#836ef9',
                  backgroundColor: 'rgba(131, 110, 249, 0.2)',
                  border: '1px solid rgba(131, 110, 249, 0.4)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 700,
                }}
              >
                TIER 1 (AAA)
              </div>
            </div>

            {/* Content Details */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Score and Tier Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '14px 18px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>TOTAL IDENTITY CREDIT SCORE</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#836ef9', marginTop: 4 }}>
                    <DigitRoll value="820" delay={20} fontSize={32} color="#836ef9" />
                    <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600, marginLeft: 6 }}>/ 1000</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>CREDIT STATUS</div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#10b981',
                      marginTop: 6,
                    }}
                  >
                    AAA RATED
                  </div>
                </div>
              </div>

              {/* Allowance Allocation Box */}
              <div
                style={{
                  backgroundColor: 'rgba(131, 110, 249, 0.08)',
                  border: '1px solid rgba(131, 110, 249, 0.3)',
                  borderRadius: 6,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>SYNTHETIC CREDIT ALLOWANCE:</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#00f2fe' }}>
                    ${quota.toLocaleString('en-US')}.00 USDC
                  </span>
                </div>

                <div
                  style={{
                    height: 6,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(quota / 5000) * 100}%`,
                      height: '100%',
                      backgroundColor: '#00f2fe',
                      boxShadow: '0 0 8px #00f2fe',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
                  <span>EIP-712 SESSION LIMIT: $100.00 / TX</span>
                  <span>MAX DAILY SPEND: $5,000.00</span>
                </div>
              </div>

              {/* Policy Whitelist Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#10b981',
                }}
              >
                <span>[POLICY WHITELIST: ACTIVE]</span>
                <span>Alpaca LLM API · Monad Perp DEX · OpenRouter</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
