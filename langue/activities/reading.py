"""
Reading comprehension activity for Langue.

This module provides the ReadingActivity class which implements a reading
comprehension exercise for language learning.
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


class ReadingActivity(Activity):
    """Reading comprehension language learning activity."""

    def __init__(self, language: str, difficulty: int = 1, model_name: Optional[str] = None,
                 topic: Optional[str] = None, passage_length: str = "medium",
                 level: Optional[str] = None, user_id: Optional[str] = "default_user"):
        """Initialize the reading comprehension activity.

        Args:
            language: Language to practice
            difficulty: Difficulty level (1-5)
            model_name: Optional model to use for generating content
            topic: Optional topic for the reading passage
            passage_length: Length of the reading passage (short, medium, long)
            level: Language level (a1, a2, b1, b2, c1, c2)
            user_id: User ID for persistence
        """
        super().__init__(language, difficulty, model_name)
        self.topic = topic
        self.passage_length = passage_length
        self.level = level or self._get_level_from_difficulty(difficulty)
        self.user_id = user_id
        self.correct_count = 0
        self.total_count = 0
        self.current_question_index = 0

        # Initialize model interface based on model_name
        self.model = self._initialize_model(model_name)

    @property
    def name(self) -> str:
        """Get the name of the activity.

        Returns:
            String name of the activity
        """
        return "Reading Comprehension"

    @property
    def description(self) -> str:
        """Get the description of the activity.

        Returns:
            String description of the activity
        """
        return "Read a passage and answer questions about it"

    def get_instructions(self) -> str:
        """Get instructions for the reading comprehension activity.

        Returns:
            String with instructions for the user
        """
        return (
            f"You will be shown a passage in {self.language} followed by questions about it. "
            "Read the passage carefully, then answer each question to the best of your ability."
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
            model_id = model_name.split(":", 1)[1] if ":" in model_name else None
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
        """Generate reading comprehension content using the language model.

        Returns:
            Dictionary containing the generated content with:
            - passage: The reading passage
            - translation: English translation of the passage
            - questions: List of questions about the passage
            - answers: List of answers to the questions
            - options: List of options for each question (including correct answer)
            - vocabulary: List of key vocabulary words with translations
        """
        # Determine passage length in words
        passage_lengths = {
            "short": {1: 50, 2: 75, 3: 100, 4: 125, 5: 150},
            "medium": {1: 100, 2: 150, 3: 200, 4: 250, 5: 300},
            "long": {1: 150, 2: 225, 3: 300, 4: 375, 5: 450}
        }

        # Get word count for the passage
        word_count = passage_lengths.get(self.passage_length, passage_lengths["medium"]).get(self.difficulty, 200)

        # Determine number of questions based on difficulty and passage length
        if self.passage_length == "short":
            question_count = max(2, self.difficulty)
        elif self.passage_length == "long":
            question_count = max(3, self.difficulty + 1)
        else:  # medium
            question_count = max(2, self.difficulty + 1)

        # Create system prompt based on difficulty
        difficulty_descriptions = {
            1: "very simple vocabulary and grammar for beginners",
            2: "basic vocabulary and simple sentences for elementary learners",
            3: "intermediate vocabulary and grammar structures",
            4: "advanced vocabulary and complex sentences",
            5: "sophisticated vocabulary and nuanced expressions for advanced learners"
        }

        difficulty_desc = difficulty_descriptions.get(self.difficulty, "intermediate level")

        # Topic specification
        topic_prompt = f" about {self.topic}" if self.topic else ""

        system_prompt = (
            f"You are a language teacher creating reading comprehension exercises for {self.language} learners. "
            f"Generate a passage of approximately {word_count} words in {self.language}, using {difficulty_desc}{topic_prompt}. "
            f"Then create {question_count} comprehension questions about the passage. "
            "Provide the following in JSON format:\n"
            "1. The reading passage\n"
            "2. An English translation of the passage\n"
            f"3. {question_count} questions about the passage in {self.language}\n"
            "4. The correct answer for each question\n"
            "5. Three incorrect but plausible options for each question\n"
            "6. A list of 5-8 key vocabulary words from the passage with their English translations\n"
            "Format the response as JSON with keys: passage, translation, questions, answers, options, vocabulary"
        )

        # User prompt
        user_prompt = f"Generate a reading comprehension exercise in {self.language}{topic_prompt}."

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

                    # Extract vocabulary as a dictionary
                    vocabulary = data.get("vocabulary", {})
                    if isinstance(vocabulary, list):
                        # Convert list to dictionary if necessary
                        vocab_dict = {}
                        for item in vocabulary:
                            if isinstance(item, dict) and "word" in item and "translation" in item:
                                vocab_dict[item["word"]] = item["translation"]
                            elif isinstance(item, str) and ":" in item:
                                word, trans = item.split(":", 1)
                                vocab_dict[word.strip()] = trans.strip()
                        vocabulary = vocab_dict

                    # Format options as a list of lists
                    options = data.get("options", [])
                    if options and not isinstance(options[0], list):
                        # If options is not a list of lists, reconstruct it
                        answers = data.get("answers", [])
                        formatted_options = []

                        for i, question_options in enumerate(options):
                            if i < len(answers):
                                # Include the correct answer in the options
                                all_options = question_options + [answers[i]]
                                # Shuffle options
                                random.shuffle(all_options)
                                formatted_options.append(all_options)

                        options = formatted_options

                    return {
                        "passage": data.get("passage", ""),
                        "translation": data.get("translation", ""),
                        "questions": data.get("questions", []),
                        "answers": data.get("answers", []),
                        "options": options,
                        "vocabulary": vocabulary
                    }
                except json.JSONDecodeError:
                    pass

            # Fallback: Parse response manually if JSON parsing failed
            # This is a simplified fallback - in a real implementation, you would want
            # more robust parsing logic

            passage = ""
            translation = ""
            questions = []
            answers = []
            options = []
            vocabulary = {}

            # Very basic parsing logic
            lines = response.split("\n")
            section = ""

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                if line.lower().startswith("passage:"):
                    section = "passage"
                    passage = line.split(":", 1)[1].strip()
                elif line.lower().startswith("translation:"):
                    section = "translation"
                    translation = line.split(":", 1)[1].strip()
                elif line.lower().startswith("question") and ":" in line:
                    section = "question"
                    questions.append(line.split(":", 1)[1].strip())
                elif line.lower().startswith("answer") and ":" in line:
                    section = "answer"
                    answers.append(line.split(":", 1)[1].strip())
                elif line.lower().startswith("vocabulary") or line.lower().startswith("key words"):
                    section = "vocabulary"
                elif section == "passage" and not line.lower().startswith("translation"):
                    passage += " " + line
                elif section == "translation" and not line.lower().startswith("question"):
                    translation += " " + line
                elif section == "vocabulary" and ":" in line:
                    parts = line.split(":", 1)
                    vocabulary[parts[0].strip()] = parts[1].strip()

            # Generate generic options if we have answers but no options
            if answers and not options:
                for answer in answers:
                    # Create some generic wrong options
                    question_options = [answer]  # Start with correct answer

                    # Add generic wrong answers based on language
                    if self.language in ["Spanish", "French", "Italian", "Portuguese"]:
                        wrong_options = ["Sí", "No", "Quizás", "No lo sé", "Verdadero", "Falso"]
                    elif self.language in ["German"]:
                        wrong_options = ["Ja", "Nein", "Vielleicht", "Ich weiß nicht", "Richtig", "Falsch"]
                    else:
                        wrong_options = ["Yes", "No", "Maybe", "I don't know", "True", "False"]

                    # Add wrong options (ensuring they're different from the answer)
                    for opt in wrong_options:
                        if opt != answer and len(question_options) < 4:
                            question_options.append(opt)

                    # Shuffle options
                    random.shuffle(question_options)
                    options.append(question_options)

            # Extract vocabulary words from the passage if none were provided
            if not vocabulary and passage:
                words = extract_words(passage, self.language)
                # Take a random sample of words
                sample_size = min(5, len(words))
                for word in random.sample(words, sample_size):
                    vocabulary[word] = "[Translation not available]"

            return {
                "passage": passage,
                "translation": translation,
                "questions": questions,
                "answers": answers,
                "options": options,
                "vocabulary": vocabulary
            }

        except Exception as e:
            # Return fallback content in case of error
            console.print(f"[red]Error generating reading comprehension: {str(e)}[/red]")
            return {
                "passage": f"[Error generating {self.language} passage]",
                "translation": "[Error generating translation]",
                "questions": ["[Error generating question]"],
                "answers": ["Error"],
                "options": [["Error", "Mistake", "Problem", "Bug"]],
                "vocabulary": {"error": "mistake"}
            }

    def present_challenge(self, content: Dict[str, Any]) -> None:
        """Present a reading comprehension challenge to the user.

        Args:
            content: Reading comprehension content to present
        """
        passage = content.get("passage", "")
        translation = content.get("translation", "")
        questions = content.get("questions", [])
        vocabulary = content.get("vocabulary", {})

        # Track vocabulary words
        if vocabulary:
            self.track_words(list(vocabulary.keys()))

        # Display the reading passage
        console.print(Panel(
            passage,
            title="【ＲＥＡＤＩＮＧ　ＰＡＳＳＡＧＥ】",
            expand=False,
            border_style=PANEL_BORDER_STYLE
        ))

        # Show translation if available (at lower difficulty levels)
        if translation and self.difficulty <= 2:
            console.print(Panel(
                f"[{SYNTHWAVE_THEME['secondary']}]{translation}[/{SYNTHWAVE_THEME['secondary']}]",
                title="【ＴＲＡＮＳＬＡＴＩＯＮ】",
                expand=False,
                border_style=PANEL_BORDER_STYLE
            ))

        # Display key vocabulary if available
        if vocabulary and self.difficulty <= 3:
            vocab_table = Table(title="【ＫＥＹ　ＶＯＣＡＢＵＬＡＲＹ】")
            vocab_table.add_column("Word", style=f"{SYNTHWAVE_THEME['primary']}")
            vocab_table.add_column("Translation", style=f"{SYNTHWAVE_THEME['secondary']}")

            for word, trans in vocabulary.items():
                vocab_table.add_row(word, trans)

            console.print(vocab_table)
            console.print("")

        # Reset question index
        self.current_question_index = 0

        # Display the first question
        if questions and self.current_question_index < len(questions):
            self._present_question(content)

    def _present_question(self, content: Dict[str, Any]) -> None:
        """Present a single question to the user.

        Args:
            content: Reading comprehension content
        """
        questions = content.get("questions", [])
        options = content.get("options", [])

        if not questions or self.current_question_index >= len(questions):
            return

        question = questions[self.current_question_index]

        # Display the question
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['primary']}]{question}[/bold {SYNTHWAVE_THEME['primary']}]",
            title=f"【ＱＵＥＳＴＩＯＮ {self.current_question_index + 1}】",
            border_style=PANEL_BORDER_STYLE
        ))

        # Display options if available
        if options and self.current_question_index < len(options):
            question_options = options[self.current_question_index]
            for i, option in enumerate(question_options, 1):
                console.print(f"  {i}. [{SYNTHWAVE_THEME['secondary']}]{option}[/{SYNTHWAVE_THEME['secondary']}]")

    def process_response(self, user_input: str, content: Dict[str, Any]) -> Tuple[bool, str]:
        """Process the user's response to a reading comprehension question.

        Args:
            user_input: User's input (option number or free text)
            content: Content for the current challenge

        Returns:
            Tuple of (is_correct, feedback)
        """
        questions = content.get("questions", [])
        answers = content.get("answers", [])
        options = content.get("options", [])
        translation = content.get("translation", "")

        # If we don't have any questions or we've handled all questions, return error
        if not questions or self.current_question_index >= len(questions):
            return False, "No more questions to answer."

        # Get the correct answer for the current question
        correct_answer = answers[self.current_question_index] if self.current_question_index < len(answers) else ""

        # Determine if the answer is correct
        is_correct = False

        if options and self.current_question_index < len(options):
            # Multiple choice question
            try:
                # Parse the option number
                option_index = int(user_input) - 1
                if 0 <= option_index < len(options[self.current_question_index]):
                    selected_option = options[self.current_question_index][option_index]
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
                    return False, f"Invalid option. Please choose 1-{len(options[self.current_question_index])}."
            except ValueError:
                # If they typed an answer instead of a number, check if it matches
                is_correct = user_input.lower() == correct_answer.lower()
        else:
            # Free text entry - just compare the answers
            # This is a simplified check - in a real implementation, you would want
            # more sophisticated answer checking
            if isinstance(correct_answer, str):
                is_correct = user_input.lower() == correct_answer.lower()
            else:
                try:
                    is_correct = user_input.lower() == str(correct_answer).lower()
                except:
                    is_correct = False

        # Update counters
        self.total_count += 1
        if is_correct:
            self.correct_count += 1

        # Prepare feedback
        if is_correct:
            feedback = f"Correct! The answer is '{correct_answer}'."
        else:
            feedback = f"Not quite. The correct answer is '{correct_answer}'."

        # Show translation if we didn't show it before and we're at the last question
        if translation and self.difficulty > 2 and self.current_question_index == len(questions) - 1:
            console.print(Panel(
                f"{translation}",
                title="Translation",
                expand=False
            ))

        # Move to next question if there are more
        self.current_question_index += 1

        # If there are more questions, show the next one
        if self.current_question_index < len(questions):
            self._present_question(content)

        return is_correct, feedback

    def _show_summary(self) -> None:
        """Show a summary of the reading comprehension activity results."""
        success_rate = (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0

        summary_text = Text()
        summary_text.append(f"\n★★★ ＡＣＴＩＶＩＴＹ ＣＯＭＰＬＥＴＥ! ★★★\n\n", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        summary_text.append(f"Points earned: {self.points_earned}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Questions: {self.total_count}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Correct answers: {self.correct_count}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Success rate: {success_rate:.1f}%\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"New words encountered: {len(self.words_encountered)}\n", style=f"{SYNTHWAVE_THEME['secondary']}")

        console.print(Panel(
            summary_text,
            title="【ＳＵＭＭＡＲＹ】",
            border_style=PANEL_BORDER_STYLE
        ))

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the reading comprehension activity.

        Returns:
            Dictionary with activity results
        """
        results = super().get_results()
        results.update({
            "total_questions": self.total_count,
            "correct_answers": self.correct_count,
            "success_rate": (self.correct_count / self.total_count) * 100 if self.total_count > 0 else 0,
        })
        return results
