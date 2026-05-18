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


def test_value_scale_is_positive_when_set():
    """A non-1.0 value_scale must be strictly positive (negative scales
    would invert sign without anyone noticing in the unit label)."""
    for entry in COCKPIT_WHITELIST:
        if entry.value_scale != 1.0:
            assert entry.value_scale > 0, (
                f"{entry.id}: value_scale must be > 0, got {entry.value_scale}"
            )


def test_value_transform_is_a_known_name_when_set():
    """value_transform, if set, must be one of the names build_cockpit knows
    how to apply. A mistyped transform would raise at build time, but failing
    the test here gives a clearer error than a CI traceback."""
    from scripts.transform.build_cockpit import SUPPORTED_VALUE_TRANSFORMS

    for entry in COCKPIT_WHITELIST:
        if entry.value_transform is not None:
            assert entry.value_transform in SUPPORTED_VALUE_TRANSFORMS, (
                f"{entry.id}: value_transform {entry.value_transform!r} not in "
                f"SUPPORTED_VALUE_TRANSFORMS={sorted(SUPPORTED_VALUE_TRANSFORMS)}"
            )
        for sec in entry.secondary_lines:
            if sec.value_transform is not None:
                assert sec.value_transform in SUPPORTED_VALUE_TRANSFORMS, (
                    f"{entry.id} secondary {sec.label!r}: value_transform "
                    f"{sec.value_transform!r} not supported"
                )


def test_oas_and_yield_curve_entries_scale_percent_to_bp():
    """Guard against an accidental scale revert. The FRED OAS series and the
    derived us10y_minus_us2y series all arrive in percent / percentage points
    and the cockpit displays them in basis points."""
    expected_bp_scaled = {"credit_spreads", "ig_spreads", "yield_curve"}
    for entry in COCKPIT_WHITELIST:
        if entry.id in expected_bp_scaled:
            assert entry.value_scale == 100.0, (
                f"{entry.id}: expected value_scale=100.0 (% → bp), "
                f"got {entry.value_scale}"
            )
            assert entry.primary_unit.strip() == "bp", (
                f"{entry.id}: expected primary_unit ' bp', got "
                f"{entry.primary_unit!r}"
            )


def test_inflation_uses_yoy_transform():
    """Core CPI source is a raw index; the cockpit must convert to YoY %."""
    inflation = next(e for e in COCKPIT_WHITELIST if e.id == "inflation")
    assert inflation.value_transform == "yoy_pct"
    assert inflation.primary_unit == "% YoY"


def test_payrolls_uses_monthly_change_transform_and_level_secondary():
    """Nonfarm Payrolls publishes a monotonically-rising total; the cockpit
    must headline the month-over-month change and surface the level as a
    secondary line (analogous to Core CPI YoY + Core PCE)."""
    payrolls = next(e for e in COCKPIT_WHITELIST if e.id == "payrolls")
    assert payrolls.value_transform == "monthly_change"
    assert payrolls.primary_unit == "k m/m"
    assert payrolls.direction == "support"
    # Exactly one secondary line, the level.
    assert len(payrolls.secondary_lines) == 1
    level = payrolls.secondary_lines[0]
    assert level.label == "Level"
    assert level.series_id == "nonfarm_payrolls"
    assert level.value_transform is None  # raw level, not transformed
    assert level.unit == "k"


def test_secondary_line_value_transform_is_a_known_name_when_set():
    """Mirror of test_value_transform_is_a_known_name_when_set for the
    secondary side — a typo on a secondary chip must fail at test time, not
    at build time."""
    from scripts.transform.build_cockpit import SUPPORTED_VALUE_TRANSFORMS

    allowed: set[str | None] = {None, *SUPPORTED_VALUE_TRANSFORMS}
    for entry in COCKPIT_WHITELIST:
        for sec in entry.secondary_lines:
            assert sec.value_transform in allowed, (
                f"{entry.id} secondary {sec.label!r}: value_transform "
                f"{sec.value_transform!r} not in {sorted(s for s in allowed if s)}"
            )


def test_initial_claims_scaled_to_thousands():
    """ICSA arrives in raw count (e.g. 211000); cockpit displays in thousands."""
    claims = next(e for e in COCKPIT_WHITELIST if e.id == "labor_claims")
    assert claims.value_scale == 0.001
    assert claims.primary_unit == "k"


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
