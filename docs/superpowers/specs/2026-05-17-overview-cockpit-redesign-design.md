---
title: Overview cockpit redesign — fixed slot grid with rotating contents
date: 2026-05-17
status: design
---

# Overview cockpit redesign — design

## Background

The site has the data and the ranking — `signal_priority.json` is wired into `TopSignalList` on Overview and TacticalTradingWeather. The remaining gap is **information hierarchy on the Overview itself**.

A live audit of the rendered Overview (1440×900 desktop and 390×844 mobile) surfaced these defects:

1. **Same content shown 3–5 times per page.** "Real yields elevated" appears across `MarketBriefHeader`, `TopSignalList`, `ScoreContributionHeatmap`, `DriverAttributionPanel`, `InterpretationPanel`, `SignalList`, `ScoreCard`. ~19 panels stack on the Overview, 6–8 of equal visual weight competing for first-glance attention.
2. **Scores have no anchor.** Headline values render as bare numbers (4.3, +12.0, 28.8, 0.12, –100.0) with no percentile, no historical band, no scale legend. Newcomers cannot tell if any number is alarming.
3. **Confidence reads ~99% everywhere.** The aggregate `coverage × freshness × model × source` compresses into a meaningless 0.97–1.00 band on every score, adding noise.
4. **Dynamic headline composition disorients.** `TopSignalList` reshuffles based on `signal_priority.json` daily — a senior who learned yesterday's Overview opens today's and re-reads it. The page acts like a newspaper, not a dashboard.
5. **18-pill nav in 3 sections eats the top of every page.** At desktop, nav sits beside (not above) the masthead with the H1 visually subordinate. At mobile, nav consumes ~480 px before any market data appears.
6. **The 10 "Data Library" detail routes** (Volatility / Rates / Liquidity / Credit / Dollar / Commodities / Growth / Housing / Inflation / Positioning) each duplicate the same `DataQuality + PageInsightHero + FocusBlock + chart + DataStatusTable` template; they are one tabbed view masquerading as ten routes.
7. **Best chart on the site (Fragility shock-risk waterfall) is buried**; the densest grid (`HorizonImpactMatrix`, 7×5 micro-cells) is treated as Overview-prominent content despite being un-skimmable.

Industry reference points (researched during brainstorming): 42 Macro / Hedgeye / MacroStaq / Fidenza all use a **regime-first cockpit** as the home view, with a fixed instrument-panel layout where the cells (gauges) stay in place day to day and only their values rotate. QuantCube anchors a composite Risk-On/Risk-Off score at the top of every view as the orienting glance. This pattern is what professional macro shops actually publish.

## Goals

1. Make the Overview a **fixed-slot cockpit**: 3 always-on composite-score cells in a top row, then a 9-cell 3×3 vital-signs grid below. The slot count and shape never change; the slot **contents** rotate daily by today's priority ranking.
2. Anchor every cockpit number with **5y percentile + Δ7d (+ Δ1m where meaningful) + 90D sparkline + freshness pill** so newcomers can interpret it without domain knowledge and pros get the deltas they expect.
3. Add a **persistent regime header** on every route so the current regime (Reallocation / Reflation / Stagflation / etc.) is ambient, not buried in a separate route.
4. Add a **Brief / Detail mode toggle** with viewport auto-default (Brief on <900px, Detail otherwise), persisting via URL `?mode=` and `localStorage.mwm.mode`. Brief hides the Context block and drops per-cell deltas / secondary lines.
5. **Demote duplicated panels off the Overview.** Remove `OverviewDecisionCard ×4`, `ScoreCard ×3`, `InterpretationPanel`, `SignalList ×2`, `ConfidenceBreakdown`, `MarketBriefHeader` (replaced by the new `CompositeScoresRow` inside the cockpit), `HowToReadPanel`. Collapse `HorizonImpactMatrix`, `ScoreContributionHeatmap`, `DriverAttributionPanel`, `MissingSignalPanel` into a `<details>` Context block.
6. **Consolidate the 10 detail routes into a single `/channels` tabbed route.** Old URLs redirect via `<Navigate>`. Top-level nav shrinks 18 → 7 pills + "More ▾".
7. **Merge `/regime-map` + `/replay` into `/history`** with tabs. Redirects preserve bookmarks.
8. Generate one new derived JSON, `public/data/derived/cockpit.json`, in the existing GitHub Actions workflow. Frontend stays "render static JSON"; no client-side ranking, no series arithmetic in React.

## Non-goals (deferred to later initiatives)

- No new data sources promoted out of `terms_review_needed`. The source-gating contract (`AccessStatus` enum, 7-value, `validate_candidate_isolation`) is preserved unchanged.
- No FocusBlock placements on Channels tabs (deferred to a follow-up audit).
- No print stylesheet, no `/diff` route, no keyboard shortcuts (`g o`, `g r`, …).
- No confidence-decomposition recalibration; the always-99% number is hidden from Brief mode but the underlying `data_quality` JSON is unchanged.
- No Recharts retirement. New cockpit primitives (sparkline, percentile band) use inline SVG, not ECharts — instant render, no animation overhead.
- No backend, no browser-side provider calls, no API keys (CLAUDE.md hard constraint).

