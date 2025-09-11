# Flashcard Library System Documentation

## Overview

The Flashcard Library System provides a structured way to organize vocabulary by language proficiency level (A1-C2), allowing for consistent and level-appropriate flashcard content. This system enhances the learning experience by ensuring learners practice vocabulary suitable for their current level of proficiency.

## Components

### 1. Vocabulary Libraries

Structured JSON files containing pre-defined vocabulary organized by:
- Language (e.g., Spanish, French)
- CEFR Proficiency Level (A1, A2, B1, B2, C1, C2)

Libraries are stored in:
```
langue/data/flashcard_libraries/<language>/<level>.json
```

#### Library Format

Each library file has the following structure:

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

### 2. Library Generator Tool

A command-line tool for generating vocabulary libraries using AI language models.

#### Usage

```bash
langue library [options]
```

Options:
- `-l, --language LANGUAGE` - Target language (e.g., spanish, french)
- `-v, --level LEVEL` - Language level (a1, a2, b1, b2, c1, c2, or "all")
- `-n, --words COUNT` - Number of words to generate [default: 100]
- `-o, --output DIR` - Output directory [default: data/flashcard_libraries]
- `-f, --force` - Overwrite existing libraries
- `-a, --append` - Append to existing libraries
- `--model MODEL` - Specify LLM model to use

#### Examples

Generate 100 A1 level Spanish words:
```bash
langue library -l spanish -v a1 -n 100
```

Generate vocabulary for all levels of French:
```bash
langue library -l french -v all -n 50
```

Append 20 more words to existing libraries:
```bash
langue library -l spanish -v a1 -n 20 -a
```

### 3. Library Manager

The `FlashcardLibraryManager` class handles loading and managing vocabulary libraries:

- Discovering available languages and levels
- Loading libraries from disk
- Caching for performance
- Retrieving words by various criteria (random, category, difficulty)

## Integration with Flashcard Activity

The flashcard activity integrates with the library system to:

1. Automatically load vocabulary appropriate for the user's language and level
2. Prioritize words that need practice based on user history
3. Fall back to AI-generated content when libraries are unavailable
4. Track progress against the pre-defined vocabulary set

### Configuration

When starting the flashcard activity, the level is determined by:

1. Explicitly specified level (`--level` parameter)
2. Mapped from difficulty setting (1-5):
   - Difficulty 1 → A1
   - Difficulty 2 → A2
   - Difficulty 3 → B1
   - Difficulty 4 → B2
   - Difficulty 5 → C1

## Adding Custom Libraries

Custom vocabulary libraries can be added manually by:

1. Creating JSON files following the library format
2. Placing them in the appropriate directory structure:
   ```
   langue/data/flashcard_libraries/<language>/<level>.json
   ```

## Technical Implementation

The library system consists of three main Python modules:

1. `library_generator.py` - Generates vocabulary libraries using LLMs
2. `library_manager.py` - Manages access to vocabulary libraries
3. Integration in `activity.py` - Uses libraries in the flashcard activity

### Fallback Mechanism

If a library is unavailable for the user's language/level, the system will:

1. First try to use another available level (if any)
2. Fall back to using the language model to generate vocabulary
3. Provide feedback to the user about the source of content

## Best Practices

1. **Starting a new language**: Generate all levels (A1-C2) with `library -l language -v all`
2. **Regular updates**: Periodically append new words with the `-a` option
3. **Topic focus**: Consider creating separate topic-specific libraries for specialized vocabulary
4. **User feedback**: Track which vocabulary items are most challenging and focus future practice

## Future Enhancements

1. **Multimedia Support**: Add audio pronunciations and images
2. **Custom Libraries**: User interface for creating custom vocabulary lists
3. **Advanced Filtering**: Filter by part of speech, frequency, or other attributes
4. **API Integration**: Allow third-party dictionary or vocabulary APIs
5. **Thematic Libraries**: Support for topic-based libraries (travel, business, etc.)