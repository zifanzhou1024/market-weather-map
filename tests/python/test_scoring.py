from scripts.transform import compute_regime_score
from scripts.transform import compute_percentiles
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
        "source": "Derived",
        "expected_frequency": "daily",
        "freshness_days": 2,
        "max_stale_days": 7,
        "message": "Fresh.",
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
        "high_yield_oas": _summary(latest_value=4.4, change_1m=0.45, percentile_252d=76.0),
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

    assert summary["method_version"] == "phase3-three-score-v1"
    assert set(summary["scores"]) == {"market_weather", "macro_climate", "fragility"}
    assert "High-yield spreads widened over the past month." in summary["scores"]["market_weather"]["top_risks"]
    assert summary["scores"]["macro_climate"]["confidence"] < 1.0
    assert "Housing is not active in Phase 3." in summary["scores"]["macro_climate"]["missing_or_stale_notes"]
    assert summary["data_quality"]["overall_confidence"] <= 1.0
    assert "Housing is not active in Phase 3." in summary["data_quality"]["reasons"]


def test_validate_score_summary_requires_three_named_score_blocks(tmp_path, monkeypatch):
    derived = tmp_path / "derived"
    derived.mkdir()
    (derived / "score_summary.json").write_text(
        """
        {
          "scores": {
            "market_weather": {"score": -1, "confidence": 0.9, "top_risks": []},
            "macro_climate": {"score": 2, "confidence": 0.8, "top_risks": ["Housing is not active in Phase 3."]},
            "fragility": {"score": -3, "confidence": 0.7, "top_risks": []}
          }
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    validate_schema.validate_score_summary_file()
