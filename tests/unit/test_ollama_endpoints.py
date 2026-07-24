"""Regression tests for Ollama endpoint/URL fixes (issue #5).

The management calls must use the native /api/* endpoints (not /v1/*), the URL
must be built from the trailing-slash-stripped server, null generation params
must be omitted, and the default model must come from the registry.
"""

import unittest
from unittest.mock import patch, MagicMock

from langue.models.ollama import OllamaModelInterface
from langue.models import registry


def _resp(status=200, data=None):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = data or {}
    r.raise_for_status.return_value = None
    return r


class TestOllamaEndpoints(unittest.TestCase):
    def test_check_availability_uses_api_tags(self):
        o = OllamaModelInterface(model_name="llama3.2")
        with patch(
            "langue.models.ollama.requests.get",
            return_value=_resp(200, {"models": [{"name": "llama3.2"}]}),
        ) as get:
            self.assertTrue(o.check_availability())
        url = get.call_args[0][0]
        self.assertTrue(url.endswith("/api/tags"), f"used {url}")

    def test_get_model_info_uses_api_show(self):
        o = OllamaModelInterface(model_name="llama3.2")
        with patch(
            "langue.models.ollama.requests.post",
            return_value=_resp(200, {"parameters": {}}),
        ) as post:
            o.get_model_info()
        url = post.call_args[0][0]
        self.assertTrue(url.endswith("/api/show"), f"used {url}")

    def test_url_construction_strips_trailing_slash(self):
        o = OllamaModelInterface(server_url="http://localhost:11434/")
        self.assertEqual(o._api_url, "http://localhost:11434/v1")
        self.assertEqual(o._legacy_api_url, "http://localhost:11434/api")

    def test_default_model_from_registry(self):
        self.assertEqual(OllamaModelInterface()._model_name, registry.DEFAULT_OLLAMA_MODEL)

    def test_null_generation_params_omitted(self):
        o = OllamaModelInterface(model_name="llama3.2")
        captured = {}

        def fake_post(url, json=None, timeout=None):
            captured.clear()
            captured.update(json or {})
            return _resp(200, {"choices": [{"message": {"content": "hi"}}]})

        with patch("langue.models.ollama.requests.post", side_effect=fake_post):
            o.get_response("hi")  # temperature and max_tokens left as None
        self.assertNotIn("temperature", captured)
        self.assertNotIn("max_tokens", captured)


if __name__ == "__main__":
    unittest.main()
