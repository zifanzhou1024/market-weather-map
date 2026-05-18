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
from pathlib import Path
from typing import Any

from scripts.shared.cockpit_whitelist import (
    COCKPIT_WHITELIST,
    REGIME_TONE_MAP,
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

METHOD_VERSION = "phase-e-cockpit-v1"
MAX_VITAL_SIGNS = 9
COMPOSITE_SCORE_ORDER: tuple[str, ...] = ("market_weather", "macro_climate", "fragility")


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text())


def _compose_composite_scores(score_summary: dict[str, Any]) -> list[dict[str, Any]]:
    scores = score_summary.get("scores", {})
    out: list[dict[str, Any]] = []
    for sid in COMPOSITE_SCORE_ORDER:
        s = scores.get(sid, {})
        out.append({
            "id": sid,
            "label": sid.replace("_", " ").title(),
            "value": s.get("score"),
            "regime_label": s.get("label"),
            "percentile_5y": None,        # populated when score_history.json arrives
            "percentile_window_days": None,
            "delta_7d": None,
            "delta_1m": None,
            "sparkline_90d": [],
            "direction": "neutral",
        })
    return out


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
        out.append({"label": sec.label, "value": obs[-1]["value"], "unit": sec.unit})
    return out


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
    regime_snapshot = _read_json(input_root / "derived" / "regime_snapshot.json", {})
    data_status = _read_json(input_root / "status" / "data_status.json", {"series": {}})

    composite = _compose_composite_scores(score_summary)

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
