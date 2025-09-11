"""
Storage module for Langue.

This module provides functionality for data persistence, including database operations
and file-based storage.
"""

from langue.storage.database import DatabaseManager, initialize_database, get_db_path

# Import these lazily to avoid circular imports
__all__ = [
    "DatabaseManager", "initialize_database", "get_db_path", "get_db_manager",
    "save_activity_results", "get_user_profile", "save_user_profile",
    "update_user_streak", "get_user_stats", "get_recent_activities",
    "get_vocabulary_list", "migrate_user_data", "initialize_db_from_config"
]

# Provide accessor functions to avoid circular imports
def save_activity_results(*args, **kwargs):
    from langue.storage.integration import save_activity_results as func
    return func(*args, **kwargs)

def get_user_profile(*args, **kwargs):
    from langue.storage.integration import get_user_profile as func
    return func(*args, **kwargs)

def save_user_profile(*args, **kwargs):
    from langue.storage.integration import save_user_profile as func
    return func(*args, **kwargs)

def update_user_streak(*args, **kwargs):
    from langue.storage.integration import update_user_streak as func
    return func(*args, **kwargs)

def get_user_stats(*args, **kwargs):
    from langue.storage.integration import get_user_stats as func
    return func(*args, **kwargs)

def get_recent_activities(*args, **kwargs):
    from langue.storage.integration import get_recent_activities as func
    return func(*args, **kwargs)

def get_vocabulary_list(*args, **kwargs):
    from langue.storage.integration import get_vocabulary_list as func
    return func(*args, **kwargs)

def migrate_user_data(*args, **kwargs):
    from langue.storage.integration import migrate_user_data as func
    return func(*args, **kwargs)

def initialize_db_from_config(*args, **kwargs):
    from langue.storage.integration import initialize_db_from_config as func
    return func(*args, **kwargs)

def get_db_manager():
    """Get a singleton instance of the DatabaseManager.

    Returns:
        DatabaseManager: The database manager instance
    """
    db_manager = DatabaseManager()
    return db_manager
