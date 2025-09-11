"""
Model interfaces for Langue.

This module provides interfaces for different language models that can be used with Langue,
including local models via Ollama and cloud-based models like Claude and OpenAI.
"""

from langue.models.base import ModelInterface
from langue.models.discovery import discover_available_models
from langue.models.model_manager import get_model_interface

__all__ = ["ModelInterface", "discover_available_models", "get_model_interface"]
