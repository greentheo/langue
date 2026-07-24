"""
Library Generator Tool for Langue Flashcard System

This module provides tools to generate and manage vocabulary libraries
organized by language and proficiency level (A1-C2).
"""

import os
import json
import re
import click
import logging
import sys
import requests
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

# Fields a normalized flashcard entry may contain. "word" is the display text
# (also used for phrases/units). New optional fields extend words to phrases and
# grammatical units while staying backward-compatible with old libraries.
UNIT_TYPES = ("word", "phrase", "grammar")
BATCH_SIZE = 20  # entries requested per model call, to avoid truncation

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define language levels
LANGUAGE_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]

# Define common categories for vocabulary
COMMON_CATEGORIES = [
    "greetings", "numbers", "family", "food", "travel",
    "shopping", "time", "weather", "work", "education",
    "housing", "leisure", "health", "transportation",
    "technology", "nature", "arts", "sports", "emotions",
    "daily_routines"
]

class VocabularyLibraryGenerator:
    """Generates vocabulary libraries for language learning."""

    def __init__(self, model_interface, config=None):
        """Initialize with a model interface and configuration.

        Args:
            model_interface: Interface to language model for generating vocabulary
            config: Configuration settings for the generator
        """
        self.model = model_interface
        self.config = config or {}
        self.default_output_dir = os.path.join(os.path.dirname(os.path.dirname(
                                  os.path.dirname(os.path.abspath(__file__)))),
                                  "data", "flashcard_libraries")

    def generate_vocabulary(self, language: str, level: str, count: int) -> List[Dict[str, Any]]:
        """Generate vocabulary for a specific language and level.

        Args:
            language: Target language (e.g., "spanish", "french")
            level: Language proficiency level (a1, a2, b1, b2, c1, c2)
            count: Number of words to generate

        Returns:
            List of word dictionaries containing word, translations, examples, etc.
        """
        if level.lower() not in LANGUAGE_LEVELS:
            raise ValueError(f"Invalid level: {level}. Must be one of {LANGUAGE_LEVELS}")

        logger.info(f"Generating {count} {level.upper()} level units for {language}")

        # Generate in batches to avoid truncation, deduping by surface text.
        # Model errors propagate (as ModelError) so the caller can decide whether
        # to fall back to offline content — we never silently fake results here.
        collected: List[Dict[str, Any]] = []
        seen = set()
        max_attempts = (count // BATCH_SIZE) + 3
        attempts = 0
        while len(collected) < count and attempts < max_attempts:
            attempts += 1
            need = min(BATCH_SIZE, count - len(collected))
            prompt = self._create_vocabulary_prompt(language, level, need)
            response = self.model.get_response(
                prompt,
                system_prompt=self._get_system_prompt(),
                temperature=0.7,
                max_tokens=4000,
            )
            try:
                batch = self._parse_vocabulary_response(response)
            except Exception as e:
                logger.warning(f"Skipping unparseable batch ({e})")
                continue
            for entry in batch:
                key = entry.get("word", "").strip().lower()
                if key and key not in seen:
                    seen.add(key)
                    collected.append(entry)
            logger.info(f"{language} {level.upper()}: {len(collected)}/{count} units")

        logger.info(f"Generated {len(collected)} units for {language} {level.upper()}")
        return collected[:count]

    def save_library(self, language: str, level: str, words: List[Dict[str, Any]],
                    output_dir: Optional[str] = None, mode: str = 'create') -> str:
        """Save vocabulary library to disk.

        Args:
            language: Target language
            level: Language proficiency level
            words: List of word dictionaries
            output_dir: Directory to save the library to
            mode: 'create' (new file), 'overwrite', or 'append'

        Returns:
            Path to the saved library file
        """
        output_dir = output_dir or self.default_output_dir
        language_dir = os.path.join(output_dir, language.lower())

        # Create language directory if it doesn't exist
        os.makedirs(language_dir, exist_ok=True)

        # Define file path
        file_path = os.path.join(language_dir, f"{level.lower()}.json")

        # Prepare library data
        library_data = {
            "metadata": {
                "language": language.lower(),
                "level": level.lower(),
                "version": "1.0",
                "word_count": len(words),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "description": f"Common {level.upper()} level {language.capitalize()} vocabulary"
            },
            "words": words
        }

        # Handle different modes
        if mode == 'append' and os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)

                # Update metadata
                existing_data["metadata"]["word_count"] += len(words)
                existing_data["metadata"]["updated_at"] = datetime.now(timezone.utc).isoformat()

                # Append new words, avoiding duplicates
                existing_words = {w["word"].lower() for w in existing_data["words"]}
                for word in words:
                    if word["word"].lower() not in existing_words:
                        existing_data["words"].append(word)
                        existing_words.add(word["word"].lower())

                library_data = existing_data
                logger.info(f"Appending to existing library: {file_path}")
            except Exception as e:
                logger.error(f"Error reading existing library: {e}")
                logger.info(f"Creating new library instead: {file_path}")
        elif mode != 'create' and os.path.exists(file_path):
            logger.info(f"Overwriting existing library: {file_path}")
        else:
            logger.info(f"Creating new library: {file_path}")

        # Write the library to disk
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(library_data, f, ensure_ascii=False, indent=2)

        logger.info(f"Saved library with {len(words)} words to {file_path}")
        return file_path

    def generate_all_levels(self, language: str, count_per_level: int,
                           output_dir: Optional[str] = None, mode: str = 'create') -> List[str]:
        """Generate vocabulary for all levels of a language.

        Args:
            language: Target language
            count_per_level: Number of words to generate per level
            output_dir: Directory to save the libraries to
            mode: Save mode ('create', 'overwrite', or 'append')

        Returns:
            List of paths to the saved library files
        """
        output_dir = output_dir or self.default_output_dir
        saved_files = []

        for level in LANGUAGE_LEVELS:
            try:
                words = self.generate_vocabulary(language, level, count_per_level)
                file_path = self.save_library(language, level, words, output_dir, mode)
                saved_files.append(file_path)
            except Exception as e:
                logger.error(f"Error generating {level} vocabulary for {language}: {e}")

        return saved_files

    def _create_vocabulary_prompt(self, language: str, level: str, count: int) -> str:
        """Create a prompt for generating vocabulary.

        Args:
            language: Target language
            level: Language proficiency level
            count: Number of words to generate

        Returns:
            Prompt string for the language model
        """
        cats = ', '.join(COMMON_CATEGORIES)
        return f"""Generate {count} DISTINCT {level.upper()}-level {language} learning units for flashcards.
Aim for roughly 60% single words, 30% useful phrases/collocations, and 10% grammatical units (a word shown in a common conjugated or inflected form).

Return ONLY a JSON array. Each element must have this structure:
{{
  "word": "the {language} word or phrase exactly as a learner sees it",
  "type": "word" | "phrase" | "grammar",
  "part_of_speech": "noun | verb | adjective | adverb | expression | ...",
  "translations": ["english meaning", "..."],
  "literal": "literal word-for-word gloss (include ONLY if it differs from the natural translation)",
  "breakdown": [{{"text": "component in {language}", "gloss": "english meaning of that component"}}],
  "base_form": "dictionary/base form (include ONLY for type=grammar)",
  "grammar_note": "short note, e.g. 'present tense, 3rd person singular' (include ONLY for type=grammar)",
  "examples": ["one short, natural example sentence in {language}"],
  "example_translations": ["english translation of that example sentence"],
  "category": "one of: {cats}",
  "difficulty": difficulty_number_1_to_5
}}

Rules:
- "breakdown" is REQUIRED for type=phrase and type=grammar (one entry per component word); for single words it may be omitted.
- Always include "example_translations" paired with "examples".
- Keep examples short and appropriate for {level.upper()}.
- No duplicates. Return only the JSON array, no commentary."""

    def _get_system_prompt(self) -> str:
        """Get the system prompt for vocabulary generation."""
        return """You are an expert language educator building flashcard content for
learners at CEFR levels A1-C2. You produce a MIX of learning units, not just
isolated words:
- "word": a single high-frequency word.
- "phrase": a short, useful multi-word expression or collocation learners
  actually encounter (e.g. "I would like", "how much is it").
- "grammar": a word shown in an inflected/conjugated form that illustrates a
  common pattern (e.g. a verb in a frequent tense), with its base form noted.

Level guidance:
- A1: basic everyday words and set phrases; only the most common verb forms.
- A2: personal-information, shopping, travel, and geography words and phrases.
- B1: work/school/travel situations, personal interests, more verb tenses.
- B2: abstract topics, technical discussion, richer collocations.
- C1: idioms, colloquialisms, professional register.
- C2: specialized fields, cultural references, nuanced expressions.

For every unit provide accurate translations, a natural example sentence WITH its
English translation, and — for phrases and grammar units — a component-by-
component gloss so a beginner can see how the parts map to meaning. Return only
the requested JSON, no commentary."""

    def _get_fallback_words(self, language: str, level: str, count: int) -> List[Dict[str, Any]]:
        """Get fallback words when model generation fails.

        Args:
            language: Target language
            level: Language proficiency level
            count: Number of words to return

        Returns:
            List of basic word dictionaries
        """
        # Basic vocabulary for common languages
        basic_words = {
            "spanish": [
                {"word": "hola", "translations": ["hello", "hi"], "examples": ["¡Hola! ¿Cómo estás?"], "category": "greetings", "difficulty": 1},
                {"word": "gracias", "translations": ["thank you", "thanks"], "examples": ["Muchas gracias por tu ayuda."], "category": "greetings", "difficulty": 1},
                {"word": "adiós", "translations": ["goodbye", "bye"], "examples": ["Adiós, hasta mañana."], "category": "greetings", "difficulty": 1},
                {"word": "sí", "translations": ["yes"], "examples": ["Sí, entiendo."], "category": "basics", "difficulty": 1},
                {"word": "no", "translations": ["no"], "examples": ["No, gracias."], "category": "basics", "difficulty": 1}
            ],
            "french": [
                {"word": "bonjour", "translations": ["hello", "good morning", "good day"], "examples": ["Bonjour, comment allez-vous?"], "category": "greetings", "difficulty": 1},
                {"word": "au revoir", "translations": ["goodbye"], "examples": ["Au revoir, à demain!"], "category": "greetings", "difficulty": 1},
                {"word": "merci", "translations": ["thank you", "thanks"], "examples": ["Merci beaucoup pour votre aide."], "category": "greetings", "difficulty": 1},
                {"word": "oui", "translations": ["yes"], "examples": ["Oui, je comprends."], "category": "basics", "difficulty": 1},
                {"word": "non", "translations": ["no"], "examples": ["Non, merci."], "category": "basics", "difficulty": 1}
            ],
            "italian": [
                {"word": "ciao", "translations": ["hello", "hi", "bye"], "examples": ["Ciao, come stai?"], "category": "greetings", "difficulty": 1},
                {"word": "grazie", "translations": ["thank you", "thanks"], "examples": ["Grazie mille per il tuo aiuto."], "category": "greetings", "difficulty": 1},
                {"word": "arrivederci", "translations": ["goodbye"], "examples": ["Arrivederci, a domani."], "category": "greetings", "difficulty": 1},
                {"word": "sì", "translations": ["yes"], "examples": ["Sì, capisco."], "category": "basics", "difficulty": 1},
                {"word": "no", "translations": ["no"], "examples": ["No, grazie."], "category": "basics", "difficulty": 1}
            ],
            "german": [
                {"word": "hallo", "translations": ["hello", "hi"], "examples": ["Hallo, wie geht es dir?"], "category": "greetings", "difficulty": 1},
                {"word": "danke", "translations": ["thank you", "thanks"], "examples": ["Vielen Danke für deine Hilfe."], "category": "greetings", "difficulty": 1},
                {"word": "auf Wiedersehen", "translations": ["goodbye"], "examples": ["Auf Wiedersehen, bis morgen."], "category": "greetings", "difficulty": 1},
                {"word": "ja", "translations": ["yes"], "examples": ["Ja, ich verstehe."], "category": "basics", "difficulty": 1},
                {"word": "nein", "translations": ["no"], "examples": ["Nein, danke."], "category": "basics", "difficulty": 1}
            ]
        }

        # Default to Spanish if language not in our basic set
        language = language.lower()
        words = basic_words.get(language, basic_words["spanish"])

        # Return requested number of words, repeating if necessary
        if len(words) >= count:
            return words[:count]
        else:
            # Repeat words to reach the requested count
            result = []
            while len(result) < count:
                result.extend(words[:min(count - len(result), len(words))])
            return result

    def _parse_vocabulary_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse the vocabulary response from the language model.

        Args:
            response: Response string from the language model

        Returns:
            List of word dictionaries
        """
        text = response.strip()

        # Strip a code fence if present.
        fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if fence:
            text = fence.group(1).strip()

        # Isolate the outermost JSON array.
        start, end = text.find("["), text.rfind("]")
        candidate = text[start:end + 1] if (start != -1 and end > start) else text

        words = None
        # Try as-is, then with a light trailing-comma repair.
        for attempt in (candidate, re.sub(r",\s*([\]}])", r"\1", candidate)):
            try:
                words = json.loads(attempt)
                break
            except json.JSONDecodeError:
                continue

        if words is None:
            raise ValueError("Could not parse model response as a JSON array")
        if not isinstance(words, list):
            raise ValueError("Response is not a list")

        return [self._normalize_entry(w) for w in words if isinstance(w, dict)]

    def _normalize_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Coerce a raw model entry into the canonical flashcard schema.

        Guarantees the required keys and cleans the optional phrase/grammar
        fields; empty optionals are dropped to keep the library JSON tidy.
        """
        e = dict(entry)
        e["word"] = str(e.get("word", "")).strip()
        e["type"] = e["type"] if e.get("type") in UNIT_TYPES else "word"

        for field in ("translations", "examples", "example_translations"):
            value = e.get(field, [])
            if not isinstance(value, list):
                value = [value] if value else []
            e[field] = [str(x).strip() for x in value if str(x).strip()]

        breakdown = []
        raw_breakdown = e.get("breakdown", [])
        if isinstance(raw_breakdown, list):
            for item in raw_breakdown:
                if isinstance(item, dict) and str(item.get("text", "")).strip():
                    breakdown.append({
                        "text": str(item["text"]).strip(),
                        "gloss": str(item.get("gloss", "")).strip(),
                    })
        e["breakdown"] = breakdown

        for field in ("part_of_speech", "literal", "base_form", "grammar_note", "category"):
            if e.get(field) is not None:
                e[field] = str(e[field]).strip()
        if not e.get("category"):
            e["category"] = "basics"

        try:
            e["difficulty"] = max(1, min(5, int(e.get("difficulty", 1))))
        except (ValueError, TypeError):
            e["difficulty"] = 1

        # Drop empty optionals so word entries stay compact.
        for field in ("literal", "base_form", "grammar_note", "breakdown", "example_translations"):
            if not e.get(field):
                e.pop(field, None)

        return e


