"""
Tests for the FlashcardLibraryManager.

These tests verify the functionality of the flashcard library manager
that handles loading and managing vocabulary libraries.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch

from langue.activities.flashcards.library_manager import FlashcardLibraryManager

# Test data for creating mock libraries
TEST_LIBRARY_DATA = {
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


class TestFlashcardLibraryManager(unittest.TestCase):
    """Test the FlashcardLibraryManager class."""

    def setUp(self):
        """Set up test environment with mock libraries."""
        self.temp_dir = tempfile.TemporaryDirectory()

        # Create test libraries
        self.spanish_dir = os.path.join(self.temp_dir.name, "spanish")
        self.french_dir = os.path.join(self.temp_dir.name, "french")

        os.makedirs(self.spanish_dir, exist_ok=True)
        os.makedirs(self.french_dir, exist_ok=True)

        # Create A1 Spanish library
        with open(os.path.join(self.spanish_dir, "a1.json"), 'w', encoding='utf-8') as f:
            json.dump(TEST_LIBRARY_DATA, f, ensure_ascii=False)

        # Create A2 Spanish library (modify A1 data)
        a2_data = TEST_LIBRARY_DATA.copy()
        a2_data["metadata"] = a2_data["metadata"].copy()
        a2_data["metadata"]["level"] = "a2"
        a2_data["metadata"]["word_count"] = 2  # Explicitly set word_count to match length of words array
        a2_data["words"] = [
            {
                "word": "restaurante",
                "translations": ["restaurant"],
                "examples": ["Vamos a comer en el restaurante."],
                "category": "food",
                "difficulty": 2
            },
            {
                "word": "biblioteca",
                "translations": ["library"],
                "examples": ["La biblioteca está cerrada hoy."],
                "category": "education",
                "difficulty": 2
            }
        ]

        with open(os.path.join(self.spanish_dir, "a2.json"), 'w', encoding='utf-8') as f:
            json.dump(a2_data, f, ensure_ascii=False)

        # Create A1 French library
        french_data = TEST_LIBRARY_DATA.copy()
        french_data["metadata"] = french_data["metadata"].copy()
        french_data["metadata"]["language"] = "french"
        french_data["words"] = [
            {
                "word": "bonjour",
                "translations": ["hello", "good morning"],
                "examples": ["Bonjour, comment allez-vous?"],
                "category": "greetings",
                "difficulty": 1
            },
            {
                "word": "merci",
                "translations": ["thank you", "thanks"],
                "examples": ["Merci beaucoup pour votre aide."],
                "category": "greetings",
                "difficulty": 1
            }
        ]

        with open(os.path.join(self.french_dir, "a1.json"), 'w', encoding='utf-8') as f:
            json.dump(french_data, f, ensure_ascii=False)

        # Initialize the library manager with our temporary directory
        self.manager = FlashcardLibraryManager(library_path=self.temp_dir.name)

    def tearDown(self):
        """Clean up test environment."""
        self.temp_dir.cleanup()

    def test_get_available_languages(self):
        """Test getting available languages."""
        languages = self.manager.get_available_languages()
        self.assertEqual(set(languages), {"spanish", "french"})

    def test_get_available_levels(self):
        """Test getting available levels for a language."""
        spanish_levels = self.manager.get_available_levels("spanish")
        self.assertEqual(set(spanish_levels), {"a1", "a2"})

        french_levels = self.manager.get_available_levels("french")
        self.assertEqual(set(french_levels), {"a1"})

        # Test for non-existent language
        nonexistent_levels = self.manager.get_available_levels("german")
        self.assertEqual(nonexistent_levels, [])

    def test_load_library(self):
        """Test loading a library."""
        library = self.manager.load_library("spanish", "a1")

        self.assertEqual(library["metadata"]["language"], "spanish")
        self.assertEqual(library["metadata"]["level"], "a1")
        self.assertEqual(len(library["words"]), 3)

        # Test for non-existent library
        with self.assertRaises(FileNotFoundError):
            self.manager.load_library("spanish", "c1")

    def test_get_word_count(self):
        """Test getting word count from a library."""
        count = self.manager.get_word_count("spanish", "a1")
        self.assertEqual(count, 3)

        count = self.manager.get_word_count("spanish", "a2")
        self.assertEqual(count, 2)

        # Test for non-existent library
        count = self.manager.get_word_count("german", "a1")
        self.assertEqual(count, 0)

    def test_get_word_by_index(self):
        """Test getting a word by index."""
        word = self.manager.get_word_by_index("spanish", "a1", 0)
        self.assertEqual(word["word"], "hola")

        # Test out-of-range index
        with self.assertRaises(IndexError):
            self.manager.get_word_by_index("spanish", "a1", 10)

    def test_get_random_word(self):
        """Test getting a random word."""
        word = self.manager.get_random_word("spanish", "a1")
        self.assertIn(word["word"], ["hola", "gracias", "adiós"])

        # Test for empty library
        with patch.object(self.manager, 'load_library') as mock_load:
            mock_load.return_value = {"metadata": {}, "words": []}
            with self.assertRaises(ValueError):
                self.manager.get_random_word("empty", "a1")

    def test_get_words_by_category(self):
        """Test getting words by category."""
        words = self.manager.get_words_by_category("spanish", "a1", "greetings")
        self.assertEqual(len(words), 3)

        words = self.manager.get_words_by_category("spanish", "a2", "food")
        self.assertEqual(len(words), 1)
        self.assertEqual(words[0]["word"], "restaurante")

        # Test for non-existent category
        words = self.manager.get_words_by_category("spanish", "a1", "nonexistent")
        self.assertEqual(words, [])

    def test_get_words_by_difficulty(self):
        """Test getting words by difficulty."""
        words = self.manager.get_words_by_difficulty("spanish", "a1", 1)
        self.assertEqual(len(words), 3)

        words = self.manager.get_words_by_difficulty("spanish", "a2", 2)
        self.assertEqual(len(words), 2)

        # Test for non-existent difficulty
        words = self.manager.get_words_by_difficulty("spanish", "a1", 5)
        self.assertEqual(words, [])

    def test_get_all_categories(self):
        """Test getting all categories from a library."""
        categories = self.manager.get_all_categories("spanish", "a1")
        self.assertEqual(categories, {"greetings"})

        categories = self.manager.get_all_categories("spanish", "a2")
        self.assertEqual(categories, {"food", "education"})

    def test_get_words_across_levels(self):
        """Test getting words across multiple levels."""
        words = self.manager.get_words_across_levels("spanish", ["a1", "a2"])
        self.assertEqual(len(words), 5)  # 3 from A1 + 2 from A2

        # Check that level information is added
        a1_words = [w for w in words if w.get("level") == "a1"]
        a2_words = [w for w in words if w.get("level") == "a2"]
        self.assertEqual(len(a1_words), 3)
        self.assertEqual(len(a2_words), 2)

    def test_get_library_metadata(self):
        """Test getting library metadata."""
        metadata = self.manager.get_library_metadata("spanish", "a1")
        self.assertEqual(metadata["language"], "spanish")
        self.assertEqual(metadata["level"], "a1")

        # Test for non-existent library
        metadata = self.manager.get_library_metadata("german", "a1")
        self.assertEqual(metadata, {})

    def test_reload_library(self):
        """Test reloading a library."""
        # First load to cache
        self.manager.load_library("spanish", "a1")

        # Modify the file on disk
        modified_data = TEST_LIBRARY_DATA.copy()
        modified_data["words"][0]["word"] = "modified"

        with open(os.path.join(self.spanish_dir, "a1.json"), 'w', encoding='utf-8') as f:
            json.dump(modified_data, f, ensure_ascii=False)

        # Without reload, should get cached version
        library = self.manager.load_library("spanish", "a1")
        self.assertEqual(library["words"][0]["word"], "hola")

        # With reload, should get updated version
        self.manager.reload_library("spanish", "a1")
        library = self.manager.load_library("spanish", "a1")
        self.assertEqual(library["words"][0]["word"], "modified")


if __name__ == '__main__':
    unittest.main()
