import pytest

from scripts.shared import catalog as catalog_module
from scripts.shared.catalog import governance


def test_governance_default_resolves_registry_access_status():
    # Existing callsite shape: governance("fred") with no kwargs.
    # Should pick up the registry's access_status and derive flags.
    result = governance("fred")
    assert result["access_status"] in {"free_public_active", "free_public"}  # before/after Task A3
    assert "active_scoring_allowed" in result
    assert "public_redistribution_allowed" in result
    assert "requires_secret" in result


def test_governance_explicit_access_status_overrides_registry():
    result = governance("fred", access_status="free_public_active")
    assert result["access_status"] == "free_public_active"
    assert result["score_status"] == "active"
    assert result["active_scoring_allowed"] is True
    assert result["public_redistribution_allowed"] is True
    assert result["requires_secret"] is False


def test_governance_proxy_only_allowed_for_active_scoring():
    result = governance("derived", access_status="proxy_only")
    assert result["active_scoring_allowed"] is True
    assert result["public_redistribution_allowed"] is True
    assert result["score_status"] == "active"


def test_governance_legacy_score_status_kwarg_overrides_derived():
    # Back-compat for legacy callsites that pass score_status explicitly.
    result = governance("fred", access_status="free_public_active", score_status="candidate")
    assert result["score_status"] == "candidate"  # explicit override wins


def test_governance_terms_status_and_citation_notes_preserved():
    result = governance("fred")
    # These fields must still appear (legacy callsites depend on them).
    assert "terms_status" in result
    assert "citation_notes" in result


def test_governance_derivation_table_for_every_enum_value(monkeypatch):
    # Use a fake registry so we can exercise every enum value.
    fake_registry = {
        "test_provider": {
            "access_status": "free_public",       # legacy registry value
            "terms_status": "ok",
            "notes": "test",
            "requires_secret": False,
            "name": "Test",
            "base_url": "",
            "update_cadence": "",
        }
    }
    monkeypatch.setattr(catalog_module, "source_registry_entries", lambda: fake_registry)

    cases = {
        "free_public_active":      ("active",    True,  True,  False),
        "free_public_candidate":   ("candidate", False, True,  False),
        "terms_review_needed":     ("candidate", False, False, False),
        "authenticated_candidate": ("candidate", False, False, True),
        "proxy_only":              ("active",    True,  True,  False),
        "restricted_vendor":       ("candidate", False, False, False),
        "unavailable":             ("candidate", False, False, False),
    }
    for access_status, (score, active, redist, secret) in cases.items():
        result = governance("test_provider", access_status=access_status)
        assert result["score_status"] == score, f"score_status for {access_status}"
        assert result["active_scoring_allowed"] is active, f"active_scoring_allowed for {access_status}"
        assert result["public_redistribution_allowed"] is redist, f"public_redistribution_allowed for {access_status}"
        assert result["requires_secret"] is secret, f"requires_secret for {access_status}"


def test_governance_legacy_literal_as_kwarg_resolves():
    """Legacy 4-value SourceAccessStatus values are translated when passed as the access_status kwarg.

    Required because the FRED_SERIES loop in scripts/shared/catalog.py passes
    access_status=str(series.get("access_status", "free_public")) — the literal
    "free_public" would otherwise raise ValueError after the 7-value enum migration.
    """
    legacy_result = governance("fred", access_status="free_public")
    new_result = governance("fred", access_status="free_public_active")
    # Both should resolve to free_public_active in the output.
    assert legacy_result["access_status"] == "free_public_active"
    assert new_result["access_status"] == "free_public_active"
    # And the derived flags should match.
    assert legacy_result["active_scoring_allowed"] == new_result["active_scoring_allowed"]
    assert legacy_result["public_redistribution_allowed"] == new_result["public_redistribution_allowed"]
    assert legacy_result["score_status"] == new_result["score_status"]


def test_governance_raises_for_unknown_access_status():
    """Unknown access_status values (not in DERIVATION_TABLE and not in _LEGACY_ACCESS_STATUS_MAP)
    must raise ValueError. The error message names the offending value and lists valid options."""
    with pytest.raises(ValueError, match="unknown access_status"):
        governance("fred", access_status="not_a_valid_status")
