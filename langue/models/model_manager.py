"""
Model Manager for Langue.

This module provides functions for managing language model interfaces,
including initialization, selection, and configuration.
"""

import os
from typing import Optional, Dict, Any

from langue.models.base import ModelInterface, ModelError
from langue.models.ollama import OllamaModelInterface
from langue.models.claude import ClaudeModelInterface
from langue.models.discovery import discover_ollama_models


def get_model_interface(model_name: Optional[str] = None) -> ModelInterface:
    """Get a model interface based on the model name.

    Args:
        model_name: Optional name of the model to use. Format can be:
                   - "ollama:model_name" for Ollama models
                   - "claude:model_name" for Claude models
                   If None, defaults to Ollama with the default model.

    Returns:
        Initialized model interface
    """
    if not model_name:
        # Default to Ollama
        return OllamaModelInterface()

    if model_name.startswith("ollama:"):
        # Extract the specific Ollama model name if provided
        model_id = model_name.split(":", 1)[1] if ":" in model_name else None
        return OllamaModelInterface(model_name=model_id)

    elif model_name.startswith("claude:"):
        # Extract the specific Claude model if provided
        model_id = model_name.split(":", 1)[1] if ":" in model_name else None
        return ClaudeModelInterface(model_name=model_id)

    else:
        # Assume it's an Ollama model name
        return OllamaModelInterface(model_name=model_name)


def get_default_model() -> str:
    """Get the default model name.

    Attempts to discover available models and returns the first one found.
    If no models are discovered, returns "llama3".

    Returns:
        Default model name
    """
    models = discover_ollama_models()
    if models:
        return models[0]
    return "llama3"


def initialize_model_with_fallback(model_name: Optional[str] = None) -> ModelInterface:
    """Initialize a model interface with fallback to simpler models if needed.

    Args:
        model_name: Optional name of the model to use

    Returns:
        Initialized model interface
    """
    try:
        # Try to initialize the requested model
        return get_model_interface(model_name)
    except Exception as e:
        # If that fails, try the default model
        try:
            print(f"Warning: Failed to initialize model {model_name}: {e}")
            print("Trying default model...")
            return get_model_interface(None)
        except Exception as e2:
            # Only fall back to fake responses when the user explicitly opts in,
            # and make it unmistakably loud. Otherwise surface the real failure.
            if os.environ.get("LANGUE_ALLOW_MOCK") == "1":
                banner = "=" * 64
                print(banner)
                print("WARNING: MOCK MODE ENABLED (LANGUE_ALLOW_MOCK=1)")
                print("Responses are FAKE canned text, NOT real AI output.")
                print(banner)
                return MockModelInterface()
            raise ModelError(
                f"Could not initialize any language model (last error: {e2}).",
                kind="unavailable",
                hint="Set ANTHROPIC_API_KEY for Claude, or start Ollama for local "
                     "models. Set LANGUE_ALLOW_MOCK=1 to allow fake offline responses.",
            ) from e2


class MockModelInterface(ModelInterface):
    """A mock model interface that returns predefined responses.

    This is used as a fallback when other models fail to initialize.
    """

    def __init__(self, model_name: str = "mock"):
        """Initialize mock model."""
        self.model_name = model_name

    def get_response(self, prompt: str, system_prompt: str = None, temperature: float = 0.7, max_tokens: int = None, **kwargs) -> str:
        """Return a predefined response.

        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            temperature: Controls randomness (ignored in mock)
            max_tokens: Maximum tokens to generate (ignored in mock)
            **kwargs: Additional parameters (ignored in mock)

        Returns:
            A simple mock response
        """
        # Return a simple JSON response for basic functionality
        return '{"result": "This is a mock response for offline operation."}'

    def check_availability(self) -> bool:
        """Check if the model is available.

        Returns:
            Always True for the mock model
        """
        return True

    @property
    def is_online(self) -> bool:
        """Check if model requires internet access.

        Returns:
            False since this is an offline mock
        """
        return False

    @property
    def name(self) -> str:
        """Get the model's name.

        Returns:
            The model name
        """
        return f"mock:{self.model_name}"

    def get_supported_languages(self) -> list:
        """Get languages supported by this model.

        Returns:
            List of supported languages
        """
        return ["English", "Spanish", "French", "German", "Italian", "Portuguese",
                "Chinese", "Japanese", "Korean", "Russian", "Arabic"]
