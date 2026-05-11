"""Build the signal-priority snapshot.

Reads the existing score summary, shock-risk snapshot, regime snapshot, and
per-series freshness status, then emits a ranked descriptive snapshot under
``public/data/derived/signal_priority.json``. Output is consumed by the
Overview and Tactical Trading Weather routes to render the executive
"what is flashing? what matters? what is missing?" view.

The engine is descriptive only. It does not forecast or recommend trades. It
does not promote candidate sources into active scoring; gated sources surface
in ``missing_high_value_signals`` and are excluded from active warnings and
supports.

Gating contract (defense layer 1 — see candidate-isolation guard in
``docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md``):
a series may enter the primary slots (``top_warnings``, ``top_supports``)
only if its ``access_status`` is in :data:`ACTIVE_ACCESS_STATUSES`. Candidate
classes (``free_public_candidate``, ``terms_review_needed``,
``authenticated_candidate``, ``restricted_vendor``, ``unavailable``) may
still surface in ``missing_high_value_signals`` for transparency but never
in active arrays. ``SignalActiveEntry.source_status`` keeps its literal
``"active"`` narrow post-gating — every entry that survives is active by
construction.
"""
from __future__ import annotations

import json
from typing import Any, Iterable

from scripts.shared.access_status import ACTIVE_ACCESS_STATUSES, is_active_scoring_allowed
from scripts.shared.io import data_dir, utc_now_iso, write_json


METHOD_VERSION = "phase6-pr1-signal-priority-v1"
TOP_N = 7
NEUTRAL_THRESHOLD = 1.0
FRESHNESS_MULTIPLIER = {
    "ok": 1.0,
    "stale": 0.8,
    "unavailable": 0.0,
    "terms_review_needed": 0.0,
}

# Re-exported for test imports; canonical home is access_status.py. Keeping the
# names resolvable via this module preserves call sites like
# ``build_signal_priority.is_active_scoring_allowed`` without forcing tests to
# reach across modules. SIGNAL_CATALOG / MISSING_CATALOG / METHOD_VERSION are
# the engine's own surface, listed alongside for a single explicit __all__.
__all__ = [
    "ACTIVE_ACCESS_STATUSES",
    "is_active_scoring_allowed",
    "build_signal_priority_snapshot",
    "SIGNAL_CATALOG",
    "MISSING_CATALOG",
    "METHOD_VERSION",
]


