import json
from pathlib import Path

import pytest

from scripts.validate.validate_schema import (
    SchemaError,
    check_access_status_enum,
)


@pytest.fixture
def tmp_catalog(tmp_path: Path, monkeypatch) -> Path:
    catalog = tmp_path / "catalog"
    catalog.mkdir()
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    return catalog


def _write_registry(catalog_dir: Path, entries: dict) -> None:
    (catalog_dir / "source_registry.json").write_text(json.dumps(entries))


def _write_series(catalog_dir: Path, entries: list) -> None:
    (catalog_dir / "series_catalog.json").write_text(json.dumps(entries))


VALID_REGISTRY_ENTRY = {
    "fred": {
        "access_status": "free_public_active",
        "active_scoring_allowed": True,
        "public_redistribution_allowed": True,
        "requires_secret": False,
        "name": "FRED",
        "base_url": "https://fred.stlouisfed.org",
        "notes": "...",
        "terms_status": "ok",
        "update_cadence": "daily",
    }
}

VALID_SERIES_ENTRY = {
    "id": "vix",
    "access_status": "free_public_active",
    "active_scoring_allowed": True,
    "public_redistribution_allowed": True,
    "requires_secret": False,
    "score_status": "active",
    "provider_id": "cboe",
}


def test_access_status_enum_passes_for_valid_entry(tmp_catalog: Path):
    _write_registry(tmp_catalog, VALID_REGISTRY_ENTRY)
    _write_series(tmp_catalog, [VALID_SERIES_ENTRY])
    check_access_status_enum()


def test_access_status_enum_fails_for_legacy_value(tmp_catalog: Path):
    bad = {**VALID_REGISTRY_ENTRY["fred"], "access_status": "free_public"}
    _write_registry(tmp_catalog, {"fred": bad})
    _write_series(tmp_catalog, [VALID_SERIES_ENTRY])
    with pytest.raises(SchemaError) as exc:
        check_access_status_enum()
    assert "free_public" in str(exc.value)


def test_access_status_enum_fails_when_active_scoring_allowed_inconsistent(tmp_catalog: Path):
    bad = {**VALID_REGISTRY_ENTRY["fred"], "access_status": "free_public_candidate", "active_scoring_allowed": True}
    _write_registry(tmp_catalog, {"fred": bad})
    _write_series(tmp_catalog, [VALID_SERIES_ENTRY])
    with pytest.raises(SchemaError) as exc:
        check_access_status_enum()
    assert "active_scoring_allowed" in str(exc.value)


def test_access_status_enum_fails_when_required_flags_missing(tmp_catalog: Path):
    bad = {"fred": {"access_status": "free_public_active", "name": "FRED"}}
    _write_registry(tmp_catalog, bad)
    _write_series(tmp_catalog, [VALID_SERIES_ENTRY])
    with pytest.raises(SchemaError) as exc:
        check_access_status_enum()
    msg = str(exc.value).lower()
    assert "requires_secret" in msg or "active_scoring_allowed" in msg or "public_redistribution_allowed" in msg
