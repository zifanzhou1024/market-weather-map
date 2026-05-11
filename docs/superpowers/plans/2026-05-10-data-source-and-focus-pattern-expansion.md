# Data-source expansion + focus pattern formalization — implementation plan

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` to implement this plan. Each task block is self-contained — pick up one task at a time, read its `Files`, `Spec reference`, and step list, and execute end-to-end without needing to load the whole plan or whole spec. Mark steps complete with `- [x]`.

**Goal:** Add the next-layer data-source governance (`AccessStatus` enum), official-free data ingest, TradingView authenticated candidates, and the `FocusBlock` section pattern — without touching any active scoring path until the gating contract is in place.

**Architecture:** Four phases. Phase A merges first, building the `AccessStatus` enum, candidate-isolation validator, and `score_status` derivation. Phases B / C / D dispatch in parallel after A merges, each in its own branch. A final QA phase verifies the merged state. The full design is at `docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md` — refer back to it for the policy rationale; this plan only carries executable tasks.

**Tech Stack:** Python 3.11 (ingest + transforms + validators), Vite + React 19 + TypeScript (frontend), pytest, Vitest, ECharts (existing `src/charts/EChartPanel.tsx` wrapper). Static JSON only — no backend service, no browser-side fetches, no runtime secrets.

**Spec file:** [docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md](../specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md)

---

## Branching and worktree strategy

Each phase merges as its own PR. Recommended worktree layout (run from the repo root):

```bash
# Phase A — gating contract, merges first
git worktree add .worktrees/phaseA -b feat/data-source-phase-a-governance origin/main

# Phases B, C, D — dispatched in parallel after phase A merges
git worktree add .worktrees/phaseB-official -b feat/data-source-phase-b-official origin/main
git worktree add .worktrees/phaseB-cboe -b feat/data-source-phase-b-cboe-candidate origin/main
git worktree add .worktrees/phaseB-sentiment -b feat/data-source-phase-b-sentiment-candidate origin/main
git worktree add .worktrees/phaseC -b feat/data-source-phase-c-tradingview origin/main
git worktree add .worktrees/phaseD -b feat/data-source-phase-d-focus-block origin/main
```

After phase A's PR merges to `main`, rebase each B/C/D branch onto the new `main` before continuing. Each branch's `cd .worktrees/<name> && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt` sets up a local Python environment matching CI.

---

## Verification gate — run before every commit and before opening every PR

**Base gate (run from Chunk 1 onward):**

```bash
.venv/bin/python -m pytest tests/python -v
npm test
npm run build
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
# Optional / network-conditional:
.venv/bin/python -m scripts.update_data
```

**Extended gate (run from Chunk 3 onward, after `validate_candidate_isolation` exists):**

```bash
.venv/bin/python -m scripts.validate.validate_candidate_isolation
```

The CI workflow at `.github/workflows/update-data.yml` runs both gates on every push (once Chunk 3 lands, the candidate-isolation step joins the workflow). Don't merge until everything is green.

@superpowers:verification-before-completion governs the rule: never claim a step is done before running the verification command and reading the output.

---

## Chunk 1: Phase A — types, factory, source_registry (tasks A1–A3)

**Branch:** `feat/data-source-phase-a-governance`
**Worktree:** `.worktrees/phaseA`
**Spec reference:** §"Phase A — source governance contract" in [the spec](../specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md).
**Owns:** `src/lib/types.ts`, `scripts/shared/catalog.py`, `scripts/validate/*.py`, `scripts/update_data.py`, `scripts/transform/build_signal_priority.py`, `scripts/transform/build_page_insights.py`, `public/data/catalog/*.json`, `public/data/candidates/README.md`, two test files.
**Why it merges first:** Phases B / C / D all consume the new `AccessStatus` enum and the candidate-isolation validator. Without phase A merged to `main`, the parallel branches would race on `src/lib/types.ts`, `source_registry.json`, and `series_catalog.json`.

### Canonical derivation table (single source of truth for Chunk 1)

Every task in Chunks 1 and 2 must conform to this table. If a step appears to disagree, this table wins.

| `access_status` | `score_status` (alias) | `active_scoring_allowed` | `public_redistribution_allowed` | `requires_secret` |
|---|---|---|---|---|
| `free_public_active` | `active` | `true` | `true` | `false` |
| `free_public_candidate` | `candidate` | `false` | `true` | `false` |
| `terms_review_needed` | `candidate` | `false` | `false` | `false` |
| `authenticated_candidate` | `candidate` | `false` | `false` | `true` |
| `proxy_only` | `active` | `true` | `true` | `false` |
| `restricted_vendor` | `candidate` | `false` | `false` | `false` |
| `unavailable` | `candidate` | `false` | `false` | `false` |

`requires_secret: true` only for `authenticated_candidate` per derivation. The current `unavailable` source-registry entry sets `requires_secret: true` — this is overridden by migration to match the derivation table (per the spec's "Per-entry flags" section, the flag is derived, not retained from legacy data).

### Task dependency chain inside Chunk 1

- A1 (types) is independent.
- A2 (factory) depends on A1.
- A3 (source_registry) depends on A1 (for the new `SourceTermsStatus` value) and A2 (because A3's verification calls `governance()` which must accept the new enum values).

A subagent executing one task must complete its predecessor tasks first.

### Worktree bootstrap (run once per branch)

```bash
git worktree add .worktrees/phaseA -b feat/data-source-phase-a-governance origin/main
cd .worktrees/phaseA
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Run all subsequent commands from this worktree, using `.venv/bin/python -m ...` for Python invocations.

---

### Task A1: Add `AccessStatus` enum + flag fields to TypeScript types

**Dependencies:** none.

**Files:**
- Modify: `src/lib/types.ts` (around lines 27–95 in current state)

**Spec reference:** §"`AccessStatus` enum" and §"Per-entry flags".

**Why:** The frontend reads catalog entries through `SourceRegistryEntry` and `SeriesCatalogEntry`. Adding the enum first lets every downstream Python migration land in `series_catalog.json` against a type the frontend can already consume.

**Current state to be aware of (verified 2026-05-10):**
- `SourceAccessStatus` (line 27) is a 4-value union: `"free_public" | "terms_review_needed" | "restricted" | "unavailable"`.
- `SourceTermsStatus` (line 33) is `"ok" | "review_each_series" | "review_needed" | "restricted" | "unknown"`.
- `ScoreStatus` (line 40) is `"active" | "candidate" | "unavailable"`.
- `SourceRegistryEntry` (line 87) has required `access_status: SourceAccessStatus` and `terms_status: SourceTermsStatus`, plus `requires_secret: boolean` ALREADY present.
- `SeriesCatalogEntry` (line 148) has OPTIONAL `access_status?: SourceAccessStatus`, OPTIONAL `terms_status?: SourceTermsStatus`, OPTIONAL `score_status?: ScoreStatus`.

- [ ] **Step 1: Read the current type definitions**

Run: `sed -n '25,170p' src/lib/types.ts`
Confirm the lines and types match the "Current state" notes above. If they have drifted, re-anchor each subsequent edit to the actual line numbers you see.

- [ ] **Step 2: Add the new `AccessStatus`, `ACCESS_STATUS_VALUES`, and `AccessFlags` types**

Insert this block just before the existing `SourceAccessStatus` declaration (around line 27):

```ts
export type AccessStatus =
  | "free_public_active"
  | "free_public_candidate"
  | "terms_review_needed"
  | "authenticated_candidate"
  | "proxy_only"
  | "restricted_vendor"
  | "unavailable";

export const ACCESS_STATUS_VALUES: readonly AccessStatus[] = [
  "free_public_active",
  "free_public_candidate",
  "terms_review_needed",
  "authenticated_candidate",
  "proxy_only",
  "restricted_vendor",
  "unavailable",
] as const;

export interface AccessFlags {
  access_status: AccessStatus;
  requires_secret: boolean;
  active_scoring_allowed: boolean;
  public_redistribution_allowed: boolean;
}
```

- [ ] **Step 3: Alias `SourceAccessStatus` to `AccessStatus`**

Replace the existing `SourceAccessStatus` declaration (4-value union) with:

```ts
/**
 * @deprecated Use `AccessStatus` directly. This alias is preserved so legacy
 * consumers continue to compile; new code should not reference SourceAccessStatus.
 */
export type SourceAccessStatus = AccessStatus;
```

This widens the type universally — every existing field of type `SourceAccessStatus` automatically accepts the new 7-value enum without rewriting callsites. Two callsites (`src/routes/TacticalTradingWeather.tsx:108` and `src/routes/Volatility.tsx:109`) read `entry?.access_status ?? entry?.score_status` and use it as a display string; widening is safe for them (no exhaustive switch).

- [ ] **Step 4: Add `"authenticated_review"` to `SourceTermsStatus`**

The TradingView source registry entry (added in Task A3) needs a `terms_status` value that doesn't exist today. Extend the union:

```ts
export type SourceTermsStatus =
  | "ok"
  | "review_each_series"
  | "review_needed"
  | "restricted"
  | "unknown"
  | "authenticated_review";
```

- [ ] **Step 5: Add the four flag fields to `SourceRegistryEntry`**

`SourceRegistryEntry` already has `requires_secret: boolean` and `access_status: SourceAccessStatus`. Add the two missing flag fields and keep all existing fields:

```ts
export interface SourceRegistryEntry {
  name: string;
  base_url: string;
  requires_secret: boolean;
  access_status: SourceAccessStatus;
  active_scoring_allowed: boolean;
  public_redistribution_allowed: boolean;
  terms_status: SourceTermsStatus;
  update_cadence: string;
  notes: string;
}
```

- [ ] **Step 6: Extend `SeriesCatalogEntry` and make the governance fields required**

Replace the optional governance fields on `SeriesCatalogEntry` with required ones, and add the new flag fields:

```ts
export interface SeriesCatalogEntry {
  id: string;
  name: string;
  category: SeriesCategory;
  source: string;
  provider_id?: string;
  source_url: string;
  endpoint_url?: string;
  frequency: SeriesFrequency;
  units: string;
  higher_is: "supportive" | "riskier" | "contextual";
  public: boolean;
  max_stale_days: number;
  notes: string;
  citation_notes?: string;
  // Governance fields — ALL required after Phase A migration.
  access_status: SourceAccessStatus;          // was optional
  terms_status: SourceTermsStatus;            // was optional
  score_status: ScoreStatus;                  // was optional; derived alias
  active_scoring_allowed: boolean;            // new
  public_redistribution_allowed: boolean;     // new
  requires_secret: boolean;                   // new
  horizon?: Horizon;
  regime_role?: RegimeRole[];
  preferred_chart?: PreferredChart;
}
```

- [ ] **Step 7: Update `src/components/SourceAccessBadge.tsx` exhaustive Records**

`SourceAccessBadge.tsx` has two `Record<...>` literals that will fail TypeScript compile after aliasing `SourceAccessStatus` to the wider `AccessStatus` enum (and after extending `SourceTermsStatus`). The Records are exhaustive — adding enum values requires adding keys.

Edit `src/components/SourceAccessBadge.tsx`:

```ts
const accessLabels: Record<SourceAccessStatus, string> = {
  free_public_active: "Free public",
  free_public_candidate: "Free public (candidate)",
  terms_review_needed: "Terms review needed",
  authenticated_candidate: "Authenticated candidate",
  proxy_only: "Proxy",
  restricted_vendor: "Restricted vendor",
  unavailable: "Unavailable",
};

