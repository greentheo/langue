"""
Library Generator Tool for Langue Flashcard System

This module provides tools to generate and manage vocabulary libraries
organized by language and proficiency level (A1-C2).
"""

import os
import json
import click
import logging
import sys
import requests
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

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

        logger.info(f"Generating {count} {level.upper()} level words for {language}")

        # Create a prompt for the language model
        prompt = self._create_vocabulary_prompt(language, level, count)

        # Generate vocabulary using the model
        try:
            response = self.model.get_response(
                prompt,
                system_prompt=self._get_system_prompt(),
                temperature=0.7,
                max_tokens=4000
            )
            logger.info(f"Successfully received response from model")
        except Exception as e:
            logger.error(f"Error generating vocabulary with model: {e}")
            # Don't raise exception, return a fallback list of basic words
            logger.warning(f"Falling back to basic vocabulary list for {language} {level}")
            return self._get_fallback_words(language, level, count)

        # Parse the response to extract word data
        try:
            words = self._parse_vocabulary_response(response, count)
            logger.info(f"Successfully generated {len(words)} words")

            # If we didn't get enough words, make a follow-up request for the remainder
            if len(words) < count:
                remaining_count = count - len(words)
                logger.info(f"Got {len(words)} words, making follow-up request for {remaining_count} more")

                # Keep track of words we already have to avoid duplicates
                existing_words = {w["word"].lower() for w in words}

                # Create a new prompt that specifically excludes the words we already have
                follow_up_prompt = self._create_follow_up_prompt(language, level, remaining_count, existing_words)

                try:
                    follow_up_response = self.model.get_response(
                        follow_up_prompt,
                        system_prompt=self._get_system_prompt(),
                        temperature=0.8,  # Slightly higher temperature for more variety
                        max_tokens=4000
                    )
                    follow_up_words = self._parse_vocabulary_response(follow_up_response, remaining_count)

                    # Filter out any duplicates that might still appear
                    new_words = []
                    for word in follow_up_words:
                        if word["word"].lower() not in existing_words:
                            new_words.append(word)
                            existing_words.add(word["word"].lower())

                    logger.info(f"Added {len(new_words)} more unique words from follow-up request")
                    words.extend(new_words)
                except Exception as e:
                    logger.error(f"Error in follow-up request: {e}")
                    # If follow-up fails, fall back to basic words for the remainder
                    fallback_words = self._get_fallback_words(language, level, remaining_count*2)
                    for word in fallback_words:
                        if word["word"].lower() not in existing_words and len(words) < count:
                            words.append(word)
                            existing_words.add(word["word"].lower())

            return words
        except Exception as e:
            logger.error(f"Error parsing vocabulary response: {e}")
            logger.debug(f"Raw response: {response}")
            raise

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
                "created_at": datetime.utcnow().isoformat(),
                "description": f"Common {level.upper()} level {language.capitalize()} vocabulary"
            },
            "words": words
        }

        # First, make sure we have no duplicates in the words we're adding
        unique_words = []
        seen_words = set()

        for word in words:
            if word["word"].lower() not in seen_words:
                unique_words.append(word)
                seen_words.add(word["word"].lower())

        if len(unique_words) < len(words):
            logger.warning(f"Removed {len(words) - len(unique_words)} duplicate words from input")

        # Update word list to unique words
        words = unique_words

        # Handle different modes
        if mode == 'append' and os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)

                # Get existing words
                existing_words = {w["word"].lower() for w in existing_data["words"]}

                # Add only new words
                new_words_added = 0
                for word in words:
                    if word["word"].lower() not in existing_words:
                        existing_data["words"].append(word)
                        existing_words.add(word["word"].lower())
                        new_words_added += 1

                # Update metadata
                existing_data["metadata"]["word_count"] = len(existing_data["words"])
                existing_data["metadata"]["updated_at"] = datetime.utcnow().isoformat()

                library_data = existing_data
                logger.info(f"Appending to existing library: {file_path} (added {new_words_added} new words)")
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
        return f"""
        I need a list of EXACTLY {count} vocabulary words for {level.upper()} level {language} language learners. You MUST provide {count} words, no more and no fewer.

        For each word, provide:
        1. The word in {language}
        2. English translations (at least 1, up to 3)
        3. An example sentence using the word in {language}
        4. A category (choose from: {', '.join(COMMON_CATEGORIES)})
        5. A difficulty rating (1-5, where 1 is easiest and 5 is most difficult for this level)

        Your response must be formatted as a valid JSON array where each object has this structure:
        {{
          "word": "word in {language}",
          "translations": ["english1", "english2"],
          "examples": ["example sentence in {language}"],
          "category": "category name",
          "difficulty": difficulty_number
        }}

        IMPORTANT REQUIREMENTS:
        - Generate EXACTLY {count} words total
        - Your response must start with '[' and end with ']'
        - Each word must be unique - no duplicates
        - All fields must be present for each word
        - Ensure proper JSON formatting with no trailing commas
        - The difficulty must be a number between 1-5, not a string
        - Do not include any explanations, markdown code blocks, or non-JSON text
        - If you can't think of enough words, create more - I need exactly {count} words

        Your task is to generate EXACTLY {count} words. This is critical.
        """

    def _create_follow_up_prompt(self, language: str, level: str, count: int, existing_words: set) -> str:
        """Create a follow-up prompt for generating additional vocabulary.

        Args:
            language: Target language
            level: Language proficiency level
            count: Number of additional words to generate
            existing_words: Set of words that have already been generated

        Returns:
            Follow-up prompt string for the language model
        """
        # Create a shortened list of existing words to show as examples
        existing_examples = list(existing_words)[:20]  # Limit to first 20 to keep prompt size reasonable
        existing_examples_str = ", ".join(f'"{word}"' for word in existing_examples)

        return f"""
        I need {count} MORE vocabulary words for {level.upper()} level {language} language learners.

        IMPORTANT: You must generate words that are DIFFERENT from these words I already have:
        {existing_examples_str}{" (and others)" if len(existing_words) > 20 else ""}

        For each word, provide:
        1. The word in {language}
        2. English translations (at least 1, up to 3)
        3. An example sentence using the word in {language}
        4. A category (choose from: {', '.join(COMMON_CATEGORIES)})
        5. A difficulty rating (1-5, where 1 is easiest and 5 is most difficult for this level)

        Your response must be formatted as a valid JSON array where each object has this structure:
        {{
          "word": "word in {language}",
          "translations": ["english1", "english2"],
          "examples": ["example sentence in {language}"],
          "category": "category name",
          "difficulty": difficulty_number
        }}

        REQUIREMENTS:
        - Generate EXACTLY {count} NEW and UNIQUE words that aren't in my list
        - Your response must start with '[' and end with ']'
        - Ensure proper JSON formatting with no trailing commas
        - The difficulty must be a number between 1-5, not a string
        - Do not include any explanations, markdown code blocks, or non-JSON text

        Your task is to generate {count} ADDITIONAL unique words. This is critical.
        """

    def _get_system_prompt(self) -> str:
        """Get the system prompt for vocabulary generation."""
        return """
        You are an expert language educator specializing in vocabulary development.
        Your task is to create appropriate vocabulary lists for language learners
        at different CEFR levels (A1-C2). You are extremely careful about formatting
        valid JSON that can be parsed directly by a Python program.

        Guidelines for each level:
        - A1: Basic, everyday expressions, simple phrases
        - A2: Common expressions related to personal information, shopping, geography
        - B1: Regular work/school situations, travel, personal interests
        - B2: Technical discussions, abstract topics, special interests
        - C1: Complex topics, idioms, colloquialisms, professional contexts
        - C2: Highly specialized fields, cultural references, nuanced expressions

        YOU MUST FOLLOW THESE RULES EXACTLY:
        - Return ONLY a JSON array with EXACTLY the requested number of words
        - Include NO explanatory text, only the JSON array
        - Ensure all word entries are unique, with no duplicates
        - Use proper JSON syntax with double quotes for strings
        - Use numbers (not strings) for numeric values
        - Make sure the JSON is valid and can be parsed by Python's json.loads()
        - Do not include any markdown formatting, code blocks, or backticks
        - Generate the EXACT number of words requested - this is critical
        - Be creative if needed to reach the exact word count requested
        """

    def _get_fallback_words(self, language: str, level: str, count: int) -> List[Dict[str, Any]]:
        """Get fallback words when model generation fails.

        Args:
            language: Target language
            level: Language proficiency level
            count: Number of words to return

        Returns:
            List of basic word dictionaries
        """
        # Basic vocabulary for common languages - expanded with more words to avoid repetition
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
                {"word": "tres", "translations": ["three"], "examples": ["Hay tres libros en la mesa."], "category": "numbers", "difficulty": 1},
                {"word": "cuatro", "translations": ["four"], "examples": ["Tengo cuatro hermanos."], "category": "numbers", "difficulty": 1},
                {"word": "cinco", "translations": ["five"], "examples": ["Hay cinco personas aquí."], "category": "numbers", "difficulty": 1},
                {"word": "casa", "translations": ["house", "home"], "examples": ["Vivo en una casa grande."], "category": "housing", "difficulty": 1},
                {"word": "comer", "translations": ["to eat"], "examples": ["Me gusta comer pasta."], "category": "food", "difficulty": 1},
                {"word": "beber", "translations": ["to drink"], "examples": ["Quiero beber agua."], "category": "food", "difficulty": 1}
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
                {"word": "trois", "translations": ["three"], "examples": ["Il y a trois livres sur la table."], "category": "numbers", "difficulty": 1},
                {"word": "quatre", "translations": ["four"], "examples": ["J'ai quatre frères."], "category": "numbers", "difficulty": 1},
                {"word": "cinq", "translations": ["five"], "examples": ["Il y a cinq personnes ici."], "category": "numbers", "difficulty": 1},
                {"word": "maison", "translations": ["house", "home"], "examples": ["J'habite dans une grande maison."], "category": "housing", "difficulty": 1},
                {"word": "manger", "translations": ["to eat"], "examples": ["J'aime manger des pâtes."], "category": "food", "difficulty": 1},
                {"word": "boire", "translations": ["to drink"], "examples": ["Je veux boire de l'eau."], "category": "food", "difficulty": 1}
            ],
            "italian": [
                {"word": "ciao", "translations": ["hello", "hi", "bye"], "examples": ["Ciao, come stai?"], "category": "greetings", "difficulty": 1},
                {"word": "grazie", "translations": ["thank you", "thanks"], "examples": ["Grazie mille per il tuo aiuto."], "category": "greetings", "difficulty": 1},
                {"word": "arrivederci", "translations": ["goodbye"], "examples": ["Arrivederci, a domani."], "category": "greetings", "difficulty": 1},
                {"word": "sì", "translations": ["yes"], "examples": ["Sì, capisco."], "category": "basics", "difficulty": 1},
                {"word": "no", "translations": ["no"], "examples": ["No, grazie."], "category": "basics", "difficulty": 1},
                {"word": "per favore", "translations": ["please"], "examples": ["Per favore, passami l'acqua."], "category": "basics", "difficulty": 1},
                {"word": "acqua", "translations": ["water"], "examples": ["Vorrei un bicchiere d'acqua."], "category": "food", "difficulty": 1},
                {"word": "uno", "translations": ["one"], "examples": ["Ho un libro."], "category": "numbers", "difficulty": 1},
                {"word": "due", "translations": ["two"], "examples": ["Ho bisogno di due biglietti."], "category": "numbers", "difficulty": 1},
                {"word": "tre", "translations": ["three"], "examples": ["Ci sono tre libri sul tavolo."], "category": "numbers", "difficulty": 1},
                {"word": "quattro", "translations": ["four"], "examples": ["Ho quattro fratelli."], "category": "numbers", "difficulty": 1},
                {"word": "cinque", "translations": ["five"], "examples": ["Ci sono cinque persone qui."], "category": "numbers", "difficulty": 1},
                {"word": "casa", "translations": ["house", "home"], "examples": ["Abito in una grande casa."], "category": "housing", "difficulty": 1},
                {"word": "mangiare", "translations": ["to eat"], "examples": ["Mi piace mangiare la pasta."], "category": "food", "difficulty": 1},
                {"word": "bere", "translations": ["to drink"], "examples": ["Voglio bere dell'acqua."], "category": "food", "difficulty": 1}
            ],
            "german": [
                {"word": "hallo", "translations": ["hello", "hi"], "examples": ["Hallo, wie geht es dir?"], "category": "greetings", "difficulty": 1},
                {"word": "danke", "translations": ["thank you", "thanks"], "examples": ["Vielen Danke für deine Hilfe."], "category": "greetings", "difficulty": 1},
                {"word": "auf Wiedersehen", "translations": ["goodbye"], "examples": ["Auf Wiedersehen, bis morgen."], "category": "greetings", "difficulty": 1},
                {"word": "ja", "translations": ["yes"], "examples": ["Ja, ich verstehe."], "category": "basics", "difficulty": 1},
                {"word": "nein", "translations": ["no"], "examples": ["Nein, danke."], "category": "basics", "difficulty": 1},
                {"word": "bitte", "translations": ["please"], "examples": ["Bitte, gib mir das Wasser."], "category": "basics", "difficulty": 1},
                {"word": "Wasser", "translations": ["water"], "examples": ["Ich möchte ein Glas Wasser."], "category": "food", "difficulty": 1},
                {"word": "eins", "translations": ["one"], "examples": ["Ich habe ein Buch."], "category": "numbers", "difficulty": 1},
                {"word": "zwei", "translations": ["two"], "examples": ["Ich brauche zwei Tickets."], "category": "numbers", "difficulty": 1},
                {"word": "drei", "translations": ["three"], "examples": ["Es gibt drei Bücher auf dem Tisch."], "category": "numbers", "difficulty": 1},
                {"word": "vier", "translations": ["four"], "examples": ["Ich habe vier Brüder."], "category": "numbers", "difficulty": 1},
                {"word": "fünf", "translations": ["five"], "examples": ["Es gibt fünf Personen hier."], "category": "numbers", "difficulty": 1},
                {"word": "Haus", "translations": ["house", "home"], "examples": ["Ich wohne in einem großen Haus."], "category": "housing", "difficulty": 1},
                {"word": "essen", "translations": ["to eat"], "examples": ["Ich mag Nudeln essen."], "category": "food", "difficulty": 1},
                {"word": "trinken", "translations": ["to drink"], "examples": ["Ich möchte Wasser trinken."], "category": "food", "difficulty": 1}
            ]
        }

        # Default to Spanish if language not in our basic set
        language = language.lower()
        words = basic_words.get(language, basic_words["spanish"])

        # Return requested number of words, avoiding repetition
        if len(words) >= count:
            return words[:count]
        else:
            # If we don't have enough words, generate variations with modified difficulties
            # and example sentences to avoid duplicates
            result = words.copy()  # Start with all available words
            variations_needed = count - len(words)

            # Create variations of existing words with different difficulty levels and examples
            word_variations = []
            for i in range(variations_needed):
                base_word = words[i % len(words)]
                variation = base_word.copy()
                # Adjust difficulty (cycling between 1-5)
                variation["difficulty"] = ((base_word["difficulty"] + i) % 5) + 1
                # Modify example slightly to make it unique
                if variation["examples"]:
                    variation["examples"] = [f"{variation['examples'][0]} ({i+1})"]
                word_variations.append(variation)

            # Add variations to result
            result.extend(word_variations)

            logger.warning(f"Not enough unique words for {language} {level}. Created {variations_needed} variations to reach {count} words.")
            return result[:count]

    def _parse_vocabulary_response(self, response: str, count: int = 0) -> List[Dict[str, Any]]:
        """Parse the vocabulary response from the language model.

        Args:
            response: Response string from the language model
            count: Expected number of words (for validation)

        Returns:
            List of word dictionaries
        """
        # Clean up the response to extract just the JSON part
        response = response.strip()

        # Handle various response formats
        if "```json" in response:
            # Extract JSON from code block
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            # Extract from generic code block
            response = response.split("```")[1].split("```")[0].strip()

        # Find JSON array bounds - this helps when models add explanatory text
        try:
            start_idx = response.index('[')
            end_idx = response.rindex(']') + 1
            json_text = response[start_idx:end_idx]
            logger.info(f"Extracted JSON array from response")
        except ValueError:
            # If we can't find brackets, use the whole response
            json_text = response
            logger.warning("Could not locate JSON array bounds, using full response")

        # Fix common JSON formatting issues
        json_text = json_text.replace('\\"', '"')  # Fix escaped quotes
        json_text = json_text.replace('\\n', ' ')  # Replace newlines in strings

        # Try to parse as JSON
        try:
            words = json.loads(json_text)
            logger.info(f"Successfully parsed JSON with {len(words)} entries")

            # Validate the structure
            if not isinstance(words, list):
                logger.error("Response is not a list, attempting to extract list")
                # Try to find a list in the response if the whole thing isn't a list
                for key, value in words.items():
                    if isinstance(value, list) and len(value) > 0:
                        words = value
                        logger.info(f"Found list under key '{key}' with {len(words)} entries")
                        break

                if not isinstance(words, list):
                    raise ValueError("Response does not contain a word list")

            # Validate each word
            validated_words = []
            for word in words:
                if not isinstance(word, dict):
                    logger.warning(f"Skipping non-dictionary entry: {word}")
                    continue

                # Ensure required fields
                required_fields = ["word", "translations", "examples", "category", "difficulty"]
                for field in required_fields:
                    if field not in word:
                        if field in ["translations", "examples"]:
                            word[field] = []
                        elif field == "difficulty":
                            word[field] = 1
                        else:
                            word[field] = ""

                # Ensure lists are lists
                for field in ["translations", "examples"]:
                    if not isinstance(word[field], list):
                        word[field] = [word[field]]

                # Ensure difficulty is an integer between 1 and 5
                try:
                    word["difficulty"] = max(1, min(5, int(word["difficulty"])))
                except (ValueError, TypeError):
                    word["difficulty"] = 1

                # Make sure word has content
                if word["word"].strip():
                    validated_words.append(word)
                else:
                    logger.warning("Skipping entry with empty word field")

            logger.info(f"Validated {len(validated_words)} words out of {len(words)} entries")

            # Check if we got the requested number of words
            if count > 0 and len(validated_words) < count:
                logger.warning(f"Received fewer words than requested: {len(validated_words)} vs {count}")

            return validated_words
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")
            logger.debug(f"Raw response: {json_text}")

            # Last resort attempt - try to manually extract word objects
            try:
                logger.info("Attempting manual JSON extraction as fallback")
                # Try to extract individual word objects and create a valid array
                import re
                word_objects = re.findall(r'\{\s*"word".*?\}', response, re.DOTALL)
                if word_objects:
                    manual_json = "[" + ",".join(word_objects) + "]"
                    words = json.loads(manual_json)
                    logger.info(f"Manual extraction succeeded with {len(words)} words")
                    return words
            except Exception as e2:
                logger.error(f"Manual extraction failed: {e2}")

            raise ValueError(f"Failed to parse model response as JSON: {e}")


