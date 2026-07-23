"""
Test Tools Package for Langue.

This package provides utilities for testing the Langue application,
including test runners, dependency management, and test configuration.
"""

from pathlib import Path

# Path to test utility scripts
TEST_TOOLS_DIR = Path(__file__).parent

# Export test utility functions
__all__ = [
    'ensure_test_deps',
]