const termsLabels: Record<SourceTermsStatus, string> = {
  ok: "Terms ok",
  restricted: "Restricted",
  review_each_series: "Review each series",
  review_needed: "Review needed",
  unknown: "Terms unknown",
  authenticated_review: "Authenticated review",
};
```

The previous keys (`free_public`, `restricted`) are removed. Any pre-existing JSON that still carries the legacy values will fall through to the `formatFallback()` path the component already implements, so this change is safe at runtime.

- [ ] **Step 8: Update `src/lib/data.test.ts` fixtures**

Run: `grep -n "free_public\b\|access_status\|SeriesCatalogEntry\|SourceRegistryFile" src/lib/data.test.ts`

Three fixtures need updating (verified at lines ~320, ~350, ~370 in current state):
- `const monthlyEntry: SeriesCatalogEntry = { ... }` — add the six required governance fields (`access_status: "free_public_active"`, `terms_status: "ok"`, `score_status: "active"`, `active_scoring_allowed: true`, `public_redistribution_allowed: true`, `requires_secret: false`).
- `const catalogEntry: SeriesCatalogEntry = { ... }` — change `access_status: "free_public"` to `"free_public_active"`; ensure all six governance fields are present.
- `const registry: SourceRegistryFile = { ... }` — change `access_status: "free_public"` to `"free_public_active"`; ensure all flag fields are present.

If you find more `"free_public"` or `"terms_review_needed"` literals in other test files, update them analogously (the legacy values are gone from the union after the alias).

- [ ] **Step 9: Run TypeScript compile to confirm no breakages**

Run: `npm run build 2>&1 | tail -30`
Expected: build succeeds.

- [ ] **Step 10: Run vitest to confirm no test breakages**

Run: `npm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/types.ts src/components/SourceAccessBadge.tsx src/lib/data.test.ts
git commit -m "feat(types): add AccessStatus enum and AccessFlags fields

Add 7-value AccessStatus enum (free_public_active / free_public_candidate /
terms_review_needed / authenticated_candidate / proxy_only /
restricted_vendor / unavailable) and an AccessFlags interface.

Widen SourceAccessStatus to alias AccessStatus so legacy callsites
compile without modification. Extend SourceTermsStatus with
authenticated_review. Add three new flag fields (active_scoring_allowed,
public_redistribution_allowed, requires_secret) to SourceRegistryEntry
and make the previously-optional governance fields required on
SeriesCatalogEntry.

Refs: docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md"
```

---

### Task A2: Extend `governance()` factory in `scripts/shared/catalog.py`

**Dependencies:** Task A1 (uses the new `AccessStatus` enum names).

**Files:**
- Modify: `scripts/shared/catalog.py` (around line 9 — the `governance()` factory; plus all callsites)
- Test: `tests/python/test_catalog_governance.py` (new)

**Spec reference:** §"`scripts/shared/catalog.py`" sub-bullet in §"Three related fields".

**Why:** `governance()` is the single point of truth for governance fields on every catalog entry. Extending it (rather than rewriting callsites) keeps the migration mechanical.

**Current factory signature (verified 2026-05-10 at `scripts/shared/catalog.py:9`):**

```python
def governance(
    provider_id: str,
    score_status: str = "active",
    access_status: str | None = None,
    terms_status: str | None = None,
    citation_notes: str | None = None,
) -> dict[str, object]:
    registry = source_registry_entries()[provider_id]
    return {
        "provider_id": provider_id,
        "access_status": access_status or str(registry["access_status"]),
        "terms_status": terms_status or str(registry["terms_status"]),
        "score_status": score_status,
        "citation_notes": citation_notes or str(registry["notes"]),
    }
```

The new factory must PRESERVE `terms_status` and `citation_notes` (and their registry fallback) while adding the new flag fields and the derivation table.

- [ ] **Step 1: Read the current `governance()` signature and three callsite patterns**

Run:
```bash
grep -n "def governance" scripts/shared/catalog.py
grep -n "governance(" scripts/shared/catalog.py | head -20
```

Note the signature (currently `score_status: str = "active"`) and the typical callsites (e.g. `governance(provider_id, score_status="candidate")`).

- [ ] **Step 2: Write the failing test**

Create `tests/python/test_catalog_governance.py`. The test uses `fred` as a known-existing registry entry; after Task A3, the registry will carry the new `free_public_active` enum value for `fred`. For the all-enum-values fixture test (last one), use a monkeypatched fake registry so we can exercise enum values that aren't on real provider rows.

```python
import pytest

from scripts.shared import catalog as catalog_module
from scripts.shared.catalog import governance


def test_governance_default_resolves_registry_access_status():
    # Existing callsite shape: governance("fred") with no kwargs.
    # Should pick up the registry's access_status and derive flags.
    result = governance("fred")
    assert result["access_status"] in {"free_public_active", "free_public"}  # before/after Task A3
    assert "active_scoring_allowed" in result
    assert "public_redistribution_allowed" in result
    assert "requires_secret" in result


def test_governance_explicit_access_status_overrides_registry():
    result = governance("fred", access_status="free_public_active")
    assert result["access_status"] == "free_public_active"
    assert result["score_status"] == "active"
    assert result["active_scoring_allowed"] is True
    assert result["public_redistribution_allowed"] is True
    assert result["requires_secret"] is False


def test_governance_proxy_only_allowed_for_active_scoring():
    result = governance("derived", access_status="proxy_only")
    assert result["active_scoring_allowed"] is True
    assert result["public_redistribution_allowed"] is True
    assert result["score_status"] == "active"


def test_governance_legacy_score_status_kwarg_overrides_derived():
    # Back-compat for legacy callsites that pass score_status explicitly.
    result = governance("fred", access_status="free_public_active", score_status="candidate")
    assert result["score_status"] == "candidate"  # explicit override wins


def test_governance_terms_status_and_citation_notes_preserved():
    result = governance("fred")
    # These fields must still appear (legacy callsites depend on them).
    assert "terms_status" in result
    assert "citation_notes" in result


def test_governance_derivation_table_for_every_enum_value(monkeypatch):
    # Use a fake registry so we can exercise every enum value.
    fake_registry = {
        "test_provider": {
            "access_status": "free_public",       # legacy registry value
            "terms_status": "ok",
            "notes": "test",
            "requires_secret": False,
            "name": "Test",
            "base_url": "",
            "update_cadence": "",
        }
    }
    monkeypatch.setattr(catalog_module, "source_registry_entries", lambda: fake_registry)

    cases = {
        "free_public_active":      ("active",    True,  True,  False),
        "free_public_candidate":   ("candidate", False, True,  False),
        "terms_review_needed":     ("candidate", False, False, False),
        "authenticated_candidate": ("candidate", False, False, True),
        "proxy_only":              ("active",    True,  True,  False),
        "restricted_vendor":       ("candidate", False, False, False),
        "unavailable":             ("candidate", False, False, False),
    }
    for access_status, (score, active, redist, secret) in cases.items():
        result = governance("test_provider", access_status=access_status)
        assert result["score_status"] == score, f"score_status for {access_status}"
        assert result["active_scoring_allowed"] is active, f"active_scoring_allowed for {access_status}"
        assert result["public_redistribution_allowed"] is redist, f"public_redistribution_allowed for {access_status}"
        assert result["requires_secret"] is secret, f"requires_secret for {access_status}"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_catalog_governance.py -v`
Expected: All tests FAIL because the new kwarg / derivation logic doesn't exist yet.

- [ ] **Step 4: Implement the factory extension**

Replace the existing `governance()` function with (note: the new version is backward-compatible — every existing kwarg still works, including `terms_status` and `citation_notes` with registry fallback):

```python
_DERIVATION_TABLE = {
    "free_public_active":      ("active",    True,  True,  False),
    "free_public_candidate":   ("candidate", False, True,  False),
    "terms_review_needed":     ("candidate", False, False, False),
    "authenticated_candidate": ("candidate", False, False, True),
    "proxy_only":              ("active",    True,  True,  False),
    "restricted_vendor":       ("candidate", False, False, False),
    "unavailable":             ("candidate", False, False, False),
}

_LEGACY_ACCESS_STATUS_MAP = {
    # Maps old 4-value SourceAccessStatus to the new 7-value AccessStatus
    # so legacy registry rows that haven't been upgraded yet still resolve.
    "free_public":         "free_public_active",
    "terms_review_needed": "terms_review_needed",
    "restricted":          "restricted_vendor",
    "unavailable":         "unavailable",
}


def governance(
    provider_id: str,
    score_status: str | None = None,
    access_status: str | None = None,
    terms_status: str | None = None,
    citation_notes: str | None = None,
    requires_secret: bool | None = None,
) -> dict[str, object]:
    """Build the governance sub-fields on a catalog entry.

    access_status is authoritative. score_status, active_scoring_allowed,
    public_redistribution_allowed, and requires_secret are derived from
    access_status via _DERIVATION_TABLE.

    Legacy callsites that pass only score_status (no access_status) get
    a sensible default derived from the registry's access_status and
    the legacy mapping table. New callsites should pass access_status
    explicitly; this is enforced by tests after migration.
    """
    registry = source_registry_entries()[provider_id]
    resolved_access = access_status or _LEGACY_ACCESS_STATUS_MAP.get(
        str(registry["access_status"]),
        str(registry["access_status"]),
    )
    if resolved_access not in _DERIVATION_TABLE:
        raise ValueError(
            f"unknown access_status {resolved_access!r} for provider {provider_id!r}; "
            f"expected one of {list(_DERIVATION_TABLE)}"
        )
    derived_score, active_scoring, public_redist, derived_secret = _DERIVATION_TABLE[resolved_access]
    return {
        "provider_id": provider_id,
        "access_status": resolved_access,
        "terms_status": terms_status or str(registry["terms_status"]),
        "score_status": score_status if score_status is not None else derived_score,
        "citation_notes": citation_notes or str(registry["notes"]),
        "active_scoring_allowed": active_scoring,
        "public_redistribution_allowed": public_redist,
        "requires_secret": requires_secret if requires_secret is not None else derived_secret,
    }
