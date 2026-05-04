from __future__ import annotations

import csv
import io
import zipfile
from datetime import datetime, timezone
from urllib.request import Request, urlopen

from scripts.shared.catalog import CFTC_POSITIONING_SERIES, CFTC_SOURCE_URL, cftc_tff_year_url
from scripts.shared.io import parse_float, series_path, utc_now_iso, write_json


TARGET_CONTRACT_MARKET_CODE = "13874A"
TARGET_MARKET = "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE"
TARGET_MARKET_NAMES = {
    TARGET_MARKET,
    "E-MINI S&P 500 STOCK INDEX - CHICAGO MERCANTILE EXCHANGE",
}


def fetch_zip_bytes(url: str) -> bytes:
    requests = [
        Request(url, headers={"User-Agent": "market-weather-map/0.1"}),
        Request(url),
    ]
    last_error: Exception | None = None
    for request in requests:
        try:
            with urlopen(request, timeout=30) as response:
                return response.read()
        except Exception as error:
            last_error = error
    raise RuntimeError(f"unable to download CFTC zip {url}: {last_error}")


def rows_from_zip(payload: bytes) -> list[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        name = archive.namelist()[0]
        with archive.open(name) as handle:
            text = io.TextIOWrapper(handle, encoding="latin1")
            return list(csv.DictReader(text))


def is_target_market(row: dict[str, str]) -> bool:
    code = row.get("CFTC_Contract_Market_Code")
    if code:
        return code.strip() == TARGET_CONTRACT_MARKET_CODE
    name = row.get("Market_and_Exchange_Names")
    return bool(name and name.strip() in TARGET_MARKET_NAMES)


def net_percent_open_interest(row: dict[str, str], prefix: str) -> float:
    open_interest = parse_float(row.get("Open_Interest_All"))
    long_value = parse_float(row.get(f"{prefix}_Positions_Long_All"))
    short_value = parse_float(row.get(f"{prefix}_Positions_Short_All"))
    if not open_interest or long_value is None or short_value is None:
        raise ValueError("missing CFTC positioning fields")
    return round((long_value - short_value) / open_interest * 100, 4)


def normalize_cftc_rows(rows: list[dict[str, str]]) -> dict[str, list[dict[str, float | str]]]:
    observations: dict[str, list[dict[str, float | str]]] = {
        "cftc_sp500_asset_mgr_net": [],
        "cftc_sp500_lev_money_net": [],
    }
    seen_dates: set[str] = set()
    for row in rows:
        if not is_target_market(row):
            continue
        date = row.get("Report_Date_as_YYYY-MM-DD")
        if not date or date in seen_dates:
            continue
        seen_dates.add(date)
        observations["cftc_sp500_asset_mgr_net"].append(
            {"date": date, "value": net_percent_open_interest(row, "Asset_Mgr")}
        )
        observations["cftc_sp500_lev_money_net"].append(
            {"date": date, "value": net_percent_open_interest(row, "Lev_Money")}
        )

    for values in observations.values():
        values.sort(key=lambda item: str(item["date"]))
    return observations


def current_years(window: int = 5) -> list[int]:
    year = datetime.now(timezone.utc).year
    return list(range(year - window + 1, year + 1))


def collect_cftc_rows(years: list[int], fetcher=fetch_zip_bytes) -> list[dict[str, str]]:
    all_rows: list[dict[str, str]] = []
    latest_year = max(years)
    for year in years:
        try:
            payload = fetcher(cftc_tff_year_url(year))
        except Exception:
            if year == latest_year and all_rows:
                continue
            raise
        all_rows.extend(rows_from_zip(payload))
    if not all_rows:
        raise ValueError("no CFTC rows collected")
    return all_rows


def main() -> None:
    observations = normalize_cftc_rows(collect_cftc_rows(current_years()))
    generated_at = utc_now_iso()
    series_meta = {str(series["id"]): series for series in CFTC_POSITIONING_SERIES}

    for series_id, values in observations.items():
        if not values:
            raise ValueError(f"no CFTC observations parsed for {series_id}")
        meta = series_meta[series_id]
        write_json(
            series_path(series_id),
            {
                "series_id": series_id,
                "generated_at_utc": generated_at,
                "source": "CFTC",
                "source_url": CFTC_SOURCE_URL,
                "frequency": "weekly",
                "units": meta["units"],
                "observations": values,
            },
        )


if __name__ == "__main__":
    main()
