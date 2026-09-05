import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {theme} from '../theme';
import {SceneBackground, useKenBurns} from '../SceneBackground';
import {HostCharacter, HostPose} from '../HostCharacter';
import {AssetImage} from '../AssetImage';

export const TitleScene: React.FC<{
  text: string;
  subtitle?: string;
  // Optional recurring character. "src" is a real pose image (e.g.
  // host-neutral.png) already scanned from public/assets/ — the planner
  // only ever references real files, and this takes priority when given.
  // Without "src", "pose" draws her procedurally instead (HostCharacter) —
  // no image asset required at all.
  character?: {src?: string; pose?: HostPose; color?: string; position?: 'left' | 'right'};
  durationInFrames?: number;
  sceneIndex?: number;
}> = ({text, subtitle, character, durationInFrames = 60, sceneIndex = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const scale = spring({frame, fps, config: {damping: 14, stiffness: 120}});
  const opacity = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const kenBurns = useKenBurns(durationInFrames, sceneIndex);

  const charPos = character?.position ?? 'right';
  const textInset = character ? 34 : 0; // % of width the text column yields to the character

  return (
    <div style={{flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: theme.bg}}>
      <SceneBackground seed={sceneIndex} />
      <div style={{position: 'absolute', inset: 0, ...kenBurns}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: charPos === 'left' ? `${textInset}%` : 0,
            paddingRight: charPos === 'right' ? `${textInset}%` : 0,
          }}
        >
          <div
            style={{
              fontFamily: theme.fontFamily,
              fontWeight: 800,
              fontSize: 72,
              color: theme.colors.teal,
              textShadow: theme.glow(theme.colors.teal, 20),
              opacity,
              transform: `scale(${scale})`,
              textAlign: 'center',
              padding: '0 60px',
            }}
          >
            {text}
          </div>
          {subtitle ? (
            <div
              style={{
                fontFamily: theme.fontFamily,
                fontWeight: 500,
                fontSize: 34,
                color: theme.colors.white,
                opacity: interpolate(frame, [10, 25], [0, 1], {extrapolateRight: 'clamp'}),
                marginTop: 24,
                textAlign: 'center',
                padding: '0 80px',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {character ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              [charPos]: '2%',
              width: '32%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              opacity: interpolate(frame, [4, 20], [0, 1], {extrapolateRight: 'clamp'}),
              transform: `translateX(${interpolate(frame, [0, 18], [charPos === 'right' ? 30 : -30, 0], {
                extrapolateRight: 'clamp',
              })}px)`,
              pointerEvents: 'none',
            } as React.CSSProperties}
          >
            {character.src ? (
              <AssetImage
                filename={character.src}
                style={{maxWidth: '100%', maxHeight: '94%', objectFit: 'contain', filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.55))'}}
              />
            ) : (
              <div style={{width: '68%', maxHeight: '94%', filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.55))'}}>
                <HostCharacter pose={character.pose ?? 'neutral'} color={character.color} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
