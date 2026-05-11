# Phase B PRs (8)

**Parent doc:** [2026-05-11-bcd-replan.md](2026-05-11-bcd-replan.md) — start there for the dependency graph, dispatch cadence, worktree bootstrap pattern, and standard verification gate. This doc just enumerates the 8 Phase B PRs with their bundles, branches, and demo-able outputs.

**Per-task detail:** [2026-05-10-data-source-and-focus-pattern-expansion.md](2026-05-10-data-source-and-focus-pattern-expansion.md) — chunks 4 and 5. Every PR section below links to the specific tasks in that doc; do NOT duplicate per-task detail here.

**All 8 PRs branch off post-merge `main`.** No internal dependencies — any PR can run before any other. Recommended order in §"Recommended sequence" at the bottom.

---

## Phase B-official — 4 PRs

Each adds ONE new active-class data source. Output goes to `public/data/series/` (B1-B3) or `public/data/derived/` (B4). `access_status: "free_public_active"`.

### PR B1: BEA personal saving rate

- **Branch:** `feat/b1-bea-personal-saving-rate`
- **Worktree:** `.worktrees/b1-bea`
- **Bundles:**
  - BO1 step 1 — write `docs/source_reviews/bea_personal_saving_rate.md`
  - BO2 — add `personal_saving_rate` series catalog entry (single dict) to `OFFICIAL_SOURCE_SERIES_PHASE_B` list in `scripts/shared/catalog.py`
  - BO3 — `scripts/ingest/fetch_bea_personal_saving_rate.py` + `tests/python/test_fetch_bea_personal_saving_rate.py`
  - Append `scripts.ingest.fetch_bea_personal_saving_rate` to `MODULES_INGEST_PHASE_B_OFFICIAL` in [scripts/update_data.py](../../../scripts/update_data.py)
- **Demo-able output:** new `public/data/series/personal_saving_rate.json`
- **Original-plan refs:** [BO1](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bo1-write-source-review-docs), [BO2](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bo2-add-new-series-catalog-entries-to-scriptssharedcatalogpy), [BO3](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bo3-implement-fetch_bea_personal_saving_ratepy)
- **PR title:** `feat(b1-bea): add BEA personal saving rate diagnostic`

### PR B2: Shiller CAPE

- **Branch:** `feat/b2-shiller-cape`
- **Worktree:** `.worktrees/b2-shiller`
- **Bundles:**
  - BO1 step 2 — write `docs/source_reviews/shiller_cape.md`
  - BO2 — add `cape_ratio` series catalog entry
  - BO4 — `scripts/ingest/fetch_shiller_cape.py` + test
  - Append to `MODULES_INGEST_PHASE_B_OFFICIAL`
- **Demo-able output:** new `public/data/series/cape_ratio.json`
- **Original-plan refs:** BO1 step 2, BO2 row, [BO4](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bo4-implement-fetch_shiller_capepy)
- **PR title:** `feat(b2-shiller): add Shiller CAPE diagnostic`

### PR B3: NY Fed ACM term premium (promotion + fetch)

- **Branch:** `feat/b3-nyfed-acm`
- **Worktree:** `.worktrees/b3-acm`
- **Bundles:**
  - BO1 step 3 — UPDATE `docs/source_reviews/ny_fed_acm_term_premium.md` with documented endpoint (re-review)
  - BO2 — add `term_premium_acm_10y` series catalog entry; promotes from gated `terms_review_needed` to `free_public_active` (governance change)
  - BO5 — `scripts/ingest/fetch_nyfed_acm_term_premium.py` + test
  - Append to `MODULES_INGEST_PHASE_B_OFFICIAL`
- **Demo-able output:** new `public/data/series/term_premium_acm_10y.json`; `term_premium_acm_10y` EXITS `missing_high_value_signals` in regenerated `signal_priority.json` (the gap closes).
- **Original-plan refs:** BO1 step 3, BO2 row, [BO5](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bo5-implement-fetch_nyfed_acm_term_premiumpy)
- **PR title:** `feat(b3-acm): promote NY Fed ACM term premium to active`
- **Note:** the governance change (gated → active) deserves an explicit callout in the PR body. Verify `validate_candidate_isolation` still passes after the regeneration.

### PR B4: Treasury supply pressure (derived)

- **Branch:** `feat/b4-treasury-supply`
- **Worktree:** `.worktrees/b4-treasury`
- **Bundles:**
  - BO2 — add `treasury_supply_pressure` derived-series catalog entry
  - BO6 — `scripts/transform/build_treasury_supply_pressure.py` + test (this is a transform, not an ingest — it composes existing FRED + FiscalData series)
  - Append `scripts.transform.build_treasury_supply_pressure` to `MODULES_TRANSFORM_PHASE_B`
- **Demo-able output:** new `public/data/derived/treasury_supply_pressure.json`
- **Original-plan refs:** BO2 row, [BO6](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bo6-implement-build_treasury_supply_pressurepy)
- **PR title:** `feat(b4-treasury): add treasury supply pressure transform`
- **Note:** verify Treasury auction supply + monthly outlays + receipts are all present in catalog before starting (Phase A landed them).

---

## Phase B-Cboe — 2 PRs

Both write to `public/data/candidates/` and never enter active scoring. Source reviews already exist (`docs/source_reviews/cboe_put_call.md`, `docs/source_reviews/vix_futures_curve.md`). Catalog entries already exist in `CANDIDATE_SERIES_PHASE_A` (shipped in A5).

### PR B5: Cboe put/call candidates

