"""Derive VIX term-structure metrics from the TradingView VIX term candidate.

Reads public/data/candidates/tradingview_vix_term_candidate.json and
writes public/data/candidates/tradingview_vix_term_metrics_candidate.json.

Skips gracefully if the input file does not exist (e.g. ingest skipped
because secrets are absent or the fetcher failed).

Usage:
  python -m scripts.transform.build_tradingview_vix_term_metrics
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

from scripts.shared import io as shared_io

INPUT_SERIES_ID = "tradingview_vix_term_candidate"
OUTPUT_SERIES_ID = "tradingview_vix_term_metrics_candidate"

METRIC_KEYS = [
    "vix_event_spread",
    "vix_front_spread",
    "vix_mid_curve_spread",
    "vix_long_curve_spread",
    "vix_term_contango_score",
]


def compute_metrics(obs: dict) -> dict:
    """Compute term-structure metrics for a single observation."""
    vix9d = obs["vix9d"]
    vix = obs["vix"]
    vix3m = obs["vix3m"]
    vix6m = obs["vix6m"]
    vix1y = obs["vix1y"]
    return {
        "date": obs["date"],
        "vix_event_spread": vix9d - vix,              # negative = event-stress contango
        "vix_front_spread": vix3m - vix,              # positive = contango
        "vix_mid_curve_spread": vix6m - vix3m,
        "vix_long_curve_spread": vix1y - vix6m,
        "vix_term_contango_score": (vix1y - vix) / max(vix, 1.0),  # unitless; positive = long-end contango
    }


def main() -> None:
    candidates_dir = shared_io.data_dir() / "candidates"
    input_path = candidates_dir / f"{INPUT_SERIES_ID}.json"

    if not input_path.exists():
        print(
            f"{OUTPUT_SERIES_ID}: input file {input_path} does not exist; skipping.",
            file=sys.stderr,
        )
        return

    raw = json.loads(input_path.read_text(encoding="utf-8"))
    observations = raw.get("observations", [])

    # Only process observations that have all required input keys.
    required_keys = {"vix9d", "vix", "vix3m", "vix6m", "vix1y"}
    metric_obs = []
    for obs in observations:
        if not required_keys.issubset(obs.keys()):
            continue
        try:
            metric_obs.append(compute_metrics(obs))
        except (KeyError, TypeError, ZeroDivisionError) as exc:
            print(
                f"{OUTPUT_SERIES_ID}: skipping observation {obs.get('date')}: {exc}",
                file=sys.stderr,
            )

    payload = {
        "series_id": OUTPUT_SERIES_ID,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "Derived from TradingView VIX term candidate",
        "frequency": "daily",
        "units": "index_points (spreads); ratio (contango_score)",
        "access_status": "authenticated_candidate",
        "score_status": "candidate",
        "active_scoring_allowed": False,
        "public_redistribution_allowed": False,
        "requires_secret": True,
        "notes": (
            "Derived term-structure metrics from tradingview_vix_term_candidate. "
            "Spreads in VIX index points; contango_score is unitless (vix1y - vix) / vix. "
            "Not active in scoring."
        ),
        "metric_keys": METRIC_KEYS,
        "observations": metric_obs,
    }

    out = candidates_dir / f"{OUTPUT_SERIES_ID}.json"
    shared_io.write_json(out, payload)
    print(f"{OUTPUT_SERIES_ID}: wrote {len(metric_obs)} observations.")


if __name__ == "__main__":
    main()
