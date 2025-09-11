@echo off
:: Langue Development Environment Setup Script for Windows
:: This script sets up a development environment for the Langue application,
:: including creating a virtual environment, installing dependencies,
:: and initializing the SQLite database.

echo Langue Development Environment Setup
echo ===============================================

:: Determine project root directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%"
set "VENV_DIR=%PROJECT_ROOT%venv"
set "DATA_DIR=%PROJECT_ROOT%data"
set "CONFIG_DIR=%USERPROFILE%\.config\langue"
set "DB_FILE=%DATA_DIR%\langue.db"

:: Create data directory if it doesn't exist
if not exist "%DATA_DIR%" (
    echo Creating data directory...
    mkdir "%DATA_DIR%"
)

:: Create config directory if it doesn't exist
if not exist "%CONFIG_DIR%" (
    echo Creating config directory...
    mkdir "%CONFIG_DIR%"
)

:: Check if Python is installed
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Python is not installed. Please install Python and try again.
    exit /b 1
)

:: Display Python version
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo Using %PYTHON_VERSION%

:: Check if virtual environment exists
if exist "%VENV_DIR%" (
    echo Virtual environment already exists at %VENV_DIR%
    set /p RECREATE="Do you want to recreate it? (y/n) "
    if /i "%RECREATE%"=="y" (
        echo Removing existing virtual environment...
        rmdir /s /q "%VENV_DIR%"
    ) else (
        echo Using existing virtual environment.
    )
)

:: Create virtual environment if it doesn't exist
if not exist "%VENV_DIR%" (
    echo Creating virtual environment...
    python -m venv "%VENV_DIR%"
)

:: Activate virtual environment
echo Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"

:: Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

:: Install dependencies
echo Installing dependencies...
pip install -e .

:: Explicitly install python-dotenv and questionary (sometimes these can be missed)
echo Ensuring python-dotenv and questionary are installed...
pip install python-dotenv questionary

:: Create .env file if it doesn't exist
set "ENV_FILE=%PROJECT_ROOT%.env"
if not exist "%ENV_FILE%" (
    echo Creating .env file...
    (
        echo # Langue Environment Variables
        echo.
        echo # API Keys
        echo # ANTHROPIC_API_KEY=your_api_key_here
        echo # OPENAI_API_KEY=your_api_key_here
        echo.
        echo # Configuration
        echo # LANGUE_DEBUG=true
        echo # LANGUE_CONFIG_DIR=%CONFIG_DIR%
        echo # LANGUE_DATA_DIR=%DATA_DIR%
    ) > "%ENV_FILE%"
    echo Created .env file at %ENV_FILE%
    echo Please edit this file to add your API keys if needed.
)

:: Verify required packages installation
python -c "import dotenv; print(f'python-dotenv version: {getattr(dotenv, \"__version__\", \"unknown\")}')" || pip install python-dotenv
python -c "import questionary; print(f'questionary version: {getattr(questionary, \"__version__\", \"unknown\")}')" || pip install questionary

