"""Candidate-isolation validator.

Verifies that no candidate-class series_id appears in active-output JSON.
A series is candidate-class if its access_status implies
active_scoring_allowed=False (free_public_candidate, terms_review_needed,
authenticated_candidate, restricted_vendor, unavailable). proxy_only and
free_public_active are allowed.

Run standalone via ``python -m scripts.validate.validate_candidate_isolation``,
or transitively via ``validate_schema.run()`` which imports ``run()`` from
this module.

See ``docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md``
section "Candidate isolation guard - defense in depth" for context. This
module is the second defense layer (validator-time); layer 1 is the Python
build-time predicate in ``build_signal_priority.py`` / ``build_page_insights.py``
and layer 3 is the pytest leak fixtures in ``tests/python/test_candidate_isolation.py``.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from scripts.shared import io as shared_io


# Active-output files whose ``id`` references must be active-class only.
# missing_high_value_signals on signal_priority.json and source_gaps on
# shock_risk_snapshot.json legitimately reference candidate-class series_ids
# for transparency. The walker skips those keys.
ACTIVE_OUTPUT_FILES = (
    "derived/signal_priority.json",
    "derived/page_insights.json",
    "derived/score_summary.json",
    "derived/regime_score.json",
    "derived/bucket_scores.json",
    "derived/shock_risk_snapshot.json",
)

# Per-file keys whose subtree may legitimately reference candidate series.
# Anything outside this exemption is treated as an active slot.
EXEMPT_KEYS_BY_FILE: dict[str, frozenset[str]] = {
    "derived/signal_priority.json": frozenset({"missing_high_value_signals"}),
    "derived/shock_risk_snapshot.json": frozenset({"source_gaps"}),
    "derived/page_insights.json": frozenset({"freshness_notes"}),
    "derived/score_summary.json": frozenset({"missing_or_stale_notes"}),
}

# AccessStatus values that grant active-scoring eligibility. Anything else
# (free_public_candidate, terms_review_needed, authenticated_candidate,
# restricted_vendor, unavailable) is candidate-class.
ACTIVE_ACCESS_STATUSES: frozenset[str] = frozenset({"free_public_active", "proxy_only"})


class CandidateIsolationError(RuntimeError):
    """Raised when a candidate-class series_id leaks into active outputs."""


def _load_series_catalog(root: Path) -> dict[str, dict[str, Any]]:
    path = root / "catalog" / "series_catalog.json"
    return {entry["id"]: entry for entry in json.loads(path.read_text(encoding="utf-8"))}


def _candidate_series_ids(catalog: dict[str, dict[str, Any]]) -> set[str]:
    return {
        entry_id
        for entry_id, entry in catalog.items()
        if entry.get("access_status") not in ACTIVE_ACCESS_STATUSES
    }


def _walk_ids(node: Any, exempt_keys: frozenset[str]) -> Iterable[str]:
    """Yield every string value found under any ``id`` key, recursively.

    Subtrees rooted at any key in ``exempt_keys`` are skipped — those slots
    are reserved for legitimate candidate references (e.g.
    missing_high_value_signals, source_gaps).
    """
    if isinstance(node, dict):
        value = node.get("id")
        if isinstance(value, str):
            yield value
        for key, child in node.items():
            if key in exempt_keys:
                continue
            yield from _walk_ids(child, exempt_keys)
    elif isinstance(node, list):
        for item in node:
            yield from _walk_ids(item, exempt_keys)


def run() -> None:
    """Validate that no candidate-class series_id leaks into active outputs.

    Raises:
        CandidateIsolationError: when one or more candidate ids appear in
            non-exempt slots of the active-output files.
    """
    root = shared_io.data_dir()
    catalog = _load_series_catalog(root)
    candidates = _candidate_series_ids(catalog)
    leaks: list[tuple[str, str]] = []
    for rel_path in ACTIVE_OUTPUT_FILES:
        file_path = root / rel_path
        if not file_path.exists():
            continue
        content = json.loads(file_path.read_text(encoding="utf-8"))
        exempt_keys = EXEMPT_KEYS_BY_FILE.get(rel_path, frozenset())
        for ref in _walk_ids(content, exempt_keys):
            if ref in candidates:
                leaks.append((ref, rel_path))
    if leaks:
        lines = "\n".join(f"  - {leak_id} leaked into {file}" for leak_id, file in leaks)
        raise CandidateIsolationError(
            f"Candidate-isolation violation:\n{lines}\n"
            f"Candidate series_ids must not appear in active-output files. "
            f"See docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md "
            f"for the gating contract."
        )


def main() -> int:
    try:
        run()
    except CandidateIsolationError as exc:
        print(f"ERROR: {exc}")
        return 1
    print("Candidate isolation OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
