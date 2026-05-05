import json

import pytest

from scripts.transform import compute_regime_score
from scripts.transform import compute_percentiles
from scripts.validate import validate_freshness
from scripts.validate import validate_schema
from scripts.transform.compute_percentiles import (
    change_offsets,
    enrich_observations,
    percentile_rank,
    series_summary,
)
from scripts.transform.compute_regime_score import (
    _status_for_series,
    build_status,
    build_net_liquidity,
    build_matched_spread,
    clamp,
    score_commodities,
    score_credit,
    score_liquidity,
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


def test_series_summary_empty_includes_longer_horizon_changes():
    summary = series_summary([])

    assert summary["change_3m"] is None
    assert summary["change_12m"] is None


def test_series_summary_daily_longer_horizon_changes_use_trading_day_offsets():
    observations = [
        {
            "date": f"2025-{((index - 1) // 21) + 1:02d}-{((index - 1) % 21) + 1:02d}",
            "value": float(index),
        }
        for index in range(1, 211)
    ]

    summary = series_summary(observations, frequency="daily")

    assert summary["change_3m"] == 63.0
    assert summary["change_12m"] is None


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
    assert change_offsets("monthly") == {
        "change_1d": 1,
        "change_1w": 1,
        "change_1m": 1,
        "change_3m": 3,
        "change_12m": 12,
    }


def test_series_summary_monthly_longer_horizon_changes_use_month_offsets():
    observations = [
        {"date": f"2025-{month:02d}-01", "value": float(month)}
        for month in range(1, 13)
    ] + [{"date": "2026-01-01", "value": 20.0}]

    summary = series_summary(observations, frequency="monthly")

    assert summary["change_3m"] == 10.0
    assert summary["change_12m"] == 19.0


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


def test_build_ratio_series_matches_observations_by_date_and_summarizes_latest(monkeypatch):
    source_series = {
        "numerator": {
            "frequency": "daily",
            "observations": [
                {"date": "2026-05-01", "value": 12.0},
                {"date": "2026-05-02", "value": "missing"},
                {"date": "2026-05-03", "value": 15.0},
                {"date": "2026-05-04", "value": 20.0},
            ],
        },
        "denominator": {
            "frequency": "daily",
            "observations": [
                {"date": "2026-05-01", "value": 6.0},
                {"date": "2026-05-02", "value": 4.0},
                {"date": "2026-05-03", "value": 0.0},
                {"date": "2026-05-04", "value": 8.0},
            ],
        },
    }

    monkeypatch.setattr(compute_regime_score, "load_series", source_series.__getitem__)

    ratio = compute_regime_score.build_ratio_series(
        "numerator",
        "denominator",
        "numerator_denominator_ratio",
        "2026-05-04T12:00:00Z",
        "ratio",
        "Numerator divided by denominator.",
    )

    assert ratio["series_id"] == "numerator_denominator_ratio"
    assert ratio["source"] == "Derived"
    assert ratio["depends_on"] == ["numerator", "denominator"]
    assert ratio["method"] == "Numerator divided by denominator."
    assert [(item["date"], item["value"]) for item in ratio["observations"]] == [
        ("2026-05-01", 2.0),
        ("2026-05-04", 2.5),
    ]
    assert ratio["summary"]["latest_date"] == "2026-05-04"
    assert ratio["summary"]["latest_value"] == 2.5


def test_build_ratio_series_skips_non_finite_values_and_sorts_by_date(monkeypatch):
    source_series = {
        "numerator": {
            "frequency": "daily",
            "observations": [
                {"date": "2026-05-03", "value": 30.0},
                {"date": "2026-05-01", "value": 10.0},
                {"date": "2026-05-02", "value": float("nan")},
                {"date": "2026-05-04", "value": float("inf")},
                {"date": "2026-05-05", "value": True},
                {"date": "2026-05-06", "value": 12.0},
                {"date": "2026-05-07", "value": 14.0},
            ],
        },
        "denominator": {
            "frequency": "daily",
            "observations": [
                {"date": "2026-05-01", "value": 5.0},
                {"date": "2026-05-02", "value": 5.0},
                {"date": "2026-05-03", "value": 10.0},
                {"date": "2026-05-04", "value": 2.0},
                {"date": "2026-05-05", "value": 5.0},
                {"date": "2026-05-06", "value": float("-inf")},
                {"date": "2026-05-07", "value": "missing"},
                {"date": "2026-05-08", "value": 4.0},
            ],
        },
    }

    monkeypatch.setattr(compute_regime_score, "load_series", source_series.__getitem__)

    ratio = compute_regime_score.build_ratio_series(
        "numerator",
        "denominator",
        "finite_ratio",
        "2026-05-08T12:00:00Z",
        "ratio",
        "Finite ratio.",
    )

    assert [(item["date"], item["value"]) for item in ratio["observations"]] == [
        ("2026-05-01", 2.0),
        ("2026-05-03", 3.0),
    ]
    assert ratio["summary"]["latest_date"] == "2026-05-03"
    assert ratio["summary"]["latest_value"] == 3.0


def test_build_commodity_inflation_impulse_uses_momentum_for_negative_risk_score():
    series = {
        "wti_crude": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 100.0,
                "change_3m": 50.0,
                "change_12m": 80.0,
                "percentile_252d": 1.0,
            }
        },
        "brent_crude": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 110.0,
                "change_3m": 44.0,
                "change_12m": 55.0,
                "percentile_252d": 1.0,
            }
        },
        "corn_price": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 300.0,
                "change_3m": 90.0,
                "percentile_252d": 1.0,
            }
        },
        "wheat_price": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 400.0,
                "change_3m": 160.0,
                "percentile_252d": 1.0,
            }
        },
        "soybean_price": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 500.0,
                "change_3m": 125.0,
                "percentile_252d": 1.0,
            }
        },
        "breakeven_10y": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 2.8,
                "change_3m": 0.7,
                "percentile_252d": 1.0,
            }
        },
    }

    impulse = compute_regime_score.build_commodity_inflation_impulse(series, "2026-05-04T12:00:00Z")

    assert impulse["series_id"] == "commodity_inflation_impulse"
    assert impulse["value"] < 0
    assert impulse["summary"]["latest_value"] == impulse["value"]
    assert impulse["depends_on"] == [
        "wti_crude",
        "brent_crude",
        "corn_price",
        "wheat_price",
        "soybean_price",
        "breakeven_10y",
    ]
    assert "oil 3-month" in impulse["method"]


