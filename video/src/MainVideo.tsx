import React from 'react';
import { Sequence } from 'remotion';
import { BackgroundGrid } from './components/BackgroundGrid';
import { HudHeader } from './components/HudHeader';
import { SubtitleOverlay } from './components/SubtitleOverlay';
import { AudioLayer } from './components/AudioLayer';
import { Act1_PainAndSolution } from './acts/Act1_PainAndSolution';
import { Act2_IdentityAndCredit } from './acts/Act2_IdentityAndCredit';
import { Act3_AgentAutonomousTrading } from './acts/Act3_AgentAutonomousTrading';
import { Act4_OnChainSettlement } from './acts/Act4_OnChainSettlement';
import type { VideoProps } from './types';

export const MainVideo: React.FC<VideoProps> = ({ bgm = true }) => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: 'relative',
        backgroundColor: '#0a0d14',
        overflow: 'hidden',
      }}
    >
      {/* Dynamic Cyber Backdrop */}
      <BackgroundGrid />

      {/* Top HUD Status Bar */}
      <HudHeader />

      {/* Act 1: 0:00 - 0:30 (0 - 900 frames) */}
      <Sequence from={0} durationInFrames={900}>
        <Act1_PainAndSolution />
      </Sequence>

      {/* Act 2: 0:30 - 1:15 (900 - 2250 frames) */}
      <Sequence from={900} durationInFrames={1350}>
        <Act2_IdentityAndCredit />
      </Sequence>

      {/* Act 3: 1:15 - 2:00 (2250 - 3600 frames) */}
      <Sequence from={2250} durationInFrames={1350}>
        <Act3_AgentAutonomousTrading />
      </Sequence>

      {/* Act 4: 2:00 - 2:30 (3600 - 4500 frames) */}
      <Sequence from={3600} durationInFrames={900}>
        <Act4_OnChainSettlement />
      </Sequence>

      {/* Synchronized Lower-Third Subtitles */}
      <SubtitleOverlay />

      {/* Multi-Track Audio (BGM + Act-Specific SFX) */}
      <AudioLayer enableBgm={bgm} />
    </div>
  );
};
