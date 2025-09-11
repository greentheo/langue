# Flashcard Library System Design Specification

## Overview

This document outlines the design and implementation of a configurable flashcard library system for Langue. The system will pre-set vocabulary by language learning level, providing better control over the content presented to language learners.

## Goals

1. Create a tool to generate vocabulary libraries organized by language learning level
2. Redesign the flashcard system to use these pre-loaded libraries
3. Continue leveraging LLMs for response accuracy evaluation
4. Design the system to be reusable in future activities

## System Components

### 1. Vocabulary Library Structure

```
langue/
├── data/
│   ├── flashcard_libraries/
│   │   ├── spanish/
│   │   │   ├── a1.json
│   │   │   ├── a2.json
│   │   │   ├── b1.json
│   │   │   ├── b2.json
│   │   │   ├── c1.json
│   │   │   └── c2.json
│   │   ├── french/
│   │   │   ├── a1.json
│   │   │   └── ...
│   │   └── ...
```

#### Library File Format (JSON)

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

A CLI tool to generate vocabulary libraries:

- Configurable number of words
- Selectable language
- Configurable levels (A1-C2)
- Uses LLM to generate appropriate vocabulary
- Saves libraries in JSON format
- Updates existing libraries or creates new ones

### 3. Enhanced Flashcard System

- Integrates with the existing flashcard activity
- Loads vocabulary from the appropriate library based on user's language and level
- Allows for mixed-level practice
- Tracks progress against the pre-set vocabulary
- Continues using LLM for answer evaluation

## Detailed Component Specifications

### 1. Library Generator Tool

#### Command Line Interface

```
usage: langue library [options]

Generate flashcard vocabulary libraries for Langue

options:
  -l, --language LANGUAGE   Target language (e.g., spanish, french)
  -v, --level LEVEL         Language level (a1, a2, b1, b2, c1, c2, or "all")
  -n, --words COUNT         Number of words to generate [default: 100]
  -o, --output DIR          Output directory [default: data/flashcard_libraries]
  -f, --force               Overwrite existing libraries
  -a, --append              Append to existing libraries
  --model MODEL             Specify LLM model to use
  --help                    Show this help message
```

#### Implementation Classes

```python
class VocabularyLibraryGenerator:
    """Generates vocabulary libraries for language learning."""
    
    def __init__(self, model_interface, config):
        """Initialize with a model interface and configuration."""
        self.model = model_interface
        self.config = config
        
    def generate_vocabulary(self, language, level, count):
        """Generate vocabulary for a specific language and level."""
        # Generate words using LLM
        # Format into standardized structure
        # Return word list
        
    def save_library(self, language, level, words, output_dir, mode='create'):
        """Save vocabulary library to disk."""
        # Create output directory if needed
        # Format as JSON
        # Write to file
        
    def generate_all_levels(self, language, count_per_level, output_dir):
        """Generate vocabulary for all levels of a language."""
        # Loop through all levels (A1-C2)
        # Generate and save each level
```

### 2. Flashcard Library Manager

```python
class FlashcardLibraryManager:
    """Manages flashcard vocabulary libraries."""
    
    def __init__(self, library_path='data/flashcard_libraries'):
        """Initialize with path to libraries."""
        self.library_path = library_path
        self.libraries = {}  # Cache for loaded libraries
        
    def get_available_languages(self):
        """Return list of available language libraries."""
        # Scan directory for language folders
        
    def get_available_levels(self, language):
        """Return list of available levels for a language."""
        # Scan language directory for level files
        
    def load_library(self, language, level):
        """Load a specific vocabulary library."""
        # Load from cache or disk
        # Parse JSON
        # Return word list
        
    def get_word_count(self, language, level):
        """Return the number of words in a library."""
        # Get library metadata
        
    def get_word_by_index(self, language, level, index):
        """Get a specific word by index."""
        # Load library if needed
        # Return word at index
        
    def get_random_word(self, language, level):
        """Get a random word from the library."""
        # Load library if needed
        # Return random word
        
    def get_words_by_category(self, language, level, category):
        """Get words filtered by category."""
        # Load library if needed
        # Filter by category
        # Return filtered list
```

