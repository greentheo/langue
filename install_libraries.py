#!/usr/bin/env python
"""
Flashcard Library Installation Utility

This script copies generated flashcard libraries from the ./data directory
into the installed Langue package for use by the application.
"""

import os
import sys
import shutil
from pathlib import Path
import logging
import argparse

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_source_libraries():
    """Find the source flashcard libraries directory."""
    # Check current directory first
    current_dir = os.getcwd()
    source_path = os.path.join(current_dir, "data", "flashcard_libraries")

    if os.path.exists(source_path):
        logger.info(f"Found source libraries in: {source_path}")
        return source_path

    # Check one level up
    parent_dir = os.path.dirname(current_dir)
    source_path = os.path.join(parent_dir, "data", "flashcard_libraries")

    if os.path.exists(source_path):
        logger.info(f"Found source libraries in: {source_path}")
        return source_path

    logger.error("Could not find source flashcard libraries. Please run from project root.")
    return None

def find_installed_package_path():
    """Find the installed Langue package directory."""
    try:
        import langue
        package_path = os.path.dirname(langue.__file__)
        logger.info(f"Found installed package at: {package_path}")
        return package_path
    except ImportError:
        logger.error("Langue package not found. Please install the package first.")
        return None

def find_target_libraries_path(package_path):
    """Find where to install the libraries in the package."""
    # Check for existing data directory
    target_path = os.path.join(package_path, "data", "flashcard_libraries")

    # Create if it doesn't exist
    os.makedirs(target_path, exist_ok=True)
    logger.info(f"Using target directory: {target_path}")

    return target_path

def copy_libraries(source_path, target_path):
    """Copy all libraries from source to target."""
    # Count for summary
    languages_copied = 0
    libraries_copied = 0

    # Process all language directories
    for language in os.listdir(source_path):
        language_dir = os.path.join(source_path, language)
        if not os.path.isdir(language_dir):
            continue

        # Create target language directory
        target_language_dir = os.path.join(target_path, language)
        os.makedirs(target_language_dir, exist_ok=True)

        # Copy all JSON files (libraries)
        lib_count = 0
        for filename in os.listdir(language_dir):
            if filename.endswith('.json'):
                source_file = os.path.join(language_dir, filename)
                target_file = os.path.join(target_language_dir, filename)

                shutil.copy2(source_file, target_file)
                logger.info(f"Copied: {language}/{filename}")
                lib_count += 1
                libraries_copied += 1

        if lib_count > 0:
            languages_copied += 1

    return languages_copied, libraries_copied

def verify_installation(target_path):
    """Verify the installed libraries can be loaded."""
    try:
        from langue.activities.flashcards.library_manager import FlashcardLibraryManager

        # Initialize with the target path
        manager = FlashcardLibraryManager(library_path=target_path)

        # Get available languages
        languages = manager.get_available_languages()
        logger.info(f"Found {len(languages)} languages in installed libraries: {', '.join(languages)}")

        # Check each language and level
        for language in languages:
            levels = manager.get_available_levels(language)
            logger.info(f"Language {language} has levels: {', '.join(levels)}")

            # Attempt to load one library to verify
            if levels:
                library = manager.load_library(language, levels[0])
                word_count = len(library.get("words", []))
                logger.info(f"Verified library {language}/{levels[0]} with {word_count} words")

        return True
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Install flashcard libraries into the Langue package")
    parser.add_argument('--force', action='store_true', help='Overwrite existing libraries')
    parser.add_argument('--source', help='Custom source directory for libraries')
    parser.add_argument('--target', help='Custom target directory for libraries')
    args = parser.parse_args()

    # Find source libraries
    source_path = args.source or find_source_libraries()
    if not source_path:
        sys.exit(1)

    # Find installed package
    package_path = find_installed_package_path()
    if not package_path:
        sys.exit(1)

    # Find target location
    target_path = args.target or find_target_libraries_path(package_path)

    # Check if target already has libraries and handle force flag
    if os.path.exists(target_path) and os.listdir(target_path) and not args.force:
        logger.warning("Target directory already contains libraries.")
        response = input("Do you want to overwrite existing libraries? (y/n): ")
        if response.lower() != 'y':
            logger.info("Installation cancelled.")
            sys.exit(0)

    # Copy libraries
    languages_copied, libraries_copied = copy_libraries(source_path, target_path)

    # Verify installation
    success = verify_installation(target_path)

    # Report results
    if success:
        logger.info(f"Successfully installed {libraries_copied} libraries for {languages_copied} languages.")
        logger.info(f"Libraries installed at: {target_path}")
        logger.info("You can now use these libraries in the Langue application.")
    else:
        logger.error("Installation completed but verification failed. Libraries might not work correctly.")
        sys.exit(1)

if __name__ == "__main__":
    main()
