from __future__ import annotations

from datetime import datetime

from scripts.shared.catalog import FRED_SERIES, fred_endpoint
from scripts.shared.io import download_text, parse_csv_rows, parse_float, series_path, utc_now_iso, write_json


def require_iso_date(value: str, series_id: str) -> str:
    text = value.strip()
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError as error:
        raise ValueError(f"invalid ISO date for {series_id}: {value}") from error
    return text


def normalize_fred_rows(rows: list[dict[str, str]], fred_id: str) -> list[dict[str, float | str]]:
    if not rows:
        raise ValueError(f"no rows returned for {fred_id}")

    columns = set(rows[0])
    if "observation_date" not in columns or fred_id not in columns:
        raise ValueError(f"missing expected FRED column {fred_id}")

    observations = []
    for row in rows:
        raw_date = row.get("observation_date")
        raw_value = row.get(fred_id)
        try:
            value = parse_float(raw_value)
        except ValueError as error:
            raise ValueError(f"invalid numeric value for {fred_id}: {raw_value}") from error
        if value is None:
            continue
        if not raw_date:
            raise ValueError(f"missing observation_date for {fred_id}")
        observations.append({"date": require_iso_date(raw_date, fred_id), "value": value})

    if not observations:
        raise ValueError(f"no observations parsed for {fred_id}")

    observations.sort(key=lambda item: str(item["date"]))
    return observations


def active_fred_series() -> list[dict[str, object]]:
    return [
        series
        for series in FRED_SERIES
        if series.get("score_status", "active") == "active"
        and series.get("access_status", "free_public") == "free_public"
    ]


def main() -> None:
    for series in active_fred_series():
        fred_id = str(series["fred_id"])
        rows = parse_csv_rows(download_text(fred_endpoint(fred_id)))
        observations = normalize_fred_rows(rows, fred_id)
        write_json(
            series_path(str(series["id"])),
            {
                "series_id": series["id"],
                "generated_at_utc": utc_now_iso(),
                "source": "FRED",
                "source_url": f"https://fred.stlouisfed.org/series/{fred_id}",
                "frequency": series["frequency"],
                "units": series["units"],
                "observations": observations,
            },
        )


if __name__ == "__main__":
    main()
