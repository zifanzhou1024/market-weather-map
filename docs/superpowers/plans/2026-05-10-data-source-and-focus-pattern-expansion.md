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

### Task A4: Migrate `series_catalog.json` (via Python catalog + regeneration)

**Dependencies:** Tasks A1 (types), A2 (factory), A3 (registry reclassification).

**Files:**
- Modify: `scripts/shared/catalog.py` (add an `_OVERRIDES` map applied inside `catalog_entries()` for the 4 series-level overrides)
- Modify (regenerated): `public/data/catalog/series_catalog.json` (written by `scripts/transform/normalize_series.py:31` from `catalog_entries()`)
- Test: `tests/python/test_series_catalog_migration.py` (new)

**Spec reference:** §"Series-level migration".

**Why:** Manual editing of 105 JSON entries is futile — `series_catalog.json` is regenerated from `catalog_entries()` in `scripts/shared/catalog.py:1521` (verified 2026-05-10). The next `update_data` run rewrites the file from the Python source.

After Task A2 + A3 land, simply REGENERATING `series_catalog.json` migrates 105 entries correctly via the legacy-mapping path: `governance()` translates `"free_public"` → `"free_public_active"` and `"terms_review_needed"` stays as-is. The new flag fields (`active_scoring_allowed`, `public_redistribution_allowed`, `requires_secret`) get populated automatically.

The remaining work is the 4 series-level overrides, which need an explicit Python mechanism in `catalog.py`.

**Current data shape (verified 2026-05-10):** 105 entries cover three legacy combinations:
- `(free_public, active)` — 56 entries → `free_public_active`
- `(free_public, candidate)` — 11 entries → `free_public_candidate`
- `(terms_review_needed, candidate)` — 38 entries → `terms_review_needed` (unchanged)

Plus the 4 series-level overrides:
- `sp500_index` → `terms_review_needed` (already correct; no override needed)
- `move_index` → `restricted_vendor` (override needed; currently inherits `terms_review_needed`)
- `skew_index` → `terms_review_needed` (already correct)
- `bond_volatility_proxy` → `proxy_only` (override needed; currently inherits `free_public_active` from `derived` provider)

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

- [ ] **Step 3: Add `_SERIES_ACCESS_STATUS_OVERRIDES` to `scripts/shared/catalog.py`**

Open `scripts/shared/catalog.py`. Add near the top of the file (after imports, before `governance()`):

```python
# Series-level access_status overrides applied inside catalog_entries().
# Each row overrides whatever access_status the provider-level governance()
# would have populated, plus re-derives the flag fields via _DERIVATION_TABLE.
_SERIES_ACCESS_STATUS_OVERRIDES: dict[str, str] = {
    "move_index": "restricted_vendor",
    "bond_volatility_proxy": "proxy_only",
    # sp500_index and skew_index naturally resolve to terms_review_needed
    # via their providers, no override needed.
}
```

- [ ] **Step 4: Apply the overrides + re-derive flags inside `catalog_entries()`**

Find `catalog_entries()` (around line 1521). At the END of the function, after all entries are appended, apply the overrides via a single post-pass. Add this block immediately before the function's `return entries`:

```python
for entry in entries:
    series_id = entry.get("id")
    if series_id in _SERIES_ACCESS_STATUS_OVERRIDES:
        new_access = _SERIES_ACCESS_STATUS_OVERRIDES[series_id]
        derived_score, active_scoring, public_redist, derived_secret = _DERIVATION_TABLE[new_access]
        entry["access_status"] = new_access
        entry["score_status"] = derived_score
        entry["active_scoring_allowed"] = active_scoring
        entry["public_redistribution_allowed"] = public_redist
        entry["requires_secret"] = derived_secret
```

This re-uses Task A2's `_DERIVATION_TABLE`. The override path mirrors the provider-level resolution in `governance()`, ensuring every entry has consistent flags.

- [ ] **Step 5: Regenerate `public/data/catalog/series_catalog.json` from the Python source**

```bash
.venv/bin/python -c "
import json
from pathlib import Path
from scripts.shared.catalog import catalog_entries
out = Path('public/data/catalog/series_catalog.json')
out.write_text(json.dumps(catalog_entries(), indent=2) + '\n')
print('Regenerated', out, 'with', len(catalog_entries()), 'entries.')
"
```

Expected: `Regenerated public/data/catalog/series_catalog.json with 105 entries.`

- [ ] **Step 6: Run the migration tests**

Run: `.venv/bin/python -m pytest tests/python/test_series_catalog_migration.py -v`
Expected: PASS.

- [ ] **Step 7: Run all existing tests**

Run: `.venv/bin/python -m pytest tests/python -v`
Expected: PASS. Update any assertion-value mismatches in `test_catalog.py` per Task A2 Step 6 guidance.

- [ ] **Step 8: Spot-check the diff**

Run: `git diff public/data/catalog/series_catalog.json | head -80`
Confirm: a typical entry's `access_status` changed from `"free_public"` to `"free_public_active"`, and the three new flag fields are present. `move_index` is now `restricted_vendor`, `bond_volatility_proxy` is now `proxy_only`. `sp500_index` and `skew_index` remain `terms_review_needed`.

- [ ] **Step 9: Commit**

```bash
git status --short
git add scripts/shared/catalog.py public/data/catalog/series_catalog.json tests/python/test_series_catalog_migration.py
# Only add test_catalog.py if you updated assertion-value literals in Step 7.
git commit -m "feat(catalog): migrate series_catalog entries to AccessStatus

Migration leverages Task A2's _LEGACY_ACCESS_STATUS_MAP for the 67
'free_public' entries (auto-translated to free_public_active /
free_public_candidate by governance()) plus a small
_SERIES_ACCESS_STATUS_OVERRIDES map for two series-level exceptions
(move_index -> restricted_vendor, bond_volatility_proxy ->
proxy_only). sp500_index and skew_index naturally resolve to
terms_review_needed via their provider entries. score_status is
retained as derived alias on every entry."
```

---

### Task A5: Append 12 already-reviewed candidate series entries (Python catalog + regeneration)

**Dependencies:** Task A4 (series_catalog migration must have finished so the file is on the new schema).

**Files:**
- Modify: `scripts/shared/catalog.py` (define a `CANDIDATE_SERIES_PHASE_A` list constant; extend `catalog_entries()` to include it)
- Modify (regenerated): `public/data/catalog/series_catalog.json`
- Test: `tests/python/test_series_catalog_candidate_entries.py` (new)

**Spec reference:** §"`series_catalog.json` ownership — split by source-review presence", first table (phase A entries).

**Why:** Adding these entries up front lets the candidate-isolation validator from Task A7 reject leaks even before phase B/C land their candidate-file ingest scripts. The entries are appended in Python (the source of truth) so they survive `update_data` regeneration.

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

- [ ] **Step 3: Define `CANDIDATE_SERIES_PHASE_A` in `scripts/shared/catalog.py`**

Open `scripts/shared/catalog.py`. Add a new module-level constant near the other SERIES constants (e.g. after `TACTICAL_IDS` or alongside `FRED_SERIES`):

```python
CANDIDATE_SERIES_PHASE_A: list[dict[str, object]] = [
    # Filled in by the dict literals shown in Step 4 below.
]
```

Then extend `catalog_entries()` to include this list. At the end of `catalog_entries()`, BEFORE the override loop added in Task A4 Step 4, add:

```python
entries.extend(entry.copy() for entry in CANDIDATE_SERIES_PHASE_A)
```

The `.copy()` matches the existing pattern at line 1522 (`[series.copy() for series in CBOE_INDEX_SERIES]`).

- [ ] **Step 4: Populate `CANDIDATE_SERIES_PHASE_A` with the 12 candidate entries**

Each entry is a self-contained dict — no `governance()` call needed because the flag fields are written explicitly. Below is the canonical first entry; replicate the pattern with field-value substitutions for the remaining 11 entries.

```python
CANDIDATE_SERIES_PHASE_A: list[dict[str, object]] = [
    {
        "id": "put_call_total_candidate",
        "name": "Cboe Total Put/Call Ratio (candidate)",
        "category": "volatility",
        "source": "Cboe",
        "provider_id": "cboe_options",
        "source_url": "https://www.cboe.com/markets/us/options/market_statistics/",
        "endpoint_url": "",
        "frequency": "daily",
        "units": "ratio",
        "higher_is": "riskier",
        "public": False,
        "max_stale_days": 7,
        "notes": "Candidate Cboe options market statistics. Not active until source review approves redistribution.",
        "citation_notes": "Cboe options market statistics; candidate pending review per docs/source_reviews/cboe_put_call.md.",
        "access_status": "free_public_candidate",
        "score_status": "candidate",
        "terms_status": "review_needed",
        "active_scoring_allowed": False,
        "public_redistribution_allowed": True,
        "requires_secret": False,
        "horizon": "tactical",
        "regime_role": ["volatility"],
        "preferred_chart": "line",
    },
    # ... 11 more entries; see field-value table below.
]
```

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

- [ ] **Step 5: Regenerate `series_catalog.json` from the Python source**

```bash
.venv/bin/python -c "
import json
from pathlib import Path
from scripts.shared.catalog import catalog_entries
out = Path('public/data/catalog/series_catalog.json')
out.write_text(json.dumps(catalog_entries(), indent=2) + '\n')
print('Regenerated', out, 'with', len(catalog_entries()), 'entries.')
"
```

Expected: `Regenerated public/data/catalog/series_catalog.json with 117 entries.` (105 existing + 12 candidate appends = 117).

- [ ] **Step 6: Run the candidate-entries test**

Run: `.venv/bin/python -m pytest tests/python/test_series_catalog_candidate_entries.py -v`
Expected: PASS.

- [ ] **Step 7: Run the migration test to confirm no regression**

Run: `.venv/bin/python -m pytest tests/python/test_series_catalog_migration.py tests/python/test_series_catalog_candidate_entries.py -v`
Expected: PASS for both.

- [ ] **Step 8: Commit**

