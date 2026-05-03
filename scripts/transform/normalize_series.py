from __future__ import annotations

import json

from scripts.shared.catalog import catalog_entries
from scripts.shared.io import data_dir, parse_float, series_path, write_json


def normalize_observations(observations: list[dict[str, object]]) -> list[dict[str, object]]:
    by_date: dict[str, float] = {}
    for observation in observations:
        raw_date = observation.get("date")
        value = parse_float(str(observation.get("value", "")))
        if not raw_date or value is None:
            continue
        by_date[str(raw_date)] = value
    return [{"date": date, "value": by_date[date]} for date in sorted(by_date)]


def main() -> None:
    entries = catalog_entries()
    write_json(data_dir() / "catalog" / "series_catalog.json", entries)

    for entry in entries:
        path = series_path(str(entry["id"]))
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["observations"] = normalize_observations(payload.get("observations", []))
        write_json(path, payload)


if __name__ == "__main__":
    main()
