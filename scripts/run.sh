#!/usr/bin/env bash
# Usage:
#   scripts/run.sh <voice-file> [output-name.mp4] [script.txt] [language-code] [required-assets]
#
# Examples:
#   scripts/run.sh public/voice.mp3
#   scripts/run.sh public/voice.mp3 my-video.mp4
#   scripts/run.sh public/voice.mp3 my-video.mp4 script.txt fa
#   scripts/run.sh public/voice.mp3 my-video.mp4 "" "" "logo.png,demo.gif"
#
# - <voice-file>     required. Can already live inside public/ or anywhere else.
# - [output-name.mp4] optional, defaults to final.mp4, written to out/.
# - [script.txt]      optional. If you already wrote the exact narration,
#                      pass it here so the video uses your real wording
#                      instead of Whisper's automatic transcription.
# - [language-code]   optional, e.g. "fa" for Persian, "en" for English.
#                      Improves transcription accuracy; omit to auto-detect.
# - [required-assets] optional, comma-separated filenames already in
#                      public/assets/ that MUST appear somewhere in the
#                      video, instead of only being used if the AI director
#                      happens to pick them on its own.
set -euo pipefail

VOICE_PATH="${1:?Usage: scripts/run.sh path/to/voice.mp3 [output.mp4] [script.txt] [language] [required-assets]}"
OUT_NAME="${2:-final.mp4}"
SCRIPT_PATH="${3:-}"
LANGUAGE="${4:-}"
REQUIRED_ASSETS="${5:-}"
FILENAME="$(basename "$VOICE_PATH")"
DEST="public/$FILENAME"

echo "== 1/4 Placing audio in public/ =="
SAME_FILE=$(python3 -c "import os,sys; print(os.path.abspath(sys.argv[1]) == os.path.abspath(sys.argv[2]))" "$VOICE_PATH" "$DEST" 2>/dev/null || echo "False")
if [ "$SAME_FILE" != "True" ]; then
  cp "$VOICE_PATH" "$DEST"
else
  echo "  (already in public/, skipping copy)"
fi

echo "== 2/4 Aligning audio (local, free) =="
if [ -n "$LANGUAGE" ]; then
  python3 scripts/align.py --audio "$DEST" --out align.json --language "$LANGUAGE"
else
  python3 scripts/align.py --audio "$DEST" --out align.json
fi

if [ -n "$SCRIPT_PATH" ]; then
  echo "== 2b/4 Using your exact script text instead of the auto-transcription =="
  python3 scripts/inject_script.py --align align.json --script "$SCRIPT_PATH"
fi

echo "== 3/4 Planning scenes with OpenAI (a few cents) =="
if [ -n "$REQUIRED_ASSETS" ]; then
  python3 scripts/plan_scenes.py --align align.json --audio-file "$FILENAME" --out scenes.generated.json --required-assets "$REQUIRED_ASSETS"
else
  python3 scripts/plan_scenes.py --align align.json --audio-file "$FILENAME" --out scenes.generated.json
fi

echo "== 4/4 Rendering both formats from the same storyboard (same length as your audio) =="
BASE="${OUT_NAME%.*}"
VERTICAL_OUT="out/$BASE-instagram.mp4"
LANDSCAPE_OUT="out/$BASE-youtube.mp4"

echo "  -> vertical 1080x1920 (Instagram/Reels/Shorts)"
npx remotion render src/index.ts MainVideo "$VERTICAL_OUT" --props=scenes.generated.json

echo "  -> landscape 1920x1080 (YouTube standard)"
npx remotion render src/index.ts MainVideoYouTube "$LANDSCAPE_OUT" --props=scenes.generated.json

echo "Done -> $VERTICAL_OUT, $LANDSCAPE_OUT"
