from __future__ import annotations

from datetime import datetime

from scripts.shared.catalog import CBOE_VIX
from scripts.shared.io import download_text, parse_csv_rows, parse_float, series_path, utc_now_iso, write_json


DATE_COLUMNS = ("DATE", "Date", "date")
CLOSE_COLUMNS = ("CLOSE", "Close", "close")


def first_value(row: dict[str, str], names: tuple[str, ...]) -> str | None:
    for name in names:
        if name in row:
            return row[name]
    return None


def normalize_date(value: str) -> str:
    text = value.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return text


def main() -> None:
    rows = parse_csv_rows(download_text(str(CBOE_VIX["endpoint_url"])))
    observations = []
    for row in rows:
        raw_date = first_value(row, DATE_COLUMNS)
        raw_close = first_value(row, CLOSE_COLUMNS)
        value = parse_float(raw_close)
        if not raw_date or value is None:
            continue
        observations.append({"date": normalize_date(raw_date), "value": value})

    observations.sort(key=lambda item: item["date"])
    write_json(
        series_path(str(CBOE_VIX["id"])),
        {
            "series_id": CBOE_VIX["id"],
            "generated_at_utc": utc_now_iso(),
            "source": CBOE_VIX["source"],
            "source_url": CBOE_VIX["source_url"],
            "frequency": CBOE_VIX["frequency"],
            "units": CBOE_VIX["units"],
            "observations": observations,
        },
    )


if __name__ == "__main__":
    main()