:: Initialize SQLite database if it doesn't exist
if not exist "%DB_FILE%" (
    echo Initializing SQLite database...

    :: Check if direct initialization script exists
    if exist "%PROJECT_ROOT%\init_db.py" (
        :: Use the dedicated initialization script
        python "%PROJECT_ROOT%\init_db.py" "%DB_FILE%"
    ) else (
        echo Direct initialization script not found. Creating temporary script...

        :: Create a temporary initialization script
        set "INIT_SCRIPT=%TEMP%\init_db.py"

        (
            echo from pathlib import Path
            echo import sqlite3
            echo import sys
            echo.
            echo def initialize_database():
            echo     """Initialize the database schema."""
            echo     db_path = Path^("%DB_FILE%"^)
            echo     db_path.parent.mkdir^(parents=True, exist_ok=True^)
            echo.
            echo     conn = sqlite3.connect^(db_path^)
            echo     cursor = conn.cursor^(^)
            echo.
            echo     # Create users table
            echo     cursor.execute^('''
            echo     CREATE TABLE IF NOT EXISTS users ^(
            echo         user_id TEXT PRIMARY KEY,
            echo         username TEXT NOT NULL,
            echo         current_language TEXT NOT NULL,
            echo         points INTEGER NOT NULL DEFAULT 0,
            echo         streak_days INTEGER NOT NULL DEFAULT 0,
            echo         last_active TEXT NOT NULL,
            echo         created_at TEXT NOT NULL,
            echo         metadata TEXT
            echo     ^)
            echo     '''^)
            echo.
            echo     # Create languages table
            echo     cursor.execute^('''
            echo     CREATE TABLE IF NOT EXISTS languages ^(
            echo         id INTEGER PRIMARY KEY AUTOINCREMENT,
            echo         user_id TEXT NOT NULL,
            echo         language TEXT NOT NULL,
            echo         word_count INTEGER NOT NULL DEFAULT 0,
            echo         FOREIGN KEY ^(user_id^) REFERENCES users^(user_id^) ON DELETE CASCADE,
            echo         UNIQUE^(user_id, language^)
            echo     ^)
            echo     '''^)
            echo.
            echo     # Create words table
            echo     cursor.execute^('''
            echo     CREATE TABLE IF NOT EXISTS words ^(
            echo         id INTEGER PRIMARY KEY AUTOINCREMENT,
            echo         user_id TEXT NOT NULL,
            echo         language TEXT NOT NULL,
            echo         word TEXT NOT NULL,
            echo         first_seen TEXT NOT NULL,
            echo         last_seen TEXT NOT NULL,
            echo         exposures INTEGER NOT NULL DEFAULT 1,
            echo         FOREIGN KEY ^(user_id^) REFERENCES users^(user_id^) ON DELETE CASCADE,
            echo         UNIQUE^(user_id, language, word^)
            echo     ^)
            echo     '''^)
            echo.
            echo     # Create activities table
            echo     cursor.execute^('''
            echo     CREATE TABLE IF NOT EXISTS activities ^(
            echo         id INTEGER PRIMARY KEY AUTOINCREMENT,
            echo         user_id TEXT NOT NULL,
            echo         activity_type TEXT NOT NULL,
            echo         language TEXT NOT NULL,
            echo         points_earned INTEGER NOT NULL DEFAULT 0,
            echo         words_count INTEGER NOT NULL DEFAULT 0,
            echo         duration_seconds INTEGER,
            echo         completed_at TEXT NOT NULL,
            echo         metadata TEXT,
            echo         FOREIGN KEY ^(user_id^) REFERENCES users^(user_id^) ON DELETE CASCADE
            echo     ^)
            echo     '''^)
            echo.
            echo     # Create achievements table
            echo     cursor.execute^('''
            echo     CREATE TABLE IF NOT EXISTS achievements ^(
            echo         id INTEGER PRIMARY KEY AUTOINCREMENT,
            echo         user_id TEXT NOT NULL,
            echo         achievement TEXT NOT NULL,
            echo         earned_at TEXT NOT NULL,
            echo         FOREIGN KEY ^(user_id^) REFERENCES users^(user_id^) ON DELETE CASCADE,
            echo         UNIQUE^(user_id, achievement^)
            echo     ^)
            echo     '''^)
            echo.
            echo     conn.commit^(^)
            echo     conn.close^(^)
            echo     print^(f"Database initialized at {db_path}"^)
            echo.
            echo if __name__ == "__main__":
            echo     initialize_database^(^)
        ) > "%INIT_SCRIPT%"

        :: Run the initialization script
        python "%INIT_SCRIPT%"

        :: Remove the temporary script
        del "%INIT_SCRIPT%"
    )

    :: Verify the database was created
    if exist "%DB_FILE%" (
        echo SQLite database initialized at %DB_FILE%
    ) else (
        echo Failed to initialize database
        type nul > "%DB_FILE%"
    )
)

:: Check for Ollama installation
where ollama >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Ollama is installed.
    :: Check if Ollama server is running
    curl -s http://localhost:11434/api/tags >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo Ollama server is running.
        echo Available Ollama models:
        ollama list
    ) else (
        echo Ollama server is not running. Start it to use local models.
    )
) else (
    echo Ollama is not installed. Install it to use local models:
    echo https://ollama.ai
)

:: Success message with usage instructions
echo.
echo Setup complete!
echo To activate the virtual environment, run:
echo     %VENV_DIR%\Scripts\activate.bat
echo.
echo To run Langue, use:
echo     langue
echo.
echo Or for development:
echo     python -m langue.main
echo.
echo To deactivate the virtual environment when done:
echo     deactivate
echo.
echo Happy language learning and development!

:: Keep the command window open
pause
