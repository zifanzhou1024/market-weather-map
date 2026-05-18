"""Priority-merge / tie-break behavior tests for build_cockpit.

Verifies the documented selection ordering: priority desc, importance desc,
id asc. Fixture layout mirrors the real public/data/ tree (derived/, status/,
series/ subdirs) used by build_cockpit_payload after the Task 1.4 layout fix.
"""

import json

from scripts.transform.build_cockpit import build_cockpit_payload


def _multi_signal_inputs(tmp_path):
    """Fixture: multiple whitelist signals available, with intentional ties.

    - inflation (priority_key="inflation", priority 100, importance 5)
    - credit_spreads (priority_key="credit_spreads", priority 100, importance 4)
    - labor_claims + payrolls (both share priority_key="labor", priority 50,
      importance 5) — same (priority, importance), so tie-break is by id asc.
      Only initial_claims series is supplied below; nonfarm_payrolls is omitted
      so payrolls drops out as unavailable. The id-asc assertion is conditional
      to keep this resilient if a future change adds payrolls back in.
    """
    derived = tmp_path / "derived"
    derived.mkdir()
    series = tmp_path / "series"
    series.mkdir()
    status_dir = tmp_path / "status"
    status_dir.mkdir()

    (derived / "signal_priority.json").write_text(json.dumps({
        "top_warnings": [
            {"id": "inflation", "priority": 100.0, "importance": 5, "why_it_matters": ""},
            {"id": "credit_spreads", "priority": 100.0, "importance": 4, "why_it_matters": ""},
        ],
        "top_supports": [
            {"id": "labor", "priority": 50.0, "importance": 5, "why_it_matters": ""},
        ],
        "missing_high_value_signals": [],
        "overall_read": {},
    }))
    # core_cpi needs ~12mo of monthly observations because the cockpit
    # whitelist applies value_transform="yoy_pct" to that series; without
    # a year of history the YoY transform drops every row and the entry
    # falls out of vital_signs. Use 24 monthly stamps to stay on the safe
    # side of the 11-13mo lookback window.
    cpi_obs = []
    for year in (2024, 2025, 2026):
        for month in range(1, 13):
            if year == 2026 and month > 5:
                break
            cpi_obs.append({
                "date": f"{year}-{month:02d}-01",
                "value": 300.0 + (year - 2024) * 12 + month,
            })
    (series / "core_cpi.json").write_text(json.dumps({
        "series_id": "core_cpi",
        "observations": cpi_obs,
    }))
    for sid in ("high_yield_oas", "initial_claims"):
        (series / f"{sid}.json").write_text(json.dumps({
            "series_id": sid,
            "observations": [
                {"date": f"2026-05-{d:02d}", "value": d * 1.0}
                for d in range(1, 16)
            ],
        }))
    (derived / "score_summary.json").write_text(json.dumps({
        "date": "2026-05-15",
        "scores": {sid: {"score": 0, "label": "M", "confidence": 1,
                         "bucket_scores": {}, "bucket_weights": {},
                         "top_supports": [], "top_risks": [],
                         "recent_changes": [], "missing_or_stale_notes": [],
                         "confidence_reasons": []}
                   for sid in ("market_weather", "macro_climate", "fragility")},
    }))
    (derived / "regime_snapshot.json").write_text(json.dumps({"regime": {"label": "X"}}))
    (status_dir / "data_status.json").write_text(json.dumps({"series": {
        "core_cpi": {"status": "ok"},
        "high_yield_oas": {"status": "ok"},
        "initial_claims": {"status": "ok"},
    }}))
    return tmp_path


def test_tie_breaks_by_importance_then_id(tmp_path):
    payload = build_cockpit_payload(_multi_signal_inputs(tmp_path))
    vs_ids = [v["id"] for v in payload["vital_signs"]]
    # inflation (priority 100, importance 5) > credit_spreads (priority 100,
    # importance 4) > labor_claims (priority 50, importance 5).
    assert vs_ids.index("inflation") < vs_ids.index("credit_spreads")
    assert vs_ids.index("credit_spreads") < vs_ids.index("labor_claims")
    # Alphabetical tiebreak: labor_claims < payrolls if both appear.
    if "payrolls" in vs_ids:
        assert vs_ids.index("labor_claims") < vs_ids.index("payrolls")
