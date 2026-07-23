# Flashcards Package

This package provides a modular implementation of the flashcard activity for Langue.

## Overview

The flashcards package breaks down the functionality into specialized components:

- **activity.py**: Main `FlashcardActivity` class that integrates all components
- **history.py**: Classes for tracking flashcard history and attempts
- **evaluation.py**: Functions for evaluating user answers using LLMs
- **visualization.py**: Visualization components for learning progress
- **persistence.py**: Database operations for flashcard history

## Components

### FlashcardActivity

The main activity class that provides the flashcard learning experience.

```python
from langue.activities.flashcards import FlashcardActivity

# Create the activity
activity = FlashcardActivity(
    language="French",
    difficulty=2,
    user_id="user123"
)

# Start the activity
activity.start()
```

Key features:
- Continuous mode (unlimited cards until user quits)
- Intelligent word selection prioritizing items that need review
- LLM-based answer evaluation with detailed feedback
- Progress visualization with performance metrics

### FlashcardHistory

Tracks the history of flashcard attempts and provides performance metrics.

```python
from langue.activities.flashcards.history import FlashcardHistory

# Create a history object
history = FlashcardHistory()

# Add an attempt
history.add_attempt(
    word="bonjour",
    user_answer="hello",
    score=9,
    correct=True
)

# Get performance metrics
avg_score = history.get_average_score("bonjour")
success_rate = history.get_success_rate("bonjour")
```

Key methods:
- `add_attempt()`: Record a flashcard attempt
- `get_words_needing_practice()`: Get words with low scores
- `get_recently_seen_words()`: Get recently seen words
- `get_average_score()`: Get average score for a word
- `get_success_rate()`: Get success rate for a word

### Evaluation

Functions for evaluating user answers using language models.

```python
from langue.activities.flashcards.evaluation import evaluate_answer

# Evaluate a user's answer
is_correct, feedback, score = evaluate_answer(
    model=my_model,
    word="bonjour",
    translation="hello",
    user_answer="hi"
)
```

Features:
- Uses LLM to evaluate answer quality
- Provides detailed, personalized feedback
- Scores answers on a scale from 1-10
- Falls back to string matching if model fails

### Visualization

Functions for visualizing flashcard learning progress.

```python
from langue.activities.flashcards.visualization import create_progress_visualization

# Show visualizations
create_progress_visualization(
    flashcard_history=history,
    words_to_practice=["difficult_word1", "difficult_word2"],
    user_id="user123",
    language="French"
)
```

Features:
- Word mastery progress bars
- Learning trend visualization
- Statistical summary of performance
- Improvement metrics

### Persistence

Functions for loading and saving flashcard data to the database.

```python
from langue.activities.flashcards.persistence import (
    load_flashcard_history,
    save_flashcard_attempt
)

# Load history from database
history = load_flashcard_history(user_id="user123", language="French")

# Save an attempt
save_flashcard_attempt(
    user_id="user123",
    word="bonjour",
    translation="hello",
    user_answer="hi",
    language="French",
    score=7,
    correct=True
)
```

## Database Schema

The flashcard history is stored in the `flashcard_history` table:

```sql
CREATE TABLE flashcard_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    user_answer TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    correct BOOLEAN NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
)
```

## Testing

Each component has dedicated unit tests to ensure functionality.

For testing without database interactions, set the environment variable:

```python
os.environ["LANGUE_TEST_MODE"] = "1"
```

This will prevent database operations and use mocked data instead.

## Usage Flow

1. User is shown a word in the target language
2. User enters their translation
3. System evaluates the answer and provides feedback
4. Progress is tracked and visualized
5. Words that need practice are prioritized for review
6. User can continue indefinitely or type 'quit' to end

## Future Enhancements

- Add support for image-based flashcards
- Implement forgetting curves for optimal review timing
- Add export/import functionality for flashcard data
- Create a more comprehensive dashboard for learning analytics