## Hard constraints (carry-over from CLAUDE.md)

- No backend; static JSON only under `public/data/`.
- No browser-side provider calls, API keys, or secrets.
- All ingest stays in `scripts/ingest/...` or GitHub Actions.
- Output remains descriptive — no advice, forecasts, targets, or buy/sell language. Match `docs/LIMITATIONS.md`.
- Source-gated items must not enter the cockpit (only `free_public_active` or `proxy_only` signals are eligible whitelist entries).
- New `cockpit.json` gets a schema check in `scripts/validate/validate_schema.py` and a freshness expectation in `scripts/validate/validate_freshness.py`.

## Architecture

### Data flow

```
GitHub Actions → scripts/update_data.py
  ├─ existing fetch/transform/score/validate steps
  └─ NEW: build_cockpit.py
       ├─ reads scripts/shared/cockpit_whitelist.py (~15 signal definitions)
       ├─ reads signal_priority.json (today's priority per signal id)
       ├─ reads each whitelisted signal's series JSON (value + 90D history)
       ├─ computes per-cell value, Δ7d, Δ1m, sparkline_90d, percentile_5y, freshness_status
       ├─ sorts whitelist by priority desc; takes top 9 for vital_signs
       └─ writes public/data/derived/cockpit.json

Static deploy → React frontend
  └─ src/lib/data.ts: loadCockpit() → CockpitFile
       ├─ MarketCockpit.tsx (Overview only)
       │    ├─ CompositeScoresRow (always 3 fixed cells: market_weather / macro_climate / fragility)
       │    └─ VitalSignsGrid → CockpitCell × 9
       └─ PersistentRegimeHeader.tsx (every route, in AppLayout)
            ├─ regime dot + label
            ├─ composite risk score + arrow
            ├─ as-of date + freshness state
            └─ Brief|Detail toggle
```

### Cockpit selection rule

Composition is **dynamic but constrained**.

`scripts/shared/cockpit_whitelist.py` defines ~15 `CockpitSignal` entries. Each entry carries:

```python
@dataclass(frozen=True)
class CockpitSignal:
    id: str                       # cockpit-internal id (e.g., "real_yields")
    priority_key: str             # matches an id in signal_priority.json
    display_label: str            # short label shown in the cell header
    primary_series_id: str        # canonical series; drives value, spark, pctile
    secondary_lines: list[CockpitSecondaryLine] = field(default_factory=list)
    primary_unit: str = ""        # e.g. "%", "% YoY", " bp"
    primary_decimals: int = 1
    direction: Direction = "risk" # one of: risk | support | neutral
    importance: int = 3           # 1-5; used as a tie-breaker. Defaults to 3
                                  # if the matching SIGNAL_CATALOG entry omits it.
    why_it_matters: str = ""      # falls back to SIGNAL_CATALOG[priority_key]
                                  # .why_it_matters when blank

@dataclass(frozen=True)
class CockpitSecondaryLine:
    label: str
    series_id: str
    unit: str = ""
    decimals: int = 1
```

Selection algorithm in `build_cockpit.py`:

