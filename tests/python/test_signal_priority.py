"""Tests for the signal-priority transform.

The signal-priority engine ranks the most important active warnings, the most
important active supports, and the high-value signals that are unavailable
because their source is gated. It reads the existing score summary, shock-risk
snapshot, regime snapshot, and per-series freshness status and emits a
descriptive snapshot under public/data/derived/signal_priority.json.
"""
from __future__ import annotations

import json

import pytest

from scripts.transform import build_signal_priority
from scripts.validate import validate_schema


def _score_family(
    *,
    label: str,
    score: float,
    bucket_scores: dict[str, float],
    confidence: float = 1.0,
) -> dict[str, object]:
    return {
        "bucket_scores": bucket_scores,
        "bucket_weights": {key: 1.0 for key in bucket_scores},
        "confidence": confidence,
        "confidence_breakdown": {
            "coverage_confidence": 1.0,
            "freshness_confidence": confidence,
            "model_confidence": 1.0,
            "overall_confidence": confidence,
            "source_confidence": 1.0,
        },
        "confidence_reasons": [],
        "label": label,
        "missing_or_stale_notes": [],
        "recent_changes": [],
        "score": score,
        "source_coverage": {
            "available": [],
            "coverage_ratio": 1.0,
            "expected": [],
            "groups": {},
            "missing": [],
        },
        "top_risks": [],
        "top_supports": [],
    }


def _score_summary(scores: dict[str, dict[str, object]]) -> dict[str, object]:
    return {
        "conflicting_signals": [],
        "data_quality": {
            "coverage_confidence": 1.0,
            "freshness_confidence": 1.0,
            "model_confidence": 1.0,
            "overall_confidence": 1.0,
            "reasons": [],
            "source_confidence": 1.0,
        },
        "date": "2026-05-07",
        "generated_at_utc": "2026-05-08T00:17:53Z",
        "method_version": "phase5-pr4-strategic-macro-completeness-v1",
        "scores": scores,
    }


def _shock_snapshot(
    *,
    label: str = "Contained shock risk",
    score: float = 21.98,
    source_gaps: list[dict[str, str]] | None = None,
    active_signals: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "active_signals": active_signals or [],
        "date": "2026-05-07",
        "generated_at_utc": "2026-05-08T00:17:53Z",
        "label": label,
        "method_version": "phase5-shock-risk-v1",
        "mismatch_warnings": [],
        "score": score,
        "source_gaps": source_gaps
        or [
            {
                "id": "move_index",
                "label": "MOVE Index",
                "message": "Candidate source requires access or terms review before scoring.",
                "status": "terms_review_needed",
            },
            {
                "id": "skew_index",
                "label": "SKEW Index",
                "message": "Candidate source requires access or terms review before scoring.",
                "status": "terms_review_needed",
            },
        ],
    }


def _regime_snapshot(label: str = "Mixed") -> dict[str, object]:
    return {
        "checklist": [],
        "confirmations": [],
        "date": "2026-05-07",
        "generated_at_utc": "2026-05-08T00:17:53Z",
        "method_version": "phase5-horizon-regime-v1",
        "quadrant_trail": [],
        "regime": {
            "dollar_direction": "down",
            "label": label,
            "nominal_yield_direction": "flat",
            "tips_direction": "flat",
            "yield_driver": "mixed",
        },
        "yield_decomposition": [],
    }


