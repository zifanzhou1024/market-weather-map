import json

import pytest

from scripts.validate.validate_schema import check_cockpit_schema


def _valid_payload():
    return {
        "generated_at_utc": "2026-05-17T16:13:45Z",
        "date": "2026-05-15",
        "method_version": "phase-e-cockpit-v1",
        "regime": {"label": "Mixed", "tone": "neutral"},
        "composite_scores": [
            {"id": sid, "label": sid, "value": 4.3, "regime_label": "Mixed",
             "percentile_5y": None, "percentile_window_days": None,
             "delta_7d": None, "delta_1m": None, "sparkline_90d": [],
             "direction": "neutral"}
            for sid in ("market_weather", "macro_climate", "fragility")
        ],
        "vital_signs": [
            {"id": "inflation", "rank": 1, "label": "Inflation",
             "primary_value": 3.2, "primary_unit": "% YoY", "primary_decimals": 1,
             "secondary_values": [], "percentile_5y": 78, "percentile_window_days": 1260,
             "delta_7d": 0.1, "delta_1m": None, "sparkline_90d": [3.0, 3.2],
             "freshness_status": "ok", "score_status": "active",
             "as_of": "2026-04-01", "direction": "risk",
             "source_series_ids": ["core_cpi"], "priority": 495.0,
             "importance": 5, "why_it_matters": "..."}
        ],
        "candidates_not_shown": [],
    }


def test_valid_payload_passes(tmp_path):
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(_valid_payload()))
    check_cockpit_schema(p)  # should not raise


def test_missing_composite_score_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"].pop()
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_wrong_composite_order_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"].reverse()
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_more_than_nine_vital_signs_rejected(tmp_path):
    payload = _valid_payload()
    template = payload["vital_signs"][0]
    payload["vital_signs"] = [
        {**template, "id": f"id{i}", "rank": i} for i in range(1, 11)
    ]
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_candidate_score_status_rejected(tmp_path):
    payload = _valid_payload()
    payload["vital_signs"][0]["score_status"] = "candidate"
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_out_of_range_percentile_rejected(tmp_path):
    payload = _valid_payload()
    payload["vital_signs"][0]["percentile_5y"] = 200
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)


def test_composite_missing_fragility_rejected(tmp_path):
    payload = _valid_payload()
    payload["composite_scores"] = [s for s in payload["composite_scores"] if s["id"] != "fragility"]
    p = tmp_path / "cockpit.json"
    p.write_text(json.dumps(payload))
    with pytest.raises(AssertionError):
        check_cockpit_schema(p)
