import json
from pathlib import Path

SERIES = Path("public/data/catalog/series_catalog.json")
NEW_ACCESS_STATUS_VALUES = {
    "free_public_active",
    "free_public_candidate",
    "terms_review_needed",
    "authenticated_candidate",
    "proxy_only",
    "restricted_vendor",
    "unavailable",
}

OVERRIDES = {
    "sp500_index":            "terms_review_needed",
    "move_index":             "restricted_vendor",
    "skew_index":             "terms_review_needed",
    "bond_volatility_proxy":  "proxy_only",
}


def _load() -> list[dict]:
    return json.loads(SERIES.read_text())


def test_every_entry_has_new_access_status_value():
    for entry in _load():
        assert entry["access_status"] in NEW_ACCESS_STATUS_VALUES, entry.get("id")


def test_every_entry_has_new_flag_fields():
    for entry in _load():
        assert "requires_secret" in entry, entry.get("id")
        assert "active_scoring_allowed" in entry, entry.get("id")
        assert "public_redistribution_allowed" in entry, entry.get("id")


def test_score_status_alias_consistency():
    for entry in _load():
        if entry["access_status"] in {"free_public_active", "proxy_only"}:
            assert entry["score_status"] == "active", entry.get("id")
        else:
            assert entry["score_status"] == "candidate", entry.get("id")


def test_active_scoring_allowed_consistency():
    for entry in _load():
        expected = entry["access_status"] in {"free_public_active", "proxy_only"}
        assert entry["active_scoring_allowed"] is expected, entry.get("id")


def test_series_level_overrides_applied():
    by_id = {e["id"]: e for e in _load()}
    for series_id, expected in OVERRIDES.items():
        if series_id in by_id:
            assert by_id[series_id]["access_status"] == expected, series_id


def test_no_unmapped_combinations():
    for entry in _load():
        assert entry["access_status"] not in {"free_public", None, ""}, entry.get("id")
