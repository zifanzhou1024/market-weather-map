from __future__ import annotations

import json
import math
import statistics
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
from scripts.transform.regime_replay import build_regime_replay


WEIGHTS = {
    "volatility": 0.20,
    "rates": 0.15,
    "liquidity": 0.20,
    "credit": 0.20,
    "commodities": 0.10,
    "sentiment": 0.15,
}
METHOD_VERSION = "phase5-pr4-strategic-macro-completeness-v1"
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
    "growth": 0.18,
    "labor": 0.18,
    "inflation": 0.16,
    "consumer_production": 0.16,
    "housing": 0.12,
    "consumer_balance_sheet": 0.10,
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
    "housing": ["housing_starts", "building_permits", "mortgage_rate_30y"],
    "consumer balance sheet": [
        "household_debt_service_ratio",
        "consumer_debt_service_ratio",
        "credit_card_delinquency_rate",
    ],
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
    "bond_volatility_proxy": {"max_stale_days": 7},
    "brent_wti_spread": {"max_stale_days": 10},
    "net_liquidity": {"max_stale_days": 14},
    "hy_minus_ig_oas": {"max_stale_days": 10},
    "vix9d_vix_ratio": {"max_stale_days": 7},
    "vix_vix3m_ratio": {"max_stale_days": 7},
    "commodity_inflation_impulse": {"max_stale_days": 75},
}

# Importance weights drive coverage/freshness confidence so the aggregate is
# discriminating: losing VIX or US10Y is a big hit; losing corn_price is a
# rounding error. The high-importance set mirrors the importance>=5 signals in
# build_signal_priority.SIGNAL_CATALOG plus the canonical macro+rates anchors.
HIGH_IMPORTANCE_SERIES: frozenset[str] = frozenset(
    {
        "vix",
        "us10y",
        "us2y",
        "real_yield_10y",
        "high_yield_oas",
        "broad_dollar",
        "net_liquidity",
        "core_cpi",
        "initial_claims",
        "nonfarm_payrolls",
    }
)
_HIGH_IMPORTANCE_WEIGHT = 5.0
_DEFAULT_IMPORTANCE_WEIGHT = 1.0


def _series_importance_weight(series_id: str) -> float:
    """Return the 1-5 importance weight for a series (used in confidence math).

    High-importance series (defined in HIGH_IMPORTANCE_SERIES) carry weight 5;
    everything else carries weight 1. The ratio gives a coverage gap of one
    high-importance series roughly the same impact as five low-importance ones,
    matching the spec's design intent.
    """
    if series_id in HIGH_IMPORTANCE_SERIES:
        return _HIGH_IMPORTANCE_WEIGHT
    return _DEFAULT_IMPORTANCE_WEIGHT


def _series_freshness_weight(days_old: int, max_stale: int) -> float:
    """Linear freshness ramp used by recalibrated freshness confidence.

    At or below ``max_stale_days`` the series is fully fresh (1.0). It then
    linearly decays to 0.5 at ``2 * max_stale_days`` and to 0.0 at or beyond
    ``3 * max_stale_days``. ``max_stale`` of 0 collapses to a binary check.
    """
    if days_old <= max_stale:
        return 1.0
    if max_stale <= 0:
        return 0.0
    if days_old >= 3 * max_stale:
        return 0.0
    return max(0.0, 1.0 - (days_old - max_stale) / (2 * max_stale))


_DATA_QUALITY_TIER_THRESHOLDS: tuple[tuple[float, str], ...] = (
    (0.80, "high"),
    (0.60, "medium"),
    (0.40, "low"),
)


def _compute_data_quality_tier(overall_confidence: float) -> str:
    """Map a 0-1 overall_confidence to a discrete tier label.

    See spec: >=0.80 -> high, 0.60-0.79 -> medium, 0.40-0.59 -> low, <0.40 -> thin.
    """
    for threshold, tier in _DATA_QUALITY_TIER_THRESHOLDS:
        if overall_confidence >= threshold:
            return tier
    return "thin"


# Ordering reflects what most reduces overall_confidence today: high-importance
# series gaps first, then bucket-level breadth misses, then access/candidate
# gating, then everything else. Two to four entries surface in the banner.
_QUALITY_REASON_PRIORITY_PATTERNS: tuple[str, ...] = (
    "High-importance",
    "Bucket missing active inputs",
    "Series gated",
    "Series at candidate-only",
)


def _prioritized_quality_reasons(reasons: list[str], limit: int = 4) -> list[str]:
    """Return the top ``limit`` reasons ordered by impact bucket.

    Reasons are sorted into priority buckets so the banner can surface the
    2-4 most-impactful items. Within a priority bucket, ordering is the
    caller's natural order (already de-duplicated by ``sorted(set(...))`` in
    ``_confidence_breakdown``).
    """
    if not reasons:
        return []
    buckets: list[list[str]] = [[] for _ in _QUALITY_REASON_PRIORITY_PATTERNS]
    fallback: list[str] = []
    for reason in reasons:
        placed = False
        for index, pattern in enumerate(_QUALITY_REASON_PRIORITY_PATTERNS):
            if pattern in reason:
                buckets[index].append(reason)
                placed = True
                break
        if not placed:
            fallback.append(reason)
    ordered = [item for bucket in buckets for item in bucket] + fallback
    return ordered[:limit]


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


