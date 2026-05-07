from scripts.transform import compute_regime_score


def s(value, change_1m=0.0, percentile=50.0):
    return {
        "frequency": "daily",
        "summary": {
            "latest_date": "2026-05-06",
            "latest_value": value,
            "change_1m": change_1m,
            "percentile_252d": percentile,
        },
        "observations": [{"date": "2026-05-06", "value": value}],
    }


def test_shock_snapshot_flags_bond_vol_gap_and_active_mismatch():
    status = {
        "move_index": {
            "status": "terms_review_needed",
            "message": "Candidate source requires access or terms review before scoring.",
        },
        "skew_index": {
            "status": "terms_review_needed",
            "message": "Candidate source requires access or terms review before scoring.",
        },
    }
    snapshot = compute_regime_score.build_shock_risk_snapshot(
        {
            "vix": s(22, 4, 80),
            "vix_vix3m_ratio": s(1.08, 0.15, 85),
            "real_yield_10y": s(2.3, 0.25, 80),
            "broad_dollar": s(125, 2.0, 82),
            "high_yield_oas": s(4.2, 0.35, 75),
            "hy_minus_ig_oas": s(2.7, 0.25, 78),
            "net_liquidity": s(6000, -120, 35),
        },
        status,
        "2026-05-07T00:00:00Z",
    )

    assert snapshot["label"] == "Elevated shock risk"
    assert any(
        item["id"] == "move_index" and item["status"] == "terms_review_needed"
        for item in snapshot["source_gaps"]
    )
    assert any(
        item["id"] == "skew_index" and item["status"] == "terms_review_needed"
        for item in snapshot["source_gaps"]
    )
    assert any(
        warning["id"] == "tightening_confirmation"
        for warning in snapshot["mismatch_warnings"]
    )


def test_shock_snapshot_does_not_emit_active_change_signals_when_change_missing():
    snapshot = compute_regime_score.build_shock_risk_snapshot(
        {
            "vix": s(18, -2, 55),
            "vix_vix3m_ratio": s(0.9, -0.1, 45),
            "high_yield_oas": s(3.8, -0.2, 45),
            "broad_dollar": s(120, None, 50),
            "real_yield_10y": s(2.1, None, 50),
            "net_liquidity": s(6000, None, 50),
        },
        {},
        "2026-05-07T00:00:00Z",
    )

    active_signal_ids = {item["id"] for item in snapshot["active_signals"]}
    assert "broad_dollar" not in active_signal_ids
    assert "real_yield_10y" not in active_signal_ids
    assert "net_liquidity" not in active_signal_ids
