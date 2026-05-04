from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Any

from scripts.shared.catalog import available_catalog_entries
from scripts.shared.io import data_dir, series_path, write_json
from scripts.transform.compute_percentiles import enrich_observations, series_summary


WEIGHTS = {
    "volatility": 0.20,
    "rates": 0.15,
    "liquidity": 0.20,
    "credit": 0.20,
    "commodities": 0.10,
    "sentiment": 0.15,
}
METHOD_VERSION = "phase2-public-data-v1"
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
        summary = latest_summary(series_by_id[series_id])
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


def _title(name: str) -> str:
    return name.replace("_", " ").title()


def _status_for_series(entry: dict[str, Any], series: dict[str, Any], generated_at: str) -> dict[str, Any]:
    summary = latest_summary(series)
    latest_date = summary.get("latest_date")
    freshness_days = None
    status = "failed"
    message = "No observations available."
    if isinstance(latest_date, str):
        current_date = datetime.fromisoformat(generated_at.replace("Z", "+00:00")).date()
        observed_date = datetime.fromisoformat(latest_date).date()
        freshness_days = (current_date - observed_date).days
        if freshness_days < 0:
            status = "failed"
            message = "Latest observation is future-dated."
        elif freshness_days > int(entry["max_stale_days"]):
            status = "stale"
            message = f"Latest observation is {freshness_days} days old."
        else:
            status = "ok"
            message = "Fresh."
    return {
        "status": status,
        "last_observation": latest_date if isinstance(latest_date, str) else None,
        "source": entry["source"],
        "expected_frequency": entry["frequency"],
        "freshness_days": freshness_days,
        "max_stale_days": entry["max_stale_days"],
        "message": message,
    }


def build_status(series_by_id: dict[str, dict[str, Any]], generated_at: str) -> dict[str, Any]:
    statuses = {
        str(entry["id"]): _status_for_series(entry, series_by_id[str(entry["id"])], generated_at)
        for entry in available_catalog_entries()
    }
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

    values = [status["status"] for status in statuses.values()]
    if any(status == "failed" for status in values):
        overall = "failed"
    elif any(status == "stale" for status in values):
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

    commodity_inflation_dependencies = {
        "wti_crude",
        "brent_crude",
        "corn_price",
        "wheat_price",
        "soybean_price",
        "breakeven_10y",
    }
    if commodity_inflation_dependencies <= set(series_by_id):
        commodity_inflation_impulse = build_commodity_inflation_impulse(series_by_id, generated_at)
        write_json(
            data_dir() / "derived" / "commodity_inflation_impulse.json",
            commodity_inflation_impulse,
        )
        series_by_id["commodity_inflation_impulse"] = commodity_inflation_impulse

    buckets = {
        "volatility": score_volatility(series_by_id),
        "rates": score_rates(series_by_id),
        "liquidity": score_liquidity(series_by_id),
        "credit": score_credit(series_by_id),
        "commodities": score_commodities(series_by_id),
        "sentiment": score_sentiment(series_by_id),
    }
    overall_score = weighted_score(buckets, WEIGHTS)
    latest_dates = [
        latest_summary(series).get("latest_date")
        for series in series_by_id.values()
        if isinstance(latest_summary(series).get("latest_date"), str)
    ]
    latest_date = max(latest_dates)

    write_json(
        data_dir() / "derived" / "bucket_scores.json",
        {
            "generated_at_utc": generated_at,
            "date": latest_date,
            "method_version": METHOD_VERSION,
            "buckets": buckets,
            "weights": WEIGHTS,
        },
    )

    ordered = sorted(buckets.items(), key=lambda item: item[1])
    write_json(
        data_dir() / "derived" / "regime_score.json",
        {
            "date": latest_date,
            "generated_at_utc": generated_at,
            "overall_score": overall_score,
            "label": label_for_score(overall_score),
            "buckets": buckets,
            "top_supports": [_title(name) for name, score in reversed(ordered) if score > 0][:3],
            "top_risks": [_title(name) for name, score in ordered if score < 0][:3],
            "method_version": METHOD_VERSION,
        },
    )

    write_json(data_dir() / "status" / "data_status.json", build_status(series_by_id, generated_at))


if __name__ == "__main__":
    main()
