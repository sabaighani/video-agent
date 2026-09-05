import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {theme} from '../theme';
import {IconByName, IconName, AGENT_BODY_ANCHORS, ShapePrimitive} from '../icons';
import {SceneBackground, useKenBurns} from '../SceneBackground';
import {HostCharacter} from '../HostCharacter';
import {AssetImage} from '../AssetImage';

export type NodeKind = 'box' | 'terminal' | 'icon' | 'badge' | 'chips' | 'image' | 'checklist' | 'chatbox' | 'matrix' | 'character' | 'browser' | 'layer';
export type LayoutKind = 'pipeline' | 'pair' | 'grid' | 'tree' | 'stack' | 'stages';

export type Callout = {label: string; anchor: keyof typeof AGENT_BODY_ANCHORS; color?: string};

export type FlowNode = {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  kind?: NodeKind;
  lines?: string[]; // terminal
  error?: boolean; // terminal: chalky red X overlay + red glow
  icon?: IconName; // icon kind
  callouts?: Callout[]; // icon kind (agent-body only): progressive labeled leader lines to body parts
  chips?: string[]; // chips kind
  src?: string; // image kind: filename inside public/assets/
  items?: string[]; // checklist kind
  activeIndex?: number; // checklist kind: which item is highlighted
  icons?: IconName[]; // checklist kind: optional icon per item, same order as items
  stage?: number; // layout: 'stages' only — which vertical stage/column (0-indexed) this node belongs to
  logos?: {label: string; color: string; src?: string}[]; // layer kind: small badge row inside the layer
  rows?: string[]; // matrix kind: pre-formatted monospace lines, revealed one at a time
  shape?: ShapePrimitive[]; // icon kind, only when icon === 'custom': hand-composed drawing primitives
  caption?: string; // matrix kind: small caption below the rows (e.g. "× 96 layers")
  // Scene-relative frame this node should reveal on, precomputed by
  // plan_scenes.py from the real timestamp of whichever word the planner
  // pointed at ("wordIndex" — resolved before this ever reaches the app, so
  // it never appears here). When absent (hand-authored data, e.g.
  // scenes.sample.json), the node falls back to the even-spread guess
  // computeRevealFrames() below produces, same as before this existed.
  revealFrame?: number;
};

export type FlowEdge = {
  from: string;
  to: string;
  bidirectional?: boolean;
  label?: string;
  color?: string;
  animated?: boolean; // comet-trail dot travelling repeatedly along the curve
  // Instead of a plain dot, animate one of these icons flying along the
  // curve — use when the narration names a specific transport/action verb
  // (sends, launches, notifies) so the motion actually depicts that action.
  travelIcon?: 'rocket' | 'mail' | 'lightning' | 'chat';
};

type Rect = {x: number; y: number; w: number; h: number};

// A recurring illustrated host, composed at the SCENE level (as opposed to
// the "character" node kind, which places one inline among the diagram's
// nodes). This reserves a strip on one side of the frame for her full
// height, and shrinks the diagram's own layout into the remaining width —
// this is what produces the "she's standing next to the diagram, explaining
// it" look instead of squeezing her into the grid as just another box.
//
// No image asset is required: omit "src" entirely and she's drawn
// procedurally by HostCharacter.tsx instead, picking a pose from "pose"
// (falling back to the same "neutral/laptop vs explaining" automatic logic
// as before, just choosing a drawn pose instead of an image filename). If
// "src" IS given (a real asset the user dropped into public/assets/), that
// takes priority and renders exactly as before — this only adds a
// no-asset-needed fallback, it doesn't remove the asset-based path.
export type SceneCharacter = {
  src?: string; // optional real pose image, e.g. "host-laptop.png" — takes priority over the drawn fallback when given
  focusSrc?: string; // pose to switch to once the scene actually has a diagram to explain — falls back to `src` if omitted
  pose?: 'laptop' | 'explain' | 'neutral'; // base pose for the drawn fallback when no "src" is given
  focusPose?: 'laptop' | 'explain' | 'neutral'; // pose to switch to once there's a diagram to explain; defaults to "explain"
  color?: string; // accent/shirt color for the drawn fallback — defaults to a theme color
  position?: 'left' | 'right'; // which side of the frame she stands on; default 'right'
};

// ---- Layout engine -------------------------------------------------------
const TOP_MARGIN_WITH_TITLE = 16;
const TOP_MARGIN_NO_TITLE = 8;
const BOTTOM_MARGIN = 8;

function pipelineLayout(count: number, top: number, bottom: number): Rect[] {
  const usable = bottom - top;
  const gap = 3;
  const maxH = 20;
  const itemH = Math.min((usable - gap * (count - 1)) / count, maxH);
  const totalStack = itemH * count + gap * (count - 1);
  const startY = top + Math.max(0, (usable - totalStack) / 2);
  const w = 76;
  const x = (100 - w) / 2;
  return Array.from({length: count}, (_, i) => ({x, y: startY + i * (itemH + gap), w, h: itemH}));
}