def test_build_commodity_inflation_impulse_reweights_only_valid_components():
    series = {
        "wti_crude": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 100.0,
                "change_3m": 50.0,
                "change_12m": None,
            }
        }
    }

    impulse = compute_regime_score.build_commodity_inflation_impulse(series, "2026-05-04T12:00:00Z")

    assert impulse["value"] == -100.0
    assert impulse["summary"]["latest_value"] == -100.0
    assert impulse["observations"] == [
        {"date": "2026-05-01", "value": -100.0, "percentile_252d": 100.0}
    ]


def test_build_commodity_inflation_impulse_has_no_fake_point_without_valid_components():
    series = {
        "wti_crude": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 100.0,
                "change_3m": None,
                "change_12m": None,
            }
        },
        "breakeven_10y": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": None,
                "change_3m": 0.25,
            }
        },
    }

    impulse = compute_regime_score.build_commodity_inflation_impulse(series, "2026-05-04T12:00:00Z")

    assert impulse["observations"] == []
    assert impulse["summary"] == series_summary([], "daily")
    assert impulse["summary"]["latest_value"] is None


def test_build_commodity_inflation_impulse_rejects_nonpositive_previous_values():
    series = {
        "wti_crude": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 50.0,
                "change_3m": 60.0,
            }
        },
        "brent_crude": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 40.0,
                "change_3m": 40.0,
            }
        },
    }

    impulse = compute_regime_score.build_commodity_inflation_impulse(series, "2026-05-04T12:00:00Z")

    assert impulse["observations"] == []
    assert impulse["summary"]["latest_value"] is None


def test_build_net_liquidity_uses_latest_risk_drains_on_or_before_fed_date():
    series = {
        "fed_assets": {
            "frequency": "weekly",
            "observations": [{"date": "2026-04-30", "value": 7000000.0}],
        },
        "treasury_general_account": {
            "observations": [{"date": "2026-04-29", "value": 800000.0}],
        },
        "reverse_repo": {
            "observations": [{"date": "2026-04-28", "value": 450.0}],
        },
    }

    payload = build_net_liquidity(series, "2026-05-03T00:00:00Z")

    assert payload["series_id"] == "net_liquidity"
    assert payload["observations"] == [{"date": "2026-04-30", "value": 5750000.0, "percentile_252d": 100.0}]


def test_score_liquidity_uses_net_liquidity_when_available():
    supportive = {
        "fed_assets": {"summary": {"latest_value": 7000000, "change_1m": 0}},
        "reverse_repo": {"summary": {"latest_value": 450, "change_1m": 0}},
        "sofr": {"summary": {"percentile_252d": 20}},
        "net_liquidity": {"summary": {"latest_value": 5750000, "change_1m": 100000}},
    }

    assert score_liquidity(supportive) > 0


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


def test_status_for_candidate_series_requires_terms_review_before_observations():
    entry = {
        "id": "candidate_series",
        "source": "Candidate Source",
        "frequency": "monthly",
        "max_stale_days": 45,
        "score_status": "candidate",
        "access_status": "terms_review_needed",
        "terms_status": "review_needed",
    }
    series = {"summary": {"latest_date": None}, "observations": []}

    status = _status_for_series(entry, series, "2026-05-04T00:00:00Z")

    assert status == {
        "status": "terms_review_needed",
        "last_observation": None,
        "observation_period": None,
        "source": "Candidate Source",
        "expected_frequency": "monthly",
        "freshness_days": None,
        "max_stale_days": 45,
        "expected_next_release_window": None,
        "message": "Candidate source requires access or terms review before scoring.",
    }


def test_status_for_unavailable_or_restricted_series_reports_unavailable_before_observations():
    entry = {
        "id": "restricted_series",
        "source": "Restricted Source",
        "frequency": "daily",
        "max_stale_days": 7,
        "access_status": "unavailable",
        "terms_status": "restricted",
    }
    series = {"summary": {"latest_date": None}, "observations": []}

    status = _status_for_series(entry, series, "2026-05-04T00:00:00Z")

    assert status["status"] == "unavailable"
    assert status["last_observation"] is None
    assert status["observation_period"] is None
    assert status["freshness_days"] is None
    assert status["expected_next_release_window"] is None
    assert status["message"] == "Source is unavailable for automated static ingestion."


def test_build_status_reports_source_governance_without_lowering_overall(monkeypatch):
    monkeypatch.setattr(compute_regime_score, "available_catalog_entries", lambda: [])
    monkeypatch.setattr(
        compute_regime_score,
        "catalog_entries",
        lambda: [
            {
                "id": "active_public",
                "source": "FRED",
                "frequency": "daily",
                "max_stale_days": 7,
                "score_status": "active",
                "public": True,
                "access_status": "free_public",
                "terms_status": "ok",
            },
            {
                "id": "candidate_series",
                "source": "Candidate Source",
                "frequency": "monthly",
                "max_stale_days": 45,
                "score_status": "candidate",
                "public": False,
                "access_status": "terms_review_needed",
                "terms_status": "review_needed",
            },
            {
                "id": "restricted_series",
                "source": "Restricted Source",
                "frequency": "daily",
                "max_stale_days": 7,
                "score_status": "candidate",
                "public": False,
                "access_status": "unavailable",
                "terms_status": "restricted",
            },
        ],
    )

    status = build_status(
        {"active_public": {"frequency": "daily", "summary": {"latest_date": "2026-05-03"}}},
        "2026-05-04T00:00:00Z",
    )

    assert status["overall_status"] == "ok"
    assert status["series"]["candidate_series"]["status"] == "terms_review_needed"
    assert status["series"]["restricted_series"]["status"] == "unavailable"


def test_build_status_reports_missing_active_public_payload_with_freshness_shape(monkeypatch):
    monkeypatch.setattr(compute_regime_score, "available_catalog_entries", lambda: [])
    monkeypatch.setattr(
        compute_regime_score,
        "catalog_entries",
        lambda: [
            {
                "id": "missing_active_public",
                "source": "FRED",
                "frequency": "daily",
                "max_stale_days": 7,
                "score_status": "active",
                "public": True,
                "access_status": "free_public",
                "terms_status": "ok",
            },
        ],
    )

    status = build_status({}, "2026-05-04T00:00:00Z")

    assert status["series"]["missing_active_public"] == {
        "status": "unavailable",
        "last_observation": None,
        "observation_period": None,
        "source": "FRED",
        "expected_frequency": "daily",
        "freshness_days": None,
        "max_stale_days": 7,
        "expected_next_release_window": None,
        "message": "Active public catalog series has no generated payload.",
    }


