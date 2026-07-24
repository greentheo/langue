#!/usr/bin/env python3
"""
Langue - CLI Language Learning Application

Main entry point for the Langue application.
"""

import os
import sys
import click
import logging
from pathlib import Path
from typing import Optional

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
import questionary
from questionary import Style
from rich.color import Color
from rich.theme import Theme

from langue.config.manager import ConfigManager
from langue.user.profile import UserProfileManager
from langue.cli.commands import register_activity_commands
from langue.models.discovery import discover_available_models, discover_ollama_models
from langue.models import registry
from langue.models.base import ModelError
from langue.storage.integration import save_flashcard_activity_results

# Define an 80's style theme
SYNTHWAVE_THEME = {
    "primary": Color.parse("#ff00ff").name,    # Hot pink
    "secondary": Color.parse("#00ffff").name,  # Cyan
    "accent": Color.parse("#ffff00").name,     # Yellow
    "highlight": Color.parse("#00ff00").name,  # Neon green
    "background": Color.parse("#000033").name, # Dark blue
    "border": Color.parse("#ff00ff").name,     # Hot pink
}

# Define questionary style
RETRO_STYLE = Style([
    ('qmark', f'fg:{SYNTHWAVE_THEME["primary"]} bold'),       # token in front of the question
    ('question', f'fg:{SYNTHWAVE_THEME["secondary"]} bold'),  # question text
    ('answer', f'fg:{SYNTHWAVE_THEME["accent"]} bold'),       # submitted answer text
    ('pointer', f'fg:{SYNTHWAVE_THEME["primary"]} bold'),     # pointer used in select and checkbox prompts
    ('highlighted', f'fg:{SYNTHWAVE_THEME["highlight"]} bold'),  # pointed-at choice in select and checkbox prompts
    ('selected', f'fg:{SYNTHWAVE_THEME["secondary"]} bold'),  # style for a selected item of a checkbox
    ('separator', f'fg:{SYNTHWAVE_THEME["border"]} bold'),    # separator in lists
    ('instruction', f'fg:{SYNTHWAVE_THEME["accent"]}'),       # user instructions for select, rawselect, checkbox
    ('text', f'fg:{SYNTHWAVE_THEME["secondary"]}'),           # plain text
    ('disabled', 'fg:#858585 italic')                         # disabled choices
])

# Initialize console for rich output
# Initialize console for rich output with 80's styling
from rich.theme import Theme
console = Console(theme=Theme({
    "info": f"bold {SYNTHWAVE_THEME['secondary']}",
    "warning": f"bold {SYNTHWAVE_THEME['accent']}",
    "danger": f"bold {SYNTHWAVE_THEME['primary']}",
    "success": f"bold {SYNTHWAVE_THEME['highlight']}",
}))

# Configure logging to minimize UI disruption
logging.basicConfig(
    level=logging.ERROR,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("langue.log")
    ]
)
# Set specific loggers to higher level to suppress unwanted messages
logging.getLogger("httpx").setLevel(logging.CRITICAL)
logging.getLogger("anthropic").setLevel(logging.CRITICAL)
logging.getLogger("root").setLevel(logging.CRITICAL)

# Configure panel borders for 80's aesthetic
PANEL_BORDER_STYLE = f"{SYNTHWAVE_THEME['border']} bold"


def initialize_app() -> tuple:
    """Initialize application components and ensure required directories exist."""
    # Ensure config directory exists
    config_dir = Path.home() / ".config" / "langue"
    config_dir.mkdir(parents=True, exist_ok=True)

    # Ensure data directory exists
    data_dir = Path.home() / ".local" / "share" / "langue"
    data_dir.mkdir(parents=True, exist_ok=True)

    # Initialize configuration
    config_manager = ConfigManager()

    # Initialize user profile
    user_manager = UserProfileManager()

    # Check if we need to prompt for model selection
    if config_manager.settings.prompt_for_model:
        ensure_model_selected(config_manager)

    return config_manager, user_manager


def ensure_model_selected(config_manager: ConfigManager) -> None:
    """Ensure a model is selected for use.

    If no model is selected in the configuration, or the selected model
    is not available, prompt the user to select a model.

    Args:
        config_manager: The configuration manager
    """
    # Try to load .env file if available
    try:
        from dotenv import load_dotenv
        load_dotenv()
        console.print("[dim]Loaded environment variables from .env file[/dim]")
    except ImportError:
        console.print("[dim]python-dotenv not installed, skipping .env loading[/dim]")

    # Check if Claude API key is available
    claude_api_key = os.environ.get("ANTHROPIC_API_KEY")

    if claude_api_key:
        # Set Claude as primary model
        config_manager.update_setting("primary_model", "claude")
        default_model = registry.default_claude_model()
        config_manager.update_setting("claude.model_name", default_model)
        console.print(f"[{SYNTHWAVE_THEME['highlight']}]Using {registry.model_display_name(default_model)} for all activities[/{SYNTHWAVE_THEME['highlight']}]")
        return
    else:
        console.print("[yellow]No Anthropic API key found. Checking for Ollama models...[/yellow]")

    # Check for Ollama models
    ollama_models = discover_ollama_models()
    if not ollama_models:
        console.print("[red]No Ollama models detected and no Claude API key found.[/red]")
        console.print("[yellow]To use Claude, add ANTHROPIC_API_KEY to your .env file or environment.[/yellow]")
        console.print("[yellow]To use Ollama, make sure it's installed and running.[/yellow]")
        return

    # Set Ollama as the primary model
    config_manager.update_setting("primary_model", "ollama")

    # Get the currently configured Ollama model
    current_model = config_manager.settings.ollama.model_name

    # Check if the current model exists in available models
    if current_model in ollama_models:
        console.print(f"[{SYNTHWAVE_THEME['highlight']}]Using Ollama model: [bold]{current_model}[/bold][/{SYNTHWAVE_THEME['highlight']}]")
        return

    # If we get here, we need to prompt for model selection
    console.print(f"[bold {SYNTHWAVE_THEME['accent']}]Please select an Ollama model to use:[/bold {SYNTHWAVE_THEME['accent']}]")

    # Prepare choices for questionary
    model_choices = [{"name": model, "value": model} for model in ollama_models]

    # Use questionary for interactive selection
    selected_model = questionary.select(
        "Select a model:",
        choices=model_choices,
        style=RETRO_STYLE
    ).ask()

    # If nothing was selected (user pressed Ctrl+C), use the first model
    if not selected_model and ollama_models:
        selected_model = ollama_models[0]

    # Update the configuration
    config_manager.update_setting("ollama.model_name", selected_model)
    console.print(f"[{SYNTHWAVE_THEME['highlight']}]Model set to: [bold]{selected_model}[/bold][/{SYNTHWAVE_THEME['highlight']}]")


