"""
Flashcard Library Manager for Langue

This module provides tools to manage vocabulary libraries for the
flashcard activity, organized by language and proficiency level.
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FlashcardLibraryManager:
    """Manages flashcard vocabulary libraries."""

    def __init__(self, library_path: Optional[str] = None):
        """Initialize with path to libraries.

        Args:
            library_path: Path to the libraries directory. If None, use default.
        """
        if library_path is None:
            # Default path is data/flashcard_libraries relative to package root
            root_dir = Path(__file__).parents[3]  # Go up 3 levels from this file
            library_path = os.path.join(root_dir, "data", "flashcard_libraries")

        self.library_path = library_path
        self.libraries = {}  # Cache for loaded libraries

        # Create library directory if it doesn't exist
        os.makedirs(self.library_path, exist_ok=True)

        logger.debug(f"Initialized FlashcardLibraryManager with path: {self.library_path}")

    def get_available_languages(self) -> List[str]:
        """Return list of available language libraries.

        Returns:
            List of language names
        """
        try:
            languages = [
                d for d in os.listdir(self.library_path)
                if os.path.isdir(os.path.join(self.library_path, d))
            ]
            return sorted(languages)
        except FileNotFoundError:
            logger.warning(f"Library path not found: {self.library_path}")
            return []

    def get_available_levels(self, language: str) -> List[str]:
        """Return list of available levels for a language.

        Args:
            language: Language to get levels for

        Returns:
            List of level codes (a1, a2, etc.)
        """
        language_dir = os.path.join(self.library_path, language.lower())

        try:
            # Get all JSON files in the language directory
            level_files = [
                f.split('.')[0] for f in os.listdir(language_dir)
                if f.endswith('.json') and os.path.isfile(os.path.join(language_dir, f))
            ]
            return sorted(level_files)
        except FileNotFoundError:
            logger.warning(f"Language directory not found: {language_dir}")
            return []

    def load_library(self, language: str, level: str) -> Dict[str, Any]:
        """Load a specific vocabulary library.

        Args:
            language: Language to load
            level: Level to load

        Returns:
            Dictionary with library data including metadata and words

        Raises:
            FileNotFoundError: If library file doesn't exist
        """
        # Check cache first
        cache_key = f"{language.lower()}_{level.lower()}"
        if cache_key in self.libraries:
            return self.libraries[cache_key]

        # Load from file
        file_path = os.path.join(self.library_path, language.lower(), f"{level.lower()}.json")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                library = json.load(f)

            # Cache the loaded library
            self.libraries[cache_key] = library
            logger.debug(f"Loaded library: {language} {level} with {len(library.get('words', []))} words")
            return library
        except FileNotFoundError:
            logger.error(f"Library file not found: {file_path}")
            raise
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in library file: {file_path}")
            raise

    def get_word_count(self, language: str, level: str) -> int:
        """Return the number of words in a library.

        Args:
            language: Language to check
            level: Level to check

        Returns:
            Number of words in the library
        """
        try:
            library = self.load_library(language, level)
            return library.get("metadata", {}).get("word_count", 0)
        except Exception as e:
            logger.error(f"Error getting word count: {e}")
            return 0

    def get_word_by_index(self, language: str, level: str, index: int) -> Dict[str, Any]:
        """Get a specific word by index.

        Args:
            language: Language to get word from
            level: Level to get word from
            index: Index of the word to get

        Returns:
            Word dictionary

        Raises:
            IndexError: If index is out of range
        """
        try:
            library = self.load_library(language, level)
            words = library.get("words", [])

            if 0 <= index < len(words):
                return words[index]
            else:
                raise IndexError(f"Word index out of range: {index}, max: {len(words)-1}")
        except Exception as e:
            if not isinstance(e, IndexError):
                logger.error(f"Error getting word by index: {e}")
            raise

    def get_random_word(self, language: str, level: str) -> Dict[str, Any]:
        """Get a random word from the library.

        Args:
            language: Language to get word from
            level: Level to get word from

        Returns:
            Random word dictionary

        Raises:
            ValueError: If library has no words
        """
        import random

        try:
            library = self.load_library(language, level)
            words = library.get("words", [])

            if not words:
                raise ValueError(f"No words found in library: {language} {level}")

            return random.choice(words)
        except Exception as e:
            if not isinstance(e, ValueError):
                logger.error(f"Error getting random word: {e}")
            raise

    def get_words_by_category(self, language: str, level: str, category: str) -> List[Dict[str, Any]]:
        """Get words filtered by category.

        Args:
            language: Language to get words from
            level: Level to get words from
            category: Category to filter by

        Returns:
            List of word dictionaries matching the category
        """
        try:
            library = self.load_library(language, level)
            words = library.get("words", [])

            filtered_words = [
                word for word in words
                if word.get("category", "").lower() == category.lower()
            ]

            logger.debug(f"Found {len(filtered_words)} words in category '{category}'")
            return filtered_words
        except Exception as e:
            logger.error(f"Error getting words by category: {e}")
            return []

    def get_words_by_difficulty(self, language: str, level: str, difficulty: int) -> List[Dict[str, Any]]:
        """Get words filtered by difficulty rating.

        Args:
            language: Language to get words from
            level: Level to get words from
            difficulty: Difficulty rating to filter by (1-5)

        Returns:
            List of word dictionaries matching the difficulty
        """
        try:
            library = self.load_library(language, level)
            words = library.get("words", [])

            filtered_words = [
                word for word in words
                if word.get("difficulty", 0) == difficulty
            ]

            logger.debug(f"Found {len(filtered_words)} words with difficulty '{difficulty}'")
            return filtered_words
        except Exception as e:
            logger.error(f"Error getting words by difficulty: {e}")
            return []

    def get_all_categories(self, language: str, level: str) -> Set[str]:
        """Get all categories present in a library.

        Args:
            language: Language to check
            level: Level to check

        Returns:
            Set of category names
        """
        try:
            library = self.load_library(language, level)
            words = library.get("words", [])

            categories = {word.get("category", "").lower() for word in words if word.get("category")}
            return categories
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return set()

    def get_words_across_levels(self, language: str, levels: List[str]) -> List[Dict[str, Any]]:
        """Get words from multiple levels.

        Args:
            language: Language to get words from
            levels: List of levels to include

        Returns:
            List of word dictionaries from all specified levels
        """
        all_words = []

        for level in levels:
            try:
                library = self.load_library(language, level)
                words = library.get("words", [])

                # Add level information to each word
                for word in words:
                    word_with_level = word.copy()
                    word_with_level["level"] = level
                    all_words.append(word_with_level)

            except Exception as e:
                logger.error(f"Error loading level {level}: {e}")
                continue

        logger.debug(f"Loaded {len(all_words)} words across {len(levels)} levels")
        return all_words

    def get_library_metadata(self, language: str, level: str) -> Dict[str, Any]:
        """Get metadata for a specific library.

        Args:
            language: Language to get metadata for
            level: Level to get metadata for

        Returns:
            Dictionary with library metadata
        """
        try:
            library = self.load_library(language, level)
            return library.get("metadata", {})
        except Exception as e:
            logger.error(f"Error getting metadata: {e}")
            return {}

    def reload_library(self, language: str, level: str) -> bool:
        """Force reload a library from disk, bypassing cache.

        Args:
            language: Language to reload
            level: Level to reload

        Returns:
            True if successful, False otherwise
        """
        # Remove from cache
        cache_key = f"{language.lower()}_{level.lower()}"
        if cache_key in self.libraries:
            del self.libraries[cache_key]

        # Try to load
        try:
            self.load_library(language, level)
            return True
        except Exception as e:
            logger.error(f"Error reloading library: {e}")
            return False
