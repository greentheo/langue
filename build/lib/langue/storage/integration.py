"""
Storage database integration for Langue.

This module provides functions to integrate the database storage with activities,
user profiles, and other application components.
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple, Set

from langue.storage.database import DatabaseManager
# Import UserProfile class lazily to avoid circular imports
from langue.activities.base import Activity

# Initialize database manager
db_manager = DatabaseManager()


def save_activity_results(user_id: str, activity: Activity) -> bool:
    """Save activity results to the database.

    Args:
        user_id: User ID
        activity: Completed activity with results

    Returns:
        True if successful, False otherwise
    """
    try:
        # Get activity results
        results = activity.get_results()

        # Prepare metadata
        metadata = {k: v for k, v in results.items() if k not in [
            'activity', 'language', 'difficulty', 'points_earned',
            'words_encountered', 'words_count'
        ]}

        # Log the activity
        success = db_manager.log_activity(
            user_id=user_id,
            activity_type=results['activity'],
            language=results['language'],
            points_earned=results['points_earned'],
            words_count=results['words_count'],
            duration_seconds=metadata.get('duration_seconds'),
            metadata=metadata
        )

        # Save encountered words
        for word in results.get('words_encountered', []):
            db_manager.add_word(user_id, results['language'], word)

        return success
    except Exception as e:
        print(f"Error saving activity results: {e}")
        return False


def get_user_profile(user_id: str) -> Optional[Any]:
    """Get a user profile from the database.

    Args:
        user_id: User ID to retrieve

    Returns:
        UserProfile object or None if not found
    """
    try:
        # Import here to avoid circular imports
        from langue.user.profile import UserProfile

        # Get user data from database
        user_data = db_manager.get_user(user_id)

        if not user_data:
            return None

        # Convert database data to UserProfile object
        return UserProfile(
            user_id=user_data.get('user_id'),
            username=user_data.get('username'),
            languages=user_data.get('languages', []),
            current_language=user_data.get('current_language'),
            word_count=user_data.get('word_count', {}),
            points=user_data.get('points', 0),
            streak_days=user_data.get('streak_days', 0),
            last_active=user_data.get('last_active'),
            achievements=user_data.get('achievements', [])
        )
    except Exception as e:
        print(f"Error retrieving user profile: {e}")
        return None


def save_user_profile(user: Any) -> bool:
    """Save a user profile to the database.

    Args:
        user: UserProfile object to save

    Returns:
        True if successful, False otherwise
    """
    try:
        # Convert UserProfile to dictionary format expected by the database
        user_data = user.to_dict()

        # Save to database
        return db_manager.save_user(user_data)
    except Exception as e:
        print(f"Error saving user profile: {e}")
        return False


def update_user_streak(user_id: str) -> Tuple[int, datetime]:
    """Update user streak based on activity.

    Args:
        user_id: User ID

    Returns:
        Tuple of (new_streak_days, last_active)
    """
    try:
        return db_manager.get_streak_data(user_id)
    except Exception as e:
        print(f"Error updating user streak: {e}")
        return 0, datetime.now()


def get_user_stats(user_id: str) -> Dict[str, Any]:
    """Get comprehensive statistics for a user.

    Args:
        user_id: User ID

    Returns:
        Dictionary with user statistics
    """
    try:
        return db_manager.get_user_stats(user_id)
    except Exception as e:
        print(f"Error retrieving user stats: {e}")
        return {
            'total_points': 0,
            'activities_completed': 0,
            'total_words': 0,
            'languages': {},
            'activity_breakdown': {},
            'learning_time': 0,
        }


def get_recent_activities(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get recent activity history for a user.

    Args:
        user_id: User ID
        limit: Maximum number of activities to return

    Returns:
        List of activity records
    """
    try:
        return db_manager.get_activity_history(user_id, limit)
    except Exception as e:
        print(f"Error retrieving activity history: {e}")
        return []


