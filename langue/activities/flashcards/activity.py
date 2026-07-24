"""
Flashcard Activity for Langue.

This module provides the main FlashcardActivity class which implements
a flashcard-based vocabulary learning activity.
"""

import os
import json
import logging
from typing import Dict, Optional, Tuple, Any, List
import random

from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from langue.activities.base import Activity
from langue.models.base import ModelInterface
from langue.models.ollama import OllamaModelInterface
from langue.models.claude import ClaudeModelInterface

# Import console with 80's theme from base activity
from langue.activities.base import console, SYNTHWAVE_THEME, PANEL_BORDER_STYLE

# Import flashcard-specific components
from langue.activities.flashcards.history import FlashcardHistory
from langue.activities.flashcards.evaluation import evaluate_answer
from langue.activities.flashcards.visualization import create_progress_visualization
from langue.activities.flashcards.persistence import load_flashcard_history, save_flashcard_attempt
from langue.activities.flashcards.library_manager import FlashcardLibraryManager


class FlashcardActivity(Activity):
    """Flashcard-based vocabulary learning activity."""

    def __init__(self, language: str, difficulty: int = 1, model_name: Optional[str] = None,
                 auto_reveal: int = 0, topic: Optional[str] = None, user_id: Optional[str] = "default_user",
                 level: Optional[str] = None):
        """Initialize the flashcard activity.

        Args:
            language: Language to practice
            difficulty: Difficulty level (1-6)
            model_name: Optional model to use for generating content
            auto_reveal: Seconds before automatically revealing answer (0 for manual)
            topic: Optional topic to focus on for vocabulary
            user_id: User ID for persistence
            level: Language level (a1, a2, b1, b2, c1, c2)
        """
        super().__init__(language, difficulty, model_name, level)
        self.auto_reveal = auto_reveal
        self.topic = topic
        self.correct_count = 0
        self.total_count = 0
        self.user_id = user_id

        # Debug logging for initialization
        logging.info(f"DEBUG: Initializing FlashcardActivity with parameters:")
        logging.info(f"DEBUG: language={language}, difficulty={difficulty}")
        logging.info(f"DEBUG: user_id={user_id}")
        logging.info(f"DEBUG: provided level={level}")

        # If level is explicitly provided and not None, use it
        # Otherwise, get the level based on difficulty or default to a1
        if level is not None and level.strip():
            self.level = level.lower()
            logging.info(f"DEBUG: Using provided level: {self.level}")
        else:
            self.level = self._get_level_from_difficulty(difficulty)
            logging.info(f"DEBUG: Using difficulty-derived level: {self.level}")

        logging.info(f"DEBUG: Final level set to: {self.level}")

        # Initialize library manager
        self.library_manager = FlashcardLibraryManager()

        # Flashcard history tracking
        self.flashcard_history = FlashcardHistory()

        # For backwards compatibility with tests
        self._history_dict = {}

        # Load persistent history
        self._load_history_from_db()

        # Initialize model interface based on model_name
        self.model = self._initialize_model(model_name)

    @property
    def name(self) -> str:
        """Get the name of the activity.

        Returns:
            String name of the activity
        """
        return "Flashcards"

    @property
    def description(self) -> str:
        """Get the description of the activity.

        Returns:
            String description of the activity
        """
        return "Practice vocabulary with flashcards"

    def get_instructions(self) -> str:
        """Get instructions for the flashcard activity.

        Returns:
            String with instructions for the user
        """
        return (
            f"You will be shown words in {self.language}. "
            "Type your translation in English and press Enter to see the correct answer. "
            "Your answers will be scored on a scale from 1-10, and your total points will accumulate as you progress. "
            "Type 'quit' at any time to end the session and see your progress."
        )

    def _load_history_from_db(self) -> None:
        """Load flashcard history from the database."""
        try:
            # Skip database loading in test environments
            if os.environ.get('LANGUE_TEST_MODE') == '1':
                return

            # Get history from database - ensure user_id is a string
            user_id = str(self.user_id) if self.user_id is not None else "default_user"
            self.flashcard_history = load_flashcard_history(user_id, self.language)

            # Update history dict for backwards compatibility
            self._update_history_dict()
        except Exception as e:
            console.print(f"[red]Error loading flashcard history: {e}[/red]")

    def _initialize_model(self, model_name: Optional[str]) -> ModelInterface:
        """Initialize the appropriate model interface.

        Args:
            model_name: Name of the model to use

        Returns:
            Initialized model interface
        """
        if not model_name or model_name.startswith("ollama:"):
            # Default to Ollama
            model_id = model_name.split(":", 1)[1] if model_name and ":" in model_name else "llama3"
            return OllamaModelInterface(model_name=model_id)
        elif model_name.startswith("claude:"):
            # Use Claude
            model_id = model_name.split(":", 1)[1] if ":" in model_name else None
            return ClaudeModelInterface(model_name=model_id)
        else:
            # Fallback to Ollama
            return OllamaModelInterface()

    def _get_level_from_difficulty(self, difficulty: int) -> str:
        """Convert difficulty (1-6) to CEFR level (A1-C2).

        This mapping ensures consistent level selection across the application.

        Args:
            difficulty: Integer difficulty level (1-6)

        Returns:
            CEFR level string (a1, a2, b1, b2, c1, c2)
        """
        level_map = {
            1: "a1",
            2: "a2",
            3: "b1",
            4: "b2",
            5: "c1",
            6: "c2"
        }
        level = level_map.get(difficulty, "a1")
        logging.info(f"DEBUG: Mapped difficulty {difficulty} to level {level}")
        return level

    def generate_content(self) -> Dict[str, Any]:
        """Generate flashcard content using either the vocabulary library or language model.

        Returns:
            Dictionary containing the generated content with:
            - word: The word in the target language
            - translation: The English translation
            - example: Example sentence using the word
            - notes: Additional context or grammar notes
        """
        logging.info(f"Generating flashcard content for {self.language.capitalize()} level {self.level.upper()}")
        logging.info(f"DEBUG: User ID: {self.user_id}")
        logging.info(f"DEBUG: Language: {self.language}")
        logging.info(f"DEBUG: Level (in activity): {self.level}")
        logging.info(f"DEBUG: Difficulty setting: {self.difficulty}")

        # First try to get word from library based on language and level
        try:
            # Check if we have a library for this language and level
            available_languages = self.library_manager.get_available_languages()
            logging.info(f"DEBUG: Available languages: {available_languages}")

            if self.language.lower() in available_languages:
                available_levels = self.library_manager.get_available_levels(self.language)
                logging.info(f"DEBUG: Library path: {self.library_manager.library_path}")
                logging.info(f"Available levels: {available_levels}, current level: {self.level.upper()}, match: {self.level.lower() in [l.lower() for l in available_levels]}")
                if available_levels and self.level in available_levels:
                    # Load the library
                    library = self.library_manager.load_library(self.language, self.level)
                    library_words = library.get("words", [])

                    if not library_words:
                        # Empty library, fallback to model generation
                        return self._generate_content_with_model()

                    # Use weighted selection based on word scores
                    word_weights = self._calculate_word_weights(library_words)

                    # If we have weights, use weighted random selection
                    if word_weights:
                        try:
                            import random
                            indices = list(word_weights.keys())
                            weights = list(word_weights.values())

                            # Check for valid data before selection
                            if indices and weights and len(indices) == len(weights):
                                # Select a word based on weights
                                selected_index = random.choices(indices, weights=weights, k=1)[0]

                                # Validate index is within bounds
                                if 0 <= selected_index < len(library_words):
                                    word_data = library_words[selected_index]
                                    return self._format_library_word(word_data)
                                else:
                                    logging.warning(f"Selected index {selected_index} out of bounds for library with {len(library_words)} words")
                            else:
                                logging.warning(f"Invalid weights data: indices={len(indices)}, weights={len(weights)}")
                        except Exception as e:
                            logging.error(f"Error in weighted word selection: {e}")

                    # Fallback to random selection if no weights available
                    try:
                        word_data = self.library_manager.get_random_word(self.language, self.level)
                        return self._format_library_word(word_data)
                    except Exception as e:
                        logging.error(f"Error getting random word: {e}")
                        # Continue to model-generated fallback

        except Exception as e:
            console.print(f"[dim]Note: Using model-generated vocabulary (library error: {str(e)})[/dim]")

        # Fallback to model-generated content if library approach fails
        return self._generate_content_with_model()

    def _format_library_word(self, word_data: Dict[str, Any]) -> Dict[str, Any]:
        """Format a word from the library into the standard flashcard format.

        Args:
            word_data: Word data from the library

        Returns:
            Formatted flashcard content
        """
        # Get the first example / its translation (may be absent on older libraries)
        examples = word_data.get("examples", []) or [""]
        example = examples[0] if examples else ""
        example_translations = word_data.get("example_translations", []) or []
        example_translation = example_translations[0] if example_translations else ""

        # Get all translations
        translations = word_data.get("translations", [""]) or [""]

        # Use the first translation for display, but keep all translations for evaluation
        primary_translation = translations[0] if translations else ""

        # Build the notes line (part of speech, category, level).
        part_of_speech = word_data.get("part_of_speech", "")
        note_bits = [f"Category: {word_data.get('category', 'General')}", f"Level: {self.level.upper()}"]
        if part_of_speech:
            note_bits.insert(0, part_of_speech)

        # Format the content in our standard format. New phrase/grammar fields are
        # optional and default empty, so single-word library entries are unaffected.
        return {
            "word": word_data.get("word", ""),
            "translation": primary_translation,
            "all_translations": translations,  # Store all translations for evaluation
            "example": example,
            "example_translation": example_translation,
            "notes": " • ".join(note_bits),
            "unit_type": word_data.get("type", "word"),
            "part_of_speech": part_of_speech,
            "literal": word_data.get("literal", ""),
            "grammar_note": word_data.get("grammar_note", ""),
            "base_form": word_data.get("base_form", ""),
            "breakdown": word_data.get("breakdown", []),
            "source": "library"  # Mark this as coming from the library
        }

    def _generate_content_with_model(self) -> Dict[str, Any]:
        """Generate flashcard content using the language model.

        Returns:
            Dictionary containing the generated content
        """
        # Create system prompt for generating flashcards
        difficulty_descriptions = {
            1: "basic, everyday vocabulary for complete beginners",
            2: "common vocabulary for elementary learners",
            3: "intermediate vocabulary",
            4: "advanced vocabulary",
            5: "sophisticated, nuanced vocabulary for advanced learners"
        }

        difficulty_desc = difficulty_descriptions.get(self.difficulty, "intermediate vocabulary")

        topic_prompt = f" related to {self.topic}" if self.topic else ""

        # Get recently seen words to avoid repetition
        recently_seen = self.flashcard_history.get_recently_seen_words(5)

        # Find words that need practice (with low scores)
        words_to_practice = self.flashcard_history.get_words_needing_practice(5)

        # Construct the prompt with history context
        if words_to_practice and self.flashcard_history.should_review():
            # Prioritize words that need practice
            practice_word = words_to_practice[0] if words_to_practice else ""
            history_context = f" Use this specific word that needs practice: {practice_word}"
        else:
            # Otherwise avoid recently seen words
            history_context = f" Avoid these previously shown words: {', '.join(recently_seen)}" if recently_seen else ""

        system_prompt = (
            f"You are a language teacher creating flashcards for {self.language} learners. "
            f"Generate a single {difficulty_desc} word or phrase{topic_prompt}. "
            "Provide the following in JSON format:\n"
            "1. The word or phrase in the target language\n"
            "2. The English translation\n"
            "3. An example sentence using the word/phrase\n"
            "4. The example sentence translated to English\n"
            "5. Brief notes about usage, context, or grammar\n"
            "Format the response as JSON with keys: word, translation, example, example_translation, notes"
        )

        # User prompt for this task
        user_prompt = f"Generate a flashcard for a {self.language} word{topic_prompt}.{history_context}"

        try:
            # Get response from model
            response = self.model.get_response(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7
            )

            # Parse the response
            result = self._parse_flashcard_response(response)
            result["source"] = "model"  # Mark this as coming from the model

            # For model-generated content, ensure we have an all_translations field
            # that includes the main translation and any alternatives
            if "translation" in result and "all_translations" not in result:
                result["all_translations"] = [result["translation"]]

            return result
        except Exception as e:
            # Return fallback content in case of error
            console.print(f"[red]Error generating flashcard: {str(e)}[/red]")
            return {
                "word": f"[Error generating {self.language} word]",
                "translation": "[Error generating translation]",
                "example": "",
                "example_translation": "",
                "notes": ""
            }

    def _parse_flashcard_response(self, response: str) -> Dict[str, Any]:
        """Parse the response from the language model into flashcard content.

        Args:
            response: The raw response from the language model

        Returns:
            Dictionary containing parsed flashcard content
        """
        # Try to find JSON in the response
        import re
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```|{[\s\S]*}', response)
        if json_match:
            json_str = json_match.group(1) if json_match.group(1) else json_match.group(0)
            try:
                data = json.loads(json_str)
                return {
                    "word": data.get("word", ""),
                    "translation": data.get("translation", ""),
                    "example": data.get("example", ""),
                    "example_translation": data.get("example_translation", ""),
                    "notes": data.get("notes", ""),
                    "all_translations": [data.get("translation", "")]  # Initialize with primary translation
                }
            except json.JSONDecodeError:
                pass

        # Fallback: Parse response manually if JSON parsing failed
        lines = response.split("\n")
        result = {}

        for line in lines:
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip().lower()
                value = value.strip()

                if "word" in key:
                    result["word"] = value
                elif "translation" in key or "english" in key:
                    result["translation"] = value
                elif "example" in key and "translation" not in key:
                    result["example"] = value
                elif "example translation" in key:
                    result["example_translation"] = value
                elif "note" in key or "usage" in key:
                    result["notes"] = value

        # Set default values for any missing fields
        result.setdefault("word", f"[Error generating {self.language} word]")
        result.setdefault("translation", "[Error generating translation]")
        result.setdefault("example", "")
        result.setdefault("example_translation", "")
        result.setdefault("notes", "")
        result.setdefault("all_translations", [result.get("translation", "")])

        return result

    def present_challenge(self, content: Dict[str, Any]) -> None:
        """Present a flashcard challenge to the user.

        Args:
            content: Flashcard content to present
        """
        word = content.get("word", "")

        # Track this word
        if word:
            self.track_words([word])

        # Display the flashcard front. Title reflects whether it's a word, a
        # phrase, or a grammatical form; the part of speech shows as a subtitle.
        unit_type = content.get("unit_type", "word")
        front_titles = {"word": "【ＷＯＲＤ】", "phrase": "【ＰＨＲＡＳＥ】", "grammar": "【ＦＯＲＭ】"}
        pos = content.get("part_of_speech", "")
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['primary']}]{word}[/bold {SYNTHWAVE_THEME['primary']}]",
            title=front_titles.get(unit_type, "【ＷＯＲＤ】"),
            subtitle=pos or None,
            expand=False,
            border_style=PANEL_BORDER_STYLE
        ))

        # Get user's answer before revealing the correct one
        # Handle test environment where input might be mocked
        try:
            user_answer = console.input(f"[italic {SYNTHWAVE_THEME['accent']}]Your translation (or 'quit' to end): [/italic {SYNTHWAVE_THEME['accent']}]")
        except (EOFError, KeyboardInterrupt):
            # For tests, use a default answer
            user_answer = "test_answer"

        # Store the user's answer in the content for later reference
        content["user_answer"] = user_answer

        # Check if the user wants to quit
        if self.is_quit_command(user_answer):
            return

        # Show the full flashcard with answer and evaluation
        self._display_full_flashcard(content)

    def _display_full_flashcard(self, content: Dict[str, Any]) -> None:
        """Display the complete flashcard with all information and evaluation.

        Args:
            content: Flashcard content to display
        """
        word = content.get("word", "")
        translation = content.get("translation", "")
        example = content.get("example", "")
        example_translation = content.get("example_translation", "")
        notes = content.get("notes", "")
        user_answer = content.get("user_answer", "")

        # Create a table to display the flashcard information
        table = Table(show_header=False, expand=False)
        table.add_column("Field", style="bold")
        table.add_column("Content")

        table.add_row("Word", f"[{SYNTHWAVE_THEME['primary']}]{word}[/{SYNTHWAVE_THEME['primary']}]")
        table.add_row("Your Translation", f"[{SYNTHWAVE_THEME['accent']}]{user_answer}[/{SYNTHWAVE_THEME['accent']}]")

        # Display all translations
        all_translations = content.get("all_translations", [translation])
        translations_text = ", ".join(all_translations)
        table.add_row("Correct Translation(s)", translations_text)

        # Literal gloss (for idiomatic phrases where the literal reading differs).
        literal = content.get("literal", "")
        if literal:
            table.add_row("Literal", f"[dim {SYNTHWAVE_THEME['secondary']}]{literal}[/dim {SYNTHWAVE_THEME['secondary']}]")

        # Component-by-component breakdown (how the parts map to meaning).
        breakdown = content.get("breakdown", [])
        if breakdown:
            bd_text = "\n".join(
                f"{b.get('text', '')} → {b.get('gloss', '')}" for b in breakdown if b.get("text")
            )
            if bd_text:
                table.add_row("Breakdown", f"[{SYNTHWAVE_THEME['secondary']}]{bd_text}[/{SYNTHWAVE_THEME['secondary']}]")

        # Grammar note (for conjugated / inflected forms).
        grammar_note = content.get("grammar_note", "")
        base_form = content.get("base_form", "")
        if grammar_note or base_form:
            note = grammar_note
            if base_form:
                note = f"{note} (base form: {base_form})" if note else f"base form: {base_form}"
            table.add_row("Grammar", f"[{SYNTHWAVE_THEME['accent']}]{note}[/{SYNTHWAVE_THEME['accent']}]")

        if example:
            table.add_row("Example", f"[italic {SYNTHWAVE_THEME['secondary']}]{example}[/italic {SYNTHWAVE_THEME['secondary']}]")
        if example_translation:
            table.add_row("Example Translation", f"[dim]{example_translation}[/dim]")
        if notes:
            table.add_row("Notes", f"[dim {SYNTHWAVE_THEME['accent']}]{notes}[/dim {SYNTHWAVE_THEME['accent']}]")

        console.print(table)

        # Evaluate the answer using the LLM, passing all possible translations
        all_translations = content.get("all_translations", [translation])
        is_correct, feedback, score = evaluate_answer(self.model, word, all_translations, user_answer)

        # Display score and feedback
        console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＦＥＥＤＢＡＣＫ】[/bold {SYNTHWAVE_THEME['secondary']}]")
        if is_correct:
            console.print(f"[bold {SYNTHWAVE_THEME['highlight']}]Score: {score}/10[/bold {SYNTHWAVE_THEME['highlight']}] {feedback}")
        else:
            console.print(f"[bold {SYNTHWAVE_THEME['primary']}]Score: {score}/10[/bold {SYNTHWAVE_THEME['primary']}] {feedback}")

        # Show running total
        self.points_earned += score
        console.print(f"[{SYNTHWAVE_THEME['secondary']}]Total points: {self.points_earned}[/{SYNTHWAVE_THEME['secondary']}]\n")

        # Record this attempt in history
        self.flashcard_history.add_attempt(word, user_answer, score, is_correct)

        # Update history dict for backwards compatibility
        self._update_history_dict()

        # Save to database
        try:
            if os.environ.get('LANGUE_TEST_MODE') != '1':
                # Ensure user_id is a string
                user_id = str(self.user_id) if self.user_id is not None else "default_user"
                save_flashcard_attempt(
                    user_id=user_id,
                    word=word,
                    translation=translation,
                    user_answer=user_answer,
                    language=self.language,
                    score=score,
                    correct=is_correct
                )
        except Exception as e:
            console.print(f"[red]Error saving flashcard attempt: {e}[/red]")

    def _update_history_dict(self):
        """Update the history dictionary for backwards compatibility with tests."""
        if isinstance(self.flashcard_history, dict):
            return  # Already a dict

        # Convert FlashcardHistory to dict format
        self._history_dict = {}
        for word in self.flashcard_history.to_dict():
            word_data = self.flashcard_history.to_dict()[word]
            attempts = word_data.get('attempts', [])

            self._history_dict[word] = {
                "encounters": word_data.get('encounters', 0),
                "answers": [a.get('user_answer', '') for a in attempts],
                "scores": [a.get('score', 0) for a in attempts]
            }

        # For backwards compatibility, allow dict-style access
        if not isinstance(self.flashcard_history, dict):
            # Make flashcard_history act like a dict for tests that expect it
            self.flashcard_history.__getitem__ = lambda word: self._history_dict.get(word, {"encounters": 0, "answers": [], "scores": []})
            self.flashcard_history.__contains__ = lambda word: word in self._history_dict

    def process_response(self, user_input: str, content: Dict[str, Any]) -> Tuple[bool, str]:
        """Process the user's answer to the flashcard.

        Args:
            user_input: User's input (not used in this implementation as feedback is already shown)
            content: Content for the current flashcard, including user's answer

        Returns:
            Tuple of (is_correct, feedback)
        """
        word = content.get("word", "")

        # The evaluation is already done in _display_full_flashcard
        # This method mainly updates activity state for compatibility
        is_correct = False
        feedback = "Feedback already shown"

        # Handle both dict-style history (for old tests) and FlashcardHistory
        if isinstance(self.flashcard_history, dict):
            # For backwards compatibility with tests
            if word in self.flashcard_history and 'scores' in self.flashcard_history[word]:
                scores = self.flashcard_history[word]['scores']
                if scores:
                    score = scores[-1]
                    is_correct = score >= 7  # Consider 7+ as correct
        else:
            # Get the result from history if available
            if self.flashcard_history.has_word(word):
                last_attempt = self.flashcard_history.get_last_attempt(word)
                if last_attempt:
                    is_correct = last_attempt.correct
                    score = last_attempt.score

        self.total_count += 1

        # Count as correct if the score is high enough
        if is_correct:
            self.correct_count += 1

        return is_correct, feedback

    def _calculate_word_weights(self, library_words: List[Dict[str, Any]]) -> Dict[int, float]:
        """Calculate weights for words based on historical performance.

        Words with lower scores (more difficult) get higher weights.

        Args:
            library_words: List of words from the library

        Returns:
            Dictionary mapping word indices to weights
        """
        if not library_words:
            return {}

        word_weights = {}

        # Default weight for words without history
        default_weight = 1.0

        for i, word_data in enumerate(library_words):
            word = word_data.get("word", "").lower()

            # Get history for this word
            attempts = self.flashcard_history.get_word_attempts(word)

            if attempts:
                # Calculate average score (1-10)
                avg_score = sum(a.score for a in attempts) / len(attempts)

                # Invert score: lower scores get higher weights
                # Add 1 to avoid division by zero and scale to make differences more significant
                weight = 11.0 - avg_score  # This gives weights from 1 (perfect) to 10 (terrible)

                # Square the weight to make poor performance even more likely to be selected
                weight = weight ** 2
            else:
                # New words get slightly higher than default weight to encourage exploration
                weight = default_weight * 1.5

            word_weights[i] = weight

        # If we somehow ended up with no weights, add a default entry to prevent errors
        if not word_weights and library_words:
            word_weights[0] = default_weight
            logging.warning("No valid weights calculated, using default for first word")

        return word_weights

    def is_quit_command(self, input_text: str) -> bool:
        """Check if the input text is a quit command.

        Args:
            input_text: Text to check

        Returns:
            True if the input is a quit command, False otherwise
        """
        quit_commands = ["quit", "exit", "q", "stop"]
        return input_text.lower().strip() in quit_commands

    def _show_summary(self) -> None:
        """Show a summary of the flashcard activity results with visualizations."""
        success_rate = (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0

        # Get words to practice
        if isinstance(self.flashcard_history, dict):
            # For backwards compatibility with tests
            words_to_practice = []
        else:
            words_to_practice = self.flashcard_history.get_words_needing_practice(5)

        summary_text = Text()
        summary_text.append("\n★★★ ＡＣＴＩＶＩＴＹ ＣＯＭＰＬＥＴＥ! ★★★\n\n", style="bold " + SYNTHWAVE_THEME['highlight'])
        summary_text.append(f"Points earned: {self.points_earned}\n", style=SYNTHWAVE_THEME['secondary'])
        summary_text.append(f"Words practiced: {self.total_count}\n", style=SYNTHWAVE_THEME['secondary'])
        summary_text.append(f"Words mastered: {self.correct_count}\n", style=SYNTHWAVE_THEME['secondary'])
        summary_text.append(f"Success rate: {success_rate:.1f}%\n", style=SYNTHWAVE_THEME['secondary'])
        summary_text.append(f"New words encountered: {len(self.words_encountered)}\n", style=SYNTHWAVE_THEME['secondary'])

        console.print(Panel(
            summary_text,
            title="【ＳＵＭＭＡＲＹ】",
            border_style=PANEL_BORDER_STYLE
        ))

        # Show visualizations for progress
        create_progress_visualization(self.flashcard_history, words_to_practice, self.user_id, self.language)

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the flashcard activity.

        Returns:
            Dictionary with activity results
        """
        results = super().get_results()

        # Add detailed flashcard history and trend data
        results.update({
            "total_cards": self.total_count,
            "correct_cards": self.correct_count,
            "success_rate": (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0,
            "flashcard_history": self.flashcard_history.to_dict() if not isinstance(self.flashcard_history, dict) else self.flashcard_history
        })
        return results
