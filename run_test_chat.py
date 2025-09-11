#!/usr/bin/env python3
"""
Test wrapper for the Chat activity in Langue.

This script provides a convenient way to run tests for the Chat activity.
It ensures that the correct environment variables and Python paths are set
before running the tests.
"""

import os
import sys
import subprocess
from pathlib import Path

# Get the absolute path to the project root
PROJECT_ROOT = Path(__file__).resolve().parent

def setup_environment():
    """Set up the environment for testing."""
    # Add the project root to Python path
    sys.path.insert(0, str(PROJECT_ROOT))

    # Set environment variables if needed
    os.environ["PYTHONPATH"] = str(PROJECT_ROOT)

    # Make sure required packages are installed
    try:
        import rich
        import questionary
        print("Required packages are installed.")
    except ImportError as e:
        print(f"Error: {e}")
        print("Installing missing packages...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "rich", "questionary"])
        print("Packages installed, but you may need to run this script again.")

def run_unit_tests():
    """Run unit tests for the Chat activity."""
    print("Running Chat activity unit tests...")

    # Use unittest to discover and run tests with environment variables
    env = os.environ.copy()
    env["PYTHONPATH"] = str(PROJECT_ROOT)

    result = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", "tests/unit", "-p", "test_chat*.py"],
        cwd=PROJECT_ROOT,
        env=env
    )

    return result.returncode == 0

def run_end_to_end_tests():
    """Run end-to-end tests for the Chat activity."""
    print("Running Chat activity end-to-end tests...")

    # Run the end-to-end tests with environment variables
    env = os.environ.copy()
    env["PYTHONPATH"] = str(PROJECT_ROOT)

    result = subprocess.run(
        [sys.executable, "-m", "unittest", "tests/end_to_end/test_chat.py"],
        cwd=PROJECT_ROOT,
        env=env
    )

    return result.returncode == 0

def run_interactive_test():
    """Run the interactive Chat test."""
    print("Running interactive Chat test...")

    # Run the interactive test script with the --simulate flag and environment variables
    env = os.environ.copy()
    env["PYTHONPATH"] = str(PROJECT_ROOT)

    result = subprocess.run(
        [sys.executable, "test_chat.py", "--simulate"],
        cwd=PROJECT_ROOT,
        env=env
    )

    return result.returncode == 0

def main():
    """Main entry point."""
    # Set up the environment
    setup_environment()

    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description="Run tests for the Chat activity.")
    parser.add_argument("--unit", action="store_true", help="Run unit tests only")
    parser.add_argument("--e2e", action="store_true", help="Run end-to-end tests only")
    parser.add_argument("--interactive", action="store_true", help="Run interactive test only")
    parser.add_argument("--all", action="store_true", help="Run all tests")
    args = parser.parse_args()

    # Default to running all tests if no specific tests are requested
    run_all = args.all or not (args.unit or args.e2e or args.interactive)

    # Track success of tests
    success = True

    # Run requested tests
    if args.unit or run_all:
        unit_success = run_unit_tests()
        success = success and unit_success
        print(f"Unit tests {'passed' if unit_success else 'failed'}")

    if args.e2e or run_all:
        e2e_success = run_end_to_end_tests()
        success = success and e2e_success
        print(f"End-to-end tests {'passed' if e2e_success else 'failed'}")

    if args.interactive or run_all:
        interactive_success = run_interactive_test()
        success = success and interactive_success
        print(f"Interactive test {'passed' if interactive_success else 'failed'}")

    # Return appropriate exit code
    return 0 if success else 1

if __name__ == "__main__":
    print("Langue Chat Activity Test Runner")
    print("================================")
    print(f"Python: {sys.executable}")
    print(f"Project Root: {PROJECT_ROOT}")

    # Ensure we're running from the right directory
    os.chdir(PROJECT_ROOT)

    # Make sure Langue is installed in development mode
    try:
        import langue
        print(f"Langue is installed: Version {getattr(langue, '__version__', 'unknown')}")
    except ImportError:
        print("Langue is not installed. Installing in development mode...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-e", "."])
        print("Langue installed. Restarting script...")
        os.execv(sys.executable, [sys.executable] + sys.argv)

    # Run the main function
    sys.exit(main())
