"""Gating tests for ``build_page_insights``.

Mirrors the A9 gating-test pattern from ``test_signal_priority.py`` but
applied to the page-insights builder. Verifies that the
:func:`scripts.shared.access_status.is_active_scoring_allowed` predicate
(via the local ``_is_primary_eligible`` adapter) is the single contract
deciding which entries may populate ``primary_warning`` /
``primary_support`` slots — and that candidate-class access_statuses are
always rejected, including ``terms_review_needed`` and
``authenticated_candidate``, while ``proxy_only`` is admitted alongside
``free_public_active``.

These tests pair the predicate-only truth table with three
integration-style cases that exercise the actual builder code path with
synthetic signal_priority payloads.
"""
from __future__ import annotations

from typing import Any

from scripts.shared.access_status import is_active_scoring_allowed
from scripts.transform import build_page_insights


# ---------------------------------------------------------------------------
# Predicate-only truth table — anchors the active-scoring contract used by
# every downstream consumer (build_signal_priority, build_page_insights,
# validate_candidate_isolation, validate_schema).
# ---------------------------------------------------------------------------


def test_predicate_allows_free_public_active():
    assert is_active_scoring_allowed({"access_status": "free_public_active"}) is True


def test_predicate_allows_proxy_only():
    assert is_active_scoring_allowed({"access_status": "proxy_only"}) is True


def test_predicate_rejects_free_public_candidate():
    assert is_active_scoring_allowed({"access_status": "free_public_candidate"}) is False


def test_predicate_rejects_terms_review_needed():
    assert is_active_scoring_allowed({"access_status": "terms_review_needed"}) is False


def test_predicate_rejects_authenticated_candidate():
    assert is_active_scoring_allowed({"access_status": "authenticated_candidate"}) is False


def test_predicate_rejects_restricted_vendor():
    assert is_active_scoring_allowed({"access_status": "restricted_vendor"}) is False


def test_predicate_rejects_unavailable():
    assert is_active_scoring_allowed({"access_status": "unavailable"}) is False


def test_predicate_fails_closed_when_field_missing():
    assert is_active_scoring_allowed({}) is False
    assert is_active_scoring_allowed({"access_status": None}) is False


# ---------------------------------------------------------------------------
# Integration tests — exercise the actual builder with synthetic
# signal_priority payloads that carry one entry per scenario. Each entry
# is fabricated; we do NOT depend on the real catalog or the real
# signal_priority output. The builder is asked to map each entry into a
# route slot, and we assert whether it admitted or rejected the entry.
# ---------------------------------------------------------------------------


def _entry(
    *,
    entry_id: str,
    direction: str,
    category: str,
    severity: float = 50.0,
    priority: float = 200.0,
    access_status: str | None = "free_public_active",
    source_status: str = "active",
) -> dict[str, Any]:
    """Build a synthetic top_warnings / top_supports entry.

    Mirrors the SignalActiveEntry shape used by build_signal_priority. The
    ``access_status`` argument is the only knob the tests below flip.
    """
    base: dict[str, Any] = {
        "id": entry_id,
        "label": entry_id.replace("_", " ").title(),
        "group": "Test group",
        "category": category,
        "horizon": "short_term",
        "importance": 5,
        "severity": severity,
        "priority": priority,
        "direction": direction,
        "urgency": "near_term",
        "confidence": 0.9,
        "freshness_status": "ok",
        "source_status": source_status,
        "message": f"{entry_id} synthetic message.",
        "why_it_matters": f"{entry_id} synthetic rationale.",
    }
    if access_status is not None:
        base["access_status"] = access_status
    return base


def _payload(
    *,
    top_warnings: list[dict[str, Any]] | None = None,
    top_supports: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
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
        "top_supports": top_supports or [],
        "top_warnings": top_warnings or [],
    }


