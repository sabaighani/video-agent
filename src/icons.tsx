import React from 'react';

type IconProps = {
  color: string;
  size: number;
  progress?: number;
  // Only meaningful for AgentBodyIcon: per-limb draw progress, so each part
  // can sketch itself in independently the moment it's named, instead of
  // the whole body drawing in at once.
  partProgress?: Partial<Record<'head' | 'handLeft' | 'handRight' | 'legLeft' | 'legRight', number>>;
  // Only meaningful for the 'custom' icon: the shape primitives to draw.
  shape?: ShapePrimitive[];
};

// Simple abstract blob-brain: two overlapping wavy lobes. Generic shape, not
// traced from any existing icon set or illustration.
export const BrainIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path
      d="M30 20c-12 0-20 10-20 20 0 6 2 10 6 14-4 4-6 9-6 14 0 12 10 20 22 20 6 0 11-2 15-6 4 4 9 6 15 6 12 0 22-8 22-20 0-5-2-10-6-14 4-4 6-8 6-14 0-10-8-20-20-20-6 0-11 2-15 6-4-4-9-6-15-6z"
      stroke={color}
      strokeWidth={4}
      strokeLinejoin="round"
     pathLength={1}/>
    <path d="M50 26v50M30 40c6 0 10 4 10 10M70 40c-6 0-10 4-10 10M30 62c6 0 10-4 10-10M70 62c-6 0-10-4-10-10"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
     pathLength={1}/>
      </g>
  </svg>
);

// Generic person silhouette: circle head + rounded-trapezoid body.
export const PersonIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <circle cx="50" cy="30" r="16" stroke={color} strokeWidth={4}  pathLength={1}/>
    <path
      d="M20 82c2-18 14-28 30-28s28 10 30 28"
      stroke={color}
      strokeWidth={4}
      strokeLinecap="round"
     pathLength={1}/>
      </g>
  </svg>
);

// Circle with an X — generic warning / failure symbol.
export const WarningIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <circle cx="50" cy="50" r="38" stroke={color} strokeWidth={5}  pathLength={1}/>
    <path d="M36 36l28 28M64 36L36 64" stroke={color} strokeWidth={6} strokeLinecap="round"  pathLength={1}/>
      </g>
  </svg>
);

// Stick-figure body with distinguishable parts, for progressive callouts
// (e.g. "hands = tools", "eyes = vision", "legs = actions"). Generic
// clip-art-style figure, not traced from any existing work.
export const AgentBodyIcon: React.FC<IconProps> = ({color, size, progress = 1, partProgress}) => {
  const p = (key: 'head' | 'handLeft' | 'handRight' | 'legLeft' | 'legRight') =>
    partProgress?.[key] ?? progress;
  const dash = (key: Parameters<typeof p>[0]) => ({strokeDasharray: 1, strokeDashoffset: 1 - p(key)});
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <g style={dash('head')}>
        <circle cx="50" cy="18" r="12" stroke={color} strokeWidth={4} pathLength={1} />
        <circle cx="45" cy="16" r="1.6" fill={color} opacity={p('head')} />
        <circle cx="55" cy="16" r="1.6" fill={color} opacity={p('head')} />
        <line x1="50" y1="30" x2="50" y2="62" stroke={color} strokeWidth={4} strokeLinecap="round" pathLength={1} />
      </g>
      <g style={dash('handLeft')}>
        <line x1="50" y1="40" x2="25" y2="55" stroke={color} strokeWidth={4} strokeLinecap="round" pathLength={1} />
        <circle cx="25" cy="55" r="5" stroke={color} strokeWidth={3.5} pathLength={1} />
      </g>
      <g style={dash('handRight')}>
        <line x1="50" y1="40" x2="75" y2="55" stroke={color} strokeWidth={4} strokeLinecap="round" pathLength={1} />
        <circle cx="75" cy="55" r="5" stroke={color} strokeWidth={3.5} pathLength={1} />
      </g>
      <g style={dash('legLeft')}>
        <line x1="50" y1="62" x2="32" y2="90" stroke={color} strokeWidth={4} strokeLinecap="round" pathLength={1} />
        <circle cx="32" cy="90" r="5" stroke={color} strokeWidth={3.5} pathLength={1} />
      </g>
      <g style={dash('legRight')}>
        <line x1="50" y1="62" x2="68" y2="90" stroke={color} strokeWidth={4} strokeLinecap="round" pathLength={1} />
        <circle cx="68" cy="90" r="5" stroke={color} strokeWidth={3.5} pathLength={1} />
      </g>
    </svg>
  );
};

