"""Tests for the SECTION_CATALOG and its five derive functions.

Each derive function is tested for:
- Missing-data branch (empty ``loaded`` dict) → ``freshness_status="unavailable"``
- With-fixture branch (minimal valid payload) → ``freshness_status="ok"``

The catalog-structure test verifies the total entry count equals five.
"""
from __future__ import annotations

import pytest

from scripts.transform import build_page_insights as mod


# ---------------------------------------------------------------------------
# Catalog structure
# ---------------------------------------------------------------------------


def test_section_catalog_has_five_entries():
    total = sum(len(v) for v in mod.SECTION_CATALOG.values())
    assert total == 5


def test_section_catalog_route_keys():
    assert set(mod.SECTION_CATALOG.keys()) == {
        "volatility",
        "rates",
        "regime_map",
        "sentiment",
        "tactical",
    }


def test_section_catalog_ids():
    expected_ids = {
        "volatility_complex",
        "rates_pressure",
        "regime_drivers",
        "positioning_vs_candidate_sentiment",
        "tactical_stress_board",
    }
    actual_ids = {
        section["id"]
        for sections in mod.SECTION_CATALOG.values()
        for section in sections
    }
    assert actual_ids == expected_ids


# ---------------------------------------------------------------------------
# _derive_volatility_complex
# ---------------------------------------------------------------------------


def test_volatility_derive_returns_unavailable_when_data_missing():
    result = mod._derive_volatility_complex({})
    assert result["freshness_status"] == "unavailable"
    assert "not yet active" in result["answer"]


def test_volatility_derive_returns_stale_when_curve_empty():
    loaded = {
        "volatility_dashboard": {
            "latest_curve": [],
            "hidden_stress": [{"date": "2024-01-01", "state": "calm"}],
        }
    }
    result = mod._derive_volatility_complex(loaded)
    assert result["freshness_status"] == "stale"


def test_volatility_derive_returns_ok_with_fixture():
    loaded = {
        "volatility_dashboard": {
            "latest_curve": [{"tenor": "9D", "value": 14.0, "percentile_5y": 0.4}],
            "hidden_stress": [{"date": "2024-01-01", "state": "calm"}],
        }
    }
    result = mod._derive_volatility_complex(loaded)
    assert result["freshness_status"] == "ok"
    assert "contained" in result["answer"]
    assert result["support"] is not None
    assert result["risk"] is None


def test_volatility_derive_watch_state():
    loaded = {
        "volatility_dashboard": {
            "latest_curve": [{"tenor": "9D", "value": 18.0, "percentile_5y": 0.6}],
            "hidden_stress": [{"date": "2024-01-01", "state": "watch"}],
        }
    }
    result = mod._derive_volatility_complex(loaded)
    assert result["freshness_status"] == "ok"
    assert result["risk"] is not None
    assert result["support"] is None


def test_volatility_derive_elevated_state():
    loaded = {
        "volatility_dashboard": {
            "latest_curve": [{"tenor": "9D", "value": 30.0, "percentile_5y": 0.9}],
            "hidden_stress": [{"date": "2024-01-01", "state": "elevated"}],
        }
    }
    result = mod._derive_volatility_complex(loaded)
    assert result["freshness_status"] == "ok"
    assert "elevated" in result["answer"].lower()


# ---------------------------------------------------------------------------
# _derive_rates_pressure
# ---------------------------------------------------------------------------


def test_rates_derive_returns_unavailable_when_data_missing():
    result = mod._derive_rates_pressure({})
    assert result["freshness_status"] == "unavailable"
    assert "not yet active" in result["answer"]


def test_rates_derive_returns_stale_when_windows_missing():
    loaded = {
        "rates_dashboard": {
            "current_decomposition": {"nominal_10y_pct": 4.4, "real_yield_10y_pct": 2.0, "breakeven_10y_pct": 2.4}
        }
    }
    result = mod._derive_rates_pressure(loaded)
    assert result["freshness_status"] == "stale"