function pairLayout(top: number, bottom: number): Rect[] {
  const usable = bottom - top;
  const h = Math.min(usable * 0.55, 26);
  const y = top + (usable - h) / 2;
  const gap = 6;
  const w = (84 - gap) / 2;
  const startX = (100 - (w * 2 + gap)) / 2;
  return [0, 1].map((i) => ({x: startX + i * (w + gap), y, w, h}));
}

function gridLayout(count: number, top: number, bottom: number): Rect[] {
  const cols = count <= 2 ? count : 2;
  const rows = Math.ceil(count / cols);
  const gap = 5;
  const usable = bottom - top;
  const cellW = (84 - gap * (cols - 1)) / cols;
  const cellH = Math.min((usable - gap * (rows - 1)) / rows, 22);
  const totalGridH = cellH * rows + gap * (rows - 1);
  const startY = top + Math.max(0, (usable - totalGridH) / 2);
  const startX = (100 - (cellW * cols + gap * (cols - 1))) / 2;
  return Array.from({length: count}, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return {x: startX + c * (cellW + gap), y: startY + r * (cellH + gap), w: cellW, h: cellH};
  });
}

function treeLayout(count: number, top: number, bottom: number, rootPosition: 'top' | 'bottom'): Rect[] {
  const rootH = 16;
  const rootW = 40;
  const childCount = count - 1;
  const childH = 18;
  const gap = 4;
  const childW = childCount > 0 ? (84 - gap * Math.max(0, childCount - 1)) / childCount : 40;
  const childStartX = (100 - (childW * childCount + gap * Math.max(0, childCount - 1))) / 2;
  const rootX = (100 - rootW) / 2;
  const positions: Rect[] = new Array(count);
  if (rootPosition === 'bottom') {
    const childY = top;
    const rootY = bottom - rootH;
    positions[0] = {x: rootX, y: rootY, w: rootW, h: rootH};
    for (let i = 0; i < childCount; i++) {
      positions[i + 1] = {x: childStartX + i * (childW + gap), y: childY, w: childW, h: childH};
    }
  } else {
    const rootY = top;
    const childY = top + rootH + 10;
    positions[0] = {x: rootX, y: rootY, w: rootW, h: rootH};
    for (let i = 0; i < childCount; i++) {
      positions[i + 1] = {x: childStartX + i * (childW + gap), y: childY, w: childW, h: childH};
    }
  }
  return positions;
}

function computeLayout(
  layout: LayoutKind,
  count: number,
  hasTitle: boolean,
  rootPosition: 'top' | 'bottom'
): Rect[] {
  const top = hasTitle ? TOP_MARGIN_WITH_TITLE : TOP_MARGIN_NO_TITLE;
  const bottom = 100 - BOTTOM_MARGIN;

  let effective = layout;
  if (effective === 'pair' && count !== 2) effective = 'pipeline';
  if (effective === 'tree' && count < 2) effective = 'pipeline';
  if (count === 0) return [];

  switch (effective) {
    case 'pair':
      return pairLayout(top, bottom);
    case 'grid':
      return gridLayout(count, top, bottom);
    case 'tree':
      return treeLayout(count, top, bottom, rootPosition);
    case 'stack':
      return stackLayout(count, top, bottom);
    case 'pipeline':
    default:
      return pipelineLayout(count, top, bottom);
  }
}

// Trapezoid "platform layer" slabs, stacked top to bottom, each one wider
// than the last — the visual the model reaches for when narration describes
// something as "layers" (UI on top of a platform on top of infrastructure,
// etc). The actual trapezoid clipping happens in the renderer; this just
// computes safe, non-overlapping bounding boxes, progressively wider.
function stackLayout(count: number, top: number, bottom: number): Rect[] {
  const gap = 5;
  const itemH = Math.min((bottom - top - gap * (count - 1)) / count, 22);
  const totalH = itemH * count + gap * (count - 1);
  const startY = top + Math.max(0, (bottom - top - totalH) / 2);
  return Array.from({length: count}, (_, i) => {
    const w = count <= 1 ? 70 : 55 + (i / (count - 1)) * 35; // 55% -> 90%
    const x = (100 - w) / 2;
    return {x, y: startY + i * (itemH + gap), w, h: itemH};
  });
}

