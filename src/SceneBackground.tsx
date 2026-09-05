import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {theme} from './theme';

// Deterministic pseudo-random spread from a seed (usually the scene index),
// so every scene's orbs land somewhere a little different without breaking
// frame-by-frame render determinism (Math.random() would).
function seeded(seed: number, salt: number) {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const ORB_COLORS = [theme.colors.blue, theme.colors.purple, theme.colors.teal, theme.colors.coral];

// Ambient depth behind every scene: a couple of huge, soft, slowly-drifting
// color blooms + the existing dot grid + a gentle vignette. On its own this
// is what turns a flat single-color background into something with actual
// depth, without ever competing with foreground content (captions sit in
// their own pill, well clear of the vignette's darkened edges).
export const SceneBackground: React.FC<{seed?: number}> = ({seed = 0}) => {
  const frame = useCurrentFrame();
  const orbs = [0, 1].map((i) => {
    const cx = 20 + seeded(seed, i) * 60; // 20-80%
    const cy = 20 + seeded(seed, i + 10) * 55; // 20-75%
    const size = 70 + seeded(seed, i + 20) * 40; // 70-110vmin
    const color = ORB_COLORS[(Math.floor(seeded(seed, i + 30) * 10) + i) % ORB_COLORS.length];
    const driftX = Math.sin(frame / 280 + i * 2.3) * 2.5;
    const driftY = Math.cos(frame / 320 + i * 1.6) * 2.5;
    return {cx, cy, size, color, driftX, driftY};
  });

  return (
    <>
      <div style={{position: 'absolute', inset: 0, backgroundColor: theme.bg}} />
      {orbs.map((o, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${o.cx + o.driftX}%`,
            top: `${o.cy + o.driftY}%`,
            width: `${o.size}vmin`,
            height: `${o.size}vmin`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${o.color}26, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: theme.dotGrid,
          backgroundSize: theme.dotGridSize,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 45%, transparent 52%, rgba(2,2,6,0.42) 100%)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

// A very slow, subtle continuous zoom/pan on top of a scene's content (not
// the captions, which live outside every scene) — the difference between a
// static poster and something that feels like it's actually being filmed.
// Kept small (max ~3.5% scale, ~0.6% pan) so it never fights readability.
export function useKenBurns(durationInFrames: number, seed = 0): React.CSSProperties {
  const frame = useCurrentFrame();
  const dur = Math.max(durationInFrames, 1);
  const dir = seed % 2 === 0 ? 1 : -1;
  const scale = interpolate(frame, [0, dur], [1, 1.035], {extrapolateRight: 'clamp'});
  const translateX = dir * interpolate(frame, [0, dur], [0, 0.6], {extrapolateRight: 'clamp'});
  return {transform: `scale(${scale}) translateX(${translateX}%)`, transformOrigin: '50% 50%'};
}
