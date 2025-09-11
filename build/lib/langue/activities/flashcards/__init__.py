"""
Flashcards Activity Package for Langue.

This package provides the flashcard-based vocabulary learning activity,
including persistence, evaluation, and visualization components.
"""

from langue.activities.flashcards.activity import FlashcardActivity
from langue.activities.flashcards.evaluation import evaluate_answer
from langue.activities.flashcards.history import FlashcardHistory, FlashcardAttempt
from langue.activities.flashcards.visualization import create_progress_visualization
from langue.activities.flashcards.library_manager import FlashcardLibraryManager

__all__ = [
    'FlashcardActivity',
    'evaluate_answer',
    'FlashcardHistory',
    'FlashcardAttempt',
    'create_progress_visualization',
    'FlashcardLibraryManager'
]
