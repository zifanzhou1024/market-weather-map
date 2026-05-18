import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest

from scripts.transform._cockpit_inputs import (
    load_signal_priority_index,
    load_series_observations,
)
from scripts.transform._cockpit_math import (
    delta_against_window,
    percentile_5y,
    sparkline_90d,
    parse_date,
)
from scripts.transform.build_cockpit import build_cockpit_payload


@pytest.fixture
def sample_signal_priority(tmp_path):
    payload = {
        "top_warnings": [
            {"id": "inflation", "priority": 495.0, "importance": 5,
             "why_it_matters": "Inflation drives Fed policy."},
        ],
        "top_supports": [
            {"id": "credit_spreads", "priority": 359.0, "importance": 5,
             "why_it_matters": "Credit confirms stress."},
        ],
        "missing_high_value_signals": [],
        "overall_read": {},
    }
    path = tmp_path / "signal_priority.json"
    path.write_text(json.dumps(payload))
    return path


def test_load_signal_priority_index_merges_warnings_and_supports(sample_signal_priority):
    index = load_signal_priority_index(sample_signal_priority)
    assert "inflation" in index
    assert "credit_spreads" in index
    assert index["inflation"]["priority"] == 495.0


def test_load_signal_priority_index_missing_file_returns_empty(tmp_path):
    index = load_signal_priority_index(tmp_path / "nope.json")
    assert index == {}


def test_load_series_observations_returns_sorted_pairs(tmp_path):
    payload = {
        "observations": [
            {"date": "2026-05-15", "value": 3.2},
            {"date": "2026-05-14", "value": 3.1},
            {"date": "2026-05-13", "value": 3.0},
        ]
    }
    path = tmp_path / "core_cpi.json"
    path.write_text(json.dumps(payload))
    obs = load_series_observations(path)
    assert [o["value"] for o in obs] == [3.0, 3.1, 3.2]


def test_load_series_observations_missing_file_returns_none(tmp_path):
    assert load_series_observations(tmp_path / "nope.json") is None


def _make_obs(date_str: str, value: float) -> dict[str, Any]:
    return {"date": date_str, "value": value}


def test_delta_against_window_daily():
    obs = [
        _make_obs("2026-05-01", 1.0),
        _make_obs("2026-05-08", 1.5),  # exactly 7d
        _make_obs("2026-05-15", 2.0),  # latest
    ]
    assert delta_against_window(obs, days=7) == pytest.approx(0.5)


def test_delta_against_window_returns_none_when_no_old_enough_obs():
    obs = [
        _make_obs("2026-05-13", 1.0),
        _make_obs("2026-05-14", 1.5),
        _make_obs("2026-05-15", 2.0),
    ]
    assert delta_against_window(obs, days=30) is None


def test_delta_against_window_uses_most_recent_obs_at_or_before_cutoff():
    obs = [
        _make_obs("2026-05-01", 1.0),
        _make_obs("2026-05-02", 1.1),
        _make_obs("2026-05-07", 1.4),
        _make_obs("2026-05-15", 2.0),
    ]
    # 7d back from 2026-05-15 = 2026-05-08; most recent strictly older = 2026-05-07
    assert delta_against_window(obs, days=7) == pytest.approx(0.6)


def test_percentile_5y_returns_position_and_window():
    """Latest value is the max -> percentile near 100."""
    start = date(2026, 1, 1)
    obs = [{"date": (start + timedelta(days=i)).isoformat(), "value": float(i + 1)}
           for i in range(90)]
    pct, window = percentile_5y(obs)
    assert window == 90
    assert pct is not None
    assert 90 <= pct <= 100


def test_percentile_5y_returns_none_when_insufficient_history():
    obs = [_make_obs("2026-05-15", 1.0)] * 5
    pct, window = percentile_5y(obs)
    assert pct is None
    assert window == 5


