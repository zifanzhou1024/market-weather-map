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


def require_iso_date(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as error:
        raise ValueError(f"invalid ISO date for vix: {value}") from error
    return value


def normalize_vix_rows(rows: list[dict[str, str]]) -> list[dict[str, float | str]]:
    if not rows:
        raise ValueError("no rows returned for vix")

    columns = set(rows[0])
    has_date = any(column in columns for column in DATE_COLUMNS)
    has_close = any(column in columns for column in CLOSE_COLUMNS)
    if not has_date or not has_close:
        raise ValueError("missing required VIX columns")

    observations = []
    for row in rows:
        raw_date = first_value(row, DATE_COLUMNS)
        raw_close = first_value(row, CLOSE_COLUMNS)
        try:
            value = parse_float(raw_close)
        except ValueError as error:
            raise ValueError(f"invalid numeric value for vix: {raw_close}") from error
        if value is None:
            continue
        if not raw_date:
            raise ValueError("missing date for vix")
        date = require_iso_date(normalize_date(raw_date))
        observations.append({"date": date, "value": value})

    if not observations:
        raise ValueError("no observations parsed for vix")

    observations.sort(key=lambda item: str(item["date"]))
    return observations


def main() -> None:
    rows = parse_csv_rows(download_text(str(CBOE_VIX["endpoint_url"])))
    observations = normalize_vix_rows(rows)
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
