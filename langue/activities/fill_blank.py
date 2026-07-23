"""
Fill-in-the-blank activity for Langue.

This module provides the FillBlankActivity class which implements a fill-in-the-blank
exercise for language learning.
"""

import re
import random
import json
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from datetime import datetime

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.markdown import Markdown
from rich.table import Table

from langue.activities.base import Activity
from langue.models.base import ModelInterface
from langue.models.ollama import OllamaModelInterface
from langue.models.claude import ClaudeModelInterface
from langue.utils.helpers import extract_words
from langue.activities.flashcards.library_manager import FlashcardLibraryManager
from langue.storage.database import DatabaseManager

# Import console with 80's theme from base activity
from langue.activities.base import console, SYNTHWAVE_THEME, PANEL_BORDER_STYLE

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class FillBlankAttempt:
    """Class representing a fill-in-the-blank attempt."""

    def __init__(self, word: str, user_answer: str, correct: bool = False, timestamp: str = None):
        """Initialize a fill-in-the-blank attempt.

        Args:
            word: The word that was blanked out
            user_answer: The user's answer
            correct: Whether the answer was correct
            timestamp: When the attempt was made (ISO format)
        """
        self.word = word
        self.user_answer = user_answer
        self.correct = correct
        self.timestamp = timestamp or datetime.now().isoformat()


class FillBlankHistory:
    """Class for tracking fill-in-the-blank history."""

    def __init__(self, user_id: str, language: str, db_manager: Optional[DatabaseManager] = None):
        """Initialize fill-in-the-blank history.

        Args:
            user_id: User ID for database operations
            language: Language being practiced
            db_manager: Database manager for persistence
        """
        self.user_id = user_id
        self.language = language
        self.db_manager = db_manager
        self.attempts = []  # List of FillBlankAttempt objects
        self.session_stats = {
            "total": 0,
            "correct": 0,
            "words": set()
        }

    def add_attempt(self, word: str, user_answer: str, correct: bool) -> None:
        """Add a new attempt to history.

        Args:
            word: The word that was blanked out
            user_answer: The user's answer
            correct: Whether the answer was correct
        """
        attempt = FillBlankAttempt(word, user_answer, correct)
        self.attempts.append(attempt)

        # Update session stats
        self.session_stats["total"] += 1
        if correct:
            self.session_stats["correct"] += 1
        self.session_stats["words"].add(word)

        # Save to database if available
        if self.db_manager:
            try:
                self.db_manager.save_fill_blank_attempt(
                    user_id=self.user_id,
                    language=self.language,
                    word=word,
                    user_answer=user_answer,
                    correct=correct
                )
            except Exception as e:
                logger.error(f"Error saving fill-in-the-blank attempt: {e}")

    def get_attempts(self, word: Optional[str] = None) -> List[FillBlankAttempt]:
        """Get attempts for a specific word or all attempts.

        Args:
            word: Optional word to filter by

        Returns:
            List of attempts
        """
        if word:
            return [a for a in self.attempts if a.word.lower() == word.lower()]
        return self.attempts

    def get_success_rate(self, word: Optional[str] = None) -> float:
        """Get success rate for a word or overall.

        Args:
            word: Optional word to get rate for

        Returns:
            Success rate as float (0-1)
        """
        attempts = self.get_attempts(word)
        if not attempts:
            return 0.0

        correct = sum(1 for a in attempts if a.correct)
        return correct / len(attempts)

    def get_session_stats(self) -> Dict[str, Any]:
        """Get statistics for the current session.

        Returns:
            Dict with session statistics
        """
        return {
            "total": self.session_stats["total"],
            "correct": self.session_stats["correct"],
            "success_rate": (self.session_stats["correct"] / self.session_stats["total"]
                            if self.session_stats["total"] > 0 else 0.0),
            "unique_words": len(self.session_stats["words"])
        }


