"""
Learning activities for Langue.

This module provides implementations of various language learning activities,
including flashcards, fill-in-the-blank exercises, conversation practice,
reading comprehension, and translation exercises.
"""

from langue.activities.base import Activity
from langue.activities.flashcards import FlashcardActivity
from langue.activities.fill_blank import FillBlankActivity
from langue.activities.chat import ChatActivity
from langue.activities.reading import ReadingActivity
from langue.activities.translation import TranslationActivity

__all__ = [
    "Activity",
    "FlashcardActivity",
    "FillBlankActivity",
    "ChatActivity",
    "ReadingActivity",
    "TranslationActivity"
]
