"""Regression tests for honest model failures (issues #4, #5).

Ensures the model layer raises typed ModelError instead of returning fabricated
text, that the mock model is opt-in only, and that Ollama errors are mapped.
All network/SDK calls are mocked — no API key or Ollama server required.
"""

import os
import unittest
from unittest.mock import patch, MagicMock

import anthropic
import httpx
import requests

from langue.models.base import ModelError
from langue.models.claude import ClaudeModelInterface
from langue.models.ollama import OllamaModelInterface
from langue.models.model_manager import initialize_model_with_fallback, MockModelInterface

_CANNED = "I'm having trouble connecting"  # the old fake-fallback string


def _anthropic_error(cls, status):
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("boom", response=httpx.Response(status, request=req), body=None)


class TestClaudeErrorMapping(unittest.TestCase):
    def _make_client(self):
        with patch("langue.models.claude.Anthropic", return_value=MagicMock()):
            return ClaudeModelInterface(model_name="claude-haiku-4-5", api_key="sk-test")

    def test_missing_key_raises_auth(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ModelError) as cm:
                ClaudeModelInterface(api_key=None)
        self.assertEqual(cm.exception.kind, "auth")

    def test_maps_authentication_error(self):
        m = self._make_client()
        m._client.messages.create.side_effect = _anthropic_error(anthropic.AuthenticationError, 401)
        with self.assertRaises(ModelError) as cm:
            m.get_response("hi")
        self.assertEqual(cm.exception.kind, "auth")

    def test_maps_not_found(self):
        m = self._make_client()
        m._client.messages.create.side_effect = _anthropic_error(anthropic.NotFoundError, 404)
        with self.assertRaises(ModelError) as cm:
            m.get_response("hi")
        self.assertEqual(cm.exception.kind, "not_found")

    def test_maps_rate_limit(self):
        m = self._make_client()
        m._client.messages.create.side_effect = _anthropic_error(anthropic.RateLimitError, 429)
        with self.assertRaises(ModelError) as cm:
            m.get_response("hi")
        self.assertEqual(cm.exception.kind, "rate_limit")

    def test_never_returns_canned_fallback(self):
        """Both response paths must raise, never return the old fake string."""
        m = self._make_client()
        m._client.messages.create.side_effect = _anthropic_error(anthropic.NotFoundError, 404)
        with self.assertRaises(ModelError):
            m.get_response("hi")
        m._client.messages.create.side_effect = _anthropic_error(anthropic.AuthenticationError, 401)
        with self.assertRaises(ModelError):
            m.get_chat_response([{"role": "user", "content": "hi"}])

    def test_success_returns_text(self):
        m = self._make_client()
        block = MagicMock(); block.text = "hello"
        resp = MagicMock(); resp.content = [block]
        m._client.messages.create.side_effect = None
        m._client.messages.create.return_value = resp
        self.assertEqual(m.get_response("hi"), "hello")
        self.assertNotIn(_CANNED, m.get_response("hi"))


class TestOllamaErrorMapping(unittest.TestCase):
    def test_connection_error_maps_to_model_error(self):
        o = OllamaModelInterface(model_name="llama3.2")
        with patch(
            "langue.models.ollama.requests.post",
            side_effect=requests.exceptions.ConnectionError("down"),
        ):
            with self.assertRaises(ModelError) as cm:
                o.get_response("hi")
        self.assertEqual(cm.exception.kind, "connection")


class TestMockGating(unittest.TestCase):
    def test_raises_without_optin(self):
        with patch(
            "langue.models.model_manager.get_model_interface",
            side_effect=RuntimeError("boom"),
        ):
            with patch.dict(os.environ, {}, clear=True):
                with self.assertRaises(ModelError):
                    initialize_model_with_fallback("claude:x")

    def test_returns_mock_with_optin(self):
        with patch(
            "langue.models.model_manager.get_model_interface",
            side_effect=RuntimeError("boom"),
        ):
            with patch.dict(os.environ, {"LANGUE_ALLOW_MOCK": "1"}):
                m = initialize_model_with_fallback("claude:x")
        self.assertIsInstance(m, MockModelInterface)


if __name__ == "__main__":
    unittest.main()
