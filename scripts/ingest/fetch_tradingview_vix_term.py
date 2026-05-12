"""Fetch constant-maturity VIX index term structure from TradingView (authenticated candidate).

Writes to public/data/candidates/tradingview_vix_term_candidate.json only.
Credentials are consumed once to open the session, then discarded.
Secret values never reach the JSON output or any log line.

These are constant-maturity VIX indices (VIX9D, VIX, VIX3M, VIX6M, VIX1Y, VVIX),
NOT VX futures contracts. The active Cboe-CSV-sourced series (vix, vvix, vix9d, vix3m)
are untouched; this TradingView fetch is a candidate-class cross-validation alternative.

Symbols confirmed by live probe 2026-05-11 against rongardF/tvdatafeed@e6f6aaa7de43:
  CBOE:VIX9D  — last close 16.89
  CBOE:VIX    — last close 18.38
  CBOE:VIX3M  — last close 21.24
  CBOE:VIX6M  — last close 23.06
  CBOE:VIX1Y  — last close 23.99
  CBOE:VVIX   — last close 98.06

Usage (CI only — local run without secrets skips gracefully):
  python -m scripts.ingest.fetch_tradingview_vix_term
"""
from __future__ import annotations

import os
import sys
import tempfile
from datetime import datetime, timezone

from scripts.shared import io as shared_io
from scripts.shared.config import secret, tradingview_credentials_available

SERIES_ID = "tradingview_vix_term_candidate"
TV_EXCHANGE = "CBOE"
SYMBOL_TO_KEY = (
    ("VIX9D", "vix9d"),
    ("VIX", "vix"),
    ("VIX3M", "vix3m"),
    ("VIX6M", "vix6m"),
    ("VIX1Y", "vix1y"),
    ("VVIX", "vvix"),
)
N_BARS = 5000


def _build_tv_client():
    """Construct a TvDatafeed instance; isolated so tests can patch this factory."""
    from tvDatafeed import TvDatafeed  # type: ignore
    return TvDatafeed(secret("TRADINGVIEW_USERNAME"), secret("TRADINGVIEW_PASSWORD"))


def _scrub_credentials(text: str) -> str:
    """Replace any credential value appearing in *text* with a placeholder."""
    for name in ("TRADINGVIEW_USERNAME", "TRADINGVIEW_PASSWORD"):
        value = secret(name)
        if value and value in text:
            text = text.replace(value, f"<scrubbed {name}>")
    return text


def _write_payload(observations: list[dict], symbol_keys: list[str]) -> None:
    payload = {
        "series_id": SERIES_ID,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "TradingView",
        "source_url": "https://www.tradingview.com/symbols/CBOE-VIX/",
        "frequency": "daily",
        "units": "index",
        "access_status": "authenticated_candidate",
        "score_status": "candidate",
        "active_scoring_allowed": False,
        "public_redistribution_allowed": False,
        "requires_secret": True,
        "notes": (
            "Constant-maturity VIX index term structure (vix9d, vix, vix3m, vix6m, vix1y, vvix) "
            "fetched from TradingView. Cross-validation candidate; does not replace the official "
            "active VIX series in public/data/series/. NOT VX futures contracts. "
            "Not active in scoring."
        ),
        "symbol_keys": symbol_keys,
        "observations": observations,
    }
    out = shared_io.data_dir() / "candidates" / f"{SERIES_ID}.json"
    shared_io.write_json(out, payload)


def main() -> None:
    if not tradingview_credentials_available():
        print(f"{SERIES_ID}: secrets missing or disabled; skipping.")
        return

    if "TVDATAFEED_CACHE_DIR" not in os.environ:
        # Point any on-disk session cache at a temp directory so it never lands
        # in the repo root or home directory. The isolation test enforces this.
        os.environ["TVDATAFEED_CACHE_DIR"] = tempfile.mkdtemp(prefix="tv_cache_")

    try:
        from tvDatafeed import Interval  # type: ignore
        tv = _build_tv_client()
    except Exception as exc:
        msg = _scrub_credentials(str(exc))
        print(f"{SERIES_ID}: TradingView client construction failed: {msg}", file=sys.stderr)
        return

    # Fetch all series; tolerate partial failures — only abort if ALL fail.
    rows_by_date: dict = {}
    succeeded_keys: list[str] = []
    failed_count = 0

    for symbol, key in SYMBOL_TO_KEY:
        try:
            df = tv.get_hist(
                symbol=symbol,
                exchange=TV_EXCHANGE,
                interval=Interval.in_daily,
                n_bars=N_BARS,
            )
        except Exception as exc:
            msg = _scrub_credentials(str(exc))
            print(f"{SERIES_ID}: fetch {TV_EXCHANGE}:{symbol} failed: {msg}", file=sys.stderr)
            failed_count += 1
            continue

        if df is None or df.empty:
            print(
                f"{SERIES_ID}: {TV_EXCHANGE}:{symbol} returned empty DataFrame; skipping.",
                file=sys.stderr,
            )
            failed_count += 1
            continue

        succeeded_keys.append(key)
        for ts, row in df.iterrows():
            rows_by_date.setdefault(ts, {})[key] = float(row["close"])

    if failed_count == len(SYMBOL_TO_KEY):
        print(f"{SERIES_ID}: all series failed; aborting without writing output.", file=sys.stderr)
        return

    # Only keep dates where every successfully-fetched series has a value.
    observations = [
        {"date": ts.strftime("%Y-%m-%d"), **values}
        for ts, values in sorted(rows_by_date.items())
        if len(values) == len(succeeded_keys)
    ]

    if not observations:
        print(f"{SERIES_ID}: no complete observations after merging; skipping.", file=sys.stderr)
        return

    _write_payload(observations, succeeded_keys)
    print(f"{SERIES_ID}: wrote {len(observations)} observations ({len(succeeded_keys)} series).")


if __name__ == "__main__":
    main()