def _status(overrides: dict[str, dict[str, object]] | None = None) -> dict[str, dict[str, object]]:
    base = {
        "vix": {"status": "ok", "last_observation": "2026-05-06"},
        "vvix": {"status": "ok", "last_observation": "2026-05-07"},
        "vix9d": {"status": "ok", "last_observation": "2026-05-07"},
        "vix3m": {"status": "ok", "last_observation": "2026-05-07"},
        "vix9d_vix_ratio": {"status": "ok", "last_observation": "2026-05-06"},
        "vix_vix3m_ratio": {"status": "ok", "last_observation": "2026-05-06"},
        "high_yield_oas": {"status": "ok", "last_observation": "2026-05-06"},
        "investment_grade_oas": {"status": "ok", "last_observation": "2026-05-06"},
        "bbb_oas": {"status": "ok", "last_observation": "2026-05-06"},
        "real_yield_10y": {"status": "ok", "last_observation": "2026-05-06"},
        "broad_dollar": {"status": "ok", "last_observation": "2026-05-01"},
        "net_liquidity": {"status": "ok", "last_observation": "2026-05-06"},
        "reverse_repo": {"status": "ok", "last_observation": "2026-05-07"},
        "sofr": {"status": "ok", "last_observation": "2026-05-06"},
        "commodity_inflation_impulse": {"status": "ok", "last_observation": "2026-05-07"},
        "breakeven_10y": {"status": "ok", "last_observation": "2026-05-07"},
        "cftc_sp500_lev_money_net": {"status": "ok", "last_observation": "2026-04-28"},
        "cftc_sp500_asset_mgr_net": {"status": "ok", "last_observation": "2026-04-28"},
        "cfnai": {"status": "ok", "last_observation": "2026-03-01"},
        "cfnai_3m_avg": {"status": "ok", "last_observation": "2026-03-01"},
        "nonfarm_payrolls": {"status": "ok", "last_observation": "2026-03-01"},
        "unemployment_rate": {"status": "ok", "last_observation": "2026-03-01"},
        "initial_claims": {"status": "ok", "last_observation": "2026-05-02"},
        "sahm_rule": {"status": "ok", "last_observation": "2026-03-01"},
        "headline_cpi": {"status": "ok", "last_observation": "2026-03-01"},
        "core_cpi": {"status": "ok", "last_observation": "2026-03-01"},
        "core_pce": {"status": "ok", "last_observation": "2026-03-01"},
        "ppi_final_demand": {"status": "ok", "last_observation": "2026-03-01"},
        "household_debt_service_ratio": {"status": "stale", "last_observation": "2025-10-01"},
        "consumer_debt_service_ratio": {"status": "stale", "last_observation": "2025-10-01"},
        "credit_card_delinquency_rate": {"status": "stale", "last_observation": "2025-10-01"},
        "housing_starts": {"status": "ok", "last_observation": "2026-03-01"},
        "building_permits": {"status": "ok", "last_observation": "2026-03-01"},
        "mortgage_rate_30y": {"status": "ok", "last_observation": "2026-05-07"},
        "move_index": {"status": "terms_review_needed", "last_observation": None},
        "skew_index": {"status": "terms_review_needed", "last_observation": None},
        "put_call_total": {"status": "terms_review_needed", "last_observation": None},
        "put_call_spxw": {"status": "terms_review_needed", "last_observation": None},
        "vx1": {"status": "terms_review_needed", "last_observation": None},
        "term_premium_acm_10y": {"status": "terms_review_needed", "last_observation": None},
        "sp500_index": {"status": "terms_review_needed", "last_observation": None},
    }
    if overrides:
        for key, value in overrides.items():
            base[key] = {**base.get(key, {}), **value}
    return base


def _baseline_inputs(**overrides: object) -> dict[str, object]:
    score_summary = _score_summary(
        {
            "market_weather": _score_family(
                label="Mixed",
                score=7.18,
                bucket_scores={
                    "commodities_inflation_impulse": -48.26,
                    "credit_spreads": 62.3,
                    "dollar_global": 76.98,
                    "liquidity_funding": -27.61,
                    "rates_real_yields": -33.34,
                    "sentiment_positioning": -30.15,
                    "volatility_tail_risk": 23.94,
                },
            ),
            "macro_climate": _score_family(
                label="Mixed",
                score=14.44,
                bucket_scores={
                    "consumer_balance_sheet": 39.53,
                    "consumer_production": 66.67,
                    "growth": 41.66,
                    "housing": -0.96,
                    "inflation": -100.0,
                    "labor": 65.39,
                    "real_yields": -33.34,
                },
                confidence=0.99,
            ),
            "fragility": _score_family(
                label="Low Fragility",
                score=39.47,
                bucket_scores={
                    "credit_spread_widening": 86.5,
                    "dollar_spike": 76.98,
                    "liquidity_drain": 19.24,
                    "positioning_crowding": -30.15,
                    "treasury_bond_volatility": 0.0,
                    "volatility_term_structure": 39.68,
                },
                confidence=0.99,
            ),
        }
    )
    inputs = {
        "score_summary": score_summary,
        "shock_snapshot": _shock_snapshot(),
        "regime_snapshot": _regime_snapshot(),
        "status": _status(),
        "generated_at_utc": "2026-05-08T00:18:00Z",
    }
    inputs.update(overrides)
    return inputs


