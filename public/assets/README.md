Drop your own logo/image/gif files here (e.g. `claude.png`, `demo.gif`).

The scene planner (`scripts/plan_scenes.py`) automatically scans this folder
and can reference any file here by filename in an "image" node (or as a
character pose, or a layer's logo — see below). This project never
downloads or generates logos itself — only files you put here yourself are
ever used, which keeps this copyright-safe.

Supported extensions: .png, .jpg, .jpeg, .webp, .svg, .gif — an animated
`.gif` actually animates in the final render (via `@remotion/gif`), it's not
just a frozen first frame.

**How the planner decides what to use — filename only, not content.** It
never looks at the actual picture; it's a text-only prompt that gets a plain
list of filenames. So naming matters: `claude-logo.webp` or
`host-explain.png` tell it what something is far better than `IMG_2381.png`
would. Rename files here to something descriptive before a run.

**Making sure a specific file gets used** (rather than leaving it to the
planner's judgment): pass `--required-assets "file1.png,file2.gif"` to
`plan_scenes.py` (or just answer the "کدوم‌ها حتما باید استفاده بشن؟" prompt
`agent.ps1`'s `run`/`feedback` asks — it lists what's actually in this
folder so you're picking real filenames). Anything named this way MUST
appear somewhere in the video; everything else in this folder stays
"available" — used only if a segment's content actually calls for it.
`plan_scenes.py` also prints a warning afterward if the model ended up
skipping a required one anyway, so you're not left guessing.

## A recurring character (host, mascot, etc.)

**You don't need to provide anything here to get a recurring host.** As of
Round 16, `src/HostCharacter.tsx` draws a simple, generic presenter
procedurally — no image asset required — in three poses (`laptop`,
`explain`, `neutral`) with an accent color you can tint per scene. The
planner uses this automatically on a minority of scenes (see Round 16 in
the main README). This is a generic, original stand-in — the same honest
spirit as the "badge" node not being a real logo — not a specific branded
character.

If you'd rather have an actual custom-illustrated host (e.g. a specific
branded character), generate a handful of pose/expression variants yourself
(the same way you'd make any AI-generated illustration) and name them with
a shared prefix — a real asset always looks more polished than the drawn
fallback, and the planner prefers it automatically once it sees one. For
the planner to use it well, at minimum give it:

```
host-neutral.png     — a plain, calm standing/greeting pose
host-laptop.png      — busy working, typing at a laptop
host-explain.png     — pointing/presenting, gesturing toward something
```

You can add more variants (`host-thinking.png`, `host-pointing.png`, etc.)
and the planner will pick whichever pose's filename best fits each moment —
but these three cover the postures this project actively looks for: general
narration/work (`laptop`/`neutral`) versus "explaining a diagram"
(`explain`), see below.

There are two different ways she can appear, both automatic once the files
above exist — you never have to ask for either one by name:

- **Scene-level `character`** (`src/scenes/FlowScene.tsx`,
  `src/scenes/TitleScene.tsx`): she stands full-height on one side of the
  frame (left or right), and the diagram/title shrinks into whatever's left
  — this is the "she's presenting this" look. The planner uses this on a
  minority of scenes (openings, key explanatory beats), picks her base pose
  by what the segment is about (e.g. `host-laptop.png` for "building/
  setting this up", `host-neutral.png` for a plain transition), and — only
  on a "flow" scene that actually has a diagram — automatically swaps to an
  "explain"-style pose the moment that diagram starts revealing, then back
  to the base pose if a later scene has no diagram. This is also the mode
  that pairs with the `stack` layout (trapezoid platform layers): her
  standing beside the stack while focus moves down it one layer at a time,
  each older layer blurring into the background, is the built-in "explaining
  the architecture" moment — see Round 15 in the main README.
- **Node-level `character`** (a node inside a `flow` scene's own `nodes`
  list, `kind: "character"`): a smaller inline appearance placed among the
  diagram's other boxes/icons like Round 12 originally added, no card frame,
  different from `kind: "image"` which is for logos and does get a frame.
  Useful when she should appear as one part of a larger diagram rather than
  standing beside the whole thing.

Both ways only ever reference exact filenames the planner sees under
"Available image assets" — it never invents a pose that doesn't exist, so
nothing breaks if you only provide one or two of the three poses above (the
renderer just falls back to whichever pose you did give it).
