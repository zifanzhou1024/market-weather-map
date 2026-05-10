---
title: market-weather-map next phase — IA refactor, derived dashboards, chart redesigns
date: 2026-05-10
status: design
---

# market-weather-map next phase — design

## Background

The site has correct data and a working signal-priority ranking layer. PRs 1–6 of `.claude/skills/market-weather-map-next-phase/SKILL.md` are merged: signal-priority engine, ECharts foundation, Overview executive dashboard, Short-Term Market Reaction charts, SPX benchmark, Fragility upgrade. `public/data/derived/signal_priority.json` exists with the documented shape (`top_warnings`, `top_supports`, `missing_high_value_signals`, `overall_read{fragility, long_term, short_term, regime}`); `TopSignalList` is wired into `src/routes/Overview.tsx` and `src/routes/TacticalTradingWeather.tsx`. The "rank-before-visualize" constraint is therefore satisfied — new chart and dashboard work consumes the ranking layer rather than presupposing it.

The remaining product gap is information hierarchy in the single-domain routes (Rates, Volatility, RegimeMap, LongTermMacroClimate, Credit, Liquidity, DollarGlobal, Commodities, Inflation, Growth, Housing, Sentiment, FragilityShockRisk). These routes mix interpretation, data-status tables, candidate diagnostics, metric cards, and charts in the main flow — the user has to scroll past data-pipeline transparency before reaching analytical content. For example, `src/routes/Rates.tsx` puts `DataGapPanel` and `CandidateDiagnosticPanel` ahead of the metric cards and the yield-decomposition chart.

There is also a real bug in the regime-map quadrant: `scripts/transform/compute_regime_score.py:656–685` writes sequential daily deltas into `quadrant_trail`, but `src/components/RegimeQuadrantChart.tsx` labels the plot as "20-observation change". The displayed trail is therefore not a true 20-observation lookback delta.

## Goals

1. Make every single-domain route first-glance interpretive: `current read → primary chart → secondary charts → metric cards → data layer at bottom`.
2. Fix the regime-map math + axis + label bug.
3. Add four derived JSONs (`page_insights`, `volatility_dashboard`, `rates_dashboard`, `regime_dashboard`) that pre-compute the analytical content the new charts need.
4. Redesign volatility and rates charts to be diagnostic, not just time-series.
5. Add per-route hero charts to the 9 content routes that lack one.
6. Carve the work into independent agent-sized pieces so `/subagent-driven-development` can dispatch agents in parallel without route-file collisions.

## Non-goals (deferred to later phases)

- Cboe VIX6M / VIX1Y maturity expansion. Its own source-review workstream + ingest scripts. The `volatility_dashboard.json[latest_curve]` shape supports N tenors so adding maturities later is data-only.
- Full Recharts retirement. `TimeSeriesChartInner`, `MultiSeriesChart`, `ChartResponsiveContainer` stay on Recharts. `YieldDecompositionChart` stays on Recharts as tertiary history.
- Promotion of currently source-gated items: ICE MOVE, Cboe SKEW, Cboe put/call, Cboe/CFE VX futures curve, NY Fed ACM term premium. They remain readiness/diagnostic in the footer.
- New external data sources or upstream ingest scripts beyond what `scripts/ingest/` already produces. (Sentiment hero falls back gracefully if CFTC COT data is not yet active — see Wave 4.)
- Universal hero replacement on Overview, Tactical, LongTermMacroClimate. Their existing `MarketBriefHeader` / `HorizonScoreHeader` stay; only `RouteDataFooter` is added to wrap their existing data-transparency tail.

## Hard constraints (carry-over from `CLAUDE.md`)

- No backend; static JSON only under `public/data/`.
- No browser-side provider calls, API keys, or secrets.
- All ingest stays in `scripts/ingest/...` or GitHub Actions.
- Output is descriptive — no advice, forecasts, targets, or buy/sell/short language. Match `docs/LIMITATIONS.md`.
- New heavy charts use ECharts via the local `src/charts/EChartPanel.tsx` wrapper with `echarts/core` modular imports + `CanvasRenderer`. No Plotly, Highcharts, or `echarts-for-react`.
- Source-gated items must not enter active scores/labels/checklists/confidence/hero-charts/`page_insights`. Footer-only as readiness or diagnostic.
- Every new `public/data/...` file gets a schema check in `scripts/validate/validate_schema.py` and a freshness expectation in `scripts/validate/validate_freshness.py`.

## Phase prerequisites

