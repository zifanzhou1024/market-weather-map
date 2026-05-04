from scripts.transform import compute_regime_score
from scripts.transform import compute_percentiles
from scripts.transform.compute_percentiles import (
    change_offsets,
    enrich_observations,
    percentile_rank,
    series_summary,
)
from scripts.transform.compute_regime_score import (
    _status_for_series,
    build_matched_spread,
    clamp,
    score_commodities,
    score_credit,
    score_sentiment,
    weighted_score,
)


def test_percentile_rank_returns_0_to_100_rank():
    assert percentile_rank([1, 2, 3, 4], 3) == 75.0


def test_series_summary_calculates_latest_value_and_changes():
    observations = [
        {"date": "2026-04-24", "value": 10.0},
        {"date": "2026-04-27", "value": 11.0},
        {"date": "2026-04-28", "value": 13.0},
        {"date": "2026-04-29", "value": 14.0},
        {"date": "2026-04-30", "value": 16.0},
        {"date": "2026-05-01", "value": 19.0},
    ]

    summary = series_summary(observations)

    assert summary["latest_date"] == "2026-05-01"
    assert summary["latest_value"] == 19.0
    assert summary["change_1d"] == 3.0
    assert summary["change_1w"] == 9.0


def test_series_summary_weekly_uses_weekly_offsets():
    observations = [
        {"date": "2026-04-03", "value": 100.0},
        {"date": "2026-04-10", "value": 110.0},
        {"date": "2026-04-17", "value": 130.0},
        {"date": "2026-04-24", "value": 160.0},
        {"date": "2026-05-01", "value": 200.0},
    ]

    summary = series_summary(observations, frequency="weekly")

    assert summary["change_1d"] == 40.0
    assert summary["change_1w"] == 40.0
    assert summary["change_1m"] == 100.0


def test_series_summary_daily_preserves_daily_offsets():
    observations = [
        {"date": f"2026-04-{day:02d}", "value": float(day)}
        for day in range(1, 23)
    ]

    summary = series_summary(observations, frequency="daily")

    assert summary["change_1d"] == 1.0
    assert summary["change_1w"] == 5.0
    assert summary["change_1m"] == 21.0


def test_monthly_change_offsets_use_observation_steps():
    assert change_offsets("monthly") == {"change_1d": 1, "change_1w": 1, "change_1m": 1}


def test_percentile_window_for_frequency_uses_annual_observation_counts():
    assert compute_percentiles.percentile_window_for_frequency("daily") == 252
    assert compute_percentiles.percentile_window_for_frequency("weekly") == 52
    assert compute_percentiles.percentile_window_for_frequency("monthly") == 12


def test_monthly_percentile_uses_trailing_12_observations_for_annual_window():
    observations = [
        {"date": f"2024-{month:02d}-01", "value": float(month)}
        for month in range(1, 13)
    ] + [
        {"date": f"2025-{month:02d}-01", "value": float(value)}
        for month, value in enumerate(list(range(13, 24)) + [13], start=1)
    ]

    enriched = enrich_observations(observations, frequency="monthly")
    summary = series_summary(enriched, frequency="monthly")

    assert enriched[-1]["percentile_252d"] == 16.67
    assert summary["percentile_252d"] == 16.67


def test_clamp_bounds_scores_to_minus_100_and_100():
    assert clamp(125) == 100.0
    assert clamp(-125) == -100.0
    assert clamp(42.25) == 42.25


def test_weighted_score_combines_bucket_values():
    scores = {"volatility": 20.0, "rates": -10.0, "credit": 30.0}
    weights = {"volatility": 0.5, "rates": 0.25, "credit": 0.25}

    assert weighted_score(scores, weights) == 15.0


def test_score_credit_uses_financial_stress_and_conditions_series():
    series = {
        "financial_stress": {"summary": {"percentile_252d": 80.0}},
        "financial_conditions": {"summary": {"percentile_252d": 60.0}},
        "high_yield_oas": {"summary": {"percentile_252d": 1.0}},
        "investment_grade_oas": {"summary": {"percentile_252d": 1.0}},
    }

    assert score_credit(series) == -42.0


def test_score_commodities_uses_planned_oil_and_crop_weights():
    series = {
        "wti_crude": {"summary": {"percentile_252d": 90}},
        "brent_crude": {"summary": {"percentile_252d": 80}},
        "corn_price": {"summary": {"percentile_252d": 75}},
        "wheat_price": {"summary": {"percentile_252d": 60}},
        "soybean_price": {"summary": {"percentile_252d": 50}},
    }

    assert score_commodities(series) == -53.67


def test_score_sentiment_penalizes_leveraged_money_crowding():
    crowded = {
        "cftc_sp500_asset_mgr_net": {"summary": {"percentile_252d": 60}},
        "cftc_sp500_lev_money_net": {"summary": {"percentile_252d": 95}},
    }

    underexposed = {
        "cftc_sp500_asset_mgr_net": {"summary": {"percentile_252d": 20}},
        "cftc_sp500_lev_money_net": {"summary": {"percentile_252d": 10}},
    }

    assert score_sentiment(crowded) < 0
    assert score_sentiment(underexposed) > score_sentiment(crowded)


def test_build_matched_spread_uses_source_frequency_for_summary(monkeypatch):
    source_series = {
        "left_monthly": {
            "frequency": "monthly",
            "observations": [
                {"date": f"2026-{month:02d}-01", "value": float(month)}
                for month in range(1, 6)
            ],
        },
        "right_monthly": {
            "frequency": "monthly",
            "observations": [
                {"date": f"2026-{month:02d}-01", "value": 1.0}
                for month in range(1, 6)
            ],
        },
    }

    monkeypatch.setattr(compute_regime_score, "load_series", source_series.__getitem__)

    spread = build_matched_spread(
        "left_monthly",
        "right_monthly",
        "monthly_spread",
        "2026-05-03T00:00:00Z",
        "index",
        "Left minus right.",
    )

    assert spread["summary"]["change_1m"] == 1.0


def test_status_for_series_marks_future_observations_failed():
    entry = {
        "id": "future_series",
        "source": "Test",
        "frequency": "daily",
        "max_stale_days": 7,
    }
    series = {"summary": {"latest_date": "2026-05-04"}}

    status = _status_for_series(entry, series, "2026-05-03T12:00:00Z")

    assert status["status"] == "failed"
    assert status["freshness_days"] == -1
    assert "future-dated" in status["message"]