def test_rates_derive_returns_ok_real_yield_driver():
    loaded = {
        "rates_dashboard": {
            "yield_change_windows": {
                "1M": {"nominal_10y_bps": 20.0, "real_yield_10y_bps": 18.0, "breakeven_10y_bps": 2.0, "driver": "real_yield"},
                "3M": {"nominal_10y_bps": 15.0, "real_yield_10y_bps": 10.0, "breakeven_10y_bps": 5.0, "driver": "real_yield"},
                "6M": {"nominal_10y_bps": 10.0, "real_yield_10y_bps": 8.0, "breakeven_10y_bps": 2.0, "driver": "real_yield"},
                "1Y": {"nominal_10y_bps": 5.0, "real_yield_10y_bps": 3.0, "breakeven_10y_bps": 2.0, "driver": "real_yield"},
            },
            "current_decomposition": {"nominal_10y_pct": 4.4, "real_yield_10y_pct": 2.0, "breakeven_10y_pct": 2.4},
        }
    }
    result = mod._derive_rates_pressure(loaded)
    assert result["freshness_status"] == "ok"
    assert "real yield" in result["answer"].lower()
    assert 60 <= len(result["answer"]) <= 200


def test_rates_derive_returns_ok_breakeven_driver():
    loaded = {
        "rates_dashboard": {
            "yield_change_windows": {
                "1M": {"nominal_10y_bps": 15.0, "real_yield_10y_bps": 2.0, "breakeven_10y_bps": 13.0, "driver": "breakeven"},
                "3M": {"nominal_10y_bps": 10.0, "real_yield_10y_bps": 1.0, "breakeven_10y_bps": 9.0, "driver": "breakeven"},
                "6M": {"nominal_10y_bps": 8.0, "real_yield_10y_bps": 2.0, "breakeven_10y_bps": 6.0, "driver": "breakeven"},
                "1Y": {"nominal_10y_bps": 5.0, "real_yield_10y_bps": 1.0, "breakeven_10y_bps": 4.0, "driver": "breakeven"},
            },
            "current_decomposition": {"nominal_10y_pct": 4.4, "real_yield_10y_pct": 2.0, "breakeven_10y_pct": 2.4},
        }
    }
    result = mod._derive_rates_pressure(loaded)
    assert result["freshness_status"] == "ok"
    assert "breakeven" in result["answer"].lower()


def test_rates_derive_balanced_driver():
    loaded = {
        "rates_dashboard": {
            "yield_change_windows": {
                "1M": {"nominal_10y_bps": 20.0, "real_yield_10y_bps": 10.0, "breakeven_10y_bps": 10.0, "driver": "balanced"},
                "3M": {"nominal_10y_bps": 15.0, "real_yield_10y_bps": 8.0, "breakeven_10y_bps": 7.0, "driver": "balanced"},
                "6M": {"nominal_10y_bps": 10.0, "real_yield_10y_bps": 5.0, "breakeven_10y_bps": 5.0, "driver": "balanced"},
                "1Y": {"nominal_10y_bps": 5.0, "real_yield_10y_bps": 2.0, "breakeven_10y_bps": 3.0, "driver": "balanced"},
            },
            "current_decomposition": {"nominal_10y_pct": 4.4, "real_yield_10y_pct": 2.0, "breakeven_10y_pct": 2.4},
        }
    }
    result = mod._derive_rates_pressure(loaded)
    assert result["freshness_status"] == "ok"
    assert "both" in result["answer"].lower()


# ---------------------------------------------------------------------------
# _derive_regime_drivers
# ---------------------------------------------------------------------------


def test_regime_derive_returns_unavailable_when_data_missing():
    result = mod._derive_regime_drivers({})
    assert result["freshness_status"] == "unavailable"
    assert "not yet active" in result["answer"]


