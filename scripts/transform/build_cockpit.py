"""Builds public/data/derived/cockpit.json from signal_priority + series + scores.

Selection rule (see spec §"Cockpit selection rule"):
1. For each whitelist entry, compute a per-cell payload from its primary series.
2. Look up today's priority from signal_priority.json by matching priority_key.
3. Filter out unavailable / non-active cells.
4. Sort by (priority desc, importance desc, id asc).
5. Take top 9 as vital_signs; emit the rest as candidates_not_shown.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from scripts.shared.cockpit_whitelist import (
    COCKPIT_WHITELIST,
    REGIME_TONE_MAP,
    CockpitSecondaryLine,
    CockpitSignal,
)
from scripts.shared.io import utc_now_iso
from scripts.transform._cockpit_inputs import (
    load_series_observations,
    load_signal_priority_index,
)
from scripts.transform._cockpit_math import (
    delta_against_window,
    percentile_5y,
    sparkline_90d,
)

SUPPORTED_VALUE_TRANSFORMS: frozenset[str] = frozenset({"yoy_pct"})

METHOD_VERSION = "phase-e-cockpit-v1"
MAX_VITAL_SIGNS = 9
COMPOSITE_SCORE_ORDER: tuple[str, ...] = ("market_weather", "macro_climate", "fragility")


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text())


def _compose_composite_scores(
    score_summary: dict[str, Any],
    score_history: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Compose the three composite score cells.

    When `score_history` (derived/score_history.json) is available, populate
    percentile_5y / sparkline_90d / delta_7d / delta_1m from its observations.
    When it is missing or empty, those fields stay null/empty — the frontend
    renders a placeholder rather than misleading numbers.
    """
    scores = score_summary.get("scores", {})
    history_obs = (score_history or {}).get("observations", []) or []
    out: list[dict[str, Any]] = []
    for sid in COMPOSITE_SCORE_ORDER:
        s = scores.get(sid, {})
        # Per-composite mini-series extracted from the multi-column history.
        series = [
            {"date": o["date"], "value": o[sid]}
            for o in history_obs
            if o.get(sid) is not None
        ]
        series.sort(key=lambda o: o["date"])
        if series:
            pct, window = percentile_5y(series)
            spark = sparkline_90d(series)
            d7 = delta_against_window(series, days=7)
            d1m = delta_against_window(series, days=30)
        else:
            pct, window = None, 0
            spark = []
            d7 = None
            d1m = None
        out.append({
            "id": sid,
            "label": sid.replace("_", " ").title(),
            "value": s.get("score"),
            "regime_label": s.get("label"),
            "percentile_5y": pct,
            "percentile_window_days": window if pct is not None else None,
            "delta_7d": d7,
            "delta_1m": d1m,
            "sparkline_90d": spark,
            "direction": "neutral",
        })
    return out