def test_build_status_includes_derived_series_rows(monkeypatch):
    generated_at = "2026-05-03T12:00:00Z"
    monkeypatch.setattr(compute_regime_score, "available_catalog_entries", lambda: [])
    series_by_id = {
        "us10y_minus_us2y": {
            "frequency": "daily",
            "summary": {"latest_date": "2026-05-01"},
        },
        "brent_wti_spread": {
            "frequency": "daily",
            "summary": {"latest_date": "2026-04-30"},
        },
        "net_liquidity": {
            "frequency": "weekly",
            "summary": {"latest_date": "2026-04-29"},
        },
    }

    status = build_status(series_by_id, generated_at)

    assert status["series"]["us10y_minus_us2y"] == {
        "status": "ok",
        "last_observation": "2026-05-01",
        "observation_period": "2026-05-01",
        "source": "Derived",
        "expected_frequency": "daily",
        "freshness_days": 2,
        "max_stale_days": 7,
        "expected_next_release_window": None,
        "message": "Latest daily observation is 2 days old.",
    }
    assert status["series"]["brent_wti_spread"]["source"] == "Derived"
    assert status["series"]["brent_wti_spread"]["max_stale_days"] == 10
    assert status["series"]["net_liquidity"]["source"] == "Derived"
    assert status["series"]["net_liquidity"]["expected_frequency"] == "weekly"
    assert status["series"]["net_liquidity"]["max_stale_days"] == 14


def _summary(
    latest_value=100.0,
    change_1m=0.0,
    percentile_252d=50.0,
    latest_date="2026-05-01",
):
    return {
        "summary": {
            "latest_date": latest_date,
            "latest_value": latest_value,
            "change_1m": change_1m,
            "change_3m": change_1m * 2,
            "change_12m": change_1m * 4,
            "percentile_252d": percentile_252d,
        }
    }


def test_build_score_summary_returns_three_scores_with_specific_drivers():
    series = {
        "vix": _summary(latest_value=24.0, change_1m=4.0, percentile_252d=80.0),
        "vix_vix3m_ratio": _summary(latest_value=1.1, change_1m=0.08, percentile_252d=75.0),
        "us10y": _summary(latest_value=4.7, change_1m=0.25, percentile_252d=70.0),
        "real_yield_10y": _summary(latest_value=2.2, change_1m=0.3, percentile_252d=85.0),
        "fed_assets": _summary(latest_value=7400000.0, change_1m=-50000.0, percentile_252d=45.0),
        "reverse_repo": _summary(latest_value=450.0, change_1m=30.0, percentile_252d=55.0),
        "sofr": _summary(latest_value=5.3, change_1m=0.05, percentile_252d=70.0),
        "net_liquidity": _summary(latest_value=5700000.0, change_1m=-120000.0, percentile_252d=35.0),
        "high_yield_oas": _summary(latest_value=4.4, change_1m=0.45, percentile_252d=95.0),
        "investment_grade_oas": _summary(latest_value=1.4, change_1m=0.05, percentile_252d=60.0),
        "hy_minus_ig_oas": _summary(latest_value=3.0, change_1m=0.4, percentile_252d=78.0),
        "financial_stress": _summary(latest_value=0.2, change_1m=0.1, percentile_252d=65.0),
        "financial_conditions": _summary(latest_value=0.1, change_1m=0.05, percentile_252d=55.0),
        "wti_crude": _summary(latest_value=84.0, change_1m=6.0, percentile_252d=70.0),
        "brent_crude": _summary(latest_value=88.0, change_1m=5.0, percentile_252d=68.0),
        "corn_price": _summary(latest_value=480.0, change_1m=15.0, percentile_252d=65.0),
        "wheat_price": _summary(latest_value=620.0, change_1m=20.0, percentile_252d=66.0),
        "soybean_price": _summary(latest_value=1280.0, change_1m=30.0, percentile_252d=60.0),
        "commodity_inflation_impulse": _summary(latest_value=-35.0, change_1m=-10.0, percentile_252d=70.0),
        "broad_dollar": _summary(latest_value=106.0, change_1m=2.0, percentile_252d=80.0),
        "cftc_sp500_asset_mgr_net": _summary(latest_value=120000.0, change_1m=10000.0, percentile_252d=88.0),
        "cftc_sp500_lev_money_net": _summary(latest_value=80000.0, change_1m=15000.0, percentile_252d=92.0),
        "real_gdp": _summary(latest_value=2.0, change_1m=-0.2, percentile_252d=55.0),
        "payrolls": _summary(latest_value=175000.0, change_1m=-50000.0, percentile_252d=45.0),
        "unemployment_rate": _summary(latest_value=4.1, change_1m=0.2, percentile_252d=65.0),
        "cpi": _summary(latest_value=3.4, change_1m=0.1, percentile_252d=70.0),
        "pce": _summary(latest_value=3.1, change_1m=0.1, percentile_252d=68.0),
        "consumer_sentiment": _summary(latest_value=72.0, change_1m=-3.0, percentile_252d=40.0),
        "retail_sales": _summary(latest_value=705000.0, change_1m=-2000.0, percentile_252d=45.0),
        "industrial_production": _summary(latest_value=103.0, change_1m=-0.3, percentile_252d=42.0),
        "pmi": _summary(latest_value=49.0, change_1m=-1.0, percentile_252d=38.0),
    }

    summary = compute_regime_score.build_score_summary(series, "2026-05-04T00:00:00Z")

    assert summary["method_version"] == "phase4-pr2-macro-completeness-v1"
    assert set(summary["scores"]) == {"market_weather", "macro_climate", "fragility"}
    assert "High-yield spreads widened over the past month." in summary["scores"]["market_weather"]["top_risks"]
    assert summary["scores"]["macro_climate"]["confidence"] < 1.0
    assert "Housing is not active in Phase 4 PR 1." not in summary["scores"]["macro_climate"]["missing_or_stale_notes"]
    assert summary["data_quality"]["overall_confidence"] <= 1.0
    assert "Housing is not active in Phase 4 PR 1." not in summary["data_quality"]["reasons"]


