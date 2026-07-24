"""
Settings module for Langue.

This module provides the Settings class, which represents the application configuration.
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator

from langue.models.registry import DEFAULT_CLAUDE_MODEL

# Map a provider name to the environment variable that holds its API key.
API_KEY_ENV_VARS = {
    "claude": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
}


class ModelSettings(BaseModel):
    """Settings for a specific model."""

    # General settings for all models
    temperature: float = Field(0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(1000, gt=0)

    # Model-specific settings
    api_key: Optional[str] = None
    model_name: str = "default"
    api_url: Optional[str] = None

    # extra="allow" for model-specific fields; protected_namespaces=() silences
    # Pydantic v2's warning about the model_name field.
    model_config = ConfigDict(extra="allow", protected_namespaces=())


class OllamaSettings(ModelSettings):
    """Ollama-specific settings."""

    server: str = "http://localhost:11434"
    model_name: str = "llama3.2"
    context_window: int = 4096

    @model_validator(mode="before")
    @classmethod
    def load_from_env(cls, values):
        """Load settings from environment variables."""
        if isinstance(values, dict):
            if "OLLAMA_MODEL" in os.environ:
                values["model_name"] = os.environ["OLLAMA_MODEL"]
            if "OLLAMA_SERVER" in os.environ:
                values["server"] = os.environ["OLLAMA_SERVER"]
        return values


class CloudModelSettings(ModelSettings):
    """Settings for cloud-based models."""

    api_key: str = ""
    organization_id: Optional[str] = None


class ActivitySettings(BaseModel):
    """Settings for learning activities."""

    items_per_session: int = 10
    difficulty: int = Field(1, ge=1, le=5)
    auto_reveal: int = 0  # Time in seconds before showing answer (0 for manual)

    model_config = ConfigDict(extra="allow")  # activity-specific extra fields


class LanguageSettings(BaseModel):
    """Settings for a specific language."""

    focus: str = "all"  # Options: "vocabulary", "grammar", "conversation", "reading", "all"
    dialect: Optional[str] = None
    custom_vocabulary: List[str] = []


class Settings(BaseModel):
    """Main application settings."""

    # General settings
    default_language: str = "Spanish"
    theme: str = "default"  # Options: "default", "dark", "light", "colorful"
    check_updates: bool = True
    save_analytics: bool = True
    prompt_for_model: bool = True  # Whether to prompt for model selection on startup

    # User settings
    username: str = "language_learner"
    level: int = Field(1, ge=1, le=5)
    daily_goal: int = 15  # Minutes

    # Model settings
    primary_model: str = "claude"  # Options: "ollama", "claude", "openai", etc.
    fallback_model: Optional[str] = "ollama"

    # Model-specific settings
    ollama: OllamaSettings = OllamaSettings()
    claude: CloudModelSettings = CloudModelSettings(model_name=DEFAULT_CLAUDE_MODEL)
    openai: CloudModelSettings = CloudModelSettings()

    # Activity settings
    activities: Dict[str, ActivitySettings] = {
        "flashcards": ActivitySettings(),
        "fill_blank": ActivitySettings(items_per_session=5),
        "chat": ActivitySettings(items_per_session=1, difficulty=1),
        "reading": ActivitySettings(items_per_session=3),
        "translation": ActivitySettings(items_per_session=5),
    }

    # Language-specific settings
    languages: Dict[str, LanguageSettings] = {
        "Spanish": LanguageSettings(),
        "French": LanguageSettings(),
    }

    # Advanced settings
    debug: bool = False
    log_level: str = "info"
    cache_dir: Path = Path.home() / ".cache" / "langue"
    max_cache_size: int = 100  # MB
    proxy: Optional[str] = None

    model_config = ConfigDict(extra="allow")

    def get_model_settings(self, model_name: Optional[str] = None) -> ModelSettings:
        """Get settings for the specified model or the primary model."""
        model = model_name or self.primary_model

        if model == "ollama":
            return self.ollama
        elif model == "claude":
            return self.claude
        elif model == "openai":
            return self.openai
        else:
            return ModelSettings(model_name=model)

    def get_language_settings(self, language: Optional[str] = None) -> LanguageSettings:
        """Get settings for the specified language or the default language."""
        lang = language or self.default_language

        if lang in self.languages:
            return self.languages[lang]

        # If language doesn't exist in settings, create a default one
        self.languages[lang] = LanguageSettings()
        return self.languages[lang]

    def get_api_key(self, model_name: Optional[str] = None) -> Optional[str]:
        """Get API key for the specified model from settings or environment."""
        model = model_name or self.primary_model

        # Try the environment first, using the provider's real env var name
        # (e.g. claude -> ANTHROPIC_API_KEY, not CLAUDE_API_KEY).
        env_var = API_KEY_ENV_VARS.get(model, f"{model.upper()}_API_KEY")
        if os.environ.get(env_var):
            return os.environ[env_var]

        # Fall back to any key persisted in settings.
        model_settings = self.get_model_settings(model)
        return getattr(model_settings, "api_key", None)


def load_default_settings() -> Settings:
    """Load default settings.

    Applies any environment variables that override defaults.
    """
    settings = Settings()

    # Apply environment variables for general settings
    if "DEFAULT_LANGUAGE" in os.environ:
        settings.default_language = os.environ["DEFAULT_LANGUAGE"]

    return settings
