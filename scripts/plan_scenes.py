"""
plan_scenes.py — the "director" step.

Architecture: the audio's real timestamps are used to split the narration
into topic-sized segments FIRST (by natural pauses, with a length fallback) —
this is plain arithmetic, not the LLM's guess. Each segment gets an exact
on-screen duration computed directly from those timestamps. The LLM's only
job is choosing WHAT to visually show for each segment's exact words — it
never has to estimate timing, which is what used to cause scenes to drift out
of sync with the narration.

This is the only step in the whole pipeline that costs money — one short LLM
call, a few cents at most per video, using OpenAI's API.

Usage:
    export OPENAI_API_KEY=sk-...
    python scripts/plan_scenes.py --align align.json --audio-file voice.mp3 --out scenes.generated.json
"""
import argparse
import json
import os
import re

import requests

FPS = 30
MIN_SEGMENT_SECONDS = 10
MAX_SEGMENT_SECONDS = 20
PAUSE_GAP_SECONDS = 0.5


def segment_words(words):
    """Split words into topic-sized chunks: prefer breaking on a natural
    pause once a segment is already long enough; force a break past the max
    length regardless of pauses."""
    if not words:
        return []
    segments = []
    current = [words[0]]
    for w in words[1:]:
        prev = current[-1]
        gap = w["start"] - prev["end"]
        span_if_added = w["end"] - current[0]["start"]
        current_span = prev["end"] - current[0]["start"]
        should_break = (gap > PAUSE_GAP_SECONDS and current_span >= MIN_SEGMENT_SECONDS) or span_if_added > MAX_SEGMENT_SECONDS
        if should_break:
            segments.append(current)
            current = []
        current.append(w)
    if current:
        segments.append(current)
    # Don't end on an oddly brief final segment — fold it into the previous one.
    if len(segments) > 1 and (segments[-1][-1]["end"] - segments[-1][0]["start"]) < 3:
        segments[-2].extend(segments[-1])
        segments.pop()
    return segments


def segment_frame_bounds(segments, target_total_frames):
    """Exact [start, end) frame range for each segment. Boundaries sit at the
    midpoint of the gap between segments, snapped so the first starts at 0
    and the last ends exactly at target_total_frames — the video is always
    precisely as long as the audio, by construction."""
    n = len(segments)
    raw_times = [0.0]
    for i in range(n - 1):
        gap_mid = (segments[i][-1]["end"] + segments[i + 1][0]["start"]) / 2
        raw_times.append(gap_mid)
    raw_times.append(target_total_frames / FPS)

    frame_bounds = [round(t * FPS) for t in raw_times]
    frame_bounds[0] = 0
    frame_bounds[-1] = target_total_frames
    for i in range(1, len(frame_bounds)):
        if frame_bounds[i] <= frame_bounds[i - 1]:
            frame_bounds[i] = frame_bounds[i - 1] + 1
    return [(frame_bounds[i], frame_bounds[i + 1]) for i in range(n)]


