"""
align.py — transcribe a voice file and extract word-level timestamps.

Runs 100% locally and for free using faster-whisper (no API cost). The first
run downloads the model weights once (needs normal internet access on your
machine; the sandbox this project was drafted in blocks that download, so
this step is untested in-sandbox but is a standard, well-supported flow).

Usage:
    python scripts/align.py --audio public/voice.mp3 --out align.json
"""
import argparse
import json

from faster_whisper import WhisperModel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True, help="Path to the voice file (mp3/wav/m4a...)")
    parser.add_argument("--out", default="align.json", help="Where to write the alignment JSON")
    parser.add_argument(
        "--model",
        default="small",
        help="Whisper model size: tiny/base/small/medium/large-v3. Bigger = more accurate, slower.",
    )
    parser.add_argument("--language", default=None, help="Force a language code, e.g. 'fa' or 'en'")
    args = parser.parse_args()

    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        args.audio,
        word_timestamps=True,
        language=args.language,
    )

    words = []
    full_text_parts = []
    last_end = 0.0
    for segment in segments:
        full_text_parts.append(segment.text.strip())
        for w in segment.words or []:
            words.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)})
            last_end = max(last_end, w.end)

    result = {
        "audio": args.audio,
        "language": info.language,
        "duration": round(info.duration, 3),
        "transcript": " ".join(full_text_parts),
        "words": words,
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(words)} words, duration {result['duration']}s -> {args.out}")


if __name__ == "__main__":
    main()
