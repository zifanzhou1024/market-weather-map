"""Schema tests for scripts.validate.validate_schema.check_diff_schema.

A valid payload must pass; any deviation from the contract must raise
``ValueError`` so a future builder regression is caught at the validation
gate, not silently propagated to the frontend.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.validate.validate_schema import check_diff_schema


def _row(*, row_id: str, direction: str = "risk", freshness: str = "ok") -> dict:
    return {
        "id": row_id,
        "label": row_id.replace("_", " ").title(),
        "direction": direction,
        "primary_unit": "",
        "primary_decimals": 1,
        "current_value": 1.5,
        "current_date": "2026-05-15",
        "windows": {
            "1d": {"value": 1.4, "date": "2026-05-14", "delta": 0.1, "delta_pct": 7.1},
            "7d": {"value": None, "date": None, "delta": None, "delta_pct": None},
            "30d": {"value": None, "date": None, "delta": None, "delta_pct": None},
        },
        "freshness_status": freshness,
    }


def _valid_payload() -> dict:
    return {
        "generated_at_utc": "2026-05-17T16:13:45Z",
        "date": "2026-05-15",
        "method_version": "phase-f-diff-v1",
        "composite_scores": [
            _row(row_id="market_weather", direction="neutral"),
            _row(row_id="macro_climate", direction="neutral"),
            _row(row_id="fragility", direction="neutral"),
        ],
        "vital_signs": [
            _row(row_id="vix_complex", direction="risk"),
        ],
    }


def _write(payload: dict, tmp_path: Path) -> Path:
    p = tmp_path / "diff.json"
    p.write_text(json.dumps(payload))
    return p


def test_valid_payload_passes(tmp_path):
    check_diff_schema(_write(_valid_payload(), tmp_path))


def test_missing_top_level_key_rejected(tmp_path):
    payload = _valid_payload()
    del payload["method_version"]
    with pytest.raises(ValueError, match="missing top-level keys"):
        check_diff_schema(_write(payload, tmp_path))


def test_missing_composite_score_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"].pop()
    with pytest.raises(ValueError, match="must have 3 entries"):
        check_diff_schema(_write(payload, tmp_path))


def test_wrong_composite_order_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"].reverse()
    with pytest.raises(ValueError, match="composite_scores order"):
        check_diff_schema(_write(payload, tmp_path))


def test_empty_vital_signs_rejected(tmp_path):
    payload = _valid_payload()
    payload["vital_signs"] = []
    with pytest.raises(ValueError, match="vital_signs must be non-empty"):
        check_diff_schema(_write(payload, tmp_path))


def test_missing_window_key_rejected(tmp_path):
    payload = _valid_payload()
    del payload["vital_signs"][0]["windows"]["7d"]
    with pytest.raises(ValueError, match="windows keys must be exactly"):
        check_diff_schema(_write(payload, tmp_path))


def test_extra_window_key_rejected(tmp_path):
    payload = _valid_payload()
    payload["vital_signs"][0]["windows"]["90d"] = {
        "value": None,
        "date": None,
        "delta": None,
        "delta_pct": None,
    }
    with pytest.raises(ValueError, match="windows keys must be exactly"):
        check_diff_schema(_write(payload, tmp_path))


def test_missing_window_entry_field_rejected(tmp_path):
    payload = _valid_payload()
    del payload["vital_signs"][0]["windows"]["1d"]["delta_pct"]
    with pytest.raises(ValueError, match=r"windows\.1d missing keys"):
        check_diff_schema(_write(payload, tmp_path))


def test_invalid_direction_rejected(tmp_path):
    payload = _valid_payload()
    payload["vital_signs"][0]["direction"] = "bullish"
    with pytest.raises(ValueError, match="direction must be one of"):
        check_diff_schema(_write(payload, tmp_path))


def test_invalid_freshness_status_rejected(tmp_path):
    payload = _valid_payload()
    payload["vital_signs"][0]["freshness_status"] = "fresh"
    with pytest.raises(ValueError, match="freshness_status must be one of"):
        check_diff_schema(_write(payload, tmp_path))


def test_missing_row_field_rejected(tmp_path):
    payload = _valid_payload()
    del payload["vital_signs"][0]["current_value"]
    with pytest.raises(ValueError, match="missing keys"):
        check_diff_schema(_write(payload, tmp_path))


def test_composite_row_with_wrong_id_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"][2]["id"] = "fragility_typo"
    with pytest.raises(ValueError, match="composite_scores order"):
        check_diff_schema(_write(payload, tmp_path))
