"""
End-to-end tests for Langue.

This package contains end-to-end tests that verify the full functionality
of the Langue application, including activities, database storage, and user tracking.
"""

# Import test runner for easy access
from tests.end_to_end.test_runner import run_all_tests

__all__ = ["run_all_tests"]
