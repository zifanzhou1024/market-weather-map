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
| A | `source-governance-agent` | `src/lib/types.ts` (`AccessStatus` enum + flags), `public/data/catalog/source_registry.json` reclassification + new entries (`bea`, `bls`, `multpl_shiller`, `ny_fed`, `naaim`, `aaii`, `tradingview`), `public/data/catalog/series_catalog.json` per-series overrides where needed (e.g. FRED-hosted SP500 stays gated at the series level), `scripts/validate/validate_schema.py` extensions, `scripts/validate/validate_candidate_isolation.py` (new), `tests/python/test_signal_priority.py` extension, `tests/python/test_candidate_isolation.py` (new), `public/data/candidates/README.md`, `public/data/candidates/.gitkeep`. |
| B | `official-sources-agent` | `scripts/ingest/fetch_bea_personal_saving_rate.py`, `scripts/ingest/fetch_shiller_cape.py`, `scripts/ingest/fetch_nyfed_acm_term_premium.py`, `scripts/transform/build_treasury_supply_pressure.py`, `docs/source_reviews/bea_personal_saving_rate.md`, `docs/source_reviews/shiller_cape.md`, updated `docs/source_reviews/ny_fed_acm_term_premium.md`. |
| B | `cboe-candidate-agent` | `scripts/ingest/fetch_cboe_put_call.py`, `scripts/ingest/fetch_cboe_vx_settlements.py`, `scripts/transform/build_vx_curve_context.py`. |
| B | `sentiment-candidate-agent` | `scripts/ingest/fetch_naaim_candidate.py`, `scripts/ingest/fetch_aaii_candidate.py`. |
| C | `tradingview-candidate-agent` | `.github/workflows/update-data.yml` env-block extension only, `requirements.txt` additions, `scripts/shared/config.py` secret helpers, `scripts/ingest/fetch_tradingview_move.py`, `scripts/ingest/fetch_tradingview_put_call.py`, `scripts/ingest/fetch_tradingview_vx_curve.py`, `docs/source_reviews/tradingview_authenticated_candidates.md`, `tests/python/test_secrets_isolation.py`. |
| D | `focus-pattern-agent` | `src/components/FocusBlock.tsx`, `src/components/FocusBlock.test.tsx`, `src/lib/types.ts` extension (`SectionInsight`, `RouteInsight.sections`), `scripts/transform/build_page_insights.py` extension (`SECTION_CATALOG`), targeted insertions in `Volatility.tsx`, `Rates.tsx`, `RegimeMap.tsx`, `Sentiment.tsx`, `TacticalTradingWeather.tsx`, `FragilityShockRisk.tsx`. |
| QA | `qa-agent` | Verification commands, candidate-isolation grep checks, route-render fallback checks, no-secret-in-public-JSON check, ARIA fallback checks, verification report. |

### Why this carves cleanly

