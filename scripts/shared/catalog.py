from __future__ import annotations

from datetime import datetime, timezone

from scripts.shared.io import data_dir


CBOE_VIX = {
    "id": "vix",
    "name": "CBOE Volatility Index",
    "category": "volatility",
    "source": "Cboe",
    "source_url": "https://www.cboe.com/tradable_products/vix/vix_historical_data/",
    "endpoint_url": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv",
    "frequency": "daily",
    "units": "index",
    "higher_is": "riskier",
    "public": True,
    "max_stale_days": 7,
    "notes": "Daily VIX close from Cboe public historical data.",
}


FRED_SERIES = [
    {
        "id": "us2y",
        "fred_id": "DGS2",
        "name": "2-Year Treasury Constant Maturity Rate",
        "category": "rates",
        "frequency": "daily",
        "units": "percent",
        "higher_is": "riskier",
        "max_stale_days": 7,
        "notes": "Daily 2-year Treasury yield from FRED.",
    },
    {
        "id": "us10y",
        "fred_id": "DGS10",
        "name": "10-Year Treasury Constant Maturity Rate",
        "category": "rates",
        "frequency": "daily",
        "units": "percent",
        "higher_is": "riskier",
        "max_stale_days": 7,
        "notes": "Daily 10-year Treasury yield from FRED.",
    },
    {
        "id": "us20y",
        "fred_id": "DGS20",
        "name": "20-Year Treasury Constant Maturity Rate",
        "category": "rates",
        "frequency": "daily",
        "units": "percent",
        "higher_is": "riskier",
        "max_stale_days": 7,
        "notes": "Daily 20-year Treasury yield from FRED.",
    },
    {
        "id": "us30y",
        "fred_id": "DGS30",
        "name": "30-Year Treasury Constant Maturity Rate",
        "category": "rates",
        "frequency": "daily",
        "units": "percent",
        "higher_is": "riskier",
        "max_stale_days": 7,
        "notes": "Daily 30-year Treasury yield from FRED.",
    },
    {
        "id": "fed_assets",
        "fred_id": "WALCL",
        "name": "Federal Reserve Total Assets",
        "category": "liquidity",
        "frequency": "weekly",
        "units": "millions_usd",
        "higher_is": "supportive",
        "max_stale_days": 14,
        "notes": "Weekly Federal Reserve balance sheet assets from FRED.",
    },
    {
        "id": "reverse_repo",
        "fred_id": "RRPONTSYD",
        "name": "Overnight Reverse Repurchase Agreements",
        "category": "liquidity",
        "frequency": "daily",
        "units": "billions_usd",
        "higher_is": "riskier",
        "max_stale_days": 7,
        "notes": "Daily reverse repo operations from FRED.",
    },
    {
        "id": "treasury_general_account",
        "fred_id": "WTREGEN",
        "name": "Treasury General Account",
        "category": "liquidity",
        "frequency": "weekly",
        "units": "millions_usd",
        "higher_is": "riskier",
        "max_stale_days": 14,
        "notes": "Weekly Treasury General Account balance from FRED.",
    },
    {
        "id": "sofr",
        "fred_id": "SOFR",
        "name": "Secured Overnight Financing Rate",
        "category": "liquidity",
        "frequency": "daily",
        "units": "percent",
        "higher_is": "riskier",
        "max_stale_days": 7,
        "notes": "Daily SOFR from FRED.",
    },
    {
        "id": "financial_stress",
        "fred_id": "STLFSI4",
        "name": "St. Louis Fed Financial Stress Index",
        "category": "credit",
        "frequency": "weekly",
        "units": "index",
        "higher_is": "riskier",
        "max_stale_days": 14,
        "notes": "Weekly financial stress index published by the St. Louis Fed.",
    },
    {
        "id": "financial_conditions",
        "fred_id": "NFCI",
        "name": "Chicago Fed National Financial Conditions Index",
        "category": "credit",
        "frequency": "weekly",
        "units": "index",
        "higher_is": "riskier",
        "max_stale_days": 14,
        "notes": "Weekly national financial conditions index published by the Chicago Fed.",
    },
    {
        "id": "wti_crude",
        "fred_id": "DCOILWTICO",
        "name": "WTI Crude Oil Spot Price",
        "category": "commodities",
        "frequency": "daily",
        "units": "usd_per_barrel",
        "higher_is": "riskier",
        "max_stale_days": 10,
        "notes": "Daily WTI crude oil spot price from FRED graph CSV.",
    },
    {
        "id": "brent_crude",
        "fred_id": "DCOILBRENTEU",
        "name": "Brent Crude Oil Spot Price",
        "category": "commodities",
        "frequency": "daily",
        "units": "usd_per_barrel",
        "higher_is": "riskier",
        "max_stale_days": 10,
        "notes": "Daily Brent crude oil spot price from FRED graph CSV.",
    },
    {
        "id": "corn_price",
        "fred_id": "PMAIZMTUSDM",
        "name": "Global Corn Price",
        "category": "commodities",
        "frequency": "monthly",
        "units": "usd_per_metric_ton",
        "higher_is": "riskier",
        "max_stale_days": 75,
        "notes": "Monthly global corn price from FRED graph CSV.",
    },
    {
        "id": "wheat_price",
        "fred_id": "PWHEAMTUSDM",
        "name": "Global Wheat Price",
        "category": "commodities",
        "frequency": "monthly",
        "units": "usd_per_metric_ton",
        "higher_is": "riskier",
        "max_stale_days": 75,
        "notes": "Monthly global wheat price from FRED graph CSV.",
    },
    {
        "id": "soybean_price",
        "fred_id": "PSOYBUSDM",
        "name": "Global Soybean Price",
        "category": "commodities",
        "frequency": "monthly",
        "units": "usd_per_metric_ton",
        "higher_is": "riskier",
        "max_stale_days": 75,
        "notes": "Monthly global soybean price from FRED graph CSV.",
    },
]


