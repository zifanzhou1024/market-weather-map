from __future__ import annotations

import json
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
METHOD_VERSION = "phase1-github-native-v1"


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
    fed_change = _pct_change(latest_summary(series["fed_assets"]))
    reverse_repo_change = _pct_change(latest_summary(series["reverse_repo"]))

    fed_score = clamp((fed_change or 0.0) * 20)
    reverse_repo_score = clamp(-(reverse_repo_change or 0.0) * 10)
    return weighted_score(
        {"fed_assets": fed_score, "reverse_repo": reverse_repo_score},
        {"fed_assets": 0.60, "reverse_repo": 0.40},
    )


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


def build_curve(generated_at: str) -> dict[str, Any]:
    return build_matched_spread(
        "us10y",
        "us2y",
        "us10y_minus_us2y",
        generated_at,
        "percentage_points",
        "10-year Treasury yield minus 2-year Treasury yield by matched observation date.",
    )


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

    if "brent_crude" in series_by_id and "wti_crude" in series_by_id:
        write_json(
            data_dir() / "derived" / "brent_wti_spread.json",
            build_matched_spread(
                "brent_crude",
                "wti_crude",
                "brent_wti_spread",
                generated_at,
                "usd_per_barrel",
                "Brent crude spot price minus WTI crude spot price by matched observation date.",
            ),
        )

    buckets = {
        "volatility": score_volatility(series_by_id),
        "rates": score_rates(series_by_id),
        "liquidity": score_liquidity(series_by_id),
        "credit": score_credit(series_by_id),
        "commodities": score_commodities(series_by_id),
        "sentiment": 0.0,
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
