#!/usr/bin/env python3
"""
Test script for Rich console initialization with the 80's theme.
This script tests if the console initialization works correctly.
"""

from rich.console import Console
from rich.theme import Theme
from rich.color import Color

def main():
    # Define an 80's style theme
    SYNTHWAVE_THEME = {
        "primary": Color.parse("#ff00ff").name,    # Hot pink
        "secondary": Color.parse("#00ffff").name,  # Cyan
        "accent": Color.parse("#ffff00").name,     # Yellow
        "highlight": Color.parse("#00ff00").name,  # Neon green
        "background": Color.parse("#000033").name, # Dark blue
        "border": Color.parse("#ff00ff").name,     # Hot pink
    }

    # Initialize console with theme (this should work now)
    console = Console(theme=Theme({
        "info": f"bold {SYNTHWAVE_THEME['secondary']}",
        "warning": f"bold {SYNTHWAVE_THEME['accent']}",
        "danger": f"bold {SYNTHWAVE_THEME['primary']}",
        "success": f"bold {SYNTHWAVE_THEME['highlight']}",
    }))

    # Test printing with theme styles
    console.print("[info]This is info text[/info]")
    console.print("[warning]This is warning text[/warning]")
    console.print("[danger]This is danger text[/danger]")
    console.print("[success]This is success text[/success]")

    # Print message if all worked
    console.print("Console theme initialization successful!", style=f"bold {SYNTHWAVE_THEME['highlight']}")

if __name__ == "__main__":
    main()