def test_terms_review_needed_entry_is_excluded_from_primary_slots():
    """A signal carrying access_status=terms_review_needed must never
    populate primary_warning or primary_support, even when no competing
    active entry exists for the route."""
    payload = _payload(
        top_warnings=[
            _entry(
                entry_id="gated_credit_risk",
                direction="risk",
                category="credit",
                access_status="terms_review_needed",
                # Upstream gating would prevent this in production; the test
                # forces source_status="active" so we exercise the layer-1
                # defense in build_page_insights specifically.
            )
        ]
    )
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    # The credit route either is absent (no eligible signals AND no
    # freshness notes) or — if present — must NOT carry the gated entry in
    # any primary slot.
    credit = result["routes"].get("credit")
    if credit is not None:
        assert credit.get("primary_warning") is None
        assert credit.get("primary_support") is None


def test_authenticated_candidate_entry_is_excluded_from_primary_slots():
    """authenticated_candidate is the AccessStatus for sources that
    require auth but have not been promoted via a source-review PR. The
    gating predicate must reject it."""
    payload = _payload(
        top_supports=[
            _entry(
                entry_id="gated_volatility_support",
                direction="support",
                category="volatility",
                access_status="authenticated_candidate",
            )
        ]
    )
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    volatility = result["routes"].get("volatility")
    if volatility is not None:
        assert volatility.get("primary_warning") is None
        assert volatility.get("primary_support") is None


def test_proxy_only_entry_is_admitted_into_primary_slot():
    """proxy_only is active-eligible. A signal carrying
    access_status=proxy_only must surface in primary slots just like a
    free_public_active signal would."""
    payload = _payload(
        top_warnings=[
            _entry(
                entry_id="bond_volatility_proxy_risk",
                direction="risk",
                category="volatility",
                access_status="proxy_only",
            )
        ]
    )
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    volatility = result["routes"]["volatility"]
    primary = volatility.get("primary_warning")
    assert primary is not None, (
        "proxy_only signal must populate primary_warning — it is "
        "active-eligible per ACTIVE_ACCESS_STATUSES"
    )
    assert primary["id"] == "bond_volatility_proxy_risk"
    # The projected access_status flows through to the SignalRef so
    # validate_candidate_isolation / downstream consumers can apply the
    # same gating predicate without re-loading the catalog.
    assert primary.get("access_status") == "proxy_only"


def test_free_public_active_entry_is_admitted_into_primary_slot():
    """The baseline case: free_public_active is active-eligible and must
    appear in the primary slot."""
    payload = _payload(
        top_warnings=[
            _entry(
                entry_id="rates_real_yields",
                direction="risk",
                category="rates",
                access_status="free_public_active",
            )
        ]
    )
    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    rates = result["routes"]["rates"]
    primary = rates.get("primary_warning")
    assert primary is not None
    assert primary["id"] == "rates_real_yields"
    assert primary.get("access_status") == "free_public_active"


def test_entry_without_access_status_falls_back_to_source_status():
    """Pre-A10 signal_priority.json snapshots (and synthetic fixtures
    that omit access_status) must still go through the upstream
    ``source_status: "active"`` literal gate as a defense-in-depth
    fallback. An entry with source_status="active" but no access_status
    is admitted; an entry with source_status="terms_review_needed" and
    no access_status is rejected."""
    admitted = _entry(
        entry_id="legacy_active",
        direction="risk",
        category="credit",
        access_status=None,
        source_status="active",
    )
    rejected = _entry(
        entry_id="legacy_gated",
        direction="risk",
        category="liquidity",
        access_status=None,
        source_status="terms_review_needed",
    )
    payload = _payload(top_warnings=[admitted, rejected])

    result = build_page_insights.build_page_insights(
        signal_priority=payload,
        generated_at_utc="2026-05-10T09:30:00Z",
    )

    credit = result["routes"].get("credit")
    assert credit is not None
    assert credit["primary_warning"]["id"] == "legacy_active"

    liquidity = result["routes"].get("liquidity")
    if liquidity is not None:
        assert liquidity.get("primary_warning") is None
