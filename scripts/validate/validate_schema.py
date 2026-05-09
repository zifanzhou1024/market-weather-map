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
    data_dir() / "derived" / "bond_volatility_proxy.json",
    data_dir() / "derived" / "brent_wti_spread.json",
    data_dir() / "derived" / "net_liquidity.json",
    data_dir() / "derived" / "hy_minus_ig_oas.json",
    data_dir() / "derived" / "vix9d_vix_ratio.json",
    data_dir() / "derived" / "vix_vix3m_ratio.json",
    data_dir() / "derived" / "commodity_inflation_impulse.json",
    data_dir() / "derived" / "score_summary.json",
    data_dir() / "derived" / "bucket_scores.json",
    data_dir() / "derived" / "regime_score.json",
    data_dir() / "derived" / "regime_snapshot.json",
    data_dir() / "derived" / "regime_replay.json",
    data_dir() / "derived" / "score_history.json",
    data_dir() / "derived" / "shock_risk_snapshot.json",
    data_dir() / "status" / "data_status.json",
]
ROOT_STATUSES = {"ok", "stale", "partial", "failed"}
SERIES_STATUSES = {"ok", "stale", "failed", "terms_review_needed", "unavailable"}
DATA_STATUSES = ROOT_STATUSES | {"terms_review_needed", "unavailable"}
STATUSES_WITH_PAYLOAD_OBSERVATIONS = {"ok", "stale", "partial"}
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


def _validate_string_field(
    payload: dict[str, Any],
    path: Path,
    field_name: str,
    display_name: str | None = None,
) -> None:
    if not isinstance(payload.get(field_name), str):
        raise ValueError(f"{path} {display_name or field_name} must be a string")


def _validate_number_or_null(
    payload: dict[str, Any],
    path: Path,
    field_name: str,
    display_name: str | None = None,
) -> None:
    if field_name not in payload:
        raise ValueError(f"{path} {display_name or field_name} must be numeric or null")
    if payload[field_name] is None:
        return
    value = payload[field_name]
    if not isinstance(value, int | float) or isinstance(value, bool) or not math.isfinite(float(value)):
        raise ValueError(f"{path} {display_name or field_name} must be numeric or null")


def _payload_path_for_status_series(series_id: str) -> Path | None:
    root = data_dir()
    for path in (root / "series" / f"{series_id}.json", root / "derived" / f"{series_id}.json"):
        if path.exists():
            return path
    return None


def _payload_latest_date(path: Path) -> str | None:
    payload = _load_json(path)
    summary = payload.get("summary")
    if isinstance(summary, dict) and isinstance(summary.get("latest_date"), str):
        return str(summary["latest_date"])

    observations = payload.get("observations")
    if isinstance(observations, list) and observations:
        latest = observations[-1]
        if isinstance(latest, dict) and isinstance(latest.get("date"), str):
            return str(latest["date"])
    return None


def _validate_status_last_observation_matches_payload(
    status_path: Path,
    series_id: str,
    status: dict[str, Any],
) -> None:
    status_value = status.get("last_observation")
    if status.get("status") not in STATUSES_WITH_PAYLOAD_OBSERVATIONS or status_value is None:
        return
    if not isinstance(status_value, str):
        raise ValueError(f"{status_path} last_observation must be a string or null for {series_id}")

    payload_path = _payload_path_for_status_series(series_id)
    if payload_path is None:
        raise ValueError(f"{status_path} active series status for {series_id} has no series or derived payload")

    payload_latest = _payload_latest_date(payload_path)
    if payload_latest is None:
        raise ValueError(f"{payload_path} has no latest observation date for status series {series_id}")
    if status_value != payload_latest:
        raise ValueError(
            f"{status_path} {series_id} last_observation {status_value} does not match "
            f"{payload_path} latest observation {payload_latest}"
        )