def test_overall_read_summarises_all_three_score_families_and_regime():
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    overall = snapshot["overall_read"]
    assert overall["short_term"]["label"] == "Mixed"
    assert overall["short_term"]["score"] == pytest.approx(7.18)
    assert overall["short_term"]["confidence"] == pytest.approx(1.0)
    assert overall["long_term"]["label"] == "Mixed"
    assert overall["long_term"]["score"] == pytest.approx(14.44)
    assert overall["long_term"]["confidence"] == pytest.approx(0.99)
    assert overall["fragility"]["label"] == "Low Fragility"
    assert overall["fragility"]["score"] == pytest.approx(39.47)
    assert overall["fragility"]["confidence"] == pytest.approx(0.99)
    assert overall["regime"]["label"] == "Mixed"


def test_top_warnings_rank_high_importance_negative_buckets_first():
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    warning_ids = [item["id"] for item in snapshot["top_warnings"]]
    # real_yields and credit_spread_widening are the highest priority risks in the
    # baseline fixture. real_yields shows up via market_weather rates_real_yields
    # AND via macro_climate real_yields, which gives it the strongest priority.
    assert "real_yields" in warning_ids
    # commodity_inflation_impulse (importance 3, severity 48.26) should also surface.
    assert "commodities_inflation_impulse" in warning_ids
    # Each warning carries direction = "risk" and severity > 0.
    for entry in snapshot["top_warnings"]:
        assert entry["direction"] == "risk"
        assert entry["severity"] > 0
        assert entry["importance"] >= 1
        assert entry["priority"] > 0
    # Ordered by descending priority.
    priorities = [entry["priority"] for entry in snapshot["top_warnings"]]
    assert priorities == sorted(priorities, reverse=True)


def test_top_supports_rank_high_importance_positive_buckets_first():
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    support_ids = [item["id"] for item in snapshot["top_supports"]]
    # Credit spreads (62.3) and dollar (76.98) are the strongest supports.
    assert "credit_spreads" in support_ids
    assert "broad_dollar" in support_ids
    for entry in snapshot["top_supports"]:
        assert entry["direction"] == "support"
        assert entry["severity"] > 0
    priorities = [entry["priority"] for entry in snapshot["top_supports"]]
    assert priorities == sorted(priorities, reverse=True)


def test_missing_high_value_signals_surface_gated_sources():
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    missing_ids = {entry["id"] for entry in snapshot["missing_high_value_signals"]}
    # MOVE / SKEW come straight from shock_snapshot.source_gaps.
    assert "move_index" in missing_ids
    assert "skew_index" in missing_ids
    # put/call and VX futures surface from data_status candidate rows.
    assert "put_call_total" in missing_ids or "put_call_spxw" in missing_ids
    assert "vx_futures_curve" in missing_ids
    # SPX benchmark is the highest-importance missing equity signal; it must
    # surface to make the gap explicit on Overview and Tactical.
    assert "sp500_index" in missing_ids
    sp500_entry = next(
        entry
        for entry in snapshot["missing_high_value_signals"]
        if entry["id"] == "sp500_index"
    )
    assert sp500_entry["importance"] == 5
    assert sp500_entry["source_status"] == "terms_review_needed"
    for entry in snapshot["missing_high_value_signals"]:
        assert entry["source_status"] != "active"
        assert entry["importance"] >= 3
        assert entry["why_it_matters"]
        assert "message" in entry


def test_gated_sources_never_appear_in_active_warnings_or_supports():
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    active_ids = {item["id"] for item in snapshot["top_warnings"]}
    active_ids.update(item["id"] for item in snapshot["top_supports"])
    for gated in {
        "move_index",
        "skew_index",
        "put_call_total",
        "put_call_spxw",
        "vx_futures_curve",
        "sp500_index",
    }:
        assert gated not in active_ids