```

- [ ] **Step 5: Verify all existing `governance(...)` callsites still resolve**

Run: `grep -n "governance(" scripts/shared/catalog.py | head -30`

Every callsite in this file falls into one of three shapes:
- `governance(provider_id)` — uses registry default; resolves via `_LEGACY_ACCESS_STATUS_MAP`. NO EDIT REQUIRED.
- `governance(provider_id, score_status="candidate")` — sets score_status explicitly; access_status comes from registry. NO EDIT REQUIRED.
- `governance(provider_id, score_status="active")` — same shape. NO EDIT REQUIRED.

The legacy mapping means every existing callsite continues to work after Task A3's reclassification lands. After Task A3 makes the registry entries carry the new 7-value `access_status`, the `_LEGACY_ACCESS_STATUS_MAP` lookup falls through (because the registry value is already in `_DERIVATION_TABLE`).

If you want to clean up callsites that explicitly pass `score_status="candidate"` (because the new factory derives it from `access_status`), you may do so — but it is not required. Defer that cleanup to a follow-up PR per the spec.

- [ ] **Step 6: Run all catalog tests + the new factory test**

Run: `.venv/bin/python -m pytest tests/python/test_catalog.py tests/python/test_catalog_governance.py -v`

Expected: PASS.

Likely failure mode if it doesn't: existing `test_catalog.py` assertions read literal values like `entry["access_status"] == "free_public"`. After A2, the legacy mapping translates `"free_public"` → `"free_public_active"` via the registry, so the factory output carries the new value. The fix is to update those expected literal values (`"free_public"` → `"free_public_active"`, etc.) in the assertions. Do NOT change call-site signatures — the legacy positional/keyword shape continues to work.

- [ ] **Step 7: Commit**

Stage only the files actually changed:

```bash
git add scripts/shared/catalog.py tests/python/test_catalog_governance.py
# Only add test_catalog.py if you actually modified it in Step 6.
git status --short
git commit -m "feat(catalog): extend governance() factory with AccessStatus derivation

Add access_status as the authoritative governance field; derive
score_status, active_scoring_allowed, public_redistribution_allowed,
and requires_secret from access_status via _DERIVATION_TABLE. Preserve
backwards-compat for terms_status and citation_notes (registry
fallback) plus the legacy SourceAccessStatus values (via
_LEGACY_ACCESS_STATUS_MAP). Existing callsites do not need rewriting."
```

---

### Task A3: Reclassify the source registry (Python source of truth + regenerated JSON)

**Dependencies:** Task A1 (extended `SourceTermsStatus` enum) and Task A2 (extended `governance()` factory). Run A2 before A3 because the factory must accept the new `access_status` values during verification.

**Files:**
- Modify: `scripts/shared/source_registry.py` (the Python source-of-truth — defines all registry entries)
- Modify (regenerated): `public/data/catalog/source_registry.json` (written by `scripts/transform/normalize_series.py:30` from the Python function)
- Test: `tests/python/test_source_registry_migration.py` (new)

**Spec reference:** §"Reclassification of existing source registry entries" and §"New source entries".

**Why:** Source-registry entries set the policy default for each provider. Other phases will reference them, so they have to be correct before parallel branches begin.

**Critical detail (verified 2026-05-10):** `public/data/catalog/source_registry.json` is GENERATED from the Python function `source_registry_entries()` in `scripts/shared/source_registry.py`. `scripts/transform/normalize_series.py:30` does `write_json(data_dir() / "catalog" / "source_registry.json", source_registry_entries())` on every `update_data` run. Editing only the JSON is futile — the next `update_data` rewrites it. Task A3 MUST update the Python function first; the JSON is regenerated by running `normalize_series` (or by checking it in via the migration script).

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_source_registry_migration.py`:

```python
import json
from pathlib import Path

REGISTRY = Path("public/data/catalog/source_registry.json")
EXPECTED_RECLASSIFICATION = {
    "cboe":              "free_public_active",
    "cboe_futures":      "terms_review_needed",
    "cboe_options":      "terms_review_needed",
    "cftc":              "free_public_active",
    "derived":           "free_public_active",
    "economic_calendar": "terms_review_needed",
    "fiscaldata":        "free_public_active",
    "fred":              "free_public_active",
    "ice_indices":       "restricted_vendor",
    "occ":               "terms_review_needed",
    "terms_review":      "terms_review_needed",
    "treasury_calendar": "terms_review_needed",
    "unavailable":       "unavailable",
}

EXPECTED_NEW_ENTRIES = {
    "bea":              "free_public_active",
    "bls":              "free_public_active",
    "multpl_shiller":   "free_public_active",
    "ny_fed":           "free_public_candidate",
    "naaim":            "terms_review_needed",
    "aaii":             "terms_review_needed",
    "tradingview":      "authenticated_candidate",
}


def test_registry_has_all_expected_entries():
    data = json.loads(REGISTRY.read_text())
    expected_ids = set(EXPECTED_RECLASSIFICATION) | set(EXPECTED_NEW_ENTRIES)
    assert set(data) == expected_ids


def test_registry_access_status_values():
    data = json.loads(REGISTRY.read_text())
    for entry_id, expected_status in {**EXPECTED_RECLASSIFICATION, **EXPECTED_NEW_ENTRIES}.items():
        assert data[entry_id]["access_status"] == expected_status, entry_id


def test_registry_has_all_new_flags():
    data = json.loads(REGISTRY.read_text())
    for entry_id, entry in data.items():
        assert "requires_secret" in entry, entry_id
        assert "active_scoring_allowed" in entry, entry_id
        assert "public_redistribution_allowed" in entry, entry_id


def test_registry_tradingview_requires_secret():
    data = json.loads(REGISTRY.read_text())
    assert data["tradingview"]["requires_secret"] is True
    assert data["tradingview"]["active_scoring_allowed"] is False
    assert data["tradingview"]["public_redistribution_allowed"] is False


def test_registry_ice_indices_restricted():
    data = json.loads(REGISTRY.read_text())
    assert data["ice_indices"]["access_status"] == "restricted_vendor"
    assert data["ice_indices"]["active_scoring_allowed"] is False


def test_registry_derivation_consistency():
    # active_scoring_allowed must be derivable from access_status.
    expected_active = {"free_public_active", "proxy_only"}
    data = json.loads(REGISTRY.read_text())
    for entry_id, entry in data.items():
        if entry["access_status"] in expected_active:
            assert entry["active_scoring_allowed"] is True, entry_id
        else:
            assert entry["active_scoring_allowed"] is False, entry_id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_source_registry_migration.py -v`
Expected: FAIL (new entries missing, flag fields missing).

- [ ] **Step 3: Apply the reclassification + new entries to `scripts/shared/source_registry.py`**

Open `scripts/shared/source_registry.py`. The function `source_registry_entries()` returns a dict of 13 entries. For each entry:

1. Change `"access_status"` value per the EXPECTED_RECLASSIFICATION table in Step 1.
2. Add the three flag fields per the derivation table at the top of this chunk. Every row is derived strictly from `access_status` — there are no per-source overrides on the flags. For convenience:
   - `cboe`, `cftc`, `derived`, `fiscaldata`, `fred` (`free_public_active`) → `requires_secret: false`, `active_scoring_allowed: true`, `public_redistribution_allowed: true`.
   - `cboe_futures`, `cboe_options`, `economic_calendar`, `occ`, `terms_review`, `treasury_calendar` (`terms_review_needed`) → `requires_secret: false`, `active_scoring_allowed: false`, `public_redistribution_allowed: false`.
   - `ice_indices` (now `restricted_vendor`) → `requires_secret: false`, `active_scoring_allowed: false`, `public_redistribution_allowed: false`.
   - `unavailable` (already `unavailable`) → `requires_secret: false`, `active_scoring_allowed: false`, `public_redistribution_allowed: false`. **Note:** the current entry has `requires_secret: true`; this migration flips it to `false` to match the derivation table. The flag's meaning is "this source needs an env secret to fetch," and the `unavailable` row documents that no automatable fetch path exists at all — secrets are moot.

3. Append the 7 new entries to the Python dict (NOT to the JSON file). Each entry follows the existing Python dict-literal style in `source_registry.py`. Translated from the JSON form below:

```python
# Add these inside source_registry_entries() return dict, after the existing entries.
"bea": {
    "access_status": "free_public_active",
    "active_scoring_allowed": True,
    "base_url": "https://www.bea.gov",
    "name": "U.S. Bureau of Economic Analysis",
    "notes": "Free public macroeconomic data hosted by BEA and mirrored on FRED.",
    "public_redistribution_allowed": True,
    "requires_secret": False,
    "terms_status": "review_each_series",
    "update_cadence": "monthly_release",
},
# ...plus bls, multpl_shiller, ny_fed, naaim, aaii, tradingview with the values
# shown below (transposed from JSON syntax to Python).
```

Reference JSON shape (for cross-referencing field values; do NOT paste this JSON into source_registry.py — use Python dict literals instead):

```json
{
  "bea": {
    "access_status": "free_public_active",
    "base_url": "https://www.bea.gov",
    "name": "U.S. Bureau of Economic Analysis",
    "notes": "Free public macroeconomic data hosted by BEA and mirrored on FRED.",
    "requires_secret": false,
    "active_scoring_allowed": true,
    "public_redistribution_allowed": true,
    "terms_status": "review_each_series",
    "update_cadence": "monthly_release"
  },
  "bls": {
    "access_status": "free_public_active",
    "base_url": "https://www.bls.gov",
    "name": "U.S. Bureau of Labor Statistics",
    "notes": "Free public labor and inflation data hosted by BLS.",
    "requires_secret": false,
    "active_scoring_allowed": true,
    "public_redistribution_allowed": true,
    "terms_status": "review_each_series",
    "update_cadence": "monthly_release"
  },
  "multpl_shiller": {
    "access_status": "free_public_active",
    "base_url": "https://www.multpl.com",
    "name": "Robert Shiller / multpl.com",
    "notes": "Shiller CAPE distributed under a public-data convention; multpl.com mirrors. Confirm endpoint stability in source review.",
    "requires_secret": false,
    "active_scoring_allowed": true,
    "public_redistribution_allowed": true,
    "terms_status": "review_each_series",
    "update_cadence": "monthly"
  },
  "ny_fed": {
    "access_status": "free_public_candidate",
    "base_url": "https://www.newyorkfed.org",
    "name": "Federal Reserve Bank of New York",
    "notes": "Public Federal Reserve research data; candidate pending endpoint/terms confirmation.",
    "requires_secret": false,
    "active_scoring_allowed": false,
    "public_redistribution_allowed": true,
    "terms_status": "review_each_series",
    "update_cadence": "monthly_release"
  },
  "naaim": {
    "access_status": "terms_review_needed",
    "base_url": "https://www.naaim.org",
    "name": "National Association of Active Investment Managers",
    "notes": "NAAIM Exposure Index publishes a weekly XLS; redistribution and commercial-use terms require review per docs/source_reviews/aaii_naaim.md.",
    "requires_secret": false,
    "active_scoring_allowed": false,
    "public_redistribution_allowed": false,
    "terms_status": "review_needed",
    "update_cadence": "weekly"
  },
  "aaii": {
    "access_status": "terms_review_needed",
    "base_url": "https://www.aaii.com",
    "name": "American Association of Individual Investors",
    "notes": "AAII Sentiment Survey distributed via subscription/dashboard; redistribution requires review per docs/source_reviews/aaii_naaim.md.",
    "requires_secret": false,
    "active_scoring_allowed": false,
    "public_redistribution_allowed": false,
    "terms_status": "review_needed",
    "update_cadence": "weekly"
  },
  "tradingview": {
    "access_status": "authenticated_candidate",
    "base_url": "https://www.tradingview.com",
    "name": "TradingView (authenticated candidate)",
    "notes": "Authenticated candidate feed. Used only as candidate-only fallback for MOVE / put-call / VX. Never enters active scoring. Secrets injected via GitHub Actions environment.",
    "requires_secret": true,
    "active_scoring_allowed": false,
    "public_redistribution_allowed": false,
    "terms_status": "authenticated_review",
    "update_cadence": "daily_market_data"
  }
}
```