def validate_score_summary_file() -> None:
    path = data_dir() / "derived" / "score_summary.json"
    payload = _load_json(path)
    scores = payload.get("scores")
    if not isinstance(scores, dict) or set(scores) != {"market_weather", "macro_climate", "fragility"}:
        raise ValueError(f"{path} must contain exactly market_weather, macro_climate, and fragility scores")

    conflicting_signals = payload.get("conflicting_signals")
    if not isinstance(conflicting_signals, list):
        raise ValueError(f"{path} conflicting_signals must be a list")
    for signal in conflicting_signals:
        if not isinstance(signal, str):
            raise ValueError(f"{path} conflicting_signals items must be strings")

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


def validate_regime_snapshot_file() -> None:
    path = data_dir() / "derived" / "regime_snapshot.json"
    payload = _load_json(path)
    for field in ["generated_at_utc", "date", "method_version"]:
        if not isinstance(payload.get(field), str):
            raise ValueError(f"{path} {field} must be a string")

    regime = payload.get("regime")
    if not isinstance(regime, dict):
        raise ValueError(f"{path} regime must be an object")
    for field in [
        "label",
        "tips_direction",
        "dollar_direction",
        "nominal_yield_direction",
        "yield_driver",
    ]:
        if not isinstance(regime.get(field), str):
            raise ValueError(f"{path} regime.{field} must be a string")

    checklist = payload.get("checklist")
    if not isinstance(checklist, list):
        raise ValueError(f"{path} checklist must be a list")
    for item in checklist:
        if not isinstance(item, dict):
            raise ValueError(f"{path} checklist items must be objects")
        for field in ["id", "label", "state", "message"]:
            if not isinstance(item.get(field), str):
                raise ValueError(f"{path} checklist.{field} must be a string")

    confirmations = payload.get("confirmations")
    if not isinstance(confirmations, list):
        raise ValueError(f"{path} confirmations must be a list")
    for item in confirmations:
        if not isinstance(item, dict):
            raise ValueError(f"{path} confirmations items must be objects")
        for field in ["id", "label", "status", "message"]:
            if not isinstance(item.get(field), str):
                raise ValueError(f"{path} confirmations.{field} must be a string")
        if item["status"] not in {"confirming", "diverging", "mixed", "unavailable"}:
            raise ValueError(f"{path} confirmations.status has invalid value")

    if not isinstance(payload.get("quadrant_trail"), list):
        raise ValueError(f"{path} quadrant_trail must be a list")
    if not isinstance(payload.get("yield_decomposition"), list):
        raise ValueError(f"{path} yield_decomposition must be a list")


def validate_shock_risk_snapshot_file() -> None:
    path = data_dir() / "derived" / "shock_risk_snapshot.json"
    payload = _load_json(path)
    for field in ["generated_at_utc", "date", "method_version", "label"]:
        _validate_string_field(payload, path, field)
    if payload["label"] not in {"Elevated shock risk", "Mixed shock risk", "Contained shock risk"}:
        raise ValueError(f"{path} label has invalid value")
    _validate_finite_number(payload.get("score"), path, "score")
    for field in ["active_signals", "source_gaps", "mismatch_warnings"]:
        if not isinstance(payload.get(field), list):
            raise ValueError(f"{path} {field} must be a list")

    for item in payload["active_signals"]:
        if not isinstance(item, dict):
            raise ValueError(f"{path} active_signals items must be objects")
        for field in ["id", "label", "message"]:
            _validate_string_field(item, path, field, f"active_signals.{field}")
        _validate_finite_number(item.get("score"), path, "active_signals.score")
        for field in ["value", "change"]:
            _validate_number_or_null(item, path, field, f"active_signals.{field}")

    for item in payload["source_gaps"]:
        if not isinstance(item, dict):
            raise ValueError(f"{path} source_gaps items must be objects")
        for field in ["id", "label", "status", "message"]:
            _validate_string_field(item, path, field, f"source_gaps.{field}")
        if item["status"] not in DATA_STATUSES:
            raise ValueError(f"{path} source_gaps.status has invalid value")

    for item in payload["mismatch_warnings"]:
        if not isinstance(item, dict):
            raise ValueError(f"{path} mismatch_warnings items must be objects")
        for field in ["id", "label", "message"]:
            _validate_string_field(item, path, field, f"mismatch_warnings.{field}")
        if "severity" in item and not isinstance(item["severity"], str):
            raise ValueError(f"{path} mismatch_warnings.severity must be a string")


