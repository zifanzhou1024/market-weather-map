"""Compute value-level diffs across 1d/7d/30d windows for the cockpit whitelist
+ composite scores.

The senior trader's first daily question is "what flipped since yesterday?".
The cockpit gestures at this with WhatChangedColumn attribution, but there is
no surface that shows the actual value-level moves (e.g. VIX 14.2 -> 16.3).

This builder pre-computes those diffs in Python and writes them to
public/data/derived/diff.json. The frontend renders the resulting payload
without further client-side computation. Inputs:

  - public/data/derived/score_history.json (composite scores)
  - public/data/derived/score_summary.json (composite metadata / labels)
  - public/data/series/<series_id>.json + public/data/derived/<series_id>.json
    for each entry in the COCKPIT_WHITELIST

Output shape mirrors the cockpit roster: 3 composite scores + 15 vital signs,
each with a per-window {value, date, delta, delta_pct} record for 1d / 7d / 30d.
"""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from typing import Any

from scripts.shared.catalog import catalog_entries
from scripts.shared.cockpit_whitelist import COCKPIT_WHITELIST, CockpitSignal
from scripts.shared.io import utc_now_iso
from scripts.transform._cockpit_inputs import load_series_observations
from scripts.transform._cockpit_math import parse_date

METHOD_VERSION = "phase-f-diff-v1"
WINDOWS: tuple[int, ...] = (1, 7, 30)
COMPOSITE_SCORE_ORDER: tuple[str, ...] = ("market_weather", "macro_climate", "fragility")
ALLOWED_FREQUENCIES: frozenset[str] = frozenset(
    {"daily", "weekly", "monthly", "quarterly"}
)
# Composite scores ride on score_history.json, which is regenerated each
# pipeline run (i.e. every business day). They have no catalog entry of
# their own, so we hard-code a "daily" cadence pill for the composite rows.
COMPOSITE_FREQUENCY = "daily"
# Fallback for whitelist entries whose primary_series_id isn't in the
# catalog (e.g. derived series like net_liquidity). The cockpit pipeline
# refreshes derived series on each daily run, so "daily" is the right
# default to surface for these rows.
DEFAULT_FREQUENCY = "daily"


def _frequency_lookup() -> dict[str, str]:
    """Map ``series_id`` to its catalog ``frequency``.

    Unknown frequencies (or entries without one) are coerced to
    :data:`DEFAULT_FREQUENCY` so the resulting map always has values from
    :data:`ALLOWED_FREQUENCIES`. The schema validator and Python tests
    enforce that contract end-to-end.
    """
    lookup: dict[str, str] = {}
    for entry in catalog_entries():
        sid = entry.get("id")
        freq = entry.get("frequency")
        if not isinstance(sid, str):
            continue
        if isinstance(freq, str) and freq in ALLOWED_FREQUENCIES:
            lookup[sid] = freq
        else:
            lookup[sid] = DEFAULT_FREQUENCY
    return lookup


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text())


def _value_at_or_before(
    observations: list[dict[str, Any]],
    days_back: int,
) -> tuple[float, str] | None:
    """Return ``(value, date)`` of the most recent observation at or before
    ``latest_date - days_back``.

    Mirrors the semantics of
    :func:`scripts.transform._cockpit_math.delta_against_window` so a diff
    computed here aligns with the deltas the cockpit reports. Returns
    ``None`` when no observation that old exists in the series.
    """
    if not observations:
        return None
    latest_date = parse_date(observations[-1]["date"])
    cutoff = latest_date - timedelta(days=days_back)
    candidates = [o for o in observations[:-1] if parse_date(o["date"]) <= cutoff]
    if not candidates:
        return None
    base = candidates[-1]
    return (float(base["value"]), str(base["date"]))