def display_welcome(user_manager) -> None:
    """Display welcome message and user stats."""
    user = user_manager.get_current_user()

    # Create welcome header with 80's ASCII art
    welcome_ascii = """
    ██╗      █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗███████╗
    ██║     ██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔════╝
    ██║     ███████║██╔██╗ ██║██║  ███╗██║   ██║█████╗
    ██║     ██╔══██║██║╚██╗██║██║   ██║██║   ██║██╔══╝
    ███████╗██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝███████╗
    ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚══════╝
    """

    # Create welcome header with retro styling
    welcome_text = Text()
    welcome_text.append(welcome_ascii, style=f"{SYNTHWAVE_THEME['primary']} bold")
    welcome_text.append("\n\n", style="default")
    welcome_text.append("【﻿ＣＬＩ　ＬＡＮＧＵＡＧＥ　ＬＥＡＲＮＩＮＧ】", style=f"{SYNTHWAVE_THEME['secondary']} bold")

    # Create user stats
    stats_text = Text()

    if user:
        stats_text.append(f"\nUsername: {user.username}\n", style="bold")
        stats_text.append(f"Current Language: {user.current_language}\n")
        stats_text.append(f"Level: {user.current_level.upper() if hasattr(user, 'current_level') else 'A1'}\n")
        stats_text.append(f"Words Learned: {sum(user.word_count.values())}\n")
        stats_text.append(f"Total Points: {user.points}\n")
        stats_text.append(f"Learning Streak: {user.streak_days} days\n")

        if user.achievements:
            stats_text.append("\nAchievements:\n", style="bold yellow")
            for achievement in user.achievements[:3]:  # Show only the latest 3
                stats_text.append(f"- {achievement}\n", style="yellow")
    else:
        stats_text.append("\nWelcome, new language learner!\n", style="bold")
        stats_text.append("Let's set up your profile and start learning.\n")

    # Display welcome panel
    console.print(Panel(welcome_text, subtitle="v0.1.0", border_style=PANEL_BORDER_STYLE))

    if user:
        console.print(Panel(stats_text, title="【﻿ＹＯＵＲ　ＰＲＯＧＲＥＳＳ】", border_style=PANEL_BORDER_STYLE))


@click.group(invoke_without_command=True)
@click.version_option("0.1.0")
@click.option("--language", "-l", help="Language to learn")
@click.pass_context
def main(ctx, language: Optional[str] = None):
    """Langue - CLI Language Learning Assistant."""
    # Initialize application
    config_manager, user_manager = initialize_app()

    # Store managers in context for sub-commands
    ctx.obj = {
        "config_manager": config_manager,
        "user_manager": user_manager
    }

    # If language is specified, set it as current language
    if language:
        user = user_manager.get_current_user()
        if user:
            user.current_language = language
            user_manager.save_user(user)

    # If no subcommand is specified, run main app flow
    if ctx.invoked_subcommand is None:
        display_welcome(user_manager)

        # Discover available models
        try:
            models = discover_available_models()
            if models:
                console.print("[{}]Available models:[/{}] {}".format(SYNTHWAVE_THEME['highlight'], SYNTHWAVE_THEME['highlight'], ', '.join(models)))
        except Exception as e:
            console.print("[{}]Could not discover models: {}[/{}]".format(SYNTHWAVE_THEME['accent'], e, SYNTHWAVE_THEME['accent']))

        # Present main menu
        show_main_menu(ctx)


def show_main_menu(ctx):
    """Display main application menu."""
    # Get user and current language/level info
    user_manager = ctx.obj["user_manager"]
    user = user_manager.get_current_user()

    # Get language and level for display
    language = user.current_language if user else "Spanish"
    level = user.current_level.upper() if (user and hasattr(user, 'current_level')) else "A1"

    options = [
        ("Start Learning", f"Begin a {language} (Level {level}) session"),
        ("Change Language or Level", "Select language or proficiency level"),
        ("Settings", "Configure application settings"),
        ("View Progress", "View detailed progress statistics"),
        ("Help", "Show help information"),
        ("Exit", "Exit the application")
    ]

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＷＨＡＴ　ＷＯＵＬＤ　ＹＯＵ　ＬＩＫＥ　ＴＯ　ＤＯ？】[/bold {SYNTHWAVE_THEME['secondary']}]\n")

    # Prepare choices for questionary
    menu_choices = [{"name": f"{option} - {description}", "value": i} for i, (option, description) in enumerate(options, 1)]

    # Use questionary for interactive selection
    choice = questionary.select(
        "Select an option:",
        choices=menu_choices,
        style=RETRO_STYLE
    ).ask()

    # Default to 1 if nothing was selected
    if not choice:
        choice = 1

    if choice == 1:
        try:
            show_activity_menu(ctx)
        except ModelError as e:
            hint = f"\n\n{e.hint}" if e.hint else ""
            console.print(Panel(
                f"{e}{hint}",
                title="【ＭＯＤＥＬ　ＥＲＲＯＲ】",
                border_style=SYNTHWAVE_THEME['primary'],
                padding=(1, 2),
            ))
    elif choice == 2:
        change_language_or_level(ctx)
    elif choice == 3:
        show_settings(ctx)
    elif choice == 4:
        show_progress(ctx)
    elif choice == 5:
        show_help()
    elif choice == 6:
        console.print("[yellow]Goodbye! Happy language learning![/yellow]")
        sys.exit(0)
    else:
        console.print("[red]Invalid choice. Please try again.[/red]")
        show_main_menu(ctx)


