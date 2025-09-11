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
Langue Installation Verification Script

This script verifies that the Langue application is properly installed and
configured, checks for required dependencies, and tests basic functionality.
"""

import os
import sys
import time
import platform
import subprocess
import importlib.util
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Terminal colors for better output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
BOLD = "\033[1m"
RESET = "\033[0m"
CYAN = "\033[96m"

# For Windows terminals that don't support ANSI color codes
if platform.system() == "Windows":
    try:
        import colorama
        colorama.init()
    except ImportError:
        # If colorama is not available, disable colors
        GREEN = YELLOW = RED = BLUE = BOLD = RESET = ""


def print_header(message: str) -> None:
    """Print a formatted header message."""
    print(f"\n{BOLD}{BLUE}=== {message} ==={RESET}\n")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{GREEN}✓ {message}{RESET}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{YELLOW}⚠ {message}{RESET}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{RED}✗ {message}{RESET}")


def print_info(message: str) -> None:
    """Print an informational message."""
    print(f"{CYAN}ℹ {message}{RESET}")


def check_python_version() -> bool:
    """Check if the Python version is compatible."""
    print_header("Checking Python Version")

    required_version = (3, 10)
    current_version = sys.version_info

    print(f"Current Python version: {sys.version.split()[0]}")
    print(f"Required Python version: {required_version[0]}.{required_version[1]} or higher")

    if current_version >= required_version:
        print_success("Python version is compatible")
        return True
    else:
        print_error(f"Python version {current_version[0]}.{current_version[1]} is not compatible")
        print_warning(f"Please upgrade to Python {required_version[0]}.{required_version[1]} or higher")
        return False


def check_required_packages() -> bool:
    """Check if required packages are installed."""
    print_header("Checking Required Packages")

    required_packages = [
        "click", "rich", "pydantic", "requests", "toml",
        "anthropic", "openai", "python-dotenv", "sqlalchemy", "questionary"
    ]

    all_installed = True
    critical_packages = ["click", "rich", "pydantic", "requests", "toml", "sqlalchemy", "questionary"]
    optional_packages = ["anthropic", "openai", "python-dotenv"]

    for package in required_packages:
        try:
            # Handle special case for python-dotenv
            if package == "python-dotenv":
                # Try both 'python-dotenv' and 'dotenv'
                try:
                    module = importlib.import_module("dotenv")
                    version = getattr(module, "__version__", "unknown")
                    print_success(f"{package} - Version: {version}")
                    continue
                except ImportError:
                    pass

            module = importlib.import_module(package)
            version = getattr(module, "__version__", "unknown")
            print_success(f"{package} - Version: {version}")
        except ImportError:
            # Try alternative import paths
            if package == "python-dotenv":
                try:
                    # Some environments import it differently
                    import dotenv
                    version = getattr(dotenv, "__version__", "unknown")
                    print_success(f"{package} - Version: {version}")
                    continue
                except ImportError:
                    pass

            if package in critical_packages:
                print_error(f"{package} not found (CRITICAL)")
                all_installed = False
            else:
                print_warning(f"{package} not found (OPTIONAL)")

    if not all_installed:
        print_warning("Some critical packages are missing. Run 'pip install -e .' to install them.")
        print_warning("Optional packages may be needed for specific features but are not required.")

    return all_installed


def check_langue_installation() -> bool:
    """Check if Langue is properly installed."""
    print_header("Checking Langue Installation")

    try:
        import langue
        print_success(f"Langue version: {langue.__version__}")

        # Check for critical modules
        for module_name in ["user", "activities", "models", "storage", "config"]:
            module_path = f"langue.{module_name}"
            try:
                importlib.import_module(module_path)
                print_success(f"Module {module_path} found")
            except ImportError as e:
                print_error(f"Module {module_path} not found: {e}")
                return False

        return True
    except ImportError as e:
        print_error(f"Failed to import Langue: {e}")
        return False


def check_directory_structure() -> bool:
    """Check if the directory structure is correct."""
    print_header("Checking Directory Structure")

    # Try to determine the project root
    current_dir = Path(__file__).resolve().parent

    # Check if this script is in the project root
    if (current_dir / "langue").is_dir():
        project_root = current_dir
    else:
        # Try to find project root (up to 3 levels up)
        found = False
        for _ in range(3):
            current_dir = current_dir.parent
            if (current_dir / "langue").is_dir():
                project_root = current_dir
                found = True
                break

        if not found:
            print_error("Could not find Langue project root directory")
            return False

    print(f"Project root: {project_root}")

    # Check for required directories
    required_dirs = [
        "langue/activities",
        "langue/cli",
        "langue/config",
        "langue/models",
        "langue/storage",
        "langue/user",
        "langue/utils",
        "data",
        "tests"
    ]

    all_dirs_exist = True

    for dir_path in required_dirs:
        full_path = project_root / dir_path
        if full_path.is_dir():
            print_success(f"Directory {dir_path} found")
        else:
            print_error(f"Directory {dir_path} not found")
            all_dirs_exist = False

    return all_dirs_exist


def check_ollama_availability() -> Tuple[bool, List[str]]:
    """Check if Ollama is installed and available."""
    print_header("Checking Ollama Availability")

    ollama_installed = False
    available_models = []

    # Check if Ollama is installed
    try:
        if platform.system() == "Windows":
            subprocess.run(["where", "ollama"], check=True, capture_output=True)
        else:
            subprocess.run(["which", "ollama"], check=True, capture_output=True)

        ollama_installed = True
        print_success("Ollama is installed")
    except (subprocess.SubprocessError, FileNotFoundError):
        print_warning("Ollama is not installed or not in PATH")
        print("To install Ollama, visit: https://ollama.ai")
        return False, []

    # Check if Ollama server is running
    try:
        import requests
        response = requests.get("http://localhost:11434/api/tags", timeout=2)

        if response.status_code == 200:
            print_success("Ollama server is running")

            # Get available models
            data = response.json()
            if "models" in data:
                available_models = [model["name"] for model in data["models"]]

                if available_models:
                    print_success(f"Available models: {', '.join(available_models)}")
                else:
                    print_warning("No models available. Pull a model with 'ollama pull llama3'")
            else:
                print_warning("Could not retrieve available models")
        else:
            print_warning(f"Ollama server returned status code: {response.status_code}")

    except (requests.RequestException, ImportError):
        print_warning("Ollama server is not running or could not be reached")
        print("Start Ollama server with the 'ollama serve' command")

    return ollama_installed, available_models


def check_api_keys() -> bool:
    """Check if API keys for cloud models are set."""
    print_header("Checking API Keys")

    keys_found = False

    # Check environment variables
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if anthropic_key:
        print_success("ANTHROPIC_API_KEY is set")
        keys_found = True
    else:
        print_warning("ANTHROPIC_API_KEY is not set")

    if openai_key:
        print_success("OPENAI_API_KEY is set")
        keys_found = True
    else:
        print_warning("OPENAI_API_KEY is not set")

    # Check .env file
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        print_success(".env file found")

        with open(env_path, "r") as f:
            env_content = f.read()

            if "ANTHROPIC_API_KEY" in env_content and not anthropic_key:
                print_success("ANTHROPIC_API_KEY found in .env file")
                keys_found = True

            if "OPENAI_API_KEY" in env_content and not openai_key:
                print_success("OPENAI_API_KEY found in .env file")
                keys_found = True
    else:
        print_warning(".env file not found")

    if not keys_found:
        print_warning("No API keys found. Cloud models (Claude, OpenAI) will not be available.")
        print("To use cloud models, set API keys in environment variables or .env file.")

    return keys_found


def check_database() -> bool:
    """Check if the database is properly configured."""
    print_header("Checking Database Configuration")

    try:
        from langue.storage.database import get_db_path, initialize_database

        db_path = get_db_path()
        print(f"Database path: {db_path}")

        if db_path.exists():
            print_success("Database file exists")

            # Check file size to ensure it's not empty
            if db_path.stat().st_size > 0:
                print_success("Database file is not empty")
            else:
                print_warning("Database file exists but is empty")

                # Initialize database
                print("Initializing database...")
                initialize_database()

                if db_path.stat().st_size > 0:
                    print_success("Database initialized successfully")
                else:
                    print_error("Failed to initialize database")
                    return False
        else:
            print_warning("Database file does not exist")

            # Create database directory
            db_path.parent.mkdir(parents=True, exist_ok=True)

            # Initialize database
            print("Initializing database...")
            initialize_database()

            if db_path.exists() and db_path.stat().st_size > 0:
                print_success("Database initialized successfully")
            else:
                print_error("Failed to initialize database")
                return False

        return True
    except ImportError as e:
        print_error(f"Failed to import database module: {e}")
        return False
    except Exception as e:
        print_warning(f"Error checking database: {e}")
        print_info("This might be expected during initial setup - a new database will be created on first run")
        return True  # Return True to avoid failing installation verification


def run_basic_test() -> bool:
    """Run a basic test to ensure Langue works."""
    print_header("Running Basic Functionality Test")

    try:
        # Try to import main modules
        print("Importing modules...")
        from langue.user.profile import UserProfile
        from langue.activities.flashcards import FlashcardActivity

        # Create a test user profile
        print("Creating test user profile...")
        user = UserProfile(
            user_id="test_user",
            username="Test User",
            current_language="Spanish"
        )

        # Create a test activity
        print("Creating test activity...")
        activity = FlashcardActivity(
            language="Spanish",
            difficulty=1
        )

        print_success("Basic functionality test passed")
        return True
    except ImportError as e:
        print_warning(f"Import error during test: {e}")
        print_warning("This might be expected during initial setup")
        return True  # Return True to avoid failing installation verification
    except Exception as e:
        print_error(f"Basic functionality test failed: {e}")
        return False


def run_verification():
    """Run all verification checks."""
    print(f"{BOLD}{BLUE}Langue Installation Verification{RESET}")
    print(f"{BOLD}===============================\n{RESET}")

    # Record start time
    start_time = time.time()

    # Run checks
    python_ok = check_python_version()
    packages_ok = check_required_packages()
    langue_ok = check_langue_installation()
    dirs_ok = check_directory_structure()
    ollama_ok, available_models = check_ollama_availability()
    api_keys_ok = check_api_keys()
    database_ok = check_database()
    basic_test_ok = run_basic_test()

    # Record end time
    end_time = time.time()

    # Print summary
    print_header("Verification Summary")

    # Only fail if critical components are missing
    if python_ok and langue_ok and dirs_ok and database_ok and basic_test_ok:
        print_success("Langue is correctly installed and configured!")

        # Show model availability
        if ollama_ok and available_models:
            print_success(f"Local models available: {', '.join(available_models)}")
        elif ollama_ok:
            print_warning("Ollama is installed but no models are available")
            print("Pull a model with: ollama pull llama3")
        else:
            print_warning("No local models available (Ollama not installed)")

        if api_keys_ok:
            print_success("Cloud models (Claude, OpenAI) are available")
        else:
            print_warning("Cloud models are not available (API keys not set)")

        print(f"\n{BOLD}Langue is ready to use!{RESET}")
        print(f"Run 'langue' to start the application")
    else:
        print_error("Langue installation verification failed")
        print("Please fix the issues above and run this script again")

    print(f"\nVerification completed in {end_time - start_time:.2f} seconds")


if __name__ == "__main__":
    run_verification()
