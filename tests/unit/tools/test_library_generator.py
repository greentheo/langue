"""
Tests for the vocabulary library generator.

These tests verify the functionality of the vocabulary library generator tool.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from langue.tools.library_generator import VocabularyLibraryGenerator

# Example model response for testing
TEST_MODEL_RESPONSE = """```json
[
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
  },
  {
    "word": "au revoir",
    "translations": ["goodbye"],
    "examples": ["Au revoir, à demain!"],
    "category": "greetings",
    "difficulty": 1
  }
]
```"""


class MockModelInterface:
    """Mock model interface for testing."""

    def get_response(self, prompt, system_prompt=None, temperature=None, max_tokens=None):
        """Return a test response."""
        return TEST_MODEL_RESPONSE


class TestVocabularyLibraryGenerator(unittest.TestCase):
    """Test the VocabularyLibraryGenerator class."""

    def setUp(self):
        """Set up test environment."""
        self.model = MockModelInterface()
        self.generator = VocabularyLibraryGenerator(self.model)
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        """Clean up test environment."""
        self.temp_dir.cleanup()

    def test_generate_vocabulary(self):
        """Test generating vocabulary."""
        words = self.generator.generate_vocabulary("french", "a1", 3)
        self.assertEqual(len(words), 3)
        self.assertEqual(words[0]["word"], "bonjour")
        self.assertEqual(words[1]["translations"], ["thank you", "thanks"])
        self.assertEqual(words[2]["examples"][0], "Au revoir, à demain!")

    def test_save_library(self):
        """Test saving a vocabulary library."""
        words = self.generator.generate_vocabulary("french", "a1", 3)
        file_path = self.generator.save_library("french", "a1", words, self.temp_dir.name)

        self.assertTrue(os.path.exists(file_path))

        # Verify the contents
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.assertEqual(data["metadata"]["language"], "french")
        self.assertEqual(data["metadata"]["level"], "a1")
        self.assertEqual(data["metadata"]["word_count"], 3)
        self.assertEqual(len(data["words"]), 3)

    def test_append_to_library(self):
        """Test appending to an existing library."""
        # First create a library
        words1 = self.generator.generate_vocabulary("french", "a1", 3)
        file_path = self.generator.save_library("french", "a1", words1, self.temp_dir.name)

        # Now append to it with different words
        different_words = [
            {
                "word": "oui",
                "translations": ["yes"],
                "examples": ["Oui, je comprends."],
                "category": "basics",
                "difficulty": 1
            }
        ]

        file_path = self.generator.save_library("french", "a1", different_words,
                                               self.temp_dir.name, mode='append')

        # Verify the contents
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.assertEqual(data["metadata"]["word_count"], 4)  # 3 original + 1 new
        self.assertEqual(len(data["words"]), 4)

        # Check that both original and new words are present
        words = [w["word"] for w in data["words"]]
        self.assertIn("bonjour", words)
        self.assertIn("oui", words)

    def test_generate_all_levels(self):
        """Test generating vocabulary for all levels."""
        with patch.object(self.generator, 'generate_vocabulary') as mock_generate:
            mock_generate.return_value = [{"word": "test", "translations": ["test"]}]

            file_paths = self.generator.generate_all_levels("spanish", 1, self.temp_dir.name)

            # Should call generate_vocabulary for each level (a1-c2)
            self.assertEqual(mock_generate.call_count, 6)
            self.assertEqual(len(file_paths), 6)

    def test_parse_vocabulary_response(self):
        """Test parsing model responses."""
        # Test with code block format
        response = "```json\n[{\"word\": \"test\"}]\n```"
        result = self.generator._parse_vocabulary_response(response)
        self.assertEqual(result[0]["word"], "test")

        # Test with raw JSON
        response = "[{\"word\": \"test\"}]"
        result = self.generator._parse_vocabulary_response(response)
        self.assertEqual(result[0]["word"], "test")

        # Test with missing fields
        response = "[{\"word\": \"test\"}]"
        result = self.generator._parse_vocabulary_response(response)
        self.assertIn("translations", result[0])
        self.assertIn("examples", result[0])
        self.assertIn("category", result[0])
        self.assertIn("difficulty", result[0])


if __name__ == '__main__':
    unittest.main()
