from scripts.transform.compute_percentiles import percentile_rank, series_summary
from scripts.transform.compute_regime_score import clamp, score_credit, weighted_score


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
