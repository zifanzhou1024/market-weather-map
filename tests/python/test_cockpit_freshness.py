"""Freshness behavior tests for build_cockpit.

Verifies that stale signals still occupy slots, terms_review_needed status
routes the signal to candidates_not_shown (reason: "candidate"), and missing
series files cause exclusion entirely.

Fixture layout mirrors the real public/data/ tree (derived/, status/, series/
subdirs) used by build_cockpit_payload after the Task 1.4 layout fix.
"""

import json

from scripts.transform.build_cockpit import build_cockpit_payload


def _make_minimal_inputs(tmp_path, *, core_cpi_status="ok"):
    """Minimal fixture with only one whitelist signal (inflation) available."""
    derived = tmp_path / "derived"
    derived.mkdir()
    series = tmp_path / "series"
    series.mkdir()
    status_dir = tmp_path / "status"
    status_dir.mkdir()

    (derived / "signal_priority.json").write_text(json.dumps({
        "top_warnings": [{"id": "inflation", "priority": 495.0, "importance": 5,
                          "why_it_matters": ""}],
        "top_supports": [],
        "missing_high_value_signals": [],
        "overall_read": {},
    }))
    (series / "core_cpi.json").write_text(json.dumps({
        "series_id": "core_cpi",
        "observations": [
            {"date": f"2026-{m:02d}-15", "value": 3.0 + 0.01 * m}
            for m in range(1, 13)
        ],
    }))
    (derived / "score_summary.json").write_text(json.dumps({
        "date": "2026-05-15",
        "scores": {
            sid: {"score": 0, "label": "Mixed", "confidence": 0.99,
                  "bucket_scores": {}, "bucket_weights": {},
                  "top_supports": [], "top_risks": [], "recent_changes": [],
                  "missing_or_stale_notes": [], "confidence_reasons": []}
            for sid in ("market_weather", "macro_climate", "fragility")
        },
    }))
    (derived / "regime_snapshot.json").write_text(json.dumps({
        "regime": {"label": "Mixed"}
    }))
    (status_dir / "data_status.json").write_text(json.dumps({
        "series": {"core_cpi": {"status": core_cpi_status}}
    }))
    return tmp_path


def test_stale_signal_still_occupies_slot(tmp_path):
    payload = build_cockpit_payload(_make_minimal_inputs(tmp_path, core_cpi_status="stale"))
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    assert "inflation" in vs_ids
    inflation = next(v for v in payload["vital_signs"] if v["id"] == "inflation")
    assert inflation["freshness_status"] == "stale"


def test_candidate_status_excludes_from_cockpit(tmp_path):
    payload = build_cockpit_payload(
        _make_minimal_inputs(tmp_path, core_cpi_status="terms_review_needed")
    )
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    assert "inflation" not in vs_ids
    # And it lands in candidates_not_shown with reason "candidate" (Task 1.4 fix)
    not_shown = {c["id"]: c for c in payload["candidates_not_shown"]}
    assert "inflation" in not_shown
    assert not_shown["inflation"]["reason"] == "candidate"


def test_unavailable_signal_excluded(tmp_path):
    inputs = _make_minimal_inputs(tmp_path, core_cpi_status="unavailable")
    # Also delete the series file so the loader returns None.
    (inputs / "series" / "core_cpi.json").unlink()
    payload = build_cockpit_payload(inputs)
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    assert "inflation" not in vs_ids