def test_missing_phase_3_macro_coverage_lowers_confidence_and_adds_notes():
    series = {
        "vix": _summary(latest_value=18.0, change_1m=1.0, percentile_252d=55.0),
        "us10y": _summary(latest_value=4.2, change_1m=0.1, percentile_252d=55.0),
        "fed_assets": _summary(latest_value=7400000.0, change_1m=0.0, percentile_252d=50.0),
        "reverse_repo": _summary(latest_value=450.0, change_1m=0.0, percentile_252d=50.0),
        "sofr": _summary(latest_value=5.3, change_1m=0.0, percentile_252d=50.0),
        "net_liquidity": _summary(latest_value=5700000.0, change_1m=0.0, percentile_252d=50.0),
        "financial_stress": _summary(latest_value=0.0, change_1m=0.0, percentile_252d=50.0),
        "financial_conditions": _summary(latest_value=0.0, change_1m=0.0, percentile_252d=50.0),
    }

    summary = compute_regime_score.build_score_summary(series, "2026-05-04T00:00:00Z")
    macro = summary["scores"]["macro_climate"]

    assert macro["confidence"] < 0.8
    assert "Housing is not active in Phase 4 PR 1." not in macro["missing_or_stale_notes"]
    assert any("growth" in note and "cfnai" in note for note in macro["missing_or_stale_notes"])
    assert any("labor" in note and "nonfarm_payrolls" in note for note in macro["missing_or_stale_notes"])
    assert any("inflation" in note and "headline_cpi" in note for note in macro["missing_or_stale_notes"])
    assert any("consumer/production" in note and "real_retail_sales" in note for note in macro["missing_or_stale_notes"])


def test_macro_climate_includes_active_housing_bucket():
    series = {
        "housing_starts": _summary(percentile_252d=80.0),
        "building_permits": _summary(percentile_252d=70.0),
        "mortgage_rate_30y": _summary(percentile_252d=20.0),
        "cfnai": _summary(percentile_252d=50.0),
        "cfnai_3m_avg": _summary(percentile_252d=50.0),
        "nonfarm_payrolls": _summary(percentile_252d=50.0),
        "unemployment_rate": _summary(percentile_252d=50.0),
        "initial_claims": _summary(percentile_252d=50.0),
        "sahm_rule": _summary(percentile_252d=50.0),
        "headline_cpi": _summary(percentile_252d=50.0),
        "core_cpi": _summary(percentile_252d=50.0),
        "core_pce": _summary(percentile_252d=50.0),
        "ppi_final_demand": _summary(percentile_252d=50.0),
        "real_retail_sales": _summary(percentile_252d=50.0),
        "industrial_production": _summary(percentile_252d=50.0),
        "durable_goods_orders": _summary(percentile_252d=50.0),
        "real_yield_10y": _summary(percentile_252d=50.0),
    }

    summary = compute_regime_score.build_score_summary(series, "2026-05-05T00:00:00Z")
    macro = summary["scores"]["macro_climate"]

    assert "housing" in macro["bucket_scores"]
    assert macro["bucket_weights"]["housing"] == 0.15
    assert macro["bucket_scores"]["housing"] > 0
    assert "Housing activity and rate sensitivity are supportive." in macro["top_supports"]
    assert "Housing is not active" not in " ".join(macro["missing_or_stale_notes"])


def test_missing_housing_lowers_macro_confidence_with_pr2_note():
    series = {
        "cfnai": _summary(percentile_252d=50.0),
        "cfnai_3m_avg": _summary(percentile_252d=50.0),
    }

    summary = compute_regime_score.build_score_summary(series, "2026-05-05T00:00:00Z")
    macro = summary["scores"]["macro_climate"]

    assert any("housing" in note.lower() for note in macro["missing_or_stale_notes"])
    assert macro["confidence_breakdown"]["coverage_confidence"] < 1.0


def test_score_summary_does_not_embed_candidate_source_ids():
    series = {
        "vix": _summary(percentile_252d=50.0),
        "reverse_repo": _summary(percentile_252d=50.0),
        "net_liquidity": _summary(percentile_252d=50.0),
        "financial_stress": _summary(percentile_252d=50.0),
        "financial_conditions": _summary(percentile_252d=50.0),
    }

    summary_text = json.dumps(
        compute_regime_score.build_score_summary(series, "2026-05-04T00:00:00Z")
    )

    assert "ism_manufacturing_pmi" not in summary_text
    assert "move_index" not in summary_text
    assert "Treasury/bond volatility source is not active." in summary_text


def test_macro_climate_uses_phase_3_catalog_ids_not_legacy_aliases():
    series = {
        "cfnai": _summary(percentile_252d=90.0),
        "cfnai_3m_avg": _summary(percentile_252d=80.0),
        "real_retail_sales": _summary(percentile_252d=85.0),
        "industrial_production": _summary(percentile_252d=80.0),
        "durable_goods_orders": _summary(percentile_252d=75.0),
        "nonfarm_payrolls": _summary(percentile_252d=80.0),
        "unemployment_rate": _summary(percentile_252d=20.0),
        "initial_claims": _summary(percentile_252d=15.0),
        "sahm_rule": _summary(percentile_252d=10.0),
        "headline_cpi": _summary(percentile_252d=80.0),
        "core_cpi": _summary(percentile_252d=75.0),
        "core_pce": _summary(percentile_252d=70.0),
        "ppi_final_demand": _summary(percentile_252d=65.0),
        "real_yield_10y": _summary(percentile_252d=85.0),
        "real_gdp": _summary(percentile_252d=5.0),
        "retail_sales": _summary(percentile_252d=5.0),
        "consumer_sentiment": _summary(percentile_252d=5.0),
        "pmi": _summary(percentile_252d=5.0),
        "cpi": _summary(percentile_252d=10.0),
        "pce": _summary(percentile_252d=10.0),
    }

    macro = compute_regime_score.build_score_summary(
        series, "2026-05-04T00:00:00Z"
    )["scores"]["macro_climate"]

    assert macro["bucket_scores"]["growth"] > 0
    assert macro["bucket_scores"]["labor"] > 0
    assert macro["bucket_scores"]["consumer_production"] > 0
    assert macro["bucket_scores"]["inflation"] < 0
    assert macro["bucket_scores"]["real_yields"] < 0


def test_market_weather_uses_phase_3_buckets_and_bucket_drivers_for_top_risks():
    series = {
        "vix": _summary(percentile_252d=55.0),
        "real_yield_10y": _summary(percentile_252d=55.0),
        "net_liquidity": _summary(percentile_252d=45.0),
        "reverse_repo": _summary(percentile_252d=50.0),
        "sofr": _summary(percentile_252d=50.0),
        "commodity_inflation_impulse": _summary(latest_value=-95.0, change_1m=-20.0, percentile_252d=95.0),
        "cftc_sp500_asset_mgr_net": _summary(latest_value=0.0, change_1m=0.0, percentile_252d=50.0),
        "cftc_sp500_lev_money_net": _summary(latest_value=80.0, change_1m=15.0, percentile_252d=95.0),
    }

    market = compute_regime_score.build_score_summary(
        series, "2026-05-04T00:00:00Z"
    )["scores"]["market_weather"]

    assert set(market["bucket_scores"]) == {
        "credit_spreads",
        "liquidity_funding",
        "rates_real_yields",
        "volatility_tail_risk",
        "dollar_global",
        "commodities_inflation_impulse",
        "sentiment_positioning",
    }
    assert "Commodity inflation impulse is elevated." in market["top_risks"]
    assert "Leveraged-money S&P 500 positioning is crowded." in market["top_risks"]


