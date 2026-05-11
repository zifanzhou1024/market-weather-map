---
title: market-weather-map — data-source expansion + focus pattern formalization
date: 2026-05-10
status: design
---

# Data-source expansion + focus pattern formalization — design

## Background

As of 2026-05-10 the 7-PR next-phase roadmap (signal-priority engine through long-term macro visual system) and the May-10 5-wave dashboard redesign (`docs/superpowers/specs/2026-05-10-market-weather-map-next-phase-design.md`) are essentially complete. `public/data/derived/signal_priority.json`, `page_insights.json`, `volatility_dashboard.json`, `rates_dashboard.json`, `regime_dashboard.json` exist with their documented shapes. `src/components/PageInsightHero.tsx`, `src/components/RouteDataFooter.tsx`, `src/components/InteractiveChartShell.tsx`, `src/components/MarketBriefHeader.tsx`, `src/components/HorizonScoreHeader.tsx`, hero charts per route, and `src/charts/EChartPanel.tsx` with Line/Bar/Heatmap/Scatter registrations are merged. The site renders a ranked, interpretive cockpit; the "rank before visualizing or adding data" guard is satisfied.

Two remaining gaps motivate this phase.

**Gap 1: source governance.** The current `access_status` taxonomy is binary (`free_public` vs `terms_review_needed`). This conflates several materially different classes: free sources that have been approved for active scoring, free sources awaiting promotion review, sources requiring authenticated access, proxy series that intentionally substitute for restricted vendor data, and restricted vendor data itself. The current contract relies on convention plus a single pytest non-leak test. Adding new candidate-class sources without expanding the taxonomy risks accidental promotion through implicit reclassification.

**Gap 2: section focus pattern.** Single-domain routes use `PageInsightHero` for the route-level read and `InteractiveChartShell.insight` (string) for the chart-level read. There is no intermediate pattern for grouped multi-chart sections (e.g. volatility complex, rates pressure decomposition, regime quadrant + trail) that benefit from a structured question → answer → why → risk/support → caveat block scoped to the section.

This design adds (1) a seven-value `AccessStatus` enum with explicit `requires_secret` / `active_scoring_allowed` / `public_redistribution_allowed` flags, (2) the next official-free data ingest, (3) optional TradingView authenticated candidate fallback for MOVE/put-call/VX, and (4) a sparingly-used `FocusBlock` component for grouped sections.

## Goals

1. Replace the binary `access_status` with a seven-value enum so candidate, authenticated-candidate, proxy-only, and restricted-vendor classes have distinct policy rails.
2. Mechanically prevent candidate/restricted data from entering active scoring, hero charts, or `page_insights` primary slots — extending the existing build-time + validator + pytest gating contract.
3. Add the next official-free data ingest: BEA personal saving rate, Shiller CAPE, Cboe put/call direct, VX futures direct, NAAIM/AAII official XLS, plus a re-attempted NY Fed ACM promotion review.
4. Add authenticated TradingView fallback for MOVE/put-call/VX, writing only to `public/data/candidates/`, never to active series.
5. Add `FocusBlock` (`variant="section"` and `variant="compact"`) for grouped multi-chart sections, without changing `PageInsightHero`, `RouteDataFooter`, or `InteractiveChartShell` APIs.

## Non-goals (deferred to later phases)

- SP500 active ingest. The S&P DJI redistribution gate documented in `docs/source_reviews/sp500_index.md` stands. SP500 remains a `missing_high_value_signal`. A sublicensing channel, if found, is its own follow-up source-review PR.
- Recharts retirement. `TimeSeriesChartInner`, `MultiSeriesChart`, `ChartResponsiveContainer`, `YieldDecompositionChart` remain Recharts.
- Universal hero consolidation. `PageInsightHero`, `HorizonScoreHeader`, `MarketBriefHeader` coexist.
- New backend service, browser-side fetches, or runtime secrets. Static-JSON-only architecture is preserved.
- `InteractiveChartShell.insight` API change. `FocusBlock variant="compact"` is passed *into* `insight`, not a replacement.
- Cboe put/call and VX futures promotion to active scoring. They land as candidates in this phase; promotion is a separate source-review PR per source.
- VIX maturity expansion (VIX6M / VIX1Y / VIX1D). Already deferred in the May-10 design; structure supports later addition.
- Replacing the existing `MarketBriefHeader` or `HorizonScoreHeader` on Overview, Tactical, or LongTermMacroClimate routes.

## Hard constraints (carry-over from `CLAUDE.md`)

- No backend service, database, or live market feed.
- No browser-side provider calls, API keys, or secrets.
- All ingest stays in `scripts/ingest/...` or GitHub Actions.
- All new heavy charts use `src/charts/EChartPanel.tsx` with `echarts/core` modular imports + `CanvasRenderer`. No Plotly, Highcharts, or `echarts-for-react`.
- Output is descriptive — no advice, forecasts, targets, or buy/sell/short language. Match `docs/LIMITATIONS.md`.
- Every new `public/data/...` file gets a schema check in `scripts/validate/validate_schema.py` and a freshness expectation in `scripts/validate/validate_freshness.py`.
- Every new candidate or active source needs a `docs/source_reviews/<name>.md` entry first.

## Architecture: four phases

```
Phase A — source governance contract
       │
       ▼
   ┌───┴───┬──────────┐
   ▼       ▼          ▼
Phase B   Phase C   Phase D
official  TradingView focus
sources   candidates pattern
   │       │          │
   └───┬───┴──────────┘
       ▼
   Phase QA (verification gate)
```

Phase A merges first because it creates the `AccessStatus` enum, the per-entry flags, the `public/data/candidates/` directory, and the candidate-isolation validator that B, C, and D all depend on. Phases B, C, and D dispatch in parallel after A merges. Each phase is one PR. QA dispatches after B, C, and D all merge.

### Agent ownership

Six implementation agents plus one QA agent.

| Phase | Agent | Owns |
|---|---|---|
| A | `source-governance-agent` | `src/lib/types.ts` (`AccessStatus` enum + flags), `public/data/catalog/source_registry.json` reclassification + 7 new source entries, `public/data/catalog/series_catalog.json` reclassification of all 105 existing entries + series-level overrides + appended entries for sources whose reviews already exist (Cboe put/call, VX, NAAIM, AAII), `scripts/shared/catalog.py` `governance()` factory extension, `scripts/validate/validate_schema.py` AccessStatus enum check (append-only), `scripts/validate/validate_candidate_isolation.py` (new), `scripts/update_data.py` MODULES restructure into per-phase sub-lists, `scripts/transform/build_signal_priority.py` and `build_page_insights.py` gating-predicate rewrite, `tests/python/test_signal_priority.py` extension, `tests/python/test_candidate_isolation.py` (new), `public/data/candidates/README.md`, `public/data/candidates/.gitkeep`. |
| B | `official-sources-agent` | `scripts/ingest/fetch_bea_personal_saving_rate.py`, `scripts/ingest/fetch_shiller_cape.py`, `scripts/ingest/fetch_nyfed_acm_term_premium.py`, `scripts/transform/build_treasury_supply_pressure.py`, `docs/source_reviews/bea_personal_saving_rate.md`, `docs/source_reviews/shiller_cape.md`, updated `docs/source_reviews/ny_fed_acm_term_premium.md`. Appends new series_catalog entries: `personal_saving_rate`, `cape_ratio`, `ny_fed_acm_term_premium_candidate`. Appends MODULES sub-lists. |
| B | `cboe-candidate-agent` | `scripts/ingest/fetch_cboe_put_call.py`, `scripts/ingest/fetch_cboe_vx_settlements.py`, `scripts/transform/build_vx_curve_context.py`. Appends MODULES sub-list. (series_catalog entries already added by phase A.) |
| B | `sentiment-candidate-agent` | `scripts/ingest/fetch_naaim_candidate.py`, `scripts/ingest/fetch_aaii_candidate.py`. Appends MODULES sub-list. (series_catalog entries already added by phase A.) |
| C | `tradingview-candidate-agent` | `.github/workflows/update-data.yml` env-block extension only, `requirements.txt` additions, `scripts/shared/config.py` secret helpers, `scripts/ingest/fetch_tradingview_move.py`, `scripts/ingest/fetch_tradingview_put_call.py`, `scripts/ingest/fetch_tradingview_vx_curve.py`, `docs/source_reviews/tradingview_authenticated_candidates.md`, `tests/python/test_secrets_isolation.py`. Appends new series_catalog entries for the three TradingView candidates. Appends MODULES sub-list. |
| D | `focus-pattern-agent` | `src/components/FocusBlock.tsx`, `src/components/FocusBlock.test.tsx`, `src/lib/types.ts` extension (`SectionInsight`, `SectionId`, `RouteInsight.sections`), `scripts/validate/validate_schema.py` SectionId enum check (append-only, in a separate function from the AccessStatus check), `scripts/transform/build_page_insights.py` extension (`SECTION_CATALOG` and `_build_sections()`), `tests/python/test_page_insights_duplicate_reads.py` (new), targeted insertions in `Volatility.tsx`, `Rates.tsx`, `RegimeMap.tsx`, `Sentiment.tsx`, `TacticalTradingWeather.tsx`. (FragilityShockRisk NOT touched in this phase.) |
| QA | `qa-agent` | Verification commands, candidate-isolation grep checks, route-render fallback checks, no-secret-in-public-JSON check, ARIA fallback checks, MODULES final-order check, verification report. |

