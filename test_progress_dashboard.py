#!/usr/bin/env python
"""
Test script for the progress dashboard visualization in Langue.
This script creates a mock database with sample data and renders the progress dashboard.
"""

import os
import sys
from datetime import datetime, timedelta
import random
import sqlite3
import json
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent))

# Import Langue modules
from langue.storage.database import DatabaseManager
from langue.user.profile import UserProfile, UserProfileManager
from langue.activities.base import console, SYNTHWAVE_THEME

# Import the show_progress function
from langue.main import show_progress

class MockContext:
    """Mock Click context object for testing."""
    def __init__(self):
        self.obj = {}

def create_test_db():
    """Create a test database with sample data."""
    # Create temporary db path
    db_path = Path("test_progress.db")
    if db_path.exists():
        os.remove(db_path)

    # Initialize database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Create tables
    conn.executescript("""
        CREATE TABLE users (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            current_language TEXT NOT NULL,
            current_level TEXT NOT NULL,
            points INTEGER NOT NULL DEFAULT 0,
            streak_days INTEGER NOT NULL DEFAULT 0,
            last_active TEXT NOT NULL,
            created_at TEXT NOT NULL,
            metadata TEXT
        );

        CREATE TABLE languages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            language TEXT NOT NULL,
            word_count INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            UNIQUE(user_id, language)
        );

        CREATE TABLE words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            language TEXT NOT NULL,
            word TEXT NOT NULL,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            exposures INTEGER NOT NULL DEFAULT 1,
            level TEXT,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            UNIQUE(user_id, language, word)
        );

        CREATE TABLE activities (
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
        );

        CREATE TABLE achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            achievement TEXT NOT NULL,
            earned_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            UNIQUE(user_id, achievement)
        );

        CREATE TABLE flashcard_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            language TEXT NOT NULL,
            word TEXT NOT NULL,
            translation TEXT NOT NULL,
            user_answer TEXT,
            score INTEGER NOT NULL DEFAULT 0,
            correct BOOLEAN NOT NULL DEFAULT 0,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );
    """)

    # Insert sample user
    user_id = "test_user"
    now = datetime.now()

    conn.execute(
        """
        INSERT INTO users (
            user_id, username, current_language, current_level,
            points, streak_days, last_active, created_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, "Test User", "Spanish", "b1", 1250, 14,
         now.isoformat(), (now - timedelta(days=30)).isoformat(), None)
    )

    # Insert languages
    languages = {
        "Spanish": 320,
        "French": 150,
        "German": 75
    }

    for language, word_count in languages.items():
        conn.execute(
            """
            INSERT INTO languages (user_id, language, word_count)
            VALUES (?, ?, ?)
            """,
            (user_id, language, word_count)
        )

    # Insert activities
    activity_types = ["flashcards", "fill_blank", "reading", "translation", "chat"]

    # Generate activities over the past 30 days
    for day in range(30):
        activity_date = now - timedelta(days=day)

        # Random number of activities per day (0-3)
        num_activities = random.randint(0, 3)

        # Skip some days to create gaps in the streak
        if day > 14 and random.random() < 0.3:
            continue

        for _ in range(num_activities):
            activity_type = random.choice(activity_types)
            language = random.choice(list(languages.keys()))
            points = random.randint(10, 50)
            words = random.randint(5, 20)
            duration = random.randint(120, 600)

            conn.execute(
                """
                INSERT INTO activities (
                    user_id, activity_type, language, points_earned,
                    words_count, duration_seconds, completed_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, activity_type, language, points, words, duration,
                 activity_date.isoformat(), None)
            )

    # Insert achievements
    achievements = [
        "Earned 100 points",
        "Earned 500 points",
        "Earned 1000 points",
        "3-day streak",
        "7-day streak",
        "Completed flashcards",
        "Completed fill-in-the-blank",
        "Had a conversation",
        "Learned 50 words"
    ]

    for achievement in achievements:
        earned_at = now - timedelta(days=random.randint(0, 30))
        conn.execute(
            """
            INSERT INTO achievements (user_id, achievement, earned_at)
            VALUES (?, ?, ?)
            """,
            (user_id, achievement, earned_at.isoformat())
        )

    # Insert flashcard history
    spanish_words = [
        "hola", "gracias", "adiós", "casa", "trabajo", "tiempo", "día", "noche",
        "comida", "agua", "libro", "amigo", "coche", "ciudad", "país"
    ]

    # Generate flashcard attempts with varying scores
    for day in range(20):
        attempt_date = now - timedelta(days=day)

        # Random number of flashcard attempts per day
        num_attempts = random.randint(0, 10)

        for _ in range(num_attempts):
            word = random.choice(spanish_words)
            translation = f"Translation of {word}"
            user_answer = translation if random.random() < 0.7 else f"Wrong {word}"
            score = random.randint(1, 10)
            correct = score >= 7

            conn.execute(
                """
                INSERT INTO flashcard_history (
                    user_id, language, word, translation, user_answer,
                    score, correct, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, "Spanish", word, translation, user_answer,
                 score, correct, attempt_date.isoformat())
            )

    conn.commit()
    conn.close()

    return db_path

def mock_user_profile():
    """Create a mock user profile."""
    user = UserProfile(
        user_id="test_user",
        username="Test User",
        languages=["Spanish", "French", "German"],
        current_language="Spanish",
        current_level="b1",
        word_count={"Spanish": 320, "French": 150, "German": 75},
        language_levels={"Spanish": "b1", "French": "a2", "German": "a1"},
        points=1250,
        streak_days=14,
        last_active=datetime.now(),
        achievements=[
            "Earned 100 points",
            "Earned 500 points",
            "Earned 1000 points",
            "3-day streak",
            "7-day streak",
            "Completed flashcards",
            "Completed fill-in-the-blank",
            "Had a conversation",
            "Learned 50 words"
        ]
    )
    return user

def main():
    """Run the progress dashboard test."""
    # Create test database
    db_path = create_test_db()
    print(f"Created test database at {db_path}")

    # Create database manager
    db_manager = DatabaseManager()
    # Monkey-patch the get_db_path method for testing
    db_manager.get_db_path = lambda: db_path

    # Create mock user profile and user manager
    user = mock_user_profile()
    user_manager = UserProfileManager()
    user_manager._current_user = user

    # Create mock context
    ctx = MockContext()
    ctx.obj["db_manager"] = db_manager
    ctx.obj["user_manager"] = user_manager

    # Show the progress dashboard
    print("\nShowing progress dashboard...\n")
    console.print(f"[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ】[/bold {SYNTHWAVE_THEME['secondary']}]")

    try:
        show_progress(ctx)
    except Exception as e:
        print(f"Error showing progress dashboard: {e}")

    # Clean up
    if db_path.exists():
        os.remove(db_path)
        print(f"\nRemoved test database at {db_path}")

if __name__ == "__main__":
    main()
