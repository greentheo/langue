#!/bin/bash
# Langue Development Environment Setup Script
# This script sets up a development environment for the Langue application,
# including creating a virtual environment, installing dependencies,
# and initializing the SQLite database.

# Make script executable
chmod +x "$0"

set -e  # Exit on error

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}Langue Development Environment Setup${RESET}"
echo "==============================================="

# Determine project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
VENV_DIR="$PROJECT_ROOT/venv"
DATA_DIR="$PROJECT_ROOT/data"
CONFIG_DIR="$HOME/.config/langue"
DB_FILE="$DATA_DIR/langue.db"

# Create data directory if it doesn't exist
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}Creating data directory...${RESET}"
    mkdir -p "$DATA_DIR"
fi

# Create config directory if it doesn't exist
if [ ! -d "$CONFIG_DIR" ]; then
    echo -e "${YELLOW}Creating config directory...${RESET}"
    mkdir -p "$CONFIG_DIR"
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3 and try again."
    exit 1
fi

# Display Python version
PYTHON_VERSION=$(python3 --version)
echo -e "${YELLOW}Using $PYTHON_VERSION${RESET}"

# Check if virtual environment exists
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Virtual environment already exists at $VENV_DIR${RESET}"
    read -p "Do you want to recreate it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Removing existing virtual environment...${RESET}"
        rm -rf "$VENV_DIR"
    else
        echo -e "${YELLOW}Using existing virtual environment.${RESET}"
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Creating virtual environment...${RESET}"
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${RESET}"
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${RESET}"
pip install --upgrade pip

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${RESET}"
pip install -e .

# Explicitly install python-dotenv and questionary (sometimes these can be missed)
echo -e "${YELLOW}Ensuring python-dotenv and questionary are installed...${RESET}"
pip install python-dotenv questionary

# Create .env file if it doesn't exist
ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Creating .env file...${RESET}"
    cat > "$ENV_FILE" << EOF
# Langue Environment Variables

# API Keys
# ANTHROPIC_API_KEY=your_api_key_here
# OPENAI_API_KEY=your_api_key_here

# Configuration
# LANGUE_DEBUG=true
# LANGUE_CONFIG_DIR=$CONFIG_DIR
# LANGUE_DATA_DIR=$DATA_DIR
EOF
    echo -e "${GREEN}Created .env file at $ENV_FILE${RESET}"
    echo -e "${YELLOW}Please edit this file to add your API keys if needed.${RESET}"
fi

# Verify required packages installation
python -c "import dotenv; print(f'python-dotenv version: {getattr(dotenv, \"__version__\", \"unknown\")}')" || pip install python-dotenv
python -c "import questionary; print(f'questionary version: {getattr(questionary, \"__version__\", \"unknown\")}')" || pip install questionary

# Initialize SQLite database if it doesn't exist
if [ ! -f "$DB_FILE" ]; then
    echo -e "${YELLOW}Initializing SQLite database...${RESET}"

    # Check if the init_db.py script exists
    if [ -f "$PROJECT_ROOT/init_db.py" ]; then
        # Use the dedicated initialization script
        python "$PROJECT_ROOT/init_db.py" "$DB_FILE"
    else
        echo -e "${YELLOW}Direct initialization script not found. Creating temporary script...${RESET}"
        # Create a simple initialization script
        cat > "$PROJECT_ROOT/temp_init_db.py" << EOF
from pathlib import Path
import sqlite3
import sys

def initialize_database():
    """Initialize the database schema."""
    db_path = Path("$DB_FILE")
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        current_language TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 0,
        last_active TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata TEXT
    )
    ''')

    # Create languages table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS languages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, language)
    )
    ''')

    # Create words table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        word TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        exposures INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, language, word)
    )
    ''')

    # Create activities table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activities (
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
    )
    ''')

    # Create achievements table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        achievement TEXT NOT NULL,
        earned_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, achievement)
    )
    ''')

    conn.commit()
    conn.close()
    print(f"Database initialized at {db_path}")

if __name__ == "__main__":
    initialize_database()
EOF

        # Run the initialization script directly
        python "$PROJECT_ROOT/temp_init_db.py"

        # Remove the temporary script
        rm "$PROJECT_ROOT/temp_init_db.py"
    fi

    # Verify the database was created
    if [ -f "$DB_FILE" ]; then
        echo -e "${GREEN}SQLite database initialized at $DB_FILE${RESET}"
    else
        echo -e "${RED}Failed to initialize database${RESET}"
        touch "$DB_FILE"  # Create an empty file as a placeholder
    fi
fi

# Check for Ollama installation
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}Ollama is installed.${RESET}"
    # Check if Ollama server is running
    if curl -s http://localhost:11434/api/tags &> /dev/null; then
        echo -e "${GREEN}Ollama server is running.${RESET}"
        echo -e "${YELLOW}Available Ollama models:${RESET}"
        ollama list
    else
        echo -e "${YELLOW}Ollama server is not running. Start it to use local models.${RESET}"
    fi
else
    echo -e "${YELLOW}Ollama is not installed. Install it to use local models:${RESET}"
    echo -e "${BLUE}https://ollama.ai${RESET}"
fi

# Rebuild app environment
echo -e "${YELLOW}Rebuilding application environment...${RESET}"
pip install -e .

# Reactivate virtual environment to refresh
echo -e "${YELLOW}Reactivating virtual environment...${RESET}"
deactivate
source "$VENV_DIR/bin/activate"

# Verify environment is active
echo -e "${GREEN}Environment refreshed and activated.${RESET}"

# Success message with usage instructions
echo
echo -e "${GREEN}${BOLD}Setup complete!${RESET}"
echo -e "${BOLD}To activate the virtual environment, run:${RESET}"
echo -e "    ${BLUE}source $VENV_DIR/bin/activate${RESET}"
echo
echo -e "${BOLD}To run Langue, use:${RESET}"
echo -e "    ${BLUE}langue${RESET}"
echo
echo -e "${BOLD}Or for development:${RESET}"
echo -e "    ${BLUE}python -m langue.main${RESET}"
echo
echo -e "${BOLD}To deactivate the virtual environment when done:${RESET}"
echo -e "    ${BLUE}deactivate${RESET}"
echo
echo -e "${YELLOW}Happy language learning and development!${RESET}"
