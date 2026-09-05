import React from 'react';
import {theme} from './theme';

export type HostPose = 'laptop' | 'explain' | 'neutral';

// A generic, procedurally-drawn recurring host — NOT a copy of any real
// person, photo, or existing illustration. Round 12-15 could only place a
// character the user generated and dropped into public/assets/ themselves;
// this is the "don't make me supply an image at all" version — a simple
// flat-vector figure the code draws itself, in whichever of three poses
// fits the moment (see FlowScene/TitleScene for how the pose is picked).
// It never claims to BE any specific branded character — think of it as
// this project's own generic presenter, the same honest spirit as the
// "badge" node explicitly not being a real logo.
export const HostCharacter: React.FC<{pose?: HostPose; color?: string; hairColor?: string; skinColor?: string}> = ({
  pose = 'neutral',
  color = theme.colors.coral,
  hairColor = '#3a2a22',
  skinColor = '#f0c19c',
}) => {
  const stripeColor = 'rgba(255,255,255,0.85)';
  const pantsColor = '#232838';

  return (
    <svg width="100%" height="100%" viewBox="0 0 100 160" style={{overflow: 'visible'}}>
      <defs>
        <clipPath id="hc-torso-clip">
          <rect x="30" y="44" width="40" height="46" rx="14" />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="50" cy="154" rx="26" ry="5" fill="rgba(0,0,0,0.35)" />

      {/* legs — standing for neutral/explain, seated for laptop */}
      {pose === 'laptop' ? (
        <g fill={pantsColor}>
          <rect x="27" y="90" width="20" height="16" rx="8" />
          <rect x="53" y="90" width="20" height="16" rx="8" />
          <rect x="30" y="100" width="12" height="34" rx="6" />
          <rect x="58" y="100" width="12" height="34" rx="6" />
          <ellipse cx="36" cy="136" rx="9" ry="5" fill="#12141c" />
          <ellipse cx="64" cy="136" rx="9" ry="5" fill="#12141c" />
        </g>
      ) : (
        <g fill={pantsColor}>
          <rect x="35" y="88" width="13" height="46" rx="6.5" />
          <rect x="52" y="88" width="13" height="46" rx="6.5" />
          <ellipse cx="41.5" cy="136" rx="8" ry="5" fill="#12141c" />
          <ellipse cx="58.5" cy="136" rx="8" ry="5" fill="#12141c" />
        </g>
      )}

      {/* far arm (behind torso), pose-dependent */}
      {pose === 'explain' ? (
        <path d="M34 52 Q22 60 20 78" stroke={skinColor} strokeWidth={9} strokeLinecap="round" fill="none" />
      ) : pose === 'laptop' ? null : (
        <path d="M34 52 Q24 66 26 84" stroke={skinColor} strokeWidth={9} strokeLinecap="round" fill="none" />
      )}

      {/* torso (shirt) with clipped horizontal stripes */}
      <rect x="30" y="44" width="40" height="46" rx="14" fill={color} />
      <g clipPath="url(#hc-torso-clip)">
        <rect x="30" y="52" width="40" height="7" fill={stripeColor} opacity={0.9} />
        <rect x="30" y="66" width="40" height="7" fill={stripeColor} opacity={0.9} />
        <rect x="30" y="80" width="40" height="7" fill={stripeColor} opacity={0.9} />
      </g>
      <rect x="30" y="44" width="40" height="46" rx="14" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} />

      {/* laptop, only for the working pose — sits in front of the lap */}
      {pose === 'laptop' ? (
        <g>
          <rect x="30" y="84" width="40" height="4" rx="2" fill="#0c0c14" stroke={theme.colors.blue} strokeWidth={1.5} />
          <path
            d="M34 84 L38 66 Q39 63 42 63 L58 63 Q61 63 62 66 L66 84 Z"
            fill="#0c0c14"
            stroke={theme.colors.blue}
            strokeWidth={1.5}
          />
          <rect x="42" y="67" width="16" height="10" rx="1.5" fill={theme.colors.blue} opacity={0.28} />
        </g>
      ) : null}

      {/* near arm (in front of torso), pose-dependent */}
      {pose === 'explain' ? (
        <>
          <path d="M66 50 Q84 40 90 24" stroke={skinColor} strokeWidth={9} strokeLinecap="round" fill="none" />
          <circle cx="91" cy="21" r="6" fill={skinColor} />
        </>
      ) : pose === 'laptop' ? (
        <>
          <path d="M36 58 Q34 74 40 84" stroke={skinColor} strokeWidth={9} strokeLinecap="round" fill="none" />
          <path d="M64 58 Q66 74 60 84" stroke={skinColor} strokeWidth={9} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <path d="M66 50 Q76 64 74 84" stroke={skinColor} strokeWidth={9} strokeLinecap="round" fill="none" />
      )}

      {/* neck + head */}
      <rect x="45" y="34" width="10" height="12" fill={skinColor} />
      <circle cx="50" cy="24" r="15" fill={skinColor} />

      {/* hair: rounded crown + a ponytail sweeping to one side */}
      <path
        d="M33 22 Q33 6 50 6 Q67 6 67 22 Q67 14 58 12 Q52 20 42 14 Q35 15 33 22 Z"
        fill={hairColor}
      />
      <path
        d="M64 16 Q78 20 76 40 Q75 48 68 46 Q73 30 62 18 Z"
        fill={hairColor}
      />

      {/* face */}
      <circle cx="44.5" cy="25" r="1.7" fill="#2a2a2a" />
      <circle cx="55.5" cy="25" r="1.7" fill="#2a2a2a" />
      <path d="M45 31 Q50 34.5 55 31" stroke="#9c5a3c" strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </svg>
  );
};
