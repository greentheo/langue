# Fill-in-the-Blank Activity Documentation

## Overview

The fill-in-the-blank activity is a language learning exercise where users complete sentences by identifying missing words. This activity has been enhanced to use the flashcard library system, providing level-appropriate vocabulary and sentences based on the user's current proficiency level (A1-C2). The activity runs in continuous mode, allowing users to practice for as long as they want.

## Key Features

### Flashcard Library Integration
- Uses vocabulary from the level-appropriate flashcard libraries
- Generates example sentences featuring words from the flashcard set
- Falls back to model-generated content when libraries aren't available
- Tracks vocabulary mastery across sessions

- Multiple choice or free text
- Configurable to show options (multiple choice) or require typed answers
- Automatically generates plausible alternative options
- Options can include other words from the same category for more meaningful choices
- Sentences are adapted to match the user's proficiency level (simpler sentences for A1-A2, more complex for C1-C2)

### Progress Tracking
- Records all attempts in a dedicated database table
- Tracks success rates for words over time
- Identifies challenging words that need additional practice
- Visualizes performance in the progress dashboard

- Continuous Mode
- Unlimited fill-in-the-blank exercises per session
- Progress counter shows current item number
- Exit anytime by typing 'quit'
- Summary statistics shown upon completion
- Works just like the flashcards continuous mode for consistency

## Implementation Details

### Architecture

The fill-in-the-blank activity consists of the following components:

1. **`FillBlankActivity` Class**: Main activity implementation
2. **`FillBlankHistory` Class**: Tracks history and statistics
3. **`FillBlankAttempt` Class**: Represents a single attempt
4. **Database Integration**: Stores attempts persistently

### Word Selection Logic

The activity follows this process to generate content:

1. Attempt to get a random word from the appropriate flashcard library
2. If a library word is found, generate a level-appropriate sentence using that word
3. Ensure the target word is properly blanked out in the sentence
4. Generate plausible alternative options for multiple choice
5. Always show translation after the user answers (not before)
6. If no library is available, fall back to model-generated content

### Multiple Choice Generation

Options for multiple choice are generated in this order:

1. The correct answer (the blanked-out word)
2. Other words from the same category in the flashcard library
3. Other random words from the same proficiency level
4. Algorithmically modified versions of the correct word (if needed)

### Scoring System

- Correct answers earn 1 point each
- No partial scoring is implemented (answers are either correct or incorrect)
- Statistics track both individual session and overall performance

## Database Schema

The activity uses a dedicated table in the SQLite database:

```sql
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
```

## Progress Visualization

The main progress dashboard includes a dedicated section for fill-in-the-blank statistics:

- Overall accuracy with a progress bar
- Total attempts and success rate
- Number of unique words practiced
- List of challenging words that need additional practice

## Usage

The activity can be started from the command line:

```bash
langue fill-blank --language spanish --difficulty 3
```

Or from the activity menu in the main application.

### Parameters

- `language`: Language to practice (defaults to user's current language)
- `difficulty`: Difficulty level from 1-6 (maps to CEFR levels A1-C2)
- `level`: Can directly specify CEFR level (a1, a2, b1, b2, c1, c2)
- `show_options`: Whether to show multiple choice options (defaults to true)

The activity continues indefinitely until you type 'quit', just like the flashcard activity.

## Example Session

```
ＩＴＥＭ 1

【ＣＯＭＰＬＥＴＥ　ＴＨＥ　ＳＥＮＴＥＮＣＥ】
Me gusta _____ en el parque.

【ＣＨＯＯＳＥ　ＴＨＥ　ＣＯＲＲＥＣＴ　ＯＰＴＩＯＮ】
  1. correr
  2. libro
  3. casa
  4. rápido

> 1

★ CORRECT! ★ The missing word is 'correr'.

This word belongs to the category 'activities'. It means 'to run' in English. It's considered a A1 level word.

【ＣＯＭＰＬＥＴＥ　ＳＥＮＴＥＮＣＥ】
Me gusta correr en el parque.

Translation: I like to run in the park.

Points: 1
```

## Implementation Notes

- The activity uses the language model to generate contextually appropriate sentences when no examples are available in the flashcard library.
- Database operations are wrapped in try/except blocks to ensure robustness.
- The activity follows the same 80's synthwave aesthetic as the rest of the application.
- The same model is used for both generating sentences and evaluating responses.

## Future Enhancements

Potential future improvements include:

1. **Multiple Blanks**: Support for sentences with multiple blanks
2. **Contextual Difficulty**: Adjusting sentence complexity based on user performance
3. **Grammar Focus**: Targeting specific grammar concepts in the generated sentences
4. **Spaced Repetition**: Implementing smarter scheduling of words based on performance
5. **Audio Support**: Adding pronunciation examples for the sentences
6. **Enhanced Translation**: Adding more context-specific translations for complex sentences