Note: `terms_status: "authenticated_review"` is the new union member Task A1 added to `SourceTermsStatus`. If you discover Task A1's enum extension didn't land, fix that first — do not work around it here.

- [ ] **Step 4: Regenerate `public/data/catalog/source_registry.json` from the Python source**

The JSON file is generated by `scripts/transform/normalize_series.py:30`. Trigger just the regeneration step (without running the full ingest pipeline):

```bash
.venv/bin/python -c "
import json
from pathlib import Path
from scripts.shared.source_registry import source_registry_entries
out = Path('public/data/catalog/source_registry.json')
out.write_text(json.dumps(source_registry_entries(), indent=2) + '\n')
print('Regenerated', out, 'with', len(source_registry_entries()), 'entries.')
"
```

Expected: prints `Regenerated public/data/catalog/source_registry.json with 20 entries.` (13 existing + 7 new = 20).

- [ ] **Step 5: Run the migration test to verify the JSON matches expectations**

Run: `.venv/bin/python -m pytest tests/python/test_source_registry_migration.py -v`
Expected: PASS.

- [ ] **Step 6: Run all existing tests to confirm no regression**

Run: `.venv/bin/python -m pytest tests/python -v`

Expected: PASS.

Likely failure mode: `tests/python/test_catalog.py` has assertions like `registry["fred"]["access_status"] == "free_public"`. After this task, the value is `"free_public_active"`. Update those expected literal values — DO NOT change the registry back. Same pattern as Task A2 Step 6.

- [ ] **Step 7: Commit**

Stage every file actually modified (the Python source AND the regenerated JSON AND any test assertion updates):

```bash
git status --short
git add scripts/shared/source_registry.py public/data/catalog/source_registry.json tests/python/test_source_registry_migration.py
# Only add tests/python/test_catalog.py if you updated assertion-value literals in Step 6.
git commit -m "feat(catalog): reclassify source_registry + add 7 new source entries

Apply AccessStatus enum to all 13 existing source entries. Add bea,
bls, multpl_shiller, ny_fed, naaim, aaii, and tradingview as new
source registry entries with appropriate access_status and flag
fields. ICE indices promoted from terms_review_needed to
restricted_vendor (MOVE)."
```

---

---

## Chunk 2: Phase A — series_catalog migration + candidates + MODULES (tasks A4–A6)

**Branch:** `feat/data-source-phase-a-governance` (same branch as Chunk 1).
**Spec reference:** §"Series-level migration" and §"MODULES coordination — split into per-phase sub-lists".
**Owns:** `public/data/catalog/series_catalog.json`, `scripts/update_data.py`, `scripts/migrations/migrate_series_catalog_access_status.py`, two test files.
**Depends on:** Chunk 1 (A1–A3) complete on this branch — types, factory, and source_registry must be in place.

The canonical derivation table at the top of Chunk 1 applies here as well.

---

### Task A4: Migrate `series_catalog.json` (105 entries — automated migration)

**Dependencies:** Tasks A1 (types), A2 (factory), A3 (registry reclassification).

**Files:**
- Modify: `public/data/catalog/series_catalog.json` (105 entries)
- Create: `scripts/migrations/migrate_series_catalog_access_status.py` (one-shot migration script)
- Test: `tests/python/test_series_catalog_migration.py` (new)

**Spec reference:** §"Series-level migration".

**Why:** Manual editing of 105 JSON entries is error-prone. A deterministic migration script + a fixture test makes the migration reproducible and auditable.

**Current data shape (verified 2026-05-10):** all 105 entries fall into one of three `(access_status, score_status)` pairs:
- `(free_public, active)` — 56 entries
- `(free_public, candidate)` — 11 entries
- `(terms_review_needed, candidate)` — 38 entries

No other combinations exist. The mapping table in the migration script covers all three; the safety-net branch should not fire on real data, but stays in as a guard for accidental future drift.

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_series_catalog_migration.py`:

```python
import json
from pathlib import Path

SERIES = Path("public/data/catalog/series_catalog.json")
NEW_ACCESS_STATUS_VALUES = {
    "free_public_active",
    "free_public_candidate",
    "terms_review_needed",
    "authenticated_candidate",
    "proxy_only",
    "restricted_vendor",
    "unavailable",
}

# Series-level overrides applied AFTER default mapping.
OVERRIDES = {
    "sp500_index":            "terms_review_needed",
    "move_index":             "restricted_vendor",
    "skew_index":             "terms_review_needed",
    "bond_volatility_proxy":  "proxy_only",
}


def _load() -> list[dict]:
    return json.loads(SERIES.read_text())


def test_every_entry_has_new_access_status_value():
    for entry in _load():
        assert entry["access_status"] in NEW_ACCESS_STATUS_VALUES, entry.get("id")


def test_every_entry_has_new_flag_fields():
    for entry in _load():
        assert "requires_secret" in entry, entry.get("id")
        assert "active_scoring_allowed" in entry, entry.get("id")
        assert "public_redistribution_allowed" in entry, entry.get("id")


def test_score_status_alias_consistency():
    # score_status must be "active" iff access_status is in {free_public_active, proxy_only}.
    for entry in _load():
        if entry["access_status"] in {"free_public_active", "proxy_only"}:
            assert entry["score_status"] == "active", entry.get("id")
        else:
            assert entry["score_status"] == "candidate", entry.get("id")


def test_active_scoring_allowed_consistency():
    for entry in _load():
        expected = entry["access_status"] in {"free_public_active", "proxy_only"}
        assert entry["active_scoring_allowed"] is expected, entry.get("id")


def test_series_level_overrides_applied():
    by_id = {e["id"]: e for e in _load()}
    for series_id, expected in OVERRIDES.items():
        if series_id in by_id:
            assert by_id[series_id]["access_status"] == expected, series_id