```bash
git add scripts/shared/catalog.py public/data/catalog/series_catalog.json tests/python/test_series_catalog_candidate_entries.py
git commit -m "feat(catalog): append 12 already-reviewed candidate series entries

Add CANDIDATE_SERIES_PHASE_A list constant with 5 Cboe put/call + 5
VX (vx1-3 + vx_front_spread + vx_contango_score) +
naaim_exposure_candidate + aaii_sentiment_candidate entries; extend
catalog_entries() to include them. All marked as candidate-class;
never enter active scoring. Reviews already exist (cboe_put_call.md,
vix_futures_curve.md, aaii_naaim.md). JSON regenerated."
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

## Chunk 4: Phase B — official-sources-agent (tasks BO1–BO8)

**Branch:** `feat/data-source-phase-b-official`
**Worktree:** `.worktrees/phaseB-official`
**Spec reference:** §"Phase B" → `official-sources-agent`.
**Owns:** new ingest scripts for BEA, Shiller CAPE, NY Fed ACM; new transform for treasury supply pressure; three new source-review docs.
**Depends on:** Phase A merged to `main`. Rebase this branch onto post-merge `main` before starting.

### Python-source-first pattern (used by every Phase B/C agent)

For new series, append entries to `scripts/shared/catalog.py` (not directly to JSON). The `update_data` pipeline regenerates `public/data/catalog/series_catalog.json`. The pattern established in Phase A Task A5:

1. Define a per-agent list constant in `catalog.py` (e.g. `OFFICIAL_SOURCE_SERIES_PHASE_B`).
2. Extend `catalog_entries()` to include the new list.
3. Each entry sets `access_status`, `score_status`, `active_scoring_allowed`, `public_redistribution_allowed`, `requires_secret` explicitly per the derivation table.
4. Regenerate JSON via the one-liner from Task A4 Step 5.

### Worktree bootstrap

```bash
git worktree add .worktrees/phaseB-official -b feat/data-source-phase-b-official origin/main
cd .worktrees/phaseB-official
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

---

### Task BO1: Write source-review docs

**Dependencies:** none.

**Files:**
- Create: `docs/source_reviews/bea_personal_saving_rate.md`
- Create: `docs/source_reviews/shiller_cape.md`
- Modify: `docs/source_reviews/ny_fed_acm_term_premium.md` (re-review with documented endpoint)

**Spec reference:** §"`official-sources-agent`" sub-bullets.

- [ ] **Step 1: Write `bea_personal_saving_rate.md`**

Follow the structure of existing source reviews (e.g. `docs/source_reviews/sloos.md`). Include:
- Source owner: U.S. Bureau of Economic Analysis.
- Official page: https://www.bea.gov/data/income-saving/personal-saving-rate (and FRED mirror at https://fred.stlouisfed.org/series/PSAVERT).
- Data format: monthly, percent of disposable income.
- Automated download: approved via FRED graph CSV endpoint (`https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSAVERT`).
- Static JSON redistribution: approved (BEA data is in the public domain).
- Attribution: "U.S. Bureau of Economic Analysis, Personal Saving Rate [PSAVERT], via FRED."
- Decision: `access_status: free_public_active`, `score_status: active`.

- [ ] **Step 2: Write `shiller_cape.md`**

- Source owner: Robert Shiller / Yale; mirror at multpl.com.
- Official page: http://www.econ.yale.edu/~shiller/data.htm.
- Data format: monthly CAPE ratio.
- Automated download: approved if from Shiller's hosted XLS or multpl.com mirror.
- Static JSON redistribution: approved (Shiller data is broadly public).
- Attribution: "Cyclically Adjusted P/E ratio from Robert Shiller, Yale University."
- Decision: `access_status: free_public_active`, `score_status: active`.

- [ ] **Step 3: Update `ny_fed_acm_term_premium.md`**

Replace the existing "Decision" section. Document the endpoint at `https://www.newyorkfed.org/medialibrary/media/research/data_indicators/ACMTermPremium.xls` (or the current canonical URL — verify on the NY Fed page).

Either:
- (a) Conclude `access_status: free_public_candidate` if endpoint is stable but redistribution requires further review. Output goes to `candidates/`.
- (b) Conclude `access_status: free_public_active` if redistribution is approved.

Default: (a). The ingest script in Task BO5 outputs to `candidates/` regardless.

- [ ] **Step 4: Commit**

```bash
git add docs/source_reviews/bea_personal_saving_rate.md docs/source_reviews/shiller_cape.md docs/source_reviews/ny_fed_acm_term_premium.md
git commit -m "docs(source-reviews): add BEA + Shiller CAPE reviews; re-review NY Fed ACM

BEA personal saving rate and Shiller CAPE concluded free_public_active.
NY Fed ACM term premium remains free_public_candidate pending
redistribution review."
```

---

### Task BO2: Add new series catalog entries to `scripts/shared/catalog.py`

**Dependencies:** Phase A merged (catalog.py now uses the new `_DERIVATION_TABLE`).

**Files:**
- Modify: `scripts/shared/catalog.py`
- Modify (regenerated): `public/data/catalog/series_catalog.json`
- Test: `tests/python/test_official_sources_catalog_entries.py` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_official_sources_catalog_entries.py`:

```python
import json
from pathlib import Path

CATALOG = Path("public/data/catalog/series_catalog.json")

EXPECTED = {
    "personal_saving_rate":          ("free_public_active",    "bea"),
    "cape_ratio":                    ("free_public_active",    "multpl_shiller"),
    "ny_fed_acm_term_premium_candidate": ("free_public_candidate", "ny_fed"),
}


def test_official_source_entries_present():
    entries = {e["id"]: e for e in json.loads(CATALOG.read_text())}
    for series_id, (access, provider) in EXPECTED.items():
        assert series_id in entries, series_id
        assert entries[series_id]["access_status"] == access
        assert entries[series_id]["provider_id"] == provider
```

- [ ] **Step 2: Define `OFFICIAL_SOURCE_SERIES_PHASE_B` in `catalog.py`**

Add the list with three dict literals (analogous to `CANDIDATE_SERIES_PHASE_A`):

```python
OFFICIAL_SOURCE_SERIES_PHASE_B: list[dict[str, object]] = [
    {
        "id": "personal_saving_rate",
        "name": "U.S. Personal Saving Rate",
        "category": "growth",
        "source": "BEA / FRED",
        "provider_id": "bea",
        "source_url": "https://fred.stlouisfed.org/series/PSAVERT",
        "endpoint_url": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSAVERT",
        "frequency": "monthly",
        "units": "percent",
        "higher_is": "supportive",
        "public": True,
        "max_stale_days": 60,
        "notes": "Monthly U.S. personal saving rate; reflects share of disposable income saved.",
        "citation_notes": "U.S. Bureau of Economic Analysis, Personal Saving Rate [PSAVERT], via FRED. Free public.",
        "access_status": "free_public_active",
        "score_status": "active",
        "terms_status": "review_each_series",
        "active_scoring_allowed": True,
        "public_redistribution_allowed": True,
        "requires_secret": False,
        "horizon": "strategic",
        "regime_role": ["growth"],
        "preferred_chart": "line",
    },
    {
        "id": "cape_ratio",
        "name": "Shiller CAPE Ratio",
        "category": "sentiment",
        "source": "Robert Shiller / Yale",
        "provider_id": "multpl_shiller",
        "source_url": "http://www.econ.yale.edu/~shiller/data.htm",
        "endpoint_url": "",
        "frequency": "monthly",
        "units": "ratio",
        "higher_is": "riskier",
        "public": True,
        "max_stale_days": 45,
        "notes": "Cyclically Adjusted Price-to-Earnings ratio (S&P 500), monthly.",
        "citation_notes": "Cyclically Adjusted P/E ratio from Robert Shiller, Yale University.",
        "access_status": "free_public_active",
        "score_status": "active",
        "terms_status": "review_each_series",
        "active_scoring_allowed": True,
        "public_redistribution_allowed": True,
        "requires_secret": False,
        "horizon": "strategic",
        "regime_role": ["sentiment"],
        "preferred_chart": "line",
    },
    {
        "id": "ny_fed_acm_term_premium_candidate",
        "name": "NY Fed ACM 10-Year Term Premium (candidate)",
        "category": "rates",
        "source": "Federal Reserve Bank of New York",
        "provider_id": "ny_fed",
        "source_url": "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs",
        "endpoint_url": "",
        "frequency": "monthly",
        "units": "percent",
        "higher_is": "riskier",
        "public": False,
        "max_stale_days": 45,
        "notes": "Adrian-Crump-Moench 10Y term premium; candidate pending redistribution review.",
        "citation_notes": "NY Fed ACM term-premium estimates; candidate.",
        "access_status": "free_public_candidate",
        "score_status": "candidate",
        "terms_status": "review_each_series",
        "active_scoring_allowed": False,
        "public_redistribution_allowed": True,
        "requires_secret": False,
        "horizon": "strategic",
        "regime_role": ["real_yield"],
        "preferred_chart": "line",
    },
]
```

Extend `catalog_entries()` to include this list (after `CANDIDATE_SERIES_PHASE_A`):

```python
entries.extend(entry.copy() for entry in OFFICIAL_SOURCE_SERIES_PHASE_B)
```

- [ ] **Step 3: Regenerate JSON + run tests**

```bash
.venv/bin/python -c "import json; from pathlib import Path; from scripts.shared.catalog import catalog_entries; Path('public/data/catalog/series_catalog.json').write_text(json.dumps(catalog_entries(), indent=2) + '\n'); print(len(catalog_entries()), 'entries')"
.venv/bin/python -m pytest tests/python/test_official_sources_catalog_entries.py -v
```

Expected: 120 entries (105 base + 12 phase A candidates + 3 official sources); PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/shared/catalog.py public/data/catalog/series_catalog.json tests/python/test_official_sources_catalog_entries.py
git commit -m "feat(catalog): add Phase B official-source series entries

personal_saving_rate and cape_ratio (free_public_active);
ny_fed_acm_term_premium_candidate (free_public_candidate)."
```

---

### Task BO3: Implement `fetch_bea_personal_saving_rate.py`

**Dependencies:** Task BO1 (source review), BO2 (catalog entry).

