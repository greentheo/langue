#!/usr/bin/env python3
"""
Unit tests for the Chat activity in Langue.

This module contains unit tests for the Chat conversation activity,
verifying its core functionality and proper integration with the 80's theme.
"""

import unittest
from unittest.mock import patch, MagicMock, call
from datetime import datetime, timedelta

# Import the activity to test
from langue.activities.chat import ChatActivity
from langue.activities.base import SYNTHWAVE_THEME, PANEL_BORDER_STYLE


class TestChatActivity(unittest.TestCase):
    """Unit tests for the Chat activity."""

    def setUp(self):
        """Set up test environment before each test."""
        # Create a mock model
        self.mock_model = MagicMock()
        self.mock_model.get_response.return_value = "¡Hola! Soy tu asistente de conversación."
        self.mock_model.get_chat_response.return_value = "Muy bien, gracias."

        # Create patch for the model initialization
        self.model_patcher = patch('langue.activities.chat.ChatActivity._initialize_model')
        self.mock_init_model = self.model_patcher.start()
        self.mock_init_model.return_value = self.mock_model

        # Mock datetime to have consistent results
        self.datetime_patcher = patch('langue.activities.chat.datetime')
        self.mock_datetime = self.datetime_patcher.start()
        self.test_time = datetime(2023, 1, 1, 12, 0, 0)
        self.mock_datetime.now.return_value = self.test_time

    def tearDown(self):
        """Clean up after each test."""
        self.model_patcher.stop()
        self.datetime_patcher.stop()

    def test_initialization(self):
        """Test that the activity initializes correctly."""
        activity = ChatActivity(
            language="Spanish",
            difficulty=2,
            duration_minutes=10,
            correction_mode="gentle"
        )

        # Check initialization parameters
        self.assertEqual(activity.language, "Spanish")
        self.assertEqual(activity.difficulty, 2)
        self.assertEqual(activity.duration_minutes, 10)
        self.assertEqual(activity.correction_mode, "gentle")
        self.assertEqual(activity.turns_count, 0)
        self.assertEqual(activity.points_earned, 0)
        self.assertEqual(len(activity.messages), 0)
        self.assertEqual(len(activity.words_encountered), 0)

        # Verify model was initialized
        self.mock_init_model.assert_called_once()

    @patch('langue.activities.chat.console.print')
    def test_generate_content(self, mock_print):
        """Test that generate_content creates appropriate content."""
        activity = ChatActivity(language="Spanish", difficulty=1)
        content = activity.generate_content()

        # Check that content has the required keys
        self.assertIn('greeting', content)
        self.assertIsInstance(content['greeting'], str)

        # Verify model was called with appropriate parameters - we expect two calls:
        # 1. For the greeting
        # 2. For the vocabulary suggestions
        self.assertEqual(self.mock_model.get_response.call_count, 2)

        # Check first call (greeting)
        first_call_args = self.mock_model.get_response.call_args_list[0]
        self.assertIn('system_prompt', first_call_args[1])
        self.assertIn('CEFR', first_call_args[1]['system_prompt'])
        self.assertIn('Spanish', first_call_args[1]['system_prompt'])

        # Check second call (vocabulary)
        second_call_args = self.mock_model.get_response.call_args_list[1]
        # Check that the vocabulary prompt contains expected keywords
        if isinstance(second_call_args[0], tuple) and len(second_call_args[0]) > 0:
            self.assertIn('vocabulary', second_call_args[0][0].lower())
        else:
            self.assertIn('vocabulary', second_call_args.kwargs.get('prompt', '').lower())

    @patch('langue.activities.chat.console.print')
    def test_present_challenge(self, mock_print):
        """Test that present_challenge displays the conversation interface."""
        activity = ChatActivity(language="Spanish", difficulty=1)
        content = {"greeting": "¡Hola! ¿Cómo estás?", "suggested_vocabulary": {}}

        # Call the method
        activity.present_challenge(content)

        # Verify that prints were called with 80's style elements
        styled_calls = [
            call_args for call_args in mock_print.call_args_list
            if hasattr(call_args[0][0], 'border_style') and call_args[0][0].border_style == PANEL_BORDER_STYLE
        ]
        self.assertGreater(len(styled_calls), 0, "No styled panels were displayed")

        # Check that start time was set
        self.assertEqual(activity.start_time, self.test_time)

    @patch('langue.activities.chat.console.print')
    @patch('langue.activities.chat.console.input')
    def test_process_response(self, mock_input, mock_print):
        """Test that process_response handles user input correctly."""
        activity = ChatActivity(language="Spanish", difficulty=1)
        activity.start_time = self.test_time
        activity.messages = [
            {"role": "system", "content": "System prompt"},
            {"role": "user", "content": "Initial user message"}
        ]

        # Test with a normal response
        content = {"greeting": "¡Hola!"}
        continuing, response = activity.process_response("Hola, ¿cómo estás?", content)

        # Check that the response is handled correctly
        self.assertTrue(continuing)
        self.assertEqual(response, "Muy bien, gracias.")
        self.assertEqual(len(activity.messages), 4)  # 2 original + user msg + assistant response
        self.assertGreater(activity.points_earned, 0)

        # Test with exit command
        continuing, response = activity.process_response("exit", content)
        self.assertFalse(continuing)
        self.assertIn("ending", response.lower())

    @patch('langue.activities.chat.console.print')
    def test_error_handling(self, mock_print):
        """Test error handling in the activity."""
        # Create a mock model that raises an exception
        error_model = MagicMock()
        error_model.get_response.side_effect = Exception("Test error")

        # Create a new activity with this model
        with patch('langue.activities.chat.ChatActivity._initialize_model', return_value=error_model):
            activity = ChatActivity(language="Spanish", difficulty=1)
            content = activity.generate_content()

            # Check that we got a fallback greeting
            self.assertIn("¡Hola!", content["greeting"])

            # Verify error panel was displayed
            panel_calls = [
                call_args for call_args in mock_print.call_args_list
                if hasattr(call_args[0][0], 'title') and ('ERROR' in str(call_args[0][0].title) or 'ＥＲＲＯＲ' in str(call_args[0][0].title))
            ]
            self.assertGreater(len(panel_calls), 0, "No error panel was displayed")

    @patch('langue.activities.chat.console.print')
    def test_show_summary(self, mock_print):
        """Test that _show_summary displays results with 80's style."""
        activity = ChatActivity(language="Spanish", difficulty=1)
        activity.start_time = self.test_time - timedelta(minutes=5)
        activity.end_time = self.test_time
        activity.points_earned = 15
        activity.turns_count = 6
        activity.words_encountered = {"hola", "como", "estas"}
        activity.vocabulary_used = {"hola", "adios", "gracias"}
        activity.corrections_made = ["hola → Hola"]

        # Call the summary method
        activity._show_summary()

        # Verify that a styled panel was displayed
        panel_calls = [
            call_args for call_args in mock_print.call_args_list
            if hasattr(call_args[0][0], 'border_style') and call_args[0][0].border_style == PANEL_BORDER_STYLE
        ]
        self.assertGreater(len(panel_calls), 0, "No styled panel was displayed")

        # Check that the panel title includes the 80's style full-width characters
        title_calls = [
            call_args for call_args in mock_print.call_args_list
            if hasattr(call_args[0][0], 'title') and '【' in call_args[0][0].title
        ]
        self.assertGreater(len(title_calls), 0, "No panel with 80's style title was displayed")

    @patch('langue.activities.chat.console.print')
    @patch('langue.activities.chat.console.input')
    def test_start_method(self, mock_input, mock_print):
        """Test the start method for a complete session."""
        # Set up input sequence: two responses and then exit
        mock_input.side_effect = ["Hola", "Me gusta español", "exit"]

        # Create activity and start it
        activity = ChatActivity(language="Spanish", difficulty=1, duration_minutes=5)
        activity.start()

        # Verify that the session proceeded correctly
        self.assertEqual(mock_input.call_count, 3)
        self.assertGreater(activity.points_earned, 0)
        self.assertEqual(activity.turns_count, 3)  # Initial + 2 turns

        # Check for 80's styled UI elements
        styled_calls = [
            call_args for call_args in mock_print.call_args_list
            if isinstance(call_args[0][0], str) and SYNTHWAVE_THEME['secondary'] in call_args[0][0]
        ]
        self.assertGreater(len(styled_calls), 0, "No styled text was displayed")


if __name__ == "__main__":
    unittest.main()
