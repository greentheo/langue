"""
End-to-end tests for the progress view in Langue.
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
from io import StringIO
from datetime import datetime, timedelta

from langue.user.profile import UserProfile
from langue.storage.database import DatabaseManager
from langue.main import show_progress


class TestProgressViewEndToEnd(unittest.TestCase):
    """End-to-end test for the progress view."""

    def setUp(self):
        """Set up test fixtures."""
        # Create a mock user profile with realistic data
        self.user = UserProfile(
            user_id="test_user",
            username="Test User",
            languages=["Spanish", "French", "German"],
            current_language="Spanish",
            current_level="b1",
            word_count={"Spanish": 320, "French": 150, "German": 75},
            language_levels={"Spanish": "b1", "French": "a2", "German": "a1"},
            points=1250,
            streak_days=14,
            last_active=datetime.now(),
            achievements=[
                "Earned 100 points",
                "Earned 500 points",
                "Earned 1000 points",
                "3-day streak",
                "7-day streak",
                "Completed flashcards"
            ]
        )

        # Mock the database with realistic data
        self.db = MagicMock(spec=DatabaseManager)
        self.db.get_user_stats.return_value = {
            'total_points': 1250,
            'streak_days': 14,
            'total_words': 545,
            'activities_completed': 42,
            'learning_time': 10800,  # 3 hours in seconds
            'languages': {
                'Spanish': {'word_count': 320},
                'French': {'word_count': 150},
                'German': {'word_count': 75}
            },
            'activity_breakdown': {
                'flashcards': {'count': 20, 'points': 500, 'words': 200, 'duration': 3600},
                'fill_blank': {'count': 10, 'points': 300, 'words': 150, 'duration': 2400},
                'reading': {'count': 5, 'points': 200, 'words': 100, 'duration': 1800},
                'translation': {'count': 5, 'points': 150, 'words': 75, 'duration': 1500},
                'chat': {'count': 2, 'points': 100, 'words': 20, 'duration': 1500}
            }
        }

        # Create mock flashcard history
        now = datetime.now()
        flashcard_history = []
        for i in range(20):
            flashcard_history.append({
                'word': f'word{i}',
                'translation': f'translation{i}',
                'user_answer': f'user_answer{i}',
                'score': i % 10 + 1,  # 1-10
                'correct': (i % 10 >= 5),  # 50% correct rate
                'timestamp': (now - timedelta(days=i//2)).isoformat()
            })
        self.db.get_flashcard_history.return_value = flashcard_history

        # Mock the connection and cursor
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # Mock weekly activities data
        weekly_activities = []
        for i in range(10):
            activity_date = now - timedelta(days=i % 7)
            weekly_activities.append({
                'completed_at': activity_date.isoformat(),
                'points_earned': 30
            })

        mock_cursor.fetchall.return_value = weekly_activities
        mock_conn.cursor.return_value = mock_cursor
        self.db.get_connection.return_value = mock_conn

        # Create mock user manager
        self.user_manager = MagicMock()
        self.user_manager.get_current_user.return_value = self.user

        # Create mock context
        self.ctx = MagicMock()
        self.ctx.obj = {
            "user_manager": self.user_manager,
            "db_manager": self.db
        }

        # Capture stdout to verify output
        self.stdout_capture = StringIO()
        self.old_stdout = sys.stdout
        sys.stdout = self.stdout_capture

        # Mock input to handle the "press enter to continue" prompt
        self.input_patcher = patch('builtins.input', return_value='')
        self.mock_input = self.input_patcher.start()

    def tearDown(self):
        """Tear down test fixtures."""
        sys.stdout = self.old_stdout
        self.input_patcher.stop()

    def test_progress_view_renders_all_sections(self):
        """Test that all sections of the progress view render correctly."""
        # Call the function with mocked show_main_menu to prevent recursion
        with patch('langue.main.show_main_menu') as mock_show_main_menu:
            show_progress(self.ctx)
            mock_show_main_menu.assert_called_once_with(self.ctx)

        # Get the captured output
        output = self.stdout_capture.getvalue()

        # Check all major sections are present
        expected_sections = [
            "ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ",
            "Learning Overview",
            "Total Points: 1250",
            "Current Streak: 14 days",
            "Total Words Learned: 545",
            "Language Progress",
            "Spanish (Level B1)",
            "French (Level A2)",
            "German (Level A1)",
            "Activity Stats",
            "Flashcards",
            "Fill in the Blank",
            "Translation",
            "Reading",
            "Conversation",
            "Weekly Activity",
            "Achievements",
            "Earned 100 points",
            "Earned 500 points",
            "Earned 1000 points",
            "3-day streak",
            "7-day streak",
            "Completed flashcards",
            "Flashcard Performance",
            "Total Flashcards Attempted",
            "Correct Answers",
            "Recent Average Score",
            "Accuracy",
            "Level Progress"
        ]

        for section in expected_sections:
            self.assertIn(section, output, f"Missing section: {section}")

    def test_db_access_robust_to_errors(self):
        """Test that the progress view handles database errors gracefully."""
        # Make the DB throw an exception for weekly activities
        self.db.get_connection.side_effect = Exception("Database error")

        # Call the function
        with patch('langue.main.show_main_menu') as mock_show_main_menu:
            show_progress(self.ctx)
            mock_show_main_menu.assert_called_once_with(self.ctx)

        # Get the captured output
        output = self.stdout_capture.getvalue()

        # Error message should be displayed
        self.assertIn("Error loading activities", output)

        # But other sections should still render
        self.assertIn("ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ", output)
        self.assertIn("Learning Overview", output)
        self.assertIn("Total Points: 1250", output)

    def test_no_error_with_empty_data(self):
        """Test that the view doesn't crash with empty data."""
        # Set empty data
        self.db.get_user_stats.return_value = {
            'total_points': 0,
            'streak_days': 0,
            'total_words': 0,
            'activities_completed': 0,
            'learning_time': 0,
            'languages': {},
            'activity_breakdown': {}
        }
        self.db.get_flashcard_history.return_value = []

        # Call the function
        with patch('langue.main.show_main_menu') as mock_show_main_menu:
            show_progress(self.ctx)
            mock_show_main_menu.assert_called_once_with(self.ctx)

        # Get the captured output
        output = self.stdout_capture.getvalue()

        # Should still show the dashboard title
        self.assertIn("ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ", output)

        # Should show empty stats
        self.assertIn("Total Points: 0", output)
        self.assertIn("Current Streak: 0 days", output)

        # Flashcard section should not be present with empty history
        self.assertNotIn("Flashcard Performance", output)


if __name__ == '__main__':
    unittest.main()