CFTC_SOURCE_URL = "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm"

CFTC_POSITIONING_SERIES = [
    {
        "id": "cftc_sp500_asset_mgr_net",
        "name": "CFTC E-mini S&P 500 Asset Manager Net Positioning",
        "category": "sentiment",
        "frequency": "weekly",
        "units": "percent_open_interest",
        "higher_is": "contextual",
        "max_stale_days": 14,
        "notes": "Asset manager long minus short positioning as percent of open interest from CFTC Traders in Financial Futures.",
    },
    {
        "id": "cftc_sp500_lev_money_net",
        "name": "CFTC E-mini S&P 500 Leveraged Money Net Positioning",
        "category": "sentiment",
        "frequency": "weekly",
        "units": "percent_open_interest",
        "higher_is": "riskier",
        "max_stale_days": 14,
        "notes": "Leveraged money long minus short positioning as percent of open interest from CFTC Traders in Financial Futures.",
    },
]


def fred_endpoint(fred_id: str) -> str:
    return f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fred_id}"


def cftc_tff_year_url(year: int) -> str:
    return f"https://www.cftc.gov/files/dea/history/fut_fin_txt_{year}.zip"


def catalog_entries() -> list[dict[str, object]]:
    entries = [CBOE_VIX.copy()]
    for series in FRED_SERIES:
        entries.append(
            {
                "id": series["id"],
                "name": series["name"],
                "category": series["category"],
                "source": "FRED",
                "source_url": f"https://fred.stlouisfed.org/series/{series['fred_id']}",
                "endpoint_url": fred_endpoint(str(series["fred_id"])),
                "frequency": series["frequency"],
                "units": series["units"],
                "higher_is": series["higher_is"],
                "public": True,
                "max_stale_days": series["max_stale_days"],
                "notes": series["notes"],
            }
        )
    for series in CFTC_POSITIONING_SERIES:
        entries.append(
            {
                "id": series["id"],
                "name": series["name"],
                "category": series["category"],
                "source": "CFTC",
                "source_url": CFTC_SOURCE_URL,
                "endpoint_url": cftc_tff_year_url(datetime.now(timezone.utc).year),
                "frequency": series["frequency"],
                "units": series["units"],
                "higher_is": series["higher_is"],
                "public": True,
                "max_stale_days": series["max_stale_days"],
                "notes": series["notes"],
            }
        )
    return entries


def available_catalog_entries() -> list[dict[str, object]]:
    series_dir = data_dir() / "series"
    return [
        entry
        for entry in catalog_entries()
        if (series_dir / f"{entry['id']}.json").exists()
    ]