1. **Load inputs**: `signal_priority.json` (today's `top_warnings + top_supports` merged into one dict keyed by signal id), `data_status.json` (per-series freshness + availability), `regime_snapshot.json` (regime label + tone), `score_summary.json` (composite-score values + regime labels per bucket), and every whitelisted series' JSON under `public/data/series/` or `public/data/derived/`.
2. **Compute per-cell payload** for each whitelist entry: primary value (latest observation of `primary_series_id`), Δ7d / Δ1m (see "Delta semantics" below), 90D sparkline, 5y percentile (see "Percentile window" below), freshness status (`ok | stale | unavailable` from `data_status.json`), `secondary_values` (latest observation of each `secondary_lines[i].series_id`), `rank` (1-based position in the final `vital_signs` array — assigned after sort + truncation), `as_of` (latest-observation date of `primary_series_id`), `source_series_ids` (primary plus every secondary series id, for downstream cross-reference), and a per-cell `score_status ∈ {active, candidate, unavailable}` projected from the catalog (must be `active` for the cell to qualify — defense-in-depth so a misconfigured whitelist entry cannot smuggle a candidate signal into the cockpit).
3. **Compute per-entry priority**: look up `signal_priority.json[priority_key].priority`. Whitelist entries with no match get priority 0 and rank below all matched entries.
4. **Sort descending by priority**; tie-break by `importance` desc (read from the matched `signal_priority.json` entry; falls back to the `CockpitSignal.importance` default if no match), then alphabetical `id`.
5. **Filter out `unavailable` and non-`active` entries** before the top-9 cut.
6. **Take top 9 as `vital_signs`** and emit them with their computed payload. Remaining whitelist entries go to `candidates_not_shown` with `reason ∈ {"below top 9 today", "unavailable", "non-active"}`.

If a whitelisted signal is `stale`, it still qualifies for top-9 (no churn from a single missed release); the cell renders with an amber freshness pill and a desaturated sparkline.

**Composite-score values** (`composite_scores[*]`) are read from `score_summary.json`:
- `market_weather.value = score_summary.scores.market_weather.score`
- `macro_climate.value = score_summary.scores.macro_climate.score`
- `fragility.value = score_summary.scores.fragility.score`
- `regime_label` per composite score is the corresponding `.label` from the same source.
- Δ7d / Δ1m for composite scores come from `score_history.json[observations]` (existing artifact), using the same window-strict rule as vital signs.
- 90D sparkline for composite scores comes from `score_history.json[observations]`.
- `percentile_5y` and `percentile_window_days` follow the same fallback rules as vital signs (5y window, drop to available history if shorter, omit if fewer than 60 samples).
- `direction: "neutral"` is fixed for all three composite scores (they are bidirectional regime reads, not risk/support signals).
- The 3 composite scores ship in fixed order: `market_weather, macro_climate, fragility`. The schema validator enforces both the cardinality and the order.

**Regime field** on cockpit.json (`regime.label`, `regime.tone`) is read from `regime_snapshot.json[regime.label]`. Tone derives from a `REGIME_TONE_MAP` in `cockpit_whitelist.py` (`Goldilocks → positive`, `Reflation → positive`, `Stagflation Pressure → negative`, `Risk-Off → negative`, fallback `neutral`). When `regime_snapshot.json` is unavailable the cockpit builder reuses the prior `cockpit.json[regime]` (last-known-good fallback) and surfaces the staleness in the persistent header.

### Percentile window

`percentile_5y` is computed from the trailing 5 years of daily observations of `primary_series_id`. If the series has fewer than 252 observations (~1 trading year), the builder uses the full available history and the payload sets `percentile_window_days: <actual count>`. If fewer than 60 observations, the field is `null` and the cell renders without the percentile band. The window size is recorded per cell so the frontend can show "pct 78 (3y window)" when the default 5y is not met.

### Delta semantics for non-daily series

`delta_7d` and `delta_1m` are computed against the most recent observation strictly older than 7 or 30 calendar days, respectively. If no such observation exists in the series (e.g., a quarterly series with only 3 observations in the last year), the field is `null`. Specifically:

- Daily series (e.g., `vix`, `us10y`): both deltas usually populate.
- Weekly series (e.g., `initial_claims`, `cftc_sp500_lev_money_net`): Δ7d uses the previous weekly print; Δ1m uses the print ≥30 days old.
- Monthly series (e.g., `core_cpi`, `nonfarm_payrolls`): Δ7d is typically `null` (a single monthly release is rarely >7 days apart from itself); Δ1m uses the prior month's print.
- The frontend hides any `null` delta rather than rendering "—" so the cell visually stays clean.

### Whitelist roster (initial ~15)

| Whitelist `id` | `display_label` | `primary_series_id` | `direction` | Why always-eligible |
|---|---|---|---|---|
| `vix_complex` | VIX | `vix` (+9d/3m context) | risk | Equity vol gauge |
| `us10y` | US 10Y | `us10y` | risk | Reference rate |
| `real_yields` | 10Y Real Yield | `real_yield_10y` | risk | Valuation driver |
| `yield_curve` | 10Y−2Y | derived `us10y_minus_us2y` | risk | Recession signal |
| `credit_spreads` | HY OAS | `high_yield_oas` | risk | Credit stress |
| `ig_spreads` | IG OAS | `investment_grade_oas` | risk | IG credit stress |
| `broad_dollar` | Broad USD | `broad_dollar` | risk | Global liquidity transmission |
| `wti_crude` | WTI Crude | `wti_crude` | risk | Inflation impulse |
| `net_liquidity` | Net Liquidity | derived `net_liquidity` | support | Funding backdrop |
| `inflation` | Core CPI YoY | `core_cpi` | risk | Inflation anchor |
| `labor_claims` | Initial Claims | `initial_claims` | support | Fastest labor pulse |
| `payrolls` | Nonfarm Payrolls | `nonfarm_payrolls` | support | Monthly labor read |
| `sp500_positioning` | SP500 Lev-Money | `cftc_sp500_lev_money_net` | risk | Sentiment crowd |
| `term_premium` | 10Y Term Premium | `term_premium_acm_10y` | risk | Rate decomposition |
| `breakeven_10y` | 10Y Breakeven | `breakeven_10y` | risk | Inflation expectations |

The whitelist is Python (not JSON) so it can carry formulas (e.g. derived series, multi-series displays). It is not source-gated material — every entry is already a `free_public_active` or `proxy_only` series in the existing catalog. **Explicitly excluded from the initial whitelist (gated by source review):** MOVE (`tradingview_move_candidate`), Cboe SKEW (no candidate yet), Cboe put/call (`tradingview_put_call_candidate`), Cboe/CFE VX futures curve (`tradingview_vix_term_candidate`). These remain `terms_review_needed` / `authenticated_candidate`; promotion is gated by a `docs/source_reviews/<name>.md` update + a separate PR. Once promoted, each becomes a one-line whitelist edit.

### `cockpit.json` schema

```json
{
  "generated_at_utc": "2026-05-17T16:13:45Z",
  "date": "2026-05-15",
  "method_version": "phase-e-cockpit-v1",
  "regime": { "label": "Reallocation / rotation", "tone": "neutral" },
  "composite_scores": [
    {
      "id": "market_weather",
      "label": "Market Weather",
      "value": 4.32,
      "regime_label": "Mixed",
      "percentile_5y": 62,
      "delta_7d": 0.3,
      "delta_1m": -0.5,
      "sparkline_90d": [3.8, 3.9, 4.0, 4.1, 4.2, 4.32],
      "direction": "neutral"
    }
  ],
  "vital_signs": [
    {
      "id": "inflation",
      "rank": 1,
      "label": "Inflation",
      "primary_value": 3.2,
      "primary_unit": "% YoY",
      "primary_decimals": 1,
      "secondary_values": [
        { "label": "Core PCE", "value": 2.8, "unit": "% YoY" }
      ],
      "percentile_5y": 78,
      "percentile_window_days": 1260,
      "delta_7d": 0.1,
      "delta_1m": null,
      "sparkline_90d": [3.0, 3.0, 3.05, 3.1, 3.12, 3.15, 3.18, 3.2],
      "freshness_status": "ok",
      "score_status": "active",
      "as_of": "2026-04-01",
      "direction": "risk",
      "source_series_ids": ["core_cpi", "core_pce"],
      "priority": 495.0,
      "importance": 5,
      "why_it_matters": "Inflation trajectory drives Fed policy expectations and real-yield direction."
    }
  ],
  "candidates_not_shown": [
    { "id": "wti_crude", "priority": 88.4, "reason": "below top 9 today" },
    { "id": "breakeven_10y", "priority": 0, "reason": "non-active" }
  ]
}
```

`composite_scores[*].sparkline_90d` and `vital_signs[*].sparkline_90d` always carry up to 90 trailing daily observations (the full content is elided in the sample above for brevity). Schema validator enforces `len(sparkline_90d) <= 90`.

`score_status` per cell is a defense-in-depth gate: every vital-sign cell must carry `score_status: "active"`. A cell with any other value is rejected by `check_cockpit_schema()` — this ensures a misconfigured whitelist entry cannot accidentally surface a candidate signal in the cockpit even if it ranks highest in priority.

### Frontend tier model

The Overview renders five tiers, top to bottom:

```
TIER 0  PersistentRegimeHeader (sticky, in AppLayout — every route)
TIER 1  MarketCockpit (Overview only, always visible)
          ├─ CompositeScoresRow  (always 3 fixed cells)
          └─ VitalSignsGrid (9 cells, rotating contents)
TIER 2  Today's Notable (Detail mode only)
          ├─ TopSignalList (warnings)
          ├─ TopSignalList (supports)
          └─ WhatChangedColumn
TIER 3  Context block, <details> collapsed (Detail mode only)
          ├─ ScoreContributionHeatmap
          ├─ DriverAttributionPanel
          ├─ MissingSignalPanel
          └─ HorizonImpactMatrix
TIER 4  Footer (always visible, compact)
          ├─ DataQualityBanner (one line + expand)
          └─ DataStatusTable (in <details>)
```

In Brief mode (auto on <900 px, opt-in elsewhere), Tiers 2–3 are entirely hidden. Each cockpit cell additionally drops `delta_7d`, `delta_1m`, and `secondary_values` — keeping only label + primary value + sparkline + percentile band + freshness pill.

### Persistent header

Lives at the top of `AppLayout.tsx`. Sticky (`position: sticky; top: 0; z-index: 20`). Shrinks to a thin one-line bar after 80px scroll (regime dot + score + toggle survive; date + refresh fold into a tooltip). Honors `prefers-reduced-motion` by skipping the shrink animation.

Reads `cockpit.json`. The mode toggle updates URL `?mode=brief|detail` and writes `localStorage.mwm.mode`. Precedence on load: URL > localStorage > viewport auto.

**Viewport-resize behavior**: once the user has explicitly set a mode (URL or localStorage), that choice persists across viewport changes — resizing past the 900px breakpoint mid-session does not silently flip the mode. The viewport-auto fallback only fires on the very first visit (no URL param, no localStorage entry).

**Subpage header coverage**: `PersistentRegimeHeader` carries regime + composite risk + as-of + toggle. It does **not** carry per-bucket scores. Subpages (`/short-term`, `/long-term`, `/fragility`) that previously rendered `<HorizonScoreHeader>` retain a slim per-route adapter — a `<RouteScoreStrip>` component (NEW) showing only the relevant bucket score + label + percentile, without the full driver lists that `HorizonScoreHeader` used to render. The `DataQualityBanner` is removed from subpages because the persistent header surfaces the worst-case freshness state for the page being viewed.

### Nav consolidation (Hybrid IA)

```
Overview · Short-Term · Long-Term · Fragility · Channels · History · More ▾
                                                                       └─ Calendar
                                                                       └─ Methodology
```

URL migration (every redirect via `<Route element={<Navigate to=... replace />} />`, same pattern as the existing `/tactical → /short-term`):

| Old URL | New URL |
|---|---|
| `/regime-map` | `/history?tab=regime` |
| `/replay` | `/history?tab=replay` |
| `/volatility` | `/channels?tab=volatility` |
| `/rates` | `/channels?tab=rates` |
| `/liquidity` | `/channels?tab=liquidity` |
| `/credit` | `/channels?tab=credit` |
| `/dollar-global` | `/channels?tab=dollar` |
| `/commodities` | `/channels?tab=commodities` |
| `/growth` | `/channels?tab=growth` |
| `/housing` | `/channels?tab=housing` |
| `/inflation` | `/channels?tab=inflation` |
| `/sentiment` | `/channels?tab=positioning` |

`/`, `/short-term`, `/tactical → /short-term`, `/long-term`, `/macro-climate → /long-term`, `/fragility`, `/calendar`, `/methodology` are unchanged.

### Mobile considerations

- Persistent header collapses to: regime dot + composite risk score + Brief|Detail toggle. Date moves into a tooltip on the dot.
- Nav becomes a bottom tab bar with 5 items (Overview · Short-Term · Long-Term · Fragility · More ▾) for thumb-reach. Channels + History live under More ▾.
- Cockpit grid auto-collapses to a single column via existing `auto-fit, minmax(220px, 1fr)`.
- Brief mode is the default for viewports under 900px.

## Components

### New components

- `src/components/RouteScoreStrip.tsx` — slim per-route adapter showing the relevant bucket score + label + percentile on `/short-term`, `/long-term`, `/fragility`. Replaces `<HorizonScoreHeader>`'s role on those routes without duplicating cockpit content.
- `src/components/MarketCockpit.tsx` — owns the cockpit grid; renders `CompositeScoresRow` + `VitalSignsGrid`.
- `src/components/CompositeScoresRow.tsx` — always renders 3 fixed cells in the fixed order: Market Weather, Macro Climate, Fragility.
- `src/components/CockpitCell.tsx` — atomic vital-sign cell; same template regardless of which signal occupies it.
- `src/components/PersistentRegimeHeader.tsx` — sticky header in `AppLayout`.
- `src/components/PercentileBand.tsx` — reusable inline SVG bar with a vertical tick at the current pctile.
- `src/components/Sparkline.tsx` — reusable inline SVG `<polyline>`, no ECharts.
- `src/components/FreshnessPill.tsx` — reusable pill (ok / stale / unavailable).
- `src/components/TodaysNotable.tsx` — 3-column band: TopSignalList warnings, TopSignalList supports, WhatChangedColumn.
- `src/components/WhatChangedColumn.tsx` — driver-attribution diff display, derived from `score_history.json`'s `latest_attribution`.
- `src/components/ContextBlock.tsx` — `<details>` collapsible wrapper.
- `src/routes/Channels.tsx` — single tabbed route hosting 10 tab components.
- `src/components/channels/ChannelTabs.tsx` — tab strip with URL state via `useSearchParams`.
- `src/components/channels/{Volatility,Rates,Liquidity,Credit,Dollar,Commodities,Growth,Housing,Inflation,Positioning}Tab.tsx` — extracted bodies of the old routes; code-split via `lazy()`.
- `src/routes/History.tsx` — tabbed route hosting regime + replay.
- `src/components/history/{RegimeTab,ReplayTab}.tsx` — extracted bodies of `RegimeMap.tsx` and `HistoricalRegimeReplay.tsx`.
- `src/lib/mode.ts` — mode context, URL/localStorage/viewport precedence, `<ModeProvider>` mounted in `App.tsx`.

### Changed components

- `src/components/AppLayout.tsx` — mount `<PersistentRegimeHeader>` + `<ModeProvider>`; compress nav from 3 sections × 18 pills to one horizontal bar of 7 visible pills + "More ▾" overflow.
- `src/routes/Overview.tsx` — replace most of its body with the new tier structure; delete the duplicated panels enumerated below.
- `src/routes/TacticalTradingWeather.tsx`, `src/routes/LongTermMacroClimate.tsx`, `src/routes/FragilityShockRisk.tsx` — remove duplicated `<DataQualityBanner>` + `<HorizonScoreHeader>`; replace `<HorizonScoreHeader>` with the new `<RouteScoreStrip>`; keep route-specific FocusBlock + charts. `DataQualityBanner` rolls up into the persistent header's worst-case freshness pill.
- `src/App.tsx` — register `/channels`, `/history`; replace 10 detail routes + `/regime-map` + `/replay` with `<Navigate>` redirects; mount `<ModeProvider>`.
- `src/lib/types.ts` — add `CockpitFile`, `CockpitVitalSign`, `CockpitCompositeScore`, `CockpitWhitelistEntry`.
- `src/lib/data.ts` — add `loadCockpit()`.
- `src/styles.css` — add cockpit grid + cell tokens, sticky header rules, mode-aware visibility, mobile bottom-tab-bar styles.

### Deleted from Overview (kept as files until PR 7 cleanup)

`OverviewDecisionCard × 4`, `ScoreCard × 3` (on Overview only — still used on subpages), `InterpretationPanel`, `SignalList × 2`, `ConfidenceBreakdown`, `MarketBriefHeader`, `HowToReadPanel`.

### Deleted files (across PRs 5–7)

Per the per-PR scope clarifications in the migration plan, file deletions are owned by the PR that orphans them — not deferred:

- **PR 5 deletes** the 10 old detail-route files in `src/routes/`: `Volatility.tsx`, `Rates.tsx`, `Liquidity.tsx`, `Credit.tsx`, `DollarGlobal.tsx`, `Commodities.tsx`, `Growth.tsx`, `Housing.tsx`, `Inflation.tsx`, `Sentiment.tsx`. PR 5 also removes their `import` statements from `src/App.tsx` when adding the `<Navigate>` redirects.
- **PR 6 deletes** `src/routes/RegimeMap.tsx` and `src/routes/HistoricalRegimeReplay.tsx` along with their `App.tsx` imports.
- **PR 7 deletes** `src/components/OverviewDecisionCard.tsx`, `src/components/MarketBriefHeader.tsx`, and `src/components/HorizonScoreHeader.tsx` — the three Overview-only components that became unused after PR 4's Overview rebuild and PR 7's swap to `<RouteScoreStrip>` on subpages.

## Validation & testing

### New Python tests

- `tests/python/test_build_cockpit.py` — builder produces correct shape; correctly merges priority + series; correctly computes Δ7d / Δ1m / sparkline; correctly handles missing series; correctly downgrades stale signals.
- `tests/python/test_cockpit_whitelist.py` — every whitelist entry maps to an existing catalog series; `direction ∈ {risk, support, neutral}`; no duplicate ids; ≥ 9 entries.
- `tests/python/test_validate_cockpit_schema.py` — schema validator accepts valid samples; rejects each required-key violation, wrong-cardinality composite scores, out-of-range percentile.
- `tests/python/test_cockpit_priority_merge.py` — given a sample `signal_priority.json`, top-9 selection is correct; ties broken by importance desc, then alphabetical id.
- `tests/python/test_cockpit_freshness.py` — when a series is older than `max_stale_days`, the cell still occupies its slot and `freshness_status === "stale"`.

### Changed Python validators

- `scripts/validate/validate_schema.py` — add `check_cockpit_schema()` enforcing the schema above.
- `scripts/validate/validate_freshness.py` — add `cockpit` to expected derived outputs with `max_age_days=2` (daily refresh + weekend tolerance).

### New React tests (vitest)

- `src/components/__tests__/MarketCockpit.test.tsx` — renders 3 composite scores + N vital signs from sample `cockpit.json`; renders empty / loading / error states; respects `mode` prop.
- `src/components/__tests__/CockpitCell.test.tsx` — renders primary + sparkline + percentile; hides Δ + secondary in Brief; shows them in Detail; freshness pill color is correct; tooltip on focus shows `why_it_matters`.
- `src/components/__tests__/PersistentRegimeHeader.test.tsx` — renders regime label + color dot from sample data; toggle updates URL + localStorage; sticky behavior renders the thin bar after scroll.
- `src/components/__tests__/CompositeScoresRow.test.tsx` — always renders 3 scores in fixed order regardless of input ordering.
- `src/components/__tests__/TodaysNotable.test.tsx` — renders all three columns from sample data; hidden in Brief mode.
- `src/routes/__tests__/Channels.test.tsx` — URL `?tab=rates` mounts `RatesTab`; default mounts `VolatilityTab`; clicking a tab updates the URL.
- `src/routes/__tests__/History.test.tsx` — tab routing for regime vs replay; deep links work.
- `src/routes/__tests__/redirects.test.tsx` — each old URL resolves to the new URL with `<Navigate replace>`.
- `src/lib/__tests__/data.test.ts` — `loadCockpit()` caches; freshness pill state derives from `cockpit.json`'s `freshness_status` per cell.
- `src/lib/__tests__/mode.test.ts` — mode precedence: URL > localStorage > viewport-auto.

### Fixtures

- `src/__fixtures__/cockpit/today.json` — happy-path render.
- `src/__fixtures__/cockpit/all-stale.json` — every cell stale.
- `src/__fixtures__/cockpit/partial-fill.json` — only 5 vital signs available.
- `src/__fixtures__/cockpit/truncation.json` — all 15 whitelist entries return valid payload; the test asserts the cockpit emits exactly 9 in priority order and the remaining 6 land in `candidates_not_shown` with `reason: "below top 9 today"`.
- `src/__fixtures__/cockpit/composite-missing.json` — `score_summary.json` missing the `fragility` block; builder emits 2 composite scores; schema validator must fail this fixture (negative test).

### Existing test impact

- `src/routes/data-routes.test.tsx` — update route-count assertion. Final count: 8 active route components (`Overview`, `TacticalTradingWeather`, `LongTermMacroClimate`, `FragilityShockRisk`, `Channels`, `History`, `Calendar`, `Methodology`) + 14 redirect entries (existing `/tactical`, `/macro-climate` plus 12 new redirects from the migration table).
- `src/routes/__tests__/*Route.test.tsx` (Phase D placement tests) — update assertions for routes that become tabs (Volatility / Rates / Liquidity / etc.).
- `tests/python/test_page_insights_*` — FocusBlock placements remain on Short-Term / Long-Term / Fragility; no change. Channels tabs get no per-tab FocusBlocks (deferred).
- Source-governance tests — no change; cockpit signals are already `free_public_active` / `proxy_only`.

### Verification gate per PR (from CLAUDE.md)

```bash
npm test
npm run build
python -m pytest tests/python -v
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

For data-only PRs (PR 1): also `python -m scripts.update_data` to confirm the safe-update path works.

Each PR includes a manual browser check at the end: every route renders, every redirect URL resolves, Brief/Detail toggle persists across navigation, mobile layout at 390px is usable, keyboard focus on cockpit cells shows tooltip.

## Data ownership

To prevent overlap drift between the new and existing derived JSONs:

- `public/data/derived/cockpit.json` — canonical Overview-cockpit payload (composite scores + 9 vital signs + regime field). Consumed only by `<MarketCockpit>` and `<PersistentRegimeHeader>`.
- `public/data/derived/signal_priority.json` — canonical ranked-signal list (unchanged). Consumed by `<TopSignalList>` on Overview Today's Notable and Tactical, and by the cockpit builder upstream.
- `public/data/derived/bucket_scores.json` — per-bucket score components. Consumed by subpage cards and `RouteScoreStrip`. Unchanged.
- `public/data/derived/score_history.json` (existing) — 90D history of composite scores + latest attribution. Consumed by `WhatChangedColumn` and by the cockpit builder for composite-score sparklines.
- `public/data/derived/regime_snapshot.json` (existing) — full regime quadrant payload. Consumed by `RegimeTab` (formerly `/regime-map`) and by the cockpit builder for the `regime` field.

If any of these are modified or renamed by future work, `cockpit.json`'s builder + frontend must be updated in the same PR.

## Method version policy

`method_version` in `cockpit.json` follows `phase-e-cockpit-vN`. Any change to the schema (added/removed/renamed field, or semantics change in an existing field) bumps `N`. The schema validator asserts the version string format. Frontend consumers warn (console.warn, not error) when they see an unexpected `phase-e-cockpit-vN` prefix.

## Whitelist composition guidance

The initial 15-entry whitelist is intentionally heavy on rates-family signals (`us10y`, `real_yields`, `yield_curve`, `term_premium`, `breakeven_10y`) because rate dynamics dominate macro reading in the current regime. The selection rule does **not** enforce a per-category quota — if every top-9 slot ends up filled by rate signals during a rate-stress episode, that is the correct read.

Should this turn out to overwhelm the cockpit (a Channels-rebalance follow-up could decide), a category quota (e.g., `max 3 cells per direction-tag category`) can be added to `build_cockpit.py` as a one-function change. The current spec accepts this as known behavior and does not introduce the quota up front.

## Freshness behavior in CI

- `update-data.yml` already runs `python -m scripts.update_data`; adding `build_cockpit` to that fan-out means the cockpit refreshes on every weekday cron run plus any manual dispatch.
- If `build_cockpit` fails (e.g., a whitelisted series went missing), `safe_update.py` restores the prior `cockpit.json` and records the failure in `data_status.json`. The frontend shows the prior cockpit + a stale pill in the persistent header. No silent dropout.

## Migration plan — 7 sequential PRs

| PR | Type | Scope | Days | Risk | Reversible |
|---|---|---|---|---|---|
| 1 | backend | `build_cockpit.py` + whitelist + tests + validators; produces `cockpit.json`; no frontend changes | 1 | low | trivially |
| 2 | frontend additive | `<MarketCockpit>` + primitives (`Sparkline`, `PercentileBand`, `FreshnessPill`); slot on top of Overview; everything else unchanged | 2 | low | trivially |
| 3 | frontend additive | `<PersistentRegimeHeader>` + `<ModeProvider>`; mounted in `AppLayout`; toggle present but doesn't change rendering yet | 1 | low | trivially |
| 4 | frontend mutative | Demote Overview duplicates; add Today's Notable; add Context `<details>`; wire mode-aware visibility | 2 | medium | revert PR |
| 5 | frontend mutative | `/channels` route + 10 detail-route redirects; collapse nav 18 → 7 | 3 | medium | revert PR |
| 6 | frontend mutative | `/history` route + `/regime-map` + `/replay` redirects | 1 | low | revert PR |
| 7 | frontend cleanup | Remove duplicated chrome from `/short-term`, `/long-term`, `/fragility`; replace `<HorizonScoreHeader>` with `<RouteScoreStrip>`; delete `OverviewDecisionCard.tsx` / `MarketBriefHeader.tsx` / `HorizonScoreHeader.tsx`; bundle-size check | 1 | low | trivially |

**Total: ~11 days.**

### Sequencing rules

- **PR 1 lands first** (publishes `cockpit.json` to `public/data/`).
- **PR 2 and PR 3 may proceed in parallel** once PR 1 lands. PR 2 is the only one that consumes `cockpit.json` data; PR 3 has no data dependency.
- **PRs 4 → 7 must ship in order.** Each builds structurally on the prior.
- After PR 4 ships, monitor for at least one weekday data refresh before PR 5 — gives time to catch any Brief/Detail UX issue before adding the bigger nav restructure on top.

### Per-PR scope clarifications

- **PR 5 explicitly owns the App.tsx import cleanup.** When PR 5 introduces the 10 `<Navigate>` redirects, it also removes the 10 corresponding `import` statements at the top of `src/App.tsx`. The 10 old route component files in `src/routes/` (Volatility, Rates, Liquidity, Credit, DollarGlobal, Commodities, Growth, Housing, Inflation, Sentiment) then become unreferenced and are deleted as part of PR 5 (not deferred to PR 7).
- **PR 6 explicitly owns the same cleanup for History.** PR 6 removes `RegimeMap` and `HistoricalRegimeReplay` imports from `App.tsx` and deletes the two route files.
- **PR 7 is therefore "subpage cleanup" only**: removing duplicated `<DataQualityBanner>` / `<HorizonScoreHeader>` from the three remaining horizon routes, deleting `OverviewDecisionCard.tsx` / `MarketBriefHeader.tsx` / `HorizonScoreHeader.tsx`, and the bundle-size check. PR 7 has no remaining-consumer ambiguity because PR 5 and PR 6 already orphaned their respective route files.

## Acceptance criteria

- `cockpit.json` validates against the documented schema; freshness validator passes; `npm test` and `python -m pytest tests/python -v` pass.
- Overview renders the cockpit at the top: 3 composite-score cells (always in fixed order) + 9 vital-sign cells (selected from the whitelist by today's priority).
- Persistent regime header renders on every route, including the redirects' new homes.
- Brief/Detail toggle persists across page navigations via URL + localStorage; auto-defaults to Brief at viewport <900px.
- In Brief mode: Tiers 2–3 are not rendered; cockpit cells hide Δ7d / Δ1m / secondary values.
- In Detail mode: all tiers render; Context block defaults to collapsed `<details>`.
- Old detail URLs (`/volatility`, `/rates`, `/liquidity`, `/credit`, `/dollar-global`, `/commodities`, `/growth`, `/housing`, `/inflation`, `/sentiment`, `/regime-map`, `/replay`) all resolve via `<Navigate replace>` to their new homes.
- Nav at desktop shows 7 visible pills + "More ▾"; at mobile <900px, the bottom tab bar shows 5 items.
- No duplicated `<DataQualityBanner>` / `<HorizonScoreHeader>` on subpages (PersistentRegimeHeader covers).
- No new data source enters scoring; source-gating contract unchanged.
- `GITHUB_PAGES=true npm run build` succeeds; bundle size is no larger than pre-initiative + 5%. Measurement command for PR 7: `du -sk dist/assets/*.js | sort -n | tail -1` against the pre-initiative baseline captured before PR 1. Cockpit primitives are inline SVG (not new ECharts modules), so growth should come only from new component code, not chart libraries.

## Out of scope (explicit non-goals; some may become follow-ups)

- FocusBlock placements on Channels tabs.
- Per-cell glossary tooltips (e.g., `<abbr title="VIX9D/VIX ratio">` for jargon) — defer to a follow-up A11Y pass.
- Print stylesheet.
- `/diff` route (today vs N days ago summary).
- Keyboard shortcuts.
- Promotion of MOVE / SKEW / put-call / VX-curve sources into the whitelist.
- Recalibration of the confidence aggregate.
- Removal of Recharts in favor of ECharts on any chart not already migrated.