def validate_regime_replay_file() -> None:
    path = data_dir() / "derived" / "regime_replay.json"
    payload = _load_json(path)
    _validate_timestamp_with_timezone(_require_string(payload, "generated_at_utc", path), path)
    _require_non_empty_string(payload, "method_version", path)
    scenarios = payload.get("scenarios")
    if not isinstance(scenarios, list):
        raise ValueError(f"{path} scenarios must be a list")
    for scenario in scenarios:
        if not isinstance(scenario, dict):
            raise ValueError(f"{path} scenarios items must be objects")
        if "future_return_summary" in scenario:
            raise ValueError(f"{path} future_return_summary is not allowed until return sources are active")
        for field in ["id", "label", "description", "caveat"]:
            _require_non_empty_string(scenario, field, path)
        _validate_finite_number(scenario.get("occurrence_count"), path, "occurrence_count")
        if int(scenario["occurrence_count"]) != scenario["occurrence_count"] or scenario["occurrence_count"] < 0:
            raise ValueError(f"{path} occurrence_count must be a non-negative integer")
        if scenario.get("last_occurrence_date") is not None:
            _validate_event_date(scenario.get("last_occurrence_date"), path)
        occurrences = scenario.get("occurrences")
        if not isinstance(occurrences, list):
            raise ValueError(f"{path} occurrences must be a list")
        if len(occurrences) != int(scenario["occurrence_count"]):
            raise ValueError(f"{path} occurrence_count must match occurrences length")
        for occurrence in occurrences:
            if not isinstance(occurrence, dict):
                raise ValueError(f"{path} occurrences items must be objects")
            _require_non_empty_string(occurrence, "date", path)
            _validate_event_date(occurrence["date"], path)
            for field in [
                "real_yield_20obs_change",
                "dollar_20obs_change",
                "credit_20obs_change",
                "vix_curve_20obs_change",
                "nominal_10y_20obs_change",
            ]:
                _validate_finite_number(occurrence.get(field), path, field)


def validate_score_history_file() -> None:
    path = data_dir() / "derived" / "score_history.json"
    payload = _load_json(path)
    _validate_timestamp_with_timezone(_require_string(payload, "generated_at_utc", path), path)
    _require_non_empty_string(payload, "method_version", path)
    observations = payload.get("observations")
    if not isinstance(observations, list):
        raise ValueError(f"{path} observations must be a list")
    last_date = None
    for observation in observations:
        if not isinstance(observation, dict):
            raise ValueError(f"{path} observations items must be objects")
        _require_non_empty_string(observation, "date", path)
        _validate_event_date(observation["date"], path)
        if last_date is not None and observation["date"] < last_date:
            raise ValueError(f"{path} observations must be sorted ascending")
        last_date = observation["date"]
        for field in ["market_weather", "macro_climate", "fragility"]:
            _validate_finite_number(observation.get(field), path, field)
    latest_attribution = payload.get("latest_attribution")
    if not isinstance(latest_attribution, dict):
        raise ValueError(f"{path} latest_attribution must be an object")
    for score_key in ["market_weather", "macro_climate", "fragility"]:
        block = latest_attribution.get(score_key)
        if not isinstance(block, dict):
            raise ValueError(f"{path} latest_attribution.{score_key} must be an object")
        for field in ["recent_changes", "top_risks", "top_supports"]:
            if not isinstance(block.get(field), list):
                raise ValueError(f"{path} latest_attribution.{score_key}.{field} must be a list")


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
        _validate_status_last_observation_matches_payload(path, str(series_id), status)


def main() -> None:
    for entry in available_catalog_entries():
        validate_series_file(str(entry["id"]))
    validate_generated_files()
    validate_macro_calendar_file()
    validate_score_summary_file()
    validate_regime_snapshot_file()
    validate_regime_replay_file()
    validate_score_history_file()
    validate_shock_risk_snapshot_file()
    validate_status_file()


if __name__ == "__main__":
    main()
