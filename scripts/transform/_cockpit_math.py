"""Pure-function math helpers for build_cockpit.

All functions are stateless and operate on the observation-list shape
[{"date": "YYYY-MM-DD", "value": float}, ...] sorted ascending by date.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any


def parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def delta_against_window(observations: list[dict[str, Any]], *, days: int) -> float | None:
    """Return latest_value - value_at_or_before(latest - `days`).

    Uses the most recent observation whose date is <= (latest_date - days).
    An observation that is EXACTLY `days` old qualifies. Returns None when
    no observation that old exists in the series.
    """
    if not observations:
        return None
    latest = observations[-1]
    latest_date = parse_date(latest["date"])
    cutoff = latest_date - timedelta(days=days)
    candidates = [o for o in observations[:-1] if parse_date(o["date"]) <= cutoff]
    if not candidates:
        return None
    base = candidates[-1]  # most recent at or before cutoff
    return latest["value"] - base["value"]


def percentile_5y(observations: list[dict[str, Any]]) -> tuple[int | None, int]:
    """Return (percentile_0_to_100, window_days_used).

    Uses up to 1260 trailing observations (5 trading years).
    If fewer than 60 observations exist, returns (None, len(observations)).
    """
    if not observations:
        return None, 0
    window = observations[-1260:]
    n = len(window)
    if n < 60:
        return None, n
    values = sorted(o["value"] for o in window)
    latest_value = observations[-1]["value"]
    rank = sum(1 for v in values if v < latest_value)
    pct = round(100 * rank / max(n - 1, 1))
    return min(max(pct, 0), 100), n


def sparkline_90d(observations: list[dict[str, Any]]) -> list[float]:
    """Return up to 90 trailing values."""
    if not observations:
        return []
    return [o["value"] for o in observations[-90:]]
