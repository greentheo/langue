"""
Tests for the FlashcardActivity with library integration.

These tests verify that the flashcard activity properly integrates
with the vocabulary library system.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from langue.activities.flashcards.activity import FlashcardActivity
from langue.activities.flashcards.library_manager import FlashcardLibraryManager


class TestFlashcardActivityWithLibrary(unittest.TestCase):
    """Test the FlashcardActivity with library integration."""

    def setUp(self):
        """Set up test environment with mock libraries."""
        self.temp_dir = tempfile.TemporaryDirectory()

        # Create test library directory structure
        self.library_path = os.path.join(self.temp_dir.name, "flashcard_libraries")
        self.spanish_dir = os.path.join(self.library_path, "spanish")

        os.makedirs(self.spanish_dir, exist_ok=True)

        # Create A1 Spanish library
        self.a1_library = {
            "metadata": {
                "language": "spanish",
                "level": "a1",
                "version": "1.0",
                "word_count": 3,
                "created_at": "2023-10-15T14:30:00Z",
                "description": "Test Spanish vocabulary"
            },
            "words": [
                {
                    "word": "hola",
                    "translations": ["hello", "hi"],
                    "examples": ["¡Hola! ¿Cómo estás?"],
                    "category": "greetings",
                    "difficulty": 1
                },
                {
                    "word": "gracias",
                    "translations": ["thank you", "thanks"],
                    "examples": ["Muchas gracias por tu ayuda."],
                    "category": "greetings",
                    "difficulty": 1
                },
                {
                    "word": "adiós",
                    "translations": ["goodbye", "bye"],
                    "examples": ["Adiós, hasta mañana."],
                    "category": "greetings",
                    "difficulty": 1
                }
            ]
        }

        with open(os.path.join(self.spanish_dir, "a1.json"), 'w', encoding='utf-8') as f:
            json.dump(self.a1_library, f, ensure_ascii=False)

        # Mock the model interface
        self.mock_model = MagicMock()
        self.mock_model.get_response.return_value = """
        {
            "word": "casa",
            "translation": "house",
            "example": "Mi casa es grande.",
            "example_translation": "My house is big.",
            "notes": "A common noun."
        }
        """

        # Patch the library path
        self.library_manager_patch = patch.object(
            FlashcardLibraryManager, '__init__',
            return_value=None
        )
        self.library_manager_init = self.library_manager_patch.start()

        # Patch the load_library method
        self.load_library_patch = patch.object(
            FlashcardLibraryManager, 'load_library',
            return_value=self.a1_library
        )
        self.load_library_mock = self.load_library_patch.start()

        # Patch the get_random_word method
        self.get_random_word_patch = patch.object(
            FlashcardLibraryManager, 'get_random_word',
            return_value=self.a1_library["words"][0]
        )
        self.get_random_word_mock = self.get_random_word_patch.start()

        # Patch the get_available_languages method
        self.get_available_languages_patch = patch.object(
            FlashcardLibraryManager, 'get_available_languages',
            return_value=["spanish"]
        )
        self.get_available_languages_mock = self.get_available_languages_patch.start()

        # Patch the get_available_levels method
        self.get_available_levels_patch = patch.object(
            FlashcardLibraryManager, 'get_available_levels',
            return_value=["a1"]
        )
        self.get_available_levels_mock = self.get_available_levels_patch.start()

    def tearDown(self):
        """Clean up test environment."""
        self.temp_dir.cleanup()
        self.library_manager_patch.stop()
        self.load_library_patch.stop()
        self.get_random_word_patch.stop()
        self.get_available_languages_patch.stop()
        self.get_available_levels_patch.stop()

    @patch('langue.activities.flashcards.activity.console')
    def test_generate_content_with_library(self, mock_console):
        """Test generating content from library."""
        # Create flashcard activity with Spanish language and A1 level
        activity = FlashcardActivity(
            language="spanish",
            difficulty=1,
            model_name=None,
            level="a1"
        )

        # Replace the model with our mock
        activity.model = self.mock_model

        # Generate content
        content = activity.generate_content()

        # Check that content is generated from the library
        self.assertEqual(content["word"], "hola")
        self.assertEqual(content["translation"], "hello")
        self.assertEqual(content["example"], "¡Hola! ¿Cómo estás?")
        self.assertEqual(content["source"], "library")

        # Verify that the library methods were called
        self.get_available_languages_mock.assert_called_once()
        self.get_available_levels_mock.assert_called_once_with("spanish")
        self.get_random_word_mock.assert_called_once_with("spanish", "a1")

    @patch('langue.activities.flashcards.activity.console')
    def test_generate_content_fallback_to_model(self, mock_console):
        """Test fallback to model when library is unavailable."""
        # Modify mocks to simulate library not available
        self.get_available_languages_mock.return_value = []

        # Create flashcard activity
        activity = FlashcardActivity(
            language="spanish",
            difficulty=1,
            model_name=None
        )

        # Replace the model with our mock
        activity.model = self.mock_model

        # Generate content
        content = activity.generate_content()

        # Check that content is generated from the model
        self.assertEqual(content["word"], "casa")
        self.assertEqual(content["translation"], "house")
        self.assertEqual(content["example"], "Mi casa es grande.")
        self.assertEqual(content["source"], "model")

        # Verify the model was called
        self.mock_model.get_response.assert_called_once()

    @patch('langue.activities.flashcards.activity.console')
    def test_format_library_word(self, mock_console):
        """Test formatting a word from the library."""
        # Create flashcard activity
        activity = FlashcardActivity(
            language="spanish",
            difficulty=1,
            model_name=None,
            level="a1"
        )

        # Test formatting a word
        word_data = {
            "word": "manzana",
            "translations": ["apple", "Apple fruit"],
            "examples": ["Me gusta comer manzanas.", "Las manzanas son rojas."],
            "category": "food",
            "difficulty": 2
        }

        formatted = activity._format_library_word(word_data)

        # Check formatting
        self.assertEqual(formatted["word"], "manzana")
        self.assertEqual(formatted["translation"], "apple")
        self.assertEqual(formatted["example"], "Me gusta comer manzanas.")
        self.assertEqual(formatted["source"], "library")
        self.assertIn("food", formatted["notes"])
        self.assertIn("A1", formatted["notes"])

    @patch('langue.activities.flashcards.activity.console')
    def test_get_level_from_difficulty(self, mock_console):
        """Test converting difficulty to CEFR level."""
        # Create flashcard activity
        activity = FlashcardActivity(
            language="spanish",
            difficulty=1,
            model_name=None
        )

        # Test different difficulty levels
        self.assertEqual(activity._get_level_from_difficulty(1), "a1")
        self.assertEqual(activity._get_level_from_difficulty(2), "a2")
        self.assertEqual(activity._get_level_from_difficulty(3), "b1")
        self.assertEqual(activity._get_level_from_difficulty(4), "b2")
        self.assertEqual(activity._get_level_from_difficulty(5), "c1")

        # Test out of range
        self.assertEqual(activity._get_level_from_difficulty(10), "a1")
        self.assertEqual(activity._get_level_from_difficulty(-1), "a1")


if __name__ == '__main__':
    unittest.main()
