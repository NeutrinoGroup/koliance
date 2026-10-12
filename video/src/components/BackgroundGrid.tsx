import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export const BackgroundGrid: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle breathing lighting
  const pulse = interpolate(
    Math.sin((frame / 60) * Math.PI),
    [-1, 1],
    [0.15, 0.25]
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#0a0d14',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Radial lighting gradients */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '30%',
          width: '50vw',
          height: '50vw',
          background: `radial-gradient(circle, rgba(131, 110, 249, ${pulse}) 0%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '20%',
          width: '45vw',
          height: '45vw',
          background: `radial-gradient(circle, rgba(0, 242, 254, ${pulse * 0.5}) 0%, transparent 65%)`,
          filter: 'blur(90px)',
        }}
      />

      {/* Cyber Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Vignette border */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 160px rgba(0, 0, 0, 0.85)',
        }}
      />
    </div>
  );
};
