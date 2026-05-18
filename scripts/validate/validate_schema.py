from __future__ import annotations

import json
import math
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from scripts.shared import io as shared_io
from scripts.shared.access_status import DERIVATION_TABLE
from scripts.shared.catalog import available_catalog_entries
from scripts.shared.io import data_dir, series_path
from scripts.validate.validate_candidate_isolation import (
    run as run_candidate_isolation,
)


class SchemaError(RuntimeError):
    """Raised when catalog entries violate AccessStatus schema rules."""


_ALLOWED_ACCESS_STATUSES = frozenset(DERIVATION_TABLE)

_REQUIRED_FLAGS = ("active_scoring_allowed", "public_redistribution_allowed", "requires_secret")


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
    data_dir() / "derived" / "treasury_supply_pressure.json",
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
    data_dir() / "derived" / "signal_priority.json",
    data_dir() / "derived" / "page_insights.json",
    data_dir() / "derived" / "volatility_dashboard.json",
    data_dir() / "derived" / "rates_dashboard.json",
    data_dir() / "derived" / "regime_dashboard.json",
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


SIGNAL_PRIORITY_HORIZONS = {"short_term", "long_term", "both", "fragility"}
SIGNAL_PRIORITY_CATEGORIES = {
    "volatility",
    "rates",
    "credit",
    "liquidity",
    "dollar",
    "positioning",
    "macro",
    "event",
}
SIGNAL_PRIORITY_DIRECTIONS = {"support", "risk", "neutral"}
SIGNAL_PRIORITY_URGENCIES = {"immediate", "near_term", "slow", "background"}
SIGNAL_PRIORITY_FRESHNESS = {"ok", "stale", "unavailable"}
SIGNAL_PRIORITY_OVERALL_KEYS = ("short_term", "long_term", "fragility")
ACTIVE_ENTRY_REQUIRED_FIELDS = (
    "id",
    "label",
    "group",
    "category",
    "horizon",
    "importance",
    "severity",
    "priority",
    "direction",
    "urgency",
    "confidence",
    "freshness_status",
    "source_status",
    "message",
    "why_it_matters",
)
MISSING_ENTRY_REQUIRED_FIELDS = (
    "id",
    "label",
    "group",
    "category",
    "horizon",
    "importance",
    "source_status",
    "message",
    "why_it_matters",
)


def _validate_signal_active_entry(entry: dict[str, Any], path: Path, context: str) -> None:
    if not isinstance(entry, dict):
        raise ValueError(f"{path} {context} item must be an object")
    missing = [field for field in ACTIVE_ENTRY_REQUIRED_FIELDS if field not in entry]
    if missing:
        raise ValueError(f"{path} {context} item missing fields: {missing}")
    for field in ("id", "label", "group", "message", "why_it_matters"):
        _require_non_empty_string(entry, field, path)
    if entry["category"] not in SIGNAL_PRIORITY_CATEGORIES:
        raise ValueError(f"{path} {context} category is invalid for {entry['id']}")
    if entry["horizon"] not in SIGNAL_PRIORITY_HORIZONS:
        raise ValueError(f"{path} {context} horizon is invalid for {entry['id']}")
    if entry["direction"] not in SIGNAL_PRIORITY_DIRECTIONS:
        raise ValueError(f"{path} {context} direction is invalid for {entry['id']}")
    if entry["urgency"] not in SIGNAL_PRIORITY_URGENCIES:
        raise ValueError(f"{path} {context} urgency is invalid for {entry['id']}")
    if entry["freshness_status"] not in SIGNAL_PRIORITY_FRESHNESS:
        raise ValueError(f"{path} {context} freshness_status is invalid for {entry['id']}")
    if entry["source_status"] != "active":
        raise ValueError(
            f"{path} {context} source_status must be 'active' for {entry['id']}; "
            f"gated sources belong in missing_high_value_signals"
        )
    importance = entry["importance"]
    if (
        not isinstance(importance, int)
        or isinstance(importance, bool)
        or importance < 1
        or importance > 5
    ):
        raise ValueError(f"{path} {context} importance must be an integer 1-5 for {entry['id']}")
    for field in ("severity", "priority"):
        _validate_finite_number(entry.get(field), path, f"{context}.{field}")
        if float(entry[field]) < 0:
            raise ValueError(f"{path} {context} {field} must be non-negative for {entry['id']}")
    _validate_confidence_value(entry.get("confidence"), path, f"{context}.confidence")


