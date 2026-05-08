import json

from scripts.transform import compute_regime_score
from scripts.transform.regime_replay import build_regime_replay
from scripts.validate import validate_schema


def make_series(series_id, values):
    return {
        "series_id": series_id,
        "frequency": "daily",
        "observations": [{"date": date, "value": value} for date, value in values],
    }


def test_replay_detects_tightening_risk_off_occurrences():
    dates = [f"2026-05-{day:02d}" for day in range(1, 31)]
    series_by_id = {
        "real_yield_10y": make_series(
            "real_yield_10y",
            [(date, 2.0 + index * 0.02) for index, date in enumerate(dates)],
        ),
        "broad_dollar": make_series(
            "broad_dollar",
            [(date, 120.0 + index * 0.15) for index, date in enumerate(dates)],
        ),
        "high_yield_oas": make_series(
            "high_yield_oas",
            [(date, 3.5 + index * 0.02) for index, date in enumerate(dates)],
        ),
        "vix_vix3m_ratio": make_series(
            "vix_vix3m_ratio",
            [(date, 0.92 + index * 0.008) for index, date in enumerate(dates)],
        ),
        "us10y": make_series(
            "us10y",
            [(date, 4.0 + index * 0.02) for index, date in enumerate(dates)],
        ),
    }

    replay = build_regime_replay(series_by_id, "2026-05-31T00:00:00Z")

    scenario = next(item for item in replay["scenarios"] if item["id"] == "tightening_risk_off")
    assert replay["method_version"] == "phase5-regime-replay-v1"
    assert scenario["occurrence_count"] > 0
    assert scenario["last_occurrence_date"] == "2026-05-30"
    assert scenario["description"].startswith("Real yields rising")
    assert "future_return_summary" not in scenario
    assert "descriptive context, not forecasts" in scenario["caveat"]


def test_replay_schema_rejects_forward_return_summary(tmp_path, monkeypatch):
    derived = tmp_path / "derived"
    derived.mkdir()
    payload = {
        "generated_at_utc": "2026-05-31T00:00:00Z",
        "method_version": "phase5-regime-replay-v1",
        "scenarios": [
            {
                "id": "tightening_risk_off",
                "label": "Tightening / risk-off",
                "description": "Real yields rising.",
                "occurrence_count": 1,
                "last_occurrence_date": "2026-05-30",
                "occurrences": [
                    {
                        "date": "2026-05-30",
                        "real_yield_20obs_change": 0.4,
                        "dollar_20obs_change": 3.0,
                        "credit_20obs_change": 0.4,
                        "vix_curve_20obs_change": 0.16,
                        "nominal_10y_20obs_change": 0.4,
                    }
                ],
                "caveat": "Historical regime occurrences are descriptive context, not forecasts.",
                "future_return_summary": {"spy_1m": 1.2},
            }
        ],
    }
    (derived / "regime_replay.json").write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    try:
        validate_schema.validate_regime_replay_file()
    except ValueError as error:
        assert "future_return_summary is not allowed" in str(error)
    else:
        raise AssertionError("regime replay schema accepted forward return summary")


def test_score_history_contains_current_scores_and_drivers(tmp_path, monkeypatch):
    derived = tmp_path / "derived"
    derived.mkdir()
    monkeypatch.setattr(compute_regime_score, "data_dir", lambda: tmp_path)

    history = compute_regime_score.build_score_history(
        {
            "scores": {
                "market_weather": {
                    "score": -6,
                    "recent_changes": ["VIX rose."],
                    "top_risks": ["Credit widened."],
                    "top_supports": [],
                },
                "macro_climate": {
                    "score": 12,
                    "recent_changes": ["Labor stable."],
                    "top_risks": [],
                    "top_supports": ["Growth firm."],
                },
                "fragility": {
                    "score": -22,
                    "recent_changes": ["Dollar strengthened."],
                    "top_risks": ["Dollar pressure."],
                    "top_supports": [],
                },
            },
            "date": "2026-05-06",
        },
        "2026-05-07T00:00:00Z",
    )

    assert history["method_version"] == "phase5-score-history-v1"
    assert history["observations"][-1]["date"] == "2026-05-06"
    assert history["observations"][-1]["market_weather"] == -6
    assert "Credit widened." in history["latest_attribution"]["market_weather"]["top_risks"]
