import React from 'react';
import { useCurrentFrame, spring } from 'remotion';
import { PageCam, type CamKey } from '../lib/PageCam';

const CAM_KEYS_CONSOLE_SETTLE: CamKey[] = [
  { frame: 0, cx: 960, cy: 460, zoom: 1.05, rotX: 8, rotY: -5, rotZ: 0, persp: 1300 },
  { frame: 250, cx: 1200, cy: 550, zoom: 1.30, rotX: 6, rotY: 2, rotZ: 0.3, persp: 1300 },
  { frame: 500, cx: 800, cy: 520, zoom: 1.22, rotX: 9, rotY: -3, rotZ: -0.2, persp: 1300 },
];

const CAM_KEYS_HOME_ARCH: CamKey[] = [
  { frame: 500, cx: 960, cy: 1200, zoom: 1.08, rotX: 10, rotY: 0, rotZ: 0, persp: 1300 },
  { frame: 700, cx: 960, cy: 1750, zoom: 1.24, rotX: 7, rotY: 3, rotZ: 0.3, persp: 1300 },
  { frame: 900, cx: 960, cy: 2150, zoom: 1.15, rotX: 4, rotY: 0, rotZ: 0, persp: 1300 },
];

export const Act4_OnChainSettlement: React.FC = () => {
  const frame = useCurrentFrame();

  // Part 4.1 (0 - 500) vs Part 4.2 (500 - 900)
  const isPart2 = frame >= 500;
  const localPart1 = frame;
  const localPart2 = frame - 500;

  // Spring animations for HUD entrance
  const part1Spring = spring({
    frame: localPart1,
    fps: 30,
    config: { damping: 14, stiffness: 110 },
  });

  const part2Spring = spring({
    frame: localPart2,
    fps: 30,
    config: { damping: 14, stiffness: 110 },
  });

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {!isPart2 ? (
        /* PART 4.1: 真实 Developer Console 页面上的 Monad Explorer 真实交易 Hash 存证与合规净资产结算 */
        <>
          <PageCam
            src="textures/live/console.png"
            pageH={1080}
            keys={CAM_KEYS_CONSOLE_SETTLE}
            frame={frame}
          >
            {/* Subtle Cyber Cyan Vignette */}
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

          {/* Floating On-Chain Attestation Terminal (Screen Viewport Space) */}
          <div
            style={{
              position: 'absolute',
              top: 100,
              left: 80,
              transform: `scale(${part1Spring})`,
              opacity: part1Spring,
              width: 680,
              backgroundColor: 'rgba(13, 17, 25, 0.96)',
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
                  [CONSENSUS AUDIT] MONAD EXPLORER IMMUTABLE RECORD
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
                FINALIZED (0.42s)
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  backgroundColor: '#070a0f',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>TX HASH:</span>
                  <span style={{ color: '#00f2fe', fontFamily: 'monospace' }}>
                    0x8f2c...59a4 (Monad Testnet)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>CONTRACT METHOD:</span>
                  <span style={{ color: '#f8fafc' }}>SessionKeyRegistry.settleAgentBatch()</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>GAS CONSUMED:</span>
                  <span style={{ color: '#10b981' }}>0.000042 MON (&lt; $0.0001 USD)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>SOLVENCY AUDIT:</span>
                  <span style={{ color: '#10b981' }}>NET EQUITY VERIFIED · ZERO DEFICIT</span>
                </div>
              </div>

              {/* Status Badges */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 9, color: '#64748b' }}>CONSENSUS TIME</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginTop: 2 }}>
                    420ms BFT
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 9, color: '#64748b' }}>SLIPPAGE DRIFT</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#00f2fe', marginTop: 2 }}>
                    0.00% DRIFT
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 9, color: '#64748b' }}>SECURITY RATING</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#836ef9', marginTop: 2 }}>
                    AAA AUDITED
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* PART 4.2: 真实全页架构区上的 Monad 并行架构与品牌定格 */
        <>
          <PageCam
            src="textures/live/home_full.png"
            pageH={8136}
            keys={CAM_KEYS_HOME_ARCH}
            frame={frame}
          >
            {/* Subtle Deep Space Purple Vignette */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(10, 13, 20, 0.25)',
                boxShadow: 'inset 0 0 160px rgba(131, 110, 249, 0.35)',
                pointerEvents: 'none',
              }}
            />
          </PageCam>

          {/* Floating High-Throughput Parallel Engine Overlay (Screen Viewport Space) */}
          <div
            style={{
              position: 'absolute',
              top: 100,
              left: '50%',
              transform: `translateX(-50%) scale(${part2Spring})`,
              opacity: part2Spring,
              width: 880,
              backgroundColor: 'rgba(13, 17, 25, 0.95)',
              border: '1px solid rgba(131, 110, 249, 0.6)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(131, 110, 249, 0.35)',
              backdropFilter: 'blur(20px)',
              fontFamily: 'ui-monospace, monospace',
              zIndex: 30,
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 44,
                backgroundColor: 'rgba(23, 19, 44, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#836ef9' }} />
                <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700 }}>
                  MONAD HIGH-THROUGHPUT PARALLEL EVM ADVANTAGE
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#00f2fe',
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                10,000 TPS ENGINE
              </div>
            </div>

            {/* Architecture Metrics Grid */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 10, color: '#64748b' }}>OPTIMISTIC CONCURRENCY</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
                    Parallel Execution
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                    Multi-Agent state isolated
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 10, color: '#64748b' }}>ASYNC I/O DISK ACCESS</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#00f2fe', marginTop: 4 }}>
                    MonadDb State Trie
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                    Sub-cent per transaction
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 10, color: '#64748b' }}>AGENT CAPACITY</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#836ef9', marginTop: 4 }}>
                    Millions of Agents
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                    Instantaneous settlement
                  </div>
                </div>
              </div>

              {/* Call to Action Final Bar */}
              <div
                style={{
                  backgroundColor: 'rgba(131, 110, 249, 0.12)',
                  border: '1px solid rgba(131, 110, 249, 0.4)',
                  borderRadius: 6,
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                    KOLIANCE // TRUST &amp; IDENTITY INFRASTRUCTURE
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    Built for the Autonomous Agentic Economy on Monad
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#836ef9',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                >
                  https://koliance.oodai.space
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
