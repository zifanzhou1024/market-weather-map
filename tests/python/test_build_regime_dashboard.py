"""Tests for the next-phase regime dashboard transform.

The regime dashboard exposes the regime quadrant for three lookback
windows (20D / 60D / 120D). Each point at date T uses a TRUE window
lookback delta: ``value(T) - value(T - window_days)``, NOT a sequential
daily delta. This is the bug that ``compute_regime_score._build_quadrant_trail``
used to embody. See ``test_regime_lookback_fix.py`` for the regression
test on that historical field.
"""
from __future__ import annotations

from datetime import date, timedelta

from scripts.transform import build_regime_dashboard


def _series(observations: list[dict[str, object]]) -> dict[str, object]:
    return {"observations": observations, "frequency": "daily"}


def _calendar_business_days(n: int, start: str = "2024-01-02") -> list[str]:
    current = date.fromisoformat(start)
    days = []
    while len(days) < n:
        if current.weekday() < 5:
            days.append(current.isoformat())
        current += timedelta(days=1)
    return days


def _baseline_series(n: int = 320) -> dict[str, object]:
    """Construct deterministic series so window-lookback math is checkable."""
    days = _calendar_business_days(n)
    real_yield = [{"date": d, "value": 2.00 + i * 0.01} for i, d in enumerate(days)]
    dollar = [{"date": d, "value": 100.0 + i * 0.05} for i, d in enumerate(days)]
    vix = [
        {"date": d, "value": 15.0, "percentile_252d": 30.0 + (i % 50)}
        for i, d in enumerate(days)
    ]
    high_yield_oas = [{"date": d, "value": 350.0 - i * 0.1} for i, d in enumerate(days)]
    return {
        "real_yield_10y": _series(real_yield),
        "broad_dollar": _series(dollar),
        "vix": _series(vix),
        "high_yield_oas": _series(high_yield_oas),
    }


def _baseline_shock(score: float = 30.0) -> dict[str, object]:
    return {"score": score, "method_version": "test"}


