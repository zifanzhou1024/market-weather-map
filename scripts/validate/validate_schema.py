from __future__ import annotations

import json
import math
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

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
    data_dir() / "events" / "macro_calendar.json",
    data_dir() / "derived" / "us10y_minus_us2y.json",
    data_dir() / "derived" / "brent_wti_spread.json",
    data_dir() / "derived" / "net_liquidity.json",
    data_dir() / "derived" / "hy_minus_ig_oas.json",
    data_dir() / "derived" / "vix9d_vix_ratio.json",
    data_dir() / "derived" / "vix_vix3m_ratio.json",
    data_dir() / "derived" / "commodity_inflation_impulse.json",
    data_dir() / "derived" / "score_summary.json",
    data_dir() / "derived" / "bucket_scores.json",
    data_dir() / "derived" / "regime_score.json",
    data_dir() / "status" / "data_status.json",
]
ROOT_STATUSES = {"ok", "stale", "partial", "failed"}
SERIES_STATUSES = {"ok", "stale", "failed", "terms_review_needed", "unavailable"}
EVENT_IMPORTANCES = {"high", "medium", "low"}
EVENT_STATUSES = {"scheduled", "source_link", "estimated"}
EVENT_CATEGORIES = {"inflation", "growth", "rates", "housing", "sentiment"}
EVENT_TIMEZONES = {"America/New_York"}
REQUIRED_SCORE_ARRAY_FIELDS = (
    "top_risks",
    "top_supports",
    "confidence_reasons",
    "recent_changes",
    "missing_or_stale_notes",
)
CONFIDENCE_FIELDS = (
    "coverage_confidence",
    "freshness_confidence",
    "model_confidence",
    "source_confidence",
    "overall_confidence",
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


def _require_string(payload: dict[str, Any], field_name: str, path: Path) -> str:
    value = payload.get(field_name)
    if not isinstance(value, str):
        raise ValueError(f"{path} {field_name} must be a string")
    return value


def _require_non_empty_string(payload: dict[str, Any], field_name: str, path: Path) -> str:
    value = _require_string(payload, field_name, path)
    if not value.strip():
        raise ValueError(f"{path} {field_name} must be a non-empty string")
    return value


def _validate_optional_string_or_null(payload: dict[str, Any], field_name: str, path: Path) -> None:
    value = payload.get(field_name)
    if value is not None and not isinstance(value, str):
        raise ValueError(f"{path} {field_name} must be a string or null")


def _validate_timestamp_with_timezone(value: str, path: Path) -> None:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise ValueError(f"{path} generated_at_utc must be an ISO timestamp with timezone") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{path} generated_at_utc must be an ISO timestamp with timezone")
    if not value.endswith("Z") or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
        raise ValueError(f"{path} generated_at_utc must be a UTC timestamp ending in Z")


def _validate_https_url(value: str, path: Path) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError(f"{path} source_url must be an https URL with hostname")
    if any(character.isspace() for character in parsed.netloc) or any(
        character.isspace() for character in parsed.hostname
    ):
        raise ValueError(f"{path} source_url must be an https URL with valid hostname")


def _validate_event_date(value: str | None, path: Path) -> None:
    if value is None:
        return
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError(f"{path} date must be an ISO date")
    try:
        date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{path} date must be an ISO date") from error


def _validate_event_time(value: str | None, path: Path) -> None:
    if value is None:
        return
    if not re.fullmatch(r"\d{2}:\d{2}", value):
        raise ValueError(f"{path} time must be HH:MM 24-hour time")
    hour, minute = (int(part) for part in value.split(":"))
    if hour > 23 or minute > 59:
        raise ValueError(f"{path} time must be HH:MM 24-hour time")


def _validate_event_timezone(value: str | None, path: Path) -> None:
    if value is not None and value not in EVENT_TIMEZONES:
        raise ValueError(f"{path} timezone is invalid")


def validate_macro_calendar_file() -> None:
    path = data_dir() / "events" / "macro_calendar.json"
    payload = _load_json(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must be an object")
    _validate_timestamp_with_timezone(_require_string(payload, "generated_at_utc", path), path)
    _require_string(payload, "method_version", path)
    events = payload.get("events")
    if not isinstance(events, list) or not events:
        raise ValueError(f"{path} events must be a non-empty list")

    seen_ids: set[str] = set()
    for event in events:
        if not isinstance(event, dict):
            raise ValueError(f"{path} event must be an object")
        event_id = _require_non_empty_string(event, "id", path)
        if event_id in seen_ids:
            raise ValueError(f"{path} duplicate event id: {event_id}")
        seen_ids.add(event_id)

        for field_name in ("title", "category", "importance", "source", "source_url", "notes", "status"):
            _require_non_empty_string(event, field_name, path)

        _validate_https_url(event["source_url"], path)
        if event["category"] not in EVENT_CATEGORIES:
            raise ValueError(f"{path} category is invalid for {event_id}")
        if event["importance"] not in EVENT_IMPORTANCES:
            raise ValueError(f"{path} importance is invalid for {event_id}")
        if event["status"] not in EVENT_STATUSES:
            raise ValueError(f"{path} status is invalid for {event_id}")
        for field_name in ("date", "time", "timezone"):
            _validate_optional_string_or_null(event, field_name, path)
        _validate_event_date(event.get("date"), path)
        _validate_event_time(event.get("time"), path)
        _validate_event_timezone(event.get("timezone"), path)


def _validate_finite_number(value: Any, path: Path, field_name: str) -> None:
    if not isinstance(value, int | float) or isinstance(value, bool):
        raise ValueError(f"{path} {field_name} must be numeric")
    if not math.isfinite(float(value)):
        raise ValueError(f"{path} {field_name} must be finite")


def _validate_confidence_value(value: Any, path: Path, field_name: str) -> None:
    _validate_finite_number(value, path, field_name)
    if not 0 <= float(value) <= 1:
        raise ValueError(f"{path} {field_name} must be between 0 and 1")


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
        _validate_confidence_value(block.get("confidence"), path, f"{score_key}.confidence")
        for field in REQUIRED_SCORE_ARRAY_FIELDS:
            if not isinstance(block.get(field), list):
                raise ValueError(f"{path} {score_key}.{field} must be a list")
        confidence_breakdown = block.get("confidence_breakdown")
        if not isinstance(confidence_breakdown, dict):
            raise ValueError(f"{path} {score_key}.confidence_breakdown must be an object")
        for field in CONFIDENCE_FIELDS:
            _validate_confidence_value(
                confidence_breakdown.get(field),
                path,
                f"{score_key}.confidence_breakdown.{field}",
            )

    data_quality = payload.get("data_quality")
    if not isinstance(data_quality, dict):
        raise ValueError(f"{path} data_quality must be an object")
    for field in CONFIDENCE_FIELDS:
        _validate_confidence_value(data_quality.get(field), path, f"data_quality.{field}")
    if not isinstance(data_quality.get("reasons"), list):
        raise ValueError(f"{path} data_quality.reasons must be a list")


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
        if "observation_period" in status and status["observation_period"] is not None and not isinstance(status["observation_period"], str):
            raise ValueError(f"{path} observation_period must be a string or null for {series_id}")
        if "expected_next_release_window" in status and status["expected_next_release_window"] is not None:
            window = status["expected_next_release_window"]
            if not isinstance(window, dict) or not isinstance(window.get("start"), str) or not isinstance(window.get("end"), str):
                raise ValueError(
                    f"{path} expected_next_release_window must contain start and end strings for {series_id}"
                )
        if "message" in status and status["message"] is not None and not isinstance(status["message"], str):
            raise ValueError(f"{path} message must be a string or null for {series_id}")


def main() -> None:
    for entry in available_catalog_entries():
        validate_series_file(str(entry["id"]))
    validate_generated_files()
    validate_macro_calendar_file()
    validate_score_summary_file()
    validate_status_file()


if __name__ == "__main__":
    main()
