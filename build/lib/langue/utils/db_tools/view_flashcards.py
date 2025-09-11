#!/usr/bin/env python3
"""
Flashcard History Viewer for Langue.

This utility script visualizes a user's flashcard history and performance metrics.
It shows progress over time, commonly used words, and success rates.
"""

import os
import sys
import json
import sqlite3
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import Counter, defaultdict

# Add the parent directory to sys.path
script_dir = Path(__file__).parent
if str(script_dir) not in sys.path:
    sys.path.insert(0, str(script_dir))

# Rich for nice visualization
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.progress import Progress, BarColumn, TextColumn
from rich.columns import Columns
from rich import box
from rich.tree import Tree
from rich.prompt import Prompt

# Import from langue
from langue.storage.database import get_db_path, get_connection
from langue.storage.integration import get_flashcard_history, get_flashcard_stats

# Initialize console
console = Console()


def get_user_id() -> str:
    """Get the user ID to analyze.

    Returns:
        User ID as a string
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Get list of users
        cursor.execute("SELECT user_id, username FROM users")
        users = cursor.fetchall()

        if not users:
            return "default_user"

        # If only one user, return that
        if len(users) == 1:
            return users[0]['user_id']

        # Otherwise, let user choose
        console.print("[bold]Select a user to view flashcard history:[/bold]")
        for i, user in enumerate(users):
            console.print(f"{i+1}. {user['username']} ({user['user_id']})")

        choice = Prompt.ask(
            "Enter user number",
            choices=[str(i+1) for i in range(len(users))],
            default="1"
        )

        return users[int(choice)-1]['user_id']
    except Exception as e:
        console.print(f"[red]Error getting users: {e}[/red]")
        return "default_user"
    finally:
        conn.close()


def get_languages(user_id: str) -> List[str]:
    """Get languages the user has studied.

    Args:
        user_id: User ID to get languages for

    Returns:
        List of language names
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT DISTINCT language FROM flashcard_history WHERE user_id = ?",
            (user_id,)
        )
        languages = [row['language'] for row in cursor.fetchall()]

        if not languages:
            cursor.execute(
                "SELECT current_language FROM users WHERE user_id = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            if row:
                languages = [row['current_language']]

        return languages
    except Exception as e:
        console.print(f"[red]Error getting languages: {e}[/red]")
        return []
    finally:
        conn.close()


def get_flashcard_stats_summary(user_id: str, language: Optional[str] = None) -> Dict[str, Any]:
    """Get summary statistics about flashcard usage.

    Args:
        user_id: User ID to get stats for
        language: Optional language filter

    Returns:
        Dictionary with summary statistics
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Build query with optional language filter
        query = """
            SELECT
                COUNT(*) as total_attempts,
                COUNT(DISTINCT word) as unique_words,
                AVG(score) as avg_score,
                SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct_count,
                MIN(timestamp) as first_attempt,
                MAX(timestamp) as last_attempt
            FROM flashcard_history
            WHERE user_id = ?
        """
        params = [user_id]

        if language:
            query += " AND language = ?"
            params.append(language)

        cursor.execute(query, params)
        stats = dict(cursor.fetchone() or {})

        # Calculate success rate
        if stats.get('total_attempts', 0) > 0:
            stats['success_rate'] = (stats.get('correct_count', 0) / stats.get('total_attempts', 0)) * 100
        else:
            stats['success_rate'] = 0

        return stats
    except Exception as e:
        console.print(f"[red]Error getting flashcard stats: {e}[/red]")
        return {}
    finally:
        conn.close()


def get_top_words(user_id: str, language: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    """Get the most frequently studied words.

    Args:
        user_id: User ID to get words for
        language: Optional language filter
        limit: Maximum number of words to return

    Returns:
        List of word data dictionaries
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Build query with optional language filter
        query = """
            SELECT
                word,
                COUNT(*) as attempts,
                AVG(score) as avg_score,
                SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct_count,
                MAX(timestamp) as last_attempt
            FROM flashcard_history
            WHERE user_id = ?
        """
        params = [user_id]

        if language:
            query += " AND language = ?"
            params.append(language)

        query += " GROUP BY word ORDER BY attempts DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        words = [dict(row) for row in cursor.fetchall()]

        # Calculate success rates
        for word in words:
            if word.get('attempts', 0) > 0:
                word['success_rate'] = (word.get('correct_count', 0) / word.get('attempts', 0)) * 100
            else:
                word['success_rate'] = 0

        return words
    except Exception as e:
        console.print(f"[red]Error getting top words: {e}[/red]")
        return []
    finally:
        conn.close()


def get_learning_trend(user_id: str, language: Optional[str] = None, days: int = 30) -> List[Dict[str, Any]]:
    """Get learning trend data over time.

    Args:
        user_id: User ID to get trend for
        language: Optional language filter
        days: Number of days to analyze

    Returns:
        List of daily trend data
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        # Build query with optional language filter
        query = """
            SELECT
                DATE(timestamp) as date,
                COUNT(*) as attempts,
                AVG(score) as avg_score,
                SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct_count
            FROM flashcard_history
            WHERE user_id = ? AND timestamp >= ?
        """
        params = [user_id, start_date.isoformat()]

        if language:
            query += " AND language = ?"
            params.append(language)

        query += " GROUP BY DATE(timestamp) ORDER BY date"

        cursor.execute(query, params)
        trend_data = [dict(row) for row in cursor.fetchall()]

        # Calculate success rates and fill in missing dates
        result = []
        current_date = start_date.date()

        # Create a lookup dictionary for existing data
        data_by_date = {datetime.fromisoformat(item['date']).date(): item for item in trend_data}

        while current_date <= end_date.date():
            if current_date in data_by_date:
                item = data_by_date[current_date]
                if item.get('attempts', 0) > 0:
                    item['success_rate'] = (item.get('correct_count', 0) / item.get('attempts', 0)) * 100
                else:
                    item['success_rate'] = 0
                result.append(item)
            else:
                # Add empty data for this date
                result.append({
                    'date': current_date.isoformat(),
                    'attempts': 0,
                    'avg_score': 0,
                    'correct_count': 0,
                    'success_rate': 0
                })

            current_date += timedelta(days=1)

        return result
    except Exception as e:
        console.print(f"[red]Error getting learning trend: {e}[/red]")
        return []
    finally:
        conn.close()


def display_user_summary(user_id: str) -> None:
    """Display summary information about the user.

    Args:
        user_id: User ID to display summary for
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Get user info
        cursor.execute(
            "SELECT * FROM users WHERE user_id = ?",
            (user_id,)
        )
        user = cursor.fetchone()

        if not user:
            console.print(f"[yellow]User {user_id} not found[/yellow]")
            return

        # Get available languages
        languages = get_languages(user_id)

        # Create user summary panel
        tree = Tree(f"[bold]User: {user['username']}[/bold]")
        tree.add(f"User ID: [cyan]{user_id}[/cyan]")
        tree.add(f"Current Language: [cyan]{user['current_language']}[/cyan]")
        tree.add(f"Points: [cyan]{user['points']:,}[/cyan]")
        tree.add(f"Streak: [cyan]{user['streak_days']} days[/cyan]")
        tree.add(f"Languages: [cyan]{', '.join(languages)}[/cyan]")

        # Add summary stats
        stats = get_flashcard_stats_summary(user_id)
        if stats:
            stats_branch = tree.add("[bold]Flashcard Statistics[/bold]")
            stats_branch.add(f"Total Attempts: [cyan]{stats.get('total_attempts', 0):,}[/cyan]")
            stats_branch.add(f"Unique Words: [cyan]{stats.get('unique_words', 0):,}[/cyan]")
            stats_branch.add(f"Success Rate: [cyan]{stats.get('success_rate', 0):.1f}%[/cyan]")
            stats_branch.add(f"Average Score: [cyan]{stats.get('avg_score', 0):.1f}/10[/cyan]")

            if stats.get('first_attempt'):
                first_date = datetime.fromisoformat(stats['first_attempt'])
                last_date = datetime.fromisoformat(stats['last_attempt'])
                days_studied = (last_date - first_date).days + 1
                stats_branch.add(f"Days Studied: [cyan]{days_studied}[/cyan]")
                stats_branch.add(f"First Session: [cyan]{first_date.strftime('%Y-%m-%d')}[/cyan]")
                stats_branch.add(f"Last Session: [cyan]{last_date.strftime('%Y-%m-%d')}[/cyan]")

        console.print(Panel(tree, title="User Profile", border_style="green"))
    except Exception as e:
        console.print(f"[red]Error displaying user summary: {e}[/red]")
    finally:
        conn.close()


def display_top_words(user_id: str, language: Optional[str] = None) -> None:
    """Display the top words for a user.

    Args:
        user_id: User ID to display words for
        language: Optional language filter
    """
    words = get_top_words(user_id, language, limit=10)

    if not words:
        console.print("[yellow]No flashcard data found[/yellow]")
        return

    # Create table for top words
    table = Table(
        title=f"Top Words {f'({language})' if language else ''}",
        box=box.ROUNDED
    )

    table.add_column("Word", style="cyan")
    table.add_column("Attempts", justify="right")
    table.add_column("Success Rate", justify="right")
    table.add_column("Avg Score", justify="right")
    table.add_column("Last Studied", justify="right", style="dim")

    for word in words:
        # Format last attempt date
        last_date = datetime.fromisoformat(word['last_attempt']) if word.get('last_attempt') else None
        last_date_str = last_date.strftime("%Y-%m-%d") if last_date else "N/A"

        table.add_row(
            word['word'],
            f"{word.get('attempts', 0)}",
            f"{word.get('success_rate', 0):.1f}%",
            f"{word.get('avg_score', 0):.1f}/10",
            last_date_str
        )

    console.print(table)

    # Create progress bars for top words
    console.print("\n[bold]Word Mastery Progress:[/bold]")

    progress_panels = []
    for word in words[:5]:  # Show top 5 words
        # Create a progress panel for this word
        progress = Progress(
            TextColumn(f"[bold]{word['word']}[/bold]"),
            BarColumn(bar_width=40),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            expand=True
        )

        # Use average score as progress (out of 10)
        avg_score = word.get('avg_score', 0)
        task_id = progress.add_task("", total=10, completed=min(10, int(avg_score)))

        # Create panel with progress and stats
        panel = Panel(
            progress,
            title=f"Mastery: {avg_score:.1f}/10",
            subtitle=f"Attempts: {word.get('attempts', 0)} | Success: {word.get('success_rate', 0):.1f}%",
            width=60
        )
        progress_panels.append(panel)

    if progress_panels:
        console.print(Columns(progress_panels))


def display_learning_trend(user_id: str, language: Optional[str] = None, days: int = 30) -> None:
    """Display learning trend visualization.

    Args:
        user_id: User ID to display trend for
        language: Optional language filter
        days: Number of days to analyze
    """
    trend_data = get_learning_trend(user_id, language, days)

    if not trend_data or all(item.get('attempts', 0) == 0 for item in trend_data):
        console.print("[yellow]No trend data available for the specified period[/yellow]")
        return

    # Filter out days with no attempts
    active_days = [item for item in trend_data if item.get('attempts', 0) > 0]

    if not active_days:
        console.print("[yellow]No activity found in the specified period[/yellow]")
        return

    # Create table for trend data
    table = Table(
        title=f"Learning Trend - Last {days} Days {f'({language})' if language else ''}",
        box=box.ROUNDED
    )

    table.add_column("Date")
    table.add_column("Attempts", justify="right")
    table.add_column("Success Rate", justify="right")
    table.add_column("Avg Score", justify="right")

    # Show up to 7 rows in the table (most recent)
    for item in active_days[-7:]:
        date_str = item.get('date', '').split('T')[0]  # Extract date part

        table.add_row(
            date_str,
            f"{item.get('attempts', 0)}",
            f"{item.get('success_rate', 0):.1f}%",
            f"{item.get('avg_score', 0):.1f}/10"
        )

    console.print(table)

    # Create progress bars to visualize score trend
    console.print("\n[bold]Score Trend:[/bold]")

    score_progress = Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=50),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        expand=True
    )

    # Group by weeks if we have enough data
    if len(active_days) > 14:
        # Group by week
        weeks = defaultdict(list)
        for item in active_days:
            date = datetime.fromisoformat(item['date'].split('T')[0])
            week_num = date.isocalendar()[1]  # Get ISO week number
            weeks[week_num].append(item)

        # Calculate weekly averages
        weekly_data = []
        for week_num, items in sorted(weeks.items()):
            attempts = sum(item.get('attempts', 0) for item in items)
            if attempts > 0:
                avg_score = sum(item.get('avg_score', 0) * item.get('attempts', 0)
                               for item in items) / attempts
                weekly_data.append({
                    'label': f"Week {week_num}",
                    'score': avg_score
                })

        # Add tasks for each week
        for i, item in enumerate(weekly_data):
            label = item['label']
            if i == len(weekly_data) - 1:
                label = f"{label} (Latest)"
            score_progress.add_task(f"[bold]{label}[/bold]",
                                  total=10,
                                  completed=min(10, int(item['score'])))
    else:
        # Use daily data for shorter periods
        # Show only days with activity, up to 10 days
        display_days = active_days[-10:]

        for i, item in enumerate(display_days):
            date = datetime.fromisoformat(item['date'].split('T')[0])
            label = date.strftime("%m-%d")
            if i == len(display_days) - 1:
                label = f"{label} (Latest)"
            score_progress.add_task(f"[bold]{label}[/bold]",
                                  total=10,
                                  completed=min(10, int(item.get('avg_score', 0))))

    # Show trend panel
    console.print(Panel(score_progress, title="Score Trend Over Time"))

    # Calculate and show improvement
    if len(active_days) >= 2:
        first_scores = active_days[:min(3, len(active_days))]
        last_scores = active_days[-3:]

        first_avg = sum(item.get('avg_score', 0) for item in first_scores) / len(first_scores)
        last_avg = sum(item.get('avg_score', 0) for item in last_scores) / len(last_scores)

        improvement = last_avg - first_avg

        stats_text = Text()
        if improvement > 0:
            stats_text.append(f"Score Improvement: [green]+{improvement:.1f} points[/green]\n")
        else:
            stats_text.append(f"Score Change: [yellow]{improvement:.1f} points[/yellow]\n")

        # Calculate activity metrics
        active_day_count = len(active_days)
        total_attempts = sum(item.get('attempts', 0) for item in active_days)
        avg_per_day = total_attempts / active_day_count if active_day_count > 0 else 0

        stats_text.append(f"Active Days: {active_day_count}/{days} ({active_day_count/days*100:.1f}%)\n")
        stats_text.append(f"Total Attempts: {total_attempts}\n")
        stats_text.append(f"Average Attempts per Active Day: {avg_per_day:.1f}\n")

        console.print(Panel(stats_text, title="Learning Metrics"))