@click.command()
@click.option('--language', '-l', default=None, help='Target language (e.g., spanish, french)')
@click.option('--level', '-v', default='all', help='Language level (a1, a2, b1, b2, c1, c2, or "all")')
@click.option('--words', '-n', default=100, help='Number of words to generate per level')
@click.option('--output', '-o', default=None, help='Output directory')
@click.option('--force', '-f', is_flag=True, help='Overwrite existing libraries')
@click.option('--append', '-a', is_flag=True, default=True, help='Append to existing libraries')
@click.option('--model', default=None, help='Specify LLM model to use')
@click.option('--offline', is_flag=True, help='Generate a minimal library without using a model')
def library_command(language, level, words, output, force, append, model, offline):
    """Generate flashcard vocabulary libraries for Langue."""

    if offline:
        # Create a mock library with basic words when in offline mode
        click.echo(f"Generating basic {language} library in offline mode")
        create_offline_library(language, level, words, output_dir=output, mode='overwrite' if force else ('append' if append else 'create'))
        return

    # For standalone running
    if output is None:
        # Default output location is in data/flashcard_libraries
        project_root = Path(__file__).parents[3]  # Go up 3 levels from this file
        output = os.path.join(project_root, "data", "flashcard_libraries")
        if not os.path.exists(output):
            os.makedirs(output, exist_ok=True)

    # Load .env so ANTHROPIC_API_KEY is available when run standalone.
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    # Resolve the model: explicit --model wins; otherwise use Claude when an API
    # key is set, else fall back to the local Ollama default. (No hard Ollama
    # gate — availability surfaces as a clear error on first use.)
    if not model:
        if os.environ.get("ANTHROPIC_API_KEY"):
            from langue.models import registry
            model = registry.default_claude_selector()

    from langue.models.model_manager import get_model_interface
    try:
        model_interface = get_model_interface(model_name=model)
    except Exception as e:
        click.echo(f"Could not initialize model '{model or 'ollama (default)'}': {e}")
        click.echo("Switching to offline basic library...")
        create_offline_library(language, level, words, output_dir=output, mode='overwrite' if force else ('append' if append else 'create'))
        return

    click.echo(f"Using model: {getattr(model_interface, 'name', model or 'default')}")

    try:
        # Create generator
        generator = VocabularyLibraryGenerator(model_interface)

        # Generate and save vocabulary
        # Determine mode
        mode = 'overwrite' if force else ('append' if append else 'create')

        try:
            if level.lower() == 'all':
                # Generate all levels
                generator.generate_all_levels(language, words, output, mode)
                click.echo(f"Generated all levels for {language} with {words} words per level")
            else:
                # Generate specific level
                words_data = generator.generate_vocabulary(language, level, words)
                generator.save_library(language, level, words_data, output, mode)
                click.echo(f"Generated {level.upper()} level for {language} with {len(words_data)} words")
            return
        except Exception as e:
            click.echo(f"Error generating vocabulary: {e}")
            click.echo("Switching to offline mode automatically...")
            create_offline_library(language, level, words, output_dir=output, mode='overwrite' if force else ('append' if append else 'create'))
            return
    except Exception as e:
        click.echo(f"Error initializing generator: {e}")
        click.echo("Switching to offline mode automatically...")
        create_offline_library(language, level, words, output_dir=output, mode='overwrite' if force else ('append' if append else 'create'))
        return

    # Default to a small test set of languages if none specified
    if not language:
        languages = ["spanish", "french"]
        for lang in languages:
            # Determine mode
            mode = 'overwrite' if force else ('append' if append else 'create')

            try:
                if level.lower() == 'all':
                    generator.generate_all_levels(lang, words, output, mode)
                    click.echo(f"Generated all levels for {lang} with {words} words per level")
                else:
                    words_data = generator.generate_vocabulary(lang, level, words)
                    generator.save_library(lang, level, words_data, output, mode)
                    click.echo(f"Generated {level.upper()} level for {lang} with {len(words_data)} words")
            except Exception as e:
                click.echo(f"Error generating vocabulary for {lang}: {e}")
                click.echo(f"Switching to offline mode for {lang}...")
                create_offline_library(lang, level, words, output_dir=output, mode='overwrite' if force else ('append' if append else 'create'))