def test_regime_derive_returns_stale_when_windows_empty():
    loaded = {
        "regime_dashboard": {
            "windows": {"20D": [], "60D": [], "120D": []},
            "thresholds": {"real_yield_neutral_bps": 5.0, "dollar_neutral_pct": 0.5},
        }
    }
    result = mod._derive_regime_drivers(loaded)
    assert result["freshness_status"] == "stale"


def test_regime_derive_joint_tightening():
    loaded = {
        "regime_dashboard": {
            "windows": {
                "20D": [{"date": "2024-01-01", "real_yield_change_bps": 20.0, "dollar_change_pct": 2.0, "regime": "global_tightening_risk_off", "vix_percentile": 50.0, "credit_change_bps": 0.0, "fragility_score": 0.2}],
            },
            "thresholds": {"real_yield_neutral_bps": 5.0, "dollar_neutral_pct": 0.5},
        }
    }
    result = mod._derive_regime_drivers(loaded)
    assert result["freshness_status"] == "ok"
    assert "tightening" in result["answer"].lower()
    assert result["risk"] is not None


def test_regime_derive_joint_easing():
    loaded = {
        "regime_dashboard": {
            "windows": {
                "20D": [{"date": "2024-01-01", "real_yield_change_bps": -20.0, "dollar_change_pct": -2.0, "regime": "risk_on_easing", "vix_percentile": 20.0, "credit_change_bps": -10.0, "fragility_score": 0.1}],
            },
            "thresholds": {"real_yield_neutral_bps": 5.0, "dollar_neutral_pct": 0.5},
        }
    }
    result = mod._derive_regime_drivers(loaded)
    assert result["freshness_status"] == "ok"
    assert "easing" in result["answer"].lower()
    assert result["support"] is not None


def test_regime_derive_neutral_range():
    loaded = {
        "regime_dashboard": {
            "windows": {
                "20D": [{"date": "2024-01-01", "real_yield_change_bps": 1.0, "dollar_change_pct": 0.1, "regime": "mixed", "vix_percentile": 40.0, "credit_change_bps": 0.0, "fragility_score": 0.2}],
            },
            "thresholds": {"real_yield_neutral_bps": 5.0, "dollar_neutral_pct": 0.5},
        }
    }
    result = mod._derive_regime_drivers(loaded)
    assert result["freshness_status"] == "ok"
    assert "neutral" in result["answer"].lower()


# ---------------------------------------------------------------------------
# _derive_positioning
# ---------------------------------------------------------------------------


def test_positioning_derive_returns_unavailable_when_data_missing():
    result = mod._derive_positioning({})
    assert result["freshness_status"] == "unavailable"
    assert "not yet active" in result["answer"]


def test_positioning_derive_returns_stale_when_observations_empty():
    loaded = {
        "cftc_sp500_asset_mgr_net": {
            "observations": [],
        }
    }
    result = mod._derive_positioning(loaded)
    assert result["freshness_status"] == "stale"


def test_positioning_derive_crowded():
    loaded = {
        "cftc_sp500_asset_mgr_net": {
            "observations": [
                {"date": "2024-01-01", "value": 55.0, "percentile_252d": 92.0}
            ]
        }
    }
    result = mod._derive_positioning(loaded)
    assert result["freshness_status"] == "ok"
    assert "crowded" in result["answer"].lower()
    assert result["risk"] is not None


def test_positioning_derive_washed_out():
    loaded = {
        "cftc_sp500_asset_mgr_net": {
            "observations": [
                {"date": "2024-01-01", "value": -20.0, "percentile_252d": 8.0}
            ]
        }
    }
    result = mod._derive_positioning(loaded)
    assert result["freshness_status"] == "ok"
    assert "washed out" in result["answer"].lower()
    assert result["support"] is not None


