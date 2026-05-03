from __future__ import annotations

from scripts.shared.catalog import FRED_SERIES, fred_endpoint
from scripts.shared.io import download_text, parse_csv_rows, parse_float, series_path, utc_now_iso, write_json


def main() -> None:
    for series in FRED_SERIES:
        fred_id = str(series["fred_id"])
        rows = parse_csv_rows(download_text(fred_endpoint(fred_id)))
        observations = []
        for row in rows:
            raw_date = row.get("observation_date")
            value = parse_float(row.get(fred_id))
            if not raw_date or value is None:
                continue
            observations.append({"date": raw_date.strip(), "value": value})

        observations.sort(key=lambda item: item["date"])
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
