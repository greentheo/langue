# Flashcard Libraries for Langue

This directory contains vocabulary libraries organized by language and CEFR proficiency level (A1-C2).

## Directory Structure

```
flashcard_libraries/
├── spanish/
│   ├── a1.json
│   ├── a2.json
│   ├── b1.json
│   ├── b2.json
│   ├── c1.json
│   └── c2.json
├── french/
│   ├── a1.json
│   └── ...
└── ...
```

## Library Format

Each library is a JSON file with the following structure:

```json
{
  "metadata": {
    "language": "french",
    "level": "a2",
    "version": "1.0",
    "word_count": 100,
    "created_at": "2023-09-10T23:56:26.502746",
    "description": "Common A2 level French vocabulary"
  },
  "words": [
    {
      "word": "bonjour",
      "translations": ["hello", "good morning", "good day"],
      "examples": ["Bonjour, comment allez-vous?"],
      "category": "greetings",
      "difficulty": 1
    },
    // More words...
  ]
}
```

## Using Libraries

These libraries are automatically used by the flashcard activity based on the user's selected language and level. When you run the flashcard activity, the system will:

1. Look for a library matching your language and level
2. Choose words based on your learning history and difficulty settings
3. Create flashcards using those words

## Generating New Libraries

You can generate new vocabulary libraries using the `library` command:

```bash
langue library --language spanish --level a1 --words 100
```

Options:
- `--language` - Target language (e.g., spanish, french)
- `--level` - Language level (a1, a2, b1, b2, c1, c2, or "all")
- `--words` - Number of words to generate per level
- `--model` - Specify LLM model to use (defaults to Claude)

## Installation

If you've generated libraries in your local project, you can install them into the Langue package using the included installation script:

```bash
python install_libraries.py
```

This will ensure the flashcard activity can find and use your generated libraries.

## Troubleshooting

If the flashcard activity isn't finding your libraries:

1. Make sure you've installed them using the installation script
2. Check the language and level settings match your library files
3. Verify the library JSON files are properly formatted

For more help, see the [flashcard system documentation](../../docs/flashcard_library_system.md).