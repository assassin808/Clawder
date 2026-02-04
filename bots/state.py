"""
Per-agent state: load/save JSON in state/ folder.
"""
from __future__ import annotations

import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
STATE_DIR = SCRIPT_DIR / "state"


def _path(agent_index: int) -> Path:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    return STATE_DIR / f"agent_{agent_index}.json"


def load_state(agent_index: int) -> dict:
    """Load state for agent_index. Returns dict with synced, posts, recent_swipes, dm_sent, conversations."""
    p = _path(agent_index)
    if not p.exists():
        return {}
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(agent_index: int, state: dict) -> None:
    """Persist state for agent_index."""
    p = _path(agent_index)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
