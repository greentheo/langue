"""
Claude model interface for Langue.

This module provides an implementation of the ModelInterface for cloud-based Claude models.
"""

import os
from typing import Dict, List, Optional, Any

import anthropic
from anthropic import Anthropic
from anthropic.types import MessageParam

from langue.models.base import ModelInterface, ModelError
from langue.models import registry


class ClaudeModelInterface(ModelInterface):
    """Interface for Claude models."""

    def __init__(self, model_name: Optional[str] = None, api_key: Optional[str] = None):
        """Initialize the Claude model interface.

        Args:
            model_name: Claude model ID, alias (e.g. "haiku"), or "claude:<id>"
                selector. If None, the registry default is used.
            api_key: Anthropic API key (if None, will try to get from environment)
        """
        self._model_name = registry.resolve_claude_model(model_name)
        self._api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")

        if not self._api_key:
            raise ModelError(
                "No API key provided for Claude.", kind="auth",
                hint="Add ANTHROPIC_API_KEY to your .env file or environment, "
                     "or use a local Ollama model instead.")

        try:
            self._client = Anthropic(api_key=self._api_key)
        except Exception as e:
            raise ModelError(
                f"Failed to initialize the Claude client: {e}",
                kind="unknown",
                hint="Check your anthropic SDK install and ANTHROPIC_API_KEY.",
            ) from e

    def _raise_model_error(self, err: Exception) -> None:
        """Translate an Anthropic SDK error into a typed ModelError and raise it."""
        if isinstance(err, anthropic.AuthenticationError):
            raise ModelError(
                "Claude authentication failed.", kind="auth",
                hint="Check that ANTHROPIC_API_KEY is set and valid.") from err
        if isinstance(err, anthropic.NotFoundError):
            raise ModelError(
                f"Claude model '{self._model_name}' was not found.", kind="not_found",
                hint="The model may be retired or not enabled for your account. "
                     "Update the model in Settings.") from err
        if isinstance(err, anthropic.RateLimitError):
            raise ModelError(
                "Claude rate limit exceeded.", kind="rate_limit",
                hint="Wait a moment and try again.") from err
        if isinstance(err, anthropic.APIConnectionError):
            raise ModelError(
                "Could not reach the Claude API.", kind="connection",
                hint="Check your internet connection.") from err
        raise ModelError(f"Claude API error: {err}", kind="unknown") from err

    def get_response(self, prompt: str, system_prompt: Optional[str] = None,
                     temperature: Optional[float] = None, max_tokens: Optional[int] = None,
                     **kwargs) -> str:
        """Get a response from the Claude model.

        Args:
            prompt: The user's message or prompt
            system_prompt: Optional system instructions to guide the model
            temperature: Controls randomness (0.0-1.0)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional Claude-specific parameters

        Returns:
            The model's response as a string

        Raises:
            ValueError: If there's an issue with the request parameters
            RuntimeError: For API errors
        """
        try:
            # Convert message format
            messages: List[MessageParam] = [
                {"role": "user", "content": prompt}
            ]

            # Set up parameters
            params = {
                "model": self._model_name,
                "messages": messages,
                "max_tokens": max_tokens or 1000,
            }

            # Add optional parameters
            if system_prompt:
                params["system"] = system_prompt
            if temperature is not None:
                params["temperature"] = temperature

            # Add any additional parameters
            for key, value in kwargs.items():
                params[key] = value

            # Make the API call
            response = self._client.messages.create(**params)
            return response.content[0].text

        except anthropic.APIError as api_error:
            self._raise_model_error(api_error)
        except ModelError:
            raise
        except Exception as e:
            raise ModelError(f"Unexpected error calling Claude: {e}", kind="unknown") from e

    def get_supported_languages(self) -> List[str]:
        """Get a list of languages supported by Claude models.

        Returns:
            List of language names supported for learning
        """
        # Claude supports many languages, this is a non-exhaustive list
        return [
            "English", "Spanish", "French", "German", "Italian",
            "Portuguese", "Dutch", "Russian", "Chinese", "Japanese",
            "Korean", "Arabic", "Hindi", "Bengali", "Turkish",
            "Vietnamese", "Thai", "Indonesian", "Malay", "Swahili"
        ]

    @property
    def is_online(self) -> bool:
        """Check if the model requires internet access.

        Returns:
            True, as Claude models require API access
        """
        return True

    @property
    def name(self) -> str:
        """Get the name of the model.

        Returns:
            String identifier for the model
        """
        return f"claude:{self._model_name}"

    def check_availability(self) -> bool:
        """Check if the model is available and ready to use.

        Returns:
            True if the API key is set and a simple test request works
        """
        if not self._api_key:
            return False

        try:
            # Make a minimal API call to test connectivity
            self._client.messages.create(
                model=self._model_name,
                max_tokens=10,
                messages=[
                    {"role": "user", "content": "Hello"}
                ]
            )
            return True
        except Exception:
            return False

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the Claude model.

        Returns:
            Dictionary containing model information
        """
        info = {
            "name": self.name,
            "type": "claude",
            "offline": False,
            "model_name": self._model_name,
            "context_window": self._get_context_window(),
            "api_key_configured": bool(self._api_key),
        }

        return info

    def _get_context_window(self) -> int:
        """Get the context window size for the current model.

        Returns:
            Integer representing the token context window
        """
        return registry.claude_context_window(self._model_name)

    def get_chat_response(self, messages: List[Dict[str, str]],
                          temperature: Optional[float] = None,
                          max_tokens: Optional[int] = None,
                          **kwargs) -> str:
        """Get a chat response from the Claude model using a messages format.

        Args:
            messages: List of message dictionaries with 'role' and 'content'
            temperature: Controls randomness (0.0-1.0)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional Claude-specific parameters

        Returns:
            The model's response as a string
        """
        try:
            # Extract system message if present
            system_prompt = None
            chat_messages: List[MessageParam] = []

            for message in messages:
                if message["role"] == "system":
                    system_prompt = message["content"]
                else:
                    # Convert to Claude's message format
                    chat_messages.append({
                        "role": message["role"],
                        "content": message["content"]
                    })

            # Set up parameters
            params = {
                "model": self._model_name,
                "messages": chat_messages,
                "max_tokens": max_tokens or 1000,
            }

            # Add optional parameters
            if system_prompt:
                params["system"] = system_prompt
            if temperature is not None:
                params["temperature"] = temperature

            # Add any additional parameters
            for key, value in kwargs.items():
                params[key] = value

            # Make the API call
            response = self._client.messages.create(**params)
            return response.content[0].text

        except anthropic.APIError as api_error:
            self._raise_model_error(api_error)
        except ModelError:
            raise
        except Exception as e:
            raise ModelError(f"Unexpected error calling Claude: {e}", kind="unknown") from e
