#!/usr/bin/env python3
"""Validate every flashcard library JSON file in the repository.

Checks each ``data/flashcard_libraries/<language>/<level>.json`` for the
invariants the flashcard activity assumes but never enforces:

* the document has ``metadata`` and ``words``
* ``metadata.word_count`` matches the actual number of entries
* ``metadata.language`` / ``metadata.level`` match the file's location
* every word has non-empty ``word``, ``translations``, ``examples``
* ``difficulty`` is an integer in 1-5
* ``category`` is one of the known categories
* no duplicate words within a level

Duplicates are reported as errors because the flashcard activity samples
uniformly from ``words``: a word repeated four times is drawn four times as
often, which is why the French A1 library shows 389 entries for 94 real words.

Usage::

    python -m langue.tools.vocab_validate            # all languages
    python -m langue.tools.vocab_validate -l italian
    python -m langue.tools.vocab_validate --allow-duplicates   # warn, don't fail
    python -m langue.tools.vocab_validate --fix-duplicates     # rewrite, keeping first

``--fix-duplicates`` only ever removes repeated entries and corrects
``word_count``; it never invents or edits vocabulary.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
LIBRARY_DIR = REPO_ROOT / "data" / "flashcard_libraries"

VALID_LEVELS = {"a1", "a2", "b1", "b2", "c1", "c2"}

# The 20 categories the generator prompts for, plus the ones the existing
# French libraries already use at the upper levels.
VALID_CATEGORIES = {
    "greetings", "numbers", "family", "food", "travel", "shopping", "time",
    "weather", "work", "education", "housing", "leisure", "health",
    "transportation", "technology", "nature", "arts", "sports", "emotions",
    "daily_routines",
    # Extended set.
    "basics", "language", "philosophy", "politics", "science", "business",
    "society", "abstract", "body", "clothing", "animals", "colors", "verbs",
}


class Report:
    """Accumulates errors and warnings across every library file."""

    def __init__(self) -> None:
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def error(self, where: str, message: str) -> None:
        self.errors.append(f"{where}: {message}")

    def warn(self, where: str, message: str) -> None:
        self.warnings.append(f"{where}: {message}")

    @property
    def ok(self) -> bool:
        return not self.errors


def validate_file(path: Path, report: Report, allow_duplicates: bool) -> int:
    """Validate a single library file. Returns the number of unique words."""
    where = str(path.relative_to(REPO_ROOT))

    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError as exc:
        report.error(where, f"invalid JSON: {exc}")
        return 0

    if not isinstance(data, dict):
        report.error(where, "top level is not an object")
        return 0

    metadata = data.get("metadata")
    words = data.get("words")

    if not isinstance(metadata, dict):
        report.error(where, "missing or malformed 'metadata' object")
        metadata = {}

    if not isinstance(words, list):
        report.error(where, "missing or malformed 'words' array")
        return 0

    expected_language = path.parent.name
    expected_level = path.stem

    if metadata.get("language") != expected_language:
        report.error(
            where,
            f"metadata.language is {metadata.get('language')!r}, "
            f"expected {expected_language!r} from the directory name",
        )

    if metadata.get("level") != expected_level:
        report.error(
            where,
            f"metadata.level is {metadata.get('level')!r}, "
            f"expected {expected_level!r} from the file name",
        )

    if expected_level not in VALID_LEVELS:
        report.error(where, f"{expected_level!r} is not a CEFR level")

    if metadata.get("word_count") != len(words):
        report.error(
            where,
            f"metadata.word_count is {metadata.get('word_count')}, "
            f"but the library holds {len(words)} entries",
        )

    counts: Counter = Counter()

    for index, entry in enumerate(words):
        item = f"{where}[{index}]"

        if not isinstance(entry, dict):
            report.error(item, "entry is not an object")
            continue

        word = entry.get("word")
        if not isinstance(word, str) or not word.strip():
            report.error(item, "missing or empty 'word'")
            continue

        counts[word.lower()] += 1

        translations = entry.get("translations")
        if not isinstance(translations, list) or not translations:
            report.error(item, f"{word!r} has no translations")
        elif any(not isinstance(t, str) or not t.strip() for t in translations):
            report.error(item, f"{word!r} has an empty translation")

        examples = entry.get("examples")
        if not isinstance(examples, list) or not examples:
            report.error(item, f"{word!r} has no example sentences")
        elif any(not isinstance(e, str) or not e.strip() for e in examples):
            report.error(item, f"{word!r} has an empty example sentence")

        category = entry.get("category")
        if category not in VALID_CATEGORIES:
            report.error(item, f"{word!r} has unknown category {category!r}")

        difficulty = entry.get("difficulty")
        if not isinstance(difficulty, int) or isinstance(difficulty, bool):
            report.error(item, f"{word!r} has non-integer difficulty {difficulty!r}")
        elif not 1 <= difficulty <= 5:
            report.error(item, f"{word!r} has difficulty {difficulty} outside 1-5")

    duplicates = {word: n for word, n in counts.items() if n > 1}
    if duplicates:
        worst = sorted(duplicates.items(), key=lambda kv: -kv[1])[:5]
        detail = ", ".join(f"{word!r}×{n}" for word, n in worst)
        message = (
            f"{len(duplicates)} duplicated word(s) inflate {len(words)} entries "
            f"to {len(counts)} unique — {detail}"
        )
        if allow_duplicates:
            report.warn(where, message)
        else:
            report.error(where, message)

    return len(counts)


def validate_across_levels(language_dir: Path, report: Report) -> None:
    """Warn when a word appears at more than one level for the same language.

    Reported as a warning, not an error, because a repeat is sometimes
    legitimate — Portuguese "patente" is both "patent" and "evident". But it is
    always worth a look, because ``getWordsUpToLevel`` (and the CLI's
    equivalent) dedupe by headword and keep the *lowest* level, so the
    higher-level sense silently becomes unreachable.
    """
    first_seen: Dict[str, str] = {}
    repeats: Dict[str, List[str]] = {}

    for level in ("a1", "a2", "b1", "b2", "c1", "c2"):
        path = language_dir / f"{level}.json"
        if not path.exists():
            continue
        try:
            with path.open(encoding="utf-8") as handle:
                words = json.load(handle).get("words", [])
        except (json.JSONDecodeError, OSError):
            continue  # already reported by validate_file

        for entry in words:
            if not isinstance(entry, dict) or not isinstance(entry.get("word"), str):
                continue
            key = entry["word"].lower()
            if key in first_seen:
                repeats.setdefault(key, [first_seen[key]]).append(level)
            else:
                first_seen[key] = level

    if repeats:
        detail = ", ".join(
            f"{word!r} ({'+'.join(levels)})" for word, levels in list(repeats.items())[:5]
        )
        more = f", and {len(repeats) - 5} more" if len(repeats) > 5 else ""
        report.warn(
            language_dir.name,
            f"{len(repeats)} word(s) appear at more than one level — only the "
            f"lowest is reachable: {detail}{more}",
        )


def validate_language_contamination(report: Report) -> None:
    """Flag a language whose vocabulary is largely another language's.

    ``create_offline_library`` resolves its fallback word list with
    ``basic_words.get(language, basic_words["spanish"])``, so generating a
    library for any language it does not know writes **Spanish** under that
    language's name. That is how german/a1.json ended up as ten Spanish words
    labelled German — a learner picking German is taught Spanish.

    Heuristic: if most of a language's headwords also appear in another
    language's library, something upstream substituted the wrong list. Genuine
    cognates between Romance languages exist but rarely dominate a whole level.
    """
    inventory: Dict[str, set] = {}

    for language_dir in sorted(LIBRARY_DIR.iterdir()):
        if not language_dir.is_dir():
            continue
        words: set = set()
        for path in language_dir.glob("*.json"):
            try:
                with path.open(encoding="utf-8") as handle:
                    data = json.load(handle)
            except (json.JSONDecodeError, OSError):
                continue
            for entry in data.get("words", []):
                if isinstance(entry, dict) and isinstance(entry.get("word"), str):
                    words.add(entry["word"].lower())
        if words:
            inventory[language_dir.name] = words

    for language, words in inventory.items():
        for other, other_words in inventory.items():
            if other == language:
                continue
            shared = words & other_words
            ratio = len(shared) / len(words)
            if ratio >= 0.5:
                sample = ", ".join(sorted(shared)[:6])
                report.error(
                    language,
                    f"{ratio:.0%} of its {len(words)} words also appear in "
                    f"{other!r} — this library looks like {other} mislabelled "
                    f"as {language}: {sample}",
                )


def deduplicate_file(path: Path) -> int:
    """Drop repeated words from a library, keeping the first occurrence.

    Returns the number of entries removed. Only touches ``words`` and
    ``metadata.word_count`` — every surviving entry is left byte-for-byte as it
    was, so this can never change a translation or an example sentence.
    """
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)

    words = data.get("words")
    if not isinstance(words, list):
        return 0

    seen: set = set()
    kept: List[Any] = []
    for entry in words:
        if not isinstance(entry, dict) or not isinstance(entry.get("word"), str):
            kept.append(entry)
            continue
        key = entry["word"].lower()
        if key in seen:
            continue
        seen.add(key)
        kept.append(entry)

    removed = len(words) - len(kept)
    if not removed:
        return 0

    data["words"] = kept
    if isinstance(data.get("metadata"), dict):
        data["metadata"]["word_count"] = len(kept)

    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    return removed


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--language", "-l", action="append", dest="languages",
                        help="Language to validate (repeatable). Default: all.")
    parser.add_argument("--allow-duplicates", action="store_true",
                        help="Report duplicate words as warnings instead of errors.")
    parser.add_argument("--fix-duplicates", action="store_true",
                        help="Rewrite libraries to drop repeated words (keeps the first).")
    args = parser.parse_args(argv)

    if not LIBRARY_DIR.is_dir():
        print(f"No library directory at {LIBRARY_DIR}", file=sys.stderr)
        return 1

    languages = args.languages or sorted(
        p.name for p in LIBRARY_DIR.iterdir() if p.is_dir()
    )

    if args.fix_duplicates:
        total_removed = 0
        for language in languages:
            for path in sorted((LIBRARY_DIR / language.lower()).glob("*.json")):
                removed = deduplicate_file(path)
                if removed:
                    total_removed += removed
                    print(f"{path.relative_to(REPO_ROOT)}: removed {removed} duplicate(s)")
        print(f"\nremoved {total_removed} duplicate entr(ies)\n")

    report = Report()
    totals: Dict[str, int] = {}

    for language in languages:
        language_dir = LIBRARY_DIR / language.lower()
        if not language_dir.is_dir():
            report.error(language, "no such language directory")
            continue

        files = sorted(language_dir.glob("*.json"))
        if not files:
            report.error(language, "no library files")
            continue

        totals[language] = sum(
            validate_file(path, report, args.allow_duplicates) for path in files
        )
        validate_across_levels(language_dir, report)

    # Only meaningful across the whole set, so it runs once after every
    # language has been read.
    validate_language_contamination(report)

    for language, unique in sorted(totals.items()):
        levels = len(list((LIBRARY_DIR / language).glob("*.json")))
        print(f"{language:12} {levels} level(s), {unique} unique words")

    if report.warnings:
        print(f"\n{len(report.warnings)} warning(s):")
        for warning in report.warnings:
            print(f"  - {warning}")

    if report.errors:
        print(f"\n{len(report.errors)} error(s):", file=sys.stderr)
        for error in report.errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("\nAll libraries valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
