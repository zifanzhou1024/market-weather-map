"""Build the per-route ``page_insights.json`` snapshot.

Reads ``signal_priority.json`` (already produced by
``scripts.transform.build_signal_priority``) and projects its ranked
warnings/supports onto twelve canonical route keys consumed by the new
``PageInsightHero`` component.

For each route, the highest-priority risk signal becomes
``primary_warning`` and the highest-priority support signal becomes
``primary_support``. Source-gated signals
(``source_status in {terms_review_needed, candidate}``) are excluded
from primary slots — gating is the project's strongest invariant.

Tone is descriptive only; the ``why_it_matters`` text comes verbatim
from the underlying ranked signal so it inherits the existing tone
review.
"""
from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from scripts.shared.io import data_dir, utc_now_iso, write_json


METHOD_VERSION = "phase8-pr1-page-insights-v1"

# Source-gated statuses that must NEVER populate a primary slot.
GATED_STATUSES = frozenset({"terms_review_needed", "candidate"})

# Severity threshold above which a support-only route is labelled
# "support" rather than "calm".
SUPPORT_STATE_THRESHOLD = 25.0

# Twelve canonical routes consumed by PageInsightHero.
ROUTE_KEYS: tuple[str, ...] = (
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
)

ROUTE_TITLES: dict[str, str] = {
    "rates": "Rates",
    "volatility": "Volatility",
    "regime_map": "Regime map",
    "credit": "Credit",
    "liquidity": "Liquidity",
    "dollar_global": "Dollar / Global",
    "commodities": "Commodities",
    "inflation": "Inflation",
    "growth": "Growth",
    "housing": "Housing",
    "sentiment": "Sentiment",
    "fragility": "Fragility / shock risk",
}

# Macro-category signals are routed by signal id since the "macro" category
# umbrella spans growth, inflation, housing, commodities, consumer balance
# sheet, etc. The same id may map to multiple routes (e.g. labor goes to
# growth as the strategic backdrop).
MACRO_ID_TO_ROUTES: dict[str, tuple[str, ...]] = {
    "inflation": ("inflation",),
    "growth": ("growth",),
    "labor": ("growth",),
    "consumer_balance_sheet": ("growth",),
    "commodities_inflation_impulse": ("commodities",),
}

# Non-macro categories map to a tuple of routes (a category can surface in
# more than one route, e.g. volatility surfaces in both Volatility and
# Fragility, which observes the volatility complex as part of shock risk).
CATEGORY_TO_ROUTES: dict[str, tuple[str, ...]] = {
    "volatility": ("volatility", "fragility"),
    "rates": ("rates",),
    "credit": ("credit",),
    "liquidity": ("liquidity",),
    "dollar": ("dollar_global",),
    "positioning": ("sentiment",),
    # event signals don't map to any single-domain route
    "event": (),
}

# Default why_it_matters per route, used when no warning/support is present
# but freshness data still warrants the route surfacing.
DEFAULT_WHY_IT_MATTERS: dict[str, str] = {
    "rates": "Rates set the discount-rate backdrop for valuations.",
    "volatility": "Implied volatility frames near-term hedging pressure.",
    "regime_map": "The regime quadrant blends rates, dollar and risk inputs.",
    "credit": "Credit spreads confirm whether stress is spreading beyond equities.",
    "liquidity": "Net liquidity defines the funding backdrop for risk assets.",
    "dollar_global": "Dollar moves transmit global liquidity and risk-off pressure.",
    "commodities": "Commodity prices feed inflation expectations and rates.",
    "inflation": "Inflation trajectory drives Fed policy expectations.",
    "growth": "Growth conditions set the strategic backdrop for risk assets.",
    "housing": "Housing turnover signals consumer balance-sheet pressure.",
    "sentiment": "Positioning extremes amplify drawdowns when sentiment turns.",
    "fragility": "Tail-risk fragility captures cross-asset stress build-up.",
}


def _signal_routes(entry: dict[str, Any]) -> tuple[str, ...]:
    """Resolve which RouteKey(s) a ranked signal contributes to."""
    category = str(entry.get("category", ""))
    signal_id = str(entry.get("id", ""))
    if category == "macro":
        return MACRO_ID_TO_ROUTES.get(signal_id, ())
    return CATEGORY_TO_ROUTES.get(category, ())


def _to_signal_ref(entry: dict[str, Any]) -> dict[str, Any]:
    """Project a ranked signal entry onto the SignalRef schema for the hero."""
    return {
        "id": str(entry["id"]),
        "label": str(entry["label"]),
        "message": str(entry["message"]),
        "why_it_matters": str(entry["why_it_matters"]),
        "severity": float(entry["severity"]),
        "freshness_status": str(entry["freshness_status"]),
        "confidence": float(entry["confidence"]),
        "source_status": _project_source_status(entry),
    }


def _project_source_status(entry: dict[str, Any]) -> str:
    """Project the upstream source_status onto the PageInsight enum.

    Upstream ranked entries carry source_status == "active" once they are
    promoted into top_warnings/top_supports. The PageInsight schema uses a
    different vocabulary that distinguishes "free_public" from gated
    statuses. Map "active" -> "free_public" so the public-data shape is
    consistent. Preserve gated statuses verbatim so the gating filter
    upstream can still rely on the original tag.
    """
    status = str(entry.get("source_status", "free_public"))
    if status == "active":
        return "free_public"
    if status in GATED_STATUSES:
        return status
    return status


