import React from 'react';
import { interpolate, useCurrentFrame, spring } from 'remotion';
import { PageCam, type CamKey } from '../lib/PageCam';

const CAM_KEYS_SCENE1: CamKey[] = [
  { frame: 0, cx: 960, cy: 420, zoom: 1.05, rotX: 8, rotY: -6, rotZ: 0, persp: 1200 },
  { frame: 250, cx: 960, cy: 480, zoom: 1.15, rotX: 12, rotY: -4, rotZ: 0.5, persp: 1200 },
  { frame: 450, cx: 960, cy: 520, zoom: 1.25, rotX: 15, rotY: -2, rotZ: 1, persp: 1200 },
];

const CAM_KEYS_SCENE2: CamKey[] = [
  { frame: 450, cx: 960, cy: 1150, zoom: 1.02, rotX: 10, rotY: 4, rotZ: -0.5, persp: 1300 },
  { frame: 700, cx: 960, cy: 1380, zoom: 1.12, rotX: 6, rotY: 0, rotZ: 0, persp: 1300 },
  { frame: 900, cx: 960, cy: 1580, zoom: 1.18, rotX: 4, rotY: -2, rotZ: 0, persp: 1300 },
];

export const Act1_PainAndSolution: React.FC = () => {
  const frame = useCurrentFrame();

  const isScene2 = frame >= 450;
  const localFrame2 = frame - 450;

  // Drain simulation in Scene 1
  const balance = Math.max(0, interpolate(frame, [80, 260], [100000, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));

  // Shake effect on drain critical moment (frame 140 - 240)
  const shake = frame > 140 && frame < 240 ? Math.sin(frame * 1.5) * 6 : 0;

  // Scene 2 Spring Animation
  const springProgress = spring({
    frame: localFrame2,
    fps: 30,
    config: { damping: 14, stiffness: 120 },
  });

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {!isScene2 ? (
        /* SCENE 1.1: 真实 live DApp 页面上的无限制私钥灾难 */
        <PageCam
          src="textures/live/home.png"
          pageH={1080}
          keys={CAM_KEYS_SCENE1}
          frame={frame}
        >
          {/* Danger vignette overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              boxShadow: 'inset 0 0 140px rgba(239, 68, 68, 0.4)',
              pointerEvents: 'none',
            }}
          />

          {/* Floating Critical Alert Terminal */}
          <div
            style={{
              position: 'absolute',
              top: 220,
              left: '50%',
              transform: `translateX(-50%) translate(${shake}px, ${shake * 0.5}px)`,
              width: 1080,
              backgroundColor: 'rgba(13, 17, 23, 0.94)',
              border: '1px solid rgba(239, 68, 68, 0.6)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(239, 68, 68, 0.35)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {/* Terminal Header */}
            <div
              style={{
                height: 44,
                backgroundColor: 'rgba(22, 27, 34, 0.9)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#ef4444' }} />
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#64748b' }} />
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#64748b' }} />
                <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600, marginLeft: 8 }}>
                  [SECURITY_CRITICAL] RAW AGENT PRIVATE KEY BREACH DETECTED
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#ef4444',
                  fontWeight: 700,
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >
                UNPROTECTED DELEGATION
              </div>
            </div>

            {/* Content Body */}
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>EXPOSED KEY IDENTITY</div>
                  <div style={{ fontSize: 14, color: '#f8fafc', fontWeight: 600, marginTop: 4 }}>
                    0x9f83b2...a4e1 (Full Root Key)
                  </div>
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                    无 EIP-712 会话限制 · 无单笔额度熔断保护
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#ef4444' }}>TREASURY BALANCE DEPLETION</div>
                  <div style={{ fontSize: 28, color: '#ef4444', fontWeight: 800, marginTop: 2 }}>
                    ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </div>
                  <div style={{ fontSize: 11, color: '#fca5a5' }}>
                    {balance === 0 ? '[ALERT] 100% CAPITAL DRAINED // LIQUIDATED' : 'DRAINING IN REAL TIME...'}
                  </div>
                </div>
              </div>

              {/* Console log */}
              <div
                style={{
                  backgroundColor: '#05070a',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  padding: 14,
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ color: '#94a3b8' }}>
                  &gt; [00:04.2] Prompt Injection attack injected into Agent runtime
                </div>
                <div style={{ color: '#ef4444' }}>
                  &gt; [00:07.1] Agent invoked raw private key: transferring $50,000 to unauthorized address
                </div>
                <div style={{ color: frame > 180 ? '#ef4444' : '#64748b' }}>
                  &gt; [00:09.8] Rogue perp short order opened with 50x leverage: forced liquidation triggered
                </div>
                <div style={{ color: frame > 240 ? '#ef4444' : '#64748b', fontWeight: 700 }}>
                  &gt; [00:12.4] Zero-governance cascade: Vault fully insolvent.
                </div>
              </div>
            </div>
          </div>
        </PageCam>
      ) : (
        /* SCENE 1.2: 真实 live DApp 架构区上的 Koliance 破局装甲 */
        <PageCam
          src="textures/live/home_full.png"
          pageH={8136}
          keys={CAM_KEYS_SCENE2}
          frame={frame}
        >
          {/* Centered Koliance Protocol Armor Shield */}
          <div
            style={{
              position: 'absolute',
              top: 1320,
              left: '50%',
              transform: `translateX(-50%) scale(${springProgress})`,
              opacity: springProgress,
              width: 1160,
              backgroundColor: 'rgba(14, 18, 27, 0.95)',
              border: '1px solid rgba(131, 110, 249, 0.5)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(131, 110, 249, 0.35)',
              backdropFilter: 'blur(16px)',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 50,
                backgroundColor: 'rgba(20, 26, 38, 0.95)',
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
                    padding: '3px 8px',
                    backgroundColor: 'rgba(131, 110, 249, 0.25)',
                    border: '1px solid #836ef9',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#f8fafc',
                  }}
                >
                  KOLIANCE PROTOCOL DEFENSE
                </div>
                <span style={{ fontSize: 13, color: '#00f2fe', fontWeight: 600 }}>
                  EIP-712 SESSION KEY REGISTRY + AGENTCARD
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                [MONAD TESTNET ON-CHAIN SHIELD]
              </div>
            </div>

            {/* 4 Pillars Grid */}
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  {
                    title: 'EIP-712 SESSION KEY',
                    val: 'Delegated Sub-Key',
                    desc: '根私钥永不离库，仅委托限时、限权力的链下会话签名',
                    tag: 'Zero-Exposure',
                  },
                  {
                    title: 'MAX PER TX LIMIT',
                    val: '$100.00 USD',
                    desc: '单笔交易硬顶限制，杜绝大额恶意掏空与滑点穿仓',
                    tag: 'Per-Tx Cap',
                  },
                  {
                    title: 'DAILY ALLOWANCE',
                    val: '$500.00 USD',
                    desc: '24小时滚动配额，超额即锁，确定性锁定最大损失敞口',
                    tag: 'Daily Cap',
                  },
                  {
                    title: 'MCC WHITELIST',
                    val: 'Scoped APIs',
                    desc: '商户类别代码白名单（仅限 AI 算力与指定永续合约交易）',
                    tag: 'Restricted',
                  },
                ].map((card, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(131, 110, 249, 0.25)',
                      borderRadius: 6,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{card.title}</span>
                      <span
                        style={{
                          fontSize: 9,
                          color: '#00f2fe',
                          backgroundColor: 'rgba(0, 242, 254, 0.1)',
                          padding: '2px 5px',
                          borderRadius: 3,
                          border: '1px solid rgba(0, 242, 254, 0.2)',
                        }}
                      >
                        {card.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, color: '#f8fafc', fontWeight: 700 }}>{card.val}</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.3 }}>{card.desc}</div>
                  </div>
                ))}
              </div>

              {/* Bottom Armed Banner */}
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 6,
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: '#10b981',
                      boxShadow: '0 0 10px #10b981',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                      INSTANT CIRCUIT BREAKER // 毫秒级防穿仓断路器
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      一旦检测到清算预警或高频异常，清算 Bot 与智能合约即刻触发 freezeSessionKey()，保护本金安全
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                  }}
                >
                  [ARMED &amp; PROTECTED]
                </div>
              </div>
            </div>
          </div>
        </PageCam>
      )}
    </div>
  );
};
