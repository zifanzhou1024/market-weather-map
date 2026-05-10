"""Regression tests for the regime quadrant lookback fix.

The old ``_build_quadrant_trail`` in ``scripts/transform/compute_regime_score.py``
computed sequential daily deltas (``value[T] - value[T-1]``) and sliced
``[-20:]``. The chart label said "20-observation change," so the displayed
trail was wrong relative to the label. The fix is to use a true 20-day
lookback (``value[T] - value[T-20]``) for each point and add a deprecation
note that consumers should prefer ``regime_dashboard.json windows.20D``.
"""
from __future__ import annotations

from datetime import date, timedelta

from scripts.transform import compute_regime_score


def _calendar_business_days(n: int, start: str = "2024-01-02") -> list[str]:
    current = date.fromisoformat(start)
    days = []
    while len(days) < n:
        if current.weekday() < 5:
            days.append(current.isoformat())
        current += timedelta(days=1)
    return days


def _series_from_values(days: list[str], values: list[float]) -> dict[str, object]:
    return {
        "observations": [
            {"date": d, "value": v} for d, v in zip(days, values, strict=False)
        ]
    }


def test_quadrant_trail_uses_true_20_day_lookback_for_real_yield():
    """Build a deterministic real_yield series with monotone increment +1
    per business day. value[T] - value[T-20] must therefore equal exactly 20.
    The old sequential implementation would have produced 1, not 20."""
    n = 60
    days = _calendar_business_days(n)
    real_yield_values = [float(i) for i in range(n)]
    real_yield = _series_from_values(days, real_yield_values)

    # Provide consistent dollar / nominal series so the function returns
    # without short-circuiting.
    dollar = _series_from_values(days, [100.0 + i * 0.1 for i in range(n)])
    us10y = _series_from_values(days, [4.0 + i * 0.001 for i in range(n)])

    series_by_id = {
        "real_yield_10y": real_yield,
        "broad_dollar": dollar,
        "us10y": us10y,
        "vix": {"observations": [{"date": d, "percentile_252d": 50.0} for d in days]},
        "high_yield_oas": _series_from_values(days, [350.0 + i for i in range(n)]),
    }

    trail = compute_regime_score._build_quadrant_trail(series_by_id)
    assert trail, "trail must not be empty"

    # Each point is a 20-business-day lookback.
    for point in trail:
        d = point["date"]
        idx = days.index(d)
        if idx < 20:
            # Points without 20 observations of history shouldn't appear.
            raise AssertionError(
                f"trail point at {d} has idx {idx} < 20; pre-fix sequential "
                f"behaviour would have placed it here"
            )
        expected_change = real_yield_values[idx] - real_yield_values[idx - 20]
        assert point["real_yield_change"] == round(expected_change, 4), (
            f"point {d} real_yield_change={point['real_yield_change']} "
            f"expected {round(expected_change, 4)} (true 20D lookback). "
            f"Sequential daily delta would have been 1.0."
        )


def test_quadrant_trail_does_not_use_sequential_delta_of_one():
    """Same fixture, but explicitly check the values are NOT 1 (sequential)."""
    n = 60
    days = _calendar_business_days(n)
    real_yield_values = [float(i) for i in range(n)]
    real_yield = _series_from_values(days, real_yield_values)
    dollar = _series_from_values(days, [100.0 + i * 0.1 for i in range(n)])
    us10y = _series_from_values(days, [4.0 + i * 0.001 for i in range(n)])

    series_by_id = {
        "real_yield_10y": real_yield,
        "broad_dollar": dollar,
        "us10y": us10y,
        "vix": {"observations": [{"date": d, "percentile_252d": 50.0} for d in days]},
        "high_yield_oas": _series_from_values(days, [350.0 + i for i in range(n)]),
    }

    trail = compute_regime_score._build_quadrant_trail(series_by_id)
    real_yield_changes = [point["real_yield_change"] for point in trail]
    # Every change should be 20, NOT 1, given the +1/day series.
    for change in real_yield_changes:
        assert change != 1.0, (
            "real_yield_change == 1.0 indicates the sequential delta bug is back"
        )


def test_quadrant_trail_adds_deprecation_note_via_doc_or_constant():
    """The fix is documented in source. We assert the file mentions
    'regime_dashboard.json' so consumers know where the canonical view is."""
    import inspect

    source = inspect.getsource(compute_regime_score._build_quadrant_trail)
    assert "regime_dashboard" in source.lower() or "deprecated" in source.lower(), (
        "_build_quadrant_trail should reference the new regime_dashboard.json "
        "as the canonical source"
    )
