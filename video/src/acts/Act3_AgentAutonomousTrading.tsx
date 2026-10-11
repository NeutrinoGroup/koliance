import React from 'react';
import { interpolate, useCurrentFrame, spring } from 'remotion';
import { PageCam, type CamKey } from '../lib/PageCam';

const CAM_KEYS_MARKET: CamKey[] = [
  { frame: 0, cx: 960, cy: 430, zoom: 1.05, rotX: 8, rotY: -6, rotZ: 0, persp: 1300 },
  { frame: 350, cx: 1220, cy: 510, zoom: 1.28, rotX: 6, rotY: -3, rotZ: 0.3, persp: 1300 },
  { frame: 700, cx: 780, cy: 530, zoom: 1.22, rotX: 10, rotY: 4, rotZ: -0.3, persp: 1300 },
];

const CAM_KEYS_DEFENSE: CamKey[] = [
  { frame: 700, cx: 1200, cy: 520, zoom: 1.20, rotX: 10, rotY: 3, rotZ: 0, persp: 1300 },
  { frame: 1000, cx: 960, cy: 460, zoom: 1.30, rotX: 12, rotY: -4, rotZ: 0.4, persp: 1300 },
  { frame: 1350, cx: 800, cy: 500, zoom: 1.22, rotX: 6, rotY: 0, rotZ: 0, persp: 1300 },
];

export const Act3_AgentAutonomousTrading: React.FC = () => {
  const frame = useCurrentFrame();

  // Part 3.1 (0 - 700) vs Part 3.2 (700 - 1350)
  const isPart2 = frame >= 700;
  const localPart1 = frame;
  const localPart2 = frame - 700;

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

  // Rapid micro-payments count in Part 3.1
  const txCount = Math.floor(
    interpolate(localPart1, [40, 600], [1, 48], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  // Micro-billing spent
  const spentUsd = (txCount * 0.85).toFixed(2);

  // Shake on circuit breaker clamp in Part 3.2
  const shake = localPart2 > 40 && localPart2 < 140 ? Math.sin(localPart2 * 1.8) * 5 : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {!isPart2 ? (
        /* PART 3.1: 真实 MarketTerminal 页面上的 Agent 自主开仓与小额高频支付 */
        <>
          <PageCam
            src="textures/live/market.png"
            pageH={1080}
            keys={CAM_KEYS_MARKET}
            frame={frame}
          >
            {/* Subtle Emerald Vignette */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(16, 185, 129, 0.04)',
                boxShadow: 'inset 0 0 120px rgba(16, 185, 129, 0.25)',
                pointerEvents: 'none',
              }}
            />
          </PageCam>

          {/* Floating AI Agent Autopilot Terminal (Screen Viewport Space) */}
          <div
            style={{
              position: 'absolute',
              top: 110,
              left: 80,
              transform: `scale(${part1Spring})`,
              opacity: part1Spring,
              width: 580,
              backgroundColor: 'rgba(13, 17, 25, 0.95)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.2)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'ui-monospace, monospace',
              zIndex: 30,
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 42,
                backgroundColor: 'rgba(17, 28, 24, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#10b981' }} />
                <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>
                  [AUTONOMOUS LOOP] EIP-712 SESSION EXECUTION
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
                LIVE MONITORING
              </div>
            </div>

            {/* Content Details */}
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Telemetry Log */}
              <div
                style={{
                  backgroundColor: '#070a0f',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 11,
                }}
              >
                <div style={{ color: '#00f2fe' }}>
                  &gt; [AI BRAIN] Signal: Bullish breakout on MON/USDC
                </div>
                <div style={{ color: '#10b981' }}>
                  &gt; [SESSION KEY] Delegated sign: 0x9f1a...4321
                </div>
                <div style={{ color: '#94a3b8' }}>
                  &gt; [ACTION] Opening 5x Long Position (Size: $85.00)
                </div>
                <div style={{ color: '#836ef9' }}>
                  &gt; [MICRO-PAY] LLM Inference stream billing ($0.0012/req)
                </div>
              </div>

              {/* Real-time stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 10, color: '#64748b' }}>AUTONOMOUS TRANSACTIONS</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                    {txCount} TXs Executed
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 10, color: '#64748b' }}>TOTAL VALUE SETTLED</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#00f2fe', marginTop: 4 }}>
                    ${spentUsd} USDC
                  </div>
                </div>
              </div>

              {/* Policy Bound Check */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 10,
                  color: '#94a3b8',
                  paddingTop: 6,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <span>POLICY: MAX $100/TX</span>
                <span style={{ color: '#10b981' }}>[COMPLIANT: UNDER LIMIT]</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* PART 3.2: 恶意越权拦截与限频熔断机制 */
        <>
          <PageCam
            src="textures/live/market.png"
            pageH={1080}
            keys={CAM_KEYS_DEFENSE}
            frame={frame}
          >
            {/* Danger Red Alert Vignette */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                boxShadow: 'inset 0 0 160px rgba(239, 68, 68, 0.5)',
                pointerEvents: 'none',
              }}
            />
          </PageCam>

          {/* Floating Circuit Breaker Enforcement Terminal (Screen Viewport Space) */}
          <div
            style={{
              position: 'absolute',
              top: 110,
              left: '50%',
              transform: `translateX(-50%) translate(${shake}px, ${shake * 0.5}px) scale(${part2Spring})`,
              opacity: part2Spring,
              width: 760,
              backgroundColor: 'rgba(13, 17, 25, 0.96)',
              border: '1px solid rgba(239, 68, 68, 0.6)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8), 0 0 40px rgba(239, 68, 68, 0.35)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'ui-monospace, monospace',
              zIndex: 30,
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 44,
                backgroundColor: 'rgba(38, 18, 18, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#ef4444' }} />
                <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                  [SECURITY INTERVENTION] POLICY LIMIT REACHED &amp; BLOCKED
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontWeight: 700,
                }}
              >
                CIRCUIT BREAKER ENGAGED
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 6,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>VIOLATION DETECTED</div>
                  <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700, marginTop: 4 }}>
                    ATTEMPTED $2,500.00 SINGLE TX
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                    Allowed Max Per Tx: $100.00 USD
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 6,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>FREQUENCY EXCEEDED</div>
                  <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700, marginTop: 4 }}>
                    35 REQUESTS IN 100ms
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                    Policy Rate Cap: 10 Req / Sec
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#070a0f',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ color: '#ef4444' }}>
                  &gt; [ALERT] Smart Contract reverted transaction: LimitExceeded()
                </div>
                <div style={{ color: '#10b981' }}>
                  &gt; [SAFEGUARD] User Root Capital Preserved: 100% Intact
                </div>
                <div style={{ color: '#00f2fe' }}>
                  &gt; [ACTION] Session Key frozen until owner manual review
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
