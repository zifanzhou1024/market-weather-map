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