class FillBlankActivity(Activity):
    """Fill-in-the-blank language learning activity."""

    def __init__(self, language: str, difficulty: int = 1, model_name: Optional[str] = None,
                 topic: Optional[str] = None, show_options: bool = True,
                 level: Optional[str] = None, user_id: Optional[str] = "default_user"):
        """Initialize the fill-in-the-blank activity.

        Args:
            language: Language to practice
            difficulty: Difficulty level (1-5)
            model_name: Optional model to use for generating content
            topic: Optional topic for sentences
            show_options: Whether to show multiple choice options
            level: Language level (a1, a2, b1, b2, c1, c2)
            user_id: User ID for persistence
        """
        super().__init__(language, difficulty, model_name)
        self.topic = topic
        self.show_options = show_options
        self.level = level or self._get_level_from_difficulty(difficulty)
        self.user_id = user_id
        self.correct_count = 0
        self.total_count = 0
        self.current_blank_index = 0

        # Initialize model interface based on model_name
        self.model = self._initialize_model(model_name)

        # Initialize flashcard library manager
        self.library_manager = FlashcardLibraryManager()

        # Initialize history tracker
        try:
            from langue.storage import get_db_manager
            db_manager = get_db_manager()
            self.history = FillBlankHistory(user_id, language, db_manager)
        except Exception as e:
            logger.error(f"Error initializing database manager: {e}")
            self.history = FillBlankHistory(user_id, language)

        # Item counter for continuous mode
        self.item_number = 0
        self.quit_requested = False

    @property
    def name(self) -> str:
        """Get the name of the activity.

        Returns:
            Activity name
        """
        return "Fill-in-the-Blank"

    @property
    def description(self) -> str:
        """Get the description of the activity.

        Returns:
            Activity description
        """
        return "Complete sentences with missing words."

    def get_instructions(self) -> str:
        """Get instructions for the activity.

        Returns:
            Instructions for the activity
        """
        if self.show_options:
            return (
                "You will be shown sentences with missing words.\n"
                "Choose the correct option to fill in each blank.\n"
                "Type the number of your choice (e.g., 1, 2, 3).\n"
                "Continue as long as you like - type 'quit' at any time to exit and see your results."
            )
        else:
            return (
                "You will be shown sentences with missing words.\n"
                "Type the correct word to fill in each blank.\n"
                "Continue as long as you like - type 'quit' at any time to exit and see your results."
            )

    def _initialize_model(self, model_name: Optional[str]) -> ModelInterface:
        """Initialize the model interface.

        Args:
            model_name: Name of the model to use

        Returns:
            Model interface instance
        """
        try:
            if model_name and "claude" in model_name.lower():
                return ClaudeModelInterface(model_name=model_name)
            else:
                return OllamaModelInterface(model_name=model_name)
        except Exception as e:
            console.print(Panel(
                f"[bold red]ERROR: Could not initialize model: {str(e)}[/bold red]\n"
                f"Falling back to default model.",
                title="【ＥＲＲＯＲ】",
                border_style=PANEL_BORDER_STYLE
            ))
            # Fallback to default model
            try:
                return OllamaModelInterface()
            except Exception as fallback_error:
                console.print(Panel(
                    f"[bold red]CRITICAL ERROR: Could not initialize fallback model: {str(fallback_error)}[/bold red]\n"
                    f"The activity may not function correctly.",
                    title="【ＣＲＩＴＩＣＡＬ　ＥＲＲＯＲ】",
                    border_style=PANEL_BORDER_STYLE
                ))
                # Return a minimal mock interface to prevent crashes
                from langue.models.base import ModelInterface
                return ModelInterface()

    def _get_level_from_difficulty(self, difficulty: int) -> str:
        """Map difficulty level to CEFR level.

        Args:
            difficulty: Difficulty level (1-5)

        Returns:
            CEFR level (a1, a2, b1, b2, c1, c2)
        """
        if difficulty <= 0:
            return "a1"

        # Map difficulty to levels
        level_map = {
            1: "a1",
            2: "a2",
            3: "b1",
            4: "b2",
            5: "c1",
            6: "c2"
        }

        return level_map.get(difficulty, "a1")

    def _get_random_flashcard_word(self) -> Optional[Dict[str, Any]]:
        """Get a random word from the flashcard library for the current level.

        Returns:
            Word data or None if no library available
        """
        try:
            # Check if library exists for this language and level
            available_levels = self.library_manager.get_available_levels(self.language)

            if not available_levels:
                logger.info(f"No flashcard libraries found for language: {self.language}")
                return None

            if self.level.lower() not in available_levels:
                logger.info(f"No library for level {self.level} in {self.language}, using available level")
                # Use the closest available level
                if "a1" in available_levels:
                    level = "a1"
                else:
                    level = available_levels[0]
            else:
                level = self.level.lower()

            # Get a random word from the library
            word_data = self.library_manager.get_random_word(self.language, level)
            return word_data

        except Exception as e:
            logger.error(f"Error getting flashcard word: {e}")
            return None

    def generate_content(self) -> Dict[str, Any]:
        """Generate fill-in-the-blank content using flashcard libraries or language model.

        Returns:
            Dictionary containing the generated content:
            - full_sentence: The complete sentence
            - blank_sentence: The sentence with blank(s)
            - missing_word: The word that is missing
            - options: List of options (if multiple choice)
            - translation: English translation of the sentence
            - explanation: Grammar or vocabulary explanation
        """
        # Increment item counter
        self.item_number += 1

        # First, try to get a word from the flashcard library
        word_data = self._get_random_flashcard_word()

        if word_data:
            # Use the flashcard word to generate a sentence
            return self._generate_content_from_word(word_data)
        else:
            # Fallback to full generation with the language model
            return self._generate_content_with_model()

    def _generate_content_from_word(self, word_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fill-in-the-blank content using a word from the flashcard library.

        Args:
            word_data: Word data from the flashcard library

        Returns:
            Content dictionary
        """
        # Extract word and translations
        word = word_data.get("word", "")
        translations = word_data.get("translations", [])
        if not translations:
            translations = [word_data.get("translation", "")]

        # Check if example is provided in the word data
        example = word_data.get("example", "")
        examples = word_data.get("examples", [])
        if examples and not example:
            example = examples[0]

        # If no example is provided, generate one
        if not example:
            # Generate a sentence using the word
            system_prompt = (
                f"You are a language teacher creating an example sentence in {self.language} "
                f"using the word '{word}'. Create a natural-sounding sentence that demonstrates "
                f"the usage of this word at the {self.level.upper()} language level. "
                f"Make sure the word '{word}' appears exactly as provided in the sentence.\n"
                f"The word '{word}' must be used verbatim (exact spelling) in the sentence - this is critical.\n"
                f"The sentence should be appropriate for a {self.level.upper()} level student - do not use vocabulary or grammar "
                f"that would be too complex for this level. Stick to simple sentence structures for A1-A2, "
                f"moderate complexity for B1-B2, and more advanced structures only for C1-C2.\n"
                f"Provide the following in JSON format:\n"
                "1. The sentence containing the word\n"
                "2. An English translation of the sentence\n"
                "Format the response as JSON with keys: sentence, translation"
            )

            user_prompt = f"Create an example sentence in {self.language} using the word '{word}'."

            try:
                response = self.model.get_response(
                    prompt=user_prompt,
                    system_prompt=system_prompt,
                    temperature=0.7
                )

                # Extract JSON content
                json_match = re.search(r'```json\s*([\s\S]*?)\s*```|{[\s\S]*}', response)
                if json_match:
                    json_str = json_match.group(1) if json_match.group(1) else json_match.group(0)
                    try:
                        data = json.loads(json_str)
                        example = data.get("sentence", "")
                        translation = data.get("translation", "")
                    except json.JSONDecodeError:
                        # Fallback to simple parsing
                        lines = response.split("\n")
                        for line in lines:
                            if "sentence" in line.lower() and ":" in line:
                                example = line.split(":", 1)[1].strip().strip('"')
                            elif "translation" in line.lower() and ":" in line:
                                translation = line.split(":", 1)[1].strip().strip('"')
                else:
                    # Fallback to simple parsing
                    lines = response.split("\n")
                    for line in lines:
                        if "sentence" in line.lower() and ":" in line:
                            example = line.split(":", 1)[1].strip().strip('"')
                        elif "translation" in line.lower() and ":" in line:
                            translation = line.split(":", 1)[1].strip().strip('"')

                if not example:
                    # If we still don't have an example, create a simple one
                    example = f"{word}."
            except Exception as e:
                logger.error(f"Error generating example sentence: {e}")
                example = f"{word}."
                translation = ""

        # Create a blank sentence by replacing the word with a blank
        # Try several approaches to ensure the word is properly replaced

        # 1. Try with word boundaries and case-insensitive matching
        pattern = r'(?i)\b' + re.escape(word) + r'\b'
        blank_sentence = re.sub(pattern, '_____', example)

        # 2. If that fails, try without word boundaries
        if '_____' not in blank_sentence:
            pattern = r'(?i)' + re.escape(word)
            blank_sentence = re.sub(pattern, '_____', example)

        # 3. If still failing, try a direct case-insensitive search
        if '_____' not in blank_sentence:
            word_lower = word.lower()
            example_lower = example.lower()

            if word_lower in example_lower:
                start_index = example_lower.find(word_lower)
                end_index = start_index + len(word_lower)
                blank_sentence = example[:start_index] + '_____' + example[end_index:]
            else:
                # If we still can't find the word, regenerate the example
                # This is a failsafe that should rarely be needed
                logger.warning(f"Could not find word '{word}' in example: '{example}'")
                console.print(f"[dim]Generating a new example for the word '{word}'...[/dim]")

                # Create a very simple example as a last resort
                blank_sentence = f"_____ {example}"
                example = f"{word} {example}"

        # Generate options for multiple choice
        options = [word]  # Start with the correct answer

        # Generate wrong options
        try:
            # Get other words from the same level as distractors
            other_words = []
            try:
                # Try to get words from the same category
                category = word_data.get("category", "")
                if category:
                    same_category_words = self.library_manager.get_words_by_category(self.language, self.level, category)
                    other_words = [w.get("word") for w in same_category_words if w.get("word") != word]

                # If we don't have enough, get random words
                if len(other_words) < 3:
                    for _ in range(10):  # Try up to 10 times to get enough words
                        random_word = self.library_manager.get_random_word(self.language, self.level)
                        if random_word and random_word.get("word") != word:
                            other_words.append(random_word.get("word"))
                        if len(other_words) >= 3:
                            break
            except Exception as e:
                logger.error(f"Error getting distractor words: {e}")

            # If we still don't have enough, create fake distractors
            if len(other_words) < 3:
                # Create fake options by modifying the correct answer
                if len(word) > 3:
                    # Change a character
                    modified = list(word)
                    idx = random.randint(1, len(modified)-2)
                    modified[idx] = 'x' if modified[idx] != 'x' else 'z'
                    other_words.append(''.join(modified))

                # Add or remove a character
                if len(word) > 2:
                    if random.choice([True, False]):
                        other_words.append(word[:-1])  # Remove last character
                    else:
                        other_words.append(word + 'a')  # Add a character

                # Reverse the word or part of it
                other_words.append(word[::-1])

            # Add up to 3 wrong options
            options.extend(other_words[:3])

            # Ensure we have only 4 options total
            options = options[:4]

            # Shuffle the options
            random.shuffle(options)

        except Exception as e:
            logger.error(f"Error generating options: {e}")
            # Fallback options
            options = [word, word + "a", word + "s", word[::-1]]
            random.shuffle(options)

        # Create a brief explanation based on the word's characteristics
        category = word_data.get("category", "General")
        difficulty = word_data.get("difficulty", 1)

        explanation = f"This word belongs to the category '{category}'. "
        if translations:
            explanation += f"It means '{', '.join(translations)}' in English. "
        explanation += f"It's considered a {self.level.upper()} level word."

        return {
            "full_sentence": example,
            "blank_sentence": blank_sentence,
            "missing_words": [word],
            "options": [options],
            "translation": translation if 'translation' in locals() else "",
            "explanation": explanation,
            "word_data": word_data,  # Include the original word data
            "source": "library"  # Mark this as library-sourced
        }

    def _generate_content_with_model(self) -> Dict[str, Any]:
        """Generate fill-in-the-blank content using just the language model.

        Returns:
            Content dictionary
        """
        # Create system prompt based on difficulty
        difficulty_descriptions = {
            1: "simple sentences with basic vocabulary for beginners",
            2: "straightforward sentences for elementary learners",
            3: "moderately complex sentences for intermediate learners",
            4: "complex sentences with advanced vocabulary",
            5: "sophisticated sentences with nuanced vocabulary and grammar"
        }

        difficulty_desc = difficulty_descriptions.get(self.difficulty, "intermediate level sentences")

        # Number of blanks to include based on difficulty
        blanks_count = 1 if self.difficulty <= 3 else min(2, self.difficulty - 2)

        # Topic specification
        topic_prompt = f" related to {self.topic}" if self.topic else ""

        system_prompt = (
            f"You are a language teacher creating fill-in-the-blank exercises for {self.language} learners "
            f"at the {self.level.upper()} level. "
            f"Generate {difficulty_desc}{topic_prompt}. "
            f"Create a sentence and remove {blanks_count} key word(s) that would be appropriate for the difficulty level. "
            "Provide the following in JSON format:\n"
            "1. The complete sentence\n"
            "2. The sentence with the word(s) replaced by _____\n"
            "3. The missing word(s)\n"
            "4. Three incorrect but plausible options for each blank\n"
            "5. An English translation of the complete sentence\n"
            "6. A brief explanation of the grammar or vocabulary\n"
            "Format the response as JSON with keys: full_sentence, blank_sentence, missing_words, options, translation, explanation"
        )

        # User prompt
        user_prompt = f"Generate a fill-in-the-blank exercise for {self.language} learners{topic_prompt} at {self.level.upper()} level."

        try:
            # Get response from model
            response = self.model.get_response(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7
            )

            # Extract JSON content from response
            import json
            import re

            # Try to find JSON in the response
            json_match = re.search(r'```json\s*([\s\S]*?)\s*```|{[\s\S]*}', response)
            if json_match:
                json_str = json_match.group(1) if json_match.group(1) else json_match.group(0)
                try:
                    data = json.loads(json_str)

                    # Ensure options is a list of lists for consistency
                    options = data.get("options", [])
                    if options and not isinstance(options[0], list):
                        options = [options]  # Wrap in list if it's just one set

                    # Ensure missing_words is a list for consistency
                    missing_words = data.get("missing_words", data.get("missing_word", ""))
                    if isinstance(missing_words, str):
                        missing_words = [missing_words]

                    return {
                        "full_sentence": data.get("full_sentence", ""),
                        "blank_sentence": data.get("blank_sentence", ""),
                        "missing_words": missing_words,
                        "options": options,
                        "translation": data.get("translation", ""),
                        "explanation": data.get("explanation", ""),
                        "source": "model"  # Mark this as model-generated
                    }
                except json.JSONDecodeError:
                    pass

            # Fallback: Parse response manually if JSON parsing failed
            full_sentence = ""
            blank_sentence = ""
            missing_words = []
            options = []
            translation = ""
            explanation = ""

            lines = response.split("\n")
            for i, line in enumerate(lines):
                if ":" in line:
                    key, value = line.split(":", 1)
                    key = key.strip().lower()
                    value = value.strip()

                    if "full sentence" in key or "complete sentence" in key:
                        full_sentence = value
                    elif "blank" in key:
                        blank_sentence = value
                    elif "missing word" in key:
                        # Try to extract the word and remove quotes if present
                        word = re.sub(r'^["\'](.*)["\']$', r'\1', value)
                        missing_words.append(word)
                    elif "translation" in key:
                        translation = value
                    elif "explanation" in key or "note" in key:
                        explanation = value
                    elif "option" in key or "incorrect" in key:
                        # This might be one of the options
                        if not value.strip() in missing_words:  # Don't include the answer as an option
                            if len(options) == 0:
                                options.append([])
                            options[0].append(value)

            # Extract missing words from context if not found explicitly
            if not missing_words and full_sentence and blank_sentence:
                # Find what's missing by comparing sentences
                full_words = extract_words(full_sentence, self.language)
                blank_words = extract_words(blank_sentence.replace("_____", ""), self.language)
                missing_words = [word for word in full_words if word not in blank_words]

            # Generate default options if none were found
            if not options and missing_words:
                options = [[missing_words[0]]]  # Start with the correct answer
                # Add some generic wrong options
                if self.language in ["Spanish", "French", "Italian", "Portuguese"]:
                    options[0].extend(["es", "la", "el", "un", "una"])
                elif self.language in ["German"]:
                    options[0].extend(["der", "die", "das", "ein", "eine"])
                else:
                    options[0].extend(["the", "a", "is", "in", "on"])

                # Ensure we have only 4 options total
                options[0] = options[0][:4]
                # Shuffle the options
                random.shuffle(options[0])

            # Ensure we have the missing word in the options
            for i, word_options in enumerate(options):
                if i < len(missing_words) and missing_words[i] not in word_options:
                    word_options.append(missing_words[i])
                    # Ensure we have only 4 options total
                    word_options = word_options[:4]
                    # Shuffle the options
                    random.shuffle(word_options)
                    options[i] = word_options

            return {
                "full_sentence": full_sentence,
                "blank_sentence": blank_sentence,
                "missing_words": missing_words,
                "options": options,
                "translation": translation,
                "explanation": explanation,
                "source": "model"  # Mark this as model-generated
            }

        except Exception as e:
            # Return fallback content in case of error
            console.print(Panel(
                f"[bold red]Error generating fill-in-the-blank: {str(e)}[/bold red]",
                title="【ＥＲＲＯＲ】",
                border_style=PANEL_BORDER_STYLE
            ))
            return {
                "full_sentence": f"[Error generating {self.language} sentence]",
                "blank_sentence": "_____ _____ _____",
                "missing_words": ["error"],
                "options": [["error", "mistake", "problem", "bug"]],
                "translation": "[Error generating translation]",
                "explanation": "",
                "source": "fallback"  # Mark this as fallback content
            }

    def present_challenge(self, content: Dict[str, Any]) -> None:
        """Present a fill-in-the-blank challenge to the user.

        Args:
            content: Fill-in-the-blank content to present
        """
        blank_sentence = content.get("blank_sentence", "")
        missing_words = content.get("missing_words", [])
        options = content.get("options", [])
        translation = content.get("translation", "")
        source = content.get("source", "model")

        # Display the item number
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]ＩＴＥＭ {self.item_number}[/bold {SYNTHWAVE_THEME['primary']}]")

        # Track the missing words
        if missing_words:
            self.track_words(missing_words)

        # Check if quit was requested
        if self.quit_requested:
            self._show_summary()
            return

        # Display the sentence with blanks
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['secondary']}]{blank_sentence}[/bold {SYNTHWAVE_THEME['secondary']}]",
            title="【ＣＯＭＰＬＥＴＥ　ＴＨＥ　ＳＥＮＴＥＮＣＥ】",
            expand=False,
            border_style=PANEL_BORDER_STYLE
        ))

        # Don't show translation initially - we'll show it after the answer
        # This creates more challenge for the user

        # For multiple blanks, we'll handle each one separately
        self.current_blank_index = 0

        if self.show_options and options and self.current_blank_index < len(options):
            # Show multiple choice options
            console.print(f"[bold {SYNTHWAVE_THEME['primary']}]【ＣＨＯＯＳＥ　ＴＨＥ　ＣＯＲＲＥＣＴ　ＯＰＴＩＯＮ】[/bold {SYNTHWAVE_THEME['primary']}]")
            for i, option in enumerate(options[self.current_blank_index], 1):
                console.print(f"  {i}. [{SYNTHWAVE_THEME['secondary']}]{option}[/{SYNTHWAVE_THEME['secondary']}]")

    def process_response(self, user_input: str, content: Dict[str, Any]) -> Tuple[bool, str]:
        """Process the user's response to the fill-in-the-blank challenge.

        Args:
            user_input: User's input (option number or word)
            content: Content for the current challenge

        Returns:
            Tuple of (is_correct, feedback)
        """
        # Check for quit command
        if user_input.lower() == 'quit':
            self.quit_requested = True
            return True, "Quitting activity."

        # Check if quit was already requested
        if self.quit_requested:
            return True, "Quitting activity."

        missing_words = content.get("missing_words", [])
        options = content.get("options", [])
        explanation = content.get("explanation", "")
        full_sentence = content.get("full_sentence", "")
        translation = content.get("translation", "")

        # If we don't have any missing words or we've handled all blanks, return error
        if not missing_words or self.current_blank_index >= len(missing_words):
            return False, "No more blanks to fill."

        # Get the correct answer for the current blank
        correct_answer = missing_words[self.current_blank_index]

        # Determine if the answer is correct
        is_correct = False

        if self.show_options and options and self.current_blank_index < len(options):
            # Handle multiple choice response
            try:
                # Parse the option number
                option_index = int(user_input) - 1
                if 0 <= option_index < len(options[self.current_blank_index]):
                    selected_option = options[self.current_blank_index][option_index]
                    # Handle case where selected_option might be a dict or other non-string type
                    if isinstance(selected_option, str):
                        is_correct = selected_option.lower() == correct_answer.lower()
                    else:
                        # If it's a dict or other type, try to convert to string or use as is
                        try:
                            is_correct = str(selected_option).lower() == correct_answer.lower()
                        except:
                            is_correct = False
                else:
                    return False, f"Invalid option. Please choose 1-{len(options[self.current_blank_index])}."
            except ValueError:
                # If they typed a word instead of a number, check if it matches
                is_correct = user_input.lower() == correct_answer.lower()
        else:
            # Free text entry - just compare the words
            is_correct = user_input.lower() == correct_answer.lower()

        # Update counters
        self.total_count += 1
        if is_correct:
            self.correct_count += 1
            # Award points
            self.points_earned += 1

        # Add this attempt to history
        if missing_words and correct_answer:
            self.history.add_attempt(correct_answer, user_input, is_correct)

        # Prepare feedback
        if is_correct:
            feedback = f"★ CORRECT! ★ The missing word is '{correct_answer}'."
            # Add explanation if available
            if explanation:
                feedback += f"\n\n{explanation}"
        else:
            feedback = f"✖ NOT QUITE. The correct answer is '{correct_answer}'."
            # Add explanation if available
            if explanation:
                feedback += f"\n\n{explanation}"

        # Highlight the previously blanked word in the full sentence
        highlighted_sentence = full_sentence
        if correct_answer and correct_answer in full_sentence:
            highlighted_sentence = full_sentence.replace(
                correct_answer,
                f"[bold {SYNTHWAVE_THEME['accent']}]{correct_answer}[/bold {SYNTHWAVE_THEME['accent']}]",
                1
            )

        # Show the full sentence
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['highlight']}]{highlighted_sentence}[/bold {SYNTHWAVE_THEME['highlight']}]",
            title="【ＣＯＭＰＬＥＴＥ　ＳＥＮＴＥＮＣＥ】",
            expand=False,
            border_style=PANEL_BORDER_STYLE
        ))

        # Always show translation after answering
        if translation:
            console.print(f"\n[bold {SYNTHWAVE_THEME['accent']}]Translation:[/bold {SYNTHWAVE_THEME['accent']}] {translation}\n")

        # Show running points total
        console.print(f"[bold {SYNTHWAVE_THEME['secondary']}]Points: {self.points_earned}[/bold {SYNTHWAVE_THEME['secondary']}]\n")

        # Move to next blank if there are more
        self.current_blank_index += 1

        # If there are more blanks, show the next one
        if self.current_blank_index < len(missing_words) and self.current_blank_index < len(options):
            console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]【ＮＥＸＴ　ＢＬＡＮＫ】[/bold {SYNTHWAVE_THEME['primary']}]")
            if self.show_options:
                for i, option in enumerate(options[self.current_blank_index], 1):
                    console.print(f"  {i}. [{SYNTHWAVE_THEME['secondary']}]{option}[/{SYNTHWAVE_THEME['secondary']}]")

        return is_correct, feedback

    def start(self) -> None:
        """Start the fill-in-the-blank activity.

        This overrides the base Activity.start() to implement continuous mode.
        """
        # Display activity header
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['primary']}]【﻿{self.name.upper()}】[/bold {SYNTHWAVE_THEME['primary']}]",
            subtitle=f"Difficulty: {self.difficulty} • Level: {self.level.upper()}",
            border_style=PANEL_BORDER_STYLE
        ))
        console.print(f"Language: [{SYNTHWAVE_THEME['secondary']}]{self.language}[/{SYNTHWAVE_THEME['secondary']}]\n")

        # Show instructions
        console.print(f"[bold {SYNTHWAVE_THEME['accent']}]【﻿ＩＮＳＴＲＵＣＴＩＯＮＳ】[/bold {SYNTHWAVE_THEME['accent']}] {self.get_instructions()}\n")

        # Run in continuous mode until the user quits
        self.quit_requested = False

        while not self.quit_requested:
            self.item_number += 1
            console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]ＩＴＥＭ {self.item_number}[/bold {SYNTHWAVE_THEME['primary']}]")

            # Generate content for this item
            content = self.generate_content()

            # Present the challenge to the user
            self.present_challenge(content)

            # If quit was requested during presentation, break the loop
            if self.quit_requested:
                break

            # Get user input
            user_input = console.input(f"\n[bold {SYNTHWAVE_THEME['secondary']}]Your answer: [/bold {SYNTHWAVE_THEME['secondary']}]")

            # Process user response (may set quit_requested to True)
            is_correct, feedback = self.process_response(user_input, content)

            # Display feedback
            if is_correct and not self.quit_requested:
                console.print(f"\n[bold {SYNTHWAVE_THEME['highlight']}]★ ＣＯＲＲＥＣＴ! ★[/bold {SYNTHWAVE_THEME['highlight']}] {feedback}")
            elif not self.quit_requested:
                console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]✖ ＴＲＹ　ＡＧＡＩＮ ✖[/bold {SYNTHWAVE_THEME['primary']}] {feedback}")

        # Summary is shown in present_challenge when quit is detected

    def _show_summary(self) -> None:
        """Show a summary of the fill-in-the-blank activity results."""
        # Get session stats
        stats = self.history.get_session_stats()
        success_rate = (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0

        summary_text = Text()
        summary_text.append(f"\n★★★ ＡＣＴＩＶＩＴＹ ＣＯＭＰＬＥＴＥ! ★★★\n\n", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        summary_text.append(f"Points earned: {self.points_earned}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Blanks filled: {self.total_count}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Correct answers: {self.correct_count}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Success rate: {success_rate:.1f}%\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"New words encountered: {len(self.words_encountered)}\n", style=f"{SYNTHWAVE_THEME['secondary']}")

        console.print(Panel(
            summary_text,
            title="【ＳＵＭＭＡＲＹ】",
            border_style=PANEL_BORDER_STYLE
        ))

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the fill-in-the-blank activity.

        Returns:
            Dictionary with activity results
        """
        results = super().get_results()
        results.update({
            "total_blanks": self.total_count,
            "correct_blanks": self.correct_count,
            "success_rate": (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0,
        })
        return results
