from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from scripts.shared.catalog import available_catalog_entries
from scripts.shared.io import data_dir, series_path


REQUIRED_SERIES_FIELDS = {
    "series_id",
    "generated_at_utc",
    "source",
    "source_url",
    "frequency",
    "units",
    "observations",
}
REQUIRED_GENERATED_FILES = [
    data_dir() / "catalog" / "series_catalog.json",
    data_dir() / "catalog" / "source_registry.json",
    data_dir() / "derived" / "us10y_minus_us2y.json",
    data_dir() / "derived" / "brent_wti_spread.json",
    data_dir() / "derived" / "net_liquidity.json",
    data_dir() / "derived" / "commodity_inflation_impulse.json",
    data_dir() / "derived" / "score_summary.json",
    data_dir() / "derived" / "bucket_scores.json",
    data_dir() / "derived" / "regime_score.json",
    data_dir() / "status" / "data_status.json",
]
ROOT_STATUSES = {"ok", "stale", "partial", "failed"}
SERIES_STATUSES = {"ok", "stale", "failed", "terms_review_needed", "unavailable"}
REQUIRED_SCORE_ARRAY_FIELDS = (
    "top_risks",
    "top_supports",
    "confidence_reasons",
    "recent_changes",
    "missing_or_stale_notes",
)


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"{path} is not valid JSON: {error}") from error


def _parse_date(value: Any, path: Path) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"{path} observation date must be a string")
    try:
        return datetime.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{path} observation date is not ISO formatted: {value}") from error


def validate_series_file(series_id: str) -> None:
    path = series_path(series_id)
    if not path.exists():
        raise ValueError(f"Missing catalog series file: {path}")

    payload = _load_json(path)
    missing = REQUIRED_SERIES_FIELDS - payload.keys()
    if missing:
        raise ValueError(f"{path} missing required fields: {sorted(missing)}")
    if payload["series_id"] != series_id:
        raise ValueError(f"{path} series_id does not match file name")

    observations = payload["observations"]
    if not isinstance(observations, list):
        raise ValueError(f"{path} observations must be a list")

    today = datetime.now(timezone.utc).date()
    seen_dates: set[str] = set()
    last_date: str | None = None
    for observation in observations:
        if not isinstance(observation, dict):
            raise ValueError(f"{path} observation must be an object")
        date = observation.get("date")
        parsed = _parse_date(date, path)
        if parsed.date() > today:
            raise ValueError(f"{path} contains future-dated observation: {date}")
        if date in seen_dates:
            raise ValueError(f"{path} contains duplicate observation date: {date}")
        if last_date is not None and str(date) < last_date:
            raise ValueError(f"{path} observations must be sorted ascending")
        seen_dates.add(str(date))
        last_date = str(date)

        value = observation.get("value")
        if not isinstance(value, int | float) or isinstance(value, bool):
            raise ValueError(f"{path} observation value must be numeric for {date}")


def validate_generated_files() -> None:
    for path in REQUIRED_GENERATED_FILES:
        if not path.exists():
            raise ValueError(f"Missing generated data file: {path}")
        _load_json(path)


def _validate_finite_number(value: Any, path: Path, field_name: str) -> None:
    if not isinstance(value, int | float) or isinstance(value, bool):
        raise ValueError(f"{path} {field_name} must be numeric")
    if not math.isfinite(float(value)):
        raise ValueError(f"{path} {field_name} must be finite")


def validate_score_summary_file() -> None:
    path = data_dir() / "derived" / "score_summary.json"
    payload = _load_json(path)
    scores = payload.get("scores")
    if not isinstance(scores, dict) or set(scores) != {"market_weather", "macro_climate", "fragility"}:
        raise ValueError(f"{path} must contain exactly market_weather, macro_climate, and fragility scores")

    for score_key, block in scores.items():
        if not isinstance(block, dict):
            raise ValueError(f"{path} {score_key} score block must be an object")
        _validate_finite_number(block.get("score"), path, f"{score_key}.score")
        _validate_finite_number(block.get("confidence"), path, f"{score_key}.confidence")
        for field in REQUIRED_SCORE_ARRAY_FIELDS:
            if not isinstance(block.get(field), list):
                raise ValueError(f"{path} {score_key}.{field} must be a list")


def validate_status_file() -> None:
    path = data_dir() / "status" / "data_status.json"
    payload = _load_json(path)
    if payload.get("overall_status") not in ROOT_STATUSES:
        raise ValueError(f"{path} has invalid overall_status")
    if "update_status" in payload and payload["update_status"] not in {"ok", "failed"}:
        raise ValueError(f"{path} has invalid update_status")
    if "last_attempt_utc" in payload and not isinstance(payload["last_attempt_utc"], str):
        raise ValueError(f"{path} last_attempt_utc must be a string when present")
    if "update_message" in payload and not isinstance(payload["update_message"], str):
        raise ValueError(f"{path} update_message must be a string when present")
    series_statuses = payload.get("series", {})
    if not isinstance(series_statuses, dict):
        raise ValueError(f"{path} series must be an object when present")
    for series_id, status in series_statuses.items():
        if not isinstance(status, dict) or status.get("status") not in SERIES_STATUSES:
            raise ValueError(f"{path} has invalid series status for {series_id}")


def main() -> None:
    for entry in available_catalog_entries():
        validate_series_file(str(entry["id"]))
    validate_generated_files()
    validate_score_summary_file()
    validate_status_file()


if __name__ == "__main__":
    main()
