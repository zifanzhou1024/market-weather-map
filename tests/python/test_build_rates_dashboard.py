"""Tests for the next-phase rates dashboard transform.

The rates dashboard pre-computes:
- ``yield_change_windows`` per (1M / 3M / 6M / 1Y) horizon, in basis points,
  with a derived ``driver`` enum (real_yield / breakeven / balanced).
- ``current_decomposition`` (latest 10Y nominal vs real vs breakeven), in
  percent.
- ``curve_snapshots`` for 2Y / 10Y / 20Y / 30Y at four historical dates.
- ``decomposition_history`` daily series for the secondary chart.
"""
from __future__ import annotations

from datetime import date, timedelta

from scripts.transform import build_rates_dashboard


def _series(observations: list[dict[str, float | str]]) -> dict[str, object]:
    return {"observations": observations, "frequency": "daily"}


def _linear_observations(
    start_value: float,
    daily_increment: float,
    n_business_days: int = 600,
    start_date: str = "2024-01-02",
) -> list[dict[str, float | str]]:
    """Generate a daily series with a constant per-day increment for
    deterministic windowed-change asserts."""
    current = date.fromisoformat(start_date)
    obs = []
    i = 0
    while len(obs) < n_business_days:
        if current.weekday() < 5:
            obs.append(
                {"date": current.isoformat(), "value": round(start_value + i * daily_increment, 6)}
            )
            i += 1
        current += timedelta(days=1)
    return obs


def _baseline_inputs() -> dict[str, object]:
    """Construct a deterministic fixture with linear daily yield growth so
    that windowed bps changes are exactly predictable."""
    nominal_10y = _linear_observations(start_value=4.00, daily_increment=0.001)
    real_10y = _linear_observations(start_value=2.00, daily_increment=0.001)
    breakeven_10y = _linear_observations(start_value=2.00, daily_increment=0.000)
    nominal_2y = _linear_observations(start_value=4.50, daily_increment=0.001)
    nominal_20y = _linear_observations(start_value=4.20, daily_increment=0.001)
    nominal_30y = _linear_observations(start_value=4.30, daily_increment=0.001)

    return {
        "us2y": _series(nominal_2y),
        "us10y": _series(nominal_10y),
        "us20y": _series(nominal_20y),
        "us30y": _series(nominal_30y),
        "real_yield_10y": _series(real_10y),
        "breakeven_10y": _series(breakeven_10y),
        "generated_at_utc": "2026-05-10T09:30:00Z",
    }


def test_top_level_metadata_and_method_version():
    result = build_rates_dashboard.build_rates_dashboard(**_baseline_inputs())

    assert result["generated_at_utc"] == "2026-05-10T09:30:00Z"
    assert result["method_version"].startswith("phase8-pr1-rates-dashboard")
    assert isinstance(result["date"], str)


def test_yield_change_windows_use_basis_points_not_percent():
    """Linear daily growth of +0.001 pct points / day means a 21-day window
    moves +0.021 pct = +2.1 bps. The dashboard must report bps."""
    result = build_rates_dashboard.build_rates_dashboard(**_baseline_inputs())

    one_month = result["yield_change_windows"]["1M"]
    # 21 business days * 0.001 pct/day = 0.021 pct = 2.1 bps
    assert 1.0 <= one_month["nominal_10y_bps"] <= 4.0


def test_driver_classification_real_yield_when_real_dominates():
    """Real yields rising 0.001/day and breakeven flat -> driver should be
    'real_yield' since |real bps| >> 1.5 * |breakeven bps|."""
    result = build_rates_dashboard.build_rates_dashboard(**_baseline_inputs())

    one_year = result["yield_change_windows"]["1Y"]
    assert one_year["driver"] == "real_yield"