**Files:**
- Create: `scripts/ingest/fetch_bea_personal_saving_rate.py`
- Modify: `scripts/update_data.py` (append `"scripts.ingest.fetch_bea_personal_saving_rate"` to `MODULES_INGEST_PHASE_B_OFFICIAL`)
- Modify: `scripts/validate/validate_schema.py` (add schema check for the new series file)
- Modify: `scripts/validate/validate_freshness.py` (add freshness expectation)
- Test: `tests/python/test_fetch_bea.py` (new)

- [ ] **Step 1: Read the existing FRED CSV fetcher**

Run: `grep -n "def \|fred" scripts/ingest/fetch_fred_csv.py | head -20`
Use its pattern (CSV download, normalize, write TimeSeriesFile JSON) as the template.

- [ ] **Step 2: Write the failing test (fixture-driven)**

Create `tests/python/test_fetch_bea.py`:

```python
from pathlib import Path

import pytest

from scripts.ingest import fetch_bea_personal_saving_rate as mod


def test_parse_fred_csv_basic(tmp_path: Path):
    csv_text = "DATE,VALUE\n2024-01-01,5.2\n2024-02-01,5.4\n"
    fixture = tmp_path / "psavert.csv"
    fixture.write_text(csv_text)
    series_file = mod.parse_csv(fixture)
    assert series_file["series_id"] == "personal_saving_rate"
    assert series_file["frequency"] == "monthly"
    assert series_file["units"] == "percent"
    obs = series_file["observations"]
    assert len(obs) == 2
    assert obs[0]["date"] == "2024-01-01" and obs[0]["value"] == 5.2
```

- [ ] **Step 3: Implement the ingest module**

Create `scripts/ingest/fetch_bea_personal_saving_rate.py` modelled on `scripts/ingest/fetch_fred_csv.py`. Key bits:

```python
"""Fetch BEA Personal Saving Rate (PSAVERT) from FRED."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

import requests

from scripts.shared.io import data_dir, write_json

ENDPOINT = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSAVERT"
SERIES_ID = "personal_saving_rate"


def parse_csv(path: Path) -> dict:
    rows = []
    with path.open() as fh:
        for row in csv.DictReader(fh):
            try:
                rows.append({"date": row["DATE"], "value": float(row["VALUE"])})
            except (KeyError, ValueError):
                continue
    return {
        "series_id": SERIES_ID,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "BEA / FRED",
        "source_url": "https://fred.stlouisfed.org/series/PSAVERT",
        "frequency": "monthly",
        "units": "percent",
        "observations": rows,
    }


def main() -> None:
    out = data_dir() / "series" / f"{SERIES_ID}.json"
    response = requests.get(ENDPOINT, timeout=30)
    response.raise_for_status()
    tmp = data_dir() / "series" / f"{SERIES_ID}.csv.tmp"
    tmp.write_text(response.text)
    payload = parse_csv(tmp)
    tmp.unlink()
    write_json(out, payload)
    print(f"Wrote {out} with {len(payload['observations'])} observations.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Append to MODULES sub-list**

Edit `scripts/update_data.py`:

```python
MODULES_INGEST_PHASE_B_OFFICIAL: list[str] = [
    "scripts.ingest.fetch_bea_personal_saving_rate",
]
```

- [ ] **Step 5: Add schema + freshness rules**

Add to `scripts/validate/validate_schema.py` (in the existing per-series check loop or a new helper):

```python
# personal_saving_rate: monthly TimeSeriesFile shape
_check_time_series_file(data_dir() / "series" / "personal_saving_rate.json", expected_frequency="monthly")
```

Add to `scripts/validate/validate_freshness.py`:

```python
EXPECTED_FRESHNESS["personal_saving_rate"] = timedelta(days=60)
```

(Match the exact pattern of existing entries in that file.)

- [ ] **Step 6: Run test + verification**

```bash
.venv/bin/python -m pytest tests/python/test_fetch_bea.py -v
.venv/bin/python -m scripts.validate.validate_schema
```

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest/fetch_bea_personal_saving_rate.py scripts/update_data.py scripts/validate/validate_schema.py scripts/validate/validate_freshness.py tests/python/test_fetch_bea.py
git commit -m "feat(ingest): add BEA personal saving rate ingest from FRED CSV"
```

---

### Task BO4: Implement `fetch_shiller_cape.py`

**Dependencies:** Task BO1, BO2.

**Files:**
- Create: `scripts/ingest/fetch_shiller_cape.py`
- Modify: `scripts/update_data.py` (append to `MODULES_INGEST_PHASE_B_OFFICIAL`)
- Modify: `scripts/validate/validate_schema.py`, `scripts/validate/validate_freshness.py`
- Modify: `requirements.txt` (add `openpyxl>=3.1,<4` if absent)
- Test: `tests/python/test_fetch_shiller_cape.py` (new)

Same overall shape as BO3 but reads Shiller's XLS (multiple sheets — CAPE is in the "Data" sheet, with the ratio in a known column) instead of CSV.

- [ ] **Step 1: Add `openpyxl` to requirements.txt if not present**

Run: `grep -c openpyxl requirements.txt`
If 0, append `openpyxl>=3.1,<4` and run `.venv/bin/pip install -r requirements.txt`.

- [ ] **Step 2: Write the failing test (fixture-driven)**

Create `tests/python/test_fetch_shiller_cape.py`. Use a small fixture XLS or monkeypatch `openpyxl.load_workbook` to return a fake worksheet:

```python
from pathlib import Path

from scripts.ingest import fetch_shiller_cape as mod


def test_parse_shiller_xls_extracts_cape(tmp_path: Path, monkeypatch):
    # Mock openpyxl to return rows: [(date, ..., cape), ...]
    fake_rows = [
        ("2024.01", 5000.0, 200.0, 35.5),
        ("2024.02", 5050.0, 201.0, 36.0),
    ]
    # ... monkeypatch the workbook loader to return fake_rows
    series_file = mod.parse_xls_rows(fake_rows)
    assert series_file["series_id"] == "cape_ratio"
    assert series_file["frequency"] == "monthly"
    assert series_file["units"] == "ratio"
    assert len(series_file["observations"]) == 2
    assert series_file["observations"][0]["value"] == 35.5
```

- [ ] **Step 3: Implement the ingest module**

Mirror BO3's structure. Endpoint: `http://www.econ.yale.edu/~shiller/data/ie_data.xls` (verify on the canonical page; the exact filename may change). Use `openpyxl.load_workbook` with `read_only=True`. Extract the CAPE column from the "Data" sheet (skip header rows; the column index depends on the workbook layout — confirm in source review). Output to `public/data/series/cape_ratio.json` with the same `TimeSeriesFile` shape as BO3.

- [ ] **Step 4: Append to MODULES sub-list**

```python
MODULES_INGEST_PHASE_B_OFFICIAL.append("scripts.ingest.fetch_shiller_cape")
```
(Or extend the list literal in place — same effect.)

- [ ] **Step 5: Add schema + freshness rules**

Same pattern as BO3 Step 5. Use `expected_frequency="monthly"` and `EXPECTED_FRESHNESS["cape_ratio"] = timedelta(days=45)`.

- [ ] **Step 6: Run test + validators**

```bash
.venv/bin/python -m pytest tests/python/test_fetch_shiller_cape.py -v
.venv/bin/python -m scripts.validate.validate_schema
```

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest/fetch_shiller_cape.py scripts/update_data.py scripts/validate/validate_schema.py scripts/validate/validate_freshness.py requirements.txt tests/python/test_fetch_shiller_cape.py
git commit -m "feat(ingest): add Shiller CAPE ratio ingest from Yale XLS"
```

---

### Task BO5: Implement `fetch_nyfed_acm_term_premium.py`

**Dependencies:** Task BO1, BO2.

**Files:**
- Create: `scripts/ingest/fetch_nyfed_acm_term_premium.py`
- Modify: `scripts/update_data.py` (append to `MODULES_INGEST_PHASE_B_OFFICIAL`)
- Modify: `scripts/validate/validate_schema.py`, `scripts/validate/validate_freshness.py`
- Test: `tests/python/test_fetch_nyfed_acm.py` (new)

**Output path differs from BO3/BO4.** Because `access_status` is `free_public_candidate`, the output goes to `public/data/candidates/ny_fed_acm_term_premium_candidate.json` — NOT to `series/`.

The output JSON carries `access_status: "free_public_candidate"`, `active_scoring_allowed: false`, `public_redistribution_allowed: true`, `requires_secret: false`.

- [ ] **Step 1: Write the failing test (XLS fixture)**

Same shape as BO4 Step 2 but parses the NY Fed ACM XLS columns (10Y term premium is column `ACMTP10`).

- [ ] **Step 2: Implement the ingest module**

Endpoint: `https://www.newyorkfed.org/medialibrary/media/research/data_indicators/ACMTermPremium.xls` (confirm on the NY Fed term-premia page; the canonical URL may change). Output path:

```python
out = data_dir() / "candidates" / "ny_fed_acm_term_premium_candidate.json"
```

The output payload MUST include candidate metadata:

```python
payload = {
    "series_id": "ny_fed_acm_term_premium_candidate",
    "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    "source": "Federal Reserve Bank of New York",
    "source_url": "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs",
    "frequency": "monthly",
    "units": "percent",
    "access_status": "free_public_candidate",
    "score_status": "candidate",
    "active_scoring_allowed": False,
    "public_redistribution_allowed": True,
    "requires_secret": False,
    "notes": "NY Fed ACM 10-year term premium; candidate pending redistribution review.",
    "observations": [...],
}
```

- [ ] **Step 3: Append to MODULES sub-list**

```python
MODULES_INGEST_PHASE_B_OFFICIAL.append("scripts.ingest.fetch_nyfed_acm_term_premium")
```

- [ ] **Step 4: Add schema + freshness rules**

Add a candidate-file schema check pattern (since the file lives under `candidates/`, validate_schema enforces `active_scoring_allowed: false`). Freshness: `EXPECTED_FRESHNESS["ny_fed_acm_term_premium_candidate"] = timedelta(days=45)`.