# Each entry maps to ONE underlying score path so we don't double-count the
# same channel via overlapping families. ``horizon`` describes when the signal
# matters most; importance is a per-signal weight (1-5) used for ranking.
SIGNAL_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "id": "vix_complex",
        "label": "VIX / VVIX complex",
        "group": "Volatility & tail risk",
        "category": "volatility",
        "horizon": "short_term",
        "importance": 5,
        "urgency": "immediate",
        "score_path": ("market_weather", "volatility_tail_risk"),
        "freshness_keys": ("vix", "vvix", "vix9d", "vix3m"),
        "support_message": "Volatility tail risk is contained.",
        "risk_message": "Volatility tail risk is elevated.",
        "why_it_matters": "Implied equity volatility frames near-term equity stress and dealer hedging pressure.",
    },
    {
        "id": "credit_spreads",
        "label": "Credit spreads",
        "group": "Credit",
        "category": "credit",
        "horizon": "both",
        "importance": 5,
        "urgency": "near_term",
        "score_path": ("market_weather", "credit_spreads"),
        "freshness_keys": ("high_yield_oas", "investment_grade_oas", "bbb_oas"),
        "support_message": "Credit spread pressure is contained.",
        "risk_message": "Credit spreads are widening.",
        "why_it_matters": "Credit spreads confirm whether stress is spreading beyond equities into corporate funding markets.",
    },
    {
        "id": "real_yields",
        "label": "10Y real yields",
        "group": "Rates / Real-Yield Pressure",
        "category": "rates",
        "horizon": "both",
        "importance": 5,
        "urgency": "near_term",
        "score_path": ("market_weather", "rates_real_yields"),
        "freshness_keys": ("real_yield_10y",),
        "support_message": "Real yields are giving room to risk assets.",
        "risk_message": "Real yields are elevated and pressuring valuations.",
        "why_it_matters": "Higher real yields tighten financial conditions and weigh on valuation-sensitive assets.",
    },
    {
        "id": "broad_dollar",
        "label": "Broad dollar",
        "group": "Dollar / Global",
        "category": "dollar",
        "horizon": "short_term",
        "importance": 4,
        "urgency": "near_term",
        "score_path": ("market_weather", "dollar_global"),
        "freshness_keys": ("broad_dollar",),
        "support_message": "The broad dollar backdrop is easing.",
        "risk_message": "The broad dollar is firming and tightening global liquidity.",
        "why_it_matters": "Dollar moves transmit global liquidity and risk-off pressure across asset classes.",
    },
    {
        "id": "net_liquidity",
        "label": "Net liquidity",
        "group": "Liquidity / Funding",
        "category": "liquidity",
        "horizon": "both",
        "importance": 4,
        "urgency": "slow",
        "score_path": ("market_weather", "liquidity_funding"),
        "freshness_keys": ("net_liquidity", "reverse_repo", "sofr"),
        "support_message": "Net liquidity is supportive.",
        "risk_message": "Net liquidity is draining.",
        "why_it_matters": "Net liquidity defines the funding backdrop for risk assets and dealer balance sheets.",
    },
    {
        "id": "commodities_inflation_impulse",
        "label": "Commodities inflation impulse",
        "group": "Commodities / Inflation",
        "category": "macro",
        "horizon": "short_term",
        "importance": 3,
        "urgency": "near_term",
        "score_path": ("market_weather", "commodities_inflation_impulse"),
        "freshness_keys": ("commodity_inflation_impulse", "breakeven_10y"),
        "support_message": "Commodity inflation impulse is calming.",
        "risk_message": "Commodity inflation impulse is elevated.",
        "why_it_matters": "Commodity-driven inflation impulse pressures rates and discount-rate-sensitive assets.",
    },
    {
        "id": "sentiment_positioning",
        "label": "S&P 500 positioning",
        "group": "Positioning",
        "category": "positioning",
        "horizon": "short_term",
        "importance": 4,
        "urgency": "near_term",
        "score_path": ("market_weather", "sentiment_positioning"),
        "freshness_keys": ("cftc_sp500_lev_money_net", "cftc_sp500_asset_mgr_net"),
        "support_message": "S&P 500 positioning is balanced.",
        "risk_message": "Leveraged-money S&P 500 positioning is crowded.",
        "why_it_matters": "Crowded leveraged-money positioning amplifies drawdowns when sentiment turns.",
    },
    {
        "id": "vix_curve",
        "label": "VIX curve state",
        "group": "Volatility curve",
        "category": "volatility",
        "horizon": "short_term",
        "importance": 4,
        "urgency": "immediate",
        "score_path": ("fragility", "volatility_term_structure"),
        "freshness_keys": ("vix9d_vix_ratio", "vix_vix3m_ratio"),
        "support_message": "VIX curve is contango-proxy and calm.",
        "risk_message": "VIX curve is in backwardation-proxy stress.",
        "why_it_matters": "VIX curve backwardation flags acute near-term event risk and dealer-driven stress.",
    },
    {
        "id": "growth",
        "label": "Growth breadth",
        "group": "Growth",
        "category": "macro",
        "horizon": "long_term",
        "importance": 5,
        "urgency": "slow",
        "score_path": ("macro_climate", "growth"),
        "freshness_keys": ("cfnai", "cfnai_3m_avg"),
        "support_message": "Growth inputs are supportive.",
        "risk_message": "Growth breadth is weakening.",
        "why_it_matters": "Broad growth conditions set the strategic backdrop for risk assets and recession risk.",
    },
    {
        "id": "labor",
        "label": "Labor cycle",
        "group": "Labor",
        "category": "macro",
        "horizon": "long_term",
        "importance": 5,
        "urgency": "slow",
        "score_path": ("macro_climate", "labor"),
        "freshness_keys": (
            "nonfarm_payrolls",
            "unemployment_rate",
            "initial_claims",
            "sahm_rule",
        ),
        "support_message": "Labor cycle is firm.",
        "risk_message": "Labor cycle is softening.",
        "why_it_matters": "Labor cycle data drives the strategic recession-risk and consumer-income read.",
    },
    {
        "id": "inflation",
        "label": "Inflation pressure",
        "group": "Inflation",
        "category": "macro",
        "horizon": "long_term",
        "importance": 5,
        "urgency": "slow",
        "score_path": ("macro_climate", "inflation"),
        "freshness_keys": ("headline_cpi", "core_cpi", "core_pce", "ppi_final_demand"),
        "support_message": "Inflation pressure is moderating.",
        "risk_message": "Inflation pressure remains elevated.",
        "why_it_matters": "Inflation trajectory drives Fed policy expectations and real-yield direction.",
    },
    {
        "id": "consumer_balance_sheet",
        "label": "Consumer balance sheet",
        "group": "Consumer balance sheet",
        "category": "macro",
        "horizon": "long_term",
        "importance": 4,
        "urgency": "background",
        "score_path": ("macro_climate", "consumer_balance_sheet"),
        "freshness_keys": (
            "household_debt_service_ratio",
            "consumer_debt_service_ratio",
            "credit_card_delinquency_rate",
        ),
        "support_message": "Consumer balance-sheet stress is contained.",
        "risk_message": "Consumer balance-sheet stress is rising.",
        "why_it_matters": "Consumer fragility shapes the strategic late-cycle and recession-risk read.",
    },
)