def show_activity_menu(ctx):
    """Display activity selection menu."""
    user_manager = ctx.obj["user_manager"]
    config_manager = ctx.obj["config_manager"]

    # Get current user and language
    user = user_manager.get_current_user()
    current_language = user.current_language if user else config_manager.settings.default_language

    # Get configured model
    model_name = f"ollama:{config_manager.settings.ollama.model_name}"

    activities = [
        ("Flashcards", "Practice vocabulary with flashcards"),
        ("Fill in the Blank", "Complete sentences with missing words"),
        ("Conversation", "Practice speaking with an AI language partner"),
        ("Reading Comprehension", "Read a passage and answer questions"),
        ("Translation Exercise", "Translate phrases between languages"),
        ("Back", "Return to main menu")
    ]

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＣＨＯＯＳＥ　ＡＮ　ＡＣＴＩＶＩＴＹ】[/bold {SYNTHWAVE_THEME['secondary']}]\n")

    # Prepare choices for questionary
    activity_choices = [{"name": f"{activity} - {description}", "value": i} for i, (activity, description) in enumerate(activities, 1)]

    # Use questionary for interactive selection
    choice = questionary.select(
        "Select an activity:",
        choices=activity_choices,
        style=RETRO_STYLE
    ).ask()

    # Default to 1 if nothing was selected
    if not choice:
        choice = 1

    if choice == 1:  # Flashcards
        console.print(f"[green]Starting {activities[choice-1][0]}...[/green]")
        from langue.activities.flashcards import FlashcardActivity
        # Get current user ID
        user = user_manager.get_current_user()
        user_id = user.user_id if user else "default_user"

        # Get the user's current level and pass it to the activity
        level = user.current_level if hasattr(user, 'current_level') else None

        # Determine which model to use
        model_name = registry.default_claude_selector() if os.environ.get("ANTHROPIC_API_KEY") else model_name

        activity = FlashcardActivity(
            language=current_language,
            difficulty=config_manager.settings.activities["flashcards"].difficulty,
            model_name=model_name,
            user_id=user_id,
            level=level
        )
        activity.start()
        # Track activity in user profile
        user_manager.track_activity("flashcards", words=list(activity.words_encountered), points=activity.points_earned)
        # Save detailed flashcard history
        save_flashcard_activity_results(user_id, activity)
        show_main_menu(ctx)
    elif choice == 2:  # Fill in the Blank
        console.print(f"[green]Starting {activities[choice-1][0]}...[/green]")
        from langue.activities.fill_blank import FillBlankActivity

        # Get the user's current level and pass it to the activity
        level = user.current_level if hasattr(user, 'current_level') else None

        # Determine which model to use
        model_name = registry.default_claude_selector() if os.environ.get("ANTHROPIC_API_KEY") else model_name

        activity = FillBlankActivity(
            language=current_language,
            difficulty=config_manager.settings.activities["fill_blank"].difficulty,
            model_name=model_name,
            level=level
        )
        activity.start()
        # Track activity in user profile
        user_manager.track_activity("fill_blank", words=list(activity.words_encountered), points=activity.points_earned)
        show_main_menu(ctx)
    elif choice == 3:  # Conversation
        console.print(f"[green]Starting {activities[choice-1][0]}...[/green]")
        from langue.activities.chat import ChatActivity

        # Get the user's current level and pass it to the activity
        level = user.current_level if hasattr(user, 'current_level') else None

        # Determine which model to use
        model_name = registry.default_claude_selector() if os.environ.get("ANTHROPIC_API_KEY") else model_name

        activity = ChatActivity(
            language=current_language,
            difficulty=config_manager.settings.activities["chat"].difficulty,
            model_name=model_name,
            duration_minutes=10,  # Default 10-minute conversation
            level=level
        )
        activity.start()
        # Track activity in user profile
        user_manager.track_activity("chat", words=list(activity.words_encountered), points=activity.points_earned)
        show_main_menu(ctx)
    elif choice == 4:  # Reading Comprehension
        console.print(f"[green]Starting {activities[choice-1][0]}...[/green]")
        from langue.activities.reading import ReadingActivity

        # Get the user's current level and pass it to the activity
        level = user.current_level if hasattr(user, 'current_level') else None

        # Determine which model to use
        model_name = registry.default_claude_selector() if os.environ.get("ANTHROPIC_API_KEY") else model_name

        activity = ReadingActivity(
            language=current_language,
            difficulty=config_manager.settings.activities["reading"].difficulty,
            model_name=model_name,
            level=level
        )
        activity.start()
        # Track activity in user profile
        user_manager.track_activity("reading", words=list(activity.words_encountered), points=activity.points_earned)
        show_main_menu(ctx)
    elif choice == 5:  # Translation Exercise
        console.print(f"[green]Starting {activities[choice-1][0]}...[/green]")
        from langue.activities.translation import TranslationActivity

        # Get the user's current level and pass it to the activity
        level = user.current_level if hasattr(user, 'current_level') else None

        # Determine which model to use
        model_name = registry.default_claude_selector() if os.environ.get("ANTHROPIC_API_KEY") else model_name

        activity = TranslationActivity(
            language=current_language,
            difficulty=config_manager.settings.activities["translation"].difficulty,
            model_name=model_name,
            level=level
        )
        activity.start()
        # Track activity in user profile
        user_manager.track_activity("translation", words=list(activity.words_encountered), points=activity.points_earned)
        show_main_menu(ctx)
    elif choice == 6:  # Back
        show_main_menu(ctx)
    else:
        console.print("[red]Invalid choice. Please try again.[/red]")
        show_activity_menu(ctx)


def change_language_or_level(ctx):
    """Change the current learning language or level."""
    options = ["Language", "Level"]

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＣＨＡＮＧＥ　ＬＡＮＧＵＡＧＥ　ＯＲ　ＬＥＶＥＬ】[/bold {SYNTHWAVE_THEME['secondary']}]\n")

    # Prepare choices for questionary
    option_choices = [{"name": opt, "value": i} for i, opt in enumerate(options, 1)]

    # Use questionary for interactive selection
    option_choice = questionary.select(
        "What would you like to change?",
        choices=option_choices,
        style=RETRO_STYLE
    ).ask()

    # Default to 1 if nothing was selected
    if not option_choice:
        option_choice = 1

    if option_choice == 1:
        # Change language
        change_language(ctx)
    elif option_choice == 2:
        # Change level
        change_level(ctx)
    else:
        console.print("[red]Invalid choice. Please try again.[/red]")
        show_main_menu(ctx)