def test_no_unmapped_combinations():
    # Migration script writes a report. If any row needed the fallback rule,
    # it appears in the report. For this test, just verify no entry has the
    # legacy binary value.
    for entry in _load():
        assert entry["access_status"] not in {"free_public", None, ""}, entry.get("id")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_series_catalog_migration.py -v`
Expected: FAIL.

- [ ] **Step 3: Write the migration script**

Create `scripts/migrations/__init__.py` (empty) and `scripts/migrations/migrate_series_catalog_access_status.py`:

```python
"""One-shot migration for series_catalog.json's access_status field.

Run with: .venv/bin/python -m scripts.migrations.migrate_series_catalog_access_status

Idempotent: re-running on an already-migrated file is a no-op.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

CATALOG = Path("public/data/catalog/series_catalog.json")

DERIVATION_TABLE = {
    "free_public_active":      {"score_status": "active",    "active_scoring_allowed": True,  "public_redistribution_allowed": True,  "requires_secret": False},
    "free_public_candidate":   {"score_status": "candidate", "active_scoring_allowed": False, "public_redistribution_allowed": True,  "requires_secret": False},
    "terms_review_needed":     {"score_status": "candidate", "active_scoring_allowed": False, "public_redistribution_allowed": False, "requires_secret": False},
    "authenticated_candidate": {"score_status": "candidate", "active_scoring_allowed": False, "public_redistribution_allowed": False, "requires_secret": True},
    "proxy_only":              {"score_status": "active",    "active_scoring_allowed": True,  "public_redistribution_allowed": True,  "requires_secret": False},
    "restricted_vendor":       {"score_status": "candidate", "active_scoring_allowed": False, "public_redistribution_allowed": False, "requires_secret": False},
    "unavailable":             {"score_status": "candidate", "active_scoring_allowed": False, "public_redistribution_allowed": False, "requires_secret": False},
}

# Default mapping from (old access_status, old score_status) to new access_status.
DEFAULT_MAPPING: dict[tuple[str, str], str] = {
    ("free_public", "active"):              "free_public_active",
    ("free_public", "candidate"):           "free_public_candidate",
    ("terms_review_needed", "candidate"):   "terms_review_needed",
}

# Series-level overrides (apply after the default mapping).
OVERRIDES = {
    "sp500_index":            "terms_review_needed",
    "move_index":             "restricted_vendor",
    "skew_index":             "terms_review_needed",
    "bond_volatility_proxy":  "proxy_only",
}


def migrate_entry(entry: dict) -> dict:
    series_id = entry.get("id", "<unknown>")
    old_access = entry.get("access_status", "")
    old_score = entry.get("score_status", "")

    # If already migrated, return unchanged.
    if old_access in DERIVATION_TABLE:
        new_access = old_access
    elif (old_access, old_score) in DEFAULT_MAPPING:
        new_access = DEFAULT_MAPPING[(old_access, old_score)]
    elif old_access == "terms_review_needed" and old_score == "active":
        raise ValueError(
            f"impossible (terms_review_needed, active) row for {series_id}"
        )
    else:
        # Safety net per spec.
        print(
            f"WARN: unmapped (access_status={old_access!r}, score_status={old_score!r}) "
            f"for {series_id}; defaulting to terms_review_needed + candidate.",
            file=sys.stderr,
        )
        new_access = "terms_review_needed"

    # Apply explicit series-level override.
    if series_id in OVERRIDES:
        new_access = OVERRIDES[series_id]

    flags = DERIVATION_TABLE[new_access]
    return {
        **entry,
        "access_status": new_access,
        "score_status": flags["score_status"],
        "active_scoring_allowed": flags["active_scoring_allowed"],
        "public_redistribution_allowed": flags["public_redistribution_allowed"],
        "requires_secret": flags["requires_secret"],
    }


def main() -> int:
    entries = json.loads(CATALOG.read_text())
    migrated = [migrate_entry(entry) for entry in entries]
    CATALOG.write_text(json.dumps(migrated, indent=2) + "\n")
    print(f"Migrated {len(migrated)} entries in {CATALOG}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run the migration**

Run: `.venv/bin/python -m scripts.migrations.migrate_series_catalog_access_status`
Expected stdout: `Migrated 105 entries in public/data/catalog/series_catalog.json.`
Any WARN lines on stderr indicate fallback rows that hit the safety-net branch — investigate before continuing.

- [ ] **Step 5: Run the migration tests**

Run: `.venv/bin/python -m pytest tests/python/test_series_catalog_migration.py -v`
Expected: PASS.

- [ ] **Step 6: Spot-check the diff**

Run: `git diff public/data/catalog/series_catalog.json | head -80`
Confirm: a typical entry's `access_status` changed from `"free_public"` to `"free_public_active"`, and the three new flag fields are present. `sp500_index`, `move_index`, `skew_index`, and `bond_volatility_proxy` got their override values.

- [ ] **Step 7: Commit**

```bash
git add public/data/catalog/series_catalog.json scripts/migrations/ tests/python/test_series_catalog_migration.py
git commit -m "feat(catalog): migrate all 105 series_catalog entries to AccessStatus

Apply the access_status migration via a deterministic, idempotent
script. score_status is retained as a derived alias. Series-level
overrides applied for sp500_index (terms_review_needed),
move_index (restricted_vendor), skew_index (terms_review_needed),
and bond_volatility_proxy (proxy_only)."
```

---

### Task A5: Append 12 already-reviewed candidate series entries to `series_catalog.json`

**Dependencies:** Task A4 (series_catalog migration must have finished so the file is on the new schema).

**Files:**
- Modify: `public/data/catalog/series_catalog.json` (append 12 new entries at the end)
- Test: `tests/python/test_series_catalog_candidate_entries.py` (new)

**Spec reference:** §"`series_catalog.json` ownership — split by source-review presence", first table (phase A entries).

**Why:** Adding these entries up front lets the candidate-isolation validator from task A8 reject leaks even before phase B/C land their candidate-file ingest scripts.

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_series_catalog_candidate_entries.py`:

```python
import json
from pathlib import Path

CATALOG = Path("public/data/catalog/series_catalog.json")

EXPECTED_PHASE_A_CANDIDATES = {
    "put_call_total_candidate":     ("free_public_candidate", "cboe_options"),
    "put_call_index_candidate":     ("free_public_candidate", "cboe_options"),
    "put_call_equity_candidate":    ("free_public_candidate", "cboe_options"),
    "put_call_vix_candidate":       ("free_public_candidate", "cboe_options"),
    "put_call_spxw_candidate":      ("free_public_candidate", "cboe_options"),
    "vx1_candidate":                ("free_public_candidate", "cboe_futures"),
    "vx2_candidate":                ("free_public_candidate", "cboe_futures"),
    "vx3_candidate":                ("free_public_candidate", "cboe_futures"),
    "vx_front_spread_candidate":    ("free_public_candidate", "cboe_futures"),
    "vx_contango_score_candidate":  ("free_public_candidate", "cboe_futures"),
    "naaim_exposure_candidate":     ("terms_review_needed",   "naaim"),
    "aaii_sentiment_candidate":     ("terms_review_needed",   "aaii"),
}


def test_all_phase_a_candidate_entries_present():
    entries = {e["id"]: e for e in json.loads(CATALOG.read_text())}
    for series_id, (expected_access, expected_provider) in EXPECTED_PHASE_A_CANDIDATES.items():
        assert series_id in entries, series_id
        assert entries[series_id]["access_status"] == expected_access, series_id
        assert entries[series_id]["provider_id"] == expected_provider, series_id
        assert entries[series_id]["active_scoring_allowed"] is False, series_id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_series_catalog_candidate_entries.py -v`
Expected: FAIL (entries missing).

- [ ] **Step 3: Append the 12 candidate entries**

Open `public/data/catalog/series_catalog.json`. Append the following entries at the end of the array (before the closing `]`). Each entry follows the existing schema — adapt fields like `name`, `category`, `frequency`, `endpoint_url` to be plausible for the underlying source. Use `endpoint_url: ""` if the ingest script lands it later. Each entry MUST carry `access_status`, `requires_secret`, `active_scoring_allowed`, `public_redistribution_allowed`, `score_status` (derived alias).

Example for one Cboe put/call entry:

```json
{
  "access_status": "free_public_candidate",
  "active_scoring_allowed": false,
  "category": "volatility",
  "citation_notes": "Cboe options market statistics; candidate pending review per docs/source_reviews/cboe_put_call.md.",
  "endpoint_url": "",
  "frequency": "daily",
  "higher_is": "riskier",
  "horizon": "tactical",
  "id": "put_call_total_candidate",
  "max_stale_days": 7,
  "name": "Cboe Total Put/Call Ratio (candidate)",
  "notes": "Candidate Cboe options market statistics. Not active until source review approves redistribution.",
  "preferred_chart": "line",
  "provider_id": "cboe_options",
  "public": false,
  "public_redistribution_allowed": true,
  "regime_role": ["volatility"],
  "requires_secret": false,
  "score_status": "candidate",
  "source": "Cboe",
  "source_url": "https://www.cboe.com/markets/us/options/market_statistics/",
  "terms_status": "review_needed",
  "units": "ratio",
  "value_columns": ["VALUE"]
}
```

Replicate this pattern for all 12 entries, varying `id`, `name`, `provider_id`, `notes`, and `category` per series. For each row, the new flag fields MUST follow the derivation table at the top of this chunk:

- 5 put/call entries — `id`s `put_call_total_candidate`, `put_call_index_candidate`, `put_call_equity_candidate`, `put_call_vix_candidate`, `put_call_spxw_candidate`. `provider_id: "cboe_options"`, `category: "volatility"`, `frequency: "daily"`, `units: "ratio"`. Flags: `access_status: "free_public_candidate"`, `score_status: "candidate"`, `active_scoring_allowed: false`, `public_redistribution_allowed: true`, `requires_secret: false`.

- 3 VX raw entries — `id`s `vx1_candidate`, `vx2_candidate`, `vx3_candidate`. `provider_id: "cboe_futures"`, `category: "volatility"`, `frequency: "daily"`, `units: "index"`, `value_columns: ["SETTLE"]`. Same flag values as put/call (`free_public_candidate`).

- 2 VX-derived entries — `id`s `vx_front_spread_candidate`, `vx_contango_score_candidate`. `provider_id: "cboe_futures"`, derived from VX1/VX2, `endpoint_url: ""`. Same flag values as put/call (`free_public_candidate`).

- `naaim_exposure_candidate` — `provider_id: "naaim"`, `category: "sentiment"`, `frequency: "weekly"`, `units: "percent"`. Flags: `access_status: "terms_review_needed"`, `score_status: "candidate"`, `active_scoring_allowed: false`, `public_redistribution_allowed: false`, `requires_secret: false`. (Note the redistribution flag differs from the Cboe pattern: `terms_review_needed` blocks committed files, while `free_public_candidate` permits them.)

- `aaii_sentiment_candidate` — `provider_id: "aaii"`, `category: "sentiment"`, `frequency: "weekly"`, `units: "percent"`. Same flag values as NAAIM (`terms_review_needed`).

- [ ] **Step 4: Run the candidate-entries test**

Run: `.venv/bin/python -m pytest tests/python/test_series_catalog_candidate_entries.py -v`
Expected: PASS.

- [ ] **Step 5: Run the migration test to confirm no regression**

Run: `.venv/bin/python -m pytest tests/python/test_series_catalog_migration.py tests/python/test_series_catalog_candidate_entries.py -v`
Expected: PASS for both.

- [ ] **Step 6: Commit**

```bash
git add public/data/catalog/series_catalog.json tests/python/test_series_catalog_candidate_entries.py
git commit -m "feat(catalog): append 12 already-reviewed candidate series entries

Add 5 Cboe put/call + 5 VX (vx1-3 + vx_front_spread +
vx_contango_score) + naaim_exposure_candidate +
aaii_sentiment_candidate entries to series_catalog.json. All marked
as candidate-class; never enter active scoring. Reviews already
exist (cboe_put_call.md, vix_futures_curve.md, aaii_naaim.md)."
```

---

### Task A6: Restructure `MODULES` in `scripts/update_data.py` into per-phase sub-lists

**Dependencies:** none (touches an isolated file). May run in parallel with A2–A5 on the same branch.

**Files:**
- Modify: `scripts/update_data.py`
- Test: `tests/python/test_update_data_modules.py` (new)

**Spec reference:** §"MODULES coordination — split into per-phase sub-lists".

**Why:** Single closing `]` line conflicts on every parallel append. Splitting into named sub-lists prevents merge conflicts when phases B/C dispatch in parallel.

- [ ] **Step 1: Read the current MODULES list**

Run: `cat scripts/update_data.py`
Note the 15 existing module paths and their order (verified 2026-05-10: 4 ingest + 8 transform + 1 generate_macro_calendar + 2 validate = 15 string entries; an inline comment about wave-1 derived dashboards may also be present).

- [ ] **Step 2: Write the failing test**

Create `tests/python/test_update_data_modules.py`:

```python
import importlib

import scripts.update_data as mod


def test_modules_list_contains_existing_paths():
    expected = [
        "scripts.ingest.fetch_cboe",
        "scripts.ingest.fetch_fred_csv",
        "scripts.ingest.fetch_treasury",
        "scripts.ingest.fetch_cftc",
        "scripts.transform.normalize_series",
        "scripts.transform.compute_percentiles",
        "scripts.transform.compute_regime_score",
        "scripts.transform.build_signal_priority",
        "scripts.transform.build_page_insights",
        "scripts.transform.build_volatility_dashboard",
        "scripts.transform.build_rates_dashboard",
        "scripts.transform.build_regime_dashboard",
        "scripts.generate_macro_calendar",
        "scripts.validate.validate_schema",
        "scripts.validate.validate_freshness",
    ]
    for path in expected:
        assert path in mod.MODULES, f"missing {path} in MODULES"


def test_modules_order_ingest_transform_validate():
    # Ingest must come before transform must come before validate.
    indices = {p: i for i, p in enumerate(mod.MODULES)}
    assert indices["scripts.ingest.fetch_cboe"] < indices["scripts.transform.normalize_series"]
    assert indices["scripts.transform.normalize_series"] < indices["scripts.validate.validate_schema"]


def test_sub_lists_exist():
    # Phase A introduces named sub-lists that phase B/C agents will append to.
    assert hasattr(mod, "MODULES_INGEST_EXISTING")
    assert hasattr(mod, "MODULES_INGEST_PHASE_B_OFFICIAL")
    assert hasattr(mod, "MODULES_INGEST_PHASE_B_CBOE")
    assert hasattr(mod, "MODULES_INGEST_PHASE_B_SENTIMENT")
    assert hasattr(mod, "MODULES_INGEST_PHASE_C_TRADINGVIEW")
    assert hasattr(mod, "MODULES_TRANSFORM_EXISTING")
    assert hasattr(mod, "MODULES_TRANSFORM_PHASE_B")
    assert hasattr(mod, "MODULES_VALIDATE")


def test_sub_lists_are_lists():
    for name in [
        "MODULES_INGEST_EXISTING",
        "MODULES_INGEST_PHASE_B_OFFICIAL",
        "MODULES_INGEST_PHASE_B_CBOE",
        "MODULES_INGEST_PHASE_B_SENTIMENT",
        "MODULES_INGEST_PHASE_C_TRADINGVIEW",
        "MODULES_TRANSFORM_EXISTING",
        "MODULES_TRANSFORM_PHASE_B",
        "MODULES_VALIDATE",
    ]:
        assert isinstance(getattr(mod, name), list), name
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_update_data_modules.py -v`
Expected: FAIL for `test_sub_lists_exist` (the sub-list attributes don't exist yet).

- [ ] **Step 4: Restructure `MODULES`**

Replace the current `MODULES = [...]` declaration in `scripts/update_data.py` with:

```python
MODULES_INGEST_EXISTING = [
    "scripts.ingest.fetch_cboe",
    "scripts.ingest.fetch_fred_csv",
    "scripts.ingest.fetch_treasury",
    "scripts.ingest.fetch_cftc",
]

# Phase B / official-sources-agent appends entries here.
MODULES_INGEST_PHASE_B_OFFICIAL: list[str] = []

# Phase B / cboe-candidate-agent appends entries here.
MODULES_INGEST_PHASE_B_CBOE: list[str] = []

# Phase B / sentiment-candidate-agent appends entries here.
MODULES_INGEST_PHASE_B_SENTIMENT: list[str] = []

# Phase C / tradingview-candidate-agent appends entries here.
MODULES_INGEST_PHASE_C_TRADINGVIEW: list[str] = []

MODULES_TRANSFORM_EXISTING = [
    "scripts.transform.normalize_series",
    "scripts.transform.compute_percentiles",
    "scripts.transform.compute_regime_score",
    "scripts.transform.build_signal_priority",
    "scripts.transform.build_page_insights",
    "scripts.transform.build_volatility_dashboard",
    "scripts.transform.build_rates_dashboard",
    "scripts.transform.build_regime_dashboard",
    "scripts.generate_macro_calendar",
]

# Phase B may append entries (e.g. treasury_supply_pressure).
MODULES_TRANSFORM_PHASE_B: list[str] = []

MODULES_VALIDATE = [
    "scripts.validate.validate_schema",
    "scripts.validate.validate_freshness",
    # Task A8 will make validate_schema transitively run validate_candidate_isolation
    # so a separate entry here is intentionally omitted.
]

MODULES = (
    MODULES_INGEST_EXISTING
    + MODULES_INGEST_PHASE_B_OFFICIAL
    + MODULES_INGEST_PHASE_B_CBOE
    + MODULES_INGEST_PHASE_B_SENTIMENT
    + MODULES_INGEST_PHASE_C_TRADINGVIEW
    + MODULES_TRANSFORM_EXISTING
    + MODULES_TRANSFORM_PHASE_B
    + MODULES_VALIDATE
)
```

Leave the rest of `update_data.py` (the `run_module`, `main`, etc.) unchanged.

- [ ] **Step 5: Run the test + a network-free smoke check**

Run: `.venv/bin/python -m pytest tests/python/test_update_data_modules.py -v`
Expected: PASS.

Network-free smoke check (no `update_data` invocation; just verify the module loads and the list resolves):

```bash
.venv/bin/python -c "import scripts.update_data as m; assert len(m.MODULES) == len(m.MODULES_INGEST_EXISTING) + len(m.MODULES_INGEST_PHASE_B_OFFICIAL) + len(m.MODULES_INGEST_PHASE_B_CBOE) + len(m.MODULES_INGEST_PHASE_B_SENTIMENT) + len(m.MODULES_INGEST_PHASE_C_TRADINGVIEW) + len(m.MODULES_TRANSFORM_EXISTING) + len(m.MODULES_TRANSFORM_PHASE_B) + len(m.MODULES_VALIDATE); print('MODULES resolves; total =', len(m.MODULES))"
```

Expected: prints `MODULES resolves; total = 15`. (Phase A's restructure preserves the existing 15 module paths; phase B/C sub-lists start empty.)

If network is available, also run `.venv/bin/python -m scripts.update_data` and confirm same behavior as before.

- [ ] **Step 6: Commit**

```bash
git add scripts/update_data.py tests/python/test_update_data_modules.py
git commit -m "refactor(update-data): split MODULES into per-phase sub-lists

Each phase B/C agent appends entries only to its named sub-list,
avoiding closing-bracket merge conflicts on parallel branches. Final
MODULES concatenation declared once."
```

---

---

## Chunk 3: Phase A — validators, build rewrites, verification (tasks A7–A13)

**Branch:** `feat/data-source-phase-a-governance` (same branch as Chunks 1 and 2).
**Spec reference:** §"Phase A — source governance contract" (validator and gating-predicate sections).
**Owns:** `scripts/validate/*.py`, `scripts/transform/build_signal_priority.py`, `scripts/transform/build_page_insights.py`, `public/data/candidates/`, two test files.
**Depends on:** Chunks 1 and 2 (A1–A6) complete and committed on this branch.

The canonical derivation table at the top of Chunk 1 applies here as well.

---

### Task A7: Create `scripts/validate/validate_candidate_isolation.py`

**Files:**
- Create: `scripts/validate/validate_candidate_isolation.py`
- Test: `tests/python/test_candidate_isolation.py` (created in this task; extended in A12)

**Spec reference:** §"Validator extensions" and §"Candidate isolation guard — defense in depth", layer 2.

**Why:** This validator catches leaks of candidate-class series_ids into active outputs. It's the second of three defense layers.

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_candidate_isolation.py`:

```python
import json
from pathlib import Path

import pytest

from scripts.validate.validate_candidate_isolation import (
    CandidateIsolationError,
    run as validate_isolation,
)


@pytest.fixture
def tmp_data(tmp_path: Path, monkeypatch) -> Path:
    """Return a temp data dir containing minimal valid fixtures."""
    catalog = tmp_path / "catalog"
    derived = tmp_path / "derived"
    catalog.mkdir()
    derived.mkdir()

    # Minimal series_catalog with one active and one candidate series.
    (catalog / "series_catalog.json").write_text(
        json.dumps([
            {
                "id": "vix",
                "access_status": "free_public_active",
                "active_scoring_allowed": True,
                "public_redistribution_allowed": True,
                "requires_secret": False,
                "score_status": "active",
                "provider_id": "cboe",
            },
            {
                "id": "put_call_total_candidate",
                "access_status": "free_public_candidate",
                "active_scoring_allowed": False,
                "public_redistribution_allowed": True,
                "requires_secret": False,
                "score_status": "candidate",
                "provider_id": "cboe_options",
            },
        ])
    )

    # Mock the data_dir() helper to return this tmp path.
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    return tmp_path


def test_isolation_passes_when_no_leaks(tmp_data: Path):
    (tmp_data / "derived" / "signal_priority.json").write_text(
        json.dumps({
            "top_warnings": [{"id": "vix", "source_status": "active"}],
            "top_supports": [],
            "missing_high_value_signals": [],
        })
    )
    # No exception means pass.
    validate_isolation()


def test_isolation_fails_when_candidate_in_top_warnings(tmp_data: Path):
    (tmp_data / "derived" / "signal_priority.json").write_text(
        json.dumps({
            "top_warnings": [
                {"id": "vix", "source_status": "active"},
                {"id": "put_call_total_candidate", "source_status": "free_public_candidate"},
            ],
            "top_supports": [],
            "missing_high_value_signals": [],
        })
    )
    with pytest.raises(CandidateIsolationError) as exc:
        validate_isolation()
    assert "put_call_total_candidate" in str(exc.value)
    assert "signal_priority.json" in str(exc.value)


def test_isolation_fails_when_candidate_in_page_insights_primary(tmp_data: Path):
    # signal_priority is clean ...
    (tmp_data / "derived" / "signal_priority.json").write_text(
        json.dumps({"top_warnings": [], "top_supports": [], "missing_high_value_signals": []})
    )
    # ... but page_insights primary_warning references a candidate id.
    (tmp_data / "derived" / "page_insights.json").write_text(
        json.dumps({
            "routes": {
                "volatility": {
                    "primary_warning": {"id": "put_call_total_candidate"},
                }
            }
        })
    )
    with pytest.raises(CandidateIsolationError) as exc:
        validate_isolation()
    assert "put_call_total_candidate" in str(exc.value)
    assert "page_insights.json" in str(exc.value)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_candidate_isolation.py -v`
Expected: FAIL with "module not found".

- [ ] **Step 3: Implement the validator**

Create `scripts/validate/validate_candidate_isolation.py`:

```python
"""Candidate-isolation validator.

