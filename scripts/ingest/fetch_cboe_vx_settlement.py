"""Fetch Cboe daily VX futures settlement prices as a non-scoring candidate.

The Cboe settlement page exposes a daily CSV link such as:
https://www-api.cboe.com/us/futures/market_statistics/settlement/csv?dt=YYYY-MM-DD

This script keeps the output in public/data/candidates/ and marks it as
terms_review_needed/candidate. It does not write active series files and does
not affect scoring.
"""
from __future__ import annotations

import re
import sys
from datetime import date
from typing import Any

from scripts.shared import io as shared_io
from scripts.shared.io import download_text, parse_csv_rows, parse_float, utc_now_iso, write_json

SERIES_ID = "cboe_vx_settlement_candidate"
SETTLEMENT_PAGE_URL = "https://www.cboe.com/markets/us/futures/market-statistics/settlement/futures/daily/"
CSV_URL_PATTERN = re.compile(
    r"(https://www-api\.cboe\.com/us/futures/market_statistics/settlement/csv/?\?dt=(\d{4}-\d{2}-\d{2}))"
)
STANDARD_VX_SYMBOL_PATTERN = re.compile(r"^VX/[FGHJKMNQUVXZ]\d+$")
MAX_TENORS = 8


def discover_latest_csv_url(page_html: str) -> tuple[str, str]:
    """Return (settlement_date, csv_url) for the first Cboe CSV URL on the page."""
    match = CSV_URL_PATTERN.search(page_html)
    if not match:
        raise ValueError("missing Cboe settlement CSV URL on settlement page")
    return match.group(2), match.group(1)


def parse_settlement_rows(csv_text: str) -> list[dict[str, str]]:
    return parse_csv_rows(csv_text)


def _parse_price(raw: str | None) -> float | None:
    if raw is None:
        return None
    return parse_float(raw.replace("*", ""))


def _is_standard_vx_monthly(row: dict[str, str]) -> bool:
    return row.get("Product", "").strip() == "VX" and bool(
        STANDARD_VX_SYMBOL_PATTERN.fullmatch(row.get("Symbol", "").strip())
    )


def normalize_vx_settlement_rows(
    rows: list[dict[str, str]],
    *,
    settlement_date: str,
    max_tenors: int = MAX_TENORS,
) -> dict[str, Any]:
    """Normalize daily Cboe VX settlement rows into a tenor-keyed observation.

    Cboe's daily settlement CSV includes weekly VX and VXM mini rows. The
    dashboard needs the standard monthly VX curve, so this parser keeps only
    symbols shaped like VX/K6, VX/M6, etc., sorted by expiration date.
    """
    try:
        date.fromisoformat(settlement_date)
    except ValueError as error:
        raise ValueError(f"invalid settlement date: {settlement_date}") from error

    contracts: list[dict[str, Any]] = []
    for row in rows:
        if not _is_standard_vx_monthly(row):
            continue
        expiration_date = row.get("Expiration Date", "").strip()
        try:
            date.fromisoformat(expiration_date)
        except ValueError as error:
            raise ValueError(f"invalid VX expiration date: {expiration_date}") from error
        price = _parse_price(row.get("Price"))
        if price is None:
            continue
        contracts.append(
            {
                "expiration_date": expiration_date,
                "symbol": row.get("Symbol", "").strip(),
                "value": price,
            }
        )

    contracts.sort(key=lambda item: item["expiration_date"])
    contracts = contracts[:max_tenors]
    if len(contracts) < 2:
        raise ValueError("fewer than two standard monthly VX contracts found")

    observation: dict[str, Any] = {"date": settlement_date}
    for index, contract in enumerate(contracts, start=1):
        tenor = f"vx{index}"
        contract["tenor"] = tenor
        observation[tenor] = contract["value"]

    vx1 = float(observation["vx1"])
    vx2 = float(observation["vx2"])
    last_key = f"vx{len(contracts)}"
    last_value = float(observation[last_key])
    observation["vx_front_spread"] = round(vx2 - vx1, 6)
    observation["vx1_vx2_ratio"] = round(vx1 / vx2, 6) if vx2 else None
    observation["vx_curve_slope"] = round(last_value - vx1, 6)
    observation["contracts"] = contracts
    return observation


def _candidate_payload(
    *,
    csv_url: str,
    settlement_date: str,
    normalized: dict[str, Any],
) -> dict[str, Any]:
    contracts = normalized["contracts"]
    observation = {key: value for key, value in normalized.items() if key != "contracts"}
    tenor_keys = [contract["tenor"] for contract in contracts]
    latest_metrics = {
        key: observation[key]
        for key in ("date", "vx1", "vx2", "vx_front_spread", "vx1_vx2_ratio", "vx_curve_slope")
        if key in observation
    }

    return {
        "series_id": SERIES_ID,
        "generated_at_utc": utc_now_iso(),
        "source": "Cboe Futures Exchange",
        "source_url": SETTLEMENT_PAGE_URL,
        "csv_url": csv_url,
        "settlement_date": settlement_date,
        "frequency": "daily",
        "units": "index",
        "access_status": "terms_review_needed",
        "score_status": "candidate",
        "active_scoring_allowed": False,
        "public_redistribution_allowed": False,
        "requires_secret": False,
        "notes": (
            "Daily Cboe VX standard monthly futures settlement candidate. "
            "Generated for source-readiness visibility only; not active in scoring "
            "until Cboe redistribution terms are approved."
        ),
        "tenor_keys": tenor_keys,
        "contracts": contracts,
        "latest_metrics": latest_metrics,
        "observations": [observation],
    }


def main() -> None:
    try:
        settlement_date, csv_url = discover_latest_csv_url(download_text(SETTLEMENT_PAGE_URL))
        rows = parse_settlement_rows(download_text(csv_url))
        normalized = normalize_vx_settlement_rows(rows, settlement_date=settlement_date)
    except Exception as error:
        print(f"{SERIES_ID}: Cboe VX settlement fetch skipped: {error}", file=sys.stderr)
        return

    out = shared_io.data_dir() / "candidates" / f"{SERIES_ID}.json"
    write_json(
        out,
        _candidate_payload(
            csv_url=csv_url,
            settlement_date=settlement_date,
            normalized=normalized,
        ),
    )
    print(f"{SERIES_ID}: wrote {len(normalized['contracts'])} VX tenors for {settlement_date}.")


if __name__ == "__main__":
    main()
