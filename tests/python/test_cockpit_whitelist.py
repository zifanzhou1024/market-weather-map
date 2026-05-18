from pathlib import Path

from scripts.shared.catalog import catalog_entries
from scripts.shared.cockpit_whitelist import (
    COCKPIT_WHITELIST,
    CockpitSignal,
    CockpitSecondaryLine,
    REGIME_TONE_MAP,
)
from scripts.transform.build_signal_priority import SIGNAL_CATALOG


def test_whitelist_has_at_least_nine_entries():
    assert len(COCKPIT_WHITELIST) >= 9


def test_whitelist_ids_are_unique():
    ids = [e.id for e in COCKPIT_WHITELIST]
    assert len(ids) == len(set(ids))


def test_every_direction_is_valid():
    for e in COCKPIT_WHITELIST:
        assert e.direction in {"risk", "support", "neutral"}


def test_default_importance_is_three():
    e = CockpitSignal(
        id="x", priority_key="x", display_label="X", primary_series_id="vix"
    )
    assert e.importance == 3


def test_secondary_line_defaults():
    sl = CockpitSecondaryLine(label="L", series_id="vix")
    assert sl.unit == ""
    assert sl.decimals == 1


def test_regime_tone_map_includes_known_labels():
    assert REGIME_TONE_MAP["Goldilocks"] == "positive"
    assert REGIME_TONE_MAP["Stagflation Pressure"] == "negative"
    assert REGIME_TONE_MAP.get("Reallocation / rotation", "neutral") == "neutral"


def _all_known_series_ids() -> set[str]:
    """Union of raw catalog series ids + derived series JSON filenames.

    Cockpit signals may reference derived series (e.g. us10y_minus_us2y,
    net_liquidity) that are not in the raw catalog. We accept any series
    that has an existing derived JSON artifact.
    """
    ids = {e["id"] for e in catalog_entries()}
    derived_dir = Path(__file__).resolve().parents[2] / "public" / "data" / "derived"
    if derived_dir.is_dir():
        ids |= {p.stem for p in derived_dir.glob("*.json")}
    return ids


def test_every_whitelisted_series_is_known():
    known = _all_known_series_ids()
    for entry in COCKPIT_WHITELIST:
        assert entry.primary_series_id in known, (
            f"{entry.id}: primary {entry.primary_series_id} not in catalog or derived"
        )
        for sec in entry.secondary_lines:
            assert sec.series_id in known, (
                f"{entry.id}: secondary {sec.series_id} not in catalog or derived"
            )


def test_every_priority_key_matches_a_signal_catalog_id():
    """Defense against typos in priority_key strings. A mistyped key
    would silently rank the cell at priority 0 forever."""
    known_signal_ids = {entry["id"] for entry in SIGNAL_CATALOG}
    used_keys = {e.priority_key for e in COCKPIT_WHITELIST}
    unknown = used_keys - known_signal_ids
    assert not unknown, (
        f"priority_key values not found in SIGNAL_CATALOG: {sorted(unknown)}"
    )


def test_regime_tone_map_covers_known_regime_labels():
    """The keys in REGIME_TONE_MAP should match the regime labels enumerated
    in src/lib/types.ts (ScoreBlock['label'] union, see lines ~140-147).
    If a new regime label is added on the TS side, add a corresponding tone
    here so subagents downstream don't silently fall through to 'neutral'."""
    # Source-of-truth labels (mirror of src/lib/types.ts ScoreBlock['label'] union)
    expected_labels = {
        "Goldilocks", "Reflation", "Disinflationary Slowdown",
        "Stagflation Pressure", "Credit Stress", "Liquidity Stress",
        "Crowded Calm", "Risk-Off",
    }
    missing = expected_labels - set(REGIME_TONE_MAP.keys())
    assert not missing, (
        f"REGIME_TONE_MAP missing keys present in src/lib/types.ts: {sorted(missing)}"
    )
