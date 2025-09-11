"""
Fill-in-the-blank activity for Langue.

This module provides the FillBlankActivity class which implements a fill-in-the-blank
exercise for language learning.
"""

import re
import random
from typing import Dict, List, Optional, Tuple, Any

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.markdown import Markdown

from langue.activities.base import Activity
from langue.models.base import ModelInterface
from langue.models.ollama import OllamaModelInterface
from langue.models.claude import ClaudeModelInterface
from langue.utils.helpers import extract_words

# Import console with 80's theme from base activity
from langue.activities.base import console, SYNTHWAVE_THEME, PANEL_BORDER_STYLE


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

    @property
    def name(self) -> str:
        """Get the name of the activity.

        Returns:
            String name of the activity
        """
        return "Fill in the Blank"

    @property
    def description(self) -> str:
        """Get the description of the activity.

        Returns:
            String description of the activity
        """
        return "Complete sentences with missing words"

    def get_instructions(self) -> str:
        """Get instructions for the fill-in-the-blank activity.

        Returns:
            String with instructions for the user
        """
        if self.show_options:
            return (
                f"You will be shown sentences in {self.language} with one or more missing words. "
                "Choose the correct word from the given options to complete each sentence."
            )
        else:
            return (
                f"You will be shown sentences in {self.language} with one or more missing words. "
                "Type the correct word to complete each sentence."
            )

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
            model_id = model_name.split(":", 1)[1] if ":" in model_name else "claude-3-haiku-20240307"
            return ClaudeModelInterface(model_name=model_id)
        else:
            # Fallback to Ollama
            return OllamaModelInterface()

    def _get_level_from_difficulty(self, difficulty: int) -> str:
        """Convert difficulty (1-5) to CEFR level (A1-C2).

        Args:
            difficulty: Integer difficulty level (1-5)

        Returns:
            CEFR level string (a1, a2, b1, b2, c1, c2)
        """
        level_map = {
            1: "a1",
            2: "a2",
            3: "b1",
            4: "b2",
            5: "c1"
        }
        return level_map.get(difficulty, "a1")

    def generate_content(self) -> Dict[str, Any]:
        """Generate fill-in-the-blank content using the language model.

        Returns:
            Dictionary containing the generated content:
            - full_sentence: The complete sentence
            - blank_sentence: The sentence with blank(s)
            - missing_word: The word that is missing
            - options: List of options (if multiple choice)
            - translation: English translation of the sentence
            - explanation: Grammar or vocabulary explanation
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
            f"You are a language teacher creating fill-in-the-blank exercises for {self.language} learners. "
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
        user_prompt = f"Generate a fill-in-the-blank exercise for {self.language} learners{topic_prompt}."

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
                        "explanation": data.get("explanation", "")
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
                "explanation": explanation
            }

        except Exception as e:
            # Return fallback content in case of error
            console.print(f"[red]Error generating fill-in-the-blank: {str(e)}[/red]")
            return {
                "full_sentence": f"[Error generating {self.language} sentence]",
                "blank_sentence": "_____ _____ _____",
                "missing_words": ["error"],
                "options": [["error", "mistake", "problem", "bug"]],
                "translation": "[Error generating translation]",
                "explanation": ""
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

        # Track the missing words
        if missing_words:
            self.track_words(missing_words)

        # Display the sentence with blanks
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['secondary']}]{blank_sentence}[/bold {SYNTHWAVE_THEME['secondary']}]",
            title="【ＣＯＭＰＬＥＴＥ　ＴＨＥ　ＳＥＮＴＥＮＣＥ】",
            expand=False,
            border_style=PANEL_BORDER_STYLE
        ))

        # Show translation if available (at higher difficulty levels, show it after)
        if translation and self.difficulty <= 2:
            console.print(f"[dim {SYNTHWAVE_THEME['accent']}]Translation: {translation}[/dim {SYNTHWAVE_THEME['accent']}]\n")

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

        # Show the full sentence
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['highlight']}]{full_sentence}[/bold {SYNTHWAVE_THEME['highlight']}]",
            title="【ＣＯＭＰＬＥＴＥ　ＳＥＮＴＥＮＣＥ】",
            expand=False,
            border_style=PANEL_BORDER_STYLE
        ))

        # Show translation if we didn't show it before
        if translation and self.difficulty > 2:
            console.print(f"[dim {SYNTHWAVE_THEME['accent']}]Translation: {translation}[/dim {SYNTHWAVE_THEME['accent']}]\n")

        # Move to next blank if there are more
        self.current_blank_index += 1

        # If there are more blanks, show the next one
        if self.current_blank_index < len(missing_words) and self.current_blank_index < len(options):
            console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]【ＮＥＸＴ　ＢＬＡＮＫ】[/bold {SYNTHWAVE_THEME['primary']}]")
            if self.show_options:
                for i, option in enumerate(options[self.current_blank_index], 1):
                    console.print(f"  {i}. [{SYNTHWAVE_THEME['secondary']}]{option}[/{SYNTHWAVE_THEME['secondary']}]")

        return is_correct, feedback

    def _show_summary(self) -> None:
        """Show a summary of the fill-in-the-blank activity results."""
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