def test_positioning_derive_neutral():
    loaded = {
        "cftc_sp500_asset_mgr_net": {
            "observations": [
                {"date": "2024-01-01", "value": 30.0, "percentile_252d": 55.0}
            ]
        }
    }
    result = mod._derive_positioning(loaded)
    assert result["freshness_status"] == "ok"
    assert "neutral" in result["answer"].lower()


def test_positioning_derive_graceful_without_naaim():
    """NAAIM absent — must succeed without it."""
    loaded = {
        "cftc_sp500_asset_mgr_net": {
            "observations": [
                {"date": "2024-01-01", "value": 50.0, "percentile_252d": 90.0}
            ]
        },
        # no naaim_exposure_candidate key at all
    }
    result = mod._derive_positioning(loaded)
    assert result["freshness_status"] == "ok"


def test_positioning_derive_graceful_with_naaim_none():
    """NAAIM present but set to None (file not loaded) — must succeed."""
    loaded = {
        "cftc_sp500_asset_mgr_net": {
            "observations": [
                {"date": "2024-01-01", "value": 50.0, "percentile_252d": 90.0}
            ]
        },
        "naaim_exposure_candidate": None,
    }
    result = mod._derive_positioning(loaded)
    assert result["freshness_status"] == "ok"


# ---------------------------------------------------------------------------
# _derive_tactical_stress
# ---------------------------------------------------------------------------


def test_tactical_derive_returns_unavailable_when_data_missing():
    result = mod._derive_tactical_stress({})
    assert result["freshness_status"] == "unavailable"
    assert "not yet active" in result["answer"]


def test_tactical_derive_returns_stale_when_warnings_not_list():
    loaded = {
        "signal_priority": {
            "top_warnings": None,
            "top_supports": [],
        }
    }
    result = mod._derive_tactical_stress(loaded)
    assert result["freshness_status"] == "stale"


def test_tactical_derive_no_warnings():
    loaded = {
        "signal_priority": {
            "top_warnings": [],
            "top_supports": [
                {"id": "credit_spreads", "label": "Credit spreads", "severity": 50.0}
            ],
        }
    }
    result = mod._derive_tactical_stress(loaded)
    assert result["freshness_status"] == "ok"
    assert "no active warnings" in result["answer"].lower()
    assert result["support"] is not None


def test_tactical_derive_low_severity_warnings():
    loaded = {
        "signal_priority": {
            "top_warnings": [
                {"id": "net_liquidity", "label": "Net liquidity", "severity": 25.0},
            ],
            "top_supports": [],
        }
    }
    result = mod._derive_tactical_stress(loaded)
    assert result["freshness_status"] == "ok"
    assert "low-severity" in result["answer"].lower()


def test_tactical_derive_some_elevated_warnings():
    loaded = {
        "signal_priority": {
            "top_warnings": [
                {"id": "real_yields", "label": "Real yields", "severity": 55.0},
                {"id": "net_liquidity", "label": "Net liquidity", "severity": 28.0},
            ],
            "top_supports": [
                {"id": "credit_spreads", "label": "Credit spreads", "severity": 48.0}
            ],
        }
    }
    result = mod._derive_tactical_stress(loaded)
    assert result["freshness_status"] == "ok"
    assert "1" in result["answer"]  # 1 elevated warning


def test_tactical_derive_multiple_elevated_warnings():
    loaded = {
        "signal_priority": {
            "top_warnings": [
                {"id": "inflation", "label": "Inflation pressure", "severity": 100.0},
                {"id": "real_yields", "label": "Real yields", "severity": 55.0},
                {"id": "commodities", "label": "Commodities inflation impulse", "severity": 48.0},
                {"id": "net_liquidity", "label": "Net liquidity", "severity": 27.0},
            ],
            "top_supports": [],
        }
    }
    result = mod._derive_tactical_stress(loaded)
    assert result["freshness_status"] == "ok"
    assert result["risk"] is not None
    assert 60 <= len(result["answer"]) <= 200
