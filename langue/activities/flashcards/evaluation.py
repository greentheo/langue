"""
Flashcard Evaluation Module for Langue.

This module provides functions for evaluating flashcard answers
using language models for intelligent scoring and feedback.
"""

import json
import re
from typing import Tuple, Dict, Any, Optional, Union, List

from langue.models.base import ModelInterface


def evaluate_answer(model: ModelInterface, word: str, translation: Union[str, List[str]],
                    user_answer: str) -> Tuple[bool, str, int]:
    """Evaluate a flashcard answer using a language model.

    Args:
        model: Language model interface to use for evaluation
        word: The flashcard word in the target language
        translation: The correct translation(s) - can be a string or list of strings
        user_answer: The user's answer

    Returns:
        Tuple of (is_correct, feedback, score)
        - is_correct: Boolean indicating if the answer is correct
        - feedback: Personalized feedback from the LLM
        - score: Score from 1-10 evaluating the answer
    """
    # Handle empty answers
    if not user_answer.strip():
        return False, "No answer provided. Please try again.", 1

    # Convert single translation to list for consistent handling
    translations = translation if isinstance(translation, list) else [translation]

    # Create system prompt for evaluating answers
    system_prompt = (
        "You are a language learning assistant evaluating a user's flashcard answer. "
        "Provide helpful, encouraging feedback on their response. "
        "Also rate the answer on a scale from 1-10 where 10 is perfect. "
        "If the user's provided translation matches any of the correct translations exactly, give it a 10. "
        "Be very generous with scoring - it's better to reward partial understanding than to be strict. "
        "Consider all provided translations as equally valid answers. "
        "Also consider partial correctness, typos, etc. "
        "Be lenient with minor mistakes but strict with major ones. "
        "Format response as JSON with keys: is_correct (boolean), feedback (string), score (integer 1-10)."
    )

    # Format all translations for the prompt
    translations_text = ", ".join(f'"{t}"' for t in translations)

    # User prompt for evaluation
    user_prompt = (
        f"Evaluate this flashcard response:\n\n"
        f"Word: {word}\n"
        f"Correct translations: [{translations_text}]\n"
        f"User's answer: {user_answer}\n\n"
        f"Provide feedback and score the answer from 1-10."
    )

    try:
        # Get response from model
        response = model.get_response(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.3  # Lower temperature for more consistent evaluation
        )

        # Parse response
        result = parse_evaluation_response(response)
        return result
    except Exception as e:
        # Fallback evaluation if model fails
        return fallback_evaluate_answer(word, translation, user_answer)


def parse_evaluation_response(response: str) -> Tuple[bool, str, int]:
    """Parse the response from the language model into evaluation components.

    Args:
        response: The raw response from the language model

    Returns:
        Tuple of (is_correct, feedback, score)
    """
    # Try to find JSON in the response
    json_match = re.search(r'```json\s*([\s\S]*?)\s*```|{[\s\S]*}', response)
    if json_match:
        json_str = json_match.group(1) if json_match.group(1) else json_match.group(0)
        try:
            data = json.loads(json_str)
            return (
                data.get("is_correct", False),
                data.get("feedback", "Keep practicing this word."),
                data.get("score", 5)
            )
        except json.JSONDecodeError:
            pass

    # Fallback: Manual parsing if JSON extraction fails
    is_correct = "correct" in response.lower() and "incorrect" not in response.lower()

    # Extract a score if possible
    score_match = re.search(r'score:\s*(\d+)', response, re.IGNORECASE)
    score = int(score_match.group(1)) if score_match else 5

    # Limit score to 1-10 range
    score = max(1, min(score, 10))

    # Use the whole response as feedback if JSON parsing failed
    return is_correct, response, score


def fallback_evaluate_answer(word: str, translation: Union[str, List[str]], user_answer: str) -> Tuple[bool, str, int]:
    """Fallback evaluation method when the model evaluation fails.

    Args:
        word: The flashcard word in the target language
        translation: The correct translation(s) - can be a string or list of strings
        user_answer: The user's answer

    Returns:
        Tuple of (is_correct, feedback, score)
    """
    # Convert single translation to list for consistent handling
    translations = translation if isinstance(translation, list) else [translation]

    # Simple string matching for correctness
    user_lower = user_answer.lower().strip()

    # Check for exact match with any translation
    for trans in translations:
        trans_lower = trans.lower().strip()

        # Check for exact match
        if user_lower == trans_lower:
            return True, "Your answer is correct!", 10

        # Check for close match (e.g., missing punctuation, extra spaces)
        if clean_text(user_lower) == clean_text(trans_lower):
            return True, "Your answer is correct, though there might be small differences in formatting.", 9

    # Check for partial match with any translation
    for trans in translations:
        trans_lower = trans.lower().strip()

        if user_lower in trans_lower or trans_lower in user_lower:
            return False, f"Your answer is partially correct. Acceptable translations include: {', '.join(translations)}.", 6

    # Check for similarity with any translation
    best_similarity = 0
    for trans in translations:
        trans_lower = trans.lower().strip()
        similarity = character_similarity(user_lower, trans_lower)
        best_similarity = max(best_similarity, similarity)

    if best_similarity > 0.5:
        return False, f"Your answer is close but not quite right. Acceptable translations include: {', '.join(translations)}.", 4

    # No match
    return False, f"Your answer is incorrect. Acceptable translations include: {', '.join(translations)}.", 2


def clean_text(text: str) -> str:
    """Remove non-alphanumeric characters for comparison.

    Args:
        text: Text to clean

    Returns:
        Cleaned text
    """
    return re.sub(r'[^\w\s]', '', text)


def character_similarity(a: str, b: str) -> float:
    """Calculate character-level similarity between two strings.

    Args:
        a: First string
        b: Second string

    Returns:
        Similarity score (0-1)
    """
    if not a or not b:
        return 0.0

    # Count matching characters
    matches = sum(1 for char_a in a if char_a in b)
    total = max(len(a), len(b))

    return matches / total if total > 0 else 0.0