// Percent-of-icon-box anchor points matching the SVG above, so FlowScene can
// point a callout leader line precisely at a body part.
export const AGENT_BODY_ANCHORS: Record<string, {x: number; y: number}> = {
  head: {x: 50, y: 18},
  handLeft: {x: 25, y: 55},
  handRight: {x: 75, y: 55},
  legLeft: {x: 32, y: 90},
  legRight: {x: 68, y: 90},
};

// ---------------------------------------------------------------------------
// General-purpose concept icons. These are NOT specific to AI/agent topics —
// they let the storyboard visually represent whatever the narration is
// actually about (a house, a car, money, security, a network, and so on),
// so the same code works for any subject the video covers. All hand-drawn,
// simple, generic line-art — not traced from any icon library or artwork.
// ---------------------------------------------------------------------------

export const GearIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <circle cx="50" cy="50" r="18" stroke={color} strokeWidth={5}  pathLength={1}/>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x1 = 50 + Math.cos(rad) * 30, y1 = 50 + Math.sin(rad) * 30;
      const x2 = 50 + Math.cos(rad) * 42, y2 = 50 + Math.sin(rad) * 42;
      return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={7} strokeLinecap="round"  pathLength={1}/>;
    })}
      </g>
  </svg>
);

export const HouseIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path d="M15 50 L50 20 L85 50" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"  pathLength={1}/>
    <path d="M25 45 V82 H75 V45" stroke={color} strokeWidth={5} strokeLinejoin="round"  pathLength={1}/>
    <rect x="43" y="58" width="14" height="24" stroke={color} strokeWidth={4}  pathLength={1}/>
      </g>
  </svg>
);

export const CarIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path d="M12 62 L22 38 H78 L88 62" stroke={color} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round"  pathLength={1}/>
    <rect x="8" y="60" width="84" height="18" rx="6" stroke={color} strokeWidth={5}  pathLength={1}/>
    <circle cx="28" cy="80" r="8" stroke={color} strokeWidth={5}  pathLength={1}/>
    <circle cx="72" cy="80" r="8" stroke={color} strokeWidth={5}  pathLength={1}/>
      </g>
  </svg>
);

export const CloudIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path
      d="M28 68c-10 0-18-8-18-17 0-9 7-16 16-17 3-11 13-19 25-19 13 0 24 10 26 22 8 1 14 8 14 16 0 9-7 16-16 16H28z"
      stroke={color}
      strokeWidth={5}
      strokeLinejoin="round"
     pathLength={1}/>
      </g>
  </svg>
);

export const DatabaseIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <ellipse cx="50" cy="24" rx="32" ry="12" stroke={color} strokeWidth={5}  pathLength={1}/>
    <path d="M18 24v52c0 6.6 14.3 12 32 12s32-5.4 32-12V24" stroke={color} strokeWidth={5}  pathLength={1}/>
    <path d="M18 50c0 6.6 14.3 12 32 12s32-5.4 32-12" stroke={color} strokeWidth={5}  pathLength={1}/>
      </g>
  </svg>
);

export const ChatIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <rect x="12" y="20" width="76" height="52" rx="14" stroke={color} strokeWidth={5}  pathLength={1}/>
    <path d="M32 72l-6 16 20-16" stroke={color} strokeWidth={5} strokeLinejoin="round"  pathLength={1}/>
    <line x1="28" y1="40" x2="72" y2="40" stroke={color} strokeWidth={4.5} strokeLinecap="round"  pathLength={1}/>
    <line x1="28" y1="54" x2="58" y2="54" stroke={color} strokeWidth={4.5} strokeLinecap="round"  pathLength={1}/>
      </g>
  </svg>
);

