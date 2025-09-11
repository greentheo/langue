#!/usr/bin/env python3
# Make script executable
import os
import stat

# Make this script executable
script_path = __file__
if not os.access(script_path, os.X_OK):
    current_mode = os.stat(script_path).st_mode
    os.chmod(script_path, current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
"""
Test runner script for Langue.

This script runs all tests, including unit tests and end-to-end tests,
to verify that the Langue application is working correctly.
"""

import os
import sys
import argparse
import unittest
import subprocess
import importlib.util
from pathlib import Path

# Ensure the langue package is in the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Required packages for tests
REQUIRED_PACKAGES = ["rich", "questionary", "click", "pydantic"]

def check_dependencies():
    """Check if required packages are installed."""
    missing = []
    for package in REQUIRED_PACKAGES:
        spec = importlib.util.find_spec(package)
        if spec is None:
            missing.append(package)

    if missing:
        print(f"Missing required packages: {', '.join(missing)}")
        print("Installing missing packages...")
        for package in missing:
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", package])
                print(f"Successfully installed {package}")
            except subprocess.CalledProcessError:
                print(f"Failed to install {package}. Tests may fail.")
                return False

    return True

# Import end-to-end tests after checking dependencies
from tests.end_to_end.test_runner import run_all_tests


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Run tests for Langue.")
    parser.add_argument(
        "--end-to-end", "-e",
        action="store_true",
        help="Run only end-to-end tests"
    )
    parser.add_argument(
        "--unit", "-u",
        action="store_true",
        help="Run only unit tests"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Increase output verbosity"
    )
    parser.add_argument(
        "--activity",
        type=str,
        choices=["flashcards", "fill_blank", "reading", "chat", "translation", "ui"],
        help="Run tests for a specific activity"
    )
    return parser.parse_args()


def run_unit_tests(verbose=False, activity=None):
    """Run unit tests."""
    print("Running unit tests...")

    # Discover and run tests
    loader = unittest.TestLoader()

    if activity:
        # Run tests for a specific activity
        test_dir = Path(__file__).parent / "tests" / "unit"
        pattern = f"test_{activity}*.py"
    else:
        # Run all unit tests
        test_dir = Path(__file__).parent / "tests" / "unit"
        pattern = "test_*.py"

    try:
        suite = loader.discover(str(test_dir), pattern=pattern)
        runner = unittest.TextTestRunner(verbosity=2 if verbose else 1)
        result = runner.run(suite)
        return result.wasSuccessful()
    except Exception as e:
        print(f"Error running unit tests: {e}")
        return False


def run_e2e_tests(verbose=False, activity=None):
    """Run end-to-end tests."""
    print("Running end-to-end tests...")

    # Import the test module here to avoid potential circular imports
    from tests.end_to_end.test_runner import run_all_tests, FlashcardTest, FillBlankTest, ReadingTest, ChatTest, TranslationTest
    from tests.end_to_end.test_ui import TestUI
    from tests.end_to_end.test_chat import TestChatActivity

    try:
        if activity:
            # Run tests for a specific activity
            suite = unittest.TestSuite()

            if activity == "flashcards":
                suite.addTest(FlashcardTest("test_flashcard_activity"))
            elif activity == "fill_blank":
                suite.addTest(FillBlankTest("test_fill_blank_activity"))
            elif activity == "reading":
                suite.addTest(ReadingTest("test_reading_activity"))
            elif activity == "chat":
                suite.addTest(ChatTest("test_chat_activity"))
                # Add all chat activity tests
                chat_tests = unittest.defaultTestLoader.loadTestsFromTestCase(TestChatActivity)
                suite.addTests(chat_tests)
            elif activity == "translation":
                suite.addTest(TranslationTest("test_translation_activity"))
            elif activity == "ui":
                # Add all UI tests
                ui_tests = unittest.defaultTestLoader.loadTestsFromTestCase(TestUI)
                suite.addTests(ui_tests)

            runner = unittest.TextTestRunner(verbosity=2 if verbose else 1)
            result = runner.run(suite)
            return result.wasSuccessful()
        else:
            # Run all end-to-end tests
            result = run_all_tests()
            return result.wasSuccessful()
    except Exception as e:
        print(f"Error running end-to-end tests: {e}")
        return False


def main():
    """Run tests based on command line arguments."""
    args = parse_args()

    # Check dependencies before running tests
    print("Checking for required dependencies...")
    if not check_dependencies():
        print("Warning: Some dependencies could not be installed. Tests may fail.")

    # Set test mode environment variable
    os.environ["LANGUE_TEST_MODE"] = "1"

    # Check if specific test types are requested
    run_unit = not args.end_to_end or args.unit
    run_e2e = not args.unit or args.end_to_end

    success = True

    if run_unit:
        unit_success = run_unit_tests(args.verbose, args.activity)
        success = success and unit_success

    if run_e2e:
        e2e_success = run_e2e_tests(args.verbose, args.activity)
        success = success and e2e_success

    # Clean up environment variables
    os.environ.pop("LANGUE_TEST_MODE", None)

    # Return status code based on test results
    return 0 if success else 1


if __name__ == "__main__":
    # Check if end-to-end test runner is executable
    test_runner_path = Path(__file__).parent / "tests" / "end_to_end" / "test_runner.py"
    if test_runner_path.exists() and not os.access(test_runner_path, os.X_OK):
        current_mode = os.stat(test_runner_path).st_mode
        os.chmod(test_runner_path, current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    # Check if verification script is executable
    verify_script_path = Path(__file__).parent / "verify_installation.py"
    if verify_script_path.exists() and not os.access(verify_script_path, os.X_OK):
        current_mode = os.stat(verify_script_path).st_mode
        os.chmod(verify_script_path, current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    sys.exit(main())