Verifies that no candidate-class series_id appears in active-output JSON.
A series is candidate-class if its access_status implies
active_scoring_allowed=False (free_public_candidate, terms_review_needed,
authenticated_candidate, restricted_vendor, unavailable). proxy_only and
free_public_active are allowed.

Run standalone via `python -m scripts.validate.validate_candidate_isolation`,
or transitively via `validate_schema.run()` which imports `run()` from
this module.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from scripts.shared.io import data_dir


ACTIVE_OUTPUT_FILES = [
    "derived/signal_priority.json",
    "derived/page_insights.json",
    "derived/score_summary.json",
    "derived/regime_score.json",
    "derived/bucket_scores.json",
    "derived/shock_risk_snapshot.json",
]

ACTIVE_ACCESS_STATUSES = frozenset({"free_public_active", "proxy_only"})


class CandidateIsolationError(RuntimeError):
    pass


def _load_series_catalog(root: Path) -> dict[str, dict]:
    path = root / "catalog" / "series_catalog.json"
    return {entry["id"]: entry for entry in json.loads(path.read_text())}


def _candidate_series_ids(catalog: dict[str, dict]) -> set[str]:
    return {
        entry_id
        for entry_id, entry in catalog.items()
        if entry.get("access_status") not in ACTIVE_ACCESS_STATUSES
    }


def _walk_ids(node: object) -> Iterable[str]:
    """Yield every string value found under any 'id' key, recursively."""
    if isinstance(node, dict):
        if "id" in node and isinstance(node["id"], str):
            yield node["id"]
        for value in node.values():
            yield from _walk_ids(value)
    elif isinstance(node, list):
        for item in node:
            yield from _walk_ids(item)


def run() -> None:
    root = data_dir()
    catalog = _load_series_catalog(root)
    candidates = _candidate_series_ids(catalog)
    leaks: list[tuple[str, str]] = []
    for rel_path in ACTIVE_OUTPUT_FILES:
        file_path = root / rel_path
        if not file_path.exists():
            continue
        content = json.loads(file_path.read_text())
        for ref in _walk_ids(content):
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
```

- [ ] **Step 4: Run the tests**

Run: `.venv/bin/python -m pytest tests/python/test_candidate_isolation.py -v`
Expected: PASS.

- [ ] **Step 5: Run the validator against the actual repo data**

Run: `.venv/bin/python -m scripts.validate.validate_candidate_isolation`
Expected: prints `Candidate isolation OK.` and exits 0. If it finds leaks, those are real existing leaks that must be fixed before this task can commit.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate/validate_candidate_isolation.py tests/python/test_candidate_isolation.py
git commit -m "feat(validate): add candidate-isolation validator

New validator enforces that no candidate-class series_id appears in
active-output JSON (signal_priority, page_insights primary slots,
score_summary, regime_score, bucket_scores, shock_risk_snapshot).
Standalone command + run() for transitive invocation from
validate_schema."
```

---

### Task A8: Extend `validate_schema.py` (AccessStatus enum check + transitive candidate-isolation call)

**Files:**
- Modify: `scripts/validate/validate_schema.py`
- Test: `tests/python/test_validate_schema_access_status.py` (new)

**Spec reference:** §"Validator extensions" sub-bullet for `validate_schema.py`.

**Why:** Schema validation must enforce the new `AccessStatus` enum and the per-entry flag presence. Importing `validate_candidate_isolation.run()` means a single `validate_schema` invocation transitively exercises both.

- [ ] **Step 1: Read the current `validate_schema.py` shape**

Run: `wc -l scripts/validate/validate_schema.py && head -40 scripts/validate/validate_schema.py`
Identify how to add new checks (function pattern, where it loads catalog data).

- [ ] **Step 2: Write the failing tests**