def build_bond_volatility_proxy(
    series_by_id: dict[str, dict[str, Any]],
    generated_at: str,
    window: int = 21,
) -> dict[str, Any]:
    us10y = series_by_id["us10y"]
    values = []
    for observation in us10y.get("observations", []):
        date = observation.get("date")
        value = observation.get("value")
        if isinstance(date, str) and _finite_number(value):
            values.append((date, float(value)))
    values.sort(key=lambda item: item[0])

    changes = [
        (values[index][0], values[index][1] - values[index - 1][1])
        for index in range(1, len(values))
    ]
    observations = []
    for index in range(window - 1, len(changes)):
        window_changes = [change for _, change in changes[index - window + 1 : index + 1]]
        realized_vol = statistics.pstdev(window_changes) * math.sqrt(252) * 100
        observations.append(
            {
                "date": changes[index][0],
                "value": round(realized_vol, 4),
            }
        )

    observations = enrich_observations(observations, "daily")
    return {
        "series_id": "bond_volatility_proxy",
        "generated_at_utc": generated_at,
        "source": "Derived",
        "source_url": "/data/series/us10y.json",
        "frequency": "daily",
        "units": "basis_points_annualized",
        "depends_on": ["us10y"],
        "method": (
            "Rolling 21-observation population standard deviation of daily 10-year Treasury "
            "yield changes, annualized by sqrt(252) and converted to basis points; not ICE MOVE "
            "and not an implied bond-volatility benchmark."
        ),
        "summary": series_summary(observations, "daily"),
        "observations": observations,
    }


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


def _direction_from_change(change: object, threshold: float = 0.05) -> str:
    if not _finite_number(change):
        return "unavailable"
    value = float(change)
    if value >= threshold:
        return "up"
    if value <= -threshold:
        return "down"
    return "flat"


def _summary_change(
    series_by_id: dict[str, dict[str, Any]],
    series_id: str,
    key: str = "change_1m",
) -> float | None:
    if series_id not in series_by_id:
        return None
    value = latest_summary(series_by_id[series_id]).get(key)
    return float(value) if _finite_number(value) else None


def _regime_label(tips_direction: str, dollar_direction: str) -> str:
    if "unavailable" in {tips_direction, dollar_direction}:
        return "Unavailable"
    if tips_direction == "down" and dollar_direction == "down":
        return "Strong risk-on"
    if tips_direction == "up" and dollar_direction == "down":
        return "Reallocation / rotation"
    if tips_direction == "up" and dollar_direction == "up":
        return "Tightening / risk-off"
    if tips_direction == "down" and dollar_direction == "up":
        return "Bonds-first / safe haven"
    return "Mixed"


def _yield_driver(
    nominal_change: float | None,
    real_change: float | None,
    breakeven_change: float | None,
) -> str:
    if nominal_change is None or real_change is None or breakeven_change is None:
        return "unavailable"
    if abs(nominal_change) < 0.05:
        return "mixed"
    real_abs = abs(real_change)
    breakeven_abs = abs(breakeven_change)
    if nominal_change > 0 and real_abs > breakeven_abs and real_change > 0:
        return "real_yield_driven"
    if nominal_change > 0 and breakeven_abs >= real_abs and breakeven_change > 0:
        return "breakeven_inflation_driven"
    if nominal_change < 0 and real_change < 0:
        return "real_yield_easing"
    if nominal_change < 0:
        return "safe_haven_or_growth_scare"
    return "mixed"


def _summary_value(
    series_by_id: dict[str, dict[str, Any]],
    series_id: str,
    key: str = "latest_value",
) -> float | None:
    if series_id not in series_by_id:
        return None
    value = latest_summary(series_by_id[series_id]).get(key)
    return float(value) if _finite_number(value) else None


def _series_values_by_date(series: dict[str, Any]) -> dict[str, float]:
    values = {}
    for observation in series.get("observations", []):
        date = observation.get("date")
        value = observation.get("value")
        if isinstance(date, str) and _finite_number(value):
            values[date] = float(value)
    return values


def _matched_observation_dates(
    series_by_id: dict[str, dict[str, Any]],
    series_ids: list[str],
) -> list[str]:
    date_sets = []
    for series_id in series_ids:
        if series_id not in series_by_id:
            return []
        date_sets.append(set(_series_values_by_date(series_by_id[series_id])))
    if not date_sets:
        return []
    return sorted(set.intersection(*date_sets))


def _confirmation_status(
    change: float | None,
    risk_on_confirming_direction: str,
    risk_off_confirming_direction: str,
    regime_label: str,
) -> str:
    if change is None:
        return "unavailable"
    direction = _direction_from_change(change)
    if direction == "flat":
        return "mixed"
    if regime_label == "Strong risk-on":
        return "confirming" if direction == risk_on_confirming_direction else "diverging"
    if regime_label == "Tightening / risk-off":
        return "confirming" if direction == risk_off_confirming_direction else "diverging"
    return "mixed"


def _direction_message(label: str, direction: str) -> str:
    if direction == "unavailable":
        return f"{label} one-month change is unavailable."
    return f"{label} is {direction} over one month."


