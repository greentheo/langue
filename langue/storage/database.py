"""
Database storage for Langue.

This module provides functionality for database operations, including initializing
the database schema and performing CRUD operations on user data and activity logs.
"""

import os
import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple, Union

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)



def get_db_path() -> Path:
    """Get the path to the SQLite database file.

    Returns:
        Path to the database file
    """
    # Check for environment variable override
    custom_data_dir = os.environ.get("LANGUE_DATA_DIR")

    if custom_data_dir:
        data_dir = Path(custom_data_dir)
    else:
        # Default location
        data_dir = Path.home() / ".local" / "share" / "langue"

    # Ensure directory exists
    data_dir.mkdir(parents=True, exist_ok=True)

    return data_dir / "langue.db"


def get_connection() -> sqlite3.Connection:
    """Get a connection to the SQLite database.

    Returns:
        SQLite connection object
    """
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)

    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")

    # Configure connection to return rows as dictionaries
    conn.row_factory = sqlite3.Row

    return conn


def initialize_database() -> None:
    """Initialize the database schema.

    This function creates all necessary tables if they don't exist.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        current_language TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 0,
        last_active TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata TEXT
    )
    ''')

    # Create languages table to track languages for each user
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS languages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, language)
    )
    ''')

    # Create words table to track words encountered by users
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        word TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        exposures INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, language, word)
    )
    ''')

    # Create activities table to log activity history
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activities (
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
    )
    ''')

    # Create achievements table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        achievement TEXT NOT NULL,
        earned_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, achievement)
    )
    ''')

    # Create flashcard history table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS flashcard_history (
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
    )
    ''')

    # Create fill-in-the-blank history table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS fill_blank_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        word TEXT NOT NULL,
        user_answer TEXT,
        correct BOOLEAN NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
    ''')

    conn.commit()
    conn.close()


class DatabaseManager:
    """Manager class for database operations."""

    def __init__(self):
        """Initialize the database manager."""
        self.db_path = get_db_path()
        # Initialize database if it doesn't exist
        if not self.db_path.exists() or self.db_path.stat().st_size == 0:
            initialize_database()
        else:
            # Make sure we have the latest schema
            self._ensure_flashcard_history_table()

    def _ensure_flashcard_history_table(self):
        """Ensure the flashcard_history table exists."""
        conn = self.get_connection()
        cursor = conn.cursor()

        # Check if flashcard_history table exists, create it if not
        cursor.execute('''
        SELECT name FROM sqlite_master WHERE type='table' AND name='flashcard_history'
        ''')
        if not cursor.fetchone():
            cursor.execute('''
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
            )
            ''')
            conn.commit()

        conn.close()

    def get_connection(self):
        """Get a database connection.

        Returns:
            SQLite connection object
        """
        return get_connection()

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user data by ID.

        Args:
            user_id: User ID to retrieve

        Returns:
            User data as dictionary or None if not found
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        # Get user basic data
        cursor.execute(
            "SELECT * FROM users WHERE user_id = ?",
            (user_id,)
        )
        user_row = cursor.fetchone()

        if not user_row:
            conn.close()
            return None

        user_data = dict(user_row)

        # Get languages
        cursor.execute(
            "SELECT language, word_count FROM languages WHERE user_id = ?",
            (user_id,)
        )
        languages_rows = cursor.fetchall()

        word_count = {}
        languages = []

        for row in languages_rows:
            languages.append(row['language'])
            word_count[row['language']] = row['word_count']

        user_data['languages'] = languages
        user_data['word_count'] = word_count

        # Get achievements
        cursor.execute(
            "SELECT achievement FROM achievements WHERE user_id = ?",
            (user_id,)
        )
        achievements_rows = cursor.fetchall()

        user_data['achievements'] = [row['achievement'] for row in achievements_rows]

        # Parse metadata JSON if it exists
        if user_data.get('metadata'):
            try:
                user_data['metadata'] = json.loads(user_data['metadata'])
            except json.JSONDecodeError:
                user_data['metadata'] = {}

        conn.close()
        return user_data

    def save_user(self, user_data: Dict[str, Any]) -> bool:
        """Save user data to the database.

        Args:
            user_data: User data dictionary

        Returns:
            True if successful, False otherwise
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            # Prepare metadata
            metadata = user_data.get('metadata', {})
            if metadata:
                metadata_json = json.dumps(metadata)
            else:
                metadata_json = None

            # Check if user exists
            cursor.execute(
                "SELECT user_id FROM users WHERE user_id = ?",
                (user_data['user_id'],)
            )
            existing_user = cursor.fetchone()

            if existing_user:
                # Update existing user
                cursor.execute(
                    """
                    UPDATE users
                    SET username = ?, current_language = ?, points = ?,
                        streak_days = ?, last_active = ?, metadata = ?
                    WHERE user_id = ?
                    """,
                    (
                        user_data['username'],
                        user_data['current_language'],
                        user_data['points'],
                        user_data['streak_days'],
                        user_data['last_active'],
                        metadata_json,
                        user_data['user_id']
                    )
                )
            else:
                # Insert new user
                cursor.execute(
                    """
                    INSERT INTO users
                    (user_id, username, current_language, points,
                     streak_days, last_active, created_at, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_data['user_id'],
                        user_data['username'],
                        user_data['current_language'],
                        user_data['points'],
                        user_data['streak_days'],
                        user_data['last_active'],
                        datetime.now().isoformat(),
                        metadata_json
                    )
                )

            # Handle languages and word counts
            for language, count in user_data.get('word_count', {}).items():
                cursor.execute(
                    """
                    INSERT INTO languages (user_id, language, word_count)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id, language)
                    DO UPDATE SET word_count = ?
                    """,
                    (user_data['user_id'], language, count, count)
                )

            # Handle achievements
            for achievement in user_data.get('achievements', []):
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO achievements
                    (user_id, achievement, earned_at)
                    VALUES (?, ?, ?)
                    """,
                    (user_data['user_id'], achievement, datetime.now().isoformat())
                )

            conn.commit()
            return True
        except Exception as e:
            print(f"Error saving user: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def add_word(self, user_id: str, language: str, word: str) -> bool:
        """Add a word to the user's vocabulary.

        Args:
            user_id: User ID
            language: Language of the word
            word: The word to add

        Returns:
            True if this is a new word, False if already encountered
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        try:
            # Check if word exists
            cursor.execute(
                """
                SELECT id, exposures FROM words
                WHERE user_id = ? AND language = ? AND word = ?
                """,
                (user_id, language, word.lower())
            )
            existing_word = cursor.fetchone()

            if existing_word:
                # Update existing word
                cursor.execute(
                    """
                    UPDATE words
                    SET last_seen = ?, exposures = exposures + 1
                    WHERE id = ?
                    """,
                    (now, existing_word['id'])
                )
                is_new = False
            else:
                # Insert new word
                cursor.execute(
                    """
                    INSERT INTO words
                    (user_id, language, word, first_seen, last_seen)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (user_id, language, word.lower(), now, now)
                )

                # Update word count for this language
                cursor.execute(
                    """
                    UPDATE languages
                    SET word_count = word_count + 1
                    WHERE user_id = ? AND language = ?
                    """,
                    (user_id, language)
                )

                # If language doesn't exist for this user yet, create it
                if cursor.rowcount == 0:
                    cursor.execute(
                        """
                        INSERT INTO languages (user_id, language, word_count)
                        VALUES (?, ?, 1)
                        """,
                        (user_id, language)
                    )

                is_new = True

            conn.commit()
            return is_new
        except Exception as e:
            print(f"Error adding word: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def log_activity(self, user_id: str, activity_type: str, language: str,
                     points_earned: int, words_count: int,
                     duration_seconds: Optional[int] = None,
                     metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Log a completed activity.

        Args:
            user_id: User ID
            activity_type: Type of activity
            language: Language used in the activity
            points_earned: Points earned in the activity
            words_count: Number of words encountered
            duration_seconds: Duration of the activity in seconds
            metadata: Additional metadata about the activity

        Returns:
            True if successful, False otherwise
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        try:
            # Prepare metadata
            metadata_json = json.dumps(metadata) if metadata else None

            # Insert activity
            cursor.execute(
                """
                INSERT INTO activities
                (user_id, activity_type, language, points_earned,
                words_count, duration_seconds, completed_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id, activity_type, language, points_earned,
                    words_count, duration_seconds, now, metadata_json
                )
            )

            conn.commit()
            return True
        except Exception as e:
            print(f"Error logging activity: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def save_flashcard_attempt(self, user_id: str, language: str,
                             word: str, translation: str, user_answer: str,
                             score: int, correct: bool) -> bool:
        """Save a flashcard attempt to the database.

        Args:
            user_id: User ID
            language: Language of the flashcard
            word: The word or phrase on the flashcard
            translation: The correct translation
            user_answer: The user's answer
            score: Score from 1-10
            correct: Whether the answer was correct

        Returns:
            True if successful, False otherwise
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        try:
            cursor.execute(
                """
                INSERT INTO flashcard_history
                (user_id, language, word, translation, user_answer, score, correct, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, language, word, translation, user_answer, score, 1 if correct else 0, now)
            )

            conn.commit()
            return True
        except Exception as e:
            print(f"Error saving flashcard attempt: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def get_flashcard_history(self, user_id: str, language: str = None) -> List[Dict[str, Any]]:
        """Get flashcard history for a user.

        Args:
            user_id: User ID
            language: Optional language filter

        Returns:
            List of flashcard history entries
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            if language:
                cursor.execute(
                    """
                    SELECT * FROM flashcard_history
                    WHERE user_id = ? AND language = ?
                    ORDER BY timestamp DESC
                    """,
                    (user_id, language)
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM flashcard_history
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                    """,
                    (user_id,)
                )

            history = []
            for row in cursor.fetchall():
                history.append(dict(row))

            return history
        except Exception as e:
            print(f"Error retrieving flashcard history: {e}")
            return []
        finally:
            conn.close()

    def get_flashcard_stats_by_word(self, user_id: str, word: str, language: str = None) -> Dict[str, Any]:
        """Get flashcard stats for a specific word.

        Args:
            user_id: User ID
            word: The word to get stats for
            language: Optional language filter

        Returns:
            Dictionary with stats for the word
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            if language:
                cursor.execute(
                    """
                    SELECT AVG(score) as avg_score,
                           COUNT(*) as attempts,
                           SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct_count,
                           MAX(timestamp) as last_seen
                    FROM flashcard_history
                    WHERE user_id = ? AND word = ? AND language = ?
                    """,
                    (user_id, word, language)
                )
            else:
                cursor.execute(
                    """
                    SELECT AVG(score) as avg_score,
                           COUNT(*) as attempts,
                           SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct_count,
                           MAX(timestamp) as last_seen
                    FROM flashcard_history
                    WHERE user_id = ? AND word = ?
                    """,
                    (user_id, word)
                )

            row = cursor.fetchone()
            if not row or row['attempts'] == 0:
                return {
                    'word': word,
                    'avg_score': 0,
                    'attempts': 0,
                    'correct_count': 0,
                    'correct_percentage': 0,
                    'last_seen': None
                }

            correct_percentage = (row['correct_count'] / row['attempts']) * 100 if row['attempts'] > 0 else 0

            return {
                'word': word,
                'avg_score': row['avg_score'],
                'attempts': row['attempts'],
                'correct_count': row['correct_count'],
                'correct_percentage': correct_percentage,
                'last_seen': row['last_seen']
            }
        except Exception as e:
            print(f"Error retrieving flashcard stats: {e}")
            return {
                'word': word,
                'avg_score': 0,
                'attempts': 0,
                'correct_count': 0,
                'correct_percentage': 0,
                'last_seen': None
            }
        finally:
            conn.close()

    def get_activity_history(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent activity history for a user.

        Args:
            user_id: User ID
            limit: Maximum number of activities to return

        Returns:
            List of activity records
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT * FROM activities
            WHERE user_id = ?
            ORDER BY completed_at DESC
            LIMIT ?
            """,
            (user_id, limit)
        )

        activities = []
        for row in cursor.fetchall():
            activity = dict(row)

            # Parse metadata JSON if it exists
            if activity.get('metadata'):
                try:
                    activity['metadata'] = json.loads(activity['metadata'])
                except json.JSONDecodeError:
                    activity['metadata'] = {}

            activities.append(activity)

        conn.close()
        return activities

    def get_streak_data(self, user_id: str) -> Tuple[int, datetime]:
        """Get streak data for a user.

        Args:
            user_id: User ID

        Returns:
            Tuple of (streak_days, last_active)
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT streak_days, last_active FROM users
            WHERE user_id = ?
            """,
            (user_id,)
        )

        row = cursor.fetchone()
        conn.close()

        if row:
            return row['streak_days'], datetime.fromisoformat(row['last_active'])
        else:
            return 0, datetime.now()

    def get_fill_blank_history(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get fill-in-the-blank history for a user.

        Args:
            user_id: User ID to get history for
            limit: Maximum number of records to return

        Returns:
            List of fill-in-the-blank attempts
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                """
                SELECT * FROM fill_blank_history
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (user_id, limit)
            )
            return cursor.fetchall()
        except Exception as e:
            logger.error(f"Error getting fill-in-the-blank history: {e}")
            return []

    def get_fill_blank_stats(self, user_id: str) -> Dict[str, Any]:
        """Get fill-in-the-blank statistics for a user.

        Args:
            user_id: User ID to get stats for

        Returns:
            Dictionary with fill-in-the-blank statistics
        """
        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            # Get overall stats
            cursor.execute(
                """
                SELECT
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
                    COUNT(DISTINCT word) as unique_words
                FROM fill_blank_history
                WHERE user_id = ?
                """,
                (user_id,)
            )
            overall = cursor.fetchone()

            # Get stats by language
            cursor.execute(
                """
                SELECT
                    language,
                    COUNT(*) as attempts,
                    SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct,
                    COUNT(DISTINCT word) as words
                FROM fill_blank_history
                WHERE user_id = ?
                GROUP BY language
                """,
                (user_id,)
            )
            by_language = cursor.fetchall()

            # Get most challenging words
            cursor.execute(
                """
                SELECT
                    word,
                    COUNT(*) as attempts,
                    SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct,
                    CAST(SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as success_rate
                FROM fill_blank_history
                WHERE user_id = ?
                GROUP BY word
                HAVING COUNT(*) >= 2
                ORDER BY success_rate ASC
                LIMIT 5
                """,
                (user_id,)
            )
            challenging_words = cursor.fetchall()

            result = {
                "total_attempts": overall["total_attempts"] if overall else 0,
                "correct_attempts": overall["correct_attempts"] if overall else 0,
                "success_rate": (overall["correct_attempts"] / overall["total_attempts"] * 100
                                if overall and overall["total_attempts"] > 0 else 0),
                "unique_words": overall["unique_words"] if overall else 0,
                "by_language": by_language,
                "challenging_words": challenging_words
            }

            # Close the connection
            conn.close()

            return result
        except Exception as e:
            if 'logger' in globals():
                logger.error(f"Error getting fill-in-the-blank stats: {e}")
            else:
                print(f"Error getting fill-in-the-blank stats: {e}")

            # Close the connection in case of error
            if 'conn' in locals() and conn:
                conn.close()
            return {
                "total_attempts": 0,
                "correct_attempts": 0,
                "success_rate": 0,
                "unique_words": 0,
                "by_language": [],
                "challenging_words": []
            }

    def save_fill_blank_attempt(self, user_id: str, language: str, word: str, user_answer: str, correct: bool) -> bool:
        """Save a fill-in-the-blank attempt to the database.

        Args:
            user_id: User ID
            language: Language of the activity
            word: The word that was blanked out
            user_answer: The user's answer
            correct: Whether the answer was correct

        Returns:
            True if successful, False otherwise
        """
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            timestamp = datetime.now().isoformat()

            cursor.execute(
                """
                INSERT INTO fill_blank_history
                (user_id, language, word, user_answer, correct, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, language, word, user_answer, 1 if correct else 0, timestamp)
            )
            conn.commit()
            return True
        except Exception as e:
            if 'logger' in globals():
                logger.error(f"Error saving fill-in-the-blank attempt: {e}")
            else:
                print(f"Error saving fill-in-the-blank attempt: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive statistics for a user.

        Args:
            user_id: User ID to get stats for

        Returns:
            Dictionary with user statistics
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        stats = {
            'total_points': 0,
            'activities_completed': 0,
            'total_words': 0,
            'languages': {},
            'activity_breakdown': {},
            'learning_time': 0,  # in seconds
        }

        # Get basic user info
        cursor.execute(
            """
            SELECT points, streak_days FROM users
            WHERE user_id = ?
            """,
            (user_id,)
        )

        user_row = cursor.fetchone()
        if user_row:
            stats['total_points'] = user_row['points']
            stats['streak_days'] = user_row['streak_days']

        # Get language stats
        # Get languages the user has learned
        cursor.execute(
            """
            SELECT language, word_count FROM languages
            WHERE user_id = ?
            """,
            (user_id,)
        )

        languages = cursor.fetchall()
        for row in languages:
            language = row['language']
            stats['languages'][language] = {
                'word_count': row['word_count']
            }
            stats['total_words'] += row['word_count']

        # Get activity stats
        cursor.execute(
            """
            SELECT
                activity_type,
                COUNT(*) as count,
                SUM(points_earned) as total_points,
                SUM(words_count) as total_words,
                SUM(duration_seconds) as total_duration
            FROM activities
            WHERE user_id = ?
            GROUP BY activity_type
            """,
            (user_id,)
        )

        # Get fill-in-the-blank stats
        fill_blank_stats = self.get_fill_blank_stats(user_id)

        activities_data = cursor.fetchall()
        for row in activities_data:
            activity_type = row['activity_type']
            stats['activity_breakdown'][activity_type] = {
                'count': row['count'],
                'points': row['total_points'],
                'words': row['total_words'],
                'duration': row['total_duration']
            }

        # Add fill-in-the-blank stats
        if fill_blank_stats['total_attempts'] > 0:
            # Get points from activities table for fill_blank
            cursor.execute(
                """
                SELECT SUM(points_earned) as points
                FROM activities
                WHERE user_id = ? AND activity_type = 'fill_blank'
                """,
                (user_id,)
            )
            points_data = cursor.fetchone()
            points = points_data['points'] if points_data and 'points' in points_data else 0

            stats['activity_breakdown']['fill_blank'] = {
                'count': fill_blank_stats['total_attempts'],
                'points': points,
                'words': fill_blank_stats['unique_words'],
                'duration': 0,  # Duration not tracked for individual attempts
                'success_rate': fill_blank_stats['success_rate']
            }

        # Update totals from all activities
        for activity_type, activity_data in stats['activity_breakdown'].items():
            stats['activities_completed'] += activity_data.get('count', 0)
            stats['learning_time'] += activity_data.get('duration', 0) or 0

        conn.close()
        return stats


# Initialize the database if this module is run directly
if __name__ == "__main__":
    initialize_database()
    print(f"Database initialized at {get_db_path()}")