# Static catalog of high-importance signals that we know are source-gated. The
# engine combines this with shock_snapshot.source_gaps and data_status to
# describe what high-impact signals are not currently scoring.
MISSING_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "id": "sp500_index",
        "label": "S&P 500 benchmark (SPX)",
        "group": "Equity benchmark",
        "category": "positioning",
        "horizon": "short_term",
        "importance": 5,
        "data_status_key": "sp500_index",
        "why_it_matters": "An equity benchmark would let the dashboard compare VIX against realized equity volatility and detect VIX-vs-tape divergences.",
    },
    {
        "id": "move_index",
        "label": "MOVE Index (bond volatility)",
        "group": "Volatility & tail risk",
        "category": "volatility",
        "horizon": "fragility",
        "importance": 4,
        "data_status_key": "move_index",
        "why_it_matters": "Bond-volatility moves can pressure markets even when equity volatility is calm.",
    },
    {
        "id": "skew_index",
        "label": "Cboe SKEW",
        "group": "Volatility & tail risk",
        "category": "volatility",
        "horizon": "short_term",
        "importance": 4,
        "data_status_key": "skew_index",
        "why_it_matters": "SKEW measures tail-risk pricing in S&P options beyond at-the-money volatility.",
    },
    {
        "id": "put_call_total",
        "label": "Put/call ratio (total)",
        "group": "Sentiment",
        "category": "positioning",
        "horizon": "short_term",
        "importance": 4,
        "data_status_key": "put_call_total",
        "why_it_matters": "Put/call positioning is a fast read on option-driven sentiment and hedging.",
    },
    {
        "id": "put_call_spxw",
        "label": "Put/call ratio (SPXW / 0DTE)",
        "group": "Sentiment",
        "category": "positioning",
        "horizon": "short_term",
        "importance": 4,
        "data_status_key": "put_call_spxw",
        "why_it_matters": "0DTE put/call ratios show very-near-term dealer hedging on the index.",
    },
    {
        "id": "vx_futures_curve",
        "label": "VX futures curve",
        "group": "Volatility curve",
        "category": "volatility",
        "horizon": "short_term",
        "importance": 4,
        "data_status_key": "vx1",
        "why_it_matters": "True VX futures curve shape is the gold standard for volatility-curve diagnosis.",
    },
    {
        "id": "term_premium_acm_10y",
        "label": "10Y term premium (ACM)",
        "group": "Rates",
        "category": "rates",
        "horizon": "long_term",
        "importance": 3,
        "data_status_key": "term_premium_acm_10y",
        "why_it_matters": "Term premium decomposes long yields into expected rates and risk premium.",
    },
)