SYSTEM_PROMPT = """You are a creative video director. You'll be given a narration \
already split into numbered SEGMENTS with their exact words. For each segment, \
in order, choose ONE scene that visually represents exactly what that segment \
says — for a modern, neon-tech explainer video (dark background, a wide \
toolbox of glowing components: icons, terminal mockups, checklists, chat/ \
matrix panels, layered diagrams, and yes sometimes labeled boxes with \
arrows — but that's one tool among many below, not the default, all with a \
consistent visual rhythm from scene to scene).

Output ONLY a valid JSON object, no prose, no markdown fences:

{
  "scenes": [
    {"type": "title", "props": {"text": str, "subtitle": str?, "character": {"src": str?, "pose": "laptop" | "explain" | "neutral"?, "color": "#hex"?, "position": "left" | "right"}?}},
    {"type": "compare", "props": {"title": str, "items": [{"label": str, "color": "#hex", "initial": str?}]}},
    {"type": "flow", "props": {
        "title": str?,
        "layout": "pipeline" | "pair" | "grid" | "tree" | "stack" | "stages",
        "rootPosition": "top" | "bottom",
        "character": {"src": str?, "focusSrc": str?, "pose": "laptop" | "explain" | "neutral"?, "focusPose": "laptop" | "explain" | "neutral"?, "color": "#hex"?, "position": "left" | "right"}?,
        "continueDiagram": bool?,
        "nodes": [{
            "id": str, "label": str, "sublabel": str?, "color": "#hex",
            "kind": "box" | "terminal" | "icon" | "badge" | "chips" | "image" | "checklist" | "chatbox" | "matrix" | "character" | "browser" | "layer",
            "lines": [str]?,
            "error": bool?,
            "icon": "brain" | "person" | "warning" | "agent-body" | "gear" | "house" | "car" | "cloud" | "database" | "chat" | "lightning" | "chart" | "lock" | "globe" | "book" | "money" | "shield" | "refresh" | "rocket" | "network" | "check" | "star" | "mail" | "search" | "robot" | "custom"?,
            "callouts": [{"label": str, "anchor": "head" | "handLeft" | "handRight" | "legLeft" | "legRight", "color": "#hex"?}]?,
            "chips": [str]?,
            "src": str?,
            "items": [str]?,
            "activeIndex": int?,
            "icons": [str]?,
            "stage": int?,
            "logos": [{"label": str, "color": "#hex", "src": str?}]?,
            "rows": [str]?,
            "caption": str?,
            "shape": [
                {"type": "circle", "cx": num, "cy": num, "r": num} |
                {"type": "dot", "cx": num, "cy": num, "r": num} |
                {"type": "line", "x1": num, "y1": num, "x2": num, "y2": num} |
                {"type": "path", "points": [[num, num], ...], "closed": bool?} |
                {"type": "arc", "cx": num, "cy": num, "r": num, "startDeg": num, "endDeg": num}
            ]?,
            "wordIndex": int?
        }],
        "edges": [{"from": str, "to": str, "bidirectional": bool?, "label": str?, "color": "#hex"?, "animated": bool?, "travelIcon": "rocket" | "mail" | "lightning" | "chat"?}]
    }}
  ]
}

You must return EXACTLY one scene per segment, in the same order — the array
length must equal the number of segments given to you. Don't merge segments
together and don't skip any. (Timing is handled separately — don't worry
about duration at all.)

IMPORTANT: flow nodes have NO x/y/width/height — you never place anything \
manually. A layout engine positions everything for you, guaranteed to never \
overlap or spill off-frame. Your only job is picking the right layout and \
node kinds for the content:

TIMING each node's own entrance — "wordIndex": every node's shape/icon \
should visually appear at the exact moment its concept is actually spoken, \
not at some evenly-guessed interval. Each segment above is shown as \
bracket-indexed words, e.g. "[0]The [1]agent [2]calls [3]the [4]model" — set \
a node's "wordIndex" to the bracket number of the word where that node's \
subject is first named (for the "agent" node in that example, "wordIndex": \
1). Code — not you — converts that word's real timestamp into the exact \
frame the node reveals on, so this only ever needs an index, never a frame \
number or any timing math from you. Do this for EVERY node whenever a \
matching word exists in the segment (it almost always does, since node \
labels are drawn directly from the segment's own words) — omit "wordIndex" \
only on the rare node with no single corresponding word (e.g. a generic \
connecting element). List nodes in the order their words are actually \
spoken so the reveal sequence and the layout's reading order agree.

CONTINUING A DIAGRAM ACROSS SEGMENTS — "continueDiagram": true: a real \
explanation often builds ONE diagram progressively across several \
consecutive segments instead of a brand new picture every time — e.g. one \
segment introduces You→Agent→Model, the next adds a tool list onto the \
SAME agent box, the next adds a terminal plus a red error arrow back to the \
SAME model box — all without the earlier boxes ever moving, resizing, or \
disappearing. Hard-cutting to a completely fresh layout every single \
segment (even for closely related content) is what makes a video feel like \
the screen keeps jumping — this is the fix. Set "continueDiagram": true on \
a flow scene to mean "keep showing the previous flow scene's diagram \
exactly as it is, and layer these new nodes/edges onto it":
- You still return exactly one scene object per segment as always (never \
merge segments together yourself) — "continueDiagram" is a flag on that \
object, not a change to how many scenes you output.
- A continuing scene's "props" should contain ONLY the NEW "nodes"/"edges" \
this segment introduces — never repeat nodes from earlier segments, the \
code keeps them automatically, in their exact original positions. Omit \
"title"/"layout"/"rootPosition"/"character" entirely on a continuing scene \
(they're ignored — the diagram keeps whatever the FIRST scene in the chain \
set).
- A new edge MAY reference a node id introduced in an EARLIER segment of \
the same chain (e.g. connecting a brand-new terminal back to the "model" \
box from two segments ago) — just reuse that exact id string, same as if \
it were still right in front of you (which, visually, it still is).
- Never set "continueDiagram" on the first scene of a chain (there's \
nothing yet to continue) — only on the 2nd, 3rd, etc. segment that keeps \
building the same picture.
- A single diagram — counting every node across the whole chain — should \
never grow past about 6 nodes total. Once a chain reaches that, its next \
segment must start a genuinely fresh scene ("continueDiagram" false) rather \
than adding a 7th node; the code enforces this ceiling either way, but \
planning around it yourself keeps the newly-started scene coherent instead \
of an arbitrary cutoff. Most chains should be 2-4 segments (one base scene \
plus 1-3 continuations), not a marathon.

Example — three consecutive segments building ONE diagram (this is the \
target pattern to match):
Segment 5: "[0]You [1]ask [2]the [3]agent [4]to [5]fix [6]a [7]bug."
{"type": "flow", "props": {
  "title": "Coding agent", "layout": "tree", "rootPosition": "top",
  "nodes": [
    {"id": "you", "label": "You", "color": "#9aa0ac", "kind": "icon", "icon": "person", "wordIndex": 0},
    {"id": "agent", "label": "Agent", "color": "#ffb347", "kind": "box", "icon": "gear", "wordIndex": 3},
    {"id": "model", "label": "Model", "color": "#2de2e6", "kind": "icon", "icon": "brain", "wordIndex": 3}
  ],
  "edges": [
    {"from": "you", "to": "agent", "color": "#9aa0ac"},
    {"from": "agent", "to": "model", "bidirectional": true, "color": "#ffb347", "animated": true}
  ]
}}
Segment 6: "[0]It [1]can [2]read [3]files, [4]run [5]commands, [6]or [7]edit [8]code."
{"type": "flow", "props": {
  "continueDiagram": true,
  "nodes": [{"id": "tools", "label": "Tools", "color": "#39ff88", "kind": "checklist", "items": ["read_file", "run_cmd", "edit_file"], "wordIndex": 2}],
  "edges": [{"from": "agent", "to": "tools", "color": "#39ff88"}]
}}
Segment 7: "[0]It [1]runs [2]the [3]tests, [4]but [5]one [6]fails [7]with [8]an [9]error."
{"type": "flow", "props": {
  "continueDiagram": true,
  "nodes": [{"id": "term", "label": "", "color": "#ff3b5c", "kind": "terminal", "error": true, "lines": ["$ npm test", "x 1 test failing"], "wordIndex": 1}],
  "edges": [
    {"from": "agent", "to": "term", "color": "#ff3b5c"},
    {"from": "term", "to": "model", "label": "error", "color": "#ff3b5c"}
  ]
}}
Notice segments 6 and 7 reuse "agent"/"model" — ids from segment 5 — to \
connect into the diagram that's already on screen, and never re-declare \
"you"/"agent"/"model" as nodes themselves.

Use this whenever segments naturally continue one idea — look for "and \
then", "but", "so it", or a continuing pronoun ("it"/"that") with no new \
subject introduced. Don't force it onto genuinely unrelated content: a \
segment introducing a different topic should leave "continueDiagram" \
false (the default) and start fresh, same as before.

Layout guide — "pipeline" is the LEAST interesting option and is overused; \
reach for "tree" or "grid" by default and only use "pipeline" when the \
content is a genuine strict sequence with no other structure:
- "pipeline": nodes stacked vertically in sequence — ONLY for a true \
step-by-step process ("first X, then Y, then Z") where order is the whole \
point. Do not use this as a generic fallback for "I have several things to \
show" — that's what "tree" and "grid" are for, and they look far more like \
an actual designed diagram instead of a falling list of boxes.
- "pair": exactly 2 nodes side by side — for a direct comparison or a \
two-way relationship (e.g. "you" vs "the model").
- "grid": 3+ nodes arranged in a balanced grid — for a set of parallel \
items with no strict order (e.g. several features, tools, or concepts).
- "tree": node[0] is the root, all remaining nodes are children shown in a \
row — for one thing connecting to several others (e.g. one agent calling \
multiple tools, one concept branching into examples). Set "rootPosition" to \
"top" or "bottom" depending on whether the root is the source or the \
destination conceptually. This is usually the best choice for "one central \
thing relates to several other things," which is extremely common.
- "stack": trapezoid "platform layer" slabs stacked top to bottom, each \
wider than the last — use whenever the narration explicitly describes \
layers/levels/tiers stacked on each other (e.g. "a UI layer sits on top of \
a platform layer, which sits on infrastructure"). Nodes for this layout use \
"kind": "layer" — see below. This is the layout that pairs best with the \
recurring host character (see above) in her explaining pose, if one is \
available — a host standing beside a layer stack, with focus moving down it \
one layer at a time as each is discussed, is a strong, reusable pattern for \
"here's our architecture" moments specifically.
- "stages": a proper branching/converging workflow diagram, not just a \
simple tree — use when something fans out into multiple paths that later \
reconverge (e.g. "a request goes to a build step, which triggers two \
parallel processes, both of which deploy to the same place"). Every node \
needs a "stage" number (0-indexed, top to bottom); nodes sharing a stage \
are arranged in a row automatically. Edges then connect across stages \
however the narration describes — fan-out (one stage-N node to several \
stage-(N+1) nodes) and fan-in (several nodes converging to one) both work \
naturally since positions are computed from "stage" alone, not from the edges.
Example — request pipeline that splits then reconverges:
{"type": "flow", "props": {
  "title": "Request to production",
  "layout": "stages",
  "nodes": [
    {"id": "req", "label": "Request", "color": "#4d7cff", "kind": "box", "stage": 0},
    {"id": "build", "label": "Build", "color": "#ffb347", "kind": "box", "stage": 1},
    {"id": "deploy", "label": "Deploy", "color": "#39ff88", "kind": "box", "stage": 2},
    {"id": "provision", "label": "Provision", "color": "#b06bff", "kind": "box", "stage": 2},
    {"id": "run", "label": "Run", "color": "#2de2e6", "kind": "box", "stage": 3}
  ],
  "edges": [
    {"from": "req", "to": "build", "color": "#4d7cff"},
    {"from": "build", "to": "deploy", "color": "#ffb347"},
    {"from": "build", "to": "provision", "color": "#ffb347"},
    {"from": "deploy", "to": "run", "color": "#39ff88"},
    {"from": "provision", "to": "run", "color": "#b06bff"}
  ]
}}

Recurring host character (scene-level, on "title" and "flow" scenes only): \
a "character" object on a small minority of scenes' "props" — roughly 1 in \
every 4-6 scenes (always the opening "title" scene, plus a few key moments \
later), never most scenes, so she reads as a recurring host popping in \
rather than a static watermark. No image asset is required — the renderer \
draws her itself. Two ways to fill this in:
- No "Available image assets" host files: use "pose" (her base pose) and \
optionally "focusPose" (her explaining pose) — one of "laptop" (busy \
working/typing), "explain" (standing, gesturing/presenting), or "neutral" \
(plain standing). This is the default path; it works on every video, no \
setup needed. Optionally set "color" (a hex from the scene's own palette) \
to tint her outfit to match.
- If "Available image assets" DOES list files that look like pose variants \
of the same recurring host (e.g. "host-neutral.png", "host-laptop.png" — \
judge this from a shared filename prefix, same as the per-node "character" \
kind below), use "src"/"focusSrc" with those exact filenames instead — a \
real asset always looks more polished than the drawn fallback, so prefer it \
whenever one is available. Never invent a filename that isn't listed.
Either way: pick the base pose/src by matching the segment's own action — \
"building/setting up/writing code" -> "laptop"; a plain greeting/transition \
with no diagram -> "neutral". Give the "focus" pose/src an explaining/ \
pointing character whenever this "flow" scene also has real "nodes" (a \
diagram for her to be explaining) — the renderer automatically switches to \
it the moment the diagram has something to show, and back to the base pose \
when there's no diagram, so you never have to time this yourself. Alternate \
"position" between "left" and "right" across the scenes you use her in \
rather than always the same side.

Node kind guide — pick deliberately based on what's actually being said, don't default to "box" every time:
- "box": a labeled component/step/concept with an optional one-line sublabel, \
and an optional "icon" (see the full icon list above — it is general-purpose \
and covers far more than AI topics: houses, cars, money, security, networks, \
charts, and more). Whenever a box represents a concrete visualizable thing, \
give it the closest-matching icon instead of leaving it as bare text — a box \
with a small icon plus a word reads far better than a wall of text.
- "terminal": a fake terminal window; give 2-4 short "lines" (like "$ npm test"). \
Set "error": true when the segment describes something failing, breaking, or \
not being able to do something — this draws a red X over it.
- "icon": a glowing circular icon + label, for a concrete recurring subject. \
This works for ANY topic the video is about — not just AI/agents. Pick \
whichever available icon best visually represents the actual thing being \
discussed: "house" for a building/home, "car" for a vehicle, "money" for \
finance, "lock"/"shield" for security, "globe"/"network" for the internet \
or connections, "cloud" for cloud computing/storage, "chart" for data/growth, \
"database" for storage, "book" for learning/documentation, "gear" for a \
mechanism/setting, "rocket" for launch/speed, "lightning" for power/speed, \
"chat" for conversation/messaging, "check"/"star" for success/quality, \
"search" for looking something up/finding, "robot" for a general AI \
agent/assistant (a more detailed illustrated look than a plain "brain" — \
use this when the agent itself, not just its intelligence, is the subject). \
Use \
"brain" specifically for AI/intelligence/thinking, "person" for the \
user/human in the loop, "warning" for a standalone error/failure moment \
that isn't a terminal. Use "agent-body" with a "callouts" list when the \
segment describes something (an agent, a system, a person) having several \
distinct parts or capabilities named one after another (e.g. "it can read \
files, run commands, see output") — each callout is {"label": short text, \
"anchor": one of "head"/"handLeft"/"handRight"/"legLeft"/"legRight"}, \
revealed in order; use this whenever a body-part metaphor (hands = \
actions/tools, head = thinking, legs = execution) actually fits what's \
being said — this pattern generalizes beyond agents to anything describable \
as "parts of a whole."

If the concrete thing being described has NO good match among the named \
icons above, use "icon": "custom" with a "shape" array instead of forcing a \
mismatched icon or falling back to a plain box. You are drawing with a small \
set of primitives in a 0-100 coordinate space (not writing code) — compose \
them into a simple, recognizable line-art sketch of the actual thing:
- {"type": "circle", "cx", "cy", "r"} — an outlined circle.
- {"type": "dot", "cx", "cy", "r"} — a small filled dot (e.g. an eye).
- {"type": "line", "x1", "y1", "x2", "y2"} — a straight stroke.
- {"type": "path", "points": [[x,y], ...], "closed": bool?} — a multi-point \
line or, if closed, an outline shape.
- {"type": "arc", "cx", "cy", "r", "startDeg", "endDeg"} — a curved stroke \
(0°=right, 90°=down), useful for smiles, wheels, curves a straight line can't do.
Example — a bicycle (no named icon fits, so it's drawn from primitives):
"shape": [
  {"type": "circle", "cx": 25, "cy": 70, "r": 18},
  {"type": "circle", "cx": 75, "cy": 70, "r": 18},
  {"type": "path", "points": [[25,70],[45,40],[65,40],[75,70]], "closed": false},
  {"type": "path", "points": [[45,40],[35,20],[55,20]], "closed": false},
  {"type": "line", "x1": 55, "y1": 20, "x2": 65, "y2": 40}
]
Keep it to 4-10 primitives — simple and recognizable beats detailed. This \
still gets the same live "sketching in" animation as every named icon.
- "checklist": a bordered list of short "items" (strings) with one \
"activeIndex" highlighted — use this for a fixed set of options/tools/steps \
where the segment is currently pointing at ONE specific one (e.g. naming \
which tool gets called out of a known list). Optionally add "icons" (same \
length and order as "items") to show a small icon before each item — good \
for "a directory/menu of capabilities" (e.g. search, database, code icons \
next to their labels) rather than plain text.
- "browser": a code-editor/browser-style window (top bar + address-bar-like \
line, a "> message" prompt below, optional faint placeholder "lines" under \
it representing code/text). Use this for "typing/running something in an \
editor or browser" moments — a step up from "terminal" (which is styled as \
a literal black terminal specifically for command output/errors) when the \
context is more like writing/browsing than executing.
- "layer": ONLY used inside a "stack" layout — one trapezoid platform slab. \
"label" is the layer's name (e.g. "Infrastructure"); optional "logos" is a \
row of small colored badges inside it, one per specific tool/product \
mentioned for that layer — each is {"label": short text, "color": "#hex", \
"src": filename?} (use "src" only for a listed available image asset, \
otherwise omit it and the badge shows the label's initial instead). Give \
the layer currently being discussed a fuller "logos" row; layers not yet \
or no longer being discussed can have an empty "logos" list — they'll \
automatically blur into the background until it's their turn.
- "chatbox": a rounded chat-input mockup — "label" is the message text shown \
inside it, with a small circular send button. Use this whenever the segment \
describes someone typing/asking/sending a message or prompt (e.g. "you ask \
the model a question").
- "matrix": a small monospace panel of pre-formatted "rows" (strings, e.g. \
"[ 0.02 -1.88 0.45 ]  x  [ 0.83 ] = [ 1.42 ]"), revealed one row at a time, \
with an optional "label" title above (e.g. "WEIGHTS") and "caption" below \
(e.g. "× 96 layers"). Use this for anything numeric/computational being \
described — embeddings, calculations, statistics, scores — where seeing \
actual example numbers makes the concept concrete instead of abstract.
- "badge": a colored glowing pill with bold text — use this whenever a *specific \
named tool, company, model, or product* is mentioned (e.g. "Claude", "OpenAI", \
"GitHub") AND no matching file is listed under "Available image assets" — \
check that list FIRST every time a named product comes up. This is a \
generic stand-in, NOT a real logo — just the name in a colored pill, so \
never describe or reference an actual logo design.
- "chips": a row of small pill-shaped labels inside one box, with an optional \
caption below ("chips": [str, ...]). Use this for anything enumerable said in \
quick succession — tokens, steps, tags, short list items — instead of making \
one bare box per tiny item.
- "image": shows a picture the user has provided themselves, referenced by \
"src": "<filename>". Check the "Available image assets" list in the user \
message BEFORE choosing "badge" for any named product — if a filename there \
is a plausible match (e.g. contains the product's name), you MUST use \
"image" with that exact filename instead of "badge"; "badge" is only the \
fallback for named things with no matching asset. If no assets are listed \
at all, never use "image".
- "character": shows a recurring illustrated character the user has \
provided, WITHOUT the card frame "image" uses — for a person who appears \
across the video, not a logo. If the available assets include several \
files that look like pose/expression variants of the same character (e.g. \
"character-thinking.png", "character-pointing.png", "host-neutral.png" — \
judge this from the filenames, they'll share a clear base name), pick \
whichever pose's name best matches this segment's tone or action (a segment \
about reasoning/deciding -> a "thinking" pose; a segment pointing out a \
specific thing -> a "pointing" pose) and use "character" with that exact \
filename. Don't invent a pose filename that isn't listed. If no such \
character asset exists, don't use this kind — use the scene-level \
"character" (see "Recurring host character" above) instead, which draws \
her without needing any asset at all.

Example: if "Available image assets" lists "claude-logo.webp" and the \
segment says "...like Claude...", use \
{"id": "c", "label": "Claude", "color": "#ff9d5c", "kind": "image", "src": "claude-logo.webp"} \
— not a "badge".


Edges: set "animated": true on any edge that represents something continuous or \
repeated (data flowing, requests being sent back and forth, a loop) — it draws a \
small dot travelling repeatedly along the line. Leave it false for a one-time action.

On an animated edge, add "travelIcon" whenever the segment names a specific \
transport/action verb instead of a generic dot: "rocket" for launch/deploy/ \
speed, "mail" for sending a message/request/email, "lightning" for a fast \
signal/trigger, "chat" for a notification/reply. This makes the motion \
actually depict the action being described (e.g. a little rocket flying \
toward the box when the narration says "sends it to..."), which is far more \
memorable than an anonymous dot — use it whenever a fitting verb is present, \
not just occasionally.

Each segment's scene now lasts several seconds and its nodes reveal one at a \
time automatically, spaced out across the whole scene (the code handles the \
timing, not you) — so aim for 3-6 nodes per scene when the segment has that \
much concrete content, not just 1-2. A scene that reveals one thing every \
few seconds feels alive; a scene with only one static box for its whole \
duration feels dead.

Density matters as much as correctness. A weak, lazy scene has one vague box. \
A good scene packs in every concrete entity the segment actually mentions, \
each with its own node, connected with edges whose color reflects the *kind* \
of relationship — not just picked for variety. Study this worked example \
closely; match this density and this way of using color, not the literal \
content:

Segment (shown to you bracket-indexed, exactly like the real input): \
"[0]You [1]ask [2]the [3]agent [4]to [5]fix [6]a [7]bug. [8]The [9]agent \
[10]calls [11]the [12]model, [13]which [14]tells [15]it [16]to [17]run \
[18]the [19]tests. [20]The [21]tests [22]fail [23]with [24]an [25]error, \
[26]and [27]that [28]error [29]gets [30]sent [31]back [32]to [33]the \
[34]model."

Good scene (this is the level of detail and color-per-relationship expected):
{"type": "flow", "props": {
  "title": "Coding agent",
  "layout": "tree",
  "rootPosition": "top",
  "nodes": [
    {"id": "agent", "label": "Agent", "color": "#ffb347", "kind": "box", "icon": "gear", "wordIndex": 3},
    {"id": "you", "label": "You", "color": "#9aa0ac", "kind": "icon", "icon": "person", "wordIndex": 0},
    {"id": "model", "label": "Model", "color": "#2de2e6", "kind": "icon", "icon": "brain", "wordIndex": 12},
    {"id": "term", "label": "", "color": "#ff3b5c", "kind": "terminal", "error": true, "lines": ["$ npm test", "x 1 test failing"], "wordIndex": 22}
  ],
  "edges": [
    {"from": "you", "to": "agent", "color": "#9aa0ac"},
    {"from": "agent", "to": "model", "bidirectional": true, "color": "#ffb347", "animated": true},
    {"from": "agent", "to": "term", "color": "#ffb347"},
    {"from": "term", "to": "model", "label": "error", "color": "#ff3b5c"}
  ]
}}
Notice: every distinct thing mentioned (you, the agent, the model, the \
failing test) is its own node — nothing got abstracted away or merged into \
a single generic box. The you→agent edge is neutral gray (just a request), \
the agent↔model edge matches the agent's own color and is animated (an \
ongoing exchange), and the error edge is red specifically because it \
carries an error — the color encodes the relationship, not decoration. Also \
notice every node's "wordIndex" points at the bracket number where that \
exact thing is first said — "you" at [0], "agent" at [3] (its first \
mention, not "The agent" at [9]), "model" at [12], and the failing test at \
[22] ("fail"), matching the moment the narration actually says "fail" \
rather than earlier when it only says "run the tests".

This same system applies to ANY topic, not just AI. Example for a segment \
about home security instead: "[0]A [1]smart [2]lock [3]connects [4]to \
[5]the [6]cloud, [7]which [8]alerts [9]your [10]phone [11]if [12]a \
[13]break-in [14]is [15]detected."
{"type": "flow", "props": {
  "title": "Smart security",
  "layout": "tree",
  "rootPosition": "top",
  "nodes": [
    {"id": "cloud", "label": "Cloud", "color": "#4d7cff", "kind": "icon", "icon": "cloud", "wordIndex": 6},
    {"id": "lock", "label": "Smart Lock", "color": "#39ff88", "kind": "box", "icon": "lock", "wordIndex": 2},
    {"id": "alert", "label": "Alert", "color": "#ff3b5c", "kind": "box", "icon": "warning", "wordIndex": 8}
  ],
  "edges": [
    {"from": "cloud", "to": "lock", "bidirectional": true, "color": "#4d7cff", "animated": true},
    {"from": "cloud", "to": "alert", "color": "#ff3b5c", "label": "break-in", "animated": true, "travelIcon": "mail"}
  ]
}}
Same density, same principle — concrete things (the lock, the cloud, the \
alert) each got their own node with a fitting icon, chosen from the full \
icon list, not the AI-specific ones from the first example.

A third example, specifically to show "chatbox"/"chips"/"matrix" in use — \
segment: "[0]You [1]type [2]a [3]question. [4]It [5]gets [6]split [7]into \
[8]6 [9]tokens, [10]then [11]run [12]through [13]the [14]model's [15]weights."
{"type": "flow", "props": {
  "title": "What the model does",
  "layout": "pipeline",
  "nodes": [
    {"id": "q", "label": "What's an AI agent?", "color": "#2de2e6", "kind": "chatbox", "wordIndex": 1},
    {"id": "tok", "label": "6 tokens", "color": "#4d7cff", "kind": "chips", "chips": ["What", "'s", "an", "AI", "agent", "?"], "wordIndex": 9},
    {"id": "mx", "label": "Weights", "color": "#b06bff", "kind": "matrix", "rows": ["[ 0.02 -1.88 0.45 ] x [ 0.83 ] = [ 1.42 ]"], "caption": "× 96 layers", "wordIndex": 15}
  ],
  "edges": []
}}
Whenever a segment mentions someone typing/asking something, breaking text \
into pieces, or doing a calculation/scoring numbers, reach for these three \
kinds — they exist specifically for this and are silently underused if you \
default back to "box" out of habit.

Hard rules:
- Mix layouts, scene types, and node kinds across segments — don't repeat the \
exact same layout+kind combination two segments in a row, but keep a \
consistent visual rhythm (similar sizing conventions, similar number of \
nodes per flow scene) so the video doesn't feel jarring from one segment to \
the next.
- Don't let plain "box" nodes connected by plain edges become the default \
you fall back to out of habit — across a whole video, box+arrow should be \
one recurring pattern among several, not nearly every scene. Before adding \
a "box", check whether "icon", "chips", "checklist", "terminal", "chatbox", \
"matrix", or "badge" already fits the actual content better (see the node \
kind guide above) — most of them exist precisely because a labeled box \
undersells what's being described. And not everything needs an edge at \
all: a "grid" of several parallel, unrelated items (features, tools, \
options) reads better as bare nodes with an EMPTY "edges" array than as \
boxes wired together with arrows that don't represent a real relationship \
— only draw an edge when the segment actually describes one thing acting \
on, sending to, or leading to another.
- Pick 2-3 colors per scene from: #2de2e6 (cyan), #ffb347 (orange), #ff6ec7 \
(pink), #4d7cff (blue), #ff3b5c (red), #39ff88 (green), #b06bff (purple), \
#9aa0ac (gray).
- Base every single scene's content directly and specifically on that exact \
segment's words — if it names a concrete thing (a tool, an error, a person, \
a concept), show that concrete thing using the node kinds above, don't \
abstract it away into a generic box.
- Keep every label under 4 words. Keep terminal "lines" under 8 words each.
- Give every node a "wordIndex" whenever the segment contains a word for it \
(see "TIMING each node's own entrance" above and the worked examples) — \
this is what keeps shapes/motion in sync with the actual narration instead \
of an even guess, and is expected on nearly every node, not just some.
- If the user message lists available image assets AND a segment names or \
clearly refers to the specific tool/company/subject one of those images \
depicts, you MUST use an "image" node with that exact filename for that \
segment — do not substitute a "badge" or generic box instead. Leaving an \
available, relevant image unused is a mistake, not a stylistic choice.
- If the user message lists REQUIRED assets, EVERY one of them must appear \
somewhere across the whole storyboard by the end — this is a hard \
completion check, not a suggestion. A ".gif" filename works exactly like \
any other image asset (it will actually animate in the final render); \
don't treat it differently.
- Respond with the JSON object and nothing else.
"""


