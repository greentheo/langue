"""
Chat conversation activity for Langue.

This module provides the ChatActivity class which implements a conversational
practice activity for language learning.
"""

import time
import re
from typing import Dict, List, Optional, Tuple, Any, Union
from datetime import datetime, timedelta

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.markdown import Markdown
from rich.prompt import Prompt

from langue.activities.base import Activity
from langue.models.base import ModelInterface, ModelError
from langue.models.ollama import OllamaModelInterface
from langue.models.claude import ClaudeModelInterface
from langue.utils.helpers import extract_words, parse_language_level

# Import console with 80's theme from base activity
from langue.activities.base import console, SYNTHWAVE_THEME, PANEL_BORDER_STYLE


class ChatActivity(Activity):
    """Conversational practice language learning activity."""

    def __init__(self, language: str, difficulty: int = 1, model_name: Optional[str] = None,
                 topic: Optional[str] = None, duration_minutes: int = 10,
                 character: Optional[str] = None, correction_mode: str = "gentle",
                 level: Optional[str] = None, user_id: Optional[str] = "default_user"):
        """Initialize the chat conversation activity.

        Args:
            language: Language to practice
            difficulty: Difficulty level (1-5)
            model_name: Optional model to use for generating content
            topic: Optional topic for the conversation
            duration_minutes: Duration of the conversation in minutes
            character: Optional character for the AI to roleplay
            correction_mode: How to correct errors ("none", "gentle", "immediate", "detailed")
        """
        super().__init__(language, difficulty, model_name)
        self.topic = topic
        self.duration_minutes = duration_minutes
        self.character = character
        self.correction_mode = correction_mode
        self.level = level or self._get_level_from_difficulty(difficulty)
        self.user_id = user_id
        self.messages = []
        self.start_time = None
        self.end_time = None
        self.words_seen = set()
        self.vocabulary_used = set()
        self.corrections_made = []

        # Initialize model interface based on model_name
        self.model = self._initialize_model(model_name)

        # Track turns
        self.turns_count = 0
        self.max_turns = 20  # Fallback limit in case duration isn't reached

        # Beginner-support state.
        self.native_language = "English"
        # Show English translations automatically at beginner levels (A1/A2).
        self.show_translations = self.level in ("a1", "a2")
        self.last_ai_message = ""      # most recent instructor line (for /t)
        self._translation_cache = {}   # avoid re-translating the same line

    @property
    def name(self) -> str:
        """Get the name of the activity.

        Returns:
            String name of the activity
        """
        return "Conversation Practice"

    @property
    def description(self) -> str:
        """Get the description of the activity.

        Returns:
            String description of the activity
        """
        return "Practice conversation with an AI language partner"

    def get_instructions(self) -> str:
        """Get instructions for the chat activity.

        Returns:
            String with instructions for the user
        """
        language_levels = {
            1: "beginner (A1)",
            2: "elementary (A2)",
            3: "intermediate (B1)",
            4: "upper intermediate (B2)",
            5: "advanced (C1-C2)"
        }

        level = language_levels.get(self.difficulty, "intermediate")

        return (
            f"Have a conversation in {self.language} with your AI language partner. "
            f"The conversation will be at a {level} level."
            f"{' The topic is: ' + self.topic if self.topic else ''} "
            f"The session will last approximately {self.duration_minutes} minutes. "
            "Type 'quit' or 'exit' at any time to end the conversation early."
        )

    def _initialize_model(self, model_name: Optional[str]) -> ModelInterface:
        """Initialize the appropriate model interface.

        Args:
            model_name: Name of the model to use

        Returns:
            Initialized model interface
        """
        try:
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
        except ModelError:
            # Surface the real failure to the launch boundary — do not fake a model.
            raise
        except Exception as e:
            raise ModelError(
                f"Could not initialize the conversation model: {e}",
                kind="unknown",
            ) from e

    # ------------------------------------------------------------------
    # Beginner-support helpers (translation, hints, in-chat commands)
    # ------------------------------------------------------------------

    def _is_beginner(self) -> bool:
        """True for A1/A2 learners, who get simpler instructor language + aids."""
        return self.level in ("a1", "a2")

    def _translate_to_native(self, text: str) -> str:
        """Translate an instructor line into the learner's native language."""
        text = (text or "").strip()
        if not text:
            return ""
        if text in self._translation_cache:
            return self._translation_cache[text]
        try:
            result = self.model.get_response(
                prompt=(
                    f"Translate this {self.language} text into {self.native_language}. "
                    f"Return ONLY the translation, with no quotes or notes:\n\n{text}"
                ),
                temperature=0.0,
            ).strip()
        except ModelError as e:
            result = f"[translation unavailable: {e}]"
        self._translation_cache[text] = result
        return result

    def _show_translation(self, text: str) -> None:
        """Print the native-language translation of a line, dimmed and indented."""
        translation = self._translate_to_native(text)
        if translation:
            console.print(
                f"[dim {SYNTHWAVE_THEME['secondary']}]  ↳ {translation}"
                f"[/dim {SYNTHWAVE_THEME['secondary']}]"
            )

    def _suggest_replies(self) -> None:
        """Show 2-3 example replies (target language + translation) the learner could give."""
        if not self.last_ai_message:
            console.print(f"[dim]Nothing to respond to yet.[/dim]")
            return
        try:
            raw = self.model.get_response(
                prompt=(
                    f"A learner is practicing {self.language} at {self.level.upper()} level. "
                    f"The assistant just said: \"{self.last_ai_message}\". "
                    f"Suggest 2-3 short, natural replies the learner could give, in {self.language}. "
                    f"Put each on its own line formatted exactly as: "
                    f"<reply in {self.language}> = <{self.native_language} translation>. "
                    "No numbering and no extra commentary."
                ),
                temperature=0.5,
            )
        except ModelError as e:
            console.print(Panel(str(e), title="【ＨＩＮＴ】", border_style=PANEL_BORDER_STYLE))
            return
        body = Text()
        body.append("You could try saying:\n", style="bold")
        shown = 0
        for line in raw.splitlines():
            if "=" not in line:
                continue
            target, _, native = line.strip().lstrip("-•* ").partition("=")
            target, native = target.strip(), native.strip()
            if not target:
                continue
            body.append(f"  • {target}", style="cyan")
            body.append(f"  ({native})\n", style="dim")
            shown += 1
            if shown >= 3:
                break
        console.print(Panel(body, title="【ＨＩＮＴＳ】", expand=False, border_style=PANEL_BORDER_STYLE))

    def _explain_word(self, word: str) -> None:
        """Explain a word or phrase to the learner in their native language."""
        word = word.strip()
        if not word:
            console.print("[dim]Usage: /word <a word or phrase>[/dim]")
            return
        try:
            explanation = self.model.get_response(
                prompt=(
                    f"Briefly explain the {self.language} word or phrase \"{word}\" to a "
                    f"{self.level.upper()}-level learner, in {self.native_language}: its meaning "
                    "and one short example. Keep it to 2-3 short sentences."
                ),
                temperature=0.3,
            ).strip()
        except ModelError as e:
            explanation = str(e)
        console.print(Panel(explanation, title=f"【 {word} 】", expand=False, border_style=PANEL_BORDER_STYLE))

    def _show_chat_help(self) -> None:
        """List the in-conversation commands."""
        help_text = Text()
        help_text.append("Conversation commands:\n", style="bold")
        commands = [
            ("/t", f"translate the assistant's last message to {self.native_language}"),
            ("/hint", "suggest replies you could give"),
            ("/word <x>", "explain a word or phrase"),
            ("/bilingual", "toggle automatic translations on/off"),
            ("/help", "show this help"),
            ("quit", "end the conversation"),
        ]
        for cmd, desc in commands:
            help_text.append(f"  {cmd}", style="cyan")
            help_text.append(f" — {desc}\n")
        console.print(Panel(help_text, title="【ＨＥＬＰ】", expand=False, border_style=PANEL_BORDER_STYLE))

    def _handle_command(self, text: str) -> bool:
        """Handle a slash command. Returns True if the input was a command (not a turn)."""
        stripped = text.strip()
        low = stripped.lower()
        if low in ("/t", "/en", "/translate"):
            self._show_translation(self.last_ai_message)
        elif low in ("/hint", "/h", "/suggest"):
            self._suggest_replies()
        elif low in ("/bilingual", "/b"):
            self.show_translations = not self.show_translations
            state = "on" if self.show_translations else "off"
            console.print(f"[{SYNTHWAVE_THEME['accent']}]Automatic translations: {state}[/{SYNTHWAVE_THEME['accent']}]")
        elif low.startswith("/word") or low.startswith("/w "):
            self._explain_word(stripped.split(" ", 1)[1] if " " in stripped else "")
        elif low in ("/help", "/?"):
            self._show_chat_help()
        else:
            return False
        return True

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
        """Generate the initial context for the conversation.

        Returns:
            Dictionary containing the initial context including:
            - greeting: Initial greeting from the AI
            - context: Background information for the conversation
            - suggested_vocabulary: Vocabulary that might be useful
        """
        # Map difficulty levels to CEFR levels
        cefr_levels = {
            1: "A1",
            2: "A2",
            3: "B1",
            4: "B2",
            5: "C1"
        }
        # Honor the learner's actual CEFR level (A1-C2). This previously derived
        # the level from difficulty and capped it at C1, ignoring self.level.
        cefr_level = self.level.upper()

        # Character specification
        character_prompt = ""
        if self.character:
            character_prompt = f"You are roleplaying as {self.character}. Maintain this character throughout the conversation."

        # Topic specification
        topic_prompt = f" about {self.topic}" if self.topic else ""

        system_prompt = (
            f"You are a friendly language teacher helping someone practice {self.language}. "
            f"Your responses should be in {self.language} at a {cefr_level} level (CEFR standard). "
            f"{character_prompt} "
            f"The conversation will be{topic_prompt}. "
            "\n\nFollow these guidelines:"
            f"\n1. Respond only in {self.language} (except for corrections)."
            f"\n2. Keep responses at a {cefr_level} level, using appropriate vocabulary and grammar."
            f"\n3. Be conversational, friendly, and engaging."
            "\n4. Ask questions to keep the conversation going."
            "\n5. If the user makes mistakes, provide corrections based on the correction mode."
            "\n\nFor your first message, introduce yourself briefly and ask an open-ended question to start the conversation."
        )

        # At beginner levels, force genuinely simple, comprehensible instructor
        # language so an A1/A2 learner can actually follow along.
        if self._is_beginner():
            system_prompt += (
                f"\n\nIMPORTANT — the learner is a BEGINNER ({cefr_level}). "
                "Use very short sentences (about 5-8 words). Use only the most common, "
                "basic words. Say ONE thing at a time. Prefer simple yes/no or either/or "
                "questions over open-ended ones. Speak slowly and clearly, as if talking "
                "to someone who knows very little of the language."
            )

        # Set correction instructions based on mode
        if self.correction_mode == "gentle":
            system_prompt += "\n\nCorrection mode: gentle - Wait for 2-3 mistakes before correcting. Put corrections in [brackets] at the end of your message."
        elif self.correction_mode == "immediate":
            system_prompt += "\n\nCorrection mode: immediate - Correct each mistake right after the user's message. Put corrections in [brackets]."
        elif self.correction_mode == "detailed":
            system_prompt += "\n\nCorrection mode: detailed - Provide detailed grammar explanations for mistakes. Put corrections and explanations in [brackets] using English."
        else:  # "none"
            system_prompt += "\n\nCorrection mode: none - Do not correct mistakes unless the user specifically asks for help."

        user_prompt = f"Let's have a conversation in {self.language}{topic_prompt}."

        try:
            # Get initial greeting from model
            response = self.model.get_response(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7
            )

            # Add greeting to conversation history
            self.messages.append({
                "role": "system",
                "content": system_prompt
            })

            self.messages.append({
                "role": "user",
                "content": user_prompt
            })

            self.messages.append({
                "role": "assistant",
                "content": response
            })

            # Generate suggested vocabulary based on the topic
            vocab_prompt = (
                f"Generate a list of 5-8 useful {self.language} vocabulary words or phrases "
                f"at a {cefr_level} level that might be helpful for a conversation{topic_prompt}. "
                "For each word or phrase, include the English translation. "
                "Format as a JSON object with the word as key and translation as value."
            )

            # Only generate vocabulary if the main greeting succeeded
            # This avoids making two API calls when there might be an error
            try:
                vocab_response = self.model.get_response(
                    prompt=vocab_prompt,
                    temperature=0.3
                )

                # Try to extract vocabulary
                vocabulary = {}
                import json
                import re

                # Try to find JSON in the response
                json_match = re.search(r'```json\s*([\s\S]*?)\s*```|{[\s\S]*}', vocab_response)
                if json_match:
                    json_str = json_match.group(1) if json_match.group(1) else json_match.group(0)
                    try:
                        vocabulary = json.loads(json_str)
                    except json.JSONDecodeError:
                        # If JSON parsing fails, try simple extraction
                        for line in vocab_response.split('\n'):
                            if ':' in line:
                                key, value = line.split(':', 1)
                                vocabulary[key.strip()] = value.strip()
            except Exception:
                # Fallback for vocabulary
                vocabulary = {}

            # Extract words from the greeting to track vocabulary
            greeting_words = extract_words(response, self.language)
            for word in greeting_words:
                self.vocabulary_used.add(word)
                self.track_words([word])

            return {
                "greeting": response,
                "context": system_prompt,
                "suggested_vocabulary": vocabulary
            }

        except Exception as e:
            # Return fallback content in case of error
            error_message = str(e)

            # Create and display error panel
            if "404 Client Error: Not Found" in error_message and "ollama" in error_message.lower():
                # Specific message for Ollama not running
                console.print(Panel(
                    f"Error: Ollama server is not running\n\n"
                    "Using fallback conversation mode. This will work but responses won't be personalized.\n"
                    "To use the full AI conversation features, make sure Ollama is running with 'ollama serve'",
                    title="【ＯＬＬＡＭＡ　ＥＲＲＯＲ】",
                    border_style=PANEL_BORDER_STYLE
                ))
            else:
                # Generic error message
                console.print(Panel(
                    f"Error starting conversation: {error_message}\n\n"
                    "Using fallback conversation mode. This will work but responses won't be personalized.",
                    title="【ＥＲＲＯＲ】",
                    border_style=PANEL_BORDER_STYLE
                ))

            fallback_greeting = f"¡Hola! Soy tu compañero de conversación en {self.language}. ¿Cómo estás hoy?"
            if self.language == "French":
                fallback_greeting = f"Bonjour! Je suis votre partenaire de conversation en français. Comment allez-vous aujourd'hui?"
            elif self.language == "German":
                fallback_greeting = f"Hallo! Ich bin dein Gesprächspartner auf Deutsch. Wie geht es dir heute?"

            return {
                "greeting": fallback_greeting,
                "context": "Error starting conversation",
                "suggested_vocabulary": {}
            }

    def present_challenge(self, content: Dict[str, Any]) -> None:
        """Present the chat conversation interface to the user.

        Args:
            content: Initial conversation content
        """
        greeting = content.get("greeting", "")
        vocabulary = content.get("suggested_vocabulary", {})

        # Record start time
        self.start_time = datetime.now()

        # Display welcome message
        console.print(Panel(
            Text(f"【ＣＯＮＶＥＲＳＡＴＩＯＮ　ＰＲＡＣＴＩＣＥ】", style=f"bold {SYNTHWAVE_THEME['primary']}"),
            subtitle=f"Language: {self.language} | Level: {self.difficulty}/5",
            border_style=PANEL_BORDER_STYLE
        ))

        # Display instructions
        console.print(self.get_instructions())
        console.print(f"[dim {SYNTHWAVE_THEME['secondary']}]Session will end at approximately: {(self.start_time.replace(microsecond=0) + timedelta(minutes=self.duration_minutes)).time()}[/dim {SYNTHWAVE_THEME['secondary']}]")

        # Display suggested vocabulary if available
        if vocabulary:
            vocab_text = Text()
            vocab_text.append("Suggested Vocabulary:\n", style="bold")

            for word, translation in vocabulary.items():
                vocab_text.append(f"{word}", style="cyan")
                vocab_text.append(f": {translation}\n")

            console.print(Panel(vocab_text, title="【ＶＯＣＡＢＵＬＡＲＹ】", expand=False, border_style=PANEL_BORDER_STYLE))

        # Display AI's greeting (plus a translation for beginners).
        console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【ＡＳＳＩＳＴＡＮＴ】[/bold {SYNTHWAVE_THEME['secondary']}] {greeting}")
        self.last_ai_message = greeting
        if self.show_translations:
            self._show_translation(greeting)

        # Tell the learner about the in-conversation helpers.
        console.print(
            f"[dim {SYNTHWAVE_THEME['accent']}]Tip: /t translate · /hint reply ideas · "
            f"/word <x> explain · /bilingual toggle · /help[/dim {SYNTHWAVE_THEME['accent']}]"
        )

        # Track turns
        self.turns_count = 1

    def process_response(self, user_input: str, content: Dict[str, Any]) -> Tuple[bool, str]:
        """Process the user's message in the conversation.

        Args:
            user_input: User's message
            content: Conversation content

        Returns:
            Tuple of (is_continuing, ai_response)
        """
        # Check for exit command
        if user_input.lower() in ["quit", "exit", "end", "stop"]:
            self.end_time = datetime.now()
            # Award points for participation
            self.points_earned += 1
            return False, "Ending conversation."

        # Check if we've reached the time limit
        current_time = datetime.now()
        elapsed_minutes = (current_time - self.start_time).total_seconds() / 60

        if elapsed_minutes >= self.duration_minutes or self.turns_count >= self.max_turns:
            self.end_time = current_time
            return False, "Time's up! Ending conversation."

        # Extract words from user input to track vocabulary
        user_words = extract_words(user_input, self.language)
        for word in user_words:
            self.vocabulary_used.add(word)
            self.track_words([word])

        # Add user message to conversation history
        self.messages.append({
            "role": "user",
            "content": user_input
        })

        # Get AI response
        try:
            response = self.model.get_chat_response(
                messages=self.messages,
                temperature=0.7
            )

            # Add AI response to conversation history
            self.messages.append({
                "role": "assistant",
                "content": response
            })

            # Extract words from AI response to track vocabulary
            ai_words = extract_words(response, self.language)
            for word in ai_words:
                self.vocabulary_used.add(word)
                self.track_words([word])

            # Extract corrections if present
            corrections = re.findall(r'\[(.*?)\]', response)
            if corrections:
                self.corrections_made.extend(corrections)

            # Update turn count and award points
            self.turns_count += 1
            self.points_earned += max(1, len(user_words))  # Award at least 1 point per turn

            return True, response

        except ModelError as e:
            # Honest failure — show the specific problem and end the session
            # rather than pretending to reply.
            hint = f"\n\n{e.hint}" if e.hint else ""
            console.print(Panel(
                f"{e}{hint}",
                title="【ＭＯＤＥＬ　ＥＲＲＯＲ】",
                border_style=PANEL_BORDER_STYLE
            ))
            return False, ""
        except Exception as e:
            console.print(Panel(
                f"Error getting response: {e}",
                title="【ＥＲＲＯＲ】",
                border_style=PANEL_BORDER_STYLE
            ))
            return False, ""

    def start(self) -> None:
        """Start the chat activity.

        Overrides the base class method to provide a continuous conversation flow.
        """
        try:
            # Generate initial content
            content = self.generate_content()

            # Present the conversation interface
            self.present_challenge(content)

            # Conversation loop
            continuing = True
            while continuing:
                try:
                    # Get user input
                    user_input = console.input(f"\n[bold {SYNTHWAVE_THEME['highlight']}]【ＹＯＵ】[/bold {SYNTHWAVE_THEME['highlight']}] ")

                    # In-conversation commands (/t, /hint, /word, ...) are helpers,
                    # not a conversational turn — handle and re-prompt.
                    if self._handle_command(user_input):
                        continue

                    # Process input and get AI response
                    continuing, ai_response = self.process_response(user_input, content)

                    if continuing:
                        # Display AI response (plus a translation for beginners)
                        console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【ＡＳＳＩＳＴＡＮＴ】[/bold {SYNTHWAVE_THEME['secondary']}] {ai_response}")
                        self.last_ai_message = ai_response
                        if self.show_translations:
                            self._show_translation(ai_response)

                        # Award points for each turn
                        self.points_earned += 2
                    elif ai_response:
                        # End of conversation with a closing message (empty means an
                        # error panel was already shown — don't print a blank line).
                        console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【ＡＳＳＩＳＴＡＮＴ】[/bold {SYNTHWAVE_THEME['secondary']}] {ai_response}")
                except EOFError:
                    # Handle Ctrl+D gracefully
                    console.print(f"\n[{SYNTHWAVE_THEME['accent']}]Conversation ended by user.[/{SYNTHWAVE_THEME['accent']}]")
                    continuing = False
                except KeyboardInterrupt:
                    # Handle Ctrl+C gracefully
                    console.print(f"\n[{SYNTHWAVE_THEME['accent']}]Conversation interrupted by user.[/{SYNTHWAVE_THEME['accent']}]")
                    continuing = False
                except Exception as e:
                    console.print(f"\n[{SYNTHWAVE_THEME['primary']}]Error during conversation: {str(e)}[/{SYNTHWAVE_THEME['primary']}]")
                    console.print(f"[{SYNTHWAVE_THEME['accent']}]Continuing conversation...[/{SYNTHWAVE_THEME['accent']}]")

            # Show summary
            self._show_summary()
        except Exception as e:
            error_message = str(e)
            if "404 Client Error: Not Found" in error_message and "ollama" in error_message.lower():
                console.print(Panel(
                    "Error: Ollama server is not running\n\n"
                    "To use the full AI conversation features, please start Ollama with:\n"
                    "  ollama serve\n\n"
                    "Then try running this activity again.",
                    title="【ＯＬＬＡＭＡ　ＮＯＴ　ＦＯＵＮＤ】",
                    border_style=PANEL_BORDER_STYLE
                ))
            else:
                console.print(Panel(
                    f"Error in conversation activity: {error_message}\n\n"
                    "Try running again or check if your AI model is available.",
                    title="【ＦＡＴＡＬ ＥＲＲＯＲ】",
                    border_style=PANEL_BORDER_STYLE
                ))

    def _show_summary(self) -> None:
        """Show a summary of the chat activity results."""
        # Calculate duration
        if self.start_time and self.end_time:
            duration_seconds = (self.end_time - self.start_time).total_seconds()
            duration_str = f"{int(duration_seconds // 60)} minutes, {int(duration_seconds % 60)} seconds"
        else:
            duration_str = "Unknown"

        summary_text = Text()
        summary_text.append("\n★★★ ＣＯＮＶＥＲＳＡＴＩＯＮ ＣＯＭＰＬＥＴＥ! ★★★\n\n", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        summary_text.append(f"Duration: {duration_str}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Turns: {self.turns_count}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Points earned: {self.points_earned}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"Unique words used: {len(self.vocabulary_used)}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"New words learned: {len(self.words_encountered)}\n", style=f"{SYNTHWAVE_THEME['secondary']}")

        if self.corrections_made:
            summary_text.append("\nCorrections made:\n", style=f"{SYNTHWAVE_THEME['accent']}")
            for i, correction in enumerate(self.corrections_made[:5], 1):
                summary_text.append(f"{i}. {correction}\n", style=f"{SYNTHWAVE_THEME['accent']}")

            if len(self.corrections_made) > 5:
                summary_text.append(f"...and {len(self.corrections_made) - 5} more.\n", style=f"{SYNTHWAVE_THEME['accent']}")

        console.print(Panel(
            summary_text,
            title="【ＣＯＮＶＥＲＳＡＴＩＯＮ ＳＵＭＭＡＲＹ】",
            border_style=PANEL_BORDER_STYLE
        ))

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the chat activity.

        Returns:
            Dictionary with activity results
        """
        results = super().get_results()

        # Add chat-specific results
        if self.start_time and self.end_time:
            duration_seconds = int((self.end_time - self.start_time).total_seconds())
        else:
            duration_seconds = 0

        results.update({
            "turns": self.turns_count,
            "duration_seconds": duration_seconds,
            "vocabulary_used": len(self.vocabulary_used),
            "corrections_count": len(self.corrections_made),
        })

        return results
