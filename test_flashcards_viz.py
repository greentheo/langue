#!/usr/bin/env python3
"""
Test script for visualizing flashcard data and progress.

This script demonstrates the flashcard visualization capabilities
that have been added to the FlashcardActivity class.
"""

import os
import sys
import time
import random
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from langue.activities.flashcards import FlashcardActivity
from langue.models.base import ModelInterface
from langue.storage.database import initialize_database
from rich.console import Console

console = Console()


class MockModel(ModelInterface):
    """Mock model for testing flashcards."""

    def __init__(self):
        """Initialize the mock model."""
        self.flashcard_data = [
            {
                "word": "bonjour",
                "translation": "hello",
                "example": "Bonjour, comment allez-vous?",
                "example_translation": "Hello, how are you?",
                "notes": "Common greeting used throughout the day."
            },
            {
                "word": "merci",
                "translation": "thank you",
                "example": "Merci beaucoup pour votre aide.",
                "example_translation": "Thank you very much for your help.",
                "notes": "Used to express gratitude."
            },
            {
                "word": "au revoir",
                "translation": "goodbye",
                "example": "Au revoir, à demain!",
                "example_translation": "Goodbye, see you tomorrow!",
                "notes": "Formal way to say goodbye."
            },
            {
                "word": "s'il vous plaît",
                "translation": "please",
                "example": "Un café, s'il vous plaît.",
                "example_translation": "A coffee, please.",
                "notes": "Formal way to say please."
            },
            {
                "word": "excusez-moi",
                "translation": "excuse me",
                "example": "Excusez-moi, où est la gare?",
                "example_translation": "Excuse me, where is the train station?",
                "notes": "Used to get attention or apologize."
            }
        ]

        self.evaluation_responses = [
            {
                "is_correct": True,
                "feedback": "Perfect! Your answer is correct.",
                "score": 10
            },
            {
                "is_correct": True,
                "feedback": "Very good! Your answer is essentially correct.",
                "score": 8
            },
            {
                "is_correct": False,
                "feedback": "Not quite. Your answer is close but not correct.",
                "score": 5
            },
            {
                "is_correct": False,
                "feedback": "Incorrect. Try again and pay attention to the exact meaning.",
                "score": 3
            }
        ]

        self.current_flashcard = 0
        self.current_evaluation = 0

    def get_response(self, prompt, system_prompt=None, temperature=0.7):
        """Return a predefined response."""
        import json

        if "Generate a flashcard" in prompt:
            # Return flashcard data
            data = self.flashcard_data[self.current_flashcard]
            self.current_flashcard = (self.current_flashcard + 1) % len(self.flashcard_data)
            return json.dumps(data)

        elif "Evaluate this flashcard response" in prompt:
            # Return evaluation data
            response = self.evaluation_responses[self.current_evaluation]
            self.current_evaluation = (self.current_evaluation + 1) % len(self.evaluation_responses)
            return json.dumps(response)

        else:
            # Default response
            return json.dumps({"result": "unknown prompt"})


def simulate_user_input(prompt, answer):
    """Simulate user input by printing the prompt and returning the answer."""
    console.print(f"[cyan]{prompt}[/cyan]")
    time.sleep(0.5)
    console.print(f"[yellow]> {answer}[/yellow]")
    time.sleep(0.5)
    return answer


def run_test():
    """Run a test of the flashcard activity with visualization."""
    # Ensure database exists
    initialize_database()

    # Create a test user ID
    test_user_id = "test_user_" + str(random.randint(1000, 9999))

    # Create mock model
    mock_model = MockModel()

    # Create flashcard activity
    activity = FlashcardActivity(
        language="French",
        difficulty=2,
        user_id=test_user_id
    )

    # Set the mock model
    activity.model = mock_model

    # Override console.input to simulate user responses
    original_input = Console.input

    try:
        # Patch console.input to simulate user input
        Console.input = simulate_user_input

        # Now run multiple flashcard sessions to build up some history

        # Session 1 - First exposure to words
        console.print("\n[bold green]===== SESSION 1: FIRST EXPOSURE =====\n")
        run_session(activity, ["hello", "thanks", "goodbye", "please", "excuse me"])

        # Session 2 - Second exposure, better performance
        console.print("\n[bold green]===== SESSION 2: IMPROVING =====\n")
        run_session(activity, ["hello", "thank you", "goodbye", "please", "excuse me"])

        # Session 3 - Third exposure, mixed performance
        console.print("\n[bold green]===== SESSION 3: MIXED RESULTS =====\n")
        run_session(activity, ["hi", "thanks", "bye", "please", "pardon me"])

        # Final session with full visualization
        console.print("\n[bold green]===== FINAL SESSION WITH VISUALIZATION =====\n")
        # Reset the mock model's counters
        mock_model.current_flashcard = 0
        mock_model.current_evaluation = 0

        # Generate 5 cards and simulate answers
        answers = ["hello", "thank you", "goodbye", "please", "sorry"]
        for i in range(5):
            # Generate content
            content = activity.generate_content()

            # Present challenge (this will show the word)
            console.print(f"\n[bold]FLASHCARD {i+1}/5:[/bold] {content['word']}")

            # Simulate user answer
            content["user_answer"] = answers[i]

            # Show full flashcard
            activity._display_full_flashcard(content)

            # Process response
            activity.process_response("", content)

        # Show summary with visualizations
        activity._show_summary()

    finally:
        # Restore original input function
        Console.input = original_input


def run_session(activity, answers):
    """Run a session with the given answers."""
    for i, answer in enumerate(answers):
        # Generate content
        content = activity.generate_content()

        # Present challenge (simplified)
        console.print(f"\n[bold]Word {i+1}/{len(answers)}:[/bold] {content['word']}")

        # Simulate user answer
        content["user_answer"] = answer

        # Process response (simplified)
        activity.process_response("", content)

        # Show brief result
        console.print(f"Processed: {content['word']} -> {answer}")

    console.print(f"\nSession complete: {len(answers)} flashcards processed")


if __name__ == "__main__":
    console.print("[bold magenta]===== FLASHCARD VISUALIZATION TEST =====\n")
    run_test()