def test_driver_classification_breakeven_when_breakeven_dominates():
    inputs = _baseline_inputs()
    # Make breakeven dominate: real flat, breakeven steady growth.
    inputs["real_yield_10y"] = _series(
        _linear_observations(start_value=2.00, daily_increment=0.0)
    )
    inputs["breakeven_10y"] = _series(
        _linear_observations(start_value=2.00, daily_increment=0.001)
    )
    # Sum nominal should match the inputs roughly so we keep the test honest.
    inputs["us10y"] = _series(
        _linear_observations(start_value=4.00, daily_increment=0.001)
    )

    result = build_rates_dashboard.build_rates_dashboard(**inputs)
    assert result["yield_change_windows"]["1Y"]["driver"] == "breakeven"


def test_driver_classification_balanced_when_neither_dominates():
    inputs = _baseline_inputs()
    inputs["real_yield_10y"] = _series(
        _linear_observations(start_value=2.00, daily_increment=0.001)
    )
    inputs["breakeven_10y"] = _series(
        _linear_observations(start_value=2.00, daily_increment=0.001)
    )
    inputs["us10y"] = _series(
        _linear_observations(start_value=4.00, daily_increment=0.002)
    )

    result = build_rates_dashboard.build_rates_dashboard(**inputs)
    assert result["yield_change_windows"]["1Y"]["driver"] == "balanced"


def test_current_decomposition_uses_percent_levels():
    result = build_rates_dashboard.build_rates_dashboard(**_baseline_inputs())

    decomp = result["current_decomposition"]
    # nominal ~4.00 + 0.001 * (n-1), final value around 4.00 + 0.6 = 4.6
    assert 4.0 <= decomp["nominal_10y_pct"] <= 5.0
    assert 2.0 <= decomp["real_yield_10y_pct"] <= 3.0


def test_curve_snapshots_carry_expected_tenors():
    result = build_rates_dashboard.build_rates_dashboard(**_baseline_inputs())

    snapshots = result["curve_snapshots"]
    assert "current" in snapshots
    assert "one_month_ago" in snapshots
    assert "three_months_ago" in snapshots
    assert "one_year_ago" in snapshots

    valid_tenors = {"2Y", "10Y", "20Y", "30Y"}
    for snapshot_key in ("current", "one_month_ago", "three_months_ago", "one_year_ago"):
        for point in snapshots[snapshot_key]:
            assert point["tenor"] in valid_tenors


def test_curve_snapshot_drops_missing_tenor_only_for_that_snapshot():
    """If 30Y data starts AFTER the 1-year-ago date, that snapshot must omit
    the 30Y tenor while keeping it for the current snapshot."""
    inputs = _baseline_inputs()
    # Replace us30y with a series that starts mid-fixture (no 1Y-ago data).
    short_30y = _linear_observations(
        start_value=4.30,
        daily_increment=0.001,
        n_business_days=200,
        start_date="2025-08-01",
    )
    inputs["us30y"] = _series(short_30y)

    result = build_rates_dashboard.build_rates_dashboard(**inputs)
    one_year = result["curve_snapshots"]["one_year_ago"]
    # 30Y series doesn't reach back a full year, so it must be omitted
    one_year_tenors = [point["tenor"] for point in one_year]
    assert "30Y" not in one_year_tenors
    # But must still appear in current
    current_tenors = [point["tenor"] for point in result["curve_snapshots"]["current"]]
    assert "30Y" in current_tenors


def test_decomposition_history_is_daily_series_of_three_components():
    result = build_rates_dashboard.build_rates_dashboard(**_baseline_inputs())

    history = result["decomposition_history"]
    assert history, "decomposition_history must be non-empty"
    for entry in history:
        assert "date" in entry
        assert "nominal_pct" in entry
        assert "real_pct" in entry
        assert "breakeven_pct" in entry


def test_yield_change_window_bps_are_finite_numbers():
    result = build_rates_dashboard.build_rates_dashboard(**_baseline_inputs())

    for window_key in ("1M", "3M", "6M", "1Y"):
        window = result["yield_change_windows"][window_key]
        for field in ("nominal_10y_bps", "real_yield_10y_bps", "breakeven_10y_bps"):
            value = window[field]
            assert isinstance(value, int | float)
            assert not (value != value)  # not NaN
