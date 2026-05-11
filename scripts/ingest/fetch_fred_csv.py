from __future__ import annotations

from scripts.shared.catalog import FRED_SERIES, fred_endpoint
from scripts.shared.io import download_text, normalize_two_column_csv, parse_csv_rows, series_path, utc_now_iso, write_json


def normalize_fred_rows(rows: list[dict[str, str]], fred_id: str) -> list[dict[str, float | str]]:
    return normalize_two_column_csv(  # type: ignore[return-value]
        rows,
        date_column="observation_date",
        value_column=fred_id,
        label=fred_id,
        require_iso_date=True,
    )


def active_fred_series() -> list[dict[str, object]]:
    return [
        series
        for series in FRED_SERIES
        if series.get("score_status", "active") == "active"
        and series.get("access_status", "free_public") == "free_public"
    ]


def generated_fred_series() -> list[dict[str, object]]:
    return [
        series
        for series in FRED_SERIES
        if series.get("access_status", "free_public") == "free_public"
        and (
            series.get("score_status", "active") == "active"
            or (
                series.get("score_status") == "candidate"
                and series.get("generate_static") is True
            )
        )
    ]


def main() -> None:
    for series in generated_fred_series():
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