def _apply_yoy_pct_transform(
    observations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Reuse :func:`scripts.transform.build_cockpit._apply_yoy_pct_transform`
    so the per-observation YoY conversion matches what the cockpit displays.
    """
    # Local import keeps the dependency direction unambiguous: build_diff
    # depends on build_cockpit for the transform helper, but they otherwise
    # share zero state.
    from scripts.transform.build_cockpit import _apply_yoy_pct_transform as _yoy

    return _yoy(observations)


def _apply_monthly_change_transform(
    observations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Reuse :func:`scripts.transform.build_cockpit._apply_monthly_change_transform`
    so the per-observation month-over-month conversion matches the cockpit.
    """
    from scripts.transform.build_cockpit import (
        _apply_monthly_change_transform as _mom,
    )

    return _mom(observations)


def _empty_windows() -> dict[str, dict[str, Any]]:
    return {
        f"{d}d": {"value": None, "date": None, "delta": None, "delta_pct": None}
        for d in WINDOWS
    }


def _compose_row(
    *,
    id: str,
    label: str,
    direction: str,
    primary_unit: str,
    primary_decimals: int,
    value_scale: float,
    value_transform: str | None,
    observations: list[dict[str, Any]] | None,
    frequency: str = DEFAULT_FREQUENCY,
) -> dict[str, Any]:
    """Compute the 3-window diff payload for a single signal row.

    The transform is applied to the whole series first (so e.g. yoy_pct
    produces a YoY-percent series), then the scalar ``value_scale`` is
    applied to each observation. This matches what the cockpit shows for
    the same series.
    """
    base_payload: dict[str, Any] = {
        "id": id,
        "label": label,
        "direction": direction,
        "primary_unit": primary_unit,
        "primary_decimals": primary_decimals,
        "current_value": None,
        "current_date": None,
        "windows": _empty_windows(),
        "freshness_status": "unavailable",
        "frequency": frequency,
    }

    if observations is None or not observations:
        return base_payload

    # Apply transform first (so the series is in display-space), then scale.
    transformed = observations
    if value_transform == "yoy_pct":
        transformed = _apply_yoy_pct_transform(observations)
    elif value_transform == "monthly_change":
        transformed = _apply_monthly_change_transform(observations)
    if not transformed:
        return base_payload

    scaled: list[dict[str, Any]] = [
        {"date": o["date"], "value": float(o["value"]) * value_scale}
        for o in transformed
    ]
    current = scaled[-1]
    current_value = float(current["value"])
    current_date = str(current["date"])

    windows_payload: dict[str, dict[str, Any]] = {}
    for d in WINDOWS:
        result = _value_at_or_before(scaled, d)
        if result is None:
            windows_payload[f"{d}d"] = {
                "value": None,
                "date": None,
                "delta": None,
                "delta_pct": None,
            }
            continue
        base_value, base_date = result
        delta = current_value - base_value
        if base_value == 0:
            delta_pct: float | None = None
        else:
            delta_pct = (delta / base_value) * 100.0
        windows_payload[f"{d}d"] = {
            "value": base_value,
            "date": base_date,
            "delta": delta,
            "delta_pct": delta_pct,
        }

    return {
        "id": id,
        "label": label,
        "direction": direction,
        "primary_unit": primary_unit,
        "primary_decimals": primary_decimals,
        "current_value": current_value,
        "current_date": current_date,
        "windows": windows_payload,
        "freshness_status": "ok",
        "frequency": frequency,
    }


def _load_series(input_root: Path, series_id: str) -> list[dict[str, Any]] | None:
    """Try ``series/`` then ``derived/`` then a bare ``series_id.json`` file.

    Returns the sorted observation list or ``None`` if the file is absent.
    """
    for sub in ("series", "derived"):
        candidate = input_root / sub / f"{series_id}.json"
        obs = load_series_observations(candidate)
        if obs is not None:
            return obs
    bare = input_root / f"{series_id}.json"
    if bare.exists():
        return load_series_observations(bare)
    return None


def _compose_composite_rows(score_history: dict[str, Any]) -> list[dict[str, Any]]:
    """Build the 3 composite-score diff rows in the canonical order.

    Reads per-score time series from ``score_history.json`` and applies the
    same diff math as vital signs. No scale/transform — composites are
    already in their display units. The cadence pill is hard-coded
    ``daily`` because ``score_history.json`` is regenerated each pipeline
    run.
    """
    history_obs = score_history.get("observations", []) or []
    rows: list[dict[str, Any]] = []
    for sid in COMPOSITE_SCORE_ORDER:
        series = [
            {"date": o["date"], "value": o[sid]}
            for o in history_obs
            if o.get(sid) is not None
        ]
        series.sort(key=lambda item: item["date"])
        row = _compose_row(
            id=sid,
            label=sid.replace("_", " ").title(),
            direction="neutral",
            primary_unit="",
            primary_decimals=2,
            value_scale=1.0,
            value_transform=None,
            observations=series,
            frequency=COMPOSITE_FREQUENCY,
        )
        rows.append(row)
    return rows


def _compose_vital_rows(
    input_root: Path, freq_map: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    """Build a diff row per :data:`COCKPIT_WHITELIST` entry.

    Missing series degrade to ``freshness_status: 'unavailable'`` rows so
    the frontend can render an em-dash placeholder; we never silently drop
    a whitelist entry — the row count stays stable across builds.
    """
    if freq_map is None:
        freq_map = _frequency_lookup()
    rows: list[dict[str, Any]] = []
    for entry in COCKPIT_WHITELIST:
        rows.append(_compose_vital_row(entry, input_root, freq_map))
    return rows


def _compose_vital_row(
    entry: CockpitSignal,
    input_root: Path,
    freq_map: dict[str, str] | None = None,
) -> dict[str, Any]:
    if freq_map is None:
        freq_map = _frequency_lookup()
    obs = _load_series(input_root, entry.primary_series_id)
    return _compose_row(
        id=entry.id,
        label=entry.display_label,
        direction=entry.direction,
        primary_unit=entry.primary_unit,
        primary_decimals=entry.primary_decimals,
        value_scale=entry.value_scale,
        value_transform=entry.value_transform,
        observations=obs,
        frequency=freq_map.get(entry.primary_series_id, DEFAULT_FREQUENCY),
    )


def build_diff_payload(input_root: Path) -> dict[str, Any]:
    """Read inputs, build the diff.json payload.

    Pure function — no side effects. Tests can call this with a temp dir
    that mirrors the ``public/data/`` layout and assert on the returned
    dict directly.
    """
    score_history = _read_json(input_root / "derived" / "score_history.json", {})
    score_summary = _read_json(input_root / "derived" / "score_summary.json", {})
    composite_rows = _compose_composite_rows(score_history)
    vital_rows = _compose_vital_rows(input_root, _frequency_lookup())
    snapshot_date = _resolve_snapshot_date(
        score_summary,
        composite_rows,
        vital_rows,
    )
    return {
        "generated_at_utc": utc_now_iso(),
        "date": snapshot_date,
        "method_version": METHOD_VERSION,
        "composite_scores": composite_rows,
        "vital_signs": vital_rows,
    }


def _resolve_snapshot_date(
    score_summary: dict[str, Any],
    composite_rows: list[dict[str, Any]],
    vital_rows: list[dict[str, Any]],
) -> str:
    """Pick the snapshot date for the freshness check.

    Prefers ``score_summary['date']`` (the canonical "today" the scoring
    pipeline ran for). When score_summary is unavailable, falls back to
    the latest ``current_date`` across composite + vital rows so the
    freshness check still has something to anchor against.
    """
    candidate = score_summary.get("date")
    if isinstance(candidate, str) and candidate:
        return candidate

    dates: list[str] = []
    for row in (*composite_rows, *vital_rows):
        if isinstance(row.get("current_date"), str) and row["current_date"]:
            dates.append(row["current_date"])
    if dates:
        return max(dates)

    # Last resort: stamp today's date so the freshness checker has a
    # value to compare against. The schema validator catches any
    # downstream mismatch.
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def main() -> None:
    """CLI entry point — reads from ``public/data/``, writes
    ``public/data/derived/diff.json``.
    """
    from scripts.shared.io import write_json

    project_root = Path(__file__).resolve().parents[2]
    data_root = project_root / "public" / "data"
    payload = build_diff_payload(data_root)
    out_path = data_root / "derived" / "diff.json"
    write_json(out_path, payload)


if __name__ == "__main__":
    main()