@click.command()
@click.option('--language', '-l', default=None, help='Target language (e.g., spanish, french)')
@click.option('--level', '-v', default='all', help='Language level (a1, a2, b1, b2, c1, c2, or "all")')
@click.option('--words', '-n', default=100, help='Number of words to generate per level')
@click.option('--output', '-o', default=None, help='Output directory')
@click.option('--force', '-f', is_flag=True, help='Overwrite existing libraries')
@click.option('--append', '-a', is_flag=True, default=True, help='Append to existing libraries')
@click.option('--model', default='claude:claude-3-haiku-20240307', help='Specify LLM model to use')
@click.option('--offline', is_flag=True, help='Generate a minimal library without using a model')
def library_command(language, level, words, output, force, append, model, offline):
    """Generate flashcard vocabulary libraries for Langue."""

    if offline:
        # Create a mock library with basic words when in offline mode
        click.echo(f"Generating basic {language} library in offline mode")
        create_offline_library(language, level, words, output_dir=output, mode='overwrite' if force else ('append' if append else 'create'))
        return

    # For standalone running
    import os
    from dotenv import load_dotenv

    if output is None:
        # Default output location is in data/flashcard_libraries
        project_root = Path(__file__).parents[3]  # Go up 3 levels from this file
        output = os.path.join(project_root, "data", "flashcard_libraries")
        if not os.path.exists(output):
            os.makedirs(output, exist_ok=True)

    # Check if the API key for Anthropic is available

    # Load API key from .env file
    load_dotenv()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        click.echo("Error: ANTHROPIC_API_KEY not found in environment variables or .env file.")
        click.echo("Please ensure your API key is set properly.")
        click.echo("")
        click.echo("Alternatively, you can generate libraries in offline mode:")
        click.echo("  python -m langue.tools.library_generator --offline --language french --level a1")
        click.echo("")
        click.echo("Switching to offline mode automatically...")
        create_offline_library(language, level, words, output_dir=output, mode='overwrite' if force else ('append' if append else 'create'))
        return

    click.echo(f"Using Claude API for library generation")

    try:
        from langue.models.model_manager import get_model_interface
        # Get model interface
        model_interface = get_model_interface(model_name=model)
    except ImportError:
        # Fallback if model_manager is not available
        from langue.models.claude import ClaudeModelInterface
        click.echo(f"Using Claude Haiku for library generation")
        model_interface = ClaudeModelInterface(model_name="claude-3-haiku-20240307")

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
            {"word": "tres", "translations": ["three"], "examples": ["Hay tres libros en la mesa."], "category": "numbers", "difficulty": 1},
            {"word": "cuatro", "translations": ["four"], "examples": ["Tengo cuatro hermanos."], "category": "numbers", "difficulty": 1},
            {"word": "cinco", "translations": ["five"], "examples": ["Hay cinco personas aquí."], "category": "numbers", "difficulty": 1},
            {"word": "casa", "translations": ["house", "home"], "examples": ["Vivo en una casa grande."], "category": "housing", "difficulty": 1},
            {"word": "comer", "translations": ["to eat"], "examples": ["Me gusta comer pasta."], "category": "food", "difficulty": 1},
            {"word": "beber", "translations": ["to drink"], "examples": ["Quiero beber agua."], "category": "food", "difficulty": 1}
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
            {"word": "trois", "translations": ["three"], "examples": ["Il y a trois livres sur la table."], "category": "numbers", "difficulty": 1},
            {"word": "quatre", "translations": ["four"], "examples": ["J'ai quatre frères."], "category": "numbers", "difficulty": 1},
            {"word": "cinq", "translations": ["five"], "examples": ["Il y a cinq personnes ici."], "category": "numbers", "difficulty": 1},
            {"word": "maison", "translations": ["house", "home"], "examples": ["J'habite dans une grande maison."], "category": "housing", "difficulty": 1},
            {"word": "manger", "translations": ["to eat"], "examples": ["J'aime manger des pâtes."], "category": "food", "difficulty": 1},
            {"word": "boire", "translations": ["to drink"], "examples": ["Je veux boire de l'eau."], "category": "food", "difficulty": 1}
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

            # Create word list with no duplicates
            unique_words = []
            seen_words = set()

            for word in words:
                if word["word"].lower() not in seen_words:
                    unique_words.append(word)
                    seen_words.add(word["word"].lower())

            # Prepare library data
            library_data = {
                "metadata": {
                    "language": language.lower(),
                    "level": level.lower(),
                    "version": "1.0",
                    "word_count": len(unique_words),
                    "created_at": datetime.utcnow().isoformat(),
                    "description": f"Basic {level.upper()} level {language.capitalize()} vocabulary (offline mode)"
                },
                "words": unique_words
            }

            # Handle different modes
            if mode == 'append' and os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)

                    # Get existing words
                    existing_words = {w["word"].lower() for w in existing_data["words"]}

                    # Add only new words
                    new_words_added = 0
                    for word in unique_words:
                        if word["word"].lower() not in existing_words:
                            existing_data["words"].append(word)
                            existing_words.add(word["word"].lower())
                            new_words_added += 1

                    # Update metadata
                    existing_data["metadata"]["word_count"] = len(existing_data["words"])
                    existing_data["metadata"]["updated_at"] = datetime.utcnow().isoformat()

                    library_data = existing_data
                    click.echo(f"Appending to existing library: {file_path} (added {new_words_added} new words)")
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