export const LightningIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path d="M55 10 20 58h22l-8 32 40-52H52z" stroke={color} strokeWidth={5} strokeLinejoin="round" fill="none"  pathLength={1}/>
      </g>
  </svg>
);

export const ChartIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path d="M15 85V15M15 85H85" stroke={color} strokeWidth={5} strokeLinecap="round"  pathLength={1}/>
    <path d="M25 70l18-20 15 12 25-32" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"  pathLength={1}/>
      </g>
  </svg>
);

export const LockIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <rect x="22" y="45" width="56" height="42" rx="8" stroke={color} strokeWidth={5}  pathLength={1}/>
    <path d="M32 45V32a18 18 0 0136 0v13" stroke={color} strokeWidth={5}  pathLength={1}/>
    <circle cx="50" cy="65" r="6" stroke={color} strokeWidth={4}  pathLength={1}/>
      </g>
  </svg>
);

export const GlobeIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <circle cx="50" cy="50" r="38" stroke={color} strokeWidth={5}  pathLength={1}/>
    <ellipse cx="50" cy="50" rx="16" ry="38" stroke={color} strokeWidth={4}  pathLength={1}/>
    <line x1="12" y1="50" x2="88" y2="50" stroke={color} strokeWidth={4}  pathLength={1}/>
    <path d="M18 32h64M18 68h64" stroke={color} strokeWidth={4}  pathLength={1}/>
      </g>
  </svg>
);

export const BookIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path d="M50 26c-8-8-22-10-34-6v52c12-4 26-2 34 6" stroke={color} strokeWidth={5} strokeLinejoin="round"  pathLength={1}/>
    <path d="M50 26c8-8 22-10 34-6v52c-12-4-26-2-34 6" stroke={color} strokeWidth={5} strokeLinejoin="round"  pathLength={1}/>
    <line x1="50" y1="26" x2="50" y2="78" stroke={color} strokeWidth={4}  pathLength={1}/>
      </g>
  </svg>
);

export const MoneyIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <rect x="10" y="30" width="80" height="40" rx="8" stroke={color} strokeWidth={5}  pathLength={1}/>
    <circle cx="50" cy="50" r="14" stroke={color} strokeWidth={4.5}  pathLength={1}/>
      </g>
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path d="M50 10 84 24v26c0 24-16 38-34 40-18-2-34-16-34-40V24z" stroke={color} strokeWidth={5} strokeLinejoin="round"  pathLength={1}/>
    <path d="M36 50l10 10 20-20" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"  pathLength={1}/>
      </g>
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path d="M78 30a34 34 0 10 6 30" stroke={color} strokeWidth={5} strokeLinecap="round"  pathLength={1}/>
    <path d="M78 12v20h-20" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"  pathLength={1}/>
      </g>
  </svg>
);

export const RocketIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path d="M50 10c14 10 20 28 16 50l-16 12-16-12c-4-22 2-40 16-50z" stroke={color} strokeWidth={5} strokeLinejoin="round"  pathLength={1}/>
    <circle cx="50" cy="42" r="7" stroke={color} strokeWidth={4}  pathLength={1}/>
    <path d="M34 60l-14 18 20-6M66 60l14 18-20-6" stroke={color} strokeWidth={4.5} strokeLinejoin="round"  pathLength={1}/>
      </g>
  </svg>
);