def build_user_prompt(segments, notes: str = "", available_images=None, required_images=None) -> str:
    lines = [f"You will output exactly {len(segments)} scenes, one per segment, in order.\n"]
    for i, seg in enumerate(segments):
        # Each word is shown with its own bracketed index (e.g. "[3]agent")
        # instead of as one plain string — this is what lets the model
        # reference a SPECIFIC word via "wordIndex" (see the system prompt)
        # so shapes/motions can be timed to the real moment that word is
        # spoken, instead of an even guess spread across the whole segment.
        indexed = " ".join(f"[{j}]{w['word']}" for j, w in enumerate(seg))
        lines.append(f"Segment {i} ({len(seg)} words): {indexed}")
    prompt = "\n".join(lines)

    required_images = required_images or []
    # "Available" is everything scanned MINUS whatever was promoted to the
    # required tier below — kept as two separate lists so the model sees a
    # clear must-use/may-use split instead of one flat pile of filenames.
    optional_images = [f for f in (available_images or []) if f not in required_images]

    if required_images:
        prompt += (
            "\n\nREQUIRED image/gif assets — the user explicitly asked for these to "
            "appear somewhere in the video. Each one MUST be used at least once, "
            "in whichever segment(s) its content actually fits best (an \"image\" "
            "node for a picture/logo/reference, \"character\" for a recurring "
            "person, or a \"layer\"'s \"logos\" entry for a tool/product badge in a "
            "stack layout — whichever kind matches what the file actually shows). "
            "Use the filename exactly as shown, and don't force one into a segment "
            "it has nothing to do with — spread them across whichever segments are "
            f"the best fit, even if that's just one segment each: {', '.join(required_images)}\n"
        )
    if optional_images:
        prompt += (
            "\n\nAvailable image/gif assets you MAY reference via an \"image\" node's "
            f"\"src\" field when relevant (use the filename exactly as shown): {', '.join(optional_images)}\n"
        )
    if not required_images and not optional_images:
        prompt += "\n\nNo image assets are available this time — do not use the \"image\" node kind.\n"

    if notes.strip():
        prompt += (
            f"\n\nExtra instructions / feedback from the user — follow these closely, "
            f"they may override the general style defaults above:\n{notes.strip()}\n"
        )
    return prompt


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}