Create `tests/python/test_validate_schema_access_status.py`:

```python
import json
from pathlib import Path

import pytest

from scripts.validate.validate_schema import (
    SchemaError,
    check_access_status_enum,
)


@pytest.fixture
def tmp_catalog(tmp_path: Path, monkeypatch) -> Path:
    catalog = tmp_path / "catalog"
    catalog.mkdir()
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    return catalog


def _write_registry(catalog_dir: Path, entries: dict) -> None:
    (catalog_dir / "source_registry.json").write_text(json.dumps(entries))


def _write_series(catalog_dir: Path, entries: list) -> None:
    (catalog_dir / "series_catalog.json").write_text(json.dumps(entries))


VALID_REGISTRY_ENTRY = {
    "fred": {
        "access_status": "free_public_active",
        "active_scoring_allowed": True,
        "public_redistribution_allowed": True,
        "requires_secret": False,
        "name": "FRED",
        "base_url": "https://fred.stlouisfed.org",
        "notes": "...",
        "terms_status": "ok",
        "update_cadence": "daily",
    }
}

VALID_SERIES_ENTRY = {
    "id": "vix",
    "access_status": "free_public_active",
    "active_scoring_allowed": True,
    "public_redistribution_allowed": True,
    "requires_secret": False,
    "score_status": "active",
    "provider_id": "cboe",
}


def test_access_status_enum_passes_for_valid_entry(tmp_catalog: Path):
    _write_registry(tmp_catalog, VALID_REGISTRY_ENTRY)
    _write_series(tmp_catalog, [VALID_SERIES_ENTRY])
    check_access_status_enum()


def test_access_status_enum_fails_for_legacy_value(tmp_catalog: Path):
    bad = {**VALID_REGISTRY_ENTRY["fred"], "access_status": "free_public"}
    _write_registry(tmp_catalog, {"fred": bad})
    _write_series(tmp_catalog, [VALID_SERIES_ENTRY])
    with pytest.raises(SchemaError) as exc:
        check_access_status_enum()
    assert "free_public" in str(exc.value)


def test_access_status_enum_fails_when_active_scoring_allowed_inconsistent(tmp_catalog: Path):
    # access_status free_public_candidate must imply active_scoring_allowed=False.
    bad = {**VALID_REGISTRY_ENTRY["fred"], "access_status": "free_public_candidate", "active_scoring_allowed": True}
    _write_registry(tmp_catalog, {"fred": bad})
    _write_series(tmp_catalog, [VALID_SERIES_ENTRY])
    with pytest.raises(SchemaError) as exc:
        check_access_status_enum()
    assert "active_scoring_allowed" in str(exc.value)


def test_access_status_enum_fails_when_required_flags_missing(tmp_catalog: Path):
    bad = {"fred": {"access_status": "free_public_active", "name": "FRED"}}  # missing flags
    _write_registry(tmp_catalog, bad)
    _write_series(tmp_catalog, [VALID_SERIES_ENTRY])
    with pytest.raises(SchemaError) as exc:
        check_access_status_enum()
    msg = str(exc.value).lower()
    assert "requires_secret" in msg or "active_scoring_allowed" in msg or "public_redistribution_allowed" in msg
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_validate_schema_access_status.py -v`
Expected: FAIL (`check_access_status_enum` doesn't exist).

- [ ] **Step 4: Implement the enum check + transitive isolation call**

Open `scripts/validate/validate_schema.py`. Add at the top (or near other check functions):

```python
from scripts.shared.io import data_dir
from scripts.validate.validate_candidate_isolation import run as run_candidate_isolation, CandidateIsolationError


class SchemaError(RuntimeError):
    pass


_ALLOWED_ACCESS_STATUSES = {
    "free_public_active",
    "free_public_candidate",
    "terms_review_needed",
    "authenticated_candidate",
    "proxy_only",
    "restricted_vendor",
    "unavailable",
}

_DERIVATION = {
    "free_public_active":      (True,  True,  False),
    "free_public_candidate":   (False, True,  False),
    "terms_review_needed":     (False, False, False),
    "authenticated_candidate": (False, False, True),
    "proxy_only":              (True,  True,  False),
    "restricted_vendor":       (False, False, False),
    "unavailable":             (False, False, False),
}

_REQUIRED_FLAGS = ("active_scoring_allowed", "public_redistribution_allowed", "requires_secret")


def _check_entry(entry_id: str, entry: dict, source: str) -> list[str]:
    errs: list[str] = []
    access = entry.get("access_status")
    if access not in _ALLOWED_ACCESS_STATUSES:
        errs.append(f"{source} entry {entry_id!r}: access_status={access!r} not in allowed enum")
        return errs
    for flag in _REQUIRED_FLAGS:
        if flag not in entry:
            errs.append(f"{source} entry {entry_id!r}: missing required field {flag!r}")
    if errs:
        return errs
    expected_active, expected_redist, expected_secret = _DERIVATION[access]
    if entry["active_scoring_allowed"] != expected_active:
        errs.append(
            f"{source} entry {entry_id!r}: active_scoring_allowed={entry['active_scoring_allowed']!r} "
            f"inconsistent with access_status={access!r} (expected {expected_active})"
        )
    if entry["public_redistribution_allowed"] != expected_redist:
        errs.append(
            f"{source} entry {entry_id!r}: public_redistribution_allowed inconsistent with access_status"
        )
    return errs


def check_access_status_enum() -> None:
    root = data_dir()
    errs: list[str] = []
    registry = json.loads((root / "catalog" / "source_registry.json").read_text())
    for entry_id, entry in registry.items():
        errs.extend(_check_entry(entry_id, entry, "source_registry"))
    series = json.loads((root / "catalog" / "series_catalog.json").read_text())
    for entry in series:
        errs.extend(_check_entry(entry.get("id", "<unknown>"), entry, "series_catalog"))
    if errs:
        raise SchemaError("AccessStatus enum violations:\n  " + "\n  ".join(errs))
```

Then add at the END of the existing main entrypoint (whatever function ties together the existing checks) one new call:

```python
check_access_status_enum()
run_candidate_isolation()
```

(If `validate_schema.py` doesn't currently have a `main()`/`run()` orchestrator, wrap the existing top-level checks plus the two new calls in a `run()` function and call it from `if __name__ == "__main__":` plus from a `main()`. Preserve all existing checks.)

Add `import json` if not already present.

- [ ] **Step 5: Run the tests**

Run: `.venv/bin/python -m pytest tests/python/test_validate_schema_access_status.py -v`
Expected: PASS.

- [ ] **Step 6: Run the full validator against repo data**

Run: `.venv/bin/python -m scripts.validate.validate_schema`
Expected: exits 0. If it reports inconsistencies, those are migration bugs from task A3/A4/A5 — go back and fix.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate/validate_schema.py tests/python/test_validate_schema_access_status.py
git commit -m "feat(validate): enforce AccessStatus enum + transitively run candidate isolation

validate_schema now rejects entries whose access_status is not in the
7-value enum, whose derived flags are inconsistent with their
access_status, or whose required flag fields are missing. Calls
validate_candidate_isolation.run() at the end so a single
validate_schema invocation transitively exercises both."
```

---

### Task A9: Rewrite gating predicate in `scripts/transform/build_signal_priority.py`

**Files:**
- Modify: `scripts/transform/build_signal_priority.py`
- Modify: `tests/python/test_signal_priority.py` (extend)

**Spec reference:** §"`GATED_STATUSES` → `active_scoring_allowed` predicate".

**Why:** The build-time guard is the first defense layer. Replacing the `GATED_STATUSES` set with an `access_status`-aware predicate makes the new enum the authoritative gating field.

- [ ] **Step 1: Locate the existing gating logic**

Run:
```bash
grep -n "GATED_STATUSES\|score_status\|source_status" scripts/transform/build_signal_priority.py
```
Note: this module currently uses `source_status` on `RankedEntry`, projected from upstream `score_status`. The new code projects `access_status` instead.

- [ ] **Step 2: Extend the test fixture**

Append to `tests/python/test_signal_priority.py`:

```python
def test_signal_priority_excludes_terms_review_needed_from_primary_slots():
    # Fixture: a terms_review_needed series should NEVER appear in top_warnings or top_supports.
    # Look at an existing test for the build function and add a fixture entry with
    # access_status="terms_review_needed". Run the builder, assert the id is not in
    # top_warnings/top_supports/primary slots.
    ...  # Implementation depends on existing test patterns — preserve them.


def test_signal_priority_excludes_authenticated_candidate_from_primary_slots():
    ...


def test_signal_priority_includes_proxy_only_in_active_outputs():
    # bond_volatility_proxy has access_status="proxy_only" and active_scoring_allowed=True.
    # It must be allowed to appear in top_warnings/top_supports.
    ...
```

Adapt each `...` body to mirror existing test patterns in the file (use the fixture builder, call the build function, assert membership). Keep the existing gated-source non-leak test intact.

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `.venv/bin/python -m pytest tests/python/test_signal_priority.py -v`
Expected: new tests FAIL; existing tests still PASS.

- [ ] **Step 4: Rewrite the gating logic**

In `scripts/transform/build_signal_priority.py`:

- Remove the `GATED_STATUSES` constant (or rename to a deprecated alias that warns on use).
- Introduce:

```python
ACTIVE_ACCESS_STATUSES = frozenset({"free_public_active", "proxy_only"})


def is_active_scoring_allowed(entry: dict) -> bool:
    """Return True iff the catalog entry is allowed to enter active outputs."""
    return entry.get("access_status") in ACTIVE_ACCESS_STATUSES
```

- Replace every gating callsite that previously read `source_status` from a `RankedEntry` to instead consult the catalog entry's `access_status` via `is_active_scoring_allowed(catalog_entry)`. Where the projection writes `source_status` onto a `RankedEntry`, set it to the catalog entry's `access_status` value verbatim (this widens the projected values to the new enum).

- Where `SignalActiveEntry.source_status` is literally `"active"` (post-gating), keep that literal — the projection only widens for `SignalMissingEntry` and the internal `RankedEntry` representation.

- [ ] **Step 5: Run the tests**

Run: `.venv/bin/python -m pytest tests/python/test_signal_priority.py -v`
Expected: ALL tests PASS (existing + new).

- [ ] **Step 6: Run the builder against real data and inspect output**

Run: `.venv/bin/python -m scripts.transform.build_signal_priority`
Then: `python -c "import json; data = json.load(open('public/data/derived/signal_priority.json')); print(set(e.get('source_status') for e in data.get('top_warnings', []) + data.get('top_supports', [])))"`
Expected: set is `{"active"}` (post-gating literal).

- [ ] **Step 7: Commit**

```bash
git add scripts/transform/build_signal_priority.py tests/python/test_signal_priority.py
git commit -m "refactor(signal-priority): gate primary slots on access_status

Replace GATED_STATUSES set with is_active_scoring_allowed predicate.
Project access_status onto RankedEntry.source_status. SignalActiveEntry's
literal 'active' narrow is preserved (post-gating). Tests cover
terms_review_needed, authenticated_candidate, and proxy_only paths."
```

---

### Task A10: Rewrite gating predicate in `scripts/transform/build_page_insights.py`

**Files:**
- Modify: `scripts/transform/build_page_insights.py`
- Test: extend existing tests (search `tests/python/` for any file referencing `build_page_insights`)

**Spec reference:** §"`GATED_STATUSES` → `active_scoring_allowed` predicate".

**Why:** Same gating contract as A9, applied to the page-insights builder. Without this, candidate-class signals could leak into `page_insights.json[routes][*][primary_warning|primary_support]`.

- [ ] **Step 1: Locate the gating callsites**

Run:
```bash
grep -n "GATED_STATUSES\|source_status\|score_status" scripts/transform/build_page_insights.py
```
Note: line 30 defines `GATED_STATUSES`; lines 167 and 187 use it.

- [ ] **Step 2: Find or create the test file**

Run: `ls tests/python/ | grep -i "page_insights"`
If a file exists, extend it. If not, create `tests/python/test_page_insights_gating.py`:

```python
import json
from pathlib import Path

import pytest

# Adapt imports to whatever scripts.transform.build_page_insights actually exports.
# If the module exposes a main() that reads from data_dir(), use monkeypatch on data_dir().
# If it exposes pure functions, call them directly with fixture data.

from scripts.transform.build_page_insights import is_active_scoring_allowed


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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_page_insights_gating.py -v`
Expected: FAIL (`is_active_scoring_allowed` not exported).

- [ ] **Step 4: Replace the gating logic**

In `scripts/transform/build_page_insights.py`:

- Replace line 30's `GATED_STATUSES = frozenset({"terms_review_needed", "candidate"})` with:

```python
ACTIVE_ACCESS_STATUSES = frozenset({"free_public_active", "proxy_only"})


def is_active_scoring_allowed(entry: dict) -> bool:
    """Return True iff a catalog entry / ranked entry is allowed in primary slots."""
    return entry.get("access_status") in ACTIVE_ACCESS_STATUSES
```

- At line 167 and 187 (the existing `if str(entry.get("source_status", "")) in GATED_STATUSES:` callsites), replace with:

```python
if not is_active_scoring_allowed(entry):
    # excluded from primary slot; entry remains available for missing_high_value_signals
    ...
```

Adapt the surrounding logic so the field being checked is `access_status` (now widened) on the projected `RankedEntry`, OR look up the catalog entry directly. The cleanest approach: when projecting `source_status` onto `RankedEntry`, also project `access_status`; gate on `access_status`.

- [ ] **Step 5: Run the test**

Run: `.venv/bin/python -m pytest tests/python/test_page_insights_gating.py -v`
Expected: PASS.

- [ ] **Step 6: Run the builder against real data + check output**

Run: `.venv/bin/python -m scripts.transform.build_page_insights`
Then: `python -c "import json; data = json.load(open('public/data/derived/page_insights.json'))['routes']; import collections; statuses = collections.Counter(); [statuses.update([s.get('access_status', s.get('source_status'))]) for r in data.values() for s in [r.get('primary_warning'), r.get('primary_support')] if s]; print(statuses)"`
Expected: every primary slot status is `free_public_active` or `proxy_only` (or none).

- [ ] **Step 7: Commit**

```bash
git add scripts/transform/build_page_insights.py tests/python/test_page_insights_gating.py
git commit -m "refactor(page-insights): gate primary slots on access_status predicate

Replace GATED_STATUSES set with is_active_scoring_allowed predicate.
Primary warning/support slots now reject every access_status outside
{free_public_active, proxy_only}. proxy_only entries (e.g.
bond_volatility_proxy) remain allowed."
```

---

### Task A11: Create `public/data/candidates/` directory + README + .gitkeep

**Files:**
- Create: `public/data/candidates/README.md`
- Create: `public/data/candidates/.gitkeep`

**Spec reference:** §"`public/data/candidates/` directory".

**Why:** Phase B/C agents write candidate files here. The README documents the contract; `.gitkeep` ensures the directory exists pre-merge.

- [ ] **Step 1: Create the README**

Write the file content:

```markdown
# `public/data/candidates/`

Candidate JSONs live here. They are GENERATED by ingest scripts and committed under explicit governance.

## Rules

- A file in this directory NEVER enters:
  - `signal_priority.json` `top_warnings` or `top_supports`
  - `page_insights.json` route primary warning or primary support slots
  - `score_summary.json`
  - `regime_score.json`
  - `bucket_scores.json`
  - `shock_risk_snapshot.json`

- Files may appear in `RouteDataFooter` candidate panels or `MissingSignalPanel` confidence text.

- Every file carries `"active_scoring_allowed": false`.

- A file's `access_status` is one of `free_public_candidate`, `terms_review_needed`, or `authenticated_candidate`.

- `authenticated_candidate` files carry `"requires_secret": true`. The fetch path uses workflow-injected env secrets; the values never appear in committed JSON.

## Promotion path

To promote a candidate to active scoring:

1. Update the corresponding `docs/source_reviews/<source>.md` with documented access, redistribution, attribution, and cadence.
2. Open a PR moving the file from `public/data/candidates/<id>_candidate.json` to `public/data/series/<id>.json` (or `derived/`).
3. Update `public/data/catalog/series_catalog.json` and `public/data/catalog/source_registry.json` to set the new `access_status` (e.g. `free_public_active`).
4. Update `scripts/validate/validate_schema.py` if new constraints are needed.
5. Run the full verification gate; ensure `validate_candidate_isolation` still passes.

See `docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md` for the full governance contract.
```

- [ ] **Step 2: Create the .gitkeep**

```bash
touch public/data/candidates/.gitkeep
```

- [ ] **Step 3: Verify directory structure**

Run: `ls -la public/data/candidates/`
Expected: shows `.gitkeep` and `README.md`.

- [ ] **Step 4: Commit**

```bash
git add public/data/candidates/
git commit -m "feat(candidates): add public/data/candidates/ directory + README

The directory holds candidate-class JSON files produced by phase B/C
ingest scripts. README documents the no-active-scoring contract and
the promotion path."
```

---

### Task A12: Extend `test_signal_priority.py` and `test_candidate_isolation.py` with leak fixtures

**Files:**
- Modify: `tests/python/test_signal_priority.py`
- Modify: `tests/python/test_candidate_isolation.py`

**Spec reference:** §"Candidate isolation guard — defense in depth", layer 3 (pytest contract).

**Why:** Layer 3 of the defense is the pytest contract. One intentional-leak fixture per new `AccessStatus` enum value proves the validator catches every class.

- [ ] **Step 1: Add a fixture-table test to `test_candidate_isolation.py`**

Append:

```python
import pytest

LEAK_CASES = [
    ("free_public_candidate", "put_call_total_candidate"),
    ("terms_review_needed", "naaim_exposure_candidate"),
    ("authenticated_candidate", "tradingview_move_candidate"),
    ("restricted_vendor", "move_index"),
    ("unavailable", "synthetic_unavailable_series"),
]


@pytest.mark.parametrize("access_status,series_id", LEAK_CASES)
def test_isolation_catches_every_candidate_class(
    tmp_path: Path, monkeypatch, access_status: str, series_id: str
):
    catalog = tmp_path / "catalog"
    derived = tmp_path / "derived"
    catalog.mkdir()
    derived.mkdir()
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)

    (catalog / "series_catalog.json").write_text(json.dumps([
        {
            "id": series_id,
            "access_status": access_status,
            "active_scoring_allowed": False,
            "public_redistribution_allowed": False,
            "requires_secret": access_status == "authenticated_candidate",
            "score_status": "candidate",
            "provider_id": "test_provider",
        }
    ]))
    (derived / "signal_priority.json").write_text(json.dumps({
        "top_warnings": [{"id": series_id, "source_status": access_status}],
        "top_supports": [],
        "missing_high_value_signals": [],
    }))

    with pytest.raises(CandidateIsolationError) as exc:
        validate_isolation()
    assert series_id in str(exc.value)
```

- [ ] **Step 2: Run the parametrized tests**

Run: `.venv/bin/python -m pytest tests/python/test_candidate_isolation.py -v -k "test_isolation_catches"`
Expected: 5 PASS rows (one per enum value).

- [ ] **Step 3: Commit**

```bash
git add tests/python/test_candidate_isolation.py
git commit -m "test(candidate-isolation): cover every candidate AccessStatus enum value

Parametrized intentional-leak fixtures prove validate_candidate_isolation
catches free_public_candidate, terms_review_needed,
authenticated_candidate, restricted_vendor, and unavailable leaks
into signal_priority primary slots."
```

---

### Task A13: Phase A — full verification gate + open PR

**Files:** None (verification + PR).

- [ ] **Step 1: Run the full pytest suite**

Run: `.venv/bin/python -m pytest tests/python -v`
Expected: ALL PASS.

- [ ] **Step 2: Run the validators**

Run:
```bash
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
.venv/bin/python -m scripts.validate.validate_candidate_isolation
```
Expected: all exit 0.

- [ ] **Step 3: Run the JS test + build**

Run:
```bash
npm test
npm run build
```
Expected: both PASS. If frontend breaks because of the widened `access_status` union, narrow your fix to keeping `access_status` and `score_status` reads functional. Phase A explicitly avoids UI changes.

- [ ] **Step 4: Smoke-test the data pipeline (network-conditional)**

Run: `.venv/bin/python -m scripts.update_data`
Expected: produces no errors; existing JSON outputs unchanged in shape; safe-update path preserves prior good data on any failure. Skip this step if no network is available.

- [ ] **Step 5: Open the PR**

```bash
gh pr create --title "Phase A: source governance contract" --body "$(cat <<'EOF'
## Summary

Phase A of the data-source expansion plan. Lays the source-governance contract that phases B/C/D depend on.

- Adds 7-value `AccessStatus` enum + `requires_secret`/`active_scoring_allowed`/`public_redistribution_allowed` flags to both `source_registry.json` (13 reclassified + 7 new entries) and `series_catalog.json` (105 migrated + 12 appended candidate entries).
- `score_status` kept as derived alias; legacy callsites unchanged.
- `scripts/shared/catalog.py` `governance()` factory extended.
- New `scripts/validate/validate_candidate_isolation.py` enforces no-leak contract; invoked transitively via `validate_schema`.
- `build_signal_priority.py` and `build_page_insights.py` gate primary slots on `is_active_scoring_allowed()` instead of the old `GATED_STATUSES` set.
- `scripts/update_data.py` `MODULES` restructured into per-phase sub-lists so phases B/C/D append without git merge conflicts.
- `public/data/candidates/` directory created with README documenting the contract.

## Test plan

- [x] `pytest tests/python -v`
- [x] `python -m scripts.validate.validate_schema`
- [x] `python -m scripts.validate.validate_freshness`
- [x] `python -m scripts.validate.validate_candidate_isolation`
- [x] `npm test`
- [x] `npm run build`
- [x] Confirm primary slots in `signal_priority.json` carry `source_status: active` only.

Spec: `docs/superpowers/specs/2026-05-10-data-source-and-focus-pattern-expansion-design.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Wait for the PR to land in `main` before dispatching phases B/C/D**

Phase A is the gate. Do not start phases B / C / D until Phase A is merged.

---