def test_sparkline_90d_takes_trailing_observations():
    obs = [_make_obs(f"2026-01-{i:02d}", float(i)) for i in range(1, 32)]
    obs += [_make_obs(f"2026-02-{i:02d}", float(i)) for i in range(1, 29)]
    obs += [_make_obs(f"2026-03-{i:02d}", float(i)) for i in range(1, 32)]
    spark = sparkline_90d(obs)
    assert len(spark) == 90
    # last point matches latest observation
    assert spark[-1] == 31.0


def test_sparkline_90d_pads_short_history():
    obs = [_make_obs(f"2026-05-{i:02d}", float(i)) for i in range(1, 11)]
    spark = sparkline_90d(obs)
    assert len(spark) == 10  # no padding; the front-end handles shorter arrays


@pytest.fixture
def sample_inputs(tmp_path):
    """Minimal viable input tree mirroring real public/data/ layout:
    derived/{signal_priority,score_summary,regime_snapshot}.json + status/data_status.json
    + series/*.json.
    """
    derived_dir = tmp_path / "derived"
    derived_dir.mkdir()
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    series_dir = tmp_path / "series"
    series_dir.mkdir()

    # signal_priority (under derived/)
    (derived_dir / "signal_priority.json").write_text(json.dumps({
        "top_warnings": [
            {"id": "inflation", "priority": 495.0, "importance": 5,
             "why_it_matters": "Inflation drives Fed policy."},
        ],
        "top_supports": [
            {"id": "credit_spreads", "priority": 359.0, "importance": 5,
             "why_it_matters": "Credit confirms stress."},
        ],
        "missing_high_value_signals": [],
        "overall_read": {},
    }))

    # series files (under series/) for 2 entries the whitelist references
    (series_dir / "core_cpi.json").write_text(json.dumps({
        "series_id": "core_cpi",
        "observations": [
            {"date": f"2026-{m:02d}-15", "value": 3.0 + 0.01 * m}
            for m in range(1, 13)
        ],
    }))
    (series_dir / "high_yield_oas.json").write_text(json.dumps({
        "series_id": "high_yield_oas",
        "observations": [
            {"date": f"2026-05-{d:02d}", "value": 310 + d}
            for d in range(1, 16)
        ],
    }))

    # score_summary (under derived/)
    (derived_dir / "score_summary.json").write_text(json.dumps({
        "generated_at_utc": "2026-05-16T00:00:00Z",
        "date": "2026-05-15",
        "method_version": "test",
        "scores": {
            "market_weather": {"score": 4.3, "label": "Mixed", "confidence": 0.99,
                               "bucket_scores": {}, "bucket_weights": {},
                               "top_supports": [], "top_risks": [], "recent_changes": [],
                               "missing_or_stale_notes": [], "confidence_reasons": []},
            "macro_climate": {"score": 12.0, "label": "Mixed", "confidence": 0.99,
                              "bucket_scores": {}, "bucket_weights": {},
                              "top_supports": [], "top_risks": [], "recent_changes": [],
                              "missing_or_stale_notes": [], "confidence_reasons": []},
            "fragility": {"score": 28.8, "label": "Low Fragility", "confidence": 0.98,
                          "bucket_scores": {}, "bucket_weights": {},
                          "top_supports": [], "top_risks": [], "recent_changes": [],
                          "missing_or_stale_notes": [], "confidence_reasons": []},
        },
        "conflicting_signals": [],
        "data_quality": {},
    }))

    # regime_snapshot (under derived/)
    (derived_dir / "regime_snapshot.json").write_text(json.dumps({
        "regime": {"label": "Reallocation / rotation"},
    }))

    # data_status (under status/) — mark both series ok
    (status_dir / "data_status.json").write_text(json.dumps({
        "series": {
            "core_cpi": {"status": "ok"},
            "high_yield_oas": {"status": "ok"},
        }
    }))

    return tmp_path