- Phase A is governance-only — touches catalog + types + validators. No ingest scripts, no routes, no UI components.
- Phase B's three agents write to disjoint files. `official-sources-agent` writes to `series/` and `derived/`. `cboe-candidate-agent` and `sentiment-candidate-agent` write only to `candidates/`. No script-file overlap.
- Phase C is the only phase that touches `.github/workflows/` and `requirements.txt`.
- Phase D is the only phase that touches `src/components/` and routes in this design.
- `source_registry.json` is touched by phase A (reclassification + pre-emptive addition of `naaim`, `aaii`, `tradingview`, `bea`, `bls`, `multpl_shiller`, `ny_fed`). Phase B/C agents only *reference* the entries already added by phase A.

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
  "active_scoring_allowed": boolean,           // derived from access_status; explicit for safety
  "public_redistribution_allowed": boolean     // explicit; true only for free_public_active + derived + proxy_only
}
```

Derivation rule (validator enforces):

| `access_status` | `active_scoring_allowed` | `public_redistribution_allowed` |
|---|---|---|
| `free_public_active` | true | true |
| `free_public_candidate` | false | true (file can ship in candidates/) |
| `terms_review_needed` | false | false (panel-only display in routes) |
| `authenticated_candidate` | false | false |
| `proxy_only` | true (under proxy name) | true |
| `restricted_vendor` | false | false |
| `unavailable` | false | false |

`requires_secret` is independent: true only for `authenticated_candidate` and any per-series exception.

### Reclassification of existing registry entries

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

FRED-hosted SP500 stays gated at the **series** level via `series_catalog.json`, not the source level. The series entry overrides `fred`'s `free_public_active` default with `terms_review_needed` and `active_scoring_allowed: false`.

### New source entries (added by `source-governance-agent` in phase A)

| Entry | `access_status` | `requires_secret` |
|---|---|---|
| `bea` | `free_public_active` | false |
| `bls` | `free_public_active` | false |
| `multpl_shiller` | `free_public_active` | false |
| `ny_fed` | `free_public_candidate` | false (re-review may promote later) |
| `naaim` | `free_public_candidate` (pending `aaii_naaim.md` confirmation) | false |
| `aaii` | `free_public_candidate` (pending `aaii_naaim.md` confirmation) | false |
| `tradingview` | `authenticated_candidate` | true |

### `public/data/candidates/` directory

Phase A creates the directory with a `.gitkeep` and a `README.md` stating:

> Candidate JSONs live here. They never enter active scoring, `page_insights` primary slots, hero charts, `score_summary`, or `regime_*` files. Routes may display them only in `RouteDataFooter` or candidate panels.

### Validator extensions

`scripts/validate/validate_schema.py` enforces:

- `AccessStatus` enum on every registry and catalog entry.
- `requires_secret`, `active_scoring_allowed`, `public_redistribution_allowed` are present on every entry.
- The derivation table above (e.g. `access_status: "free_public_active"` ⇒ `active_scoring_allowed: true`).
- Any file under `public/data/candidates/` carries `access_status` ∈ {`free_public_candidate`, `terms_review_needed`, `authenticated_candidate`} and `active_scoring_allowed: false`.

`scripts/validate/validate_candidate_isolation.py` (new) loads `signal_priority.json`, `page_insights.json`, `score_summary.json`, `regime_score.json`, `bucket_scores.json`, `shock_risk_snapshot.json` and verifies that no candidate-class `series_id` appears in primary slots. Fails loudly with the leaking id and the receiving file.

### Candidate isolation guard — defense in depth

1. **Python build-time guard.** `scripts/transform/build_signal_priority.py` and `scripts/transform/build_page_insights.py` extend their existing source-gated exclusion to include every `access_status` not in {`free_public_active`, `proxy_only`, `derived`}. Excluded items may still appear in `missing_high_value_signals` for transparency.
2. **Validator-time guard.** `validate_candidate_isolation.py` catches leaks in committed JSON.
3. **Pytest contract.** Existing `tests/python/test_signal_priority.py` gated-source non-leak test is extended; new `tests/python/test_candidate_isolation.py` adds an intentional-leak fixture per new `AccessStatus` enum value that must fail validation.

### `source-governance-agent` acceptance

- All registry and catalog entries carry the new fields with valid values.
- Reclassification table matches the file state.
- All seven new source entries are present.
- All three validators (`validate_schema`, `validate_freshness`, `validate_candidate_isolation`) pass on existing data.
- Intentional-leak fixtures fail the validator.
- `public/data/candidates/README.md` and `.gitkeep` exist.
- `npm run build` and `npm test` still pass.
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

**Pipeline integration.** Wire new build scripts into `scripts/update_data.py` after their upstream data is generated. The safe-update path preserves prior good JSON on failure; failures record into `public/data/status/data_status.json`.

**Acceptance.**

- Three source review docs committed before any ingest script.
- All four output files validate against schema and freshness.
- `python -m scripts.update_data` produces them on a fresh repo when network is available.
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

- `public/data/candidates/naaim_exposure_candidate.json` — `free_public_candidate` if `docs/source_reviews/aaii_naaim.md` pre-approves; `terms_review_needed` otherwise.
- `public/data/candidates/aaii_sentiment_candidate.json` — same treatment.

Weekly cadence.

**Acceptance.**

- Existing `aaii_naaim.md` source review consulted; output `access_status` reflects review conclusion.
- Candidate panel on `Sentiment.tsx` can display these (rendering belongs to phase D's FocusBlock + the existing `CandidateDiagnosticPanel`).
- No active scoring impact.

### Cross-agent collision check

All three agents write to disjoint files. `source_registry.json` is touched only by phase A. New `naaim`, `aaii`, and other registry entries are added by `source-governance-agent` in phase A pre-emptively so phase B's other two agents only reference existing entries.

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

Conservative additions:

```
pandas>=2.2,<3
requests>=2.32,<3
```

TradingView fetch library is optional, imported with `try/except ImportError`. Library choice (`tvDatafeed` or alternative) is the agent's call but must be pinned with explicit version constraints and documented in the source review.

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
3. No committed file under `public/data/` contains the literal strings `TRADINGVIEW_USERNAME` or `TRADINGVIEW_PASSWORD` (or their lowercase variants).

### `tradingview-candidate-agent` acceptance

- Source review doc committed first.
- Workflow env block extended; no other workflow edits.
- `requirements.txt` additions are minimal and pinned.
- `scripts/shared/config.py` exports the secret helpers with tests.
- All three candidate files validate when generated; absence is silently tolerated.
- `test_secrets_isolation.py` passes.
- `grep -r "TRADINGVIEW_\|tradingview_username\|tradingview_password" public/ docs/ src/` returns zero hits.
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
| Section | `FocusBlock variant="section"` | Above a multi-chart section that benefits from structured framing. Sparingly. |
| Chart | `InteractiveChartShell.insight` (string) | Default for ordinary charts. Unchanged in this phase. |
| Important chart | `InteractiveChartShell.insight={<FocusBlock variant="compact" .../>}` | Important single chart that needs structured framing. |

Never stack `PageInsightHero` + `FocusBlock variant="section"` + `FocusBlock variant="compact"` + `InteractiveChartShell.insight` string in a way that produces duplicate reads. The audit grid enforces this by limiting `FocusBlock` placements to six.

### Data source — `page_insights.json` extension

In `src/lib/types.ts`:

```ts
export type RouteInsight = {
  // existing fields preserved
  sections?: SectionInsight[];
};