def _apply_yoy_pct_transform(observations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert raw observations into year-over-year percent change.

    For each observation at date T, find the closest prior observation in the
    window [T-400d, T-330d] (i.e. ~12 months back, tolerating monthly cadence
    drift) and compute (value[T] - prior) / prior * 100. Observations without
    a comparable 12-month-prior value are dropped.
    """
    if not observations:
        return observations
    by_date = {
        datetime.strptime(o["date"], "%Y-%m-%d").date(): o["value"]
        for o in observations
    }
    out: list[dict[str, Any]] = []
    for o in observations:
        d = datetime.strptime(o["date"], "%Y-%m-%d").date()
        target = d - timedelta(days=365)
        low = d - timedelta(days=400)
        high = d - timedelta(days=330)
        candidates = [(cd, cv) for cd, cv in by_date.items() if low <= cd <= high]
        if not candidates:
            continue
        candidates.sort(key=lambda pair: abs((pair[0] - target).days))
        prior_value = candidates[0][1]
        if prior_value == 0:
            continue
        yoy = (o["value"] - prior_value) / prior_value * 100
        out.append({"date": o["date"], "value": yoy})
    return out


def _apply_value_transform_and_scale(
    obs: list[dict[str, Any]],
    entry: CockpitSignal,
) -> list[dict[str, Any]]:
    """Apply named transform (if any), then numeric scale (if not 1.0).

    Returns a new list. Callers should treat the result as the canonical
    observations used downstream (percentile, sparkline, delta).
    """
    if entry.value_transform is not None:
        if entry.value_transform not in SUPPORTED_VALUE_TRANSFORMS:
            raise ValueError(
                f"Unknown value_transform {entry.value_transform!r} "
                f"on cockpit signal {entry.id!r}"
            )
        if entry.value_transform == "yoy_pct":
            obs = _apply_yoy_pct_transform(obs)
    if entry.value_scale != 1.0:
        obs = [
            {"date": o["date"], "value": o["value"] * entry.value_scale}
            for o in obs
        ]
    return obs


def _compose_vital_sign(
    entry: CockpitSignal,
    series_root: Path,
    data_status: dict[str, Any],
    priority_index: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    """Return the payload for one whitelist entry, or None if unavailable."""
    # Load primary series — try public/data/series first, then public/data/derived.
    obs = _load_series_or_derived(series_root, entry.primary_series_id)
    if obs is None:
        return None

    # Freshness + score_status come from data_status.json
    status_entry = data_status.get("series", {}).get(entry.primary_series_id, {})
    freshness = _normalize_freshness(status_entry.get("status"))
    score_status = _project_score_status(status_entry.get("status"))
    if score_status != "active":
        return None  # defense-in-depth — never emit a candidate cell

    # Apply transform (e.g. yoy_pct) then numeric scale (e.g. % → bp) before
    # any downstream math; primary_value, percentile, deltas, and sparkline
    # must all reflect the displayed units.
    obs = _apply_value_transform_and_scale(obs, entry)
    if not obs:
        # Transform may legitimately drop all rows (e.g. yoy_pct with < 1y history).
        return None

    # Per-cell payload
    pct, window = percentile_5y(obs)
    priority_meta = priority_index.get(entry.priority_key, {})
    payload = {
        "id": entry.id,
        "label": entry.display_label,
        "primary_value": obs[-1]["value"],
        "primary_unit": entry.primary_unit,
        "primary_decimals": entry.primary_decimals,
        "secondary_values": _compose_secondary_values(entry, series_root),
        "percentile_5y": pct,
        "percentile_window_days": window,
        "delta_7d": delta_against_window(obs, days=7),
        "delta_1m": delta_against_window(obs, days=30),
        "sparkline_90d": sparkline_90d(obs),
        "freshness_status": freshness,
        "score_status": score_status,
        "as_of": obs[-1]["date"],
        "direction": entry.direction,
        "source_series_ids": [entry.primary_series_id] + [s.series_id for s in entry.secondary_lines],
        "priority": float(priority_meta.get("priority", 0)),
        "importance": int(priority_meta.get("importance", entry.importance)),
        "why_it_matters": priority_meta.get("why_it_matters") or entry.why_it_matters,
    }
    return payload


def _compose_secondary_values(entry: CockpitSignal, series_root: Path) -> list[dict[str, Any]]:
    out = []
    for sec in entry.secondary_lines:
        obs = _load_series_or_derived(series_root, sec.series_id)
        if obs is None:
            continue
        obs = _apply_secondary_transform_and_scale(obs, sec)
        if not obs:
            continue
        out.append({"label": sec.label, "value": obs[-1]["value"], "unit": sec.unit})
    return out


def _apply_secondary_transform_and_scale(
    obs: list[dict[str, Any]],
    sec: CockpitSecondaryLine,
) -> list[dict[str, Any]]:
    """Mirror of _apply_value_transform_and_scale for secondary chips."""
    if sec.value_transform is not None:
        if sec.value_transform not in SUPPORTED_VALUE_TRANSFORMS:
            raise ValueError(
                f"Unknown value_transform {sec.value_transform!r} "
                f"on secondary line {sec.label!r}"
            )
        if sec.value_transform == "yoy_pct":
            obs = _apply_yoy_pct_transform(obs)
    if sec.value_scale != 1.0:
        obs = [
            {"date": o["date"], "value": o["value"] * sec.value_scale}
            for o in obs
        ]
    return obs


def _load_series_or_derived(series_root: Path, series_id: str) -> list[dict[str, Any]] | None:
    """Look for series_id in series/ then derived/ subdirs of series_root, then bare."""
    for sub in ("series", "derived", ""):
        if sub:
            candidate = series_root / sub / f"{series_id}.json"
        else:
            candidate = series_root / f"{series_id}.json"
        obs = load_series_observations(candidate)
        if obs is not None:
            return obs
    return None


def _normalize_freshness(status: str | None) -> str:
    if status in {"ok", "stale", "unavailable"}:
        return status
    return "unavailable"


def _project_score_status(status: str | None) -> str:
    """Project per-status freshness into the score_status enum.

    `_compose_vital_sign` only emits cells whose score_status is "active";
    "candidate" is kept here to document intent (the data_status enum surfaces
    gated sources) but is treated as non-active downstream and surfaces as
    `reason: "candidate"` in `candidates_not_shown`.
    """
    if status in {"ok", "stale"}:
        return "active"
    if status == "terms_review_needed":
        return "candidate"
    return "unavailable"


def build_cockpit_payload(input_root: Path) -> dict[str, Any]:
    """Pure function: read inputs, produce cockpit.json payload.

    Reads from a real public/data/ layout:
      - <input_root>/derived/signal_priority.json
      - <input_root>/derived/score_summary.json
      - <input_root>/derived/regime_snapshot.json
      - <input_root>/status/data_status.json
      - <input_root>/series/*.json + <input_root>/derived/*.json (series files)
    """
    signal_priority = load_signal_priority_index(input_root / "derived" / "signal_priority.json")
    score_summary = _read_json(input_root / "derived" / "score_summary.json", {})
    score_history = _read_json(input_root / "derived" / "score_history.json", {})
    regime_snapshot = _read_json(input_root / "derived" / "regime_snapshot.json", {})
    data_status = _read_json(input_root / "status" / "data_status.json", {"series": {}})

    composite = _compose_composite_scores(score_summary, score_history)

    # Compose all whitelist entries
    cells_with_priority: list[tuple[float, int, str, dict[str, Any]]] = []
    skipped: list[dict[str, Any]] = []
    for entry in COCKPIT_WHITELIST:
        cell = _compose_vital_sign(entry, input_root, data_status, signal_priority)
        if cell is None:
            # Distinguish "gated by source review" from "no data".
            status_entry = data_status.get("series", {}).get(entry.primary_series_id, {})
            raw_status = status_entry.get("status")
            reason = "candidate" if raw_status == "terms_review_needed" else "unavailable"
            skipped.append({
                "id": entry.id,
                "priority": float(signal_priority.get(entry.priority_key, {}).get("priority", 0)),
                "reason": reason,
            })
            continue
        cells_with_priority.append((cell["priority"], cell["importance"], entry.id, cell))

    # Sort: priority desc, importance desc, id asc
    cells_with_priority.sort(key=lambda t: (-t[0], -t[1], t[2]))
    vital_signs = [c for _, _, _, c in cells_with_priority[:MAX_VITAL_SIGNS]]
    for rank, vs in enumerate(vital_signs, start=1):
        vs["rank"] = rank
    not_shown = skipped + [
        {"id": entry_id, "priority": prio, "reason": "below top 9 today"}
        for prio, _, entry_id, _ in cells_with_priority[MAX_VITAL_SIGNS:]
    ]

    regime_label = regime_snapshot.get("regime", {}).get("label", "Unknown")

    return {
        "generated_at_utc": utc_now_iso(),
        "date": score_summary.get("date"),
        "method_version": METHOD_VERSION,
        "regime": {
            "label": regime_label,
            "tone": REGIME_TONE_MAP.get(regime_label, "neutral"),
        },
        "composite_scores": composite,
        "vital_signs": vital_signs,
        "candidates_not_shown": not_shown,
    }


def main() -> None:
    """CLI entry point — reads from public/data/, writes public/data/derived/cockpit.json."""
    from scripts.shared.io import write_json

    project_root = Path(__file__).resolve().parents[2]
    data_root = project_root / "public" / "data"

    payload = build_cockpit_payload(data_root)
    out_path = data_root / "derived" / "cockpit.json"
    write_json(out_path, payload)


if __name__ == "__main__":
    main()
