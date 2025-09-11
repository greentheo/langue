"""
Translation activity for Langue.

This module provides the TranslationActivity class which implements a translation
exercise for language learning.
"""

import re
import random
from typing import Dict, List, Optional, Tuple, Any

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.markup import escape

from langue.activities.base import Activity
from langue.models.base import ModelInterface
from langue.models.ollama import OllamaModelInterface
from langue.models.claude import ClaudeModelInterface
from langue.utils.helpers import extract_words

# Import console with 80's theme from base activity
from langue.activities.base import console, SYNTHWAVE_THEME, PANEL_BORDER_STYLE


class TranslationActivity(Activity):
    """Translation language learning activity."""

    def __init__(self, language: str, difficulty: int = 1, model_name: Optional[str] = None,
                 topic: Optional[str] = None, direction: str = "both",
                 level: Optional[str] = None, user_id: Optional[str] = "default_user"):
        """Initialize the translation activity.

        Args:
            language: Language to practice
            difficulty: Difficulty level (1-5)
            model_name: Optional model to use for generating content
            topic: Optional topic for phrases
            direction: Direction of translation ("to_native", "from_native", or "both")
            level: Language level (a1, a2, b1, b2, c1, c2)
            user_id: User ID for persistence
        """
        super().__init__(language, difficulty, model_name)
        self.topic = topic
        self.direction = direction
        self.level = level or self._get_level_from_difficulty(difficulty)
        self.user_id = user_id
        self.correct_count = 0
        self.total_count = 0
        self.current_direction = direction
        if direction == "both":
            # Start with a random direction
            self.current_direction = random.choice(["to_foreign", "to_english"])

        # Initialize model interface based on model_name
        self.model = self._initialize_model(model_name)

    @property
    def name(self) -> str:
        """Get the name of the activity.

        Returns:
            String name of the activity
        """
        return "Translation Exercise"

    @property
    def description(self) -> str:
        """Get the description of the activity.

        Returns:
            String description of the activity
        """
        return "Translate phrases between languages"

    def get_instructions(self) -> str:
        """Get instructions for the translation activity.

        Returns:
            String with instructions for the user
        """
        if self.direction == "to_foreign":
            return (
                f"Translate the English phrases into {self.language}. "
                "Type your translation and press Enter."
            )
        elif self.direction == "to_english":
            return (
                f"Translate the {self.language} phrases into English. "
                "Type your translation and press Enter."
            )
        else:  # both
            return (
                f"Translate phrases between English and {self.language}. "
                "The direction will vary. Type your translation and press Enter."
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
        """Generate translation content using the language model.

        Returns:
            Dictionary containing the generated content with:
            - original: The original phrase to translate
            - translation: The correct translation
            - direction: Direction of translation ("to_foreign" or "to_english")
            - notes: Optional grammar or vocabulary notes
            - alternate_translations: Other acceptable translations
        """
        # If direction is "both", alternate between directions
        if self.direction == "both":
            self.current_direction = "to_english" if self.current_direction == "to_foreign" else "to_foreign"

        # Create system prompt based on difficulty
        difficulty_descriptions = {
            1: "simple phrases with basic vocabulary for beginners",
            2: "straightforward sentences for elementary learners",
            3: "moderately complex sentences for intermediate learners",
            4: "complex sentences with advanced vocabulary",
            5: "sophisticated sentences with nuanced vocabulary and grammar"
        }

        difficulty_desc = difficulty_descriptions.get(self.difficulty, "intermediate level sentences")

        # Topic specification
        topic_prompt = f" related to {self.topic}" if self.topic else ""

        # Direction-specific instructions
        if self.current_direction == "to_foreign":
            direction_desc = f"Generate an English phrase{topic_prompt} that a student should translate into {self.language}."
            source_lang = "English"
            target_lang = self.language
        else:  # to_english
            direction_desc = f"Generate a {self.language} phrase{topic_prompt} that a student should translate into English."
            source_lang = self.language
            target_lang = "English"

        system_prompt = (
            f"You are a language teacher creating translation exercises for {self.language} learners. "
            f"{direction_desc} Use {difficulty_desc}. "
            "Provide the following in JSON format:\n"
            f"1. The original phrase in {source_lang}\n"
            f"2. The correct translation in {target_lang}\n"
            "3. Two or three alternative acceptable translations\n"
            "4. Brief notes on grammar or vocabulary\n"
            "Format the response as JSON with keys: original, translation, alternate_translations, notes"
        )

        # User prompt
        user_prompt = f"Generate a translation exercise for {self.language} learners{topic_prompt}."

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
                    return {
                        "original": data.get("original", ""),
                        "translation": data.get("translation", ""),
                        "alternate_translations": data.get("alternate_translations", []),
                        "notes": data.get("notes", ""),
                        "direction": self.current_direction
                    }
                except json.JSONDecodeError:
                    pass

            # Fallback: Parse response manually if JSON parsing failed
            original = ""
            translation = ""
            alternate_translations = []
            notes = ""

            lines = response.split("\n")
            for line in lines:
                if ":" in line:
                    key, value = line.split(":", 1)
                    key = key.strip().lower()
                    value = value.strip()

                    if "original" in key or source_lang.lower() in key:
                        original = value
                    elif "translation" in key or "correct" in key or target_lang.lower() in key:
                        translation = value
                    elif "alternative" in key or "alternate" in key:
                        # Might contain multiple translations
                        alt_trans = value.split(",")
                        for alt in alt_trans:
                            alt = alt.strip()
                            if alt and alt != translation:
                                alternate_translations.append(alt)
                    elif "note" in key or "grammar" in key:
                        notes = value

            return {
                "original": original,
                "translation": translation,
                "alternate_translations": alternate_translations,
                "notes": notes,
                "direction": self.current_direction
            }

        except Exception as e:
            # Return fallback content in case of error
            console.print(f"[{SYNTHWAVE_THEME['primary']}]Error generating translation exercise: {str(e)}[/{SYNTHWAVE_THEME['primary']}]")
            if self.current_direction == "to_foreign":
                return {
                    "original": "Hello, how are you today?",
                    "translation": "¡Hola! ¿Cómo estás hoy?",  # Spanish fallback
                    "alternate_translations": [],
                    "notes": "",
                    "direction": "to_foreign"
                }
            else:
                return {
                    "original": "¡Hola! ¿Cómo estás hoy?",  # Spanish fallback
                    "translation": "Hello, how are you today?",
                    "alternate_translations": ["Hi, how are you today?"],
                    "notes": "",
                    "direction": "to_english"
                }

    def present_challenge(self, content: Dict[str, Any]) -> None:
        """Present a translation challenge to the user.

        Args:
            content: Translation content to present
        """
        original = content.get("original", "")
        direction = content.get("direction", "to_foreign")

        # Track words based on the direction
        if direction == "to_foreign":
            # For English to foreign, we track the foreign words
            translation = content.get("translation", "")
            words = extract_words(translation, self.language)
            self.track_words(words)
        else:
            # For foreign to English, we track the foreign words in the original
            words = extract_words(original, self.language)
            self.track_words(words)

        # Determine source and target language labels
        if direction == "to_foreign":
            source_lang = "English"
            target_lang = self.language
        else:
            source_lang = self.language
            target_lang = "English"

        # Display the phrase to translate
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['primary']}]{escape(original)}[/bold {SYNTHWAVE_THEME['primary']}]",
            title=f"【ＴＲＡＮＳＬＡＴＥ】 {source_lang} → {target_lang}",
            expand=False,
            border_style=PANEL_BORDER_STYLE
        ))

    def process_response(self, user_input: str, content: Dict[str, Any]) -> Tuple[bool, str]:
        """Process the user's translation.

        Args:
            user_input: User's translation
            content: Content for the current challenge

        Returns:
            Tuple of (is_correct, feedback)
        """
        translation = content.get("translation", "")
        alternate_translations = content.get("alternate_translations", [])
        notes = content.get("notes", "")
        direction = content.get("direction", "to_foreign")

        # Normalize input and expected translations for comparison
        user_input_norm = self._normalize_text(user_input)
        translation_norm = self._normalize_text(translation)
        alt_translations_norm = [self._normalize_text(alt) for alt in alternate_translations]

        # Check if the translation is correct
        is_exact_match = user_input_norm == translation_norm
        is_alternate_match = any(user_input_norm == alt for alt in alt_translations_norm)
        is_close_match = False

        # For inexact matches, check if it's close enough (more lenient at lower difficulty levels)
        if not (is_exact_match or is_alternate_match) and self.difficulty <= 3:
            # Simple similarity check - more sophisticated methods could be used
            if direction == "to_english":
                # For English, be more lenient with articles, etc.
                user_words = set(user_input_norm.split())
                trans_words = set(translation_norm.split())
                common_words = user_words.intersection(trans_words)

                # If most words match, consider it close enough
                if len(common_words) >= max(len(trans_words) * 0.7, 1):
                    is_close_match = True
            else:
                # For foreign languages, be more careful but still allow for minor differences
                if self._similarity(user_input_norm, translation_norm) > 0.8:
                    is_close_match = True

        is_correct = is_exact_match or is_alternate_match or is_close_match

        # Update counters
        self.total_count += 1
        if is_correct:
            self.correct_count += 1

        # Prepare feedback
        if is_exact_match:
            feedback = "★ ＰＥＲＦＥＣＴ! ★ Your translation is exactly right."
        elif is_alternate_match:
            feedback = "★ ＣＯＲＲＥＣＴ! ★ Your translation is one of the acceptable alternatives."
        elif is_close_match:
            feedback = f"✧ ＡＬＭＯＳＴ ＴＨＥＲＥ! ✧ Your answer is close. The exact translation is: '{translation}'"
        else:
            feedback = f"✖ ＮＯＴ ＱＵＩＴＥ. The correct translation is: '{translation}'"

        # Add grammatical notes if available
        if notes:
            feedback += f"\n\n{notes}"

        # Add alternatives if available and not a perfect match
        if alternate_translations and not is_exact_match:
            alternatives = ", ".join(f'"{alt}"' for alt in alternate_translations)
            feedback += f"\n\nOther acceptable translations: {alternatives}"

        # Display the correct translation in a panel
        if not is_exact_match:
            console.print(Panel(
                f"[bold {SYNTHWAVE_THEME['highlight']}]{translation}[/bold {SYNTHWAVE_THEME['highlight']}]",
                title="【ＣＯＲＲＥＣＴ ＴＲＡＮＳＬＡＴＩＯＮ】",
                expand=False,
                border_style=PANEL_BORDER_STYLE
            ))

        return is_correct, feedback

    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison.

        Args:
            text: Text to normalize

        Returns:
            Normalized text
        """
        # Convert to lowercase
        text = text.lower()

        # Remove punctuation except apostrophes (important for contractions)
        text = re.sub(r'[^\w\s\']', '', text)

        # Remove multiple spaces
        text = re.sub(r'\s+', ' ', text)

        # Trim whitespace
        text = text.strip()

        return text

    def _similarity(self, str1: str, str2: str) -> float:
        """Calculate similarity between two strings.

        A simple implementation of Levenshtein distance-based similarity.

        Args:
            str1: First string
            str2: Second string

        Returns:
            Similarity score between 0 and 1
        """
        # Simple implementation of Levenshtein distance
        if len(str1) == 0 or len(str2) == 0:
            return 0.0

        if len(str1) > len(str2):
            str1, str2 = str2, str1

        distances = range(len(str1) + 1)
        for i2, c2 in enumerate(str2):
            distances_ = [i2+1]
            for i1, c1 in enumerate(str1):
                if c1 == c2:
                    distances_.append(distances[i1])
                else:
                    distances_.append(1 + min((distances[i1], distances[i1 + 1], distances_[-1])))
            distances = distances_

        levenshtein_distance = distances[-1]
        max_len = max(len(str1), len(str2))

        # Convert distance to similarity score
        return 1 - (levenshtein_distance / max_len)

    def _show_summary(self) -> None:
        """Show a summary of the translation activity results."""
        success_rate = (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0

        summary_text = Text()
        summary_text.append(f"\n★★★ ＡＣＴＩＶＩＴＹ ＣＯＭＰＬＥＴＥ! ★★★\n\n", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        summary_text.append(f"Points earned: {self.points_earned}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Phrases translated: {self.total_count}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Correct translations: {self.correct_count}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Success rate: {success_rate:.1f}%\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"New words encountered: {len(self.words_encountered)}\n", style=f"{SYNTHWAVE_THEME['secondary']}")

        console.print(Panel(
            summary_text,
            title="【ＳＵＭＭＡＲＹ】",
            border_style=PANEL_BORDER_STYLE
        ))

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the translation activity.

        Returns:
            Dictionary with activity results
        """
        results = super().get_results()
        results.update({
            "total_phrases": self.total_count,
            "correct_translations": self.correct_count,
            "success_rate": (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0,
        })
        return results
