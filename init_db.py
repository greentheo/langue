#!/usr/bin/env python3
"""
Direct database initialization script for Langue.

This script initializes the SQLite database schema for Langue without requiring
the full application to be imported, avoiding potential circular import issues.
"""

import os
import sys
import sqlite3
from pathlib import Path
from datetime import datetime


def get_db_path() -> Path:
    """Get the path to the SQLite database file.

    Returns:
        Path to the database file
    """
    # Check for environment variable override
    custom_data_dir = os.environ.get("LANGUE_DATA_DIR")

    if custom_data_dir:
        data_dir = Path(custom_data_dir)
    else:
        # Default location
        data_dir = Path.home() / ".local" / "share" / "langue"

    # Ensure directory exists
    data_dir.mkdir(parents=True, exist_ok=True)

    return data_dir / "langue.db"


def initialize_database(db_path: Path = None) -> None:
    """Initialize the database schema.

    Args:
        db_path: Optional custom path for the database file
    """
    if db_path is None:
        db_path = get_db_path()

    print(f"Initializing database at: {db_path}")

    # Ensure parent directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")

    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        current_language TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 0,
        last_active TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata TEXT
    )
    ''')

    # Create languages table to track languages for each user
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS languages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, language)
    )
    ''')

    # Create words table to track words encountered by users
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        word TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        exposures INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, language, word)
    )
    ''')

    # Create activities table to log activity history
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        language TEXT NOT NULL,
        points_earned INTEGER NOT NULL DEFAULT 0,
        words_count INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER,
        completed_at TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
    ''')

    # Create achievements table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        achievement TEXT NOT NULL,
        earned_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, achievement)
    )
    ''')

    # Create settings table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, key)
    )
    ''')

    # Create a default user if none exists
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]

    if user_count == 0:
        now = datetime.now().isoformat()
        cursor.execute('''
        INSERT INTO users
        (user_id, username, current_language, points, streak_days, last_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', ('default_user', 'Default User', 'Spanish', 0, 0, now, now))

        # Add default language
        cursor.execute('''
        INSERT INTO languages (user_id, language, word_count)
        VALUES (?, ?, ?)
        ''', ('default_user', 'Spanish', 0))

    conn.commit()
    conn.close()

    print(f"Database initialized successfully at {db_path}")

    # Verify the database was created
    if db_path.exists():
        print(f"Database file exists and has size: {db_path.stat().st_size} bytes")
    else:
        print("ERROR: Database file was not created!")


if __name__ == "__main__":
    # Get custom path from command line argument if provided
    if len(sys.argv) > 1:
        db_path = Path(sys.argv[1])
        initialize_database(db_path)
    else:
        initialize_database()
