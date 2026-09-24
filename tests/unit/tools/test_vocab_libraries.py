"""Regression tests for the vocabulary libraries and their build pipeline.

Covers two things that used to go wrong silently:

1. The shipped JSON libraries were malformed in ways nothing checked — most
   visibly the French A1 set, where the offline generator padded a 5-word
   fallback list up to the requested count by repeating it, leaving 'bonjour'
   in the deck 60 times out of 389 entries.
2. Generated JSON could drift from its ``.psv`` source with no signal.

These tests run the same validator and builder the developer tooling uses, so
a bad hand-edit to either the sources or the generated libraries fails here.
"""

import unittest
from pathlib import Path

from langue.tools import vocab_build, vocab_validate

# Languages with a full A1-C2 set built from .psv sources.
SOURCED_LANGUAGES = ["french", "italian", "portuguese", "spanish"]

MIN_WORDS_PER_LEVEL = 75


class TestVocabularyLibraries(unittest.TestCase):
    """The shipped JSON libraries satisfy every invariant the app assumes."""

    def test_all_libraries_validate(self):
        """Every library file passes schema, category, and duplicate checks."""
        report = vocab_validate.Report()
        checked = 0

        for language_dir in sorted(vocab_validate.LIBRARY_DIR.iterdir()):
            if not language_dir.is_dir():
                continue
            for path in sorted(language_dir.glob("*.json")):
                vocab_validate.validate_file(path, report, allow_duplicates=False)
                checked += 1

        self.assertGreater(checked, 0, "no library files were found to validate")
        self.assertEqual(
            report.errors, [],
            "library validation failed:\n  " + "\n  ".join(report.errors),
        )

    def test_no_language_is_another_language_mislabelled(self):
        """No library is mostly another language's vocabulary.

        ``create_offline_library`` falls back to Spanish for any language it
        does not recognise and writes it under the requested name, which is how
        german/a1.json came to hold ten Spanish words labelled German. That
        library has been removed; this stops an equivalent one appearing.
        """
        report = vocab_validate.Report()
        vocab_validate.validate_language_contamination(report)
        self.assertEqual(
            report.errors, [],
            "a library looks like another language:\n  " + "\n  ".join(report.errors),
        )

    def test_no_cross_level_duplicates_in_sourced_languages(self):
        """A word appears at one level only, so no sense is unreachable.

        ``getWordsUpToLevel`` and the CLI's equivalent dedupe by headword and
        keep the lowest level, so the same word at two levels silently hides
        the higher-level entry.
        """
        for language in SOURCED_LANGUAGES:
            with self.subTest(language=language):
                report = vocab_validate.Report()
                vocab_validate.validate_across_levels(
                    vocab_validate.LIBRARY_DIR / language, report
                )
                self.assertEqual(
                    report.warnings, [],
                    "\n  ".join(report.warnings),
                )

    def test_no_duplicate_words_in_any_library(self):
        """A word appears at most once per level, so sampling stays uniform."""
        for language_dir in sorted(vocab_validate.LIBRARY_DIR.iterdir()):
            if not language_dir.is_dir():
                continue
            for path in sorted(language_dir.glob("*.json")):
                with self.subTest(library=path.name, language=language_dir.name):
                    import json
                    with path.open(encoding="utf-8") as handle:
                        words = json.load(handle)["words"]
                    seen = [w["word"].lower() for w in words]
                    self.assertEqual(
                        len(seen), len(set(seen)),
                        f"{path.name} repeats words; rerun "
                        f"`python -m langue.tools.vocab_validate --fix-duplicates`",
                    )

    def test_sourced_languages_cover_every_level(self):
        """Italian, Portuguese, and Spanish each have a usable A1-C2 set."""
        for language in SOURCED_LANGUAGES:
            for level in vocab_build.LEVELS:
                with self.subTest(language=language, level=level):
                    path = vocab_validate.LIBRARY_DIR / language / f"{level}.json"
                    self.assertTrue(path.exists(), f"missing {language}/{level}.json")

                    import json
                    with path.open(encoding="utf-8") as handle:
                        data = json.load(handle)

                    self.assertGreaterEqual(
                        len(data["words"]), MIN_WORDS_PER_LEVEL,
                        f"{language}/{level} has only {len(data['words'])} words",
                    )


class TestVocabularyBuild(unittest.TestCase):
    """The generated JSON is in sync with the .psv sources it comes from."""

    def test_generated_libraries_are_up_to_date(self):
        """`vocab_build --check` passes, so no source change went unbuilt."""
        exit_code = vocab_build.main(["--check"])
        self.assertEqual(
            exit_code, 0,
            "generated libraries are stale; run `python -m langue.tools.vocab_build`",
        )

    def test_sources_parse_and_reject_duplicates(self):
        """Every .psv source parses, and the parser rejects a repeated word."""
        for language in SOURCED_LANGUAGES:
            for level in vocab_build.LEVELS:
                with self.subTest(language=language, level=level):
                    path = vocab_build.SOURCE_DIR / language / f"{level}.psv"
                    words = vocab_build.parse_source(path)
                    self.assertGreaterEqual(len(words), MIN_WORDS_PER_LEVEL)

    def test_parser_rejects_malformed_lines(self):
        """A source line with the wrong field count is a hard error."""
        import tempfile

        cases = {
            "too few fields": "ciao | hello | Ciao! | greetings\n",
            "empty translations": "ciao |  | Ciao! | greetings | 1\n",
            "difficulty out of range": "ciao | hello | Ciao! | greetings | 9\n",
            "duplicate word": (
                "ciao | hello | Ciao! | greetings | 1\n"
                "ciao | hi | Ciao di nuovo! | greetings | 1\n"
            ),
        }

        for name, content in cases.items():
            with self.subTest(case=name):
                with tempfile.NamedTemporaryFile(
                    "w", suffix=".psv", encoding="utf-8", delete=False
                ) as handle:
                    handle.write(content)
                    temp_path = Path(handle.name)
                try:
                    with self.assertRaises(vocab_build.SourceError):
                        vocab_build.parse_source(temp_path)
                finally:
                    temp_path.unlink()


class TestDeduplication(unittest.TestCase):
    """`--fix-duplicates` removes repeats without altering surviving entries."""

    def test_deduplicate_preserves_first_occurrence_and_content(self):
        import json
        import tempfile

        payload = {
            "metadata": {"language": "test", "level": "a1", "word_count": 3},
            "words": [
                {"word": "uno", "translations": ["one"], "examples": ["Uno."],
                 "category": "numbers", "difficulty": 1},
                {"word": "due", "translations": ["two"], "examples": ["Due."],
                 "category": "numbers", "difficulty": 1},
                {"word": "Uno", "translations": ["ONE"], "examples": ["Different."],
                 "category": "basics", "difficulty": 5},
            ],
        }

        with tempfile.NamedTemporaryFile(
            "w", suffix=".json", encoding="utf-8", delete=False
        ) as handle:
            json.dump(payload, handle)
            temp_path = Path(handle.name)

        try:
            removed = vocab_validate.deduplicate_file(temp_path)
            self.assertEqual(removed, 1)

            with temp_path.open(encoding="utf-8") as handle:
                result = json.load(handle)

            self.assertEqual([w["word"] for w in result["words"]], ["uno", "due"])
            self.assertEqual(result["metadata"]["word_count"], 2)
            # The kept entry is untouched, not merged with the duplicate.
            self.assertEqual(result["words"][0]["translations"], ["one"])
            self.assertEqual(result["words"][0]["difficulty"], 1)
        finally:
            temp_path.unlink()


if __name__ == "__main__":
    unittest.main()
