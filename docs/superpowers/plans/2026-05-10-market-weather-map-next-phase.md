# market-weather-map next phase — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan wave-by-wave. Within each agent dispatch, use superpowers:test-driven-development for the per-task cycle (failing test → implement → passing test → commit). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every single-domain route first-glance interpretive, fix the regime-map math/axes/label bug, add four pre-computed dashboard JSONs, redesign volatility and rates charts, and add per-route hero charts to the nine content routes that lack one — all carved into 10 agent dispatches across 5 sequential waves.

**Architecture:** Vite + React + TypeScript frontend reading static JSON under `public/data/`; Python ingest + transform writes the JSON via GitHub Actions; ECharts via the local `src/charts/EChartPanel.tsx` wrapper for heavy charts. The collision hotspot is `src/routes/*.tsx`, so Wave 2 takes single ownership of route refactors and inserts labeled JSX slot comments — Wave 3 and Wave 4 agents then fill *slots*, not files. Five waves with phase-gated PR merges between them.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Vitest/jsdom, ECharts (`echarts/core` modular imports + `CanvasRenderer`), Recharts (legacy, retained for tertiary charts), Python 3.11, pytest, static JSON under `public/data/`.

**Spec reference:** [docs/superpowers/specs/2026-05-10-market-weather-map-next-phase-design.md](../specs/2026-05-10-market-weather-map-next-phase-design.md)

---

## Required context

Read these before any agent dispatch:

- `docs/superpowers/specs/2026-05-10-market-weather-map-next-phase-design.md` — the approved design.
- `CLAUDE.md` — hard constraints (no backend, no browser-side providers, descriptive output, ECharts wrapper rules).
- `.claude/skills/market-weather-map-next-phase/SKILL.md` — phase playbook including PR 1–6 acceptance patterns and verification gate.
- `docs/LIMITATIONS.md` — descriptive-language tone bound; no advice/forecasts/buy/sell/target/stop language.
- `docs/source_reviews/` — gating decisions for ICE MOVE, Cboe SKEW, Cboe put/call, Cboe/CFE VX futures curve, NY Fed ACM term premium.

## Hard constraints (carry-over for every agent)

- No backend service, database, or live market feed.
- No browser-side provider calls, API keys, or secrets — not in Vite, frontend code, public JSON, logs, docs, or env.
- All external data ingestion runs in `scripts/ingest/...` or GitHub Actions.
- Frontend reads only static JSON under `public/data/`.
- Output is descriptive. No financial advice, forecasts, trade recommendations, or buy/sell/short/target/stop language.
- New heavy charts use ECharts via `src/charts/EChartPanel.tsx` (`echarts/core` modular imports + `CanvasRenderer`). No Plotly, Highcharts, or `echarts-for-react`.
- Source-gated items must NOT enter active scores, regime labels, checklist states, confidence, hero charts, or `page_insights.json` primary slots. They may surface in `<RouteDataFooter>` as readiness or diagnostic only.
- Every new `public/data/...` file gets a schema check in `scripts/validate/validate_schema.py` and a freshness expectation in `scripts/validate/validate_freshness.py`.

## Verification gate (every wave PR before merge)

```bash
npm test
npm run build
.venv/bin/python -m pytest tests/python -v
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
```

Optional smoke when network access is available:

```bash
.venv/bin/python -m scripts.update_data
```

(CI uses `setup-python@v5` so `python` resolves; locally use `.venv/bin/python` per the per-worktree venv pattern in CLAUDE.md.)

---

## Wave overview

| Wave | Branch | Agents (‖ = parallel) | Owns |
|---|---|---|---|
| Pre-W1 | (sync action, no branch) | (human) | Sync working branch with `origin/main` so PR 7 commits are present |
| W1 | `feat/next-phase-w1-foundation` | `be-data-agent` ‖ `fe-platform-agent` | Python data layer + types/loaders ‖ chart platform + UI primitives |
| W2 | `feat/next-phase-w2-ia-shell` | `ia-shell-agent` | `PageInsightHero`, `RouteDataFooter`, single-domain route refactors, slot insertion |
| W3 | `feat/next-phase-w3-chart-redesigns` | `vol-charts-agent` ‖ `rates-charts-agent` ‖ `regime-charts-agent` | Volatility / Rates / Regime chart redesigns into assigned slots |
| W4 | `feat/next-phase-w4-route-heroes` | `hero-credit-liquidity-dollar-commodities-agent` ‖ `hero-macro-domain-agent` ‖ `hero-sentiment-fragility-agent` | Per-route hero charts in disjoint route files |
| W5 | `feat/next-phase-w5-qa` | `qa-agent` | Verification gate, consistency checks, fix-up |

Each wave is one PR. W1 must merge before W2 dispatches. W2 must merge before W3 or W4 dispatch. W3 and W4 may dispatch in parallel against the same base (merge order is whichever finishes first; the second rebases). W5 dispatches after W3 and W4 both merge.

---

## Pre-W1: Sync working branch with origin/main (USER AUTHORIZATION REQUIRED)

