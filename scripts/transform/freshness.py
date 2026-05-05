from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta
from typing import Any


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = (month_index % 12) + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def observation_period(value: date, frequency: str) -> str:
    if frequency == "weekly":
        return f"week of {value.isoformat()}"
    if frequency == "monthly":
        return f"{value.year:04d}-{value.month:02d}"
    if frequency == "quarterly":
        quarter = ((value.month - 1) // 3) + 1
        return f"{value.year:04d}-Q{quarter}"
    return value.isoformat()


def evaluate_freshness(
    *,
    latest_date: str | None,
    generated_at: str,
    frequency: str,
    max_stale_days: int,
) -> dict[str, Any]:
    if latest_date is None:
        return {
            "status": "failed",
            "last_observation": None,
            "observation_period": None,
            "freshness_days": None,
            "expected_next_release_window": None,
            "message": "No observations available.",
        }

    current_date = datetime.fromisoformat(generated_at.replace("Z", "+00:00")).date()
    observed_date = datetime.fromisoformat(latest_date).date()
    freshness_days = (current_date - observed_date).days
    period = observation_period(observed_date, frequency)

    if freshness_days < 0:
        return {
            "status": "failed",
            "last_observation": latest_date,
            "observation_period": period,
            "freshness_days": freshness_days,
            "expected_next_release_window": None,
            "message": "Latest observation is future-dated.",
        }

    if frequency == "daily":
        if freshness_days > max_stale_days:
            status = "stale"
            message = (
                f"Latest daily observation is {freshness_days} days old, "
                f"above the {max_stale_days} day freshness buffer."
            )
        else:
            status = "ok"
            message = f"Latest daily observation is {freshness_days} days old."
        return {
            "status": status,
            "last_observation": latest_date,
            "observation_period": period,
            "freshness_days": freshness_days,
            "expected_next_release_window": None,
            "message": message,
        }

    release_window = _expected_next_release_window(observed_date, frequency, max_stale_days)
    if release_window is None:
        return {
            "status": "ok" if freshness_days <= max_stale_days else "stale",
            "last_observation": latest_date,
            "observation_period": period,
            "freshness_days": freshness_days,
            "expected_next_release_window": None,
            "message": "Fresh." if freshness_days <= max_stale_days else f"Latest observation is {freshness_days} days old.",
        }

    if current_date <= release_window["end_date"]:
        message = _within_release_window_message(frequency, period, release_window["end"])
        status = "ok"
    else:
        message = _stale_release_window_message(frequency, period, release_window["end"])
        status = "stale"

    return {
        "status": status,
        "last_observation": latest_date,
        "observation_period": period,
        "freshness_days": freshness_days,
        "expected_next_release_window": {
            "start": release_window["start"],
            "end": release_window["end"],
        },
        "message": message,
    }


def _expected_next_release_window(observed_date: date, frequency: str, max_stale_days: int) -> dict[str, Any] | None:
    if frequency == "weekly":
        start = observed_date + timedelta(days=7)
    elif frequency == "monthly":
        start = add_months(observed_date, 1)
    elif frequency == "quarterly":
        start = add_months(observed_date, 3)
    else:
        return None

    end = start + timedelta(days=max_stale_days)
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "end_date": end,
    }


def _within_release_window_message(frequency: str, period: str, end: str) -> str:
    if frequency == "weekly":
        return f"Latest weekly observation is within the expected release window ending {end}."
    return f"Latest {frequency} observation covers {period} and is within the expected release window ending {end}."


def _stale_release_window_message(frequency: str, period: str, end: str) -> str:
    if frequency == "weekly":
        return f"Latest weekly observation expected release window ended {end}."
    return f"Latest {frequency} observation covers {period}; expected release window ended {end}."