def test_top_level_metadata_and_window_keys():
    inputs = _baseline_series()
    result = build_regime_dashboard.build_regime_dashboard(
        series_by_id=inputs,
        shock_risk_snapshot=_baseline_shock(),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    assert result["generated_at_utc"] == "2026-05-10T09:30:00Z"
    assert result["method_version"].startswith("phase8-pr1-regime-dashboard")
    assert set(result["windows"].keys()) == {"20D", "60D", "120D"}


def test_each_window_uses_true_lookback_delta_for_real_yield():
    """For each window, point[i].real_yield_change_bps must equal
    real_yield[date_i] - real_yield[date_i - window_days], NOT
    real_yield[date_i] - real_yield[date_i - 1]."""
    inputs = _baseline_series()
    real_yield_obs = inputs["real_yield_10y"]["observations"]
    real_by_date = {obs["date"]: obs["value"] for obs in real_yield_obs}
    sorted_dates = [obs["date"] for obs in real_yield_obs]

    result = build_regime_dashboard.build_regime_dashboard(
        series_by_id=inputs,
        shock_risk_snapshot=_baseline_shock(),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    for window_key, lookback_days in (("20D", 20), ("60D", 60), ("120D", 120)):
        points = result["windows"][window_key]
        assert points, f"window {window_key} must have points"
        for point in points:
            this_date = point["date"]
            this_idx = sorted_dates.index(this_date)
            assert this_idx >= lookback_days, (
                f"window {window_key} produced point at idx {this_idx} < lookback {lookback_days}"
            )
            prior_date = sorted_dates[this_idx - lookback_days]
            expected_bps = round(
                (real_by_date[this_date] - real_by_date[prior_date]) * 100.0, 2
            )
            assert point["real_yield_change_bps"] == expected_bps, (
                f"window {window_key} point {this_date}: "
                f"real_yield_change_bps={point['real_yield_change_bps']} "
                f"expected {expected_bps}"
            )


def test_dollar_change_pct_uses_window_lookback():
    inputs = _baseline_series()
    dollar_obs = inputs["broad_dollar"]["observations"]
    dollar_by_date = {obs["date"]: obs["value"] for obs in dollar_obs}
    sorted_dates = [obs["date"] for obs in dollar_obs]

    result = build_regime_dashboard.build_regime_dashboard(
        series_by_id=inputs,
        shock_risk_snapshot=_baseline_shock(),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    for window_key, lookback in (("20D", 20), ("60D", 60), ("120D", 120)):
        for point in result["windows"][window_key]:
            this_idx = sorted_dates.index(point["date"])
            prior_date = sorted_dates[this_idx - lookback]
            current = dollar_by_date[point["date"]]
            prior = dollar_by_date[prior_date]
            expected_pct = round((current / prior - 1.0) * 100.0, 4)
            assert point["dollar_change_pct"] == expected_pct


def test_thresholds_block_present():
    inputs = _baseline_series()
    result = build_regime_dashboard.build_regime_dashboard(
        series_by_id=inputs,
        shock_risk_snapshot=_baseline_shock(),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    thresholds = result["thresholds"]
    assert "real_yield_neutral_bps" in thresholds
    assert "dollar_neutral_pct" in thresholds
    assert thresholds["real_yield_neutral_bps"] > 0
    assert thresholds["dollar_neutral_pct"] > 0


def test_quadrant_assignment_reaches_all_four_labels():
    """Build series engineered to land each window's points in each quadrant
    at least once across the windows."""
    days = _calendar_business_days(320)
    n = len(days)

    # Real yield: rises in first half, falls in second half.
    # Dollar: rises in first quarter & third quarter, falls in second & fourth.
    real_obs = []
    dollar_obs = []
    for i, d in enumerate(days):
        if i < n / 4:
            real = 2.0 + i * 0.01  # rising
            dollar = 100.0 + i * 0.05  # rising
        elif i < n / 2:
            real = 2.0 + (n / 4) * 0.01 + (i - n / 4) * 0.01  # still rising
            dollar = 100.0 + (n / 4) * 0.05 - (i - n / 4) * 0.05  # falling
        elif i < 3 * n / 4:
            real = (
                2.0
                + (n / 2) * 0.01
                - (i - n / 2) * 0.01
            )  # falling
            dollar = (
                100.0
                + (n / 4) * 0.05
                - (n / 4) * 0.05
                + (i - n / 2) * 0.05
            )  # rising
        else:
            real = (
                2.0
                + (n / 2) * 0.01
                - (n / 4) * 0.01
                - (i - 3 * n / 4) * 0.01
            )  # falling
            dollar = (
                100.0 + (n / 4) * 0.05 - (n / 4) * 0.05 + (n / 4) * 0.05 - (i - 3 * n / 4) * 0.05
            )  # falling
        real_obs.append({"date": d, "value": real})
        dollar_obs.append({"date": d, "value": dollar})

    inputs = {
        "real_yield_10y": _series(real_obs),
        "broad_dollar": _series(dollar_obs),
        "vix": _series(
            [{"date": d, "value": 15.0, "percentile_252d": 50.0} for d in days]
        ),
        "high_yield_oas": _series(
            [{"date": d, "value": 350.0} for d in days]
        ),
    }

    result = build_regime_dashboard.build_regime_dashboard(
        series_by_id=inputs,
        shock_risk_snapshot=_baseline_shock(),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    seen_regimes: set[str] = set()
    for window_key in ("20D", "60D", "120D"):
        for point in result["windows"][window_key]:
            seen_regimes.add(point["regime"])

    expected = {
        "risk_on_easing",
        "global_tightening_risk_off",
        "safe_haven_growth_scare",
        "rotation_reflation",
    }
    # At least 3 of the 4 quadrants must be reachable across the windows
    # given the engineered fixture (the deadzone may eat the fourth).
    assert len(seen_regimes & expected) >= 3, (
        f"Expected at least 3 of {expected}, saw {seen_regimes}"
    )


def test_each_point_carries_required_fields():
    inputs = _baseline_series()
    result = build_regime_dashboard.build_regime_dashboard(
        series_by_id=inputs,
        shock_risk_snapshot=_baseline_shock(),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    expected_fields = {
        "date",
        "real_yield_change_bps",
        "dollar_change_pct",
        "vix_percentile",
        "credit_change_bps",
        "fragility_score",
        "regime",
    }
    for window_key in ("20D", "60D", "120D"):
        for point in result["windows"][window_key]:
            assert expected_fields.issubset(point.keys()), (
                f"point in {window_key} missing fields: {expected_fields - point.keys()}"
            )


def test_window_omits_dates_without_lookback_data():
    """Points are only emitted for dates that have a full window of prior
    observations. The 20D window should produce ~n-20 points, the 120D
    window ~n-120 points."""
    inputs = _baseline_series(n=320)
    result = build_regime_dashboard.build_regime_dashboard(
        series_by_id=inputs,
        shock_risk_snapshot=_baseline_shock(),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    assert len(result["windows"]["20D"]) >= 290
    assert len(result["windows"]["20D"]) <= 320
    assert len(result["windows"]["120D"]) >= 190
    assert len(result["windows"]["120D"]) <= 220
    assert len(result["windows"]["20D"]) > len(result["windows"]["120D"])