def get_vocabulary_list(user_id: str, language: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Get the user's vocabulary list for a specific language.

    Args:
        user_id: User ID
        language: Language to get vocabulary for
        limit: Maximum number of words to return

    Returns:
        List of vocabulary words with metadata
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT word, first_seen, last_seen, exposures
            FROM words
            WHERE user_id = ? AND language = ?
            ORDER BY last_seen DESC
            LIMIT ?
            """,
            (user_id, language, limit)
        )

        vocabulary = []
        for row in cursor.fetchall():
            vocabulary.append(dict(row))

        conn.close()
        return vocabulary
    except Exception as e:
        print(f"Error retrieving vocabulary list: {e}")
        return []


def migrate_user_data(old_user_file: str, database_path: Optional[str] = None) -> bool:
    """Migrate user data from a JSON file to the database.

    Args:
        old_user_file: Path to the old JSON user file
        database_path: Optional custom database path

    Returns:
        True if successful, False otherwise
    """
    try:
        # Load old user data
        if not os.path.exists(old_user_file):
            return False

        with open(old_user_file, 'r', encoding='utf-8') as f:
            user_data = json.load(f)

        # Create user profile
        user = UserProfile.from_dict(user_data)

        # Save to database
        return save_user_profile(user)
    except Exception as e:
        print(f"Error migrating user data: {e}")
        return False


def save_flashcard_attempt(user_id: str, word: str, translation: str,
                          user_answer: str, language: str, score: int, correct: bool) -> bool:
    """Save a flashcard attempt to the database.

    Args:
        user_id: User ID
        word: The word or phrase on the flashcard
        translation: The correct translation
        user_answer: The user's answer
        language: Language of the flashcard
        score: Score from 1-10
        correct: Whether the answer was correct

    Returns:
        True if successful, False otherwise
    """
    try:
        return db_manager.save_flashcard_attempt(
            user_id=user_id,
            language=language,
            word=word,
            translation=translation,
            user_answer=user_answer,
            score=score,
            correct=correct
        )
    except Exception as e:
        print(f"Error saving flashcard attempt: {e}")
        return False


def get_flashcard_history(user_id: str, language: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get flashcard history for a user.

    Args:
        user_id: User ID
        language: Optional language filter

    Returns:
        List of flashcard history entries
    """
    try:
        return db_manager.get_flashcard_history(user_id, language)
    except Exception as e:
        print(f"Error retrieving flashcard history: {e}")
        return []


def get_flashcard_stats(user_id: str, word: str, language: Optional[str] = None) -> Dict[str, Any]:
    """Get flashcard stats for a specific word.

    Args:
        user_id: User ID
        word: The word to get stats for
        language: Optional language filter

    Returns:
        Dictionary with stats for the word
    """
    try:
        return db_manager.get_flashcard_stats_by_word(user_id, word, language)
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


def save_flashcard_activity_results(user_id: str, activity: Any) -> bool:
    """Save flashcard activity results to the database including detailed history.

    Args:
        user_id: User ID
        activity: Completed flashcard activity with results

    Returns:
        True if successful, False otherwise
    """
    try:
        # Skip database interactions in test mode
        if os.environ.get('LANGUE_TEST_MODE') == '1':
            return True

        # First save the activity results normally
        success = save_activity_results(user_id, activity)

        # Then save detailed flashcard history
        if success and hasattr(activity, 'flashcard_history'):
            for word, data in activity.flashcard_history.items():
                # Skip words that don't have scores recorded
                if not data.get('scores'):
                    continue

                # Get the last answer and score
                last_answer = data.get('answers', [''])[-1]
                last_score = data.get('scores', [0])[-1]

                # Determine if it was correct (score >= 7 is considered correct)
                correct = last_score >= 7

                # Get translation
                translation = activity.generate_content().get('translation', '')

                # Save this attempt
                db_manager.save_flashcard_attempt(
                    user_id=user_id,
                    language=activity.language,
                    word=word,
                    translation=translation,
                    user_answer=last_answer,
                    score=last_score,
                    correct=correct
                )

        return success
    except Exception as e:
        print(f"Error saving flashcard activity results: {e}")
        return False


def initialize_db_from_config(config_path: Optional[str] = None) -> bool:
    """Initialize the database based on configuration.

    Args:
        config_path: Optional path to configuration file

    Returns:
        True if successful, False otherwise
    """
    try:
        # Initialize database
        db_manager.db_path
        return True
    except Exception as e:
        print(f"Error initializing database: {e}")
        return False


def get_db_manager() -> DatabaseManager:
    """Get the database manager instance.

    Returns:
        DatabaseManager: The singleton database manager instance
    """
    return db_manager
