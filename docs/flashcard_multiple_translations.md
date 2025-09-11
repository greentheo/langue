# Multiple Translation Handling in Flashcards

## Overview

This document explains how the flashcard system in Langue handles words with multiple valid translations, ensuring that users receive accurate evaluation regardless of which valid translation they provide.

## Problem Statement

Many words in a language can have multiple valid translations in another language. For example, the French word "bonjour" can be translated to English as "hello", "hi", or "good morning" depending on context. A robust flashcard system should recognize all these valid translations as correct answers.

## Implementation

The Langue flashcard system has been enhanced to properly handle multiple translations in the following ways:

### 1. Library Structure

In the vocabulary libraries, words are stored with an array of possible translations:

```json
{
  "word": "bonjour",
  "translations": ["hello", "hi", "good morning"],
  "examples": ["Bonjour, comment allez-vous?"],
  "category": "greetings",
  "difficulty": 1
}
```

### 2. Flashcard Formatting

When a flashcard is generated from a library word, all translations are preserved:

- The first translation is used as the primary translation for display purposes
- All translations are stored in the `all_translations` field for evaluation
- All accepted translations are shown in the notes section of the flashcard

### 3. Evaluation System

The evaluation system has been modified to consider all valid translations:

- The `evaluate_answer` function now accepts either a single translation string or a list of translations
- When evaluating answers, all translations are passed to the language model
- The LLM is instructed to consider any of the provided translations as equally valid
- The fallback evaluation (used when LLM evaluation fails) checks against all provided translations

### 4. Feedback to User

The system provides clear feedback about multiple translations:

- All accepted translations are displayed in the flashcard notes
- If a user's answer doesn't match any translation, the feedback includes all acceptable translations
- The scoring system considers matches with any valid translation as equally correct

## Example Flow

1. A flashcard is presented with the word "bonjour"
2. The user types "hi" as their answer
3. The system evaluates this against all translations: ["hello", "hi", "good morning"]
4. Since "hi" is in the list of valid translations, it's considered correct
5. The user receives positive feedback and a high score

## Technical Details

### LLM Prompt for Evaluation

When evaluating an answer with multiple translations, the LLM receives a prompt like:

```
Evaluate this flashcard response:

Word: bonjour
Correct translations: ["hello", "hi", "good morning"]
User's answer: hi

Provide feedback and score the answer from 1-10.
```

The system prompt specifically instructs the LLM to "Consider all provided translations as equally valid answers."

### Fallback Evaluation Logic

The fallback evaluation system:

1. Checks for exact matches with any translation
2. If no exact match, checks for close matches (ignoring case, punctuation)
3. If no close match, checks for partial matches (substring relationship)
4. If no partial match, checks for character similarity with any translation
5. Returns appropriate score and feedback based on the best match found

## Benefits

This approach ensures that:

- Users aren't penalized for providing alternate valid translations
- The system accurately reflects the complexity of language translation
- Feedback is informative and educational, showing multiple valid ways to translate a word
- The flashcard system remains effective even when working with large vocabulary libraries containing words with multiple meanings

## Future Enhancements

Future improvements could include:

- Context-sensitive translation evaluation based on example sentences
- Weighting of translations based on frequency or contextual relevance
- User preference tracking for specific translation styles or variants