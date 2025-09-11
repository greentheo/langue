"""
Flashcard History Module for Langue.

This module provides classes and functions for tracking flashcard history,
including attempts, scores, and performance metrics.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any
from datetime import datetime
import random


@dataclass
class FlashcardAttempt:
    """Represents a single flashcard attempt."""

    user_answer: str
    score: int
    correct: bool
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "user_answer": self.user_answer,
            "score": self.score,
            "correct": self.correct,
            "timestamp": self.timestamp.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FlashcardAttempt":
        """Create an attempt from a dictionary."""
        timestamp = data.get("timestamp")
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)
        else:
            timestamp = datetime.now()

        return cls(
            user_answer=data.get("user_answer", ""),
            score=data.get("score", 0),
            correct=data.get("correct", False),
            timestamp=timestamp
        )


class FlashcardHistory:
    """Tracks history for flashcards including attempts and performance."""

    def __init__(self):
        """Initialize an empty flashcard history."""
        # Dictionary mapping words to their history
        self._history: Dict[str, Dict[str, Any]] = {}
        # Last review time
        self._last_review_time: Optional[datetime] = None

    def __iter__(self):
        """Make the history iterable over words."""
        return iter(self._history)

    def __contains__(self, word):
        """Check if a word is in the history."""
        return word in self._history

    def add_attempt(self, word: str, user_answer: str, score: int, correct: bool) -> None:
        """Add an attempt for a word.

        Args:
            word: The flashcard word
            user_answer: User's answer
            score: Score (1-10)
            correct: Whether the answer was correct
        """
        if word not in self._history:
            self._history[word] = {
                "encounters": 0,
                "attempts": []
            }

        # Create and add the attempt
        attempt = FlashcardAttempt(user_answer, score, correct)

        # Update the history
        self._history[word]["encounters"] += 1
        self._history[word]["attempts"].append(attempt)

        # Update last review time
        self._last_review_time = datetime.now()

    def get_last_attempt(self, word: str) -> Optional[FlashcardAttempt]:
        """Get the last attempt for a word.

        Args:
            word: The flashcard word

        Returns:
            The last attempt or None if no attempts exist
        """
        if not self.has_word(word):
            return None

        attempts = self._history[word]["attempts"]
        if not attempts:
            return None

        return attempts[-1]

    def get_average_score(self, word: str) -> float:
        """Get the average score for a word.

        Args:
            word: The flashcard word

        Returns:
            Average score (0 if no attempts)
        """
        if not self.has_word(word):
            return 0.0

        attempts = self._history[word]["attempts"]
        if not attempts:
            return 0.0

        return sum(attempt.score for attempt in attempts) / len(attempts)

    def get_success_rate(self, word: str) -> float:
        """Get the success rate for a word.

        Args:
            word: The flashcard word

        Returns:
            Success rate as percentage (0 if no attempts)
        """
        if not self.has_word(word):
            return 0.0

        attempts = self._history[word]["attempts"]
        if not attempts:
            return 0.0

        correct_count = sum(1 for attempt in attempts if attempt.correct)
        return (correct_count / len(attempts)) * 100

    def get_words_needing_practice(self, limit: int = 5) -> List[str]:
        """Get words that need more practice based on low scores.

        Args:
            limit: Maximum number of words to return

        Returns:
            List of words sorted by score (lowest first)
        """
        if not self._history:
            return []

        # Calculate average scores for each word
        word_scores = {}
        for word, data in self._history.items():
            if data["attempts"]:
                avg_score = sum(attempt.score for attempt in data["attempts"]) / len(data["attempts"])
                word_scores[word] = avg_score

        # Sort by score (lowest first) and get top 'limit' words
        return [word for word, _ in sorted(word_scores.items(), key=lambda x: x[1])[:limit]]

    def get_recently_seen_words(self, limit: int = 5) -> List[str]:
        """Get recently seen words.

        Args:
            limit: Maximum number of words to return

        Returns:
            List of recently seen words
        """
        if not self._history:
            return []

        # Sort words by most recent attempt time
        sorted_words = []
        for word, data in self._history.items():
            if data["attempts"]:
                last_attempt = data["attempts"][-1]
                sorted_words.append((word, last_attempt.timestamp))

        # Sort by timestamp (most recent first) and get top 'limit' words
        return [word for word, _ in sorted(sorted_words, key=lambda x: x[1], reverse=True)[:limit]]

    def should_review(self) -> bool:
        """Determine if it's time to review previously seen words.

        Returns:
            True if review is recommended, False otherwise
        """
        # No history yet
        if not self._history or not self._last_review_time:
            return False

        # If we have enough words, introduce reviews after every few new words
        if len(self._history) >= 5:
            # Introduce some randomness to make it feel natural
            return random.random() < 0.3  # 30% chance to review

        return False

    def has_word(self, word: str) -> bool:
        """Check if a word exists in the history.

        Args:
            word: The flashcard word

        Returns:
            True if word exists in history, False otherwise
        """
        return word in self._history

    def get_word_encounters(self, word: str) -> int:
        """Get the number of encounters for a word.

        Args:
            word: The flashcard word

        Returns:
            Number of encounters (0 if word not found)
        """
        if not self.has_word(word):
            return 0

        return self._history[word]["encounters"]

    def get_word_attempts(self, word: str) -> List[FlashcardAttempt]:
        """Get all attempts for a word.

        Args:
            word: The flashcard word

        Returns:
            List of attempts (empty if word not found)
        """
        if not self.has_word(word):
            return []

        return self._history[word]["attempts"]

    def to_dict(self) -> Dict[str, Any]:
        """Convert history to dictionary for serialization.

        Returns:
            Dictionary representation of history
        """
        result = {}
        for word, data in self._history.items():
            result[word] = {
                "encounters": data["encounters"],
                "attempts": [attempt.to_dict() for attempt in data["attempts"]]
            }

        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FlashcardHistory":
        """Create a FlashcardHistory from a dictionary.

        Args:
            data: Dictionary containing history data

        Returns:
            Initialized FlashcardHistory
        """
        history = cls()

        for word, word_data in data.items():
            history._history[word] = {
                "encounters": word_data.get("encounters", 0),
                "attempts": [
                    FlashcardAttempt.from_dict(attempt_data)
                    for attempt_data in word_data.get("attempts", [])
                ]
            }

        # Set last review time based on most recent attempt
        if history._history:
            latest_time = None
            for word_data in history._history.values():
                attempts = word_data.get("attempts", [])
                if attempts:
                    attempt_time = attempts[-1].timestamp
                    if latest_time is None or attempt_time > latest_time:
                        latest_time = attempt_time

            history._last_review_time = latest_time

        return history

    def keys(self):
        """Return the words in the history."""
        return self._history.keys()

    def items(self):
        """Return word-data pairs from the history."""
        return self._history.items()

    def __getitem__(self, word):
        """Allow dictionary-style access to word history."""
        if word not in self._history:
            raise KeyError(f"Word '{word}' not in history")
        return self._history[word]
