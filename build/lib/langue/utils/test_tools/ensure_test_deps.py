#!/usr/bin/env python3
"""
Ensure Test Dependencies Script for Langue.

This script checks for required packages and installs them if they're missing.
It should be run before the test suite to ensure all dependencies are available.
"""

import os
import sys
import subprocess
import importlib.util
from pathlib import Path

# Define required packages for tests
REQUIRED_PACKAGES = [
    "rich",
    "questionary",
    "anthropic",
    "sqlalchemy",
    "pydantic",
    "toml",
    "click",
    "requests",
    "python-dotenv"
]

def is_package_installed(package_name):
    """Check if a package is installed.

    Args:
        package_name: Name of the package to check

    Returns:
        True if the package is installed, False otherwise
    """
    spec = importlib.util.find_spec(package_name)
    return spec is not None

def install_package(package_name):
    """Install a package using pip.

    Args:
        package_name: Name of the package to install

    Returns:
        True if installation was successful, False otherwise
    """
    print(f"Installing {package_name}...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
        return True
    except subprocess.CalledProcessError:
        print(f"Failed to install {package_name}")
        return False

def ensure_dependencies():
    """Ensure all required packages are installed.

    Returns:
        True if all dependencies are installed, False otherwise
    """
    all_installed = True
    for package in REQUIRED_PACKAGES:
        if not is_package_installed(package):
            print(f"Package '{package}' is not installed")
            success = install_package(package)
            if not success:
                all_installed = False
        else:
            print(f"Package '{package}' is already installed")

    return all_installed

def main():
    """Main entry point for the script."""
    print("Checking for required test dependencies...")

    # Check if running in a virtual environment
    if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("Warning: Not running in a virtual environment.")

        # Check if venv directory exists in the project
        project_root = Path(__file__).parent.parent
        venv_dir = project_root / "venv"

        if venv_dir.exists():
            print(f"A virtual environment was found at {venv_dir}")
            print("Consider activating it with:")
            if os.name == 'nt':  # Windows
                print(f"    {venv_dir}\\Scripts\\activate")
            else:  # Unix-like
                print(f"    source {venv_dir}/bin/activate")

    # Ensure dependencies are installed
    success = ensure_dependencies()

    if success:
        print("All required packages are installed.")
        return 0
    else:
        print("Some packages could not be installed. Tests may fail.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
