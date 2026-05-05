from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from scripts.shared.io import data_dir
from scripts.transform.freshness import evaluate_freshness


RELEASE_WINDOW_FREQUENCIES = {"weekly", "monthly", "quarterly"}


def _parse_iso_date(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _release_window_allows_ok_status(
    status: dict[str, object],
    generated_at_utc: object,
    generated_at: date | None,
) -> bool:
    window = status.get("expected_next_release_window")
    message = status.get("message")
    frequency = status.get("expected_frequency")
    last_observation = status.get("last_observation")
    max_stale_days = status.get("max_stale_days")
    if (
        status.get("status") != "ok"
        or generated_at is None
        or not isinstance(generated_at_utc, str)
        or frequency not in RELEASE_WINDOW_FREQUENCIES
        or _parse_iso_date(last_observation) is None
        or not isinstance(max_stale_days, int | float)
        or isinstance(max_stale_days, bool)
        or not isinstance(window, dict)
        or not isinstance(message, str)
        or "within the expected release window" not in message
    ):
        return False

    start = _parse_iso_date(window.get("start"))
    end = _parse_iso_date(window.get("end"))
    if start is None or end is None:
        return False
    if not start <= generated_at <= end:
        return False

    try:
        expected = evaluate_freshness(
            latest_date=str(last_observation),
            generated_at=generated_at_utc,
            frequency=str(frequency),
            max_stale_days=int(max_stale_days),
        )
    except (TypeError, ValueError):
        return False
    return all(
        status.get(field) == expected.get(field)
        for field in (
            "status",
            "freshness_days",
            "last_observation",
            "observation_period",
            "expected_next_release_window",
            "message",
        )
    )


def main() -> None:
    path = data_dir() / "status" / "data_status.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    generated_at_utc = payload.get("generated_at_utc")
    generated_at = _parse_iso_date(generated_at_utc)
    failures = []

    for series_id, status in payload.get("series", {}).items():
        status_value = status.get("status")
        if status_value in {"terms_review_needed", "unavailable", "stale"}:
            continue
        if status_value == "failed":
            failures.append(f"{series_id} failed: {status.get('message', 'no message')}")
            continue
        freshness_days = status.get("freshness_days")
        max_stale_days = status.get("max_stale_days")
        if (
            isinstance(freshness_days, int | float)
            and isinstance(max_stale_days, int | float)
            and freshness_days > max_stale_days
            and not _release_window_allows_ok_status(status, generated_at_utc, generated_at)
        ):
            failures.append(
                f"{series_id} is stale: {freshness_days} days > {max_stale_days} allowed"
            )

    if failures:
        raise SystemExit("\n".join(failures))


if __name__ == "__main__":
    main()