def create_offline_library(language, level, count, output_dir, mode='create'):
    """Create a basic vocabulary library without using a model.

    This function generates a simple library with common words
    when offline mode is enabled.

    Args:
        language: Target language
        level: Language level (or 'all')
        count: Number of words to include
        output_dir: Output directory
        mode: Save mode (create, append, overwrite)
    """
    # Basic vocabulary for common languages
    basic_words = {
        "spanish": [
            {"word": "hola", "translations": ["hello", "hi"], "examples": ["¡Hola! ¿Cómo estás?"], "category": "greetings", "difficulty": 1},
            {"word": "gracias", "translations": ["thank you", "thanks"], "examples": ["Muchas gracias por tu ayuda."], "category": "greetings", "difficulty": 1},
            {"word": "adiós", "translations": ["goodbye", "bye"], "examples": ["Adiós, hasta mañana."], "category": "greetings", "difficulty": 1},
            {"word": "sí", "translations": ["yes"], "examples": ["Sí, entiendo."], "category": "basics", "difficulty": 1},
            {"word": "no", "translations": ["no"], "examples": ["No, gracias."], "category": "basics", "difficulty": 1},
            {"word": "por favor", "translations": ["please"], "examples": ["Por favor, pásame el agua."], "category": "basics", "difficulty": 1},
            {"word": "agua", "translations": ["water"], "examples": ["Quiero un vaso de agua."], "category": "food", "difficulty": 1},
            {"word": "uno", "translations": ["one"], "examples": ["Tengo uno."], "category": "numbers", "difficulty": 1},
            {"word": "dos", "translations": ["two"], "examples": ["Necesito dos boletos."], "category": "numbers", "difficulty": 1},
            {"word": "tres", "translations": ["three"], "examples": ["Hay tres libros en la mesa."], "category": "numbers", "difficulty": 1}
        ],
        "french": [
            {"word": "bonjour", "translations": ["hello", "good morning", "good day"], "examples": ["Bonjour, comment allez-vous?"], "category": "greetings", "difficulty": 1},
            {"word": "au revoir", "translations": ["goodbye"], "examples": ["Au revoir, à demain!"], "category": "greetings", "difficulty": 1},
            {"word": "merci", "translations": ["thank you", "thanks"], "examples": ["Merci beaucoup pour votre aide."], "category": "greetings", "difficulty": 1},
            {"word": "oui", "translations": ["yes"], "examples": ["Oui, je comprends."], "category": "basics", "difficulty": 1},
            {"word": "non", "translations": ["no"], "examples": ["Non, merci."], "category": "basics", "difficulty": 1},
            {"word": "s'il vous plaît", "translations": ["please"], "examples": ["S'il vous plaît, passez-moi l'eau."], "category": "basics", "difficulty": 1},
            {"word": "eau", "translations": ["water"], "examples": ["Je voudrais un verre d'eau."], "category": "food", "difficulty": 1},
            {"word": "un", "translations": ["one"], "examples": ["J'ai un livre."], "category": "numbers", "difficulty": 1},
            {"word": "deux", "translations": ["two"], "examples": ["J'ai besoin de deux billets."], "category": "numbers", "difficulty": 1},
            {"word": "trois", "translations": ["three"], "examples": ["Il y a trois livres sur la table."], "category": "numbers", "difficulty": 1}
        ]
    }

    # Default to Spanish if language not in our basic set
    language = language.lower()
    words = basic_words.get(language, basic_words["spanish"])

    if len(words) > count:
        words = words[:count]

    # Create a generator-like object for saving
    class OfflineGenerator:
        def __init__(self):
            self.default_output_dir = output_dir or os.path.join(os.path.dirname(os.path.dirname(
                                      os.path.dirname(os.path.abspath(__file__)))),
                                      "data", "flashcard_libraries")

        def save_library(self, language, level, words, output_dir, mode='create'):
            output_dir = output_dir or self.default_output_dir
            language_dir = os.path.join(output_dir, language.lower())

            # Create language directory if it doesn't exist
            os.makedirs(language_dir, exist_ok=True)

            # Define file path
            file_path = os.path.join(language_dir, f"{level.lower()}.json")

            # Prepare library data
            library_data = {
                "metadata": {
                    "language": language.lower(),
                    "level": level.lower(),
                    "version": "1.0",
                    "word_count": len(words),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "description": f"Basic {level.upper()} level {language.capitalize()} vocabulary (offline mode)"
                },
                "words": words
            }

            # Handle different modes
            if mode == 'append' and os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)

                    # Update metadata
                    existing_data["metadata"]["word_count"] += len(words)
                    existing_data["metadata"]["updated_at"] = datetime.now(timezone.utc).isoformat()

                    # Append new words, avoiding duplicates
                    existing_words = {w["word"].lower() for w in existing_data["words"]}
                    for word in words:
                        if word["word"].lower() not in existing_words:
                            existing_data["words"].append(word)
                            existing_words.add(word["word"].lower())

                    library_data = existing_data
                    click.echo(f"Appending to existing library: {file_path}")
                except Exception as e:
                    click.echo(f"Error reading existing library: {e}")
                    click.echo(f"Creating new library instead: {file_path}")
            elif mode != 'create' and os.path.exists(file_path):
                click.echo(f"Overwriting existing library: {file_path}")
            else:
                click.echo(f"Creating new library: {file_path}")

            # Write the library to disk
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(library_data, f, ensure_ascii=False, indent=2)

            click.echo(f"Saved library with {len(words)} words to {file_path}")
            return file_path

    # Create the generator and save the library
    generator = OfflineGenerator()

    if level.lower() == 'all':
        levels = ["a1", "a2", "b1", "b2", "c1", "c2"]
        for lvl in levels:
            generator.save_library(language, lvl, words, output_dir, mode)
            click.echo(f"Generated {lvl.upper()} level for {language}")
    else:
        generator.save_library(language, level, words, output_dir, mode)
        click.echo(f"Generated {level.upper()} level for {language} with {len(words)} words")


if __name__ == "__main__":
    try:
        # Allow standalone execution directly with Python
        import sys
        args = sys.argv[1:] if len(sys.argv) > 1 else []
        # If no arguments provided, show help
        if not args:
            click.echo("Langue Library Generator Tool")
            click.echo("\nUsage:")
            click.echo("  python -m langue.tools.library_generator --language spanish --level a1 --words 100")
            click.echo("  python -m langue.tools.library_generator --offline --language french --level all")
            click.echo("\nFor more options:")
            click.echo("  python -m langue.tools.library_generator --help")
            sys.exit(0)
        library_command(args)
    except Exception as e:
        click.echo(f"Error running library command: {e}")
        click.echo("Try running with --offline flag for basic library generation without a model.")
        sys.exit(1)
