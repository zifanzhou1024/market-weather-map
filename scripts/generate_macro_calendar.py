from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from scripts.shared.io import data_dir, write_json


METHOD_VERSION = "official-event-calendar-v1"

EVENTS: list[dict[str, Any]] = [
    {
        "id": "cpi",
        "title": "CPI",
        "category": "inflation",
        "importance": "high",
        "source": "BLS",
        "source_url": "https://www.bls.gov/schedule/news_release/cpi.htm",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "BLS monthly Consumer Price Index release calendar.",
    },
    {
        "id": "ppi",
        "title": "PPI",
        "category": "inflation",
        "importance": "medium",
        "source": "BLS",
        "source_url": "https://www.bls.gov/schedule/news_release/ppi.htm",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "BLS monthly Producer Price Index release calendar.",
    },
    {
        "id": "employment_situation_payrolls",
        "title": "Employment Situation/payrolls",
        "category": "growth",
        "importance": "high",
        "source": "BLS",
        "source_url": "https://www.bls.gov/schedule/news_release/empsit.htm",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "BLS monthly Employment Situation release calendar.",
    },
    {
        "id": "personal_income_outlays_pce",
        "title": "Personal Income and Outlays/PCE",
        "category": "inflation",
        "importance": "high",
        "source": "BEA",
        "source_url": "https://www.bea.gov/news/schedule/",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "BEA release schedule for Personal Income and Outlays including PCE.",
    },
    {
        "id": "gross_domestic_product",
        "title": "Gross Domestic Product",
        "category": "growth",
        "importance": "high",
        "source": "BEA",
        "source_url": "https://www.bea.gov/news/schedule/",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "BEA release schedule for Gross Domestic Product estimates.",
    },
    {
        "id": "retail_sales",
        "title": "Advance Monthly Retail Trade",
        "category": "growth",
        "importance": "high",
        "source": "Census",
        "source_url": "https://www.census.gov/retail/",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "Census source page for Advance Monthly Retail Trade and Food Services releases.",
    },
    {
        "id": "fomc_meeting",
        "title": "FOMC Meeting",
        "category": "rates",
        "importance": "high",
        "source": "Federal Reserve",
        "source_url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
        "date": None,
        "time": "14:00",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "Federal Reserve FOMC calendars and policy statement schedule.",
    },
    {
        "id": "treasury_auctions",
        "title": "Treasury Auctions",
        "category": "rates",
        "importance": "medium",
        "source": "TreasuryDirect",
        "source_url": "https://www.treasuryauctions.gov/auctions/when-auctions-happen/",
        "date": None,
        "time": None,
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "TreasuryDirect auction schedule source.",
    },
    {
        "id": "new_residential_construction",
        "title": "New Residential Construction",
        "category": "housing",
        "importance": "medium",
        "source": "Census",
        "source_url": "https://www.census.gov/construction/nrc/",
        "date": None,
        "time": "08:30",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "Census housing starts and building permits release source.",
    },
    {
        "id": "commitments_of_traders",
        "title": "Commitments of Traders",
        "category": "sentiment",
        "importance": "medium",
        "source": "CFTC",
        "source_url": "https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm",
        "date": None,
        "time": "15:30",
        "timezone": "America/New_York",
        "status": "source_link",
        "notes": "CFTC Commitments of Traders release schedule source.",
    },
]


def generate_macro_calendar() -> dict[str, Any]:
    return {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "method_version": METHOD_VERSION,
        "events": deepcopy(EVENTS),
    }


def main() -> None:
    write_json(data_dir() / "events" / "macro_calendar.json", generate_macro_calendar())


if __name__ == "__main__":
    main()
