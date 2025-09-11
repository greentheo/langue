"""
Helper utilities for Langue.

This module provides various utility functions used throughout the Langue application.
"""

import re
import string
from datetime import datetime, timedelta
from typing import List, Set, Optional


def extract_words(text: str, language: str = "any") -> List[str]:
    """Extract individual words from a text string.

    Args:
        text: The text to extract words from
        language: The language of the text (affects tokenization rules)

    Returns:
        List of individual words
    """
    # Remove punctuation
    translator = str.maketrans('', '', string.punctuation)
    text = text.translate(translator)

    # Handle language-specific tokenization
    if language.lower() in ["chinese", "japanese", "korean"]:
        # For languages without spaces, we need more sophisticated tokenization
        # This is a simple placeholder - in a real implementation, you'd use a
        # language-specific tokenizer like jieba for Chinese, etc.
        words = list(text.strip())
    else:
        # For space-delimited languages, split by whitespace
        words = text.split()

    # Filter out empty strings and normalize
    return [word.strip().lower() for word in words if word.strip()]


def calculate_streak_days(dates: List[datetime]) -> int:
    """Calculate the number of consecutive days from a list of dates.

    Args:
        dates: List of datetime objects representing activity dates

    Returns:
        Number of consecutive days (streak)
    """
    if not dates:
        return 0

    # Sort dates in descending order (newest first)
    sorted_dates = sorted(dates, reverse=True)

    # Get unique dates (only the date part, not time)
    unique_dates = set(date.date() for date in sorted_dates)

    # If the latest date is not today, start streak from 0
    today = datetime.now().date()
    if max(unique_dates) < today:
        return 0

    # Count consecutive days
    streak = 1
    current_date = today

    while True:
        current_date = current_date - timedelta(days=1)
        if current_date in unique_dates:
            streak += 1
        else:
            break

    return streak


def format_duration(seconds: int) -> str:
    """Format a duration in seconds to a human-readable string.

    Args:
        seconds: Duration in seconds

    Returns:
        Formatted duration string (e.g., "2h 30m" or "45s")
    """
    if seconds < 60:
        return f"{seconds}s"

    minutes, seconds = divmod(seconds, 60)
    if minutes < 60:
        return f"{minutes}m {seconds}s"

    hours, minutes = divmod(minutes, 60)
    if hours < 24:
        return f"{hours}h {minutes}m"

    days, hours = divmod(hours, 24)
    return f"{days}d {hours}h"


def sanitize_filename(filename: str) -> str:
    """Sanitize a string to be used as a filename.

    Args:
        filename: Original filename string

    Returns:
        Sanitized filename string
    """
    # Remove invalid characters
    invalid_chars = r'[<>:"/\\|?*]'
    sanitized = re.sub(invalid_chars, '', filename)

    # Ensure it's not too long
    if len(sanitized) > 255:
        sanitized = sanitized[:255]

    # Ensure it's not empty
    if not sanitized:
        sanitized = "unnamed"

    return sanitized


def parse_language_level(level_str: str) -> int:
    """Parse a language level string to a numeric value.

    Args:
        level_str: String representation of language level (A1, A2, B1, B2, C1, C2)

    Returns:
        Integer value from 1 (A1) to 6 (C2)
    """
    level_map = {
        "a1": 1, "beginner": 1, "basic": 1,
        "a2": 2, "elementary": 2,
        "b1": 3, "intermediate": 3,
        "b2": 4, "upper intermediate": 4,
        "c1": 5, "advanced": 5,
        "c2": 6, "proficient": 6, "native": 6
    }

    # Normalize input
    normalized = level_str.lower().strip()

    # Try direct mapping
    if normalized in level_map:
        return level_map[normalized]

    # Try to extract A1-C2 pattern
    match = re.search(r'([a-c][1-2])', normalized, re.IGNORECASE)
    if match:
        return level_map.get(match.group(1).lower(), 1)

    # Default to beginner level
    return 1


def get_language_code(language_name: str) -> Optional[str]:
    """Get ISO language code from language name.

    Args:
        language_name: Full language name

    Returns:
        ISO 639-1 two-letter language code or None if not found
    """
    language_codes = {
        "english": "en",
        "spanish": "es",
        "french": "fr",
        "german": "de",
        "italian": "it",
        "portuguese": "pt",
        "dutch": "nl",
        "russian": "ru",
        "chinese": "zh",
        "japanese": "ja",
        "korean": "ko",
        "arabic": "ar",
        "hindi": "hi",
        "bengali": "bn",
        "turkish": "tr",
        "vietnamese": "vi",
        "thai": "th",
        "indonesian": "id",
        "malay": "ms",
        "swahili": "sw"
    }

    normalized = language_name.lower().strip()

    # Handle special cases
    if "chinese" in normalized and "mandarin" in normalized:
        return "zh"

    # Try direct mapping
    for name, code in language_codes.items():
        if name in normalized:
            return code

    return None