def scan_assets(assets_dir: str):
    """List image files the user has dropped into their assets folder, so the
    planner can reference their own logos/pictures by filename. We never
    fetch or generate these ourselves — only the user's own files are used."""
    if not assets_dir or not os.path.isdir(assets_dir):
        return []
    return sorted(
        f for f in os.listdir(assets_dir)
        if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS
    )


def call_openai(system: str, user: str, model: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("Set OPENAI_API_KEY in your environment first.")

    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "max_completion_tokens": 10000,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        },
        timeout=150,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in model output:\n{text}")
    return json.loads(match.group(0))


MIN_REVEAL_FRAME = 4  # mirrors FlowScene.tsx's own REVEAL_START, so a
# word-anchored node never pops in at frame 0 with no entrance spring to play


REVEAL_START_GUESS = 6  # mirrors FlowScene.tsx's own REVEAL_START


def guessed_reveal_frames(count, duration_in_frames):
    """Python port of FlowScene.tsx's own computeRevealFrames() — the even-
    spread fallback used when a node has no usable "wordIndex". Kept here
    (rather than leaving it unresolved for the client to guess) so EVERY
    node always has a real, absolute revealFrame before merge_continued_
    scenes() runs below — a merge just adds an offset, which only gives the
    right answer if every node's revealFrame is already meaningful on its
    own, word-anchored or not."""
    if count == 0:
        return []
    usable = max(duration_in_frames * 0.75, count * 18)
    gap = usable / count
    return [round(REVEAL_START_GUESS + i * gap) for i in range(count)]


