from scripts.transform.score_models import (
    ScoreDriver,
    clamp,
    confidence_from_reasons,
    driver_texts,
    label_for_three_score,
    score_block,
    weighted_score,
)


def test_score_block_includes_specific_driver_text_and_confidence():
    drivers = [
        ScoreDriver(
            bucket="credit_spreads",
            direction="risk",
            impact=-35.0,
            text="High-yield spreads widened over the past month.",
            series_id="high_yield_oas",
            latest_value=4.2,
            recent_change=0.4,
        ),
        ScoreDriver(
            bucket="liquidity",
            direction="support",
            impact=18.0,
            text="Reserve balances improved over the past month.",
            series_id="reserve_balances",
            latest_value=3300000.0,
            recent_change=120000.0,
        ),
    ]

    block = score_block(
        score=-12.0,
        label="Mixed",
        bucket_scores={"credit_spreads": -35.0, "liquidity": 18.0},
        bucket_weights={"credit_spreads": 0.2, "liquidity": 0.2},
        drivers=drivers,
        confidence_reasons=["Treasury/bond volatility source is not active."],
        missing_or_stale_notes=["MOVE is a candidate input."],
    )

    assert block["top_risks"] == ["High-yield spreads widened over the past month."]
    assert block["top_supports"] == ["Reserve balances improved over the past month."]
    assert block["recent_changes"] == [
        "High-yield spreads widened over the past month.",
        "Reserve balances improved over the past month.",
    ]
    assert block["confidence"] == 0.8
    assert block["confidence_reasons"] == ["Treasury/bond volatility source is not active."]
    assert block["missing_or_stale_notes"] == ["MOVE is a candidate input."]


def test_confidence_from_reasons_has_floor_and_penalty_per_reason():
    assert confidence_from_reasons([]) == 1.0
    assert confidence_from_reasons(["a", "b"]) == 0.8
    assert confidence_from_reasons(["a", "b", "c", "d", "e", "f", "g"]) == 0.4


def test_three_score_labeling_is_conservative():
    assert label_for_three_score(-50.0, "market_weather") == "Stressed"
    assert label_for_three_score(-20.0, "macro_climate") == "Fragile"
    assert label_for_three_score(19.99, "market_weather") == "Mixed"
    assert label_for_three_score(20.0, "macro_climate") == "Supportive"
    assert label_for_three_score(-50.0, "fragility") == "High Fragility"
    assert label_for_three_score(-20.0, "fragility") == "Elevated Fragility"
    assert label_for_three_score(19.99, "fragility") == "Moderate"
    assert label_for_three_score(20.0, "fragility") == "Low Fragility"


def test_driver_texts_returns_ordered_unique_strings():
    drivers = [
        ScoreDriver("credit", "risk", -20, "Credit spreads widened.", "high_yield_oas", 4.0, 0.2),
        ScoreDriver("credit", "risk", -10, "Credit spreads widened.", "bbb_oas", 2.0, 0.1),
        ScoreDriver("rates", "risk", -15, "10Y real yield is elevated.", "real_yield_10y", 2.1, 0.3),
        ScoreDriver("liquidity", "support", 30, "Liquidity improved.", "reserve_balances", 3.3, 0.4),
    ]

    assert driver_texts(drivers, "risk") == [
        "Credit spreads widened.",
        "10Y real yield is elevated.",
    ]
    assert driver_texts(drivers, "support") == ["Liquidity improved."]


def test_clamp_bounds_and_rounds_scores():
    assert clamp(120.432) == 100.0
    assert clamp(-120.432) == -100.0
    assert clamp(12.345) == 12.35


def test_weighted_score_reweights_available_scores():
    scores = {"credit": -30.0, "liquidity": 10.0}
    weights = {"credit": 0.4, "liquidity": 0.2, "missing": 0.4}

    assert weighted_score(scores, weights) == -16.67
    assert weighted_score({}, weights) == 0.0
    assert weighted_score(scores, {}) == 0.0
