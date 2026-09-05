import React from 'react';
import {AbsoluteFill, Audio, Series, staticFile, useCurrentFrame, interpolate} from 'remotion';
import {TitleScene} from './scenes/TitleScene';
import {CompareScene} from './scenes/CompareScene';
import {FlowScene, FlowNode, FlowEdge, LayoutKind, SceneCharacter} from './scenes/FlowScene';
import {HostPose} from './HostCharacter';
import {Captions} from './Captions';

export type SceneDef =
  | {
      type: 'title';
      durationInFrames: number;
      props: {
        text: string;
        subtitle?: string;
        character?: {src?: string; pose?: HostPose; color?: string; position?: 'left' | 'right'};
      };
    }
  | {
      type: 'compare';
      durationInFrames: number;
      props: {title: string; items: {label: string; color: string; initial?: string}[]};
    }
  | {
      type: 'flow';
      durationInFrames: number;
      props: {
        title?: string;
        layout?: LayoutKind;
        rootPosition?: 'top' | 'bottom';
        nodes: FlowNode[];
        edges: FlowEdge[];
        character?: SceneCharacter;
      };
    };

export type MainVideoProps = {
  audioSrc: string; // filename inside public/, referenced via staticFile()
  scenes: SceneDef[];
  words: {word: string; start: number; end: number}[];
};

// Sums scene durations to determine total video length. Used by calculateMetadata
// in Root.tsx so the video is automatically as long as its scene list requires.
export const totalDurationInFrames = (scenes: SceneDef[]) =>
  scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

const SCENE_FADE_FRAMES = 10;

// Softens the hard cut at every <Series.Sequence> boundary: each scene
// already fades ITS OWN content in near frame 0, but nothing previously
// faded the outgoing scene out, so it stayed at full brightness right up
// until the instant it vanished — that abrupt disappearance, not the
// content change itself, is most of what read as the screen "jumping."
// Dipping the last ~1/3s to transparent turns that into a soft dissolve
// with zero effect on timing (durationInFrames — and therefore the audio
// sync every scene is built from — is completely untouched).
//
// This only runs at an ACTUAL cut: a "continueDiagram" chain (see
// plan_scenes.py's merge_continued_scenes) is already collapsed into one
// single Series.Sequence before this ever renders, so a diagram that's
// genuinely still being built never dips — only a real change of scene does.
const SceneFade: React.FC<{durationInFrames: number; children: React.ReactNode}> = ({
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  // Guard against a scene shorter than the fade itself (hand-authored test
  // data mainly — real generated scenes run 300+ frames) so the fade never
  // eats the whole thing; cap it at a third of the scene's own duration.
  const fadeFrames = Math.min(SCENE_FADE_FRAMES, durationInFrames / 3);
  const fadeStart = Math.max(0, durationInFrames - fadeFrames);
  const opacity = interpolate(frame, [fadeStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%', opacity}}>
      {children}
    </div>
  );
};

export const MainVideo: React.FC<MainVideoProps> = ({audioSrc, scenes, words}) => {
  return (
    <AbsoluteFill>
      <Audio src={staticFile(audioSrc)} />
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={scene.durationInFrames}>
            <SceneFade durationInFrames={scene.durationInFrames}>
              {scene.type === 'title' && (
                <TitleScene {...scene.props} durationInFrames={scene.durationInFrames} sceneIndex={i} />
              )}
              {scene.type === 'compare' && (
                <CompareScene {...scene.props} durationInFrames={scene.durationInFrames} sceneIndex={i} />
              )}
              {scene.type === 'flow' && (
                <FlowScene {...scene.props} durationInFrames={scene.durationInFrames} sceneIndex={i} />
              )}
            </SceneFade>
          </Series.Sequence>
        ))}
      </Series>
      <Captions words={words} />
    </AbsoluteFill>
  );
};
