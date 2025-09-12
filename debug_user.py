#!/usr/bin/env python
"""
Debug tool for Langue - Inspect user profile

This utility displays the current user's profile information,
focusing on language and level settings.
"""

import argparse
import json
import os
from pathlib import Path
import sys

def get_user_profile():
    """Attempt to load the user profile from multiple locations."""
    # First, try the database file
    db_paths = [
        Path("./data/langue.db"),
        Path("~/.local/share/langue/langue.db").expanduser(),
    ]

    for db_path in db_paths:
        if db_path.exists():
            print(f"Found database at: {db_path}")
            try:
                import sqlite3
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM user_profiles LIMIT 1")
                row = cursor.fetchone()
                if row:
                    print("Found user in database!")
                    return parse_db_user(row, cursor)
            except Exception as e:
                print(f"Error reading database: {e}")

    # Then, try the JSON file
    json_paths = [
        Path("~/.local/share/langue/user.json").expanduser(),
        Path("./user.json"),
    ]

    for json_path in json_paths:
        if json_path.exists():
            print(f"Found user JSON at: {json_path}")
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error reading JSON file: {e}")

    print("No user profile found!")
    return None

def parse_db_user(row, cursor):
    """Parse a user profile from a database row."""
    cursor.execute("PRAGMA table_info(user_profiles)")
    columns = [col[1] for col in cursor.fetchall()]

    user_data = {}
    for i, col in enumerate(columns):
        user_data[col] = row[i]

    # Parse serialized fields
    for field in ['languages', 'word_count', 'language_levels', 'achievements']:
        if field in user_data and isinstance(user_data[field], str):
            try:
                user_data[field] = json.loads(user_data[field])
            except:
                pass

    return user_data

def display_user_info(user_data):
    """Display user profile information."""
    if not user_data:
        print("No user data available.")
        return

    print("\n=== USER PROFILE ===")
    print(f"User ID: {user_data.get('user_id', 'N/A')}")
    print(f"Username: {user_data.get('username', 'N/A')}")

    print("\n=== LANGUAGE SETTINGS ===")
    print(f"Current language: {user_data.get('current_language', 'N/A')}")
    print(f"Current level: {user_data.get('current_level', 'N/A')}")

    if 'language_levels' in user_data and user_data['language_levels']:
        print("\nLanguage Levels:")
        for lang, level in user_data['language_levels'].items():
            print(f"  {lang}: {level}")

    if 'languages' in user_data and user_data['languages']:
        print("\nAvailable Languages:")
        for lang in user_data['languages']:
            print(f"  {lang}")

    if 'word_count' in user_data and user_data['word_count']:
        print("\nWord Counts:")
        for lang, count in user_data['word_count'].items():
            print(f"  {lang}: {count} words")

    print("\n=== RAW DATA ===")
    print(json.dumps(user_data, indent=2))

def main():
    parser = argparse.ArgumentParser(description="Debug Langue user profile")
    parser.add_argument('--fix', action='store_true', help='Attempt to fix inconsistent level settings')
    args = parser.parse_args()

    user_data = get_user_profile()
    display_user_info(user_data)

    if args.fix and user_data:
        try:
            fix_user_profile(user_data)
        except Exception as e:
            print(f"Error fixing profile: {e}")

def fix_user_profile(user_data):
    """Attempt to fix inconsistent level settings."""
    print("\n=== ATTEMPTING TO FIX USER PROFILE ===")

    if not user_data.get('current_language') or not user_data.get('language_levels'):
        print("Cannot fix: missing current_language or language_levels")
        return

    current_lang = user_data['current_language']
    current_level = user_data.get('current_level', 'a1')

    # Make level lowercase for consistency
    if current_level:
        current_level = current_level.lower()

    # Ensure current language has a level
    if current_lang not in user_data['language_levels']:
        print(f"Adding missing level for {current_lang}: {current_level}")
        user_data['language_levels'][current_lang] = current_level

    # Ensure levels are consistent
    if user_data['language_levels'].get(current_lang) != current_level:
        old_level = user_data['language_levels'].get(current_lang)
        print(f"Fixing inconsistent levels: {old_level} vs {current_level}")

        # Ask user which level to keep
        choice = input(f"Keep level from language_levels[{current_lang}]='{old_level}' or current_level='{current_level}'? (1/2): ")

        if choice == '1':
            user_data['current_level'] = old_level
            print(f"Set current_level to {old_level}")
        else:
            user_data['language_levels'][current_lang] = current_level
            print(f"Set language_levels[{current_lang}] to {current_level}")

    # Save fixed profile
    try:
        json_path = Path("~/.local/share/langue/user.json").expanduser()
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(user_data, f, indent=2)
        print(f"Saved fixed profile to {json_path}")
    except Exception as e:
        print(f"Error saving fixed profile: {e}")

if __name__ == "__main__":
    main()