def _validate_signal_missing_entry(entry: dict[str, Any], path: Path) -> None:
    if not isinstance(entry, dict):
        raise ValueError(f"{path} missing_high_value_signals item must be an object")
    missing = [field for field in MISSING_ENTRY_REQUIRED_FIELDS if field not in entry]
    if missing:
        raise ValueError(
            f"{path} missing_high_value_signals item missing fields: {missing}"
        )
    for field in ("id", "label", "group", "message", "why_it_matters"):
        _require_non_empty_string(entry, field, path)
    if entry["category"] not in SIGNAL_PRIORITY_CATEGORIES:
        raise ValueError(
            f"{path} missing_high_value_signals category is invalid for {entry['id']}"
        )
    if entry["horizon"] not in SIGNAL_PRIORITY_HORIZONS:
        raise ValueError(
            f"{path} missing_high_value_signals horizon is invalid for {entry['id']}"
        )
    if entry["source_status"] == "active":
        raise ValueError(
            f"{path} missing_high_value_signals source_status must not be 'active' for {entry['id']}"
        )
    importance = entry["importance"]
    if (
        not isinstance(importance, int)
        or isinstance(importance, bool)
        or importance < 1
        or importance > 5
    ):
        raise ValueError(
            f"{path} missing_high_value_signals importance must be an integer 1-5 for {entry['id']}"
        )


