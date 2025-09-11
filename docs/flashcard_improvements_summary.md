# Flashcard System Improvements

## Overview

This document summarizes the improvements made to the flashcard system in Langue, including multiple translation handling, weighted word selection, and language proficiency level integration.

## Multiple Translation Handling

### Problem
Many words have multiple valid translations. Previously, the system only recognized the first translation as correct, leading to frustration when users provided alternate valid translations.

### Solution
1. **Enhanced Storage**: Modified the system to store all translations for each word
   ```python
   # Store all translations in the content
   "all_translations": translations,  # List of all valid translations
   ```

2. **Improved Display**: Updated the flashcard display to show all accepted translations
   ```python
   # Display all possible translations
   translations_text = ", ".join(all_translations)
   table.add_row("Correct Translation(s)", translations_text)
   ```

3. **Smarter Evaluation**: Enhanced the evaluation function to check against all valid translations
   ```python
   # Send all translations to the evaluation function
   is_correct, feedback, score = evaluate_answer(self.model, word, all_translations, user_answer)
   ```

4. **Better Prompting**: Updated the evaluation prompt to be more generous
   ```python
   "If the user's provided translation matches any of the correct translations exactly, give it a 10. "
   "Be very generous with scoring - it's better to reward partial understanding than to be strict. "
   ```

## Weighted Selection Algorithm

### Problem
The original random selection approach gave equal weight to all words, regardless of user performance, resulting in sub-optimal learning efficiency.

### Solution
Implemented a weighted selection algorithm that:

1. Tracks historical performance for each word
2. Calculates weights inversely proportional to previous scores
3. Gives higher weights to words with lower scores (more difficult words)
4. Uses these weights for random selection, ensuring challenging words appear more frequently

```python
def _calculate_word_weights(self, library_words: List[Dict[str, Any]]) -> Dict[int, float]:
    """Calculate weights for words based on historical performance."""
    word_weights = {}
    for i, word_data in enumerate(library_words):
        word = word_data.get("word", "").lower()
        attempts = self.flashcard_history.get_attempts(word)
        
        if attempts:
            # Calculate average score (1-10)
            avg_score = sum(a.score for a in attempts) / len(attempts)
            # Invert score: lower scores get higher weights
            weight = 11.0 - avg_score
            # Square the weight to make poor performance even more likely to be selected
            weight = weight ** 2
        else:
            # New words get slightly higher than default weight
            weight = 1.5
            
        word_weights[i] = weight
    return word_weights
```

## Language Level Integration

### Problem
Users needed the ability to select their language proficiency level (A1-C2) and have activities reflect that level.

### Solution

1. **User Profile Enhancement**: Added level tracking to the user profile
   ```python
   self.current_level = current_level
   self.language_levels = language_levels or {lang: "a1" for lang in self.languages}
   ```

2. **Menu Integration**: Added "Change Language or Level" option to main menu
   ```
   【﻿ＣＨＡＮＧＥ　ＬＡＮＧＵＡＧＥ　ＯＲ　ＬＥＶＥＬ】
   
   What would you like to change?
   ❯ Language
     Level
   ```

3. **Level Selection UI**: Created dedicated level selection interface
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

4. **Activity Integration**: Updated all activities to accept and use level parameter
   ```python
   def __init__(self, language: str, difficulty: int = 1, model_name: Optional[str] = None,
                topic: Optional[str] = None, user_id: Optional[str] = "default_user",
                level: Optional[str] = None):
       # ...
       self.level = level or self._get_level_from_difficulty(difficulty)
   ```

5. **UI Enhancements**: Updated activity UI to display the current level
   ```python
   # Display activity settings
   console.print(f"Language: [cyan]{user.current_language}[/cyan]")
   console.print(f"Difficulty: [cyan]{difficulty}[/cyan]")
   console.print(f"Level: [cyan]{level.upper()}[/cyan]")
   ```

## Test Fixes

Updated tests to accommodate these new features:

1. Modified `test_generate_content` to be more flexible about expected content
2. Added tests for multiple translation handling
3. Enhanced mock libraries for testing with multiple translations
4. Fixed word count tracking in end-to-end tests

## Benefits

1. **Improved User Experience**: Users receive credit for any valid translation
2. **More Efficient Learning**: Challenging words appear more frequently
3. **Personalized Learning**: Content appropriate to user's proficiency level
4. **Better Feedback**: More generous scoring and comprehensive feedback
5. **Level Progression**: Clear path for advancing through proficiency levels

## Future Enhancements

1. **Contextual Translation**: Consider sentence context when evaluating translations
2. **Adaptive Difficulty**: Automatically adjust level based on user performance
3. **Progress Visualization**: Show progress within and between levels
4. **Level-Based Goals**: Set achievement goals for each proficiency level
5. **Export/Import**: Allow users to export/import vocabulary for specific levels