- [ ] **Step 5: Run test + validators**

```bash
.venv/bin/python -m pytest tests/python/test_fetch_nyfed_acm.py -v
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_candidate_isolation
```

- [ ] **Step 6: Commit**

```bash
git add scripts/ingest/fetch_nyfed_acm_term_premium.py scripts/update_data.py scripts/validate/validate_schema.py scripts/validate/validate_freshness.py tests/python/test_fetch_nyfed_acm.py
git commit -m "feat(ingest): add NY Fed ACM 10Y term premium candidate ingest"
```

---

### Task BO6: Implement `build_treasury_supply_pressure.py`

**Dependencies:** existing `public/data/series/treasury_auction_supply.json`.

**Files:**
- Create: `scripts/transform/build_treasury_supply_pressure.py`
- Modify: `scripts/update_data.py` (append to `MODULES_TRANSFORM_PHASE_B`)
- Modify: validators
- Test: `tests/python/test_build_treasury_supply_pressure.py` (new)

Reads `treasury_auction_supply.json`. Computes a derived metric: 30-day trailing sum of auction amounts as a percentage of the trailing 365-day mean of 30-day trailing sums. Output to `public/data/derived/treasury_supply_pressure.json` with `access_status: free_public_active`.

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_build_treasury_supply_pressure.py`:

```python
from datetime import datetime, timedelta

from scripts.transform import build_treasury_supply_pressure as mod


def test_compute_pressure_returns_percent_above_average():
    # Build a synthetic series: 30-day trailing sum = 100 every day for 365 days,
    # then 150 on day 366. Pressure on day 366 should be 1.5 (or 150%).
    series = [{"date": (datetime(2024, 1, 1) + timedelta(days=i)).isoformat(), "value": 100} for i in range(365)]
    series.append({"date": (datetime(2024, 1, 1) + timedelta(days=365)).isoformat(), "value": 150})
    result = mod.compute_supply_pressure(series, window_days=30, baseline_days=365)
    last = result[-1]
    assert last["pressure_ratio"] > 1.0
