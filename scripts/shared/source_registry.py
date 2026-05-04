from __future__ import annotations


def source_registry_entries() -> dict[str, dict[str, object]]:
    return {
        "fred": {
            "name": "Federal Reserve Economic Data",
            "base_url": "https://fred.stlouisfed.org",
            "requires_secret": False,
            "access_status": "free_public",
            "terms_status": "review_each_series",
            "update_cadence": "varies_by_series",
            "notes": "FRED graph CSV endpoints do not require secrets; hosted series can carry source-specific citation or redistribution requirements.",
        },
        "cboe": {
            "name": "Cboe Global Markets",
            "base_url": "https://www.cboe.com",
            "requires_secret": False,
            "access_status": "free_public",
            "terms_status": "ok",
            "update_cadence": "daily_market_data",
            "notes": "Cboe historical index CSV files are public and delayed; source caveats should be shown with the data.",
        },
        "cftc": {
            "name": "U.S. Commodity Futures Trading Commission",
            "base_url": "https://www.cftc.gov",
            "requires_secret": False,
            "access_status": "free_public",
            "terms_status": "ok",
            "update_cadence": "weekly",
            "notes": "Public historical compressed Commitments of Traders reports.",
        },
        "derived": {
            "name": "Derived",
            "base_url": "/data",
            "requires_secret": False,
            "access_status": "free_public",
            "terms_status": "ok",
            "update_cadence": "after_source_updates",
            "notes": "Computed from active public inputs in this repository.",
        },
        "terms_review": {
            "name": "Terms-reviewed candidate sources",
            "base_url": "",
            "requires_secret": False,
            "access_status": "terms_review_needed",
            "terms_status": "review_needed",
            "update_cadence": "not_active",
            "notes": "Useful sources that require access, terms, licensing, citation, or redistribution review before automated publication.",
        },
        "unavailable": {
            "name": "Unavailable or restricted sources",
            "base_url": "",
            "requires_secret": True,
            "access_status": "unavailable",
            "terms_status": "restricted",
            "update_cadence": "not_active",
            "notes": "Sources that are not freely automatable for this static no-secret project.",
        },
    }
