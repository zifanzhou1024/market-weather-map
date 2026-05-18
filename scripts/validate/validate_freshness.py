from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

from scripts.shared.io import data_dir
from scripts.transform.freshness import evaluate_freshness


FRESHNESS_COMPARE_FIELDS = (
    "status",
    "freshness_days",
    "last_observation",
    "observation_period",
    "expected_next_release_window",
    "message",
)

# Per-file daily-cadence tolerance (days). page_insights and volatility
# follow daily series so 7 days matches the existing per-series convention
# for daily inputs (same buffer used by VIX/VIX9D/VIX3M). rates also daily.
# regime_dashboard tolerates 10 days because the broad-dollar input is
# weekly-ish and may lag a few business days.
DASHBOARD_FRESHNESS_TOLERANCE_DAYS: dict[str, int] = {
    "page_insights.json": 7,
    "volatility_dashboard.json": 7,
    "rates_dashboard.json": 7,
    "regime_dashboard.json": 10,
    "cockpit.json": 4,  # daily refresh + weekend/holiday tolerance
}


def _parse_iso_date(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _expected_freshness(
    status: dict[str, object],
    generated_at_utc: object,
    generated_at: date | None,
) -> dict[str, Any] | None:
    frequency = status.get("expected_frequency")
    last_observation = status.get("last_observation")
    max_stale_days = status.get("max_stale_days")
    if (
        generated_at is None
        or not isinstance(generated_at_utc, str)
        or not isinstance(frequency, str)
        or _parse_iso_date(last_observation) is None
        or not isinstance(max_stale_days, int | float)
        or isinstance(max_stale_days, bool)
    ):
        return None

    try:
        return evaluate_freshness(
            latest_date=str(last_observation),
            generated_at=generated_at_utc,
            frequency=str(frequency),
            max_stale_days=int(max_stale_days),
        )
    except (TypeError, ValueError):
        return None


def _freshness_message_matches(status: dict[str, object], expected: dict[str, Any]) -> bool:
    actual_message = status.get("message")
    expected_message = expected.get("message")
    if actual_message == expected_message:
        return True
    if status.get("score_status") != "candidate" or not isinstance(expected_message, str):
        return False
    return actual_message == (
        f"{expected_message} candidate diagnostic only; does not affect active scores."
    )


def _freshness_payload_matches(status: dict[str, object], expected: dict[str, Any]) -> bool:
    return all(
        _freshness_message_matches(status, expected)
        if field == "message"
        else status.get(field) == expected.get(field)
        for field in FRESHNESS_COMPARE_FIELDS
    )


def validate_dashboard_freshness() -> None:
    """Verify that the four Wave-1 derived dashboards carry a snapshot
    ``date`` within the per-file tolerance of ``generated_at_utc``.

    Missing files are silently skipped — the schema validator already
    reports them as required-file errors.
    """
    derived_root = data_dir() / "derived"
    failures: list[str] = []

    for filename, tolerance_days in DASHBOARD_FRESHNESS_TOLERANCE_DAYS.items():
        path = derived_root / filename
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            failures.append(f"{filename} is not valid JSON: {error}")
            continue
        generated_at_utc = payload.get("generated_at_utc")
        snapshot_date = payload.get("date")
        generated_at = _parse_iso_date(generated_at_utc)
        observed = _parse_iso_date(snapshot_date)
        if generated_at is None or observed is None:
            failures.append(
                f"{filename} missing valid generated_at_utc / date for freshness check"
            )
            continue
        freshness_days = (generated_at - observed).days
        if freshness_days < 0:
            failures.append(
                f"{filename} snapshot date {snapshot_date} is after generated_at {generated_at_utc}"
            )
            continue
        if freshness_days > tolerance_days:
            failures.append(
                f"{filename} is stale: snapshot {snapshot_date} is {freshness_days} "
                f"days old > {tolerance_days} day tolerance"
            )

    if failures:
        raise SystemExit("\n".join(failures))


# Candidate files written by authenticated ingest steps. Validated only when
# present (i.e. when credentials ran and the ingest succeeded). Max stale
# days matches the active VIX series convention (7 calendar days).
_CANDIDATE_FRESHNESS_EXPECTATIONS: dict[str, int] = {
    "candidates/cboe_vx_settlement_candidate.json": 7,
    "candidates/tradingview_vix_term_candidate.json": 7,
    "candidates/tradingview_vix_term_metrics_candidate.json": 7,
}


def validate_candidate_file_freshness() -> None:
    """Check freshness of candidate JSON files that are present on disk.

    Missing files are silently skipped — authenticated candidates are
    only written when workflow secrets are available.
    """
    failures: list[str] = []
    today = datetime.now(timezone.utc).date()

    for rel_path, max_stale_days in _CANDIDATE_FRESHNESS_EXPECTATIONS.items():
        path = data_dir() / rel_path
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            failures.append(f"{rel_path} is not valid JSON: {error}")
            continue

        generated_at_raw = payload.get("generated_at_utc")
        generated_at = _parse_iso_date(generated_at_raw)
        if generated_at is None:
            failures.append(f"{rel_path} missing valid generated_at_utc")
            continue

        freshness_days = (today - generated_at).days
        if freshness_days < 0:
            failures.append(f"{rel_path} generated_at_utc is in the future: {generated_at_raw}")
            continue
        if freshness_days > max_stale_days:
            failures.append(
                f"{rel_path} is stale: generated {freshness_days} days ago > "
                f"{max_stale_days} day tolerance"
            )

    if failures:
        raise SystemExit("\n".join(failures))


def main() -> None:
    path = data_dir() / "status" / "data_status.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    generated_at_utc = payload.get("generated_at_utc")
    generated_at = _parse_iso_date(generated_at_utc)
    failures = []

    for series_id, status in payload.get("series", {}).items():
        status_value = status.get("status")
        if status_value in {"terms_review_needed", "unavailable"}:
            continue
        if status_value == "failed":
            failures.append(f"{series_id} failed: {status.get('message', 'no message')}")
            continue
        if status_value in {"ok", "stale"}:
            expected = _expected_freshness(status, generated_at_utc, generated_at)
            if expected is None or not _freshness_payload_matches(status, expected):
                failures.append(f"{series_id} failed freshness invariant")
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

    validate_dashboard_freshness()
    validate_candidate_file_freshness()


if __name__ == "__main__":
    main()
