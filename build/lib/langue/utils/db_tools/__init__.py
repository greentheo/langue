"""
Database Tools Package for Langue.

This package provides utilities for inspecting and interacting with
the SQLite database used by Langue for persistence.
"""

from pathlib import Path

# Path to database utility scripts
DB_TOOLS_DIR = Path(__file__).parent

# Export command-line scripts
__all__ = [
    'db_inspector',
    'simple_db_view',
    'view_flashcards'
]