def test_build_cockpit_payload_has_three_composite_scores(sample_inputs):
    payload = build_cockpit_payload(sample_inputs)
    assert len(payload["composite_scores"]) == 3
    ids = [s["id"] for s in payload["composite_scores"]]
    assert ids == ["market_weather", "macro_climate", "fragility"]


def test_build_cockpit_payload_regime_field_from_snapshot(sample_inputs):
    payload = build_cockpit_payload(sample_inputs)
    assert payload["regime"]["label"] == "Reallocation / rotation"
    assert payload["regime"]["tone"] == "neutral"


def test_build_cockpit_payload_vital_signs_sorted_by_priority(sample_inputs):
    payload = build_cockpit_payload(sample_inputs)
    # Only 2 whitelist entries have matching series in the fixture, so only
    # 2 vital_signs emitted; inflation (priority 495) ranks before credit (359).
    vs = payload["vital_signs"]
    assert len(vs) == 2
    assert vs[0]["id"] == "inflation"
    assert vs[0]["rank"] == 1
    assert vs[1]["id"] == "credit_spreads"
    assert vs[1]["rank"] == 2


def test_build_cockpit_payload_includes_method_version(sample_inputs):
    payload = build_cockpit_payload(sample_inputs)
    assert payload["method_version"].startswith("phase-e-cockpit-v")


def test_build_cockpit_loads_from_derived_dir(tmp_path):
    """Whitelist entries pointing to derived series (us10y_minus_us2y, net_liquidity)
    must resolve from public/data/derived/ when the file is not in series/."""
    (tmp_path / "series").mkdir()
    derived_dir = tmp_path / "derived"
    derived_dir.mkdir()
    status_dir = tmp_path / "status"
    status_dir.mkdir()

    (derived_dir / "signal_priority.json").write_text(json.dumps({
        "top_warnings": [{"id": "real_yields", "priority": 100.0, "importance": 4,
                          "why_it_matters": ""}],
        "top_supports": [], "missing_high_value_signals": [], "overall_read": {},
    }))
    (derived_dir / "us10y_minus_us2y.json").write_text(json.dumps({
        "series_id": "us10y_minus_us2y",
        "observations": [{"date": f"2026-05-{d:02d}", "value": -33.0 + d}
                         for d in range(1, 16)],
    }))
    (derived_dir / "score_summary.json").write_text(json.dumps({
        "date": "2026-05-15",
        "scores": {s: {"score": 0, "label": "M", "confidence": 1, "bucket_scores": {},
                       "bucket_weights": {}, "top_supports": [], "top_risks": [],
                       "recent_changes": [], "missing_or_stale_notes": [],
                       "confidence_reasons": []}
                   for s in ("market_weather", "macro_climate", "fragility")},
    }))
    (derived_dir / "regime_snapshot.json").write_text(json.dumps({"regime": {"label": "X"}}))
    (status_dir / "data_status.json").write_text(json.dumps({
        "series": {"us10y_minus_us2y": {"status": "ok"}}
    }))
    payload = build_cockpit_payload(tmp_path)
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    assert "yield_curve" in vs_ids  # whitelist entry whose primary_series_id is us10y_minus_us2y


def test_main_writes_real_cockpit_with_actual_data():
    """End-to-end: run main() against the real repo public/data/ tree;
    cockpit.json must contain at least one vital sign (proving the wiring
    is right against the production layout).

    Non-hermetic — writes to public/data/derived/cockpit.json — but that is the
    whole point: this verifies the loader paths match the real layout.
    """
    from scripts.transform.build_cockpit import main

    main()
    project_root = Path(__file__).resolve().parents[2]
    cockpit_path = project_root / "public" / "data" / "derived" / "cockpit.json"
    assert cockpit_path.exists()
    payload = json.loads(cockpit_path.read_text())
    assert len(payload["composite_scores"]) == 3
    assert len(payload["vital_signs"]) > 0, (
        "vital_signs must be non-empty when run against real data; "
        f"got {payload['vital_signs']} with candidates_not_shown="
        f"{payload['candidates_not_shown']}"
    )
