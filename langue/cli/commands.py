"""
Command-line interface commands for Langue.

This module provides the CLI commands for the Langue application.
"""

import click
from typing import Optional

from rich.console import Console
from langue.models.discovery import discover_ollama_models
from langue.tools.library_generator import library_command

# Initialize console for rich output
console = Console()


def register_activity_commands(main_group):
    """Register activity-specific commands with the main CLI group.

    Args:
        main_group: The main Click command group to attach commands to
    """

    @main_group.command()
    @click.option("--language", "-l", help="Language to practice")
    @click.option("--count", "-c", type=int, default=10, help="Number of flashcards")
    @click.option("--difficulty", "-d", type=int, default=0, help="Difficulty level (1-6, 0 to use user's level)")
    @click.pass_context
    def flashcards(ctx, language: Optional[str], count: int, difficulty: int):
        """Practice vocabulary with flashcards."""
        console.print("[bold green]Starting flashcard activity[/bold green]")
        console.print("[dim]DEBUG: Starting flashcards command[/dim]")

        # Get user and config from context
        user_manager = ctx.obj["user_manager"]
        config_manager = ctx.obj["config_manager"]

        # Get the configured model
        model_name = config_manager.settings.ollama.model_name

        # Get current user and update language if specified
        user = user_manager.get_current_user()
        if language:
            user.current_language = language
            user_manager.save_user(user)

        # Get level from user profile or map from difficulty
        # Check both current_level and language_levels for the current language
        # Get user data

        if hasattr(user, 'current_level'):
            user_level = user.current_level
        elif hasattr(user, 'language_levels') and user.current_language in user.language_levels:
            user_level = user.language_levels[user.current_language]
        else:
            user_level = "a1"

        # Always normalize level to lowercase
        if user_level:
            user_level = user_level.lower()

        # If difficulty is explicitly specified, override user's level
        if difficulty > 0:
            level_map = {1: "a1", 2: "a2", 3: "b1", 4: "b2", 5: "c1", 6: "c2"}
            level = level_map.get(difficulty, "a1").lower()
        else:
            # Otherwise use the user's configured level
            level = user_level.lower() if user_level else "a1"

        # Display activity settings
        console.print(f"Language: [cyan]{user.current_language}[/cyan]")
        console.print(f"Cards: [cyan]{count}[/cyan]")
        if difficulty > 0:
            console.print(f"Difficulty: [cyan]{difficulty}[/cyan] (manually set)")
        else:
            console.print(f"Difficulty: [cyan]Using saved level[/cyan]")
        console.print(f"Level: [cyan]{level.upper()}[/cyan]")

        # Placeholder for actual flashcard implementation
        # Create and start the flashcard activity
        from langue.activities.flashcards import FlashcardActivity

        # Create flashcard activity with the appropriate parameters

        activity = FlashcardActivity(
            language=user.current_language,
            difficulty=difficulty,
            model_name="claude:claude-3-haiku-20240307",  # Use Claude Haiku 3.5 directly
            level=level,
            user_id=user.user_id
        )
        # Start the activity
        activity.start()

        # Track activity in user profile
        user_manager.track_activity("flashcards", words=list(activity.words_encountered), points=activity.points_earned)

    @main_group.command()
    @click.option("--language", "-l", help="Language to practice")
    @click.option("--count", "-c", type=int, default=5, help="Number of sentences")
    @click.option("--difficulty", "-d", type=int, default=0, help="Difficulty level (1-6, 0 to use user's level)")
    @click.pass_context
    def fill_blank(ctx, language: Optional[str], count: int, difficulty: int):
        """Complete sentences with missing words."""
        console.print("[bold green]Starting fill-in-the-blank activity[/bold green]")

        # Get user and config from context
        user_manager = ctx.obj["user_manager"]
        config_manager = ctx.obj["config_manager"]

        # Get the configured model
        model_name = config_manager.settings.ollama.model_name

        # Get current user and update language if specified
        user = user_manager.get_current_user()
        if language:
            user.current_language = language
            user_manager.save_user(user)

        # Get level from user profile or map from difficulty
        # Check both current_level and language_levels for the current language
        if hasattr(user, 'current_level'):
            user_level = user.current_level
        elif hasattr(user, 'language_levels') and user.current_language in user.language_levels:
            user_level = user.language_levels[user.current_language]
        else:
            user_level = "a1"

        # If difficulty is explicitly specified, override user's level
        if difficulty > 0:
            level_map = {1: "a1", 2: "a2", 3: "b1", 4: "b2", 5: "c1", 6: "c2"}
            level = level_map.get(difficulty, "a1").lower()
        else:
            # Otherwise use the user's configured level
            level = user_level.lower() if user_level else "a1"

        # Display activity settings
        console.print(f"Language: [cyan]{user.current_language}[/cyan]")
        console.print(f"Sentences: [cyan]{count}[/cyan]")
        console.print(f"Difficulty: [cyan]{difficulty}[/cyan]")
        console.print(f"Level: [cyan]{level.upper()}[/cyan]")

        # Placeholder for actual implementation
        # Create and start the fill-in-the-blank activity
        from langue.activities.fill_blank import FillBlankActivity

        activity = FillBlankActivity(
            language=user.current_language,
            difficulty=difficulty,
            model_name="claude:claude-3-haiku-20240307",  # Use Claude Haiku 3.5 directly
            show_options=True,
            level=level,
            user_id=user.user_id
        )
        console.print(f"[dim]DEBUG: Passing level={level} to FillBlankActivity[/dim]")
        activity.start()

        # Track activity in user profile
        user_manager.track_activity("fill_blank", words=list(activity.words_encountered), points=activity.points_earned)

    @main_group.command()
    @click.option("--language", "-l", help="Language to practice")
    @click.option("--difficulty", "-d", type=int, default=0, help="Complexity level (1-6, 0 to use user's level)")
    @click.option("--topic", "-t", help="Conversation topic")
    @click.option("--duration", type=int, default=10, help="Conversation duration in minutes")
    @click.pass_context
    def chat(ctx, language: Optional[str], difficulty: int, topic: Optional[str], duration: int):
        """Practice conversation with an AI language partner."""
        console.print("[bold green]Starting conversation practice[/bold green]")

        # Get user and config from context
        user_manager = ctx.obj["user_manager"]
        config_manager = ctx.obj["config_manager"]

        # Get the configured model
        model_name = config_manager.settings.ollama.model_name

        # Get current user and update language if specified
        user = user_manager.get_current_user()
        if language:
            user.current_language = language
            user_manager.save_user(user)

        # Get level from user profile or map from difficulty
        # Check both current_level and language_levels for the current language
        if hasattr(user, 'current_level'):
            user_level = user.current_level
        elif hasattr(user, 'language_levels') and user.current_language in user.language_levels:
            user_level = user.language_levels[user.current_language]
        else:
            user_level = "a1"

        # If difficulty is explicitly specified, override user's level
        if difficulty > 0:
            level_map = {1: "a1", 2: "a2", 3: "b1", 4: "b2", 5: "c1", 6: "c2"}
            level = level_map.get(difficulty, "a1").lower()
        else:
            # Otherwise use the user's configured level
            level = user_level.lower() if user_level else "a1"

        # Display activity settings
        console.print(f"Language: [cyan]{user.current_language}[/cyan]")
        console.print(f"Complexity: [cyan]{difficulty}[/cyan]")
        console.print(f"Level: [cyan]{level.upper()}[/cyan]")
        if topic:
            console.print(f"Topic: [cyan]{topic}[/cyan]")
        console.print(f"Duration: [cyan]{duration} minutes[/cyan]")

        # Placeholder for actual implementation
        # Create and start the conversation activity
        from langue.activities.chat import ChatActivity

        activity = ChatActivity(
            language=user.current_language,
            difficulty=difficulty,
            model_name="claude:claude-3-haiku-20240307",  # Use Claude Haiku 3.5 directly
            topic=topic,
            duration_minutes=duration,
            level=level,
            user_id=user.user_id
        )
        console.print(f"[dim]DEBUG: Passing level={level} to ChatActivity[/dim]")
        activity.start()

        # Track activity in user profile
        user_manager.track_activity("chat", words=list(activity.words_encountered), points=activity.points_earned)

    @main_group.command()
    @click.option("--language", "-l", help="Language to practice")
    @click.option("--difficulty", "-d", type=int, default=0, help="Difficulty level (1-6, 0 to use user's level)")
    @click.option("--topic", "-t", help="Reading topic")
    @click.pass_context
    def reading(ctx, language: Optional[str], difficulty: int, topic: Optional[str]):
        """Read a passage and answer questions about it."""
        console.print("[bold green]Starting reading comprehension activity[/bold green]")

        # Get user and config from context
        user_manager = ctx.obj["user_manager"]
        config_manager = ctx.obj["config_manager"]

        # Get the configured model
        model_name = config_manager.settings.ollama.model_name

        # Get current user and update language if specified
        user = user_manager.get_current_user()
        if language:
            user.current_language = language
            user_manager.save_user(user)

        # Get level from user profile or map from difficulty
        # Check both current_level and language_levels for the current language
        if hasattr(user, 'current_level'):
            user_level = user.current_level
        elif hasattr(user, 'language_levels') and user.current_language in user.language_levels:
            user_level = user.language_levels[user.current_language]
        else:
            user_level = "a1"

        # If difficulty is explicitly specified, override user's level
        if difficulty > 0:
            level_map = {1: "a1", 2: "a2", 3: "b1", 4: "b2", 5: "c1", 6: "c2"}
            level = level_map.get(difficulty, "a1").lower()
        else:
            # Otherwise use the user's configured level
            level = user_level.lower() if user_level else "a1"

        # Display activity settings
        console.print(f"Language: [cyan]{user.current_language}[/cyan]")
        console.print(f"Difficulty: [cyan]{difficulty}[/cyan]")
        console.print(f"Level: [cyan]{level.upper()}[/cyan]")
        if topic:
            console.print(f"Topic: [cyan]{topic}[/cyan]")

        # Placeholder for actual implementation
        # Create and start the reading comprehension activity
        from langue.activities.reading import ReadingActivity

        activity = ReadingActivity(
            language=user.current_language,
            difficulty=difficulty,
            model_name="claude:claude-3-haiku-20240307",  # Use Claude Haiku 3.5 directly
            topic=topic,
            level=level,
            user_id=user.user_id
        )
        activity.start()

        # Track activity in user profile
        user_manager.track_activity("reading", words=list(activity.words_encountered), points=activity.points_earned)

    @main_group.command()
    @click.option("--language", "-l", help="Language to practice")
    @click.option("--count", "-c", type=int, default=5, help="Number of phrases")
    @click.option("--difficulty", "-d", type=int, default=0, help="Difficulty level (1-6, 0 to use user's level)")
    @click.pass_context
    def translate(ctx, language: Optional[str], count: int, difficulty: int):
        """Translate phrases between languages."""
        console.print("[bold green]Starting translation exercise[/bold green]")

        # Get user and config from context
        user_manager = ctx.obj["user_manager"]
        config_manager = ctx.obj["config_manager"]

        # Get the configured model
        model_name = config_manager.settings.ollama.model_name

        # Get current user and update language if specified
        user = user_manager.get_current_user()
        if language:
            user.current_language = language
            user_manager.save_user(user)

        # Get level from user profile or map from difficulty
        # Check both current_level and language_levels for the current language
        if hasattr(user, 'current_level'):
            user_level = user.current_level
        elif hasattr(user, 'language_levels') and user.current_language in user.language_levels:
            user_level = user.language_levels[user.current_language]
        else:
            user_level = "a1"

        # If difficulty is explicitly specified, override user's level
        if difficulty > 0:
            level_map = {1: "a1", 2: "a2", 3: "b1", 4: "b2", 5: "c1", 6: "c2"}
            level = level_map.get(difficulty, "a1").lower()
        else:
            # Otherwise use the user's configured level
            level = user_level.lower() if user_level else "a1"

        # Display activity settings
        console.print(f"Language: [cyan]{user.current_language}[/cyan]")
        console.print(f"Phrases: [cyan]{count}[/cyan]")
        console.print(f"Difficulty: [cyan]{difficulty}[/cyan]")
        console.print(f"Level: [cyan]{level.upper()}[/cyan]")

        # Placeholder for actual implementation
        # Create and start the translation activity
        from langue.activities.translation import TranslationActivity

        activity = TranslationActivity(
            language=user.current_language,
            difficulty=difficulty,
            model_name="claude:claude-3-haiku-20240307",  # Use Claude Haiku 3.5 directly
            direction="both",
            level=level,
            user_id=user.user_id
        )
        activity.start()

        # Track activity in user profile
        user_manager.track_activity("translation", words=list(activity.words_encountered), points=activity.points_earned)

    # Register the library generator command with Claude as default model
    main_group.add_command(
        click.option('--model', default="claude:claude-3-haiku-20240307", help='Specify LLM model to use')(
            library_command
        ),
        name="library"
    )

    @main_group.command()
    @click.option("--key", "-k", help="Setting key to update")
    @click.option("--value", "-v", help="New value for the setting")
    @click.option("--list", "-l", is_flag=True, help="List current settings")
    @click.pass_context
    def settings(ctx, key: Optional[str], value: Optional[str], list: bool):
        """View or update application settings."""
        config_manager = ctx.obj["config_manager"]

        if list:
            console.print("[bold]Current Settings:[/bold]")
            # For demonstration, show a few key settings
            settings = config_manager.settings
            console.print(f"Default Language: [cyan]{settings.default_language}[/cyan]")
            console.print(f"Primary Model: [cyan]{settings.primary_model}[/cyan]")
            console.print(f"Ollama Model: [cyan]{settings.ollama.model_name}[/cyan]")
            console.print(f"Theme: [cyan]{settings.theme}[/cyan]")

            # Show available Ollama models
            console.print("\n[bold]Available Ollama models:[/bold]")
            ollama_models = discover_ollama_models()
            if ollama_models:
                for model in ollama_models:
                    is_current = model == settings.ollama.model_name
                    model_text = f"{model} [green](current)[/green]" if is_current else model
                    console.print(f"  - [cyan]{model_text}[/cyan]")
            else:
                console.print("  [yellow]No Ollama models available[/yellow]")
            return

        if key and value:
            success = config_manager.update_setting(key, value)
            if success:
                console.print(f"[green]Updated setting [bold]{key}[/bold] to [bold]{value}[/bold][/green]")
            else:
                console.print(f"[red]Failed to update setting [bold]{key}[/bold][/red]")
        elif key:
            value = config_manager.get_setting(key, "Not found")
            console.print(f"Setting [bold]{key}[/bold]: [cyan]{value}[/cyan]")
        else:
            console.print("[yellow]Please specify a setting key to view or update.[/yellow]")
            console.print("Use [bold]--list[/bold] to see current settings.")