def _select_primary(
    entries: Iterable[dict[str, Any]],
    direction: str,
    route: str,
) -> dict[str, Any] | None:
    """Pick the highest-priority active signal for ``direction`` in ``route``.

    Excludes source-gated signals — they can never populate a primary slot.
    """
    best: dict[str, Any] | None = None
    best_priority = float("-inf")
    for entry in entries:
        if entry.get("direction") != direction:
            continue
        if str(entry.get("source_status", "")) in GATED_STATUSES:
            continue
        if route not in _signal_routes(entry):
            continue
        priority = float(entry.get("priority", 0.0))
        if priority > best_priority:
            best_priority = priority
            best = entry
    return _to_signal_ref(best) if best is not None else None


def _route_signals(payload: dict[str, Any], route: str) -> list[dict[str, Any]]:
    """All non-gated active signals from top_warnings + top_supports that map
    to ``route``."""
    signals = list(payload.get("top_warnings", []) or [])
    signals.extend(payload.get("top_supports", []) or [])
    return [
        entry
        for entry in signals
        if route in _signal_routes(entry)
        and str(entry.get("source_status", "")) not in GATED_STATUSES
    ]


def _derive_state(
    primary_warning: dict[str, Any] | None,
    primary_support: dict[str, Any] | None,
) -> str:
    if primary_warning is None and primary_support is None:
        return "unknown"
    if primary_warning is not None and primary_support is not None:
        return "mixed"
    if primary_warning is not None:
        return "risk"
    # support-only — high severity is a real "support" read; otherwise calm.
    severity = float(primary_support["severity"]) if primary_support else 0.0
    return "support" if severity >= SUPPORT_STATE_THRESHOLD else "calm"


def _confidence_for_route(route_signals: list[dict[str, Any]]) -> float:
    if not route_signals:
        return 0.0
    return round(
        sum(float(entry.get("confidence", 0.0)) for entry in route_signals)
        / len(route_signals),
        3,
    )


def _why_it_matters(
    primary_warning: dict[str, Any] | None,
    primary_support: dict[str, Any] | None,
    route: str,
) -> str:
    """Use the higher-severity primary slot's text; fall back to the route default."""
    candidates = [c for c in (primary_warning, primary_support) if c is not None]
    if not candidates:
        return DEFAULT_WHY_IT_MATTERS[route]
    candidates.sort(key=lambda c: float(c.get("severity", 0.0)), reverse=True)
    return str(candidates[0]["why_it_matters"])


def _freshness_notes_for_route(
    payload: dict[str, Any],
    route: str,
) -> list[str]:
    """Compose freshness notes from any stale or unavailable signals — both
    active (top_warnings/top_supports) and gated (missing_high_value_signals)
    — that map to this route's category."""
    notes: list[str] = []
    seen: set[str] = set()

    for entry in (
        list(payload.get("top_warnings", []) or [])
        + list(payload.get("top_supports", []) or [])
    ):
        status = str(entry.get("freshness_status", "ok"))
        if status not in {"stale", "unavailable"}:
            continue
        if route not in _signal_routes(entry):
            continue
        signal_id = str(entry.get("id", ""))
        if signal_id in seen:
            continue
        seen.add(signal_id)
        label = str(entry.get("label", signal_id))
        notes.append(f"{label} is {status}.")

    # Source-gated missing high-value signals also surface here so the user
    # can see "this route's data is missing X" alongside any active stale
    # notes. Gated signals are by definition unavailable for active scoring.
    for entry in payload.get("missing_high_value_signals", []) or []:
        if route not in _signal_routes(entry):
            continue
        signal_id = str(entry.get("id", ""))
        if signal_id in seen:
            continue
        seen.add(signal_id)
        label = str(entry.get("label", signal_id))
        notes.append(f"{label} is unavailable.")

    return notes


def build_page_insights(
    *,
    signal_priority: dict[str, Any],
    generated_at_utc: str,
) -> dict[str, Any]:
    """Build the per-route descriptive snapshot.

    ``signal_priority`` is the parsed ``signal_priority.json`` payload.
    Returns the ``page_insights.json`` shape directly.
    """
    routes_block: dict[str, dict[str, Any]] = {}

    all_active = list(signal_priority.get("top_warnings", []) or [])
    all_active.extend(signal_priority.get("top_supports", []) or [])

    for route in ROUTE_KEYS:
        route_signals = _route_signals(signal_priority, route)
        primary_warning = _select_primary(all_active, "risk", route)
        primary_support = _select_primary(all_active, "support", route)
        freshness_notes = _freshness_notes_for_route(signal_priority, route)

        # Omit a route entirely when it has zero ranked signals AND no
        # freshness notes. This keeps the file compact for routes that
        # genuinely have no data this run.
        if (
            primary_warning is None
            and primary_support is None
            and not freshness_notes
            and not route_signals
        ):
            continue

        state = _derive_state(primary_warning, primary_support)
        confidence = _confidence_for_route(route_signals)
        why_it_matters = _why_it_matters(primary_warning, primary_support, route)

        insight: dict[str, Any] = {
            "title": ROUTE_TITLES[route],
            "state": state,
            "why_it_matters": why_it_matters,
            "confidence": confidence,
            "freshness_notes": freshness_notes,
        }
        if primary_warning is not None:
            insight["primary_warning"] = primary_warning
        if primary_support is not None:
            insight["primary_support"] = primary_support
        routes_block[route] = insight

    return {
        "generated_at_utc": generated_at_utc,
        "date": str(signal_priority.get("date", "")),
        "method_version": METHOD_VERSION,
        "routes": routes_block,
    }


def main() -> None:
    derived = data_dir() / "derived"
    signal_priority = json.loads(
        (derived / "signal_priority.json").read_text(encoding="utf-8")
    )
    payload = build_page_insights(
        signal_priority=signal_priority,
        generated_at_utc=utc_now_iso(),
    )
    write_json(derived / "page_insights.json", payload)


if __name__ == "__main__":
    main()
