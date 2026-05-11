"""Compute Treasury supply pressure (30-day rolling auction sum vs. trailing-year baseline)."""
from __future__ import annotations

import json
from datetime import date, timedelta

from scripts.shared.io import data_dir, utc_now_iso, write_json

SERIES_ID = "treasury_supply_pressure"
INPUT_SERIES = "treasury_auction_supply"
WINDOW_DAYS = 30
BASELINE_DAYS = 365
MIN_BASELINE_SAMPLES = 40  # minimum input observations in the trailing-365-day window


def _parse_iso(value: str) -> date:
    return date.fromisoformat(value)


def compute_window_sums(observations: list[dict[str, object]], window_days: int = WINDOW_DAYS) -> list[dict[str, object]]:
    """For each input observation, compute the trailing window_days sum of `value`.

    `observations` must be sorted ascending by date. Returns one dict per input
    observation with {"date": ISO, "window_sum": float}.
    """
    parsed = [(_parse_iso(str(o["date"])), float(o["value"])) for o in observations]
    parsed.sort(key=lambda item: item[0])
    out: list[dict[str, object]] = []
    for i, (d, _) in enumerate(parsed):
        window_start = d - timedelta(days=window_days - 1)  # inclusive 30-day window
        window_sum = sum(v for od, v in parsed if window_start <= od <= d)
        out.append({"date": d.isoformat(), "window_sum": window_sum})
    return out


def compute_supply_pressure(
    observations: list[dict[str, object]],
    *,
    window_days: int = WINDOW_DAYS,
    baseline_days: int = BASELINE_DAYS,
    min_baseline_samples: int = MIN_BASELINE_SAMPLES,
) -> list[dict[str, object]]:
    """Compute trailing-window-sum / trailing-baseline-mean for each observation.

    Returns a list of {"date": ISO, "value": float, "window_sum": float} dicts,
    skipping observations whose trailing baseline window has fewer than
    `min_baseline_samples` input observations.
    """
    window_sums = compute_window_sums(observations, window_days=window_days)
    parsed = [(_parse_iso(str(o["date"])), float(o["window_sum"])) for o in window_sums]
    out: list[dict[str, object]] = []
    for d, ws in parsed:
        baseline_start = d - timedelta(days=baseline_days - 1)
        baseline_values = [v for od, v in parsed if baseline_start <= od <= d]
        if len(baseline_values) < min_baseline_samples:
            continue
        baseline = sum(baseline_values) / len(baseline_values)
        if baseline == 0:
            continue  # avoid divide-by-zero in pathological cases
        out.append({"date": d.isoformat(), "value": round(ws / baseline, 4), "window_sum": round(ws, 2)})
    return out


def main() -> None:
    src = data_dir() / "series" / f"{INPUT_SERIES}.json"
    payload = json.loads(src.read_text())
    observations = payload["observations"]
    points = compute_supply_pressure(observations)
    write_json(
        data_dir() / "derived" / f"{SERIES_ID}.json",
        {
            "depends_on": [INPUT_SERIES],
            "frequency": "weekly",
            "generated_at_utc": utc_now_iso(),
            "method": (
                f"{WINDOW_DAYS}-day trailing sum of Treasury auction amounts divided by the "
                f"trailing {BASELINE_DAYS}-day rolling mean of those sums."
            ),
            "observations": points,
            "series_id": SERIES_ID,
            "source": "Derived",
            "source_url": "/data/series/treasury_auction_supply.json",
            "units": "ratio",
        },
    )


if __name__ == "__main__":
    main()
