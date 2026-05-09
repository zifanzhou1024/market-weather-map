from __future__ import annotations

import calendar
import json
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

from scripts.shared.io import download_text, parse_float, series_path, utc_now_iso, write_json


MTS_TABLE_1_URL = (
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_1"
    "?sort=record_date&page[size]=10000"
)
AUCTIONS_QUERY_URL = (
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query"
    "?sort=-auction_date&page[size]=10000"
)

MTS_SOURCE_URL = "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/"
AUCTIONS_SOURCE_URL = "https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/"

MTS_SERIES_FIELDS = {
    "monthly_treasury_receipts": "current_month_gross_rcpt_amt",
    "monthly_treasury_outlays": "current_month_gross_outly_amt",
    "monthly_treasury_deficit_surplus": "current_month_dfct_sur_amt",
}

MONTH_NUMBER_BY_NAME = {month: index for index, month in enumerate(calendar.month_name) if month}


def fiscal_month_end(record_fiscal_year: str, month_name: str) -> str:
    month = MONTH_NUMBER_BY_NAME[month_name]
    fiscal_year = int(record_fiscal_year)
    calendar_year = fiscal_year - 1 if month >= 10 else fiscal_year
    day = calendar.monthrange(calendar_year, month)[1]
    return f"{calendar_year:04d}-{month:02d}-{day:02d}"


def fiscaldata_payload(url: str) -> list[dict[str, Any]]:
    payload = json.loads(download_text(url))
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise ValueError("FiscalData response does not contain a data list")
    return [row for row in rows if isinstance(row, dict)]


def parse_optional_amount(value: object) -> float | None:
    try:
        return parse_float(str(value))
    except ValueError:
        return None


def normalize_mts_table_1_rows(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, float | str]]]:
    by_series: dict[str, dict[str, dict[str, Any]]] = {series_id: {} for series_id in MTS_SERIES_FIELDS}

    for row in rows:
        month_name = str(row.get("classification_desc", ""))
        record_fiscal_year = str(row.get("record_fiscal_year", ""))
        if month_name not in MONTH_NUMBER_BY_NAME or not record_fiscal_year.isdigit():
            continue

        try:
            observation_date = fiscal_month_end(record_fiscal_year, month_name)
        except ValueError:
            continue

        record_date = str(row.get("record_date", ""))
        if record_date and observation_date > record_date:
            continue
        for series_id, field in MTS_SERIES_FIELDS.items():
            value = parse_optional_amount(row.get(field, ""))
            if value is None:
                continue
            existing = by_series[series_id].get(observation_date)
            if existing and str(existing.get("record_date", "")) > record_date:
                continue
            by_series[series_id][observation_date] = {
                "date": observation_date,
                "value": round(value / 1_000_000, 4),
                "record_date": record_date,
            }

    return {
        series_id: [
            {"date": observation["date"], "value": observation["value"]}
            for observation in sorted(observations.values(), key=lambda item: str(item["date"]))
        ]
        for series_id, observations in by_series.items()
    }


def normalize_auction_supply_rows(rows: list[dict[str, Any]], as_of_date: str | None = None) -> list[dict[str, Any]]:
    weekly: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"value": 0.0, "auction_count": 0, "security_types": set()}
    )
    as_of = (
        datetime.strptime(as_of_date, "%Y-%m-%d").date()
        if as_of_date is not None
        else datetime.now(timezone.utc).date()
    )

    for row in rows:
        raw_date = row.get("auction_date")
        if not isinstance(raw_date, str):
            continue
        try:
            auction_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        if auction_date > as_of:
            continue

        offering_amount = parse_optional_amount(row.get("offering_amt", ""))
        if offering_amount is None:
            continue

        week_start = auction_date - timedelta(days=auction_date.weekday())
        bucket = weekly[week_start.isoformat()]
        bucket["value"] += offering_amount / 1_000_000
        bucket["auction_count"] += 1
        security_type = row.get("security_type")
        if isinstance(security_type, str) and security_type:
            bucket["security_types"].add(security_type)

    observations = []
    for date, bucket in sorted(weekly.items()):
        observations.append(
            {
                "date": date,
                "value": round(float(bucket["value"]), 4),
                "auction_count": bucket["auction_count"],
                "security_types": sorted(bucket["security_types"]),
            }
        )
    return observations


def write_series(series_id: str, source: str, source_url: str, frequency: str, units: str, observations: list[dict[str, Any]]) -> None:
    if not observations:
        raise ValueError(f"no Treasury observations parsed for {series_id}")
    write_json(
        series_path(series_id),
        {
            "series_id": series_id,
            "generated_at_utc": utc_now_iso(),
            "source": source,
            "source_url": source_url,
            "frequency": frequency,
            "units": units,
            "observations": observations,
        },
    )


def main() -> None:
    mts_series = normalize_mts_table_1_rows(fiscaldata_payload(MTS_TABLE_1_URL))
    for series_id, observations in mts_series.items():
        write_series(series_id, "FiscalData", MTS_SOURCE_URL, "monthly", "millions_usd", observations)

    write_series(
        "treasury_auction_supply",
        "FiscalData",
        AUCTIONS_SOURCE_URL,
        "weekly",
        "millions_usd",
        normalize_auction_supply_rows(fiscaldata_payload(AUCTIONS_QUERY_URL)),
    )


if __name__ == "__main__":
    main()
