#!/usr/bin/env python
"""
Direct Level Setting Tool for Langue

This utility allows you to directly set the level for a user,
bypassing the UI. This is useful for debugging level selection issues.
"""

import argparse
import json
import os
from pathlib import Path
import sys


def get_user_profile_path():
    """Find the user profile JSON file."""
    # Check common locations
    paths = [
        Path("~/.local/share/langue/user.json").expanduser(),
        Path("./user.json"),
    ]

    for path in paths:
        if path.exists():
            return path

    return None


def load_user_profile(path):
    """Load the user profile from a JSON file."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading user profile: {e}")
        return None


def save_user_profile(path, user_data):
    """Save the user profile to a JSON file."""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(user_data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving user profile: {e}")
        return False


def set_user_level(level, language=None):
    """Set the user's level for a specific language."""
    # Find the user profile
    profile_path = get_user_profile_path()
    if not profile_path:
        print("Error: User profile not found!")
        return False

    # Load the profile
    user_data = load_user_profile(profile_path)
    if not user_data:
        return False

    # Get the current language or use the specified one
    current_lang = language or user_data.get('current_language')
    if not current_lang:
        print("Error: No language specified and no current_language in profile")
        return False

    # Make level lowercase for consistency
    level = level.lower()

    # Print previous settings
    print(f"Previous settings:")
    print(f"  current_level: {user_data.get('current_level', 'N/A')}")
    print(f"  language_levels[{current_lang}]: {user_data.get('language_levels', {}).get(current_lang, 'N/A')}")

    # Update the level
    old_level = user_data.get('current_level')
    user_data['current_level'] = level
    print(f"Set current_level from {old_level} to {level}")

    # Ensure language_levels exists
    if 'language_levels' not in user_data:
        user_data['language_levels'] = {}

    # Update the language level
    old_lang_level = user_data['language_levels'].get(current_lang)
    user_data['language_levels'][current_lang] = level
    print(f"Set language_levels[{current_lang}] from {old_lang_level} to {level}")

    # Save the updated profile
    if save_user_profile(profile_path, user_data):
        print(f"Successfully updated level to {level} for {current_lang}")
        print(f"Profile saved to {profile_path}")
        return True
    else:
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Set the user's level in Langue")
    parser.add_argument('level', choices=['a1', 'a2', 'b1', 'b2', 'c1', 'c2'],
                        help='The CEFR level to set (a1-c2)')
    parser.add_argument('--language', '-l', help='The language to set the level for (defaults to current)')
    args = parser.parse_args()

    if set_user_level(args.level, args.language):
        print("Level set successfully.")
    else:
        print("Failed to set level.")
        sys.exit(1)


if __name__ == "__main__":
    main()
