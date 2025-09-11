# Langue - CLI Language Learning Assistant

Langue is a command-line language learning application powered by AI. Learn languages through interactive exercises and conversations right in your terminal with a rad 80's-inspired interface.

## Features

- Learn multiple languages through a variety of activities
- Supports both online (Claude, ChatGPT) and offline (Ollama) language models
- Track your progress with words learned, points, and learning streaks
- Adjustable difficulty levels from beginner to advanced
- Fully functional offline with local LLMs
- Interactive model selection with automatic detection of available models
- Stylish retro UI with arrow key navigation and synthwave colors

## Activities

- Flashcards for vocabulary practice with level-based libraries (A1-C2)
- Fill-in-the-blank exercises
- Conversation practice with adjustable complexity
- Translation exercises
- Reading comprehension
- And more!

## Installation

### Prerequisites

- Python 3.10 or higher
- For offline usage: [Ollama](https://ollama.ai/) with language models installed
- Required packages: click, rich, pydantic, questionary, and more (automatically installed)

### Install from PyPI

```bash
pip install langue
```

### Install from Source

```bash
git clone https://github.com/yourusername/langue.git
cd langue
pip install -e .
```

## Quick Start

```bash
# Run the application
langue

# Start with a specific language
langue --language spanish

# Launch directly into an activity
langue flashcards --language french

# Generate vocabulary libraries for flashcards
langue library --language spanish --level a1 --words 100
```

## Testing

Langue includes a comprehensive testing framework to ensure everything works correctly:

```bash
# Verify your installation
./verify_installation.py

# Run all tests
./run_tests.py

# Run only end-to-end tests
./run_tests.py --end-to-end

# Run tests for a specific activity
./run_tests.py --activity flashcards
```

Testing ensures:
- All activities work with simulated user behavior
- Points and activity tracking function correctly
- Database storage and retrieval work as expected
- Error handling with graceful fallbacks
- UI styling is consistent with the 80's theme
- Mock models function properly when real models are unavailable

## Configuration

Langue creates a configuration file at `~/.config/langue/config.toml` that you can customize:

- Set your preferred language model (Ollama, Claude, OpenAI)
- Configure API keys for online models
- Adjust learning preferences and activity settings
- Customize your learning experience

### Model Selection

When you first run Langue, it will automatically detect available language models and prompt you to select one:

```
Please select an Ollama model to use:
  1. llama3.2:3b
  2. llama2:latest
  3. qwen2.5-coder:latest
  4. llama3.2:latest
```

You can also configure your preferred model in several ways:

1. **Environment Variables**:
   ```bash
   export OLLAMA_MODEL=llama3.2
   ```

2. **.env File** (create from `.env.template`):
   ```
   OLLAMA_MODEL=llama3.2
   OLLAMA_SERVER=http://localhost:11434
   ```

3. **Settings Menu** within the application:
   ```
   Settings > Change Model
   ```

You can change models at any time, and Langue will verify model availability before starting activities.

- The application will detect available Ollama models on your system
- You can change the model at any time through the Settings menu
- Use the `.env` file to specify a default model (create from `.env.template`)
- Specify `OLLAMA_MODEL=model_name` in your `.env` file for your preferred model
- If models are unavailable, Langue will gracefully fall back to simulated responses

## User Interface

Langue features a stylish, 80's inspired retro interface:

- Synthwave color palette with neon pinks, cyans, and greens
- ASCII art and full-width characters for that authentic retro feel (【ＳＴＹＬＥ】)
- Arrow key navigation for all menus (up/down to select, enter to confirm)
- Interactive selection dialogs for language, model, and activity choices
- Rad retro feedback messages and stylized progress displays
- Error panels with themed borders and fullwidth characters
- Consistent styling across all activities and components

![Langue UI Example](https://via.placeholder.com/600x400?text=Langue+Retro+UI)

## API Keys

For online models, you'll need to set up API keys:

- Claude: Get an API key from [Anthropic](https://www.anthropic.com/)
- OpenAI: Get an API key from [OpenAI](https://platform.openai.com/)

You can set these via the configuration file or environment variables:

```bash
# Environment variable setup
export ANTHROPIC_API_KEY=your_key_here
export OPENAI_API_KEY=your_key_here
export OLLAMA_MODEL=llama3.2     # Specify which Ollama model to use
```

Alternatively, create a `.env` file in the project root (copy from `.env.template`).

### Troubleshooting Models

If you encounter issues with models:

1. Ensure Ollama is installed and running (`ollama serve`)
2. Check available models with `ollama list`
3. Pull required models with `ollama pull llama3.2`
4. Verify API keys for cloud models


## Flashcard Library System

Langue includes a vocabulary library system for organizing flashcards by language proficiency level (A1-C2).

### Generating Vocabulary Libraries

You can generate level-appropriate vocabulary libraries using the library command:

```bash
# Basic usage
langue library --language spanish --level a1 --words 100

# Generate for all levels of a language
langue library --language french --level all --words 50

# Append new words to existing libraries
langue library --language spanish --level a1 --words 20 --append

# Available options
langue library --help
```

Options:
- `-l, --language LANGUAGE` - Target language (e.g., spanish, french)
- `-v, --level LEVEL` - Language level (a1, a2, b1, b2, c1, c2, or "all")
- `-n, --words COUNT` - Number of words to generate [default: 100]
- `-o, --output DIR` - Output directory [default: data/flashcard_libraries]
- `-f, --force` - Overwrite existing libraries
- `-a, --append` - Append to existing libraries
- `--model MODEL` - Specify LLM model to use

Libraries are stored in `data/flashcard_libraries/<language>/<level>.json` and are automatically used by the flashcard activity based on the user's language and level.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

For developers, we provide setup scripts:

```bash
# On Unix/Linux/macOS:
./setup_dev.sh

# On Windows:
setup_dev.bat
```

These scripts will:
1. Create a virtual environment
2. Install all dependencies (including questionary for UI)
3. Set up your database
4. Configure your environment

## License

This project is licensed under the MIT License - see the LICENSE file for details.