def validate_signal_priority_file() -> None:
    path = data_dir() / "derived" / "signal_priority.json"
    payload = _load_json(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must be an object")

    _validate_timestamp_with_timezone(_require_string(payload, "generated_at_utc", path), path)
    _require_non_empty_string(payload, "method_version", path)
    _validate_event_date(_require_string(payload, "date", path), path)

    overall_read = payload.get("overall_read")
    if not isinstance(overall_read, dict):
        raise ValueError(f"{path} overall_read must be an object")
    for key in SIGNAL_PRIORITY_OVERALL_KEYS:
        block = overall_read.get(key)
        if not isinstance(block, dict):
            raise ValueError(f"{path} overall_read.{key} must be an object")
        _require_non_empty_string(block, "label", path)
        _validate_finite_number(block.get("score"), path, f"overall_read.{key}.score")
        _validate_confidence_value(block.get("confidence"), path, f"overall_read.{key}.confidence")
    regime = overall_read.get("regime")
    if not isinstance(regime, dict):
        raise ValueError(f"{path} overall_read.regime must be an object")
    _require_non_empty_string(regime, "label", path)

    for field in ("top_warnings", "top_supports", "missing_high_value_signals"):
        if not isinstance(payload.get(field), list):
            raise ValueError(f"{path} {field} must be a list")

    for entry in payload["top_warnings"]:
        _validate_signal_active_entry(entry, path, "top_warnings")
        if entry["direction"] != "risk":
            raise ValueError(
                f"{path} top_warnings entry {entry.get('id')} must have direction 'risk'"
            )
    for entry in payload["top_supports"]:
        _validate_signal_active_entry(entry, path, "top_supports")
        if entry["direction"] != "support":
            raise ValueError(
                f"{path} top_supports entry {entry.get('id')} must have direction 'support'"
            )
    for entry in payload["missing_high_value_signals"]:
        _validate_signal_missing_entry(entry, path)


# ----- Wave-1 next-phase derived dashboards -------------------------------

PAGE_INSIGHT_ROUTE_KEYS = {
    "rates",
    "volatility",
    "regime_map",
    "credit",
    "liquidity",
    "dollar_global",
    "commodities",
    "inflation",
    "growth",
    "housing",
    "sentiment",
    "fragility",
    "tactical",
}
# "watch" is reserved for a future build path. The current
# build_page_insights.py only emits risk|support|mixed|calm|unknown,
# but the enum stays open so a future emitter can introduce a pre-risk
# early-warning state without a schema rev. Keep aligned with
# RouteInsightState in src/lib/types.ts.
PAGE_INSIGHT_STATES = {"risk", "support", "mixed", "calm", "watch", "unknown"}
PAGE_INSIGHT_FRESHNESS_STATUSES = {"ok", "stale", "unavailable"}
# source_status values that are PERMITTED in primary slots. The gating
# invariant says terms_review_needed and candidate must NEVER appear here;
# they may surface only in freshness_notes (free text).
PAGE_INSIGHT_PRIMARY_SOURCE_STATUSES = {"free_public"}
PAGE_INSIGHT_GATED_SOURCE_STATUSES = {"terms_review_needed", "candidate"}
SIGNAL_REF_REQUIRED_FIELDS = (
    "id",
    "label",
    "message",
    "why_it_matters",
    "severity",
    "freshness_status",
    "confidence",
    "source_status",
)


def _validate_signal_ref(entry: dict[str, Any], path: Path, context: str) -> None:
    if not isinstance(entry, dict):
        raise ValueError(f"{path} {context} must be an object")
    missing = [field for field in SIGNAL_REF_REQUIRED_FIELDS if field not in entry]
    if missing:
        raise ValueError(f"{path} {context} missing fields: {missing}")
    for field in ("id", "label", "message", "why_it_matters"):
        _require_non_empty_string(entry, field, path)
    _validate_finite_number(entry.get("severity"), path, f"{context}.severity")
    _validate_confidence_value(entry.get("confidence"), path, f"{context}.confidence")
    if entry.get("freshness_status") not in PAGE_INSIGHT_FRESHNESS_STATUSES:
        raise ValueError(
            f"{path} {context}.freshness_status must be one of {sorted(PAGE_INSIGHT_FRESHNESS_STATUSES)}"
        )
    source_status = entry.get("source_status")
    if not isinstance(source_status, str):
        raise ValueError(f"{path} {context}.source_status must be a string")
    # The strongest invariant: source-gated entries must NEVER appear in a
    # primary slot. Convert the build-time guarantee into a static-data
    # invariant so a future builder regression is caught at validation time.
    if source_status in PAGE_INSIGHT_GATED_SOURCE_STATUSES:
        raise ValueError(
            f"{path} {context}.source_status is gated ('{source_status}'); "
            f"gating violation"
        )


def validate_page_insights_file() -> None:
    path = data_dir() / "derived" / "page_insights.json"
    payload = _load_json(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must be an object")
    _validate_timestamp_with_timezone(_require_string(payload, "generated_at_utc", path), path)
    _require_non_empty_string(payload, "method_version", path)
    _validate_event_date(_require_string(payload, "date", path), path)

    routes = payload.get("routes")
    if not isinstance(routes, dict):
        raise ValueError(f"{path} routes must be an object")

    for route_key, insight in routes.items():
        if route_key not in PAGE_INSIGHT_ROUTE_KEYS:
            raise ValueError(
                f"{path} unknown route key '{route_key}' (expected one of "
                f"{sorted(PAGE_INSIGHT_ROUTE_KEYS)})"
            )
        if not isinstance(insight, dict):
            raise ValueError(f"{path} routes.{route_key} must be an object")
        _require_non_empty_string(insight, "title", path)
        _require_non_empty_string(insight, "why_it_matters", path)
        if insight.get("state") not in PAGE_INSIGHT_STATES:
            raise ValueError(
                f"{path} routes.{route_key}.state must be one of {sorted(PAGE_INSIGHT_STATES)}"
            )
        _validate_confidence_value(
            insight.get("confidence"), path, f"routes.{route_key}.confidence"
        )
        notes = insight.get("freshness_notes")
        if not isinstance(notes, list):
            raise ValueError(f"{path} routes.{route_key}.freshness_notes must be a list")
        for note in notes:
            if not isinstance(note, str):
                raise ValueError(f"{path} routes.{route_key}.freshness_notes items must be strings")
        if "primary_warning" in insight:
            _validate_signal_ref(
                insight["primary_warning"],
                path,
                f"routes.{route_key}.primary_warning",
            )
        if "primary_support" in insight:
            _validate_signal_ref(
                insight["primary_support"],
                path,
                f"routes.{route_key}.primary_support",
            )


VOLATILITY_CURVE_TENORS = {"9D", "30D", "3M"}
VOLATILITY_HIDDEN_STRESS_STATES = {"calm", "watch", "elevated"}
VOLATILITY_THRESHOLD_KEYS = {
    "vix9d_vix_calm",
    "vix9d_vix_stress",
    "vix_vix3m_calm",
    "vix_vix3m_stress",
    "hidden_stress_watch",
    "hidden_stress_elevated",
}


def validate_volatility_dashboard_file() -> None:
    path = data_dir() / "derived" / "volatility_dashboard.json"
    payload = _load_json(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must be an object")
    _validate_timestamp_with_timezone(_require_string(payload, "generated_at_utc", path), path)
    _require_non_empty_string(payload, "method_version", path)
    _validate_event_date(_require_string(payload, "date", path), path)

    curve = payload.get("latest_curve")
    if not isinstance(curve, list):
        raise ValueError(f"{path} latest_curve must be a list")
    for index, point in enumerate(curve):
        if not isinstance(point, dict):
            raise ValueError(f"{path} latest_curve[{index}] must be an object")
        if point.get("tenor") not in VOLATILITY_CURVE_TENORS:
            raise ValueError(
                f"{path} latest_curve[{index}].tenor must be one of "
                f"{sorted(VOLATILITY_CURVE_TENORS)}"
            )
        _validate_finite_number(point.get("value"), path, f"latest_curve[{index}].value")
        percentile = point.get("percentile_5y")
        _validate_finite_number(percentile, path, f"latest_curve[{index}].percentile_5y")
        if not 0 <= float(percentile) <= 100:
            raise ValueError(
                f"{path} latest_curve[{index}].percentile_5y must be between 0 and 100"
            )

    ratio_history = payload.get("ratio_history")
    if not isinstance(ratio_history, list):
        raise ValueError(f"{path} ratio_history must be a list")
    for index, entry in enumerate(ratio_history):
        if not isinstance(entry, dict):
            raise ValueError(f"{path} ratio_history[{index}] must be an object")
        _validate_event_date(_require_string(entry, "date", path), path)
        _validate_finite_number(entry.get("vix9d_vix"), path, f"ratio_history[{index}].vix9d_vix")
        _validate_finite_number(entry.get("vix_vix3m"), path, f"ratio_history[{index}].vix_vix3m")

    hidden_stress = payload.get("hidden_stress")
    if not isinstance(hidden_stress, list):
        raise ValueError(f"{path} hidden_stress must be a list")
    for index, entry in enumerate(hidden_stress):
        if not isinstance(entry, dict):
            raise ValueError(f"{path} hidden_stress[{index}] must be an object")
        _validate_event_date(_require_string(entry, "date", path), path)
        for field in ("vix_value", "vvix_value", "vix_percentile", "vvix_percentile", "hidden_stress_score"):
            _validate_finite_number(entry.get(field), path, f"hidden_stress[{index}].{field}")
        if entry.get("state") not in VOLATILITY_HIDDEN_STRESS_STATES:
            raise ValueError(
                f"{path} hidden_stress[{index}].state must be one of "
                f"{sorted(VOLATILITY_HIDDEN_STRESS_STATES)}"
            )

    thresholds = payload.get("thresholds")
    if not isinstance(thresholds, dict):
        raise ValueError(f"{path} thresholds must be an object")
    missing = VOLATILITY_THRESHOLD_KEYS - set(thresholds.keys())
    if missing:
        raise ValueError(f"{path} thresholds missing keys: {sorted(missing)}")
    for key in VOLATILITY_THRESHOLD_KEYS:
        _validate_finite_number(thresholds.get(key), path, f"thresholds.{key}")


RATES_WINDOW_KEYS = {"1M", "3M", "6M", "1Y"}
RATES_DRIVER_VALUES = {"real_yield", "breakeven", "balanced"}
RATES_CURVE_TENORS = {"2Y", "10Y", "20Y", "30Y"}
RATES_SNAPSHOT_KEYS = {"current", "one_month_ago", "three_months_ago", "one_year_ago"}


def validate_rates_dashboard_file() -> None:
    path = data_dir() / "derived" / "rates_dashboard.json"
    payload = _load_json(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must be an object")
    _validate_timestamp_with_timezone(_require_string(payload, "generated_at_utc", path), path)
    _require_non_empty_string(payload, "method_version", path)
    _validate_event_date(_require_string(payload, "date", path), path)

    windows = payload.get("yield_change_windows")
    if not isinstance(windows, dict):
        raise ValueError(f"{path} yield_change_windows must be an object")
    if set(windows.keys()) != RATES_WINDOW_KEYS:
        raise ValueError(
            f"{path} yield_change_windows must have keys {sorted(RATES_WINDOW_KEYS)}"
        )
    for window_key, block in windows.items():
        if not isinstance(block, dict):
            raise ValueError(f"{path} yield_change_windows.{window_key} must be an object")
        for field in ("nominal_10y_bps", "real_yield_10y_bps", "breakeven_10y_bps"):
            _validate_finite_number(block.get(field), path, f"yield_change_windows.{window_key}.{field}")
        if block.get("driver") not in RATES_DRIVER_VALUES:
            raise ValueError(
                f"{path} yield_change_windows.{window_key}.driver must be one of "
                f"{sorted(RATES_DRIVER_VALUES)}"
            )

    decomp = payload.get("current_decomposition")
    if not isinstance(decomp, dict):
        raise ValueError(f"{path} current_decomposition must be an object")
    for field in ("nominal_10y_pct", "real_yield_10y_pct", "breakeven_10y_pct"):
        _validate_finite_number(decomp.get(field), path, f"current_decomposition.{field}")

    snapshots = payload.get("curve_snapshots")
    if not isinstance(snapshots, dict):
        raise ValueError(f"{path} curve_snapshots must be an object")
    if set(snapshots.keys()) != RATES_SNAPSHOT_KEYS:
        raise ValueError(
            f"{path} curve_snapshots must have keys {sorted(RATES_SNAPSHOT_KEYS)}"
        )
    for snapshot_key, points in snapshots.items():
        if not isinstance(points, list):
            raise ValueError(f"{path} curve_snapshots.{snapshot_key} must be a list")
        for index, point in enumerate(points):
            if not isinstance(point, dict):
                raise ValueError(f"{path} curve_snapshots.{snapshot_key}[{index}] must be an object")
            if point.get("tenor") not in RATES_CURVE_TENORS:
                raise ValueError(
                    f"{path} curve_snapshots.{snapshot_key}[{index}].tenor must be one of "
                    f"{sorted(RATES_CURVE_TENORS)}"
                )
            _validate_finite_number(
                point.get("value"), path, f"curve_snapshots.{snapshot_key}[{index}].value"
            )

    history = payload.get("decomposition_history")
    if not isinstance(history, list):
        raise ValueError(f"{path} decomposition_history must be a list")
    for index, entry in enumerate(history):
        if not isinstance(entry, dict):
            raise ValueError(f"{path} decomposition_history[{index}] must be an object")
        _validate_event_date(_require_string(entry, "date", path), path)
        for field in ("nominal_pct", "real_pct", "breakeven_pct"):
            _validate_finite_number(entry.get(field), path, f"decomposition_history[{index}].{field}")


REGIME_DASHBOARD_WINDOW_KEYS = {"20D", "60D", "120D"}
REGIME_DASHBOARD_REGIMES = {
    "risk_on_easing",
    "global_tightening_risk_off",
    "safe_haven_growth_scare",
    "rotation_reflation",
    "mixed",
}
REGIME_DASHBOARD_THRESHOLD_KEYS = {"real_yield_neutral_bps", "dollar_neutral_pct"}


def validate_regime_dashboard_file() -> None:
    path = data_dir() / "derived" / "regime_dashboard.json"
    payload = _load_json(path)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must be an object")
    _validate_timestamp_with_timezone(_require_string(payload, "generated_at_utc", path), path)
    _require_non_empty_string(payload, "method_version", path)
    _validate_event_date(_require_string(payload, "date", path), path)

    windows = payload.get("windows")
    if not isinstance(windows, dict):
        raise ValueError(f"{path} windows must be an object")
    if set(windows.keys()) != REGIME_DASHBOARD_WINDOW_KEYS:
        raise ValueError(
            f"{path} windows must have keys {sorted(REGIME_DASHBOARD_WINDOW_KEYS)}"
        )

    for window_key, points in windows.items():
        if not isinstance(points, list):
            raise ValueError(f"{path} windows.{window_key} must be a list")
        seen_dates: set[str] = set()
        last_date: str | None = None
        for index, point in enumerate(points):
            if not isinstance(point, dict):
                raise ValueError(f"{path} windows.{window_key}[{index}] must be an object")
            point_date = _require_string(point, "date", path)
            _validate_event_date(point_date, path)
            if point_date in seen_dates:
                raise ValueError(
                    f"{path} windows.{window_key} duplicate date {point_date}"
                )
            if last_date is not None and point_date < last_date:
                raise ValueError(
                    f"{path} windows.{window_key} dates must be ascending; "
                    f"got {point_date} after {last_date}"
                )
            seen_dates.add(point_date)
            last_date = point_date
            for field in (
                "real_yield_change_bps",
                "dollar_change_pct",
                "vix_percentile",
                "credit_change_bps",
                "fragility_score",
            ):
                _validate_finite_number(point.get(field), path, f"windows.{window_key}[{index}].{field}")
            if point.get("regime") not in REGIME_DASHBOARD_REGIMES:
                raise ValueError(
                    f"{path} windows.{window_key}[{index}].regime must be one of "
                    f"{sorted(REGIME_DASHBOARD_REGIMES)}"
                )
            fragility = point.get("fragility_score")
            if not 0.0 <= float(fragility) <= 1.0:
                raise ValueError(
                    f"{path} windows.{window_key}[{index}].fragility_score must be between 0 and 1"
                )

    thresholds = payload.get("thresholds")
    if not isinstance(thresholds, dict):
        raise ValueError(f"{path} thresholds must be an object")
    missing = REGIME_DASHBOARD_THRESHOLD_KEYS - set(thresholds.keys())
    if missing:
        raise ValueError(f"{path} thresholds missing keys: {sorted(missing)}")
    for key in REGIME_DASHBOARD_THRESHOLD_KEYS:
        _validate_finite_number(thresholds.get(key), path, f"thresholds.{key}")
        if float(thresholds[key]) <= 0:
            raise ValueError(f"{path} thresholds.{key} must be positive")


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


def _check_entry(entry_id: str, entry: dict, source: str) -> list[str]:
    errs: list[str] = []
    access = entry.get("access_status")
    if access not in _ALLOWED_ACCESS_STATUSES:
        errs.append(f"{source} entry {entry_id!r}: access_status={access!r} not in allowed enum")
        return errs
    for flag in _REQUIRED_FLAGS:
        if flag not in entry:
            errs.append(f"{source} entry {entry_id!r}: missing required field {flag!r}")
    if errs:
        return errs
    derivation = DERIVATION_TABLE[access]
    if entry["active_scoring_allowed"] != derivation.active_scoring_allowed:
        errs.append(
            f"{source} entry {entry_id!r}: active_scoring_allowed={entry['active_scoring_allowed']!r} "
            f"inconsistent with access_status={access!r} (expected {derivation.active_scoring_allowed})"
        )
    if entry["public_redistribution_allowed"] != derivation.public_redistribution_allowed:
        errs.append(
            f"{source} entry {entry_id!r}: public_redistribution_allowed="
            f"{entry['public_redistribution_allowed']!r} inconsistent with access_status="
            f"{access!r} (expected {derivation.public_redistribution_allowed})"
        )
    if entry["requires_secret"] != derivation.requires_secret:
        errs.append(
            f"{source} entry {entry_id!r}: requires_secret={entry['requires_secret']!r} "
            f"inconsistent with access_status={access!r} (expected {derivation.requires_secret})"
        )
    return errs


def check_access_status_enum() -> None:
    """Validate AccessStatus enum + derived-flag consistency in catalog files.

    Raises:
        SchemaError: when any source_registry or series_catalog entry uses an
            access_status outside the 7-value enum, has inconsistent derived
            flags, or is missing one of the three required flag fields.
    """
    root = shared_io.data_dir()
    errs: list[str] = []
    registry = json.loads((root / "catalog" / "source_registry.json").read_text(encoding="utf-8"))
    for entry_id, entry in registry.items():
        errs.extend(_check_entry(entry_id, entry, "source_registry"))
    series = json.loads((root / "catalog" / "series_catalog.json").read_text(encoding="utf-8"))
    for entry in series:
        errs.extend(_check_entry(entry.get("id", "<unknown>"), entry, "series_catalog"))
    if errs:
        raise SchemaError("AccessStatus enum violations:\n  " + "\n  ".join(errs))


# ----- D2 section catalog schema check ------------------------------------

SECTION_IDS = frozenset(
    {
        "volatility_complex",
        "rates_pressure",
        "regime_drivers",
        "positioning_vs_candidate_sentiment",
        "tactical_stress_board",
        # PR follow-up: 7 channel-tab FocusBlock placements.
        "liquidity_funding",
        "credit_dispersion",
        "dollar_pressure",
        "commodity_impulse",
        "growth_breadth",
        "housing_pulse",
        "inflation_dispersion",
    }
)
SECTION_FRESHNESS_STATUSES = frozenset({"ok", "stale", "unavailable", "degraded"})
# Character-length pins per spec (D2 / FocusBlock contract).
_SECTION_FIELD_LIMITS: dict[str, tuple[int | None, int]] = {
    # field_name: (min_len or None, max_len)
    "eyebrow": (None, 60),
    "question": (None, 120),
    "answer": (60, 200),
    "why": (None, 200),
    "risk": (None, 120),
    "support": (None, 120),
    "caveat": (None, 200),
}


def check_section_insight_schema() -> None:
    """Validate ``sections`` arrays in ``page_insights.json``.

    For each route that carries a ``sections`` key, checks:
    - ``id`` is in the ``SectionId`` enum.
    - ``eyebrow`` and ``question`` are non-empty strings within length pins.
    - ``answer`` is a non-empty string with length between 60 and 200 chars.
    - Optional text fields (``why``, ``risk``, ``support``, ``caveat``) are
      strings or absent/null, within their respective length limits.
    - ``freshness_status`` is one of the allowed enum values.

    Raises:
        ValueError: on any schema violation.
    """
    path = data_dir() / "derived" / "page_insights.json"
    payload = _load_json(path)
    routes = payload.get("routes", {})
    for route_key, insight in routes.items():
        sections = insight.get("sections")
        if sections is None:
            continue
        if not isinstance(sections, list):
            raise ValueError(
                f"{path} routes.{route_key}.sections must be a list"
            )
        for idx, section in enumerate(sections):
            ctx = f"routes.{route_key}.sections[{idx}]"
            if not isinstance(section, dict):
                raise ValueError(f"{path} {ctx} must be an object")
            # id must be in SectionId enum
            section_id = section.get("id")
            if section_id not in SECTION_IDS:
                raise ValueError(
                    f"{path} {ctx}.id {section_id!r} is not in the SectionId enum "
                    f"(expected one of {sorted(SECTION_IDS)})"
                )
            # eyebrow and question: required non-empty strings
            for field in ("eyebrow", "question", "answer"):
                value = section.get(field)
                if not isinstance(value, str) or not value.strip():
                    raise ValueError(
                        f"{path} {ctx}.{field} must be a non-empty string"
                    )
            # Length pins for all text fields
            for field, (min_len, max_len) in _SECTION_FIELD_LIMITS.items():
                value = section.get(field)
                if value is None:
                    # Optional fields may be absent or null — skip length check
                    continue
                if not isinstance(value, str):
                    raise ValueError(f"{path} {ctx}.{field} must be a string or null")
                if min_len is not None and len(value) < min_len:
                    raise ValueError(
                        f"{path} {ctx}.{field} is {len(value)} chars; "
                        f"minimum is {min_len}"
                    )
                if len(value) > max_len:
                    raise ValueError(
                        f"{path} {ctx}.{field} is {len(value)} chars; "
                        f"maximum is {max_len}"
                    )
            # freshness_status
            freshness = section.get("freshness_status")
            if freshness not in SECTION_FRESHNESS_STATUSES:
                raise ValueError(
                    f"{path} {ctx}.freshness_status {freshness!r} is not in "
                    f"{sorted(SECTION_FRESHNESS_STATUSES)}"
                )


_VIX_TERM_CANDIDATE_OBS_KEYS = frozenset(
    {"vix9d", "vix", "vix3m", "vix6m", "vix1y", "vvix"}
)
_VIX_TERM_METRICS_OBS_KEYS = frozenset(
    {
        "vix_event_spread",
        "vix_front_spread",
        "vix_mid_curve_spread",
        "vix_long_curve_spread",
        "vix_term_contango_score",
    }
)


def _validate_candidate_file_governance(payload: dict[str, Any], path: Path) -> None:
    """Check that a candidate file carries the correct governance flags."""
    if payload.get("active_scoring_allowed") is not False:
        raise ValueError(f"{path} active_scoring_allowed must be false for candidate file")
    if payload.get("public_redistribution_allowed") is not False:
        raise ValueError(f"{path} public_redistribution_allowed must be false for candidate file")
    if payload.get("requires_secret") is not True:
        raise ValueError(f"{path} requires_secret must be true for authenticated candidate")
    if payload.get("access_status") != "authenticated_candidate":
        raise ValueError(f"{path} access_status must be 'authenticated_candidate'")
    if payload.get("score_status") != "candidate":
        raise ValueError(f"{path} score_status must be 'candidate'")


def validate_vix_term_candidate_file() -> None:
    """Validate public/data/candidates/tradingview_vix_term_candidate.json if present.

    The file is generated only when TradingView credentials are available;
    missing file is silently skipped — the ingest step is optional.
    """
    path = data_dir() / "candidates" / "tradingview_vix_term_candidate.json"
    if not path.exists():
        return
    payload = _load_json(path)
    if payload.get("series_id") != "tradingview_vix_term_candidate":
        raise ValueError(f"{path} series_id must be 'tradingview_vix_term_candidate'")
    _validate_candidate_file_governance(payload, path)
    observations = payload.get("observations")
    if not isinstance(observations, list):
        raise ValueError(f"{path} observations must be a list")
    # Each observation must have a date plus at least one numeric series key.
    for index, obs in enumerate(observations):
        if not isinstance(obs, dict):
            raise ValueError(f"{path} observations[{index}] must be an object")
        if not isinstance(obs.get("date"), str):
            raise ValueError(f"{path} observations[{index}] date must be a string")
        # Allow partial keys (partial-failure tolerance) but at least one must be present.
        present_keys = _VIX_TERM_CANDIDATE_OBS_KEYS & obs.keys()
        if not present_keys:
            raise ValueError(
                f"{path} observations[{index}] must have at least one VIX series key"
            )
        for key in present_keys:
            if not isinstance(obs[key], int | float) or isinstance(obs[key], bool):
                raise ValueError(f"{path} observations[{index}].{key} must be numeric")


def validate_vix_term_metrics_candidate_file() -> None:
    """Validate public/data/candidates/tradingview_vix_term_metrics_candidate.json if present.

    Missing file is silently skipped — the transform skips if the ingest file is absent.
    """
    path = data_dir() / "candidates" / "tradingview_vix_term_metrics_candidate.json"
    if not path.exists():
        return
    payload = _load_json(path)
    if payload.get("series_id") != "tradingview_vix_term_metrics_candidate":
        raise ValueError(f"{path} series_id must be 'tradingview_vix_term_metrics_candidate'")
    _validate_candidate_file_governance(payload, path)
    observations = payload.get("observations")
    if not isinstance(observations, list):
        raise ValueError(f"{path} observations must be a list")
    for index, obs in enumerate(observations):
        if not isinstance(obs, dict):
            raise ValueError(f"{path} observations[{index}] must be an object")
        if not isinstance(obs.get("date"), str):
            raise ValueError(f"{path} observations[{index}] date must be a string")
        for key in _VIX_TERM_METRICS_OBS_KEYS:
            if key in obs and (not isinstance(obs[key], int | float) or isinstance(obs[key], bool)):
                raise ValueError(f"{path} observations[{index}].{key} must be numeric")


COCKPIT_REQUIRED_TOP_KEYS = {
    "generated_at_utc", "date", "method_version", "regime",
    "composite_scores", "vital_signs", "candidates_not_shown",
}
COCKPIT_COMPOSITE_ORDER = ("market_weather", "macro_climate", "fragility")
COCKPIT_VITAL_REQUIRED_KEYS = {
    "id", "rank", "label", "primary_value", "primary_unit", "primary_decimals",
    "secondary_values", "percentile_5y", "percentile_window_days",
    "delta_7d", "delta_1m", "sparkline_90d",
    "freshness_status", "score_status", "as_of", "direction",
    "source_series_ids", "priority", "importance", "why_it_matters",
}


def check_cockpit_schema(path: Path) -> None:
    data = json.loads(path.read_text())
    missing = COCKPIT_REQUIRED_TOP_KEYS - set(data.keys())
    assert not missing, f"cockpit.json missing top-level keys: {missing}"

    cs = data["composite_scores"]
    assert len(cs) == 3, f"composite_scores must have 3 entries, got {len(cs)}"
    ids = tuple(s["id"] for s in cs)
    assert ids == COCKPIT_COMPOSITE_ORDER, (
        f"composite_scores order must be {COCKPIT_COMPOSITE_ORDER}, got {ids}"
    )

    vs = data["vital_signs"]
    assert 1 <= len(vs) <= 9, f"vital_signs count must be 1-9, got {len(vs)}"
    for cell in vs:
        missing_cell = COCKPIT_VITAL_REQUIRED_KEYS - set(cell.keys())
        assert not missing_cell, f"vital_signs cell missing keys: {missing_cell}"
        assert cell["score_status"] == "active", (
            f"vital_signs cell {cell['id']} score_status must be 'active', "
            f"got {cell['score_status']}"
        )
        assert cell["freshness_status"] in {"ok", "stale", "unavailable"}, (
            f"freshness_status invalid: {cell['freshness_status']}"
        )
        assert cell["direction"] in {"risk", "support", "neutral"}
        if cell["percentile_5y"] is not None:
            assert 0 <= cell["percentile_5y"] <= 100, (
                f"percentile_5y out of range: {cell['percentile_5y']}"
            )
        assert len(cell["sparkline_90d"]) <= 90, "sparkline_90d too long"


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
    validate_signal_priority_file()
    validate_page_insights_file()
    validate_volatility_dashboard_file()
    validate_rates_dashboard_file()
    validate_regime_dashboard_file()
    validate_status_file()
    check_access_status_enum()
    check_section_insight_schema()
    check_cockpit_schema(data_dir() / "derived" / "cockpit.json")
    run_candidate_isolation()
    validate_vix_term_candidate_file()
    validate_vix_term_metrics_candidate_file()


if __name__ == "__main__":
    main()