### Why this carves cleanly

- Phase A is governance-only — touches catalog + types + validators + the gating-predicate rewrite in `build_signal_priority.py`/`build_page_insights.py`. No ingest scripts, no routes, no UI components.
- Phase B's three agents write to disjoint scripts and JSON files. `official-sources-agent` writes to `series/` and `derived/`. `cboe-candidate-agent` and `sentiment-candidate-agent` write to `candidates/` only.
- Phase C is the only phase that touches `.github/workflows/` and `requirements.txt`.
- Phase D is the only phase that touches `src/components/FocusBlock.tsx` and the five named routes.
- `source_registry.json` is touched by phase A only (reclassification + 7 new source entries).
- `series_catalog.json` is touched by phase A (reclassification + appended entries for already-reviewed sources) AND phase B/C (each appends entries for the source reviews they create in the same PR). All NEW entries are appended; pre-existing entries are touched only by phase A. Append-only edits to a JSON array conflict only on the trailing `]` line, which is trivially resolvable. The qa-agent verifies the merged file is valid JSON.
- `scripts/update_data.py`'s MODULES list is restructured by phase A into per-phase sub-lists (`MODULES_INGEST_PHASE_B_OFFICIAL`, `MODULES_INGEST_PHASE_B_CBOE`, etc.). Each phase B/C agent edits only its named sub-list — disjoint regions, trivial git merge.
- `scripts/validate/validate_schema.py` is touched by both phase A (AccessStatus enum check) and phase D (SectionId enum check). The two add separate functions in separate regions of the file; phase D's edits are append-only after phase A's section. Trivial merge if phase A merges first.
- `scripts/transform/build_page_insights.py` is touched by both phase A (gating predicate rewrite) and phase D (SECTION_CATALOG + `_build_sections()` addition). Different functions; trivial merge if phase A merges first.

### Phase gating

Phase A must merge before phases B, C, and D dispatch. B, C, D may dispatch and merge in any order in parallel. QA dispatches after the last of B/C/D merges.

## Phase A — source governance contract

### `AccessStatus` enum

In `src/lib/types.ts`:

```ts
export type AccessStatus =
  | "free_public_active"          // approved free public; can enter active scoring
  | "free_public_candidate"       // free public; awaiting promotion review
  | "terms_review_needed"         // existing meaning; kept for compatibility
  | "authenticated_candidate"     // requires secret; candidate only
  | "proxy_only"                  // can score under proxy name (e.g. bond_volatility_proxy)
  | "restricted_vendor"           // cannot be published as active public data
  | "unavailable";                // documented but no fetch path
```

### Per-entry flags

On `source_registry.json` and `series_catalog.json` entries:

```ts
{
  "access_status": AccessStatus,
  "requires_secret": boolean,                  // workflow must inject env secrets
  "active_scoring_allowed": boolean,           // derived from access_status; written explicitly for safety
  "public_redistribution_allowed": boolean     // written explicitly; gates file presence in repo
}
```

Derivation rule (validator enforces):

| `access_status` | `active_scoring_allowed` | `public_redistribution_allowed` |
|---|---|---|
| `free_public_active` | true | true |
| `free_public_candidate` | false | true (file may ship in `candidates/`) |
| `terms_review_needed` | false | false (panel-only display in routes; no file in repo) |
| `authenticated_candidate` | false | false (file may ship in `candidates/`, but `notes` and `score_status` mark candidate) |
| `proxy_only` | true (under proxy name) | true |
| `restricted_vendor` | false | false |
| `unavailable` | false | false |

`requires_secret` is independent: true only for `authenticated_candidate` and any per-series exception.

Note: `authenticated_candidate` is the only row where `public_redistribution_allowed: false` AND the file is still committed to `candidates/`. This is intentional — the TradingView candidate files are committed because the workflow generates them, but the underlying licensing prohibits broad republication. The repo accepts the practical risk in exchange for letting the dashboard surface the candidate. Validator must not infer "no commit" from `public_redistribution_allowed: false`; it must check the access_status directly.

### Three related fields — `access_status`, `score_status`, `source_status`

Three different fields participate in gating. The codebase currently conflates them in places; this phase clarifies their roles. **`score_status` is NOT removed in this phase.** It is kept as a deprecated alias to limit blast radius.

| Field | Where it lives | Authoritative? | Phase A action |
|---|---|---|---|
| `access_status` | `series_catalog.json` entry, `source_registry.json` entry | **Yes — single source of truth after phase A.** | Migrated to new 7-value enum on all 105 series + 13 source entries. |
| `score_status` | `series_catalog.json` entry | No — derived alias kept for downstream compatibility. | Computed from `access_status` via mapping `{free_public_active, proxy_only} → "active"; everything else → "candidate"`. Field is RETAINED on every entry. Removal is deferred to a follow-up cleanup PR. |
| `source_status` | Two distinct surfaces in `src/lib/types.ts`: `SignalActiveEntry.source_status: "active"` (literal narrow for `top_warnings`/`top_supports`), `SignalMissingEntry.source_status: DataStatus` (catalog/missing surface), `SignalRefSourceStatus` (page_insights). | No — projection from upstream. | `SignalActiveEntry.source_status: "active"` literal narrow is PRESERVED — entries in `top_warnings`/`top_supports` are post-gating and remain literally `"active"`. `SignalMissingEntry.source_status` and `SignalRefSourceStatus` widen to include the new access_status values where they classify why a signal is missing or candidate. The internal `RankedEntry` projection used by `build_page_insights.py` to gate primary slots is rewritten to read `access_status` directly from the catalog entry (via the new predicate). The previous `GATED_STATUSES` constant against `source_status` is removed at the gating callsite (lines 167 and 187 of `build_page_insights.py`); the wider source_status fields on output types continue to be populated but are not used for gating. |

This three-tier mapping has these consequences:

1. **`scripts/shared/catalog.py`** — the `governance()` factory at line 11 keeps its `score_status: str = "active"` kwarg signature but adds a new required `access_status: AccessStatus` kwarg. The factory derives `score_status` from `access_status` when `score_status` is not explicitly provided; legacy callsites that pass `score_status="candidate"` (lines 816, 832, 848, 864, 880, 896, 968, 1285, etc.) are updated to also pass the corresponding `access_status`. The factory remains the single point of truth for governance fields on a catalog entry.

2. **`scripts/transform/compute_regime_score.py`** — its 7 `score_status` references (lines 1871, 1882, 1918, 1922, 1923, 1945, 1956) are unchanged because `score_status` remains a populated field. Build-time gating in this module is unchanged.

3. **`scripts/ingest/fetch_fred_csv.py` and `fetch_cboe.py`** — their 4 `score_status` references are unchanged. `score_status` keeps being written; phase A's catalog factory derivation guarantees consistency with `access_status`.

4. **`scripts/validate/validate_freshness.py:76`** — unchanged.

5. **`src/lib/types.ts`** — the existing `ScoreStatus` enum and field on `SeriesCatalogEntry` / `CatalogEntry` are KEPT. The new `AccessStatus` enum and fields are ADDED. Frontend can read either field.

6. **`src/routes/TacticalTradingWeather.tsx:108` and `src/routes/Volatility.tsx:109`** — currently read `entry?.access_status ?? entry?.score_status ?? "source_review_required"`. This pattern continues to work because both fields are populated. No frontend edits required from this phase.

7. **Tests** — the 50+ test fixture references to `score_status` continue to work because fixtures keep writing both fields. New test fixtures (`test_candidate_isolation.py`) carry both fields to match the new factory contract.

