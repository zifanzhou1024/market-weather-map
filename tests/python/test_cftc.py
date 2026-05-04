import csv
import io
import zipfile

from scripts.ingest import fetch_cftc
from scripts.ingest.fetch_cftc import net_percent_open_interest, normalize_cftc_rows


def test_net_percent_open_interest_uses_long_short_and_open_interest():
    row = {
        "Open_Interest_All": "1000",
        "Lev_Money_Positions_Long_All": "600",
        "Lev_Money_Positions_Short_All": "250",
    }

    assert net_percent_open_interest(row, "Lev_Money") == 35.0


def test_normalize_cftc_rows_filters_emini_sp500():
    rows = [
        {
            "Market_and_Exchange_Names": "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
            "Report_Date_as_YYYY-MM-DD": "2026-04-28",
            "Open_Interest_All": "1000",
            "Asset_Mgr_Positions_Long_All": "10",
            "Asset_Mgr_Positions_Short_All": "5",
            "Lev_Money_Positions_Long_All": "10",
            "Lev_Money_Positions_Short_All": "5",
        },
        {
            "Market_and_Exchange_Names": "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE",
            "Report_Date_as_YYYY-MM-DD": "2026-04-28",
            "Open_Interest_All": "2000",
            "Asset_Mgr_Positions_Long_All": "1200",
            "Asset_Mgr_Positions_Short_All": "300",
            "Lev_Money_Positions_Long_All": "450",
            "Lev_Money_Positions_Short_All": "700",
        },
    ]

    payload = normalize_cftc_rows(rows)

    assert payload["cftc_sp500_asset_mgr_net"] == [{"date": "2026-04-28", "value": 45.0}]
    assert payload["cftc_sp500_lev_money_net"] == [{"date": "2026-04-28", "value": -12.5}]


def test_normalize_cftc_rows_uses_contract_market_code_for_alternate_name():
    rows = [
        {
            "Market_and_Exchange_Names": "E-MINI S&P 500 STOCK INDEX - CHICAGO MERCANTILE EXCHANGE",
            "CFTC_Contract_Market_Code": "13874A",
            "Report_Date_as_YYYY-MM-DD": "2026-04-28",
            "Open_Interest_All": "2000",
            "Asset_Mgr_Positions_Long_All": "1200",
            "Asset_Mgr_Positions_Short_All": "300",
            "Lev_Money_Positions_Long_All": "450",
            "Lev_Money_Positions_Short_All": "700",
        },
    ]

    payload = normalize_cftc_rows(rows)

    assert payload["cftc_sp500_asset_mgr_net"] == [{"date": "2026-04-28", "value": 45.0}]
    assert payload["cftc_sp500_lev_money_net"] == [{"date": "2026-04-28", "value": -12.5}]


def test_normalize_cftc_rows_deduplicates_name_and_code_rows_for_same_date():
    rows = [
        {
            "Market_and_Exchange_Names": "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE",
            "Report_Date_as_YYYY-MM-DD": "2026-04-28",
            "Open_Interest_All": "2000",
            "Asset_Mgr_Positions_Long_All": "1200",
            "Asset_Mgr_Positions_Short_All": "300",
            "Lev_Money_Positions_Long_All": "450",
            "Lev_Money_Positions_Short_All": "700",
        },
        {
            "Market_and_Exchange_Names": "E-MINI S&P 500 STOCK INDEX - CHICAGO MERCANTILE EXCHANGE",
            "CFTC_Contract_Market_Code": "13874A",
            "Report_Date_as_YYYY-MM-DD": "2026-04-28",
            "Open_Interest_All": "2000",
            "Asset_Mgr_Positions_Long_All": "1200",
            "Asset_Mgr_Positions_Short_All": "300",
            "Lev_Money_Positions_Long_All": "450",
            "Lev_Money_Positions_Short_All": "700",
        },
    ]

    payload = normalize_cftc_rows(rows)

    assert payload["cftc_sp500_asset_mgr_net"] == [{"date": "2026-04-28", "value": 45.0}]
    assert payload["cftc_sp500_lev_money_net"] == [{"date": "2026-04-28", "value": -12.5}]


def test_collect_cftc_rows_skips_failed_latest_year_when_prior_rows_exist():
    row = {
        "Market_and_Exchange_Names": "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE",
        "Report_Date_as_YYYY-MM-DD": "2025-12-30",
        "Open_Interest_All": "2000",
        "Asset_Mgr_Positions_Long_All": "1200",
        "Asset_Mgr_Positions_Short_All": "300",
        "Lev_Money_Positions_Long_All": "450",
        "Lev_Money_Positions_Short_All": "700",
    }

    def fetcher(url: str) -> bytes:
        if url.endswith("2026.zip"):
            raise RuntimeError("not published")
        return _zip_rows([row])

    rows = fetch_cftc.collect_cftc_rows([2025, 2026], fetcher=fetcher)

    assert rows == [row]


def _zip_rows(rows: list[dict[str, str]]) -> bytes:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as archive:
        archive.writestr("annual.txt", output.getvalue())
    return payload.getvalue()