- PR 7 (Long-Term macro visual system, #32) merged into `origin/main` on 2026-05-10 at commit `e8be748`. This design layers on top of PR 7. Before W1 dispatches, the working branch must be synced to a base that includes PR 7's commits (`25113e3`, `eb851a1`, `2fe4bdc`).
- PR 7 already provides: `MacroClimateHeatmap.tsx`, `MacroRegimeQuadrant.tsx`, `GrowthLaborInflationMatrix.tsx`, `StrategicSourceGapMatrix.tsx`, plus `ScatterChart` registration in `src/charts/EChartPanel.tsx`. As a consequence:
  - `regime-charts-agent` does NOT rebuild `MacroRegimeQuadrant.tsx`. It only repoints the existing component to `regime_dashboard.json` and verifies the axis convention is `(real-yield-x, dollar-y)` — already correct in PR 7's implementation.
  - `fe-platform-agent` does NOT register `ScatterChart` (already done in PR 7 commit `25113e3`).
  - W2 moves `StrategicSourceGapMatrix` (and any retained `StrategicSourceGapsPanel`) into `<RouteDataFooter>` on `LongTermMacroClimate.tsx`.
- Test mocks: PR 7 already updated `vi.mock("echarts/charts")` arrays to include `ScatterChart`. This phase does not register new chart types, so no further mock updates are needed unless a W3 chart introduces `CustomChart` (regime quadrant trail arrows can be implemented without it; if `CustomChart` becomes necessary, `regime-charts-agent` registers it locally and updates affected mocks per PR 7's precedent).

## Architecture: 5-wave plan

Five sequential waves; agents run in parallel within each wave. Each wave is one PR.

| Wave | Agents (‖ = parallel) | Owns |
|---|---|---|
| W1 | `be-data-agent` ‖ `fe-platform-agent` | Python + `src/lib/{types,data}.ts` ‖ `src/charts/`, primitive components |
| W2 | `ia-shell-agent` | `PageInsightHero`, `RouteDataFooter`, single-domain route refactors, slot insertion |
| W3 | `vol-charts-agent` ‖ `rates-charts-agent` ‖ `regime-charts-agent` | Volatility / Rates / Regime chart components + assigned route slots |
| W4 | `hero-credit-liquidity-dollar-commodities-agent` ‖ `hero-macro-domain-agent` ‖ `hero-sentiment-fragility-agent` | Per-route hero charts in disjoint route files |
| W5 | `qa-agent` | Verification gate |

Total: 10 agent invocations.

### Why this carves cleanly

The collision hotspot is `src/routes/*.tsx`. W2 takes single ownership of route refactors and inserts labeled JSX slot comments. W3/W4 agents then do exact-string replacements of those comments — they own *slots*, not files. `src/lib/types.ts` and `src/lib/data.ts` are owned outright by W1's `be-data-agent` (writes types + loaders alongside the JSONs). W1's `fe-platform-agent` does not touch `src/lib/`. Validators are owned by `be-data-agent` only.

Within W3, the three agents touch routes only at distinct slot IDs:
- `vol-charts-agent` → `volatility_primary_chart`, `volatility_secondary_charts` slots in `Volatility.tsx`; legacy chart swap in `TacticalTradingWeather.tsx` (via slot inserted by W2).
- `rates-charts-agent` → `rates_primary_chart`, `rates_secondary_charts` slots in `Rates.tsx`; `macro_yield_chart` slot in `LongTermMacroClimate.tsx`.
- `regime-charts-agent` → `regime_primary_chart` slot in `RegimeMap.tsx`; `macro_regime_chart` slot in `LongTermMacroClimate.tsx`. Also rebuilds the existing `RegimeQuadrantChart.tsx` component file in place.

`LongTermMacroClimate.tsx` is touched by both `rates-charts-agent` (yield slot) and `regime-charts-agent` (regime slot) — separate slots, no collision.

W4's three agents touch fully disjoint route files.

### Slot convention

In W2, `ia-shell-agent` inserts labeled JSX comment markers in single-domain routes:

```tsx
<h1>Rates</h1>
<PageInsightHero route="rates" />

{/* SLOT:rates_primary_chart */}
{/* SLOT:rates_secondary_charts */}

{/* metric cards JSX from the existing route */}
<RouteDataFooter route="rates" />
```

`MetricCardsBlock` is illustrative — each route has its own existing metric-card JSX (typically `<MetricCard ... />` repeated in a grid); W2 leaves that block unchanged in place between the slots and `<RouteDataFooter>`.

W3/W4 agents replace exactly the labeled comment with their JSX. No surrounding edits. The slot IDs are enumerated in the W2 slot map; W2 inserts them all up front so W3/W4 know which slot is theirs.

### Phase gating

W1 must merge before W2 dispatches (W2 needs derived JSON + types + platform components). W2 must merge before W3 or W4 dispatch (they need slots present in routes). W3 and W4 may dispatch in parallel since their route ownership is disjoint. W5 runs after both W3 and W4 merge.

## Wave 1 — data layer + frontend platform

### `be-data-agent`

**Owns:** `scripts/transform/`, `scripts/validate/`, `scripts/update_data.py`, `src/lib/types.ts`, `src/lib/data.ts`, output under `public/data/derived/`.

**Does not touch:** `src/routes/`, `src/components/`, `src/charts/`.

#### Four new derived JSONs

##### `public/data/derived/page_insights.json`

```ts
type PageInsightsFile = {
  generated_at_utc: string;        // ISO 8601
  date: string;                    // YYYY-MM-DD
  method_version: string;
  routes: Record<RouteKey, RouteInsight>;
};

type RouteKey =
  | "rates" | "volatility" | "regime_map"
  | "credit" | "liquidity" | "dollar_global" | "commodities"
  | "inflation" | "growth" | "housing"
  | "sentiment" | "fragility";

type RouteInsight = {
  title: string;
  state: "risk" | "support" | "mixed" | "calm" | "watch" | "unknown";
  primary_warning?: SignalRef;
  primary_support?: SignalRef;
  why_it_matters: string;
  confidence: number;              // 0..1
  freshness_notes: string[];
};

type SignalRef = {
  id: string;
  label: string;
  message: string;
  why_it_matters: string;
  severity: number;
  freshness_status: SignalFreshnessStatus;   // import from src/lib/types.ts; existing enum is "ok" | "stale" | "unavailable"
  confidence: number;
  source_status: "free_public" | "terms_review_needed" | "candidate";
};
```

Build process (`scripts/transform/build_page_insights.py`):
1. Load `signal_priority.json`.
2. Map each signal to a route via `category` (volatility → volatility/fragility, rates → rates, credit → credit, liquidity → liquidity, dollar → dollar_global, positioning → sentiment, macro → growth/inflation/housing, event → none, etc.).
3. For each `RouteKey`, pick the highest-`priority` signal with `direction == "risk"` as `primary_warning`, highest-`priority` with `direction == "support"` as `primary_support`.
4. Derive `state`: if both warning and support are present and weighted similarly → `mixed`; if only warning → `risk`; if only support → `support` or `calm` depending on severity; etc.
5. `why_it_matters` is the underlying signal's field, possibly compacted to one sentence.
6. `confidence` = average of available signal confidences for this route.
7. `freshness_notes` lists any sources marked `stale` or `unavailable` for this route's category.

Source-gated signals are excluded from `primary_warning` and `primary_support`. They may show up in `freshness_notes`.

##### `public/data/derived/volatility_dashboard.json`

```ts
type VolatilityDashboardFile = {
  generated_at_utc: string;
  date: string;
  method_version: string;
  latest_curve: Array<{
    tenor: "9D" | "30D" | "3M";    // 3 tenors only this phase
    value: number;
    percentile_5y: number;
  }>;
  ratio_history: Array<{
    date: string;
    vix9d_vix: number;
    vix_vix3m: number;
  }>;
  hidden_stress: Array<{
    date: string;
    vix_value: number;
    vvix_value: number;
    vix_percentile: number;
    vvix_percentile: number;
    hidden_stress_score: number;   // vvix_percentile - vix_percentile
    state: "calm" | "watch" | "elevated";
  }>;
  thresholds: {
    vix9d_vix_calm: number;
    vix9d_vix_stress: number;
    vix_vix3m_calm: number;
    vix_vix3m_stress: number;
    hidden_stress_watch: number;
    hidden_stress_elevated: number;
  };
};
```

Build process (`scripts/transform/build_volatility_dashboard.py`):
- `latest_curve` from latest VIX9D, VIX, VIX3M index closes plus 5-year rolling percentile.
- `ratio_history` from existing `vix9d_vix_ratio.json` and `vix_vix3m_ratio.json` (already present in `public/data/derived/`). At least 5 years of history.
- `hidden_stress` computed per-day: `vix_percentile`/`vvix_percentile` are 5-year rolling percentiles; `hidden_stress_score = vvix_percentile - vix_percentile`; `state` per thresholds.
- `thresholds` reuses the existing classifiers wherever the codebase already has them (e.g., the VIX9D/VIX and VIX/VIX3M bands).

##### `public/data/derived/rates_dashboard.json`

```ts
type RatesDashboardFile = {
  generated_at_utc: string;
  date: string;
  method_version: string;
  yield_change_windows: Record<"1M" | "3M" | "6M" | "1Y", {
    nominal_10y_bps: number;
    real_yield_10y_bps: number;
    breakeven_10y_bps: number;
    driver: "real_yield" | "breakeven" | "balanced";
  }>;
  current_decomposition: {
    nominal_10y_pct: number;
    real_yield_10y_pct: number;
    breakeven_10y_pct: number;
  };
  curve_snapshots: {
    current: Array<{ tenor: "2Y" | "10Y" | "20Y" | "30Y"; value: number }>;
    one_month_ago: Array<{ tenor: string; value: number }>;
    three_months_ago: Array<{ tenor: string; value: number }>;
    one_year_ago: Array<{ tenor: string; value: number }>;
  };
  decomposition_history: Array<{
    date: string;
    nominal_pct: number;
    real_pct: number;
    breakeven_pct: number;
  }>;
};
```

Build process (`scripts/transform/build_rates_dashboard.py`):
- `yield_change_windows` is computed in basis points as `(value_today - value_window_ago) * 100`.
- `driver` = `real_yield` if |real bps| > 1.5× |breakeven bps|, `breakeven` if reverse, `balanced` otherwise.
- `curve_snapshots` reads existing 2Y/10Y/20Y/30Y series at the specified historical dates.
- `decomposition_history` is daily nominal / real / breakeven series for the secondary chart.

If 20Y or 30Y data is missing for a snapshot, that tenor is omitted from that snapshot only (chart degrades gracefully).

##### `public/data/derived/regime_dashboard.json`

```ts
type RegimeDashboardFile = {
  generated_at_utc: string;
  date: string;
  method_version: string;
  windows: Record<"20D" | "60D" | "120D", Array<{
    date: string;
    real_yield_change_bps: number;       // value(date) - value(date - window)
    dollar_change_pct: number;            // (value(date) / value(date - window) - 1) * 100
    vix_percentile: number;               // 0..100
    credit_change_bps: number;
    fragility_score: number;              // 0..1 from shock_risk_snapshot
    regime: "risk_on_easing" | "global_tightening_risk_off" | "safe_haven_growth_scare" | "rotation_reflation";
  }>>;
  thresholds: {
    real_yield_neutral_bps: number;       // dead-zone half-width for x-axis
    dollar_neutral_pct: number;            // dead-zone half-width for y-axis
  };
};
```

Each window is a list of points spaced one observation apart. The point at date T uses `value(T) - value(T - window)`, NOT `value(T) - value(T - 1)`. This is the bug fix.

Quadrant assignment:
- `real_yield_change_bps < -neutral` and `dollar_change_pct < -neutral` → `risk_on_easing`
- `real_yield_change_bps > neutral` and `dollar_change_pct > neutral` → `global_tightening_risk_off`
- `real_yield_change_bps < -neutral` and `dollar_change_pct > neutral` → `safe_haven_growth_scare`
- `real_yield_change_bps > neutral` and `dollar_change_pct < -neutral` → `rotation_reflation`
- Otherwise → quadrant assignment uses the dominant axis sign with whichever zone is non-zero; ties default to `mixed` (added as a fifth label only if needed; otherwise omit).

#### Regime math fix

Edit `scripts/transform/compute_regime_score.py` lines 656–685. The existing `quadrant_trail` uses `value[date] - value[previous_date]`, slicing `[-20:]` to take the last 20 sequential daily deltas. This is wrong relative to the chart label "20-observation change".

Two-step fix:
1. Add `regime_dashboard.json` (above) as the new authoritative source for regime quadrant rendering.
2. In `quadrant_trail` (existing field), keep the field but document the deprecation and switch its computation to use a true 20-day lookback (`value[date] - value[date_minus_20]`). Add a note: `"deprecated: use regime_dashboard.json windows.20D instead"`.

This preserves any consumers that depend on `quadrant_trail` while exposing correct data immediately. `RegimeQuadrantChart` will be re-pointed at `regime_dashboard.json` in W3.

#### Schema + freshness validation

Add to `scripts/validate/validate_schema.py`:
- `page_insights.json` — keys, route subset, signal-ref shapes, no source-gated entries in primary slots.
- `volatility_dashboard.json` — tenor enum (3 values), threshold completeness, `state` enum.
- `rates_dashboard.json` — window keys, driver enum, snapshot tenor enum.
- `regime_dashboard.json` — window keys, regime enum, thresholds present, each window's points are spaced ≥ 1 observation apart.

Add to `scripts/validate/validate_freshness.py`:
- All four files: daily cadence (same as existing series), tolerance per the existing convention.

#### Types + loaders

`src/lib/types.ts` — add: `PageInsight`, `RouteInsight`, `SignalRef`, `VolatilityDashboard`, `RatesDashboard`, `RegimeDashboard` and their member types.

`src/lib/data.ts` — note: the existing `loadJson<T>(path)` helper throws `DataLoadError` on 404; it is unchanged. `be-data-agent` adds a permissive sibling `loadJsonOrNull<T>(path): Promise<T | null>` that returns `null` on 404 and still throws on schema mismatch when the file is present but malformed. Add new loaders that delegate to `loadJsonOrNull`: `loadPageInsights()`, `loadVolatilityDashboard()`, `loadRatesDashboard()`, `loadRegimeDashboard()`. Routes that consume these loaders render fallback UI when the loader returns `null` (a missing file lets routes degrade gracefully; a corrupt file is loud).

#### Pipeline integration

Wire the four new build scripts into `scripts/update_data.py` so they run after their upstream data is generated. The safe-update path must preserve prior good JSON if a build fails — record failures in `public/data/status/data_status.json`.

#### `be-data-agent` acceptance

- All four JSONs validate against schema and freshness.
- `python -m pytest tests/python -v` passes.
- `python -m scripts.update_data` produces all four files without errors when source data is fresh.
- `quadrant_trail` math is corrected (true lookback) and documented as deprecated.
- `src/lib/types.ts` exports the new types; `src/lib/data.ts` exports the new loaders.
- No edits to `src/routes/` or `src/components/`.

### `fe-platform-agent`

**Owns:** `src/charts/`, plus 5 specific new component files in `src/components/`.

**Does not touch:** `src/routes/`, existing `src/components/*` files, `src/lib/`, `src/charts/EChartPanel.tsx` (PR 7 already registered `ScatterChart`).

#### New chart helpers

`src/charts/buildTimeWindow.ts`
```ts
export type RangePreset = "1M" | "3M" | "6M" | "1Y" | "3Y" | "All";
export function buildTimeWindow<T extends { date: string }>(
  series: T[],
  preset: RangePreset
): T[];
```
Pure function. Rolls back from the latest date by the preset's day count; "All" returns the full series.

`src/charts/buildMarkBands.ts`
```ts
export type ThresholdBand = {
  label: string;
  min?: number;
  max?: number;
  color: string;
};
export function buildMarkBands(bands: ThresholdBand[]): EChartsOption["series"][number]["markArea"];
```
Returns ECharts `markArea` config.

#### New components

`src/components/ChartRangeControls.tsx`
```ts
type Props = {
  value: RangePreset;
  onChange: (next: RangePreset) => void;
  available?: RangePreset[];        // default: all
  disabledReason?: string;
};
```
Segmented control. Keyboard-accessible. ARIA `role="radiogroup"`.

`src/components/InteractiveChartShell.tsx`
```ts
type Props = {
  title: string;
  range?: RangePreset;
  onRangeChange?: (next: RangePreset) => void;
  state?: "risk" | "support" | "mixed" | "calm" | "watch" | "stale-data";
  insight?: ReactNode;              // rendered above the chart
  ariaLabel: string;
  children: ReactNode;              // typically <EChartPanel ... />
};
```
Wraps chart in a card with: title bar, optional `<ChartRangeControls>`, optional `<ChartStateBadge>`, optional `<InsightCallout>`, then the chart body. Handles the empty/loading/error fallback skeletons that `EChartPanel` already provides at the chart level — `InteractiveChartShell` adds the surrounding chrome.

`src/components/InsightCallout.tsx`
```ts
type Props = {
  state?: ChartState;
  message: string;
  caveat?: string;                  // freshness or confidence
};
```
Compact text block styled for "current read."

`src/components/DriverBarList.tsx`
```ts
type Driver = {
  id: string;
  label: string;
  priority: number;
  direction: "risk" | "support" | "neutral";
  why_it_matters: string;
  freshness_status: SignalFreshnessStatus;   // import from src/lib/types.ts; existing enum is "ok" | "stale" | "unavailable"
  confidence: number;
};
type Props = { items: Driver[]; max?: number };
```
Horizontal bars, length scales by priority, color by direction. Tooltip shows `why_it_matters`, `freshness_status`, `confidence`. Used by W4 hero charts and available for future Overview adoption.

`src/components/ChartStateBadge.tsx`
```ts
type Props = {
  state: "risk" | "support" | "mixed" | "calm" | "watch" | "stale-data";
};
```
Small pill. Distinct visual treatment for `stale-data`.

#### `fe-platform-agent` acceptance

- `npm run build` passes; bundle size does not regress materially.
- Vitest tests for: `buildTimeWindow` filtering edge cases, `ChartRangeControls` preset switching, `InteractiveChartShell` rendering with present/absent insight + state.
- No edits to `EChartPanel.tsx` (PR 7's `ScatterChart` registration is already in place).
- No edits to routes or other existing components.

## Wave 2 — IA shell + route refactor

### `ia-shell-agent`

**Owns:** `src/components/PageInsightHero.tsx`, `src/components/RouteDataFooter.tsx`, all single-domain route refactors, slot insertion across all routes.

#### `src/components/PageInsightHero.tsx`

```ts
type Props = { route: RouteKey };
```

Reads `loadPageInsights()` once at the top of the route's component tree (or via React Query cache if present). Renders:
- Title (`route_insight.title`).
- `<ChartStateBadge state={route_insight.state} />`.
- Primary warning + primary support side-by-side (use `<DriverBarList>` with two items, or a custom split layout).
- "Why it matters" text.
- Freshness/confidence caveat: small grey text below.
- Generated-at timestamp.

Fallback: if `route_insight` is missing, render a minimal heading-only stub with "Current read unavailable — see data status below."

#### `src/components/RouteDataFooter.tsx`

```ts
type Props = {
  route?: RouteKey;
  children?: ReactNode;             // optional source-gated panels passed in
};
```

Renders a heading "Data and sources" then:
- `<DataGapPanel route={route} />` if applicable.
- `<DataStatusTable route={route} />`.
- Children (where routes need to keep route-specific source-gap or readiness panels).

A subtle visual separator before the footer to signal "below the analytical content."

#### Route refactor map

For each of the 12 single-domain routes:
1. Add `<PageInsightHero route="..." />` after the route heading.
2. Insert slot comments per the slot map.
3. Move `DataGapPanel`, `DataStatusTable`, `CandidateDiagnosticPanel`, readiness panels, source-gap panels, static-feed-freshness panels into `<RouteDataFooter>` at the bottom.

For `Overview.tsx`, `TacticalTradingWeather.tsx`, `Calendar.tsx`, `Methodology.tsx`, `HistoricalRegimeReplay.tsx`: only wrap existing data-transparency tail in `<RouteDataFooter>`. Do not add `<PageInsightHero>`. Do not change existing `MarketBriefHeader`, `HorizonScoreHeader`, or content order above the tail.

For `LongTermMacroClimate.tsx`: keep `HorizonScoreHeader`. Move `CandidateDiagnosticPanel` and `StrategicSourceGapMatrix` (PR 7) into `<RouteDataFooter>`. Insert `macro_regime_chart` and `macro_yield_chart` slots in appropriate positions (above the macro group loop).

For `FragilityShockRisk.tsx` (per the PR 6 pattern committed at `69ddc9d`): body order is preserved as `read header` → `ShockRiskContributionChart` (in `fragility_primary_chart` slot) → `HiddenStressMismatchPanel` (cross-asset mismatches, stays in body) → `BondVolatilityProxyChart` (NOT-MOVE caveat preserved verbatim, stays in body) → `TailRiskReadinessMatrix` (gated readiness display, stays in body) → `fragility_pre_metrics_slot` (W4 fills with the new `VixVvixHiddenStressPanel`) → metric cards. Footer-only relocations: `DataGapPanel`, `DataStatusTable`, `CandidateDiagnosticPanel`, plus any source-gap or static-feed-freshness panels. The "not MOVE" caveat on `BondVolatilityProxyChart` is load-bearing and must be preserved verbatim.

#### Slot map

| Route | Slots inserted |
|---|---|
| `Rates.tsx` | `rates_primary_chart`, `rates_secondary_charts` |
| `Volatility.tsx` | `volatility_primary_chart`, `volatility_secondary_charts` |
| `RegimeMap.tsx` | `regime_primary_chart` |
| `LongTermMacroClimate.tsx` | `macro_regime_chart`, `macro_yield_chart` |
| `Credit.tsx` | `credit_primary_chart` |
| `Liquidity.tsx` | `liquidity_primary_chart` |
| `DollarGlobal.tsx` | `dollar_global_primary_chart` |
| `Commodities.tsx` | `commodities_primary_chart` |
| `Inflation.tsx` | `inflation_primary_chart` |
| `Growth.tsx` | `growth_primary_chart` |
| `Housing.tsx` | `housing_primary_chart` |
| `Sentiment.tsx` | `sentiment_primary_chart` |
| `FragilityShockRisk.tsx` | `fragility_primary_chart`, `fragility_pre_metrics_slot` |
| `TacticalTradingWeather.tsx` | `tactical_vol_curve_slot`, `tactical_vol_complex_slot` (for vol-charts-agent to swap in) |

The `TacticalTradingWeather.tsx` slots replace specific existing chart usages; `ia-shell-agent` inserts the slot comments wrapping the existing JSX so vol-charts-agent in W3 can do the swap surgically.

#### `ia-shell-agent` acceptance

- Every single-domain route's first scroll position shows `<PageInsightHero />` + `{/* SLOT:..._primary_chart */}` before the metric cards (verified by reading the JSX top-down).
- Every route ends with `<RouteDataFooter>`. No `DataGapPanel`, `DataStatusTable`, `CandidateDiagnosticPanel`, readiness panel, source-gap panel, or static-feed-freshness panel exists outside `<RouteDataFooter>`.
- Slot comments are present and exactly match the slot map IDs.
- `npm run build` and `npm test` pass.
- Vitest tests for `PageInsightHero` (with present + missing data), `RouteDataFooter` (renders children + default panels in correct order).
- `Overview.tsx`, `TacticalTradingWeather.tsx`, `Calendar.tsx`, `Methodology.tsx`, `HistoricalRegimeReplay.tsx` content order above their tails is unchanged.

## Wave 3 — chart redesigns

### `vol-charts-agent`

**Owns:** `src/components/charts/VixCurveTermStructureChart.tsx`, `src/components/charts/VixRatioHistoryChart.tsx`, `src/components/charts/VolatilityHiddenStressChart.tsx`. Edits the volatility-related slots in `Volatility.tsx` and `TacticalTradingWeather.tsx`.

**Does not touch:** other agents' chart components, `src/lib/`, `src/charts/EChartPanel.tsx`, anything outside slot replacements in routes.

#### `VixCurveTermStructureChart.tsx`

ECharts categorical x-axis (`9D`, `30D`, `3M`), y = VIX level. Latest snapshot only (line + symbols). Below the line: optional `markArea` regime band background using the project's existing volatility classifiers. Tooltip shows tenor, value, 5-year percentile.

Wraps with `<InteractiveChartShell title="Volatility curve (proxy)" state={state} insight={...} />`. Title intentionally says "proxy" to signal these are index points, not VX futures.

Props: `{ compact?: boolean }`. When `compact` is true: no surrounding `InteractiveChartShell` chrome (used inside Tactical's existing 6-tile grid which has its own framing); height ~200px instead of ~400px; tooltip simplified to tenor + value only.

#### `VixRatioHistoryChart.tsx`

ECharts line chart, two series: `vix9d_vix` and `vix_vix3m`. `markArea` bands for `calm` / `flat` / `stress` zones using thresholds from `volatility_dashboard.json`. `dataZoom` slider + inside enabled. `<ChartRangeControls>` with `1M | 3M | 6M | 1Y | 3Y | All` (default `1Y`).

#### `VolatilityHiddenStressChart.tsx`

Two-panel layout via ECharts `grid` array sharing x-axis:
- Top: scatter (x = VIX percentile, y = VVIX percentile). Points colored by recency via `visualMap`. Quadrant labels — upper-left = "hidden options stress."
- Bottom: line strip showing `hidden_stress_score` over time, `markLine` at watch and elevated thresholds.

`<ChartRangeControls>` controls both panels.

Props: `{ compact?: boolean }`. When `compact` is true: scatter panel only (no time-series strip), no `ChartRangeControls`, no `InteractiveChartShell` chrome, height ~200px. Used in Tactical's 6-tile section to replace the existing `VolatilityComplexChart`.

#### Slot fills

- `volatility_primary_chart` ← `<VixCurveTermStructureChart />`
- `volatility_secondary_charts` ← `<VixRatioHistoryChart />` then `<VolatilityHiddenStressChart />`
- `tactical_vol_curve_slot` ← `<VixCurveTermStructureChart compact />` (replaces existing `<VixCurveProxyChart />` usage in Tactical's 6-tile section).
- `tactical_vol_complex_slot` ← `<VolatilityHiddenStressChart compact />` (replaces `<VolatilityComplexChart />` usage).

Existing `src/components/VixCurveProxyChart.tsx` and `src/components/VolatilityComplexChart.tsx` files remain in place — only their importers in `Volatility.tsx` and `TacticalTradingWeather.tsx` change. Removal deferred to a future cleanup phase.

#### `vol-charts-agent` acceptance

- Three new chart files exist with fixture-render Vitest tests.
- `Volatility.tsx` and `TacticalTradingWeather.tsx` slots are filled exactly; no other JSX changes in those files.
- `npm run build` passes; chart bundle size delta is reasonable.
- All charts use `<InteractiveChartShell>` and pass through the ARIA label + state badge.
- "Proxy" terminology preserved.

### `rates-charts-agent`

**Owns:** `src/components/charts/YieldChangeWaterfallChart.tsx`, `src/components/charts/YieldCurveComparisonChart.tsx`, `src/components/charts/YieldDecompositionStackChart.tsx`. Edits rates-related slots in `Rates.tsx` and `LongTermMacroClimate.tsx`.

#### `YieldChangeWaterfallChart.tsx`

ECharts bar with stacked positive/negative segments per window (`1M`, `3M`, `6M`, `1Y`):
- `real_yield_10y_bps` segment (one color)
- `breakeven_10y_bps` segment (another color)
- Total `nominal_10y_bps` annotated as text label above the stack.
- The `driver` field highlights the dominant bar via fill weight.

x-axis = window labels, y-axis = bps.

#### `YieldCurveComparisonChart.tsx`

ECharts line chart, x = tenor categorical (`2Y`, `10Y`, `20Y`, `30Y`), four series: `current`, `1M ago`, `3M ago`, `1Y ago`. Color gradient old→new. Drop tenors that are missing for any snapshot from that snapshot only.

#### `YieldDecompositionStackChart.tsx`

ECharts horizontal stacked bar showing one row: `current_decomposition.real_yield_10y_pct` + `current_decomposition.breakeven_10y_pct` = `current_decomposition.nominal_10y_pct`. Annotated with values.

#### Slot fills

- `rates_primary_chart` ← `<YieldChangeWaterfallChart />`
- `rates_secondary_charts` ← `<YieldCurveComparisonChart />` then `<YieldDecompositionStackChart />`
- `macro_yield_chart` ← `<YieldDecompositionStackChart />`

Existing `src/components/YieldDecompositionChart.tsx` (Recharts) is kept in `Rates.tsx` and `LongTermMacroClimate.tsx` as a tertiary "history" chart, rendered below the new charts but above metric cards. Not migrated to ECharts in this phase.

#### `rates-charts-agent` acceptance

- Three new chart files exist with fixture-render tests.
- `Rates.tsx` and `LongTermMacroClimate.tsx` slot edits are surgical (no other changes).
- bps used for changes; pct used for levels.
- `npm run build` passes.

### `regime-charts-agent`

**Owns:** `src/components/RegimeQuadrantChart.tsx` (rebuild in place), `src/components/MacroRegimeQuadrant.tsx` (new). Edits regime slots in `RegimeMap.tsx` and `LongTermMacroClimate.tsx`.

#### `RegimeQuadrantChart.tsx` — rebuilt in ECharts

Replace Recharts implementation with ECharts. Same component name, same import path, same default export — importers don't change.

- Reads `regime_dashboard.json[windows][selected_window]`.
- Standardized axes: x = `real_yield_change_bps`, y = `dollar_change_pct`.
- `visualMap` color = `vix_percentile`.
- `visualMap` size = `credit_change_bps` magnitude.
- Range controls (`<ChartRangeControls available={["20D", "60D", "120D"]} />`).
- Trail rendered as connected scatter+line (custom series). Opacity gradient old→new.
- Latest-point label.
- Quadrant label annotations using ECharts `markArea` text labels:
  - x<0, y<0 → "risk-on easing"
  - x>0, y>0 → "global tightening / risk-off"
  - x<0, y>0 → "safe-haven / growth scare"
  - x>0, y<0 → "rotation / reflation / mixed"
- Quadrant-meaning legend rendered below the chart (text block).
- Misleading "20-observation change" label removed from `RegimeQuadrantChart.tsx` only; replaced by dynamic label `"{window} change"` based on selected window. The literal string `"20-observation changes"` in `src/components/HistoricalRegimeReplayPanel.tsx:79` is correct per `docs/METHODOLOGY.md` (HistoricalRegimeReplay legitimately compares 20-observation windows) and must NOT be touched.

#### `MacroRegimeQuadrant.tsx` — new

Same data, same axis convention as the rebuilt `RegimeQuadrantChart`, but defaulted to `60D` window and presented at higher visual prominence (larger panel, optional explainer). Used in `LongTermMacroClimate.tsx` for the `macro_regime_chart` slot. Differs only in defaults and surrounding chrome.

#### Slot fills

- `regime_primary_chart` ← `<RegimeQuadrantChart />`
- `macro_regime_chart` ← `<MacroRegimeQuadrant />`

`RegimeMap.tsx` previously imported `RegimeQuadrantChart` directly; now it goes through the slot, but the import is the same component. Slot is just a placement marker.

#### `regime-charts-agent` acceptance

- `RegimeQuadrantChart.tsx` no longer imports from `recharts`; uses `EChartPanel`.
- Axes consistent with `MacroRegimeQuadrant.tsx`.
- "20-observation change" string removed from `RegimeQuadrantChart.tsx` only; `HistoricalRegimeReplayPanel.tsx:79` is intentionally unchanged.
- `regime_dashboard.json` is the data source; `quadrant_trail` is no longer read by the chart.
- `npm run build` and `npm test` pass.
- Vitest test asserts the rebuilt chart renders with fixture data and shows the latest point label.

## Wave 4 — per-route hero charts

Each W4 agent owns disjoint routes; one hero chart per route in the `<route>_primary_chart` slot. All charts use `<InteractiveChartShell>` for consistency.

### `hero-credit-liquidity-dollar-commodities-agent`

Owns: `Credit.tsx`, `Liquidity.tsx`, `DollarGlobal.tsx`, `Commodities.tsx` slots + new chart components for each.

| Route | Hero chart | Data spine |
|---|---|---|
| Credit | HY/IG/BBB OAS lines + HY-IG stress `markLine`. Range controls. | `public/data/derived/hy_minus_ig_oas.json` + existing IG/BBB series |
| Liquidity | Net-liquidity area (Fed assets − TGA − RRP) with 1M/3M change strip on top. | `public/data/derived/net_liquidity.json` |
| DollarGlobal | Broad-dollar level + percentile-normalized FX pressure (z-score). | Existing dollar series |
| Commodities | Commodity inflation impulse + Brent–WTI overlay. | `public/data/derived/commodity_inflation_impulse.json`, `public/data/derived/brent_wti_spread.json` |

### `hero-macro-domain-agent`

Owns: `Inflation.tsx`, `Growth.tsx`, `Housing.tsx`.

| Route | Hero chart | Data spine |
|---|---|---|
| Inflation | Realized CPI/Core CPI vs breakeven/forward inflation, dual-line. | Existing inflation series |
| Growth | Growth/labor/recession-risk small-multiples heat strip. | Existing growth series |
| Housing | Starts/permits vs mortgage rate, dual-axis line. | Existing housing series |

### `hero-sentiment-fragility-agent`

Owns: `Sentiment.tsx`, `FragilityShockRisk.tsx`.

| Route | Hero chart | Data spine |
|---|---|---|
| Sentiment | CFTC asset manager vs leveraged-money positioning, percentile-normalized lines. CFTC COT data is already active in `public/data/derived/` (`cftc_sp500_asset_mgr_net.json` and `cftc_sp500_lev_money_net.json`); chart consumes those directly. Defensive fallback: if either file is missing at render time the loader returns `null` and a "data not yet active" state surfaces a source gap in `<RouteDataFooter>`. | `cftc_sp500_asset_mgr_net.json`, `cftc_sp500_lev_money_net.json` |
| FragilityShockRisk | `ShockRiskContributionChart` (from PR 6) already occupies the `fragility_primary_chart` slot — agent confirms placement, no rebuild. Builds a NEW component `src/components/VixVvixHiddenStressPanel.tsx` (distinct from PR 6's `HiddenStressMismatchPanel.tsx`, which covers cross-asset mismatches) and renders it into the `fragility_pre_metrics_slot` using `volatility_dashboard.json[hidden_stress]`. | Existing `shock_risk_snapshot.json` (already wired) + new `volatility_dashboard.json[hidden_stress]` |

#### W4 acceptance (all three agents)

- Each owned route has exactly one hero chart in its `<route>_primary_chart` slot.
- Hero charts use `<InteractiveChartShell>`.
- Hero charts answer the route's main question without scrolling past metric cards.
- Source-gated items do not appear in any hero chart; if data is unavailable, the chart surfaces a graceful "data not yet active" state rather than rendering empty.
- `npm run build` passes for each.
- Vitest fixture-render tests for each new chart.

## Wave 5 — QA gate

### `qa-agent`

**Owns:** verification commands. Does not edit code unless fixing a failed acceptance check.

```bash
npm test
npm run build
python -m pytest tests/python -v
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
python -m scripts.update_data    # smoke; only when network access is available
```

Verifies:
- GitHub Pages base path resolves (`vite.config.ts` `base` is correct; built `dist/` paths are sound).
- No browser-side provider calls — grep `src/` for `fetch(` to non-relative URLs and for any new `process.env` / `import.meta.env` references that look like API keys.
- No new env keys, no new secrets in committed files.
- Each route renders without crashing when one of the new derived JSONs is absent (loaders return `null`, components fall back).
- Charts resize correctly at 320 / 768 / 1280 px widths (manual or Playwright check).
- All new charts have ARIA labels and fallback text.
- `<RouteDataFooter>` is the LAST element on every route (not just present, but at the bottom).
- No data-transparency panels were deleted — only relocated into `<RouteDataFooter>`.
- Source-gated items appear only in footer, never in `page_insights.json` primary slots, never in hero charts.
- Consistency grep: `grep -rn "dollar_change\|real_yield_change\|20-observation" src/ scripts/` — verify the regime axis-rename and field-rename are coherent (no leftover `quadrant_trail` references in chart code; "20-observation" string survives only in `HistoricalRegimeReplayPanel.tsx`).
- This phase does not modify `src/routes/HistoricalRegimeReplay.tsx` or `regime_replay.json`. Wiring `regime_dashboard.json` into HistoricalRegimeReplay is a deferred follow-up.

#### `qa-agent` acceptance

- All commands above pass.
- All bullet checks above are confirmed.
- A short verification report is committed to `docs/superpowers/plans/2026-05-10-market-weather-map-next-phase-verification.md`.

## Cross-cutting decisions

### VIX maturity expansion (deferred)

`volatility_dashboard.json[latest_curve]` is structured to accept N tenors, so VIX6M / VIX1Y / VIX1D can be added later by a separate ingest script + source review without changing the chart. This phase ships with VIX9D / VIX / VIX3M only.

### Recharts retirement (partial)

In this phase:
- `RegimeQuadrantChart.tsx` migrates to ECharts (W3).
- `YieldDecompositionChart.tsx` stays Recharts (used as tertiary history).
- `TimeSeriesChartInner.tsx`, `MultiSeriesChart.tsx`, `ChartResponsiveContainer.tsx` untouched.

Full Recharts retirement is its own phase.

### Source gating

ICE MOVE, Cboe SKEW, Cboe put/call, Cboe/CFE VX futures curve, NY Fed ACM term premium remain footer-only. They never enter active scoring, hero charts, or `page_insights`. They may show up in `<RouteDataFooter>` as readiness or diagnostic.

### Freshness UX

`PageInsightHero` shows freshness via state badge if `freshness_status !== "ok"`. Charts that consume potentially stale data show `<ChartStateBadge state="stale-data" />` overlay rendered by `<InteractiveChartShell>`.

### Tone

All hero copy and chart annotations stay descriptive — no advice, no targets, no buy/sell/short language. Each route's `why_it_matters` field is sourced from the underlying signal's `why_it_matters` text already curated to match `docs/LIMITATIONS.md`.

### Testing strategy

- Vitest: `PageInsightHero` (present/missing data), `RouteDataFooter` (slot ordering), `ChartRangeControls` (preset switching), `buildTimeWindow` (edge cases), each new chart component (basic fixture render).
- Pytest: `regime_dashboard` math (asserts each window's points are spaced ≥ window-size observations apart and use true lookback computation), `page_insights` builder (no source-gated items in primary slots).

## Open questions and future work

- **Sentiment data spine.** If CFTC COT positioning data is not yet active in `public/data/`, the Sentiment hero chart falls back to existing positioning data and surfaces a source gap. A follow-up phase can promote CFTC COT once a source review is committed.
- **Tactical 6-tile section.** This phase swaps individual chart components in Tactical's tile area; redesigning the tile section itself (state + 1M direction + risk/support flag + sparkline per tile) is a larger refactor deferred to a follow-up phase, since it would compete with the just-merged PR 4 work.
- **Universal hero adoption.** A future phase could consolidate `MarketBriefHeader` / `HorizonScoreHeader` / `PageInsightHero` into one hero component family. For now they coexist.

## Acceptance summary

| Wave | Primary deliverable | Verification |
|---|---|---|
| W1 | 4 derived JSONs + regime math fix + types/loaders + chart platform + 5 primitives | schema/freshness pass; types compile; vitest passes; Python pytest passes |
| W2 | `PageInsightHero`, `RouteDataFooter`, slot insertion across all routes, single-domain refactor | every route ends with footer; slot comments present and correct; tests pass |
| W3 | Volatility / Rates / Regime chart redesigns | slot fills correct; bps for changes; `RegimeQuadrantChart` no longer Recharts; misleading label removed |
| W4 | 9 per-route hero charts | one hero per route; uses `InteractiveChartShell`; no source-gated items |
| W5 | Verification gate | all commands green; checklist confirmed; report committed |

## Appendix: agent dispatch ordering

```
W1: be-data-agent ‖ fe-platform-agent
        |
        v
W2: ia-shell-agent
        |
        v
W3: vol-charts-agent ‖ rates-charts-agent ‖ regime-charts-agent
W4: hero-credit-liquidity-dollar-commodities-agent ‖ hero-macro-domain-agent ‖ hero-sentiment-fragility-agent
        |
        v
W5: qa-agent
```

W3 and W4 may also run as a single combined wave if scheduling allows, since their route ownership is fully disjoint.