def resolve_node_timing(nodes, seg_words, start_f, end_f):
    """Turn each node's "wordIndex" (an index into this segment's own word
    list, chosen by the model) into a "revealFrame" (a scene-relative frame
    number) using that word's REAL timestamp from the transcript. This is
    what makes a node's shape/motion appear at the exact moment its word is
    actually spoken. A node with no usable wordIndex still gets an explicit
    revealFrame (the even-spread guess) rather than being left unresolved —
    see guessed_reveal_frames() above. Timing math stays entirely here, in
    code, on real timestamps or a deterministic guess — never the model's
    own estimate, same principle the whole pipeline already follows.
    """
    duration = end_f - start_f
    max_frame = max(MIN_REVEAL_FRAME, duration - 10)
    guessed = guessed_reveal_frames(len(nodes), duration)
    resolved = []
    for i, n in enumerate(nodes):
        n = dict(n)
        wi = n.pop("wordIndex", None)
        if isinstance(wi, int) and 0 <= wi < len(seg_words):
            word_frame = round(seg_words[wi]["start"] * FPS)
            local_frame = word_frame - start_f
            n["revealFrame"] = max(MIN_REVEAL_FRAME, min(local_frame, max_frame))
        else:
            n["revealFrame"] = min(guessed[i], max_frame)
        resolved.append(n)
    return resolved


