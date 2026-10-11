"use client";

import React, { useEffect, useState } from "react";
import { Shader, Swirl, ChromaFlow, FlutedGlass } from "shaders/react";

interface GlassBackgroundProps {
  className?: string;
  opacity?: string;
}

export function GlassBackground({
  className = "absolute inset-0 pointer-events-none -z-10 overflow-hidden",
  opacity = "opacity-45",
}: GlassBackgroundProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className={`${className} ${opacity} mix-blend-screen`}>
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