def _direction_for(score: float) -> str:
    if score > NEUTRAL_THRESHOLD:
        return "support"
    if score < -NEUTRAL_THRESHOLD:
        return "risk"
    return "neutral"


def _aggregate_freshness(status: dict[str, dict[str, Any]], keys: Iterable[str]) -> str:
    statuses = []
    for key in keys:
        entry = status.get(key)
        if not entry:
            statuses.append("unavailable")
            continue
        statuses.append(str(entry.get("status", "unavailable")))
    if not statuses:
        return "unavailable"
    if any(s in {"unavailable", "terms_review_needed", "restricted"} for s in statuses):
        return "unavailable"
    if any(s == "stale" for s in statuses):
        return "stale"
    return "ok"


def _all_underlying_series_active(
    catalog: dict[str, dict[str, Any]],
    series_ids: Iterable[str],
) -> bool:
    """True iff every series_id present in ``catalog`` is active-scoring-allowed.

    Series ids that are absent from the catalog (e.g. legacy keys, derived
    aggregates exposed only in ``data_status.json``) are treated as
    non-blocking — the freshness aggregator already handles unavailability.
    Only series_ids that DO appear in the catalog and carry a candidate
    ``access_status`` block the entry from active outputs.

    Note: ``series_ids`` here is the catalog entry's ``freshness_keys`` tuple;
    by convention each freshness key is also the catalog series_id, which is
    why this iteration doubles as the access-status check.
    """
    for series_id in series_ids:
        catalog_entry = catalog.get(series_id)
        if catalog_entry is None:
            continue
        if not is_active_scoring_allowed(catalog_entry):
            return False
    return True


def _aggregate_access_status(
    catalog: dict[str, dict[str, Any]] | None,
    series_ids: Iterable[str],
) -> str:
    """Project an aggregate access_status onto a SignalActiveEntry.

    Every series_id reached here has already passed
    :func:`_all_underlying_series_active`, so the aggregate is guaranteed to
    be a member of :data:`ACTIVE_ACCESS_STATUSES`. If any underlying series
    carries ``proxy_only``, the aggregate is ``proxy_only`` — proxy-only is
    the strictest active-eligible class (it limits public redistribution
    beyond the underlying public data). Otherwise the aggregate is
    ``free_public_active``. When no catalog is provided (legacy / test path),
    the projection defaults to ``free_public_active``.
    """
    if catalog is None:
        return "free_public_active"
    for series_id in series_ids:
        entry = catalog.get(series_id)
        if entry is None:
            continue
        if entry.get("access_status") == "proxy_only":
            return "proxy_only"
    return "free_public_active"


