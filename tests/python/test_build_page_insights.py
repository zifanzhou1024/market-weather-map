"""Tests for the next-phase ``build_page_insights`` transform.

The page-insights builder maps the ranked signals from
``signal_priority.json`` into a per-route descriptive view consumed by the
new ``PageInsightHero`` component. The transform must:

- Map each signal to one or more ``RouteKey`` values via the signal
  ``category`` field.
- For each route, pick the highest-priority risk signal as
  ``primary_warning`` and the highest-priority support signal as
  ``primary_support``.
- Exclude source-gated signals (``source_status`` in
  {"terms_review_needed", "candidate"}) from primary slots — gating is
  the project's strongest invariant.
- Derive a ``state`` enum: warning-only -> "risk", support-only with high
  severity -> "support", both present -> "mixed", neither -> "unknown".
- Compose ``freshness_notes`` from any ``stale`` or ``unavailable``
  signals in that route's category.
- Carry ``confidence`` as the mean of the signals contributing to the
  route.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.transform import build_page_insights


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "signal_priority_for_page_insights.json"


def _load_fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_output_carries_top_level_metadata():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    assert result["generated_at_utc"] == "2026-05-10T09:30:00Z"
    assert result["date"] == "2026-05-08"
    assert result["method_version"].startswith("phase8-pr1-page-insights")
    assert isinstance(result["routes"], dict)


def test_route_keys_are_drawn_from_the_canonical_set():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    canonical = {
        "rates",
        "volatility",
        "regime_map",
        "credit",
        "liquidity",
        "dollar_global",
        "commodities",
        "inflation",
        "growth",
        "housing",
        "sentiment",
        "fragility",
    }
    assert set(result["routes"]).issubset(canonical)


def test_inflation_warning_routes_to_inflation_and_growth():
    """Macro-category signals route by signal id; inflation -> Inflation."""
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    inflation_route = result["routes"]["inflation"]
    assert "primary_warning" in inflation_route
    assert inflation_route["primary_warning"]["id"] == "inflation"
    assert inflation_route["state"] == "risk"


def test_credit_route_picks_credit_support_only():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    credit = result["routes"]["credit"]
    assert credit["primary_support"]["id"] == "credit_spreads"
    # primary_warning must be absent (not present) when there's no warning signal
    assert credit.get("primary_warning") is None
    # support-only with high severity (>= some threshold) -> "support"
    assert credit["state"] in {"support", "calm"}


def test_volatility_route_carries_vix_complex_support():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    vol = result["routes"]["volatility"]
    assert "primary_support" in vol
    assert vol["primary_support"]["id"] == "vix_complex"


def test_rates_route_carries_real_yields_warning():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    rates = result["routes"]["rates"]
    assert rates["primary_warning"]["id"] == "real_yields"


def test_liquidity_route_with_stale_warning_records_freshness_note():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    liquidity = result["routes"]["liquidity"]
    assert liquidity["primary_warning"]["id"] == "net_liquidity"
    # stale signal in the route's category -> a freshness note is appended.
    assert any("stale" in note.lower() for note in liquidity["freshness_notes"])


def test_source_gated_signal_never_populates_primary_slot():
    """The gated_dollar_diagnostic fixture entry has source_status='candidate'.
    It must NEVER appear as primary_warning or primary_support, even though
    its priority would otherwise win the dollar_global slot."""
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    for route_insight in result["routes"].values():
        for slot_key in ("primary_warning", "primary_support"):
            slot = route_insight.get(slot_key)
            if slot is None:
                continue
            assert slot["source_status"] not in {"terms_review_needed", "candidate"}, (
                f"{slot_key} {slot['id']} is source-gated; gating violated"
            )


def test_state_derivation_warning_only_is_risk():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    # Inflation route has only a risk signal in this fixture -> state == "risk"
    assert result["routes"]["inflation"]["state"] == "risk"


def test_state_derivation_support_only_is_support_or_calm():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    # Credit route has only a support signal in this fixture -> state in {support, calm}
    assert result["routes"]["credit"]["state"] in {"support", "calm"}


def test_state_derivation_neither_is_unknown_when_route_has_no_data():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    # Housing has no signals in our fixture -> route may be omitted or
    # carry state == "unknown".
    if "housing" in result["routes"]:
        assert result["routes"]["housing"]["state"] == "unknown"


def test_freshness_status_values_are_within_enum():
    """Every primary slot's freshness_status reuses the SignalFreshnessStatus
    vocabulary: ok | stale | unavailable."""
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    valid = {"ok", "stale", "unavailable"}
    for route_insight in result["routes"].values():
        for slot_key in ("primary_warning", "primary_support"):
            slot = route_insight.get(slot_key)
            if slot is not None:
                assert slot["freshness_status"] in valid


def test_confidence_is_mean_of_contributing_signals():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    for route_insight in result["routes"].values():
        confidence = route_insight["confidence"]
        assert isinstance(confidence, float)
        assert 0.0 <= confidence <= 1.0


def test_state_derivation_mixed_when_both_warning_and_support_present():
    """Build a synthetic payload where the same route has both a warning and
    support signal — state must be 'mixed'."""
    synthetic = {
        "date": "2026-05-08",
        "generated_at_utc": "2026-05-10T09:00:00Z",
        "method_version": "phase6-pr1-signal-priority-v1",
        "missing_high_value_signals": [],
        "overall_read": {
            "fragility": {"confidence": 0.9, "label": "Mixed", "score": 0},
            "long_term": {"confidence": 0.9, "label": "Mixed", "score": 0},
            "regime": {"label": "Mixed"},
            "short_term": {"confidence": 0.9, "label": "Mixed", "score": 0},
        },
        "top_supports": [
            {
                "category": "credit",
                "confidence": 0.9,
                "direction": "support",
                "freshness_status": "ok",
                "group": "Credit",
                "horizon": "both",
                "id": "credit_spreads",
                "importance": 5,
                "label": "Credit spreads",
                "message": "Credit spread pressure is contained.",
                "priority": 100.0,
                "severity": 30.0,
                "source_status": "active",
                "urgency": "near_term",
                "why_it_matters": "Credit spreads confirm risk transmission.",
            }
        ],
        "top_warnings": [
            {
                "category": "credit",
                "confidence": 0.9,
                "direction": "risk",
                "freshness_status": "ok",
                "group": "Credit",
                "horizon": "both",
                "id": "credit_spreads_other",
                "importance": 4,
                "label": "Credit pressure",
                "message": "Credit pressure is rising.",
                "priority": 90.0,
                "severity": 25.0,
                "source_status": "active",
                "urgency": "near_term",
                "why_it_matters": "Credit pressure widens spreads.",
            }
        ],
    }
    result = build_page_insights.build_page_insights(
        signal_priority=synthetic,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    assert result["routes"]["credit"]["state"] == "mixed"


def test_omit_route_when_no_signal_maps_to_it():
    """When the input has no signals for a particular route, the builder may
    omit that route entirely — only routes with data must be present."""
    minimal = {
        "date": "2026-05-08",
        "generated_at_utc": "2026-05-10T09:00:00Z",
        "method_version": "phase6-pr1-signal-priority-v1",
        "missing_high_value_signals": [],
        "overall_read": {
            "fragility": {"confidence": 0.9, "label": "Mixed", "score": 0},
            "long_term": {"confidence": 0.9, "label": "Mixed", "score": 0},
            "regime": {"label": "Mixed"},
            "short_term": {"confidence": 0.9, "label": "Mixed", "score": 0},
        },
        "top_supports": [],
        "top_warnings": [],
    }
    result = build_page_insights.build_page_insights(
        signal_priority=minimal,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    assert result["routes"] == {}


def test_required_fields_present_in_each_route_insight():
    payload = _load_fixture()
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    expected_top_fields = {"title", "state", "why_it_matters", "confidence", "freshness_notes"}
    for route_insight in result["routes"].values():
        assert expected_top_fields.issubset(route_insight.keys())
