"""Tests for the SECTION_CATALOG and its derive functions.

Each derive function is tested for:
- Missing-data branch (empty ``loaded`` dict) → ``freshness_status="unavailable"``
- With-fixture branch (minimal valid payload) → ``freshness_status="ok"``

Twelve placements ship: the original 5 (Volatility, Rates, Regime, Sentiment,
Tactical) plus the 7 channel-tab follow-ups (Liquidity, Credit, Dollar,
Commodities, Growth, Housing, Inflation).
"""
from __future__ import annotations

import pytest

from scripts.transform import build_page_insights as mod


# ---------------------------------------------------------------------------
# Catalog structure
# ---------------------------------------------------------------------------


def test_section_catalog_has_twelve_entries():
    total = sum(len(v) for v in mod.SECTION_CATALOG.values())
    assert total == 12


def test_section_catalog_route_keys():
    assert set(mod.SECTION_CATALOG.keys()) == {
        "volatility",
        "rates",
        "regime_map",
        "sentiment",
        "tactical",
        # 7 channel-tab follow-ups
        "liquidity",
        "credit",
        "dollar_global",
        "commodities",
        "growth",
        "housing",
        "inflation",
    }


def test_section_catalog_ids():
    expected_ids = {
        "volatility_complex",
        "rates_pressure",
        "regime_drivers",
        "positioning_vs_candidate_sentiment",
        "tactical_stress_board",
        # 7 channel-tab follow-ups
        "liquidity_funding",
        "credit_dispersion",
        "dollar_pressure",
        "commodity_impulse",
        "growth_breadth",
        "housing_pulse",
        "inflation_dispersion",
    }
    actual_ids = {
        section["id"]
        for sections in mod.SECTION_CATALOG.values()
        for section in sections
    }
    assert actual_ids == expected_ids


def test_section_catalog_questions_within_120_chars():
    """All section questions must be <= 120 chars per the FocusBlock contract."""
    for sections in mod.SECTION_CATALOG.values():
        for section in sections:
            assert len(section["question"]) <= 120, (
                f"section {section['id']!r} question is {len(section['question'])} chars"
            )


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


# ---------------------------------------------------------------------------
# Channel-tab follow-up: helper fixtures
# ---------------------------------------------------------------------------


def _monthly_series(values: list[float], start: str = "2024-01-01") -> dict:
    """Build a minimal monthly-cadence observations payload."""
    import datetime as _dt
    y, m, d = (int(p) for p in start.split("-"))
    out = []
    for i, value in enumerate(values):
        # Step month-by-month without external dependencies.
        month = m + i
        year = y + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        out.append({
            "date": _dt.date(year, month, d).isoformat(),
            "value": float(value),
            "percentile_252d": 50.0,
        })
    return {"observations": out}


def _daily_series(values: list[float]) -> dict:
    """Build a minimal daily-cadence observations payload (continuous business days)."""
    import datetime as _dt
    base = _dt.date(2024, 1, 1)
    out = []
    for i, value in enumerate(values):
        out.append({
            "date": (base + _dt.timedelta(days=i)).isoformat(),
            "value": float(value),
            "percentile_252d": 50.0,
        })
    return {"observations": out}


# ---------------------------------------------------------------------------
# _derive_liquidity_funding
# ---------------------------------------------------------------------------


def test_liquidity_derive_returns_unavailable_when_data_missing():
    result = mod._derive_liquidity_funding({})
    assert result["freshness_status"] == "unavailable"
    assert "not yet active" in result["answer"]


def test_liquidity_derive_returns_stale_when_history_short():
    loaded = {"net_liquidity": {"observations": [{"date": "2024-01-01", "value": 5_000_000.0}]}}
    result = mod._derive_liquidity_funding(loaded)
    assert result["freshness_status"] == "stale"


