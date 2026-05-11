"""Single source of truth for the AccessStatus -> active-scoring contract.

The ``access_status`` field on every catalog entry is the authoritative
governance flag. From it we derive:

- ``score_status``           — "active" or "candidate"
- ``active_scoring_allowed`` — True iff the series may enter
                               ``top_warnings`` / ``top_supports`` and
                               other active-output JSON
- ``public_redistribution_allowed`` — True iff we may publish the data
                                      under the project's redistribution
                                      stance
- ``requires_secret``        — True iff fetching the data requires an
                               API key (drives ingest-time secret gating)

``DERIVATION_TABLE`` below is the single mapping used by:
- ``scripts.shared.catalog`` (governance() / catalog_entries())
- ``scripts.validate.validate_schema`` (catalog-entry consistency check)
- the active-scoring gating predicate exposed here

``ACTIVE_ACCESS_STATUSES`` is derived from ``DERIVATION_TABLE`` (status
codes whose ``active_scoring_allowed`` is True), and the
``is_active_scoring_allowed`` predicate reads ``access_status`` directly
off any dict that carries it (a catalog entry, a RankedEntry projection,
etc.). The predicate is fail-closed: a dict missing ``access_status`` is
treated as not-allowed.

See ``docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md``
section "Candidate isolation guard - defense in depth" for the broader
gating contract this module anchors.
"""
from __future__ import annotations

from typing import Any


# (score_status, active_scoring_allowed, public_redistribution_allowed, requires_secret)
# Single source of truth for the AccessStatus enum's derived governance flags.
DERIVATION_TABLE: dict[str, tuple[str, bool, bool, bool]] = {
    "free_public_active":      ("active",    True,  True,  False),
    "free_public_candidate":   ("candidate", False, True,  False),
    "terms_review_needed":     ("candidate", False, False, False),
    "authenticated_candidate": ("candidate", False, False, True),
    "proxy_only":              ("active",    True,  True,  False),
    "restricted_vendor":       ("candidate", False, False, False),
    "unavailable":             ("candidate", False, False, False),
}


# AccessStatus values that grant active-scoring eligibility. Derived from
# DERIVATION_TABLE so any future AccessStatus addition only needs a single
# edit (this table) to propagate to every consumer.
ACTIVE_ACCESS_STATUSES: frozenset[str] = frozenset(
    status
    for status, (_score, active, _redist, _secret) in DERIVATION_TABLE.items()
    if active
)


def is_active_scoring_allowed(entry: dict[str, Any]) -> bool:
    """Return True iff the catalog entry is allowed to enter active outputs.

    Reads ``access_status`` from the entry dict. Used to gate primary slots
    (e.g. ``top_warnings``, ``top_supports``, ``primary_warning``,
    ``primary_support``); candidate-class series may still appear in
    ``missing_high_value_signals`` for transparency.

    Accepts either a catalog entry (which carries ``access_status``
    directly) or any RankedEntry projection that mirrors that field. An
    entry without ``access_status`` is treated as not-allowed (fail-closed
    default — the predicate's job is to prevent silent leaks).
    """
    return entry.get("access_status") in ACTIVE_ACCESS_STATUSES
