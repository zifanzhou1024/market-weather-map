from scripts.shared.catalog import catalog_entries
from scripts.shared.source_registry import source_registry_entries


def entries_by_id():
    return {str(entry["id"]): entry for entry in catalog_entries()}


PUT_CALL_CANDIDATE_IDS = {
    "put_call_total",
    "put_call_index",
    "put_call_equity",
    "put_call_etp",
    "put_call_vix",
    "put_call_spx",
    "put_call_spxw",
}

VIX_FUTURES_CANDIDATE_IDS = tuple(f"vx{tenor}" for tenor in range(1, 9))

EVENT_CANDIDATE_IDS = (
    "event_cpi",
    "event_fomc",
    "event_payrolls",
    "event_treasury_auction",
    "event_opex",
)

TACTICAL_CANDIDATE_IDS = (
    *PUT_CALL_CANDIDATE_IDS,
    *VIX_FUTURES_CANDIDATE_IDS,
    *EVENT_CANDIDATE_IDS,
)

SUPPORTED_FRONTEND_FREQUENCIES = {"daily", "weekly", "monthly", "quarterly"}


def test_tactical_candidate_sources_are_gated():
    registry = source_registry_entries()

    assert registry["cboe_options"]["access_status"] == "terms_review_needed"
    assert registry["cboe_options"]["terms_status"] == "review_needed"
    assert registry["cboe_futures"]["access_status"] == "terms_review_needed"
    assert registry["economic_calendar"]["access_status"] == "terms_review_needed"


def test_put_call_candidate_catalog_rows_do_not_score():
    entries = entries_by_id()
    expected = PUT_CALL_CANDIDATE_IDS

    assert expected <= set(entries)
    for series_id in expected:
        entry = entries[series_id]
        assert entry["score_status"] == "candidate"
        assert entry["access_status"] == "terms_review_needed"
        assert entry["horizon"] == "tactical"
        assert "sentiment" in entry["regime_role"]


def test_vix_futures_and_event_candidates_are_gated():
    entries = entries_by_id()

    for series_id in VIX_FUTURES_CANDIDATE_IDS:
        assert entries[series_id]["score_status"] == "candidate"
        assert entries[series_id]["preferred_chart"] == "curve"

    for series_id in EVENT_CANDIDATE_IDS:
        assert entries[series_id]["score_status"] == "candidate"
        assert entries[series_id]["horizon"] == "tactical"


def test_tactical_candidate_frequencies_match_frontend_contract():
    entries = entries_by_id()

    for series_id in EVENT_CANDIDATE_IDS:
        assert entries[series_id]["frequency"] == "daily"

    for series_id in TACTICAL_CANDIDATE_IDS:
        assert entries[series_id]["frequency"] in SUPPORTED_FRONTEND_FREQUENCIES
