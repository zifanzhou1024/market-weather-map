"""Tests for the next-phase volatility dashboard transform."""
from __future__ import annotations

from scripts.transform import build_volatility_dashboard


def _vix_observation(date: str, value: float) -> dict[str, float | str]:
    return {"date": date, "value": value}


def _series(observations: list[dict[str, float | str]]) -> dict[str, list[dict[str, float | str]]]:
    return {"observations": observations, "frequency": "daily"}


def _ratio_series(observations: list[dict[str, float | str]]) -> dict[str, object]:
    return {
        "observations": observations,
        "frequency": "daily",
        "depends_on": [],
        "method": "test",
    }


def _build_long_series(start_value: float, n_days: int = 1300) -> list[dict[str, float | str]]:
    """Generate a long deterministic series so 5-year percentiles converge."""
    from datetime import date, timedelta

    start = date(2022, 1, 3)
    obs = []
    for i in range(n_days):
        d = start + timedelta(days=i)
        # weekday only
        if d.weekday() >= 5:
            continue
        obs.append({"date": d.isoformat(), "value": start_value + (i * 0.001)})
    return obs


def test_output_structure_carries_top_level_metadata():
    vix = _series(_build_long_series(15.0))
    vix9d = _series(_build_long_series(14.0))
    vix3m = _series(_build_long_series(16.0))
    vvix = _series(_build_long_series(85.0))
    ratio_9d_vix = _ratio_series(
        [{"date": obs["date"], "value": 0.95} for obs in vix["observations"]]
    )
    ratio_vix_3m = _ratio_series(
        [{"date": obs["date"], "value": 0.94} for obs in vix["observations"]]
    )

    result = build_volatility_dashboard.build_volatility_dashboard(
        vix=vix,
        vix9d=vix9d,
        vix3m=vix3m,
        vvix=vvix,
        vix9d_vix_ratio=ratio_9d_vix,
        vix_vix3m_ratio=ratio_vix_3m,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    assert result["generated_at_utc"] == "2026-05-10T09:30:00Z"
    assert result["method_version"].startswith("phase8-pr1-volatility-dashboard")
    assert "date" in result
    assert "latest_curve" in result
    assert "ratio_history" in result
    assert "hidden_stress" in result
    assert "thresholds" in result


def test_latest_curve_has_exactly_three_tenors_with_expected_enum():
    vix = _series(_build_long_series(15.0))
    vix9d = _series(_build_long_series(14.0))
    vix3m = _series(_build_long_series(16.0))
    vvix = _series(_build_long_series(85.0))
    ratio_9d_vix = _ratio_series(
        [{"date": obs["date"], "value": 0.95} for obs in vix["observations"]]
    )
    ratio_vix_3m = _ratio_series(
        [{"date": obs["date"], "value": 0.94} for obs in vix["observations"]]
    )

    result = build_volatility_dashboard.build_volatility_dashboard(
        vix=vix,
        vix9d=vix9d,
        vix3m=vix3m,
        vvix=vvix,
        vix9d_vix_ratio=ratio_9d_vix,
        vix_vix3m_ratio=ratio_vix_3m,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    curve = result["latest_curve"]
    assert len(curve) == 3
    tenors = [point["tenor"] for point in curve]
    assert tenors == ["9D", "30D", "3M"]
    for point in curve:
        assert isinstance(point["value"], float)
        assert 0 <= point["percentile_5y"] <= 100


def test_thresholds_block_is_complete():
    vix = _series(_build_long_series(15.0))
    vix9d = _series(_build_long_series(14.0))
    vix3m = _series(_build_long_series(16.0))
    vvix = _series(_build_long_series(85.0))
    ratio_9d_vix = _ratio_series(
        [{"date": obs["date"], "value": 0.95} for obs in vix["observations"]]
    )
    ratio_vix_3m = _ratio_series(
        [{"date": obs["date"], "value": 0.94} for obs in vix["observations"]]
    )

    result = build_volatility_dashboard.build_volatility_dashboard(
        vix=vix,
        vix9d=vix9d,
        vix3m=vix3m,
        vvix=vvix,
        vix9d_vix_ratio=ratio_9d_vix,
        vix_vix3m_ratio=ratio_vix_3m,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    thresholds = result["thresholds"]
    expected_keys = {
        "vix9d_vix_calm",
        "vix9d_vix_stress",
        "vix_vix3m_calm",
        "vix_vix3m_stress",
        "hidden_stress_watch",
        "hidden_stress_elevated",
    }
    assert set(thresholds.keys()) == expected_keys
    for key in expected_keys:
        assert isinstance(thresholds[key], int | float)


def test_hidden_stress_state_matches_threshold_logic():
    """Build a series where the latest day has VVIX percentile 80 and VIX
    percentile 30 -> hidden_stress_score = 50, which exceeds the elevated
    threshold (30). state must be 'elevated'."""
    from datetime import date, timedelta

    start = date(2022, 1, 3)
    days = []
    for i in range(1300):
        d = start + timedelta(days=i)
        if d.weekday() < 5:
            days.append(d.isoformat())

    # Construct VIX values: most are at 14 (low), but the latest 200 days
    # are at varying low values. VVIX values: most are at 80, latest at 95.
    # 5-year window will rank latest as low percentile for VIX, high for VVIX.
    vix_obs = []
    for i, d in enumerate(days):
        # Make a wide distribution; latest few values are below the 5y median
        value = 12.0 + ((i * 7) % 30)
        if i == len(days) - 1:
            value = 11.0  # very low percentile
        vix_obs.append({"date": d, "value": value})

    vvix_obs = []
    for i, d in enumerate(days):
        value = 70.0 + ((i * 11) % 50)
        if i == len(days) - 1:
            value = 130.0  # very high percentile
        vvix_obs.append({"date": d, "value": value})

    vix9d_obs = [{"date": d, "value": 13.0} for d in days]
    vix3m_obs = [{"date": d, "value": 17.0} for d in days]
    ratio_9d_vix = [{"date": d, "value": 0.95} for d in days]
    ratio_vix_3m = [{"date": d, "value": 0.94} for d in days]

    result = build_volatility_dashboard.build_volatility_dashboard(
        vix=_series(vix_obs),
        vix9d=_series(vix9d_obs),
        vix3m=_series(vix3m_obs),
        vvix=_series(vvix_obs),
        vix9d_vix_ratio=_ratio_series(ratio_9d_vix),
        vix_vix3m_ratio=_ratio_series(ratio_vix_3m),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    hidden = result["hidden_stress"]
    assert hidden, "hidden_stress must be non-empty"
    latest = hidden[-1]
    # latest VIX value 11 should sit very low; latest VVIX value 130 should
    # sit very high; difference -> elevated.
    assert latest["vix_percentile"] < 50
    assert latest["vvix_percentile"] > 50
    assert latest["hidden_stress_score"] > 0
    assert latest["state"] in {"watch", "elevated"}


def test_hidden_stress_state_calm_when_score_below_watch():
    """Flat constant series -> latest sits near median percentile -> score ~0
    -> state == 'calm'."""
    from datetime import date, timedelta

    start = date(2022, 1, 3)
    days = []
    for i in range(1300):
        d = start + timedelta(days=i)
        if d.weekday() < 5:
            days.append(d.isoformat())

    vix_obs = [{"date": d, "value": 15.0} for d in days]
    vvix_obs = [{"date": d, "value": 85.0} for d in days]
    vix9d_obs = [{"date": d, "value": 14.0} for d in days]
    vix3m_obs = [{"date": d, "value": 17.0} for d in days]
    ratio_9d_vix = [{"date": d, "value": 0.95} for d in days]
    ratio_vix_3m = [{"date": d, "value": 0.94} for d in days]

    result = build_volatility_dashboard.build_volatility_dashboard(
        vix=_series(vix_obs),
        vix9d=_series(vix9d_obs),
        vix3m=_series(vix3m_obs),
        vvix=_series(vvix_obs),
        vix9d_vix_ratio=_ratio_series(ratio_9d_vix),
        vix_vix3m_ratio=_ratio_series(ratio_vix_3m),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    latest = result["hidden_stress"][-1]
    assert latest["state"] == "calm"
    assert -1 <= latest["hidden_stress_score"] <= 1


def test_5_year_rolling_percentile_is_bounded_0_100():
    from datetime import date, timedelta

    start = date(2018, 1, 3)
    days = []
    for i in range(2000):
        d = start + timedelta(days=i)
        if d.weekday() < 5:
            days.append(d.isoformat())

    vix_obs = [{"date": d, "value": 12.0 + ((i * 17) % 50)} for i, d in enumerate(days)]
    vvix_obs = [{"date": d, "value": 70.0 + ((i * 13) % 80)} for i, d in enumerate(days)]
    vix9d_obs = [{"date": d, "value": 14.0} for d in days]
    vix3m_obs = [{"date": d, "value": 17.0} for d in days]
    ratio_9d_vix = [{"date": d, "value": 0.95} for d in days]
    ratio_vix_3m = [{"date": d, "value": 0.94} for d in days]

    result = build_volatility_dashboard.build_volatility_dashboard(
        vix=_series(vix_obs),
        vix9d=_series(vix9d_obs),
        vix3m=_series(vix3m_obs),
        vvix=_series(vvix_obs),
        vix9d_vix_ratio=_ratio_series(ratio_9d_vix),
        vix_vix3m_ratio=_ratio_series(ratio_vix_3m),
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    for point in result["latest_curve"]:
        assert 0.0 <= point["percentile_5y"] <= 100.0
    for point in result["hidden_stress"]:
        assert 0.0 <= point["vix_percentile"] <= 100.0
        assert 0.0 <= point["vvix_percentile"] <= 100.0


def test_ratio_history_is_aligned_and_non_empty():
    vix = _series(_build_long_series(15.0))
    vix9d = _series(_build_long_series(14.0))
    vix3m = _series(_build_long_series(16.0))
    vvix = _series(_build_long_series(85.0))

    ratio_9d_vix = _ratio_series(
        [{"date": obs["date"], "value": 0.97} for obs in vix["observations"]]
    )
    ratio_vix_3m = _ratio_series(
        [{"date": obs["date"], "value": 0.98} for obs in vix["observations"]]
    )

    result = build_volatility_dashboard.build_volatility_dashboard(
        vix=vix,
        vix9d=vix9d,
        vix3m=vix3m,
        vvix=vvix,
        vix9d_vix_ratio=ratio_9d_vix,
        vix_vix3m_ratio=ratio_vix_3m,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    assert result["ratio_history"], "ratio_history must be non-empty"
    for entry in result["ratio_history"]:
        assert isinstance(entry["date"], str)
        assert isinstance(entry["vix9d_vix"], float)
        assert isinstance(entry["vix_vix3m"], float)
