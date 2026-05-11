from datetime import date, timedelta

import pytest

from scripts.transform import build_treasury_supply_pressure as mod


def _weekly_series(start: date, n_weeks: int, value: float) -> list[dict[str, object]]:
    """Build a synthetic weekly series with constant `value` per observation."""
    return [
        {"date": (start + timedelta(weeks=i)).isoformat(), "value": value}
        for i in range(n_weeks)
    ]


def test_compute_window_sums_basic():
    # 5 weekly observations, value=100 each. Trailing 30-day window contains
    # 4-5 observations (depending on alignment), so window_sum is 400 or 500.
    obs = _weekly_series(date(2024, 1, 1), 5, 100.0)
    sums = mod.compute_window_sums(obs, window_days=30)
    # First obs has only itself in the window:
    assert sums[0]["window_sum"] == 100.0
    # Fifth obs (28 days after first): window covers obs 2 through 5 = 400
    # (or 5 if first obs is exactly 29 days back, which it is — 7*4=28, within 29-day-back)
    assert sums[4]["window_sum"] in (400.0, 500.0)


def test_compute_window_sums_sorts_input():
    # Unsorted input gets sorted before windowing.
    obs = [
        {"date": "2024-01-15", "value": 50.0},
        {"date": "2024-01-01", "value": 100.0},
    ]
    sums = mod.compute_window_sums(obs, window_days=30)
    assert [s["date"] for s in sums] == ["2024-01-01", "2024-01-15"]


def test_compute_supply_pressure_skips_insufficient_history():
    # 10 weekly obs is well under the min_baseline_samples threshold.
    obs = _weekly_series(date(2024, 1, 1), 10, 100.0)
    result = mod.compute_supply_pressure(obs, min_baseline_samples=40)
    assert result == []


def test_compute_supply_pressure_constant_input_gives_ratio_near_1():
    # Constant value of 100 across 60 weeks. After enough baseline history, the
    # window_sum and the baseline mean are both ~constant, so ratio ~= 1.0.
    obs = _weekly_series(date(2024, 1, 1), 60, 100.0)
    result = mod.compute_supply_pressure(obs, min_baseline_samples=40)
    assert len(result) > 0
    # Some observations should clear the threshold; their value should be exactly 1.0.
    final = result[-1]
    assert final["value"] == pytest.approx(1.0, rel=1e-3)


def test_compute_supply_pressure_doubling_late_value_raises_ratio():
    # 60 weeks of 100, then 5 weeks of 200. The recent 30-day window sums are
    # dominated by 200s, but the trailing-year baseline still averages mostly 100s.
    obs = _weekly_series(date(2024, 1, 1), 60, 100.0)
    obs.extend([
        {"date": (date(2024, 1, 1) + timedelta(weeks=60 + i)).isoformat(), "value": 200.0}
        for i in range(5)
    ])
    result = mod.compute_supply_pressure(obs, min_baseline_samples=40)
    final = result[-1]
    # Recent window is mostly 200, baseline is mostly 100, so ratio should be > 1.
    assert final["value"] > 1.0


def test_compute_supply_pressure_output_shape():
    obs = _weekly_series(date(2024, 1, 1), 60, 100.0)
    result = mod.compute_supply_pressure(obs, min_baseline_samples=40)
    for point in result:
        assert set(point.keys()) == {"date", "value", "window_sum"}
        assert isinstance(point["date"], str)
        assert isinstance(point["value"], float)
        assert isinstance(point["window_sum"], float)


def test_compute_supply_pressure_sorts_output_ascending():
    obs = _weekly_series(date(2024, 1, 1), 60, 100.0)
    result = mod.compute_supply_pressure(obs, min_baseline_samples=40)
    dates = [r["date"] for r in result]
    assert dates == sorted(dates)


def test_compute_supply_pressure_skips_zero_baseline():
    # All zeros — baseline mean = 0, should skip.
    obs = _weekly_series(date(2024, 1, 1), 60, 0.0)
    result = mod.compute_supply_pressure(obs, min_baseline_samples=40)
    assert result == []