def change_language(ctx):
    """Change the current learning language."""
    languages = [
        "Spanish", "French", "German", "Italian", "Portuguese",
        "Japanese", "Chinese (Mandarin)", "Russian", "Arabic", "Korean"
    ]

    # Get current user info for display purposes
    user_manager = ctx.obj["user_manager"]
    user = user_manager.get_current_user()
    current_language = user.current_language if user else "None"

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＳＥＬＥＣＴ　Ａ　ＬＡＮＧＵＡＧＥ】[/bold {SYNTHWAVE_THEME['secondary']}]\n")
    console.print(f"Current language: [{SYNTHWAVE_THEME['highlight']}]{current_language}[/{SYNTHWAVE_THEME['highlight']}]\n")

    # Prepare choices for questionary
    language_choices = [{"name": lang, "value": i} for i, lang in enumerate(languages, 1)]

    # Use questionary for interactive selection
    choice = questionary.select(
        "Select a language:",
        choices=language_choices,
        style=RETRO_STYLE
    ).ask()

    # Default to 1 if nothing was selected
    if not choice:
        choice = 1

    if 1 <= choice <= len(languages):
        selected_language = languages[choice-1]

        user_manager = ctx.obj["user_manager"]
        current_user = user_manager.get_current_user()

        if current_user:
            current_user.current_language = selected_language
            user_manager.save_user(current_user)
            console.print(f"[{SYNTHWAVE_THEME['highlight']}]Language changed to {selected_language}[/{SYNTHWAVE_THEME['highlight']}]")
        else:
            console.print(f"[{SYNTHWAVE_THEME['accent']}]Could not update user profile[/{SYNTHWAVE_THEME['accent']}]")
    else:
        console.print("[red]Invalid choice. Please try again.[/red]")

    show_main_menu(ctx)

def change_level(ctx):
    """Change the current learning level."""
    levels = [
        "A1 (Beginner)",
        "A2 (Elementary)",
        "B1 (Intermediate)",
        "B2 (Upper Intermediate)",
        "C1 (Advanced)",
        "C2 (Proficiency)"
    ]
    level_codes = ["a1", "a2", "b1", "b2", "c1", "c2"]

    # Get current user info for display purposes
    user_manager = ctx.obj["user_manager"]
    user = user_manager.get_current_user()
    current_level = user.current_level.upper() if (user and hasattr(user, 'current_level')) else "A1"
    current_language = user.current_language if user else "None"

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＳＥＬＥＣＴ　Ａ　ＬＥＶＥＬ】[/bold {SYNTHWAVE_THEME['secondary']}]\n")
    console.print(f"Current language: [{SYNTHWAVE_THEME['highlight']}]{current_language}[/{SYNTHWAVE_THEME['highlight']}] • Current level: [{SYNTHWAVE_THEME['highlight']}]{current_level}[/{SYNTHWAVE_THEME['highlight']}]\n")

    # Prepare choices for questionary
    level_choices = [{"name": lvl, "value": i} for i, lvl in enumerate(levels, 1)]

    # Use questionary for interactive selection
    choice = questionary.select(
        "Select a learning level:",
        choices=level_choices,
        style=RETRO_STYLE
    ).ask()

    # Default to 1 if nothing was selected
    if not choice:
        choice = 1

    if 1 <= choice <= len(levels):
        selected_level_code = level_codes[choice-1]
        selected_level_name = levels[choice-1]

        user_manager = ctx.obj["user_manager"]
        current_user = user_manager.get_current_user()

        if current_user:
            # Log level change for debugging
            console.print(f"[dim]DEBUG: Setting level from {current_user.current_level} to {selected_level_code}[/dim]")
            console.print(f"[dim]DEBUG: Current language: {current_user.current_language}[/dim]")
            console.print(f"[dim]DEBUG: Before change - language_levels: {current_user.language_levels}[/dim]")

            # Update both current_level and language_levels
            current_user.current_level = selected_level_code
            current_user.language_levels[current_user.current_language] = selected_level_code

            # Save and confirm changes
            user_manager.save_user(current_user)

            # Verify the changes were made
            updated_user = user_manager.get_current_user()
            console.print(f"[dim]DEBUG: After change - current_level: {updated_user.current_level}[/dim]")
            console.print(f"[dim]DEBUG: After change - language_levels: {updated_user.language_levels}[/dim]")

            console.print(f"[{SYNTHWAVE_THEME['highlight']}]Learning level changed to {selected_level_name}[/{SYNTHWAVE_THEME['highlight']}]")
        else:
            console.print(f"[{SYNTHWAVE_THEME['accent']}]Could not update user profile[/{SYNTHWAVE_THEME['accent']}]")
    else:
        console.print("[red]Invalid choice. Please try again.[/red]")

    show_main_menu(ctx)


