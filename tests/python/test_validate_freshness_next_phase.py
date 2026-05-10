"""Freshness expectations for the four Wave-1 derived dashboards.

Each dashboard carries a ``date`` (latest observation underpinning the
view) and ``generated_at_utc`` (when the snapshot was emitted). A
dashboard is fresh if its ``date`` is no more than the per-file tolerance
(in business-day-ish calendar days) old relative to ``generated_at_utc``.
This mirrors the existing convention in ``scripts.transform.freshness``
for daily series.

The check is a static-data invariant — it doesn't assert that the
underlying upstream series are themselves fresh (validate_freshness.py
already handles that via data_status.json). It only catches the case
where one of the dashboard builders publishes a stale-by-construction
snapshot date that contradicts the daily-cadence promise of the file.
"""
from __future__ import annotations

import json

import pytest

from scripts.validate import validate_freshness


def _write(tmp_path, filename: str, payload: dict) -> None:
    derived = tmp_path / "derived"
    derived.mkdir(parents=True, exist_ok=True)
    (derived / filename).write_text(json.dumps(payload), encoding="utf-8")


def _fresh_payload(date: str = "2026-05-08", generated_at_utc: str = "2026-05-10T09:30:00Z") -> dict:
    return {"date": date, "generated_at_utc": generated_at_utc}


def test_validate_dashboard_freshness_accepts_recent_snapshot(tmp_path, monkeypatch):
    for filename in (
        "page_insights.json",
        "volatility_dashboard.json",
        "rates_dashboard.json",
        "regime_dashboard.json",
    ):
        _write(tmp_path, filename, _fresh_payload())
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)
    # Should not raise.
    validate_freshness.validate_dashboard_freshness()


def test_validate_dashboard_freshness_rejects_stale_page_insights(tmp_path, monkeypatch):
    """page_insights.date = 2025-06-01 vs generated_at_utc = 2026-05-10
    -> freshness_days >> tolerance -> stale."""
    payloads = {
        "page_insights.json": _fresh_payload(date="2025-06-01"),
        "volatility_dashboard.json": _fresh_payload(),
        "rates_dashboard.json": _fresh_payload(),
        "regime_dashboard.json": _fresh_payload(),
    }
    for filename, payload in payloads.items():
        _write(tmp_path, filename, payload)
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)
    with pytest.raises(SystemExit) as excinfo:
        validate_freshness.validate_dashboard_freshness()
    assert "page_insights" in str(excinfo.value)


def test_validate_dashboard_freshness_rejects_stale_volatility_dashboard(tmp_path, monkeypatch):
    payloads = {
        "page_insights.json": _fresh_payload(),
        "volatility_dashboard.json": _fresh_payload(date="2025-01-01"),
        "rates_dashboard.json": _fresh_payload(),
        "regime_dashboard.json": _fresh_payload(),
    }
    for filename, payload in payloads.items():
        _write(tmp_path, filename, payload)
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)
    with pytest.raises(SystemExit) as excinfo:
        validate_freshness.validate_dashboard_freshness()
    assert "volatility_dashboard" in str(excinfo.value)


def test_validate_dashboard_freshness_rejects_stale_rates_dashboard(tmp_path, monkeypatch):
    payloads = {
        "page_insights.json": _fresh_payload(),
        "volatility_dashboard.json": _fresh_payload(),
        "rates_dashboard.json": _fresh_payload(date="2025-01-01"),
        "regime_dashboard.json": _fresh_payload(),
    }
    for filename, payload in payloads.items():
        _write(tmp_path, filename, payload)
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)
    with pytest.raises(SystemExit) as excinfo:
        validate_freshness.validate_dashboard_freshness()
    assert "rates_dashboard" in str(excinfo.value)


def test_validate_dashboard_freshness_rejects_stale_regime_dashboard(tmp_path, monkeypatch):
    payloads = {
        "page_insights.json": _fresh_payload(),
        "volatility_dashboard.json": _fresh_payload(),
        "rates_dashboard.json": _fresh_payload(),
        "regime_dashboard.json": _fresh_payload(date="2025-01-01"),
    }
    for filename, payload in payloads.items():
        _write(tmp_path, filename, payload)
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)
    with pytest.raises(SystemExit) as excinfo:
        validate_freshness.validate_dashboard_freshness()
    assert "regime_dashboard" in str(excinfo.value)


def test_validate_dashboard_freshness_records_all_failures(tmp_path, monkeypatch):
    """When multiple files are stale, the validator surfaces all of them
    rather than failing on the first."""
    payloads = {
        "page_insights.json": _fresh_payload(date="2025-01-01"),
        "volatility_dashboard.json": _fresh_payload(date="2025-01-01"),
        "rates_dashboard.json": _fresh_payload(),
        "regime_dashboard.json": _fresh_payload(date="2025-01-01"),
    }
    for filename, payload in payloads.items():
        _write(tmp_path, filename, payload)
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)
    with pytest.raises(SystemExit) as excinfo:
        validate_freshness.validate_dashboard_freshness()
    message = str(excinfo.value)
    assert "page_insights" in message
    assert "volatility_dashboard" in message
    assert "regime_dashboard" in message
    assert "rates_dashboard" not in message  # this one was fresh


def test_validate_dashboard_freshness_skips_missing_files_quietly(tmp_path, monkeypatch):
    """If a dashboard file isn't present (e.g. fresh checkout before update),
    skip the check rather than raising. The schema validator already
    reports the missing-file error separately."""
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)
    derived = tmp_path / "derived"
    derived.mkdir(parents=True, exist_ok=True)
    # Should not raise, even though no files exist.
    validate_freshness.validate_dashboard_freshness()