def test_freshness_status_reflects_input_status():
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    consumer_balance_sheet = next(
        (
            entry
            for entry in snapshot["top_warnings"] + snapshot["top_supports"]
            if entry["id"] == "consumer_balance_sheet"
        ),
        None,
    )
    # consumer balance-sheet inputs are stale in the fixture, so the entry must
    # surface that staleness through freshness_status.
    assert consumer_balance_sheet is not None
    assert consumer_balance_sheet["freshness_status"] == "stale"


def test_top_level_metadata_is_populated():
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    assert snapshot["date"] == "2026-05-07"
    assert snapshot["generated_at_utc"] == "2026-05-08T00:18:00Z"
    assert snapshot["method_version"].startswith("phase6-pr1-signal-priority")


def test_signal_entries_carry_full_schema_fields():
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    expected_fields = {
        "id",
        "label",
        "group",
        "category",
        "horizon",
        "importance",
        "severity",
        "priority",
        "direction",
        "urgency",
        "confidence",
        "freshness_status",
        "source_status",
        "message",
        "why_it_matters",
    }
    for entry in snapshot["top_warnings"] + snapshot["top_supports"]:
        assert expected_fields.issubset(entry.keys()), (
            f"entry {entry.get('id')} missing fields: {expected_fields - entry.keys()}"
        )

    missing_expected_fields = {
        "id",
        "label",
        "group",
        "category",
        "horizon",
        "importance",
        "source_status",
        "message",
        "why_it_matters",
    }
    for entry in snapshot["missing_high_value_signals"]:
        assert missing_expected_fields.issubset(entry.keys())


def test_warnings_capped_at_seven_entries_to_keep_first_screen_focused():
    """The signal_priority engine should cap top_warnings/top_supports to keep
    the executive view focused. Seven is the upper bound; the engine may emit
    fewer if there aren't that many active risks."""
    snapshot = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())

    assert len(snapshot["top_warnings"]) <= 7
    assert len(snapshot["top_supports"]) <= 7
    assert len(snapshot["missing_high_value_signals"]) <= 7


def test_signal_priority_is_in_required_generated_files():
    """The schema validator must require signal_priority.json so a missing file
    is caught by the gate rather than silently producing a broken UI."""
    required_paths = {path.name for path in validate_schema.REQUIRED_GENERATED_FILES}
    assert "signal_priority.json" in required_paths


def _write_signal_priority_payload(tmp_path, payload: dict) -> None:
    derived = tmp_path / "derived"
    derived.mkdir(parents=True, exist_ok=True)
    (derived / "signal_priority.json").write_text(json.dumps(payload), encoding="utf-8")


def test_validate_signal_priority_file_accepts_well_formed_snapshot(tmp_path, monkeypatch):
    payload = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())
    _write_signal_priority_payload(tmp_path, payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    validate_schema.validate_signal_priority_file()


def test_validate_signal_priority_file_rejects_missing_overall_read(tmp_path, monkeypatch):
    payload = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())
    payload.pop("overall_read")
    _write_signal_priority_payload(tmp_path, payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="overall_read"):
        validate_schema.validate_signal_priority_file()


def test_validate_signal_priority_file_rejects_signal_entry_missing_required_field(tmp_path, monkeypatch):
    payload = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())
    assert payload["top_warnings"], "fixture should produce at least one warning"
    del payload["top_warnings"][0]["why_it_matters"]
    _write_signal_priority_payload(tmp_path, payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="why_it_matters"):
        validate_schema.validate_signal_priority_file()


def test_validate_signal_priority_file_rejects_invalid_horizon(tmp_path, monkeypatch):
    payload = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())
    assert payload["top_supports"], "fixture should produce at least one support"
    payload["top_supports"][0]["horizon"] = "yesterday"
    _write_signal_priority_payload(tmp_path, payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="horizon"):
        validate_schema.validate_signal_priority_file()


