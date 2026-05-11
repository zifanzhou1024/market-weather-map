import json
from pathlib import Path

CATALOG = Path("public/data/catalog/series_catalog.json")


EXPECTED = {
    "personal_saving_rate": ("free_public_active", "bea"),
    "cape_ratio": ("free_public_active", "multpl_shiller"),
}


def test_official_source_entries_present():
    entries = {e["id"]: e for e in json.loads(CATALOG.read_text())}
    for series_id, (access, provider) in EXPECTED.items():
        assert series_id in entries, series_id
        assert entries[series_id]["access_status"] == access
        assert entries[series_id]["provider_id"] == provider
