import json
from pathlib import Path

CATALOG = Path("public/data/catalog/series_catalog.json")

EXPECTED_PHASE_A_CANDIDATES = {
    "put_call_total_candidate":     ("free_public_candidate", "cboe_options"),
    "put_call_index_candidate":     ("free_public_candidate", "cboe_options"),
    "put_call_equity_candidate":    ("free_public_candidate", "cboe_options"),
    "put_call_vix_candidate":       ("free_public_candidate", "cboe_options"),
    "put_call_spxw_candidate":      ("free_public_candidate", "cboe_options"),
    "vx1_candidate":                ("free_public_candidate", "cboe_futures"),
    "vx2_candidate":                ("free_public_candidate", "cboe_futures"),
    "vx3_candidate":                ("free_public_candidate", "cboe_futures"),
    "vx_front_spread_candidate":    ("free_public_candidate", "cboe_futures"),
    "vx_contango_score_candidate":  ("free_public_candidate", "cboe_futures"),
    "naaim_exposure_candidate":     ("terms_review_needed",   "naaim"),
    "aaii_sentiment_candidate":     ("terms_review_needed",   "aaii"),
}


def test_all_phase_a_candidate_entries_present():
    entries = {e["id"]: e for e in json.loads(CATALOG.read_text())}
    for series_id, (expected_access, expected_provider) in EXPECTED_PHASE_A_CANDIDATES.items():
        assert series_id in entries, series_id
        assert entries[series_id]["access_status"] == expected_access, series_id
        assert entries[series_id]["provider_id"] == expected_provider, series_id
        assert entries[series_id]["active_scoring_allowed"] is False, series_id
