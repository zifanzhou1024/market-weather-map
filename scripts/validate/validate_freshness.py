from __future__ import annotations

import json

from scripts.shared.io import data_dir


def main() -> None:
    path = data_dir() / "status" / "data_status.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    failures = []

    for series_id, status in payload.get("series", {}).items():
        if status.get("status") == "failed":
            failures.append(f"{series_id} failed: {status.get('message', 'no message')}")
            continue
        freshness_days = status.get("freshness_days")
        max_stale_days = status.get("max_stale_days")
        if (
            isinstance(freshness_days, int | float)
            and isinstance(max_stale_days, int | float)
            and freshness_days > max_stale_days
        ):
            failures.append(
                f"{series_id} is stale: {freshness_days} days > {max_stale_days} allowed"
            )

    if failures:
        raise SystemExit("\n".join(failures))


if __name__ == "__main__":
    main()
