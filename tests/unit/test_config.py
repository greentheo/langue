"""Regression tests for the config layer (issue #6).

Covers the API-key env-var mapping, that secrets are never written to disk, that
the shipped example config matches the real schema, and the Ollama env override.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import toml

from langue.config.settings import Settings, OllamaSettings
from langue.config.manager import ConfigManager

REPO_ROOT = Path(__file__).resolve().parents[2]


class TestConfig(unittest.TestCase):
    def test_api_key_uses_anthropic_env(self):
        s = Settings()
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-a", "CLAUDE_API_KEY": "nope"}):
            self.assertEqual(s.get_api_key("claude"), "sk-a")

    def test_api_key_openai_env(self):
        s = Settings()
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-o"}, clear=False):
            self.assertEqual(s.get_api_key("openai"), "sk-o")

    def test_secrets_redacted_on_save(self):
        with tempfile.TemporaryDirectory() as td:
            cm = ConfigManager(config_dir=Path(td))
            cm.settings.claude.api_key = "sk-super-secret"
            cm.save_settings()
            on_disk = toml.load(Path(td) / "config.toml")
        self.assertEqual(on_disk["claude"].get("api_key", ""), "")

    def test_example_config_matches_schema(self):
        example = toml.load(str(REPO_ROOT / "config_example.toml"))
        s = Settings.model_validate(example)
        self.assertEqual(s.primary_model, "claude")
        self.assertEqual(s.claude.model_name, "claude-haiku-4-5")
        self.assertEqual(s.ollama.model_name, "llama3.2")

    def test_ollama_env_override(self):
        with patch.dict(os.environ, {"OLLAMA_MODEL": "mistral"}):
            self.assertEqual(OllamaSettings().model_name, "mistral")


if __name__ == "__main__":
    unittest.main()
