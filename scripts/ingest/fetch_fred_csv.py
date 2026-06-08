from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import URLError

from scripts.shared.catalog import FRED_SERIES, fred_endpoint
from scripts.shared.io import download_text, normalize_two_column_csv, parse_csv_rows, series_path, utc_now_iso, write_json

FRED_INCREMENTAL_LOOKBACK_DAYS = 120


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


def preserve_existing_or_raise(
    output_path: Path,
    error: TimeoutError | URLError,
    *,
    skipped_after_failure: bool = False,
) -> None:
    if not output_path.exists():
        raise error

    action = (
        "skipping FRED download after earlier failure"
        if skipped_after_failure
        else "FRED download failed"
    )
    print(
        f"{output_path.name}: {action} "
        f"({type(error).__name__}: {error}); preserving existing file."
    )


def read_existing_observations(output_path: Path) -> list[dict[str, Any]]:
    if not output_path.exists():
        return []
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    observations = payload.get("observations")
    return observations if isinstance(observations, list) else []


def parse_observation_date(observation: dict[str, Any]) -> datetime | None:
    raw_date = observation.get("date")
    if not isinstance(raw_date, str):
        return None
    try:
        return datetime.strptime(raw_date, "%Y-%m-%d")
    except ValueError:
        return None


def incremental_start_date(existing_observations: list[dict[str, Any]]) -> str | None:
    dates = [
        parsed
        for observation in existing_observations
        if (parsed := parse_observation_date(observation)) is not None
    ]
    if not dates:
        return None
    return (max(dates) - timedelta(days=FRED_INCREMENTAL_LOOKBACK_DAYS)).date().isoformat()


def fred_incremental_endpoint(fred_id: str, existing_observations: list[dict[str, Any]]) -> str:
    url = fred_endpoint(fred_id)
    start_date = incremental_start_date(existing_observations)
    return f"{url}&cosd={start_date}" if start_date else url


def download_fred_rows(fred_id: str, existing_observations: list[dict[str, Any]]) -> list[dict[str, str]]:
    return parse_csv_rows(download_text(fred_incremental_endpoint(fred_id, existing_observations)))


def merge_observations(
    existing_observations: list[dict[str, Any]],
    fresh_observations: list[dict[str, float | str]],
) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for observation in existing_observations + fresh_observations:
        date_text = observation.get("date")
        if not isinstance(date_text, str):
            continue
        if parse_observation_date({"date": date_text}) is None:
            continue
        merged[date_text] = {"date": date_text, "value": observation["value"]}
    return [merged[date_text] for date_text in sorted(merged)]


def main() -> None:
    fred_download_error: TimeoutError | URLError | None = None
    for series in generated_fred_series():
        fred_id = str(series["fred_id"])
        output_path = series_path(str(series["id"]))
        existing_observations = read_existing_observations(output_path)

        if fred_download_error is not None:
            preserve_existing_or_raise(output_path, fred_download_error, skipped_after_failure=True)
            continue

        try:
            rows = download_fred_rows(fred_id, existing_observations)
        except (TimeoutError, URLError) as error:
            fred_download_error = error
            preserve_existing_or_raise(output_path, error)
            continue

        observations = merge_observations(existing_observations, normalize_fred_rows(rows, fred_id))
        write_json(
            output_path,
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
