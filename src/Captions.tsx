import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {theme} from './theme';

type Word = {word: string; start: number; end: number};
type Chunk = {words: Word[]; start: number; end: number};

const MIN_DURATION = 1.6; // seconds — never show a chunk for less than this
const MAX_DURATION = 4.0; // seconds — force a break even mid-sentence
const MAX_WORDS = 12;
// Punctuation that marks a natural place to end a caption, across Latin and
// Persian/Arabic text.
const SENTENCE_END = /[.!?؟。]$/;
const CLAUSE_END = /[,،؛;]$/;

function buildChunks(words: Word[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Word[] = [];
  let start: number | null = null;

  const flush = (endTime: number) => {
    if (current.length === 0) return;
    chunks.push({words: current, start: start as number, end: endTime});
    current = [];
    start = null;
  };

  for (const w of words) {
    if (start === null) start = w.start;
    current.push(w);
    const duration = w.end - (start as number);
    const atSentenceEnd = SENTENCE_END.test(w.word);
    const atClauseEnd = CLAUSE_END.test(w.word);

    if (duration >= MAX_DURATION || current.length >= MAX_WORDS) {
      flush(w.end);
    } else if (atSentenceEnd && duration >= MIN_DURATION) {
      flush(w.end);
    } else if (atClauseEnd && duration >= MAX_DURATION * 0.6) {
      flush(w.end);
    }
  }
  flush(current.length ? current[current.length - 1].end : 0);

  // Extend each chunk's visible window up to the start of the next one (or
  // MIN_DURATION, whichever is later) so captions don't blink out during
  // natural pauses in speech — the point is readability, not precision.
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    const floor = chunks[i].start + MIN_DURATION;
    chunks[i].end = Math.max(floor, next ? next.start : chunks[i].end);
  }

  return chunks;
}

export const Captions: React.FC<{words: Word[]}> = ({words}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const chunks = useMemo(() => buildChunks(words), [words]);
  const active = chunks.find((c) => t >= c.start && t < c.end);
  if (!active) return null;

  const startFrame = active.start * fps;
  const endFrame = active.end * fps;
  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 6, endFrame - 6, endFrame],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 90px',
      }}
    >
      <div
        // "auto" infers the paragraph's base direction (RTL for Persian/
        // Arabic, LTR for Latin) from its own first strong-directional
        // character instead of inheriting a fixed direction from the page —
        // needed because a chunk can be pure Persian, pure English, or a mix
        // of both (English loanwords inside a Persian sentence). Without
        // this, mixed-direction text rendered as many separate <span>
        // siblings (one per word, for the karaoke highlight below) came out
        // visually reordered/jumbled instead of reading as one sentence.
        dir="auto"
        style={{
          fontFamily: theme.fontFamily,
          fontSize: 38,
          lineHeight: 1.4,
          textAlign: 'center',
          textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          opacity,
          background: 'rgba(7,7,12,0.55)',
          borderRadius: 16,
          padding: '14px 26px',
        }}
      >
        {/* The chunk itself never changes mid-sentence — only which word
            inside it is bold updates, in sync with the actual timestamp of
            that word. This is what gives a karaoke-style "currently being
            said" highlight without the whole caption flickering.

            Each word is its own <span> so it can be bolded independently,
            but the space BETWEEN words is a real text character (not a CSS
            margin) — the browser's bidi/line-breaking algorithm needs an
            actual space glyph in the text stream to correctly gap and order
            mixed Persian/English runs; a margin doesn't count as a
            character for that, which is what let words run together or
            reorder in mixed-language captions. */}
        {active.words.map((w, i) => {
          const isCurrent = t >= w.start && t < w.end;
          return (
            <React.Fragment key={i}>
              <span
                style={{
                  fontWeight: isCurrent ? 800 : 500,
                  color: isCurrent ? theme.colors.orange : theme.colors.white,
                  transition: 'none',
                }}
              >
                {w.word}
              </span>
              {i < active.words.length - 1 ? ' ' : ''}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
