"""Fetch BEA Personal Saving Rate (PSAVERT) from FRED graph CSV."""
from __future__ import annotations

from scripts.shared.io import (
    download_text,
    parse_csv_rows,
    parse_float,
    series_path,
    utc_now_iso,
    write_json,
)

ENDPOINT = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSAVERT"
SERIES_ID = "personal_saving_rate"


def normalize_rows(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    if not rows:
        raise ValueError("no rows returned for PSAVERT")
    if "DATE" not in rows[0] or "VALUE" not in rows[0]:
        raise ValueError("missing expected DATE/VALUE columns in FRED CSV")
    observations: list[dict[str, object]] = []
    for row in rows:
        raw_date = row.get("DATE")
        try:
            value = parse_float(row.get("VALUE"))
        except ValueError as error:
            raise ValueError(f"invalid numeric value for PSAVERT: {row.get('VALUE')}") from error
        if value is None:
            continue
        if not raw_date:
            raise ValueError("missing DATE for PSAVERT row")
        observations.append({"date": raw_date.strip(), "value": value})
    if not observations:
        raise ValueError("no observations parsed for PSAVERT")
    observations.sort(key=lambda item: str(item["date"]))
    return observations


def main() -> None:
    rows = parse_csv_rows(download_text(ENDPOINT))
    observations = normalize_rows(rows)
    write_json(
        series_path(SERIES_ID),
        {
            "series_id": SERIES_ID,
            "generated_at_utc": utc_now_iso(),
            "source": "BEA / FRED",
            "source_url": "https://fred.stlouisfed.org/series/PSAVERT",
            "frequency": "monthly",
            "units": "percent",
            "observations": observations,
        },
    )


if __name__ == "__main__":
    main()