```

- [ ] **Step 2: Implement the transform**

Pattern follows existing derived builders (e.g. `scripts/transform/build_rates_dashboard.py`):

```python
"""Compute treasury auction supply pressure (30-day sum / trailing-year mean)."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from scripts.shared.io import data_dir, write_json


def compute_supply_pressure(observations, window_days=30, baseline_days=365):
    # observations: list of {"date": ISO, "value": float}
    # Returns list of {"date": ISO, "pressure_ratio": float, "window_sum": float}
    ...


def main():
    src = data_dir() / "series" / "treasury_auction_supply.json"
    series = json.loads(src.read_text())["observations"]
    points = compute_supply_pressure(series)
    payload = {
        "series_id": "treasury_supply_pressure",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "Derived",
        "source_url": "/data",
        "frequency": "event",
        "units": "ratio",
        "access_status": "free_public_active",
        "score_status": "active",
        "active_scoring_allowed": True,
        "public_redistribution_allowed": True,
        "requires_secret": False,
        "observations": points,
    }
    write_json(data_dir() / "derived" / "treasury_supply_pressure.json", payload)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Append to MODULES_TRANSFORM_PHASE_B**

```python
MODULES_TRANSFORM_PHASE_B.append("scripts.transform.build_treasury_supply_pressure")
```

- [ ] **Step 4: Add the new derived file to validators**

Schema: validate `pressure_ratio` is numeric and present on each observation. Freshness: `EXPECTED_FRESHNESS["treasury_supply_pressure"] = timedelta(days=30)`.

- [ ] **Step 5: Add a series_catalog entry**

Add to `catalog.py` (extending `OFFICIAL_SOURCE_SERIES_PHASE_B` or as a new derived-entry list):

```python
{
    "id": "treasury_supply_pressure",
    "name": "Treasury Supply Pressure",
    "category": "rates",
    "source": "Derived",
    "provider_id": "derived",
    "source_url": "/data",
    "endpoint_url": "",
    "frequency": "event",
    "units": "ratio",
    "higher_is": "riskier",
    "public": True,
    "max_stale_days": 30,
    "notes": "30-day trailing auction sum as percent of trailing-year average.",
    "citation_notes": "Computed from treasury_auction_supply.json.",
    "access_status": "free_public_active",
    "score_status": "active",
    "terms_status": "ok",
    "active_scoring_allowed": True,
    "public_redistribution_allowed": True,
    "requires_secret": False,
    "horizon": "tactical",
    "regime_role": ["nominal_yield"],
    "preferred_chart": "line",
},
```

Regenerate JSON.

- [ ] **Step 6: Run test + validators**

```bash
.venv/bin/python -m pytest tests/python/test_build_treasury_supply_pressure.py -v
.venv/bin/python -m scripts.validate.validate_schema
```

- [ ] **Step 7: Commit**

```bash
git add scripts/transform/build_treasury_supply_pressure.py scripts/update_data.py scripts/shared/catalog.py public/data/catalog/series_catalog.json scripts/validate/validate_schema.py scripts/validate/validate_freshness.py tests/python/test_build_treasury_supply_pressure.py
git commit -m "feat(transform): add treasury supply pressure derived metric"
```

---

### Task BO7: Verification + PR

- [ ] Run base gate (`pytest`, `npm test`, `npm run build`, `validate_schema`, `validate_freshness`, `validate_candidate_isolation`)
- [ ] Run `update_data` smoke test (network-conditional)
- [ ] Confirm all four new outputs exist and validate
- [ ] Commit any remaining changes
- [ ] Open PR titled "Phase B: official-sources-agent"

---

## Chunk 5: Phase B — cboe-candidate-agent + sentiment-candidate-agent

**Branches:** `feat/data-source-phase-b-cboe-candidate` AND `feat/data-source-phase-b-sentiment-candidate` (two separate PRs, same chunk for review economy).
**Depends on:** Phase A merged.

These two agents own disjoint files. Each agent runs the steps in its own worktree branch.

### Worktree bootstrap (run separately for each branch)

```bash
git worktree add .worktrees/phaseB-cboe -b feat/data-source-phase-b-cboe-candidate origin/main
git worktree add .worktrees/phaseB-sentiment -b feat/data-source-phase-b-sentiment-candidate origin/main
```

---

### Task BC1: cboe-candidate-agent — fetch Cboe put/call CSV

**Files:**
- Create: `scripts/ingest/fetch_cboe_put_call.py`
- Modify: `scripts/update_data.py` (`MODULES_INGEST_PHASE_B_CBOE`)
- Modify: `scripts/validate/validate_schema.py`, `scripts/validate/validate_freshness.py`
- Test: `tests/python/test_fetch_cboe_put_call.py`

Fetches Cboe options market statistics. The Cboe daily-market-stats CSV at `https://cdn.cboe.com/api/global/us_indices/daily_prices/.../...` typically returns a single multi-column CSV with the five ratios (total, index, equity, vix, spxw) in separate columns. Confirm in source review (`docs/source_reviews/cboe_put_call.md`). If the source returns separate CSVs per ratio, split into five fetches.

Each output carries `access_status: "free_public_candidate"`, `active_scoring_allowed: false`, `public_redistribution_allowed: true`, `requires_secret: false`. Series catalog entries were pre-added by Phase A Task A5.

- [ ] **Step 1: Confirm CSV structure**

Examine the source CSV (download once manually, or follow source-review notes). Decide whether the script makes one fetch and splits into 5 outputs, or makes 5 separate fetches.

- [ ] **Step 2: Write the failing test (fixture-driven)**

Create `tests/python/test_fetch_cboe_put_call.py` with a small CSV fixture containing date + 5 ratio columns. Assert the parser produces 5 separate `TimeSeriesFile`-shaped dicts keyed by ratio name.

- [ ] **Step 3: Implement the ingest module**

Same shape as `fetch_bea_personal_saving_rate.py` from Task BO3, but writes 5 output files under `public/data/candidates/`. Each output is a candidate file (carries the 4 governance fields per Task BO5).

- [ ] **Step 4: Append to `MODULES_INGEST_PHASE_B_CBOE`**

```python
MODULES_INGEST_PHASE_B_CBOE.append("scripts.ingest.fetch_cboe_put_call")
```

- [ ] **Step 5: Schema + freshness**

Add 5 entries to `EXPECTED_FRESHNESS` (each `timedelta(days=7)`). Add candidate-file schema check (validate_schema enforces `active_scoring_allowed: false` for all 5).

- [ ] **Step 6: Run tests + validators**

```bash
.venv/bin/python -m pytest tests/python/test_fetch_cboe_put_call.py -v
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_candidate_isolation
```

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest/fetch_cboe_put_call.py scripts/update_data.py scripts/validate/validate_schema.py scripts/validate/validate_freshness.py tests/python/test_fetch_cboe_put_call.py
git commit -m "feat(ingest): add Cboe put/call ratio candidate ingest (5 ratios)"
```

---

### Task BC2: cboe-candidate-agent — fetch Cboe VX settlements + curve context

**Files:**
- Create: `scripts/ingest/fetch_cboe_vx_settlements.py`
- Create: `scripts/transform/build_vx_curve_context.py`
- Modify: `scripts/update_data.py` (append to `MODULES_INGEST_PHASE_B_CBOE` and a new `MODULES_TRANSFORM_PHASE_B_CBOE` if needed)
- Modify: `scripts/validate/validate_schema.py`, `scripts/validate/validate_freshness.py`
- Test: `tests/python/test_fetch_cboe_vx.py`, `tests/python/test_build_vx_curve_context.py`

Fetches VX1/VX2/VX3 settlement data from Cboe Futures (3 outputs); derives 2 more files via the transform (`vx_front_spread_candidate`, `vx_contango_score_candidate`). All five carry `free_public_candidate` governance.

Computation rules pinned:
- `vx_front_spread = settle(VX2) - settle(VX1)` (per observation day where both exist).
- `vx_contango_score = percentile rank of vx_front_spread across the trailing 504 trading days` (~2 years).

- [ ] **Step 1: Pin the Cboe VX endpoint**

Confirm the canonical CSV path from `docs/source_reviews/vix_futures_curve.md`. Typical Cboe paths return one CSV per expiry; the script may need to request the front 3 expiries by symbol.

- [ ] **Step 2: Write failing tests**

Create `tests/python/test_fetch_cboe_vx.py` with a small CSV fixture containing settlement rows for VX1/VX2/VX3. Assert 3 output dicts.

Create `tests/python/test_build_vx_curve_context.py` with a synthetic series and assert `vx_front_spread` equals `vx2 - vx1` per date, and `vx_contango_score` percentile-ranks correctly.

- [ ] **Step 3: Implement `fetch_cboe_vx_settlements.py`**

Output 3 candidate files to `public/data/candidates/`: `vx1_candidate.json`, `vx2_candidate.json`, `vx3_candidate.json`. Each has the candidate governance shape.

- [ ] **Step 4: Implement `build_vx_curve_context.py`**

Reads the 3 VX candidate files. Computes:
- `vx_front_spread_candidate.json` — per-date `vx2 - vx1`.
- `vx_contango_score_candidate.json` — trailing-504 percentile rank of the spread.

Both outputs are candidate files.

- [ ] **Step 5: Append to MODULES**

```python
MODULES_INGEST_PHASE_B_CBOE.append("scripts.ingest.fetch_cboe_vx_settlements")
MODULES_INGEST_PHASE_B_CBOE.append("scripts.transform.build_vx_curve_context")
```
(Transforms can live in the ingest sub-list since the per-phase sub-list is just a list of modules to run in order.)

- [ ] **Step 6: Schema + freshness**

5 entries in `EXPECTED_FRESHNESS` (daily). Candidate-file schema check.

- [ ] **Step 7: Run tests + validators**

```bash
.venv/bin/python -m pytest tests/python/test_fetch_cboe_vx.py tests/python/test_build_vx_curve_context.py -v
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_candidate_isolation
```

- [ ] **Step 8: Commit**

```bash
git add scripts/ingest/fetch_cboe_vx_settlements.py scripts/transform/build_vx_curve_context.py scripts/update_data.py scripts/validate/validate_schema.py scripts/validate/validate_freshness.py tests/python/test_fetch_cboe_vx.py tests/python/test_build_vx_curve_context.py
git commit -m "feat(ingest): add Cboe VX1/VX2/VX3 candidate ingest + curve context"
```

---

### Task BC3: cboe-candidate-agent — verification + PR

- [ ] Run base + extended gate
- [ ] Confirm 10 candidate files validate
- [ ] PR titled "Phase B: cboe-candidate-agent"

---

### Task BS1: sentiment-candidate-agent — implement NAAIM ingest (ingest only, no committed JSON)

**Files:**
- Create: `scripts/ingest/fetch_naaim_candidate.py`
- Modify: `scripts/update_data.py` (`MODULES_INGEST_PHASE_B_SENTIMENT`)
- Test: `tests/python/test_fetch_naaim.py`

Per the spec's Option A decision, the ingest script lands but no candidate JSON is committed (NAAIM is `terms_review_needed`, so `public_redistribution_allowed: false`). The ingest script runs in CI, writes to a local file, but the file is gitignored (add `public/data/candidates/naaim_exposure_candidate.json` to `.gitignore` if not already).

Steps:
- [ ] Write fetch logic for NAAIM XLS
- [ ] Add the candidates filename to `.gitignore` under `public/data/candidates/naaim_*`
- [ ] Append to MODULES
- [ ] Test that the fetch runs cleanly with a fixture XLS
- [ ] Commit (only the script + .gitignore + test; no JSON)

---

### Task BS2: sentiment-candidate-agent — implement AAII ingest (ingest only)

**Files:**
- Create: `scripts/ingest/fetch_aaii_candidate.py`
- Modify: `scripts/update_data.py` (`MODULES_INGEST_PHASE_B_SENTIMENT`)
- Modify: `.gitignore` (add `public/data/candidates/aaii_*`)
- Test: `tests/python/test_fetch_aaii.py`

Same shape as BS1 for AAII Sentiment Survey. Endpoint: confirm from `docs/source_reviews/aaii_naaim.md`; AAII publishes a weekly XLS or CSV. Output to `public/data/candidates/aaii_sentiment_candidate.json` (gitignored).

- [ ] **Step 1: Add gitignore entry**

```bash
echo "public/data/candidates/aaii_*" >> .gitignore
```

- [ ] **Step 2: Write the failing test (fixture-driven)**

Same pattern as BS1; assert the parser yields a weekly series with `access_status: "terms_review_needed"`.

- [ ] **Step 3: Implement `fetch_aaii_candidate.py`**

Pattern follows BS1. Output payload includes `access_status: "terms_review_needed"`, `active_scoring_allowed: false`, `public_redistribution_allowed: false`, `requires_secret: false`.

- [ ] **Step 4: Append to MODULES_INGEST_PHASE_B_SENTIMENT**

- [ ] **Step 5: Run test**

```bash
.venv/bin/python -m pytest tests/python/test_fetch_aaii.py -v
```

- [ ] **Step 6: Commit (only the script + .gitignore + test; NO JSON file)**

```bash
git status --short
# Confirm NO public/data/candidates/aaii_*.json is staged.
git add scripts/ingest/fetch_aaii_candidate.py scripts/update_data.py .gitignore tests/python/test_fetch_aaii.py
git commit -m "feat(ingest): add AAII sentiment candidate ingest (no committed JSON)"
```

---

### Task BS3: sentiment-candidate-agent — verification + PR

- [ ] Run base gate
- [ ] Confirm no NAAIM/AAII JSON in `public/data/candidates/`
- [ ] PR titled "Phase B: sentiment-candidate-agent"

---

## Chunk 6: Phase C — TradingView authenticated candidates (tasks C1–C9)

**Branch:** `feat/data-source-phase-c-tradingview`
**Worktree:** `.worktrees/phaseC`
**Depends on:** Phase A merged.

### Worktree bootstrap

```bash
git worktree add .worktrees/phaseC -b feat/data-source-phase-c-tradingview origin/main
cd .worktrees/phaseC
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

---

### Task C1: Write source-review doc

**Files:**
- Create: `docs/source_reviews/tradingview_authenticated_candidates.md`

Pin the TradingView client (e.g. `tvdatafeed-fork>=1.5,<2`) and document:
- access_status: authenticated_candidate
- requires_secret: true
- public_redistribution_allowed: false (but file is committed; see spec's note)
- Cache dir: must be set under `tempfile.gettempdir()` via env var
- Exception scrubbing: must strip credentials from error messages

Commit.

---

### Task C2: Add `scripts/shared/config.py` secret helpers

**Files:**
- Create: `scripts/shared/config.py`
- Test: `tests/python/test_config_secrets.py`

- [ ] Write the failing test that exercises `secret()`, `authenticated_candidates_enabled()`, and `tradingview_credentials_available()` against monkeypatched env values.

- [ ] Implement the module per the spec's §"Secret helpers" code block:

```python
import os


def secret(name: str) -> str | None:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else None


def authenticated_candidates_enabled() -> bool:
    return os.environ.get("ENABLE_AUTHENTICATED_CANDIDATES", "").lower() == "true"


def tradingview_credentials_available() -> bool:
    return (
        authenticated_candidates_enabled()
        and secret("TRADINGVIEW_USERNAME") is not None
        and secret("TRADINGVIEW_PASSWORD") is not None
    )
```

Helpers never log values. Test asserts behavior across all enabled/disabled combinations.

- [ ] Commit.

---

### Task C3: Update `requirements.txt`

**Files:**
- Modify: `requirements.txt`

Append:

```
pandas>=2.2,<3
requests>=2.32,<3
tvdatafeed-fork>=1.5,<2
```

Verify: `.venv/bin/pip install -r requirements.txt` succeeds.

Commit.

---

### Task C4: Add catalog entries for 3 TV candidates

**Files:**
- Modify: `scripts/shared/catalog.py` (add `TRADINGVIEW_CANDIDATE_SERIES`)
- Modify (regenerated): `public/data/catalog/series_catalog.json`
- Test: `tests/python/test_tradingview_catalog_entries.py`

Follow Phase A Task A5 pattern. Three entries (`tradingview_move_candidate`, `tradingview_put_call_candidate`, `tradingview_vx_curve_candidate`) with `access_status: "authenticated_candidate"`, `requires_secret: true`, `provider_id: "tradingview"`.

Regenerate JSON; commit.

---

### Task C5: Implement `fetch_tradingview_move.py`

**Files:**
- Create: `scripts/ingest/fetch_tradingview_move.py`
- Modify: `scripts/update_data.py` (`MODULES_INGEST_PHASE_C_TRADINGVIEW`)
- Test: `tests/python/test_fetch_tradingview_move.py` (mocks the TV client)

**TV library API (chosen in Task C1):** the `tvdatafeed-fork` package exposes `from tvDatafeed import TvDatafeed, Interval`. Authentication is via constructor: `tv = TvDatafeed(username, password)`. Data fetch: `tv.get_hist(symbol="MOVE", exchange="ICEUS", interval=Interval.in_daily, n_bars=5000)` returns a pandas DataFrame with index = date, columns = `["open","high","low","close","volume"]`. The exact `symbol` and `exchange` for MOVE must be confirmed in the source review (C1) — the ICE-listed MOVE Index is published on TradingView under a specific identifier.

- [ ] **Step 1: Write the failing test**

Create `tests/python/test_fetch_tradingview_move.py`:

```python
import os
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from scripts.ingest import fetch_tradingview_move as mod


def _enable_secrets(monkeypatch):
    monkeypatch.setenv("ENABLE_AUTHENTICATED_CANDIDATES", "true")
    monkeypatch.setenv("TRADINGVIEW_USERNAME", "fake-user-token-abc123")
    monkeypatch.setenv("TRADINGVIEW_PASSWORD", "fake-pass-token-xyz789")


def test_skips_when_secrets_disabled(monkeypatch, capsys):
    monkeypatch.delenv("ENABLE_AUTHENTICATED_CANDIDATES", raising=False)
    mod.main()
    captured = capsys.readouterr()
    assert "skipping" in captured.out.lower()


def test_writes_candidate_file_on_success(monkeypatch, tmp_path):
    _enable_secrets(monkeypatch)
    from scripts.shared import io as shared_io
    monkeypatch.setattr(shared_io, "data_dir", lambda: tmp_path)
    (tmp_path / "candidates").mkdir()

    fake_df = pd.DataFrame(
        {"close": [120.0, 121.5]},
        index=pd.to_datetime(["2024-01-01", "2024-01-02"]),
    )
    fake_tv = MagicMock()
    fake_tv.get_hist.return_value = fake_df
    with patch.object(mod, "_build_tv_client", return_value=fake_tv):
        mod.main()

    out = tmp_path / "candidates" / "tradingview_move_candidate.json"
    assert out.exists()
    import json
    payload = json.loads(out.read_text())
    assert payload["series_id"] == "tradingview_move_candidate"
    assert payload["access_status"] == "authenticated_candidate"
    assert payload["requires_secret"] is True
    assert len(payload["observations"]) == 2


def test_scrubs_credentials_from_error(monkeypatch, capsys):
    _enable_secrets(monkeypatch)
    fake_tv = MagicMock()
    fake_tv.get_hist.side_effect = RuntimeError(
        "login failed for fake-user-token-abc123"
    )
    with patch.object(mod, "_build_tv_client", return_value=fake_tv):
        mod.main()
    captured = capsys.readouterr()
    assert "fake-user-token-abc123" not in captured.out
    assert "fake-user-token-abc123" not in captured.err
```

- [ ] **Step 2: Implement the ingest module**

Create `scripts/ingest/fetch_tradingview_move.py`:

```python
"""Fetch MOVE-like series from TradingView (authenticated candidate)."""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from scripts.shared.config import (
    authenticated_candidates_enabled,
    secret,
    tradingview_credentials_available,
)
from scripts.shared.io import data_dir, write_json

SERIES_ID = "tradingview_move_candidate"
TV_SYMBOL = "MOVE"          # confirm in source review
TV_EXCHANGE = "ICEUS"       # confirm in source review
N_BARS = 5000


def _build_tv_client():
    """Factory; isolated so tests can patch it."""
    from tvDatafeed import TvDatafeed  # type: ignore
    return TvDatafeed(secret("TRADINGVIEW_USERNAME"), secret("TRADINGVIEW_PASSWORD"))


def _scrub_credentials(text: str) -> str:
    for name in ("TRADINGVIEW_USERNAME", "TRADINGVIEW_PASSWORD"):
        value = secret(name)
        if value and value in text:
            text = text.replace(value, f"<scrubbed {name}>")
    return text


def _write_payload(rows: list[dict]) -> None:
    payload = {
        "series_id": SERIES_ID,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "TradingView",
        "source_url": "https://www.tradingview.com",
        "frequency": "daily",
        "units": "index",
        "access_status": "authenticated_candidate",
        "score_status": "candidate",
        "active_scoring_allowed": False,
        "public_redistribution_allowed": False,
        "requires_secret": True,
        "notes": "Authenticated TradingView candidate; not treated as official ICE MOVE.",
        "observations": rows,
    }
    out = data_dir() / "candidates" / f"{SERIES_ID}.json"
    write_json(out, payload)


def main() -> None:
    if not tradingview_credentials_available():
        print(f"{SERIES_ID}: secrets missing or disabled; skipping.")
        return
    try:
        from tvDatafeed import Interval  # type: ignore  # noqa: F401
    except ImportError:
        print(f"{SERIES_ID}: TradingView library not installed; skipping.")
        return

    os.environ.setdefault("TVDATAFEED_CACHE_DIR", tempfile.mkdtemp(prefix="tv_cache_"))
    try:
        tv = _build_tv_client()
        from tvDatafeed import Interval as _Interval  # type: ignore
        df = tv.get_hist(symbol=TV_SYMBOL, exchange=TV_EXCHANGE, interval=_Interval.in_daily, n_bars=N_BARS)
    except Exception as exc:
        msg = _scrub_credentials(str(exc))
        print(f"{SERIES_ID}: TradingView fetch failed: {msg}", file=sys.stderr)
        return

    rows = [
        {"date": ts.strftime("%Y-%m-%d"), "value": float(row["close"])}
        for ts, row in df.iterrows()
    ]
    _write_payload(rows)
    print(f"{SERIES_ID}: wrote {len(rows)} observations.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Append to MODULES_INGEST_PHASE_C_TRADINGVIEW**

- [ ] **Step 4: Run the test**

```bash
.venv/bin/python -m pytest tests/python/test_fetch_tradingview_move.py -v
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/fetch_tradingview_move.py scripts/update_data.py tests/python/test_fetch_tradingview_move.py
git commit -m "feat(ingest): add TradingView MOVE candidate ingest with secret scrubbing"
```

---

### Task C6: Implement `fetch_tradingview_put_call.py` and `fetch_tradingview_vx_curve.py`

C5 covered MOVE. C6 adds the remaining two scripts (put_call and vx_curve), bringing the total to three TV ingest scripts.

**Files:**
- Create: `scripts/ingest/fetch_tradingview_put_call.py`
- Create: `scripts/ingest/fetch_tradingview_vx_curve.py`
- Modify: `scripts/update_data.py` (append both to `MODULES_INGEST_PHASE_C_TRADINGVIEW`)
- Test: `tests/python/test_fetch_tradingview_put_call.py`, `tests/python/test_fetch_tradingview_vx_curve.py`

- [ ] **Step 1: Implement `fetch_tradingview_put_call.py`**

Identical structure to C5's MOVE script. Change:
- `SERIES_ID = "tradingview_put_call_candidate"`
- `TV_SYMBOL` and `TV_EXCHANGE` per source review (TradingView may publish put/call ratios as composite or per-product symbols)
- Notes: "Authenticated TradingView candidate; not treated as official Cboe put/call."

- [ ] **Step 2: Implement `fetch_tradingview_vx_curve.py`**

Output `tradingview_vx_curve_candidate.json`. May fetch the VIX futures continuous front or term-structure depending on TV symbol availability (confirm in source review).

- [ ] **Step 3: Mirror C5's tests for both new scripts**

Each test covers: skip-on-missing-secrets, write-on-success, credential-scrubbing-on-error.

- [ ] **Step 4: Run tests**

```bash
.venv/bin/python -m pytest tests/python/test_fetch_tradingview_put_call.py tests/python/test_fetch_tradingview_vx_curve.py -v
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/fetch_tradingview_put_call.py scripts/ingest/fetch_tradingview_vx_curve.py scripts/update_data.py tests/python/test_fetch_tradingview_put_call.py tests/python/test_fetch_tradingview_vx_curve.py
git commit -m "feat(ingest): add TradingView put/call and VX curve candidate ingest"
```

---

### Task C7: Add `tests/python/test_secrets_isolation.py`

**Files:**
- Create: `tests/python/test_secrets_isolation.py`

Per the spec's §"Secret-isolation test" section:

1. `secret()` strips and returns None for empty values.
2. `tradingview_credentials_available()` is False without env vars.
3. **Allowlist check:** secret-name strings appear only in the allowlist files (`.github/workflows/update-data.yml`, `scripts/shared/config.py`, `scripts/ingest/fetch_tradingview_*.py`, `docs/source_reviews/tradingview_authenticated_candidates.md`, `tests/python/test_secrets_isolation.py`, this plan + spec docs). Implementation: enumerate `grep -rE ...` matches, subtract allowlist, assert empty.
4. **Secret-VALUE leak check:** set fake env values (`os.environ["TRADINGVIEW_USERNAME"] = "fake-user-token-abc123"` etc.); invoke each TV ingest script in a sandbox; assert the fake value never appears in any committed file under `public/`, `docs/`, `scripts/`, nor in `caplog` output.
5. **Cache-path-under-tempdir check.** Assert that after invoking any TV ingest script (mock the client to return an empty DataFrame), the env var `TVDATAFEED_CACHE_DIR` is set and its value starts with `/tmp` or matches `tempfile.gettempdir()`. Concretely:

```python
import os
import tempfile

def test_cache_dir_is_tempdir():
    # invoke a TV ingest script's main() with mocks
    ...
    cache_dir = os.environ.get("TVDATAFEED_CACHE_DIR", "")
    assert cache_dir.startswith(tempfile.gettempdir()), (
        f"cache dir {cache_dir!r} must be under tempdir"
    )
```

Commit.

---

### Task C8: Update `.github/workflows/update-data.yml` env block

**Files:**
- Modify: `.github/workflows/update-data.yml`

Add to the existing data-fetch step's `env:` block:

```yaml
env:
  # ...existing keys preserved...
  TRADINGVIEW_USERNAME: ${{ secrets.TRADINGVIEW_USERNAME }}
  TRADINGVIEW_PASSWORD: ${{ secrets.TRADINGVIEW_PASSWORD }}
  ENABLE_AUTHENTICATED_CANDIDATES: ${{ secrets.ENABLE_AUTHENTICATED_CANDIDATES }}
```

No other workflow changes (no new step, no new job, no schedule change).

Commit.

---

### Task C9: Phase C verification + PR

- [ ] Run base + extended gate including `test_secrets_isolation.py`
- [ ] Confirm secret-NAME allowlist check passes
- [ ] Confirm secret-VALUE leak test passes against fake env values
- [ ] Confirm cache-dir under `/tmp`
- [ ] PR titled "Phase C: TradingView authenticated candidates"

---

## Chunk 7: Phase D — FocusBlock + page focus audit (tasks D1–D8)

**Branch:** `feat/data-source-phase-d-focus-block`
**Worktree:** `.worktrees/phaseD`
**Depends on:** Phase A merged. Phase B/C may or may not be merged — Phase D defensively handles absent candidate files.

### Worktree bootstrap

```bash
git worktree add .worktrees/phaseD -b feat/data-source-phase-d-focus-block origin/main
cd .worktrees/phaseD
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm install
```

---

### Task D1: Add `SectionId` and `SectionInsight` types

**Files:**
- Modify: `src/lib/types.ts`

Append after the existing `RouteInsight` interface:

```ts
export type SectionId =
  | "volatility_complex"
  | "rates_pressure"
  | "regime_drivers"
  | "positioning_vs_candidate_sentiment"
  | "tactical_stress_board";

export interface SectionInsight {
  id: SectionId;
  eyebrow: string;
  question: string;        // ≤ 120 chars
  answer: string;          // 60-200 chars
  why?: string;            // ≤ 200 chars
  risk?: string;           // ≤ 120 chars
  support?: string;        // ≤ 120 chars
  caveat?: string;         // ≤ 200 chars
  freshness_status: SignalFreshnessStatus;
}
```

Extend `RouteInsight`:

```ts
export interface RouteInsight {
  // existing fields preserved
  sections?: SectionInsight[];
}
```

Build + commit.

---

### Task D2: Create `src/components/FocusBlock.tsx` + test

**Files:**
- Create: `src/components/FocusBlock.tsx`
- Create: `src/components/FocusBlock.test.tsx`

- [ ] Write failing vitest covering both variants, all field combinations, freshness-stale styling.

- [ ] Implement the component per the spec's §"Component spec":

```tsx
import { SignalFreshnessStatus } from "../lib/types";

type FocusBlockProps = {
  variant: "section" | "compact";
  eyebrow?: string;
  question: string;
  answer: string;
  why?: string;
  risk?: string;
  support?: string;
  caveat?: string;
  freshnessStatus?: SignalFreshnessStatus;
  ariaLabel?: string;
};

export default function FocusBlock(props: FocusBlockProps) {
  const isStale = props.freshnessStatus && props.freshnessStatus !== "ok";
  const className = `focus-block focus-block--${props.variant}` + (isStale ? " focus-block--stale" : "");
  return (
    <section className={className} aria-label={props.ariaLabel ?? props.question}>
      {props.eyebrow && <p className="focus-block__eyebrow">{props.eyebrow}</p>}
      <h2 className="focus-block__question">{props.question}</h2>
      <p className="focus-block__answer">{props.answer}</p>
      {props.why && <p className="focus-block__why">{props.why}</p>}
      <dl className="focus-block__signals">
        {props.risk && <><dt>Risk</dt><dd>{props.risk}</dd></>}
        {props.support && <><dt>Support</dt><dd>{props.support}</dd></>}
      </dl>
      {props.caveat && <p className="focus-block__caveat">{props.caveat}</p>}
    </section>
  );
}
```

- [ ] Add baseline CSS for FocusBlock.

Either create `src/components/FocusBlock.css` or extend the existing component-CSS bundle. Required selectors:

```css
.focus-block {
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background: var(--color-surface-1, #1a1f29);
  border: 1px solid var(--color-border, #2a3140);
  margin-bottom: 1rem;
}
.focus-block--compact {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
}
.focus-block--stale {
  opacity: 0.6;
  border-style: dashed;
}
.focus-block__eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted, #9aa3b2);
  margin: 0 0 0.25rem 0;
}
.focus-block__question {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--color-text, #e6eaf2);
}
.focus-block__answer {
  font-size: 0.95rem;
  color: var(--color-text, #e6eaf2);
  margin: 0 0 0.5rem 0;
}
.focus-block__why,
.focus-block__caveat {
  font-size: 0.85rem;
  color: var(--color-text-muted, #9aa3b2);
}
.focus-block__signals {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 0.5rem;
  font-size: 0.85rem;
  margin: 0.5rem 0;
}
.focus-block__signals dt { color: var(--color-text-muted, #9aa3b2); }
```

Adjust variable names to match the project's existing CSS variables. The structure mirrors the existing `PageInsightHero` and `InsightCallout` styling.
- [ ] Run vitest; commit.

---

### Task D3: Extend `build_page_insights.py` with `SECTION_CATALOG`

**Files:**
- Modify: `scripts/transform/build_page_insights.py`
- Test: `tests/python/test_section_catalog.py` (new)

**Data spine per section** (matches spec audit grid):

| `SectionId` | Underlying data file(s) |
|---|---|
| `volatility_complex` | `public/data/derived/volatility_dashboard.json` |
| `rates_pressure` | `public/data/derived/rates_dashboard.json` |
| `regime_drivers` | `public/data/derived/regime_dashboard.json` |
| `positioning_vs_candidate_sentiment` | `public/data/series/cftc_sp500_asset_mgr_net.json` + `public/data/candidates/naaim_exposure_candidate.json` (may be absent) |
| `tactical_stress_board` | `public/data/derived/signal_priority.json` |

**Tone constraints (from `docs/LIMITATIONS.md`):** all text descriptive, no advice/targets/buy-sell language. Distinct first 80 chars from each route's `why_it_matters`.

- [ ] **Step 1: Add the `SectionTemplate` TypedDict and `SECTION_CATALOG` constant**

In `scripts/transform/build_page_insights.py`, append (after existing constants):

```python
from typing import Callable, TypedDict

class SectionTemplate(TypedDict, total=False):
    id: str
    eyebrow: str
    question: str
    derive: Callable[[dict], dict]   # returns answer/why/risk/support/caveat/freshness_status

# Hand-curated text. Questions are ≤ 120 chars and distinct from
# each route's why_it_matters string in page_insights.json.
SECTION_CATALOG: dict[str, list[SectionTemplate]] = {
    "volatility": [
        {
            "id": "volatility_complex",
            "eyebrow": "Volatility complex",
            "question": "Is the term structure pricing calm, stress, or hidden options stress?",
            "derive": _derive_volatility_complex,
        },
    ],
    "rates": [
        {
            "id": "rates_pressure",
            "eyebrow": "Rates pressure",
            "question": "Is the recent 10Y move coming from real yields, breakevens, or curve shape?",
            "derive": _derive_rates_pressure,
        },
    ],
    "regime_map": [
        {
            "id": "regime_drivers",
            "eyebrow": "Regime drivers",
            "question": "Are real yields and the dollar tightening or easing financial conditions together?",
            "derive": _derive_regime_drivers,
        },
    ],
    "sentiment": [
        {
            "id": "positioning_vs_candidate_sentiment",
            "eyebrow": "Positioning vs sentiment",
            "question": "Is positioning crowded enough to amplify downside?",
            "derive": _derive_positioning,
        },
    ],
    "tactical": [
        {
            "id": "tactical_stress_board",
            "eyebrow": "Tactical stress",
            "question": "Which warnings are clustering on the short-term board today?",
            "derive": _derive_tactical_stress,
        },
    ],
}
```

- [ ] **Step 2: Implement one fully-worked derivation function — `_derive_volatility_complex`**

```python
def _derive_volatility_complex(loaded: dict) -> dict:
    """Read volatility_dashboard.json and build the section's dynamic fields."""
    vol = loaded.get("volatility_dashboard")
    if vol is None:
        return {
            "answer": "Data not yet active for this section.",
            "freshness_status": "unavailable",
        }
    curve = vol.get("latest_curve", [])
    hidden = vol.get("hidden_stress", [])
    latest_hidden = hidden[-1] if hidden else None
    if not curve or latest_hidden is None:
        return {
            "answer": "Data partially loaded; awaiting full volatility dashboard.",
            "freshness_status": "stale",
        }
    state = latest_hidden.get("state", "calm")
    answer_map = {
        "calm": "Volatility term structure remains contained and short-end stress is muted.",
        "watch": "Term structure remains contained but VVIX-vs-VIX divergence suggests hidden options stress is building.",
        "elevated": "Hidden options stress is elevated while headline VIX still understates the move.",
    }
    return {
        "answer": answer_map.get(state, answer_map["calm"]),
        "why": "Term-structure inversion and VVIX-vs-VIX divergence are leading indicators ahead of headline VIX.",
        "risk": "VVIX percentile is above VIX percentile" if state in {"watch", "elevated"} else None,
        "support": "Front-end percentile remains in normal range" if state == "calm" else None,
        "caveat": "Volatility indices are delayed Cboe public data; intraday moves not reflected.",
        "freshness_status": "ok",
    }
