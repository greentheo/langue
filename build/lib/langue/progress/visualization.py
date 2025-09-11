"""
Progress Visualization Module for Langue.

This module provides functions for visualizing user progress and statistics
using rich text components and interactive visualizations.
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import math
import calendar

from rich.console import Console
from rich.panel import Panel
from rich.columns import Columns
from rich.table import Table
from rich.progress import Progress, BarColumn, TextColumn, SpinnerColumn
from rich.text import Text
from rich.layout import Layout
from rich.align import Align

# Import console with 80's theme from base activity
from langue.activities.base import console, SYNTHWAVE_THEME, PANEL_BORDER_STYLE


def create_overview_panel(stats: Dict[str, Any]) -> Panel:
    """Create an overview panel with key user statistics.

    Args:
        stats: Dictionary of user statistics

    Returns:
        Rich Panel with formatted overview statistics
    """
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
    """Create a visual representation of the streak.

    Args:
        streak_days: Number of days in the streak

    Returns:
        Rich Text object with streak visualization
    """
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
    """Create progress bars for each language.

    Args:
        stats: Dictionary of user statistics
        language_levels: Dictionary mapping languages to their CEFR levels

    Returns:
        Rich Panel with language progress visualization
    """
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

        # Calculate percentage toward level completion
        percentage = min(100, (word_count / target) * 100)

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
    """Create a table showing activity statistics.

    Args:
        stats: Dictionary of user statistics

    Returns:
        Rich Table with activity breakdown
    """
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
    """Create a visualization of weekly activity.

    Args:
        activities: List of activity data

    Returns:
        Rich Panel with weekly activity chart
    """
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


def create_monthly_calendar(activities: List[Dict[str, Any]]) -> Panel:
    """Create a monthly calendar visualization.

    Args:
        activities: List of activity data

    Returns:
        Rich Panel with monthly calendar
    """
    now = datetime.now()
    year = now.year
    month = now.month

    # Create a calendar for the current month
    cal = calendar.monthcalendar(year, month)
    month_name = calendar.month_name[month]

    # Track activity by date
    activity_dates = {}
    for activity in activities:
        if activity.get('completed_at'):
            date = datetime.fromisoformat(activity['completed_at']).date()
            if date.year == year and date.month == month:
                if date not in activity_dates:
                    activity_dates[date] = {"count": 0, "points": 0}
                activity_dates[date]["count"] += 1
                activity_dates[date]["points"] += activity.get('points_earned', 0) or 0

    # Create calendar table
    calendar_table = Table(
        show_header=True,
        header_style=f"bold {SYNTHWAVE_THEME['highlight']}",
        border_style=PANEL_BORDER_STYLE,
        title=f"{month_name} {year}"
    )

    # Add weekday headers
    for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]:
        calendar_table.add_column(day, justify="center", style=SYNTHWAVE_THEME['secondary'])

    # Add calendar rows
    for week in cal:
        row = []
        for day in week:
            if day == 0:
                # Empty cell for days not in this month
                row.append("")
            else:
                date = datetime(year, month, day).date()
                today = datetime.now().date()

                # Format cell based on activity
                if date in activity_dates:
                    count = activity_dates[date]["count"]
                    points = activity_dates[date]["points"]

                    if date == today:
                        # Today with activity
                        cell = f"[bold {SYNTHWAVE_THEME['highlight']}]{day}[/] 🔥 +{points}"
                    else:
                        # Day with activity
                        cell = f"{day} 🔥 +{points}"
                elif date == today:
                    # Today without activity
                    cell = f"[bold {SYNTHWAVE_THEME['highlight']}]{day}[/]"
                elif date > today:
                    # Future date
                    cell = f"[dim]{day}[/]"
                else:
                    # Past date with no activity
                    cell = f"{day}"

                row.append(cell)

        calendar_table.add_row(*row)

    return Panel(
        calendar_table,
        title="[bold]Monthly Activity Calendar[/bold]",
        border_style=PANEL_BORDER_STYLE
    )


def create_achievement_display(achievements: List[str]) -> Columns:
    """Create a display of achievement badges.

    Args:
        achievements: List of achievement strings

    Returns:
        Rich Columns containing achievement panels
    """
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
    """Create a panel showing flashcard performance.

    Args:
        flashcard_history: List of flashcard attempt data

    Returns:
        Rich Panel with flashcard performance visualization
    """
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


def create_difficult_words_panel(flashcard_history: List[Dict[str, Any]]) -> Optional[Panel]:
    """Create a panel showing difficult words that need practice.

    Args:
        flashcard_history: List of flashcard attempt data

    Returns:
        Rich Panel with difficult words visualization, or None if no difficult words
    """
    if len(flashcard_history) <= 5:
        return None

    # Find words with low scores
    word_scores = {}
    for card in flashcard_history:
        word = card.get('word', '')
        if not word:
            continue

        if word not in word_scores:
            word_scores[word] = {'total': 0, 'count': 0}
        word_scores[word]['total'] += card.get('score', 0)
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

    if not difficult_words:
        return None

    difficult_progress = Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=40, style=SYNTHWAVE_THEME['primary']),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        expand=True
    )

    # Add tasks for difficult words
    for word, score in list(sorted(difficult_words.items(), key=lambda x: x[1]))[:5]:
        difficult_progress.add_task(f"[bold]{word}[/bold]", total=10, completed=int(score))

    return Panel(
        difficult_progress,
        title="[bold]Words Needing Review[/bold]",
        border_style=PANEL_BORDER_STYLE
    )


def create_learning_trend_chart(flashcard_history: List[Dict[str, Any]]) -> Optional[Panel]:
    """Create a chart showing learning trends over time.

    Args:
        flashcard_history: List of flashcard attempt data

    Returns:
        Rich Panel with learning trend visualization, or None if insufficient data
    """
    if len(flashcard_history) < 10:
        return None

    # Group by date
    scores_by_date = {}
    for card in flashcard_history:
        if not card.get('timestamp'):
            continue

        date_str = datetime.fromisoformat(card['timestamp']).date().isoformat()
        if date_str not in scores_by_date:
            scores_by_date[date_str] = []
        scores_by_date[date_str].append(card.get('score', 0))

    # Calculate daily averages
    dates = sorted(scores_by_date.keys())
    if len(dates) < 3:
        return None

    # Only use the most recent 10 days with data
    dates = dates[-10:]

    daily_avgs = [sum(scores_by_date[date])/len(scores_by_date[date]) for date in dates]

    # Create trend visualization
    trend_progress = Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
        TextColumn("{task.completed:.1f}/10"),
        expand=True
    )

    # Add tasks for each day
    for i, (date, avg) in enumerate(zip(dates, daily_avgs)):
        display_date = datetime.fromisoformat(date).strftime("%b %d")

        # Highlight the most recent day
        if i == len(dates) - 1:
            date_style = f"bold {SYNTHWAVE_THEME['highlight']}"
        else:
            date_style = SYNTHWAVE_THEME['secondary']

        trend_progress.add_task(
            f"[{date_style}]{display_date}[/{date_style}]",
            total=10,
            completed=avg
        )

    # Calculate overall trend
    improvement = daily_avgs[-1] - daily_avgs[0] if len(daily_avgs) > 1 else 0

    trend_text = Text()
    if improvement > 0:
        trend_text.append(f"\nImprovement: +{improvement:.1f} points\n", style=SYNTHWAVE_THEME['highlight'])
    elif improvement < 0:
        trend_text.append(f"\nChange: {improvement:.1f} points\n", style=SYNTHWAVE_THEME['accent'])
    else:
        trend_text.append("\nScore is stable\n", style=SYNTHWAVE_THEME['secondary'])

    return Panel(
        Text.assemble(trend_progress, trend_text),
        title="[bold]Daily Learning Trend[/bold]",
        border_style=PANEL_BORDER_STYLE
    )


def create_ascii_graph(title: str, data: List[Tuple[str, int]], max_width: int = 50) -> Text:
    """Create a simple ASCII bar graph.

    Args:
        title: Graph title
        data: List of (label, value) pairs
        max_width: Maximum width of the bars

    Returns:
        Rich Text object with ASCII graph
    """
    graph_text = Text()
    graph_text.append(f"{title}\n\n", style=f"bold {SYNTHWAVE_THEME['primary']}")

    max_value = max(value for _, value in data) if data else 1
    max_label_len = max(len(label) for label, _ in data) if data else 10

    for label, value in data:
        # Calculate bar width
        bar_width = int((value / max_value) * max_width)
        bar = "█" * bar_width

        # Format the line
        padded_label = label.ljust(max_label_len)
        graph_text.append(f"{padded_label} │ ", style=SYNTHWAVE_THEME['secondary'])
        graph_text.append(bar, style=SYNTHWAVE_THEME['highlight'])
        graph_text.append(f" {value}\n", style=SYNTHWAVE_THEME['text'])

    return graph_text


def create_ascii_streak_calendar(streak_days: int, recent_days: List[bool] = None) -> Text:
    """Create an ASCII streak calendar.

    Args:
        streak_days: Number of days in the streak
        recent_days: List of booleans indicating activity for recent days (True = active)

    Returns:
        Rich Text object with ASCII calendar
    """
    calendar_text = Text()
    calendar_text.append("Last 14 Days Activity:\n\n", style=f"bold {SYNTHWAVE_THEME['primary']}")

    # Default to 14 days of activity if not provided
    if recent_days is None:
        recent_days = [True] * min(streak_days, 14)
        if len(recent_days) < 14:
            recent_days = [False] * (14 - len(recent_days)) + recent_days

    # Limit to 14 days
    recent_days = recent_days[-14:]

    # Create the day indicators
    now = datetime.now()
    for i, active in enumerate(recent_days):
        day = now - timedelta(days=13-i)
        day_str = day.strftime("%a")

        if i == 13:  # Today
            style = f"bold {SYNTHWAVE_THEME['highlight']}"
        else:
            style = SYNTHWAVE_THEME['secondary']

        calendar_text.append(f"{day_str} ", style=style)

        if active:
            calendar_text.append("🔥 ", style=SYNTHWAVE_THEME['highlight'])
        else:
            calendar_text.append("◯ ", style="dim")

        if (i + 1) % 7 == 0:
            calendar_text.append("\n")

    calendar_text.append("\n")

    return calendar_text


def create_level_progress_panel(current_level: str, word_count: int) -> Panel:
    """Create a panel showing progress toward the next level.

    Args:
        current_level: Current CEFR level (a1, a2, b1, b2, c1, c2)
        word_count: Number of words learned

    Returns:
        Rich Panel with level progress visualization
    """
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

    # Calculate progress toward next level
    current_threshold = level_thresholds.get(current_level.lower(), 500)

    # Determine next level
    levels = ["a1", "a2", "b1", "b2", "c1", "c2"]
    current_idx = levels.index(current_level.lower()) if current_level.lower() in levels else 0

    next_level = levels[current_idx + 1] if current_idx < len(levels) - 1 else None
    next_threshold = level_thresholds.get(next_level, current_threshold * 2) if next_level else None

    # Create progress display
    level_progress = Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=50, style=SYNTHWAVE_THEME['highlight']),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        expand=True
    )

    # Add current level progress
    current_progress = min(word_count, current_threshold)
    level_progress.add_task(
        f"[bold]{level_names.get(current_level.lower(), current_level.upper())}[/bold]",
        total=current_threshold,
        completed=current_progress
    )

    # Add next level progress if applicable
    if next_level and word_count > current_threshold:
        next_progress = min(word_count - current_threshold, next_threshold - current_threshold)
        level_progress.add_task(
            f"[bold]{level_names.get(next_level, next_level.upper())}[/bold]",
            total=next_threshold - current_threshold,
            completed=next_progress
        )

    # Create level information text
    level_info = Text()
    level_info.append("\nCEFR Level Vocabulary Targets:\n", style=SYNTHWAVE_THEME['secondary'])

    for level, threshold in level_thresholds.items():
        if level.lower() == current_level.lower():
            style = f"bold {SYNTHWAVE_THEME['highlight']}"
        else:
            style = SYNTHWAVE_THEME['text']

        level_info.append(f"• {level_names.get(level, level.upper())}: ", style=style)
        level_info.append(f"{threshold} words\n", style=SYNTHWAVE_THEME['text'])

    return Panel(
        Text.assemble(level_progress, level_info),
        title="[bold]Progress Toward Next Level[/bold]",
        border_style=PANEL_BORDER_STYLE
    )


def create_word_cloud(word_data: Dict[str, Any], max_words: int = 20) -> Text:
    """Create a simple ASCII word cloud representation.

    Args:
        word_data: Dictionary mapping words to scores/frequencies
        max_words: Maximum number of words to include

    Returns:
        Rich Text object with word cloud visualization
    """
    if not word_data:
        return Text("No word data available.")

    cloud_text = Text()

    # Sort words by score/frequency
    sorted_words = sorted(word_data.items(), key=lambda x: x[1], reverse=True)[:max_words]

    # Find min and max values for scaling
    min_value = min(value for _, value in sorted_words)
    max_value = max(value for _, value in sorted_words)
    value_range = max_value - min_value if max_value > min_value else 1

    # Create font sizes (1-4)
    for word, value in sorted_words:
        # Scale to 1-4 range
        size = 1 + int((value - min_value) / value_range * 3)

        # Choose style based on size
        if size == 4:
            style = f"bold {SYNTHWAVE_THEME['highlight']}"
        elif size == 3:
            style = SYNTHWAVE_THEME['secondary']
        elif size == 2:
            style = SYNTHWAVE_THEME['text']
        else:
            style = f"dim {SYNTHWAVE_THEME['text']}"

        # Add spacing based on size
        spacing = " " * size
        cloud_text.append(f"{word}{spacing}", style=style)

        # Add line breaks occasionally for better layout
        if sorted_words.index((word, value)) % 5 == 4:
            cloud_text.append("\n")

    return cloud_text
