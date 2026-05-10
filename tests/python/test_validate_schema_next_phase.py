"""Schema validation tests for the four Wave-1 derived dashboards.

Each validator must:
- Accept a well-formed fixture.
- Reject at least one known-bad fixture (missing/extra fields, off-spec
  enum, etc.).

The page_insights validator additionally enforces the source-gating
invariant — primary_warning/primary_support source_status must NEVER be
'terms_review_needed' or 'candidate'. This converts the gating rule from
a build-time guarantee into a static-data invariant.
"""
from __future__ import annotations

import json

import pytest

from scripts.validate import validate_schema


# ----- Fixtures ------------------------------------------------------------


def _good_page_insights() -> dict:
    return {
        "generated_at_utc": "2026-05-10T09:30:00Z",
        "date": "2026-05-08",
        "method_version": "phase8-pr1-page-insights-v1",
        "routes": {
            "rates": {
                "title": "Rates",
                "state": "risk",
                "primary_warning": {
                    "id": "real_yields",
                    "label": "10Y real yields",
                    "message": "Real yields are elevated.",
                    "why_it_matters": "Higher real yields tighten conditions.",
                    "severity": 45.0,
                    "freshness_status": "ok",
                    "confidence": 0.95,
                    "source_status": "free_public",
                },
                "why_it_matters": "Higher real yields tighten conditions.",
                "confidence": 0.95,
                "freshness_notes": [],
            },
            "credit": {
                "title": "Credit",
                "state": "support",
                "primary_support": {
                    "id": "credit_spreads",
                    "label": "Credit spreads",
                    "message": "Credit spread pressure is contained.",
                    "why_it_matters": "Credit spreads confirm risk transmission.",
                    "severity": 50.0,
                    "freshness_status": "ok",
                    "confidence": 0.95,
                    "source_status": "free_public",
                },
                "why_it_matters": "Credit spreads confirm risk transmission.",
                "confidence": 0.95,
                "freshness_notes": [],
            },
        },
    }


def _good_volatility_dashboard() -> dict:
    return {
        "generated_at_utc": "2026-05-10T09:30:00Z",
        "date": "2026-05-08",
        "method_version": "phase8-pr1-volatility-dashboard-v1",
        "latest_curve": [
            {"tenor": "9D", "value": 14.21, "percentile_5y": 31.98},
            {"tenor": "30D", "value": 17.19, "percentile_5y": 43.49},
            {"tenor": "3M", "value": 20.5, "percentile_5y": 49.13},
        ],
        "ratio_history": [
            {"date": "2026-05-08", "vix9d_vix": 0.95, "vix_vix3m": 0.94}
        ],
        "hidden_stress": [
            {
                "date": "2026-05-08",
                "vix_value": 17.19,
                "vvix_value": 96.78,
                "vix_percentile": 43.1,
                "vvix_percentile": 48.81,
                "hidden_stress_score": 5.71,
                "state": "calm",
            }
        ],
        "thresholds": {
            "vix9d_vix_calm": 0.95,
            "vix9d_vix_stress": 1.05,
            "vix_vix3m_calm": 0.95,
            "vix_vix3m_stress": 1.0,
            "hidden_stress_watch": 15.0,
            "hidden_stress_elevated": 30.0,
        },
    }


def _good_rates_dashboard() -> dict:
    return {
        "generated_at_utc": "2026-05-10T09:30:00Z",
        "date": "2026-05-08",
        "method_version": "phase8-pr1-rates-dashboard-v1",
        "yield_change_windows": {
            "1M": {
                "nominal_10y_bps": 12.0,
                "real_yield_10y_bps": 0.0,
                "breakeven_10y_bps": 11.0,
                "driver": "breakeven",
            },
            "3M": {
                "nominal_10y_bps": 19.0,
                "real_yield_10y_bps": 8.0,
                "breakeven_10y_bps": 10.0,
                "driver": "balanced",
            },
            "6M": {
                "nominal_10y_bps": 31.0,
                "real_yield_10y_bps": 15.0,
                "breakeven_10y_bps": 15.0,
                "driver": "balanced",
            },
            "1Y": {
                "nominal_10y_bps": 5.0,
                "real_yield_10y_bps": -12.0,
                "breakeven_10y_bps": 19.0,
                "driver": "breakeven",
            },
        },
        "current_decomposition": {
            "nominal_10y_pct": 4.41,
            "real_yield_10y_pct": 1.96,
            "breakeven_10y_pct": 2.45,
        },
        "curve_snapshots": {
            "current": [
                {"tenor": "2Y", "value": 3.92},
                {"tenor": "10Y", "value": 4.41},
            ],
            "one_month_ago": [{"tenor": "10Y", "value": 4.30}],
            "three_months_ago": [{"tenor": "10Y", "value": 4.20}],
            "one_year_ago": [{"tenor": "10Y", "value": 4.15}],
        },
        "decomposition_history": [
            {
                "date": "2026-05-08",
                "nominal_pct": 4.41,
                "real_pct": 1.96,
                "breakeven_pct": 2.45,
            }
        ],
    }


