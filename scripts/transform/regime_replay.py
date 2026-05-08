from __future__ import annotations

from typing import Any


LOOKBACK_OBSERVATIONS = 20
METHOD_VERSION = "phase5-regime-replay-v1"
REPLAY_CAVEAT = "Historical regime occurrences are descriptive context, not forecasts."

SCENARIOS = [
    {
        "id": "tightening_risk_off",
        "label": "Tightening / risk-off",
        "description": "Real yields rising, dollar rising, and credit or volatility pressure rising.",
    },
    {
        "id": "strong_risk_on",
        "label": "Strong risk-on",
        "description": "Real yields falling, dollar falling, and credit or volatility pressure contained.",
    },
    {
        "id": "bonds_first_safe_haven",
        "label": "Bonds-first / safe haven",
        "description": "Real yields falling while the dollar rises and credit or volatility pressure is mixed.",
    },
    {
        "id": "reallocation_rotation",
        "label": "Reallocation / rotation",
        "description": "Real yields rising while the dollar does not confirm broad stress.",
    },
]


def _series_values_by_date(series: dict[str, Any]) -> dict[str, float]:
    values = {}
    for observation in series.get("observations", []):
        date = observation.get("date")
        value = observation.get("value")
        if isinstance(date, str) and isinstance(value, int | float) and not isinstance(value, bool):
            values[date] = float(value)
    return values


def _matched_dates(series_by_id: dict[str, dict[str, Any]], series_ids: list[str]) -> list[str]:
    date_sets = []
    for series_id in series_ids:
        series = series_by_id.get(series_id)
        if series is None:
            return []
        date_sets.append(set(_series_values_by_date(series)))
    return sorted(set.intersection(*date_sets)) if date_sets else []


def _change(values: dict[str, float], date: str, prior_date: str) -> float:
    return round(values[date] - values[prior_date], 4)


def _scenario_id(row: dict[str, float]) -> str | None:
    real = row["real_yield_20obs_change"]
    dollar = row["dollar_20obs_change"]
    credit = row["credit_20obs_change"]
    vix_curve = row["vix_curve_20obs_change"]
    pressure_rising = credit > 0 or vix_curve > 0
    pressure_contained = credit <= 0 and vix_curve <= 0

    if real > 0 and dollar > 0 and pressure_rising:
        return "tightening_risk_off"
    if real < 0 and dollar < 0 and pressure_contained:
        return "strong_risk_on"
    if real < 0 and dollar > 0:
        return "bonds_first_safe_haven"
    if real > 0 and dollar <= 0:
        return "reallocation_rotation"
    return None


def _empty_scenario(spec: dict[str, str]) -> dict[str, Any]:
    return {
        **spec,
        "occurrence_count": 0,
        "last_occurrence_date": None,
        "occurrences": [],
        "caveat": REPLAY_CAVEAT,
    }


def build_regime_replay(series_by_id: dict[str, dict[str, Any]], generated_at: str) -> dict[str, Any]:
    required_ids = ["real_yield_10y", "broad_dollar", "high_yield_oas", "vix_vix3m_ratio", "us10y"]
    dates = _matched_dates(series_by_id, required_ids)
    values = {series_id: _series_values_by_date(series_by_id[series_id]) for series_id in required_ids if series_id in series_by_id}
    scenario_rows = {str(spec["id"]): _empty_scenario(spec) for spec in SCENARIOS}

    for index in range(LOOKBACK_OBSERVATIONS, len(dates)):
        date = dates[index]
        prior_date = dates[index - LOOKBACK_OBSERVATIONS]
        row = {
            "date": date,
            "real_yield_20obs_change": _change(values["real_yield_10y"], date, prior_date),
            "dollar_20obs_change": _change(values["broad_dollar"], date, prior_date),
            "credit_20obs_change": _change(values["high_yield_oas"], date, prior_date),
            "vix_curve_20obs_change": _change(values["vix_vix3m_ratio"], date, prior_date),
            "nominal_10y_20obs_change": _change(values["us10y"], date, prior_date),
        }
        scenario_id = _scenario_id(row)
        if scenario_id is not None:
            scenario_rows[scenario_id]["occurrences"].append(row)

    for scenario in scenario_rows.values():
        occurrences = scenario["occurrences"]
        scenario["occurrence_count"] = len(occurrences)
        scenario["last_occurrence_date"] = occurrences[-1]["date"] if occurrences else None

    return {
        "generated_at_utc": generated_at,
        "method_version": METHOD_VERSION,
        "scenarios": [scenario_rows[str(spec["id"])] for spec in SCENARIOS],
    }