def _evaluate_catalog_entry(
    catalog_entry: dict[str, Any],
    score_summary: dict[str, Any],
    status: dict[str, dict[str, Any]],
    series_catalog: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    family_key, bucket_key = catalog_entry["score_path"]
    family = score_summary["scores"].get(family_key)
    if not family:
        return None
    bucket_score = family.get("bucket_scores", {}).get(bucket_key)
    if bucket_score is None:
        return None

    # Defense layer 1: drop the entry if any underlying series carries a
    # candidate-class access_status. The SIGNAL_CATALOG is curated, but the
    # explicit guard prevents silent leaks if a series is later
    # reclassified to terms_review_needed/authenticated_candidate/etc.
    if series_catalog is not None and not _all_underlying_series_active(
        series_catalog, catalog_entry["freshness_keys"]
    ):
        return None

    direction = _direction_for(float(bucket_score))
    severity = abs(float(bucket_score))
    freshness_status = _aggregate_freshness(status, catalog_entry["freshness_keys"])
    freshness_multiplier = FRESHNESS_MULTIPLIER.get(freshness_status, 0.0)
    confidence = float(family.get("confidence", 1.0))
    importance = int(catalog_entry["importance"])

    if direction == "support":
        message = catalog_entry["support_message"]
    elif direction == "risk":
        message = catalog_entry["risk_message"]
    else:
        message = f"{catalog_entry['label']} is around mid-range."

    priority = importance * severity * freshness_multiplier * confidence

    # ``source_status`` keeps its literal "active" narrow per the
    # SignalActiveEntry TypeScript contract — every entry that survives the
    # gating predicate above is active by construction.
    # ``access_status`` is projected from the underlying catalog so downstream
    # consumers (build_page_insights) can apply the active-scoring predicate
    # without re-loading the catalog.
    access_status = _aggregate_access_status(series_catalog, catalog_entry["freshness_keys"])
    return {
        "id": catalog_entry["id"],
        "label": catalog_entry["label"],
        "group": catalog_entry["group"],
        "category": catalog_entry["category"],
        "horizon": catalog_entry["horizon"],
        "importance": importance,
        "severity": round(severity, 2),
        "priority": round(priority, 2),
        "direction": direction,
        "urgency": catalog_entry["urgency"],
        "confidence": round(confidence, 2),
        "freshness_status": freshness_status,
        "source_status": "active",
        "access_status": access_status,
        "message": message,
        "why_it_matters": catalog_entry["why_it_matters"],
    }


def _missing_high_value_signals(
    shock_snapshot: dict[str, Any],
    status: dict[str, dict[str, Any]],
    series_catalog: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    gap_status_by_id: dict[str, str] = {}
    gap_message_by_id: dict[str, str] = {}
    for gap in shock_snapshot.get("source_gaps", []) or []:
        gap_id = gap.get("id")
        if not gap_id:
            continue
        gap_status_by_id[str(gap_id)] = str(gap.get("status", "terms_review_needed"))
        gap_message_by_id[str(gap_id)] = str(gap.get("message", ""))

    entries: list[dict[str, Any]] = []
    for catalog_entry in MISSING_CATALOG:
        data_status_key = catalog_entry["data_status_key"]
        status_entry = status.get(data_status_key, {})
        # The catalog's access_status is the authoritative signal that a
        # source has been promoted into active scoring; promoted sources
        # don't belong in the missing list.
        if series_catalog is not None:
            series_catalog_entry = series_catalog.get(data_status_key)
            if series_catalog_entry is not None and is_active_scoring_allowed(
                series_catalog_entry
            ):
                continue
        source_status = (
            gap_status_by_id.get(data_status_key)
            or str(status_entry.get("status", "unavailable"))
        )
        message = gap_message_by_id.get(data_status_key) or str(
            status_entry.get(
                "message",
                "Candidate source requires access or terms review before scoring.",
            )
        )
        entries.append(
            {
                "id": catalog_entry["id"],
                "label": catalog_entry["label"],
                "group": catalog_entry["group"],
                "category": catalog_entry["category"],
                "horizon": catalog_entry["horizon"],
                "importance": int(catalog_entry["importance"]),
                "source_status": source_status,
                "message": message,
                "why_it_matters": catalog_entry["why_it_matters"],
            }
        )

    entries.sort(key=lambda item: item["importance"], reverse=True)
    return entries[:TOP_N]


def _overall_read(
    score_summary: dict[str, Any],
    regime_snapshot: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    market_weather = score_summary["scores"].get("market_weather", {})
    macro_climate = score_summary["scores"].get("macro_climate", {})
    fragility = score_summary["scores"].get("fragility", {})
    regime = regime_snapshot.get("regime", {}) or {}

    return {
        "short_term": {
            "label": str(market_weather.get("label", "Unknown")),
            "score": round(float(market_weather.get("score", 0.0)), 2),
            "confidence": round(float(market_weather.get("confidence", 0.0)), 2),
        },
        "long_term": {
            "label": str(macro_climate.get("label", "Unknown")),
            "score": round(float(macro_climate.get("score", 0.0)), 2),
            "confidence": round(float(macro_climate.get("confidence", 0.0)), 2),
        },
        "fragility": {
            "label": str(fragility.get("label", "Unknown")),
            "score": round(float(fragility.get("score", 0.0)), 2),
            "confidence": round(float(fragility.get("confidence", 0.0)), 2),
        },
        "regime": {
            "label": str(regime.get("label", "Unknown")),
        },
    }


def build_signal_priority_snapshot(
    *,
    score_summary: dict[str, Any],
    shock_snapshot: dict[str, Any],
    regime_snapshot: dict[str, Any],
    status: dict[str, dict[str, Any]],
    generated_at_utc: str,
    series_catalog: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build the descriptive signal-priority snapshot.

    All inputs are already-generated static JSON payloads; this function does
    not fetch external data.

    Args:
        series_catalog: Optional ``{series_id: catalog_entry}`` mapping used
            to apply the active-scoring gating predicate
            (:func:`is_active_scoring_allowed`). When provided, every entry
            in ``top_warnings``/``top_supports`` is guaranteed to source
            only from series with ``access_status`` in
            :data:`ACTIVE_ACCESS_STATUSES`. When omitted, the curated
            SIGNAL_CATALOG alone gates the active arrays (every production
            caller passes ``series_catalog``; the default exists only for
            simpler test setups).
    """
    overall_read = _overall_read(score_summary, regime_snapshot)

    evaluated = []
    for catalog_entry in SIGNAL_CATALOG:
        entry = _evaluate_catalog_entry(
            catalog_entry,
            score_summary,
            status,
            series_catalog=series_catalog,
        )
        if entry is None:
            continue
        evaluated.append(entry)

    warnings = sorted(
        (e for e in evaluated if e["direction"] == "risk"),
        key=lambda item: item["priority"],
        reverse=True,
    )[:TOP_N]
    supports = sorted(
        (e for e in evaluated if e["direction"] == "support"),
        key=lambda item: item["priority"],
        reverse=True,
    )[:TOP_N]

    missing = _missing_high_value_signals(
        shock_snapshot,
        status,
        series_catalog=series_catalog,
    )

    return {
        "date": str(score_summary.get("date", "")),
        "generated_at_utc": generated_at_utc,
        "method_version": METHOD_VERSION,
        "overall_read": overall_read,
        "top_warnings": warnings,
        "top_supports": supports,
        "missing_high_value_signals": missing,
    }


def _load_series_catalog() -> dict[str, dict[str, Any]]:
    """Load ``catalog/series_catalog.json`` as a ``{series_id: entry}`` dict.

    Used by :func:`main` to pass authoritative ``access_status`` data into
    the gating predicate. Tests mock this by passing ``series_catalog``
    directly to :func:`build_signal_priority_snapshot`.
    """
    catalog_path = data_dir() / "catalog" / "series_catalog.json"
    raw = json.loads(catalog_path.read_text(encoding="utf-8"))
    return {str(entry["id"]): entry for entry in raw}


def main() -> None:
    derived = data_dir() / "derived"
    status_path = data_dir() / "status" / "data_status.json"

    score_summary = json.loads((derived / "score_summary.json").read_text(encoding="utf-8"))
    shock_snapshot = json.loads((derived / "shock_risk_snapshot.json").read_text(encoding="utf-8"))
    regime_snapshot = json.loads((derived / "regime_snapshot.json").read_text(encoding="utf-8"))
    status_payload = json.loads(status_path.read_text(encoding="utf-8"))
    series_status = status_payload.get("series", {})
    series_catalog = _load_series_catalog()

    snapshot = build_signal_priority_snapshot(
        score_summary=score_summary,
        shock_snapshot=shock_snapshot,
        regime_snapshot=regime_snapshot,
        status=series_status,
        generated_at_utc=utc_now_iso(),
        series_catalog=series_catalog,
    )

    write_json(derived / "signal_priority.json", snapshot)


if __name__ == "__main__":
    main()
