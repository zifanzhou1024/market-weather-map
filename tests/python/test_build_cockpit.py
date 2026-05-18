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
