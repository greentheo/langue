#!/usr/bin/env python3
"""
End-to-end tests for the Chat activity in Langue.

This module tests the conversation practice functionality,
ensuring that the chat interface works correctly with the 80's theme.
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
import time
from datetime import datetime

# Add the project root directory to Python path
project_root = Path(__file__).parents[3]
sys.path.append(str(project_root))

from langue.activities.chat import ChatActivity
from langue.activities.base import SYNTHWAVE_THEME


class TestChatActivity(unittest.TestCase):
    """Test case for the Chat activity."""

    def setUp(self):
        """Set up test environment."""
        # Mock the model response
        self.patcher = patch('langue.activities.chat.ChatActivity._initialize_model')
        self.mock_initialize_model = self.patcher.start()

        # Create a mock model
        self.mock_model = MagicMock()
        # We need to handle both the main prompt and vocabulary generation
        self.mock_model.get_response = MagicMock()
        self.mock_model.get_response.return_value = "¡Hola! ¿Cómo estás? Soy tu asistente de conversación."
        self.mock_model.get_chat_response = MagicMock()
        self.mock_model.get_chat_response.return_value = "Muy bien, gracias. ¿Y tú? ¿Qué te gusta hacer en tu tiempo libre?"

        # Configure mock to return our mock model
        self.mock_initialize_model.return_value = self.mock_model

    def tearDown(self):
        """Clean up after tests."""
        self.patcher.stop()

    @patch('langue.activities.chat.console.input')
    @patch('langue.activities.chat.console.print')
    def test_chat_basic_functionality(self, mock_print, mock_input):
        """Test basic chat functionality."""
        # Set up mock input to simulate user responses
        mock_input.side_effect = ["Estoy bien, gracias.", "exit"]

        # Create chat activity
        activity = ChatActivity(
            language="Spanish",
            difficulty=1,
            duration_minutes=0.1,  # Short duration for testing
            correction_mode="none"
        )

        # Start the activity
        activity.start()

        # Verify model was called (don't check exact number since vocabulary generation is optional)
        self.assertTrue(self.mock_model.get_response.called)
        self.assertTrue(self.mock_model.get_chat_response.called)

        # Verify console.print was called with 80's style elements
        styled_calls = [
            call_args[0][0] for call_args in mock_print.call_args_list
            if isinstance(call_args[0][0], str) and f"{SYNTHWAVE_THEME['secondary']}" in call_args[0][0]
        ]

        # Verify that at least one styled print call was made
        self.assertGreater(len(styled_calls), 0, "No styled print calls were made")

    @patch('langue.activities.chat.console.input')
    @patch('langue.activities.chat.console.print')
    def test_chat_vocabulary_tracking(self, mock_print, mock_input):
        """Test that vocabulary is properly tracked."""
        # Set up mock input to simulate user responses
        mock_input.side_effect = ["Hola, estoy aprendiendo español.", "exit"]

        # Create chat activity
        activity = ChatActivity(
            language="Spanish",
            difficulty=1,
            duration_minutes=0.1
        )

        # Start the activity
        activity.start()

        # Verify words were tracked
        self.assertGreater(len(activity.words_encountered), 0, "No words were tracked")
        self.assertGreater(len(activity.vocabulary_used), 0, "No vocabulary was recorded")

    @patch('langue.activities.chat.console.input')
    @patch('langue.activities.chat.datetime')
    def test_chat_duration_limit(self, mock_datetime, mock_input):
        """Test that chat stops after duration limit is reached."""
        # Set up mock datetime to simulate time passing
        start_time = datetime(2023, 1, 1, 12, 0, 0)
        mock_datetime.now.side_effect = [
            start_time,  # First call in start()
            start_time,  # Second call in process_response
            datetime(2023, 1, 1, 12, 11, 0),  # Third call - 11 minutes later
        ]

        # Set up mock input for user responses
        mock_input.side_effect = ["Hola", "¿Cómo estás?", "This should not be called"]

        # Create chat activity with 10 minute duration
        activity = ChatActivity(
            language="Spanish",
            difficulty=1,
            duration_minutes=10
        )

        # Mock the _show_summary method to avoid additional datetime calls
        activity._show_summary = MagicMock()

        # Start the activity
        activity.start()

        # Verify that only 2 inputs were processed (the third would exceed the time limit)
        self.assertEqual(mock_input.call_count, 2, "Wrong number of inputs processed")

    @patch('langue.activities.chat.console.input')
    @patch('langue.activities.chat.console.print')
    def test_chat_panel_styling(self, mock_print, mock_input):
        """Test that chat uses proper panel styling with 80's theme."""
        # Set up mock input
        mock_input.side_effect = ["Hola", "exit"]

        # Create chat activity
        activity = ChatActivity(
            language="Spanish",
            difficulty=1,
            duration_minutes=0.1
        )

        # Start the activity
        activity.start()

        # Check for panel styling in print calls
        panel_calls = [
            call_args for call_args in mock_print.call_args_list
            if len(call_args[0]) > 0 and hasattr(call_args[0][0], 'title')
            and call_args[0][0].title is not None and '【' in str(call_args[0][0].title)
        ]

        # Verify that at least one panel with proper styling was displayed
        self.assertGreater(len(panel_calls), 0, "No properly styled panels were displayed")


if __name__ == "__main__":
    unittest.main()