```

The remaining 4 derivation functions (`_derive_rates_pressure`, `_derive_regime_drivers`, `_derive_positioning`, `_derive_tactical_stress`) follow the same shape: read one or two derived JSONs into `loaded`, branch on the latest state, return the 5 text fields. The subagent implements each following the volatility example.

- [ ] **Step 3: Wire the SECTION_CATALOG into the build**

In the function that constructs each `RouteInsight`, after the existing fields are set, add:

```python
templates = SECTION_CATALOG.get(route_key, [])
sections = []
for template in templates:
    dynamic = template["derive"](loaded_data_bundle)
    sections.append({
        "id": template["id"],
        "eyebrow": template["eyebrow"],
        "question": template["question"],
        "answer": dynamic.get("answer", ""),
        "why": dynamic.get("why"),
        "risk": dynamic.get("risk"),
        "support": dynamic.get("support"),
        "caveat": dynamic.get("caveat"),
        "freshness_status": dynamic.get("freshness_status", "unavailable"),
    })
if sections:
    route_insight["sections"] = sections
```

`loaded_data_bundle` is a dict the build function pre-loads with all derived JSONs (keyed by filename stem). Each derivation function reads only the keys it needs.

- [ ] **Step 4: Write `tests/python/test_section_catalog.py`**

```python
from scripts.transform import build_page_insights as mod


