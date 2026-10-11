"use client";

import React, { useEffect, useState } from "react";
import { Shader, LiquidMetal, Glitch, CRTScreen } from "shaders/react";

interface QuantumBootLoaderProps {
  onComplete?: () => void;
}

export function QuantumBootLoader({ onComplete }: QuantumBootLoaderProps) {
  const [percent, setPercent] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 1200; // 1.2s smooth boot sequence

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setPercent(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsDone(true);
          onComplete?.();
        }, 150);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090e] text-white select-none transition-opacity duration-500 ${
        isDone ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Background WebGPU LiquidMetal & Glitch Shader Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
        <Shader toneMapping="neutral" className="w-full h-full">
          <LiquidMetal
            origin="center"
            center={{ x: 0.5, y: 0.5 }}
            scale={1.2}
            lightColor="#00f2fe"
            darkColor="#120c24"
            turbulence={0.8}
            ripple={3.5}
            rotation={0}
          />
          <CRTScreen
            pixelSize={160}
            colorShift={0.4}
            scanlineIntensity={0.2}
            scanlineFrequency={220}
            brightness={1.05}
          />
          <Glitch
            intensity={percent < 90 ? 0.25 : 0.05}
            speed={1.2}
            rgbShift={percent < 90 ? 3 : 1}
            blockDensity={12}
            colorBarIntensity={0.15}
          />
        </Shader>
      </div>

      {/* Cyber Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#836ef9_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Central Terminal Telemetry Hub */}
      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center space-y-6">
        {/* Monad Chain & Architecture Coordinates */}
        <div className="flex items-center gap-3 font-mono text-[11px] tracking-widest text-cyan-400/90 border border-cyan-400/20 bg-cyan-950/30 px-3.5 py-1.5 rounded-md backdrop-blur-md">
          <span className="w-2 h-2 rounded-sm bg-cyan-400 animate-ping" />
          <span>KOLIANCE BOOT // CHAIN 10143</span>
        </div>

        {/* Big Monospaced Speed Percentage */}
        <div className="flex flex-col items-center">
          <div className="font-mono text-6xl sm:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-purple-400">
            {percent}%
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuantumBootLoader;