def test_validate_signal_priority_file_rejects_active_entry_with_gated_source(tmp_path, monkeypatch):
    """Active warnings/supports must never carry a non-active source_status —
    the source-gating contract is the project's strongest invariant."""
    payload = build_signal_priority.build_signal_priority_snapshot(**_baseline_inputs())
    assert payload["top_warnings"], "fixture should produce at least one warning"
    payload["top_warnings"][0]["source_status"] = "terms_review_needed"
    _write_signal_priority_payload(tmp_path, payload)
    monkeypatch.setattr(validate_schema, "data_dir", lambda: tmp_path)

    with pytest.raises(ValueError, match="source_status"):
        validate_schema.validate_signal_priority_file()


# ---------------------------------------------------------------------------
# access_status gating predicate (defense layer 1)
#
# These tests exercise the new ``is_active_scoring_allowed`` predicate that
# replaces the pre-A1 ``GATED_STATUSES`` set. The predicate reads
# ``access_status`` from the catalog entry and admits only
# ``free_public_active`` and ``proxy_only``; every other AccessStatus is
# candidate-class and must be excluded from top_warnings / top_supports.
# ---------------------------------------------------------------------------


def _baseline_catalog(
    overrides: dict[str, dict[str, object]] | None = None,
) -> dict[str, dict[str, object]]:
    """Build a series_catalog dict mirroring the data_status fixture.

    Every series_id referenced by SIGNAL_CATALOG.freshness_keys is marked
    ``free_public_active`` by default so the baseline matches the
    pre-gating behaviour (all curated SIGNAL_CATALOG entries pass through).
    Tests can override individual ids to inject candidate access_status
    values and verify the predicate excludes the affected SIGNAL_CATALOG
    entry from active outputs.
    """
    active_ids = set()
    for entry in build_signal_priority.SIGNAL_CATALOG:
        active_ids.update(entry["freshness_keys"])
    catalog = {
        series_id: {
            "id": series_id,
            "access_status": "free_public_active",
            "active_scoring_allowed": True,
        }
        for series_id in active_ids
    }
    if overrides:
        for key, override in overrides.items():
            base = catalog.get(key, {"id": key})
            catalog[key] = {**base, **override}
    return catalog


def test_signal_priority_excludes_terms_review_needed_from_primary_slots():
    """A terms_review_needed series must NEVER appear in top_warnings / top_supports.

    We force every ``vix_complex`` underlying series (vix, vvix, vix9d,
    vix3m) to ``terms_review_needed`` in the synthetic catalog. The
    SIGNAL_CATALOG entry's bucket score in the baseline fixture
    (volatility_tail_risk = 23.94, a support direction) would normally
    surface vix_complex in top_supports; the gating predicate must block it.
    """
    inputs = _baseline_inputs(
        series_catalog=_baseline_catalog(
            {
                "vix": {"access_status": "terms_review_needed", "active_scoring_allowed": False},
                "vvix": {"access_status": "terms_review_needed", "active_scoring_allowed": False},
                "vix9d": {"access_status": "terms_review_needed", "active_scoring_allowed": False},
                "vix3m": {"access_status": "terms_review_needed", "active_scoring_allowed": False},
            }
        )
    )
    snapshot = build_signal_priority.build_signal_priority_snapshot(**inputs)

    active_ids = {entry["id"] for entry in snapshot["top_warnings"]}
    active_ids.update(entry["id"] for entry in snapshot["top_supports"])
    assert "vix_complex" not in active_ids, (
        "vix_complex must be excluded from primary slots when its underlying "
        "series carry access_status=terms_review_needed"
    )


def test_signal_priority_excludes_authenticated_candidate_from_primary_slots():
    """An authenticated_candidate series must NEVER appear in top_warnings / top_supports.

    authenticated_candidate is the AccessStatus reserved for sources that
    require auth (e.g. FRED API key) but have not yet been promoted via
    a source-review PR. The gating predicate must treat it as candidate-class.
    """
    inputs = _baseline_inputs(
        series_catalog=_baseline_catalog(
            {
                "high_yield_oas": {
                    "access_status": "authenticated_candidate",
                    "active_scoring_allowed": False,
                },
                "investment_grade_oas": {
                    "access_status": "authenticated_candidate",
                    "active_scoring_allowed": False,
                },
                "bbb_oas": {
                    "access_status": "authenticated_candidate",
                    "active_scoring_allowed": False,
                },
            }
        )
    )
    snapshot = build_signal_priority.build_signal_priority_snapshot(**inputs)

    active_ids = {entry["id"] for entry in snapshot["top_warnings"]}
    active_ids.update(entry["id"] for entry in snapshot["top_supports"])
    assert "credit_spreads" not in active_ids, (
        "credit_spreads must be excluded from primary slots when its underlying "
        "series carry access_status=authenticated_candidate"
    )