def merge_continued_scenes(scenes):
    """A flow scene whose props set "continueDiagram": true means "don't
    hard-cut — keep showing the previous flow scene's diagram and layer
    these new nodes/edges onto it," matching how the reference material
    this was benchmarked against builds ONE diagram progressively across
    many narration beats instead of replacing it every few seconds (that
    replace-every-segment default was the actual cause of the "screen keeps
    jumping" complaint — the layout engine recomputing everything from
    scratch each time, even for the "same" box, moves it).

    Runs as a pure post-processing pass over the already-fixed scene list:
    a continuing scene's nodes get folded into the preceding flow scene's
    own "nodes"/"edges" (each node's already-resolved revealFrame shifted
    by the preceding scene's cumulative duration so it still lands at the
    right real moment), its duration added on, and the continuing scene
    entry itself is dropped — one continuous FlowScene mount ends up
    playing every beat in the chain, so nothing already on screen ever
    unmounts, repositions, or pops back in.

    Node ids are namespaced per merge step to guarantee uniqueness, but an
    id-map threaded through the whole chain lets a LATER segment's edge
    still reference an EARLIER segment's node by the exact literal id the
    model used when it first introduced that node — see resolve_ref below.
    """
    # Hard ceiling on how many nodes ONE diagram is ever allowed to
    # accumulate through chained continuations. Without this, a model that
    # sets "continueDiagram" too eagerly (or for too long a run of
    # segments) can pile a dozen-plus nodes into a single "tree"/"grid"
    # layout — the layout engine still guarantees no overlap, but it does
    # that by shrinking every cell, which is exactly what turned into "all
    # the icons got tiny and jumbled together" in practice. Once a chain
    # would cross this, later segments simply start a fresh diagram instead
    # — enforced here in code, not left to the model to self-regulate.
    MAX_DIAGRAM_NODES = 6

    merged: list = []
    id_maps: list = []  # parallel to `merged`; None for non-flow scenes
    for scene in scenes:
        this_node_count = len((scene.get("props") or {}).get("nodes") or [])
        wants_continue = (
            scene.get("type") == "flow"
            and bool((scene.get("props") or {}).get("continueDiagram"))
            and merged
            and merged[-1].get("type") == "flow"
            and len((merged[-1].get("props") or {}).get("nodes") or []) + this_node_count <= MAX_DIAGRAM_NODES
        )
        if wants_continue:
            prev = merged[-1]
            prev_props = prev["props"]
            id_map = id_maps[-1]
            offset = prev["durationInFrames"]
            k = prev_props.get("_mergeCount", 0) + 1
            prefix = f"c{k}_"

            this_props = dict(scene.get("props") or {})
            this_nodes = this_props.get("nodes") or []
            this_edges = this_props.get("edges") or []

            for n in this_nodes:
                id_map[n["id"]] = prefix + n["id"]

            def resolve_ref(node_id, _id_map=id_map):
                # Not in the map -> the model is referencing a node from the
                # ORIGINAL base scene of this chain, whose id was never
                # renamed, so the literal string is already correct.
                return _id_map.get(node_id, node_id)

            renamed_nodes = []
            for n in this_nodes:
                n = dict(n)
                n["id"] = id_map[n["id"]]
                if isinstance(n.get("revealFrame"), (int, float)):
                    n["revealFrame"] = n["revealFrame"] + offset
                renamed_nodes.append(n)

            renamed_edges = []
            for e in this_edges:
                e = dict(e)
                e["from"] = resolve_ref(e["from"])
                e["to"] = resolve_ref(e["to"])
                renamed_edges.append(e)

            prev_props["nodes"] = (prev_props.get("nodes") or []) + renamed_nodes
            prev_props["edges"] = (prev_props.get("edges") or []) + renamed_edges
            prev_props["_mergeCount"] = k
            prev["durationInFrames"] += scene["durationInFrames"]
        else:
            merged.append(scene)
            id_maps.append({} if scene.get("type") == "flow" else None)

    for s in merged:
        if s.get("type") == "flow":
            s["props"].pop("_mergeCount", None)
    return merged


