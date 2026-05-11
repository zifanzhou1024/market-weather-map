"""Fetch Cboe equity put/call ratio from TradingView (authenticated candidate).

Writes to public/data/candidates/tradingview_put_call_candidate.json only.
Credentials are consumed once to open the session, then discarded.
Secret values never reach the JSON output or any log line.

Symbol confirmed by live probe 2026-05-11 against rongardF/tvdatafeed@e6f6aaa7de43:
  USI:PCC — daily bars; last close 0.780 on 2026-05-11.

Usage (CI only — local run without secrets skips gracefully):
  python -m scripts.ingest.fetch_tradingview_put_call
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime, timezone

from scripts.shared import io as shared_io
from scripts.shared.config import secret, tradingview_credentials_available

SERIES_ID = "tradingview_put_call_candidate"
TV_SYMBOL = "PCC"
TV_EXCHANGE = "USI"
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


def _write_payload(rows: list[dict]) -> None:
    payload = {
        "series_id": SERIES_ID,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "TradingView",
        "source_url": "https://www.tradingview.com/symbols/USI-PCC/",
        "frequency": "daily",
        "units": "ratio",
        "access_status": "authenticated_candidate",
        "score_status": "candidate",
        "active_scoring_allowed": False,
        "public_redistribution_allowed": False,
        "requires_secret": True,
        "notes": (
            "Authenticated TradingView candidate for the Cboe equity put/call ratio. "
            "Not treated as the official Cboe put/call. Not active in scoring."
        ),
        "observations": rows,
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
        df = tv.get_hist(
            symbol=TV_SYMBOL,
            exchange=TV_EXCHANGE,
            interval=Interval.in_daily,
            n_bars=N_BARS,
        )
    except Exception as exc:
        msg = _scrub_credentials(str(exc))
        print(f"{SERIES_ID}: TradingView fetch failed: {msg}", file=sys.stderr)
        return

    if df is None or df.empty:
        print(f"{SERIES_ID}: TradingView returned empty DataFrame; skipping.", file=sys.stderr)
        return

    rows = [
        {"date": ts.strftime("%Y-%m-%d"), "value": float(row["close"])}
        for ts, row in df.iterrows()
    ]
    _write_payload(rows)
    print(f"{SERIES_ID}: wrote {len(rows)} observations.")


if __name__ == "__main__":
    main()
