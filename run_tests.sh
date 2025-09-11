#!/bin/bash
# Langue Test Runner Script
# This script helps run tests for the Langue project with proper environment setup

# Make script executable
chmod +x "$0"

# Set terminal colors
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
BOLD="\033[1m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}Langue Test Runner${RESET}"
echo "================="

# Set test mode environment variable
export LANGUE_TEST_MODE=1

# Determine project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
VENV_DIR="$PROJECT_ROOT/venv"

# Check if virtual environment exists
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Activating virtual environment...${RESET}"
    source "$VENV_DIR/bin/activate"
else
    echo -e "${YELLOW}No virtual environment found at $VENV_DIR${RESET}"
    echo -e "${YELLOW}Running with system Python${RESET}"
fi

# Ensure required packages are installed
echo -e "${YELLOW}Ensuring required packages are installed...${RESET}"
python -c "import rich" > /dev/null 2>&1 || pip install rich
python -c "import questionary" > /dev/null 2>&1 || pip install questionary
python -c "import click" > /dev/null 2>&1 || pip install click
python -c "import pydantic" > /dev/null 2>&1 || pip install pydantic

# Function to run unit tests
run_unit_tests() {
    echo -e "${BOLD}${BLUE}Running unit tests...${RESET}"
    python -m unittest discover -s tests/unit "$@"
    return $?
}

# Function to run end-to-end tests
run_e2e_tests() {
    echo -e "${BOLD}${BLUE}Running end-to-end tests...${RESET}"
    python -m tests.end_to_end.test_runner "$@"
    return $?
}

# Function to run all tests
run_all_tests() {
    unit_success=0
    e2e_success=0

    run_unit_tests
    unit_success=$?

    run_e2e_tests
    e2e_success=$?

    # Check if both tests passed
    if [ $unit_success -eq 0 ] && [ $e2e_success -eq 0 ]; then
        echo -e "${GREEN}${BOLD}All tests passed!${RESET}"
        return 0
    else
        if [ $unit_success -ne 0 ]; then
            echo -e "${RED}${BOLD}Unit tests failed!${RESET}"
        fi
        if [ $e2e_success -ne 0 ]; then
            echo -e "${RED}${BOLD}End-to-end tests failed!${RESET}"
        fi
        return 1
    fi
}

# Check for command line arguments
if [ $# -eq 0 ]; then
    # No arguments, run all tests
    run_all_tests
else
    case "$1" in
        "unit")
            shift
            run_unit_tests "$@"
            ;;
        "e2e")
            shift
            run_e2e_tests "$@"
            ;;
        "flashcards")
            # Run only flashcard tests
            echo -e "${BOLD}${BLUE}Running flashcard tests...${RESET}"
            python -m unittest tests.unit.test_flashcards tests.unit.test_flashcards_update
            ;;
        "help")
            echo -e "${BOLD}Usage:${RESET}"
            echo "  ./run_tests.sh              Run all tests"
            echo "  ./run_tests.sh unit         Run only unit tests"
            echo "  ./run_tests.sh e2e          Run only end-to-end tests"
            echo "  ./run_tests.sh flashcards   Run only flashcard tests"
            echo "  ./run_tests.sh help         Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown command: $1${RESET}"
            echo "Use './run_tests.sh help' for usage information."
            exit 1
            ;;
    esac
fi

# Deactivate virtual environment if it was activated
if [ -d "$VENV_DIR" ]; then
    deactivate 2>/dev/null || true
fi

# Clear test mode environment variable
unset LANGUE_TEST_MODE