def strip_host_character(scenes):
    """--no-host's actual guarantee: remove any "character" the model added
    anyway, on both scene-level ("character" prop) and node-level ("kind":
    "character" nodes, dropped outright since they have no other purpose).
    An instruction in the prompt is a request; this is the enforcement."""
    cleaned = []
    for scene in scenes:
        scene = dict(scene)
        props = dict(scene.get("props") or {})
        props.pop("character", None)
        if "nodes" in props:
            props["nodes"] = [n for n in props["nodes"] if n.get("kind") != "character"]
        scene["props"] = props
        cleaned.append(scene)
    return cleaned


def find_used_assets(scenes) -> set:
    """Scan every place a filename can appear across the final storyboard, so
    we can warn (not fail — this is a safety net, not a gate) if the model
    ignored the hard "REQUIRED assets" rule for one of them."""
    used = set()
    for scene in scenes:
        props = scene.get("props") or {}
        char = props.get("character") or {}
        for key in ("src", "focusSrc"):
            if char.get(key):
                used.add(char[key])
        for n in props.get("nodes") or []:
            if n.get("src"):
                used.add(n["src"])
            for logo in n.get("logos") or []:
                if logo.get("src"):
                    used.add(logo["src"])
    return used


def fallback_scene(segment) -> dict:
    """Used only if the model returns fewer scenes than segments — keeps the
    segment's own words on screen instead of silently dropping it."""
    text = " ".join(w["word"] for w in segment)[:60]
    return {
        "type": "flow",
        "props": {
            "layout": "pipeline",
            "nodes": [{"id": "f", "label": text, "color": "#2de2e6", "kind": "box"}],
            "edges": [],
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--align", required=True, help="Path to align.json from align.py")
    parser.add_argument("--audio-file", required=True, help="Filename of the audio inside public/, e.g. voice.mp3")
    parser.add_argument("--out", default="scenes.generated.json")
    parser.add_argument("--model", default=os.environ.get("OPENAI_MODEL", "gpt-5.6-sol"))
    parser.add_argument("--notes", default="", help="Optional extra instructions/feedback to steer the storyboard")
    parser.add_argument(
        "--assets-dir",
        default="public/assets",
        help="Folder to scan for your own logo/image files the storyboard may reference (default: public/assets)",
    )
    parser.add_argument(
        "--required-assets",
        default="",
        help=(
            "Comma-separated filenames (must already be in --assets-dir) that MUST "
            "appear somewhere in the video, instead of only being available if the "
            "model happens to pick them — e.g. --required-assets \"logo.png,demo.gif\""
        ),
    )
    parser.add_argument(
        "--no-host",
        action="store_true",
        help=(
            "Disable the recurring host character entirely for this video (both the "
            "scene-level and node-level \"character\" kind, drawn or asset-based) — "
            "enforced twice: an explicit instruction in the prompt, AND every "
            "\"character\" field is stripped from the model's output afterward "
            "regardless of whether it complied, so this can't silently fail."
        ),
    )
    args = parser.parse_args()

    with open(args.align, "r", encoding="utf-8") as f:
        align = json.load(f)

    available_images = scan_assets(args.assets_dir)
    if available_images:
        print(f"Found {len(available_images)} image asset(s) in {args.assets_dir}: {', '.join(available_images)}")

    requested_required = [f.strip() for f in args.required_assets.split(",") if f.strip()]
    required_images = [f for f in requested_required if f in available_images]
    missing_required = [f for f in requested_required if f not in available_images]
    if missing_required:
        print(
            f"⚠️  Ignoring required asset(s) not found in {args.assets_dir}: {', '.join(missing_required)}"
        )
    if required_images:
        print(f"Required (must appear in the video): {', '.join(required_images)}")

    notes = args.notes
    if args.no_host:
        notes = (
            notes + "\n\n" if notes.strip() else ""
        ) + (
            "HARD OVERRIDE: do not use the recurring host character anywhere in this "
            "video — never set a \"character\" field on any \"title\" or \"flow\" "
            "scene, and never use a \"character\" node kind. Skip her entirely for "
            "this video."
        )

    target_total_frames = int(round(align["duration"] * FPS))
    segments = segment_words(align["words"])
    if not segments:
        raise SystemExit("No words found in align.json — is the audio silent or too quiet?")

    bounds = segment_frame_bounds(segments, target_total_frames)
    user_prompt = build_user_prompt(segments, notes, available_images, required_images)

    raw = call_openai(SYSTEM_PROMPT, user_prompt, args.model)
    storyboard = extract_json(raw)
    scenes = storyboard.get("scenes", [])

    fixed_scenes = []
    for i, (start_f, end_f) in enumerate(bounds):
        scene = dict(scenes[i]) if i < len(scenes) else fallback_scene(segments[i])
        scene["durationInFrames"] = end_f - start_f
        if scene.get("type") == "flow":
            props = dict(scene.get("props") or {})
            props.setdefault("nodes", [])
            props.setdefault("edges", [])
            props["nodes"] = resolve_node_timing(props["nodes"], segments[i], start_f, end_f)
            scene["props"] = props
        fixed_scenes.append(scene)

    if len(scenes) != len(segments):
        print(
            f"⚠️  Model returned {len(scenes)} scenes for {len(segments)} segments — "
            f"{'padded missing ones with a plain fallback' if len(scenes) < len(segments) else 'dropped the extras'}."
        )

    before_merge = len(fixed_scenes)
    fixed_scenes = merge_continued_scenes(fixed_scenes)
    if len(fixed_scenes) != before_merge:
        print(
            f"Merged {before_merge - len(fixed_scenes)} continuing segment(s) into their "
            f"preceding diagram (continueDiagram) -> {len(fixed_scenes)} scenes, still "
            f"{sum(s['durationInFrames'] for s in fixed_scenes)} frames total (unchanged)."
        )

    if args.no_host:
        before_strip = sum(1 for s in fixed_scenes if (s.get("props") or {}).get("character"))
        fixed_scenes = strip_host_character(fixed_scenes)
        if before_strip:
            print(f"--no-host: removed the host character from {before_strip} scene(s) the model added anyway.")

    if required_images:
        used = find_used_assets(fixed_scenes)
        unused_required = [f for f in required_images if f not in used]
        if unused_required:
            print(
                f"⚠️  The model didn't end up using {len(unused_required)} required asset(s): "
                f"{', '.join(unused_required)}. Re-run with different/more specific --notes "
                "if you need them to actually appear."
            )

    storyboard["scenes"] = fixed_scenes
    storyboard["audioSrc"] = args.audio_file
    storyboard["words"] = align["words"]

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(storyboard, f, ensure_ascii=False, indent=2)

    total = sum(s["durationInFrames"] for s in storyboard["scenes"])
    print(f"Planned {len(storyboard['scenes'])} scenes ({len(segments)} audio segments), {total} frames -> {args.out}")


if __name__ == "__main__":
    main()