export type SectionInsight = {
  id: string;                // matches a placement in the audit grid
  eyebrow: string;
  question: string;          // hand-curated, static
  answer: string;            // data-derived
  why?: string;
  risk?: string;
  support?: string;
  caveat?: string;
  freshness_status: SignalFreshnessStatus;
};
```

### `build_page_insights.py` extension

Add `SECTION_CATALOG: dict[RouteKey, list[SectionTemplate]]` where each `SectionTemplate` carries the section `id`, hand-curated `eyebrow` and `question`, and a Python derivation function that reads from existing derived JSONs (`rates_dashboard.json`, `volatility_dashboard.json`, `regime_dashboard.json`, `shock_risk_snapshot.json`, `signal_priority.json`) to fill `answer`/`why`/`risk`/`support`/`caveat`/`freshness_status`. Static text lives in Python; dynamic text is derived. Frontend only renders.

### Audit grid

Five `variant="section"` placements and one `variant="compact"` placement. Each placement is gated on data presence — when its `SectionInsight` is absent or its underlying data is missing, the FocusBlock does not render (no blank or loading block).

| Route | Section id | Variant | Placement | Data spine |
|---|---|---|---|---|
| `Volatility.tsx` | `volatility_complex` | section | Above the `volatility_primary_chart` + `volatility_secondary_charts` slots | `volatility_dashboard.json` |
| `Rates.tsx` | `rates_pressure` | section | Above the `rates_primary_chart` + `rates_secondary_charts` slots | `rates_dashboard.json` |
| `RegimeMap.tsx` | `regime_drivers` | section | Above the `regime_primary_chart` slot | `regime_dashboard.json` |
| `Sentiment.tsx` | `positioning_vs_candidate_sentiment` | section | Above the `sentiment_primary_chart` slot and the candidate panel pair below | CFTC actives + new NAAIM/AAII candidate files |
| `TacticalTradingWeather.tsx` | `tactical_stress_board` | section | Above the existing tactical 6-tile section | `signal_priority.json[top_warnings]` + tactical readiness |
| `FragilityShockRisk.tsx` | `shock_decomposition` | compact (inside `InteractiveChartShell.insight`) | Inside the existing `ShockRiskContributionChart`'s shell | `shock_risk_snapshot.json` |

Other routes (`Credit`, `Liquidity`, `DollarGlobal`, `Commodities`, `Inflation`, `Growth`, `Housing`, `LongTermMacroClimate`, `Overview`, `Calendar`, `Methodology`, `HistoricalRegimeReplay`) do **not** receive FocusBlock in this phase. They already have `PageInsightHero` plus chart-level `insight` strings; adding section-level FocusBlocks would duplicate reads.

### Tests

- Vitest: `FocusBlock` renders all field combinations in both variants; optional fields omit cleanly; freshness state applies styling.
- Vitest: each of the six placements renders against a fixture `page_insights.json` and gracefully degrades when `sections` is absent.
- Pytest: `build_page_insights.py` populates `sections` for the listed `RouteKey`s; derivation functions match documented logic; `validate_schema.py` enforces the new `SectionInsight` shape including the `id` enum.

### Phase D and phase B coordination

Phase D depends on phase B's data only at QA gate, not at dispatch. The new section text for Sentiment (NAAIM/AAII context) is written defensively: if `naaim_exposure_candidate.json` or `aaii_sentiment_candidate.json` is absent, the SECTION_CATALOG derivation falls back to a "data not yet active" answer string. Phase D can land before phase B's data fully arrives; FocusBlocks light up incrementally as data lands.

### `focus-pattern-agent` acceptance

- `FocusBlock.tsx` exists with both variants and passes Vitest.
- `page_insights.json` schema and `RouteInsight` type extended with `sections`.
- `build_page_insights.py` produces `sections` for the six placements with hand-curated questions/eyebrows and data-derived answers.
- Six placements inserted in the listed routes with no shell or hero changes.
- No edits to `PageInsightHero`, `RouteDataFooter`, `InteractiveChartShell`, or other charts.
- Tests cover happy path, missing data, and missing optional fields.

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

Per-section gating implemented in `validate_schema.py`. Candidate isolation enforced by `validate_candidate_isolation.py`. Both validators run as part of the existing `python -m scripts.validate.validate_schema` flow (the new module is imported alongside the existing checks).

### Active-scoring guard — three-layer defense

1. Python build-time filter in `build_signal_priority.py` and `build_page_insights.py`.
2. Validator-time grep against committed JSON.
3. Pytest contract with intentional-leak fixtures per new enum value.

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

- No active score uses any `series_id` whose `access_status` is not `free_public_active`, `proxy_only`, or `derived`.
- No leak of TradingView / Cboe-candidate / NAAIM / AAII `series_id`s into `signal_priority.json` primary slots, `page_insights.json` primary slots, `score_summary.json`, `regime_score.json`, `bucket_scores.json`, or `shock_risk_snapshot.json`.
- `public/data/candidates/README.md` exists; every file in that directory carries `active_scoring_allowed: false`.
- `grep -r "TRADINGVIEW_" public/ docs/ src/` returns zero hits.
- Every new route placement of `FocusBlock` renders cleanly when its underlying `sections` data is absent.
- `RouteDataFooter` is still the last element on every route.
- All new FocusBlock placements have ARIA labels and fallback text.
- A short verification report committed to `docs/superpowers/plans/2026-05-10-data-source-and-focus-pattern-expansion-verification.md`.

### `qa-agent` acceptance

- All commands above pass.
- All bullet checks above are confirmed.
- Verification report committed.

## Acceptance summary

| Phase | Primary deliverable | Verification |
|---|---|---|
| A | `AccessStatus` enum + flags + reclassification + candidate-isolation validator + candidates directory | All validators pass; intentional-leak fixtures fail validator; pytest extension passes |
| B | Personal saving rate + CAPE + ACM candidate + treasury supply pressure + Cboe put/call candidates + VX candidates + NAAIM/AAII candidates | All new JSONs validate; candidate isolation holds; safe-update preserves prior good data |
| C | TradingView MOVE/put-call/VX candidates with workflow env-block extension and secret helpers | Secrets never leak; missing secrets tolerated; candidate files validate when generated |
| D | `FocusBlock` + `SectionInsight` extension + six route placements | FocusBlock renders both variants; placements degrade gracefully when data absent |
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