PR 7 (#32, Long-Term macro visual system) merged into `origin/main` on 2026-05-10 at commit `e8be748`. The 4 design-doc commits from this brainstorm sit on a local `main` that does NOT include PR 7's commits (`25113e3`, `eb851a1`, `2fe4bdc`).

Before W1 dispatches, the working branch must be synced. Two options — pick one and confirm with the user:

**Option A — rebase (recommended; linear history):**

```bash
git fetch origin
git rebase origin/main
```

The 4 design-doc commits (`747cd73`, `8aa6f80`, `3637285`, `ca8f399`) replay on top of PR 7. Linear history. No merge commit.

**Option B — merge (preserves design-doc history exactly):**

```bash
git fetch origin
git merge origin/main
```

Creates a merge commit. Local main becomes a fork-and-merge of design-doc onto PR 7.

Either is fine; rebase is cleaner. Both rewrite local history, so neither should run without user approval. **Do not push to origin until the user explicitly approves.**

After sync, verify PR 7 artifacts are present:

```bash
test -f src/components/MacroRegimeQuadrant.tsx
test -f src/components/MacroClimateHeatmap.tsx
test -f src/components/StrategicSourceGapMatrix.tsx
test -f src/components/GrowthLaborInflationMatrix.tsx
grep -q "ScatterChart" src/charts/EChartPanel.tsx
echo "post-PR-7 sync verified"
```

If any check fails, do not dispatch W1.

---

## Chunk 1: Wave 1 — Foundation (data layer + chart platform)

**Branch:** `feat/next-phase-w1-foundation`
**Worktree:** `.worktrees/next-phase-w1-foundation` (per the local convention from PR 7)
**Parallel agents:** `be-data-agent` ‖ `fe-platform-agent` (disjoint file ownership; safe in same worktree)

### File ownership map (Wave 1)

| File | Owner | Operation |
|---|---|---|
| `scripts/transform/build_page_insights.py` | be-data | create |
| `scripts/transform/build_volatility_dashboard.py` | be-data | create |
| `scripts/transform/build_rates_dashboard.py` | be-data | create |
| `scripts/transform/build_regime_dashboard.py` | be-data | create |
| `scripts/transform/compute_regime_score.py` (lines 656–685) | be-data | modify |
| `scripts/update_data.py` | be-data | modify (wire 4 new builds) |
| `scripts/validate/validate_schema.py` | be-data | modify (add 4 schemas) |
| `scripts/validate/validate_freshness.py` | be-data | modify (add 4 expectations) |
| `tests/python/test_build_page_insights.py` | be-data | create |
| `tests/python/test_build_volatility_dashboard.py` | be-data | create |
| `tests/python/test_build_rates_dashboard.py` | be-data | create |
| `tests/python/test_build_regime_dashboard.py` | be-data | create |
| `tests/python/test_regime_lookback_fix.py` | be-data | create |
| `src/lib/types.ts` | be-data | modify (add 4 type sets) |
| `src/lib/data.ts` | be-data | modify (add `loadJsonOrNull` + 4 new loaders) |
| `src/lib/data.test.ts` | be-data | create or modify |
| `public/data/derived/page_insights.json` | be-data | generated output (committed) |
| `public/data/derived/volatility_dashboard.json` | be-data | generated output |
| `public/data/derived/rates_dashboard.json` | be-data | generated output |
| `public/data/derived/regime_dashboard.json` | be-data | generated output |
| `src/charts/buildTimeWindow.ts` | fe-platform | create |
| `src/charts/buildTimeWindow.test.ts` | fe-platform | create |
| `src/charts/buildMarkBands.ts` | fe-platform | create |
| `src/charts/buildMarkBands.test.ts` | fe-platform | create |
| `src/components/ChartRangeControls.tsx` | fe-platform | create |
| `src/components/ChartRangeControls.test.tsx` | fe-platform | create |
| `src/components/InteractiveChartShell.tsx` | fe-platform | create |
| `src/components/InteractiveChartShell.test.tsx` | fe-platform | create |
| `src/components/InsightCallout.tsx` | fe-platform | create |
| `src/components/DriverBarList.tsx` | fe-platform | create |
| `src/components/ChartStateBadge.tsx` | fe-platform | create |
| `src/components/__tests__/primitives.test.tsx` | fe-platform | create |

No file is owned by both agents. `src/lib/types.ts` is `be-data` only — `fe-platform` does not import the new types in W1.

### Agent W1A: `be-data-agent`

**Briefing prompt** (paste into Agent dispatch):

> You are `be-data-agent` in Wave 1 of the market-weather-map next-phase implementation. Your job is to build the four new derived JSONs (`page_insights`, `volatility_dashboard`, `rates_dashboard`, `regime_dashboard`), fix the regime-map sequential-delta bug, and add the matching TypeScript types/loaders in the frontend.
>
> Read first:
> - `docs/superpowers/specs/2026-05-10-market-weather-map-next-phase-design.md` Wave 1 → `be-data-agent` section (full schemas in TypeScript form).
> - `CLAUDE.md` hard constraints.
> - Existing patterns in `scripts/transform/compute_regime_score.py` (regime math you'll fix is at lines 656–685), `scripts/transform/build_signal_priority.py` (canonical priority builder), `scripts/validate/validate_schema.py` (existing schema check style), `src/lib/data.ts:36-48` (existing `loadJson` that throws on 404 — you add the permissive `loadJsonOrNull` sibling).
> - `public/data/derived/signal_priority.json` real shape — `freshness_status` enum is `"ok" | "stale" | "unavailable"` (use `SignalFreshnessStatus` from `src/lib/types.ts`).
>
> Use `superpowers:test-driven-development` for each task: write failing test, run to confirm fail, implement minimal code, run to confirm pass, commit.
>
> **Out of scope — do NOT touch:**
> - `src/routes/*` (W2's job)
> - `src/components/*` (W1B and later waves)
> - `src/charts/*` (W1B's job)
> - PR 7 components (`MacroRegimeQuadrant`, `MacroClimateHeatmap`, `StrategicSourceGapMatrix`, `GrowthLaborInflationMatrix`) — already shipped.
> - `EChartPanel.tsx` — PR 7 already registered `ScatterChart`.
>
> **Source-gating reminder:** ICE MOVE, Cboe SKEW, Cboe put/call, Cboe/CFE VX futures curve, NY Fed ACM term premium are footer-only. They must NOT appear in `page_insights.json[routes][*].primary_warning` or `primary_support`, and must NOT enter any new active-score path. Add a regression test asserting that source-gated category IDs are excluded from primary-warning/primary-support fields.

**Task list (TDD per superpowers:test-driven-development):**

- [ ] **Task W1A-1: Add `loadJsonOrNull<T>` helper to `src/lib/data.ts`.**
  - File: modify `src/lib/data.ts`. Test in `src/lib/data.test.ts` (create if absent).
  - Behavior: returns `null` when fetch yields a 404 (`DataLoadError` with `status === 404`); rethrows other errors and JSON-parse failures.
  - Test cases: 200 returns parsed JSON; 404 returns null; 500 throws; invalid path throws (matches existing `dataPathPattern`).
  - Commit: `feat(data): add loadJsonOrNull permissive loader for optional derived JSON`.

- [ ] **Task W1A-2: Add type exports to `src/lib/types.ts`.**
  - Add `PageInsightsFile`, `RouteInsight`, `SignalRef`, `RouteKey` (string union of 12 routes), `VolatilityDashboardFile`, `RatesDashboardFile`, `RegimeDashboardFile` and supporting member types per the spec's Wave 1 schemas.
  - `SignalRef.freshness_status` MUST reuse the existing `SignalFreshnessStatus` enum from this file (`"ok" | "stale" | "unavailable"`). Do NOT introduce a new enum.
  - Add a TypeScript-level test (compile check; tsc strict mode) — these types must be importable without circular-import errors.
  - Commit: `feat(types): add PageInsights / VolatilityDashboard / RatesDashboard / RegimeDashboard types`.

- [ ] **Task W1A-3: Add `loadPageInsights / loadVolatilityDashboard / loadRatesDashboard / loadRegimeDashboard` to `src/lib/data.ts`.**
  - Each delegates to `loadJsonOrNull` and returns `T | null`.
  - Test cases in `src/lib/data.test.ts`: each loader returns the parsed object on 200; returns null on 404; throws on schema mismatch (mock fetch with malformed JSON).
  - Commit: `feat(data): add loaders for the four next-phase dashboard JSONs`.

- [ ] **Task W1A-4: Build `scripts/transform/build_page_insights.py`.**
  - Inputs: `public/data/derived/signal_priority.json`.
  - Output: `public/data/derived/page_insights.json` matching the `PageInsightsFile` schema.
  - Build process per spec Wave 1 § page_insights: map signals to routes by category, pick highest-priority warning + support per route, derive `state`, set `confidence` = mean signal confidence per route, compose `freshness_notes` from any `stale` or `unavailable` signals in that route's category.
  - Source gating: source-gated signals (`source_status: "candidate"` or `"terms_review_needed"` for the gated set in CLAUDE.md) MUST NOT populate `primary_warning` or `primary_support`. They MAY appear in `freshness_notes`.
  - Test fixture: `tests/python/fixtures/signal_priority_for_page_insights.json` — small, deterministic, includes one source-gated signal that must NOT bubble into a primary slot.
  - Tests in `tests/python/test_build_page_insights.py`:
    - Output validates against the schema.
    - Each route key (12 routes) is present (omit only if no signal maps to that route).
    - Source-gated signals never populate `primary_*` (regression).
    - `state` derivation: warning-only → `"risk"`; support-only with high severity → `"support"`; both present → `"mixed"`; neither → `"unknown"`.
    - `freshness_status` values are within `SignalFreshnessStatus` enum.
  - Commit: `feat(transform): build page_insights.json from signal_priority`.

- [ ] **Task W1A-5: Build `scripts/transform/build_volatility_dashboard.py`.**
  - Inputs: existing series for VIX, VIX9D, VIX3M, VVIX, plus `vix9d_vix_ratio.json` and `vix_vix3m_ratio.json` already in `public/data/derived/`.
  - Output: `public/data/derived/volatility_dashboard.json` per spec.
  - 5-year rolling percentile for `latest_curve[*].percentile_5y`, `vix_percentile`, `vvix_percentile`.
  - `hidden_stress_score = vvix_percentile - vix_percentile`. `state` = `"calm"` if score < watch threshold, `"watch"` if watch ≤ score < elevated, `"elevated"` if score ≥ elevated. Thresholds in `thresholds` block of output.
  - `latest_curve` includes 3 tenors only (9D, 30D, 3M); structure must accept N tenors for future expansion.
  - Tests in `tests/python/test_build_volatility_dashboard.py`:
    - Output validates against schema.
    - `latest_curve` has exactly 3 entries with the expected tenor enum.
    - `hidden_stress` is non-empty and `state` matches threshold logic on a fixture.
    - 5-year rolling percentile is bounded [0, 100].
  - Commit: `feat(transform): build volatility_dashboard.json with VIX curve, ratio history, hidden stress`.

- [ ] **Task W1A-6: Build `scripts/transform/build_rates_dashboard.py`.**
  - Inputs: existing 2Y/10Y/20Y/30Y nominal Treasury, real-yield, breakeven series.
  - Output: `public/data/derived/rates_dashboard.json` per spec.
  - `yield_change_windows` in basis points (multiply percent delta by 100). `driver` heuristic: `real_yield` if |real bps| > 1.5 × |breakeven bps|, `breakeven` if reverse, `balanced` otherwise.
  - `curve_snapshots` reads existing series at the specified historical dates; if a tenor is missing on a snapshot date, omit that tenor from that snapshot only.
  - Tests in `tests/python/test_build_rates_dashboard.py`:
    - Output validates against schema.
    - bps used for `*_bps` fields, percent for `*_pct`.
    - `driver` classification matches the heuristic on a fixture.
    - Missing-tenor graceful degradation (one snapshot has no 30Y; output still valid).
  - Commit: `feat(transform): build rates_dashboard.json with waterfall windows, curve snapshots, decomposition history`.

- [ ] **Task W1A-7: Build `scripts/transform/build_regime_dashboard.py` AND fix the sequential-delta bug in `compute_regime_score.py:656–685`.**
  - New file `scripts/transform/build_regime_dashboard.py` produces `regime_dashboard.json` per spec, with `windows: { "20D", "60D", "120D" }`. Each point at date T uses **true lookback delta**: `value(T) - value(T - window_days)`, NOT `value(T) - value(T - 1)`.
  - In `compute_regime_score.py:656–685`, change the existing `quadrant_trail` computation to use a true 20-day lookback delta and add a deprecation comment: `# DEPRECATED: prefer regime_dashboard.json windows.20D`. Do NOT delete the field this phase (back-compat).
  - Quadrant assignment per spec: real_yield_change_bps × dollar_change_pct sign with `thresholds.real_yield_neutral_bps` and `thresholds.dollar_neutral_pct` dead zone.
  - Tests in `tests/python/test_build_regime_dashboard.py`:
    - Output validates against schema.
    - Each window's points are spaced one observation apart but each point's value is a true window-lookback delta (assert `point[i].real_yield_change_bps == real_yield[date_i] - real_yield[date_i - 20]` etc.).
    - All four `regime` enum values can be reached by fixture.
  - Tests in `tests/python/test_regime_lookback_fix.py`:
    - Build a fixture with real_yield series 0, 1, 2, 3, ..., 50.
    - Assert `quadrant_trail[k].real_yield_change` for the new computation equals `value[k] - value[k-20]`, NOT `value[k] - value[k-1]`.
  - Commit: `fix(regime): true 20-day lookback for quadrant_trail; add regime_dashboard.json with 20/60/120 windows`.

- [ ] **Task W1A-8: Wire 4 new build scripts into `scripts/update_data.py`.**
  - Each new script runs after its upstream data is generated. Failures preserve prior good JSON and record in `public/data/status/data_status.json` per the existing safe-update path.
  - Add a smoke test that asserts running `scripts/update_data.py` end-to-end on a fixture pipeline produces all four files (or a matching `data_status.json` entry on simulated failure).
  - Commit: `feat(update): wire next-phase derived dashboards into safe-update pipeline`.

- [ ] **Task W1A-9: Add 4 schema entries to `scripts/validate/validate_schema.py`.**
  - Per spec Wave 1: page_insights (route subset, signal-ref shapes, no source-gated entries in primary slots), volatility_dashboard (tenor enum, threshold completeness, state enum), rates_dashboard (window keys, driver enum, snapshot tenor enum), regime_dashboard (window keys, regime enum, thresholds present, point spacing ≥ 1 observation).
  - Tests in `tests/python/test_validate_schema_next_phase.py`:
    - Each new schema accepts a valid fixture.
    - Each new schema rejects a known-bad fixture (one per file: missing field, wrong enum, invalid route key, etc.).
  - Commit: `feat(validate): add schemas for the four next-phase dashboards`.

- [ ] **Task W1A-10: Add 4 freshness expectations to `scripts/validate/validate_freshness.py`.**
  - All four files: daily cadence, tolerance per existing convention.
  - Tests in `tests/python/test_validate_freshness_next_phase.py`: fresh fixtures pass, stale fixtures fail.
  - Commit: `feat(validate): add freshness expectations for next-phase dashboards`.

**Verification gate (run before reporting done):**

```bash
.venv/bin/python -m pytest tests/python -v
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
.venv/bin/python -m scripts.update_data
npm test -- src/lib/data.test.ts
npm run build
```

**Acceptance criteria (verifiable):**

- [ ] All four JSONs exist under `public/data/derived/` and validate against `validate_schema.py` and `validate_freshness.py`.
- [ ] `quadrant_trail` math fixed: regression test in `tests/python/test_regime_lookback_fix.py` passes.
- [ ] `loadJsonOrNull` is the only new public export in `src/lib/data.ts`'s general API; the four loaders use it.
- [ ] `SignalRef.freshness_status` reuses `SignalFreshnessStatus` from `src/lib/types.ts` (no new enum).
- [ ] No edits to `src/routes/`, `src/components/`, `src/charts/`, `src/charts/EChartPanel.tsx`.
- [ ] Source-gated regression test passes: source-gated signals do not appear in any `primary_warning` or `primary_support` field across all 12 route entries.
- [ ] `git log` shows commits per task (10 commits or fewer if combined logically).

### Agent W1B: `fe-platform-agent`

**Briefing prompt** (paste into Agent dispatch):

> You are `fe-platform-agent` in Wave 1. Build the chart-platform helpers and 5 reusable UI primitives that Wave 3, Wave 4, and Wave 2 will compose. You do NOT touch routes, existing components, or `src/lib/`.
>
> Read first:
> - `docs/superpowers/specs/2026-05-10-market-weather-map-next-phase-design.md` Wave 1 → `fe-platform-agent` section.
> - `src/charts/EChartPanel.tsx` — the canonical chart wrapper with empty/loading/error/normal states. Your `InteractiveChartShell` wraps `EChartPanel`, never replaces it.
> - `src/charts/chartTheme.ts`, `src/charts/chartFormatters.ts` — existing constants and callbacks. Reuse, do not duplicate.
> - PR 7 commit `25113e3` for the test-mock pattern when EChartPanel registrations change (you do not change them in W1, but the pattern is the reference).
>
> Use `superpowers:test-driven-development` for each task.
>
> **Out of scope — do NOT touch:**
> - `src/routes/*`
> - `src/lib/*` (W1A's job)
> - `src/components/*` other than the 5 specific new files listed in your file ownership
> - `src/charts/EChartPanel.tsx` (PR 7 has already registered ScatterChart; no changes needed)
> - `src/charts/chartTheme.ts` and `src/charts/chartFormatters.ts` (read-only — extend only by composition, not modification)
>
> **Tone reminder:** any user-facing strings (range labels, ARIA labels, badge text) stay descriptive — no advice, targets, or buy/sell language.

**Task list (TDD):**

- [ ] **Task W1B-1: `src/charts/buildTimeWindow.ts`.**
  - Pure function `buildTimeWindow<T extends { date: string }>(series: T[], preset: RangePreset): T[]`.
  - `RangePreset = "1M" | "3M" | "6M" | "1Y" | "3Y" | "All"` exported from this file.
  - Behavior: rolls back from `series[series.length - 1].date` by the preset's day count; `"All"` returns the full series; empty input returns empty.
  - Tests in `src/charts/buildTimeWindow.test.ts`: 1M filters last 30 days; "All" returns full; empty input returns empty; series with non-monotonic dates is normalized (sorted by date or documented as undefined-behavior — pick sorted).
  - Commit: `feat(charts): add buildTimeWindow helper for range-preset filtering`.

- [ ] **Task W1B-2: `src/charts/buildMarkBands.ts`.**
  - `ThresholdBand = { label: string; min?: number; max?: number; color: string }`.
  - `buildMarkBands(bands: ThresholdBand[]): MarkAreaOption["data"]` — returns the array shape that ECharts `markArea.data` consumes.
  - Tests in `src/charts/buildMarkBands.test.ts`: empty bands returns empty; one band with min+max emits one rect; missing min uses -Infinity; missing max uses +Infinity; label propagates to `name`.
  - Commit: `feat(charts): add buildMarkBands helper for threshold visualization`.

- [ ] **Task W1B-3: `src/components/ChartRangeControls.tsx`.**
  - Segmented control. Props: `{ value: RangePreset; onChange: (next: RangePreset) => void; available?: RangePreset[]; disabledReason?: string }`.
  - `available` defaults to all 6 presets; if a preset is not in `available`, render but disable it with `aria-disabled` and tooltip showing `disabledReason`.
  - Keyboard: arrow keys move selection; Enter/Space activates.
  - ARIA: `role="radiogroup"` on container, `role="radio"` on each preset.
  - Tests in `src/components/ChartRangeControls.test.tsx`:
    - Renders all 6 presets when `available` undefined.
    - Renders only specified subset when `available` is provided.
    - Clicking a preset calls `onChange(preset)`.
    - Disabled presets have `aria-disabled="true"`.
    - Keyboard arrow-key navigation moves focus.
  - Commit: `feat(components): add ChartRangeControls segmented preset selector`.

- [ ] **Task W1B-4: `src/components/ChartStateBadge.tsx`.**
  - Pill component. Props: `{ state: "risk" | "support" | "mixed" | "calm" | "watch" | "stale-data" }`.
  - Distinct CSS modifier per state (e.g., `.chart-state-badge--risk`) so future color shifts don't lose accessibility-by-text.
  - Tests in `src/components/__tests__/primitives.test.tsx`: each state renders a distinct class; visible label text matches state name.
  - Commit: `feat(components): add ChartStateBadge pill primitive`.

- [ ] **Task W1B-5: `src/components/InsightCallout.tsx`.**
  - Compact text block. Props: `{ state?: ChartState; message: string; caveat?: string }`.
  - Renders state badge inline (using `ChartStateBadge`), message text, optional caveat in muted style below.
  - Tests in `primitives.test.tsx`: renders without state; renders with state; renders caveat when present.
  - Commit: `feat(components): add InsightCallout for current-read summaries`.

- [ ] **Task W1B-6: `src/components/DriverBarList.tsx`.**
  - Horizontal bars list. Props: `{ items: Driver[]; max?: number }` where `Driver = { id; label; priority; direction; why_it_matters; freshness_status; confidence }` and `freshness_status` reuses `SignalFreshnessStatus` from `src/lib/types.ts`.
  - Bar length scales by `priority`. Bar color by `direction` (`risk` red-ish, `support` green-ish, `neutral` grey).
  - Tooltip on each bar shows `why_it_matters`, `freshness_status`, `confidence`.
  - `max` truncates the visible list to top-N by priority.
  - Tests in `primitives.test.tsx`: renders N bars; truncates to `max`; tooltip text composes correctly; bar width proportional to priority.
  - Commit: `feat(components): add DriverBarList for ranked warning/support visualization`.

- [ ] **Task W1B-7: `src/components/InteractiveChartShell.tsx`.**
  - Wraps a chart child. Props: `{ title: string; range?: RangePreset; onRangeChange?: (next: RangePreset) => void; state?: ChartState; insight?: ReactNode; ariaLabel: string; children: ReactNode }`.
  - Layout: title bar (with state badge if `state` provided) → optional `<ChartRangeControls>` → optional `<InsightCallout>` (if `insight` is a string, wrap it; if it's a node, render directly) → chart body via `children`.
  - Falls through to `EChartPanel`'s empty/loading/error states by virtue of wrapping its children.
  - Tests in `src/components/InteractiveChartShell.test.tsx`:
    - Renders with all props.
    - Renders without `range` / `state` / `insight` (graceful absence).
    - `aria-label` is present on the outer container.
    - Calls `onRangeChange` when the inner `ChartRangeControls` fires.
    - Re-renders without crashing when `children` is `null`.
  - Commit: `feat(components): add InteractiveChartShell wrapping EChartPanel with range + insight + state chrome`.

**Verification gate:**

```bash
npm test -- src/charts src/components/__tests__ src/components/ChartRangeControls src/components/InteractiveChartShell
npm run build
```

**Acceptance criteria:**

- [ ] All 7 new files exist with passing Vitest tests.
- [ ] `npm run build` passes; bundle size delta is documented in the PR description (acceptable if < 5KB gzipped for these primitives).
- [ ] No edits to `src/routes/`, `src/lib/`, existing `src/components/*`, `src/charts/EChartPanel.tsx`, `chartTheme.ts`, `chartFormatters.ts`.
- [ ] All new components export TypeScript types (no `any` in public APIs).
- [ ] All charts/components have ARIA labels.

### Wave 1 PR review checklist

Before merging W1:

- [ ] `be-data-agent` and `fe-platform-agent` task lists fully checked off.
- [ ] Both agents' verification gates pass.
- [ ] Combined diff has no `src/routes/` or existing-component edits.
- [ ] Source-gated regression test passes.
- [ ] PR description lists the 4 new derived JSONs (with file paths) and the 7 new TypeScript modules.

---

## Chunk 2: Wave 2 — IA shell + route refactor

**Branch:** `feat/next-phase-w2-ia-shell`
**Worktree:** `.worktrees/next-phase-w2-ia-shell`
**Single agent:** `ia-shell-agent` — sole owner of route refactors this wave.

### File ownership map (Wave 2)

| File | Operation |
|---|---|
| `src/components/PageInsightHero.tsx` | create |
| `src/components/PageInsightHero.test.tsx` | create |
| `src/components/RouteDataFooter.tsx` | create |
| `src/components/RouteDataFooter.test.tsx` | create |
| `src/styles.css` (or modular CSS file) | modify (hero + footer styles) |
| `src/routes/Rates.tsx` | modify (insert hero + 2 slots, relocate footer) |
| `src/routes/Volatility.tsx` | modify (hero + 2 slots + footer) |
| `src/routes/RegimeMap.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/LongTermMacroClimate.tsx` | modify (keep `HorizonScoreHeader`; add 2 slots; footer) |
| `src/routes/Credit.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/Liquidity.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/DollarGlobal.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/Commodities.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/Inflation.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/Growth.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/Housing.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/Sentiment.tsx` | modify (hero + 1 slot + footer) |
| `src/routes/FragilityShockRisk.tsx` | modify (hero + 2 slots + footer; preserve PR 6 body order) |
| `src/routes/TacticalTradingWeather.tsx` | modify (wrap existing data-tail in footer; insert 2 vol slots wrapping existing chart usages) |
| `src/routes/Overview.tsx` | modify (wrap existing data-tail in footer only; no hero, no slots) |
| `src/routes/Calendar.tsx` | modify (wrap data-tail in footer only) |
| `src/routes/Methodology.tsx` | modify (wrap data-tail in footer only) |
| `src/routes/HistoricalRegimeReplay.tsx` | modify (wrap data-tail in footer only) |
| `src/routes/data-routes.test.tsx` | modify (assert hero + footer + slot comments per route) |

### Agent W2: `ia-shell-agent`

**Briefing prompt:**

> You are `ia-shell-agent` in Wave 2. Build `PageInsightHero` and `RouteDataFooter`, then apply the IA pattern to all 17 routes per the slot map in the spec. You are the sole owner of route refactors this wave; W3 and W4 will fill the slots you insert.
>
> Read first:
> - `docs/superpowers/specs/2026-05-10-market-weather-map-next-phase-design.md` Wave 2 section. The slot map enumerates exactly which slots go in which routes.
> - Existing route patterns: `src/routes/Overview.tsx` (`MarketBriefHeader` + signal section + tail) and `src/routes/TacticalTradingWeather.tsx` (`HorizonScoreHeader` + signal + 6-tile section + tail).
> - PR 6 pattern in `src/routes/FragilityShockRisk.tsx`: read header → `ShockRiskContributionChart` → `HiddenStressMismatchPanel` → `BondVolatilityProxyChart` (NOT-MOVE caveat verbatim) → `TailRiskReadinessMatrix` → metric cards → tail.
> - W1's new loaders in `src/lib/data.ts` and types in `src/lib/types.ts` (`PageInsight`, `RouteInsight`, `RouteKey`).
>
> **Slot convention:** insert exact JSX comment markers like `{/* SLOT:rates_primary_chart */}`. W3/W4 will replace these comments with chart JSX via exact-string match — do not surround with extra whitespace or modify the marker format.
>
> **Out of scope — do NOT touch:**
> - Route content above the slots in routes where the spec says to preserve existing order.
> - PR 6's body order in `FragilityShockRisk.tsx`. The "not MOVE" caveat on `BondVolatilityProxyChart` is load-bearing and stays verbatim.
> - The 4 new derived JSONs (W1's output).
> - The 7 new primitive components from W1B.
> - Charts that the slots will be filled by W3/W4 — only the slot markers go in this wave.

**Task list (TDD):**

- [ ] **Task W2-1: Build `src/components/PageInsightHero.tsx`.**
  - Props: `{ route: RouteKey }`. Reads `loadPageInsights()` and looks up `routes[route]`.
  - Renders: title, `<ChartStateBadge state={state} />`, primary warning + primary support (use `<DriverBarList items={[primary_warning, primary_support].filter(Boolean)} max={2} />`), why-it-matters paragraph, freshness/confidence caveat, generated-at timestamp.
  - Fallback when `loadPageInsights()` returns `null` OR the route key has no entry: render minimal heading-only stub with text "Current read unavailable — see data status below."
  - Tests in `src/components/PageInsightHero.test.tsx`:
    - Renders full hero when route insight is present.
    - Renders fallback when `loadPageInsights()` resolves to `null`.
    - Renders fallback when the route key is missing from `routes`.
    - State badge state matches the route insight's state field.
    - Source-gated signals never appear in primary slots (this is enforced upstream by `be-data-agent`, but the test asserts that when given a fixture with a source-gated entry, the hero gracefully omits it).
  - Commit: `feat(components): add PageInsightHero rendering route-keyed page_insights`.

- [ ] **Task W2-2: Build `src/components/RouteDataFooter.tsx`.**
  - Props: `{ route?: RouteKey; children?: ReactNode }`.
  - Renders: a "Data and sources" heading, a subtle visual separator, `<DataGapPanel route={route} />` (if route provided), `<DataStatusTable route={route} />`, then `children` (where routes pass route-specific source-gap or readiness panels).
  - Tests in `src/components/RouteDataFooter.test.tsx`:
    - Renders heading and separator.
    - Renders `DataGapPanel` and `DataStatusTable` when `route` provided.
    - Renders children below default panels.
    - Children render after default panels (assert DOM order).
  - Commit: `feat(components): add RouteDataFooter wrapping data-transparency tail`.

- [ ] **Task W2-3: Refactor `src/routes/Rates.tsx`.**
  - After heading: `<PageInsightHero route="rates" />`.
  - Then: `{/* SLOT:rates_primary_chart */}` then `{/* SLOT:rates_secondary_charts */}`.
  - Existing metric-card JSX stays in place between slots and footer.
  - Move `DataGapPanel`, `DataStatusTable`, `CandidateDiagnosticPanel` (Treasury supply diagnostics), readiness panels, source-gap panels into `<RouteDataFooter route="rates">` at the bottom.
  - Update `src/routes/data-routes.test.tsx` to assert: hero present immediately after heading, two slot comments present, footer is the last element, `CandidateDiagnosticPanel` is inside footer.
  - Commit: `refactor(rates): apply hero + slots + footer pattern`.

- [ ] **Task W2-4: Refactor `src/routes/Volatility.tsx`.**
  - Same shape: hero + 2 slots (`volatility_primary_chart`, `volatility_secondary_charts`) + metric cards + footer.
  - Existing volatility chart imports stay (W3 will replace them); the slots are placed where the new charts will land.
  - Update `data-routes.test.tsx` for Volatility.
  - Commit: `refactor(volatility): apply hero + slots + footer pattern`.

- [ ] **Task W2-5: Refactor `src/routes/RegimeMap.tsx`.**
  - Hero + 1 slot (`regime_primary_chart`) + existing supplementary charts + footer.
  - Update `data-routes.test.tsx`.
  - Commit: `refactor(regime-map): apply hero + slot + footer pattern`.

- [ ] **Task W2-6: Refactor `src/routes/LongTermMacroClimate.tsx`.**
  - Keep `HorizonScoreHeader` (do NOT replace with `PageInsightHero`).
  - Insert `{/* SLOT:macro_regime_chart */}` and `{/* SLOT:macro_yield_chart */}` above the macro group loop.
  - Move `CandidateDiagnosticPanel` and `StrategicSourceGapMatrix` (PR 7) into footer.
  - Update `data-routes.test.tsx`.
  - Commit: `refactor(long-term-macro): add slots; relocate diagnostics to footer; preserve HorizonScoreHeader`.

- [ ] **Task W2-7: Refactor `src/routes/FragilityShockRisk.tsx`.**
  - Per PR 6 pattern (preserve body order): read header → `ShockRiskContributionChart` (in `fragility_primary_chart` slot — wrap the existing usage with the slot comment) → `HiddenStressMismatchPanel` (cross-asset, stays in body) → `BondVolatilityProxyChart` (NOT-MOVE caveat preserved verbatim, stays in body) → `TailRiskReadinessMatrix` (stays in body) → `{/* SLOT:fragility_pre_metrics_slot */}` → metric cards → `<RouteDataFooter>` containing `DataGapPanel`, `DataStatusTable`, `CandidateDiagnosticPanel`, `MismatchWarningPanel`, `TailRiskPanel`.
  - Add `<PageInsightHero route="fragility" />` immediately after the read header.
  - Update `data-routes.test.tsx`.
  - **Critical:** assert in tests that the literal string "not MOVE" appears in the page (load-bearing caveat).
  - Commit: `refactor(fragility): apply hero + 2 slots + footer; preserve PR 6 body order and NOT-MOVE caveat`.

- [ ] **Task W2-8: Refactor `src/routes/Credit.tsx`, `Liquidity.tsx`, `DollarGlobal.tsx`, `Commodities.tsx`.**
  - Each: hero + 1 primary slot + metric cards + footer.
  - Update `data-routes.test.tsx`.
  - Commit: `refactor(credit-liquidity-dollar-commodities): apply hero + slot + footer pattern`.

- [ ] **Task W2-9: Refactor `src/routes/Inflation.tsx`, `Growth.tsx`, `Housing.tsx`.**
  - Same shape.
  - Commit: `refactor(inflation-growth-housing): apply hero + slot + footer pattern`.

- [ ] **Task W2-10: Refactor `src/routes/Sentiment.tsx`.**
  - Hero + 1 slot + footer.
  - Commit: `refactor(sentiment): apply hero + slot + footer pattern`.

- [ ] **Task W2-11: Refactor `src/routes/TacticalTradingWeather.tsx`.**
  - Do NOT add `<PageInsightHero>` (existing `HorizonScoreHeader` stays).
  - In the existing 6-tile chart section, wrap the current `<VixCurveProxyChart />` usage with `{/* SLOT:tactical_vol_curve_slot */}` ... `{/* /SLOT:tactical_vol_curve_slot */}`. Same for `<VolatilityComplexChart />` with `tactical_vol_complex_slot`. (Use open + close marker convention so W3 vol-charts-agent can replace the wrapped usage atomically.)
  - Move existing footer-eligible panels (`DataGapPanel`, `DataStatusTable`, options sentiment source gates, VX futures readiness, event source gates, static-feed-freshness) into `<RouteDataFooter>`.
  - Commit: `refactor(tactical): wrap vol slots and apply footer; preserve HorizonScoreHeader and 6-tile section`.

- [ ] **Task W2-12: Wrap data tails in `Overview.tsx`, `Calendar.tsx`, `Methodology.tsx`, `HistoricalRegimeReplay.tsx`.**
  - Only the data-transparency tail goes into `<RouteDataFooter>`. No hero added. Content order above the tail unchanged.
  - **Critical:** `HistoricalRegimeReplayPanel.tsx:79` literal "20-observation changes" string is correct per `docs/METHODOLOGY.md` and must NOT be touched.
  - Commit: `refactor(overview-calendar-methodology-replay): wrap data tails in RouteDataFooter`.

- [ ] **Task W2-13: Cross-route consistency tests in `data-routes.test.tsx`.**
  - Loop over all 17 routes; assert `<RouteDataFooter>` is the last element rendered.
  - Loop over the 12 single-domain routes; assert `<PageInsightHero>` is present.
  - Loop over the 12 single-domain routes + Tactical; assert the slot-comment IDs match the spec slot map.
  - Commit: `test(routes): cross-route hero + footer + slot consistency`.

**Verification gate:**

```bash
npm test
npm run build
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
```

**Acceptance criteria:**

- [ ] Every single-domain route's first scroll position shows hero + slot comment before metric cards (verified by reading JSX top-down and by `data-routes.test.tsx`).
- [ ] Every route ends with `<RouteDataFooter>`. No `DataGapPanel`/`DataStatusTable`/`CandidateDiagnosticPanel`/readiness/source-gap/static-feed-freshness panels exist outside `<RouteDataFooter>`.
- [ ] Slot comments match the spec slot map exactly (case, underscores).
- [ ] `Overview.tsx`, `TacticalTradingWeather.tsx`, `Calendar.tsx`, `Methodology.tsx`, `HistoricalRegimeReplay.tsx` content order above the tail is unchanged.
- [ ] FragilityShockRisk preserves PR 6 body order; "not MOVE" caveat literal present.
- [ ] HistoricalRegimeReplay's "20-observation changes" string at line 79 is unchanged.
- [ ] `npm test` and `npm run build` pass.

### Wave 2 PR review checklist

- [ ] All 13 W2 tasks checked off.
- [ ] No source-gated panels above the footer on any route.
- [ ] Slot map verification: 19 slots inserted across the 13 single-domain routes (Tactical has 2; Rates and Volatility have 2 each; LongTermMacro has 2; FragilityShockRisk has 2; the 8 remaining routes have 1 each).

---

## Chunk 3: Wave 3 — Chart redesigns (volatility, rates, regime)

**Branch:** `feat/next-phase-w3-chart-redesigns`
**Worktree:** `.worktrees/next-phase-w3-chart-redesigns`
**Parallel agents:** `vol-charts-agent` ‖ `rates-charts-agent` ‖ `regime-charts-agent`

Each agent owns its chart components AND its assigned slots in routes. The slot convention prevents file-level collision: agents do exact-string replacement of the slot-comment markers W2 inserted.

`LongTermMacroClimate.tsx` is touched by both `rates-charts-agent` (slot `macro_yield_chart`) and `regime-charts-agent` (slot `macro_regime_chart`) — different slot IDs, no collision.

### File ownership map (Wave 3)

| File | Owner | Operation |
|---|---|---|
| `src/components/charts/VixCurveTermStructureChart.tsx` | vol-charts | create |
| `src/components/charts/VixRatioHistoryChart.tsx` | vol-charts | create |
| `src/components/charts/VolatilityHiddenStressChart.tsx` | vol-charts | create |
| `src/components/charts/__tests__/vol-charts.test.tsx` | vol-charts | create |
| `src/routes/Volatility.tsx` (slots `volatility_primary_chart`, `volatility_secondary_charts`) | vol-charts | replace slot comments |
| `src/routes/TacticalTradingWeather.tsx` (slots `tactical_vol_curve_slot`, `tactical_vol_complex_slot`) | vol-charts | replace slot wrappers |
| `src/components/charts/YieldChangeWaterfallChart.tsx` | rates-charts | create |
| `src/components/charts/YieldCurveComparisonChart.tsx` | rates-charts | create |
| `src/components/charts/YieldDecompositionStackChart.tsx` | rates-charts | create |
| `src/components/charts/__tests__/rates-charts.test.tsx` | rates-charts | create |
| `src/routes/Rates.tsx` (slots `rates_primary_chart`, `rates_secondary_charts`) | rates-charts | replace slot comments |
| `src/routes/LongTermMacroClimate.tsx` (slot `macro_yield_chart`) | rates-charts | replace slot comment |
| `src/components/RegimeQuadrantChart.tsx` | regime-charts | rebuild in ECharts (same path, same export) |
| `src/components/RegimeQuadrantChart.test.tsx` | regime-charts | rewrite tests for ECharts |
| `src/components/MacroRegimeQuadrant.tsx` | regime-charts | modify (repoint to `regime_dashboard.json`; PR 7 already created the file) |
| `src/components/MacroRegimeQuadrant.test.tsx` | regime-charts | update tests for new data source |
| `src/routes/RegimeMap.tsx` (slot `regime_primary_chart`) | regime-charts | replace slot comment |
| `src/routes/LongTermMacroClimate.tsx` (slot `macro_regime_chart`) | regime-charts | replace slot comment |

### Agent W3A: `vol-charts-agent`

**Briefing prompt:**

> You are `vol-charts-agent` in Wave 3. Build the three new volatility chart components and fill the volatility slots in `Volatility.tsx` and `TacticalTradingWeather.tsx`. Other W3 agents are working in parallel — you only edit your owned slots and your own component files.
>
> Read first:
> - Spec Wave 3 → `vol-charts-agent` section.
> - W1B's `InteractiveChartShell` and `ChartRangeControls` (your charts wrap with these unless `compact` is true).
> - W1A's `volatility_dashboard.json` shape (`latest_curve`, `ratio_history`, `hidden_stress`, `thresholds`).
> - `src/charts/EChartPanel.tsx` — registered chart types include `LineChart`, `BarChart`, `HeatmapChart`, `ScatterChart` (PR 7 added the last). All needed chart types are registered.
> - `src/components/VixCurveProxyChart.tsx` and `VolatilityComplexChart.tsx` for the existing implementations you replace in Tactical's 6-tile section.
>
> **"Proxy" terminology:** the term-structure chart title intentionally says "Volatility curve (proxy)" because these are index points (VIX9D / VIX / VIX3M), not VX futures. VX futures remain source-gated.
>
> **Out of scope:**
> - Other slots in routes (rates and regime agents own those).
> - `EChartPanel.tsx` itself (no new chart type registrations).
> - `VixCurveProxyChart.tsx` / `VolatilityComplexChart.tsx` legacy files — leave them in place (importable but unused after slot fills); their full removal is deferred.

**Task list:**

- [ ] **Task W3A-1: `src/components/charts/VixCurveTermStructureChart.tsx`.**
  - ECharts categorical x-axis (`9D`, `30D`, `3M`), y = VIX level. Latest snapshot only (line + symbols).
  - Optional regime-band background via `markArea` using project's existing volatility classifiers (read from `volatility_dashboard.json[thresholds]`).
  - Tooltip: tenor, value, 5-year percentile.
  - Wrap with `<InteractiveChartShell title="Volatility curve (proxy)" state={...} insight={...} ariaLabel="Volatility curve term structure" />`.
  - Props: `{ data: VolatilityDashboardFile["latest_curve"]; thresholds?: VolatilityDashboardFile["thresholds"]; compact?: boolean }`. When `compact` is true: no `InteractiveChartShell` chrome, height ~200px instead of ~400px, simpler tooltip (tenor + value only).
  - Tests in `vol-charts.test.tsx`: renders full mode; renders compact mode; tooltip contents; `markArea` present when thresholds provided; "proxy" word is present in the rendered DOM in non-compact mode.
  - Commit: `feat(charts): add VixCurveTermStructureChart`.

- [ ] **Task W3A-2: `src/components/charts/VixRatioHistoryChart.tsx`.**
  - ECharts line chart with two series: `vix9d_vix` and `vix_vix3m` from `volatility_dashboard.json[ratio_history]`.
  - `markArea` bands for `calm` / `flat` / `stress` zones using `volatility_dashboard.json[thresholds]`.
  - `dataZoom` slider + inside.
  - `<ChartRangeControls available={["1M","3M","6M","1Y","3Y","All"]} />` (default `1Y`).
  - Tests: renders both series; range-control switches the visible window via `buildTimeWindow`; `markArea` matches threshold props.
  - Commit: `feat(charts): add VixRatioHistoryChart with threshold bands and range zoom`.

- [ ] **Task W3A-3: `src/components/charts/VolatilityHiddenStressChart.tsx`.**
  - Two-panel layout via ECharts `grid` array sharing x-axis:
    - Top: scatter (x = `vix_percentile`, y = `vvix_percentile`). Recency-colored via `visualMap`. Quadrant labels — upper-left = "hidden options stress."
    - Bottom: line strip showing `hidden_stress_score` over time, `markLine` at watch and elevated thresholds.
  - `<ChartRangeControls>` controls both panels.
  - Props: `{ data: VolatilityDashboardFile["hidden_stress"]; thresholds: VolatilityDashboardFile["thresholds"]; compact?: boolean }`. Compact mode: scatter only, no controls, no shell.
  - Tests: renders both panels; visualMap recency gradient correct; `compact` collapses to scatter only.
  - Commit: `feat(charts): add VolatilityHiddenStressChart with scatter + strip + recency visualMap`.

- [ ] **Task W3A-4: Fill slots in `src/routes/Volatility.tsx`.**
  - Replace `{/* SLOT:volatility_primary_chart */}` with `<VixCurveTermStructureChart data={volDashboard.latest_curve} thresholds={volDashboard.thresholds} />` (loading + null guards).
  - Replace `{/* SLOT:volatility_secondary_charts */}` with `<VixRatioHistoryChart ... />` and `<VolatilityHiddenStressChart ... />` stacked.
  - Use `loadVolatilityDashboard()` (W1A) at the route level; if it returns `null`, render an "interactive volatility view loading..." placeholder.
  - Update `data-routes.test.tsx` to assert the new charts render under fixture data.
  - Commit: `feat(volatility-route): wire term-structure, ratio-history, and hidden-stress charts into slots`.

- [ ] **Task W3A-5: Fill slots in `src/routes/TacticalTradingWeather.tsx`.**
  - Replace the `tactical_vol_curve_slot` wrapper (containing the existing `<VixCurveProxyChart />` usage) with `<VixCurveTermStructureChart compact ... />`.
  - Replace the `tactical_vol_complex_slot` wrapper with `<VolatilityHiddenStressChart compact ... />`.
  - The existing 6-tile section structure stays.
  - Update tests.
  - Commit: `feat(tactical): swap VIX curve + volatility complex tiles to next-phase compact charts`.

**Verification:**

```bash
npm test -- src/components/charts src/routes/Volatility src/routes/TacticalTradingWeather
npm run build
```

**Acceptance:**

- [ ] Three new chart files exist with passing fixture-render tests.
- [ ] `Volatility.tsx` and `TacticalTradingWeather.tsx` slots are filled exactly; no edits to surrounding JSX.
- [ ] All charts go through `EChartPanel`; no direct `echarts` imports outside the wrapper (per CLAUDE.md).
- [ ] "Proxy" terminology preserved in non-compact term structure.
- [ ] Compact mode collapses chrome correctly per spec.

### Agent W3B: `rates-charts-agent`

**Briefing prompt:**

> You are `rates-charts-agent` in Wave 3. Build three rates chart components and fill rates-related slots in `Rates.tsx` and `LongTermMacroClimate.tsx`. The existing Recharts `YieldDecompositionChart` stays in place as tertiary history — do NOT migrate it this phase.
>
> Read first:
> - Spec Wave 3 → `rates-charts-agent` section.
> - W1A's `rates_dashboard.json` shape (`yield_change_windows`, `current_decomposition`, `curve_snapshots`, `decomposition_history`).
> - `src/components/YieldDecompositionChart.tsx` (Recharts, kept) — note units: percent for levels.
> - W1B's `InteractiveChartShell`.
>
> **Units rule:** bps for changes (your three new charts), percent for levels (existing chart).
>
> **Out of scope:** other slots, `YieldDecompositionChart.tsx` (legacy stays), `EChartPanel.tsx` registrations.

**Task list:**

- [ ] **Task W3B-1: `src/components/charts/YieldChangeWaterfallChart.tsx`.**
  - ECharts bar with stacked positive/negative segments per window (`1M`, `3M`, `6M`, `1Y`):
    - Real-yield contribution (one color)
    - Breakeven contribution (another color)
    - Total nominal annotated as text label above the stack.
  - `driver` field highlights the dominant bar via fill opacity.
  - x = window labels, y = bps.
  - Wrap with `<InteractiveChartShell title="Yield change waterfall" ariaLabel="..." />`.
  - Tests: renders bars per window; bps labels correct; `driver` highlight visible.
  - Commit: `feat(charts): add YieldChangeWaterfallChart in bps with driver highlight`.

- [ ] **Task W3B-2: `src/components/charts/YieldCurveComparisonChart.tsx`.**
  - ECharts line, x = tenor categorical (`2Y`, `10Y`, `20Y`, `30Y`), 4 series: current, 1M ago, 3M ago, 1Y ago. Color gradient old→new.
  - Drop tenors that are missing for any snapshot (graceful per `rates_dashboard.json` spec).
  - Tests: 4 series rendered; tenor missing in one snapshot does not crash chart.
  - Commit: `feat(charts): add YieldCurveComparisonChart with current vs historical snapshots`.

- [ ] **Task W3B-3: `src/components/charts/YieldDecompositionStackChart.tsx`.**
  - ECharts horizontal stacked bar showing one row: current real-yield + breakeven = nominal.
  - Annotated with values in pct.
  - Tests: stacked layout correct; annotations match `current_decomposition` fixture.
  - Commit: `feat(charts): add YieldDecompositionStackChart for current 10Y composition`.

- [ ] **Task W3B-4: Fill `Rates.tsx` slots.**
  - `rates_primary_chart` ← `<YieldChangeWaterfallChart data={ratesDashboard.yield_change_windows} />`.
  - `rates_secondary_charts` ← `<YieldCurveComparisonChart ... />` then `<YieldDecompositionStackChart ... />`.
  - Existing `<YieldDecompositionChart />` (Recharts) is moved BELOW the new charts but ABOVE metric cards as tertiary history. Add a small heading "Yield decomposition history" above it.
  - Update `data-routes.test.tsx`.
  - Commit: `feat(rates-route): wire waterfall, curve-comparison, decomposition-stack into slots`.

- [ ] **Task W3B-5: Fill `LongTermMacroClimate.tsx` `macro_yield_chart` slot.**
  - Replace `{/* SLOT:macro_yield_chart */}` with `<YieldDecompositionStackChart data={ratesDashboard.current_decomposition} />`.
  - Update tests.
  - Commit: `feat(long-term-macro): wire yield-decomposition-stack into macro slot`.

**Verification:**

```bash
npm test -- src/components/charts src/routes/Rates src/routes/LongTermMacroClimate
npm run build
```

**Acceptance:**

- [ ] Three new chart files with passing tests.
- [ ] bps for changes, percent for levels.
- [ ] `Rates.tsx` and `LongTermMacroClimate.tsx` slot edits surgical.
- [ ] Legacy `YieldDecompositionChart` still renders below the new ones; not removed.

### Agent W3C: `regime-charts-agent`

**Briefing prompt:**

> You are `regime-charts-agent` in Wave 3. Rebuild `RegimeQuadrantChart` in ECharts (replacing Recharts), repoint `MacroRegimeQuadrant` (PR 7 component) to `regime_dashboard.json`, and fill the regime slots in `RegimeMap.tsx` and `LongTermMacroClimate.tsx`.
>
> Read first:
> - Spec Wave 3 → `regime-charts-agent` section.
> - W1A's `regime_dashboard.json` shape with `windows: { "20D", "60D", "120D" }`.
> - Existing `src/components/RegimeQuadrantChart.tsx` (Recharts, axes are dollar-x / real-yield-y; misleading "20-observation change" label at line 55).
> - PR 7's `src/components/MacroRegimeQuadrant.tsx` (already real-yield-x / dollar-y; consumes legacy `quadrant_trail` — repoint to `regime_dashboard.json`).
> - `src/components/HistoricalRegimeReplayPanel.tsx:79` — its literal "20-observation changes" string is correct per `docs/METHODOLOGY.md` and must NOT be touched.
>
> **Standardized axes after this wave:** x = `real_yield_change_bps`, y = `dollar_change_pct`. RegimeQuadrantChart's axes flip from current.
>
> **Out of scope:**
> - `HistoricalRegimeReplayPanel.tsx`.
> - `regime_replay.json`, `regime_score.json`, other regime data files (W1A only changed `compute_regime_score.py:656-685` and added `regime_dashboard.json`).
> - `EChartPanel.tsx` registrations.

**Task list:**

- [ ] **Task W3C-1: Rebuild `src/components/RegimeQuadrantChart.tsx` in ECharts.**
  - Same file path, same default export name. Importers do not change.
  - Reads `loadRegimeDashboard()` (W1A loader). Default selected window: `20D`.
  - x = `real_yield_change_bps`, y = `dollar_change_pct`.
  - `visualMap` color = `vix_percentile`. `visualMap` size = absolute `credit_change_bps`.
  - `<ChartRangeControls available={["20D","60D","120D"]} />` to switch windows.
  - Trail rendered as connected scatter+line (custom series via `series.type: "scatter"` + `series.type: "line"` overlay; opacity gradient old→new).
  - Latest-point label.
  - Quadrant label annotations using ECharts `markArea` text or `graphic`:
    - x<0, y<0 → "risk-on easing"
    - x>0, y>0 → "global tightening / risk-off"
    - x<0, y>0 → "safe-haven / growth scare"
    - x>0, y<0 → "rotation / reflation / mixed"
  - Quadrant-meaning legend rendered below chart (text block with brief explanation per quadrant).
  - **Misleading "20-observation change" label removed** (current literal in this file at line 55). Replace with dynamic `"{window} change"` string based on selected window. Verify by grep that `"20-observation change"` (with hyphen) does not appear in this file after edit. The `HistoricalRegimeReplayPanel.tsx:79` "20-observation changes" (plural, in different context) stays.
  - Tests in `src/components/RegimeQuadrantChart.test.tsx`:
    - Renders with fixture from `regime_dashboard.json`.
    - Window selector switches the dataset.
    - Latest-point label displays the latest date's regime label.
    - Axis labels are `real_yield_change_bps` (x) and `dollar_change_pct` (y).
    - "20-observation change" string does NOT appear.
    - All four quadrant meaning strings appear.
  - Commit: `refactor(regime-quadrant): rebuild in ECharts; standardize axes; fix lookback label`.

- [ ] **Task W3C-2: Repoint `src/components/MacroRegimeQuadrant.tsx` to `regime_dashboard.json`.**
  - PR 7 already created this file using the legacy `quadrant_trail`. Switch its data source to `loadRegimeDashboard()`. Default window: `60D` (matches PR 7's default per memory).
  - Verify PR 7's existing axis convention is `(real-yield-x, dollar-y)` — should already be correct; if not, fix.
  - Update tests.
  - Commit: `refactor(macro-regime-quadrant): consume regime_dashboard.json; verify axis convention`.

- [ ] **Task W3C-3: Fill `RegimeMap.tsx` slot `regime_primary_chart`.**
  - Replace `{/* SLOT:regime_primary_chart */}` with `<RegimeQuadrantChart />`.
  - The component already loads its own data; no props needed at the route level.
  - Update `data-routes.test.tsx`.
  - Commit: `feat(regime-map-route): wire rebuilt RegimeQuadrantChart into slot`.

- [ ] **Task W3C-4: Fill `LongTermMacroClimate.tsx` slot `macro_regime_chart`.**
  - Replace `{/* SLOT:macro_regime_chart */}` with `<MacroRegimeQuadrant />`.
  - Update tests.
  - Commit: `feat(long-term-macro-route): wire MacroRegimeQuadrant into slot`.

**Verification:**

```bash
npm test -- src/components/RegimeQuadrantChart src/components/MacroRegimeQuadrant src/routes/RegimeMap src/routes/LongTermMacroClimate
npm run build
grep -rn "20-observation change" src/  # should match only HistoricalRegimeReplayPanel.tsx:79
```

**Acceptance:**

- [ ] `RegimeQuadrantChart.tsx` no longer imports from `recharts`; uses ECharts via wrapper.
- [ ] Axes consistent between `RegimeQuadrantChart` and `MacroRegimeQuadrant`: x = real-yield-bps, y = dollar-pct.
- [ ] `"20-observation change"` removed from `RegimeQuadrantChart.tsx`. `HistoricalRegimeReplayPanel.tsx:79` "20-observation changes" intact.
- [ ] Both charts read from `regime_dashboard.json`. The legacy `quadrant_trail` field is no longer consumed by chart code (still produced for back-compat but unused).
- [ ] `npm test` and `npm run build` pass.

### Wave 3 PR review checklist

- [ ] All three W3 agents' tasks checked off.
- [ ] Slot fills are surgical (no edits outside the slot markers).
- [ ] No file is owned by two W3 agents in the same wave (verified by reviewing diffs).
- [ ] Source-gating preserved: no MOVE/SKEW/put-call/VX-curve in any new chart.
- [ ] Tone preserved: no advice or buy/sell language in chart titles, tooltips, annotations.

---

## Chunk 4: Wave 4 — Per-route hero charts (9 single-domain content routes)

**Branch:** `feat/next-phase-w4-route-heroes`
**Worktree:** `.worktrees/next-phase-w4-route-heroes`
**Parallel agents:** `hero-credit-liquidity-dollar-commodities-agent` ‖ `hero-macro-domain-agent` ‖ `hero-sentiment-fragility-agent`

Each agent owns disjoint route files. No collision risk between agents this wave.

### File ownership map (Wave 4)

| File | Owner | Operation |
|---|---|---|
| `src/components/charts/CreditSpreadMatrixHero.tsx` | hero-credit-* | create |
| `src/components/charts/LiquidityDecompositionHero.tsx` | hero-credit-* | create |
| `src/components/charts/DollarPressureHero.tsx` | hero-credit-* | create |
| `src/components/charts/CommodityImpulseHero.tsx` | hero-credit-* | create |
| `src/components/charts/__tests__/credit-liquidity-dollar-commodities.test.tsx` | hero-credit-* | create |
| `src/routes/Credit.tsx` slot `credit_primary_chart` | hero-credit-* | replace slot comment |
| `src/routes/Liquidity.tsx` slot `liquidity_primary_chart` | hero-credit-* | replace slot comment |
| `src/routes/DollarGlobal.tsx` slot `dollar_global_primary_chart` | hero-credit-* | replace slot comment |
| `src/routes/Commodities.tsx` slot `commodities_primary_chart` | hero-credit-* | replace slot comment |
| `src/components/charts/InflationSpreadHero.tsx` | hero-macro-domain | create |
| `src/components/charts/GrowthLaborMatrixHero.tsx` | hero-macro-domain | create |
| `src/components/charts/HousingActivityHero.tsx` | hero-macro-domain | create |
| `src/components/charts/__tests__/macro-domain.test.tsx` | hero-macro-domain | create |
| `src/routes/Inflation.tsx` slot `inflation_primary_chart` | hero-macro-domain | replace |
| `src/routes/Growth.tsx` slot `growth_primary_chart` | hero-macro-domain | replace |
| `src/routes/Housing.tsx` slot `housing_primary_chart` | hero-macro-domain | replace |
| `src/components/charts/SentimentPositioningHero.tsx` | hero-sentiment-fragility | create |
| `src/components/VixVvixHiddenStressPanel.tsx` | hero-sentiment-fragility | create |
| `src/components/charts/__tests__/sentiment-fragility.test.tsx` | hero-sentiment-fragility | create |
| `src/routes/Sentiment.tsx` slot `sentiment_primary_chart` | hero-sentiment-fragility | replace |
| `src/routes/FragilityShockRisk.tsx` slot `fragility_pre_metrics_slot` | hero-sentiment-fragility | replace (slot only; do NOT touch fragility_primary_chart slot) |

### Agent W4A: `hero-credit-liquidity-dollar-commodities-agent`

**Briefing prompt:**

> You are `hero-credit-liquidity-dollar-commodities-agent` in Wave 4. Build hero charts for Credit, Liquidity, DollarGlobal, and Commodities routes. Other W4 agents own disjoint routes; you can run fully in parallel.
>
> Read first:
> - Spec Wave 4 → your agent section.
> - W1B's `InteractiveChartShell` for consistent chrome.
> - Existing data spines: `public/data/derived/hy_minus_ig_oas.json`, `net_liquidity.json`, `commodity_inflation_impulse.json`, `brent_wti_spread.json` (already in repo).
>
> **Out of scope:** Other W4 agents' routes/components, EChartPanel registrations, the slots W3 already filled.

**Task list:**

- [ ] **Task W4A-1: `CreditSpreadMatrixHero.tsx`.**
  - Multi-line ECharts: HY OAS, IG OAS, BBB OAS series + HY-IG stress `markLine` annotation.
  - Range controls.
  - Wrap with `<InteractiveChartShell>`.
  - Tests + slot fill in `Credit.tsx`.
  - Commit: `feat(charts): add CreditSpreadMatrixHero`.

- [ ] **Task W4A-2: `LiquidityDecompositionHero.tsx`.**
  - Stacked area: Fed assets − TGA − RRP = Net liquidity.
  - 1M / 3M change strip on top.
  - Tests + slot fill in `Liquidity.tsx`.
  - Commit: `feat(charts): add LiquidityDecompositionHero`.

- [ ] **Task W4A-3: `DollarPressureHero.tsx`.**
  - Broad-dollar level + percentile-normalized FX pressure (z-score) overlay.
  - Tests + slot fill in `DollarGlobal.tsx`.
  - Commit: `feat(charts): add DollarPressureHero`.

- [ ] **Task W4A-4: `CommodityImpulseHero.tsx`.**
  - Commodity inflation impulse line + Brent–WTI spread overlay (secondary axis).
  - Tests + slot fill in `Commodities.tsx`.
  - Commit: `feat(charts): add CommodityImpulseHero`.

**Verification:**

```bash
npm test -- src/components/charts src/routes/Credit src/routes/Liquidity src/routes/DollarGlobal src/routes/Commodities
npm run build
```

**Acceptance:**

- [ ] Four hero chart files with fixture-render tests.
- [ ] Each route's `<route>_primary_chart` slot is filled.
- [ ] No source-gated items appear.
- [ ] All charts use `InteractiveChartShell`.

### Agent W4B: `hero-macro-domain-agent`

**Briefing prompt:**

> You are `hero-macro-domain-agent` in Wave 4. Build hero charts for Inflation, Growth, Housing routes. You own disjoint route files; the parallel agents handle Credit/Liquidity/Dollar/Commodities and Sentiment/Fragility respectively.
>
> Read first: Spec Wave 4 → your agent section. Existing macro series under `public/data/series/` and `public/data/derived/`.

**Task list:**

- [ ] **Task W4B-1: `InflationSpreadHero.tsx`.**
  - Realized CPI/Core CPI vs breakeven/forward inflation, dual-line.
  - Tests + slot fill in `Inflation.tsx`.
  - Commit: `feat(charts): add InflationSpreadHero`.

- [ ] **Task W4B-2: `GrowthLaborMatrixHero.tsx`.**
  - Small-multiples heat strip across growth / labor / recession-risk metrics.
  - Tests + slot fill in `Growth.tsx`.
  - Commit: `feat(charts): add GrowthLaborMatrixHero`.

- [ ] **Task W4B-3: `HousingActivityHero.tsx`.**
  - Starts/permits vs mortgage-rate dual-axis line.
  - Tests + slot fill in `Housing.tsx`.
  - Commit: `feat(charts): add HousingActivityHero`.

**Verification:**

```bash
npm test -- src/components/charts src/routes/Inflation src/routes/Growth src/routes/Housing
npm run build
```

**Acceptance:**

- [ ] Three hero charts with fixture-render tests.
- [ ] Each route's `<route>_primary_chart` slot is filled.
- [ ] All charts use `InteractiveChartShell`.

### Agent W4C: `hero-sentiment-fragility-agent`

**Briefing prompt:**

> You are `hero-sentiment-fragility-agent` in Wave 4. Build the Sentiment hero chart, build the new `VixVvixHiddenStressPanel.tsx` (distinct from PR 6's `HiddenStressMismatchPanel.tsx`), and fill the Sentiment and Fragility-pre-metrics slots.
>
> Read first:
> - Spec Wave 4 → your agent section.
> - PR 6's `src/components/HiddenStressMismatchPanel.tsx` — your new component is DIFFERENT (different data, different name).
> - W1A's `volatility_dashboard.json[hidden_stress]` shape.
> - CFTC COT data files: `cftc_sp500_asset_mgr_net.json`, `cftc_sp500_lev_money_net.json` (already in `public/data/derived/`; if absent at render time, fall back gracefully).
>
> **Critical:** the `fragility_primary_chart` slot is already occupied by `ShockRiskContributionChart` from PR 6 — do NOT touch that slot. Only `fragility_pre_metrics_slot` is yours.

**Task list:**

- [ ] **Task W4C-1: `SentimentPositioningHero.tsx`.**
  - CFTC asset-manager vs leveraged-money positioning, percentile-normalized lines.
  - Graceful fallback when COT data is `null`: render a "data not yet active" placeholder; don't crash.
  - Tests: full data renders both series; missing-data fallback renders placeholder.
  - Slot fill in `Sentiment.tsx`.
  - Commit: `feat(charts): add SentimentPositioningHero with COT-percentile dual line`.

- [ ] **Task W4C-2: `VixVvixHiddenStressPanel.tsx`.**
  - New component (distinct from `HiddenStressMismatchPanel.tsx`).
  - Reads `volatility_dashboard.json[hidden_stress]` (W1A).
  - Visual: state badge + recent hidden-stress score with trend strip + tooltip explaining VIX-vs-VVIX percentile mismatch.
  - Tests: renders with fixture; renders fallback when data is null.
  - Slot fill: in `FragilityShockRisk.tsx`, replace `{/* SLOT:fragility_pre_metrics_slot */}` with `<VixVvixHiddenStressPanel />`. Do NOT touch the `fragility_primary_chart` slot.
  - Commit: `feat(components): add VixVvixHiddenStressPanel into fragility pre-metrics slot`.

**Verification:**

```bash
npm test -- src/components/charts src/components/VixVvixHiddenStressPanel src/routes/Sentiment src/routes/FragilityShockRisk
npm run build
grep -rn "HiddenStressMismatchPanel" src/   # confirm PR 6 component still imported in FragilityShockRisk body
```

**Acceptance:**

- [ ] Two new files (one chart, one panel) with passing tests.
- [ ] `VixVvixHiddenStressPanel` is distinct from `HiddenStressMismatchPanel` (different file, different export name, different data source).
- [ ] `fragility_primary_chart` slot still contains `ShockRiskContributionChart` from PR 6 (untouched).
- [ ] `fragility_pre_metrics_slot` filled with `VixVvixHiddenStressPanel`.
- [ ] Sentiment fallback works when COT data is null.

### Wave 4 PR review checklist

- [ ] All three W4 agents' tasks checked off.
- [ ] Each route hero chart answers the route's main question without scrolling past metric cards (manual visual check at 1280px width).
- [ ] No source-gated items in any hero.
- [ ] All hero charts use `InteractiveChartShell`.
- [ ] PR 6's `HiddenStressMismatchPanel` is not modified or removed.

---

## Chunk 5: Wave 5 — QA gate + cross-cutting verification

**Branch:** `feat/next-phase-w5-qa`
**Worktree:** `.worktrees/next-phase-w5-qa`
**Single agent:** `qa-agent`

### Agent W5: `qa-agent`

**Briefing prompt:**

> You are `qa-agent` in Wave 5. Run the full verification gate, perform cross-cutting consistency checks, and fix any small defects you find. If a defect is non-trivial (e.g., a chart crashes on missing data), open a follow-up task and document the gap; do NOT silently rebuild scope.
>
> Read first:
> - Spec Wave 5 + Cross-cutting decisions section.
> - The wave-by-wave PRs in `git log` (W1, W2, W3, W4) so you understand what landed.
>
> Output: a verification report saved to `docs/superpowers/plans/2026-05-10-market-weather-map-next-phase-verification.md`.

**Task list:**

- [ ] **Task W5-1: Run the full verification gate.**

```bash
npm test
npm run build
.venv/bin/python -m pytest tests/python -v
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
.venv/bin/python -m scripts.update_data    # smoke; only when network access is available
```

  All commands must pass. If any fails, fix or document.

- [ ] **Task W5-2: Static-site sanity grep.**

```bash
# No browser-side provider calls
grep -rn "fetch(['\"]http" src/                     # should be empty (only relative paths)
grep -rn "process.env\." src/                       # should be only build-time replacements
grep -rn "import.meta.env\." src/                   # should be only base path / mode

# No new env keys, no new secrets in committed files
grep -rn "API_KEY\|SECRET\|TOKEN" src/ scripts/ public/ docs/ | grep -v "test\|fixture\|methodology"

# Slot consistency
grep -rn "SLOT:" src/                               # all slots are filled (none should remain as raw comments)

# Regime label consistency
grep -rn "20-observation" src/                      # only HistoricalRegimeReplayPanel.tsx should match
grep -rn "20-observation change\b" src/             # NO matches expected (singular form removed)

# Tone — descriptive only
grep -rni "buy\|sell\|short\|target\|stop\|recommend" src/components/ src/routes/ \
  | grep -v "test\|short_term"                       # short_term as horizon name is allowed; flag others
```

  Document each grep result in the verification report. Flag any unexpected matches.

- [ ] **Task W5-3: Route render gracefully without optional JSON.**

  For each new derived JSON (`page_insights`, `volatility_dashboard`, `rates_dashboard`, `regime_dashboard`):

  - Temporarily rename the file to `<name>.json.bak`.
  - Run `npm test -- src/routes` and visually load each route in `npm run dev`.
  - Assert no route crashes; each component renders the documented fallback.
  - Restore the file.

  Add a Vitest suite `src/routes/__tests__/missing-derived-json.test.tsx` that mocks the loader to return `null` and asserts every single-domain route renders without throwing.

  Commit: `test(qa): assert routes degrade gracefully when next-phase derived JSON is absent`.

- [ ] **Task W5-4: Responsive layout verification.**

  Use Playwright (or manual browser at 320 / 768 / 1280 widths):

  - All single-domain routes resize without horizontal scroll on the main content column.
  - All charts inside `InteractiveChartShell` resize to container width.
  - `<RouteDataFooter>` stays at the bottom on every route.

  Document screenshots or a checklist in the verification report.

- [ ] **Task W5-5: ARIA + accessibility audit.**

  - Every chart panel has an `aria-label` (`InteractiveChartShell` enforces this; verify all callsites pass it).
  - `ChartRangeControls` has `role="radiogroup"`.
  - `PageInsightHero` heading levels are correct (h1 for route title is preserved on each route).

- [ ] **Task W5-6: Generate the verification report.**

  Write `docs/superpowers/plans/2026-05-10-market-weather-map-next-phase-verification.md` summarizing:

  - All commands run and their pass/fail status.
  - Grep results.
  - Missing-JSON fallback test results.
  - Responsive checks.
  - Accessibility audit.
  - Any follow-ups documented for future phases.

  Commit: `docs(qa): add next-phase verification report`.

**Acceptance:**

- [ ] All verification commands pass.
- [ ] Grep checks documented; no unexpected matches.
- [ ] Routes render gracefully when any of the 4 new JSONs is absent.
- [ ] Responsive layout confirmed at 320 / 768 / 1280.
- [ ] ARIA labels present on chart panels.
- [ ] Verification report committed.

### Wave 5 PR review checklist

- [ ] All W5 tasks checked off.
- [ ] Verification report committed and linked from the PR description.
- [ ] No regressions introduced in the QA fixes (each fix accompanied by a test).

---

## Final acceptance — phase complete

After W5 merges, the next phase is complete when ALL of the following hold:

- [ ] Every single-domain route shows `<PageInsightHero>` immediately after the heading.
- [ ] Every route ends with `<RouteDataFooter>` containing all data-transparency panels.
- [ ] The four derived JSONs are present, validate, refresh daily, and degrade gracefully when absent.
- [ ] Volatility, rates, and regime charts use the new ECharts components per the spec.
- [ ] Per-route hero charts are present on Credit, Liquidity, DollarGlobal, Commodities, Inflation, Growth, Housing, Sentiment.
- [ ] FragilityShockRisk has both the existing PR 6 `ShockRiskContributionChart` AND the new `VixVvixHiddenStressPanel` in the pre-metrics slot.
- [ ] The regime quadrant trail uses true 20/60/120 lookback deltas, not sequential daily deltas.
- [ ] The misleading "20-observation change" label is removed from `RegimeQuadrantChart.tsx`. `HistoricalRegimeReplayPanel.tsx:79` "20-observation changes" is intact.
- [ ] No source-gated items appear in active scoring, hero charts, or `page_insights` primary slots.
- [ ] CLAUDE.md verification gate passes end to end.
- [ ] Verification report committed.

## Open questions / future work (not in this phase)

- Cboe VIX6M / VIX1Y maturity expansion → its own source-review workstream + PR.
- Full Recharts retirement (`TimeSeriesChartInner`, `MultiSeriesChart`, `ChartResponsiveContainer`, `YieldDecompositionChart`) → its own phase.
- Tactical 6-tile section redesign (state badges + 1M direction + sparkline per tile) → competes with PR 4 work; do later.
- Universal hero adoption (consolidate `MarketBriefHeader` / `HorizonScoreHeader` / `PageInsightHero`) → optional polish phase.
- Wire `regime_dashboard.json` into `HistoricalRegimeReplay.tsx` → deferred follow-up.
- CFTC COT source review for full Sentiment hero promotion (currently treated as already-active per `cftc_sp500_*.json` files).

---

## Appendix: agent dispatch order summary

```
Pre-W1: USER AUTHORIZATION — sync local main with origin/main (rebase or merge).
W1:  be-data-agent  ‖  fe-platform-agent
       │
       ▼  (PR review + merge)
W2:  ia-shell-agent
       │
       ▼  (PR review + merge)
W3:  vol-charts-agent  ‖  rates-charts-agent  ‖  regime-charts-agent       (W3 and W4 may run in parallel)
W4:  hero-credit-liquidity-dollar-commodities-agent  ‖  hero-macro-domain-agent  ‖  hero-sentiment-fragility-agent
       │
       ▼  (W3 + W4 PRs both merged)
W5:  qa-agent
```

10 agent invocations across 5 waves, 5 PRs total.
