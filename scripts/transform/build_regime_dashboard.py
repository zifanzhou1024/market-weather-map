"""Build the next-phase ``regime_dashboard.json`` snapshot.

For each lookback window in {20D, 60D, 120D}, emit a series of regime
quadrant points. At each date T the change for the window is computed as
a TRUE lookback delta:

    real_yield_change_bps = (real_yield(T) - real_yield(T - window)) * 100
    dollar_change_pct      = (dollar(T) / dollar(T - window) - 1) * 100

This is the canonical replacement for the historical
``compute_regime_score._build_quadrant_trail`` field, which used
sequential daily deltas — those are now corrected in place but flagged
as deprecated. Consumers (RegimeQuadrantChart, MacroRegimeQuadrant)
should read this file going forward.

Quadrant assignment uses a dead zone defined by ``thresholds``:

- real < -neutral & dollar < -neutral -> ``risk_on_easing``
- real > +neutral & dollar > +neutral -> ``global_tightening_risk_off``
- real < -neutral & dollar > +neutral -> ``safe_haven_growth_scare``
- real > +neutral & dollar < -neutral -> ``rotation_reflation``
- otherwise -> ``mixed``
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from scripts.shared.io import data_dir, utc_now_iso, write_json


METHOD_VERSION = "phase8-pr1-regime-dashboard-v1"

WINDOWS: dict[str, int] = {
    "20D": 20,
    "60D": 60,
    "120D": 120,
}

DEFAULT_THRESHOLDS: dict[str, float] = {
    # 5 bps half-width dead zone on the real-yield axis.
    "real_yield_neutral_bps": 5.0,
    # 0.5% half-width dead zone on the broad-dollar axis.
    "dollar_neutral_pct": 0.5,
}


def _values_by_date(series: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for obs in series.get("observations", []) or []:
        d = obs.get("date")
        v = obs.get("value")
        if isinstance(d, str) and isinstance(v, int | float):
            out[d] = float(v)
    return out


def _percentile_by_date(series: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for obs in series.get("observations", []) or []:
        d = obs.get("date")
        p = obs.get("percentile_252d")
        if isinstance(d, str) and isinstance(p, int | float):
            out[d] = float(p)
    return out


def _intersected_dates(series_list: list[dict[str, Any]]) -> list[str]:
    if not series_list:
        return []
    sets: list[set[str]] = []
    for series in series_list:
        sets.append(set(_values_by_date(series).keys()))
    if not sets:
        return []
    return sorted(set.intersection(*sets))


def _classify_quadrant(
    real_bps: float,
    dollar_pct: float,
    thresholds: dict[str, float],
) -> str:
    real_neutral = float(thresholds["real_yield_neutral_bps"])
    dollar_neutral = float(thresholds["dollar_neutral_pct"])
    real_lo = real_bps < -real_neutral
    real_hi = real_bps > real_neutral
    dollar_lo = dollar_pct < -dollar_neutral
    dollar_hi = dollar_pct > dollar_neutral

    if real_lo and dollar_lo:
        return "risk_on_easing"
    if real_hi and dollar_hi:
        return "global_tightening_risk_off"
    if real_lo and dollar_hi:
        return "safe_haven_growth_scare"
    if real_hi and dollar_lo:
        return "rotation_reflation"
    return "mixed"


def _build_window_points(
    window_days: int,
    real_yield: dict[str, Any],
    dollar: dict[str, Any],
    vix_percentile: dict[str, float],
    high_yield_oas: dict[str, Any],
    fragility_score: float,
    thresholds: dict[str, float],
) -> list[dict[str, Any]]:
    """Construct one window's series of quadrant points.

    Only emit points where the prior observation `window_days` business-day
    indices back exists in BOTH the real-yield and dollar series.
    """
    real_by = _values_by_date(real_yield)
    dollar_by = _values_by_date(dollar)
    credit_by = _values_by_date(high_yield_oas)

    common_dates = sorted(set(real_by) & set(dollar_by))
    if len(common_dates) <= window_days:
        return []

    points: list[dict[str, Any]] = []
    for idx in range(window_days, len(common_dates)):
        this_date = common_dates[idx]
        prior_date = common_dates[idx - window_days]
        real_change_bps = round(
            (real_by[this_date] - real_by[prior_date]) * 100.0, 2
        )
        prior_dollar = dollar_by[prior_date]
        if prior_dollar == 0:
            continue
        dollar_change_pct = round(
            (dollar_by[this_date] / prior_dollar - 1.0) * 100.0, 4
        )
        credit_change_bps = (
            round((credit_by[this_date] - credit_by[prior_date]) * 100.0, 2)
            if (this_date in credit_by and prior_date in credit_by)
            else 0.0
        )
        regime = _classify_quadrant(real_change_bps, dollar_change_pct, thresholds)
        points.append(
            {
                "date": this_date,
                "real_yield_change_bps": real_change_bps,
                "dollar_change_pct": dollar_change_pct,
                "vix_percentile": float(vix_percentile.get(this_date, 0.0)),
                "credit_change_bps": credit_change_bps,
                "fragility_score": fragility_score,
                "regime": regime,
            }
        )
    return points


def _resolve_date(real_yield: dict[str, Any], dollar: dict[str, Any]) -> str:
    common = _intersected_dates([real_yield, dollar])
    return common[-1] if common else ""


def _normalised_fragility(score: Any) -> float:
    """The PR-6 shock_risk_snapshot exposes ``score`` on a 0..100 range; the
    spec wants 0..1. Normalise (clamping defensively)."""
    if not isinstance(score, int | float):
        return 0.0
    value = float(score)
    if value < 0:
        return 0.0
    if value > 1:
        # Treat values >1 as 0..100 percent and rescale.
        return min(1.0, value / 100.0)
    return value


def build_regime_dashboard(
    *,
    series_by_id: dict[str, dict[str, Any]],
    shock_risk_snapshot: dict[str, Any],
    generated_at_utc: str,
    thresholds: dict[str, float] | None = None,
) -> dict[str, Any]:
    real_yield = series_by_id.get("real_yield_10y", {"observations": []})
    dollar = series_by_id.get("broad_dollar", {"observations": []})
    vix_pct = _percentile_by_date(series_by_id.get("vix", {"observations": []}))
    credit_id = "hy_minus_ig_oas" if "hy_minus_ig_oas" in series_by_id else "high_yield_oas"
    credit = series_by_id.get(credit_id, {"observations": []})
    fragility_score = _normalised_fragility(shock_risk_snapshot.get("score", 0.0))

    effective_thresholds = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    windows: dict[str, list[dict[str, Any]]] = {}
    for window_key, window_days in WINDOWS.items():
        windows[window_key] = _build_window_points(
            window_days=window_days,
            real_yield=real_yield,
            dollar=dollar,
            vix_percentile=vix_pct,
            high_yield_oas=credit,
            fragility_score=fragility_score,
            thresholds=effective_thresholds,
        )

    snapshot_date = _resolve_date(real_yield, dollar) or generated_at_utc[:10]
    try:
        datetime.strptime(snapshot_date, "%Y-%m-%d")
    except ValueError:
        snapshot_date = ""

    return {
        "generated_at_utc": generated_at_utc,
        "date": snapshot_date,
        "method_version": METHOD_VERSION,
        "windows": windows,
        "thresholds": effective_thresholds,
    }


def main() -> None:
    series_root = data_dir() / "series"
    derived_root = data_dir() / "derived"

    def _read(p: Any) -> dict[str, Any]:
        return json.loads(p.read_text(encoding="utf-8"))

    series_by_id: dict[str, dict[str, Any]] = {
        "real_yield_10y": _read(series_root / "real_yield_10y.json"),
        "broad_dollar": _read(series_root / "broad_dollar.json"),
        "vix": _read(series_root / "vix.json"),
    }
    # Prefer the derived hy_minus_ig_oas series; fall back to high_yield_oas.
    hy_minus_ig = derived_root / "hy_minus_ig_oas.json"
    high_yield_oas = series_root / "high_yield_oas.json"
    if hy_minus_ig.exists():
        series_by_id["hy_minus_ig_oas"] = _read(hy_minus_ig)
    elif high_yield_oas.exists():
        series_by_id["high_yield_oas"] = _read(high_yield_oas)

    shock = _read(derived_root / "shock_risk_snapshot.json")

    payload = build_regime_dashboard(
        series_by_id=series_by_id,
        shock_risk_snapshot=shock,
        generated_at_utc=utc_now_iso(),
    )
    write_json(derived_root / "regime_dashboard.json", payload)


if __name__ == "__main__":
    main()
