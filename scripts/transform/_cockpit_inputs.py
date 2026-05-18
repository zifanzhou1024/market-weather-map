"""Input loaders for build_cockpit.py.

Each loader is permissive on missing files: returns None or {} rather than
raising, so the builder can degrade gracefully when a single upstream
artifact has not yet been generated (CI safe-update path).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_signal_priority_index(path: Path) -> dict[str, dict[str, Any]]:
    """Load signal_priority.json into {id: entry} dict.

    Merges top_warnings + top_supports. If both contain the same id (should not
    happen in practice), the warnings entry wins.
    """
    if not path.exists():
        return {}
    raw = json.loads(path.read_text())
    index: dict[str, dict[str, Any]] = {}
    for entry in raw.get("top_supports", []):
        index[entry["id"]] = entry
    for entry in raw.get("top_warnings", []):
        index[entry["id"]] = entry
    return index


def load_series_observations(path: Path) -> list[dict[str, Any]] | None:
    """Load a series JSON and return observations sorted ascending by date.

    Returns None if file does not exist or has no observations.
    """
    if not path.exists():
        return None
    raw = json.loads(path.read_text())
    obs = raw.get("observations") or []
    if not obs:
        return None
    return sorted(obs, key=lambda o: o["date"])
