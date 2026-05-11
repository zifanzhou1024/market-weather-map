"""Fetch Shiller CAPE Ratio from multpl.com HTML table.

multpl.com is the canonical fresh mirror of Shiller's CAPE data.
Yale's published .xls (http://www.econ.yale.edu/~shiller/data/ie_data.xls)
has not updated since 2023-10-17; multpl.com mirrors the same methodology
with monthly updates.
"""
from __future__ import annotations

import re
from datetime import datetime

from scripts.shared.io import download_text, series_path, utc_now_iso, write_json

ENDPOINT = "https://www.multpl.com/shiller-pe/table/by-month"
SERIES_ID = "cape_ratio"

# Each table row: <tr ...><td ...>Apr 1, 2026</td><td ...>&#x2002;\n38.34\n</td></tr>
# Capture the date string and the trailing float value.
_ROW_RE = re.compile(
    r"<tr[^>]*>\s*<td[^>]*>([A-Z][a-z]+ \d{1,2}, \d{4})</td>\s*<td[^>]*>[^<]*?(\d+\.\d+)\s*</td>\s*</tr>",
    re.DOTALL,
)


def _parse_date(raw: str) -> str:
    """Convert 'May 1, 2026' (or 'May 8, 2026' for the live row) to ISO YYYY-MM-01."""
    parsed = datetime.strptime(raw.strip(), "%b %d, %Y")
    return f"{parsed.year:04d}-{parsed.month:02d}-01"


def extract_observations(html: str) -> list[dict[str, object]]:
    """Parse the multpl.com Shiller PE table HTML into TimeSeriesFile observations.

    Normalizes the live current-day row (e.g. 'May 8, 2026') to first-of-month
    so all observations sit on a clean monthly grid.
    """
    matches = _ROW_RE.findall(html)
    if not matches:
        raise ValueError("multpl.com Shiller PE table: no rows matched the expected pattern")

    seen: dict[str, float] = {}
    for raw_date, raw_value in matches:
        try:
            iso_date = _parse_date(raw_date)
            value = float(raw_value)
        except ValueError:
            continue
        # First match for a given month wins (the live current-day row appears
        # first in the source; subsequent first-of-month rows for prior months follow).
        seen.setdefault(iso_date, value)

    observations = [{"date": d, "value": v} for d, v in seen.items()]
    observations.sort(key=lambda item: str(item["date"]))
    return observations


def main() -> None:
    html = download_text(ENDPOINT)
    observations = extract_observations(html)
    write_json(
        series_path(SERIES_ID),
        {
            "series_id": SERIES_ID,
            "generated_at_utc": utc_now_iso(),
            "source": "Robert Shiller / multpl.com",
            "source_url": "https://www.multpl.com/shiller-pe/table/by-month",
            "frequency": "monthly",
            "units": "ratio",
            "observations": observations,
        },
    )


if __name__ == "__main__":
    main()
