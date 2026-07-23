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
from langue.models.base import ModelInterface
from langue.models.ollama import OllamaModelInterface
from langue.models.claude import ClaudeModelInterface
from langue.utils.helpers import extract_words, parse_language_level

# Add MockModelInterface for fallback when real models fail
class MockModelInterface(ModelInterface):
    """A mock model interface that returns predefined responses.

    This is used as a fallback when the real model initialization fails.
    """

    def __init__(self, model_name: str = "mock"):
        """Initialize mock model."""
        self.model_name = model_name

    def get_response(self, prompt: str, system_prompt: str = None, temperature: float = 0.7) -> str:
        """Return a predefined response."""
        # Return a simple greeting based on prompt context
        if "spanish" in prompt.lower() or "español" in prompt.lower():
            return "¡Hola! Soy un asistente de conversación básico."
        elif "french" in prompt.lower() or "français" in prompt.lower():
            return "Bonjour! Je suis un assistant de conversation basique."
        elif "german" in prompt.lower() or "deutsch" in prompt.lower():
            return "Hallo! Ich bin ein einfacher Konversationsassistent."
        else:
            return "Hello! I am a basic conversation assistant."

    def get_chat_response(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
        """Return a predefined chat response."""
        # Return a simple response
        return "Lo siento, estoy funcionando en modo limitado."

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
                model_id = model_name.split(":", 1)[1] if ":" in model_name else "claude-3-haiku-20240307"
                return ClaudeModelInterface(model_name=model_id)
            else:
                # Fallback to Ollama
                return OllamaModelInterface()
        except Exception as e:
            # Log the error
            error_panel = Panel(
                f"Error initializing model: {str(e)}\n\n"
                "Using fallback conversation mode. This will work but responses won't be personalized.",
                title="【﻿ＥＲＲＯＲ】",
                border_style=PANEL_BORDER_STYLE,
                padding=(1, 2)
            )
            console.print(error_panel)
            # Return a fallback model that doesn't make real API calls
            return MockModelInterface()

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
        cefr_level = cefr_levels.get(self.difficulty, "B1")

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

        # Display AI's greeting
        console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【ＡＳＳＩＳＴＡＮＴ】[/bold {SYNTHWAVE_THEME['secondary']}] {greeting}")

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

        except Exception as e:
            error_message = str(e)

            # Create and display error panel
            if "404 Client Error: Not Found" in error_message and "ollama" in error_message.lower():
                # Specific message for Ollama not running
                console.print(Panel(
                    f"Error: Ollama server is not responding\n\n"
                    "This could be because Ollama is not running or experiencing issues.",
                    title="【ＯＬＬＡＭＡ　ＥＲＲＯＲ】",
                    border_style=PANEL_BORDER_STYLE
                ))
            else:
                # Generic error message
                console.print(Panel(
                    f"Error getting response: {error_message}",
                    title="【ＥＲＲＯＲ】",
                    border_style=PANEL_BORDER_STYLE
                ))

            # Fallback responses in different languages
            fallback_response = "Lo siento, tuve un problema al responder. ¿Puedes intentar decir algo más?"
            if self.language == "French":
                fallback_response = "Désolé, j'ai eu un problème à répondre. Pouvez-vous essayer de dire autre chose?"
            elif self.language == "German":
                fallback_response = "Es tut mir leid, ich hatte ein Problem beim Antworten. Könntest du versuchen, etwas anderes zu sagen?"

            return True, fallback_response

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

                    # Process input and get AI response
                    continuing, ai_response = self.process_response(user_input, content)

                    if continuing:
                        # Display AI response
                        console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【ＡＳＳＩＳＴＡＮＴ】[/bold {SYNTHWAVE_THEME['secondary']}] {ai_response}")

                        # Award points for each turn
                        self.points_earned += 2
                    else:
                        # End of conversation
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
