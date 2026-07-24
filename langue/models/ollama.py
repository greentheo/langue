"""
Ollama model interface for Langue.

This module provides an implementation of the ModelInterface for local Ollama models.
"""

import json
import requests
from typing import Dict, List, Optional, Any

from langue.models.base import ModelInterface, ModelError
from langue.models import registry


class OllamaModelInterface(ModelInterface):
    """Interface for local Ollama models."""

    def __init__(self, model_name: Optional[str] = None, server_url: str = "http://localhost:11434"):
        """Initialize the Ollama model interface.

        Args:
            model_name: Name of the Ollama model to use (defaults to the
                registry default when None).
            server_url: URL of the Ollama server
        """
        self._model_name = model_name or registry.DEFAULT_OLLAMA_MODEL
        self._server_url = server_url.rstrip("/")
        # OpenAI-compatible endpoint (chat) vs native management endpoints (tags/show).
        self._api_url = f"{self._server_url}/v1"
        self._legacy_api_url = f"{self._server_url}/api"

    def get_response(self, prompt: str, system_prompt: Optional[str] = None,
                     temperature: Optional[float] = None, max_tokens: Optional[int] = None,
                     **kwargs) -> str:
        """Get a response from the Ollama model.

        Args:
            prompt: The user's message or prompt
            system_prompt: Optional system instructions to guide the model
            temperature: Controls randomness (0.0-1.0)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional Ollama-specific parameters

        Returns:
            The model's response as a string

        Raises:
            ConnectionError: If the Ollama server cannot be reached
            ValueError: If there's an issue with the request parameters
            RuntimeError: For other API errors
        """
        request_data = {
            "model": self._model_name,
            "prompt": prompt,
            "stream": False
        }

        # Add optional parameters if provided
        if system_prompt:
            request_data["system"] = system_prompt
        if temperature is not None:
            request_data["temperature"] = temperature
        if max_tokens is not None:
            request_data["num_predict"] = max_tokens

        # Add any additional parameters
        for key, value in kwargs.items():
            request_data[key] = value

        try:
            # Try the v1 API first (OpenAI compatible)
            chat_request = {
                "model": self._model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt if system_prompt else "You are a helpful assistant."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
            }
            # Only send optional params when set — some servers reject nulls.
            if temperature is not None:
                chat_request["temperature"] = temperature
            if max_tokens is not None:
                chat_request["max_tokens"] = max_tokens

            response = requests.post(
                f"{self._api_url}/chat/completions",
                json=chat_request,
                timeout=60  # Longer timeout for generation
            )

            # If v1 API fails, try the legacy API
            if response.status_code != 200:
                response = requests.post(
                    f"{self._legacy_api_url}/generate",
                    json=request_data,
                    timeout=60  # Longer timeout for generation
                )
            response.raise_for_status()
            data = response.json()

            # Handle response from v1 API
            if "choices" in data:
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
            # Handle response from legacy API
            else:
                return data.get("response", "")
        except requests.exceptions.ConnectionError as e:
            raise ModelError(
                f"Could not connect to the Ollama server at {self._server_url}.",
                kind="connection",
                hint="Is Ollama running? Start it with 'ollama serve'.") from e
        except requests.exceptions.HTTPError as e:
            raise ModelError(
                f"Ollama returned an error for model '{self._model_name}': {e}",
                kind="unavailable",
                hint=f"Is the model installed? Try 'ollama pull {self._model_name}'.") from e
        except requests.exceptions.RequestException as e:
            raise ModelError(f"Error communicating with Ollama: {e}", kind="connection") from e
        except json.JSONDecodeError as e:
            raise ModelError("Invalid response from the Ollama server.", kind="unknown") from e

    def get_supported_languages(self) -> List[str]:
        """Get a list of languages supported by this Ollama model.

        Returns:
            List of language names supported for learning
        """
        # Common languages supported by most LLMs
        return [
            "English", "Spanish", "French", "German", "Italian",
            "Portuguese", "Dutch", "Russian", "Chinese", "Japanese"
        ]

    @property
    def is_online(self) -> bool:
        """Check if the model requires internet access.

        Returns:
            False, as Ollama models work offline
        """
        return False

    @property
    def name(self) -> str:
        """Get the name of the model.

        Returns:
            String identifier for the model
        """
        return f"ollama:{self._model_name}"

    def check_availability(self) -> bool:
        """Check if the model is available and ready to use.

        Returns:
            True if the Ollama server is running and the model is available
        """
        try:
            # Check if Ollama server is running (native endpoint, not /v1)
            response = requests.get(f"{self._legacy_api_url}/tags", timeout=2)
            response.raise_for_status()

            # Check if this specific model is available
            models_data = response.json()
            available_models = [model["name"] for model in models_data.get("models", [])]

            return self._model_name in available_models
        except (requests.exceptions.RequestException, json.JSONDecodeError, KeyError):
            return False

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the Ollama model.

        Returns:
            Dictionary containing model information
        """
        info = {
            "name": self.name,
            "type": "ollama",
            "offline": True,
            "server_url": self._server_url,
            "model_name": self._model_name,
        }

        try:
            # Try to get more details about the model
            response = requests.post(
                f"{self._legacy_api_url}/show",
                json={"model": self._model_name},
                timeout=5
            )

            if response.status_code == 200:
                model_data = response.json()
                # Add relevant details from the response
                info.update({
                    "parameters": model_data.get("parameters", {}),
                    "template": model_data.get("template", ""),
                    "license": model_data.get("license", ""),
                    "size": model_data.get("size", 0),
                })
        except (requests.exceptions.RequestException, json.JSONDecodeError):
            # If we can't get details, just return the basic info
            pass

        return info

    def get_chat_response(self, messages: List[Dict[str, str]],
                          temperature: Optional[float] = None,
                          max_tokens: Optional[int] = None,
                          **kwargs) -> str:
        """Get a chat response from the Ollama model using a messages format.

        Args:
            messages: List of message dictionaries with 'role' and 'content'
            temperature: Controls randomness (0.0-1.0)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional Ollama-specific parameters

        Returns:
            The model's response as a string
        """
        # Extract system message if present
        system_prompt = None
        chat_messages = []

        for message in messages:
            if message["role"] == "system":
                system_prompt = message["content"]
            else:
                chat_messages.append(message)

        # Build the prompt from the messages
        if not chat_messages:
            # If there are no non-system messages, just use an empty prompt
            prompt = ""
        else:
            # Format messages as a conversation
            prompt_parts = []
            for message in chat_messages:
                role_prefix = "User: " if message["role"] == "user" else "Assistant: "
                prompt_parts.append(f"{role_prefix}{message['content']}")

            prompt = "\n".join(prompt_parts)

            # Add a final "Assistant: " to prompt the model to respond
            if chat_messages[-1]["role"] == "user":
                prompt += "\nAssistant: "

        # Call the regular get_response method
        return self.get_response(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
