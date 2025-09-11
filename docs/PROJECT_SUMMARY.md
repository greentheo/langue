# Langue Project Summary

## Overview

Langue is a command-line language learning application that leverages AI language models (both cloud-based and local) to provide an interactive and engaging language learning experience. The application offers various learning activities, tracks user progress, and adapts to different language proficiency levels.

## Key Features

- **Multiple Learning Activities**: 
  - Flashcards for vocabulary practice with spaced repetition, progress visualization, and performance tracking
  - Level-based vocabulary libraries (A1-C2) for structured learning paths
  - Fill-in-the-blank exercises
  - Reading comprehension
  - Translation practice
  - Conversational chat with adjustable difficulty

- **Flexible Model Support**:
  - Local models via Ollama for offline usage
  - Cloud models (Claude, OpenAI) for enhanced capabilities
  - Automatic model discovery and selection
  - Interactive model selection on startup
  - Language level selection (A1-C2) for proficiency-based learning
  - Environment variable configuration for model preferences

- **Progress Tracking**:
  - Word learning tracking with detailed performance metrics
  - Advanced flashcard history with scoring and visualization
  - Multiple translation support with intelligent evaluation
  - Weighted selection algorithm that prioritizes difficult words
  - Points system with running totals
  - Learning streak tracking
  - Achievement system

- **User-Friendly CLI Interface**:
  - Intuitive menu system
  - Rich text formatting with 80's synthwave theme
  - Easy configuration
  - Styled error handling with informative panels

- **Database Integration**:
  - SQLite database for persistent storage
  - User profile management
  - Activity history tracking

## Technical Architecture

### Core Components

1. **CLI Interface**: Main entry point and menu system built with Click and Rich
2. **Activity Engine**: Framework for different learning activities
   - Modular flashcards system with dedicated components for history, evaluation, visualization, and persistence
   - Vocabulary library system organized by language proficiency level (A1-C2)
3. **Model Interface**: Abstraction layer for working with different AI models
4. **User Profile Manager**: Handles user data and progress tracking with level-based preferences
5. **Storage System**: SQLite database integration for persistence
6. **Configuration Manager**: Handles application settings
7. **Utility Tools**: Database inspection, visualization, and testing utilities
8. **Library Tools**: Vocabulary library generation and management

### Directory Structure

```
langue/
├── langue/                # Main package
│   ├── activities/        # Learning activities
│   │   ├── flashcards/    # Modular flashcard components
│   │   │   ├── activity.py   # Main flashcard activity
│   │   │   ├── history.py    # Flashcard history tracking
│   │   │   ├── evaluation.py # Answer evaluation
│   │   │   ├── visualization.py # Progress visualization
│   │   │   ├── persistence.py   # Database operations
│   │   │   └── library_manager.py # Vocabulary library management
│   ├── cli/               # Command-line interface
│   ├── config/            # Configuration management
│   ├── models/            # AI model interfaces
│   ├── storage/           # Database and persistence
│   ├── tools/             # CLI tools including library generator
│   ├── user/              # User profile management
│   ├── utils/             # Utility functions
│   │   ├── db_tools/      # Database inspection tools
│   │   └── test_tools/    # Testing utilities
│   └── main.py            # Entry point
├── data/                  # Data storage
│   ├── flashcard_libraries/ # Vocabulary libraries organized by language and level
├── docs/                  # Documentation
├── tests/                 # Test suite
│   ├── end_to_end/        # End-to-end tests
│   └── unit/              # Unit tests
├── README.md              # Project documentation
├── setup.py               # Package setup
├── requirements.txt       # Dependencies
├── setup_dev.sh           # Development environment setup (Unix)
├── setup_dev.bat          # Development environment setup (Windows)
├── verify_installation.py # Installation verification
└── run_tests.py           # Test runner
```

## Implementation Status

### Completed

- **Core Framework**: Basic application structure and architecture
- **Activity Implementations**:
  - Flashcards
  - Fill-in-the-blank
  - Reading comprehension
  - Translation exercises
  - Conversational chat
- **Model Integration**:
  - Ollama interface for local models
  - Claude interface for cloud models
  - Interactive model selection system
  - .env and environment variable configuration
- **Database Integration**: SQLite storage for user data and progress
- **Testing Framework**: 
  - Comprehensive end-to-end and unit testing capabilities
  - Mock model interfaces for testing without AI dependencies
  - Error handling test scenarios
  - UI component and styling tests
- **Setup Scripts**: Development environment setup for Unix and Windows
- **Verification Tools**: Installation verification script

## Next Steps

1. **UI Enhancements**:
   - Expand flashcard visualizations to other activities
   - Create comprehensive learning dashboard
   - Further enhance user feedback mechanisms

2. **Model Improvements**:
   - Add caching for model responses
   - Optimize token usage
   - Improve model fallback strategies
   - Add more comprehensive model configuration options

2. **Activity Enhancements**:
   - Expand vocabulary libraries with multimedia content
   - Implement user-created custom libraries
   - Add more advanced learning strategies
   - Expand spaced repetition to other activities
   - Implement forgetting curves for optimal review timing
   - Create more specialized activities

4. **Documentation and Testing**:
   - Create user guide
   - Add developer documentation
   - Document API for extensions
   - Expand test coverage
   - Enhance error handling tests
   - Add more UI component tests

5. **Performance Optimization**:
   - Reduce startup time
   - Optimize database queries
   - Improve model response time

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/langue.git
cd langue

# Set up development environment
./setup_dev.sh  # For Unix/macOS
# OR
setup_dev.bat   # For Windows

# Verify installation
./verify_installation.py

# Run the application
langue
```

### Testing

```bash
# Run all tests
./run_tests.py

# Run specific tests
./run_tests.py --activity flashcards
```

## Project Details

- **Development Status**: Alpha
- **Python Compatibility**: Python 3.10+
- **License**: MIT
- **Dependencies**: Click, Rich, Pydantic, SQLAlchemy, Anthropic, Ollama, python-dotenv