- **Branch:** `feat/b5-cboe-put-call`
- **Worktree:** `.worktrees/b5-cboe-pc`
- **Bundles:**
  - BC1 — `scripts/ingest/fetch_cboe_put_call.py` + test (writes 5 candidate JSONs to `public/data/candidates/`)
  - Confirm 5 catalog entries exist in `CANDIDATE_SERIES_PHASE_A` (do NOT add new entries; they're already there)
  - Append to `MODULES_INGEST_PHASE_B_CBOE`
- **Demo-able output:** 5 new files in `public/data/candidates/` (`put_call_total_candidate.json`, etc.)
- **Verification add:** `validate_candidate_isolation` must still pass — these files never leak into active outputs.
- **Original-plan refs:** [BC1](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bc1-cboe-candidate-agent--fetch-cboe-putcall-csv)
- **PR title:** `feat(b5-cboe-pc): ingest Cboe put/call candidate series`

### PR B6: Cboe VX futures curve candidate

- **Branch:** `feat/b6-cboe-vx`
- **Worktree:** `.worktrees/b6-cboe-vx`
- **Bundles:**
  - BC2 — `scripts/ingest/fetch_cboe_vx_settlements.py` + curve-context derivation + tests
  - Confirm catalog entries exist in `CANDIDATE_SERIES_PHASE_A`
  - Append to `MODULES_INGEST_PHASE_B_CBOE`
- **Demo-able output:** new `vx_futures_*_candidate.json` files in `candidates/`
- **Original-plan refs:** [BC2](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bc2-cboe-candidate-agent--fetch-cboe-vx-settlements--curve-context)
- **PR title:** `feat(b6-cboe-vx): ingest Cboe VX futures curve candidate`

---

## Phase B-sentiment — 2 PRs

Ingest-only candidates. Source review (`docs/source_reviews/aaii_naaim.md`) requires `terms_review_needed`. They surface in `missing_high_value_signals` for transparency but never in primary slots.

### PR B7: NAAIM exposure index

- **Branch:** `feat/b7-naaim`
- **Worktree:** `.worktrees/b7-naaim`
- **Bundles:**
  - BS1 — `scripts/ingest/fetch_naaim_exposure.py` + test
  - Confirm `naaim_exposure_candidate` exists in `CANDIDATE_SERIES_PHASE_A`
  - Append to `MODULES_INGEST_PHASE_B_CBOE` (or a new `MODULES_INGEST_PHASE_B_SENTIMENT` sub-list if cleaner)
- **Demo-able output:** new `naaim_exposure_candidate.json` in `candidates/`
- **Original-plan refs:** [BS1](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bs1-sentiment-candidate-agent--implement-naaim-ingest-ingest-only-no-committed-json)
- **PR title:** `feat(b7-naaim): ingest NAAIM exposure index candidate`

### PR B8: AAII sentiment survey

- **Branch:** `feat/b8-aaii`
- **Worktree:** `.worktrees/b8-aaii`
- **Bundles:**
  - BS2 — `scripts/ingest/fetch_aaii_sentiment.py` + test
  - Confirm `aaii_sentiment_candidate` exists in `CANDIDATE_SERIES_PHASE_A`
  - Append to MODULES list
- **Demo-able output:** new `aaii_sentiment_candidate.json` in `candidates/`
- **Original-plan refs:** [BS2](2026-05-10-data-source-and-focus-pattern-expansion.md#task-bs2-sentiment-candidate-agent--implement-aaii-ingest-ingest-only)
- **PR title:** `feat(b8-aaii): ingest AAII sentiment survey candidate`

---

## Recommended sequence

For a single-flight Claude session, ship in this order:

1. **B1 BEA** first. Simplest fetcher in the set — a single FRED graph CSV endpoint, well-documented public source. Proves the pattern: source review → catalog entry → fetcher → test → MODULES append → verification.
2. **B2 Shiller** second. Adds parsing complexity (Excel via `multpl_shiller`) but the pattern from B1 transfers directly.
3. **B4 Treasury supply** third. Transform, not fetcher — exercises a different muscle (composing existing series). Useful before B3 because Treasury supply is read-only against already-landed data.
4. **B3 NY Fed ACM** fourth. Most involved: source re-review, governance promotion (gated → active), fetcher, verification that `term_premium_acm_10y` exits `missing_high_value_signals`. Benefits from the patterns proven in B1-B2 and the transform pattern from B4.
5. **B5 Cboe put/call** fifth. Switches from active-class to candidate-class. Pattern: fetcher writes to `candidates/`; isolation validator confirms no leak.
6. **B6 Cboe VX** sixth. Same candidate pattern as B5.
7. **B7 NAAIM** seventh. Same candidate pattern, smaller surface (1 series).
8. **B8 AAII** eighth. Same as B7.

If you want to overlap two PRs, B-official and B-Cboe (or B-sentiment) are touching disjoint files and safe to run from separate worktrees. Don't overlap two B-official PRs — they all touch `MODULES_INGEST_PHASE_B_OFFICIAL` and the same catalog list.

---

## Cross-cutting reminders

- **Python-source-first** — never edit `public/data/catalog/series_catalog.json` directly. Add the entry to the Python list in `scripts/shared/catalog.py`, then let `update_data` (or the round-trip one-liner from Phase A's handoff) regenerate the JSON.
- **No emojis in source-review docs.**
- **Test the fetcher with a fixture, not a network call.** Pattern: `tests/python/fixtures/<source>_sample.csv` (or `.json`), mock the HTTP call, assert the parsed output shape.
- **Freshness expectation** — every new active series needs an entry in `scripts/validate/validate_freshness.py`. Candidate series don't (they're allowed to be stale).
