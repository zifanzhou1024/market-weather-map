"""Build the next-phase ``rates_dashboard.json`` snapshot.

Reads the existing 2Y / 10Y / 20Y / 30Y nominal Treasury series, the 10Y
real-yield series, and the 10Y breakeven series. Emits four analytical
blocks consumed by the redesigned Rates route:

1. ``yield_change_windows`` — 1M / 3M / 6M / 1Y horizons in basis points
   with a derived ``driver`` enum (real_yield / breakeven / balanced)
   that compares the magnitude of the real-yield change to the breakeven
   change for the 10Y nominal.
2. ``current_decomposition`` — latest 10Y nominal / real / breakeven in
   percent.
3. ``curve_snapshots`` — 2Y / 10Y / 20Y / 30Y values today vs 1M / 3M /
   1Y ago. If a tenor is missing on a historical date that tenor is
   omitted from that snapshot only.
4. ``decomposition_history`` — daily nominal / real / breakeven series
   for the secondary chart.

Output is descriptive only; bps used for changes; percent used for
levels.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from scripts.shared.io import data_dir, utc_now_iso, write_json


METHOD_VERSION = "phase8-pr1-rates-dashboard-v1"

# Approximate trading-day offsets for each window. These match the
# convention used in scripts.transform.compute_percentiles for the daily
# frequency.
WINDOW_OFFSETS_BUSINESS_DAYS: dict[str, int] = {
    "1M": 21,
    "3M": 63,
    "6M": 126,
    "1Y": 252,
}

# Driver classifier: real_yield wins if |real bps| > driver_dominance ×
# |breakeven bps|, breakeven wins if reverse, otherwise balanced.
DRIVER_DOMINANCE = 1.5

# Curve snapshot horizons (in business days from latest).
CURVE_SNAPSHOT_OFFSETS: dict[str, int] = {
    "current": 0,
    "one_month_ago": 21,
    "three_months_ago": 63,
    "one_year_ago": 252,
}

CURVE_TENOR_TO_SERIES: tuple[tuple[str, str], ...] = (
    ("2Y", "us2y"),
    ("10Y", "us10y"),
    ("20Y", "us20y"),
    ("30Y", "us30y"),
)


def _values_by_date(series: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for obs in series.get("observations", []) or []:
        d = obs.get("date")
        v = obs.get("value")
        if isinstance(d, str) and isinstance(v, int | float):
            out[d] = float(v)
    return out


def _sorted_dates(series: dict[str, Any]) -> list[str]:
    return sorted(
        str(obs.get("date"))
        for obs in series.get("observations", []) or []
        if isinstance(obs.get("date"), str)
        and isinstance(obs.get("value"), int | float)
    )


def _value_at_offset(series: dict[str, Any], offset_business_days: int) -> float | None:
    """Latest value if offset==0; otherwise the value `offset` business-day
    observations earlier in the series."""
    sorted_dates = _sorted_dates(series)
    if not sorted_dates:
        return None
    if offset_business_days >= len(sorted_dates):
        return None
    target_date = sorted_dates[-(1 + offset_business_days)]
    by_date = _values_by_date(series)
    return by_date.get(target_date)


def _classify_driver(real_bps: float, breakeven_bps: float) -> str:
    real_abs = abs(real_bps)
    breakeven_abs = abs(breakeven_bps)
    if real_abs > DRIVER_DOMINANCE * breakeven_abs:
        return "real_yield"
    if breakeven_abs > DRIVER_DOMINANCE * real_abs:
        return "breakeven"
    return "balanced"


def _bps_change(series: dict[str, Any], offset: int) -> float:
    latest = _value_at_offset(series, 0)
    earlier = _value_at_offset(series, offset)
    if latest is None or earlier is None:
        return 0.0
    return round((latest - earlier) * 100.0, 2)


def _build_yield_change_windows(
    nominal_10y: dict[str, Any],
    real_10y: dict[str, Any],
    breakeven_10y: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    windows: dict[str, dict[str, Any]] = {}
    for window_key, offset in WINDOW_OFFSETS_BUSINESS_DAYS.items():
        nom = _bps_change(nominal_10y, offset)
        real = _bps_change(real_10y, offset)
        breakeven = _bps_change(breakeven_10y, offset)
        windows[window_key] = {
            "nominal_10y_bps": nom,
            "real_yield_10y_bps": real,
            "breakeven_10y_bps": breakeven,
            "driver": _classify_driver(real, breakeven),
        }
    return windows


def _build_current_decomposition(
    nominal_10y: dict[str, Any],
    real_10y: dict[str, Any],
    breakeven_10y: dict[str, Any],
) -> dict[str, float]:
    nominal = _value_at_offset(nominal_10y, 0)
    real = _value_at_offset(real_10y, 0)
    breakeven = _value_at_offset(breakeven_10y, 0)
    return {
        "nominal_10y_pct": round(float(nominal), 4) if nominal is not None else 0.0,
        "real_yield_10y_pct": round(float(real), 4) if real is not None else 0.0,
        "breakeven_10y_pct": round(float(breakeven), 4) if breakeven is not None else 0.0,
    }


def _build_curve_snapshots(
    series_by_tenor: dict[str, dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    snapshots: dict[str, list[dict[str, Any]]] = {}
    for snapshot_key, offset in CURVE_SNAPSHOT_OFFSETS.items():
        points: list[dict[str, Any]] = []
        for tenor, _series_id in CURVE_TENOR_TO_SERIES:
            series = series_by_tenor.get(tenor)
            if series is None:
                continue
            value = _value_at_offset(series, offset)
            if value is None:
                # Missing on this snapshot date; degrade gracefully by
                # omitting just this tenor for just this snapshot.
                continue
            points.append({"tenor": tenor, "value": round(float(value), 4)})
        snapshots[snapshot_key] = points
    return snapshots


def _build_decomposition_history(
    nominal_10y: dict[str, Any],
    real_10y: dict[str, Any],
    breakeven_10y: dict[str, Any],
) -> list[dict[str, Any]]:
    nom_by = _values_by_date(nominal_10y)
    real_by = _values_by_date(real_10y)
    bei_by = _values_by_date(breakeven_10y)
    common = sorted(set(nom_by) & set(real_by) & set(bei_by))
    return [
        {
            "date": d,
            "nominal_pct": round(nom_by[d], 4),
            "real_pct": round(real_by[d], 4),
            "breakeven_pct": round(bei_by[d], 4),
        }
        for d in common
    ]


def _resolve_date(nominal_10y: dict[str, Any], generated_at_utc: str) -> str:
    sorted_dates = _sorted_dates(nominal_10y)
    if sorted_dates:
        return sorted_dates[-1]
    fallback = generated_at_utc[:10]
    try:
        datetime.strptime(fallback, "%Y-%m-%d")
        return fallback
    except ValueError:
        return ""


def build_rates_dashboard(
    *,
    us2y: dict[str, Any],
    us10y: dict[str, Any],
    us20y: dict[str, Any],
    us30y: dict[str, Any],
    real_yield_10y: dict[str, Any],
    breakeven_10y: dict[str, Any],
    generated_at_utc: str,
) -> dict[str, Any]:
    series_by_tenor = {
        "2Y": us2y,
        "10Y": us10y,
        "20Y": us20y,
        "30Y": us30y,
    }
    return {
        "generated_at_utc": generated_at_utc,
        "date": _resolve_date(us10y, generated_at_utc),
        "method_version": METHOD_VERSION,
        "yield_change_windows": _build_yield_change_windows(
            us10y, real_yield_10y, breakeven_10y
        ),
        "current_decomposition": _build_current_decomposition(
            us10y, real_yield_10y, breakeven_10y
        ),
        "curve_snapshots": _build_curve_snapshots(series_by_tenor),
        "decomposition_history": _build_decomposition_history(
            us10y, real_yield_10y, breakeven_10y
        ),
    }


def main() -> None:
    series_root = data_dir() / "series"
    derived_root = data_dir() / "derived"

    def _read(p: Any) -> dict[str, Any]:
        return json.loads(p.read_text(encoding="utf-8"))

    payload = build_rates_dashboard(
        us2y=_read(series_root / "us2y.json"),
        us10y=_read(series_root / "us10y.json"),
        us20y=_read(series_root / "us20y.json"),
        us30y=_read(series_root / "us30y.json"),
        real_yield_10y=_read(series_root / "real_yield_10y.json"),
        breakeven_10y=_read(series_root / "breakeven_10y.json"),
        generated_at_utc=utc_now_iso(),
    )
    write_json(derived_root / "rates_dashboard.json", payload)


if __name__ == "__main__":
    main()
