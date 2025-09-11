"""
Flashcard Visualization Module for Langue.

This module provides functions for visualizing flashcard learning progress
using rich text components and interactive progress bars.
"""

from typing import Dict, List, Any, Optional
import statistics
from datetime import datetime

from rich.progress import Progress, BarColumn, TextColumn
from rich.columns import Columns
from rich.panel import Panel
from rich.text import Text

# Import console with 80's theme from base activity
from langue.activities.base import console, SYNTHWAVE_THEME, PANEL_BORDER_STYLE


def create_progress_visualization(flashcard_history, words_to_practice: List[str],
                                  user_id: str, language: str) -> None:
    """Create and display visualizations for flashcard progress.

    Args:
        flashcard_history: FlashcardHistory object containing history data
        words_to_practice: List of words that need more practice
        user_id: User ID for database lookups
        language: Language being practiced
    """
    # Show word mastery progress bars
    _show_word_mastery_bars(flashcard_history, words_to_practice)

    # Show learning trend if enough data
    _show_learning_trend(flashcard_history)


def _show_word_mastery_bars(flashcard_history, words_to_practice: List[str]) -> None:
    """Show progress bars for word mastery levels.

    Args:
        flashcard_history: FlashcardHistory object
        words_to_practice: List of words that need more practice
    """
    if not words_to_practice:
        return

    console.print("\n[bold]Words that need more practice:[/bold]")

    progress_panels = []
    for word in words_to_practice:
        # Get word stats
        avg_score = flashcard_history.get_average_score(word)
        attempts = len(flashcard_history.get_word_attempts(word))
        success_rate = flashcard_history.get_success_rate(word)

        # Create a progress panel for this word
        progress = Progress(
            TextColumn(f"[bold]{word}[/bold]"),
            BarColumn(bar_width=40, style=SYNTHWAVE_THEME['primary']),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            expand=True
        )

        # Add task for mastery progress
        progress.add_task("", total=10, completed=int(min(10, avg_score)))

        # Create panel with progress and stats
        panel = Panel(
            progress,
            title=f"Mastery: {avg_score:.1f}/10",
            subtitle=f"Attempts: {attempts} | Success: {success_rate:.1f}%",
            border_style=PANEL_BORDER_STYLE,
            width=60
        )
        progress_panels.append(panel)

    # Display all progress panels
    if progress_panels:
        console.print(Columns(progress_panels))


def _show_learning_trend(flashcard_history) -> None:
    """Show learning trend visualization.

    Args:
        flashcard_history: FlashcardHistory object
    """
    # Get all scores from all words
    all_scores = []
    for word in flashcard_history.to_dict():
        word_data = flashcard_history.to_dict()[word]
        for attempt in word_data.get("attempts", []):
            all_scores.append(attempt.get("score", 0))

    if len(all_scores) < 5:
        return

    console.print("\n[bold]Learning Trend:[/bold]")

    # Group scores by chunks to show trend
    chunk_size = max(1, len(all_scores) // 5)  # Divide into ~5 chunks
    chunks = [all_scores[i:i+chunk_size] for i in range(0, len(all_scores), chunk_size)]

    # Calculate average score for each chunk
    avg_scores = [sum(chunk)/len(chunk) for chunk in chunks]

    # Create progress bars to visualize trend
    trend_progress = Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        expand=True
    )

    # Add tasks for each chunk
    for i, avg in enumerate(avg_scores):
        chunk_name = f"Set {i+1}"
        if i == len(avg_scores) - 1:
            chunk_name = "Latest"
        trend_progress.add_task(f"[bold]{chunk_name}[/bold]", total=10, completed=int(min(10, avg)))

    # Show trend panel
    console.print(Panel(
        trend_progress,
        title=f"Average Score Trend ({len(all_scores)} total attempts)",
        border_style=PANEL_BORDER_STYLE
    ))

    # Calculate and show statistics
    if len(all_scores) >= 2:
        mean = statistics.mean(all_scores)
        median = statistics.median(all_scores)
        improvement = avg_scores[-1] - avg_scores[0]

        stats_text = Text()
        stats_text.append(f"Average score: {mean:.1f}/10\n", style=SYNTHWAVE_THEME['secondary'])
        stats_text.append(f"Median score: {median:.1f}/10\n", style=SYNTHWAVE_THEME['secondary'])

        if improvement > 0:
            stats_text.append(f"Improvement: +{improvement:.1f} points\n", style=SYNTHWAVE_THEME['highlight'])
        else:
            stats_text.append(f"Change: {improvement:.1f} points\n", style=SYNTHWAVE_THEME['accent'])

        console.print(Panel(
            stats_text,
            title="Statistics",
            border_style=PANEL_BORDER_STYLE
        ))
