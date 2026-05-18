"""Tests for scripts.transform.build_diff.

Covers:
  * happy-path 1d/7d/30d diffs on a synthetic monotonic series
  * missing-series rows degrade to ``freshness_status: 'unavailable'``
  * short history: shorter windows resolve, longer ones emit null
  * composite scores read from score_history.json
  * YoY transform + scale applied in both ``current_value`` and the per-window
    base values (so deltas live in the displayed units)
  * top-level payload shape (composite order, snapshot ``date`` resolution)
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest

from scripts.transform.build_diff import (
    COMPOSITE_SCORE_ORDER,
    METHOD_VERSION,
    WINDOWS,
    _compose_row,
    _empty_windows,
    _value_at_or_before,
    build_diff_payload,
)


# ---- helpers ---------------------------------------------------------------


def _series(values_by_date: list[tuple[str, float]]) -> list[dict[str, Any]]:
    return [{"date": d, "value": v} for d, v in values_by_date]


def _write_scaffold(tmp_path: Path) -> None:
    """Write minimal score_summary + regime_snapshot + status so the
    composite-score and snapshot-date helpers have inputs to read.
    """
    (tmp_path / "derived").mkdir(exist_ok=True)
    (tmp_path / "status").mkdir(exist_ok=True)
    (tmp_path / "series").mkdir(exist_ok=True)
    (tmp_path / "derived" / "score_summary.json").write_text(
        json.dumps({"date": "2026-05-15", "scores": {}})
    )
    (tmp_path / "status" / "data_status.json").write_text(json.dumps({"series": {}}))


# ---- _value_at_or_before ---------------------------------------------------


def test_value_at_or_before_returns_value_and_date_for_exact_match():
    """An observation exactly N days old qualifies."""
    obs = _series(
        [
            ("2026-05-01", 1.0),
            ("2026-05-08", 1.5),  # exactly 7d before latest
            ("2026-05-15", 2.0),
        ]
    )
    result = _value_at_or_before(obs, 7)
    assert result == (1.5, "2026-05-08")


def test_value_at_or_before_returns_most_recent_before_cutoff():
    """When no exact match, picks the most recent observation strictly older
    than the cutoff."""
    obs = _series(
        [
            ("2026-05-01", 1.0),
            ("2026-05-02", 1.1),
            ("2026-05-07", 1.4),
            ("2026-05-15", 2.0),
        ]
    )
    # cutoff = 2026-05-15 - 7 = 2026-05-08; most recent <= cutoff is 2026-05-07
    result = _value_at_or_before(obs, 7)
    assert result == (1.4, "2026-05-07")


def test_value_at_or_before_returns_none_when_history_too_short():
    obs = _series(
        [
            ("2026-05-13", 1.0),
            ("2026-05-14", 1.5),
            ("2026-05-15", 2.0),
        ]
    )
    assert _value_at_or_before(obs, 30) is None


def test_value_at_or_before_returns_none_on_empty():
    assert _value_at_or_before([], 7) is None


# ---- _compose_row ---------------------------------------------------------


def test_compose_row_happy_path_60_day_monotonic_series():
    """A series with +1.0 per day produces deltas equal to the window width."""
    start = date(2026, 1, 1)
    obs = _series(
        [
            ((start + timedelta(days=i)).isoformat(), float(i))
            for i in range(60)
        ]
    )
    row = _compose_row(
        id="x",
        label="X",
        direction="risk",
        primary_unit="",
        primary_decimals=2,
        value_scale=1.0,
        value_transform=None,
        observations=obs,
    )
    assert row["current_value"] == pytest.approx(59.0)
    assert row["freshness_status"] == "ok"
    assert row["windows"]["1d"]["delta"] == pytest.approx(1.0)
    assert row["windows"]["7d"]["delta"] == pytest.approx(7.0)
    assert row["windows"]["30d"]["delta"] == pytest.approx(30.0)
    # delta_pct: (59 - 29) / 29 * 100 for the 30d window
    assert row["windows"]["30d"]["delta_pct"] == pytest.approx(30.0 / 29.0 * 100.0)


def test_compose_row_empty_series_returns_unavailable_with_null_windows():
    row = _compose_row(
        id="x",
        label="X",
        direction="risk",
        primary_unit="",
        primary_decimals=1,
        value_scale=1.0,
        value_transform=None,
        observations=[],
    )
    assert row["freshness_status"] == "unavailable"
    assert row["current_value"] is None
    assert row["current_date"] is None
    assert row["windows"] == _empty_windows()


def test_compose_row_none_series_returns_unavailable():
    row = _compose_row(
        id="x",
        label="X",
        direction="risk",
        primary_unit="",
        primary_decimals=1,
        value_scale=1.0,
        value_transform=None,
        observations=None,
    )
    assert row["freshness_status"] == "unavailable"
    assert row["windows"]["7d"]["delta"] is None


def test_compose_row_short_history_emits_partial_windows():
    """14 daily obs: 1d & 7d resolve; 30d returns null."""
    start = date(2026, 5, 2)
    obs = _series(
        [
            ((start + timedelta(days=i)).isoformat(), float(i))
            for i in range(14)
        ]
    )
    row = _compose_row(
        id="x",
        label="X",
        direction="risk",
        primary_unit="",
        primary_decimals=2,
        value_scale=1.0,
        value_transform=None,
        observations=obs,
    )
    assert row["windows"]["1d"]["delta"] is not None
    assert row["windows"]["7d"]["delta"] is not None
    assert row["windows"]["30d"]["delta"] is None
    assert row["windows"]["30d"]["value"] is None


def test_compose_row_applies_scale_to_current_and_windows():
    """A scale=100 entry (HY OAS percent -> bp) must scale the current value,
    the per-window base values, AND the deltas (so deltas live in bp)."""
    obs = _series(
        [
            ("2026-05-08", 2.0),
            ("2026-05-15", 2.65),
        ]
    )
    row = _compose_row(
        id="hy",
        label="HY OAS",
        direction="risk",
        primary_unit=" bp",
        primary_decimals=0,
        value_scale=100.0,
        value_transform=None,
        observations=obs,
    )
    # current_value: 2.65 * 100 = 265
    assert row["current_value"] == pytest.approx(265.0)
    # 7d window base: 2.0 * 100 = 200; delta = 65bp
    assert row["windows"]["7d"]["value"] == pytest.approx(200.0)
    assert row["windows"]["7d"]["delta"] == pytest.approx(65.0)


def test_compose_row_applies_yoy_transform_then_scale():
    """yoy_pct should run before value_scale so the scale multiplier acts on
    the transformed (display-space) series."""
    obs = _series(
        [
            ("2025-01-15", 100.0),
            ("2026-01-15", 110.0),  # +10% YoY
            ("2026-06-15", 121.0),  # vs ~12mo prior = +10% YoY (no direct match)
        ]
    )
    # Add a prior point so YoY for 2026-06-15 has a comparable; closest
    # 12-month-prior in [low, high] of 2026-06-15 - 365 +/- 35 days
    obs.insert(1, {"date": "2025-06-15", "value": 110.0})
    row = _compose_row(
        id="cpi",
        label="Core CPI YoY",
        direction="risk",
        primary_unit="% YoY",
        primary_decimals=1,
        value_scale=1.0,
        value_transform="yoy_pct",
        observations=sorted(obs, key=lambda o: o["date"]),
    )
    assert row["current_value"] == pytest.approx(10.0, abs=0.01)
    assert row["freshness_status"] == "ok"


def test_compose_row_yoy_dropping_all_rows_marks_unavailable():
    """A 30-day series with no 12mo history yields zero post-transform rows ->
    the row must degrade to unavailable rather than emit a misleading 'ok'
    with null windows."""
    obs = _series(
        [(f"2026-04-{d:02d}", float(d)) for d in range(1, 30)]
    )
    row = _compose_row(
        id="cpi",
        label="Core CPI YoY",
        direction="risk",
        primary_unit="% YoY",
        primary_decimals=1,
        value_scale=1.0,
        value_transform="yoy_pct",
        observations=obs,
    )
    assert row["freshness_status"] == "unavailable"
    assert row["current_value"] is None


def test_compose_row_delta_pct_null_when_base_value_zero():
    """Zero base value must NOT divide by zero; delta_pct stays null."""
    obs = _series(
        [
            ("2026-05-08", 0.0),
            ("2026-05-15", 1.0),
        ]
    )
    row = _compose_row(
        id="x",
        label="X",
        direction="risk",
        primary_unit="",
        primary_decimals=2,
        value_scale=1.0,
        value_transform=None,
        observations=obs,
    )
    assert row["windows"]["7d"]["delta"] == pytest.approx(1.0)
    assert row["windows"]["7d"]["delta_pct"] is None


# ---- build_diff_payload ----------------------------------------------------


def test_build_diff_payload_has_three_composite_scores_in_order(tmp_path):
    _write_scaffold(tmp_path)
    history = [
        {
            "date": (date(2026, 1, 1) + timedelta(days=i)).isoformat(),
            "market_weather": float(i),
            "macro_climate": float(i * 2),
            "fragility": float(50 - i),
        }
        for i in range(60)
    ]
    (tmp_path / "derived" / "score_history.json").write_text(
        json.dumps({"observations": history})
    )

    payload = build_diff_payload(tmp_path)
    assert payload["method_version"] == METHOD_VERSION
    ids = tuple(row["id"] for row in payload["composite_scores"])
    assert ids == COMPOSITE_SCORE_ORDER
    # The market_weather composite increments +1/day -> 7d delta = 7
    market = next(r for r in payload["composite_scores"] if r["id"] == "market_weather")
    assert market["windows"]["7d"]["delta"] == pytest.approx(7.0)
    assert market["windows"]["30d"]["delta"] == pytest.approx(30.0)


def test_build_diff_payload_empty_score_history_emits_unavailable_composites(tmp_path):
    _write_scaffold(tmp_path)
    payload = build_diff_payload(tmp_path)
    assert len(payload["composite_scores"]) == 3
    for row in payload["composite_scores"]:
        assert row["freshness_status"] == "unavailable"
        assert row["current_value"] is None


def test_build_diff_payload_vital_signs_count_matches_whitelist(tmp_path):
    """Every whitelist entry produces a row, even if the underlying series is
    missing. The shape must stay stable across builds so the frontend never
    has to handle a variable row count."""
    from scripts.shared.cockpit_whitelist import COCKPIT_WHITELIST

    _write_scaffold(tmp_path)
    payload = build_diff_payload(tmp_path)
    assert len(payload["vital_signs"]) == len(COCKPIT_WHITELIST)
    # All rows must be unavailable when there is no series data on disk
    assert all(r["freshness_status"] == "unavailable" for r in payload["vital_signs"])


def test_build_diff_payload_loads_vital_sign_from_series_dir(tmp_path):
    _write_scaffold(tmp_path)
    # Provide a high_yield_oas series so the credit_spreads whitelist entry
    # resolves. scale=100 -> verifies scale is applied in the assembled row.
    series = [
        {"date": (date(2026, 4, 1) + timedelta(days=i)).isoformat(), "value": 2.5}
        for i in range(45)
    ]
    series.append({"date": "2026-05-16", "value": 2.65})
    series.sort(key=lambda o: o["date"])
    (tmp_path / "series" / "high_yield_oas.json").write_text(
        json.dumps({"observations": series})
    )

    payload = build_diff_payload(tmp_path)
    credit = next(r for r in payload["vital_signs"] if r["id"] == "credit_spreads")
    assert credit["freshness_status"] == "ok"
    assert credit["current_value"] == pytest.approx(265.0, abs=0.01)
    # 7d window: a 2.5 base scaled by 100 = 250; delta = 15 bp
    assert credit["windows"]["7d"]["value"] == pytest.approx(250.0, abs=0.01)
    assert credit["windows"]["7d"]["delta"] == pytest.approx(15.0, abs=0.01)


def test_build_diff_payload_loads_vital_sign_from_derived_dir(tmp_path):
    """us10y_minus_us2y lives under derived/ — _load_series must find it."""
    _write_scaffold(tmp_path)
    series = [
        {
            "date": (date(2026, 4, 1) + timedelta(days=i)).isoformat(),
            "value": -0.30 + 0.005 * i,
        }
        for i in range(45)
    ]
    (tmp_path / "derived" / "us10y_minus_us2y.json").write_text(
        json.dumps({"observations": series})
    )
    payload = build_diff_payload(tmp_path)
    curve = next(r for r in payload["vital_signs"] if r["id"] == "yield_curve")
    assert curve["freshness_status"] == "ok"
    # scale=100 (% -> bp), so current_value should be (latest value * 100)
    latest_raw = -0.30 + 0.005 * 44  # -0.08
    assert curve["current_value"] == pytest.approx(latest_raw * 100, abs=0.5)


def test_build_diff_payload_snapshot_date_prefers_score_summary(tmp_path):
    _write_scaffold(tmp_path)
    payload = build_diff_payload(tmp_path)
    assert payload["date"] == "2026-05-15"


def test_build_diff_payload_snapshot_date_falls_back_to_latest_current_date(tmp_path):
    """When score_summary.date is missing, snapshot date should be the latest
    current_date across any non-null vital row."""
    (tmp_path / "derived").mkdir()
    (tmp_path / "series").mkdir()
    series = [
        {"date": (date(2026, 4, 1) + timedelta(days=i)).isoformat(), "value": 2.0}
        for i in range(40)
    ]
    (tmp_path / "series" / "high_yield_oas.json").write_text(
        json.dumps({"observations": series})
    )
    (tmp_path / "derived" / "score_summary.json").write_text(json.dumps({"scores": {}}))
    payload = build_diff_payload(tmp_path)
    # latest series observation
    assert payload["date"] == series[-1]["date"]


def test_build_diff_main_writes_real_diff(tmp_path):
    """End-to-end: run main() against the real public/data/ layout. Verifies
    the loader paths match the production layout and the output round-trips
    through the schema check.
    """
    from scripts.transform.build_diff import main
    from scripts.validate.validate_schema import check_diff_schema

    main()
    project_root = Path(__file__).resolve().parents[2]
    out_path = project_root / "public" / "data" / "derived" / "diff.json"
    assert out_path.exists()
    payload = json.loads(out_path.read_text())
    assert tuple(s["id"] for s in payload["composite_scores"]) == COMPOSITE_SCORE_ORDER
    assert len(payload["vital_signs"]) > 0
    # At least one vital sign must have a current value (i.e. the cockpit
    # has real data in the worktree's public/data/ tree)
    assert any(r["current_value"] is not None for r in payload["vital_signs"])
    check_diff_schema(out_path)


def test_build_diff_payload_windows_keys_exact(tmp_path):
    """Every window object must carry exactly 1d / 7d / 30d keys."""
    _write_scaffold(tmp_path)
    payload = build_diff_payload(tmp_path)
    expected = {f"{d}d" for d in WINDOWS}
    for row in payload["composite_scores"] + payload["vital_signs"]:
        assert set(row["windows"].keys()) == expected