### 3. Enhanced Flashcard Activity

```python
class FlashcardActivity:
    """Language learning through flashcards with pre-loaded vocabulary."""
    
    def __init__(self, user_profile, model_interface, config):
        """Initialize with user profile, model, and configuration."""
        self.user = user_profile
        self.model = model_interface
        self.config = config
        self.library_manager = FlashcardLibraryManager()
        self.history = FlashcardHistory(user_profile)
        
    def get_flashcard_options(self):
        """Return options for flashcard practice."""
        # Get available languages
        # Get user's current language
        # Get available levels for language
        # Return formatted options
        
    def select_vocabulary(self, language, levels=None, categories=None):
        """Select vocabulary based on language, levels, and categories."""
        # If levels not specified, use user's current level
        # Load appropriate libraries
        # Filter by categories if specified
        # Return filtered word list
        
    def select_words_for_session(self, word_list, count=10):
        """Select words for a practice session based on history."""
        # Get user history for these words
        # Prioritize words that need review
        # Mix with some new words
        # Return selected words
        
    # Existing methods for presenting flashcards and processing responses
    # would be updated to use the library system
```

## Implementation Plan

### Phase 1: Library Structure and Generator (Week 1)

1. **Day 1-2: Library Structure Design**
   - Finalize JSON schema for vocabulary libraries
   - Create directory structure for storing libraries
   - Design prompt templates for LLM vocabulary generation

2. **Day 3-5: Library Generator Implementation**
   - Implement `VocabularyLibraryGenerator` class
   - Create CLI interface for the generator tool
   - Implement LLM-based vocabulary generation
   - Add library file creation and management
   - Write tests for the generator

### Phase 2: Library Manager and Integration (Week 2)

1. **Day 1-2: Library Manager Implementation**
   - Implement `FlashcardLibraryManager` class
   - Create methods for library discovery and loading
   - Add caching for efficient library access
   - Write tests for the library manager

2. **Day 3-5: Flashcard Activity Integration**
   - Update `FlashcardActivity` to use the library manager
   - Modify word selection logic to prioritize based on history
   - Update UI to show level information
   - Enhance progress tracking to show mastery against library words
   - Write tests for the updated flashcard activity

### Phase 3: Testing and Refinement (Week 3)

1. **Day 1-2: System Testing**
   - Test end-to-end workflow from library generation to flashcard usage
   - Verify performance with large libraries
   - Test multi-level and mixed-category sessions

2. **Day 3-4: UI and UX Improvements**
   - Enhance visualization to show progress against library vocabulary
   - Add level-based color coding or icons
   - Improve feedback to reference learning level

3. **Day 5: Documentation and Finalization**
   - Complete documentation for all new components
   - Create examples for common usage patterns
   - Prepare for integration with other activities

## Extension to Other Activities

The library system is designed to be reused in other activities:

1. **Fill-in-the-blank**: Use level-appropriate vocabulary for generating sentences
2. **Reading Comprehension**: Create passages using vocabulary from specific levels
3. **Translation**: Select sentences containing vocabulary from the user's current level
4. **Conversation**: Guide conversations to include level-appropriate vocabulary

## Metrics and Evaluation

To measure the effectiveness of the library system:

1. **Coverage Metrics**:
   - Percentage of library words encountered by the user
   - Percentage of library words mastered

2. **Learning Efficiency**:
   - Average attempts before mastery for words at each level
   - Time spent per word at different levels

3. **User Experience**:
   - Satisfaction with appropriateness of vocabulary difficulty
   - Perceived usefulness of level-based organization

## Future Enhancements

1. **Custom Libraries**: Allow users to create and import custom vocabulary lists
2. **Thematic Libraries**: Add support for topic-based libraries (travel, business, etc.)
3. **Multimedia Support**: Include audio pronunciations and images
4. **Advanced Filtering**: Filter by part of speech, frequency, or other attributes
5. **API Integration**: Allow third-party dictionary or vocabulary APIs

## Conclusion

The proposed flashcard library system will significantly enhance the language learning experience in Langue by providing level-appropriate vocabulary and enabling more structured learning paths. The system is designed to be modular, extensible, and integrates well with the existing application architecture.