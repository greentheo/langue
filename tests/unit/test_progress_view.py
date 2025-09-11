"""
Unit tests for the progress dashboard view in Langue.
"""

import unittest
from unittest.mock import MagicMock, patch
import sys
from io import StringIO
from datetime import datetime, timedelta
import sqlite3
import tempfile
import os

from langue.user.profile import UserProfile
from langue.storage.database import DatabaseManager
from langue.main import show_progress


class MockCursor:
    def __init__(self, data=None):
        self.data = data or []
        self.executed_queries = []
        self.query_params = []

    def execute(self, query, params=None):
        self.executed_queries.append(query)
        if params:
            self.query_params.append(params)
        return self

    def fetchone(self):
        if not self.data:
            return None
        return self.data[0] if isinstance(self.data, list) else self.data

    def fetchall(self):
        return self.data if isinstance(self.data, list) else [self.data]


class MockConnection:
    def __init__(self, data=None):
        self.data = data or {}
        self.cursor_obj = None

    def cursor(self):
        # Create a cursor with the appropriate data based on the last query
        self.cursor_obj = MockCursor(self.data)
        return self.cursor_obj

    def close(self):
        pass


class MockDB:
    def __init__(self):
        self.user_stats = {
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

        self.conn = MockConnection()

    def get_user_stats(self, user_id):
        return self.user_stats

    def get_flashcard_history(self, user_id, language=None):
        # Return some mock flashcard history data
        now = datetime.now()
        history = []
        for i in range(20):
            history.append({
                'word': f'word{i}',
                'translation': f'translation{i}',
                'user_answer': f'user_answer{i}',
                'score': i % 10 + 1,  # 1-10
                'correct': (i % 10 >= 5),  # 50% correct rate
                'timestamp': (now - timedelta(days=i//2)).isoformat()
            })
        return history

    def get_connection(self):
        return self.conn


class TestProgressView(unittest.TestCase):
    """Test cases for the progress dashboard view."""

    def setUp(self):
        """Set up test fixtures."""
        # Create a mock user profile
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

        # Create mock objects
        self.db = MockDB()
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
        # Restore stdout
        sys.stdout = self.old_stdout
        self.input_patcher.stop()

    def test_show_progress_displays_overview(self):
        """Test that the progress dashboard displays the learning overview."""
        # Call the function
        with patch('langue.main.show_main_menu') as mock_show_main_menu:
            show_progress(self.ctx)

            # Verify show_main_menu was called
            mock_show_main_menu.assert_called_once_with(self.ctx)

        # Get the captured output
        output = self.stdout_capture.getvalue()

        # Check that key sections are present
        self.assertIn("ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ", output)
        self.assertIn("Learning Overview", output)
        self.assertIn("Total Points: 1250", output)
        self.assertIn("Current Streak: 14 days", output)
        self.assertIn("Total Words Learned: 545", output)

        # Check for language progress section
        self.assertIn("Language Progress", output)
        self.assertIn("Spanish (Level B1)", output)

        # Check for activity stats
        self.assertIn("Activity Stats", output)
        self.assertIn("Flashcards", output)

        # Check for achievements
        self.assertIn("Achievements", output)
        self.assertIn("Earned 100 points", output)

        # Check for flashcard performance
        self.assertIn("Flashcard Performance", output)

    def test_show_progress_handles_no_flashcard_history(self):
        """Test that the dashboard handles the case when there's no flashcard history."""
        # Modify the mock to return empty flashcard history
        self.db.get_flashcard_history = MagicMock(return_value=[])

        # Call the function
        with patch('langue.main.show_main_menu') as mock_show_main_menu:
            show_progress(self.ctx)

            # Verify show_main_menu was called
            mock_show_main_menu.assert_called_once_with(self.ctx)

        # Get the captured output
        output = self.stdout_capture.getvalue()

        # Flashcard performance section should not be present
        self.assertNotIn("Flashcard Performance", output)

        # But other sections should still be there
        self.assertIn("ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ", output)
        self.assertIn("Learning Overview", output)

    def test_show_progress_handles_db_error(self):
        """Test that the dashboard handles database errors gracefully."""
        # Make the DB throw an exception when getting the connection
        self.db.get_connection = MagicMock(side_effect=Exception("Database error"))

        # Call the function
        with patch('langue.main.show_main_menu') as mock_show_main_menu:
            show_progress(self.ctx)

            # Verify show_main_menu was called
            mock_show_main_menu.assert_called_once_with(self.ctx)

        # Get the captured output
        output = self.stdout_capture.getvalue()

        # Error message should be displayed
        self.assertIn("Error loading activities", output)

        # But other sections should still be there
        self.assertIn("ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ", output)
        self.assertIn("Learning Overview", output)

    def test_show_progress_with_real_db(self):
        """Test the progress dashboard with a real SQLite database."""
        # Create a temporary database file
        with tempfile.NamedTemporaryFile(delete=False) as temp_db:
            temp_db_path = temp_db.name

        try:
            # Initialize a real database
            conn = sqlite3.connect(temp_db_path)
            conn.row_factory = sqlite3.Row

            # Create tables and insert test data
            conn.executescript("""
                CREATE TABLE users (
                    user_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    current_language TEXT NOT NULL,
                    current_level TEXT NOT NULL,
                    points INTEGER NOT NULL DEFAULT 0,
                    streak_days INTEGER NOT NULL DEFAULT 0,
                    last_active TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    metadata TEXT
                );

                CREATE TABLE languages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    language TEXT NOT NULL,
                    word_count INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                    UNIQUE(user_id, language)
                );

                CREATE TABLE activities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    activity_type TEXT NOT NULL,
                    language TEXT NOT NULL,
                    points_earned INTEGER NOT NULL DEFAULT 0,
                    words_count INTEGER NOT NULL DEFAULT 0,
                    duration_seconds INTEGER,
                    completed_at TEXT NOT NULL,
                    metadata TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                );

                CREATE TABLE flashcard_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    language TEXT NOT NULL,
                    word TEXT NOT NULL,
                    translation TEXT NOT NULL,
                    user_answer TEXT,
                    score INTEGER NOT NULL DEFAULT 0,
                    correct BOOLEAN NOT NULL DEFAULT 0,
                    timestamp TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                );
            """)

            # Insert user
            now = datetime.now()
            conn.execute(
                """
                INSERT INTO users (
                    user_id, username, current_language, current_level,
                    points, streak_days, last_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ("test_user", "Test User", "Spanish", "b1", 1250, 14,
                 now.isoformat(), (now - timedelta(days=30)).isoformat())
            )

            # Insert languages
            for language, count in [("Spanish", 320), ("French", 150), ("German", 75)]:
                conn.execute(
                    "INSERT INTO languages (user_id, language, word_count) VALUES (?, ?, ?)",
                    ("test_user", language, count)
                )

            # Insert some activities
            for i in range(10):
                activity_date = now - timedelta(days=i % 7)
                conn.execute(
                    """
                    INSERT INTO activities (
                        user_id, activity_type, language, points_earned,
                        words_count, duration_seconds, completed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    ("test_user", "flashcards", "Spanish", 30, 10, 300, activity_date.isoformat())
                )

            # Insert some flashcard history
            for i in range(20):
                attempt_date = now - timedelta(days=i//2)
                conn.execute(
                    """
                    INSERT INTO flashcard_history (
                        user_id, language, word, translation, user_answer,
                        score, correct, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    ("test_user", "Spanish", f"word{i}", f"translation{i}",
                     f"user_answer{i}", i % 10 + 1, (i % 10 >= 5), attempt_date.isoformat())
                )

            conn.commit()
            conn.close()

            # Create a real DB manager
            real_db = DatabaseManager()
            # Override the get_db_path method to use our test DB
            real_db.get_db_path = MagicMock(return_value=temp_db_path)

            # Update the context
            self.ctx.obj["db_manager"] = real_db

            # Call the function
            with patch('langue.main.show_main_menu') as mock_show_main_menu:
                show_progress(self.ctx)

                # Verify show_main_menu was called
                mock_show_main_menu.assert_called_once_with(self.ctx)

            # Get the captured output
            output = self.stdout_capture.getvalue()

            # Check that key sections are present
            self.assertIn("ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ", output)
            self.assertIn("Learning Overview", output)

            # We should not see the error message
            self.assertNotIn("Error loading activities", output)

        finally:
            # Clean up the temp file
            if os.path.exists(temp_db_path):
                os.unlink(temp_db_path)


if __name__ == '__main__':
    unittest.main()
