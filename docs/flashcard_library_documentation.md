# Flashcard Library System Documentation

## Overview

The Flashcard Library System is a comprehensive vocabulary management system in Langue that organizes words by language proficiency level (A1-C2). This system provides structured, level-appropriate vocabulary for language learners and enables more efficient learning through intelligent word selection and multiple translation support.

## Components

### 1. Vocabulary Libraries

Structured JSON files containing vocabulary organized by:
- **Language**: Spanish, French, etc.
- **CEFR Level**: A1, A2, B1, B2, C1, C2

#### Library Structure

```
data/flashcard_libraries/
├── spanish/
│   ├── a1.json
│   ├── a2.json
│   └── ...
├── french/
│   ├── a1.json
│   └── ...
└── ...
```

#### Library Format

```json
{
  "metadata": {
    "language": "spanish",
    "level": "a1",
    "version": "1.0",
    "word_count": 100,
    "created_at": "2023-10-15T14:30:00Z",
    "description": "Common A1 level Spanish vocabulary"
  },
  "words": [
    {
      "word": "hola",
      "translations": ["hello", "hi"],
      "examples": ["¡Hola! ¿Cómo estás?"],
      "category": "greetings",
      "difficulty": 1
    },
    // More words...
  ]
}
```

### 1. Library Generator Tool

The `langue library` command allows you to generate vocabulary libraries with or without an AI model:

```bash
# Basic usage
langue library --language spanish --level a1 --words 100

# Generate for all levels of a language
langue library --language french --level all --words 50

# Append new words to existing libraries
langue library --language spanish --level a1 --words 20 --append

# Generate in offline mode (no model required)
langue library --offline --language french --level a1
```

> **Note**: If Ollama is not running or encounters errors, the library generator will automatically switch to offline mode to ensure you can still generate basic vocabulary libraries.

You can also run the library generator directly with Python:

```bash
# Direct execution with Python module
python -m langue.tools.library_generator --offline --language spanish --level a1

# With a specific model
python -m langue.tools.library_generator --language french --level a1 --model llama3
```

Options:
- `-l, --language LANGUAGE` - Target language (e.g., spanish, french)
- `-v, --level LEVEL` - Language level (a1, a2, b1, b2, c1, c2, or "all")
- `-n, --words COUNT` - Number of words to generate [default: 100]
- `-o, --output DIR` - Output directory [default: data/flashcard_libraries]
- `-f, --force` - Overwrite existing libraries
- `-a, --append` - Append to existing libraries
- `--model MODEL` - Specify LLM model to use
- `--offline` - Generate a basic library without using an AI model (works without Ollama or internet)
- `-o, --output DIR` - Custom output directory for libraries

The library generator supports both the newer OpenAI-compatible API (`/v1/chat/completions`) and the legacy Ollama API (`/api/generate`), automatically detecting which is available.

### 3. Library Manager

The `FlashcardLibraryManager` class handles all library operations:
- Discovering available languages and levels
- Loading and caching library data
- Providing access to words by various criteria
- Handling errors and fallbacks

### 4. Multiple Translation Support

The system handles words with multiple valid translations:
- Stores all possible translations in the library
- Displays all valid translations to users
- Evaluates user answers against all translations
- Provides more generous scoring for alternate translations

### 5. Weighted Selection Algorithm

Words are selected based on user performance:
- Difficult words (with lower scores) are prioritized
- Weights are calculated inversely to performance
- New words have slightly higher weights to encourage exploration
- This ensures more efficient vocabulary acquisition

## User Interface

### 1. Language Level Selection

Access through the main menu:
```
【﻿ＣＨＡＮＧＥ　ＬＡＮＧＵＡＧＥ　ＯＲ　ＬＥＶＥＬ】

What would you like to change?
❯ Language
  Level
```

Select a proficiency level:
```
【﻿ＳＥＬＥＣＴ　Ａ　ＬＥＶＥＬ】

Current language: Spanish • Current level: A1

Select a learning level:
❯ A1 (Beginner)
  A2 (Elementary)
  B1 (Intermediate)
  B2 (Upper Intermediate)
  C1 (Advanced)
  C2 (Proficiency)
```

### 2. Flashcard Display

Flashcards show all valid translations:
```
┌─────────────────────┬────────────────────────────────────────────────┐
│ Word                │ bonjour                                        │
│ Your Translation    │ hi                                             │
│ Correct Translation(s) │ hello, hi, good morning                        │
│ Example             │ Bonjour, comment allez-vous?                   │
│ Notes               │ Category: greetings • Level: A1                │
└─────────────────────┴────────────────────────────────────────────────┘
```

## Integration with Learning Activities

### 1. Flashcard Activity

The flashcard activity has been enhanced to:
- Use vocabulary from the appropriate library based on language and level
- Prioritize words that need practice based on historical performance
- Display all valid translations to users
- Evaluate answers against all possible translations
- Provide more generous scoring for valid alternate translations

### 2. Other Activities

Other activities can use the vocabulary libraries to:
- Generate level-appropriate content
- Focus on vocabulary from the user's current level
- Ensure consistent vocabulary exposure across activities

## Technical Implementation

### 1. User Profile Enhancement

The `UserProfile` class has been updated to track language levels:
```python
class UserProfile:
    # ...
    current_level: str = "a1"  # Current CEFR level
    language_levels: Dict[str, str]  # Maps languages to their levels
    # ...
```

### 2. Activity Base Class Updates

All activities have been updated to support level-based content:
```python
class Activity:
    # ...
    def __init__(self, language: str, difficulty: int = 1, 
                 model_name: Optional[str] = None, 
                 level: Optional[str] = None):
        # ...
        self.level = level or self._get_level_from_difficulty(difficulty)
    # ...
```

### 3. Library Management

The library system handles file operations and data access:
```python
class FlashcardLibraryManager:
    # ...
    def load_library(self, language: str, level: str) -> Dict[str, Any]:
        # Load from cache or disk
        # ...
    
    def get_random_word(self, language: str, level: str) -> Dict[str, Any]:
        # Get a random word with proper error handling
        # ...
    # ...
```

## Best Practices

1. **Level Selection**: Choose a level appropriate to your current proficiency.
2. **Library Generation**: Generate comprehensive libraries for languages you're studying.
3. **Multiple Translations**: Provide any valid translation when answering.
4. **Regular Updates**: Periodically generate new vocabulary to expand your libraries.
5. **Custom Content**: Use the append option to add specialized vocabulary.
6. **Offline Mode**: Use the `--offline` flag when you don't have a model available or are in an environment without internet access.
7. **Direct Execution**: For development or troubleshooting, run the generator directly with Python (`python -m langue.tools.library_generator`).
8. **API Compatibility**: The system works with both the newer OpenAI-compatible Ollama API and the legacy API.
9. **Automatic Fallback**: If Ollama is not running or encounters errors, the system will automatically switch to offline mode.

## Future Enhancements

1. **Multimedia Support**: Add audio pronunciations and images.
2. **Custom Libraries**: User interface for creating custom vocabulary lists.
3. **Thematic Libraries**: Support for topic-based libraries (travel, business, etc.).
4. **Advanced Filtering**: Filter by part of speech, frequency, or other attributes.
5. **API Integration**: Allow third-party dictionary or vocabulary APIs.
6. **Spaced Repetition**: More advanced algorithms based on forgetting curves.