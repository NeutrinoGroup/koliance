import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';

export const AudioLayer: React.FC<{ enableBgm?: boolean }> = ({ enableBgm = true }) => {
  return (
    <>
      {/* Background Music Track */}
      {enableBgm && (
        <Audio
          src={staticFile('audio/bgm/bgm-tech-house.mp3')}
          volume={0.35}
          loop
        />
      )}

      {/* Act 1 SFX: Disaster & Shield Arrival */}
      <Sequence from={120} durationInFrames={60}>
        <Audio src={staticFile('audio/sfx/data/glitch-virtual-quick.mp3')} volume={0.65} />
      </Sequence>
      <Sequence from={450} durationInFrames={90}>
        <Audio src={staticFile('audio/sfx/impact/bass-hit-futuristic.mp3')} volume={0.8} />
      </Sequence>

      {/* Act 2 SFX: Web2 Binding & Credit Surge */}
      <Sequence from={960} durationInFrames={40}>
        <Audio src={staticFile('audio/sfx/ui/ui-select-modern.mp3')} volume={0.6} />
      </Sequence>
      <Sequence from={1550} durationInFrames={120}>
        <Audio src={staticFile('audio/sfx/data/power-up-electronic.mp3')} volume={0.7} />
      </Sequence>
      <Sequence from={1900} durationInFrames={60}>
        <Audio src={staticFile('audio/sfx/impact/hit-fast-exciting.mp3')} volume={0.75} />
      </Sequence>

      {/* Act 3 SFX: Autonomous Execution & Circuit Breaker */}
      <Sequence from={2320} durationInFrames={50}>
        <Audio src={staticFile('audio/sfx/camera/camera-shutter-hard.mp3')} volume={0.6} />
      </Sequence>
      <Sequence from={2650} durationInFrames={45}>
        <Audio src={staticFile('audio/sfx/ui/hitech-touch-magnet.mp3')} volume={0.55} />
      </Sequence>
      <Sequence from={2980} durationInFrames={60}>
        <Audio src={staticFile('audio/sfx/data/break-glitch-digital.mp3')} volume={0.7} />
      </Sequence>
      <Sequence from={3320} durationInFrames={90}>
        <Audio src={staticFile('audio/sfx/impact/stomp-apocalyptic.mp3')} volume={0.85} />
      </Sequence>

      {/* Act 4 SFX: Explorer Verification & Outro Slam */}
      <Sequence from={3620} durationInFrames={120}>
        <Audio src={staticFile('audio/sfx/scifi/tech-hum-futuristic.mp3')} volume={0.65} />
      </Sequence>
      <Sequence from={4200} durationInFrames={120}>
        <Audio src={staticFile('audio/sfx/impact/impact-cine-big.mp3')} volume={0.9} />
      </Sequence>
    </>
  );
};
