"""
Base model interface for Langue.

This module provides the abstract base class for all model interfaces used in Langue.
"""

import abc
from typing import Dict, List, Optional, Any


class ModelInterface(abc.ABC):
    """Abstract base class for model interfaces.

    This class defines the interface that all model implementations must provide,
    regardless of whether they're local (Ollama) or cloud-based (Claude, OpenAI).
    """

    @abc.abstractmethod
    def get_response(self, prompt: str, system_prompt: Optional[str] = None,
                     temperature: Optional[float] = None, max_tokens: Optional[int] = None,
                     **kwargs) -> str:
        """Get a response from the model for the given prompt.

        Args:
            prompt: The user's message or prompt
            system_prompt: Optional system instructions to guide the model
            temperature: Controls randomness (0.0-1.0)
            max_tokens: Maximum number of tokens to generate
            **kwargs: Additional model-specific parameters

        Returns:
            The model's response as a string
        """
        pass

    @abc.abstractmethod
    def get_supported_languages(self) -> List[str]:
        """Get a list of languages supported by this model.

        Returns:
            List of language names supported for learning
        """
        pass

    @property
    @abc.abstractmethod
    def is_online(self) -> bool:
        """Check if the model requires internet access.

        Returns:
            True if the model requires internet, False if it can work offline
        """
        pass

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Get the name of the model.

        Returns:
            String identifier for the model
        """
        pass

    @abc.abstractmethod
    def check_availability(self) -> bool:
        """Check if the model is available and ready to use.

        This method should verify that any required API keys are set
        or that local models are properly installed.

        Returns:
            True if the model is available, False otherwise
        """
        pass

    @abc.abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the model.

        Returns:
            Dictionary containing model information such as name, version,
            whether it's online/offline, etc.
        """
        pass
