from scripts.shared.catalog import catalog_entries
from scripts.shared.source_registry import source_registry_entries


def entries_by_id():
    return {str(entry["id"]): entry for entry in catalog_entries()}


def test_tactical_candidate_sources_are_gated():
    registry = source_registry_entries()

    assert registry["cboe_options"]["access_status"] == "terms_review_needed"
    assert registry["cboe_options"]["terms_status"] == "review_needed"
    assert registry["cboe_futures"]["access_status"] == "terms_review_needed"
    assert registry["economic_calendar"]["access_status"] == "terms_review_needed"


def test_put_call_candidate_catalog_rows_do_not_score():
    entries = entries_by_id()
    expected = {
        "put_call_total",
        "put_call_index",
        "put_call_equity",
        "put_call_etp",
        "put_call_vix",
        "put_call_spx",
        "put_call_spxw",
    }

    assert expected <= set(entries)
    for series_id in expected:
        entry = entries[series_id]
        assert entry["score_status"] == "candidate"
        assert entry["access_status"] == "terms_review_needed"
        assert entry["horizon"] == "tactical"
        assert "sentiment" in entry["regime_role"]


def test_vix_futures_and_event_candidates_are_gated():
    entries = entries_by_id()

    for series_id in ("vx1", "vx2", "vx3", "vx4", "vx5", "vx6", "vx7", "vx8"):
        assert entries[series_id]["score_status"] == "candidate"
        assert entries[series_id]["preferred_chart"] == "curve"

    for series_id in (
        "event_cpi",
        "event_fomc",
        "event_payrolls",
        "event_treasury_auction",
        "event_opex",
    ):
        assert entries[series_id]["score_status"] == "candidate"
        assert entries[series_id]["horizon"] == "tactical"