export const NetworkIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <circle cx="50" cy="18" r="9" stroke={color} strokeWidth={4.5}  pathLength={1}/>
    <circle cx="18" cy="78" r="9" stroke={color} strokeWidth={4.5}  pathLength={1}/>
    <circle cx="82" cy="78" r="9" stroke={color} strokeWidth={4.5}  pathLength={1}/>
    <path d="M50 27L22 70M50 27l28 43M27 78h46" stroke={color} strokeWidth={4}  pathLength={1}/>
      </g>
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <circle cx="50" cy="50" r="38" stroke={color} strokeWidth={5}  pathLength={1}/>
    <path d="M32 52l14 14 22-28" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"  pathLength={1}/>
      </g>
  </svg>
);

export const StarIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
    <path
      d="M50 12l11 26 28 3-21 19 6 28-24-15-24 15 6-28-21-19 28-3z"
      stroke={color}
      strokeWidth={5}
      strokeLinejoin="round"
     pathLength={1}/>
      </g>
  </svg>
);

export const MailIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
      <rect x="10" y="24" width="80" height="52" rx="8" stroke={color} strokeWidth={5} pathLength={1} />
      <path d="M14 28l36 30 36-30" stroke={color} strokeWidth={5} strokeLinejoin="round" pathLength={1} />
    </g>
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
      <circle cx="42" cy="42" r="26" stroke={color} strokeWidth={6} pathLength={1} />
      <line x1="61" y1="61" x2="82" y2="82" stroke={color} strokeWidth={6} strokeLinecap="round" pathLength={1} />
    </g>
  </svg>
);

// A more polished, detailed robot than the plain AgentBodyIcon stick figure
// (which exists specifically for the labeled body-part callout feature) —
// use this one for a general "AI agent" representation.
export const RobotIcon: React.FC<IconProps> = ({color, size, progress = 1}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
      <line x1="50" y1="4" x2="50" y2="14" stroke={color} strokeWidth={4} strokeLinecap="round" pathLength={1} />
      <circle cx="50" cy="4" r="3.5" stroke={color} strokeWidth={3.5} pathLength={1} />
      <circle cx="50" cy="28" r="16" stroke={color} strokeWidth={5} pathLength={1} />
      <circle cx="44" cy="26" r="2.2" fill={color} opacity={progress} />
      <circle cx="56" cy="26" r="2.2" fill={color} opacity={progress} />
      <rect x="32" y="46" width="36" height="32" rx="7" stroke={color} strokeWidth={5} pathLength={1} />
      <rect x="40" y="56" width="20" height="7" rx="2" stroke={color} strokeWidth={3} pathLength={1} />
      <line x1="32" y1="54" x2="17" y2="64" stroke={color} strokeWidth={4.5} strokeLinecap="round" pathLength={1} />
      <circle cx="17" cy="64" r="5" stroke={color} strokeWidth={3.5} pathLength={1} />
      <line x1="68" y1="54" x2="83" y2="64" stroke={color} strokeWidth={4.5} strokeLinecap="round" pathLength={1} />
      <circle cx="83" cy="64" r="5" stroke={color} strokeWidth={3.5} pathLength={1} />
      <line x1="40" y1="78" x2="37" y2="94" stroke={color} strokeWidth={4.5} strokeLinecap="round" pathLength={1} />
      <circle cx="35" cy="95" r="5" stroke={color} strokeWidth={3.5} pathLength={1} />
      <line x1="60" y1="78" x2="63" y2="94" stroke={color} strokeWidth={4.5} strokeLinecap="round" pathLength={1} />
      <circle cx="65" cy="95" r="5" stroke={color} strokeWidth={3.5} pathLength={1} />
    </g>
  </svg>
);

export type IconName =
  | 'brain'
  | 'person'
  | 'warning'
  | 'agent-body'
  | 'gear'
  | 'house'
  | 'car'
  | 'cloud'
  | 'database'
  | 'chat'
  | 'lightning'
  | 'chart'
  | 'lock'
  | 'globe'
  | 'book'
  | 'money'
  | 'shield'
  | 'refresh'
  | 'rocket'
  | 'network'
  | 'check'
  | 'star'
  | 'mail'
  | 'search'
  | 'robot'
  | 'custom';

