import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {theme} from '../theme';
import {SceneBackground, useKenBurns} from '../SceneBackground';

type Item = {label: string; color: string; initial?: string};

export const CompareScene: React.FC<{title: string; items?: Item[]; durationInFrames?: number; sceneIndex?: number}> = ({
  title,
  items,
  durationInFrames = 100,
  sceneIndex = 0,
}) => {
  const safeItems = items ?? [];
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const kenBurns = useKenBurns(durationInFrames, sceneIndex);

  return (
    <div style={{flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: theme.bg}}>
      <SceneBackground seed={sceneIndex} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 160,
          ...kenBurns,
        }}
      >
        <div
          style={{
            fontFamily: theme.fontFamily,
            fontWeight: 800,
            fontSize: 56,
            color: theme.colors.blue,
            textShadow: theme.glow(theme.colors.blue, 16),
            opacity: interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'}),
            marginBottom: 90,
          }}
        >
          {title}
        </div>
        <div style={{display: 'flex', gap: 90}}>
          {safeItems.map((item, i) => {
          const delay = 15 + i * 10;
          const s = spring({frame: frame - delay, fps, config: {damping: 12, stiffness: 140}});
          const op = interpolate(frame, [delay, delay + 10], [0, 1], {extrapolateRight: 'clamp'});
            return (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  opacity: op,
                  transform: `scale(${s})`,
                }}
              >
                <div
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: `4px solid ${item.color}`,
                    boxShadow: theme.glow(item.color, 20),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.fontFamily,
                    fontWeight: 800,
                    fontSize: 40,
                    color: item.color,
                  }}
                >
                  {item.initial ?? item.label[0]}
                </div>
                <div
                  style={{
                    fontFamily: theme.fontFamily,
                    fontWeight: 600,
                    fontSize: 30,
                    color: theme.colors.white,
                    marginTop: 18,
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