def test_supportive_credit_bucket_does_not_force_high_yield_widening_risk():
    series = {
        "high_yield_oas": _summary(latest_value=3.0, change_1m=0.01, percentile_252d=10.0),
        "investment_grade_oas": _summary(latest_value=1.0, change_1m=-0.05, percentile_252d=15.0),
        "bbb_oas": _summary(latest_value=1.5, change_1m=-0.05, percentile_252d=20.0),
        "vix": _summary(percentile_252d=80.0),
        "real_yield_10y": _summary(percentile_252d=85.0),
        "commodity_inflation_impulse": _summary(latest_value=-60.0, change_1m=-5.0, percentile_252d=80.0),
        "cftc_sp500_asset_mgr_net": _summary(percentile_252d=50.0),
        "cftc_sp500_lev_money_net": _summary(percentile_252d=50.0),
    }

    market = compute_regime_score.build_score_summary(
        series, "2026-05-04T00:00:00Z"
    )["scores"]["market_weather"]

    assert market["bucket_scores"]["credit_spreads"] > 0
    assert "High-yield spreads widened over the past month." not in market["top_risks"]
    assert "Credit spread pressure is contained." in market["top_supports"]


def test_commodity_impulse_reweights_without_breakeven_and_notes_missing_confirmation():
    series = {
        "wti_crude": _summary(latest_value=100.0, change_1m=5.0, percentile_252d=95.0),
        "brent_crude": _summary(latest_value=110.0, change_1m=5.0, percentile_252d=95.0),
        "corn_price": _summary(latest_value=300.0, change_1m=10.0, percentile_252d=95.0),
        "wheat_price": _summary(latest_value=400.0, change_1m=10.0, percentile_252d=95.0),
        "soybean_price": _summary(latest_value=500.0, change_1m=10.0, percentile_252d=95.0),
    }

    impulse = compute_regime_score.build_commodity_inflation_impulse(
        series, "2026-05-04T00:00:00Z"
    )
    series["commodity_inflation_impulse"] = impulse

    market = compute_regime_score.build_score_summary(
        series, "2026-05-04T00:00:00Z"
    )["scores"]["market_weather"]

    assert impulse["observations"]
    assert market["bucket_scores"]["commodities_inflation_impulse"] == impulse["value"]
    assert any("breakeven_10y" in note for note in market["missing_or_stale_notes"])


def test_breakeven_confirmation_present_but_invalid_still_lowers_market_confidence():
    series = {
        "high_yield_oas": _summary(percentile_252d=20.0),
        "investment_grade_oas": _summary(percentile_252d=20.0),
        "bbb_oas": _summary(percentile_252d=20.0),
        "net_liquidity": _summary(percentile_252d=55.0),
        "reverse_repo": _summary(percentile_252d=50.0),
        "sofr": _summary(percentile_252d=50.0),
        "real_yield_10y": _summary(percentile_252d=50.0),
        "vix": _summary(percentile_252d=50.0),
        "vvix": _summary(percentile_252d=50.0),
        "vix9d": _summary(percentile_252d=50.0),
        "vix3m": _summary(percentile_252d=50.0),
        "broad_dollar": _summary(percentile_252d=50.0),
        "cftc_sp500_asset_mgr_net": _summary(percentile_252d=50.0),
        "cftc_sp500_lev_money_net": _summary(percentile_252d=50.0),
        "wti_crude": _summary(latest_value=100.0, change_1m=5.0, percentile_252d=80.0),
        "brent_crude": _summary(latest_value=110.0, change_1m=5.0, percentile_252d=80.0),
        "corn_price": _summary(latest_value=300.0, change_1m=10.0, percentile_252d=80.0),
        "wheat_price": _summary(latest_value=400.0, change_1m=10.0, percentile_252d=80.0),
        "soybean_price": _summary(latest_value=500.0, change_1m=10.0, percentile_252d=80.0),
        "breakeven_10y": {
            "summary": {
                "latest_date": "2026-05-01",
                "latest_value": 2.4,
                "change_3m": None,
                "percentile_252d": 50.0,
            }
        },
    }
    series["commodity_inflation_impulse"] = compute_regime_score.build_commodity_inflation_impulse(
        series, "2026-05-04T00:00:00Z"
    )

    market = compute_regime_score.build_score_summary(
        series, "2026-05-04T00:00:00Z"
    )["scores"]["market_weather"]

    assert market["confidence"] < 1.0
    assert any("breakeven_10y" in note for note in market["missing_or_stale_notes"])


def test_build_status_marks_missing_active_public_catalog_entries_unavailable(monkeypatch):
    monkeypatch.setattr(
        compute_regime_score,
        "available_catalog_entries",
        lambda: [
            {
                "id": "cfnai",
                "source": "FRED",
                "frequency": "monthly",
                "max_stale_days": 45,
                "score_status": "active",
                "public": True,
            }
        ],
    )

    status = compute_regime_score.build_status({}, "2026-05-04T00:00:00Z")

    assert status["overall_status"] == "partial"
    assert status["series"]["cfnai"]["status"] == "unavailable"
    assert status["series"]["cfnai"]["message"] == "Active public catalog series has no generated payload."


