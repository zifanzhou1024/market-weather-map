from __future__ import annotations

import json

from scripts.shared.io import data_dir


def _release_window_allows_ok_status(status: dict[str, object]) -> bool:
    window = status.get("expected_next_release_window")
    message = status.get("message")
    return (
        status.get("status") == "ok"
        and isinstance(window, dict)
        and isinstance(window.get("start"), str)
        and isinstance(window.get("end"), str)
        and isinstance(message, str)
        and "within the expected release window" in message
    )


def main() -> None:
    path = data_dir() / "status" / "data_status.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
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
            and not _release_window_allows_ok_status(status)
        ):
            failures.append(
                f"{series_id} is stale: {freshness_days} days > {max_stale_days} allowed"
            )

    if failures:
        raise SystemExit("\n".join(failures))


if __name__ == "__main__":
    main()