def test_section_catalog_has_five_entries():
    total = sum(len(v) for v in mod.SECTION_CATALOG.values())
    assert total == 5


def test_volatility_derive_returns_unavailable_when_data_missing():
    result = mod._derive_volatility_complex({})
    assert result["freshness_status"] == "unavailable"
    assert "not yet active" in result["answer"]


def test_volatility_derive_returns_ok_with_fixture():
    loaded = {
        "volatility_dashboard": {
            "latest_curve": [{"tenor": "9D", "value": 14.0, "percentile_5y": 0.4}],
            "hidden_stress": [{"date": "2024-01-01", "state": "calm"}],
        }
    }
    result = mod._derive_volatility_complex(loaded)
    assert result["freshness_status"] == "ok"
    assert "contained" in result["answer"]
```

- [ ] **Step 5: Run tests + regenerate**

```bash
.venv/bin/python -m pytest tests/python/test_section_catalog.py -v
.venv/bin/python -m scripts.transform.build_page_insights
```

Confirm `public/data/derived/page_insights.json` now carries `sections` for the 5 route keys.

- [ ] **Step 6: Commit**

```bash
git add scripts/transform/build_page_insights.py tests/python/test_section_catalog.py public/data/derived/page_insights.json
git commit -m "feat(page-insights): add SECTION_CATALOG for 5 FocusBlock placements"
```

---

### Task D4: Extend `validate_schema.py` with `SectionId` enum check

**Files:**
- Modify: `scripts/validate/validate_schema.py`

Add a new function `check_section_insight_schema()` that:
- Iterates `page_insights.json[routes][*][sections][*]`.
- Asserts `id` is in the `SectionId` enum.
- Asserts character-length pins on each text field (`question ≤ 120`, `answer 60-200`, etc.).
- Asserts `freshness_status` is in `SignalFreshnessStatus`.

Call this function from the validate_schema main entry point AFTER `check_access_status_enum()`. This is the append-only edit pattern (Phase A and Phase D both write to validate_schema.py in separate functions).

Commit.

---

### Task D5: Insert 5 FocusBlock placements in routes

**Files:**
- Modify: `src/routes/Volatility.tsx` (above the primary/secondary chart slots)
- Modify: `src/routes/Rates.tsx`
- Modify: `src/routes/RegimeMap.tsx`
- Modify: `src/routes/Sentiment.tsx`
- Modify: `src/routes/TacticalTradingWeather.tsx` (above the 6-tile section)

**Per-route placement table:**

| Route file | `SectionId` | Slot location |
|---|---|---|
| `src/routes/Volatility.tsx` | `volatility_complex` | Above `volatility_primary_chart` + `volatility_secondary_charts` slots |
| `src/routes/Rates.tsx` | `rates_pressure` | Above `rates_primary_chart` + `rates_secondary_charts` slots |
| `src/routes/RegimeMap.tsx` | `regime_drivers` | Above `regime_primary_chart` slot |
| `src/routes/Sentiment.tsx` | `positioning_vs_candidate_sentiment` | Above `sentiment_primary_chart` slot |
| `src/routes/TacticalTradingWeather.tsx` | `tactical_stress_board` | Above the 6-tile section |

For each route, find the FocusBlock placement location per the table above. Use this insertion pattern (works under TypeScript strict mode — the `id` field on `SectionInsight` does NOT collide with `FocusBlockProps` because we destructure rather than spread):

```tsx
import FocusBlock from "../components/FocusBlock";
// ...

