"""
Unit tests for the flashcard activity.

This module tests the functionality of the FlashcardActivity class.
"""
from unittest.mock import patch, MagicMock

import unittest
from unittest.mock import MagicMock, patch
import json
import os
import sys
import tempfile
from pathlib import Path
import re

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from langue.activities.flashcards.activity import FlashcardActivity
from langue.activities.flashcards.history import FlashcardHistory
from langue.activities.base import console
from langue.models.base import ModelInterface


class MockModelInterface(ModelInterface):
    """Mock model interface for testing."""

    def __init__(self):
        """Initialize mock model interface."""
        self.responses = []
        self.current_response_index = 0

    def set_responses(self, responses):
        """Set mock responses."""
        self.responses = responses
        self.current_response_index = 0

    def get_response(self, prompt, system_prompt=None, temperature=None, max_tokens=None, **kwargs):
        """Return a mock response."""
        if not self.responses:
            return '{"word": "test", "translation": "prueba", "example": "This is a test.", "example_translation": "Esto es una prueba.", "notes": "Common word."}'

        response = self.responses[self.current_response_index]
        self.current_response_index = (self.current_response_index + 1) % len(self.responses)
        return response

    def get_supported_languages(self):
        """Return mock supported languages."""
        return ["English", "Spanish", "French", "German"]

    @property
    def is_online(self):
        """Return False for offline testing."""
        return False

    @property
    def name(self):
        """Return mock name."""
        return "mock_model"

    def check_availability(self):
        """Return True for availability."""
        return True

    def get_model_info(self):
        """Return mock model info."""
        return {
            "name": "mock_model",
            "type": "mock",
            "offline": True
        }

    def get_chat_response(self, messages, temperature=None, max_tokens=None, **kwargs):
        """Return a mock chat response."""
        return self.get_response("")


class FlashcardActivityTest(unittest.TestCase):
    """Tests for FlashcardActivity."""

    def setUp(self):
        """Set up test environment."""
        self.mock_model = MockModelInterface()
        # Initialize FlashcardActivity with mock model
        self.activity = FlashcardActivity(
            language="Spanish",
            difficulty=1,
            user_id="test_user"
        )
        self.activity.model = self.mock_model

        # Set up mock responses
        self.mock_model.set_responses([
            '{"word": "casa", "translation": "house", "example": "Mi casa es grande.", "example_translation": "My house is big.", "notes": "Common noun."}',
            '{"is_correct": true, "feedback": "Great job!", "score": 10}',
            '{"word": "perro", "translation": "dog", "example": "El perro es amigable.", "example_translation": "The dog is friendly.", "notes": "Animal noun."}',
            '{"word": "azul", "translation": "blue", "example": "El cielo es azul.", "example_translation": "The sky is blue.", "notes": "Color adjective."}'
        ])

    def test_initialization(self):
        """Test flashcard activity initialization."""
        self.assertEqual(self.activity.language, "Spanish")
        self.assertEqual(self.activity.difficulty, 1)
        self.assertEqual(self.activity.name, "Flashcards")
        self.assertEqual(self.activity.description, "Practice vocabulary with flashcards")
        self.assertIsNotNone(self.activity.get_instructions())

    def test_generate_content(self):
        """Test content generation."""
        content = self.activity.generate_content()

        self.assertIn("word", content)
        self.assertIn("translation", content)
        self.assertIn("example", content)
        self.assertIn("example_translation", content)
        self.assertIn("notes", content)

        # The generated word and translation may vary due to library integration
        # So we just check that they're non-empty strings
        self.assertIsInstance(content["word"], str)
        self.assertTrue(len(content["word"]) > 0)
        self.assertIsInstance(content["translation"], str)
        self.assertTrue(len(content["translation"]) > 0)

    @patch('langue.storage.integration.save_flashcard_attempt', return_value=True)
    def test_process_response(self, mock_save_attempt):
        """Test processing user responses."""
        content = {
            "word": "casa",
            "translation": "house",
            "example": "Mi casa es grande.",
            "example_translation": "My house is big.",
            "notes": "Common noun.",
            "user_answer": "house"  # Add user answer to content
        }

        # Manually set up the flashcard history to simulate the evaluation already happened
        self.activity.flashcard_history = {
            "casa": {
                "encounters": 1,
                "answers": ["house"],
                "scores": [10]
            }
        }

        # Mock the LLM evaluation and quit command checking
        with patch('langue.activities.flashcards.evaluation.evaluate_answer',
                  return_value=(True, "Great job!", 10)), \
             patch.object(self.activity, 'is_quit_command', return_value=False):
            is_correct, feedback = self.activity.process_response("3", content)
            self.assertTrue(is_correct)
            self.assertIn("Feedback already shown", feedback)

        # Test partial match
        content["user_answer"] = "building"
        # Update the history to simulate a lower score
        self.activity.flashcard_history["casa"]["scores"] = [5]
        self.activity.flashcard_history["casa"]["answers"] = ["building"]

        with patch('langue.activities.flashcards.evaluation.evaluate_answer',
                  return_value=(False, "Close, but not quite right.", 5)), \
             patch.object(self.activity, 'is_quit_command', return_value=False):
            is_correct, feedback = self.activity.process_response("", content)
            self.assertFalse(is_correct)
            self.assertIn("Feedback already shown", feedback)

        # Test incorrect answer
        content["user_answer"] = "dog"
        # Update the history to simulate a very low score
        self.activity.flashcard_history["casa"]["scores"] = [2]
        self.activity.flashcard_history["casa"]["answers"] = ["dog"]

        with patch('langue.activities.flashcards.evaluation.evaluate_answer',
                  return_value=(False, "Incorrect. The answer is 'house'.", 2)), \
             patch.object(self.activity, 'is_quit_command', return_value=False):
            is_correct, feedback = self.activity.process_response("", content)
            self.assertFalse(is_correct)
            self.assertIn("Feedback already shown", feedback)

    def test_track_words(self):
        """Test word tracking."""
        words = ["casa", "perro", "azul"]
        new_count = self.activity.track_words(words)

        self.assertEqual(new_count, 3)
        self.assertEqual(len(self.activity.words_encountered), 3)

        # Track the same words again
        new_count = self.activity.track_words(words)
        self.assertEqual(new_count, 0)  # No new words
        self.assertEqual(len(self.activity.words_encountered), 3)  # Still 3 words

    def test_get_results(self):
        """Test getting activity results."""
        # Track some words
        self.activity.track_words(["casa", "perro", "azul"])

        # Add some points
        self.activity.points_earned = 15

        # Set some stats
        self.activity.correct_count = 5
        self.activity.total_count = 10

        # Get results
        results = self.activity.get_results()

        self.assertEqual(results["activity"], "Flashcards")
        self.assertEqual(results["language"], "Spanish")
        self.assertEqual(results["difficulty"], 1)
        self.assertEqual(results["points_earned"], 15)
        self.assertEqual(results["words_count"], 3)
        self.assertEqual(results["total_cards"], 10)
        self.assertEqual(results["correct_cards"], 5)
        self.assertEqual(results["success_rate"], 50.0)


if __name__ == "__main__":
    unittest.main()
