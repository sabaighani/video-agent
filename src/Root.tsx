import React from 'react';
import {Composition} from 'remotion';
import {MainVideo, MainVideoProps, totalDurationInFrames} from './MainVideo';
import scenesData from '../scenes.sample.json';

const FPS = 30;

// Two formats, one storyboard: the exact same scenes.generated.json renders
// into both — Remotion just re-runs the same layout-engine math against a
// different width/height (everything in FlowScene/TitleScene/CompareScene
// is already computed in percentages of the current composition's own
// width/height, so no per-format content is needed). Render both
// composition ids from one `remotion render` pass per format — see
// scripts/run.ps1 / run.sh / agent.ps1.
const VERTICAL = {width: 1080, height: 1920}; // Instagram/Reels/Shorts, 9:16
const LANDSCAPE = {width: 1920, height: 1080}; // YouTube standard, 16:9

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="MainVideo"
        component={MainVideo}
        fps={FPS}
        width={VERTICAL.width}
        height={VERTICAL.height}
        durationInFrames={totalDurationInFrames(scenesData.scenes as MainVideoProps['scenes'])}
        defaultProps={scenesData as unknown as MainVideoProps}
        calculateMetadata={async ({props}) => ({
          durationInFrames: totalDurationInFrames(props.scenes),
        })}
      />
      <Composition
        id="MainVideoYouTube"
        component={MainVideo}
        fps={FPS}
        width={LANDSCAPE.width}
        height={LANDSCAPE.height}
        durationInFrames={totalDurationInFrames(scenesData.scenes as MainVideoProps['scenes'])}
        defaultProps={scenesData as unknown as MainVideoProps}
        calculateMetadata={async ({props}) => ({
          durationInFrames: totalDurationInFrames(props.scenes),
        })}
      />
    </>
  );
};
