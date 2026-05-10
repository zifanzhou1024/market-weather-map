"""Build the next-phase ``volatility_dashboard.json`` snapshot.

Reads the existing VIX, VIX9D, VIX3M and VVIX series plus the derived
``vix9d_vix_ratio`` and ``vix_vix3m_ratio`` files, then assembles three
analytical blocks consumed by the redesigned Volatility route:

1. ``latest_curve`` — the VIX9D / VIX / VIX3M term-structure proxy with a
   5-year rolling percentile per tenor. Structure accepts N tenors so
   future expansion to VIX6M / VIX1Y is data-only.
2. ``ratio_history`` — daily history of the two ratios.
3. ``hidden_stress`` — daily VIX vs VVIX 5-year percentile difference.

Output is descriptive only; thresholds reuse the existing volatility-curve
classifier convention (1.0 boundary between contango and backwardation
proxy in ``compute_regime_score.py``).
"""
from __future__ import annotations

import json
from datetime import date as _date
from datetime import datetime
from typing import Any

from scripts.shared.io import data_dir, utc_now_iso, write_json


METHOD_VERSION = "phase8-pr1-volatility-dashboard-v1"

# Five-year rolling window in business days. ~252 trading days per year.
ROLLING_WINDOW_DAYS = 252 * 5

# Threshold defaults inherited from the existing project conventions.
# vix9d/vix and vix/vix3m are both ratios; <=1 is contango proxy, >1 is
# backwardation proxy. We expose the band boundaries so the chart can mark
# zones consistently with the regime score and signal-priority logic.
DEFAULT_THRESHOLDS: dict[str, float] = {
    "vix9d_vix_calm": 0.95,
    "vix9d_vix_stress": 1.05,
    "vix_vix3m_calm": 0.95,
    "vix_vix3m_stress": 1.0,
    # hidden_stress = vvix_pct - vix_pct.
    "hidden_stress_watch": 15.0,
    "hidden_stress_elevated": 30.0,
}


def _percentile_rank(values: list[float], value: float) -> float:
    """0–100 percentile of ``value`` within ``values``."""
    if not values:
        return 0.0
    rank = sum(1 for item in values if item <= value) / len(values) * 100
    return round(rank, 2)


