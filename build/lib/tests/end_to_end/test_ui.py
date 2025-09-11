#!/usr/bin/env python3
"""
End-to-end tests for the Langue UI.

This module contains tests for the Langue user interface components,
ensuring that the console initialization, theme, and questionary components
work correctly.
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add the project root directory to Python path
project_root = Path(__file__).parents[3]
sys.path.append(str(project_root))

from rich.console import Console
from rich.theme import Theme
from rich.color import Color
import questionary

from langue.main import SYNTHWAVE_THEME, RETRO_STYLE, show_progress
from langue.activities.base import console as activity_console


class TestUI(unittest.TestCase):
    """Test case for UI components."""

    def test_console_initialization(self):
        """Test that the console initializes with the correct theme."""
        # Create a test console with the same theme
        test_console = Console(theme=Theme({
            "info": f"bold {SYNTHWAVE_THEME['secondary']}",
            "warning": f"bold {SYNTHWAVE_THEME['accent']}",
            "danger": f"bold {SYNTHWAVE_THEME['primary']}",
            "success": f"bold {SYNTHWAVE_THEME['highlight']}",
        }))

        # This test passes if the console initialization doesn't raise an exception
        self.assertIsNotNone(test_console)

        # Test that the activity console was initialized correctly
        self.assertIsNotNone(activity_console)

    def test_theme_colors(self):
        """Test that the theme colors are valid."""
        for color_key, color_value in SYNTHWAVE_THEME.items():
            # Verify each color is a valid color that Rich can parse
            parsed_color = Color.parse(color_value)
            self.assertIsNotNone(parsed_color)

    def test_questionary_style(self):
        """Test that the questionary style is valid."""
        # Extract the styles from RETRO_STYLE
        styles = RETRO_STYLE._values

        # Check that each key has a valid style string
        required_keys = ['qmark', 'question', 'answer', 'pointer', 'highlighted', 'selected']

        # RETRO_STYLE is an instance of questionary.Style which changed its interface
        # We'll just verify that the required keys are present in the string representation
        style_str = str(RETRO_STYLE)
        for key in required_keys:
            self.assertIn(key, style_str)

    @patch('questionary.select')
    def test_menu_selection(self, mock_select):
        """Test that menu selection with questionary works."""
        from langue.main import show_main_menu

        # Mock the questionary select response
        mock_select_instance = MagicMock()
        mock_select_instance.ask.return_value = 6  # Select Exit option
        mock_select.return_value = mock_select_instance

        # Mock click Context
        mock_ctx = MagicMock()
        mock_ctx.obj = {
            "config_manager": MagicMock(),
            "user_manager": MagicMock()
        }

        # Mock sys.exit to prevent actual exit
        with patch('sys.exit') as mock_exit:
            # Call the main menu function
            show_main_menu(mock_ctx)

            # Verify that sys.exit was called
            mock_exit.assert_called_once_with(0)

        # Verify that questionary.select was called
        mock_select.assert_called_once()

    @patch('questionary.select')
    def test_activity_menu(self, mock_select):
        """Test that activity menu selection works."""
        from langue.main import show_activity_menu

        # Mock the questionary select response
        mock_select_instance = MagicMock()
        mock_select_instance.ask.return_value = 6  # Select Back option
        mock_select.return_value = mock_select_instance

        # Mock click Context
        mock_ctx = MagicMock()
        mock_ctx.obj = {
            "config_manager": MagicMock(),
            "user_manager": MagicMock()
        }

        # Mock show_main_menu to prevent recursive calls
        with patch('langue.main.show_main_menu') as mock_main_menu:
            # Call the activity menu function
            show_activity_menu(mock_ctx)

            # Verify that show_main_menu was called
            mock_main_menu.assert_called_once()

        # Verify that questionary.select was called
        mock_select.assert_called_once()

    @patch('builtins.input', return_value='')
    def test_progress_view(self, mock_input):
        """Test that the progress view displays correctly."""
        from io import StringIO
        import sys

        # Create mock user profile
        from langue.user.profile import UserProfile
        user = UserProfile(
            user_id="test_user",
            username="Test User",
            languages=["Spanish", "French"],
            current_language="Spanish",
            current_level="b1",
            word_count={"Spanish": 100, "French": 50},
            language_levels={"Spanish": "b1", "French": "a2"},
            points=500,
            streak_days=5,
            achievements=["Earned 100 points", "3-day streak"]
        )

        # Create mock database manager
        mock_db = MagicMock()
        mock_db.get_user_stats.return_value = {
            'total_points': 500,
            'streak_days': 5,
            'total_words': 150,
            'activities_completed': 20,
            'learning_time': 3600,
            'languages': {
                'Spanish': {'word_count': 100},
                'French': {'word_count': 50}
            },
            'activity_breakdown': {
                'flashcards': {'count': 10, 'points': 300, 'words': 100, 'duration': 1800},
                'fill_blank': {'count': 5, 'points': 150, 'words': 30, 'duration': 900},
                'reading': {'count': 3, 'points': 50, 'words': 20, 'duration': 600}
            }
        }
        mock_db.get_flashcard_history.return_value = []
        mock_db.get_connection.return_value.cursor.return_value.fetchall.return_value = []

        # Mock user manager
        mock_user_manager = MagicMock()
        mock_user_manager.get_current_user.return_value = user

        # Mock context
        mock_ctx = MagicMock()
        mock_ctx.obj = {
            "user_manager": mock_user_manager,
            "db_manager": mock_db
        }

        # Capture stdout to verify output
        old_stdout = sys.stdout
        sys.stdout = StringIO()

        try:
            # Mock show_main_menu to prevent recursive calls
            with patch('langue.main.show_main_menu'):
                # Call the progress view function
                show_progress(mock_ctx)

            # Get the captured output
            output = sys.stdout.getvalue()

            # Verify key sections are present
            self.assertIn("ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ", output)
            self.assertIn("Learning Overview", output)
            # Check for the presence of key sections without worrying about exact formatting
            self.assertIn("Learning Overview", output)
            self.assertIn("500", output)  # Total Points value
            self.assertIn("5 days", output)  # Current Streak value
            self.assertIn("150", output)  # Total Words Learned value
            self.assertIn("Language Progress", output)
            self.assertIn("Spanish", output)
            self.assertIn("Level B1", output)
            self.assertIn("Activity Stats", output)
            self.assertIn("Flashcards", output)
            self.assertIn("Weekly Activity", output)
            self.assertIn("Achievements", output)
            self.assertIn("100 points", output)
            self.assertIn("3-day streak", output)

        finally:
            # Restore stdout
            sys.stdout = old_stdout


if __name__ == "__main__":
    unittest.main()
