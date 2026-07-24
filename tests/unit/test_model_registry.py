"""Regression tests for the central model registry (issue #3).

Locks in that the retired claude-3-haiku default is gone and that model
resolution (aliases, selectors, overrides) behaves as expected.
"""

import os
import pathlib
import unittest
from unittest.mock import patch

import langue
from langue.models import registry


class TestModelRegistry(unittest.TestCase):
    def test_default_is_current_haiku(self):
        self.assertEqual(registry.DEFAULT_CLAUDE_MODEL, "claude-haiku-4-5")
        self.assertEqual(registry.default_claude_model(), "claude-haiku-4-5")

    def test_resolve_none_and_aliases(self):
        self.assertEqual(registry.resolve_claude_model(None), "claude-haiku-4-5")
        self.assertEqual(registry.resolve_claude_model("haiku"), "claude-haiku-4-5")
        self.assertEqual(registry.resolve_claude_model("sonnet"), "claude-sonnet-5")
        self.assertEqual(registry.resolve_claude_model("opus"), "claude-opus-4-8")

    def test_resolve_strips_selector_prefix(self):
        self.assertEqual(registry.resolve_claude_model("claude:sonnet"), "claude-sonnet-5")
        self.assertEqual(
            registry.resolve_claude_model("claude:claude-haiku-4-5"), "claude-haiku-4-5"
        )

    def test_resolve_passthrough_unknown(self):
        # A brand-new model id should pass through unchanged.
        self.assertEqual(registry.resolve_claude_model("claude-future-9"), "claude-future-9")

    def test_context_window(self):
        self.assertEqual(registry.claude_context_window("haiku"), 200_000)
        self.assertEqual(registry.claude_context_window("claude-sonnet-5"), 1_000_000)
        self.assertEqual(
            registry.claude_context_window("unknown"), registry.DEFAULT_CONTEXT_WINDOW
        )

    def test_selector_and_display(self):
        self.assertEqual(registry.default_claude_selector(), "claude:claude-haiku-4-5")
        self.assertEqual(registry.model_display_name("haiku"), "Claude Haiku 4.5")

    def test_env_override(self):
        with patch.dict(os.environ, {"LANGUE_CLAUDE_MODEL": "opus"}):
            self.assertEqual(registry.default_claude_model(), "claude-opus-4-8")

    def test_no_retired_model_ids_in_source(self):
        """Guard: the retired claude-3 / claude-2 / instant IDs must not reappear."""
        pkg_dir = pathlib.Path(langue.__file__).parent
        offenders = []
        for py in pkg_dir.rglob("*.py"):
            text = py.read_text(encoding="utf-8")
            for bad in ("claude-3-", "claude-2.", "claude-instant"):
                if bad in text:
                    offenders.append(f"{py.relative_to(pkg_dir)}: {bad}")
        self.assertEqual(offenders, [], f"Retired model IDs found: {offenders}")


if __name__ == "__main__":
    unittest.main()