def show_settings(ctx):
    """Display and modify application settings."""
    config_manager = ctx.obj["config_manager"]
    settings = config_manager.settings

    options = [
        ("Change Default Language", "Select a different default language"),
        ("Change Model", "Select a different language model"),
        ("Theme Settings", "Change display theme"),
        ("Reset to Defaults", "Reset all settings to defaults"),
        ("Back", "Return to main menu")
    ]

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＳＥＴＴＩＮＧＳ】[/bold {SYNTHWAVE_THEME['secondary']}]\n")

    # Show current settings
    console.print(f"Default Language: [{SYNTHWAVE_THEME['secondary']}]{settings.default_language}[/{SYNTHWAVE_THEME['secondary']}]")
    console.print(f"Primary Model: [{SYNTHWAVE_THEME['secondary']}]{settings.primary_model}[/{SYNTHWAVE_THEME['secondary']}]")
    console.print(f"Ollama Model: [{SYNTHWAVE_THEME['secondary']}]{settings.ollama.model_name}[/{SYNTHWAVE_THEME['secondary']}]")
    console.print(f"Theme: [{SYNTHWAVE_THEME['secondary']}]{settings.theme}[/{SYNTHWAVE_THEME['secondary']}]")
    console.print("")

    # Prepare choices for questionary
    settings_choices = [{"name": f"{option} - {description}", "value": i} for i, (option, description) in enumerate(options, 1)]

    # Use questionary for interactive selection
    choice = questionary.select(
        "Select an option:",
        choices=settings_choices,
        style=RETRO_STYLE
    ).ask()

    # Default to 5 if nothing was selected
    if not choice:
        choice = 5

    if choice == 1:
        change_language_or_level(ctx)
    elif choice == 2:
        change_model(ctx)
    elif choice == 3:
        change_theme(ctx)
    elif choice == 4:
        confirm = questionary.confirm(
            "Are you sure you want to reset all settings to defaults?",
            style=RETRO_STYLE
        ).ask()

        if confirm:
            config_manager.reset_to_defaults()
            console.print(f"[{SYNTHWAVE_THEME['highlight']}]Settings reset to defaults.[/{SYNTHWAVE_THEME['highlight']}]")

    show_main_menu(ctx)


def change_model(ctx):
    """Change the current language model."""
    config_manager = ctx.obj["config_manager"]

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＳＥＬＥＣＴ　Ａ　ＭＯＤＥＬ】[/bold {SYNTHWAVE_THEME['secondary']}]\n")

    # First, check for available Ollama models
    ollama_models = discover_ollama_models()

    if not ollama_models:
        console.print(f"[{SYNTHWAVE_THEME['accent']}]No Ollama models detected. Make sure Ollama is installed and running.[/{SYNTHWAVE_THEME['accent']}]")
        return

    # Prepare choices for questionary
    model_choices = [{"name": f"ollama:{model}", "value": i} for i, model in enumerate(ollama_models, 1)]

    # Use questionary for interactive selection
    choice = questionary.select(
        "Select a model:",
        choices=model_choices,
        style=RETRO_STYLE
    ).ask()

    # Default to 1 if nothing was selected
    if not choice:
        choice = 1

    if 1 <= choice <= len(ollama_models):
        selected_model = ollama_models[choice-1]
        # Update the configuration
        config_manager.update_setting("ollama.model_name", selected_model)
        console.print(f"[{SYNTHWAVE_THEME['highlight']}]Model set to: [bold]{selected_model}[/bold][/{SYNTHWAVE_THEME['highlight']}]")
    else:
        console.print(f"[{SYNTHWAVE_THEME['primary']}]Invalid choice. No changes made.[/{SYNTHWAVE_THEME['primary']}]")

    # Return to settings menu
    show_settings(ctx)


def change_theme(ctx):
    """Change the application theme."""
    config_manager = ctx.obj["config_manager"]

    themes = ["default", "dark", "light", "colorful"]

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＳＥＬＥＣＴ　Ａ　ＴＨＥＭＥ】[/bold {SYNTHWAVE_THEME['secondary']}]\n")

    # Prepare choices for questionary
    theme_choices = [{"name": theme, "value": i} for i, theme in enumerate(themes, 1)]

    # Use questionary for interactive selection
    choice = questionary.select(
        "Select a theme:",
        choices=theme_choices,
        style=RETRO_STYLE
    ).ask()

    # Default to 1 if nothing was selected
    if not choice:
        choice = 1

    if 1 <= choice <= len(themes):
        selected_theme = themes[choice-1]
        config_manager.update_setting("theme", selected_theme)
        console.print(f"[{SYNTHWAVE_THEME['highlight']}]Theme set to: [bold]{selected_theme}[/bold][/{SYNTHWAVE_THEME['highlight']}]")
    else:
        console.print(f"[{SYNTHWAVE_THEME['primary']}]Invalid choice. No changes made.[/{SYNTHWAVE_THEME['primary']}]")

    # Return to settings menu
    show_settings(ctx)