The end-state is: `access_status` becomes authoritative; `score_status` is computed alongside it for back-compat. A follow-up cleanup PR (out of this phase's scope) removes `score_status` once consumers migrate.

### `GATED_STATUSES` → `active_scoring_allowed` predicate

`scripts/transform/build_page_insights.py:30` currently defines:

```python
GATED_STATUSES = frozenset({"terms_review_needed", "candidate"})
```

…and tests `entry.get("source_status", "")` against this set at lines 167 and 187. Phase A replaces this with:

```python
def is_active_scoring_allowed(access_status: str) -> bool:
    return access_status in {"free_public_active", "proxy_only"}
```

…and changes both callsites to:

```python
if not is_active_scoring_allowed(str(entry.get("access_status", ""))):
    # excluded from primary slot, may appear in missing-signals
```

The `source_status` projection on `RankedEntry` is updated to carry the entry's `access_status` value verbatim. Downstream consumers read `access_status` from `RankedEntry.source_status` (yes, the field name stays, the values change). This is intentional — renaming `source_status` to `access_status` on `RankedEntry` would force a frontend rewrite that this phase explicitly defers.

Pytest fixtures in `test_signal_priority.py` and the new `test_candidate_isolation.py` exercise the `is_active_scoring_allowed` predicate for every new `AccessStatus` enum value.

### Reclassification of existing source registry entries

Thirteen entries currently in `public/data/catalog/source_registry.json`:

| Entry | Before | After |
|---|---|---|
| `cboe` | `free_public` | `free_public_active` |
| `cboe_futures` | `terms_review_needed` | unchanged |
| `cboe_options` | `terms_review_needed` | unchanged |
| `cftc` | `free_public` | `free_public_active` |
| `derived` | `free_public` | `free_public_active` |
| `economic_calendar` | `terms_review_needed` | unchanged |
| `fiscaldata` | `free_public` | `free_public_active` |
| `fred` | `free_public` | `free_public_active` |
| `ice_indices` | `terms_review_needed` | `restricted_vendor` |
| `occ` | `terms_review_needed` | unchanged |
| `terms_review` | `terms_review_needed` | unchanged |
| `treasury_calendar` | `terms_review_needed` | unchanged |
| `unavailable` | `unavailable` | unchanged (already uses the new enum value) |

FRED-hosted SP500 stays gated at the **series** level via `series_catalog.json`, not the source level. The series entry overrides `fred`'s `free_public_active` default with `terms_review_needed` and `active_scoring_allowed: false`. See the series-level migration table below.

### Series-level migration

`public/data/catalog/series_catalog.json` has 105 entries. Phase A migrates each entry from its current `(access_status, score_status)` pair to a new `access_status` value plus the new flags, applying this mapping. `score_status` is RETAINED on every entry (computed as the derived alias) per the three-related-fields section above.

| Current `access_status` | Current `score_status` | New `access_status` | `active_scoring_allowed` | `public_redistribution_allowed` | New `score_status` (alias) |
|---|---|---|---|---|---|
| `free_public` | `active` | `free_public_active` | true | true | `active` |
| `free_public` | `candidate` | `free_public_candidate` | false | true | `candidate` |
| `terms_review_needed` | `active` | impossible — log and fail migration (no such row in current data) | — | — | — |
| `terms_review_needed` | `candidate` | `terms_review_needed` | false | false | `candidate` |
| any | any unmapped combination | log warning, default to `terms_review_needed` + `candidate`; flag in migration report | false | false | `candidate` |

The "any unmapped combination" row is the safety net for legacy rows the survey may have missed; it never silently corrupts data, and the migration script writes a report listing every unmapped row for human review. The expected count of unmapped rows is zero given the current file content.

Series-level explicit overrides (apply after the default mapping):

| `series.id` | New `access_status` | Reason |
|---|---|---|
| `sp500_index` | `terms_review_needed` | S&P DJI redistribution gate per `docs/source_reviews/sp500_index.md`. Stays in the missing-signals panel. The corresponding file `public/data/series/sp500_index.json` does NOT currently exist (verified 2026-05-10); no file deletion is required. |
| `move_index` | `restricted_vendor` | ICE MOVE per `docs/source_reviews/ice_move.md`. No corresponding file in `series/`. |
| `skew_index` | `terms_review_needed` | Per `docs/source_reviews/cboe_skew.md`. No corresponding file in `series/`. |
| `bond_volatility_proxy` (derived) | `proxy_only` | Per `docs/source_reviews/bond_volatility_proxy.md`. The only `proxy_only` entry in this phase. |

**Phase A's no-commit rule applies to NEW files only, not pre-existing files.** None of the three gated overrides (`sp500_index`, `move_index`, `skew_index`) have files in `public/data/series/` to delete. The no-commit rule in the derivation table ("`terms_review_needed` ⇒ `public_redistribution_allowed: false`") is forward-looking — phase A's QA verifies that no new file is added under `public/data/series/` for a `terms_review_needed` series; it does not retroactively delete pre-existing files (there are none).

All other series entries take the default mapping. `source-governance-agent` writes all 105 entries with the new fields in one PR; the migration is deterministic and scripted (no per-entry policy judgment).

`requires_secret` defaults to `false` for every existing series entry. The only `requires_secret: true` series in this phase are the three TradingView candidate files, which are created by `tradingview-candidate-agent` in phase C (not phase A — see "series_catalog ownership" below).

### New source entries (added by `source-governance-agent` in phase A)

`docs/source_reviews/aaii_naaim.md` (read 2026-05-10) explicitly concludes "Keep AAII and NAAIM source-gated and non-active until a later review approves an access and publication path." Both are therefore `terms_review_needed`, not `free_public_candidate`.

| Entry | `access_status` | `requires_secret` |
|---|---|---|
| `bea` | `free_public_active` | false |
| `bls` | `free_public_active` | false |
| `multpl_shiller` | `free_public_active` | false |
| `ny_fed` | `free_public_candidate` | false (re-review may promote later) |
| `naaim` | `terms_review_needed` | false (per `aaii_naaim.md`) |
| `aaii` | `terms_review_needed` | false (per `aaii_naaim.md`) |
| `tradingview` | `authenticated_candidate` | true |

### `series_catalog.json` ownership — split by source-review presence

To avoid the dependency-direction problem (phase A entries citing source reviews that phase C creates), `series_catalog.json` entries are added by whichever phase commits the underlying source review:

**Phase A adds series-level entries for sources whose `docs/source_reviews/*.md` already exists today (2026-05-10).** These citations are stable.

| `series.id` | `access_status` | `provider_id` | Source review (existing) |
|---|---|---|---|
| `put_call_total_candidate`, `put_call_index_candidate`, `put_call_equity_candidate`, `put_call_vix_candidate`, `put_call_spxw_candidate` | `free_public_candidate` | `cboe_options` | `cboe_put_call.md` |
| `vx1_candidate`, `vx2_candidate`, `vx3_candidate`, `vx_front_spread_candidate`, `vx_contango_score_candidate` | `free_public_candidate` | `cboe_futures` | `vix_futures_curve.md` |
| `naaim_exposure_candidate` | `terms_review_needed` | `naaim` | `aaii_naaim.md` |
| `aaii_sentiment_candidate` | `terms_review_needed` | `aaii` | `aaii_naaim.md` |

**Phase B and C add their own series-level entries in the same PR as their new source reviews.** This keeps citations consistent and avoids forward references.

| Adding phase / agent | `series.id` | `access_status` | `provider_id` | Source review (created in same PR) |
|---|---|---|---|---|
| Phase B / `official-sources-agent` | `personal_saving_rate` | `free_public_active` | `bea` | `bea_personal_saving_rate.md` |
| Phase B / `official-sources-agent` | `cape_ratio` | `free_public_active` | `multpl_shiller` | `shiller_cape.md` |
| Phase B / `official-sources-agent` | `ny_fed_acm_term_premium_candidate` | `free_public_candidate` | `ny_fed` | `ny_fed_acm_term_premium.md` (re-reviewed) |
| Phase C / `tradingview-candidate-agent` | `tradingview_move_candidate`, `tradingview_put_call_candidate`, `tradingview_vx_curve_candidate` | `authenticated_candidate` | `tradingview` | `tradingview_authenticated_candidates.md` |

**Multi-agent writes to `series_catalog.json`: append-only rule.** All new entries are appended to the END of the JSON array. No agent modifies pre-existing entries except phase A's reclassification (which touches every entry but writes the same schema). Append-only edits to a JSON array near the closing `]` produce predictable git conflicts only on the trailing `]` line, which are trivially auto-resolvable by the second-merging PR or human reviewer. The qa-agent verifies the merged file is valid JSON with all expected entries.

The validator from phase A enforces the candidate-isolation contract on every entry present, regardless of who added it. Adding all phase-A entries up front lets validate_candidate_isolation reject leaks from any source even before phase B/C land their additions.

### `public/data/candidates/` directory

Phase A creates the directory with a `.gitkeep` and a `README.md` stating:

> Candidate JSONs live here. They never enter active scoring, `page_insights` primary slots, hero charts, `score_summary`, or `regime_*` files. Routes may display them only in `RouteDataFooter` or candidate panels.

### Validator extensions

`scripts/validate/validate_schema.py` enforces:

- `AccessStatus` enum on every registry and catalog entry.
- `requires_secret`, `active_scoring_allowed`, `public_redistribution_allowed` are present on every entry.
- The derivation table above (e.g. `access_status: "free_public_active"` ⇒ `active_scoring_allowed: true`).
- Any file under `public/data/candidates/` carries `access_status` ∈ {`free_public_candidate`, `terms_review_needed`, `authenticated_candidate`} and `active_scoring_allowed: false`.

`scripts/validate/validate_candidate_isolation.py` (new module) loads `signal_priority.json`, `page_insights.json`, `score_summary.json`, `regime_score.json`, `bucket_scores.json`, `shock_risk_snapshot.json` and verifies that no candidate-class `series_id` appears in primary slots. Fails loudly with the leaking id and the receiving file.

**How the new module is invoked.** `validate_candidate_isolation.py` exposes both a `main()` entry point (for direct `python -m scripts.validate.validate_candidate_isolation` invocation in CI/QA) AND a `run()` function. `scripts/validate/validate_schema.py` imports `run()` and calls it after its existing schema checks, so a single `python -m scripts.validate.validate_schema` invocation transitively runs candidate isolation. The QA gate runs both commands explicitly for CI clarity (the second command is a no-op when the first already covered it, but the explicit command surfaces failures distinctly in CI logs). The MODULES list does NOT add a separate `scripts.validate.validate_candidate_isolation` entry — adding one would run candidate isolation twice on every safe-update invocation. The single `scripts.validate.validate_schema` entry already exercises it transitively.

### Candidate isolation guard — defense in depth

1. **Python build-time guard.** `scripts/transform/build_signal_priority.py` and `scripts/transform/build_page_insights.py` apply the `is_active_scoring_allowed(access_status)` predicate to each series referenced from the catalog. Items whose predicate is false are excluded from primary slots; they may still appear in `missing_high_value_signals` for transparency. The previous `GATED_STATUSES` constant (which gated on `source_status`) is replaced by the predicate (which gates on `access_status`). The `source_status` field on `RankedEntry` continues to be populated, but its value is now the entry's `access_status` verbatim — downstream consumers reading `source_status` see the new enum values. `proxy_only` series (e.g. `bond_volatility_proxy`) have `is_active_scoring_allowed === true` and ARE allowed in active outputs under their proxy name.
2. **Validator-time guard.** `validate_candidate_isolation.py` catches leaks in committed JSON. It enumerates every series whose `is_active_scoring_allowed === false` and grep-checks the listed active-output files for the corresponding `series_id`.
3. **Pytest contract.** Existing `tests/python/test_signal_priority.py` gated-source non-leak test is extended; new `tests/python/test_candidate_isolation.py` adds an intentional-leak fixture per new `AccessStatus` enum value (one fixture per: `free_public_candidate`, `terms_review_needed`, `authenticated_candidate`, `restricted_vendor`, `unavailable`). Each fixture must fail validation; the test asserts failure with a clear message naming the leaking series_id and receiving file.

### `source-governance-agent` acceptance

- All 13 source registry entries carry the new `access_status` enum + `requires_secret` + `active_scoring_allowed` + `public_redistribution_allowed` fields; reclassification table matches the file state.
- All 7 new source registry entries are present (`bea`, `bls`, `multpl_shiller`, `ny_fed`, `naaim`, `aaii`, `tradingview`).
- All 105 existing series_catalog entries carry the new fields; series-level migration table applied; `score_status` field is RETAINED as a derived alias (computed from `access_status`).
- 12 new series-level entries appended for already-reviewed candidate sources: 5 put/call + 5 VX (3 vx_n + vx_front_spread + vx_contango_score) + naaim_exposure_candidate + aaii_sentiment_candidate.
- `scripts/shared/catalog.py` `governance()` factory accepts a new `access_status: AccessStatus` kwarg and derives `score_status` from it; all callsites in `catalog.py` updated to pass both kwargs.
- `scripts/transform/build_signal_priority.py` and `scripts/transform/build_page_insights.py` updated to use the `is_active_scoring_allowed(access_status)` predicate in place of the old `GATED_STATUSES` set; `source_status` projection on RankedEntry now carries `access_status` verbatim; existing test suites pass.
- `scripts/update_data.py` MODULES list restructured into per-phase sub-lists; final `MODULES = (...)` concatenation declared.
- All three validators (`validate_schema`, `validate_freshness`, `validate_candidate_isolation`) pass on existing data after migration; intentional-leak fixtures fail the validator with clear messages naming the leaking series_id.
- `public/data/candidates/README.md` and `.gitkeep` exist.
- `npm run build` and `npm test` still pass.
- Frontend route reads `entry?.access_status ?? entry?.score_status` continue to work because both fields are populated (no frontend edits required from phase A).
- No edits to `src/components/`, `src/routes/`, `scripts/ingest/`, or `.github/workflows/`.

## Phase B — official sources + Cboe candidates + sentiment candidates

### `official-sources-agent`

**Source reviews to commit first.**

- `docs/source_reviews/bea_personal_saving_rate.md` — BEA hosts personal saving rate freely; FRED mirrors series `PSAVERT`. Expected conclusion: `free_public_active`.
- `docs/source_reviews/shiller_cape.md` — Robert Shiller's Yale data page distributes CAPE under a public-data convention; the Shiller spreadsheet endpoint and citation requirements are documented in the review. Expected conclusion: `free_public_active` if endpoint stability is confirmed.
- Re-review `docs/source_reviews/ny_fed_acm_term_premium.md` with documented endpoint, attribution, and update cadence. Possible outcomes: stays `terms_review_needed` (candidate file lands but is gated) or promotes to `free_public_active`. The ingest script writes to `candidates/` initially regardless; promotion is a separate JSON path move in a follow-up PR.

**Outputs.**

- `public/data/series/personal_saving_rate.json` — `free_public_active`. Monthly cadence; month-end timestamp. Standard `TimeSeriesFile` shape with `source`, `source_url`, `units`, `frequency`, `generated_at_utc`, `summary`, `observations`.
- `public/data/series/cape_ratio.json` — `free_public_active`. Monthly cadence. Same shape.
- `public/data/candidates/ny_fed_acm_term_premium_candidate.json` — `free_public_candidate`. Monthly cadence. Same shape. After promotion review, file path may change to `series/term_premium_acm_10y.json` and status to `free_public_active` in a separate PR; this phase does not perform that move.
- `public/data/derived/treasury_supply_pressure.json` — derived from existing `series/treasury_auction_supply.json`. `free_public_active`. Event-driven cadence (refreshed when new auction data lands).

**Schema + freshness validators.** Add expectations for each new file. Personal saving rate is monthly with month-end timestamp; CAPE is monthly; ACM is monthly (per NY Fed publication); supply pressure is event-driven.

**Pipeline integration.** Append the four new module paths to the per-phase sub-lists in `scripts/update_data.py` per the MODULES coordination rule (specifically: `MODULES_INGEST_PHASE_B_OFFICIAL` for ingest scripts and `MODULES_TRANSFORM_PHASE_B` for the supply-pressure transform). The safe-update path preserves prior good JSON on failure; failures record into `public/data/status/data_status.json`.

**Acceptance.**

- Three source review docs committed before any ingest script in the same PR.
- All four output files validate against schema and freshness.
- `python -m scripts.update_data` produces them on a fresh repo when network is available.
- `MODULES_INGEST_PHASE_B_OFFICIAL` and `MODULES_TRANSFORM_PHASE_B` contain the new module paths in declaration order.
- New series_catalog entries for `personal_saving_rate`, `cape_ratio`, `ny_fed_acm_term_premium_candidate` are appended to `series_catalog.json` in the same PR.
- No edits to `src/components/`, `src/routes/`, or other agents' files.
- ACM stays as candidate file in `candidates/` unless promotion review explicitly approves.

### `cboe-candidate-agent`

**Outputs (all `free_public_candidate` in `public/data/candidates/`).**

- `put_call_total_candidate.json`
- `put_call_index_candidate.json`
- `put_call_equity_candidate.json`
- `put_call_vix_candidate.json`
- `put_call_spxw_candidate.json`
- `vx1_candidate.json`, `vx2_candidate.json`, `vx3_candidate.json`
- `vx_front_spread_candidate.json` (derived from VX1/VX2)
- `vx_contango_score_candidate.json` (derived; e.g. percentile of front-spread)

Daily cadence for all. Source reviews already exist (`docs/source_reviews/cboe_put_call.md`, `docs/source_reviews/vix_futures_curve.md`); both gated. This phase does not promote them. Candidate files land for `RouteDataFooter` candidate-panel display and `MissingSignalPanel` confidence text.

Each output file carries `access_status: "free_public_candidate"`, `active_scoring_allowed: false`, `public_redistribution_allowed: true` (candidate file can exist in repo; just can't drive scores).

**Acceptance.**

- All candidate files validate.
- Validator catches any attempt to use these `series_id`s in active outputs.
- No `series/` or `derived/` writes from this agent.
- No edits outside `scripts/ingest/`, `scripts/transform/`, and `public/data/candidates/`.

### `sentiment-candidate-agent`

**Outputs.**

- `public/data/candidates/naaim_exposure_candidate.json` — `terms_review_needed` per existing `docs/source_reviews/aaii_naaim.md` (read 2026-05-10: "Keep AAII and NAAIM source-gated and non-active until a later review approves an access and publication path"). Per the derivation table, `terms_review_needed` files have `public_redistribution_allowed: false`. The candidate file is therefore **NOT** committed to the repo — it is only generated locally for source-review-experiment purposes and feeds the route-data-footer's candidate panel via build artifacts when reviewing locally. Wait — this conflicts with the table; resolve below.
- `public/data/candidates/aaii_sentiment_candidate.json` — same treatment.

**Resolution of the redistribution conflict.** `terms_review_needed` was originally meant to keep candidate files out of the repo. But this design's audit grid expects the Sentiment route's FocusBlock to surface NAAIM/AAII context. To make this coherent:

- Option (A) `sentiment-candidate-agent` writes the ingest script but produces **no committed candidate file**. The Sentiment FocusBlock's "candidate" text falls back to "data not yet active" because the file is absent.
- Option (B) Re-review `aaii_naaim.md` in this phase to upgrade to `free_public_candidate` if the NAAIM XLS terms permit candidate-status redistribution (not commercial republication). This requires a fresh source review.

**Design choice: Option (A) for safety.** Re-reviewing AAII/NAAIM terms is its own workstream and conservative interpretation (per the existing review) stands. `sentiment-candidate-agent` ships the ingest script and the `series_catalog.json` entries are pre-added by phase A, but no candidate JSON is committed in this PR. A follow-up PR can land the candidate JSON after a successful re-review.

Weekly cadence.

**Acceptance.**

- Ingest scripts exist and are wired into `MODULES`.
- Source-review status confirmed as `terms_review_needed` per existing `aaii_naaim.md`.
- No candidate JSON committed to `public/data/candidates/` for NAAIM or AAII in this phase.
- Sentiment FocusBlock's data-derivation in phase D handles the absent-file case with a "data not yet active" answer string.
- No active scoring impact.

### Cross-agent collision check

All three agents write to disjoint files. `source_registry.json` and `series_catalog.json` are touched only by phase A — phase B/C agents only reference entries pre-added by `source-governance-agent`. If an agent needs a `series_id` that phase A did not pre-add, the agent must coordinate with the QA fixup PR (below), not edit `series_catalog.json` directly.

### MODULES coordination — split into per-phase sub-lists

`scripts/update_data.py` currently has a single `MODULES` Python list (15 entries) with one entry per line and a closing `]`. Parallel appends from phase B/C/D all collide on the closing-`]` line — git's textual three-way merge produces a conflict every time, regardless of the logical commutativity of appends.

**Phase A restructures `MODULES` into named per-phase sub-lists**, concatenated at the bottom:

```python
MODULES_INGEST_EXISTING = [
    "scripts.ingest.fetch_cboe",
    "scripts.ingest.fetch_fred_csv",
    "scripts.ingest.fetch_treasury",
    "scripts.ingest.fetch_cftc",
]

MODULES_INGEST_PHASE_B_OFFICIAL: list[str] = []          # official-sources-agent appends here
MODULES_INGEST_PHASE_B_CBOE: list[str] = []              # cboe-candidate-agent appends here
MODULES_INGEST_PHASE_B_SENTIMENT: list[str] = []         # sentiment-candidate-agent appends here
MODULES_INGEST_PHASE_C_TRADINGVIEW: list[str] = []       # tradingview-candidate-agent appends here

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

MODULES_TRANSFORM_PHASE_B: list[str] = []                # any phase B transform additions (e.g. treasury_supply_pressure)

MODULES_VALIDATE = [
    "scripts.validate.validate_schema",
    "scripts.validate.validate_freshness",
    # validate_candidate_isolation runs transitively via validate_schema.run();
    # no separate MODULES entry needed.
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

Each phase B/C agent edits ONLY its named sub-list. Different sub-lists are in disjoint regions of the file; git auto-merges without conflict. Each sub-list starts empty in phase A's commit; phase B/C fills in. Phase A also writes a comment above each empty sub-list explaining which agent owns it.

**Coordination rule:**

- `official-sources-agent` appends to `MODULES_INGEST_PHASE_B_OFFICIAL` and `MODULES_TRANSFORM_PHASE_B`.
- `cboe-candidate-agent` appends to `MODULES_INGEST_PHASE_B_CBOE`.
- `sentiment-candidate-agent` appends to `MODULES_INGEST_PHASE_B_SENTIMENT`.
- `tradingview-candidate-agent` appends to `MODULES_INGEST_PHASE_C_TRADINGVIEW`.
- The final `MODULES = (...)` concatenation lives in phase A's commit; phase B/C never edit it.
- QA verifies all expected entries are present in their respective sub-lists.

This structure has no merge conflict for parallel appends and keeps the `MODULES` final ordering deterministic and visible in one place.

## Phase C — TradingView authenticated candidates + workflow secrets

### Source review

`docs/source_reviews/tradingview_authenticated_candidates.md` committed before any ingest script. Conclusion is preset by this design: `authenticated_candidate`, `requires_secret: true`, `active_scoring_allowed: false`, `public_redistribution_allowed: false` for all three TradingView-sourced series. Citation: "Authenticated TradingView candidate feed; not treated as official ICE MOVE or Cboe data."

### Workflow change

Single targeted edit in `.github/workflows/update-data.yml`: extend the existing `Fetch, transform, score, and validate data` step's `env:` block:

```yaml
env:
  # ...existing keys preserved...
  TRADINGVIEW_USERNAME: ${{ secrets.TRADINGVIEW_USERNAME }}
  TRADINGVIEW_PASSWORD: ${{ secrets.TRADINGVIEW_PASSWORD }}
  ENABLE_AUTHENTICATED_CANDIDATES: ${{ secrets.ENABLE_AUTHENTICATED_CANDIDATES }}
```

No new step, no new job, no schedule change, no permissions change. `continue-on-error: true` is already on this step.

### Secret helpers — `scripts/shared/config.py`

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

Helpers must never log secret values, only presence/absence booleans.

### `requirements.txt` additions

Current state: `requirements.txt` contains only `pytest>=8,<9`. The TradingView fetch path requires:

```
pandas>=2.2,<3
requests>=2.32,<3
tvdatafeed-fork>=1.5,<2     # or whichever maintained TradingView client the source review pins
```

All three are **required** entries — pandas and requests are genuinely new for this repo. The TV client is also genuinely required: if it is absent, phase C's ingest scripts cannot run at all. The earlier "optional, imported with try/except ImportError" language is removed; the `try/except ImportError` block in each ingest script is now a defensive fallback for environments where the install partially failed, not the primary skip condition. The primary skip condition is `tradingview_credentials_available() === False`.

The source review `docs/source_reviews/tradingview_authenticated_candidates.md` documents the specific TV client chosen and its pin range. Library choice must be a maintained fork with documented authentication semantics; the agent verifies no on-disk session cache outside the OS temp dir (see acceptance below).

### Ingest scripts

Three files following the existing `scripts/ingest/fetch_*.py` shape:

- `fetch_tradingview_move.py` → `public/data/candidates/tradingview_move_candidate.json`
- `fetch_tradingview_put_call.py` → `public/data/candidates/tradingview_put_call_candidate.json`
- `fetch_tradingview_vx_curve.py` → `public/data/candidates/tradingview_vx_curve_candidate.json`

Each script's top-level guard:

```python
if not tradingview_credentials_available():
    log_info("TradingView candidates disabled or secrets missing; skipping.")
    return
try:
    import <tv_library>
except ImportError:
    log_warning("TradingView library not installed; skipping candidate fetch.")
    return
```

On fetch failure (network, auth, API change), log without secret values and exit cleanly. The existing safe-update path in `scripts/update_data.py` preserves the prior good candidate JSON.

### Output file shape

Each candidate file:

```json
{
  "series_id": "tradingview_move_candidate",
  "source": "TradingView",
  "access_status": "authenticated_candidate",
  "score_status": "candidate",
  "active_scoring_allowed": false,
  "public_redistribution_allowed": false,
  "requires_secret": true,
  "generated_at_utc": "...",
  "notes": "Authenticated candidate feed; not treated as official ICE MOVE / Cboe data.",
  "observations": [...]
}
```

### Schema + freshness validators

Add expectations under the candidate-isolation namespace from phase A. Daily cadence; tolerate missing file (no fail when secrets absent).

### Frontend exposure

None in this phase. TradingView candidate data is visible only via existing `CandidateDiagnosticPanel` and `MissingSignalPanel` mechanisms in `RouteDataFooter`. Phase D may add a small "authenticated candidate" badge in those panels but no hero chart, `page_insights` slot, or active score uses these files.

### Secret-isolation test

`tests/python/test_secrets_isolation.py` asserts:

1. `secret()` never returns non-stripped values.
2. `tradingview_credentials_available()` returns False when env is empty.
3. **Secret NAME references are allowed only in an explicit allowlist of files.** The strings `TRADINGVIEW_USERNAME` / `TRADINGVIEW_PASSWORD` / `ENABLE_AUTHENTICATED_CANDIDATES` are legitimate env-var names; they may appear in:
   - `.github/workflows/update-data.yml` (workflow env block)
   - `scripts/shared/config.py` (the `secret()` helpers must reference the names to read the env)
   - `scripts/ingest/fetch_tradingview_*.py` (each may reference `tradingview_credentials_available()` plus error-message scrubbing patterns)
   - `docs/source_reviews/tradingview_authenticated_candidates.md` (documents which secrets the workflow injects)
   - `tests/python/test_secrets_isolation.py` (asserts behavior, exercises name patterns)
   - This spec file itself.
   Any reference outside this allowlist fails the test. Implementation: enumerate matches via `grep -rE` then subtract the allowlist; remaining hits cause failure.
4. **No secret VALUES may appear anywhere in the repo.** The test sets fake env values (`os.environ["TRADINGVIEW_USERNAME"] = "fake-user-token-abc123"` and similar) before invoking each TV ingest script in a sandboxed run, then asserts that no committed file under `public/`, `docs/`, or `scripts/` (and no captured `caplog` output from the test run) contains the substring `"fake-user-token-abc123"` or its companion fake password. This proves the credential never leaks into JSON outputs or log artifacts under realistic conditions.
5. **No TradingView candidate observation arrays are committed when `public_redistribution_allowed: false`.** The current spec puts `public_redistribution_allowed: false` on `authenticated_candidate` while permitting the file itself to ship; the test guards the stricter rule that if a future review flips a TV series to `public_redistribution_allowed: false` AND no longer permits committed observations, the workflow respects the flag. Implementation: read each candidate file's `public_redistribution_allowed`; if false and a separate `commit_observations` flag is also false, assert the file's `observations` array is empty.
4. The chosen TV client's cache directory, if any, is configurable and is set to a path under `tempfile.gettempdir()` (e.g. `/tmp/.tv_cache_<uuid>`) for the workflow run, never the home directory. The test enumerates the client's documented cache-path env variable and asserts the workflow sets it.
5. Exception handling in each ingest script catches `Exception` from the TV client, sanitizes the message to remove any substring containing the username or password, and re-logs with a generic message. The test mocks the TV client to raise `Exception("login failed for user a1258737881@gmail.com")` and asserts the logged output does not contain `@` or any other recognizable credential fragment.

### `tradingview-candidate-agent` acceptance

- Source review doc committed first; includes pinned TV-client name/version.
- Workflow env block extended; no other workflow edits.
- `requirements.txt` additions are pinned (pandas, requests, TV client).
- `scripts/shared/config.py` exports the secret helpers with tests.
- All three candidate files validate when generated; absence is silently tolerated.
- `test_secrets_isolation.py` passes (all 5 assertions including cache-path and exception-scrubbing).
- Secret-NAME allowlist check passes (see `test_secrets_isolation.py` assertion 3): the strings `TRADINGVIEW_USERNAME` / `TRADINGVIEW_PASSWORD` / `ENABLE_AUTHENTICATED_CANDIDATES` appear only in the allowlisted files.
- Secret-VALUE leak test passes (assertion 4): fake env values do not appear in any committed JSON, source file, or captured log when the TV ingest scripts run.
- TV client's cache path set to a temp dir via env variable in the workflow step; verified by a workflow-step `printenv | grep -i cache` check that the path starts with `/tmp` or `${RUNNER_TEMP}`.
- Each ingest script wraps the TV client call in a try/except that scrubs credentials from the exception message before logging.
- `MODULES` in `scripts/update_data.py` includes the three TV ingest module paths.
- No edits to `src/components/`, `src/routes/`, or other agents' files.

## Phase D — FocusBlock + page focus audit

### `FocusBlock` component spec

```tsx
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
```

- `variant="section"` renders a bordered block above a multi-chart section: eyebrow + question (typography-prominent) + answer paragraph + small risk/support/caveat lines.
- `variant="compact"` renders inside `InteractiveChartShell.insight` slot as plain text with light hierarchy. Fits the shell's existing insight dimensions.
- Optional fields omit cleanly with no DOM placeholders.
- Stale-data freshness applies a muted state.

### Coexistence rules (enforced by audit grid + tests)

| Level | Component | Use when |
|---|---|---|
| Route | `PageInsightHero` | Once per single-domain route. Unchanged in this phase. |
| Route | `HorizonScoreHeader` | On `TacticalTradingWeather.tsx` and `LongTermMacroClimate.tsx`. Replaces `PageInsightHero` on those routes; carries the horizon-level score read. Unchanged in this phase. |
| Route | `MarketBriefHeader` | On `Overview.tsx`. Carries the executive read. Unchanged in this phase. |
| Section | `FocusBlock variant="section"` | Above a multi-chart section that benefits from structured framing. Sparingly. |
| Chart | `InteractiveChartShell.insight` (string) | Default for ordinary charts. Unchanged in this phase. |
| Important chart | `InteractiveChartShell.insight={<FocusBlock variant="compact" .../>}` | Important single chart that needs structured framing. |

Never stack a route-level read (`PageInsightHero` / `HorizonScoreHeader` / `MarketBriefHeader`) + `FocusBlock variant="section"` + chart-level read in a way that produces duplicate reads with the same wording. The audit grid enforces this by allowing no more than five `FocusBlock` placements in this phase, and the verification gate runs a duplicate-text check against the source JSON strings (not the rendered DOM). The check is defined precisely under "Verification gate" below.

**HorizonScoreHeader coexistence on Tactical.** `TacticalTradingWeather.tsx` keeps `HorizonScoreHeader` as the route-level read (covering the horizon score and the top-level horizon interpretation). Above the existing 6-tile tactical section, a `FocusBlock variant="section"` is added with section id `tactical_stress_board` — its `question` and `answer` focus on the stress-board interpretation (which warnings are clustered? which supports counter?), distinct in wording from the horizon-level read. The verification gate's duplicate-text check enforces the distinction.

**LongTermMacroClimate exclusion.** `LongTermMacroClimate.tsx` keeps `HorizonScoreHeader` and does NOT receive `FocusBlock variant="section"` in this phase. Reason: PR 7 (long-term macro visual system) introduced `MacroClimateHeatmap`, `MacroRegimeQuadrant`, `GrowthLaborInflationMatrix`, `StrategicSourceGapMatrix` with their own per-component framing. Adding a section-level FocusBlock would duplicate framing the macro grid already carries.

### Data source — `page_insights.json` extension

In `src/lib/types.ts`:

```ts
export type SectionId =
  | "volatility_complex"
  | "rates_pressure"
  | "regime_drivers"
  | "positioning_vs_candidate_sentiment"
  | "tactical_stress_board";

export type RouteInsight = {
  // existing fields preserved
  sections?: SectionInsight[];
};

export type SectionInsight = {
  id: SectionId;             // matches a placement in the audit grid
  eyebrow: string;
  question: string;          // hand-curated, static (≤ 120 characters)
  answer: string;            // data-derived (60–200 characters)
  why?: string;              // ≤ 200 characters
  risk?: string;             // ≤ 120 characters
  support?: string;          // ≤ 120 characters
  caveat?: string;           // ≤ 200 characters
  freshness_status: SignalFreshnessStatus;
};
```

Character-length pins are enforced by `validate_schema.py` so the FocusBlock layout doesn't break with unexpectedly long strings.

**`freshness_status` fallback rules.** When the SECTION_CATALOG derivation function cannot find its underlying data:
- If the file is absent entirely: write `freshness_status: "unavailable"` and an `answer` like "Data not yet active for this section." `why`, `risk`, `support`, `caveat` are omitted.
- If the file is present but stale (older than the freshness threshold): write `freshness_status: "stale"` and an `answer` that uses the last known data with a "as of {last_observation_date}" prefix; `caveat` notes the staleness.
- If the file is fresh and parseable: write `freshness_status: "ok"` and the full derivation result.

### `build_page_insights.py` extension

Add `SECTION_CATALOG: dict[RouteKey, list[SectionTemplate]]` where each `SectionTemplate` carries the section `id`, hand-curated `eyebrow` and `question`, and a Python derivation function that reads from existing derived JSONs (`rates_dashboard.json`, `volatility_dashboard.json`, `regime_dashboard.json`, `shock_risk_snapshot.json`, `signal_priority.json`) to fill `answer`/`why`/`risk`/`support`/`caveat`/`freshness_status`. Static text lives in Python; dynamic text is derived. Frontend only renders.

### Audit grid

Five `variant="section"` placements. No `variant="compact"` placement in this phase — the originally-considered FragilityShockRisk compact placement is dropped because `ShockRiskContributionChart` (verified at `src/routes/FragilityShockRisk.tsx:125`) is rendered directly and not wrapped in `InteractiveChartShell`, so there is no insight slot to populate. Wrapping it in the shell would extend phase D's scope into chart-shell changes, conflicting with the no-shell-changes acceptance criterion.

Each placement is gated on data presence — when its `SectionInsight` is absent or its underlying data is missing, the FocusBlock does not render (no blank or loading block).

| Route | Section id | Variant | Placement | Data spine |
|---|---|---|---|---|
| `Volatility.tsx` | `volatility_complex` | section | Above the `volatility_primary_chart` + `volatility_secondary_charts` slots | `volatility_dashboard.json` |
| `Rates.tsx` | `rates_pressure` | section | Above the `rates_primary_chart` + `rates_secondary_charts` slots | `rates_dashboard.json` |
| `RegimeMap.tsx` | `regime_drivers` | section | Above the `regime_primary_chart` slot | `regime_dashboard.json` |
| `Sentiment.tsx` | `positioning_vs_candidate_sentiment` | section | Above the `sentiment_primary_chart` slot and the candidate panel pair below | CFTC actives + new NAAIM/AAII candidate files (fallback to "data not yet active" when files absent) |
| `TacticalTradingWeather.tsx` | `tactical_stress_board` | section | Above the existing tactical 6-tile section | `signal_priority.json[top_warnings]` + tactical readiness |

`FocusBlock variant="compact"` is implemented in the component but **deferred** in this phase — no compact placements ship until a follow-up. The compact variant exists in code so that future work can use it without re-implementing; the audit grid is what determines placement, and the grid intentionally contains no compact placements right now.

**Compact placement considered then dropped:** `FragilityShockRisk.tsx`'s `ShockRiskContributionChart` was originally proposed for a compact placement, but the chart is rendered directly (not wrapped in `InteractiveChartShell`) at `src/routes/FragilityShockRisk.tsx:125`, so there is no `insight` slot to populate. Wrapping it in the shell would extend phase D's scope into chart-shell changes, conflicting with the no-shell-changes acceptance criterion. Decision: not added in this phase; revisit if the chart is wrapped in a future cleanup.

**Section placements not considered:** Other routes (`Credit`, `Liquidity`, `DollarGlobal`, `Commodities`, `Inflation`, `Growth`, `Housing`, `LongTermMacroClimate`, `Overview`, `Calendar`, `Methodology`, `HistoricalRegimeReplay`) do **not** receive `FocusBlock variant="section"` in this phase. They already have `PageInsightHero`/`HorizonScoreHeader`/`MarketBriefHeader` plus chart-level `insight` strings; adding section-level FocusBlocks would duplicate reads. `LongTermMacroClimate` specifically retains its PR-7 macro grid framing instead of overlaying a FocusBlock.

### Tests

- Vitest: `FocusBlock` renders all field combinations in both variants; optional fields omit cleanly; freshness state applies styling.
- Vitest: each of the five placements renders against a fixture `page_insights.json` and gracefully degrades when `sections` is absent. Fixtures live at `src/__fixtures__/page_insights/` — three fixtures per placement: `<route>_complete.json` (all fields), `<route>_minimal.json` (only required fields), `<route>_unavailable.json` (sections empty).
- Pytest: `build_page_insights.py` populates `sections` for the listed `RouteKey`s; derivation functions match documented logic; `validate_schema.py` enforces the new `SectionInsight` shape including the `id` enum and character-length pins on each text field.

### Phase D and phase B coordination

Phase D depends on phase B's data only at QA gate, not at dispatch. The new section text for Sentiment (NAAIM/AAII context) is written defensively: if `naaim_exposure_candidate.json` or `aaii_sentiment_candidate.json` is absent, the SECTION_CATALOG derivation falls back to a "data not yet active" answer string. Phase D can land before phase B's data fully arrives; FocusBlocks light up incrementally as data lands.

### `focus-pattern-agent` acceptance

- `FocusBlock.tsx` exists with both variants and passes Vitest.
- `page_insights.json` schema and `RouteInsight` type extended with `sections`; `SectionId` enum exposed.
- `build_page_insights.py` produces `sections` for the five placements with hand-curated questions/eyebrows and data-derived answers; fallback paths cover absent, stale, and ok freshness.
- Five placements inserted in the listed routes with no shell or hero changes.
- Duplicate-text check passes on every route the agent touches (first 80 chars of each rendered read are distinct).
- No edits to `PageInsightHero`, `RouteDataFooter`, `InteractiveChartShell`, or other charts.
- Tests cover happy path, missing data, missing optional fields, and the character-length pins.

## Cross-cutting decisions

### Source precedence

When multiple feeds for the same conceptual signal exist:

```
official_direct (free_public_active)
  > official_direct (free_public_candidate)
  > authenticated_candidate (TradingView)
  > missing_signal_panel
```

Frontend selection logic lives in derived JSON builders, not in React. `build_page_insights.py` consults `signal_priority.json` plus the `access_status` of underlying series, picks the highest-precedence feed available, and writes `freshness_notes` if the active feed is candidate-class.

### Workflow + CI safety

- Workflow change is env-block-only in the existing data step. No new step, job, schedule, or permissions.
- `continue-on-error: true` already exists; existing safe-update path preserves prior good JSON on any failure.
- Grep gate in QA: `grep -r "TRADINGVIEW_" public/ docs/ src/` returns zero results.

### Schema validation strategy

Per-section gating implemented in `validate_schema.py`. Candidate isolation enforced by `validate_candidate_isolation.py`. Both invocations exist:
- `python -m scripts.validate.validate_schema` imports and transitively runs `validate_candidate_isolation.run()` after its own schema checks.
- `python -m scripts.validate.validate_candidate_isolation` is also valid as a standalone command (used by QA gate and CI for clarity).

Running both back-to-back is intentional — the second is a no-op when the first already covered it, but the explicit command surfaces failures in CI logs distinctly.

### Active-scoring guard — three-layer defense

1. Python build-time filter in `build_signal_priority.py` and `build_page_insights.py`. The filter applies `active_scoring_allowed === true` to each candidate series, computed from its `access_status` via the derivation table. This includes `proxy_only` series (e.g. `bond_volatility_proxy`) which ARE allowed in active outputs under their proxy name.
2. Validator-time grep against committed JSON via `validate_candidate_isolation.py`.
3. Pytest contract with intentional-leak fixtures per new enum value (`free_public_candidate`, `terms_review_needed`, `authenticated_candidate`, `restricted_vendor`, `unavailable`).

### Tone

All FocusBlock copy is descriptive — no advice, no targets, no buy/sell/short language. Hand-curated `question` strings are framed neutrally. Data-derived `answer` strings reuse phrasing patterns already approved in `docs/LIMITATIONS.md` and existing `why_it_matters` fields.

## Verification gate — `qa-agent`

```bash
npm test
npm run build
python -m pytest tests/python -v
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
python -m scripts.validate.validate_candidate_isolation     # new
python -m scripts.update_data                                # smoke; network-conditional
```

Plus these explicit checks:

- No active score uses any `series_id` whose `active_scoring_allowed` is false. Equivalently: every `series_id` appearing in an active output has `access_status ∈ {free_public_active, proxy_only}` per the derivation table.
- No leak of TradingView / Cboe-candidate / NAAIM / AAII `series_id`s into `signal_priority.json` primary slots, `page_insights.json` primary slots, `score_summary.json`, `regime_score.json`, `bucket_scores.json`, or `shock_risk_snapshot.json`.
- `public/data/candidates/README.md` exists; every file in that directory carries `active_scoring_allowed: false`.
- Secret-NAME allowlist check passes (no references to `TRADINGVIEW_USERNAME` / `TRADINGVIEW_PASSWORD` / `ENABLE_AUTHENTICATED_CANDIDATES` outside `.github/workflows/update-data.yml`, `scripts/shared/config.py`, `scripts/ingest/fetch_tradingview_*.py`, `docs/source_reviews/tradingview_authenticated_candidates.md`, `tests/python/test_secrets_isolation.py`, and this spec file).
- Secret-VALUE leak test passes (fake env values never appear in committed artifacts or test logs).
- Every new route placement of `FocusBlock` renders cleanly when its underlying `sections` data is absent.
- Duplicate-text check (run as a pytest assertion against committed `page_insights.json`): for each `RouteKey` that has a `sections` entry, the first 80 characters (case- and whitespace-normalized) of `routes[<route>].why_it_matters` (route-level read) and each `routes[<route>].sections[*].answer` (section-level read) are pairwise distinct. The check operates against JSON strings, not rendered DOM. Test lives at `tests/python/test_page_insights_duplicate_reads.py`.
- `RouteDataFooter` is still the last element on every route.
- All new FocusBlock placements have ARIA labels and fallback text.
- `MODULES` in `scripts/update_data.py` contains every new ingest/transform/validate module path from phases B + C in correct order.
- A short verification report committed to `docs/superpowers/plans/2026-05-10-data-source-and-focus-pattern-expansion-verification.md`.

### `qa-agent` acceptance

- All commands above pass.
- All bullet checks above are confirmed.
- Verification report committed.

## Acceptance summary

| Phase | Primary deliverable | Verification |
|---|---|---|
| A | `AccessStatus` enum + flags + 13 source-registry reclassifications + 7 new source entries + 105 series-catalog migrations + 12 appended candidate series entries + `governance()` factory extension + MODULES sub-list restructure + gating-predicate rewrite + candidate-isolation validator + candidates directory | All validators pass; intentional-leak fixtures fail validator; pytest extension passes; `score_status` kept as derived alias |
| B | Personal saving rate + CAPE + ACM candidate + treasury supply pressure + Cboe put/call candidates + VX candidates + NAAIM/AAII ingest scripts (no committed JSON) | All new JSONs validate; candidate isolation holds; safe-update preserves prior good data; MODULES extended |
| C | TradingView MOVE/put-call/VX candidates with workflow env-block extension and secret helpers, pinned TV client | Secrets never leak; cache path under temp dir; exception scrubbing works; missing secrets tolerated; candidate files validate when generated; MODULES extended |
| D | `FocusBlock` + `SectionInsight` extension + five route placements | FocusBlock renders both variants; placements degrade gracefully when data absent; duplicate-text check passes |
| QA | Verification gate | All commands green; all bullet checks confirmed; report committed |

## Appendix: agent dispatch ordering

```
Phase A: source-governance-agent
        |
        v
Phase B: official-sources-agent ‖ cboe-candidate-agent ‖ sentiment-candidate-agent
Phase C: tradingview-candidate-agent
Phase D: focus-pattern-agent
        |
        v
Phase QA: qa-agent
```

B, C, and D may dispatch and merge in parallel after A merges. QA dispatches after the last of B/C/D merges.

## Appendix: files-modified matrix

`R` = read; `W` = write (full ownership or append-only); `—` = untouched. Files shown are the coordination points; each agent owns many more files exclusive to its scope.

| File | source-governance | official-sources | cboe-candidate | sentiment-candidate | tradingview-candidate | focus-pattern | qa |
|---|---|---|---|---|---|---|---|
| `public/data/catalog/source_registry.json` | W (full) | R | R | R | R | R | R |
| `public/data/catalog/series_catalog.json` | W (reclassify all 105 + append already-reviewed candidates) | W (append 3 new) | R | R | W (append 3 new) | R | R |
| `scripts/shared/catalog.py` | W (governance() factory extension) | R | R | R | R | R | R |
| `scripts/validate/validate_schema.py` | W (AccessStatus enum check) | — | — | — | — | W (SectionId enum check, append-only) | R |
| `scripts/validate/validate_freshness.py` | R | W (append) | W (append) | W (append) | W (append) | W (append) | R |
| `scripts/validate/validate_candidate_isolation.py` | W (new) | — | — | — | — | — | R |
| `scripts/update_data.py` MODULES sub-lists | W (split structure) | W (append to own sub-list) | W (append to own sub-list) | W (append to own sub-list) | W (append to own sub-list) | — | R |
| `scripts/shared/config.py` | — | — | — | — | W | — | R |
| `src/lib/types.ts` | W (AccessStatus enum + flags; keep ScoreStatus) | — | — | — | — | W (`SectionInsight`, `SectionId`, `RouteInsight.sections`) | R |
| `src/lib/data.ts` | — | — | — | — | — | R | R |
| `scripts/transform/build_signal_priority.py` | W (gating rewrite to `is_active_scoring_allowed`) | — | — | — | — | — | R |
| `scripts/transform/build_page_insights.py` | W (gating rewrite) | — | — | — | — | W (`SECTION_CATALOG`, `_build_sections()`) | R |
| `tests/python/test_signal_priority.py` | W | — | — | — | — | — | R |
| `tests/python/test_candidate_isolation.py` (new) | W | — | — | — | — | — | R |
| `tests/python/test_secrets_isolation.py` (new) | — | — | — | — | W | — | R |
| `tests/python/test_page_insights_duplicate_reads.py` (new) | — | — | — | — | — | W | R |
| `.github/workflows/update-data.yml` | — | — | — | — | W (env block only) | — | R |
| `requirements.txt` | — | — | — | — | W | — | R |
| `public/data/candidates/README.md` (new) | W | — | — | — | — | — | R |
| `public/data/candidates/*.json` (new files) | — | — | W | — (skipped per Option A) | W | — | R |
| `public/data/series/*.json` (new files) | — | W (personal_saving_rate, cape_ratio) | — | — | — | — | R |
| `public/data/derived/*.json` (new files) | — | W (treasury_supply_pressure) | — | — | — | — | R |
| `docs/source_reviews/*.md` (new docs) | — | W (bea, shiller, updated ny_fed) | — | — | W (tradingview) | — | R |
| `src/components/FocusBlock.tsx` (new) | — | — | — | — | — | W | R |
| `src/routes/*.tsx` (5 routes for FocusBlock) | — | — | — | — | — | W (5 routes only) | R |

**Coordination points and resolution:**

1. `source_registry.json` — phase A writes it fully; phase B/C agents only read. No conflict.
2. `series_catalog.json` — phase A reclassifies all existing entries and appends entries for already-reviewed sources. Phase B/C agents append entries for sources reviewed in their own PRs. All new entries append at the end of the array; pre-existing entries are touched only by phase A. Git conflicts limited to the trailing `]` line; trivially resolvable. QA confirms file is valid JSON post-merge.
3. `update_data.py` MODULES — split into per-phase sub-lists by phase A. Each phase B/C agent edits only its named sub-list. Disjoint regions; trivial merge. The final `MODULES = ...` concatenation lives in phase A's commit only.
4. `validate_freshness.py` — multiple phase agents add freshness expectations. Appends near the end of the file; minor conflict on trailing structure; QA validates final state.
5. `validate_schema.py` — phase A adds an `AccessStatus` enum-check function; phase D appends a `SectionId` enum-check function below it. Different functions, different regions; trivial merge if phase A merges first.
6. `src/lib/types.ts` — phase A adds `AccessStatus` + flag types near existing governance types; phase D adds `SectionInsight` + `SectionId` types near existing `RouteInsight` definition. Different regions; trivial merge.
7. `build_page_insights.py` — phase A rewrites gating logic; phase D adds `SECTION_CATALOG` and `_build_sections()`. Different functions; trivial merge if phase A merges first (as it must).
8. `scripts/shared/catalog.py` — phase A extends `governance()` factory; phase B/C agents call it with new `access_status` kwargs but don't edit the factory itself.
