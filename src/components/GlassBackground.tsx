"use client";

import React, { useEffect, useState } from "react";
import { Shader, Swirl, ChromaFlow, Ripples, FlutedGlass } from "shaders/react";

interface GlassBackgroundProps {
  className?: string;
  opacity?: string;
  enableAutoMotion?: boolean;
}

export function GlassBackground({
  className = "absolute inset-0 pointer-events-none -z-10 overflow-hidden",
  opacity = "opacity-45",
  enableAutoMotion = true,
}: GlassBackgroundProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Autonomous background fluid motion driver
  useEffect(() => {
    if (!mounted || !enableAutoMotion) return;

    let animId: number;
    let lastRealMoveTime = 0;
    let t = 0;
    let lastDispatchTime = 0;

    const onRealMouseMove = (e: MouseEvent) => {
      if (e.isTrusted) {
        lastRealMoveTime = performance.now();
      }
    };

    window.addEventListener("mousemove", onRealMouseMove, { passive: true });

    const loop = (now: number) => {
      // If user is idle (has not moved mouse in the last 400ms), gently auto-drive background fluid motion
      if (now - lastRealMoveTime > 400) {
        if (now - lastDispatchTime >= 28) {
          lastDispatchTime = now;
          t += 0.022;

          const width = typeof window !== "undefined" ? window.innerWidth : 1200;
          const height = typeof window !== "undefined" ? window.innerHeight : 800;

          // Lissajous orbit to create continuous organic wave and liquid stir
          const x = width * (0.5 + 0.35 * Math.sin(t * 0.75) + 0.1 * Math.cos(t * 1.35));
          const y = height * (0.5 + 0.28 * Math.cos(t * 0.55) + 0.08 * Math.sin(t * 1.15));

          window.dispatchEvent(
            new MouseEvent("mousemove", {
              clientX: x,
              clientY: y,
              bubbles: true,
            })
          );
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onRealMouseMove);
      cancelAnimationFrame(animId);
    };
  }, [mounted, enableAutoMotion]);

  if (!mounted) {
    return null;
  }

  return (
    <div className={`${className} ${opacity} mix-blend-screen`}>
      {/* Subtle organic ambient ripple waves (淡淡的波纹) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden mix-blend-screen opacity-35">
        <div
          className="absolute inset-0 animate-[pulse_5s_cubic-bezier(0.4,0,0.6,1)_infinite]"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(131, 110, 249, 0.15) 0%, rgba(0, 242, 254, 0.08) 28%, transparent 65%)`,
          }}
        />
        <div
          className="absolute inset-0 animate-[pulse_7s_cubic-bezier(0.4,0,0.6,1)_infinite] [animation-delay:2.5s]"
          style={{
            backgroundImage: `radial-gradient(circle at 46% 54%, rgba(167, 139, 250, 0.12) 10%, rgba(56, 189, 248, 0.06) 38%, transparent 72%)`,
          }}
        />
      </div>

      <Shader toneMapping="neutral" className="w-full h-full">
        <Swirl
          blend={50}
          detail={1.7}
          stops={[
            { color: "#ffffff", position: 0 },
            { color: "#f0f0f0", position: 1 },
          ]}
        />
        <ChromaFlow
          baseColor="#836ef9"
          blendMode="hardLight"
          downColor="#4642ff"
          intensity={1.5}
          leftColor="#5900ff"
          momentum={10}
          rightColor="#5b4fff"
          upColor="#7105ff"
        />
        <Ripples
          blendMode="softLight"
          opacity={0.35}
          colorA="#a78bfa"
          colorB="#f5f3ff"
          speed={0.5}
          frequency={6}
          softness={0.85}
          thickness={0.22}
        />
        <FlutedGlass
          aberration={0.25}
          angle={30}
          frequency={8}
          highlightColor="#ffffff"
          refraction={4}
          shape="rounded"
          softness={0.5}
          speed={0.15}
        />
      </Shader>
    </div>
  );
}

export default GlassBackground;