def _good_regime_dashboard() -> dict:
    return {
        "generated_at_utc": "2026-05-10T09:30:00Z",
        "date": "2026-05-01",
        "method_version": "phase8-pr1-regime-dashboard-v1",
        "windows": {
            "20D": [
                {
                    "date": "2026-05-01",
                    "real_yield_change_bps": -8.0,
                    "dollar_change_pct": -1.876,
                    "vix_percentile": 46.03,
                    "credit_change_bps": -31.0,
                    "fragility_score": 0.213,
                    "regime": "risk_on_easing",
                }
            ],
            "60D": [
                {
                    "date": "2026-05-01",
                    "real_yield_change_bps": -3.0,
                    "dollar_change_pct": -2.0,
                    "vix_percentile": 50.0,
                    "credit_change_bps": -10.0,
                    "fragility_score": 0.213,
                    "regime": "mixed",
                }
            ],
            "120D": [
                {
                    "date": "2026-05-01",
                    "real_yield_change_bps": 7.0,
                    "dollar_change_pct": 1.5,
                    "vix_percentile": 50.0,
                    "credit_change_bps": 5.0,
                    "fragility_score": 0.213,
                    "regime": "global_tightening_risk_off",
                }
            ],
        },
        "thresholds": {
            "real_yield_neutral_bps": 5.0,
            "dollar_neutral_pct": 0.5,
        },
    }


def _write(tmp_path, filename: str, payload: dict) -> None:
    derived = tmp_path / "derived"
    derived.mkdir(parents=True, exist_ok=True)
    (derived / filename).write_text(json.dumps(payload), encoding="utf-8")


# ----- page_insights validator --------------------------------------------


def test_page_insights_accepts_well_formed_fixture(tmp_path, monkeypatch):
    _write(tmp_path, "page_insights.json", _good_page_insights())
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    validate_schema.validate_page_insights_file()


