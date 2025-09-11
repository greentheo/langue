"""
Base activity class for Langue.

This module provides the abstract base class for all learning activities in Langue.
"""

import abc
from typing import Dict, List, Optional, Tuple, Any

from rich.console import Console
from rich.panel import Panel
from rich.text import Text

# Define an 80's style theme
SYNTHWAVE_THEME = {
    "primary": "#ff00ff",    # Hot pink
    "secondary": "#00ffff",  # Cyan
    "accent": "#ffff00",     # Yellow
    "highlight": "#00ff00",  # Neon green
    "background": "#000033", # Dark blue
    "border": "#ff00ff",     # Hot pink
}

# Initialize console for rich output with 80's styling
from rich.theme import Theme
console = Console(theme=Theme({
    "info": f"bold {SYNTHWAVE_THEME['secondary']}",
    "warning": f"bold {SYNTHWAVE_THEME['accent']}",
    "danger": f"bold {SYNTHWAVE_THEME['primary']}",
    "success": f"bold {SYNTHWAVE_THEME['highlight']}",
}))

# Configure panel borders for 80's aesthetic
PANEL_BORDER_STYLE = f"{SYNTHWAVE_THEME['border']} bold"


class Activity(abc.ABC):
    """Abstract base class for language learning activities.

    All learning activities in Langue should inherit from this class and
    implement its abstract methods.
    """

    def __init__(self, language: str, difficulty: int = 1, model_name: Optional[str] = None):
        """Initialize a learning activity.

        Args:
            language: Language to use for the activity
            difficulty: Difficulty level (1-5)
            model_name: Optional model to use for generating content
        """
        self.language = language
        self.difficulty = difficulty
        self.model_name = model_name
        self.points_earned = 0
        self.words_encountered = set()

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Get the name of the activity.

        Returns:
            String name of the activity
        """
        pass

    @property
    @abc.abstractmethod
    def description(self) -> str:
        """Get the description of the activity.

        Returns:
            String description of the activity
        """
        pass

    @abc.abstractmethod
    def get_instructions(self) -> str:
        """Get instructions for the activity.

        Returns:
            String with instructions for the user
        """
        pass

    @abc.abstractmethod
    def generate_content(self) -> Dict[str, Any]:
        """Generate content for the activity.

        This method should use a language model to generate
        the necessary content for the activity.

        Returns:
            Dictionary containing the generated content
        """
        pass

    @abc.abstractmethod
    def present_challenge(self, content: Dict[str, Any]) -> None:
        """Present a challenge to the user.

        Args:
            content: Content generated for the activity
        """
        pass

    @abc.abstractmethod
    def process_response(self, user_input: str, content: Dict[str, Any]) -> Tuple[bool, str]:
        """Process the user's response to a challenge.

        Args:
            user_input: User's input or response
            content: Content for the current challenge

        Returns:
            Tuple of (is_correct, feedback)
        """
        pass

    def start(self) -> None:
        """Start the activity.

        This method runs the complete activity flow.
        """
        # Display activity header
        console.print(Panel(
            f"[bold {SYNTHWAVE_THEME['primary']}]【﻿{self.name.upper()}】[/bold {SYNTHWAVE_THEME['primary']}]",
            subtitle=f"Difficulty: {self.difficulty}",
            border_style=PANEL_BORDER_STYLE
        ))
        console.print(f"Language: [{SYNTHWAVE_THEME['secondary']}]{self.language}[/{SYNTHWAVE_THEME['secondary']}]\n")

        # Show instructions
        console.print(f"[bold {SYNTHWAVE_THEME['accent']}]【﻿ＩＮＳＴＲＵＣＴＩＯＮＳ】[/bold {SYNTHWAVE_THEME['accent']}] {self.get_instructions()}\n")

        # Special handling for flashcards - continuous mode until quit
        if self.name == "Flashcards":
            # Run in continuous mode
            item_count = 0
            quit_session = False

            while not quit_session:
                item_count += 1
                console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]【﻿ＩＴＥＭ {item_count}】[/bold {SYNTHWAVE_THEME['primary']}]\n")

                # Generate content for this item
                content = self.generate_content()

                # Present the challenge to the user (may set quit_session to True)
                self.present_challenge(content)

                # Check if user answer is in content and is a quit command
                if hasattr(self, 'is_quit_command') and content.get("user_answer"):
                    if self.is_quit_command(content.get("user_answer")):
                        quit_session = True
                        break

                # Process response to maintain activity state
                self.process_response("", content)

            # Show summary when user quits
            self._show_summary()
            return

        # For all other activities, use the fixed item count
        # Get the number of items for this activity
        items_count = self.get_items_count()

        # Run through all items
        for i in range(1, items_count + 1):
            console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]【﻿ＩＴＥＭ {i}/{items_count}】[/bold {SYNTHWAVE_THEME['primary']}]\n")

            # Generate content for this item
            content = self.generate_content()

            # Present the challenge to the user
            self.present_challenge(content)

            # Get user input
            user_input = console.input(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＹＯＵＲ　ＡＮＳＷＥＲ】[/bold {SYNTHWAVE_THEME['secondary']}] ")

            # Process user response
            is_correct, feedback = self.process_response(user_input, content)

            # Display feedback
            if is_correct:
                console.print(f"\n[bold {SYNTHWAVE_THEME['highlight']}]★ ＣＯＲＲＥＣＴ! ★[/bold {SYNTHWAVE_THEME['highlight']}] {feedback}")
                self.points_earned += 5
            else:
                console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]✖ ＴＲＹ　ＡＧＡＩＮ ✖[/bold {SYNTHWAVE_THEME['primary']}] {feedback}")
                self.points_earned += 1

        # Show summary
        self._show_summary()

    def get_items_count(self) -> int:
        """Get the number of items for this activity based on difficulty.

        Returns:
            Number of items to present
        """
        # Base count with adjustments for difficulty
        base_count = {
            1: 5,  # Beginner
            2: 7,  # Elementary
            3: 10, # Intermediate
            4: 12, # Advanced
            5: 15  # Proficient
        }

        return base_count.get(self.difficulty, 5)

    def track_words(self, words: List[str]) -> int:
        """Track words encountered during the activity.

        Args:
            words: List of words to track

        Returns:
            Number of new words encountered
        """
        new_count = 0
        for word in words:
            word_lower = word.lower()
            if word_lower not in self.words_encountered:
                self.words_encountered.add(word_lower)
                new_count += 1

        return new_count

    def _show_summary(self) -> None:
        """Show a summary of the activity results."""
        summary_text = Text()
        summary_text.append("\n★★★ ＡＣＴＩＶＩＴＹ ＣＯＭＰＬＥＴＥ! ★★★\n\n", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        summary_text.append(f"Points earned: {self.points_earned}\n", style=f"{SYNTHWAVE_THEME['secondary']}")
        summary_text.append(f"New words encountered: {len(self.words_encountered)}\n", style=f"{SYNTHWAVE_THEME['secondary']}")

        console.print(Panel(
            summary_text,
            title="【﻿ＳＵＭＭＡＲＹ】",
            border_style=PANEL_BORDER_STYLE
        ))

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the activity.

        Returns:
            Dictionary with activity results
        """
        return {
            "activity": self.name,
            "language": self.language,
            "difficulty": self.difficulty,
            "points_earned": self.points_earned,
            "words_encountered": list(self.words_encountered),
            "words_count": len(self.words_encountered)
        }
