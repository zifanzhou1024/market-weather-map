from __future__ import annotations

from datetime import datetime
from typing import Iterable

from scripts.shared.catalog import CBOE_INDEX_SERIES
from scripts.shared.io import download_text, parse_csv_rows, parse_float, series_path, utc_now_iso, write_json


DATE_COLUMNS = ("DATE", "Date", "date")


def first_value(row: dict[str, str], names: Iterable[str]) -> str | None:
    normalized = {key.lower(): key for key in row}
    for name in names:
        if name in row:
            return row[name]
        key = normalized.get(name.lower())
        if key is not None:
            return row[key]
    return None


def row_has_column(row: dict[str, str], names: Iterable[str]) -> bool:
    columns = {key.lower() for key in row}
    return any(name.lower() in columns for name in names)


def normalize_date(value: str, series_id: str) -> str:
    text = value.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError(f"invalid date for {series_id}: {value}")


def normalize_cboe_rows(
    rows: list[dict[str, str]],
    series_id: str,
    value_columns: tuple[str, ...],
) -> list[dict[str, float | str]]:
    if not rows:
        raise ValueError(f"no rows returned for {series_id}")

    has_date = row_has_column(rows[0], DATE_COLUMNS)
    has_value = row_has_column(rows[0], value_columns)
    if not has_date or not has_value:
        if series_id == "vix":
            raise ValueError("missing required VIX columns")
        raise ValueError(
            f"missing required Cboe columns for {series_id}: "
            f"date column and one of {', '.join(value_columns)}"
        )

    observations = []
    for row in rows:
        raw_date = first_value(row, DATE_COLUMNS)
        raw_value = first_value(row, value_columns)
        try:
            value = parse_float(raw_value)
        except ValueError as error:
            raise ValueError(f"invalid numeric value for {series_id}: {raw_value}") from error
        if value is None:
            continue
        if not raw_date:
            raise ValueError(f"missing date for {series_id}")
        date = normalize_date(raw_date, series_id)
        observations.append({"date": date, "value": value})

    if not observations:
        raise ValueError(f"no observations parsed for {series_id}")

    observations.sort(key=lambda item: str(item["date"]))
    return observations


def normalize_vix_rows(rows: list[dict[str, str]]) -> list[dict[str, float | str]]:
    return normalize_cboe_rows(rows, "vix", ("CLOSE", "VIX"))


def main() -> None:
    for series in CBOE_INDEX_SERIES:
        if series.get("score_status") != "active":
            continue
        series_id = str(series["id"])
        rows = parse_csv_rows(download_text(str(series["endpoint_url"])))
        value_columns = tuple(str(column) for column in series["value_columns"])
        observations = normalize_cboe_rows(rows, series_id, value_columns)
        write_json(
            series_path(series_id),
            {
                "series_id": series_id,
                "generated_at_utc": utc_now_iso(),
                "source": series["source"],
                "source_url": series["source_url"],
                "frequency": series["frequency"],
                "units": series["units"],
                "observations": observations,
            },
        )


if __name__ == "__main__":
    main()
