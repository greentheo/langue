#!/usr/bin/env python
"""
Simple test script for the Langue progress dashboard visualization.
This script creates mock data and directly renders the dashboard elements.
"""

import sys
from pathlib import Path
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

try:
    # Import rich components
    from rich.console import Console
    from rich.panel import Panel
    from rich.text import Text
    from rich.columns import Columns
    from rich.table import Table
    from rich.progress import Progress, BarColumn, TextColumn

    # Set up console with theme colors
    console = Console()

    # Define a synthwave theme (similar to the one used in Langue)
    SYNTHWAVE_THEME = {
        "primary": "magenta",
        "secondary": "cyan",
        "accent": "bright_yellow",
        "highlight": "bright_magenta",
        "text": "bright_white"
    }

    PANEL_BORDER_STYLE = "bright_magenta"

    def create_mock_data():
        """Create mock user statistics for testing."""
        # Mock user stats
        stats = {
            'total_points': 1250,
            'streak_days': 14,
            'total_words': 545,
            'activities_completed': 42,
            'learning_time': 10800,  # 3 hours in seconds
            'languages': {
                'Spanish': {'word_count': 320},
                'French': {'word_count': 150},
                'German': {'word_count': 75}
            },
            'activity_breakdown': {
                'flashcards': {'count': 20, 'points': 500, 'words': 200, 'duration': 3600},
                'fill_blank': {'count': 10, 'points': 300, 'words': 150, 'duration': 2400},
                'reading': {'count': 5, 'points': 200, 'words': 100, 'duration': 1800},
                'translation': {'count': 5, 'points': 150, 'words': 75, 'duration': 1500},
                'chat': {'count': 2, 'points': 100, 'words': 20, 'duration': 1500}
            }
        }

        # Mock user language levels
        language_levels = {
            'Spanish': 'b1',
            'French': 'a2',
            'German': 'a1'
        }

        # Mock achievements
        achievements = [
            "Earned 100 points",
            "Earned 500 points",
            "Earned 1000 points",
            "3-day streak",
            "7-day streak",
            "Completed flashcards",
            "Completed fill-in-the-blank",
            "Had a conversation",
            "Learned 50 words"
        ]

        # Mock flashcard history
        flashcard_history = []
        now = datetime.now()

        spanish_words = [
            "hola", "gracias", "adiós", "casa", "trabajo", "tiempo", "día", "noche",
            "comida", "agua", "libro", "amigo", "coche", "ciudad", "país"
        ]

        for day in range(30):
            for _ in range(random.randint(0, 5)):
                word = random.choice(spanish_words)
                score = random.randint(1, 10)
                correct = score >= 7

                flashcard_history.append({
                    'word': word,
                    'translation': f"Translation of {word}",
                    'user_answer': f"Translation of {word}" if correct else f"Wrong {word}",
                    'score': score,
                    'correct': correct,
                    'timestamp': (now - timedelta(days=day, hours=random.randint(0, 23))).isoformat()
                })

        # Mock weekly activities
        weekly_activities = []
        for day in range(7):
            for _ in range(random.randint(0, 3)):
                activity_date = now - timedelta(days=day)
                activity_type = random.choice(list(stats['activity_breakdown'].keys()))

                weekly_activities.append({
                    'completed_at': activity_date.isoformat(),
                    'points_earned': random.randint(10, 50),
                    'activity_type': activity_type
                })

        return stats, language_levels, achievements, flashcard_history, weekly_activities

    def create_overview_panel(stats: Dict[str, Any]) -> Panel:
        """Create an overview panel with key user statistics."""
        overview_text = Text()
        overview_text.append(f"📊 Total Points: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        overview_text.append(f"{stats['total_points']}\n", style=SYNTHWAVE_THEME['text'])

        overview_text.append(f"🔥 Current Streak: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        overview_text.append(f"{stats.get('streak_days', 0)} days\n", style=SYNTHWAVE_THEME['text'])

        overview_text.append(f"📚 Total Words Learned: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        overview_text.append(f"{stats['total_words']}\n", style=SYNTHWAVE_THEME['text'])

        overview_text.append(f"⏱️ Total Learning Time: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        learning_hours = stats['learning_time'] / 3600 if stats['learning_time'] else 0
        if learning_hours >= 1:
            overview_text.append(f"{learning_hours:.1f} hours\n", style=SYNTHWAVE_THEME['text'])
        else:
            learning_minutes = stats['learning_time'] / 60 if stats['learning_time'] else 0
            overview_text.append(f"{learning_minutes:.1f} minutes\n", style=SYNTHWAVE_THEME['text'])

        overview_text.append(f"🎯 Activities Completed: ", style=f"bold {SYNTHWAVE_THEME['highlight']}")
        overview_text.append(f"{stats['activities_completed']}\n", style=SYNTHWAVE_THEME['text'])

        return Panel(
            overview_text,
            title="[bold]Your Language Learning Journey[/bold]",
            border_style=PANEL_BORDER_STYLE,
            expand=False
        )

    def create_streak_visualization(streak_days: int) -> Text:
        """Create a visual representation of the streak."""
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

            streak_viz.append(f"\n[{SYNTHWAVE_THEME['text']}]Keep the streak going! Come back tomorrow for more points.[/{SYNTHWAVE_THEME['text']}]\n")
        else:
            streak_viz.append("\n[italic]Start your learning streak today![/italic]\n", style=SYNTHWAVE_THEME['accent'])

        return streak_viz

    def create_language_progress(stats: Dict[str, Any], language_levels: Dict[str, str]) -> Panel:
        """Create progress bars for each language."""
        # Targets based on CEFR levels
        # A1: ~500 words, A2: ~1000, B1: ~2000, B2: ~4000, C1: ~8000, C2: ~16000
        level_targets = {
            "a1": 500, "a2": 1000, "b1": 2000, "b2": 4000, "c1": 8000, "c2": 16000
        }

        language_progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            expand=True
        )

        for language, lang_stats in stats['languages'].items():
            word_count = lang_stats['word_count']

            # Get current level for this language
            current_level = language_levels.get(language, "a1").lower()
            target = level_targets.get(current_level, 500)  # Default to A1 target

            # Add task for this language
            language_progress.add_task(
                f"[bold]{language}[/bold] (Level {current_level.upper()})",
                total=target,
                completed=word_count
            )

        return Panel(
            language_progress,
            title=f"[bold]Vocabulary Progress by Language[/bold]",
            subtitle=f"Words learned toward level completion",
            border_style=PANEL_BORDER_STYLE
        )

    def create_activity_table(stats: Dict[str, Any]) -> Table:
        """Create a table showing activity statistics."""
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

        return activity_table

    def create_weekly_activity_chart(activities: List[Dict[str, Any]]) -> Panel:
        """Create a visualization of weekly activity."""
        # Group by day
        now = datetime.now()
        days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        activity_by_day = {day: 0 for day in days_of_week}
        points_by_day = {day: 0 for day in days_of_week}

        for activity in activities:
            if activity.get('completed_at'):
                activity_date = datetime.fromisoformat(activity['completed_at'])
                day_name = activity_date.strftime("%A")
                activity_by_day[day_name] += 1
                points_by_day[day_name] += activity.get('points_earned', 0) or 0

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

        return Panel(
            weekly_progress,
            title="[bold]This Week's Learning Activity[/bold]",
            border_style=PANEL_BORDER_STYLE
        )

    def create_achievement_display(achievements: List[str]) -> Columns:
        """Create a display of achievement badges."""
        achievement_panels = []

        # Create a panel for each achievement
        for achievement in achievements:
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

        return Columns(achievement_panels)

    def create_flashcard_performance_panel(flashcard_history: List[Dict[str, Any]]) -> Panel:
        """Create a panel showing flashcard performance."""
        # Group flashcards by correctness
        correct_count = sum(1 for card in flashcard_history if card.get('correct'))
        total_count = len(flashcard_history)
        correct_percent = (correct_count / total_count) * 100 if total_count > 0 else 0

        # Get recent scores
        recent_scores = [card.get('score', 0) for card in flashcard_history[:min(20, len(flashcard_history))]]
        avg_score = sum(recent_scores) / len(recent_scores) if recent_scores else 0

        # Create flashcard stats panel
        flashcard_stats = Text()
        flashcard_stats.append(f"Total Flashcards Attempted: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
        flashcard_stats.append(f"{total_count}\n", style=SYNTHWAVE_THEME['text'])

        flashcard_stats.append(f"Correct Answers: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
        flashcard_stats.append(f"{correct_count} ({correct_percent:.1f}%)\n", style=SYNTHWAVE_THEME['text'])

        flashcard_stats.append(f"Recent Average Score: ", style=f"bold {SYNTHWAVE_THEME['secondary']}")
        flashcard_stats.append(f"{avg_score:.1f}/10\n", style=SYNTHWAVE_THEME['text'])

        # Show progress bar for correctness
        correct_progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            expand=True
        )

        correct_progress.add_task("Accuracy", total=100, completed=correct_percent)

        return Panel(
            Text.assemble(
                flashcard_stats,
                "\n",
                correct_progress
            ),
            title="[bold]Flashcard Learning Progress[/bold]",
            border_style=PANEL_BORDER_STYLE
        )

    def main():
        """Display the progress dashboard with mock data."""
        # Create mock data
        stats, language_levels, achievements, flashcard_history, weekly_activities = create_mock_data()

        # Display dashboard title
        console.print(f"\n[bold {SYNTHWAVE_THEME['secondary']}]【﻿ＰＲＯＧＲＥＳＳ　ＤＡＳＨＢＯＡＲＤ】[/bold {SYNTHWAVE_THEME['secondary']}]")

        # Display learning overview
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]✨ Learning Overview[/bold {SYNTHWAVE_THEME['primary']}]")
        overview_panel = create_overview_panel(stats)
        console.print(overview_panel)

        # Create streak visualization
        streak_viz = create_streak_visualization(stats.get('streak_days', 0))
        console.print(streak_viz)

        # Display language progress
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]🌍 Language Progress[/bold {SYNTHWAVE_THEME['primary']}]")
        language_panel = create_language_progress(stats, language_levels)
        console.print(language_panel)

        # Display activity breakdown
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]🎮 Activity Stats[/bold {SYNTHWAVE_THEME['primary']}]")
        activity_table = create_activity_table(stats)
        console.print(activity_table)

        # Display weekly activity
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]📆 Weekly Activity[/bold {SYNTHWAVE_THEME['primary']}]")
        weekly_chart = create_weekly_activity_chart(weekly_activities)
        console.print(weekly_chart)

        # Display achievements
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]🏆 Achievements[/bold {SYNTHWAVE_THEME['primary']}]")
        achievement_display = create_achievement_display(achievements)
        console.print(achievement_display)

        # Display flashcard performance
        console.print(f"\n[bold {SYNTHWAVE_THEME['primary']}]🎴 Flashcard Performance[/bold {SYNTHWAVE_THEME['primary']}]")
        flashcard_panel = create_flashcard_performance_panel(flashcard_history)
        console.print(flashcard_panel)

    if __name__ == "__main__":
        main()

except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Make sure 'rich' is installed: pip install rich")
    sys.exit(1)
except Exception as e:
    print(f"An error occurred: {e}")
    sys.exit(1)
