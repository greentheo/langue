"""Regression tests for the reading activity (issue #8).

Covers the vocab-table crash (missing Table import) and that one passage is
generated and ALL its questions are answered before another passage — the base
loop used to generate a fresh passage per question and use only the first one.
"""

import unittest
from unittest.mock import patch

from langue.models.base import ModelInterface
from langue.activities.reading import ReadingActivity


class _StubModel(ModelInterface):
    def get_response(self, *a, **k):
        return "{}"

    def get_supported_languages(self):
        return ["Spanish"]

    @property
    def is_online(self):
        return False

    @property
    def name(self):
        return "stub"

    def check_availability(self):
        return True

    def get_model_info(self):
        return {}


_CONTENT = {
    "passage": "Hola mundo.",
    "translation": "Hello world.",
    "questions": ["Q1", "Q2", "Q3"],
    "answers": ["a", "a", "a"],
    "options": [["a", "b"], ["a", "b"], ["a", "b"]],
    "vocabulary": {"hola": "hello", "mundo": "world"},
}


class TestReadingFlow(unittest.TestCase):
    def _activity(self):
        a = ReadingActivity(language="Spanish", difficulty=1, model_name=None)
        a.model = _StubModel()
        return a

    def test_present_challenge_renders_vocab_table(self):
        # Regression: this used to raise NameError because Table was not imported.
        self._activity().present_challenge(_CONTENT)

    def test_one_passage_all_questions(self):
        a = self._activity()
        # "1" answers each of the 3 questions correctly; "n" declines another passage.
        with patch.object(a, "generate_content", return_value=_CONTENT) as gen, \
             patch("langue.activities.reading.console.input", side_effect=["1", "1", "1", "n"]):
            a.start()
        self.assertEqual(gen.call_count, 1, "should generate exactly one passage")
        self.assertEqual(a.total_count, 3, "should answer all three questions")
        self.assertEqual(a.correct_count, 3)
        self.assertEqual(a.current_question_index, 3)


if __name__ == "__main__":
    unittest.main()
