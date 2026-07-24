"""Regression tests for phrase / grammatical-unit flashcards.

Covers the generator's parsing + normalization of the extended schema and the
runtime bridge/rendering, including backward-compatibility with old word-only
libraries. No network — the generator is driven with a stubbed model.
"""

import os
import unittest
from unittest.mock import MagicMock, patch

from langue.tools.library_generator import VocabularyLibraryGenerator
from langue.activities.flashcards.activity import FlashcardActivity


class TestGeneratorNormalization(unittest.TestCase):
    def setUp(self):
        self.gen = VocabularyLibraryGenerator(MagicMock())

    def test_parses_fenced_json_with_trailing_comma(self):
        raw = '```json\n[{"word":"chat","translations":["cat"],"examples":["Le chat."],' \
              '"category":"nature","difficulty":1},]\n```'
        entries = self.gen._parse_vocabulary_response(raw)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["word"], "chat")

    def test_normalize_defaults_and_types(self):
        e = self.gen._normalize_entry({
            "word": "  bonjour ", "type": "nonsense", "translations": "hello",
            "difficulty": "9", "examples": ["Bonjour."],
        })
        self.assertEqual(e["word"], "bonjour")
        self.assertEqual(e["type"], "word")               # invalid type -> "word"
        self.assertEqual(e["translations"], ["hello"])     # scalar coerced to list
        self.assertEqual(e["difficulty"], 5)               # clamped to 1..5

    def test_normalize_breakdown_and_drops_empty_optionals(self):
        e = self.gen._normalize_entry({
            "word": "je voudrais", "type": "phrase", "translations": ["I would like"],
            "examples": ["Je voudrais un café."], "example_translations": ["I'd like a coffee."],
            "breakdown": [{"text": "je", "gloss": "I"}, {"text": "voudrais"}, {"gloss": "orphan"}],
            "literal": "", "base_form": "", "category": "food", "difficulty": 2,
        })
        self.assertEqual(e["type"], "phrase")
        self.assertEqual(len(e["breakdown"]), 2)           # entry lacking "text" dropped
        self.assertEqual(e["breakdown"][0], {"text": "je", "gloss": "I"})
        self.assertEqual(e["example_translations"], ["I'd like a coffee."])
        self.assertNotIn("literal", e)                     # empty optionals dropped
        self.assertNotIn("base_form", e)


class TestRuntimeBridge(unittest.TestCase):
    def _activity(self):
        a = FlashcardActivity.__new__(FlashcardActivity)
        a.level = "a1"
        a.words_encountered = set()
        return a

    def test_format_surfaces_new_fields(self):
        card = self._activity()._format_library_word({
            "word": "il est allé", "type": "grammar", "part_of_speech": "verb",
            "translations": ["he went"], "base_form": "aller",
            "grammar_note": "passé composé", "breakdown": [{"text": "il", "gloss": "he"}],
            "examples": ["Il est allé."], "example_translations": ["He went."],
            "category": "daily_routines", "difficulty": 3,
        })
        self.assertEqual(card["unit_type"], "grammar")
        self.assertEqual(card["base_form"], "aller")
        self.assertEqual(card["example_translation"], "He went.")
        self.assertEqual(card["breakdown"], [{"text": "il", "gloss": "he"}])

    def test_format_backward_compatible_with_old_word_entry(self):
        # An entry from an old library (no type/breakdown/example_translations).
        card = self._activity()._format_library_word({
            "word": "merci", "translations": ["thank you"], "examples": ["Merci."],
            "category": "greetings", "difficulty": 1,
        })
        self.assertEqual(card["unit_type"], "word")
        self.assertEqual(card["example_translation"], "")
        self.assertEqual(card["breakdown"], [])
        self.assertEqual(card["translation"], "thank you")

    def test_present_challenge_phrase_front_renders(self):
        a = self._activity()
        card = a._format_library_word({
            "word": "s'il vous plaît", "type": "phrase", "translations": ["please"],
            "examples": ["Un café, s'il vous plaît."], "category": "greetings", "difficulty": 1,
        })
        # 'quit' returns before evaluation, so this exercises only the front render.
        with patch("langue.activities.flashcards.activity.console.input", return_value="quit"):
            a.present_challenge(card)  # must not raise (phrase title/subtitle path)

    def test_display_back_adds_breakdown_and_example_translation_rows(self):
        a = self._activity()
        a.model = MagicMock()
        a.points_earned = 0
        a.flashcard_history = MagicMock()
        a._update_history_dict = lambda: None
        card = a._format_library_word({
            "word": "je m'appelle", "type": "phrase", "translations": ["my name is"],
            "breakdown": [{"text": "je", "gloss": "I"}, {"text": "m'appelle", "gloss": "am called"}],
            "examples": ["Je m'appelle Marie."], "example_translations": ["My name is Marie."],
            "category": "greetings", "difficulty": 1,
        })
        card["user_answer"] = "my name is"
        with patch.dict(os.environ, {"LANGUE_TEST_MODE": "1"}), \
             patch("langue.activities.flashcards.activity.evaluate_answer", return_value=(True, "ok", 8)), \
             patch("langue.activities.flashcards.activity.Table") as MockTable:
            a._display_full_flashcard(card)
            rows = [call.args[0] for call in MockTable.return_value.add_row.call_args_list]
        self.assertIn("Breakdown", rows)
        self.assertIn("Example Translation", rows)


if __name__ == "__main__":
    unittest.main()
