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


# ---------------------------------------------------------------------------
# Layer 3 defense-in-depth: every candidate-class AccessStatus enum value
# must trigger CandidateIsolationError when leaked into a signal_priority
# primary slot. One intentional-leak fixture per enum value proves the
# validator catches every class — not just the canonical ``free_public_candidate``
# case already exercised above.
# ---------------------------------------------------------------------------


LEAK_CASES = [
    ("free_public_candidate", "put_call_total_candidate"),
    ("terms_review_needed", "naaim_exposure_candidate"),
    ("authenticated_candidate", "tradingview_move_candidate"),
    ("restricted_vendor", "move_index"),
    ("unavailable", "synthetic_unavailable_series"),
]


@pytest.mark.parametrize("access_status,series_id", LEAK_CASES)
def test_isolation_catches_every_candidate_class(
    tmp_path: Path, monkeypatch, access_status: str, series_id: str
):
    catalog = tmp_path / "catalog"
    derived = tmp_path / "derived"
    catalog.mkdir()
    derived.mkdir()
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)

    (catalog / "series_catalog.json").write_text(json.dumps([
        {
            "id": series_id,
            "access_status": access_status,
            "active_scoring_allowed": False,
            "public_redistribution_allowed": False,
            "requires_secret": access_status == "authenticated_candidate",
            "score_status": "candidate",
            "provider_id": "test_provider",
        }
    ]))
    (derived / "signal_priority.json").write_text(json.dumps({
        "top_warnings": [{"id": series_id, "source_status": access_status}],
        "top_supports": [],
        "missing_high_value_signals": [],
    }))

    with pytest.raises(CandidateIsolationError) as exc:
        validate_isolation()
    assert series_id in str(exc.value)
    assert "signal_priority.json" in str(exc.value)