def view_word_details(user_id: str, word: str, language: Optional[str] = None) -> None:
    """View detailed history for a specific word.

    Args:
        user_id: User ID to view history for
        word: Word to view details for
        language: Optional language filter
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Build query with optional language filter
        query = """
            SELECT * FROM flashcard_history
            WHERE user_id = ? AND word = ?
        """
        params = [user_id, word]

        if language:
            query += " AND language = ?"
            params.append(language)

        query += " ORDER BY timestamp DESC"

        cursor.execute(query, params)
        history = [dict(row) for row in cursor.fetchall()]

        if not history:
            console.print(f"[yellow]No history found for word: {word}[/yellow]")
            return

        # Get translations
        translations = set()
        for item in history:
            if item.get('translation'):
                translations.add(item['translation'])

        # Create a word info panel
        tree = Tree(f"[bold]{word}[/bold]")
        tree.add(f"Language: [cyan]{history[0].get('language', 'Unknown')}[/cyan]")
        tree.add(f"Translation(s): [cyan]{', '.join(translations)}[/cyan]")
        tree.add(f"Total Attempts: [cyan]{len(history)}[/cyan]")

        # Calculate statistics
        scores = [item.get('score', 0) for item in history]
        correct_count = sum(1 for item in history if item.get('correct', 0) == 1)

        stats_branch = tree.add("[bold]Statistics[/bold]")
        stats_branch.add(f"Average Score: [cyan]{sum(scores)/len(scores):.1f}/10[/cyan]")
        stats_branch.add(f"Success Rate: [cyan]{correct_count/len(history)*100:.1f}%[/cyan]")
        stats_branch.add(f"First Studied: [cyan]{datetime.fromisoformat(history[-1]['timestamp']).strftime('%Y-%m-%d')}[/cyan]")
        stats_branch.add(f"Last Studied: [cyan]{datetime.fromisoformat(history[0]['timestamp']).strftime('%Y-%m-%d')}[/cyan]")

        console.print(Panel(tree, title=f"Word Details: {word}", border_style="cyan"))

        # Show the history in a table
        table = Table(title="Attempt History", box=box.ROUNDED)
        table.add_column("Date", style="dim")
        table.add_column("User Answer")
        table.add_column("Score", justify="right")
        table.add_column("Correct", justify="center")

        for item in history[:10]:  # Show most recent 10 attempts
            date = datetime.fromisoformat(item['timestamp'])
            table.add_row(
                date.strftime("%Y-%m-%d %H:%M"),
                item.get('user_answer', ''),
                f"{item.get('score', 0)}/10",
                "✓" if item.get('correct', 0) == 1 else "✗"
            )

        console.print(table)

        # Show score trend
        console.print("\n[bold]Score Progression:[/bold]")

        # Reverse scores to show chronological order
        trend_scores = list(reversed(scores))

        progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=50),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            expand=True
        )

        # Group scores if we have many
        if len(trend_scores) > 10:
            chunk_size = len(trend_scores) // 5
            chunks = [trend_scores[i:i+chunk_size] for i in range(0, len(trend_scores), chunk_size)]

            for i, chunk in enumerate(chunks):
                avg_score = sum(chunk) / len(chunk)
                label = f"Attempts {i*chunk_size+1}-{min((i+1)*chunk_size, len(trend_scores))}"
                progress.add_task(f"[bold]{label}[/bold]", total=10, completed=min(10, int(avg_score)))
        else:
            # Show individual attempts
            for i, score in enumerate(trend_scores):
                progress.add_task(f"[bold]Attempt {i+1}[/bold]", total=10, completed=min(10, int(score)))

        console.print(Panel(progress, title="Score Progression"))

    except Exception as e:
        console.print(f"[red]Error viewing word details: {e}[/red]")
    finally:
        conn.close()


def interactive_mode() -> None:
    """Run the flashcard viewer in interactive mode."""
    console.print("[bold cyan]Langue Flashcard History Viewer - Interactive Mode[/bold cyan]")

    # Get user ID
    user_id = get_user_id()
    console.print(f"[green]Using user ID: {user_id}[/green]")

    # Get languages
    languages = get_languages(user_id)
    language = None

    if languages and len(languages) > 1:
        console.print("\n[bold]Select a language:[/bold]")
        console.print("0. All Languages")
        for i, lang in enumerate(languages):
            console.print(f"{i+1}. {lang}")

        choice = Prompt.ask(
            "Enter language number",
            choices=["0"] + [str(i+1) for i in range(len(languages))],
            default="0"
        )

        if choice != "0":
            language = languages[int(choice)-1]
    elif languages:
        language = languages[0]

    if language:
        console.print(f"[green]Selected language: {language}[/green]")
    else:
        console.print("[green]Showing data for all languages[/green]")

    while True:
        # Display user summary
        display_user_summary(user_id)

        console.print("\n[bold green]Choose an option:[/bold green]")
        console.print("1. View top words")
        console.print("2. View learning trend")
        console.print("3. View word details")
        console.print("4. Change language")
        console.print("0. Exit")

        choice = Prompt.ask("Enter your choice", choices=["0", "1", "2", "3", "4"], default="1")

        if choice == "0":
            break
        elif choice == "1":
            display_top_words(user_id, language)
            Prompt.ask("\nPress Enter to continue", default="")
        elif choice == "2":
            days = int(Prompt.ask("Number of days to analyze", default="30"))
            display_learning_trend(user_id, language, days)
            Prompt.ask("\nPress Enter to continue", default="")
        elif choice == "3":
            # Get list of words to choose from
            words = get_top_words(user_id, language, limit=50)
            word_list = [w['word'] for w in words]

            if not word_list:
                console.print("[yellow]No words found[/yellow]")
                continue

            console.print("\n[bold]Select a word to view details:[/bold]")
            for i, word in enumerate(word_list[:20]):  # Show first 20
                console.print(f"{i+1}. {word}")

            if len(word_list) > 20:
                console.print("... and more")

            # Allow direct word input
            word_input = Prompt.ask("Enter word number or type word directly")

            try:
                # Check if it's a number
                num = int(word_input)
                if 1 <= num <= len(word_list):
                    selected_word = word_list[num-1]
                else:
                    selected_word = word_input
            except ValueError:
                selected_word = word_input

            view_word_details(user_id, selected_word, language)
            Prompt.ask("\nPress Enter to continue", default="")
        elif choice == "4":
            if not languages:
                console.print("[yellow]No languages found[/yellow]")
                continue

            console.print("\n[bold]Select a language:[/bold]")
            console.print("0. All Languages")
            for i, lang in enumerate(languages):
                console.print(f"{i+1}. {lang}")

            choice = Prompt.ask(
                "Enter language number",
                choices=["0"] + [str(i+1) for i in range(len(languages))],
                default="0"
            )

            if choice == "0":
                language = None
                console.print("[green]Showing data for all languages[/green]")
            else:
                language = languages[int(choice)-1]
                console.print(f"[green]Selected language: {language}[/green]")


def main():
    """Main entry point for the flashcard history viewer."""
    parser = argparse.ArgumentParser(description="Flashcard History Viewer for Langue")
    parser.add_argument("--user", help="User ID to view history for")
    parser.add_argument("--language", help="Language to filter by")
    parser.add_argument("--word", help="View details for a specific word")
    parser.add_argument("--days", type=int, default=30, help="Number of days for trend analysis")
    parser.add_argument("--interactive", "-i", action="store_true", help="Run in interactive mode")

    args = parser.parse_args()

    # Check if database exists
    db_path = get_db_path()
    if not db_path.exists():
        console.print(f"[red]Database file not found at {db_path}[/red]")
        return 1

    # Default to interactive mode if no arguments provided
    if len(sys.argv) == 1 or args.interactive:
        interactive_mode()
        return 0

    # Get user ID if not provided
    user_id = args.user
    if not user_id:
        user_id = get_user_id()

    # Display user summary
    display_user_summary(user_id)

    # Process other arguments
    if args.word:
        view_word_details(user_id, args.word, args.language)
    else:
        display_top_words(user_id, args.language)
        display_learning_trend(user_id, args.language, args.days)

    return 0


if __name__ == "__main__":
    sys.exit(main())