// Branching/converging workflow diagram (a proper small DAG, not just a
// tree): nodes declare which vertical "stage" (0, 1, 2, ...) they belong
// to, and this arranges each stage as an evenly-spaced row, stages stacked
// top to bottom. Edges (drawn separately, unaffected by this function) can
// then fan out from one stage to several nodes in the next, or converge
// from several nodes into one — the layout itself stays 100% safe and
// non-overlapping regardless of how the edges connect.
function stagesLayout(stages: number[], top: number, bottom: number): Rect[] {
  const count = stages.length;
  const maxStage = Math.max(0, ...stages);
  const numStages = maxStage + 1;
  const bandH = (bottom - top) / numStages;
  const positions: Rect[] = new Array(count);
  for (let s = 0; s <= maxStage; s++) {
    const idxs: number[] = [];
    stages.forEach((st, i) => {
      if (st === s) idxs.push(i);
    });
    const n = idxs.length;
    if (n === 0) continue;
    const itemH = Math.min(bandH - 6, 20);
    const rowY = top + s * bandH + (bandH - itemH) / 2;
    const gap = 5;
    const itemW = Math.min((84 - gap * (n - 1)) / n, 34);
    const totalW = itemW * n + gap * (n - 1);
    const startX = (100 - totalW) / 2;
    idxs.forEach((idx, k) => {
      positions[idx] = {x: startX + k * (itemW + gap), y: rowY, w: itemW, h: itemH};
    });
  }
  return positions;
}

// ---- Reveal choreography --------------------------------------------------
const REVEAL_START = 6;
function computeRevealFrames(count: number, durationInFrames: number): number[] {
  if (count === 0) return [];
  const usable = Math.max(durationInFrames * 0.75, count * 18);
  const gap = usable / count;
  return Array.from({length: count}, (_, i) => Math.round(REVEAL_START + i * gap));
}

const pct = (v: number, total: number) => (v / 100) * total;

// Quadratic bezier helpers for the curved, swoopier arrows.
type Pt = {x: number; y: number};
function curveControlPoint(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const curveAmount = Math.min(dist * 0.22, 90);
  const nx = -dy / dist;
  const ny = dx / dist;
  return {x: (a.x + b.x) / 2 + nx * curveAmount, y: (a.y + b.y) / 2 + ny * curveAmount};
}
function bezierPoint(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
  };
}

