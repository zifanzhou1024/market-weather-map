import json
from pathlib import Path

REGISTRY = Path("public/data/catalog/source_registry.json")
EXPECTED_RECLASSIFICATION = {
    "cboe":              "free_public_active",
    "cboe_futures":      "terms_review_needed",
    "cboe_options":      "terms_review_needed",
    "cftc":              "free_public_active",
    "derived":           "free_public_active",
    "economic_calendar": "terms_review_needed",
    "fiscaldata":        "free_public_active",
    "fred":              "free_public_active",
    "ice_indices":       "restricted_vendor",
    "occ":               "terms_review_needed",
    "terms_review":      "terms_review_needed",
    "treasury_calendar": "terms_review_needed",
    "unavailable":       "unavailable",
}

EXPECTED_NEW_ENTRIES = {
    "bea":              "free_public_active",
    "bls":              "free_public_active",
    "multpl_shiller":   "free_public_active",
    "ny_fed":           "free_public_candidate",
    "naaim":            "terms_review_needed",
    "aaii":             "terms_review_needed",
    "tradingview":      "authenticated_candidate",
}


def test_registry_has_all_expected_entries():
    data = json.loads(REGISTRY.read_text())
    expected_ids = set(EXPECTED_RECLASSIFICATION) | set(EXPECTED_NEW_ENTRIES)
    assert set(data) == expected_ids


def test_registry_access_status_values():
    data = json.loads(REGISTRY.read_text())
    for entry_id, expected_status in {**EXPECTED_RECLASSIFICATION, **EXPECTED_NEW_ENTRIES}.items():
        assert data[entry_id]["access_status"] == expected_status, entry_id


def test_registry_has_all_new_flags():
    data = json.loads(REGISTRY.read_text())
    for entry_id, entry in data.items():
        assert "requires_secret" in entry, entry_id
        assert "active_scoring_allowed" in entry, entry_id
        assert "public_redistribution_allowed" in entry, entry_id


def test_registry_tradingview_requires_secret():
    data = json.loads(REGISTRY.read_text())
    assert data["tradingview"]["requires_secret"] is True
    assert data["tradingview"]["active_scoring_allowed"] is False
    assert data["tradingview"]["public_redistribution_allowed"] is False


def test_registry_ice_indices_restricted():
    data = json.loads(REGISTRY.read_text())
    assert data["ice_indices"]["access_status"] == "restricted_vendor"
    assert data["ice_indices"]["active_scoring_allowed"] is False


def test_registry_derivation_consistency():
    expected_active = {"free_public_active", "proxy_only"}
    data = json.loads(REGISTRY.read_text())
    for entry_id, entry in data.items():
        if entry["access_status"] in expected_active:
            assert entry["active_scoring_allowed"] is True, entry_id
        else:
            assert entry["active_scoring_allowed"] is False, entry_id
