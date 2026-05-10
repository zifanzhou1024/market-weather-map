from __future__ import annotations

import calendar
import html
import json
import re
from datetime import date, datetime, timezone
from typing import Any, Callable

from scripts.shared.io import download_text


FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
BEA_SCHEDULE_URL = "https://www.bea.gov/news/schedule"
CENSUS_CALENDAR_URL = "https://www.census.gov/economic-indicators/calendar-listview.html"
TREASURY_AUCTIONS_API_URL = (
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query"
    "?sort=-auction_date&page[size]=10000"
)
TREASURY_AUCTIONS_SOURCE_URL = "https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/"

MONTH_BY_NAME = {month: index for index, month in enumerate(calendar.month_name) if month}


def _clean_text(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", value)
    return " ".join(html.unescape(without_tags).split())


def _parse_time_12h(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.strip().upper().split())
    if not normalized:
        return None
    try:
        return datetime.strptime(normalized, "%I:%M %p").strftime("%H:%M")
    except ValueError:
        return None


def _parse_month_day(value: str, *, default_year: int) -> date | None:
    match = re.search(r"([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?", value)
    if not match:
        return None
    month_name, day, explicit_year = match.groups()
    month = MONTH_BY_NAME.get(month_name)
    if month is None:
        return None
    year = int(explicit_year) if explicit_year else default_year
    try:
        return date(year, month, int(day))
    except ValueError:
        return None


def _event(
    *,
    event_id: str,
    title: str,
    category: str,
    importance: str,
    source: str,
    source_url: str,
    event_date: date,
    event_time: str | None,
    notes: str,
) -> dict[str, Any]:
    return {
        "id": event_id,
        "title": title,
        "category": category,
        "importance": importance,
        "source": source,
        "source_url": source_url,
        "date": event_date.isoformat(),
        "time": event_time,
        "timezone": "America/New_York",
        "status": "scheduled",
        "notes": f"{notes} Descriptive event context only; not scored.",
    }


def parse_bea_schedule_events(html_text: str, *, as_of: date) -> dict[str, dict[str, Any]]:
    rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", html_text, flags=re.IGNORECASE | re.DOTALL)
    matches: list[tuple[date, str | None, str]] = []
    for row in rows:
        date_match = re.search(r'class="[^"]*release-date[^"]*"[^>]*>(.*?)</', row, flags=re.IGNORECASE | re.DOTALL)
        title_match = re.search(r'class="[^"]*release-title[^"]*"[^>]*>(.*?)</td>', row, flags=re.IGNORECASE | re.DOTALL)
        if not date_match or not title_match:
            continue
        event_date = _parse_month_day(_clean_text(date_match.group(1)), default_year=as_of.year)
        if event_date is None or event_date < as_of:
            continue
        time_match = re.search(r"<small\b[^>]*>(.*?)</small>", row, flags=re.IGNORECASE | re.DOTALL)
        event_time = _parse_time_12h(_clean_text(time_match.group(1)) if time_match else None)
        matches.append((event_date, event_time, _clean_text(title_match.group(1))))

    events: dict[str, dict[str, Any]] = {}
    for event_date, event_time, title in sorted(matches, key=lambda item: item[0]):
        if "Personal Income and Outlays" in title and "personal_income_outlays_pce" not in events:
            events["personal_income_outlays_pce"] = _event(
                event_id="personal_income_outlays_pce",
                title="Personal Income and Outlays/PCE",
                category="inflation",
                importance="high",
                source="BEA",
                source_url=BEA_SCHEDULE_URL,
                event_date=event_date,
                event_time=event_time or "08:30",
                notes=f"Official BEA schedule row: {title}.",
            )
        if re.search(r"\bGDP\b|Gross Domestic Product", title) and "gross_domestic_product" not in events:
            events["gross_domestic_product"] = _event(
                event_id="gross_domestic_product",
                title="Gross Domestic Product",
                category="growth",
                importance="high",
                source="BEA",
                source_url=BEA_SCHEDULE_URL,
                event_date=event_date,
                event_time=event_time or "08:30",
                notes=f"Official BEA schedule row: {title}.",
            )
    return events


def parse_census_schedule_events(html_text: str, *, as_of: date) -> dict[str, dict[str, Any]]:
    rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", html_text, flags=re.IGNORECASE | re.DOTALL)
    matches: list[tuple[date, str | None, str]] = []
    for row in rows:
        title_match = re.search(r"<a\b[^>]*>(.*?)</a>", row, flags=re.IGNORECASE | re.DOTALL)
        date_match = re.search(r'<td\b[^>]*sorttable_customkey="(\d{12})"[^>]*>(.*?)</td>', row, flags=re.IGNORECASE | re.DOTALL)
        if not title_match or not date_match:
            continue
        sort_key, display_date = date_match.groups()
        try:
            event_date = datetime.strptime(sort_key[:8], "%Y%m%d").date()
            event_time = datetime.strptime(sort_key[8:], "%H%M").strftime("%H:%M")
        except ValueError:
            event_date = _parse_month_day(_clean_text(display_date), default_year=as_of.year)
            event_time = None
        if event_date is None or event_date < as_of:
            continue
        matches.append((event_date, event_time, _clean_text(title_match.group(1))))

    events: dict[str, dict[str, Any]] = {}
    for event_date, event_time, title in sorted(matches, key=lambda item: item[0]):
        if "Retail" in title and "retail_sales" not in events:
            events["retail_sales"] = _event(
                event_id="retail_sales",
                title="Advance Monthly Retail Trade",
                category="growth",
                importance="high",
                source="Census",
                source_url=CENSUS_CALENDAR_URL,
                event_date=event_date,
                event_time=event_time or "08:30",
                notes=f"Official Census economic indicators calendar row: {title}.",
            )
        if "New Residential Construction" in title and "new_residential_construction" not in events:
            events["new_residential_construction"] = _event(
                event_id="new_residential_construction",
                title="New Residential Construction",
                category="housing",
                importance="medium",
                source="Census",
                source_url=CENSUS_CALENDAR_URL,
                event_date=event_date,
                event_time=event_time or "08:30",
                notes=f"Official Census economic indicators calendar row: {title}.",
            )
    return events


def _parse_fomc_day(value: str) -> int | None:
    numbers = re.findall(r"\d{1,2}", value)
    if not numbers:
        return None
    return int(numbers[-1])


def parse_fomc_meeting_events(html_text: str, *, as_of: date) -> dict[str, dict[str, Any]]:
    year_markers = [
        (int(match.group(1)), match.start())
        for match in re.finditer(r"(\d{4})\s+FOMC\s+Meetings", html_text, flags=re.IGNORECASE)
    ]
    if not year_markers:
        return {}

    candidates: list[date] = []
    for index, (year, start) in enumerate(year_markers):
        end = year_markers[index + 1][1] if index + 1 < len(year_markers) else len(html_text)
        section = html_text[start:end]
        meetings = re.findall(
            r'fomc-meeting__month[^>]*>(.*?)</.*?fomc-meeting__date[^>]*>(.*?)</',
            section,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not meetings:
            meetings = re.findall(
                r'fomc-meeting[^>]*>.*?([A-Za-z]+).*?(\d{1,2}(?:-\d{1,2})?\*?)',
                section,
                flags=re.IGNORECASE | re.DOTALL,
            )
        for month_text, day_text in meetings:
            month = MONTH_BY_NAME.get(_clean_text(month_text))
            day = _parse_fomc_day(_clean_text(day_text))
            if month is None or day is None:
                continue
            try:
                event_date = date(year, month, day)
            except ValueError:
                continue
            if event_date >= as_of:
                candidates.append(event_date)

    if not candidates:
        return {}
    next_meeting = sorted(candidates)[0]
    return {
        "fomc_meeting": _event(
            event_id="fomc_meeting",
            title="FOMC Meeting",
            category="rates",
            importance="high",
            source="Federal Reserve",
            source_url=FOMC_CALENDAR_URL,
            event_date=next_meeting,
            event_time="14:00",
            notes="Official Federal Reserve FOMC calendar date.",
        )
    }


def parse_treasury_auction_events(rows: list[dict[str, Any]], *, as_of: date) -> dict[str, dict[str, Any]]:
    candidates: list[tuple[date, dict[str, Any]]] = []
    for row in rows:
        raw_date = row.get("auction_date")
        if not isinstance(raw_date, str):
            continue
        try:
            auction_date = date.fromisoformat(raw_date)
        except ValueError:
            continue
        if auction_date >= as_of:
            candidates.append((auction_date, row))
    if not candidates:
        return {}

    auction_date, row = sorted(candidates, key=lambda item: item[0])[0]
    security_term = str(row.get("security_term") or "").strip()
    security_type = str(row.get("security_type") or "").strip()
    amount = str(row.get("offering_amt") or "").strip()
    description = " ".join(part for part in (security_term, security_type) if part)
    amount_note = f" offering amount {amount}" if amount else ""
    notes = f"Official FiscalData auction query row for {description or 'Treasury security'}{amount_note}."
    return {
        "treasury_auctions": _event(
            event_id="treasury_auctions",
            title="Treasury Auctions",
            category="rates",
            importance="medium",
            source="FiscalData",
            source_url=TREASURY_AUCTIONS_SOURCE_URL,
            event_date=auction_date,
            event_time=None,
            notes=notes,
        )
    }


def fetch_treasury_auction_rows(fetch_text: Callable[[str], str] = download_text) -> list[dict[str, Any]]:
    payload = json.loads(fetch_text(TREASURY_AUCTIONS_API_URL))
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise ValueError("FiscalData auction response does not contain a data list")
    return [row for row in rows if isinstance(row, dict)]


def fetch_official_event_overlays(
    *,
    as_of: date | None = None,
    fetch_text: Callable[[str], str] = download_text,
) -> dict[str, dict[str, Any]]:
    as_of_date = as_of or datetime.now(timezone.utc).date()
    events: dict[str, dict[str, Any]] = {}

    for parser, url in (
        (parse_bea_schedule_events, BEA_SCHEDULE_URL),
        (parse_census_schedule_events, CENSUS_CALENDAR_URL),
        (parse_fomc_meeting_events, FOMC_CALENDAR_URL),
    ):
        try:
            events.update(parser(fetch_text(url), as_of=as_of_date))
        except Exception:
            continue

    try:
        events.update(parse_treasury_auction_events(fetch_treasury_auction_rows(fetch_text), as_of=as_of_date))
    except Exception:
        pass

    return events
