"""Regression tests for beginner conversation support.

Covers the bilingual default, in-chat command dispatch, translation caching, and
that the instructor system prompt honors the learner's level (A1 gets the
simpler-language block; the old code capped the level at C1 and ignored it).
Uses a recording stub model — no network.
"""

import unittest
from unittest.mock import patch

from langue.models.base import ModelInterface
from langue.activities.chat import ChatActivity


class _RecordingModel(ModelInterface):
    def __init__(self, reply="Bonjour !"):
        self.reply = reply
        self.calls = []

    def get_response(self, prompt, system_prompt=None, temperature=None, max_tokens=None, **kw):
        self.calls.append({"prompt": prompt, "system_prompt": system_prompt})
        return self.reply

    def get_chat_response(self, messages, temperature=None, max_tokens=None, **kw):
        self.calls.append({"messages": messages})
        return self.reply

    def get_supported_languages(self):
        return ["French"]

    @property
    def is_online(self):
        return False

    @property
    def name(self):
        return "recording"

    def check_availability(self):
        return True

    def get_model_info(self):
        return {}


def _make(level="a1", model=None):
    model = model or _RecordingModel()
    with patch.object(ChatActivity, "_initialize_model", return_value=model):
        activity = ChatActivity(language="French", difficulty=1, level=level, user_id="t")
    return activity, model


class TestChatBeginner(unittest.TestCase):
    def test_bilingual_default_by_level(self):
        self.assertTrue(_make("a1")[0].show_translations)
        self.assertTrue(_make("a2")[0].show_translations)
        self.assertFalse(_make("b1")[0].show_translations)

    def test_handle_command_dispatch(self):
        a, _ = _make("a1")
        a.last_ai_message = "Bonjour !"
        for cmd in ("/t", "/hint", "/word chat", "/help"):
            self.assertTrue(a._handle_command(cmd), cmd)
        # A normal message is not a command.
        self.assertFalse(a._handle_command("Bonjour, ça va ?"))

    def test_bilingual_toggle(self):
        a, _ = _make("a1")
        before = a.show_translations
        self.assertTrue(a._handle_command("/bilingual"))
        self.assertNotEqual(before, a.show_translations)

    def test_translation_is_cached(self):
        a, model = _make("a1", _RecordingModel(reply="Hello!"))
        self.assertEqual(a._translate_to_native("Bonjour !"), "Hello!")
        calls = len(model.calls)
        self.assertEqual(a._translate_to_native("Bonjour !"), "Hello!")  # cache hit
        self.assertEqual(len(model.calls), calls)

    def test_beginner_system_prompt_honors_level(self):
        a, model = _make("a1")
        a.generate_content()
        system_prompt = next(c["system_prompt"] for c in model.calls if c.get("system_prompt"))
        self.assertIn("A1", system_prompt)
        self.assertIn("BEGINNER", system_prompt)

    def test_advanced_prompt_is_not_beginner(self):
        a, model = _make("c1")
        a.generate_content()
        system_prompt = next(c["system_prompt"] for c in model.calls if c.get("system_prompt"))
        self.assertIn("C1", system_prompt)          # honors level (old code capped at C1 via difficulty)
        self.assertNotIn("BEGINNER", system_prompt)


if __name__ == "__main__":
    unittest.main()
