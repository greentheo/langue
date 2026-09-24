#!/usr/bin/env python3
"""Build flashcard libraries from compact pipe-separated vocabulary sources.

Hand-authoring ~100 words per CEFR level as raw JSON is unreviewable: the diffs
are dominated by punctuation and the metadata block has to be kept in sync by
hand. Instead the vocabulary lives in ``data/vocab_sources/<language>/<level>.psv``
as one word per line::

    word | translation; translation | example sentence | category | difficulty

and this script expands it into the JSON layout the app reads from
``data/flashcard_libraries/<language>/<level>.json``.

The JSON files are generated artifacts. Edit the ``.psv`` source and rebuild::

    python -m langue.tools.vocab_build                 # every language
    python -m langue.tools.vocab_build --language italian
    python -m langue.tools.vocab_build --check         # fail if JSON is stale

``--check`` regenerates in memory and compares, so CI catches a JSON file that
was edited directly or a source change that was never built.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]

LEVEL_DESCRIPTIONS = {
    "a1": "Beginner (A1) {language} vocabulary: everyday expressions and basic phrases",
    "a2": "Elementary (A2) {language} vocabulary: personal information, shopping, local geography",
    "b1": "Intermediate (B1) {language} vocabulary: work, travel, and personal interests",
    "b2": "Upper-intermediate (B2) {language} vocabulary: abstract topics and technical discussion",
    "c1": "Advanced (C1) {language} vocabulary: idiomatic, professional, and nuanced usage",
    "c2": "Mastery (C2) {language} vocabulary: specialized, literary, and culturally loaded terms",
}

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = REPO_ROOT / "data" / "vocab_sources"

# The single source of truth at runtime: LibraryManager resolves to this path.
# The langue/data/flashcard_libraries tree is a stale, unread mirror — packaging
# the libraries properly is tracked separately rather than kept in sync by hand.
OUTPUT_DIR = REPO_ROOT / "data" / "flashcard_libraries"


class SourceError(Exception):
    """A vocabulary source file could not be parsed."""


def parse_source(path: Path) -> List[Dict[str, Any]]:
    """Parse one ``.psv`` source file into a list of word dictionaries.

    Blank lines and ``#`` comments are ignored so sources can be grouped by
    theme with headings.
    """
    words: List[Dict[str, Any]] = []
    seen: Dict[str, int] = {}

    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        fields = [field.strip() for field in line.split("|")]
        if len(fields) != 5:
            raise SourceError(
                f"{path}:{lineno}: expected 5 pipe-separated fields "
                f"(word|translations|example|category|difficulty), got {len(fields)}"
            )

        word, translations_raw, example, category, difficulty_raw = fields

        if not word:
            raise SourceError(f"{path}:{lineno}: empty word")

        key = word.lower()
        if key in seen:
            raise SourceError(
                f"{path}:{lineno}: duplicate word {word!r} (first seen on line {seen[key]})"
            )
        seen[key] = lineno

        translations = [t.strip() for t in translations_raw.split(";") if t.strip()]
        if not translations:
            raise SourceError(f"{path}:{lineno}: {word!r} has no translations")

        if not example:
            raise SourceError(f"{path}:{lineno}: {word!r} has no example sentence")

        if not category:
            raise SourceError(f"{path}:{lineno}: {word!r} has no category")

        try:
            difficulty = int(difficulty_raw)
        except ValueError as exc:
            raise SourceError(
                f"{path}:{lineno}: {word!r} has non-numeric difficulty {difficulty_raw!r}"
            ) from exc

        if not 1 <= difficulty <= 5:
            raise SourceError(
                f"{path}:{lineno}: {word!r} difficulty {difficulty} outside 1-5"
            )

        words.append(
            {
                "word": word,
                "translations": translations,
                "examples": [example],
                "category": category,
                "difficulty": difficulty,
            }
        )

    if not words:
        raise SourceError(f"{path}: no vocabulary entries found")

    return words


def build_library(language: str, level: str, words: List[Dict[str, Any]],
                  created_at: str) -> Dict[str, Any]:
    """Assemble the full library document for one language/level."""
    description = LEVEL_DESCRIPTIONS[level].format(language=language.capitalize())
    return {
        "metadata": {
            "language": language.lower(),
            "level": level,
            "version": "1.0",
            "word_count": len(words),
            "created_at": created_at,
            "description": description,
            "source": f"data/vocab_sources/{language.lower()}/{level}.psv",
            "generated_by": "langue.tools.vocab_build",
        },
        "words": words,
    }


def render(library: Dict[str, Any]) -> str:
    """Serialize a library to the on-disk JSON form (stable, UTF-8, trailing newline)."""
    return json.dumps(library, ensure_ascii=False, indent=2) + "\n"


def discover_languages() -> List[str]:
    """Language directories that have vocabulary sources, in alphabetical order."""
    if not SOURCE_DIR.is_dir():
        return []
    return sorted(p.name for p in SOURCE_DIR.iterdir() if p.is_dir())


def existing_created_at(output_path: Path, fallback: str) -> str:
    """Preserve the original ``created_at`` so rebuilds produce no spurious diff."""
    if not output_path.exists():
        return fallback
    try:
        with output_path.open(encoding="utf-8") as handle:
            return json.load(handle)["metadata"]["created_at"]
    except (json.JSONDecodeError, KeyError, OSError):
        return fallback


def build_language(language: str, check_only: bool) -> Tuple[int, List[str]]:
    """Build every level for one language.

    Returns the number of words written and a list of problems found. In
    ``check_only`` mode nothing is written; stale outputs are reported instead.
    """
    now = datetime.now(timezone.utc).isoformat()
    total = 0
    problems: List[str] = []

    for level in LEVELS:
        source_path = SOURCE_DIR / language / f"{level}.psv"
        if not source_path.exists():
            problems.append(f"{language}/{level}: missing source {source_path}")
            continue

        words = parse_source(source_path)
        total += len(words)

        output_path = OUTPUT_DIR / language / f"{level}.json"
        created = existing_created_at(output_path, now)
        payload = render(build_library(language, level, words, created))

        if check_only:
            current = output_path.read_text(encoding="utf-8") if output_path.exists() else ""
            if current != payload:
                problems.append(
                    f"{output_path.relative_to(REPO_ROOT)}: stale — rerun "
                    f"`python -m langue.tools.vocab_build --language {language}`"
                )
        else:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(payload, encoding="utf-8")
            print(f"  {language}/{level}: {len(words)} words")

    return total, problems


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--language", "-l", action="append", dest="languages",
                        help="Language to build (repeatable). Default: every language with sources.")
    parser.add_argument("--check", action="store_true",
                        help="Verify generated JSON is up to date without writing.")
    args = parser.parse_args(argv)

    languages = args.languages or discover_languages()
    if not languages:
        print(f"No vocabulary sources found under {SOURCE_DIR}", file=sys.stderr)
        return 1

    grand_total = 0
    all_problems: List[str] = []

    for language in languages:
        if not args.check:
            print(f"{language}:")
        try:
            total, problems = build_language(language.lower(), args.check)
        except SourceError as exc:
            all_problems.append(str(exc))
            continue
        grand_total += total
        all_problems.extend(problems)

    if all_problems:
        print(f"\n{len(all_problems)} problem(s):", file=sys.stderr)
        for problem in all_problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    action = "verified" if args.check else "wrote"
    print(f"\n{action} {grand_total} words across {len(languages)} language(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