function VolatilityRoute() {
  const routeInsight = usePageInsights("volatility");   // existing hook
  const section = routeInsight?.sections?.find((s) => s.id === "volatility_complex");

  return (
    <>
      <PageInsightHero route="volatility" />
      {section && (
        <FocusBlock
          variant="section"
          eyebrow={section.eyebrow}
          question={section.question}
          answer={section.answer}
          why={section.why}
          risk={section.risk}
          support={section.support}
          caveat={section.caveat}
          freshnessStatus={section.freshness_status}
        />
      )}
      {/* SLOT:volatility_primary_chart */}
      {/* SLOT:volatility_secondary_charts */}
      {/* ...rest of existing route content unchanged... */}
    </>
  );
}
```

Apply the same pattern to all 5 routes, substituting the matching `SectionId` from the table. The destructured props match `FocusBlockProps` exactly — no extra `id` field is passed to the component (which would fail strict-mode prop type checking).

No other route changes. No shell or hero changes.

- [ ] **Step 1: Add FocusBlock + selector to `Volatility.tsx`**
- [ ] **Step 2: Add FocusBlock + selector to `Rates.tsx`**
- [ ] **Step 3: Add FocusBlock + selector to `RegimeMap.tsx`**
- [ ] **Step 4: Add FocusBlock + selector to `Sentiment.tsx`**
- [ ] **Step 5: Add FocusBlock + selector to `TacticalTradingWeather.tsx`**
- [ ] **Step 6: Run vitest + build**

```bash
npm test
npm run build
```

- [ ] **Step 7: Commit (one commit per route or one combined commit — your choice)**

```bash
git add src/routes/Volatility.tsx src/routes/Rates.tsx src/routes/RegimeMap.tsx src/routes/Sentiment.tsx src/routes/TacticalTradingWeather.tsx
git commit -m "feat(routes): wire FocusBlock(section) into 5 routes"
```

---

### Task D6: Create vitest fixtures at `src/__fixtures__/page_insights/`

**Files:**
- Create: `src/__fixtures__/page_insights/<route>_complete.json` (5 routes)
- Create: `src/__fixtures__/page_insights/<route>_minimal.json` (5 routes)
- Create: `src/__fixtures__/page_insights/<route>_unavailable.json` (5 routes)

15 fixture files total. Each fixture is a partial `PageInsightsFile` with one route's `sections` populated for the test scenario. Use them in Task D5's route component tests.

Commit.

---

### Task D7: Create `tests/python/test_page_insights_duplicate_reads.py`

**Files:**
- Create: `tests/python/test_page_insights_duplicate_reads.py`

The duplicate-text check per spec's verification gate:

```python
import json
import re
from pathlib import Path

PAGE_INSIGHTS = Path("public/data/derived/page_insights.json")


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower()).strip()[:80]


def test_no_duplicate_reads_within_route():
    data = json.loads(PAGE_INSIGHTS.read_text())
    for route_key, route in data.get("routes", {}).items():
        reads = []
        if route.get("why_it_matters"):
            reads.append(("why_it_matters", _normalize(route["why_it_matters"])))
        for section in route.get("sections") or []:
            reads.append((f"sections.{section['id']}.answer", _normalize(section.get("answer", ""))))
        # Pairwise distinct
        seen = {}
        for label, text in reads:
            if not text:
                continue
            assert text not in seen, (
                f"route {route_key}: read {label!r} duplicates {seen[text]!r}: {text!r}"
            )
            seen[text] = label
```

Run; expect PASS against current `page_insights.json` (sections may be empty before D3 lands; if so, the test trivially passes).

Commit.

---

### Task D8: Phase D verification + PR

- [ ] Run base + extended gate
- [ ] Run vitest
- [ ] Confirm FocusBlock renders in all 5 routes when fixture provides sections
- [ ] Confirm graceful fallback when sections are absent
- [ ] Confirm duplicate-text test passes
- [ ] PR titled "Phase D: FocusBlock + page focus audit"

---

## Chunk 8: Phase QA + handoff

**Branch:** Not a new branch; QA runs against the merged state after Phase A, Phase B (3 PRs), Phase C, and Phase D all merge into `main`.

---

### Task QA1: Run base gate against merged `main`

```bash
.venv/bin/python -m pytest tests/python -v
npm test
npm run build
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
.venv/bin/python -m scripts.validate.validate_candidate_isolation
```

All must pass.

---

### Task QA2: Confirm candidate isolation across all merged phases

Run grep checks per spec §"Verification gate":

```bash
# No candidate series_id in any active output file:
.venv/bin/python -m scripts.validate.validate_candidate_isolation

# No file in candidates/ carries active_scoring_allowed: true:
python -c "
import json
from pathlib import Path
for f in Path('public/data/candidates').glob('*.json'):
    data = json.loads(f.read_text())
    assert data.get('active_scoring_allowed') is False, f
print('All candidate files isolated.')
"
```

---

### Task QA3: Confirm no secret leaks

Run the allowlist check + value-leak test (both implemented in Phase C Task C7):

```bash
.venv/bin/python -m pytest tests/python/test_secrets_isolation.py -v
```

---

### Task QA4: Confirm duplicate-text check passes

```bash
.venv/bin/python -m pytest tests/python/test_page_insights_duplicate_reads.py -v
```

---

### Task QA5: Run network-conditional smoke test

```bash
.venv/bin/python -m scripts.update_data
```

Confirm every new module path appears in the run output and produces a valid JSON file (or gracefully skips if secrets/network unavailable).

---

### Task QA6: Write verification report

**Files:**
- Create: `docs/superpowers/plans/2026-05-10-data-source-and-focus-pattern-expansion-verification.md`

Use the template from the May-10 verification report (`docs/superpowers/plans/2026-05-10-market-weather-map-next-phase-verification.md`):

- Header (date, branch, what's verified).
- Per-task confirmation table.
- Per-acceptance-criterion confirmation table from the spec's §"Acceptance summary".
- Open follow-ups (SP500 sublicensing path, Cboe / VX promotion review timing, VIX maturity expansion, NAAIM/AAII promotion review).

Commit the verification report to `main`.

---

### Task QA7: Update CLAUDE.md gating note

**Files:**
- Modify: `CLAUDE.md` ("Source gating" section)

Reflect that:
- `AccessStatus` is now 7-value.
- Cboe put/call, VX futures, NAAIM/AAII have candidate ingest paths producing files in `public/data/candidates/`.
- TradingView authenticated candidates are accepted under the `authenticated_candidate` access tier; secrets injected via `${{ secrets.* }}` in the workflow.

---

## Execution handoff

**The plan is ready for `superpowers:subagent-driven-development`.**

Dispatch order:

1. **Phase A** (Chunks 1–3): single agent on `feat/data-source-phase-a-governance` working through tasks A1 → A13. Merge to `main` before continuing.

2. **Phase B / C / D in parallel** (Chunks 4–7): four worktrees, four agents, four PRs. Each agent works through its own task list. Each PR merges independently into `main`. The phases do not interact at the file level after Phase A's contract is in place.

3. **Phase QA** (Chunk 8): single agent against the merged `main` after all B/C/D PRs merge. Writes the verification report.

Throughout, follow @superpowers:test-driven-development (write failing test before implementation), @superpowers:verification-before-completion (run the verification command before claiming done), and @superpowers:requesting-code-review (request a code-review subagent before opening any PR).

If any task's verification step fails, follow @superpowers:systematic-debugging — do not bypass the check; do not skip ahead.


