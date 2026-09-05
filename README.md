# Voice → neon tech-explainer video

Put in a voice file (and ideally your exact script). Get out a vertical
video in a modern neon-glow explainer style (glowing boxes, icons, terminal
mockups, animated arrows), automatically the same length as your audio,
with readable synced captions.

## What's inside

```
src/
  theme.ts                  neon color palette, glow helper, font stack
  icons.tsx                 generic hand-drawn SVG icons (brain/person/warning) — not copied from any icon library
  scenes/TitleScene.tsx     big glowing title card
  scenes/CompareScene.tsx   row of labeled glowing circles (comparisons)
  scenes/FlowScene.tsx      the main diagram scene — see "layout engine" below
  Captions.tsx              phrase-level captions with fade in/out
  MainVideo.tsx             sequences the scenes + plays your audio
  Root.tsx                  Remotion composition, auto-sized to your audio's length
scripts/
  agent.ps1                 interactive menu (Windows): run / feedback / render / preview — start here
  align.py                  local, free speech-to-text with word timestamps (faster-whisper)
  inject_script.py          swap in your exact script text + correct caption words against it
  plan_scenes.py            the only paid step: asks an LLM to turn your narration into a storyboard
  run.sh                    non-interactive pipeline for macOS/Linux/Git Bash/WSL
  run.ps1                   non-interactive pipeline for Windows PowerShell
scenes.sample.json          example storyboard so you can preview without running anything
public/assets/              put your own logo/image files here (see "Round 3" below) — not tracked, add your own
remotion.config.ts          points Remotion at your system's Edge/Chrome (avoids a geo-blocked download)
```

## How it stays in sync (read this if you're curious how it works)

`plan_scenes.py` does NOT ask the AI to guess timing. Instead:
1. Your audio's real word timestamps are split into segments using the
   actual pause gaps between words (plain arithmetic, roughly 9-18 seconds
   each) — this is where topic boundaries naturally fall in real speech.
2. Each segment gets an exact on-screen duration computed directly from its
   own timestamps.
3. The AI's only job is choosing *what to show* for each segment's exact
   words — it never touches timing, which is what used to cause scenes to
   drift out of sync with the narration.

Captions are separate from this and phrase-based: `Captions.tsx` groups
words into readable chunks (breaking on punctuation and pause length, not
per word) so each caption stays on screen for a few seconds instead of
flickering. `inject_script.py` also cross-checks Whisper's recognized words
against your exact script text and swaps in your script's wording wherever
they confidently line up — this reduces caption typos, though voice and
script are never perfectly identical so it isn't 100%.

## The layout engine (why boxes can't overlap or spill off-frame)

Flow-scene nodes (`src/scenes/FlowScene.tsx`) carry **no coordinates**. The
AI picks a `layout` — `pipeline` (vertical sequence), `pair` (2 side by
side), `grid` (3+ items), or `tree` (one root + several children) — and a
pure function computes safe, evenly-spaced, non-overlapping positions for
however many nodes there are. This makes "boxes overlapping" or "boxes
spilling off-frame" structurally impossible, rather than just discouraged
in a prompt.

