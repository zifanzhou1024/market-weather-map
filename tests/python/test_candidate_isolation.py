import json
from pathlib import Path

import pytest

from scripts.validate.validate_candidate_isolation import (
    CandidateIsolationError,
    run as validate_isolation,
)


@pytest.fixture
def tmp_data(tmp_path: Path, monkeypatch) -> Path:
    """Return a temp data dir containing minimal valid fixtures."""
    catalog = tmp_path / "catalog"
    derived = tmp_path / "derived"
    catalog.mkdir()
    derived.mkdir()

    (catalog / "series_catalog.json").write_text(
        json.dumps([
            {
                "id": "vix",
                "access_status": "free_public_active",
                "active_scoring_allowed": True,
                "public_redistribution_allowed": True,
                "requires_secret": False,
                "score_status": "active",
                "provider_id": "cboe",
            },
            {
                "id": "put_call_total_candidate",
                "access_status": "free_public_candidate",
                "active_scoring_allowed": False,
                "public_redistribution_allowed": True,
                "requires_secret": False,
                "score_status": "candidate",
                "provider_id": "cboe_options",
            },
        ])
    )

    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    return tmp_path


def test_isolation_passes_when_no_leaks(tmp_data: Path):
    (tmp_data / "derived" / "signal_priority.json").write_text(
        json.dumps({
            "top_warnings": [{"id": "vix", "source_status": "active"}],
            "top_supports": [],
            "missing_high_value_signals": [],
        })
    )
    # No exception means pass.
    validate_isolation()


def test_isolation_fails_when_candidate_in_top_warnings(tmp_data: Path):
    (tmp_data / "derived" / "signal_priority.json").write_text(
        json.dumps({
            "top_warnings": [
                {"id": "vix", "source_status": "active"},
                {"id": "put_call_total_candidate", "source_status": "free_public_candidate"},
            ],
            "top_supports": [],
            "missing_high_value_signals": [],
        })
    )
    with pytest.raises(CandidateIsolationError) as exc:
        validate_isolation()
    assert "put_call_total_candidate" in str(exc.value)
    assert "signal_priority.json" in str(exc.value)


def test_isolation_fails_when_candidate_in_page_insights_primary(tmp_data: Path):
    # signal_priority is clean ...
    (tmp_data / "derived" / "signal_priority.json").write_text(
        json.dumps({"top_warnings": [], "top_supports": [], "missing_high_value_signals": []})
    )
    # ... but page_insights primary_warning references a candidate id.
    (tmp_data / "derived" / "page_insights.json").write_text(
        json.dumps({
            "routes": {
                "volatility": {
                    "primary_warning": {"id": "put_call_total_candidate"},
                }
            }
        })
    )
    with pytest.raises(CandidateIsolationError) as exc:
        validate_isolation()
    assert "put_call_total_candidate" in str(exc.value)
    assert "page_insights.json" in str(exc.value)
