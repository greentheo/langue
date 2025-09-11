"""
Flashcard activity for Langue.

This module provides the FlashcardActivity class which implements a flashcard-based
vocabulary learning activity.
"""

import json
import random
import statistics
import os
from typing import Dict, Optional, Tuple, Any, List
from datetime import datetime

from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.progress import Progress, BarColumn, TextColumn
from rich.columns import Columns

from langue.activities.base import Activity
from langue.models.base import ModelInterface
from langue.models.ollama import OllamaModelInterface
from langue.models.claude import ClaudeModelInterface

# Import console with 80's theme from base activity
from langue.activities.base import console, SYNTHWAVE_THEME, PANEL_BORDER_STYLE


class FlashcardActivity(Activity):
    """Flashcard-based vocabulary learning activity."""

    def __init__(self, language: str, difficulty: int = 1, model_name: Optional[str] = None,
                 auto_reveal: int = 0, topic: Optional[str] = None, user_id: Optional[str] = "default_user"):
        """Initialize the flashcard activity.

        Args:
            language: Language to practice
            difficulty: Difficulty level (1-5)
            model_name: Optional model to use for generating content
            auto_reveal: Seconds before automatically revealing answer (0 for manual)
            topic: Optional topic to focus on for vocabulary
            user_id: User ID for persistence
        """
        super().__init__(language, difficulty, model_name)
        self.auto_reveal = auto_reveal
        self.topic = topic
        self.correct_count = 0
        self.total_count = 0
        self.user_id = user_id

        # Flashcard history tracking
        self.flashcard_history = {}

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

    def _get_original_instructions(self) -> str:
        """Get original instructions for the flashcard activity.

        Returns:
            String with instructions for the user
        """
        return (
            f"You will be shown words in {self.language}. "
            "Try to recall the meaning in English, then press Enter to see the answer. "
            "After seeing the answer, rate your confidence from 1-3 "
            "(1: Didn't know, 2: Unsure, 3: Knew it)."
        )

    def _load_history_from_db(self) -> None:
        """Load flashcard history from the database."""
        try:
            # Lazy import to avoid circular imports
            from langue.storage.integration import get_flashcard_history

            # Skip database loading in test environments
            if os.environ.get('LANGUE_TEST_MODE') == '1':
                return

            # Get history from database - ensure user_id is a string
            user_id = str(self.user_id) if self.user_id is not None else "default_user"
            history = get_flashcard_history(user_id, self.language)

            # Process history into our flashcard_history format
            for entry in history:
                word = entry.get('word')
                if word not in self.flashcard_history:
                    self.flashcard_history[word] = {
                        'encounters': 0,
                        'answers': [],
                        'scores': []
                    }

                # Add this entry to the history
                self.flashcard_history[word]['encounters'] += 1
                self.flashcard_history[word]['answers'].append(entry.get('user_answer', ''))
                self.flashcard_history[word]['scores'].append(entry.get('score', 0))
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
            model_id = model_name.split(":", 1)[1] if ":" in model_name else "claude-3-haiku-20240307"
            return ClaudeModelInterface(model_name=model_id)
        else:
            # Fallback to Ollama
            return OllamaModelInterface()

    def generate_content(self) -> Dict[str, Any]:
        """Generate flashcard content using the language model.

        Returns:
            Dictionary containing the generated content with:
            - word: The word in the target language
            - translation: The English translation
            - example: Example sentence using the word
            - notes: Additional context or grammar notes
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

        # User prompt with some history context if available
        recently_seen = list(self.flashcard_history.keys())[:5]  # Get up to 5 previous words

        # Find words that need practice (with low scores)
        words_to_practice = []
        for word, data in self.flashcard_history.items():
            if data.get('scores') and len(data['scores']) >= 2:  # At least 2 attempts
                avg_score = sum(data['scores']) / len(data['scores'])
                if avg_score < 6:  # Below 6 means needs practice
                    words_to_practice.append(word)

        if words_to_practice and random.random() < 0.3:  # 30% chance to get a word that needs practice
            # Prioritize words that need practice
            practice_word = random.choice(words_to_practice[:5])
            history_context = f" Use this specific word that needs practice: {practice_word}"
        else:
            # Otherwise avoid recently seen words
            history_context = f" Avoid these previously shown words: {', '.join(recently_seen)}" if recently_seen else ""

        user_prompt = f"Generate a flashcard for a {self.language} word{topic_prompt}.{history_context}"

        try:
            # Get response from model
            response = self.model.get_response(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7
            )

            # Extract JSON content from response
            import re

            # Try to find JSON in the response
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
                        "notes": data.get("notes", "")
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

    def present_challenge(self, content: Dict[str, Any]) -> None:
        """Present a flashcard challenge to the user.

        Args:
            content: Flashcard content to present
        """
        word = content.get("word", "")

        # Track this word
        if word:
            self.track_words([word])

        # Display the flashcard front (word only)
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['primary']}]{word}[/bold {SYNTHWAVE_THEME['primary']}]",
            title="【ＷＯＲＤ】",
            expand=False,
            border_style=PANEL_BORDER_STYLE
        ))

        # Get user's answer before revealing the correct one
        user_answer = console.input(f"[italic {SYNTHWAVE_THEME['accent']}]Your translation (or 'quit' to end): [/italic {SYNTHWAVE_THEME['accent']}]")

        # Store the user's answer in the content for later reference
        content["user_answer"] = user_answer

        # Check if the user wants to quit
        if self.is_quit_command(user_answer):
            return

        # Show the full flashcard with answer
        self._display_full_flashcard(content)

        # If this is a first encounter with this word, initialize its history
        word = content.get("word", "")
        if word not in self.flashcard_history:
            self.flashcard_history[word] = {
                "encounters": 0,
                "answers": [],
                "scores": []
            }

        # Increment encounter count
        self.flashcard_history[word]["encounters"] += 1

    def _display_full_flashcard(self, content: Dict[str, Any]) -> None:
        """Display the complete flashcard with all information.

        Args:
            content: Flashcard content to display
        """
        word = content.get("word", "")
        translation = content.get("translation", "")
        example = content.get("example", "")
        example_translation = content.get("example_translation", "")
        notes = content.get("notes", "")

        # Get user's answer
        user_answer = content.get("user_answer", "")

        # Create a table to display the flashcard information
        table = Table(show_header=False, expand=False)
        table.add_column("Field", style="bold")
        table.add_column("Content")

        table.add_row("Word", f"[{SYNTHWAVE_THEME['primary']}]{word}[/{SYNTHWAVE_THEME['primary']}]")
        table.add_row("Your Translation", f"[{SYNTHWAVE_THEME['accent']}]{user_answer}[/{SYNTHWAVE_THEME['accent']}]")
        table.add_row("Correct Translation", translation)

        if example:
            table.add_row("Example", f"[italic {SYNTHWAVE_THEME['secondary']}]{example}[/italic {SYNTHWAVE_THEME['secondary']}]")
        if example_translation:
            table.add_row("Example Translation", example_translation)
        if notes:
            table.add_row("Notes", f"[dim {SYNTHWAVE_THEME['accent']}]{notes}[/dim {SYNTHWAVE_THEME['accent']}]")

        console.print(table)

        # Evaluate the answer right away and show feedback
        is_correct, feedback, score = self._evaluate_answer_with_llm(word, translation, user_answer)

        # Display score and feedback
        console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＦＥＥＤＢＡＣＫ】[/bold {SYNTHWAVE_THEME['secondary']}]")
        if is_correct:
            console.print(f"[bold {SYNTHWAVE_THEME['highlight']}]Score: {score}/10[/bold {SYNTHWAVE_THEME['highlight']}] {feedback}")
        else:
            console.print(f"[bold {SYNTHWAVE_THEME['primary']}]Score: {score}/10[/bold {SYNTHWAVE_THEME['primary']}] {feedback}")

        # Show running total
        self.points_earned += score
        console.print(f"[{SYNTHWAVE_THEME['secondary']}]Total points: {self.points_earned}[/{SYNTHWAVE_THEME['secondary']}]\n")

        # Store this attempt in history
        if word not in self.flashcard_history:
            self.flashcard_history[word] = {
                "encounters": 0,
                "answers": [],
                "scores": []
            }

        # Update the history
        self.flashcard_history[word]["encounters"] += 1
        self.flashcard_history[word]["answers"].append(user_answer)
        self.flashcard_history[word]["scores"].append(score)

        # Save to database
        try:
            if os.environ.get('LANGUE_TEST_MODE') != '1':
                # Lazy import to avoid circular imports
                from langue.storage.integration import save_flashcard_attempt

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

    def process_response(self, user_input: str, content: Dict[str, Any]) -> Tuple[bool, str]:
        """Process the user's answer to the flashcard.

        Args:
            user_input: User's input (not used in this implementation as feedback is already shown)
            content: Content for the current flashcard, including user's answer

        Returns:
            Tuple of (is_correct, feedback)
        """
        word = content.get("word", "")
        translation = content.get("translation", "")
        user_answer = content.get("user_answer", "")

        # The evaluation is already done in _display_full_flashcard
        # This is just a stub to maintain compatibility with the Activity interface
        # Get the latest score and feedback from flashcard history
        is_correct = False
        feedback = "Feedback already shown"
        score = 0

        if word in self.flashcard_history and self.flashcard_history[word]["scores"]:
            score = self.flashcard_history[word]["scores"][-1]
            is_correct = score >= 7  # Consider 7+ as correct

        self.total_count += 1

        # Count as correct if the score is high enough
        if is_correct:
            self.correct_count += 1

        return is_correct, feedback

    def _evaluate_answer_with_llm(self, word: str, translation: str, user_answer: str) -> Tuple[bool, str, int]:
        """Use the language model to evaluate the user's answer and provide feedback.

        Args:
            word: The flashcard word in the target language
            translation: The correct translation
            user_answer: The user's answer

        Returns:
            Tuple of (is_correct, feedback, score)
            - is_correct: Boolean indicating if the answer is correct
            - feedback: Personalized feedback from the LLM
            - score: Score from 1-10 evaluating the answer
        """
        # Create system prompt for evaluating answers
        system_prompt = (
            "You are a language learning assistant evaluating a user's flashcard answer. "
            "Provide helpful, encouraging feedback on their response. "
            "Also rate the answer on a scale from 1-10 where 10 is perfect. "
            "Consider alternative translations, partial correctness, typos, etc. "
            "Be lenient with minor mistakes but strict with major ones. "
            "Format response as JSON with keys: is_correct (boolean), feedback (string), score (integer 1-10)."
        )

        # User prompt for evaluation
        user_prompt = (
            f"Evaluate this flashcard response:\n\n"
            f"Word: {word}\n"
            f"Correct translation: {translation}\n"
            f"User's answer: {user_answer}\n\n"
            f"Provide feedback and score the answer from 1-10."
        )

        try:
            # Get response from model
            response = self.model.get_response(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.3  # Lower temperature for more consistent evaluation
            )

            # Extract JSON content from response
            import re

            # Try to find JSON in the response
            json_match = re.search(r'```json\s*([\s\S]*?)\s*```|{[\s\S]*}', response)
            if json_match:
                json_str = json_match.group(1) if json_match.group(1) else json_match.group(0)
                try:
                    data = json.loads(json_str)
                    return (
                        data.get("is_correct", False),
                        data.get("feedback", "Keep practicing this word."),
                        data.get("score", 5)
                    )
                except json.JSONDecodeError:
                    pass

            # Fallback: Manual parsing if JSON extraction fails
            is_correct = "correct" in response.lower() and "incorrect" not in response.lower()

            # Extract a score if possible
            score_match = re.search(r'score:\s*(\d+)', response, re.IGNORECASE)
            score = int(score_match.group(1)) if score_match else 5

            # Limit score to 1-10 range
            score = max(1, min(score, 10))

            # Use the whole response as feedback if JSON parsing failed
            return is_correct, response, score

        except Exception as e:
            # Return a default evaluation in case of error
            console.print(f"[red]Error evaluating answer: {str(e)}[/red]")

            # Basic evaluation as fallback
            basic_match = user_answer.lower().strip() == translation.lower().strip()
            feedback = "Your answer looks correct!" if basic_match else "Keep practicing this word."
            score = 8 if basic_match else 3

            return basic_match, feedback, score

    def _show_summary(self) -> None:
        """Show a summary of the flashcard activity results with visualizations."""
        success_rate = (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0

        # Calculate average score for each word
        word_scores = {}
        for word, data in self.flashcard_history.items():
            if data["scores"]:
                word_scores[word] = sum(data["scores"]) / len(data["scores"])

        # Sort words by score (lowest first)
        words_to_practice = sorted(word_scores.items(), key=lambda x: x[1])[:5]

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
        self._show_progress_visualizations(words_to_practice)

    def _show_progress_visualizations(self, words_to_practice: List[Tuple[str, float]]) -> None:
        """Show visualizations for flashcard progress.

        Args:
            words_to_practice: List of (word, score) tuples sorted by score (lowest first)
        """
        console.print("\n[bold]【ＦＬＡＳＨＣＡＲＤ ＰＲＯＧＲＥＳＳ】[/bold]\n")

        # Create progress bars for words that need practice
        if words_to_practice:
            console.print("[bold]Words that need more practice:[/bold]")

            progress_panels = []
            for word, score in words_to_practice:
                # Get stats from database or use defaults for tests
                if os.environ.get('LANGUE_TEST_MODE') == '1':
                    # Use default stats for tests
                    stats = {
                        'word': word,
                        'avg_score': score,
                        'attempts': 3,
                        'correct_count': 2,
                        'correct_percentage': 66.7,
                        'last_seen': datetime.now().isoformat()
                    }
                else:
                    # Lazy import to avoid circular imports
                    from langue.storage.integration import get_flashcard_stats

                    # Get detailed stats for this word - ensure user_id is a string
                    user_id = str(self.user_id) if self.user_id is not None else "default_user"
                    stats = get_flashcard_stats(user_id, word, self.language)

                attempts = stats.get('attempts', 0)
                correct_pct = stats.get('correct_percentage', 0)

                # Create a progress panel for this word
                progress = Progress(
                    TextColumn(f"[bold]{word}[/bold]"),
                    BarColumn(bar_width=40, style=SYNTHWAVE_THEME['primary']),
                    TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                    expand=True
                )

                # Add task for mastery progress
                progress.add_task("", total=10, completed=int(min(10, score)))

                # Create panel with progress and stats
                panel = Panel(
                    progress,
                    title=f"Mastery: {score:.1f}/10",
                    subtitle=f"Attempts: {attempts} | Success: {correct_pct:.1f}%",
                    border_style=PANEL_BORDER_STYLE,
                    width=60
                )
                progress_panels.append(panel)

            # Display all progress panels
            console.print(Columns(progress_panels))

        # Show learning trend if we have enough data
        all_scores = []
        for data in self.flashcard_history.values():
            all_scores.extend(data.get('scores', []))

        if len(all_scores) >= 5:
            console.print("\n[bold]Learning Trend:[/bold]")

            # Group scores by chunks to show trend
            chunk_size = max(1, len(all_scores) // 5)  # Divide into ~5 chunks
            chunks = [all_scores[i:i+chunk_size] for i in range(0, len(all_scores), chunk_size)]

            # Calculate average score for each chunk
            avg_scores = [sum(chunk)/len(chunk) for chunk in chunks]

            # Create progress bars to visualize trend
            trend_progress = Progress(
                TextColumn("[progress.description]{task.description}"),
                BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                expand=True
            )

            # Add tasks for each chunk
            for i, avg in enumerate(avg_scores):
                chunk_name = f"Set {i+1}"
                if i == len(avg_scores) - 1:
                    chunk_name = "Latest"
                trend_progress.add_task(f"[bold]{chunk_name}[/bold]", total=10, completed=int(min(10, avg)))

            # Show trend panel
            console.print(Panel(
                trend_progress,
                title=f"Average Score Trend ({len(all_scores)} total attempts)",
                border_style=PANEL_BORDER_STYLE
            ))

            # Calculate and show statistics
            if len(all_scores) >= 2:
                mean = statistics.mean(all_scores)
                median = statistics.median(all_scores)
                improvement = avg_scores[-1] - avg_scores[0]

                stats_text = Text()
                stats_text.append(f"Average score: {mean:.1f}/10\n", style=SYNTHWAVE_THEME['secondary'])
                stats_text.append(f"Median score: {median:.1f}/10\n", style=SYNTHWAVE_THEME['secondary'])

                if improvement > 0:
                    stats_text.append(f"Improvement: +{improvement:.1f} points\n", style=SYNTHWAVE_THEME['highlight'])
                else:
                    stats_text.append(f"Change: {improvement:.1f} points\n", style=SYNTHWAVE_THEME['accent'])

                console.print(Panel(
                    stats_text,
                    title="Statistics",
                    border_style=PANEL_BORDER_STYLE
                ))

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the flashcard activity.

        Returns:
            Dictionary with activity results
        """
        results = super().get_results()

        # Calculate trend data
        trend_data = self._calculate_trend_data()

        # Add detailed flashcard history and stats
        results.update({
            "total_cards": self.total_count,
            "correct_cards": self.correct_count,
            "success_rate": (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0,
            "flashcard_history": self.flashcard_history,
            "trend_data": trend_data,
            "timestamp": datetime.now().isoformat()
        })
        return results

    def is_quit_command(self, user_input: str) -> bool:
        """Check if the user input is a quit command.

        Args:
            user_input: The user's input string

        Returns:
            True if the input is a quit command, False otherwise
        """
        quit_commands = ["quit", "exit", "q", "stop"]
        return user_input.lower().strip() in quit_commands

    def _calculate_trend_data(self) -> Dict[str, Any]:
        """Calculate trend data for visualization.

        Returns:
            Dictionary with trend data
        """
        all_scores = []
        for data in self.flashcard_history.values():
            all_scores.extend(data.get('scores', []))

        if not all_scores:
            return {
                "average_score": 0,
                "median_score": 0,
                "score_trend": [],
                "improvement": 0
            }

        # Group scores for trend visualization
        chunk_size = max(1, len(all_scores) // 5)  # Divide into ~5 chunks
        chunks = [all_scores[i:i+chunk_size] for i in range(0, len(all_scores), chunk_size)]
        avg_scores = [sum(chunk)/len(chunk) for chunk in chunks]

        # Calculate statistics
        mean = statistics.mean(all_scores) if all_scores else 0
        median = statistics.median(all_scores) if all_scores else 0
        improvement = avg_scores[-1] - avg_scores[0] if len(avg_scores) > 1 else 0

        return {
            "average_score": mean,
            "median_score": median,
            "score_trend": avg_scores,
            "improvement": improvement
        }

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