def _values_by_date(series: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for obs in series.get("observations", []) or []:
        d = obs.get("date")
        v = obs.get("value")
        if isinstance(d, str) and isinstance(v, int | float):
            out[d] = float(v)
    return out


def _latest_value(series: dict[str, Any]) -> tuple[str, float] | None:
    obs = series.get("observations", []) or []
    for entry in reversed(obs):
        d = entry.get("date")
        v = entry.get("value")
        if isinstance(d, str) and isinstance(v, int | float):
            return (d, float(v))
    return None


def _five_year_percentile_for(
    series: dict[str, Any],
    target_date: str,
    target_value: float,
) -> float:
    """5-year rolling percentile of ``target_value`` within the trailing
    window ending on ``target_date`` (inclusive)."""
    obs = series.get("observations", []) or []
    values: list[float] = []
    for entry in obs:
        d = entry.get("date")
        v = entry.get("value")
        if not (isinstance(d, str) and isinstance(v, int | float)):
            continue
        if d > target_date:
            continue
        values.append(float(v))
    window = values[-ROLLING_WINDOW_DAYS:]
    return _percentile_rank(window, target_value)


def _build_latest_curve(
    vix9d: dict[str, Any],
    vix: dict[str, Any],
    vix3m: dict[str, Any],
) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    pairs: list[tuple[str, dict[str, Any]]] = [
        ("9D", vix9d),
        ("30D", vix),
        ("3M", vix3m),
    ]
    for tenor, series in pairs:
        latest = _latest_value(series)
        if latest is None:
            continue
        d, v = latest
        points.append(
            {
                "tenor": tenor,
                "value": round(float(v), 4),
                "percentile_5y": _five_year_percentile_for(series, d, v),
            }
        )
    return points


def _build_ratio_history(
    vix9d_vix_ratio: dict[str, Any],
    vix_vix3m_ratio: dict[str, Any],
) -> list[dict[str, Any]]:
    a = _values_by_date(vix9d_vix_ratio)
    b = _values_by_date(vix_vix3m_ratio)
    common_dates = sorted(set(a) & set(b))
    return [
        {
            "date": d,
            "vix9d_vix": round(a[d], 4),
            "vix_vix3m": round(b[d], 4),
        }
        for d in common_dates
    ]


def _build_hidden_stress(
    vix: dict[str, Any],
    vvix: dict[str, Any],
    thresholds: dict[str, float],
) -> list[dict[str, Any]]:
    """Daily VIX vs VVIX 5-year-percentile difference.

    Symmetric percentile windows: both vix_percentile and vvix_percentile
    for an emitted date are computed against the SAME common-date series
    (intersection of VIX and VVIX dates). Anything else makes the two
    percentiles incomparable because they would be drawn from different
    historical universes.
    """
    vix_by_date = _values_by_date(vix)
    vvix_by_date = _values_by_date(vvix)
    common_dates = sorted(set(vix_by_date) & set(vvix_by_date))

    history: list[dict[str, Any]] = []
    vix_running: list[float] = []
    vvix_running: list[float] = []

    watch = float(thresholds["hidden_stress_watch"])
    elevated = float(thresholds["hidden_stress_elevated"])

    for d in common_dates:
        v = vix_by_date[d]
        vvix_value = vvix_by_date[d]
        vix_running.append(v)
        vvix_running.append(vvix_value)
        vix_window = vix_running[-ROLLING_WINDOW_DAYS:]
        vvix_window = vvix_running[-ROLLING_WINDOW_DAYS:]
        vix_pct = _percentile_rank(vix_window, v)
        vvix_pct = _percentile_rank(vvix_window, vvix_value)

        score = round(vvix_pct - vix_pct, 2)
        if score >= elevated:
            state = "elevated"
        elif score >= watch:
            state = "watch"
        else:
            state = "calm"

        history.append(
            {
                "date": d,
                "vix_value": round(v, 4),
                "vvix_value": round(vvix_value, 4),
                "vix_percentile": vix_pct,
                "vvix_percentile": vvix_pct,
                "hidden_stress_score": score,
                "state": state,
            }
        )
    return history


def _resolve_date(
    latest_curve: list[dict[str, Any]],
    hidden_stress: list[dict[str, Any]],
    fallback: str,
) -> str:
    if hidden_stress:
        return str(hidden_stress[-1]["date"])
    if latest_curve:
        # Use VIX (30D) date if available; else first tenor.
        for point in latest_curve:
            if point["tenor"] == "30D":
                return str(point.get("date") or fallback)
        return fallback
    return fallback


def build_volatility_dashboard(
    *,
    vix: dict[str, Any],
    vix9d: dict[str, Any],
    vix3m: dict[str, Any],
    vvix: dict[str, Any],
    vix9d_vix_ratio: dict[str, Any],
    vix_vix3m_ratio: dict[str, Any],
    generated_at_utc: str,
    thresholds: dict[str, float] | None = None,
) -> dict[str, Any]:
    effective_thresholds = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    latest_curve = _build_latest_curve(vix9d, vix, vix3m)
    ratio_history = _build_ratio_history(vix9d_vix_ratio, vix_vix3m_ratio)
    hidden_stress = _build_hidden_stress(vix, vvix, effective_thresholds)

    fallback_date = generated_at_utc[:10]
    try:
        # Sanity: ensure fallback is a valid YYYY-MM-DD; otherwise use today.
        datetime.strptime(fallback_date, "%Y-%m-%d")
    except ValueError:
        fallback_date = _date.today().isoformat()

    snapshot_date = _resolve_date(latest_curve, hidden_stress, fallback_date)

    return {
        "generated_at_utc": generated_at_utc,
        "date": snapshot_date,
        "method_version": METHOD_VERSION,
        "latest_curve": latest_curve,
        "ratio_history": ratio_history,
        "hidden_stress": hidden_stress,
        "thresholds": effective_thresholds,
    }


def main() -> None:
    series_root = data_dir() / "series"
    derived_root = data_dir() / "derived"

    def _read(p: Any) -> dict[str, Any]:
        return json.loads(p.read_text(encoding="utf-8"))

    payload = build_volatility_dashboard(
        vix=_read(series_root / "vix.json"),
        vix9d=_read(series_root / "vix9d.json"),
        vix3m=_read(series_root / "vix3m.json"),
        vvix=_read(series_root / "vvix.json"),
        vix9d_vix_ratio=_read(derived_root / "vix9d_vix_ratio.json"),
        vix_vix3m_ratio=_read(derived_root / "vix_vix3m_ratio.json"),
        generated_at_utc=utc_now_iso(),
    )
    write_json(derived_root / "volatility_dashboard.json", payload)


if __name__ == "__main__":
    main()