def test_validate_status_file_accepts_governance_series_statuses(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "overall_status": "ok",
          "series": {
            "candidate_series": {"status": "terms_review_needed"},
            "restricted_series": {"status": "unavailable"}
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    validate_schema.validate_status_file()


def test_validate_status_file_rejects_unknown_series_status(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "overall_status": "ok",
          "series": {
            "unknown_series": {"status": "paused"}
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="invalid series status"):
        validate_schema.validate_status_file()


def test_validate_status_file_rejects_partial_series_status(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "overall_status": "partial",
          "series": {
            "some_series": {"status": "partial"}
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="invalid series status"):
        validate_schema.validate_status_file()


def test_validate_score_summary_file_rejects_missing_score_confidence_breakdown(tmp_path, monkeypatch):
    derived_dir = tmp_path / "derived"
    derived_dir.mkdir()
    confidence_breakdown = {
        "coverage_confidence": 1.0,
        "freshness_confidence": 1.0,
        "model_confidence": 1.0,
        "source_confidence": 1.0,
        "overall_confidence": 1.0,
    }
    score_block = {
        "score": 0.0,
        "confidence": 1.0,
        "top_risks": [],
        "top_supports": [],
        "confidence_reasons": [],
        "recent_changes": [],
        "missing_or_stale_notes": [],
        "confidence_breakdown": confidence_breakdown,
    }
    payload = {
        "scores": {
            "market_weather": {
                key: value
                for key, value in score_block.items()
                if key != "confidence_breakdown"
            },
            "macro_climate": score_block,
            "fragility": score_block,
        },
        "data_quality": {
            **confidence_breakdown,
            "reasons": [],
        },
    }
    (derived_dir / "score_summary.json").write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(
        ValueError,
        match=r"market_weather\.confidence_breakdown must be an object",
    ):
        validate_schema.validate_score_summary_file()


def test_validate_freshness_accepts_governance_series_statuses(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "overall_status": "ok",
          "series": {
            "candidate_series": {
              "status": "terms_review_needed",
              "freshness_days": null,
              "max_stale_days": 45
            },
            "restricted_series": {
              "status": "unavailable",
              "freshness_days": null,
              "max_stale_days": 7
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    validate_freshness.main()


def test_validate_freshness_accepts_partial_stale_series_status(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "partial",
          "series": {
            "macro_series": {
              "status": "stale",
              "last_observation": "2026-04-20",
              "observation_period": "2026-04-20",
              "expected_frequency": "daily",
              "freshness_days": 15,
              "max_stale_days": 7,
              "expected_next_release_window": null,
              "message": "Latest daily observation is 15 days old, above the 7 day freshness buffer."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    validate_freshness.main()


def test_validate_freshness_rejects_malformed_stale_series_status(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "partial",
          "series": {
            "macro_series": {
              "status": "stale",
              "last_observation": "2026-04-20",
              "observation_period": "2026-04-20",
              "expected_frequency": "daily",
              "freshness_days": 1,
              "max_stale_days": 7,
              "expected_next_release_window": null,
              "message": "Latest daily observation is 1 days old."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="macro_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_accepts_release_window_ok_series_status(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "monthly_series": {
              "status": "ok",
              "last_observation": "2026-03-01",
              "observation_period": "2026-03",
              "expected_frequency": "monthly",
              "freshness_days": 65,
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "2026-04-01",
                "end": "2026-05-16"
              },
              "message": "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    validate_freshness.main()


def test_validate_freshness_accepts_weekly_and_quarterly_release_window_ok_statuses(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "weekly_series": {
              "status": "ok",
              "last_observation": "2026-04-24",
              "observation_period": "week of 2026-04-24",
              "expected_frequency": "weekly",
              "freshness_days": 11,
              "max_stale_days": 7,
              "expected_next_release_window": {
                "start": "2026-05-01",
                "end": "2026-05-08"
              },
              "message": "Latest weekly observation is within the expected release window ending 2026-05-08."
            },
            "quarterly_series": {
              "status": "ok",
              "last_observation": "2026-01-01",
              "observation_period": "2026-Q1",
              "expected_frequency": "quarterly",
              "freshness_days": 124,
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "2026-04-01",
                "end": "2026-05-16"
              },
              "message": "Latest quarterly observation covers 2026-Q1 and is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    validate_freshness.main()


def test_validate_freshness_accepts_valid_fresh_daily_ok_series(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "fresh_daily_series": {
              "status": "ok",
              "last_observation": "2026-05-04",
              "observation_period": "2026-05-04",
              "expected_frequency": "daily",
              "freshness_days": 1,
              "max_stale_days": 7,
              "expected_next_release_window": null,
              "message": "Latest daily observation is 1 days old."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    validate_freshness.main()


def test_validate_freshness_rejects_stale_daily_ok_series_with_fabricated_low_age(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "daily_low_age_series": {
              "status": "ok",
              "last_observation": "2026-04-20",
              "observation_period": "2026-04-20",
              "expected_frequency": "daily",
              "freshness_days": 1,
              "max_stale_days": 7,
              "expected_next_release_window": null,
              "message": "Latest daily observation is 1 days old."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="daily_low_age_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_ok_series_with_missing_last_observation(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "missing_observation_series": {
              "status": "ok",
              "observation_period": "2026-04-20",
              "expected_frequency": "daily",
              "freshness_days": 1,
              "max_stale_days": 7,
              "expected_next_release_window": null,
              "message": "Latest daily observation is 1 days old."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="missing_observation_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_ok_series_with_malformed_last_observation(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "malformed_observation_series": {
              "status": "ok",
              "last_observation": "not-a-date",
              "observation_period": "not-a-date",
              "expected_frequency": "daily",
              "freshness_days": 1,
              "max_stale_days": 7,
              "expected_next_release_window": null,
              "message": "Latest daily observation is 1 days old."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="malformed_observation_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_stale_monthly_ok_series_with_missing_age(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-07-01T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "monthly_missing_age_series": {
              "status": "ok",
              "last_observation": "2026-03-01",
              "observation_period": "2026-03",
              "expected_frequency": "monthly",
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "2026-04-01",
                "end": "2026-05-16"
              },
              "message": "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="monthly_missing_age_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_stale_monthly_ok_series_with_non_numeric_age(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-07-01T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "monthly_non_numeric_age_series": {
              "status": "ok",
              "last_observation": "2026-03-01",
              "observation_period": "2026-03",
              "expected_frequency": "monthly",
              "freshness_days": "1",
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "2026-04-01",
                "end": "2026-05-16"
              },
              "message": "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="monthly_non_numeric_age_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_stale_monthly_ok_series_with_fabricated_low_age(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-07-01T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "monthly_low_age_series": {
              "status": "ok",
              "last_observation": "2026-03-01",
              "observation_period": "2026-03",
              "expected_frequency": "monthly",
              "freshness_days": 1,
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "2026-04-01",
                "end": "2026-05-16"
              },
              "message": "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="monthly_low_age_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_daily_spoofed_release_window_status(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "daily_series": {
              "status": "ok",
              "last_observation": "2026-04-20",
              "expected_frequency": "daily",
              "freshness_days": 15,
              "max_stale_days": 7,
              "expected_next_release_window": {
                "start": "2026-05-01",
                "end": "2026-05-16"
              },
              "message": "Latest daily observation is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="daily_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_release_window_row_with_fabricated_freshness_days(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "fabricated_freshness_series": {
              "status": "ok",
              "last_observation": "2026-03-01",
              "observation_period": "2026-03",
              "expected_frequency": "monthly",
              "freshness_days": 999,
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "2026-04-01",
                "end": "2026-05-16"
              },
              "message": "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(
        SystemExit,
        match="fabricated_freshness_series failed freshness invariant",
    ):
        validate_freshness.main()


def test_validate_freshness_rejects_release_window_row_with_fabricated_message(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "fabricated_message_series": {
              "status": "ok",
              "last_observation": "2026-03-01",
              "observation_period": "2026-03",
              "expected_frequency": "monthly",
              "freshness_days": 65,
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "2026-04-01",
                "end": "2026-05-16"
              },
              "message": "Arbitrary validator bypass text within the expected release window."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(
        SystemExit,
        match="fabricated_message_series failed freshness invariant",
    ):
        validate_freshness.main()


def test_validate_freshness_rejects_spoofed_release_window_with_malformed_dates(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-05T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "bad_window_series": {
              "status": "ok",
              "freshness_days": 65,
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "not-a-date",
                "end": "also-not-a-date"
              },
              "message": "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="bad_window_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_release_window_ok_after_window_end(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "generated_at_utc": "2026-05-17T00:00:00Z",
          "overall_status": "ok",
          "series": {
            "late_monthly_series": {
              "status": "ok",
              "freshness_days": 77,
              "max_stale_days": 45,
              "expected_next_release_window": {
                "start": "2026-04-01",
                "end": "2026-05-16"
              },
              "message": "Latest monthly observation covers 2026-03 and is within the expected release window ending 2026-05-16."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="late_monthly_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_ok_stale_series_without_release_allowance(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "overall_status": "ok",
          "series": {
            "bad_ok_series": {
              "status": "ok",
              "freshness_days": 65,
              "max_stale_days": 45,
              "message": "Fresh."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="bad_ok_series failed freshness invariant"):
        validate_freshness.main()


def test_validate_freshness_rejects_failed_series_status(tmp_path, monkeypatch):
    status_dir = tmp_path / "status"
    status_dir.mkdir()
    (status_dir / "data_status.json").write_text(
        """
        {
          "overall_status": "failed",
          "series": {
            "bad_series": {
              "status": "failed",
              "message": "No observations available."
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_freshness, "data_dir", lambda: tmp_path)

    with pytest.raises(SystemExit, match="bad_series failed: No observations available."):
        validate_freshness.main()


def test_generated_file_validation_requires_active_derived_files():
    required_paths = set(validate_schema.REQUIRED_GENERATED_FILES)

    assert (
        validate_schema.data_dir() / "derived" / "commodity_inflation_impulse.json"
    ) in required_paths
    assert validate_schema.data_dir() / "derived" / "hy_minus_ig_oas.json" in required_paths
    assert validate_schema.data_dir() / "derived" / "vix9d_vix_ratio.json" in required_paths
    assert validate_schema.data_dir() / "derived" / "vix_vix3m_ratio.json" in required_paths


def test_validate_score_summary_requires_three_named_score_blocks(tmp_path, monkeypatch):
    derived = tmp_path / "derived"
    derived.mkdir()
    (derived / "score_summary.json").write_text(
        """
        {
          "scores": {
            "market_weather": {
              "score": -1,
              "confidence": 0.9,
              "top_risks": [],
              "top_supports": [],
              "confidence_reasons": [],
              "recent_changes": [],
              "missing_or_stale_notes": [],
              "confidence_breakdown": {
                "coverage_confidence": 1.0,
                "freshness_confidence": 1.0,
                "model_confidence": 1.0,
                "source_confidence": 1.0,
                "overall_confidence": 0.9
              }
            },
            "macro_climate": {
              "score": 2,
              "confidence": 0.8,
              "top_risks": [],
              "top_supports": [],
              "confidence_reasons": [],
              "recent_changes": [],
              "missing_or_stale_notes": [],
              "confidence_breakdown": {
                "coverage_confidence": 1.0,
                "freshness_confidence": 1.0,
                "model_confidence": 1.0,
                "source_confidence": 1.0,
                "overall_confidence": 0.8
              }
            },
            "fragility": {
              "score": -3,
              "confidence": 0.7,
              "top_risks": [],
              "top_supports": [],
              "confidence_reasons": [],
              "recent_changes": [],
              "missing_or_stale_notes": [],
              "confidence_breakdown": {
                "coverage_confidence": 1.0,
                "freshness_confidence": 1.0,
                "model_confidence": 1.0,
                "source_confidence": 1.0,
                "overall_confidence": 0.7
              }
            }
          },
          "data_quality": {
            "coverage_confidence": 1.0,
            "freshness_confidence": 1.0,
            "model_confidence": 1.0,
            "source_confidence": 1.0,
            "overall_confidence": 1.0,
            "reasons": []
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    validate_schema.validate_score_summary_file()


def test_validate_score_summary_requires_ui_score_block_arrays(tmp_path, monkeypatch):
    derived = tmp_path / "derived"
    derived.mkdir()
    (derived / "score_summary.json").write_text(
        """
        {
          "scores": {
            "market_weather": {
              "score": -1,
              "confidence": 0.9,
              "top_risks": [],
              "confidence_reasons": [],
              "recent_changes": [],
              "missing_or_stale_notes": []
            },
            "macro_climate": {
              "score": 2,
              "confidence": 0.8,
              "top_risks": [],
              "top_supports": [],
              "confidence_reasons": [],
              "recent_changes": [],
              "missing_or_stale_notes": []
            },
            "fragility": {
              "score": -3,
              "confidence": 0.7,
              "top_risks": [],
              "top_supports": [],
              "confidence_reasons": [],
              "recent_changes": [],
              "missing_or_stale_notes": []
            }
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="market_weather.top_supports must be a list"):
        validate_schema.validate_score_summary_file()


def test_validate_score_summary_rejects_non_finite_score_values(tmp_path, monkeypatch):
    derived = tmp_path / "derived"
    derived.mkdir()
    payload = {
        "scores": {
            "market_weather": {
                "score": float("nan"),
                "confidence": 0.9,
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
            },
            "macro_climate": {
                "score": 2,
                "confidence": float("inf"),
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
            },
            "fragility": {
                "score": -3,
                "confidence": 0.7,
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
            },
        }
    }
    (derived / "score_summary.json").write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="market_weather.score must be finite"):
        validate_schema.validate_score_summary_file()


def test_validate_score_summary_rejects_out_of_range_data_quality_confidence(
    tmp_path, monkeypatch
):
    derived = tmp_path / "derived"
    derived.mkdir()
    confidence_breakdown = {
        "coverage_confidence": 1.0,
        "freshness_confidence": 1.0,
        "model_confidence": 1.0,
        "source_confidence": 1.0,
        "overall_confidence": 1.0,
    }
    payload = {
        "scores": {
            "market_weather": {
                "score": -1,
                "confidence": 0.9,
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
                "confidence_breakdown": confidence_breakdown,
            },
            "macro_climate": {
                "score": 2,
                "confidence": 0.8,
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
                "confidence_breakdown": confidence_breakdown,
            },
            "fragility": {
                "score": -3,
                "confidence": 0.7,
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
                "confidence_breakdown": confidence_breakdown,
            },
        },
        "data_quality": {
            "coverage_confidence": 1.2,
            "freshness_confidence": 1.0,
            "model_confidence": 1.0,
            "source_confidence": 1.0,
            "overall_confidence": 1.0,
            "reasons": [],
        },
    }
    (derived / "score_summary.json").write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(
        ValueError,
        match="data_quality.coverage_confidence must be between 0 and 1",
    ):
        validate_schema.validate_score_summary_file()


def test_validate_score_summary_rejects_out_of_range_score_confidence_breakdown(
    tmp_path, monkeypatch
):
    derived = tmp_path / "derived"
    derived.mkdir()
    payload = {
        "scores": {
            "market_weather": {
                "score": -1,
                "confidence": 0.9,
                "confidence_breakdown": {
                    "coverage_confidence": 1.0,
                    "freshness_confidence": 1.0,
                    "model_confidence": 1.0,
                    "source_confidence": 1.0,
                    "overall_confidence": -0.1,
                    "reasons": [],
                },
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
            },
            "macro_climate": {
                "score": 2,
                "confidence": 0.8,
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
            },
            "fragility": {
                "score": -3,
                "confidence": 0.7,
                "top_risks": [],
                "top_supports": [],
                "confidence_reasons": [],
                "recent_changes": [],
                "missing_or_stale_notes": [],
            },
        },
        "data_quality": {
            "coverage_confidence": 1.0,
            "freshness_confidence": 1.0,
            "model_confidence": 1.0,
            "source_confidence": 1.0,
            "overall_confidence": 1.0,
            "reasons": [],
        },
    }
    (derived / "score_summary.json").write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(
        ValueError,
        match="market_weather.confidence_breakdown.overall_confidence must be between 0 and 1",
    ):
        validate_schema.validate_score_summary_file()


def test_score_summary_emits_data_quality_confidence_breakdown():
    series = {
        "vix": _summary(percentile_252d=50.0),
        "vvix": _summary(percentile_252d=50.0),
        "vix9d": _summary(percentile_252d=50.0),
        "vix3m": _summary(percentile_252d=50.0),
        "vix9d_vix_ratio": _summary(percentile_252d=50.0),
        "vix_vix3m_ratio": _summary(percentile_252d=50.0),
        "high_yield_oas": _summary(percentile_252d=50.0),
        "investment_grade_oas": _summary(percentile_252d=50.0),
        "bbb_oas": _summary(percentile_252d=50.0),
        "hy_minus_ig_oas": _summary(percentile_252d=50.0),
        "net_liquidity": _summary(percentile_252d=50.0),
        "reverse_repo": _summary(percentile_252d=50.0),
        "sofr": _summary(percentile_252d=50.0),
        "real_yield_10y": _summary(percentile_252d=50.0),
        "broad_dollar": _summary(percentile_252d=50.0),
        "commodity_inflation_impulse": _summary(latest_value=0.0, percentile_252d=50.0),
        "breakeven_10y": _summary(percentile_252d=50.0),
        "cftc_sp500_asset_mgr_net": _summary(percentile_252d=50.0),
        "cftc_sp500_lev_money_net": _summary(percentile_252d=50.0),
        "cfnai": _summary(percentile_252d=50.0),
        "cfnai_3m_avg": _summary(percentile_252d=50.0),
        "nonfarm_payrolls": _summary(percentile_252d=50.0),
        "unemployment_rate": _summary(percentile_252d=50.0),
        "initial_claims": _summary(percentile_252d=50.0),
        "sahm_rule": _summary(percentile_252d=50.0),
        "headline_cpi": _summary(percentile_252d=50.0),
        "core_cpi": _summary(percentile_252d=50.0),
        "core_pce": _summary(percentile_252d=50.0),
        "ppi_final_demand": _summary(percentile_252d=50.0),
        "real_retail_sales": _summary(percentile_252d=50.0),
        "industrial_production": _summary(percentile_252d=50.0),
        "durable_goods_orders": _summary(percentile_252d=50.0),
        "housing_starts": _summary(percentile_252d=50.0),
        "building_permits": _summary(percentile_252d=50.0),
        "mortgage_rate_30y": _summary(percentile_252d=50.0),
    }
    statuses = {
        series_id: {"status": "ok", "message": "Fresh."}
        for series_id in series
    }

    summary = compute_regime_score.build_score_summary(
        series,
        "2026-05-04T00:00:00Z",
        statuses,
    )

    data_quality = summary["data_quality"]
    assert set(data_quality) >= {
        "coverage_confidence",
        "freshness_confidence",
        "model_confidence",
        "source_confidence",
        "overall_confidence",
        "reasons",
    }
    assert data_quality["coverage_confidence"] > 0.9
    assert data_quality["freshness_confidence"] == 1.0
    assert data_quality["source_confidence"] < 1.0
    assert data_quality["reasons"]
    assert data_quality["overall_confidence"] == 0.99
    assert "Housing is not active in Phase 4 PR 1." not in data_quality["reasons"]


def test_stale_status_lowers_freshness_confidence():
    series = {
        "vix": _summary(percentile_252d=50.0),
        "reverse_repo": _summary(percentile_252d=50.0),
        "net_liquidity": _summary(percentile_252d=50.0),
    }
    statuses = {
        "vix": {"status": "ok", "message": "Fresh."},
        "reverse_repo": {"status": "stale", "message": "Latest daily observation is stale."},
        "net_liquidity": {"status": "ok", "message": "Fresh."},
    }

    summary = compute_regime_score.build_score_summary(
        series,
        "2026-05-04T00:00:00Z",
        statuses,
    )

    assert summary["data_quality"]["freshness_confidence"] < 1.0
    assert any("reverse_repo" in reason for reason in summary["data_quality"]["reasons"])