// ---------------------------------------------------------------------------
// Generative drawing system for concepts with no matching named icon above.
// The model never writes code — it only ever supplies DATA (a short list of
// simple shape primitives in a 0-100 coordinate space), and this fixed,
// hand-tested renderer draws them. Worst case for bad input is an odd-looking
// shape, never a crash or arbitrary code execution — the same safety
// guarantee as the layout engine (which also takes structured data, never
// coordinates-as-code) elsewhere in this project.
// ---------------------------------------------------------------------------

export type ShapePrimitive =
  | {type: 'circle'; cx: number; cy: number; r: number}
  | {type: 'dot'; cx: number; cy: number; r: number} // filled, no stroke — e.g. an eye
  | {type: 'line'; x1: number; y1: number; x2: number; y2: number}
  | {type: 'path'; points: [number, number][]; closed?: boolean}
  | {type: 'arc'; cx: number; cy: number; r: number; startDeg: number; endDeg: number};

const clampCoord = (n: unknown, fallback = 50) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(-20, Math.min(120, v));
};

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export const GeneratedIcon: React.FC<IconProps & {shape?: ShapePrimitive[]}> = ({
  color,
  size,
  progress = 1,
  shape,
}) => {
  // Defensive: cap how much a single shape can contain and sanitize every
  // coordinate, regardless of what was requested upstream.
  const safeShapes = (shape ?? []).slice(0, 40);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <g style={{strokeDasharray: 1, strokeDashoffset: 1 - progress}}>
        {safeShapes.map((s, i) => {
          if (s.type === 'circle') {
            return (
              <circle
                key={i}
                cx={clampCoord(s.cx)}
                cy={clampCoord(s.cy)}
                r={Math.max(1, Math.min(60, s.r || 10))}
                stroke={color}
                strokeWidth={4}
                pathLength={1}
              />
            );
          }
          if (s.type === 'dot') {
            return (
              <circle
                key={i}
                cx={clampCoord(s.cx)}
                cy={clampCoord(s.cy)}
                r={Math.max(0.5, Math.min(6, s.r || 1.5))}
                fill={color}
                opacity={progress}
              />
            );
          }
          if (s.type === 'line') {
            return (
              <line
                key={i}
                x1={clampCoord(s.x1)}
                y1={clampCoord(s.y1)}
                x2={clampCoord(s.x2)}
                y2={clampCoord(s.y2)}
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
                pathLength={1}
              />
            );
          }
          if (s.type === 'path') {
            const pts = (s.points ?? []).slice(0, 20).map(([x, y]) => [clampCoord(x), clampCoord(y)]);
            if (pts.length < 2) return null;
            const d = pts.map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + (s.closed ? ' Z' : '');
            return (
              <path key={i} d={d} stroke={color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
            );
          }
          if (s.type === 'arc') {
            const d = arcPath(clampCoord(s.cx), clampCoord(s.cy), Math.max(1, Math.min(60, s.r || 10)), s.startDeg || 0, s.endDeg || 180);
            return <path key={i} d={d} stroke={color} strokeWidth={4} strokeLinecap="round" pathLength={1} />;
          }
          return null;
        })}
      </g>
    </svg>
  );
};

export const IconByName: Record<IconName, React.FC<IconProps>> = {
  brain: BrainIcon,
  person: PersonIcon,
  warning: WarningIcon,
  'agent-body': AgentBodyIcon,
  gear: GearIcon,
  house: HouseIcon,
  car: CarIcon,
  cloud: CloudIcon,
  database: DatabaseIcon,
  chat: ChatIcon,
  lightning: LightningIcon,
  chart: ChartIcon,
  lock: LockIcon,
  globe: GlobeIcon,
  book: BookIcon,
  money: MoneyIcon,
  shield: ShieldIcon,
  refresh: RefreshIcon,
  rocket: RocketIcon,
  network: NetworkIcon,
  check: CheckIcon,
  star: StarIcon,
  mail: MailIcon,
  search: SearchIcon,
  robot: RobotIcon,
  custom: GeneratedIcon,
};

