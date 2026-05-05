from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ScoreDriver:
    bucket: str
    direction: Literal["support", "risk"]
    impact: float
    text: str
    series_id: str
    latest_value: float | None
    recent_change: float | None


def clamp(value: float) -> float:
    return round(max(-100.0, min(100.0, float(value))), 2)


def weighted_score(scores: dict[str, float], weights: dict[str, float]) -> float:
    total_weight = sum(weight for key, weight in weights.items() if key in scores)
    if total_weight == 0:
        return 0.0
    score = sum(scores[key] * weights[key] for key in scores if key in weights) / total_weight
    return clamp(score)


def confidence_from_reasons(reasons: list[str]) -> float:
    return round(max(0.4, 1.0 - (len(reasons) * 0.1)), 2)


def driver_texts(
    drivers: list[ScoreDriver],
    direction: Literal["support", "risk"],
    limit: int = 3,
) -> list[str]:
    if limit <= 0:
        return []

    ordered = sorted(
        [driver for driver in drivers if driver.direction == direction],
        key=lambda driver: abs(driver.impact),
        reverse=True,
    )
    texts: list[str] = []
    for driver in ordered:
        if driver.text not in texts:
            texts.append(driver.text)
        if len(texts) == limit:
            break
    return texts


def label_for_three_score(score: float, score_key: str) -> str:
    if score_key == "fragility":
        if score <= -50:
            return "High Fragility"
        if score <= -20:
            return "Elevated Fragility"
        if score < 20:
            return "Moderate"
        return "Low Fragility"

    if score <= -50:
        return "Stressed"
    if score <= -20:
        return "Fragile"
    if score < 20:
        return "Mixed"
    return "Supportive"


def score_block(
    score: float,
    label: str,
    bucket_scores: dict[str, float],
    bucket_weights: dict[str, float],
    drivers: list[ScoreDriver],
    confidence_reasons: list[str],
    missing_or_stale_notes: list[str],
    confidence: float | None = None,
    confidence_breakdown: dict[str, float] | None = None,
) -> dict[str, object]:
    recent_changes = driver_texts(drivers, "risk", limit=2) + driver_texts(
        drivers,
        "support",
        limit=2,
    )
    block: dict[str, object] = {
        "score": clamp(score),
        "label": label,
        "confidence": round(max(0.0, min(1.0, confidence)), 2)
        if confidence is not None
        else confidence_from_reasons(confidence_reasons + missing_or_stale_notes),
        "confidence_reasons": confidence_reasons,
        "bucket_scores": bucket_scores,
        "bucket_weights": bucket_weights,
        "top_supports": driver_texts(drivers, "support"),
        "top_risks": driver_texts(drivers, "risk"),
        "recent_changes": recent_changes[:4],
        "missing_or_stale_notes": missing_or_stale_notes,
    }
    if confidence_breakdown is not None:
        block["confidence_breakdown"] = confidence_breakdown
    return block
