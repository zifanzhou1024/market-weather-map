from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Any

from scripts.shared.catalog import available_catalog_entries, catalog_entries
from scripts.shared.io import data_dir, series_path, write_json
from scripts.transform.compute_percentiles import enrich_observations, series_summary
from scripts.transform.freshness import evaluate_freshness
from scripts.transform.score_models import (
    ScoreDriver,
    label_for_three_score,
    score_block,
    weighted_score as weighted_three_score,
)


WEIGHTS = {
    "volatility": 0.20,
    "rates": 0.15,
    "liquidity": 0.20,
    "credit": 0.20,
    "commodities": 0.10,
    "sentiment": 0.15,
}
METHOD_VERSION = "phase3-three-score-v1"
MARKET_WEIGHTS = {
    "credit_spreads": 0.22,
    "liquidity_funding": 0.18,
    "rates_real_yields": 0.15,
    "volatility_tail_risk": 0.15,
    "dollar_global": 0.10,
    "commodities_inflation_impulse": 0.10,
    "sentiment_positioning": 0.10,
}
MACRO_WEIGHTS = {
    "growth": 0.25,
    "labor": 0.25,
    "inflation": 0.20,
    "consumer_production": 0.20,
    "real_yields": 0.10,
}
FRAGILITY_WEIGHTS = {
    "credit_spread_widening": 0.25,
    "volatility_term_structure": 0.20,
    "dollar_spike": 0.15,
    "liquidity_drain": 0.15,
    "positioning_crowding": 0.15,
    "treasury_bond_volatility": 0.10,
}
MARKET_COVERAGE_GROUPS = {
    "credit_spreads": ["high_yield_oas", "investment_grade_oas", "bbb_oas"],
    "liquidity_funding": ["net_liquidity", "reverse_repo", "sofr"],
    "rates_real_yields": ["real_yield_10y"],
    "volatility_tail_risk": ["vix", "vvix", "vix9d", "vix3m"],
    "dollar_global": ["broad_dollar"],
    "commodities_inflation_impulse": ["commodity_inflation_impulse", "breakeven_10y"],
    "sentiment_positioning": ["cftc_sp500_asset_mgr_net", "cftc_sp500_lev_money_net"],
}
MACRO_COVERAGE_GROUPS = {
    "growth": ["cfnai", "cfnai_3m_avg"],
    "labor": ["nonfarm_payrolls", "unemployment_rate", "initial_claims", "sahm_rule"],
    "inflation": ["headline_cpi", "core_cpi", "core_pce", "ppi_final_demand"],
    "consumer/production": ["real_retail_sales", "industrial_production", "durable_goods_orders"],
    "real_yields": ["real_yield_10y"],
}
FRAGILITY_COVERAGE_GROUPS = {
    "credit_spread_widening": ["high_yield_oas", "investment_grade_oas", "bbb_oas"],
    "volatility_term_structure": ["vix9d_vix_ratio", "vix_vix3m_ratio"],
    "dollar_spike": ["broad_dollar"],
    "liquidity_drain": ["net_liquidity"],
    "positioning_crowding": ["cftc_sp500_asset_mgr_net", "cftc_sp500_lev_money_net"],
    "treasury_bond_volatility": [],
}
DERIVED_STATUS_METADATA = {
    "us10y_minus_us2y": {"max_stale_days": 7},
    "brent_wti_spread": {"max_stale_days": 10},
    "net_liquidity": {"max_stale_days": 14},
    "hy_minus_ig_oas": {"max_stale_days": 10},
    "vix9d_vix_ratio": {"max_stale_days": 7},
    "vix_vix3m_ratio": {"max_stale_days": 7},
    "commodity_inflation_impulse": {"max_stale_days": 75},
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clamp(value: float) -> float:
    return round(max(-100.0, min(100.0, float(value))), 2)


def weighted_score(scores: dict[str, float], weights: dict[str, float]) -> float:
    total_weight = sum(weight for key, weight in weights.items() if key in scores)
    if total_weight == 0:
        return 0.0
    score = sum(scores[key] * weights[key] for key in scores if key in weights) / total_weight
    return clamp(score)


def load_series(series_id: str) -> dict[str, Any]:
    return json.loads(series_path(series_id).read_text(encoding="utf-8"))


def _finite_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(float(value))


def latest_summary(series: dict[str, Any]) -> dict[str, Any]:
    summary = series.get("summary")
    if isinstance(summary, dict):
        return summary
    return series_summary(series.get("observations", []), str(series.get("frequency", "daily")))


def score_inverse_percentile(summary: dict[str, Any]) -> float:
    percentile = summary.get("percentile_252d")
    if not isinstance(percentile, int | float):
        return 0.0
    return clamp(100 - (float(percentile) * 2))


def score_credit(series: dict[str, dict[str, Any]]) -> float:
    stress = score_inverse_percentile(latest_summary(series["financial_stress"]))
    conditions = score_inverse_percentile(latest_summary(series["financial_conditions"]))
    return weighted_score(
        {"financial_stress": stress, "financial_conditions": conditions},
        {"financial_stress": 0.55, "financial_conditions": 0.45},
    )


def _average(values: list[float]) -> float:
    if not values:
        return 0.0
    return clamp(sum(values) / len(values))


def score_commodities(series: dict[str, dict[str, Any]]) -> float:
    oil_scores = [
        score_inverse_percentile(latest_summary(series[series_id]))
        for series_id in ["wti_crude", "brent_crude"]
        if series_id in series
    ]
    crop_scores = [
        score_inverse_percentile(latest_summary(series[series_id]))
        for series_id in ["corn_price", "wheat_price", "soybean_price"]
        if series_id in series
    ]
    return weighted_score(
        {"oil": _average(oil_scores), "crops": _average(crop_scores)},
        {"oil": 0.65, "crops": 0.35},
    )


def score_positioning_percentile(summary: dict[str, Any]) -> float:
    percentile = summary.get("percentile_252d")
    if not isinstance(percentile, int | float):
        return 0.0
    value = float(percentile)
    if value >= 85:
        return clamp(-40 - ((value - 85) * 4))
    if value <= 15:
        return clamp(20 + ((15 - value) * 2))
    return clamp(10 - abs(value - 50) * 0.4)


def score_sentiment(series: dict[str, dict[str, Any]]) -> float:
    asset_mgr = score_positioning_percentile(latest_summary(series["cftc_sp500_asset_mgr_net"]))
    lev_money = score_positioning_percentile(latest_summary(series["cftc_sp500_lev_money_net"]))
    return weighted_score(
        {"asset_mgr": asset_mgr, "lev_money": lev_money},
        {"asset_mgr": 0.40, "lev_money": 0.60},
    )


def score_volatility(series: dict[str, dict[str, Any]]) -> float:
    return score_inverse_percentile(latest_summary(series["vix"]))


def score_rates(series: dict[str, dict[str, Any]]) -> float:
    monthly_change = latest_summary(series["us10y"]).get("change_1m")
    if not isinstance(monthly_change, int | float):
        return 0.0
    return clamp(-float(monthly_change) * 35)


def _pct_change(summary: dict[str, Any]) -> float | None:
    latest_value = summary.get("latest_value")
    monthly_change = summary.get("change_1m")
    if not isinstance(latest_value, int | float) or not isinstance(monthly_change, int | float):
        return None
    previous = float(latest_value) - float(monthly_change)
    if previous == 0:
        return None
    return float(monthly_change) / abs(previous) * 100


def score_liquidity(series: dict[str, dict[str, Any]]) -> float:
    net_change = _pct_change(latest_summary(series["net_liquidity"])) if "net_liquidity" in series else None
    reverse_repo_change = _pct_change(latest_summary(series["reverse_repo"]))
    sofr_score = score_inverse_percentile(latest_summary(series["sofr"])) if "sofr" in series else 0.0

    net_score = clamp((net_change or 0.0) * 20)
    reverse_repo_score = clamp(-(reverse_repo_change or 0.0) * 10)
    return weighted_score(
        {"net_liquidity": net_score, "reverse_repo": reverse_repo_score, "sofr": sofr_score},
        {"net_liquidity": 0.70, "reverse_repo": 0.15, "sofr": 0.15},
    )


def _latest_on_or_before(observations: list[dict[str, Any]], date: str) -> float | None:
    latest_value = None
    for observation in observations:
        observed_date = observation.get("date")
        value = observation.get("value")
        if not isinstance(observed_date, str) or observed_date > date:
            continue
        if isinstance(value, int | float) and not isinstance(value, bool):
            latest_value = float(value)
    return latest_value


def build_net_liquidity(series_by_id: dict[str, dict[str, Any]], generated_at: str) -> dict[str, Any]:
    fed_assets = series_by_id["fed_assets"]
    tga_observations = series_by_id["treasury_general_account"].get("observations", [])
    reverse_repo_observations = series_by_id["reverse_repo"].get("observations", [])

    observations = []
    for observation in fed_assets.get("observations", []):
        date = observation.get("date")
        fed_value = observation.get("value")
        if not isinstance(date, str) or not isinstance(fed_value, int | float):
            continue

        tga_value = _latest_on_or_before(tga_observations, date)
        reverse_repo_value = _latest_on_or_before(reverse_repo_observations, date)
        if tga_value is None or reverse_repo_value is None:
            continue

        observations.append(
            {
                "date": date,
                "value": round(float(fed_value) - tga_value - (reverse_repo_value * 1000), 4),
            }
        )

    frequency = str(fed_assets.get("frequency", "weekly"))
    observations = enrich_observations(observations, frequency)
    return {
        "series_id": "net_liquidity",
        "generated_at_utc": generated_at,
        "source": "Derived",
        "source_url": "/data/series/fed_assets.json",
        "frequency": frequency,
        "units": "usd_millions",
        "depends_on": ["fed_assets", "treasury_general_account", "reverse_repo"],
        "method": "Fed assets minus Treasury General Account and reverse repo balances aligned to Fed asset observation dates. Reverse repo values are converted from billions to millions before subtraction.",
        "summary": series_summary(observations, frequency),
        "observations": observations,
    }


def build_matched_spread(
    left_series_id: str,
    right_series_id: str,
    spread_series_id: str,
    generated_at: str,
    units: str,
    method: str,
) -> dict[str, Any]:
    left = load_series(left_series_id)
    right = load_series(right_series_id)
    right_by_date = {
        observation["date"]: observation["value"] for observation in right.get("observations", [])
    }
    observations = []
    for observation in left.get("observations", []):
        date = observation.get("date")
        left_value = observation.get("value")
        right_value = right_by_date.get(date)
        if isinstance(left_value, int | float) and isinstance(right_value, int | float):
            observations.append({"date": date, "value": round(float(left_value) - float(right_value), 4)})

    frequency = str(left.get("frequency", "daily"))
    observations = enrich_observations(observations, frequency)
    return {
        "series_id": spread_series_id,
        "generated_at_utc": generated_at,
        "source": "Derived",
        "source_url": f"/data/series/{left_series_id}.json",
        "frequency": frequency,
        "units": units,
        "depends_on": [left_series_id, right_series_id],
        "method": method,
        "summary": series_summary(observations, frequency),
        "observations": observations,
    }


def build_ratio_series(
    numerator_series_id: str,
    denominator_series_id: str,
    ratio_series_id: str,
    generated_at: str,
    units: str,
    method: str,
) -> dict[str, Any]:
    numerator = load_series(numerator_series_id)
    denominator = load_series(denominator_series_id)
    denominator_by_date = {}
    for observation in denominator.get("observations", []):
        date = observation.get("date")
        if isinstance(date, str):
            denominator_by_date[date] = observation.get("value")
    observations = []
    for observation in numerator.get("observations", []):
        date = observation.get("date")
        numerator_value = observation.get("value")
        denominator_value = denominator_by_date.get(date)
        if (
            isinstance(date, str)
            and _finite_number(numerator_value)
            and _finite_number(denominator_value)
            and float(denominator_value) != 0
        ):
            ratio = float(numerator_value) / float(denominator_value)
            if not math.isfinite(ratio):
                continue
            observations.append(
                {"date": date, "value": round(ratio, 4)}
            )

    frequency = str(numerator.get("frequency", "daily"))
    observations.sort(key=lambda item: item["date"])
    observations = enrich_observations(observations, frequency)
    return {
        "series_id": ratio_series_id,
        "generated_at_utc": generated_at,
        "source": "Derived",
        "source_url": f"/data/series/{numerator_series_id}.json",
        "frequency": frequency,
        "units": units,
        "depends_on": [numerator_series_id, denominator_series_id],
        "method": method,
        "summary": series_summary(observations, frequency),
        "observations": observations,
    }


def build_curve(generated_at: str) -> dict[str, Any]:
    return build_matched_spread(
        "us10y",
        "us2y",
        "us10y_minus_us2y",
        generated_at,
        "percentage_points",
        "10-year Treasury yield minus 2-year Treasury yield by matched observation date.",
    )


def _change_pct(summary: dict[str, Any], change_key: str) -> float | None:
    latest_value = summary.get("latest_value")
    change = summary.get(change_key)
    if not _finite_number(latest_value) or not _finite_number(change):
        return None
    previous = float(latest_value) - float(change)
    if previous <= 0 or not math.isfinite(previous):
        return None
    return round(float(change) / abs(previous) * 100, 4)


def _valid_component_average(
    series_by_id: dict[str, dict[str, Any]], series_ids: list[str], change_key: str
) -> tuple[float | None, list[str]]:
    values = []
    dates = []
    for series_id in series_ids:
        summary = _impulse_summary(series_by_id[series_id])
        value = _change_pct(summary, change_key)
        date = summary.get("latest_date")
        if value is None or not isinstance(date, str):
            continue
        values.append(value)
        dates.append(date)
    if not values:
        return None, []
    return sum(values) / len(values), dates


def build_commodity_inflation_impulse(
    series_by_id: dict[str, dict[str, Any]], generated_at: str
) -> dict[str, Any]:
    oil_ids = [series_id for series_id in ["wti_crude", "brent_crude"] if series_id in series_by_id]
    crop_ids = [
        series_id
        for series_id in ["corn_price", "wheat_price", "soybean_price"]
        if series_id in series_by_id
    ]

    component_scores = {}
    latest_dates = []

    oil_3m, oil_3m_dates = _valid_component_average(series_by_id, oil_ids, "change_3m")
    if oil_3m is not None:
        component_scores["oil_3m"] = oil_3m
        latest_dates.extend(oil_3m_dates)

    oil_12m, oil_12m_dates = _valid_component_average(series_by_id, oil_ids, "change_12m")
    if oil_12m is not None:
        component_scores["oil_12m"] = oil_12m
        latest_dates.extend(oil_12m_dates)

    crop_3m, crop_3m_dates = _valid_component_average(series_by_id, crop_ids, "change_3m")
    if crop_3m is not None:
        component_scores["crop_3m"] = crop_3m
        latest_dates.extend(crop_3m_dates)

    if "breakeven_10y" in series_by_id:
        breakeven_summary = latest_summary(series_by_id["breakeven_10y"])
        breakeven_3m = _change_pct(breakeven_summary, "change_3m")
        breakeven_date = breakeven_summary.get("latest_date")
        if breakeven_3m is not None and isinstance(breakeven_date, str):
            component_scores["breakeven_3m"] = breakeven_3m
            latest_dates.append(breakeven_date)

    latest_date = max(latest_dates) if latest_dates else None
    score = None
    observations = []
    if component_scores and isinstance(latest_date, str):
        impulse = weighted_score(
            component_scores,
            {"oil_3m": 0.40, "oil_12m": 0.20, "crop_3m": 0.20, "breakeven_3m": 0.20},
        )
        score = clamp(-impulse)
        observations = enrich_observations([{"date": latest_date, "value": score}], "daily")
    depends_on = [*oil_ids, *crop_ids]
    if "breakeven_10y" in series_by_id:
        depends_on.append("breakeven_10y")
    return {
        "series_id": "commodity_inflation_impulse",
        "generated_at_utc": generated_at,
        "source": "Derived",
        "source_url": "/data/series/wti_crude.json",
        "frequency": "daily",
        "units": "score",
        "value": score,
        "depends_on": depends_on,
        "method": (
            "Momentum impulse from oil 3-month change (40%), oil 12-month change (20%), "
            "crop basket 3-month momentum (20%), and 10-year breakeven confirmation (20%). "
            "Absolute summary changes are converted to percent change versus the prior value "
            "where applicable; positive inflation impulse is mapped to negative support-risk score."
        ),
        "summary": series_summary(observations, "daily"),
        "observations": observations,
    }


def label_for_score(score: float) -> str:
    if score <= -50:
        return "Stressed"
    if score <= -20:
        return "Fragile"
    if score < 20:
        return "Neutral"
    return "Supportive"


def _latest_dates(series_by_id: dict[str, dict[str, Any]]) -> list[str]:
    return [
        latest_summary(series).get("latest_date")
        for series in series_by_id.values()
        if isinstance(latest_summary(series).get("latest_date"), str)
    ]


def _title(name: str) -> str:
    return name.replace("_", " ").title()


def _summary_for_first(
    series_by_id: dict[str, dict[str, Any]], series_ids: list[str]
) -> tuple[str | None, dict[str, Any]]:
    for series_id in series_ids:
        if series_id in series_by_id:
            return series_id, latest_summary(series_by_id[series_id])
    return None, {}


def _number_from_summary(summary: dict[str, Any], key: str) -> float | None:
    value = summary.get(key)
    if _finite_number(value):
        return float(value)
    return None


def _score_inverse_percentile_for_first(
    series_by_id: dict[str, dict[str, Any]], series_ids: list[str]
) -> float | None:
    _, summary = _summary_for_first(series_by_id, series_ids)
    percentile = _number_from_summary(summary, "percentile_252d")
    if percentile is None:
        return None
    return clamp(100 - (percentile * 2))


def _score_supportive_percentile_for_first(
    series_by_id: dict[str, dict[str, Any]], series_ids: list[str]
) -> float | None:
    _, summary = _summary_for_first(series_by_id, series_ids)
    percentile = _number_from_summary(summary, "percentile_252d")
    if percentile is None:
        return None
    return clamp((percentile * 2) - 100)


def _score_percentile_average(
    series_by_id: dict[str, dict[str, Any]],
    series_ids: list[str],
    *,
    inverse: bool,
) -> float | None:
    values = []
    for series_id in series_ids:
        if series_id not in series_by_id:
            continue
        score = (
            _score_inverse_percentile_for_first(series_by_id, [series_id])
            if inverse
            else _score_supportive_percentile_for_first(series_by_id, [series_id])
        )
        if score is not None:
            values.append(score)
    return _score_average(values)


def _score_average(values: list[float | None]) -> float | None:
    valid = [value for value in values if value is not None]
    if not valid:
        return None
    return clamp(sum(valid) / len(valid))


def _coverage_component_available(series_by_id: dict[str, dict[str, Any]], series_id: str) -> bool:
    if series_id not in series_by_id:
        return False
    if series_id == "breakeven_10y":
        summary = _impulse_summary(series_by_id[series_id])
        return _change_pct(summary, "change_3m") is not None and isinstance(summary.get("latest_date"), str)
    return True


def _source_coverage(
    series_by_id: dict[str, dict[str, Any]],
    groups: dict[str, list[str]],
    scope: str,
) -> tuple[dict[str, object], list[str]]:
    group_rows = {}
    all_expected = []
    all_available = []
    all_missing = []
    notes = []
    for group, expected in groups.items():
        available = [series_id for series_id in expected if _coverage_component_available(series_by_id, series_id)]
        missing = [series_id for series_id in expected if not _coverage_component_available(series_by_id, series_id)]
        all_expected.extend(expected)
        all_available.extend(available)
        all_missing.extend(missing)
        group_rows[group] = {
            "expected": expected,
            "available": available,
            "missing": missing,
            "coverage_ratio": round(len(available) / len(expected), 2) if expected else 1.0,
        }
        if missing:
            notes.append(f"Missing {scope} {group} coverage: {', '.join(missing)}.")

    return (
        {
            "expected": all_expected,
            "available": all_available,
            "missing": all_missing,
            "coverage_ratio": round(len(all_available) / len(all_expected), 2) if all_expected else 1.0,
            "groups": group_rows,
        },
        notes,
    )


def _series_driver(
    bucket: str,
    direction: str,
    impact: float,
    text: str,
    series_id: str | None,
    summary: dict[str, Any],
) -> ScoreDriver:
    return ScoreDriver(
        bucket=bucket,
        direction="support" if direction == "support" else "risk",
        impact=impact,
        text=text,
        series_id=series_id or bucket,
        latest_value=_number_from_summary(summary, "latest_value"),
        recent_change=_number_from_summary(summary, "change_1m"),
    )


def _append_driver_for_score(
    drivers: list[ScoreDriver],
    bucket: str,
    score: float | None,
    series_id: str | None,
    summary: dict[str, Any],
    support_text: str,
    risk_text: str,
    threshold: float = 5.0,
) -> None:
    if score is None:
        return
    if score <= -threshold:
        drivers.append(_series_driver(bucket, "risk", score, risk_text, series_id, summary))
    elif score >= threshold:
        drivers.append(_series_driver(bucket, "support", score, support_text, series_id, summary))


def _safe_score_credit(series_by_id: dict[str, dict[str, Any]]) -> float:
    credit_score = _score_average(
        [
            _score_inverse_percentile_for_first(series_by_id, ["high_yield_oas"]),
            _score_inverse_percentile_for_first(series_by_id, ["investment_grade_oas"]),
            _score_inverse_percentile_for_first(series_by_id, ["bbb_oas"]),
            _score_inverse_percentile_for_first(series_by_id, ["hy_minus_ig_oas"]),
        ]
    )
    if credit_score is not None:
        return credit_score
    if {"financial_stress", "financial_conditions"} <= set(series_by_id):
        return score_credit(series_by_id)
    return 0.0


def _safe_score_commodities(series_by_id: dict[str, dict[str, Any]]) -> float:
    commodity_ids = {"wti_crude", "brent_crude", "corn_price", "wheat_price", "soybean_price"}
    if commodity_ids & set(series_by_id):
        return score_commodities(series_by_id)
    return 0.0


def _impulse_summary(series: dict[str, Any]) -> dict[str, Any]:
    summary = latest_summary(series)
    if _finite_number(summary.get("change_3m")) or _finite_number(summary.get("change_12m")):
        return summary
    return series_summary(series.get("observations", []), str(series.get("frequency", "daily")))


def _safe_score_sentiment(series_by_id: dict[str, dict[str, Any]]) -> float:
    if {"cftc_sp500_asset_mgr_net", "cftc_sp500_lev_money_net"} <= set(series_by_id):
        return score_sentiment(series_by_id)
    return 0.0


def _market_weather_scores(series_by_id: dict[str, dict[str, Any]]) -> dict[str, float]:
    commodity_impulse = _number_from_summary(
        latest_summary(series_by_id["commodity_inflation_impulse"]),
        "latest_value",
    ) if "commodity_inflation_impulse" in series_by_id else None
    commodity_score = (
        commodity_impulse
        if commodity_impulse is not None
        else 0.0
        if "commodity_inflation_impulse" in series_by_id
        else _safe_score_commodities(series_by_id)
    )
    rates_score = _score_inverse_percentile_for_first(series_by_id, ["real_yield_10y"])
    if rates_score is None:
        rates_score = score_rates(series_by_id) if "us10y" in series_by_id else 0.0
    volatility_score = _score_percentile_average(
        series_by_id,
        ["vix", "vvix", "vix9d", "vix3m", "vix9d_vix_ratio", "vix_vix3m_ratio"],
        inverse=True,
    )
    dollar_score = _score_inverse_percentile_for_first(series_by_id, ["broad_dollar"])
    return {
        "credit_spreads": _safe_score_credit(series_by_id),
        "liquidity_funding": score_liquidity(series_by_id)
        if {"reverse_repo"} <= set(series_by_id)
        else 0.0,
        "rates_real_yields": rates_score,
        "volatility_tail_risk": volatility_score if volatility_score is not None else 0.0,
        "dollar_global": dollar_score if dollar_score is not None else 0.0,
        "commodities_inflation_impulse": commodity_score,
        "sentiment_positioning": _safe_score_sentiment(series_by_id),
    }


def _market_weather_drivers(
    series_by_id: dict[str, dict[str, Any]],
    bucket_scores: dict[str, float],
) -> list[ScoreDriver]:
    drivers: list[ScoreDriver] = []

    series_id, summary = _summary_for_first(series_by_id, ["high_yield_oas", "hy_minus_ig_oas"])
    change_1m = _number_from_summary(summary, "change_1m")
    direct_credit_score = _score_inverse_percentile_for_first(
        series_by_id, [series_id] if series_id is not None else []
    )
    if (
        series_id is not None
        and change_1m is not None
        and change_1m > 0
        and direct_credit_score is not None
        and direct_credit_score < 0
        and bucket_scores["credit_spreads"] < 0
    ):
        drivers.append(
            _series_driver(
                "credit_spreads",
                "risk",
                direct_credit_score,
                "High-yield spreads widened over the past month.",
                series_id,
                summary,
            )
        )
    else:
        _append_driver_for_score(
            drivers,
            "credit_spreads",
            bucket_scores["credit_spreads"],
            series_id,
            summary,
            "Credit spread pressure is contained.",
            "Credit spread pressure is elevated.",
        )

    series_id, summary = _summary_for_first(series_by_id, ["net_liquidity"])
    _append_driver_for_score(
        drivers,
        "liquidity_funding",
        bucket_scores["liquidity_funding"],
        series_id,
        summary,
        "Liquidity funding conditions are improving.",
        "Liquidity funding conditions are tightening.",
    )

    series_id, summary = _summary_for_first(series_by_id, ["vix"])
    _append_driver_for_score(
        drivers,
        "volatility_tail_risk",
        bucket_scores["volatility_tail_risk"],
        series_id,
        summary,
        "Volatility tail risk is contained.",
        "Volatility tail risk is elevated.",
    )

    series_id, summary = _summary_for_first(series_by_id, ["real_yield_10y", "us10y"])
    _append_driver_for_score(
        drivers,
        "rates_real_yields",
        bucket_scores["rates_real_yields"],
        series_id,
        summary,
        "Real yields are easing.",
        "Real yields are elevated.",
    )

    series_id, summary = _summary_for_first(series_by_id, ["broad_dollar"])
    _append_driver_for_score(
        drivers,
        "dollar_global",
        bucket_scores["dollar_global"],
        series_id,
        summary,
        "The broad dollar backdrop is easing.",
        "The broad dollar is pressuring global liquidity.",
    )

    series_id, summary = _summary_for_first(series_by_id, ["commodity_inflation_impulse", "wti_crude"])
    _append_driver_for_score(
        drivers,
        "commodities_inflation_impulse",
        bucket_scores["commodities_inflation_impulse"],
        series_id,
        summary,
        "Commodity inflation impulse is easing.",
        "Commodity inflation impulse is elevated.",
    )

    lev_series_id, lev_summary = _summary_for_first(series_by_id, ["cftc_sp500_lev_money_net"])
    lev_score = (
        score_positioning_percentile(lev_summary)
        if lev_series_id is not None and _number_from_summary(lev_summary, "percentile_252d") is not None
        else None
    )
    if lev_score is not None and lev_score <= -5:
        drivers.append(
            _series_driver(
                "sentiment_positioning",
                "risk",
                lev_score,
                "Leveraged-money S&P 500 positioning is crowded.",
                lev_series_id,
                lev_summary,
            )
        )
    else:
        _append_driver_for_score(
            drivers,
            "sentiment_positioning",
            bucket_scores["sentiment_positioning"],
            lev_series_id,
            lev_summary,
            "Equity positioning is not crowded.",
            "Leveraged-money S&P 500 positioning is crowded.",
        )

    return drivers


def _macro_climate_scores(series_by_id: dict[str, dict[str, Any]]) -> dict[str, float]:
    return {
        "growth": _score_percentile_average(series_by_id, ["cfnai", "cfnai_3m_avg"], inverse=False)
        or 0.0,
        "labor": _score_average([
            _score_percentile_average(series_by_id, ["nonfarm_payrolls"], inverse=False),
            _score_percentile_average(series_by_id, ["unemployment_rate", "initial_claims", "sahm_rule"], inverse=True),
        ])
        or 0.0,
        "inflation": _score_percentile_average(
            series_by_id,
            ["headline_cpi", "core_cpi", "core_pce", "ppi_final_demand"],
            inverse=True,
        )
        or 0.0,
        "consumer_production": _score_percentile_average(
            series_by_id,
            ["real_retail_sales", "industrial_production", "durable_goods_orders"],
            inverse=False,
        )
        or 0.0,
        "real_yields": _score_percentile_average(series_by_id, ["real_yield_10y"], inverse=True)
        or 0.0,
    }


def _macro_climate_drivers(series_by_id: dict[str, dict[str, Any]]) -> list[ScoreDriver]:
    drivers: list[ScoreDriver] = []
    for bucket, series_ids, support_text, risk_text, inverse in [
        ("growth", ["cfnai", "cfnai_3m_avg"], "Growth inputs are supportive.", "Growth inputs are softening.", False),
        (
            "labor",
            ["nonfarm_payrolls", "unemployment_rate", "initial_claims", "sahm_rule"],
            "Labor inputs remain supportive.",
            "Labor inputs are cooling.",
            False,
        ),
        (
            "inflation",
            ["core_pce", "core_cpi", "headline_cpi", "ppi_final_demand"],
            "Inflation pressure is easing.",
            "Inflation pressure remains elevated.",
            True,
        ),
        (
            "consumer_production",
            ["real_retail_sales", "industrial_production", "durable_goods_orders"],
            "Consumer and production inputs are firm.",
            "Consumer and production inputs are weakening.",
            False,
        ),
        ("real_yields", ["real_yield_10y"], "Real yields are easing.", "Real yields are elevated.", True),
    ]:
        series_id, summary = _summary_for_first(series_by_id, series_ids)
        score = _score_percentile_average(series_by_id, series_ids, inverse=inverse)
        _append_driver_for_score(drivers, bucket, score, series_id, summary, support_text, risk_text)
    return drivers


def _fragility_scores(series_by_id: dict[str, dict[str, Any]]) -> dict[str, float]:
    liquidity_score = _score_supportive_percentile_for_first(series_by_id, ["net_liquidity"])
    return {
        "credit_spread_widening": _score_inverse_percentile_for_first(
            series_by_id, ["hy_minus_ig_oas", "high_yield_oas"]
        )
        or 0.0,
        "volatility_term_structure": _score_inverse_percentile_for_first(
            series_by_id, ["vix_vix3m_ratio", "vix9d_vix_ratio"]
        )
        or 0.0,
        "dollar_spike": _score_inverse_percentile_for_first(series_by_id, ["broad_dollar"]) or 0.0,
        "liquidity_drain": liquidity_score if liquidity_score is not None else 0.0,
        "positioning_crowding": _safe_score_sentiment(series_by_id),
        "treasury_bond_volatility": 0.0,
    }


def _fragility_drivers(series_by_id: dict[str, dict[str, Any]]) -> list[ScoreDriver]:
    drivers: list[ScoreDriver] = []
    for bucket, series_ids, support_text, risk_text in [
        (
            "credit_spread_widening",
            ["hy_minus_ig_oas", "high_yield_oas"],
            "Credit spread pressure is contained.",
            "Credit spread pressure is widening.",
        ),
        (
            "volatility_term_structure",
            ["vix_vix3m_ratio", "vix9d_vix_ratio"],
            "Volatility term structure is calm.",
            "Volatility term structure is inverted.",
        ),
        ("dollar_spike", ["broad_dollar"], "The dollar backdrop is easing.", "The broad dollar is spiking."),
        (
            "liquidity_drain",
            ["net_liquidity"],
            "Liquidity drains are limited.",
            "Liquidity drains are visible.",
        ),
    ]:
        series_id, summary = _summary_for_first(series_by_id, series_ids)
        score = _score_inverse_percentile_for_first(series_by_id, series_ids)
        if bucket == "liquidity_drain":
            score = _score_supportive_percentile_for_first(series_by_id, series_ids)
        _append_driver_for_score(drivers, bucket, score, series_id, summary, support_text, risk_text)
    return drivers


def build_score_summary(series_by_id: dict[str, dict[str, Any]], generated_at: str) -> dict[str, Any]:
    market_buckets = _market_weather_scores(series_by_id)
    macro_buckets = _macro_climate_scores(series_by_id)
    fragility_buckets = _fragility_scores(series_by_id)

    market_coverage, market_notes = _source_coverage(
        series_by_id, MARKET_COVERAGE_GROUPS, "market weather"
    )
    macro_coverage, macro_notes = _source_coverage(series_by_id, MACRO_COVERAGE_GROUPS, "macro")
    fragility_coverage, fragility_notes = _source_coverage(
        series_by_id, FRAGILITY_COVERAGE_GROUPS, "fragility"
    )

    market_score = weighted_three_score(market_buckets, MARKET_WEIGHTS)
    macro_score = weighted_three_score(macro_buckets, MACRO_WEIGHTS)
    fragility_score = weighted_three_score(fragility_buckets, FRAGILITY_WEIGHTS)

    macro_notes.append("Housing is not active in Phase 3.")
    if "Missing fragility treasury_bond_volatility coverage: move_index." in fragility_notes:
        fragility_notes.remove("Missing fragility treasury_bond_volatility coverage: move_index.")
    fragility_notes.append("Treasury/bond volatility source is not active.")

    market_block = score_block(
        market_score,
        label_for_three_score(market_score, "market_weather"),
        market_buckets,
        MARKET_WEIGHTS,
        _market_weather_drivers(series_by_id, market_buckets),
        [],
        market_notes,
    )
    market_block["source_coverage"] = market_coverage
    macro_block = score_block(
        macro_score,
        label_for_three_score(macro_score, "macro_climate"),
        macro_buckets,
        MACRO_WEIGHTS,
        _macro_climate_drivers(series_by_id),
        [],
        macro_notes,
    )
    macro_block["source_coverage"] = macro_coverage
    fragility_block = score_block(
        fragility_score,
        label_for_three_score(fragility_score, "fragility"),
        fragility_buckets,
        FRAGILITY_WEIGHTS,
        _fragility_drivers(series_by_id),
        [],
        fragility_notes,
    )
    fragility_block["source_coverage"] = fragility_coverage

    latest_dates = _latest_dates(series_by_id)
    latest_date = max(latest_dates) if latest_dates else generated_at[:10]
    quality_reasons = sorted(set(market_notes + macro_notes + fragility_notes))
    overall_confidence = round(
        (
            float(market_block["confidence"])
            + float(macro_block["confidence"])
            + float(fragility_block["confidence"])
        )
        / 3,
        2,
    )

    return {
        "generated_at_utc": generated_at,
        "date": latest_date,
        "method_version": METHOD_VERSION,
        "scores": {
            "market_weather": market_block,
            "macro_climate": macro_block,
            "fragility": fragility_block,
        },
        "data_quality": {
            "overall_confidence": overall_confidence,
            "reasons": quality_reasons,
        },
    }


def _status_for_series(entry: dict[str, Any], series: dict[str, Any], generated_at: str) -> dict[str, Any]:
    if entry.get("access_status") == "unavailable" or entry.get("terms_status") == "restricted":
        return {
            "status": "unavailable",
            "last_observation": None,
            "source": entry["source"],
            "expected_frequency": entry["frequency"],
            "freshness_days": None,
            "max_stale_days": entry["max_stale_days"],
            "message": "Source is unavailable for automated static ingestion.",
        }
    if (
        entry.get("score_status") == "candidate"
        or entry.get("access_status") == "terms_review_needed"
        or entry.get("terms_status") == "review_needed"
    ):
        return {
            "status": "terms_review_needed",
            "last_observation": None,
            "source": entry["source"],
            "expected_frequency": entry["frequency"],
            "freshness_days": None,
            "max_stale_days": entry["max_stale_days"],
            "message": "Candidate source requires access or terms review before scoring.",
        }

    summary = latest_summary(series)
    latest_date = summary.get("latest_date")
    freshness = evaluate_freshness(
        latest_date=latest_date if isinstance(latest_date, str) else None,
        generated_at=generated_at,
        frequency=str(entry["frequency"]),
        max_stale_days=int(entry["max_stale_days"]),
    )
    return {
        "status": freshness["status"],
        "last_observation": freshness["last_observation"],
        "observation_period": freshness["observation_period"],
        "source": entry["source"],
        "expected_frequency": entry["frequency"],
        "freshness_days": freshness["freshness_days"],
        "max_stale_days": entry["max_stale_days"],
        "expected_next_release_window": freshness["expected_next_release_window"],
        "message": freshness["message"],
    }


def _unavailable_status_for_series(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "last_observation": None,
        "source": entry["source"],
        "expected_frequency": entry["frequency"],
        "freshness_days": None,
        "max_stale_days": entry["max_stale_days"],
        "message": "Active public catalog series has no generated payload.",
    }


def _active_public_catalog_entries() -> list[dict[str, Any]]:
    by_id = {
        str(entry["id"]): entry
        for entry in catalog_entries()
        if entry.get("score_status") == "active" and entry.get("public") is True
    }
    for entry in available_catalog_entries():
        by_id[str(entry["id"])] = entry
    return [dict(entry) for entry in by_id.values()]


def _source_governance_catalog_entries() -> list[dict[str, Any]]:
    return [
        dict(entry)
        for entry in catalog_entries()
        if entry.get("score_status") == "candidate"
        or entry.get("access_status") in {"terms_review_needed", "unavailable"}
        or entry.get("terms_status") in {"review_needed", "restricted"}
    ]


def build_status(series_by_id: dict[str, dict[str, Any]], generated_at: str) -> dict[str, Any]:
    statuses = {}
    overall_statuses = []
    for entry in _active_public_catalog_entries():
        series_id = str(entry["id"])
        series = series_by_id.get(series_id)
        statuses[series_id] = (
            _status_for_series(entry, series, generated_at)
            if series is not None
            else _unavailable_status_for_series(entry)
        )
        overall_statuses.append(statuses[series_id]["status"])
    for entry in _source_governance_catalog_entries():
        series_id = str(entry["id"])
        if series_id in statuses:
            continue
        statuses[series_id] = _status_for_series(
            entry,
            series_by_id.get(series_id, {}),
            generated_at,
        )
    for series_id, metadata in DERIVED_STATUS_METADATA.items():
        series = series_by_id.get(series_id)
        if series is None:
            continue
        statuses[series_id] = _status_for_series(
            {
                "id": series_id,
                "source": "Derived",
                "frequency": str(series.get("frequency", "daily")),
                "max_stale_days": metadata["max_stale_days"],
            },
            series,
            generated_at,
        )
        overall_statuses.append(statuses[series_id]["status"])

    if any(status == "failed" for status in overall_statuses):
        overall = "failed"
    elif any(status in {"stale", "unavailable"} for status in overall_statuses):
        overall = "partial"
    else:
        overall = "ok"
    return {
        "generated_at_utc": generated_at,
        "last_successful_update_utc": generated_at if overall != "failed" else None,
        "overall_status": overall,
        "series": statuses,
    }


def main() -> None:
    generated_at = now_iso()
    series_by_id = {
        str(entry["id"]): load_series(str(entry["id"]))
        for entry in available_catalog_entries()
    }

    curve = build_curve(generated_at)
    write_json(data_dir() / "derived" / "us10y_minus_us2y.json", curve)
    series_by_id["us10y_minus_us2y"] = curve

    net_liquidity = build_net_liquidity(series_by_id, generated_at)
    write_json(data_dir() / "derived" / "net_liquidity.json", net_liquidity)
    series_by_id["net_liquidity"] = net_liquidity

    if "brent_crude" in series_by_id and "wti_crude" in series_by_id:
        brent_wti_spread = build_matched_spread(
            "brent_crude",
            "wti_crude",
            "brent_wti_spread",
            generated_at,
            "usd_per_barrel",
            "Brent crude spot price minus WTI crude spot price by matched observation date.",
        )
        write_json(
            data_dir() / "derived" / "brent_wti_spread.json",
            brent_wti_spread,
        )
        series_by_id["brent_wti_spread"] = brent_wti_spread

    if "high_yield_oas" in series_by_id and "investment_grade_oas" in series_by_id:
        hy_minus_ig_oas = build_matched_spread(
            "high_yield_oas",
            "investment_grade_oas",
            "hy_minus_ig_oas",
            generated_at,
            "percentage_points",
            "High yield option-adjusted spread minus investment grade option-adjusted spread by matched observation date.",
        )
        write_json(data_dir() / "derived" / "hy_minus_ig_oas.json", hy_minus_ig_oas)
        series_by_id["hy_minus_ig_oas"] = hy_minus_ig_oas

    if "vix9d" in series_by_id and "vix" in series_by_id:
        vix9d_vix_ratio = build_ratio_series(
            "vix9d",
            "vix",
            "vix9d_vix_ratio",
            generated_at,
            "ratio",
            "VIX9D divided by VIX by matched observation date.",
        )
        write_json(data_dir() / "derived" / "vix9d_vix_ratio.json", vix9d_vix_ratio)
        series_by_id["vix9d_vix_ratio"] = vix9d_vix_ratio

    if "vix" in series_by_id and "vix3m" in series_by_id:
        vix_vix3m_ratio = build_ratio_series(
            "vix",
            "vix3m",
            "vix_vix3m_ratio",
            generated_at,
            "ratio",
            "VIX divided by VIX3M by matched observation date.",
        )
        write_json(data_dir() / "derived" / "vix_vix3m_ratio.json", vix_vix3m_ratio)
        series_by_id["vix_vix3m_ratio"] = vix_vix3m_ratio

    commodity_inflation_components = {
        "wti_crude",
        "brent_crude",
        "corn_price",
        "wheat_price",
        "soybean_price",
    }
    if commodity_inflation_components & set(series_by_id):
        commodity_inflation_impulse = build_commodity_inflation_impulse(series_by_id, generated_at)
        write_json(
            data_dir() / "derived" / "commodity_inflation_impulse.json",
            commodity_inflation_impulse,
        )
        series_by_id["commodity_inflation_impulse"] = commodity_inflation_impulse

    score_summary = build_score_summary(series_by_id, generated_at)
    write_json(data_dir() / "derived" / "score_summary.json", score_summary)

    market_weather = score_summary["scores"]["market_weather"]
    buckets = dict(market_weather["bucket_scores"])
    weights = dict(market_weather["bucket_weights"])
    overall_score = float(market_weather["score"])
    latest_date = str(score_summary["date"])

    write_json(
        data_dir() / "derived" / "bucket_scores.json",
        {
            "generated_at_utc": generated_at,
            "date": latest_date,
            "method_version": METHOD_VERSION,
            "buckets": buckets,
            "weights": weights,
        },
    )

    write_json(
        data_dir() / "derived" / "regime_score.json",
        {
            "date": latest_date,
            "generated_at_utc": generated_at,
            "overall_score": overall_score,
            "label": str(market_weather["label"]),
            "buckets": buckets,
            "top_supports": list(market_weather["top_supports"]),
            "top_risks": list(market_weather["top_risks"]),
            "method_version": METHOD_VERSION,
        },
    )

    write_json(data_dir() / "status" / "data_status.json", build_status(series_by_id, generated_at))


if __name__ == "__main__":
    main()
