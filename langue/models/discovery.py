"""
Model discovery for Langue.

This module provides functionality to discover available language models
that can be used with Langue, both locally (via Ollama) and through cloud services.
"""

import os
import requests
import subprocess
from typing import List, Dict, Optional, Tuple, Any


def discover_available_models() -> List[str]:
    """Discover available language models that can be used with Langue.

    This function checks for:
    1. Local Ollama models
    2. Available cloud models based on API keys

    Returns:
        List of available model names
    """
    models = []

    # Check for Ollama models
    ollama_models = discover_ollama_models()
    if ollama_models:
        models.extend([f"ollama:{model}" for model in ollama_models])

    # Check for cloud model API keys
    if os.environ.get("ANTHROPIC_API_KEY"):
        models.append("claude:haiku")
        models.append("claude:sonnet")

    if os.environ.get("OPENAI_API_KEY"):
        models.append("openai:gpt-3.5-turbo")
        models.append("openai:gpt-4")

    return models


def discover_ollama_models() -> List[str]:
    """Discover local Ollama models.

    Attempts to query the Ollama API to list available models.
    Falls back to checking for common models if API is unavailable.

    Returns:
        List of available Ollama model names
    """
    try:
        # Try the Ollama API first
        response = requests.get("http://localhost:11434/api/tags", timeout=2)
        if response.status_code == 200:
            data = response.json()
            if "models" in data:
                return [model["name"] for model in data["models"]]
    except requests.exceptions.RequestException:
        # If API request fails, try the Ollama CLI
        try:
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True,
                timeout=3
            )
            if result.returncode == 0:
                # Parse the output to extract model names
                lines = result.stdout.strip().split("\n")[1:]  # Skip header row
                models = []
                for line in lines:
                    if line.strip():
                        # First word in each line should be the model name
                        models.append(line.split()[0])
                return models
        except (subprocess.SubprocessError, FileNotFoundError):
            # Ollama CLI not available or failed
            pass

    # If all else fails, check if Ollama is installed but return empty list
    try:
        subprocess.run(["which", "ollama"], capture_output=True, check=True)
        # Ollama is installed but we couldn't get models, return empty list
        return []
    except subprocess.SubprocessError:
        # Ollama is not installed
        return []


def get_model_capabilities(model_name: str) -> Dict[str, Any]:
    """Get capabilities of a specific model.

    Args:
        model_name: Name of the model to check

    Returns:
        Dictionary with model capabilities including supported languages,
        context size, and features
    """
    # Parse model type and name
    if ":" in model_name:
        model_type, model_id = model_name.split(":", 1)
    else:
        model_type = "ollama"  # Default to Ollama
        model_id = model_name

    # Default capabilities
    capabilities = {
        "supported_languages": [
            "English", "Spanish", "French", "German", "Italian",
            "Portuguese", "Dutch", "Russian", "Chinese", "Japanese"
        ],
        "context_window": 4096,
        "features": ["chat", "translation", "grammar_correction"],
        "offline": False
    }

    # Adjust capabilities based on model
    if model_type == "ollama":
        capabilities["offline"] = True

        # Adjust capabilities based on specific Ollama models
        if "llama" in model_id.lower():
            capabilities["context_window"] = 4096
        elif "mistral" in model_id.lower():
            capabilities["context_window"] = 8192
        elif "gemma" in model_id.lower():
            capabilities["context_window"] = 8192

    elif model_type == "claude":
        if "haiku" in model_id.lower():
            capabilities["context_window"] = 200000
        elif "sonnet" in model_id.lower():
            capabilities["context_window"] = 200000

    elif model_type == "openai":
        if "gpt-4" in model_id.lower():
            capabilities["context_window"] = 8192
            capabilities["supported_languages"].extend(["Arabic", "Hindi", "Bengali"])
        elif "gpt-3.5" in model_id.lower():
            capabilities["context_window"] = 4096

    return capabilities


def get_recommended_model(required_capabilities: Dict[str, Any]) -> Optional[str]:
    """Get the recommended model based on required capabilities.

    Args:
        required_capabilities: Dictionary of required capabilities

    Returns:
        Name of the recommended model or None if no suitable model is available
    """
    available_models = discover_available_models()

    # Filter models based on required capabilities
    suitable_models = []

    for model in available_models:
        capabilities = get_model_capabilities(model)
        meets_requirements = True

        # Check if model meets all requirements
        for key, value in required_capabilities.items():
            if key == "supported_languages":
                # For languages, just need to support the required language
                if not any(lang in capabilities["supported_languages"] for lang in value):
                    meets_requirements = False
                    break
            elif key == "context_window":
                # For context window, need at least the required size
                if capabilities["context_window"] < value:
                    meets_requirements = False
                    break
            elif key == "offline" and value is True:
                # If offline capability is required
                if not capabilities["offline"]:
                    meets_requirements = False
                    break
            elif key == "features":
                # For features, need to support all required features
                if not all(feature in capabilities["features"] for feature in value):
                    meets_requirements = False
                    break

        if meets_requirements:
            suitable_models.append(model)

    if not suitable_models:
        return None

    # Prioritize models: first offline if requested, then by capability
    if required_capabilities.get("offline", False):
        offline_models = [m for m in suitable_models if get_model_capabilities(m)["offline"]]
        if offline_models:
            return offline_models[0]

    # Otherwise return the first suitable model
    return suitable_models[0]
