from scripts.transform import compute_regime_score


def series(value, change_1m=0.0, percentile=50.0):
    return {
        "frequency": "daily",
        "summary": {
            "latest_date": "2026-05-06",
            "latest_value": value,
            "change_1m": change_1m,
            "percentile_252d": percentile,
        },
        "observations": [
            {"date": "2026-05-01", "value": value - change_1m},
            {"date": "2026-05-06", "value": value},
        ],
    }


def test_regime_snapshot_labels_tightening_risk_off():
    snapshot = compute_regime_score.build_regime_snapshot(
        {
            "real_yield_10y": series(2.25, 0.25),
            "broad_dollar": series(125.0, 2.0),
            "us10y": series(4.75, 0.30),
            "breakeven_10y": series(2.5, 0.05),
            "vix": series(22.0, 4.0, percentile=80),
            "vix3m": series(20.0, 0.5),
            "vix9d": series(24.0, 5.0),
            "high_yield_oas": series(4.2, 0.35, percentile=75),
            "hy_minus_ig_oas": series(2.8, 0.20, percentile=70),
            "net_liquidity": series(6000.0, -100.0),
        },
        "2026-05-07T00:00:00Z",
    )

    assert snapshot["regime"]["label"] == "Tightening / risk-off"
    assert snapshot["regime"]["tips_direction"] == "up"
    assert snapshot["regime"]["dollar_direction"] == "up"
    assert snapshot["regime"]["nominal_yield_direction"] == "up"
    assert snapshot["regime"]["yield_driver"] == "real_yield_driven"
    assert any(item["id"] == "vix_curve" and item["state"] == "backwardation_proxy" for item in snapshot["checklist"])


def test_regime_snapshot_labels_risk_on_easing():
    snapshot = compute_regime_score.build_regime_snapshot(
        {
            "real_yield_10y": series(1.75, -0.20),
            "broad_dollar": series(118.0, -2.0),
            "us10y": series(4.10, -0.18),
            "breakeven_10y": series(2.35, 0.02),
            "vix": series(15.0, -2.0, percentile=30),
            "vix3m": series(18.0, -0.5),
            "vix9d": series(14.0, -1.5),
            "high_yield_oas": series(3.2, -0.15, percentile=35),
            "hy_minus_ig_oas": series(2.1, -0.08, percentile=35),
            "net_liquidity": series(6200.0, 150.0),
        },
        "2026-05-07T00:00:00Z",
    )

    assert snapshot["regime"]["label"] == "Strong risk-on"
    assert snapshot["regime"]["yield_driver"] == "real_yield_easing"
    assert any(item["id"] == "credit" and item["status"] == "confirming" for item in snapshot["confirmations"])


def test_regime_snapshot_marks_missing_inputs_unavailable():
    snapshot = compute_regime_score.build_regime_snapshot({}, "2026-05-07T00:00:00Z")

    assert snapshot["regime"]["label"] == "Unavailable"
    assert snapshot["regime"]["tips_direction"] == "unavailable"
    assert snapshot["regime"]["dollar_direction"] == "unavailable"
    assert snapshot["regime"]["nominal_yield_direction"] == "unavailable"
    assert snapshot["regime"]["yield_driver"] == "unavailable"

    checklist_by_id = {item["id"]: item for item in snapshot["checklist"]}
    assert checklist_by_id["real_yield_10y"]["state"] == "unavailable"
    assert "flat" not in checklist_by_id["real_yield_10y"]["message"]
    assert checklist_by_id["overall_regime"]["state"] == "Unavailable"

    assert all(item["status"] == "unavailable" for item in snapshot["confirmations"])
    assert snapshot["quadrant_trail"] == []
    assert snapshot["yield_decomposition"] == []
