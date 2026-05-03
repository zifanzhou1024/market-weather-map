from __future__ import annotations


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
        "id": "high_yield_oas",
        "fred_id": "BAMLH0A0HYM2",
        "name": "High Yield Option-Adjusted Spread",
        "category": "credit",
        "frequency": "daily",
        "units": "percent",
        "higher_is": "riskier",
        "max_stale_days": 7,
        "notes": "Daily high yield credit spread from FRED.",
    },
    {
        "id": "investment_grade_oas",
        "fred_id": "BAMLC0A0CM",
        "name": "Investment Grade Option-Adjusted Spread",
        "category": "credit",
        "frequency": "daily",
        "units": "percent",
        "higher_is": "riskier",
        "max_stale_days": 7,
        "notes": "Daily investment grade credit spread from FRED.",
    },
]


def fred_endpoint(fred_id: str) -> str:
    return f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fred_id}"


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
    return entries
