import {loadFont} from '@remotion/google-fonts/SpaceGrotesk';

const {fontFamily: spaceGrotesk} = loadFont();

export const theme = {
  bg: '#07070c',
  // A distinctive geometric tech font instead of a plain system sans —
  // bundled via @remotion/google-fonts (fetched once, cached locally by
  // Remotion; needs internet the first time you render).
  fontFamily: `${spaceGrotesk}, 'Segoe UI', -apple-system, sans-serif`,
  colors: {
    teal: '#2de2e6',
    orange: '#ffb347',
    coral: '#ff6ec7',
    blue: '#4d7cff',
    red: '#ff3b5c',
    green: '#39ff88',
    purple: '#b06bff',
    gray: '#9aa0ac',
    white: '#f5f7ff',
  },
  // Neon glow shadow for any box/text/icon of a given hex color.
  glow: (hex: string, size = 18) => `0 0 ${size}px ${hex}99, 0 0 ${size * 2}px ${hex}44`,
  // Translucent fill of a hex color, used to "bold" the node currently being
  // talked about (solid-ish tinted background instead of just an outline).
  tint: (hex: string, alpha = 0.2) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },
  // Faint dot-grid texture for scene backgrounds — cheap atmospheric depth,
  // subtle enough to never compete with foreground content.
  dotGrid:
    'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
  dotGridSize: '28px 28px',
};
