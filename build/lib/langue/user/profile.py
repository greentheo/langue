"""
User profile management for Langue.

This module provides the UserProfile class and UserProfileManager to handle user
data, progress tracking, and statistics.
"""

import json
import uuid
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Set, Any

# Import storage functions lazily to avoid circular imports



class UserProfile:
    """Represents a user profile with language learning progress."""

    def __init__(
        self,
        user_id: Optional[str] = None,
        username: str = "language_learner",
        languages: Optional[List[str]] = None,
        current_language: str = "Spanish",
        current_level: str = "a1",
        word_count: Optional[Dict[str, int]] = None,
        language_levels: Optional[Dict[str, str]] = None,
        points: int = 0,
        streak_days: int = 0,
        last_active: Optional[datetime] = None,
        achievements: Optional[List[str]] = None,
    ):
        """Initialize a user profile.

        Args:
            user_id: Unique identifier for the user
            username: Display name for the user
            languages: List of languages the user is learning
            current_language: Currently selected language
            current_level: Currently selected CEFR level (a1, a2, b1, b2, c1, c2)
            word_count: Dictionary mapping languages to word counts
            language_levels: Dictionary mapping languages to their CEFR levels
            points: Total points earned
            streak_days: Number of consecutive days of learning
            last_active: Last activity timestamp
            achievements: List of achievements earned
        """
        self.user_id = user_id or str(uuid.uuid4())
        self.username = username
        self.languages = languages or [current_language]
        self.current_language = current_language
        self.current_level = current_level
        self.word_count = word_count or {lang: 0 for lang in self.languages}
        self.language_levels = language_levels or {lang: "a1" for lang in self.languages}
        self.points = points
        self.streak_days = streak_days
        self.last_active = last_active or datetime.now()
        self.achievements = achievements or []

        # Ensure current_language is in languages list
        if self.current_language not in self.languages:
            self.languages.append(self.current_language)

        # Ensure current_language has a level
        if self.current_language not in self.language_levels:
            self.language_levels[self.current_language] = self.current_level

        # Ensure all languages have a word count entry
        for lang in self.languages:
            if lang not in self.word_count:
                self.word_count[lang] = 0

        # Set of words encountered in each language
        self._encountered_words: Dict[str, Set[str]] = {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert the user profile to a dictionary for serialization.

        Returns:
            Dictionary representation of the user profile
        """
        return {
            "user_id": self.user_id,
            "username": self.username,
            "languages": self.languages,
            "current_language": self.current_language,
            "current_level": self.current_level,
            "word_count": self.word_count,
            "language_levels": self.language_levels,
            "points": self.points,
            "streak_days": self.streak_days,
            "last_active": self.last_active.isoformat(),
            "achievements": self.achievements
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UserProfile":
        """Create a user profile from a dictionary.

        Args:
            data: Dictionary containing user profile data

        Returns:
            UserProfile instance
        """
        # Convert ISO format string to datetime
        if "last_active" in data and isinstance(data["last_active"], str):
            data["last_active"] = datetime.fromisoformat(data["last_active"])

        return cls(**data)

    def add_points(self, points: int) -> None:
        """Add points to the user's total.

        Args:
            points: Number of points to add
        """
        self.points += points

    def add_word(self, word: str, language: Optional[str] = None) -> bool:
        """Add a word to the user's vocabulary for a specific language.

        Args:
            word: Word to add
            language: Language of the word (defaults to current language)

        Returns:
            True if this is a new word, False if already encountered
        """
        lang = language or self.current_language

        # Ensure language is in the word count and encountered words
        if lang not in self.word_count:
            self.word_count[lang] = 0
            self.languages.append(lang)

        if lang not in self._encountered_words:
            self._encountered_words[lang] = set()

        # Check if word is new
        word_lower = word.lower()
        is_new = word_lower not in self._encountered_words[lang]

        if is_new:
            self._encountered_words[lang].add(word_lower)
            self.word_count[lang] += 1

        return is_new

    def update_streak(self) -> None:
        """Update the user's streak based on their last activity date."""
        now = datetime.now()

        # If last active is today, no need to update
        if self.last_active.date() == now.date():
            return

        # If last active was yesterday, increment streak
        if self.last_active.date() == (now - timedelta(days=1)).date():
            self.streak_days += 1
        # If more than a day has passed, reset streak
        elif (now.date() - self.last_active.date()).days > 1:
            self.streak_days = 1

        # Update last active date
        self.last_active = now

    def add_achievement(self, achievement: str) -> None:
        """Add a new achievement to the user's profile.

        Args:
            achievement: Description of the achievement
        """
        if achievement not in self.achievements:
            self.achievements.append(achievement)


class UserProfileManager:
    """Manages user profiles, including loading, saving, and creating."""

    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize the user profile manager.

        Args:
            data_dir: Directory to store user data (defaults to ~/.local/share/langue)
        """
        self.data_dir = data_dir or Path.home() / ".local" / "share" / "langue"
        self.user_file = self.data_dir / "user.json"

        # Ensure data directory exists
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Cache for the current user
        self._current_user: Optional[UserProfile] = None

        # Default user ID
        self._default_user_id = os.environ.get("LANGUE_USER_ID", "default_user")

    def get_current_user(self) -> UserProfile:
        """Get the current user profile, loading from database if necessary.

        Returns:
            The current UserProfile
        """
        if self._current_user is None:
            self._current_user = self.load_user()

        # Update streak when getting the user
        self._current_user.update_streak()

        # Try to save the user, but don't fail if there's a circular import
        try:
            self.save_user(self._current_user)
        except ImportError:
            pass

        return self._current_user

    def load_user(self) -> UserProfile:
        """Load the user profile from database.

        Returns:
            The loaded UserProfile or a new one if none exists
        """
        try:
            # Import here to avoid circular import
            from langue.storage import get_user_profile

            # Try to load from database first
            user = get_user_profile(self._default_user_id)
            if user:
                return user
        except ImportError:
            # If storage module is not available yet, skip database loading
            pass

        # If not in database, try legacy file storage
        if self.user_file.exists():
            try:
                with open(self.user_file, "r", encoding="utf-8") as f:
                    user_data = json.load(f)
                user = UserProfile.from_dict(user_data)
                # Save to database for future use (only if storage is available)
                try:
                    self.save_user(user)
                except ImportError:
                    pass
                return user
            except Exception as e:
                print(f"Error loading user profile from file: {e}")

        # Create new user if not found
        return UserProfile(user_id=self._default_user_id)

    def save_user(self, user: UserProfile) -> bool:
        """Save the user profile to database.

        Args:
            user: UserProfile to save

        Returns:
            True if successful, False otherwise
        """
        try:
            # Save to database
            try:
                # Import here to avoid circular import
                from langue.storage import save_user_profile
                success = save_user_profile(user)

                # If successful, update cache
                if success:
                    self._current_user = user
            except ImportError:
                # If storage module is not available yet, skip database saving
                success = True
                self._current_user = user

            # Also save to file as backup
            try:
                with open(self.user_file, "w", encoding="utf-8") as f:
                    json.dump(user.to_dict(), f, indent=2)
            except Exception as file_e:
                print(f"Warning: Could not save user profile to file: {file_e}")

            return success
        except Exception as e:
            print(f"Error saving user profile: {e}")
            return False

    def reset_user(self) -> UserProfile:
        """Reset the user profile to a new one.

        Returns:
            A new UserProfile
        """
        user = UserProfile()
        self.save_user(user)
        return user

    def track_activity(self, activity_type: str, language: Optional[str] = None,
                       words: Optional[List[str]] = None, points: int = 0) -> None:
        """Track a learning activity for the current user.

        Args:
            activity_type: Type of activity completed
            language: Language used in the activity (defaults to user's current)
            words: List of words encountered in the activity
            points: Points earned for the activity
        """
        user = self.get_current_user()
        lang = language or user.current_language

        # Update words
        if words:
            for word in words:
                is_new = user.add_word(word, lang)
                if is_new:
                    points += 2  # Bonus points for new words

        # Add activity points
        user.add_points(points)

        # Check for achievements
        self._check_achievements(user, activity_type)

        # Save changes
        self.save_user(user)

    def _check_achievements(self, user: UserProfile, activity_type: str) -> None:
        """Check and award any new achievements.

        Args:
            user: User profile to check
            activity_type: Type of activity completed
        """
        # Points-based achievements
        if user.points >= 100 and "Earned 100 points" not in user.achievements:
            user.add_achievement("Earned 100 points")
        elif user.points >= 500 and "Earned 500 points" not in user.achievements:
            user.add_achievement("Earned 500 points")
        elif user.points >= 1000 and "Earned 1000 points" not in user.achievements:
            user.add_achievement("Earned 1000 points")

        # Streak-based achievements
        if user.streak_days >= 3 and "3-day streak" not in user.achievements:
            user.add_achievement("3-day streak")
        elif user.streak_days >= 7 and "7-day streak" not in user.achievements:
            user.add_achievement("7-day streak")
        elif user.streak_days >= 30 and "30-day streak" not in user.achievements:
            user.add_achievement("30-day streak")

        # Word count achievements
        total_words = sum(user.word_count.values())
        if total_words >= 50 and "Learned 50 words" not in user.achievements:
            user.add_achievement("Learned 50 words")
        elif total_words >= 200 and "Learned 200 words" not in user.achievements:
            user.add_achievement("Learned 200 words")
        elif total_words >= 500 and "Learned 500 words" not in user.achievements:
            user.add_achievement("Learned 500 words")

        # Activity-specific achievements
        if activity_type == "flashcards" and "Completed flashcards" not in user.achievements:
            user.add_achievement("Completed flashcards")
        elif activity_type == "fill_blank" and "Completed fill-in-the-blank" not in user.achievements:
            user.add_achievement("Completed fill-in-the-blank")
        elif activity_type == "chat" and "Had a conversation" not in user.achievements:
            user.add_achievement("Had a conversation")
