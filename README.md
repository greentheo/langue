# Langue

> **Read, write and speak a language correctly — at real levels, a few minutes
> a day, without tricks.** Why and how: [docs/vision.md](docs/vision.md) ·
> what's next: [docs/ROADMAP.md](docs/ROADMAP.md).

Langue is a small, invite-only language-learning web app for family and
friends. Its course teaches Italian, Spanish, French and Brazilian Portuguese
at A1 and A2 (beginner and elementary), in short daily steps where you type
real answers. The daily steps, with their role-plays and grading, run no AI:
they're plain code. Optional AI tools sit alongside: a tutor at the end of
each lesson page, a conversation partner, some extra exercises (one is graded
by AI) and flashcard explanations.

It's built and run by a small firm of AI agents (a foreman, a night shift, a
reviewer, Socrates and a marketer) and one human owner, who decides what
ships: see [firm/README.md](firm/README.md). The course was written and
reviewed by AI agents, and its mechanics are checked by tests. Native-speaker
checks are still to come ([docs/ROADMAP.md](docs/ROADMAP.md)).

The repo holds two apps that share one vocabulary set:

- **CLI** (`langue/`) — Python, runs in your terminal with a rad 80's-inspired
  interface. Works fully offline against Ollama.
- **Web** (`web/`) — TypeScript/Next.js, styled like an Apple IIe, deployable to
  Railway with invite-only accounts so friends can use it. See
  [web/README.md](web/README.md).

## Languages

The flashcard word lists (below) go from A1 to C2; the guided course is A1–A2.

| Language | Levels | Unique words |
|---|---|---|
| French | A1–C2 | 650 |
| Portuguese | A1–C2 | 636 |
| Spanish | A1–C2 | 632 |
| Italian | A1–C2 | 631 |

Vocabulary lives in `data/flashcard_libraries/<language>/<level>.json`, but
those files are **generated**. Edit the pipe-separated sources in
`data/vocab_sources/<language>/<level>.psv` and rebuild:

```bash
python -m langue.tools.vocab_build            # regenerate JSON from sources
python -m langue.tools.vocab_build --check    # fail if JSON is stale
python -m langue.tools.vocab_validate         # full validation
```

`vocab_validate` enforces the invariants the activities assume but never
checked: schema and category conformance, no duplicate word within a level, no
word at two levels (only the lowest is reachable, so the higher sense would be
invisible), and no library that is really another language mislabelled.

A German library used to exist. It contained ten Spanish words labelled German —
`create_offline_library` falls back to Spanish for any language it does not
recognise — so it was removed rather than left to teach the wrong language.
See issue #27.

## The CLI's features

Everything from here down to Contributing describes the Python CLI
(`langue/`). The web app's guided course is described in
[docs/guided-path.md](docs/guided-path.md), and the web app itself in
[web/README.md](web/README.md).

- Learn multiple languages through a variety of activities
- Supports both online (Claude) and offline (Ollama) language models
- Track your progress with words learned, points, and learning streaks
- Adjustable difficulty per activity (1–5)
- Fully functional offline with local LLMs
- Interactive model selection with automatic detection of local Ollama models
- Stylish retro UI with arrow key navigation and synthwave colors

## The CLI's activities

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

### Install from source

```bash
git clone https://github.com/greentheo/langue.git
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

- Adjust learning preferences and activity settings
- Customize your learning experience

### Model Selection

At every start, Langue uses Claude when `ANTHROPIC_API_KEY` is set (from the environment or `.env`). Otherwise it looks for local Ollama models, and asks you to pick one if the configured model isn't installed:

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
- If no model is available, the activity stops with a model error that says how to fix it. Fake canned responses appear only if you set `LANGUE_ALLOW_MOCK=1`, and then with a loud warning

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

Set them as environment variables or in a `.env` file. Langue never writes a key to its configuration file (it blanks `api_key` on every save):

```bash
# Environment variable setup
export ANTHROPIC_API_KEY=your_key_here
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