def test_page_insights_rejects_invalid_state_enum(tmp_path, monkeypatch):
    payload = _good_page_insights()
    payload["routes"]["rates"]["state"] = "yesterday"
    _write(tmp_path, "page_insights.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="state"):
        validate_schema.validate_page_insights_file()


def test_page_insights_rejects_invalid_route_key(tmp_path, monkeypatch):
    payload = _good_page_insights()
    payload["routes"]["unknown_route"] = payload["routes"].pop("rates")
    _write(tmp_path, "page_insights.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="route"):
        validate_schema.validate_page_insights_file()


def test_page_insights_rejects_terms_review_needed_in_primary_warning(tmp_path, monkeypatch):
    """Source-gating invariant: gated source_status MUST NEVER appear in a
    primary slot."""
    payload = _good_page_insights()
    payload["routes"]["rates"]["primary_warning"]["source_status"] = "terms_review_needed"
    _write(tmp_path, "page_insights.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="source_status"):
        validate_schema.validate_page_insights_file()


def test_page_insights_rejects_candidate_in_primary_support(tmp_path, monkeypatch):
    payload = _good_page_insights()
    payload["routes"]["credit"]["primary_support"]["source_status"] = "candidate"
    _write(tmp_path, "page_insights.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="source_status"):
        validate_schema.validate_page_insights_file()


def test_page_insights_rejects_signal_ref_missing_required_field(tmp_path, monkeypatch):
    payload = _good_page_insights()
    del payload["routes"]["rates"]["primary_warning"]["why_it_matters"]
    _write(tmp_path, "page_insights.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="why_it_matters"):
        validate_schema.validate_page_insights_file()


# ----- volatility_dashboard validator -------------------------------------


def test_volatility_dashboard_accepts_well_formed(tmp_path, monkeypatch):
    _write(tmp_path, "volatility_dashboard.json", _good_volatility_dashboard())
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    validate_schema.validate_volatility_dashboard_file()


def test_volatility_dashboard_rejects_invalid_tenor_in_curve(tmp_path, monkeypatch):
    payload = _good_volatility_dashboard()
    payload["latest_curve"][0]["tenor"] = "1Y"  # not in enum
    _write(tmp_path, "volatility_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="tenor"):
        validate_schema.validate_volatility_dashboard_file()


def test_volatility_dashboard_rejects_missing_threshold_key(tmp_path, monkeypatch):
    payload = _good_volatility_dashboard()
    del payload["thresholds"]["hidden_stress_watch"]
    _write(tmp_path, "volatility_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="threshold|hidden_stress_watch"):
        validate_schema.validate_volatility_dashboard_file()


def test_volatility_dashboard_rejects_invalid_state_enum_in_hidden_stress(tmp_path, monkeypatch):
    payload = _good_volatility_dashboard()
    payload["hidden_stress"][0]["state"] = "alarming"
    _write(tmp_path, "volatility_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="state"):
        validate_schema.validate_volatility_dashboard_file()


# ----- rates_dashboard validator ------------------------------------------


def test_rates_dashboard_accepts_well_formed(tmp_path, monkeypatch):
    _write(tmp_path, "rates_dashboard.json", _good_rates_dashboard())
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    validate_schema.validate_rates_dashboard_file()


def test_rates_dashboard_rejects_invalid_window_key(tmp_path, monkeypatch):
    payload = _good_rates_dashboard()
    payload["yield_change_windows"]["2Y"] = payload["yield_change_windows"].pop("1Y")
    _write(tmp_path, "rates_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="window"):
        validate_schema.validate_rates_dashboard_file()


def test_rates_dashboard_rejects_invalid_driver_enum(tmp_path, monkeypatch):
    payload = _good_rates_dashboard()
    payload["yield_change_windows"]["1M"]["driver"] = "term_premium"
    _write(tmp_path, "rates_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="driver"):
        validate_schema.validate_rates_dashboard_file()


def test_rates_dashboard_rejects_invalid_curve_snapshot_tenor(tmp_path, monkeypatch):
    payload = _good_rates_dashboard()
    payload["curve_snapshots"]["current"][0]["tenor"] = "5Y"
    _write(tmp_path, "rates_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="tenor"):
        validate_schema.validate_rates_dashboard_file()


# ----- regime_dashboard validator -----------------------------------------


def test_regime_dashboard_accepts_well_formed(tmp_path, monkeypatch):
    _write(tmp_path, "regime_dashboard.json", _good_regime_dashboard())
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    validate_schema.validate_regime_dashboard_file()


def test_regime_dashboard_rejects_invalid_window_key(tmp_path, monkeypatch):
    payload = _good_regime_dashboard()
    payload["windows"]["240D"] = payload["windows"].pop("120D")
    _write(tmp_path, "regime_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="window"):
        validate_schema.validate_regime_dashboard_file()


def test_regime_dashboard_rejects_invalid_regime_enum(tmp_path, monkeypatch):
    payload = _good_regime_dashboard()
    payload["windows"]["20D"][0]["regime"] = "unknown_quadrant"
    _write(tmp_path, "regime_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="regime"):
        validate_schema.validate_regime_dashboard_file()


def test_regime_dashboard_rejects_missing_thresholds(tmp_path, monkeypatch):
    payload = _good_regime_dashboard()
    del payload["thresholds"]
    _write(tmp_path, "regime_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="thresholds"):
        validate_schema.validate_regime_dashboard_file()


def test_regime_dashboard_window_points_must_be_listed_chronologically(tmp_path, monkeypatch):
    """Each window's points should be spaced ≥ 1 observation apart, i.e. dates
    must be strictly increasing within a window."""
    payload = _good_regime_dashboard()
    payload["windows"]["20D"] = [
        {**payload["windows"]["20D"][0], "date": "2026-05-02"},
        {**payload["windows"]["20D"][0], "date": "2026-05-02"},  # duplicate -> reject
    ]
    _write(tmp_path, "regime_dashboard.json", payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)
    with pytest.raises(ValueError, match="date"):
        validate_schema.validate_regime_dashboard_file()