def show_progress(ctx):
    """Display detailed progress statistics and dashboard."""
    from rich.panel import Panel
    from rich.columns import Columns
    from rich.table import Table
    from rich.progress import Progress, BarColumn, TextColumn
    from rich.text import Text
    from datetime import datetime, timedelta

    # Get user data and database connection
    user_manager = ctx.obj["user_manager"]
    user = user_manager.get_current_user()
    if not user:
        console.print("[bold red]Error: No user profile found[/bold red]")
        return

    # Import database module here to avoid circular imports
    try:
        from langue.storage import get_db_manager
        db = ctx.obj.get("db_manager")
        if db is None:
            db = get_db_manager()
            ctx.obj["db_manager"] = db
    except Exception as e:
        console.print(f"[bold red]Error accessing database: {e}[/bold red]")
        return

    # Get comprehensive user stats
    try:
        stats = db.get_user_stats(user.user_id)
    except Exception as e:
        console.print(f"[bold red]Error getting user stats: {e}[/bold red]")
        stats = {
            'total_points': 0,
            'streak_days': 0,
            'total_words': 0,
            'activities_completed': 0,
            'learning_time': 0,
            'languages': {},
            'activity_breakdown': {}
        }

    # Get flashcard history for visualizing progress
    try:
        flashcard_history = db.get_flashcard_history(user.user_id)
    except Exception as e:
        console.print(f"[bold red]Error getting flashcard history: {e}[/bold red]")
        flashcard_history = []

    console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ】[/bold {SYNTHWAVE_THEME['secondary']}]")

    # === OVERVIEW SECTION ===
    console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]✨ Learning Overview[/bold {SYNTHWAVE_THEME['primary']}]")

    # Create overview panel with key stats
    overview_text = Text()
    overview_text.append(f"📊 Total Points: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
    overview_text.append(f"{stats['total_points']}\n", style=SYNTHWAVE_THEME['secondary'])

    overview_text.append(f"🔥 Current Streak: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
    overview_text.append(f"{stats.get('streak_days', 0)} days\n", style=SYNTHWAVE_THEME['secondary'])

    overview_text.append(f"📚 Total Words Learned: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
    overview_text.append(f"{stats['total_words']}\n", style=SYNTHWAVE_THEME['secondary'])

    overview_text.append(f"⏱️ Total Learning Time: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
    learning_hours = stats['learning_time'] / 3600 if stats['learning_time'] else 0
    if learning_hours >= 1:
        overview_text.append(f"{learning_hours:.1f} hours\n", style=SYNTHWAVE_THEME['secondary'])
    else:
        learning_minutes = stats['learning_time'] / 60 if stats['learning_time'] else 0
        overview_text.append(f"{learning_minutes:.1f} minutes\n", style=SYNTHWAVE_THEME['secondary'])

    overview_text.append(f"🎯 Activities Completed: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
    overview_text.append(f"{stats['activities_completed']}\n", style=SYNTHWAVE_THEME['secondary'])

    console.print(Panel(
        overview_text,
        title="[bold]Your Language Learning Journey[/bold]",
        border_style=PANEL_BORDER_STYLE,
        expand=False
    ))

    # Create streak visualization
    streak_days = stats.get('streak_days', 0)
    streak_viz = Text()

    if streak_days > 0:
        streak_viz.append("\n🔥 Streak: ", style=f"bold {SYNTHWAVE_THEME['primary']}")

        # Visual representation with fire emojis
        flames = min(streak_days, 30)  # Cap at 30 for display
        for i in range(flames):
            if i % 7 == 0 and i > 0:  # Highlight week milestones
                streak_viz.append("🌟", style=SYNTHWAVE_THEME['highlight'])
            else:
                streak_viz.append("🔥", style=SYNTHWAVE_THEME['secondary'])

        if streak_days > 30:
            streak_viz.append(f" +{streak_days - 30} more", style=SYNTHWAVE_THEME['text'])

        streak_viz.append(f"\n[{SYNTHWAVE_THEME['secondary']}]Keep the streak going! Come back tomorrow for more points.[/{SYNTHWAVE_THEME['secondary']}]\n")
    else:
        streak_viz.append("\n[italic]Start your learning streak today![/italic]\n", style=SYNTHWAVE_THEME['accent'])

    console.print(streak_viz)

    # === LANGUAGE PROGRESS SECTION ===
    if stats['languages']:
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]🌍 Language Progress[/bold {SYNTHWAVE_THEME['primary']}]")

        # Create progress bars for each language
        language_progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            expand=True
        )

        # Targets based on CEFR levels
        level_targets = {
            "a1": 500, "a2": 1000, "b1": 2000, "b2": 4000, "c1": 8000, "c2": 16000
        }

        for language, lang_stats in stats['languages'].items():
            word_count = lang_stats['word_count']

            # Get current level for this language
            current_level = user.language_levels.get(language, "a1").lower()
            target = level_targets.get(current_level, 500)  # Default to A1 target

            # Add task for this language
            language_progress.add_task(
                f"[bold]{language}[/bold] (Level {current_level.upper()})",
                total=target,
                completed=word_count
            )

        console.print(Panel(
            language_progress,
            title=f"[bold]Vocabulary Progress by Language[/bold]",
            subtitle=f"Words learned toward level completion",
            border_style=PANEL_BORDER_STYLE
        ))

    # === ACTIVITY BREAKDOWN ===
    if stats['activity_breakdown']:
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]🎮 Activity Stats[/bold {SYNTHWAVE_THEME['primary']}]")

        # Create table for activity stats
        activity_table = Table(
            show_header=True,
            header_style=f"bold {SYNTHWAVE_THEME['highlight']}",
            border_style=PANEL_BORDER_STYLE,
            title="Activity Performance"
        )

        activity_table.add_column("Activity", style=f"bold {SYNTHWAVE_THEME['secondary']}")
        activity_table.add_column("Count", justify="right")
        activity_table.add_column("Points", justify="right")
        activity_table.add_column("Words", justify="right")
        activity_table.add_column("Time", justify="right")

        # Map internal activity names to display names
        activity_display_names = {
            "flashcards": "Flashcards",
            "fill_blank": "Fill in the Blank",
            "translation": "Translation",
            "reading": "Reading",
            "chat": "Conversation"
        }

        # Add rows for each activity
        for activity, activity_stats in stats['activity_breakdown'].items():
            display_name = activity_display_names.get(activity, activity.title())

            # Format time
            duration_seconds = activity_stats.get('duration', 0)
            if duration_seconds:
                if duration_seconds >= 3600:
                    duration_str = f"{duration_seconds / 3600:.1f} hrs"
                else:
                    duration_str = f"{duration_seconds / 60:.1f} min"
            else:
                duration_str = "-"

            activity_table.add_row(
                display_name,
                str(activity_stats.get('count', 0)),
                str(activity_stats.get('points', 0)),
                str(activity_stats.get('words', 0)),
                duration_str
            )

        console.print(activity_table)

    # === WEEKLY ACTIVITY VISUALIZATION ===
    console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]📆 Weekly Activity[/bold {SYNTHWAVE_THEME['primary']}]")

    # Get activity data from past week
    now = datetime.now()
    one_week_ago = now - timedelta(days=7)

    # Get all activities in the past week
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        # Format the date string correctly for SQLite comparison
        one_week_ago_str = one_week_ago.strftime("%Y-%m-%d")

        cursor.execute(
            """
            SELECT completed_at, points_earned
            FROM activities
            WHERE user_id = ? AND completed_at >= ?
            ORDER BY completed_at
            """,
            (user.user_id, one_week_ago_str)
        )

        weekly_activities = cursor.fetchall()
        conn.close()
    except Exception as e:
        console.print(f"[bold red]Error loading activities: {e}[/bold red]")
        weekly_activities = []

    # Group by day
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    activity_by_day = {day: 0 for day in days_of_week}
    points_by_day = {day: 0 for day in days_of_week}

    for row in weekly_activities:
        try:
            # Handle both dict-like and tuple-like results from different DB drivers
            if isinstance(row, dict) and 'completed_at' in row and row['completed_at']:
                activity_date = datetime.fromisoformat(row['completed_at'])
                points = row.get('points_earned', 0) or 0
            elif isinstance(row, (tuple, list)) and len(row) >= 2:
                completed_at = row[0]
                points = row[1] or 0
                if completed_at:
                    activity_date = datetime.fromisoformat(completed_at)
                else:
                    continue
            else:
                continue

            day_name = activity_date.strftime("%A")
            activity_by_day[day_name] += 1
            points_by_day[day_name] += points

        except (ValueError, TypeError, IndexError) as e:
            continue

    # Create weekly activity chart
    weekly_progress = Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=50),
        TextColumn("{task.completed} activities"),
        expand=True
    )

    max_activities = max(activity_by_day.values()) if activity_by_day.values() else 1

    # Get today's day name
    today = now.strftime("%A")

    # Add tasks for each day, rotating to make today the last day
    today_index = days_of_week.index(today)
    ordered_days = days_of_week[today_index+1:] + days_of_week[:today_index+1]

    for day in ordered_days:
        count = activity_by_day[day]
        points = points_by_day[day]

        # Highlight today
        if day == today:
            day_style = f"bold {SYNTHWAVE_THEME['highlight']}"
            bar_style = SYNTHWAVE_THEME['highlight']
        else:
            day_style = SYNTHWAVE_THEME['secondary']
            bar_style = SYNTHWAVE_THEME['primary']

        day_display = f"[{day_style}]{day[:3]}[/{day_style}]"
        if points > 0:
            day_display += f" (+{points} pts)"

        task_id = weekly_progress.add_task(
            day_display,
            total=max(max_activities, 3),  # At least 3 for scale
            completed=count,
            visible=True
        )

        # Change bar color
        weekly_progress.tasks[task_id].fields["bar.style"] = bar_style

    console.print(Panel(
        weekly_progress,
        title="[bold]This Week's Learning Activity[/bold]",
        border_style=PANEL_BORDER_STYLE
    ))

    # === ACHIEVEMENT BADGES ===
    if user.achievements:
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]🏆 Achievements[/bold {SYNTHWAVE_THEME['primary']}]")

        achievement_panels = []

        # Create a panel for each achievement
        for achievement in user.achievements:
            # Choose an emoji based on achievement name
            emoji = "🏆"
            if "streak" in achievement.lower():
                emoji = "🔥"
            elif "point" in achievement.lower():
                emoji = "✨"
            elif "word" in achievement.lower():
                emoji = "📚"
            elif "flashcard" in achievement.lower():
                emoji = "🎴"
            elif "fill" in achievement.lower() or "blank" in achievement.lower():
                emoji = "🖊️"
            elif "conversation" in achievement.lower() or "chat" in achievement.lower():
                emoji = "💬"
            elif "reading" in achievement.lower():
                emoji = "📖"
            elif "translation" in achievement.lower():
                emoji = "🔄"

            panel = Panel(
                f"{emoji} {achievement}",
                border_style=SYNTHWAVE_THEME['highlight'],
                width=30
            )
            achievement_panels.append(panel)

        # Display achievements in columns
        console.print(Columns(achievement_panels))

    # === FILL-IN-THE-BLANK PERFORMANCE ===
    try:
        fill_blank_stats = db.get_fill_blank_stats(user.user_id)
        if fill_blank_stats and fill_blank_stats['total_attempts'] > 0:
            console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]🖊️ Fill-in-the-Blank Performance[/bold {SYNTHWAVE_THEME['primary']}]")

            # Create fill-in-the-blank stats panel
            fill_blank_text = Text()
            fill_blank_text.append(f"Total Attempts: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
            fill_blank_text.append(f"{fill_blank_stats['total_attempts']}\n", style=SYNTHWAVE_THEME['secondary'])

            fill_blank_text.append(f"Correct Answers: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
            fill_blank_text.append(f"{fill_blank_stats['correct_attempts']} ({fill_blank_stats['success_rate']:.1f}%)\n", style=SYNTHWAVE_THEME['secondary'])

            fill_blank_text.append(f"Unique Words Practiced: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
            fill_blank_text.append(f"{fill_blank_stats['unique_words']}\n", style=SYNTHWAVE_THEME['secondary'])

            console.print(Panel(
                fill_blank_text,
                title="[bold]Fill-in-the-Blank Progress[/bold]",
                border_style=PANEL_BORDER_STYLE
            ))

            # Show accuracy progress bar
            fill_blank_progress = Progress(
                TextColumn("[progress.description]{task.description}"),
                BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                expand=True
            )

            fill_blank_progress.add_task("Accuracy", total=100, completed=fill_blank_stats['success_rate'])

            console.print(Panel(
                fill_blank_progress,
                title="[bold]Fill-in-the-Blank Accuracy[/bold]",
                border_style=PANEL_BORDER_STYLE
            ))

            # Show challenging words if available
            if fill_blank_stats['challenging_words'] and len(fill_blank_stats['challenging_words']) > 0:
                console.print(f"\n[bold {SYNTHWAVE_THEME['accent']}]Challenging Words:[/bold {SYNTHWAVE_THEME['accent']}]")

                challenging_progress = Progress(
                    TextColumn("[progress.description]{task.description}"),
                    BarColumn(bar_width=40, style=SYNTHWAVE_THEME['primary']),
                    TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                    expand=True
                )

                # Add tasks for difficult words
                for word in fill_blank_stats['challenging_words'][:5]:
                    success_rate = word['success_rate'] * 100 if word['success_rate'] is not None else 0
                    challenging_progress.add_task(f"[bold]{word['word']}[/bold]", total=100, completed=success_rate)

                console.print(Panel(
                    challenging_progress,
                    title="[bold]Words Needing Practice[/bold]",
                    border_style=PANEL_BORDER_STYLE
                ))
    except Exception as e:
        console.print(f"[red]Error displaying fill-in-the-blank stats: {e}[/red]")

    # === FLASHCARD PERFORMANCE ===
    if flashcard_history and len(flashcard_history) > 0:
        console.print(f"[bold {SYNTHWAVE_THEME['primary']}]🎴 Flashcard Performance[/bold {SYNTHWAVE_THEME['primary']}]")

        # Group flashcards by correctness
        correct_count = sum(1 for card in flashcard_history if card['correct'])
        total_count = len(flashcard_history)
        correct_percent = (correct_count / total_count) * 100 if total_count > 0 else 0

        # Get recent scores
        recent_scores = []
        for card in flashcard_history[:min(20, len(flashcard_history))]:
            if card and 'score' in card and card['score'] is not None:
                recent_scores.append(card['score'])
        avg_score = sum(recent_scores) / len(recent_scores) if recent_scores else 0

        # Create flashcard stats panel
        flashcard_stats = Text()
        flashcard_stats.append(f"Total Flashcards Attempted: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
        flashcard_stats.append(f"{total_count}\n", style=SYNTHWAVE_THEME['secondary'])

        flashcard_stats.append(f"Correct Answers: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
        flashcard_stats.append(f"{correct_count} ({correct_percent:.1f}%)\n", style=SYNTHWAVE_THEME['secondary'])

        flashcard_stats.append(f"Recent Average Score: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
        flashcard_stats.append(f"{avg_score:.1f}/10\n", style=SYNTHWAVE_THEME['secondary'])

        # Show progress bar for correctness
        correct_progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            expand=True
        )

        correct_progress.add_task("Accuracy", total=100, completed=correct_percent)

        flashcard_panel_content = Text()
        flashcard_panel_content.append(flashcard_stats)

        console.print(Panel(
            flashcard_panel_content,
            title="[bold]Flashcard Learning Progress[/bold]",
            border_style=PANEL_BORDER_STYLE
        ))

        console.print(Panel(
            correct_progress,
            title="[bold]Accuracy Rate[/bold]",
            border_style=PANEL_BORDER_STYLE
        ))

        # Show difficult words
        if total_count > 5:
            # Find words with low scores
            word_scores = {}
            for card in flashcard_history:
                if not card or 'word' not in card or 'score' not in card:
                    continue
                word = card['word']
                if not word:
                    continue
                if word not in word_scores:
                    word_scores[word] = {'total': 0, 'count': 0}
                score = card.get('score', 0)
                if score is not None:
                    word_scores[word]['total'] += score
                    word_scores[word]['count'] += 1

            # Calculate average scores
            avg_word_scores = {
                word: data['total'] / data['count']
                for word, data in word_scores.items()
                if data['count'] >= 2  # Only include words with multiple attempts
            }

            # Find difficult words (score < 6)
            difficult_words = {
                word: score for word, score in avg_word_scores.items()
                if score < 6
            }

            if difficult_words:
                console.print(f"\n[bold {SYNTHWAVE_THEME['accent']}]Words to Practice:[/bold {SYNTHWAVE_THEME['accent']}]")

                difficult_progress = Progress(
                    TextColumn("[progress.description]{task.description}"),
                    BarColumn(bar_width=40, style=SYNTHWAVE_THEME['primary']),
                    TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                    expand=True
                )

                # Add tasks for difficult words
                for word, score in list(sorted(difficult_words.items(), key=lambda x: x[1]))[:5]:
                    difficult_progress.add_task(f"[bold]{word}[/bold]", total=10, completed=int(score))

                console.print(Panel(
                    difficult_progress,
                    title="[bold]Words Needing Review[/bold]",
                    border_style=PANEL_BORDER_STYLE
                ))

    # === LEVEL PROGRESS ===
    if stats['languages'] and user.current_language in stats['languages']:
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]📊 Level Progress[/bold {SYNTHWAVE_THEME['primary']}]")

        word_count = stats['languages'][user.current_language]['word_count']
        current_level = user.current_level.lower()

        # Level thresholds
        level_thresholds = {
            "a1": 500, "a2": 1000, "b1": 2000, "b2": 4000, "c1": 8000, "c2": 16000
        }

        # Level display names
        level_names = {
            "a1": "A1 (Beginner)",
            "a2": "A2 (Elementary)",
            "b1": "B1 (Intermediate)",
            "b2": "B2 (Upper Intermediate)",
            "c1": "C1 (Advanced)",
            "c2": "C2 (Proficiency)"
        }

        current_threshold = level_thresholds.get(current_level, 500)

        level_progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            expand=True
        )

        # Add current level progress
        level_progress.add_task(
            f"[bold]{level_names.get(current_level, current_level.upper())}[/bold]",
            total=current_threshold,
            completed=min(word_count, current_threshold)
        )

        console.print(Panel(
            level_progress,
            title="[bold]Progress in Current Level[/bold]",
            border_style=PANEL_BORDER_STYLE
        ))

    # Continue button
    console.print("\nPress Enter to return to the main menu...", style=SYNTHWAVE_THEME['accent'])
    try:
        input()
    except (EOFError, KeyboardInterrupt):
        pass
    show_main_menu(ctx)


def show_help():
    """Display help information."""
    help_text = """
    [bold]Langue - Language Learning Assistant[/bold]

    [underline]Getting Started:[/underline]
    - Choose a language to learn from the main menu
    - Select an activity to begin practicing
    - Your progress is automatically saved

    [underline]Activities:[/underline]
    - [bold]Flashcards[/bold]: Practice vocabulary words and phrases
    - [bold]Fill in the Blank[/bold]: Complete sentences with missing words
    - [bold]Conversation[/bold]: Practice speaking with an AI language partner
    - [bold]Reading Comprehension[/bold]: Read passages and answer questions
    - [bold]Translation Exercise[/bold]: Translate phrases between languages

    [underline]Commands:[/underline]
    - [bold]langue[/bold]: Launch the main application
    - [bold]langue --language LANG[/bold]: Start with a specific language
    - [bold]langue flashcards[/bold]: Launch directly into flashcard activity

    For more information, visit: https://github.com/yourusername/langue
    """

    console.print(Panel(help_text, title="【﻿ＨＥＬＰ　＆　ＩＮＦＯＲＭＡＴＩＯＮ】", border_style=PANEL_BORDER_STYLE))
    questionary.press_any_key_to_continue(
        message="\nPress any key to return to the main menu...",
        style=RETRO_STYLE
    ).ask()
    show_main_menu(click.Context(main))


# Register activity-specific commands
register_activity_commands(main)

if __name__ == "__main__":
    main()
