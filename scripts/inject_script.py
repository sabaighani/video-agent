"""
inject_script.py — if you already wrote an exact script and read it aloud,
use this to:
  1. Replace Whisper's (possibly imperfect) transcription with your real
     script text — used by the scene planner for content.
  2. Cross-check Whisper's word-by-word output against your script and swap
     in your script's wording wherever the two clearly line up, while
     keeping Whisper's timestamps. This measurably reduces caption errors,
     since Whisper timestamps are usually right even when it mishears a
     word. This is a best-effort correction, not perfect — voice and script
     are rarely 100% identical word-for-word.

Usage:
    python scripts/inject_script.py --align align.json --script script.txt
"""
import argparse
import difflib
import json
import re

# Whisper's ASR output and a hand-typed Persian script routinely spell the
# *same* word with different Arabic-script code points — Arabic yeh/kaf/teh-
# marbuta instead of Persian yeh/keh/heh, Arabic-Indic digits, stray
# diacritics (i'rab/tashkeel marks), and zero-width joiners/non-joiners in
# different places. None of that changes what the word IS, but it made the
# matcher below see two DIFFERENT tokens and skip a correction it should
# have made — this was a real, silent source of "misheard word"/"spelling
# mistake" captions even when a correct --script was supplied. Folding both
# sides to one canonical form before comparing (never before *displaying* —
# the actual output text is always the original script/Whisper wording)
# fixes this without touching anything else.
#
# Written with explicit \\uXXXX escapes rather than literal Arabic/Persian
# characters in the source, since bidi text mixed with hyphens/brackets in
# an LTR-oriented source file is easy to mis-copy or mis-render — code
# points are unambiguous regardless of how a terminal/editor displays them.
_CHAR_FOLD = str.maketrans(
    {
        "ي": "ی",  # Arabic yeh -> Persian yeh (ی)
        "ى": "ی",  # alef maksura -> Persian yeh
        "ئ": "ی",  # yeh with hamza above -> Persian yeh
        "ك": "ک",  # Arabic kaf -> Persian keh (ک)
        "ة": "ه",  # teh marbuta -> heh (ه)
        "‌": "",  # ZWNJ — spacing artifact, not a letter
        "‍": "",  # ZWJ — spacing artifact, not a letter
        "ـ": "",  # tatweel/kashida — pure stretch mark, no phonetic content
        # Arabic-Indic and Extended Arabic-Indic digits -> plain ASCII digits
        "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
        "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
        "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
        "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    }
)
# Arabic diacritics (fatha/damma/kasra/tanwin/sukun/shadda/superscript alef,
# small high marks) — pronunciation marks frequently present in one source
# and absent in the other for no meaningful reason.
_DIACRITICS = re.compile("[ً-ٰٟۖ-ۭ]")


def normalize(token: str) -> str:
    t = token.translate(_CHAR_FOLD)
    t = _DIACRITICS.sub("", t)
    return re.sub(r"[^\w]", "", t, flags=re.UNICODE).lower()


def tokenize(text: str):
    return re.findall(r"\S+", text)


def correct_words(whisper_words, script_text):
    script_tokens = tokenize(script_text)
    whisper_tokens = [w["word"] for w in whisper_words]

    norm_whisper = [normalize(t) for t in whisper_tokens]
    norm_script = [normalize(t) for t in script_tokens]

    matcher = difflib.SequenceMatcher(a=norm_whisper, b=norm_script, autojunk=False)
    corrected = []
    replaced_count = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        wlen = i2 - i1
        slen = j2 - j1
        if tag == "equal":
            for k in range(wlen):
                w = whisper_words[i1 + k]
                corrected.append({"word": script_tokens[j1 + k], "start": w["start"], "end": w["end"]})
        elif tag == "replace" and slen > 0:
            # Real speech vs. a written script almost never lines up 1:1
            # (filler words, contractions, slightly different phrasing), so
            # requiring equal counts meant most mismatches were never
            # corrected. Instead, distribute the script's words across
            # Whisper's timestamps proportionally by position — every
            # Whisper word in this stretch still gets a real timestamp, and
            # now also gets the script's (correctly spelled, correctly
            # cased — e.g. English loanwords stay in English) wording.
            if wlen >= slen:
                # Whisper produced as many or more word-tokens than the
                # script has here (e.g. it split one mis-heard word into
                # two) — sample one script index per Whisper word, merging
                # into the previous caption instead of repeating the same
                # word a second time in a row when several k's land on the
                # same script index (that repetition used to read as a
                # stutter/typo, e.g. "the the model").
                last_j = None
                for k in range(wlen):
                    w = whisper_words[i1 + k]
                    j = j1 + min(slen - 1, round(k * slen / wlen))
                    if j == last_j and corrected:
                        corrected[-1]["end"] = w["end"]
                    else:
                        corrected.append({"word": script_tokens[j], "start": w["start"], "end": w["end"]})
                        replaced_count += 1
                        last_j = j
            else:
                # Fewer Whisper timestamps than script words in this stretch
                # (a short connector word got elided in speech, or Whisper
                # simply missed one — e.g. "دور و دور" heard as just two
                # beats). Sampling one script index per Whisper word would
                # SKIP the words in between entirely, silently dropping them
                # from the captions — instead, split the script words into
                # `wlen` contiguous groups and give each whole group to one
                # Whisper timestamp, joined with a space. Nothing gets
                # dropped; the trade-off is that a group's words share one
                # timestamp/highlight window instead of each having its own.
                bounds = [round(k * slen / wlen) for k in range(wlen + 1)]
                bounds[0], bounds[-1] = 0, slen
                for k in range(wlen):
                    w = whisper_words[i1 + k]
                    chunk = script_tokens[j1 + bounds[k]: j1 + bounds[k + 1]]
                    if not chunk:
                        continue
                    corrected.append({"word": " ".join(chunk), "start": w["start"], "end": w["end"]})
                    replaced_count += 1
        else:
            # Pure delete: Whisper heard something with no script counterpart
            # at all (e.g. genuine filler) — keep its own word/timestamp.
            for k in range(wlen):
                corrected.append(whisper_words[i1 + k])
        # Pure "insert" (script has extra words Whisper never heard at all)
        # is skipped — there's no timestamp to attach them to.

    return corrected, replaced_count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--align", required=True, help="align.json produced by align.py")
    parser.add_argument("--script", required=True, help="Plain text file with your exact narration")
    parser.add_argument("--out", default=None, help="Defaults to overwriting --align in place")
    args = parser.parse_args()

    with open(args.align, "r", encoding="utf-8") as f:
        align = json.load(f)

    with open(args.script, "r", encoding="utf-8") as f:
        script_text = f.read().strip()

    align["transcript"] = script_text

    corrected_words, replaced_count = correct_words(align["words"], script_text)
    align["words"] = corrected_words

    out_path = args.out or args.align
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(align, f, ensure_ascii=False, indent=2)

    print(
        f"Injected your script ({len(script_text)} chars) into {out_path}. "
        f"Corrected {replaced_count}/{len(corrected_words)} caption words to match your script text "
        f"(timestamps unchanged)."
    )


if __name__ == "__main__":
    main()
