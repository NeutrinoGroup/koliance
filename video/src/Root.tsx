import React from 'react';
import { Composition } from 'remotion';
import { MainVideo } from './MainVideo';

export const Root: React.FC = () => {
  return (
    <Composition
      id="KolianceDemo"
      component={MainVideo}
      durationInFrames={4500}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        bgm: true,
      }}
    />
  );
};