def test_liquidity_derive_expanding():
    obs = [{"date": f"2024-01-{i+1:02d}", "value": 5_000_000.0 + 10_000.0 * i} for i in range(8)]
    result = mod._derive_liquidity_funding({"net_liquidity": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "expanding" in result["answer"].lower()
    assert result["support"] is not None
    assert result["risk"] is None


def test_liquidity_derive_contracting():
    obs = [{"date": f"2024-01-{i+1:02d}", "value": 5_000_000.0 - 10_000.0 * i} for i in range(8)]
    result = mod._derive_liquidity_funding({"net_liquidity": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "contracting" in result["answer"].lower()
    assert result["risk"] is not None
    assert result["support"] is None


def test_liquidity_derive_flat():
    obs = [{"date": f"2024-01-{i+1:02d}", "value": 5_000_000.0} for i in range(8)]
    result = mod._derive_liquidity_funding({"net_liquidity": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "flat" in result["answer"].lower()


# ---------------------------------------------------------------------------
# _derive_credit_dispersion
# ---------------------------------------------------------------------------


def test_credit_derive_returns_unavailable_when_data_missing():
    result = mod._derive_credit_dispersion({})
    assert result["freshness_status"] == "unavailable"


def test_credit_derive_returns_stale_when_history_short():
    obs = [{"date": "2024-01-01", "value": 2.0}]
    result = mod._derive_credit_dispersion({"hy_minus_ig_oas": {"observations": obs}})
    assert result["freshness_status"] == "stale"


def test_credit_derive_widening():
    values = [2.0] * 22 + [2.5]  # +0.5pp over 21 trading days
    obs = [{"date": f"2024-01-{i+1:02d}", "value": v} for i, v in enumerate(values[:25])]
    result = mod._derive_credit_dispersion({"hy_minus_ig_oas": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "widening" in result["answer"].lower()
    assert result["risk"] is not None


def test_credit_derive_tightening():
    values = [2.5] * 22 + [2.0]  # -0.5pp over 21 trading days
    obs = [{"date": f"2024-01-{i+1:02d}", "value": v} for i, v in enumerate(values[:25])]
    result = mod._derive_credit_dispersion({"hy_minus_ig_oas": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "tightening" in result["answer"].lower()
    assert result["support"] is not None


def test_credit_derive_stable():
    values = [2.5] * 22 + [2.51]  # +0.01pp, below threshold
    obs = [{"date": f"2024-01-{i+1:02d}", "value": v} for i, v in enumerate(values[:25])]
    result = mod._derive_credit_dispersion({"hy_minus_ig_oas": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "stable" in result["answer"].lower()


# ---------------------------------------------------------------------------
# _derive_dollar_pressure
# ---------------------------------------------------------------------------


def test_dollar_derive_returns_unavailable_when_data_missing():
    result = mod._derive_dollar_pressure({})
    assert result["freshness_status"] == "unavailable"


def test_dollar_derive_returns_stale_when_history_short():
    obs = [{"date": "2024-01-01", "value": 100.0}]
    result = mod._derive_dollar_pressure({"broad_dollar": {"observations": obs}})
    assert result["freshness_status"] == "stale"


def test_dollar_derive_strengthening():
    values = [100.0] * 22 + [102.0]  # +2% over 21 days
    obs = [{"date": f"2024-01-{i+1:02d}", "value": v} for i, v in enumerate(values[:25])]
    result = mod._derive_dollar_pressure({"broad_dollar": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "strengthening" in result["answer"].lower()
    assert result["risk"] is not None


def test_dollar_derive_weakening():
    values = [100.0] * 22 + [98.0]  # -2% over 21 days
    obs = [{"date": f"2024-01-{i+1:02d}", "value": v} for i, v in enumerate(values[:25])]
    result = mod._derive_dollar_pressure({"broad_dollar": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "weakening" in result["answer"].lower()
    assert result["support"] is not None


def test_dollar_derive_stable():
    values = [100.0] * 22 + [100.1]  # +0.1%, below threshold
    obs = [{"date": f"2024-01-{i+1:02d}", "value": v} for i, v in enumerate(values[:25])]
    result = mod._derive_dollar_pressure({"broad_dollar": {"observations": obs}})
    assert result["freshness_status"] == "ok"
    assert "stable" in result["answer"].lower()


# ---------------------------------------------------------------------------
# _derive_commodity_impulse
# ---------------------------------------------------------------------------


def test_commodity_derive_returns_unavailable_when_data_missing():
    result = mod._derive_commodity_impulse({})
    assert result["freshness_status"] == "unavailable"


def test_commodity_derive_returns_stale_when_empty():
    result = mod._derive_commodity_impulse({"commodity_inflation_impulse": {"observations": []}})
    assert result["freshness_status"] == "stale"


def test_commodity_derive_rising_impulse():
    loaded = {
        "commodity_inflation_impulse": {
            "observations": [{"date": "2024-01-01", "value": 15.0, "percentile_252d": 85.0}]
        }
    }
    result = mod._derive_commodity_impulse(loaded)
    assert result["freshness_status"] == "ok"
    assert "adding to inflation pressure" in result["answer"].lower()
    assert result["risk"] is not None


def test_commodity_derive_falling_impulse():
    loaded = {
        "commodity_inflation_impulse": {
            "observations": [{"date": "2024-01-01", "value": -15.0, "percentile_252d": 15.0}]
        }
    }
    result = mod._derive_commodity_impulse(loaded)
    assert result["freshness_status"] == "ok"
    assert "subtracting from inflation pressure" in result["answer"].lower()
    assert result["support"] is not None


def test_commodity_derive_neutral():
    loaded = {
        "commodity_inflation_impulse": {
            "observations": [{"date": "2024-01-01", "value": 0.5, "percentile_252d": 50.0}]
        }
    }
    result = mod._derive_commodity_impulse(loaded)
    assert result["freshness_status"] == "ok"
    assert "neutral" in result["answer"].lower()


# ---------------------------------------------------------------------------
# _derive_growth_breadth
# ---------------------------------------------------------------------------


def test_growth_derive_returns_unavailable_when_data_missing():
    result = mod._derive_growth_breadth({})
    assert result["freshness_status"] == "unavailable"


def test_growth_derive_returns_stale_when_too_few_inputs():
    loaded = {"unemployment_rate": _monthly_series([4.0] * 13)}
    result = mod._derive_growth_breadth(loaded)
    assert result["freshness_status"] == "stale"


def test_growth_derive_firm():
    """All five inputs are in constructive territory."""
    loaded = {
        "unemployment_rate": _monthly_series([4.0] * 13),  # flat -> 12m change 0 -> firm
        "nonfarm_payrolls": _monthly_series([150_000, 250_000]),  # rising -> firm
        "cfnai_3m_avg": _monthly_series([0.2]),  # >= -0.7 -> firm
        "industrial_production": _monthly_series([100.0, 101.0, 102.0, 103.0]),  # 3m up -> firm
        "initial_claims": _monthly_series([220.0]),  # < 350 -> firm
    }
    result = mod._derive_growth_breadth(loaded)
    assert result["freshness_status"] == "ok"
    assert "firm" in result["answer"].lower()
    assert result["support"] is not None


def test_growth_derive_softening():
    """Few inputs in constructive territory."""
    loaded = {
        "unemployment_rate": _monthly_series([4.0] * 12 + [5.5]),  # rising 1.5 -> not firm
        "nonfarm_payrolls": _monthly_series([300_000, 100_000]),  # falling -> not firm
        "cfnai_3m_avg": _monthly_series([-1.5]),  # < -0.7 -> not firm
        "industrial_production": _monthly_series([100.0, 99.0, 98.0, 97.0]),  # 3m down -> not firm
        "initial_claims": _monthly_series([400.0]),  # > 350 -> not firm
    }
    result = mod._derive_growth_breadth(loaded)
    assert result["freshness_status"] == "ok"
    assert "softening" in result["answer"].lower()
    assert result["risk"] is not None


def test_growth_derive_mixed():
    loaded = {
        "unemployment_rate": _monthly_series([4.0] * 13),  # flat -> firm
        "nonfarm_payrolls": _monthly_series([300_000, 100_000]),  # falling -> not firm
        "cfnai_3m_avg": _monthly_series([-1.5]),  # not firm
        "industrial_production": _monthly_series([100.0, 99.0, 98.0, 97.0]),  # not firm
        "initial_claims": _monthly_series([220.0]),  # firm
    }
    result = mod._derive_growth_breadth(loaded)
    assert result["freshness_status"] == "ok"
    assert "mixed" in result["answer"].lower()


# ---------------------------------------------------------------------------
# _derive_housing_pulse
# ---------------------------------------------------------------------------


def test_housing_derive_returns_unavailable_when_data_missing():
    result = mod._derive_housing_pulse({})
    assert result["freshness_status"] == "unavailable"


def test_housing_derive_returns_stale_when_observations_empty():
    loaded = {
        "housing_starts": {"observations": []},
        "building_permits": {"observations": []},
        "mortgage_rate_30y": {"observations": []},
    }
    result = mod._derive_housing_pulse(loaded)
    assert result["freshness_status"] == "stale"


def test_housing_derive_contracting_at_elevated_rate():
    loaded = {
        "housing_starts": _monthly_series([1500.0, 1450.0, 1400.0, 1300.0]),
        "building_permits": _monthly_series([1500.0, 1450.0, 1400.0, 1300.0]),
        "mortgage_rate_30y": _monthly_series([6.5]),
    }
    result = mod._derive_housing_pulse(loaded)
    assert result["freshness_status"] == "ok"
    assert "contracting" in result["answer"].lower()
    assert result["risk"] is not None


def test_housing_derive_resilient_at_elevated_rate():
    loaded = {
        "housing_starts": _monthly_series([1300.0, 1400.0, 1450.0, 1500.0]),
        "building_permits": _monthly_series([1300.0, 1400.0, 1450.0, 1500.0]),
        "mortgage_rate_30y": _monthly_series([6.5]),
    }
    result = mod._derive_housing_pulse(loaded)
    assert result["freshness_status"] == "ok"
    assert "resilient" in result["answer"].lower()
    assert result["support"] is not None


def test_housing_derive_expanding_at_moderate_rate():
    loaded = {
        "housing_starts": _monthly_series([1300.0, 1400.0, 1450.0, 1500.0]),
        "building_permits": _monthly_series([1300.0, 1400.0, 1450.0, 1500.0]),
        "mortgage_rate_30y": _monthly_series([5.0]),
    }
    result = mod._derive_housing_pulse(loaded)
    assert result["freshness_status"] == "ok"
    assert "expanding" in result["answer"].lower()
    assert result["support"] is not None


def test_housing_derive_softening_at_moderate_rate():
    loaded = {
        "housing_starts": _monthly_series([1500.0, 1450.0, 1400.0, 1300.0]),
        "building_permits": _monthly_series([1500.0, 1450.0, 1400.0, 1300.0]),
        "mortgage_rate_30y": _monthly_series([5.0]),
    }
    result = mod._derive_housing_pulse(loaded)
    assert result["freshness_status"] == "ok"
    assert "softening" in result["answer"].lower()
    assert result["risk"] is not None


# ---------------------------------------------------------------------------
# _derive_inflation_dispersion
# ---------------------------------------------------------------------------


def test_inflation_derive_returns_unavailable_when_data_missing():
    result = mod._derive_inflation_dispersion({})
    assert result["freshness_status"] == "unavailable"


def test_inflation_derive_returns_stale_when_history_short():
    loaded = {
        "headline_cpi": _monthly_series([300.0] * 5),
        "core_cpi": _monthly_series([300.0] * 5),
    }
    result = mod._derive_inflation_dispersion(loaded)
    assert result["freshness_status"] == "stale"


def test_inflation_derive_aligned_disinflating():
    # Build sequences where the most recent YoY is lower than the prior YoY,
    # for both headline and core (aligned disinflation).
    # 26 months: index rising but at decelerating rate
    # Year 1: 100, 101, 102, ..., 112 (steep rise) — Year 2 YoY at month 12 = 12/100 = 12%
    # Year 2: 113, 114, ..., 124 (slower rise) — YoY at last month = (124-112)/112 ~ 10.7%
    # Prior YoY (drop the last point): YoY for month 11 = (123-111)/111 ~ 10.8%
    # We need now < prior. Let's use a tapering schedule.
    headline_vals = [100.0]
    for delta in [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
                  0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.8, 0.7]:
        headline_vals.append(headline_vals[-1] + delta)
    core_vals = list(headline_vals)
    loaded = {
        "headline_cpi": _monthly_series(headline_vals),
        "core_cpi": _monthly_series(core_vals),
    }
    result = mod._derive_inflation_dispersion(loaded)
    assert result["freshness_status"] == "ok"
    assert "disinflating" in result["answer"].lower() or "aligned" in result["answer"].lower()


def test_inflation_derive_aligned_rising():
    # Year 1: 100, 101, ..., 112 (slow rise) -> Year 2 ramping rise.
    headline_vals = [100.0]
    for delta in [0.5] * 12 + [1.0] * 12 + [1.5, 2.0]:
        headline_vals.append(headline_vals[-1] + delta)
    core_vals = list(headline_vals)
    loaded = {
        "headline_cpi": _monthly_series(headline_vals),
        "core_cpi": _monthly_series(core_vals),
    }
    result = mod._derive_inflation_dispersion(loaded)
    assert result["freshness_status"] == "ok"
    assert "rising" in result["answer"].lower() or "aligned" in result["answer"].lower()


def test_inflation_derive_diverging_headline_up_core_down():
    # Headline accelerating, core decelerating.
    headline_vals = [100.0]
    for delta in [0.5] * 12 + [1.0] * 12 + [1.5, 2.0]:
        headline_vals.append(headline_vals[-1] + delta)
    core_vals = [100.0]
    for delta in [1.0] * 13 + [0.9] * 11 + [0.8, 0.7]:
        core_vals.append(core_vals[-1] + delta)
    loaded = {
        "headline_cpi": _monthly_series(headline_vals),
        "core_cpi": _monthly_series(core_vals),
    }
    result = mod._derive_inflation_dispersion(loaded)
    assert result["freshness_status"] == "ok"
    assert "diverging" in result["answer"].lower() or "headline" in result["answer"].lower()
