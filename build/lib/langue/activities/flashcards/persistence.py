"""
Flashcard Persistence Module for Langue.

This module provides functions for loading and saving flashcard data
to the database, enabling persistence across sessions.
"""

import os
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

from langue.activities.flashcards.history import FlashcardHistory, FlashcardAttempt


def load_flashcard_history(user_id: str, language: str) -> FlashcardHistory:
    """Load flashcard history from the database.

    Args:
        user_id: User ID to load history for
        language: Language filter

    Returns:
        FlashcardHistory object with loaded data
    """
    # Skip database operations in test mode
    if os.environ.get('LANGUE_TEST_MODE') == '1':
        return FlashcardHistory()

    # Lazy import to avoid circular imports
    from langue.storage.integration import get_flashcard_history

    history = FlashcardHistory()

    try:
        # Get raw history from database
        db_history = get_flashcard_history(user_id, language)

        # Process the database records into a FlashcardHistory object
        word_dict = {}

        # Group attempts by word
        for entry in db_history:
            word = entry.get('word', '')
            if not word:
                continue

            if word not in word_dict:
                word_dict[word] = {
                    "encounters": 0,
                    "attempts": []
                }

            # Create an attempt from this entry
            attempt = FlashcardAttempt(
                user_answer=entry.get('user_answer', ''),
                score=entry.get('score', 0),
                correct=bool(entry.get('correct', 0)),
                timestamp=datetime.fromisoformat(entry.get('timestamp')) if entry.get('timestamp') else datetime.now()
            )

            # Add to the word's history
            word_dict[word]["encounters"] += 1
            word_dict[word]["attempts"].append(attempt)

        # Convert dictionary to FlashcardHistory format
        for word, data in word_dict.items():
            # Sort attempts by timestamp
            data["attempts"].sort(key=lambda a: a.timestamp)

            # Add each attempt to the history
            for attempt in data["attempts"]:
                history.add_attempt(word, attempt.user_answer, attempt.score, attempt.correct)

        return history

    except Exception as e:
        print(f"Error loading flashcard history: {e}")
        return FlashcardHistory()


def save_flashcard_attempt(user_id: str, word: str, translation: str,
                           user_answer: str, language: str, score: int, correct: bool) -> bool:
    """Save a flashcard attempt to the database.

    Args:
        user_id: User ID
        word: The flashcard word
        translation: The correct translation
        user_answer: The user's answer
        language: Language of the flashcard
        score: Score from 1-10
        correct: Whether the answer was correct

    Returns:
        True if successful, False otherwise
    """
    # Skip database operations in test mode
    if os.environ.get('LANGUE_TEST_MODE') == '1':
        return True

    # Lazy import to avoid circular imports
    from langue.storage.integration import save_flashcard_attempt as db_save_attempt

    try:
        # Save to database
        return db_save_attempt(
            user_id=user_id,
            word=word,
            translation=translation,
            user_answer=user_answer,
            language=language,
            score=score,
            correct=correct
        )
    except Exception as e:
        print(f"Error saving flashcard attempt: {e}")
        return False


def get_flashcard_stats(user_id: str, word: str, language: str) -> Dict[str, Any]:
    """Get detailed statistics for a specific flashcard word.

    Args:
        user_id: User ID
        word: The flashcard word
        language: Language of the flashcard

    Returns:
        Dictionary with statistics
    """
    # Skip database operations in test mode
    if os.environ.get('LANGUE_TEST_MODE') == '1':
        return {
            'word': word,
            'avg_score': 5.0,
            'attempts': 3,
            'correct_count': 2,
            'correct_percentage': 66.7,
            'last_seen': datetime.now().isoformat()
        }

    # Lazy import to avoid circular imports
    from langue.storage.integration import get_flashcard_stats as db_get_stats

    try:
        return db_get_stats(user_id, word, language)
    except Exception as e:
        print(f"Error getting flashcard stats: {e}")
        return {
            'word': word,
            'avg_score': 0,
            'attempts': 0,
            'correct_count': 0,
            'correct_percentage': 0,
            'last_seen': None
        }
