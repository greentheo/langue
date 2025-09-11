"""
Tests for flashcard evaluation with multiple translations.

These tests verify that the flashcard evaluation system correctly
handles words with multiple valid translations.
"""

import unittest
from unittest.mock import MagicMock, patch

from langue.activities.flashcards.evaluation import evaluate_answer, fallback_evaluate_answer
from langue.activities.flashcards.activity import FlashcardActivity


class MockModelInterface:
    """Mock model interface that returns predefined responses."""

    def __init__(self, evaluation_response=None):
        self.evaluation_response = evaluation_response or '{"is_correct": true, "feedback": "Good job!", "score": 9}'

    def get_response(self, prompt, system_prompt=None, temperature=None, max_tokens=None):
        """Return the predefined response."""
        return self.evaluation_response


class TestMultiTranslationEvaluation(unittest.TestCase):
    """Test the evaluation of flashcards with multiple translations."""

    def setUp(self):
        """Set up test environment."""
        self.mock_model = MockModelInterface()

    def test_evaluate_answer_with_multiple_translations(self):
        """Test that evaluate_answer correctly handles multiple translations."""
        # Test with a list of translations
        translations = ["hello", "hi", "good morning"]
        is_correct, feedback, score = evaluate_answer(self.mock_model, "bonjour", translations, "hello")

        # Since we're using a mock that always returns the same response,
        # we just verify that the function completes successfully
        self.assertTrue(is_correct)
        self.assertEqual(score, 9)

        # Now try with a non-matching answer
        with patch.object(self.mock_model, 'get_response',
                         return_value='{"is_correct": false, "feedback": "Not correct", "score": 3}'):
            is_correct, feedback, score = evaluate_answer(self.mock_model, "bonjour", translations, "goodbye")
            self.assertFalse(is_correct)
            self.assertEqual(score, 3)

    def test_fallback_evaluation_with_multiple_translations(self):
        """Test the fallback evaluation with multiple translations."""
        translations = ["hello", "hi", "good morning"]

        # Test exact match with first translation
        is_correct, feedback, score = fallback_evaluate_answer("bonjour", translations, "hello")
        self.assertTrue(is_correct)
        self.assertEqual(score, 10)

        # Test exact match with second translation
        is_correct, feedback, score = fallback_evaluate_answer("bonjour", translations, "hi")
        self.assertTrue(is_correct)
        self.assertEqual(score, 10)

        # Test exact match with third translation
        is_correct, feedback, score = fallback_evaluate_answer("bonjour", translations, "good morning")
        self.assertTrue(is_correct)
        self.assertEqual(score, 10)

        # Test close match (case difference)
        is_correct, feedback, score = fallback_evaluate_answer("bonjour", translations, "Hello")
        self.assertTrue(is_correct)
        self.assertEqual(score, 10)

        # Test close match (punctuation)
        is_correct, feedback, score = fallback_evaluate_answer("bonjour", translations, "hello!")
        self.assertTrue(is_correct)
        self.assertEqual(score, 9)

        # Test partial match
        is_correct, feedback, score = fallback_evaluate_answer("bonjour", translations, "hell")
        self.assertFalse(is_correct)
        self.assertEqual(score, 6)

        # Test no match
        is_correct, feedback, score = fallback_evaluate_answer("bonjour", translations, "goodbye")
        self.assertFalse(is_correct)
        self.assertEqual(score, 2)

    def test_flashcard_activity_with_multiple_translations(self):
        """Test that FlashcardActivity correctly handles words with multiple translations."""
        # Create mock word data with multiple translations
        word_data = {
            "word": "bonjour",
            "translations": ["hello", "hi", "good morning"],
            "examples": ["Bonjour, comment allez-vous?"],
            "category": "greetings",
            "difficulty": 1
        }

        # Create a FlashcardActivity instance with test mode to avoid DB operations
        with patch.dict('os.environ', {'LANGUE_TEST_MODE': '1'}):
            activity = FlashcardActivity(language="french", level="a1")
            activity.model = self.mock_model

        # Format the word data
        content = activity._format_library_word(word_data)

        # Verify all translations are stored
        self.assertEqual(content["translation"], "hello")  # First translation used as primary
        self.assertEqual(content["all_translations"], ["hello", "hi", "good morning"])
        self.assertIn("hello, hi, good morning", content["notes"])  # All translations in notes

        # Directly test multiple translation handling in evaluate_answer
        word = "bonjour"
        translations = ["hello", "hi", "good morning"]

        # Test with exact match to second translation
        with patch.object(self.mock_model, 'get_response',
                          return_value='{"is_correct": true, "feedback": "Great job!", "score": 10}'):
            is_correct, feedback, score = evaluate_answer(self.mock_model, word, translations, "hi")
            self.assertTrue(is_correct)
            self.assertEqual(score, 10)

        # Test with non-matching answer
        with patch.object(self.mock_model, 'get_response',
                          return_value='{"is_correct": false, "feedback": "Not quite right", "score": 3}'):
            is_correct, feedback, score = evaluate_answer(self.mock_model, word, translations, "goodbye")
            self.assertFalse(is_correct)
            self.assertEqual(score, 3)


if __name__ == '__main__':
    unittest.main()
