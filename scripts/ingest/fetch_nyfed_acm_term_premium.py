"""Fetch NY Fed 10-Year ACM Term Premium from the published .xls.

The NY Fed publishes Adrian-Crump-Moench term-premium estimates as a
legacy binary Excel .xls (OLE2 compound document). There is no CSV mirror;
the .xlsx and .csv filename variants both redirect to the same .xls file.

Workbook structure (verified 2026-05-11):
  Sheet "ACM Daily": 16,189 rows x 31 columns.
  Row 0 (index 0): header row.
  Column headers: DATE, ACMY01-ACMY10, ACMTP01-ACMTP10, ACMRNY01-ACMRNY10.
  Date format: text string "DD-Mon-YYYY" (e.g. "14-Jun-1961").
  ACMTP10: 10-year term-premium estimate (percent).

See docs/source_reviews/ny_fed_acm_term_premium.md for access and
redistribution approval.
"""
from __future__ import annotations

from datetime import datetime

import xlrd

from scripts.shared.io import download_bytes, series_path, utc_now_iso, write_json

ENDPOINT = "https://www.newyorkfed.org/medialibrary/media/research/data_indicators/ACMTermPremium.xls"
SERIES_ID = "term_premium_acm_10y"
SHEET_NAME = "ACM Daily"
DATE_HEADER = "DATE"
VALUE_HEADER = "ACMTP10"

_DATE_FMT = "%d-%b-%Y"  # e.g. "14-Jun-1961"


def parse_acm_date(raw: str) -> str:
    """Convert a "DD-Mon-YYYY" date string to ISO YYYY-MM-DD."""
    return datetime.strptime(raw.strip(), _DATE_FMT).date().isoformat()


def find_header_row_index(rows: list[list[object]]) -> int:
    """Return the index of the row that contains both DATE and ACMTP10 headers."""
    for i, row in enumerate(rows):
        stripped = [str(c).strip() for c in row]
        if DATE_HEADER in stripped and VALUE_HEADER in stripped:
            return i
    raise ValueError(
        f"ACMTermPremium.xls: no header row found containing '{DATE_HEADER}' and '{VALUE_HEADER}'"
    )


def extract_acm_observations(
    rows: list[list[object]],
    *,
    header_row_index: int,
) -> list[dict[str, object]]:
    """Parse rows into a sorted list of date/value observations.

    Locates DATE and ACMTP10 columns by header name (not index) so the
    fetcher survives workbook column reordering.
    """
    headers = [str(h).strip() for h in rows[header_row_index]]
    if DATE_HEADER not in headers or VALUE_HEADER not in headers:
        raise ValueError(
            f"ACMTermPremium.xls missing expected columns '{DATE_HEADER}' and "
            f"'{VALUE_HEADER}'; got {headers}"
        )
    date_col = headers.index(DATE_HEADER)
    value_col = headers.index(VALUE_HEADER)

    observations: list[dict[str, object]] = []
    for row in rows[header_row_index + 1 :]:
        if date_col >= len(row) or value_col >= len(row):
            continue
        raw_date = row[date_col]
        raw_value = row[value_col]
        if raw_date in (None, "") or raw_value in (None, ""):
            continue
        if str(raw_date).strip() == "" or str(raw_value).strip() == "":
            continue
        try:
            iso_date = parse_acm_date(str(raw_date))
            value = float(raw_value)
        except (ValueError, TypeError):
            continue
        observations.append({"date": iso_date, "value": value})

    if not observations:
        raise ValueError("no ACM observations parsed from ACMTermPremium.xls")

    observations.sort(key=lambda item: str(item["date"]))
    return observations


def main() -> None:
    raw_bytes = download_bytes(ENDPOINT)
    book = xlrd.open_workbook(file_contents=raw_bytes)
    sheet = book.sheet_by_name(SHEET_NAME)
    rows = [sheet.row_values(i) for i in range(sheet.nrows)]
    header_row_index = find_header_row_index(rows)
    observations = extract_acm_observations(rows, header_row_index=header_row_index)
    write_json(
        series_path(SERIES_ID),
        {
            "series_id": SERIES_ID,
            "generated_at_utc": utc_now_iso(),
            "source": "Federal Reserve Bank of New York",
            "source_url": "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs",
            "frequency": "daily",
            "units": "percent",
            "observations": observations,
        },
    )


if __name__ == "__main__":
    main()