Node kinds: `box` (label + optional sublabel), `terminal` (fake terminal
lines; `"error": true` draws a red X over it), `icon` (glowing circular
icon — brain/person/warning), `badge` (a colored glowing pill for naming a
specific tool/company — deliberately **not** a real logo; reproducing
trademarked logo artwork isn't something this project does). Edges can be
`"animated": true` for a comet-trail dot representing continuous/repeated
action (e.g. "sending requests").

## Round 3: fewer jarring cuts, richer reveals, your own logos

More feedback, more fixes:

- **Scenes last longer (10-20s) but reveal progressively.** Nodes used to
  all appear within the first second of a scene, then the whole scene got
  replaced by a completely different layout every few seconds — jarring.
  Now each scene's nodes reveal one at a time, spaced across the *entire*
  scene duration (computed from real timing, not a fixed gap), so a 15s
  scene with 4 nodes reveals roughly one every ~3-4 seconds — closer to how
  the reference video adds detail continuously. The most recently revealed
  node gets a brief glow boost; older ones settle to a dimmer (but still
  visible) glow so focus keeps moving forward without anything vanishing.
- **A concrete worked example is now baked into the prompt** showing the
  exact density and per-relationship edge-coloring style from your
  reference screenshot (person → agent ↔ model → failing terminal → red
  error edge back to the model), so the planner has a real template to
  match instead of a vague instruction.
- **New node kinds**: `chips` (a row of small pill labels — for tokens,
  steps, tags — instead of one bare box per tiny item) and `image` (see
  below).
- **Your own logo images**: drop image files into `public/assets/` (e.g.
  `public/assets/claude.png`) and the planner will list them as available
  and can reference one by filename in an `image` node. This project still
  never fetches or reproduces a real company logo itself — that stays
  copyright-safe by only ever using files *you* put there yourself.

On the "should we use a different/open-source model" question: the visual
polish (glow, motion, layout) comes entirely from this project's own React
components — the LLM only ever outputs a JSON plan of which components to
use and what text goes in them. A different text model can make better
*choices* (which is what the worked example above is aimed at), but it
can't draw better boxes than the code does — that lever is `src/scenes/`,
not `OPENAI_MODEL`.

## Round 4: curved arrows, body-part callouts, highlighted checklists

- **Curved arrows** instead of straight lines (quadratic bezier), now with a
  soft neon glow (drop-shadow matching the edge's color) — closer to the
  swoopy, glowing error-arrow look in the reference video. Animated edges'
  comet trail follows the curve too.
- **New `agent-body` icon with `callouts`**: a simple stick figure whose
  hands/head/legs get labeled one at a time with a leader line (e.g. "Hands:
  tools", "Head: thinking") — for when a segment describes an agent's
  distinct capabilities, matching the human-body metaphor from the reference.
- **New `checklist` kind**: a bordered list of short items with one
  `activeIndex` highlighted — for "here's the specific tool/option being
  used right now out of a known set" moments.
- **Chalky/"magic" error mark**: the terminal error X is no longer a plain
  geometric X — it's a rougher double-stroke scribble with small radiating
  spark ticks and a brief shake on appearing.
- **A more distinctive font** (Space Grotesk via `@remotion/google-fonts`)
  instead of a plain system sans.
- **Subtle dot-grid background texture** on every flow scene for a bit more
  depth without competing with the foreground content.

## Round 5: works for any topic, not just AI, and less "boxy"

Two important questions this round: were the visuals AI-specific, and why
did it still feel like a rigid falling column of boxes?

- **The icon library is now general-purpose.** It used to be 4 icons, all
  AI/agent-flavored (brain, person, warning, agent-body). It's now ~20
  icons — house, car, money, cloud, database, lock, shield, globe, chart,
  network, rocket, and more — so a video about literally any topic (not just
  AI) gets fitting visuals instead of generic text boxes. The prompt now
  includes a second full worked example on a completely different topic
  (a smart-lock/security scenario) specifically to prove this generalizes.
- **`box` nodes can now carry an icon too** (a small glyph above the label),
  matching the reference's AGENT/MODEL boxes which had both a shape and
  text, not just text.
- **The currently-focused box gets a tinted, semi-solid fill**, not just a
  brighter outline — closer to how the reference visibly "bolds" whatever
  box is currently being talked about.
- **The prompt now actively discourages defaulting to `pipeline`** (the
  plain top-to-bottom stack) and pushes toward `tree`/`grid` instead, which
  read as an actual designed diagram rather than a list of boxes.

What's still not built: a from-scratch illustration generator (the reference
occasionally draws something bespoke that doesn't map to a known icon). The
icon-based approach covers a wide, growing set of common concepts, but it's
still a fixed library, not arbitrary generative art — expanding that further
would mean building more hand-drawn icons over time, or a genuinely
different (and heavier) approach like an image-generation step per scene.

## Round 6: a real crash fix, and icons that "draw themselves in"

- **Fixed a real crash**: `Cannot read properties of undefined (reading
  'map')` in `FlowScene.tsx`. Root cause: the model occasionally omits the
  `"edges"` key entirely for a scene with only one node (reasonable
  instinct, but our code assumed it would always be there as at least an
  empty array). Fixed on both sides: `FlowScene` now defaults `nodes`/`edges`
  to `[]` if missing, and `plan_scenes.py` normalizes every flow scene to
  guarantee both keys exist before writing `scenes.generated.json` — so this
  can't happen again from either direction.
- **Fixed the Remotion version-mismatch warning**: different `@remotion/*`
  packages had drifted to different versions because they used independent
  `^` ranges. All Remotion packages are now pinned to the exact same version
  (`4.0.520`, no `^`) so `npm install` can never resolve them apart again.
  If you want to bump Remotion later, update all of them to the same new
  exact version together.
- **Icons now "sketch" themselves in, like a pencil drawing**, instead of
  just fading/popping in as a finished shape. Every icon's strokes animate
  from 0% to 100% drawn over about 0.8s when it's revealed, using SVG's
  `pathLength`+`stroke-dashoffset` technique (normalizes any path's length
  to a single unit, so no per-icon math was needed — this was added
  automatically across all ~20 icons). Every icon component now accepts an
  optional `progress` prop (0-1); `FlowScene` computes it from the node's
  own reveal timing, so this is fully automatic — nothing for the AI
  planner to control or get wrong.

## Round 7: captions actually get corrected now, and highlight per-word

- **Script correction was too conservative before** — it only fixed a
  mismatched word when Whisper's and the script's word counts matched
  exactly in that stretch, which real speech (filler words, contractions,
  slightly different phrasing) rarely does. `inject_script.py` now maps
  words *proportionally by position* even when counts differ, so nearly
  every word in a mismatched stretch gets corrected to your script's
  spelling instead of just the lucky 1:1 cases. This is also what fixes
  English loanwords (e.g. "browser") showing up transliterated into Persian
  instead of in English — if it's in your script, it now reliably makes it
  into the captions.
- **Captions now bold the word currently being spoken**, karaoke-style,
  without the caption phrase itself changing or flickering — `Captions.tsx`
  keeps the same stable multi-word chunk on screen (as before) but now
  tracks each word's own timestamp inside it and highlights just that one
  word as it's said.

## Round 8: chat-input and matrix/math mockups

Two new `flow` node kinds, straight from the "what the model does"-style
part of the reference video:

- **`chatbox`**: a rounded chat-input mockup with a message (`label`) and a
  small circular send button — for "you ask/type/send a message" moments.
- **`matrix`**: a small monospace panel of pre-formatted `rows` (e.g.
  `"[ 0.02 -1.88 0.45 ] x [ 0.83 ] = [ 1.42 ]"`), revealed one row at a
  time, with an optional title above and caption below (e.g. "× 96
  layers") — for making numeric/computational ideas (embeddings,
  calculations, scores) concrete instead of abstract.

`scenes.sample.json` now includes a demo scene combining both of these with
the existing `chips` kind (for the token row) — this is the same
"chatbox → tokens → matrix" sequence from the reference, built entirely
from generic, reusable components.

## Round 9: the new components weren't being chosen — here's why

Real bug, not a rendering issue: `chatbox`, `matrix`, and `image` were fully
described in the prompt's rules, but **neither worked example used them** —
and a model imitates the concrete examples it's shown far more reliably
than prose rules alone. It kept defaulting to `box`/`terminal`/`badge`
because those were the only ones actually demonstrated.

Fixed:
- Added a third worked example specifically using `chatbox` + `chips` +
  `matrix` together, so there's now a concrete template to imitate.
- Added an explicit precedence rule + example for `image`: check "Available
  image assets" *before* reaching for `badge`, and if a listed filename
  plausibly matches the named product, `image` is required, not optional.

This should noticeably help, but it's genuinely dependent on your script
actually describing something these fit (typing/sending a message,
splitting into pieces, a calculation) — they're situational, not forced
into every video.

One more honest note: the system prompt is now fairly dense (many node
kinds, multiple examples, hard constraints). A budget-tier model can
genuinely struggle to fully comply with a spec this rich — which is exactly
why Round 9, right below, switches the default model to something stronger.

## Round 9: a stronger model, and a real API compatibility fix

- **Default model upgraded to `gpt-5.6-sol`** (OpenAI's current flagship,
  replacing the now-previous-generation `gpt-4o-mini`). The old cheap model
  was likely why `chatbox`/`matrix`/`image` rarely showed up even when
  clearly applicable — with 9 different node kinds to choose from, a
  budget-tier model tends to fall back on the 2-3 most familiar ones out of
  habit. `gpt-5.6-sol` follows a schema this rich far more reliably.
  Realistic cost: roughly $0.15-0.20 per video (still well under $1) — set
  `OPENAI_MODEL=gpt-5.6-terra` for a cheaper (~half price) middle ground, or
  `gpt-5.6-luna` to go back to mini-tier pricing, if you'd rather trade some
  compliance for cost.
- **Fixed a real API incompatibility**: current OpenAI models reject the
  `max_tokens` parameter entirely in favor of `max_completion_tokens`.
  `plan_scenes.py` was still sending the old name, which would have caused
  every request to fail outright on `gpt-5.6-*`. Fixed.
- **Added a hard rule**: if an image asset is listed as available AND a
  segment clearly names the thing it depicts, the model is now explicitly
  told using it is mandatory, not optional — this was previously only
  "guidance," which a budget model in particular tends to skip.

## Round 10: limbs draw in live, and arrows can fly as rockets/letters

- **The body diagram now draws itself part-by-part, live.** Previously the
  whole stick figure sketched in at once and callout labels just pointed at
  an already-finished drawing. Now only the head/torso draw in up front —
  each limb (hand/leg) stays completely undrawn until the moment its own
  callout is named, then sketches itself in right then. Fully automatic:
  no schema change, this is purely a rendering improvement in
  `icons.tsx`/`FlowScene.tsx`.
- **Animated edges can fly a meaningful icon instead of a plain dot.** New
  optional `"travelIcon"` field: `"rocket"` (launch/deploy/speed), `"mail"`
  (sending a message/request), `"lightning"` (a fast signal/trigger), or
  `"chat"` (a notification/reply) — it animates that icon along the curve,
  rotated to face the direction of travel, instead of an anonymous dot. Use
  it whenever the narration uses a matching verb ("sends", "launches",
  "notifies") so the motion actually depicts the action.

## Round 11: draws new concepts it wasn't given an icon for

Instead of manually adding a hand-built icon for every possible topic
forever, the planner can now draw its own when nothing fits — safely.

- **New `icon: "custom"` + `shape` field.** When none of the ~23 named
  icons match a concrete thing being described, the model composes a
  simple sketch from primitives instead: `circle`, `dot` (filled), `line`,
  `path` (a multi-point line or closed outline), `arc` (for curves).
  Coordinates are 0-100; the whole thing gets the same live "sketching in"
  animation as every hand-built icon, for free.
- **Why this is safe** (and why it's data, not code-gen): the model never
  writes or runs any code. It only ever returns a short list of numbers and
  shape names — the same fixed, hand-tested renderer (`GeneratedIcon` in
  `icons.tsx`) draws all of it, with every coordinate clamped and the
  primitive count capped. Worst case for a bad response is an odd-looking
  doodle, never a crash, never arbitrary execution — the same safety
  principle as the layout engine (structured data in, never coordinates or
  logic supplied as code).
- `scenes.sample.json` includes a bicycle drawn entirely from primitives —
  there's no "bicycle" icon in the library, and there was never a code
  change needed to make one appear.

## Round 12: less visual clutter, and support for a recurring character

- **Old boxes/arrows now visibly fade once focus moves on**, instead of
  everything staying at full brightness forever as more accumulates. A
  node/edge that's no longer the "current" thing being discussed eases down
  to ~40% (nodes) / ~25% (edges) opacity over about half a second — this is
  what keeps a scene with many arrows from turning into visual noise.
- **New `character` node kind** for a recurring illustrated person (as
  opposed to `image`, which is for logos and gets a card frame). It renders
  your own image asset directly with a soft drop shadow, no neon box around
  it. If your `public/assets/` files look like pose variants of the same
  character (e.g. `host-thinking.png`, `host-pointing.png`), the planner
  picks whichever pose's name best fits each segment's tone.
- **Honest limit**: this project draws vector line-art (icons, boxes,
  arrows) — it cannot generate a specific illustrated character or a
  polished mixed-media scene like your reference images itself. What it
  *can* do is place image files you provide. If you want your character to
  appear in different poses, generate those pose images yourself (the same
  way you made the reference images) and drop them in `public/assets/` with
  clear, consistent names — the planner handles picking the right one from
  there.

## Round 13: more polished built-in illustrations

The reference images the user shared turned out to be mostly the same
underlying technology as this project — line-art vector illustrations, not
photos — just more detailed. So most of the gap could be closed with code,
not new infrastructure:

- **New `robot` icon**: a properly illustrated AI-agent robot (antenna,
  round head with eyes, boxy torso with a screen detail, jointed arms and
  legs) — more polished than the plain `agent-body` stick figure, which
  stays reserved for the labeled body-part callout feature specifically.
- **New `search` icon** (magnifying glass) — a common gap, needed for
  "look something up" moments and for the checklist icons below.
- **New `browser` node kind**: a code-editor/browser-style window (top bar
  with an address-bar-like strip, a `> message` prompt, faint placeholder
  code lines) — for "typing/running something" moments, as a step up from
  the plain black `terminal` (which stays reserved for literal command
  output/errors).
- **`checklist` can now show a small icon per item** (new optional `icons`
  array, same order as `items`) — turns a plain text list into something
  closer to the "server directory" panel look (icon + label rows) from the
  reference, reusing the existing checklist component rather than adding
  a whole new one.
- **What still genuinely needs your own asset**: an actual specific
  character illustration (the woman in the striped top) or a fully custom
  multi-element "hero" composition like the second reference image. Those
  are raster/AI-generated art, not vector line-art — see Round 12's
  `character` kind for how to bring your own generated pose images in.

## Round 14: platform-layer stacks, branching workflows, real depth of field

From four more reference images — three of them turned out to be the same
"layers + branching workflow" pattern in different amounts of detail:

- **New `stack` layout + `layer` kind**: trapezoid platform slabs stacked
  top to bottom, each wider than the last (the "UI Portal / Platform /
  Infrastructure" pyramid look). Each `layer` node can carry a `logos` row
  — small colored badges for the specific tools mentioned at that level
  (Terraform, Kubernetes, AWS, etc.), using a provided image asset or just
  the label's initial if none is given.
- **New `stages` layout**: a real branching/converging workflow diagram,
  not just a tree — nodes declare a `stage` number (0-indexed) and get
  arranged in rows automatically; edges can then fan out from one node to
  several in the next stage, or converge from several into one, exactly
  like "a build step triggers two parallel deploy paths that both land in
  the same place." This is a proper small DAG while staying just as
  overlap-safe as every other layout (positions still come purely from
  stage numbers, never coordinates).
- **Real depth-of-field blur, not just dimming**: settled (no-longer-
  focused) nodes now blur slightly in addition to fading, matching the
  "background layers out of focus, current layer sharp" look from the
  reference directly — and since it's part of the same generic focus
  system every layout already uses, `stack` layers get this automatically
  with no extra work.
- Character/logo assets: unchanged from Round 12/13 — put your own files in
  `public/assets/` and reference them via `character`/`image`/`logos.src`.

## Round 15: the host character gets real posture, and every scene got less boring

Two separate asks this round: make the recurring character actually usable
(different posture for different moments, not just floating as one more
grid box), and fix the plain diagram scenes ("sketch mode") looking flat
and static even after 14 rounds of feature work.

- **New scene-level `character`**, on both `title` and `flow` scenes
  (`src/scenes/FlowScene.tsx`, `src/scenes/TitleScene.tsx`): `{"src":
  <pose file>, "focusSrc": <pose file>?, "position": "left" | "right"?}`.
  Unlike the Round 12 `character` node (still there, unchanged, for a
  smaller inline appearance among other diagram nodes), this reserves a
  full-height strip on one side of the frame for her and shrinks the
  diagram's own layout into what's left — the "she's standing next to the
  diagram, presenting it" composition. This is a pure remapping of the
  existing 0-100 layout-engine coordinates into whatever width remains, so
  every layout (`pipeline`/`tree`/`grid`/`stack`/`stages`) and every node
  kind gets it for free, no per-kind changes needed.
- **Automatic posture switching.** With `focusSrc` given, she renders `src`
  (e.g. a "neutral" or "working at a laptop" pose) when the scene has no
  diagram, and switches to `focusSrc` (e.g. an "explaining/pointing" pose)
  the moment the scene actually has nodes to reveal — driven purely by
  whether `nodes` is non-empty, not a field the planner has to time itself.
  This is exactly "change her posture if she's working vs. explaining
  something," per this round's feedback.
- **The `stack` layout (platform-layer trapezoids) is the natural pairing**
  for the explaining pose: she stands beside the stack while the existing
  Round 14 focus system (settle-fade + depth-of-field blur) moves down it
  one layer at a time — this combination was verified end-to-end with a
  local placeholder asset and produces the "presenter beside a 3-layer
  diagram, older layers blurring back" composition directly.
- **Every scene (title/compare/flow) got a shared `SceneBackground`**
  (`src/SceneBackground.tsx`): 2 large, slow-drifting soft color blooms
  behind the existing dot grid, plus a gentle vignette — real depth instead
  of a flat single-color background, without ever competing with
  foreground content (captions keep their own opaque pill, well clear of
  the vignette's darkened edges).
- **A slow, continuous Ken Burns zoom/pan** (`useKenBurns` in the same
  file) on every scene's content layer — capped tiny (≤3.5% scale, ≤0.6%
  pan) so it reads as "this was actually filmed," not distracting. Applied
  to the diagram/title layer only, never to the character (she stays
  perfectly still, like a foreground presenter over a moving background
  plate) and never to captions (a separate top-level layer in
  `MainVideo.tsx`, unaffected by any scene's internal motion).
- **A traveling spotlight glow** blooms in behind whichever node currently
  has focus (`FlowScene.tsx`), reusing the same reveal-timing the existing
  glow-boost already tracked — reinforces where attention is without adding
  clutter, and a small idle bob on the focused node keeps it from going
  fully static once its entrance spring settles.
- **What still needs your own asset, honestly**: this project draws vector
  line-art — it cannot generate the actual illustrated character (the
  striped-top host) itself, same limit noted since Round 12. Everything
  above is verified working end-to-end with a placeholder SVG stand-in;
  once you drop real pose files into `public/assets/` (see that folder's
  README for the recommended `host-neutral` / `host-laptop` / `host-explain`
  naming), the planner starts using them automatically — nothing else to
  wire up.

## Round 16: real word-level sync, fixed mixed-language captions, and two formats at once

Three separate bugs/asks this round, all about actually matching the voice
instead of approximating it:

- **Fixed captions rendering mixed Persian/English text jumbled and
  run-together** (`src/Captions.tsx`). Two real bugs, not one: (1) word
  spacing was a CSS margin, not an actual space *character* — the browser's
  bidi/line-breaking algorithm needs a real space glyph in the text stream
  to correctly gap and order mixed-direction runs, so words could render
  jammed together; (2) no `dir` was ever set, so the caption bubble used the
  page's default LTR base direction even for Persian-majority sentences,
  which is what caused the reordering/"jumbled" look. Fixed by inserting a
  literal space text node between word `<span>`s and adding `dir="auto"` so
  each caption bubble infers its own base direction from its actual first
  strong-directional character — verified with a mixed Persian+English
  render (`این یک تست برای Claude Code است`), which now reads correctly
  right-to-left with the embedded English term in its right place.
- **Fixed a second, independent caption bug** in `scripts/inject_script.py`:
  when Whisper split one spoken word into more mis-heard tokens than your
  script has words for in that stretch, the correction logic repeated the
  *same* script word once per Whisper token — visible as a stutter like "the
  the model" in the final captions. Now merges those into one caption
  entry (extending its end time to cover the merged span) instead of
  duplicating it. Covered by a unit test.
- **Shapes/motion are now synced to the actual word being spoken, not an
  even-spread guess.** Every `FlowNode` (`src/scenes/FlowScene.tsx`) can
  carry a `revealFrame` (a scene-relative frame number); when present, the
  node reveals exactly there instead of at `computeRevealFrames()`'s evenly-
  guessed slot — everything downstream (glow boost, settle-fade, edges,
  the new spotlight from Round 15) already keyed off reveal timing, so this
  one change makes all of it follow real narration timing for free.
  `scripts/plan_scenes.py` produces these: segments are now shown to the
  model as bracket-indexed words (`[0]The [1]agent [2]calls...`), the model
  sets a `"wordIndex"` per node pointing at the word that names it (the
  system prompt's worked examples now demonstrate this directly, per the
  Round 9 lesson that concrete examples train the model far better than
  prose rules), and `resolve_node_timing()` converts that index into a real
  frame using the word's actual Whisper timestamp — timing math stays in
  code, on real timestamps, never the model's own guess, same principle the
  whole pipeline already followed for scene-level timing. Verified with a
  render where three nodes were given deliberately out-of-order
  `revealFrame`s and appeared exactly on schedule, not evenly spread.
- **Two output videos, same storyboard, one run.** `src/Root.tsx` now
  declares a second composition, `MainVideoYouTube` (1920×1080, landscape),
  alongside the existing `MainVideo` (1080×1920, vertical/Instagram) — same
  `MainVideo` component, same `scenes.generated.json`, since every scene's
  layout math already worked in percentages of its own composition's
  width/height (nothing format-specific needed changing). `run.ps1`,
  `run.sh`, and `agent.ps1`'s run/feedback/render actions now render both
  from a single invocation: `<name>-instagram.mp4` and `<name>-youtube.mp4`.
  Verified both compositions render correctly, including a full-frame
  landscape still.

## Round 17: benchmarked against the actual reference video, and a no-asset host

This round started by extracting and studying frames from the specific
reference video this project's own "coding agent" example (Round onward)
was modeled on. That comparison surfaced the real cause of the remaining
complaints, not just symptoms:

- **The reference never hard-cuts mid-story.** It builds ONE diagram
  progressively across many narration beats — You→Agent→Model appears
  once, then a tool list, then a terminal, then a red error-arrow back to
  the SAME Model box each get added in turn, without the earlier boxes ever
  moving. Our pipeline instead generated a fully independent scene per
  audio segment, so even closely related content re-ran the whole layout
  engine from scratch every ~10-20s — a different node count means
  different computed positions, so the "same" box visibly jumps. **That was
  the actual jump**, not just a missing crossfade.
- **Fix: `"continueDiagram": true`** (`scripts/plan_scenes.py`,
  `merge_continued_scenes()`). The model still returns one scene object per
  segment as always; a continuing scene's props hold only the NEW nodes/
  edges for that segment, and a Python pass folds them into the preceding
  flow scene's own node/edge list (each node's already-resolved
  `revealFrame` shifted by the preceding scene's cumulative duration) before
  the file is ever written — total duration and audio sync are completely
  unaffected, it's a pure pre-render merge. An id-map threaded through the
  whole chain lets a later segment's edge reference an earlier segment's
  node by its original id (e.g. a new terminal's error-arrow reaching back
  to "model" from two segments ago), however many hops back, without
  collisions. Covered by a unit test replicating the exact 3-segment
  reference pattern (agent → tools → terminal+error), asserting final node
  order, shifted reveal timing, and the cross-chain edge reference all come
  out correct — then rendered to confirm all 5 nodes appear at their right
  moments in one continuous mount.
- **A real, separate cut still gets a soft fade** (`src/MainVideo.tsx`,
  `SceneFade`): the outgoing scene now dips to transparent over its last
  ~1/3s instead of vanishing at full brightness the instant its
  `<Series.Sequence>` ends — softens genuine topic changes without touching
  any duration math (a continuing chain is already one Sequence by the time
  this runs, so it never dips mid-diagram).
- **Fixed a second, independent caption-accuracy bug**, in
  `scripts/inject_script.py`'s Persian/Arabic matching: Whisper's output and
  a hand-typed Persian script routinely spell the same word with different
  Arabic-script code points (Arabic ي/ك/ة vs Persian ی/ک/ه, stray
  diacritics, Arabic-Indic digits, ZWNJ placement) — the matcher was
  treating these as different words and silently skipping a correction it
  should have made, even with a correct `--script` supplied. Both sides are
  now folded to one canonical form before comparing (never before
  displaying — output text is always the original wording). Unit-tested
  with a real Arabic/Persian-variant mismatch.
- **Less box+arrow by default.** The system prompt's opening line no longer
  lists "boxes, arrows" first among the visual toolkit (models anchor
  hard on whatever's mentioned first), a new hard rule explicitly tells the
  model to check `icon`/`chips`/`checklist`/`terminal`/`chatbox`/`matrix`/
  `badge` before reaching for a plain box, and — just as important — that
  NOT every node set needs edges at all: a `grid` of parallel, unrelated
  items should be bare nodes with `edges: []`, not boxes wired together
  with arrows that don't represent a real relationship.
- **A recurring host with no image asset required at all**
  (`src/HostCharacter.tsx`): a generic, procedurally-drawn presenter (flat
  vector, three poses — `laptop`/`explain`/`neutral` — accent-colorable per
  scene) that `FlowScene`/`TitleScene` fall back to automatically whenever
  a scene's `character` has no `src`. A real image asset, if one exists in
  `public/assets/`, still takes priority (see that folder's README) — this
  only adds a path that needs nothing from you at all, it doesn't remove
  the asset-based one. Same honest framing as the "badge" node: an
  original, generic stand-in, not a copy of any specific real character.
- **Honest gap this round**: the local render/preview environment hit a
  browser-launch failure partway through this session (Microsoft Edge
  auto-updated mid-session to 152.0.4191.62 and started exiting immediately
  on any automated launch — reproduced outside Remotion too, so it's a
  local Edge issue, not a code issue) — later changes in this round
  (`HostCharacter`, the `SceneFade` transition) are verified by type-
  checking and code review but not a fresh render. Everything with testable
  logic (the merge, the id-remapping, both caption fixes) has passing unit
  tests. If `npm run preview` fails with a browser-launch error, try
  `npx remotion browser ensure` (downloads Remotion's own Chrome instead of
  system Edge) or restart the machine first.

## Round 18: gifs actually animate now, and you can force specific assets in

Two asks: animated gifs were listed as a supported extension nowhere near
correctly (they'd silently freeze on one frame), and there was no way to
say "this specific file must be in the video" short of hoping the model
picks it.

- **New `src/AssetImage.tsx`**: every place that shows a user-provided file
  from `public/assets/` (an `image` node, a `character` pose, a `layer`'s
  `logos`) now goes through this one component instead of a raw `<Img>`.
  Reason: a plain `<Img>` pointed at an animated `.gif` only ever captures
  whatever single frame Chromium's own wall-clock GIF timer happens to be
  showing at that instant — every frame of the render, since that timer
  never syncs to Remotion's own frame clock. `AssetImage` renders a `.gif`
  through `@remotion/gif` instead (added as a dependency, pinned to
  `4.0.520` to match every other Remotion package), which decodes the file
  itself and seeks to the exact frame Remotion asks for — so a dropped-in
  gif now actually animates, frame-accurately, in the real render. `.gif`
  was also missing from `plan_scenes.py`'s scanned extensions entirely —
  fixed, it's treated exactly like any other image asset now.
- **New `--required-assets` flag on `plan_scenes.py`** (comma-separated
  filenames, must already exist in `--assets-dir`): splits the scanned
  asset list into two tiers in the prompt — "REQUIRED" (must appear
  somewhere in the video, a hard rule) versus the existing "available" tier
  (used only if a segment's content actually calls for it). After the
  storyboard comes back, `find_used_assets()` scans every `src` the model
  actually used (node images, character poses, layer logos) and prints a
  warning if a required one got skipped anyway — a safety net, not a gate,
  since failing the whole run over one skipped asset would be worse than a
  visible warning. Unit-tested (prompt correctly separates the two tiers;
  the usage scan finds filenames wherever they can appear).
- **Wired into every run path**: `agent.ps1`'s `run`/`feedback` now list
  what's actually sitting in `public/assets/` and ask which of them must be
  used, so you're picking real filenames rather than remembering them;
  `run.ps1` gained a `-RequiredAssets` parameter and `run.sh` a 5th
  positional argument for the same thing non-interactively.
- Documented in `public/assets/README.md`: detection is filename-only (the
  planner is a text prompt — it never actually looks at the picture), so a
  descriptive filename matters more than the file itself.

## One-time setup

**Use Python 3.11 or 3.12 — not 3.13/3.14.** The speech libraries
(`faster-whisper` and its `av` dependency) don't have prebuilt Windows/Mac
wheels for the newest Python releases yet, so pip tries to compile from
source and fails without a C compiler + FFmpeg dev headers.

```bash
# Windows (py launcher lets you pick the version explicitly)
py -3.11 -m venv .venv
.venv\Scripts\activate

# macOS/Linux
python3.11 -m venv .venv
source .venv/bin/activate
```

Then:

```bash
npm install
pip install -r scripts/requirements.txt

export OPENAI_API_KEY=sk-...      # macOS/Linux — only plan_scenes.py needs this
setx OPENAI_API_KEY "sk-..."      # Windows (restart the terminal after)
```

Remotion needs a headless browser to render. It normally auto-downloads one,
but that download is geo-blocked in some regions (403 "not available in
your location"). `remotion.config.ts` already points it at your system's
Microsoft Edge/Chrome if it finds one at a common install path — no action
needed unless it can't find yours (see that file's comments).

**About `npm audit`:** it will report several vulnerabilities in Remotion's
own build tooling. These matter for internet-facing servers; for a script
you run locally to render your own videos, the practical risk is low.
`package.json` now pins exact versions (see Round 6) rather than `^` ranges,
to avoid the packages drifting apart — so bumping to a patched release means
manually updating the version number, not just re-running `npm install`.

## Easiest way to run it: the interactive menu (Windows)

```powershell
.\scripts\agent.ps1
```

- **run** — asks for the voice file, script file, output name, language,
  and any extra notes, defaulting to whatever it finds inside `public/`
  (hit Enter through the prompts if you already dropped files in there).
  Then aligns, plans, and renders.
- **feedback** — reuses the audio analysis from your last `run` (no
  re-transcription — fast and free) and only re-asks for new notes, then
  re-plans and re-renders. Use this to iterate: "make it punchier", "focus
  more on the ending", etc.
- **render** — just re-renders the existing storyboard, no new API call at
  all. Use this after a code/style tweak or after fixing a render error.
- **preview** — opens Remotion Studio with the sample data, no API calls.

Jump straight to one without the menu: `.\scripts\agent.ps1 run`,
`.\scripts\agent.ps1 feedback`, etc.

If PowerShell blocks running local scripts, run once:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

## Preview without spending anything

```bash
npm run preview
```

Opens Remotion Studio using `scenes.sample.json` — check the visual style
before running a real (paid) storyboard.

## Non-interactive usage (scripting / other OSes)

**Windows PowerShell**, explicit arguments instead of prompts:
```powershell
.\scripts\run.ps1 -VoicePath public\voice.mp3 -OutName my-video.mp4 -ScriptPath public\script.txt -Language fa
```

**macOS/Linux/Git Bash/WSL:**
```bash
scripts/run.sh public/voice.mp3 my-video.mp4 public/script.txt fa
```
(Naming is up to you — any filename works as long as you pass it. `public/voice.mp3` + `public/script.txt` is just a simple convention.)

Both scripts, in order: place the audio in `public/` → transcribe locally
with word timestamps → inject + correct against your script if you gave one
→ send the segmented narration to OpenAI for the storyboard → render **two**
`.mp4` files from that one storyboard, your audio muxed into both:
`my-video-instagram.mp4` (1080×1920, vertical) and `my-video-youtube.mp4`
(1920×1080, landscape) — see Round 16.

## Extending the visual style

Add a new scene component in `src/scenes/`, register its `type` in
`src/MainVideo.tsx`'s `Series.Sequence` block, and describe it in the
`SYSTEM_PROMPT` inside `scripts/plan_scenes.py` so the planner knows it can
use it. `OPENAI_MODEL` (env var, default `gpt-5.6-sol` as of Round 9) can be
swapped to `gpt-5.6-terra` or `gpt-5.6-luna` for a cheaper/faster tradeoff.

The font stack (`theme.ts`) is a modern system sans-serif, no internet
needed. For a specific real font, swap it via `@remotion/google-fonts`
(needs internet at build time).

## Honesty note on testing

Built and verified as far as the sandbox this was drafted in allows:
- ✅ `npm install` succeeds; `npx tsc --noEmit` passes with no type errors.
- ✅ Python scripts' logic (segmenting, prompt building, JSON parsing, the
  script/caption correction alignment) was unit-tested directly.
- ⚠️ The actual `remotion render` frame-by-frame render, the
  `faster-whisper` model download, and the live OpenAI API call were **not**
  run end-to-end here — this sandbox blocks the one-time downloads they
  need. They're standard, widely-used flows that should work with normal
  internet access, but budget a little debugging time on first real runs.
- ✅ Fixed a real bug from an earlier round: `agent.ps1`/`run.ps1` used to
  print "Done" even when `remotion render` crashed, since PowerShell
  doesn't treat a failed external command as script-stopping by default.
  Both now check the exit code after every step.
