import React from 'react';
import { useCurrentFrame } from 'remotion';

export const HudHeader: React.FC = () => {
  const frame = useCurrentFrame();

  const getActiveAct = () => {
    if (frame < 900) return 1;
    if (frame < 2250) return 2;
    if (frame < 3600) return 3;
    return 4;
  };

  const activeAct = getActiveAct();
  const seconds = (frame / 30).toFixed(1);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        padding: '0 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(11, 14, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 50,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {/* Brand & Project Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #836EF9 0%, #00F2FE 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(131, 110, 249, 0.4)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>K</span>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.05em' }}>
            KOLIANCE
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em' }}>
            MONAD AI AGENT ASSET & CREDIT PROTOCOL
          </div>
        </div>
      </div>

      {/* Acts Tracker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {[
          { id: 1, label: '01 痛点与破局' },
          { id: 2, label: '02 身份与信用' },
          { id: 3, label: '03 自主交易' },
          { id: 4, label: '04 链上存证' },
        ].map((act) => {
          const isActive = activeAct === act.id;
          return (
            <div
              key={act.id}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.05em',
                transition: 'all 0.2s',
                backgroundColor: isActive ? 'rgba(131, 110, 249, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#00f2fe' : '#64748b',
                border: isActive ? '1px solid rgba(0, 242, 254, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: isActive ? '0 0 12px rgba(0, 242, 254, 0.2)' : 'none',
              }}
            >
              {isActive ? `[LIVE] ${act.label}` : act.label}
            </div>
          );
        })}
      </div>

      {/* Network & Timecode Telemetry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 11, color: '#94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
            }}
          />
          <span style={{ color: '#cbd5e1' }}>MONAD PARALLEL TESTNET</span>
        </div>
        <div style={{ color: '#64748b' }}>|</div>
        <div>
          TIME: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{seconds}s</span> / 150.0s
        </div>
        <div>
          FRAME: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{frame}</span>
        </div>
      </div>
    </div>
  );
};
