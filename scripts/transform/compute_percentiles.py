from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.shared.io import data_dir, write_json


def percentile_rank(values: list[float], value: float) -> float | None:
    if not values:
        return None
    rank = sum(1 for item in values if item <= value) / len(values) * 100
    return round(rank, 2)


def change_from_index(observations: list[dict[str, Any]], offset: int) -> float | None:
    if len(observations) <= offset:
        return None
    latest = observations[-1].get("value")
    previous = observations[-1 - offset].get("value")
    if not isinstance(latest, int | float) or not isinstance(previous, int | float):
        return None
    return round(float(latest) - float(previous), 4)


def series_summary(observations: list[dict[str, Any]]) -> dict[str, Any]:
    if not observations:
        return {
            "latest_date": None,
            "latest_value": None,
            "change_1d": None,
            "change_1w": None,
            "change_1m": None,
            "percentile_252d": None,
        }

    latest = observations[-1]
    latest_value = latest.get("value")
    values = [
        float(observation["value"])
        for observation in observations[-252:]
        if isinstance(observation.get("value"), int | float)
    ]
    percentile = (
        percentile_rank(values, float(latest_value))
        if isinstance(latest_value, int | float)
        else None
    )

    return {
        "latest_date": latest.get("date"),
        "latest_value": latest_value,
        "change_1d": change_from_index(observations, 1),
        "change_1w": change_from_index(observations, 5),
        "change_1m": change_from_index(observations, 21),
        "percentile_252d": percentile,
    }


def enrich_observations(observations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched = []
    for index, observation in enumerate(observations):
        value = observation.get("value")
        if not isinstance(value, int | float):
            enriched.append({**observation, "percentile_252d": None})
            continue
        window = [
            float(item["value"])
            for item in observations[max(0, index - 251) : index + 1]
            if isinstance(item.get("value"), int | float)
        ]
        enriched.append(
            {
                **observation,
                "percentile_252d": percentile_rank(window, float(value)),
            }
        )
    return enriched


def enrich_file(path: Path | str) -> dict[str, Any]:
    target = Path(path)
    payload = json.loads(target.read_text(encoding="utf-8"))
    observations = enrich_observations(payload.get("observations", []))
    payload["observations"] = observations
    payload["summary"] = series_summary(observations)
    write_json(target, payload)
    return payload


def main() -> None:
    for path in sorted((data_dir() / "series").glob("*.json")):
        enrich_file(path)


if __name__ == "__main__":
    main()
