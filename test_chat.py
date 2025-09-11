#!/usr/bin/env python3
"""
Test script for the Chat activity in Langue.

This script demonstrates the Chat conversation activity with the 80's themed UI.
It's a quick way to test the conversation functionality without running the full application.
"""

import sys
import time
import os
import signal
import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add the project root directory to Python path
project_root = Path(__file__).resolve().parent
sys.path.append(str(project_root))

from langue.activities.chat import ChatActivity
from langue.activities.base import SYNTHWAVE_THEME, console, PANEL_BORDER_STYLE
from rich.panel import Panel


def check_ollama_available():
    """Check if Ollama server is running."""
    try:
        result = subprocess.run(["curl", "-s", "http://localhost:11434/api/tags"],
                                capture_output=True, text=True, timeout=2,
                                stderr=subprocess.DEVNULL)
        if result.returncode == 0 and "models" in result.stdout:
            return True
        return False
    except Exception:
        return False


def create_mock_model():
    """Create a mock model for testing without Ollama."""
    mock_model = MagicMock()
    mock_model.get_response.return_value = "¡Hola! ¿Cómo estás? Soy tu asistente de conversación en español."

    # Make the chat responses cycle through a few different messages
    responses = [
        "Muy bien, gracias. ¿Y tú? ¿Qué te gusta hacer en tu tiempo libre?",
        "¡Qué interesante! Yo también disfruto aprender idiomas. ¿Cuánto tiempo llevas estudiando español?",
        "Entiendo. El español es un idioma muy bonito. ¿Hay algún tema específico que te gustaría practicar hoy?",
        "¡Claro! Podemos hablar de ese tema. ¿Qué te gustaría saber específicamente?",
        "Gracias por conversar conmigo hoy. Ha sido un placer practicar español contigo."
    ]

    mock_model.get_chat_response.side_effect = responses
    return mock_model


def handle_interrupt(signum, frame):
    """Handle keyboard interrupts gracefully."""
    console.print(f"\n[{SYNTHWAVE_THEME['accent']}]Test interrupted. Exiting gracefully...[/{SYNTHWAVE_THEME['accent']}]")
    sys.exit(0)

def simulate_input(inputs):
    """Run with simulated inputs (for testing)."""
    with patch('builtins.input', side_effect=inputs + ['exit']):
        run_chat_activity(is_simulation=True)

def run_chat_activity(is_simulation=False):
    """Run the chat activity with real or mock model."""
    console.print(Panel(
        "This script demonstrates the Chat conversation activity with the 80's themed UI.\n"
        "It will start a conversation in Spanish. Type 'exit' to end the conversation.",
        title="【ＬＡＮＧＵＥ　ＣＨＡＴ　ＴＥＳＴ】",
        border_style=PANEL_BORDER_STYLE
    ))
    console.print("\nInitializing Chat activity...\n")

    # Check if Ollama is available
    ollama_available = check_ollama_available()

    # Create a patched version of the _initialize_model method
    original_init_model = ChatActivity._initialize_model

    # Define our patch function
    def patched_init_model(self, model_name):
        if not ollama_available:
            return create_mock_model()
        return original_init_model(self, model_name)

    # Apply the patch
    ChatActivity._initialize_model = patched_init_model

    if not ollama_available:
        console.print(Panel(
            f"Ollama is not available. Using mock model for demonstration.\n"
            f"Note: For a real conversation, make sure Ollama is running with 'ollama serve'",
            title="【ＭＯＣＫ　ＭＯＤＥ】",
            border_style=PANEL_BORDER_STYLE
        ))

    # Create a chat activity
    activity = ChatActivity(
        language="Spanish",
        difficulty=2,  # Elementary level
        duration_minutes=5,  # 5 minute conversation
        correction_mode="gentle"  # Gentle correction mode
    )

    # Start the activity
    try:
        activity.start()
    except KeyboardInterrupt:
        console.print(f"\n[{SYNTHWAVE_THEME['accent']}]Test interrupted by user.[/{SYNTHWAVE_THEME['accent']}]")
        return
    except EOFError:
        console.print(f"\n[{SYNTHWAVE_THEME['accent']}]Input ended. Exiting...[/{SYNTHWAVE_THEME['accent']}]")
        return
    except Exception as e:
        console.print(f"\n[{SYNTHWAVE_THEME['primary']}]Error: {e}[/{SYNTHWAVE_THEME['primary']}]")
        console.print(f"[{SYNTHWAVE_THEME['accent']}]Try running with Ollama available or check console logs for details.[/{SYNTHWAVE_THEME['accent']}]")
        return
    finally:
        # Restore the original method
        ChatActivity._initialize_model = original_init_model

    if not is_simulation:
        console.print(Panel(
            f"★★★ ＴＥＳＴ ＣＯＭＰＬＥＴＥ! ★★★\n\n"
            f"Words encountered: {len(activity.words_encountered)}\n"
            f"Points earned: {activity.points_earned}",
            title="【ＲＥＳＵＬＴＳ】",
            border_style=PANEL_BORDER_STYLE
        ))

def main():
    """Main entry point with argument handling."""
    # Set up signal handler for graceful interruption
    signal.signal(signal.SIGINT, handle_interrupt)

    # Check for simulation mode
    if len(sys.argv) > 1 and sys.argv[1] == "--simulate":
        # Simulated inputs for automated testing
        simulate_input([
            "Hola, ¿cómo estás?",
            "Me gusta aprender español",
            "Leo libros y veo películas en español para practicar"
        ])
    else:
        # Interactive mode
        run_chat_activity()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        console.print(f"\n[{SYNTHWAVE_THEME['primary']}]Unhandled error: {e}[/{SYNTHWAVE_THEME['primary']}]")
        sys.exit(1)