def test_signal_priority_includes_proxy_only_in_active_outputs():
    """proxy_only series (e.g. bond_volatility_proxy) MAY appear in top_warnings / top_supports.

    proxy_only is the AccessStatus for derived series that are
    active-scoring-eligible (active_scoring_allowed=True) without inheriting
    public redistribution rights beyond their underlying public data. The
    gating predicate must admit proxy_only just like free_public_active.

    This test verifies the predicate's inclusion side rather than the
    exclusion side: switching credit_spreads' underlying series to
    proxy_only should NOT exclude it from active outputs (compare with the
    authenticated_candidate test above which uses the same SIGNAL_CATALOG
    entry).
    """
    inputs = _baseline_inputs(
        series_catalog=_baseline_catalog(
            {
                "high_yield_oas": {
                    "access_status": "proxy_only",
                    "active_scoring_allowed": True,
                },
                "investment_grade_oas": {
                    "access_status": "proxy_only",
                    "active_scoring_allowed": True,
                },
                "bbb_oas": {
                    "access_status": "proxy_only",
                    "active_scoring_allowed": True,
                },
            }
        )
    )
    snapshot = build_signal_priority.build_signal_priority_snapshot(**inputs)

    active_ids = {entry["id"] for entry in snapshot["top_warnings"]}
    active_ids.update(entry["id"] for entry in snapshot["top_supports"])
    assert "credit_spreads" in active_ids, (
        "credit_spreads must surface in primary slots when its underlying "
        "series carry access_status=proxy_only (proxy_only is active-eligible)"
    )


def test_is_active_scoring_allowed_predicate_truth_table():
    """The predicate must admit exactly free_public_active and proxy_only.

    Pinning the truth table here makes future AccessStatus changes
    intentional: anyone adding a new enum value must either update this
    test (and the ACTIVE_ACCESS_STATUSES frozenset) or accept the
    fail-closed default.
    """
    allow = build_signal_priority.is_active_scoring_allowed
    assert allow({"access_status": "free_public_active"}) is True
    assert allow({"access_status": "proxy_only"}) is True
    assert allow({"access_status": "free_public_candidate"}) is False
    assert allow({"access_status": "terms_review_needed"}) is False
    assert allow({"access_status": "authenticated_candidate"}) is False
    assert allow({"access_status": "restricted_vendor"}) is False
    assert allow({"access_status": "unavailable"}) is False
    # Missing field fails closed.
    assert allow({}) is False
    assert allow({"access_status": None}) is False


def test_aggregate_access_status_mixed_case_proxy_wins():
    """Mixed-case rule: any underlying proxy_only forces aggregate=proxy_only.

    proxy_only is the strictest active-eligible class because it limits
    public redistribution beyond what the underlying public data already
    grants. The aggregator must surface that constraint even when only one
    of N underlying series carries proxy_only — the SignalActiveEntry it
    projects onto inherits the tightest contract.
    """
    aggregate = build_signal_priority._aggregate_access_status
    catalog = {
        "series_a": {"access_status": "proxy_only"},
        "series_b": {"access_status": "free_public_active"},
    }
    assert aggregate(catalog, ("series_a", "series_b")) == "proxy_only"
    # Order-independence: same inputs in reverse order must yield the same answer.
    assert aggregate(catalog, ("series_b", "series_a")) == "proxy_only"


def test_aggregate_access_status_all_free_public_active():
    """All free_public_active underliers project to free_public_active.

    Complements the mixed-case test above: when no underlying series
    carries the stricter proxy_only class, the aggregate stays
    free_public_active.
    """
    aggregate = build_signal_priority._aggregate_access_status
    catalog = {
        "series_a": {"access_status": "free_public_active"},
        "series_b": {"access_status": "free_public_active"},
    }
    assert aggregate(catalog, ("series_a", "series_b")) == "free_public_active"
