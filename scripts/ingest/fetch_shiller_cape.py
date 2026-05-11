"""Fetch Shiller CAPE Ratio from Yale Excel file."""
from __future__ import annotations

import xlrd

from scripts.shared.io import download_bytes, series_path, utc_now_iso, write_json

ENDPOINT = "http://www.econ.yale.edu/~shiller/data/ie_data.xls"
SERIES_ID = "cape_ratio"
SHEET_NAME = "Data"
CAPE_HEADER = "CAPE"  # column header used to locate the column by name (resilient to layout changes)


def _shiller_date_to_iso(raw: str | float) -> str:
    """Convert Shiller's YYYY.MM date (e.g. '2024.01' or 2024.01 as float) to ISO YYYY-MM-01.

    Shiller writes "2024.10" for October. Python's f"{float:.2f}" preserves trailing zeros
    (f"{2024.10:.2f}" == "2024.10"), so the month field is always two digits after formatting.
    This makes the conversion unambiguous: split on ".", parse both parts as int.
    """
    text = f"{float(raw):.2f}"  # normalize to "YYYY.MM" form; .2f preserves trailing zero
    year_str, month_str = text.split(".")
    return f"{int(year_str):04d}-{int(month_str):02d}-01"


def extract_cape_observations(rows: list[list[object]], *, header_row_index: int) -> list[dict[str, object]]:
    """Extract (date, value) observations from the parsed Data sheet rows.

    `rows` is the full sheet as a list of cell-value lists (xlrd's row_values output).
    `header_row_index` is the 0-based row index where column headers live.
    """
    headers = [str(h).strip() for h in rows[header_row_index]]
    try:
        date_col = headers.index("Date")
        cape_col = headers.index(CAPE_HEADER)
    except ValueError as error:
        raise ValueError(
            f"Shiller XLS missing expected columns 'Date' and '{CAPE_HEADER}'; got {headers}"
        ) from error

    observations: list[dict[str, object]] = []
    for row in rows[header_row_index + 1:]:
        raw_date = row[date_col] if date_col < len(row) else None
        raw_cape = row[cape_col] if cape_col < len(row) else None
        if raw_date in (None, "") or raw_cape in (None, ""):
            continue
        try:
            iso_date = _shiller_date_to_iso(raw_date)
            value = float(raw_cape)
        except (ValueError, TypeError):
            continue  # skip rows where date or CAPE doesn't parse (e.g. NA, NaN, footer rows)
        observations.append({"date": iso_date, "value": value})
    if not observations:
        raise ValueError("no CAPE observations parsed from Shiller XLS")
    observations.sort(key=lambda item: str(item["date"]))
    return observations


def find_header_row_index(rows: list[list[object]]) -> int:
    """Locate the row in the Data sheet that contains both 'Date' and CAPE_HEADER.

    Raises ValueError if no such row exists.
    """
    for i, row in enumerate(rows):
        stripped = [str(c).strip() for c in row]
        if "Date" in stripped and CAPE_HEADER in stripped:
            return i
    raise ValueError(f"Shiller XLS: no header row found containing 'Date' and '{CAPE_HEADER}'")


def main() -> None:
    raw_bytes = download_bytes(ENDPOINT)
    book = xlrd.open_workbook(file_contents=raw_bytes)
    sheet = book.sheet_by_name(SHEET_NAME)
    rows = [sheet.row_values(i) for i in range(sheet.nrows)]
    # Locate header row dynamically: scan for the first row containing both "Date" and CAPE_HEADER.
    # Shiller's "Data" sheet has a multi-row preamble before the actual column headers.
    header_row_index = find_header_row_index(rows)
    observations = extract_cape_observations(rows, header_row_index=header_row_index)
    write_json(
        series_path(SERIES_ID),
        {
            "series_id": SERIES_ID,
            "generated_at_utc": utc_now_iso(),
            "source": "Robert Shiller / Yale",
            "source_url": "http://www.econ.yale.edu/~shiller/data.htm",
            "frequency": "monthly",
            "units": "ratio",
            "observations": observations,
        },
    )


if __name__ == "__main__":
    main()