export const FlowScene: React.FC<{
  title?: string;
  layout?: LayoutKind;
  rootPosition?: 'top' | 'bottom';
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  character?: SceneCharacter;
  durationInFrames?: number;
  sceneIndex?: number;
}> = ({
  title,
  layout = 'pipeline',
  rootPosition = 'top',
  nodes,
  edges,
  character,
  durationInFrames = 150,
  sceneIndex = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  // Defensive: the LLM occasionally emits "edges": null or drops "nodes"
  // entirely instead of an empty array. Default params only catch
  // `undefined`, not `null`, so this covers both — a scene should degrade
  // to "show nothing extra" rather than crash the whole render.
  const safeNodes = nodes ?? [];
  const safeEdges = edges ?? [];

  const top = Boolean(title) ? TOP_MARGIN_WITH_TITLE : TOP_MARGIN_NO_TITLE;
  const bottom = 100 - BOTTOM_MARGIN;
  const rects =
    layout === 'stages'
      ? stagesLayout(safeNodes.map((n) => n.stage ?? 0), top, bottom)
      : computeLayout(layout, safeNodes.length, Boolean(title), rootPosition);
  const placed = safeNodes.map((n, i) => ({...n, ...rects[i]}));
  const nodeById = Object.fromEntries(placed.map((n) => [n.id, n]));

  // Prefer each node's own word-anchored revealFrame (real narration timing,
  // precomputed in plan_scenes.py) over the even-spread guess — a node
  // without one (hand-authored sample data, or the rare node the planner
  // couldn't anchor to a word) still gets the guess, so nothing is ever
  // left without a reveal time.
  const guessedReveals = computeRevealFrames(placed.length, durationInFrames);
  const revealFrames = placed.map((n, i) =>
    typeof n.revealFrame === 'number'
      ? Math.max(0, Math.min(n.revealFrame, durationInFrames - 1))
      : guessedReveals[i]
  );
  const focusIndex = revealFrames.reduce((acc, rf, i) => (frame >= rf ? i : acc), -1);

  // When a scene-level character is present, she takes a fixed strip on one
  // side of the frame and the diagram's own 0-100 coordinate space (from the
  // layout engine above, untouched) gets remapped into whatever's left —
  // this is the only place that remapping happens, so every node kind and
  // the edge/SVG math below automatically respects it for free.
  const charPosition = character?.position ?? 'right';
  const diagramInsetPct = character ? 30 : 0;
  const diagramLeftPct = character && charPosition === 'left' ? diagramInsetPct : 0;
  const diagramWidthPct = 100 - diagramInsetPct;
  const mapX = (x: number) => diagramLeftPct + (x / 100) * diagramWidthPct;
  const mapW = (w: number) => (w / 100) * diagramWidthPct;

  const centerOf = (n: (typeof placed)[number]) => ({
    x: pct(mapX(n.x + n.w / 2), width),
    y: pct(n.y + n.h / 2, height),
  });

  const pulse = (Math.sin(frame / 18) + 1) / 2; // 0..1
  const kenBurns = useKenBurns(durationInFrames, sceneIndex);

  // Once there's an actual diagram to explain, she switches to her
  // explaining/pointing pose instead of her base one — fully automatic, no
  // extra planner field needed to trigger it. Real image asset ("src")
  // takes priority when given; otherwise she's drawn procedurally by
  // HostCharacter (no asset required at all).
  const isExplaining = safeNodes.length > 0;
  const activeCharacterSrc = character ? (isExplaining ? character.focusSrc ?? character.src : character.src) : undefined;
  const activeCharacterPose = character && !activeCharacterSrc
    ? isExplaining
      ? character.focusPose ?? 'explain'
      : character.pose ?? 'neutral'
    : undefined;

  const focusedNode = focusIndex >= 0 ? placed[focusIndex] : undefined;
  const focusedCenter = focusedNode ? centerOf(focusedNode) : undefined;
  const focusedReveal = focusIndex >= 0 ? revealFrames[focusIndex] ?? 0 : 0;

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: theme.bg,
      }}
    >
      <SceneBackground seed={sceneIndex} />
      <div style={{position: 'absolute', inset: 0, ...kenBurns}}>
      {/* A soft glow that blooms in behind whichever node currently has
          focus — reinforces where attention is without adding clutter; it
          reappears fresh at each new focus point the same way the node's
          own glow boost does. */}
      {focusedCenter ? (
        <div
          style={{
            position: 'absolute',
            left: focusedCenter.x - pct(26, width),
            top: focusedCenter.y - pct(26, width),
            width: pct(52, width),
            height: pct(52, width),
            borderRadius: '50%',
            background: `radial-gradient(circle, ${focusedNode!.color}22, transparent 72%)`,
            opacity: interpolate(frame, [focusedReveal, focusedReveal + 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {title ? (
        <div
          style={{
            position: 'absolute',
            top: pct(6, height),
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: theme.fontFamily,
            fontWeight: 700,
            fontSize: 50,
            color: theme.colors.blue,
            textShadow: theme.glow(theme.colors.blue, 12),
            opacity: interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          {title}
        </div>
      ) : null}

      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{position: 'absolute', top: 0, left: 0}}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
          </marker>
          <marker id="arrowhead-start" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
          </marker>
        </defs>
        {safeEdges.map((e, i) => {
          const from = nodeById[e.from];
          const to = nodeById[e.to];
          if (!from || !to) return null;
          const fromIdx = placed.findIndex((n) => n.id === e.from);
          const toIdx = placed.findIndex((n) => n.id === e.to);
          const orderIndex = Math.max(fromIdx, toIdx);
          const delay = (revealFrames[orderIndex] ?? 0) + 8;
          const op = interpolate(frame, [delay, delay + 10], [0, 1], {extrapolateRight: 'clamp'});
          // Once focus has moved past BOTH endpoints, fade this connection
          // into the background instead of leaving it fully bright forever
          // — this is what keeps a scene with many arrows from turning into
          // visual noise as more of them accumulate.
          const edgeSettled = fromIdx < focusIndex && toIdx < focusIndex;
          const edgeFade = edgeSettled
            ? interpolate(frame, [revealFrames[focusIndex] ?? frame, (revealFrames[focusIndex] ?? frame) + 15], [1, 0.25], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : 1;
          const a = centerOf(from);
          const b = centerOf(to);
          const c = curveControlPoint(a, b);
          const color = e.color ?? theme.colors.gray;
          const pathD = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;

          const loop = 55;
          const active = e.animated && frame >= delay;
          const t = active ? ((frame - delay) % loop) / loop : 0;
          const trail = [0, -0.06, -0.12, -0.18].map((offset) => {
            const tt = ((t + offset) % 1 + 1) % 1;
            const p = bezierPoint(a, c, b, tt);
            return {...p, o: offset === 0 ? 1 : 0.45 + offset * 2};
          });
          const mid = bezierPoint(a, c, b, 0.5);
          const TravelIcon = e.travelIcon ? IconByName[e.travelIcon] : null;
          let travelAngle = 0;
          if (TravelIcon && active) {
            const ahead = bezierPoint(a, c, b, Math.min(1, t + 0.02));
            travelAngle = (Math.atan2(ahead.y - trail[0].y, ahead.x - trail[0].x) * 180) / Math.PI;
          }

          return (
            <g key={i} opacity={op * edgeFade}>
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={3}
                markerEnd="url(#arrowhead)"
                markerStart={e.bidirectional ? 'url(#arrowhead-start)' : undefined}
                style={{filter: `drop-shadow(0 0 4px ${color}aa)`}}
              />
              {active
                ? TravelIcon
                  ? (
                      <g transform={`translate(${trail[0].x}, ${trail[0].y}) rotate(${travelAngle})`}>
                        <g transform="translate(-15, -15)" style={{filter: `drop-shadow(0 0 6px ${color}cc)`}}>
                          <TravelIcon color={color} size={30} />
                        </g>
                      </g>
                    )
                  : trail.map((d, di) => (
                      <circle key={di} cx={d.x} cy={d.y} r={di === 0 ? 7 : 5} fill={color} opacity={Math.max(0, d.o)} />
                    ))
                : null}
              {e.label ? (
                <text
                  x={mid.x}
                  y={mid.y - 6}
                  fill={color}
                  fontFamily={theme.fontFamily}
                  fontWeight={600}
                  fontSize={26}
                  textAnchor="middle"
                >
                  {e.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {placed.map((n, i) => {
        const delay = revealFrames[i] ?? 0;
        const s = spring({frame: frame - delay, fps, config: {damping: 12, stiffness: 160}});
        const bounceY = interpolate(s, [0, 1], [-18, 0]);
        const op = interpolate(frame, [delay, delay + 8], [0, 1], {extrapolateRight: 'clamp'});
        const glowColor = n.error ? theme.colors.red : n.color;

        const isFocused = i === focusIndex;
        const isSettled = i < focusIndex;
        const framesSinceReveal = frame - delay;
        const boost = isFocused ? interpolate(framesSinceReveal, [0, 20], [10, 0], {extrapolateRight: 'clamp'}) : 0;
        const restingGlow = 14 + pulse * 8;
        const glowSize = isSettled ? restingGlow * 0.55 : restingGlow + boost;
        // Not just dimmer glow — fade the whole node once focus has moved
        // past it, so the screen doesn't stay cluttered with everything at
        // full brightness. Settling eases in over ~15 frames so it reads as
        // an intentional recede, not a pop.
        const settleStart = focusIndex >= 0 ? revealFrames[focusIndex] ?? frame : frame;
        const settleT = isSettled
          ? interpolate(frame, [settleStart, settleStart + 15], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 0;
        const settleFade = 1 - settleT * 0.6; // 1 -> 0.4
        const settleBlurPx = settleT * 2.5; // a real depth-of-field blur, not just dimming
        const finalOpacity = op * settleFade;
        // A tiny idle bob on whatever currently has focus, so it doesn't go
        // completely static the moment its entrance spring settles.
        const breathe = isFocused ? Math.sin(frame / 14) * 1.5 : 0;

        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: pct(mapX(n.x), width),
          top: pct(n.y, height),
          width: pct(mapW(n.w), width),
          height: pct(n.h, height),
          opacity: finalOpacity,
          filter: settleBlurPx > 0.05 ? `blur(${settleBlurPx}px)` : undefined,
          transform: `translateY(${bounceY + breathe}px) scale(${s})`,
        };

        if (n.kind === 'terminal') {
          const showCursor = Math.floor(frame / 15) % 2 === 0;
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                backgroundColor: '#0c0c14',
                borderRadius: 16,
                border: `3px solid ${glowColor}`,
                boxShadow: theme.glow(glowColor, glowSize),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                padding: 20,
              }}
            >
              <div style={{display: 'flex', gap: 8, marginBottom: 10}}>
                {['#ff3b5c', '#ffb347', '#39ff88'].map((c) => (
                  <div key={c} style={{width: 12, height: 12, borderRadius: 6, backgroundColor: c}} />
                ))}
              </div>
              {(n.lines ?? []).map((line, li) => (
                <div
                  key={li}
                  style={{
                    fontFamily: 'Consolas, monospace',
                    fontSize: 22,
                    color: line.trim().startsWith('x') ? theme.colors.red : theme.colors.white,
                  }}
                >
                  {line}
                  {li === (n.lines ?? []).length - 1 && showCursor ? '▌' : ''}
                </div>
              ))}
              {n.error ? (
                <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <ChalkyErrorMark frame={frame - delay} />
                </div>
              ) : null}
            </div>
          );
        }

        if (n.kind === 'icon') {
          const Icon = IconByName[n.icon ?? 'brain'];
          const size = Math.min(pct(n.w, width), pct(n.h, height)) * 0.55;
          const DRAW_DURATION = 24; // frames spent "sketching" the icon in
          const drawProgress = interpolate(frame, [delay, delay + DRAW_DURATION], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          // Icon circle occupies roughly the top 75% of the node box, sized
          // and centered horizontally — used below to place callouts.
          const circleBoxLeft = pct(n.x + n.w * 0.2, width);
          const circleBoxTop = pct(n.y, height);
          const circleBoxW = pct(n.w * 0.6, width);
          const circleBoxH = pct(n.h * 0.75, height);

          // For the labeled body diagram: work out each callout's reveal
          // frame up front, then drive the icon itself so each limb only
          // sketches in live at the exact moment it's named — not all at
          // once with the rest of the body.
          const calloutDelays: Partial<Record<string, number>> = {};
          n.callouts?.forEach((c, ci) => {
            calloutDelays[c.anchor] = delay + DRAW_DURATION + 4 + ci * 20;
          });
          const partProgressAt = (anchor: string) => {
            const d = calloutDelays[anchor];
            if (d === undefined) return 0; // never named -> never drawn
            return interpolate(frame, [d, d + DRAW_DURATION], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
          };
          const partProgress =
            n.icon === 'agent-body' && n.callouts
              ? {
                  head: drawProgress,
                  handLeft: partProgressAt('handLeft'),
                  handRight: partProgressAt('handRight'),
                  legLeft: partProgressAt('legLeft'),
                  legRight: partProgressAt('legRight'),
                }
              : undefined;

          return (
            <React.Fragment key={n.id}>
              <div
                style={{
                  ...baseStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: size * 1.5,
                    height: size * 1.5,
                    borderRadius: '50%',
                    border: `3px solid ${n.color}`,
                    boxShadow: theme.glow(n.color, glowSize + 4),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.04), transparent)',
                  }}
                >
                  <Icon color={n.color} size={size} progress={drawProgress} partProgress={partProgress} shape={n.shape} />
                </div>
                <div style={{fontFamily: theme.fontFamily, fontWeight: 700, fontSize: 26, color: theme.colors.white}}>
                  {n.label}
                </div>
              </div>
              {n.icon === 'agent-body' && n.callouts
                ? n.callouts.map((callout, ci) => {
                    const anchor = AGENT_BODY_ANCHORS[callout.anchor];
                    if (!anchor) return null;
                    const calloutDelay = calloutDelays[callout.anchor] ?? delay;
                    const cOp = interpolate(frame, [calloutDelay, calloutDelay + 8], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    });
                    const ax = circleBoxLeft + (anchor.x / 100) * circleBoxW;
                    const ay = circleBoxTop + (anchor.y / 100) * circleBoxH;
                    const side = ax < circleBoxLeft + circleBoxW / 2 ? -1 : 1;
                    const labelX = ax + side * 55;
                    const color = callout.color ?? n.color;
                    return (
                      <svg
                        key={ci}
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${width} ${height}`}
                        style={{position: 'absolute', top: 0, left: 0, opacity: cOp, pointerEvents: 'none'}}
                      >
                        <line x1={ax} y1={ay} x2={labelX} y2={ay} stroke={color} strokeWidth={2} />
                        <circle cx={ax} cy={ay} r={4} fill={color} />
                        <text
                          x={labelX + side * 4}
                          y={ay + 6}
                          fill={color}
                          fontFamily={theme.fontFamily}
                          fontWeight={700}
                          fontSize={20}
                          textAnchor={side === 1 ? 'start' : 'end'}
                        >
                          {callout.label}
                        </text>
                      </svg>
                    );
                  })
                : null}
            </React.Fragment>
          );
        }

        if (n.kind === 'badge') {
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                borderRadius: 999,
                border: `3px solid ${n.color}`,
                boxShadow: theme.glow(n.color, glowSize),
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: theme.fontFamily,
                  fontWeight: 800,
                  fontSize: 30,
                  color: n.color,
                  textShadow: theme.glow(n.color, 8),
                }}
              >
                {n.label}
              </div>
            </div>
          );
        }

        if (n.kind === 'chips') {
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                borderRadius: 16,
                border: `3px solid ${n.color}`,
                boxShadow: theme.glow(n.color, glowSize),
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 10,
              }}
            >
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center'}}>
                {(n.chips ?? []).map((chip, ci) => (
                  <div
                    key={ci}
                    style={{
                      fontFamily: 'Consolas, monospace',
                      fontSize: 20,
                      color: theme.colors.white,
                      border: `2px solid ${n.color}`,
                      borderRadius: 8,
                      padding: '4px 10px',
                      opacity: interpolate(frame, [delay + ci * 3, delay + ci * 3 + 6], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      }),
                    }}
                  >
                    {chip}
                  </div>
                ))}
              </div>
              {n.label ? (
                <div style={{fontFamily: theme.fontFamily, fontWeight: 600, fontSize: 20, color: n.color}}>
                  {n.label}
                </div>
              ) : null}
            </div>
          );
        }

        if (n.kind === 'checklist') {
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                borderRadius: 16,
                border: `3px solid ${n.color}`,
                boxShadow: theme.glow(n.color, glowSize),
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                flexDirection: 'column',
                padding: 14,
                gap: 6,
                overflow: 'hidden',
              }}
            >
              {n.label ? (
                <div style={{fontFamily: theme.fontFamily, fontWeight: 700, fontSize: 20, color: n.color, marginBottom: 2}}>
                  {n.label}
                </div>
              ) : null}
              {(n.items ?? []).map((item, ii) => {
                const isActive = ii === n.activeIndex;
                const ItemIcon = n.icons?.[ii] ? IconByName[n.icons[ii]] : null;
                return (
                  <div
                    key={ii}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'Consolas, monospace',
                      fontSize: 20,
                      padding: '4px 10px',
                      borderRadius: 8,
                      color: isActive ? theme.bg : theme.colors.white,
                      background: isActive ? n.color : 'transparent',
                      fontWeight: isActive ? 700 : 400,
                      opacity: interpolate(frame, [delay + ii * 4, delay + ii * 4 + 6], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      }),
                    }}
                  >
                    {ItemIcon ? <ItemIcon color={isActive ? theme.bg : n.color} size={18} /> : null}
                    {item}
                  </div>
                );
              })}
            </div>
          );
        }

        if (n.kind === 'layer') {
          const inset = 10; // percent inset on the top edge -> trapezoid
          return (
            <div key={n.id} style={baseStyle}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  clipPath: `polygon(${inset}% 0%, ${100 - inset}% 0%, 100% 100%, 0% 100%)`,
                  border: `2px solid ${n.color}`,
                  boxShadow: theme.glow(n.color, glowSize),
                  background: 'rgba(255,255,255,0.04)',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '4px 12%',
                }}
              >
                {n.logos && n.logos.length ? (
                  <div style={{display: 'flex', gap: 8, justifyContent: 'center'}}>
                    {n.logos.map((logo, li) => (
                      <div
                        key={li}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: `2px solid ${logo.color}`,
                          boxShadow: theme.glow(logo.color, 10),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.05)',
                          opacity: interpolate(frame, [delay + li * 4, delay + li * 4 + 8], [0, 1], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                          }),
                        }}
                      >
                        {logo.src ? (
                          <AssetImage filename={logo.src} style={{maxWidth: '80%', maxHeight: '80%', objectFit: 'contain'}} />
                        ) : (
                          <span style={{color: logo.color, fontWeight: 800, fontSize: 15}}>{logo.label[0]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div
                  style={{
                    fontFamily: theme.fontFamily,
                    fontWeight: 800,
                    fontSize: 22,
                    color: n.color,
                    textAlign: 'center',
                    textShadow: theme.glow(n.color, 6),
                  }}
                >
                  {n.label}
                </div>
              </div>
            </div>
          );
        }

        if (n.kind === 'browser') {
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                borderRadius: 16,
                border: `3px solid ${n.color}`,
                boxShadow: theme.glow(n.color, glowSize),
                background: '#0c0c14',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderBottom: `1px solid ${n.color}55`,
                }}
              >
                {['#ff3b5c', '#ffb347', '#39ff88'].map((c) => (
                  <div key={c} style={{width: 10, height: 10, borderRadius: 5, background: c}} />
                ))}
                <div style={{flex: 1, height: 14, marginLeft: 10, borderRadius: 7, background: 'rgba(255,255,255,0.06)'}} />
              </div>
              <div style={{padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8}}>
                {n.label ? (
                  <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <span style={{color: n.color, fontFamily: 'Consolas, monospace', fontWeight: 700}}>{'>'}</span>
                    <span style={{color: theme.colors.white, fontFamily: 'Consolas, monospace', fontSize: 20}}>
                      {n.label}
                    </span>
                  </div>
                ) : null}
                {(n.lines ?? []).map((line, li) => (
                  <div
                    key={li}
                    style={{
                      height: 6,
                      width: `${Math.max(20, 60 - li * 10)}%`,
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.15)',
                      opacity: interpolate(frame, [delay + 12 + li * 4, delay + 12 + li * 4 + 8], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      }),
                    }}
                  />
                ))}
              </div>
            </div>
          );
        }

        if (n.kind === 'chatbox') {
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                borderRadius: 999,
                border: `3px solid ${n.color}`,
                boxShadow: theme.glow(n.color, glowSize),
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 10px 0 22px',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: theme.fontFamily,
                  fontWeight: 600,
                  fontSize: 24,
                  color: theme.colors.white,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {n.label}
              </div>
              <div
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: n.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 900,
                  color: theme.bg,
                }}
              >
                ↑
              </div>
            </div>
          );
        }

        if (n.kind === 'matrix') {
          const rows = n.rows ?? [];
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                borderRadius: 16,
                border: `3px solid ${n.color}`,
                boxShadow: theme.glow(n.color, glowSize),
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 14,
                gap: 4,
                overflow: 'hidden',
              }}
            >
              {n.label ? (
                <div
                  style={{
                    fontFamily: theme.fontFamily,
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: 1,
                    color: n.color,
                    marginBottom: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {n.label}
                </div>
              ) : null}
              {rows.map((row, ri) => (
                <div
                  key={ri}
                  style={{
                    fontFamily: 'Consolas, monospace',
                    fontSize: 18,
                    color: theme.colors.white,
                    whiteSpace: 'pre',
                    opacity: interpolate(frame, [delay + ri * 5, delay + ri * 5 + 8], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    }),
                  }}
                >
                  {row}
                </div>
              ))}
              {n.caption ? (
                <div
                  style={{
                    fontFamily: theme.fontFamily,
                    fontSize: 18,
                    color: n.color,
                    marginTop: 6,
                    opacity: interpolate(frame, [delay + rows.length * 5 + 6, delay + rows.length * 5 + 14], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    }),
                  }}
                >
                  {n.caption}
                </div>
              ) : null}
            </div>
          );
        }

        if (n.kind === 'character') {
          // A recurring illustrated character (the user's own asset), shown
          // as itself — no neon card frame, just a soft drop shadow so it
          // reads as an inserted illustration rather than a UI element.
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {n.src ? (
                <AssetImage
                  filename={n.src}
                  style={{
                    maxWidth: '100%',
                    maxHeight: n.label ? '82%' : '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.55))',
                  }}
                />
              ) : null}
              {n.label ? (
                <div
                  style={{
                    fontFamily: theme.fontFamily,
                    fontWeight: 600,
                    fontSize: 20,
                    color: n.color,
                    marginTop: 6,
                  }}
                >
                  {n.label}
                </div>
              ) : null}
            </div>
          );
        }

        if (n.kind === 'image') {
          return (
            <div
              key={n.id}
              style={{
                ...baseStyle,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: '70%',
                  height: '70%',
                  borderRadius: 20,
                  border: `3px solid ${n.color}`,
                  boxShadow: theme.glow(n.color, glowSize),
                  background: 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: 10,
                }}
              >
                {n.src ? (
                  <AssetImage filename={n.src} style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} />
                ) : null}
              </div>
              {n.label ? (
                <div style={{fontFamily: theme.fontFamily, fontWeight: 700, fontSize: 24, color: theme.colors.white}}>
                  {n.label}
                </div>
              ) : null}
            </div>
          );
        }

        // default: box
        const BoxIcon = n.icon ? IconByName[n.icon] : null;
        return (
          <div
            key={n.id}
            style={{
              ...baseStyle,
              borderRadius: 18,
              border: `3px solid ${n.color}`,
              boxShadow: theme.glow(n.color, glowSize),
              background: isFocused ? theme.tint(n.color, 0.22) : 'rgba(255,255,255,0.03)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              gap: 4,
            }}
          >
            {BoxIcon ? (
              <BoxIcon
                color={n.color}
                size={Math.min(pct(n.h, height) * 0.4, 34)}
                progress={interpolate(frame, [delay, delay + 24], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}
                shape={n.shape}
              />
            ) : null}
            <div style={{fontFamily: theme.fontFamily, fontWeight: 700, fontSize: 30, color: n.color}}>{n.label}</div>
            {n.sublabel ? (
              <div style={{fontFamily: theme.fontFamily, fontSize: 20, color: theme.colors.white, marginTop: 6}}>
                {n.sublabel}
              </div>
            ) : null}
          </div>
        );
      })}
      </div>

      {activeCharacterSrc || activeCharacterPose ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            [charPosition]: '2%',
            width: `${diagramInsetPct - 4}%`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            opacity: interpolate(frame, [4, 20], [0, 1], {extrapolateRight: 'clamp'}),
            transform: `translateX(${interpolate(frame, [0, 18], [charPosition === 'right' ? 30 : -30, 0], {
              extrapolateRight: 'clamp',
            })}px)`,
            pointerEvents: 'none',
          } as React.CSSProperties}
        >
          {activeCharacterSrc ? (
            <AssetImage
              filename={activeCharacterSrc}
              style={{maxWidth: '100%', maxHeight: '92%', objectFit: 'contain', filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.55))'}}
            />
          ) : (
            <div style={{width: '62%', maxHeight: '92%', filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.55))'}}>
              <HostCharacter pose={activeCharacterPose} color={character?.color} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

// A rougher, "chalk scribble" X with a couple of radiating spark ticks and a
// quick electrical shake on appearance — used for terminal error states.
const ChalkyErrorMark: React.FC<{frame: number}> = ({frame}) => {
  const shakeX = interpolate(frame, [0, 8, 16, 24], [0, -2, 2, 0], {extrapolateRight: 'clamp'}) + Math.sin(frame / 4) * 0.6;
  const shakeY = Math.cos(frame / 3.4) * 0.5;
  const pop = spring({frame, fps: 30, config: {damping: 10, stiffness: 180}});

  return (
    <svg
      width="60%"
      height="60%"
      viewBox="0 0 100 100"
      style={{transform: `translate(${shakeX}px, ${shakeY}px) scale(${pop})`}}
    >
      <circle cx="50" cy="50" r="42" fill="rgba(7,7,12,0.55)" stroke={theme.colors.red} strokeWidth={4} />
      {/* jittered double-stroke diagonals for a hand-drawn chalk feel */}
      <path
        d="M30 30 L42 40 L38 48 L50 50 L46 58 L70 70"
        stroke={theme.colors.red}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.9}
      />
      <path
        d="M70 30 L58 42 L62 48 L48 50 L52 58 L30 70"
        stroke={theme.colors.red}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.9}
      />
      {/* radiating spark ticks for a little "zap" energy */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 50 + Math.cos(rad) * 46;
        const y1 = 50 + Math.sin(rad) * 46;
        const x2 = 50 + Math.cos(rad) * 58;
        const y2 = 50 + Math.sin(rad) * 58;
        return (
          <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.colors.red} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        );
      })}
    </svg>
  );
};
