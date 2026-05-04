from scripts.shared.source_registry import source_registry_entries


def test_source_registry_describes_provider_access_and_terms():
    registry = source_registry_entries()

    assert registry["fred"] == {
        "name": "Federal Reserve Economic Data",
        "base_url": "https://fred.stlouisfed.org",
        "requires_secret": False,
        "access_status": "free_public",
        "terms_status": "review_each_series",
        "update_cadence": "varies_by_series",
        "notes": "FRED graph CSV endpoints do not require secrets; hosted series can carry source-specific citation or redistribution requirements.",
    }
    assert registry["cboe"]["access_status"] == "free_public"
    assert registry["cftc"]["requires_secret"] is False
    assert registry["terms_review"]["access_status"] == "terms_review_needed"
    assert registry["unavailable"]["access_status"] == "unavailable"
