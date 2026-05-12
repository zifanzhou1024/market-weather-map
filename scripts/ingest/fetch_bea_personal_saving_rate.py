"""Fetch BEA Personal Saving Rate (PSAVERT) from FRED graph CSV."""
from __future__ import annotations

from scripts.shared.io import (
    download_text,
    normalize_two_column_csv,
    parse_csv_rows,
    series_path,
    utc_now_iso,
    write_json,
)

ENDPOINT = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSAVERT"
SERIES_ID = "personal_saving_rate"


def normalize_rows(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    return normalize_two_column_csv(
        rows,
        date_column="observation_date",
        value_column="PSAVERT",
        label="PSAVERT",
    )


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
