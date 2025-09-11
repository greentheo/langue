"""
Configuration manager for Langue.

This module provides the ConfigManager class to handle loading, saving, and managing
the application configuration.
"""

import os
import toml
from pathlib import Path
from typing import Optional, Dict, Any

from langue.config.settings import Settings, load_default_settings


class ConfigManager:
    """Manages application configuration."""

    def __init__(self, config_dir: Optional[Path] = None):
        """Initialize the configuration manager.

        Args:
            config_dir: Custom configuration directory path. If None, uses default.
        """
        self.config_dir = config_dir or Path.home() / ".config" / "langue"
        self.config_file = self.config_dir / "config.toml"
        self.settings = self._load_settings()

    def _load_settings(self) -> Settings:
        """Load settings from the configuration file.

        Returns:
            Settings object with loaded configuration.
        """
        # Ensure config directory exists
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # If config file doesn't exist, create it with default settings
        if not self.config_file.exists():
            default_settings = load_default_settings()
            self.save_settings(default_settings)
            return default_settings

        try:
            # Load settings from file
            config_data = toml.load(self.config_file)
            return Settings.parse_obj(config_data)
        except Exception as e:
            print(f"Error loading configuration: {e}")
            print("Loading default settings instead.")
            return load_default_settings()

    def save_settings(self, settings: Optional[Settings] = None) -> None:
        """Save settings to the configuration file.

        Args:
            settings: Settings to save. If None, saves current settings.
        """
        settings_to_save = settings or self.settings

        try:
            # Convert settings to dict and save as TOML
            settings_dict = settings_to_save.dict()

            # Convert Path objects to strings
            self._convert_paths_to_strings(settings_dict)

            # Ensure config directory exists
            self.config_dir.mkdir(parents=True, exist_ok=True)

            # Write to file
            with open(self.config_file, "w") as f:
                toml.dump(settings_dict, f)

        except Exception as e:
            print(f"Error saving configuration: {e}")

    def _convert_paths_to_strings(self, config_dict: Dict[str, Any]) -> None:
        """Convert Path objects to strings in the config dictionary.

        Args:
            config_dict: Configuration dictionary to process.
        """
        for key, value in config_dict.items():
            if isinstance(value, dict):
                self._convert_paths_to_strings(value)
            elif isinstance(value, Path):
                config_dict[key] = str(value)

    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a specific setting value.

        Args:
            key: Setting key to retrieve.
            default: Default value if setting doesn't exist.

        Returns:
            The setting value or default.
        """
        try:
            # Handle nested keys with dots (e.g., "ollama.server")
            if "." in key:
                parts = key.split(".")
                value = self.settings
                for part in parts:
                    value = getattr(value, part)
                return value
            return getattr(self.settings, key)
        except AttributeError:
            return default

    def update_setting(self, key: str, value: Any) -> bool:
        """Update a specific setting value.

        Args:
            key: Setting key to update.
            value: New value for the setting.

        Returns:
            True if successful, False otherwise.
        """
        try:
            # Handle nested keys with dots (e.g., "ollama.server")
            if "." in key:
                parts = key.split(".")
                target = self.settings
                for part in parts[:-1]:
                    target = getattr(target, part)
                setattr(target, parts[-1], value)
            else:
                setattr(self.settings, key, value)

            # Save the updated settings
            self.save_settings()
            return True
        except Exception as e:
            print(f"Error updating setting {key}: {e}")
            return False

    def reset_to_defaults(self) -> None:
        """Reset all settings to default values."""
        self.settings = load_default_settings()
        self.save_settings()
