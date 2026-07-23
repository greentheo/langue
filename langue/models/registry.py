"""Central registry of language-model identifiers.

Single source of truth for default model IDs, friendly aliases, and metadata.
Every Claude call site resolves its model here instead of hardcoding an ID, so a
model retirement (like the Claude 3 family) is a one-line change in this file.

Override the default Claude model at runtime with the ``LANGUE_CLAUDE_MODEL``
environment variable (accepts a canonical ID or an alias like ``haiku``).
"""

import os
from typing import Dict, Optional

# Default cloud model: Claude Haiku 4.5 — current fast/cheap tier ($1/$5 per MTok,
# 200K context). Replaced the retired Claude 3 Haiku snapshot, which now 404s.
DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5"

# Default local model, used only when Ollama discovery finds nothing installed.
DEFAULT_OLLAMA_MODEL = "llama3.2"

# Canonical Claude catalog. Keep in sync with https://docs.claude.com model list.
CLAUDE_MODELS: Dict[str, Dict[str, object]] = {
    "claude-haiku-4-5": {"display": "Claude Haiku 4.5", "context_window": 200_000},
    "claude-sonnet-5": {"display": "Claude Sonnet 5", "context_window": 1_000_000},
    "claude-opus-4-8": {"display": "Claude Opus 4.8", "context_window": 1_000_000},
}

# Friendly aliases -> canonical IDs (used by discovery and the CLI --model flag).
CLAUDE_ALIASES: Dict[str, str] = {
    "haiku": "claude-haiku-4-5",
    "sonnet": "claude-sonnet-5",
    "opus": "claude-opus-4-8",
}

# Fallback context window for an unknown/newer model not yet in the catalog.
DEFAULT_CONTEXT_WINDOW = 200_000


def default_claude_model() -> str:
    """Return the default Claude model ID, overridable via ``LANGUE_CLAUDE_MODEL``."""
    override = os.environ.get("LANGUE_CLAUDE_MODEL", "").strip()
    return resolve_claude_model(override) if override else DEFAULT_CLAUDE_MODEL


def resolve_claude_model(model_id: Optional[str]) -> str:
    """Resolve an alias, bare ID, or ``claude:<id>`` selector to a canonical ID.

    Empty/``None`` resolves to the configured default. An unknown ID passes
    through unchanged so a brand-new model works before this catalog is updated.
    """
    if not model_id:
        return default_claude_model()
    # Tolerate a leading "claude:" selector prefix passed through by callers.
    if model_id.startswith("claude:"):
        model_id = model_id.split(":", 1)[1]
    if not model_id:
        return default_claude_model()
    return CLAUDE_ALIASES.get(model_id, model_id)


def claude_context_window(model_id: str) -> int:
    """Context window (in tokens) for a Claude model ID, with a safe fallback."""
    meta = CLAUDE_MODELS.get(resolve_claude_model(model_id))
    return int(meta["context_window"]) if meta else DEFAULT_CONTEXT_WINDOW


def model_display_name(model_id: str) -> str:
    """Human-readable name for a Claude model ID (falls back to the ID itself)."""
    meta = CLAUDE_MODELS.get(resolve_claude_model(model_id))
    return str(meta["display"]) if meta else model_id


def default_claude_selector() -> str:
    """The ``claude:<id>`` selector string for the default Claude model."""
    return f"claude:{default_claude_model()}"