def _build_quadrant_trail(series_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Build the legacy quadrant trail with TRUE 20-business-day lookback.

    DEPRECATED: prefer ``regime_dashboard.json windows.20D`` (built by
    ``scripts.transform.build_regime_dashboard``). This field is preserved
    for back-compat with consumers that still read regime_snapshot.json,
    but new code should consume the new file. The previous implementation
    used sequential daily deltas, which contradicted the chart label
    ("20-observation change"); this fix replaces each point's deltas with
    the true window-lookback value.
    """
    LOOKBACK = 20
    matched = _matched_observation_dates(series_by_id, ["broad_dollar", "real_yield_10y", "us10y"])
    if len(matched) <= LOOKBACK:
        return []
    # Take the last 20 dates as the visible trail window, using the date
    # that occurs LOOKBACK observations earlier in the matched series as
    # the lookback anchor for each visible point.
    visible_dates = matched[-LOOKBACK:]
    visible_indices = list(range(len(matched) - LOOKBACK, len(matched)))

    dollar = _series_values_by_date(series_by_id["broad_dollar"])
    real_yield = _series_values_by_date(series_by_id["real_yield_10y"])
    nominal = _series_values_by_date(series_by_id["us10y"])
    vix_percentiles = {
        observation.get("date"): observation.get("percentile_252d")
        for observation in series_by_id.get("vix", {}).get("observations", [])
    }
    credit_series_id = "hy_minus_ig_oas" if "hy_minus_ig_oas" in series_by_id else "high_yield_oas"
    credit = _series_values_by_date(series_by_id.get(credit_series_id, {}))

    trail = []
    for date, idx in zip(visible_dates, visible_indices, strict=False):
        anchor_idx = idx - LOOKBACK
        if anchor_idx < 0:
            continue
        anchor_date = matched[anchor_idx]
        row = {
            "date": date,
            "dollar_change": round(dollar[date] - dollar[anchor_date], 4),
            "real_yield_change": round(real_yield[date] - real_yield[anchor_date], 4),
            "nominal_yield_change": round(nominal[date] - nominal[anchor_date], 4),
        }
        percentile = vix_percentiles.get(date)
        row["vix_percentile"] = float(percentile) if _finite_number(percentile) else None
        row["credit_change"] = (
            round(credit[date] - credit[anchor_date], 4)
            if date in credit and anchor_date in credit
            else None
        )
        trail.append(row)
    return trail


def _build_yield_decomposition(series_by_id: dict[str, dict[str, Any]]) -> list[dict[str, float | str]]:
    dates = _matched_observation_dates(series_by_id, ["us10y", "real_yield_10y", "breakeven_10y"])[-260:]
    if not dates:
        return []
    nominal = _series_values_by_date(series_by_id["us10y"])
    real_yield = _series_values_by_date(series_by_id["real_yield_10y"])
    breakeven = _series_values_by_date(series_by_id["breakeven_10y"])
    return [
        {
            "date": date,
            "nominal_10y": nominal[date],
            "real_yield_10y": real_yield[date],
            "breakeven_10y": breakeven[date],
        }
        for date in dates
    ]


def build_regime_snapshot(series_by_id: dict[str, dict[str, Any]], generated_at: str) -> dict[str, Any]:
    real_change = _summary_change(series_by_id, "real_yield_10y")
    dollar_change = _summary_change(series_by_id, "broad_dollar")
    nominal_change = _summary_change(series_by_id, "us10y")
    breakeven_change = _summary_change(series_by_id, "breakeven_10y")
    credit_change = _summary_change(series_by_id, "hy_minus_ig_oas")
    if credit_change is None:
        credit_change = _summary_change(series_by_id, "high_yield_oas")
    liquidity_change = _summary_change(series_by_id, "net_liquidity")
    vix_change = _summary_change(series_by_id, "vix")

    tips_direction = _direction_from_change(real_change)
    dollar_direction = _direction_from_change(dollar_change)
    nominal_direction = _direction_from_change(nominal_change)
    yield_driver = _yield_driver(nominal_change, real_change, breakeven_change)
    label = _regime_label(tips_direction, dollar_direction)

    vix_value = _summary_value(series_by_id, "vix")
    vix3m_value = _summary_value(series_by_id, "vix3m")
    if vix_value is None or vix3m_value is None or vix3m_value == 0:
        vix_curve_state = "unavailable"
    elif vix_value > vix3m_value or (vix_value / vix3m_value) > 1:
        vix_curve_state = "backwardation_proxy"
    else:
        vix_curve_state = "contango_proxy"

    credit_status = _confirmation_status(credit_change, "down", "up", label)
    liquidity_status = _confirmation_status(liquidity_change, "up", "down", label)
    vix_status = _confirmation_status(vix_change, "down", "up", label)
    rates_status = _confirmation_status(real_change, "down", "up", label)

    latest_dates = _latest_dates(series_by_id)
    latest_date = max(latest_dates) if latest_dates else generated_at[:10]

    checklist = [
        {
            "id": "real_yield_10y",
            "label": "10Y real yield",
            "state": tips_direction,
            "message": _direction_message("10Y real yield", tips_direction),
        },
        {
            "id": "dollar",
            "label": "Broad dollar",
            "state": dollar_direction,
            "message": _direction_message("The broad dollar", dollar_direction),
        },
        {
            "id": "nominal_10y",
            "label": "10Y nominal yield",
            "state": nominal_direction,
            "message": _direction_message("10Y nominal yield", nominal_direction),
        },
        {
            "id": "yield_driver",
            "label": "Yield driver",
            "state": yield_driver,
            "message": (
                "Nominal yield driver inputs are unavailable."
                if yield_driver == "unavailable"
                else f"The nominal yield move is classified as {yield_driver.replace('_', ' ')}."
            ),
        },
        {
            "id": "vix_curve",
            "label": "VIX curve",
            "state": vix_curve_state,
            "message": f"VIX curve state is {vix_curve_state.replace('_', ' ')}.",
        },
        {
            "id": "credit",
            "label": "Credit spreads",
            "state": _direction_from_change(credit_change),
            "message": "Credit spread pressure is based on HY minus IG OAS when available.",
        },
        {
            "id": "liquidity",
            "label": "Net liquidity",
            "state": _direction_from_change(liquidity_change),
            "message": "Net liquidity confirmation uses the one-month change.",
        },
        {
            "id": "overall_regime",
            "label": "Overall regime",
            "state": label,
            "message": f"Active data classifies the backdrop as {label}.",
        },
    ]

    confirmations = [
        {
            "id": "credit",
            "label": "Credit",
            "status": credit_status,
            "message": f"Credit spreads are {credit_status} for the active regime.",
        },
        {
            "id": "vix_curve",
            "label": "VIX curve",
            "status": "unavailable" if vix_curve_state == "unavailable" else vix_status,
            "message": f"Volatility is {vix_status} and the curve is {vix_curve_state.replace('_', ' ')}.",
        },
        {
            "id": "liquidity",
            "label": "Liquidity",
            "status": liquidity_status,
            "message": f"Net liquidity is {liquidity_status} for the active regime.",
        },
        {
            "id": "rates",
            "label": "Rates",
            "status": rates_status,
            "message": f"Real yield momentum is {rates_status} for the active regime.",
        },
    ]

    return {
        "generated_at_utc": generated_at,
        "date": latest_date,
        "method_version": "phase5-horizon-regime-v1",
        "regime": {
            "label": label,
            "tips_direction": tips_direction,
            "dollar_direction": dollar_direction,
            "nominal_yield_direction": nominal_direction,
            "yield_driver": yield_driver,
        },
        "checklist": checklist,
        "confirmations": confirmations,
        "quadrant_trail": _build_quadrant_trail(series_by_id),
        "yield_decomposition": _build_yield_decomposition(series_by_id),
    }


def _shock_label(score: float) -> str:
    if score <= -35:
        return "Elevated shock risk"
    if score < 20:
        return "Mixed shock risk"
    return "Contained shock risk"


def _shock_signal(
    series_by_id: dict[str, dict[str, Any]],
    series_id: str,
    label: str,
    score: float,
    message: str,
) -> dict[str, Any]:
    summary = latest_summary(series_by_id[series_id])
    return {
        "id": series_id,
        "label": label,
        "score": score,
        "value": _number_from_summary(summary, "latest_value"),
        "change": _number_from_summary(summary, "change_1m"),
        "message": message,
    }


def build_shock_risk_snapshot(
    series_by_id: dict[str, dict[str, Any]],
    status_by_id: dict[str, dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    vix_score = _score_inverse_percentile_for_first(series_by_id, ["vix"])
    vix_curve_score = _score_inverse_percentile_for_first(series_by_id, ["vix_vix3m_ratio"])
    credit_score = _score_inverse_percentile_for_first(series_by_id, ["hy_minus_ig_oas", "high_yield_oas"])
    dollar_change = _summary_change(series_by_id, "broad_dollar")
    real_yield_change = _summary_change(series_by_id, "real_yield_10y")
    liquidity_change = _summary_change(series_by_id, "net_liquidity")
    dollar_score = clamp(-dollar_change * 15) if dollar_change is not None else None
    real_yield_score = clamp(-real_yield_change * 120) if real_yield_change is not None else None
    liquidity_score = clamp(liquidity_change / 25) if liquidity_change is not None else None
    active_pressure_scores = {
        key: score
        for key, score in {
            "vix": vix_score,
            "curve": vix_curve_score,
            "credit": credit_score,
            "dollar": dollar_score,
            "real_yield": real_yield_score,
            "liquidity": liquidity_score,
        }.items()
        if score is not None
    }
    active_pressure = weighted_score(
        active_pressure_scores,
        {
            "vix": 0.2,
            "curve": 0.2,
            "credit": 0.25,
            "dollar": 0.1,
            "real_yield": 0.15,
            "liquidity": 0.1,
        },
    )

    active_signals = []
    signal_specs = [
        ("vix", "VIX", vix_score, "VIX percentile is included in active shock-risk pressure."),
        (
            "vix_vix3m_ratio",
            "VIX/VIX3M ratio",
            vix_curve_score,
            "VIX curve pressure is included in active shock-risk pressure.",
        ),
        (
            "broad_dollar",
            "Broad dollar",
            dollar_score,
            "Broad dollar one-month change is included in active shock-risk pressure.",
        ),
        (
            "real_yield_10y",
            "10Y real yield",
            real_yield_score,
            "Real yield one-month change is included in active shock-risk pressure.",
        ),
        (
            "net_liquidity",
            "Net liquidity",
            liquidity_score,
            "Net liquidity one-month change is included in active shock-risk pressure.",
        ),
    ]
    credit_series_id, _ = _summary_for_first(series_by_id, ["hy_minus_ig_oas", "high_yield_oas"])
    if credit_series_id is not None:
        signal_specs.insert(
            2,
            (
                credit_series_id,
                "Credit spreads",
                credit_score,
                "Credit spread percentile is included in active shock-risk pressure.",
            ),
        )
    for series_id, label, score, message in signal_specs:
        if series_id in series_by_id and score is not None:
            active_signals.append(_shock_signal(series_by_id, series_id, label, score, message))

    source_labels = {
        "move_index": "MOVE Index",
        "skew_index": "SKEW Index",
    }
    source_gaps = []
    for series_id, label in source_labels.items():
        row = status_by_id.get(series_id)
        if row is not None and row.get("status") != "ok":
            source_gaps.append(
                {
                    "id": series_id,
                    "label": label,
                    "status": str(row.get("status", "unavailable")),
                    "message": str(row.get("message") or "Candidate source is not active for scoring."),
                }
            )
    change_source_gaps = [
        ("broad_dollar", "Broad dollar", dollar_change),
        ("real_yield_10y", "10Y real yield", real_yield_change),
        ("net_liquidity", "Net liquidity", liquidity_change),
    ]
    for series_id, label, change in change_source_gaps:
        if series_id in series_by_id and change is None:
            source_gaps.append(
                {
                    "id": series_id,
                    "label": label,
                    "status": "unavailable",
                    "message": (
                        "One-month change is unavailable, so this input is not active "
                        "in shock-risk signal rows."
                    ),
                }
            )

    credit_change = _summary_change(series_by_id, "hy_minus_ig_oas")
    if credit_change is None:
        credit_change = _summary_change(series_by_id, "high_yield_oas")
    mismatch_warnings = []
    if (
        real_yield_change is not None
        and dollar_change is not None
        and credit_change is not None
        and real_yield_change > 0
        and dollar_change > 0
        and credit_change > 0
    ):
        mismatch_warnings.append(
            {
                "id": "tightening_confirmation",
                "label": "Tightening confirmation",
                "message": (
                    "Real yields, the broad dollar, and credit spreads all rose over one month, "
                    "confirming tighter active financial conditions."
                ),
            }
        )

    latest_dates = _latest_dates(series_by_id)
    latest_date = max(latest_dates) if latest_dates else generated_at[:10]
    return {
        "generated_at_utc": generated_at,
        "date": latest_date,
        "method_version": "phase5-shock-risk-v1",
        "score": active_pressure,
        "label": _shock_label(active_pressure),
        "active_signals": active_signals,
        "source_gaps": source_gaps,
        "mismatch_warnings": mismatch_warnings,
    }


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


def _access_status_by_series_id() -> dict[str, str]:
    """Return a series_id -> access_status map sourced from the catalog.

    Wraps catalog_entries() so confidence math can ask "is this series gated?"
    without re-implementing AccessStatus derivation. Falls back to an empty
    map if the catalog raises (e.g. in test fixtures that don't depend on the
    catalog) so source_confidence keeps working in a degraded mode.
    """
    try:
        return {
            str(entry["id"]): str(entry.get("access_status", ""))
            for entry in catalog_entries()
            if entry.get("id") is not None
        }
    except Exception:
        return {}


# Maps AccessStatus values to their tier weight for source_confidence.
# See spec: ``free_public_active`` and ``proxy_only`` count full;
# ``free_public_candidate`` counts half; everything else counts 0.
_ACCESS_STATUS_SOURCE_WEIGHT: dict[str, float] = {
    "free_public_active": 1.0,
    "proxy_only": 1.0,
    "free_public_candidate": 0.5,
    "terms_review_needed": 0.0,
    "authenticated_candidate": 0.0,
    "restricted_vendor": 0.0,
    "unavailable": 0.0,
}


def _catalog_source_confidence(
    access_status_by_id: dict[str, str],
) -> tuple[float, list[str]]:
    """Tier-weighted source confidence across the entire catalog.

    Walks every catalog entry (not just per-block coverage groups) so the
    aggregate registers structural source gating — the dozens of TradingView
    mirror candidates and terms-review feeds that exist but cannot score.
    Returns the [0, 1] ratio plus a short reason describing the gating
    breakdown when it's not 1.0.
    """
    if not access_status_by_id:
        return 1.0, []
    numerator = 0.0
    denominator = 0.0
    gated_high_importance: list[str] = []
    tier_counts: dict[str, int] = {}
    for series_id, access_status in access_status_by_id.items():
        weight = _ACCESS_STATUS_SOURCE_WEIGHT.get(access_status, 0.0)
        denominator += 1.0
        numerator += weight
        tier_counts[access_status] = tier_counts.get(access_status, 0) + 1
        if (
            series_id in HIGH_IMPORTANCE_SERIES
            and weight < 1.0
        ):
            gated_high_importance.append(series_id)
    confidence = _ratio_confidence(numerator, denominator)
    reasons: list[str] = []
    gated_total = sum(
        count
        for status, count in tier_counts.items()
        if _ACCESS_STATUS_SOURCE_WEIGHT.get(status, 0.0) == 0.0
    )
    candidate_total = tier_counts.get("free_public_candidate", 0)
    if gated_total or candidate_total:
        parts: list[str] = []
        if gated_total:
            parts.append(f"{gated_total} sources gated")
        if candidate_total:
            parts.append(f"{candidate_total} candidate-only")
        reasons.append(
            f"Catalog source tier mix: {', '.join(parts)} of {int(denominator)} total."
        )
    if gated_high_importance:
        reasons.append(
            f"High-importance sources gated: {', '.join(sorted(gated_high_importance))}."
        )
    return confidence, reasons


def _ratio_confidence(numerator: float, denominator: float) -> float:
    """Clamp ``numerator/denominator`` into [0, 1] with a two-decimal round.

    Accepts floats so importance-weighted ratios (where the numerator is a sum
    of 1.0/5.0 weights, not raw counts) can reuse the same clamping.
    """
    if denominator <= 0:
        return 1.0
    return round(max(0.0, min(1.0, numerator / denominator)), 2)


def _coverage_confidence(coverage: dict[str, object]) -> tuple[float, list[str]]:
    """Importance-weighted coverage confidence.

    Each expected series contributes its importance weight to the denominator;
    available series contribute the same weight to the numerator. Losing a
    high-importance series (VIX, US10Y, etc.) therefore drops the metric far
    more than losing a low-importance one (e.g. corn_price).
    """
    expected = coverage.get("expected", [])
    available = coverage.get("available", [])
    if not isinstance(expected, list) or not expected:
        return 1.0, []
    available_set = set(available) if isinstance(available, list) else set()
    numerator = 0.0
    denominator = 0.0
    missing_high_importance: list[str] = []
    for series_id in expected:
        series_id_str = str(series_id)
        weight = _series_importance_weight(series_id_str)
        denominator += weight
        if series_id_str in available_set:
            numerator += weight
        elif series_id_str in HIGH_IMPORTANCE_SERIES:
            missing_high_importance.append(series_id_str)
    reasons: list[str] = []
    if missing_high_importance:
        reasons.append(
            f"High-importance coverage gap: {', '.join(sorted(missing_high_importance))}."
        )
    return _ratio_confidence(numerator, denominator), reasons


def _freshness_confidence(
    status_by_id: dict[str, dict[str, Any]],
    series_ids: list[str],
) -> tuple[float, list[str]]:
    """Importance-weighted linear-ramp freshness confidence.

    Each expected series contributes its importance weight. Its per-series
    freshness contribution is 1.0 at or below ``max_stale_days``, 0.5 at twice
    that, 0.0 at or beyond 3x. Series with no status row, ``failed``, or
    ``unavailable`` count as 0.0. ``terms_review_needed`` series are excluded
    from the denominator entirely (they belong to source_confidence).
    """
    considered_ids: list[str] = []
    for series_id in series_ids:
        series_id_str = str(series_id)
        row = status_by_id.get(series_id_str)
        if row is None:
            considered_ids.append(series_id_str)
            continue
        status = row.get("status")
        if status == "terms_review_needed":
            # Source gating problem, not a freshness problem.
            continue
        considered_ids.append(series_id_str)

    if not considered_ids:
        return 0.75, ["No active series available for freshness assessment."]

    numerator = 0.0
    denominator = 0.0
    reasons: list[str] = []
    stale_high_importance: list[str] = []
    failed_high_importance: list[str] = []

    for series_id in considered_ids:
        weight = _series_importance_weight(series_id)
        denominator += weight
        row = status_by_id.get(series_id)
        if row is None:
            # No status entry. Treat as missing freshness signal.
            continue
        status = row.get("status")
        max_stale = row.get("max_stale_days")
        days_old = row.get("freshness_days")
        if status == "ok":
            numerator += weight
            continue
        if status == "stale" and isinstance(days_old, int | float) and isinstance(max_stale, int | float):
            contribution = _series_freshness_weight(int(days_old), int(max_stale))
            numerator += weight * contribution
            if series_id in HIGH_IMPORTANCE_SERIES and contribution < 1.0:
                stale_high_importance.append(series_id)
            continue
        if status in {"failed", "unavailable"}:
            if series_id in HIGH_IMPORTANCE_SERIES:
                failed_high_importance.append(series_id)
            # numerator += 0
            continue
        # Unknown status (e.g. partial): treat as moderately stale.
        numerator += weight * 0.5

    if stale_high_importance:
        reasons.append(
            f"High-importance stale series: {', '.join(sorted(stale_high_importance))}."
        )
    if failed_high_importance:
        reasons.append(
            f"High-importance unavailable series: {', '.join(sorted(failed_high_importance))}."
        )
    return _ratio_confidence(numerator, denominator), reasons


def _model_confidence(
    bucket_weights: dict[str, float],
    coverage: dict[str, object],
) -> tuple[float, list[str]]:
    """Fraction of bucket weights that received at least one active signal.

    A bucket counts toward the numerator iff its coverage group has at least
    one available series. Buckets whose coverage group has no expected series
    (e.g. fragility's treasury_bond_volatility — MOVE is gated) count as
    unfed, surfacing the model-breadth gap that the prior heuristic masked.
    """
    if not bucket_weights:
        return 1.0, []
    groups = coverage.get("groups", {})
    if not isinstance(groups, dict):
        groups = {}
    # Groups are keyed by either the bucket name or a humanized variant
    # (macro_climate uses "consumer balance sheet" and "consumer/production").
    normalized_groups = {
        str(name).replace(" ", "_").replace("/", "_"): row
        for name, row in groups.items()
        if isinstance(row, dict)
    }

    numerator = 0.0
    denominator = 0.0
    unfed: list[str] = []
    for bucket, weight in bucket_weights.items():
        denominator += weight
        group = normalized_groups.get(bucket)
        if group is None:
            unfed.append(bucket)
            continue
        available = group.get("available", [])
        if isinstance(available, list) and len(available) > 0:
            numerator += weight
        else:
            unfed.append(bucket)

    reasons = [
        f"Bucket missing active inputs: {bucket}." for bucket in unfed
    ]
    return _ratio_confidence(numerator, denominator), reasons


def _source_confidence(
    series_ids: list[str],
    status_by_id: dict[str, dict[str, Any]],
    access_status_by_id: dict[str, str] | None = None,
) -> tuple[float, list[str]]:
    """Tier-weighted source confidence.

    Each expected series contributes 1.0 to the denominator. The numerator
    contribution depends on the underlying source's AccessStatus:

      * ``free_public_active`` / ``proxy_only`` -> 1.0 (active, scoring-eligible)
      * ``free_public_candidate``                -> 0.5 (validated but not active)
      * ``terms_review_needed`` / ``authenticated_candidate`` / ``restricted_vendor`` / ``unavailable`` -> 0.0

    When the catalog lookup is unavailable we fall back to the status row's
    ``status`` field — ``terms_review_needed`` and ``unavailable`` count as 0,
    everything else as 1.0 (the conservative read).
    """
    if not series_ids:
        return 1.0, []
    access = access_status_by_id or {}
    numerator = 0.0
    denominator = 0.0
    gated: list[str] = []
    candidate: list[str] = []
    for raw_id in series_ids:
        series_id = str(raw_id)
        denominator += 1.0
        access_status = access.get(series_id)
        if access_status is None:
            row = status_by_id.get(series_id, {})
            status = row.get("status")
            if status in {"terms_review_needed", "unavailable"}:
                gated.append(series_id)
                continue
            numerator += 1.0
            continue
        if access_status in {"free_public_active", "proxy_only"}:
            numerator += 1.0
        elif access_status == "free_public_candidate":
            numerator += 0.5
            candidate.append(series_id)
        else:
            gated.append(series_id)
    reasons: list[str] = []
    if gated:
        reasons.append(
            f"Series gated by access status: {', '.join(sorted(set(gated)))}."
        )
    if candidate:
        reasons.append(
            f"Series at candidate-only status: {', '.join(sorted(set(candidate)))}."
        )
    return _ratio_confidence(numerator, denominator), reasons


def _geometric_mean(values: list[float]) -> float:
    """Geometric mean of non-negative values. Returns 0 if any value is 0."""
    if not values:
        return 0.0
    product = 1.0
    for value in values:
        if value <= 0.0:
            return 0.0
        product *= value
    return product ** (1.0 / len(values))


def _confidence_breakdown(
    coverage: dict[str, object],
    status_by_id: dict[str, dict[str, Any]],
    notes: list[str],
    bucket_weights: dict[str, float] | None = None,
    access_status_by_id: dict[str, str] | None = None,
) -> tuple[dict[str, float], list[str]]:
    """Recalibrated confidence breakdown.

    Coverage, freshness, model, and source confidences each carry real
    information now (typical reading 0.5-0.85 instead of 0.97-1.00). The
    aggregate is the geometric mean of the four components so a single weak
    component meaningfully drags the headline down.
    """
    expected = coverage.get("expected", [])
    expected_ids = [str(item) for item in expected] if isinstance(expected, list) else []
    coverage_confidence, coverage_reasons = _coverage_confidence(coverage)
    freshness_confidence, freshness_reasons = _freshness_confidence(status_by_id, expected_ids)
    model_confidence, model_reasons = _model_confidence(bucket_weights or {}, coverage)
    source_confidence, source_reasons = _source_confidence(
        expected_ids, status_by_id, access_status_by_id
    )
    breakdown = {
        "coverage_confidence": coverage_confidence,
        "freshness_confidence": freshness_confidence,
        "model_confidence": model_confidence,
        "source_confidence": source_confidence,
    }
    breakdown["overall_confidence"] = round(
        _geometric_mean(
            [
                coverage_confidence,
                freshness_confidence,
                model_confidence,
                source_confidence,
            ]
        ),
        2,
    )
    reasons = sorted(
        set(
            coverage_reasons
            + freshness_reasons
            + model_reasons
            + source_reasons
            + notes
        )
    )
    return breakdown, reasons


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


def _score_housing(series_by_id: dict[str, dict[str, Any]]) -> float:
    return _score_average([
        _score_percentile_average(series_by_id, ["housing_starts", "building_permits"], inverse=False),
        _score_percentile_average(series_by_id, ["mortgage_rate_30y"], inverse=True),
    ]) or 0.0


def _score_consumer_balance_sheet(series_by_id: dict[str, dict[str, Any]]) -> float:
    return _score_percentile_average(
        series_by_id,
        [
            "household_debt_service_ratio",
            "consumer_debt_service_ratio",
            "credit_card_delinquency_rate",
        ],
        inverse=True,
    ) or 0.0


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
        "housing": _score_housing(series_by_id),
        "consumer_balance_sheet": _score_consumer_balance_sheet(series_by_id),
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
    housing_series_id, housing_summary = _summary_for_first(
        series_by_id,
        ["housing_starts", "building_permits", "mortgage_rate_30y"],
    )
    _append_driver_for_score(
        drivers,
        "housing",
        _score_housing(series_by_id),
        housing_series_id,
        housing_summary,
        "Housing activity and rate sensitivity are supportive.",
        "Housing activity or mortgage-rate pressure is restrictive.",
    )
    consumer_series_id, consumer_summary = _summary_for_first(
        series_by_id,
        [
            "household_debt_service_ratio",
            "consumer_debt_service_ratio",
            "credit_card_delinquency_rate",
        ],
    )
    _append_driver_for_score(
        drivers,
        "consumer_balance_sheet",
        _score_consumer_balance_sheet(series_by_id),
        consumer_series_id,
        consumer_summary,
        "Consumer balance-sheet stress is contained.",
        "Consumer balance-sheet stress is elevated.",
    )
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


def build_score_summary(
    series_by_id: dict[str, dict[str, Any]],
    generated_at: str,
    status_by_id: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    statuses = status_by_id or {}
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

    if "Missing fragility treasury_bond_volatility coverage: move_index." in fragility_notes:
        fragility_notes.remove("Missing fragility treasury_bond_volatility coverage: move_index.")
    fragility_notes.append("Treasury/bond volatility source is not active.")

    access_status_by_id = _access_status_by_series_id()
    market_confidence, market_confidence_reasons = _confidence_breakdown(
        market_coverage,
        statuses,
        market_notes,
        bucket_weights=MARKET_WEIGHTS,
        access_status_by_id=access_status_by_id,
    )
    macro_confidence, macro_confidence_reasons = _confidence_breakdown(
        macro_coverage,
        statuses,
        macro_notes,
        bucket_weights=MACRO_WEIGHTS,
        access_status_by_id=access_status_by_id,
    )
    fragility_confidence, fragility_confidence_reasons = _confidence_breakdown(
        fragility_coverage,
        statuses,
        fragility_notes,
        bucket_weights=FRAGILITY_WEIGHTS,
        access_status_by_id=access_status_by_id,
    )

    market_block = score_block(
        market_score,
        label_for_three_score(market_score, "market_weather"),
        market_buckets,
        MARKET_WEIGHTS,
        _market_weather_drivers(series_by_id, market_buckets),
        market_confidence_reasons,
        market_notes,
        confidence=market_confidence["overall_confidence"],
        confidence_breakdown=market_confidence,
    )
    market_block["source_coverage"] = market_coverage
    macro_block = score_block(
        macro_score,
        label_for_three_score(macro_score, "macro_climate"),
        macro_buckets,
        MACRO_WEIGHTS,
        _macro_climate_drivers(series_by_id),
        macro_confidence_reasons,
        macro_notes,
        confidence=macro_confidence["overall_confidence"],
        confidence_breakdown=macro_confidence,
    )
    macro_block["source_coverage"] = macro_coverage
    fragility_block = score_block(
        fragility_score,
        label_for_three_score(fragility_score, "fragility"),
        fragility_buckets,
        FRAGILITY_WEIGHTS,
        _fragility_drivers(series_by_id),
        fragility_confidence_reasons,
        fragility_notes,
        confidence=fragility_confidence["overall_confidence"],
        confidence_breakdown=fragility_confidence,
    )
    fragility_block["source_coverage"] = fragility_coverage

    latest_dates = _latest_dates(series_by_id)
    latest_date = max(latest_dates) if latest_dates else generated_at[:10]
    quality_reasons = sorted(
        set(market_confidence_reasons + macro_confidence_reasons + fragility_confidence_reasons)
    )
    # Top-level source_confidence draws from the FULL catalog (not per-block
    # coverage groups) so structural source gating — the dozens of TradingView
    # candidate mirrors and terms_review_needed feeds — register in the
    # aggregate. The other three components average the per-block values
    # because they reflect today's read of the scoring model, which is
    # the per-block scope.
    catalog_source_confidence, catalog_source_reasons = _catalog_source_confidence(
        access_status_by_id
    )
    if catalog_source_reasons:
        quality_reasons = sorted(set(quality_reasons + catalog_source_reasons))
    data_quality_components = {
        "coverage_confidence": round(
            (
                market_confidence["coverage_confidence"]
                + macro_confidence["coverage_confidence"]
                + fragility_confidence["coverage_confidence"]
            )
            / 3,
            2,
        ),
        "freshness_confidence": round(
            (
                market_confidence["freshness_confidence"]
                + macro_confidence["freshness_confidence"]
                + fragility_confidence["freshness_confidence"]
            )
            / 3,
            2,
        ),
        "model_confidence": round(
            (
                market_confidence["model_confidence"]
                + macro_confidence["model_confidence"]
                + fragility_confidence["model_confidence"]
            )
            / 3,
            2,
        ),
        "source_confidence": catalog_source_confidence,
    }
    aggregate_overall = round(
        _geometric_mean(
            [
                data_quality_components["coverage_confidence"],
                data_quality_components["freshness_confidence"],
                data_quality_components["model_confidence"],
                data_quality_components["source_confidence"],
            ]
        ),
        2,
    )
    data_quality = {
        **data_quality_components,
        "overall_confidence": aggregate_overall,
        "tier": _compute_data_quality_tier(aggregate_overall),
        "reasons": _prioritized_quality_reasons(quality_reasons),
    }

    return {
        "conflicting_signals": [],
        "generated_at_utc": generated_at,
        "date": latest_date,
        "method_version": METHOD_VERSION,
        "scores": {
            "market_weather": market_block,
            "macro_climate": macro_block,
            "fragility": fragility_block,
        },
        "data_quality": data_quality,
    }


def _score_history_attribution(block: dict[str, Any]) -> dict[str, list[Any]]:
    return {
        "recent_changes": list(block.get("recent_changes", [])),
        "top_risks": list(block.get("top_risks", [])),
        "top_supports": list(block.get("top_supports", [])),
    }


def _existing_score_history_observations() -> list[dict[str, Any]]:
    path = data_dir() / "derived" / "score_history.json"
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    observations = payload.get("observations")
    return list(observations) if isinstance(observations, list) else []


def build_score_history(score_summary: dict[str, Any], generated_at: str) -> dict[str, Any]:
    scores = score_summary.get("scores", {})
    date = str(score_summary.get("date", generated_at[:10]))
    current = {
        "date": date,
        "market_weather": float(scores["market_weather"]["score"]),
        "macro_climate": float(scores["macro_climate"]["score"]),
        "fragility": float(scores["fragility"]["score"]),
    }
    observations_by_date = {
        str(observation.get("date")): dict(observation)
        for observation in _existing_score_history_observations()
        if isinstance(observation, dict) and isinstance(observation.get("date"), str)
    }
    observations_by_date[date] = current
    observations = [observations_by_date[key] for key in sorted(observations_by_date)][-520:]
    return {
        "generated_at_utc": generated_at,
        "method_version": "phase5-score-history-v1",
        "observations": observations,
        "latest_attribution": {
            "market_weather": _score_history_attribution(scores["market_weather"]),
            "macro_climate": _score_history_attribution(scores["macro_climate"]),
            "fragility": _score_history_attribution(scores["fragility"]),
        },
    }


def _status_for_series(entry: dict[str, Any], series: dict[str, Any], generated_at: str) -> dict[str, Any]:
    if entry.get("access_status") == "unavailable" or entry.get("terms_status") == "restricted":
        return {
            "status": "unavailable",
            "last_observation": None,
            "observation_period": None,
            "source": entry["source"],
            "expected_frequency": entry["frequency"],
            "freshness_days": None,
            "max_stale_days": entry["max_stale_days"],
            "expected_next_release_window": None,
            "message": "Source is unavailable for automated static ingestion.",
        }
    candidate_can_report_freshness = (
        entry.get("score_status") == "candidate"
        and entry.get("access_status") == "free_public"
        and entry.get("terms_status") in {"ok", "review_each_series"}
        and (
            isinstance(series.get("summary"), dict)
            or bool(series.get("observations"))
        )
    )
    if (
        not candidate_can_report_freshness
        and (
            entry.get("score_status") == "candidate"
            or entry.get("access_status") == "terms_review_needed"
        )
        or entry.get("terms_status") == "review_needed"
    ):
        return {
            "status": "terms_review_needed",
            "last_observation": None,
            "observation_period": None,
            "source": entry["source"],
            "expected_frequency": entry["frequency"],
            "freshness_days": None,
            "max_stale_days": entry["max_stale_days"],
            "expected_next_release_window": None,
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
    status_payload = {
        "status": freshness["status"],
        "last_observation": freshness["last_observation"],
        "observation_period": freshness["observation_period"],
        "source": entry["source"],
        "expected_frequency": entry["frequency"],
        "freshness_days": freshness["freshness_days"],
        "max_stale_days": entry["max_stale_days"],
        "expected_next_release_window": freshness["expected_next_release_window"],
        "message": (
            f"{freshness['message']} candidate diagnostic only; does not affect active scores."
            if entry.get("score_status") == "candidate"
            else freshness["message"]
        ),
    }
    if entry.get("score_status") == "candidate":
        status_payload["score_status"] = "candidate"
    return status_payload


def _unavailable_status_for_series(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "last_observation": None,
        "observation_period": None,
        "source": entry["source"],
        "expected_frequency": entry["frequency"],
        "freshness_days": None,
        "max_stale_days": entry["max_stale_days"],
        "expected_next_release_window": None,
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
        series = series_by_id.get(series_id)
        if series is None and entry.get("public") is True:
            payload_paths = [
                series_path(series_id),
                data_dir() / "derived" / f"{series_id}.json",
            ]
            for payload_path in payload_paths:
                if payload_path.exists():
                    series = json.loads(payload_path.read_text(encoding="utf-8"))
                    break
        statuses[series_id] = _status_for_series(
            entry,
            series or {},
            generated_at,
        )
    for series_id, metadata in DERIVED_STATUS_METADATA.items():
        if series_id in statuses:
            continue
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

    bond_volatility_proxy = build_bond_volatility_proxy(series_by_id, generated_at)
    write_json(
        data_dir() / "derived" / "bond_volatility_proxy.json",
        bond_volatility_proxy,
    )
    series_by_id["bond_volatility_proxy"] = bond_volatility_proxy

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

    status = build_status(series_by_id, generated_at)
    score_summary = build_score_summary(series_by_id, generated_at, status["series"])
    write_json(data_dir() / "derived" / "score_summary.json", score_summary)
    score_history = build_score_history(score_summary, generated_at)
    write_json(data_dir() / "derived" / "score_history.json", score_history)
    regime_snapshot = build_regime_snapshot(series_by_id, generated_at)
    write_json(data_dir() / "derived" / "regime_snapshot.json", regime_snapshot)
    regime_replay = build_regime_replay(series_by_id, generated_at)
    write_json(data_dir() / "derived" / "regime_replay.json", regime_replay)
    shock_risk_snapshot = build_shock_risk_snapshot(series_by_id, status["series"], generated_at)
    write_json(data_dir() / "derived" / "shock_risk_snapshot.json", shock_risk_snapshot)

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

    write_json(data_dir() / "status" / "data_status.json", status)


if __name__ == "__main__":
    main()
