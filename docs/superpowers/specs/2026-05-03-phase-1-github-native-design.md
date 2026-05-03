# Phase 1 GitHub-Native Design: market-weather-map

Date: 2026-05-03

## Summary

`market-weather-map` is a GitHub-only static market regime dashboard. Phase 1 proves the full operating loop inside GitHub:

1. GitHub Actions fetches public, no-secret CSV data.
2. Python scripts normalize, validate, and score the data.
3. The workflow writes chart-ready JSON under `public/data`.
4. The workflow commits data updates back to the repository.
5. A separate GitHub Pages workflow builds a Vite React app and deploys static assets.
6. The browser reads only static JSON from the deployed GitHub Pages site.

The dashboard explains market conditions using delayed public data. It must not provide buy/sell signals, trading instructions, broker integrations, live feeds, or financial advice.

## Goals

- Build a static Vite + React + TypeScript app deployable to GitHub Pages.
- Fetch an initial no-secret public data set through GitHub Actions.
- Store all frontend data as static JSON files in `public/data`.
- Show source, last observation, generated timestamp, freshness state, and data status for every metric.
- Provide an initial transparent weather/regime score from `-100` to `+100`.
- Keep the first implementation small enough for independent subagents to work in parallel.

## Non-Goals

- No external backend, database, WebSocket, scheduled server, or user login.
- No paid API keys or frontend API keys.
- No browser-side scraping or direct browser calls to market data providers.
- No AAII, NAAIM, EIA, CFTC, Japan yields, crop futures, FX dashboard, or event calendar in Phase 1.
- No price targets, trade recommendations, or labels such as buy, sell, long, or short.

## Public Data Slice

Phase 1 uses official or stable public CSV endpoints that do not require secrets.

| Bucket | Series | Source | Endpoint Pattern |
| --- | --- | --- | --- |
| Volatility | VIX daily history | Cboe | `https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv` |
| Rates | US 2Y | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2` |
| Rates | US 10Y | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10` |
| Rates | US 20Y | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS20` |
| Rates | US 30Y | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30` |
| Liquidity | Fed assets | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL` |
| Liquidity | Reverse repo | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=RRPONTSYD` |
| Liquidity | Treasury General Account proxy | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=WTREGEN` |
| Liquidity | SOFR | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR` |
| Credit | High-yield OAS | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2` |
| Credit | Investment-grade OAS | FRED graph CSV | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLC0A0CM` |

Derived Phase 1 metrics:

- `us10y_minus_us2y`
- rolling percentile for core series where there is enough history
- bucket scores for volatility, rates, liquidity, and credit
- fixed neutral values for out-of-scope buckets so the score contract is stable
- overall weather score

## Architecture

```text
Public CSV endpoints
        |
        v
GitHub Actions: update-data.yml
        |
        v
Python scripts in scripts/
  ingest -> normalize -> validate -> score
        |
        v
public/data JSON files
        |
        v
Commit updated data to repo
        |
        v
GitHub Actions: deploy-pages.yml
        |
        v
GitHub Pages static Vite React app
```

The frontend must work from a GitHub Pages project path such as `/market-weather-map/`. Vite `base` should be configured for the repository path or an equivalent Pages-safe setup.

## Repository Structure

```text
market-weather-map/
  README.md
  package.json
  vite.config.ts
  index.html
  requirements.txt

  src/
    main.tsx
    App.tsx
    routes/
      Overview.tsx
      Volatility.tsx
      Rates.tsx
      Liquidity.tsx
      Credit.tsx
      Methodology.tsx
    components/
      AppLayout.tsx
      MetricCard.tsx
      RegimeBadge.tsx
      TimeSeriesChart.tsx
      PercentileBandChart.tsx
      SourceNote.tsx
      DataStatusTable.tsx
    lib/
      data.ts
      formatters.ts
      scoring.ts
      types.ts

  public/
    data/
      catalog/
        series_catalog.json
      series/
        vix.json
        us2y.json
        us10y.json
        us20y.json
        us30y.json
        fed_assets.json
        reverse_repo.json
        treasury_general_account.json
        sofr.json
        high_yield_oas.json
        investment_grade_oas.json
      derived/
        us10y_minus_us2y.json
        bucket_scores.json
        regime_score.json
      status/
        data_status.json

  scripts/
    ingest/
      fetch_cboe.py
      fetch_fred_csv.py
    transform/
      normalize_series.py
      compute_percentiles.py
      compute_regime_score.py
    validate/
      validate_schema.py
      validate_freshness.py
    shared/
      catalog.py
      io.py

  .github/
    workflows/
      update-data.yml
      deploy-pages.yml

  docs/
    DATA_SOURCES.md
    METHODOLOGY.md
    LIMITATIONS.md
```

## Data Contracts

### Series Catalog

Each series is registered in `public/data/catalog/series_catalog.json`.

```json
{
  "id": "us10y",
  "name": "U.S. 10-Year Treasury Yield",
  "category": "rates",
  "source": "FRED",
  "source_url": "https://fred.stlouisfed.org/series/DGS10",
  "frequency": "daily",
  "units": "percent",
  "higher_is": "contextual",
  "public": true,
  "notes": "Fetched from FRED graph CSV without an API key."
}
```

### Time Series

Each time series file uses the same shape.

```json
{
  "series_id": "us10y",
  "generated_at_utc": "2026-05-03T00:00:00Z",
  "source": "FRED",
  "source_url": "https://fred.stlouisfed.org/series/DGS10",
  "frequency": "daily",
  "units": "percent",
  "observations": [
    { "date": "2026-05-01", "value": 4.28 }
  ]
}
```

### Regime Score

The Phase 1 regime file is stable even before all buckets exist.

```json
{
  "date": "2026-05-01",
  "generated_at_utc": "2026-05-03T00:00:00Z",
  "overall_score": 8,
  "label": "Neutral",
  "buckets": {
    "volatility": 12,
    "rates": -8,
    "liquidity": 0,
    "credit": 18,
    "commodities": 0,
    "sentiment": 0
  },
  "top_supports": ["Credit spreads", "VIX level"],
  "top_risks": ["Treasury yield pressure"],
  "method_version": "phase-1.0"
}
```

### Data Status

`public/data/status/data_status.json` powers the freshness panel.

```json
{
  "last_successful_update_utc": "2026-05-03T00:00:00Z",
  "overall_status": "ok",
  "series": {
    "us10y": {
      "status": "ok",
      "last_observation": "2026-05-01",
      "source": "FRED",
      "expected_frequency": "daily",
      "freshness_days": 3
    }
  }
}
```

Allowed statuses are `ok`, `stale`, `partial`, and `failed`.

## Scoring Model

The score is an explanatory weather indicator, not a forecast.

- Range: `-100` to `+100`
- `+100`: very supportive market weather
- `0`: neutral or mixed
- `-100`: hostile market weather

Phase 1 bucket weights:

| Bucket | Weight | Phase 1 Status |
| --- | ---: | --- |
| Volatility | 20% | active |
| Rates | 15% | active |
| Liquidity | 20% | active |
| Credit | 20% | active |
| Commodities | 10% | fixed neutral value |
| Sentiment / positioning | 15% | fixed neutral value |

Initial scoring should use simple, documented heuristics:

- high VIX percentile is riskier; low VIX percentile is more supportive
- widening credit spreads are riskier; tightening spreads are more supportive
- sharply rising yields are a headwind; stable or falling yields are contextual
- liquidity metrics use conservative neutral scoring until the methodology is more mature

Labels allowed in Phase 1: `Supportive`, `Neutral`, `Mixed`, `Fragile`, `Stressed`, `Crowded`.

## Frontend Pages

### Overview `/`

Shows the overall weather score, bucket scores, top supports, top risks, recent update status, and a compact set of metric cards.

### Volatility `/volatility`

Shows VIX level, recent changes, percentile, source note, and a VIX history chart.

### Rates `/rates`

Shows US 2Y, 10Y, 20Y, 30Y, the derived 10Y-2Y spread, and a yield/rate trend view.

### Liquidity `/liquidity`

Shows Fed assets, reverse repo, Treasury General Account proxy, SOFR, source notes, and freshness status.

### Credit `/credit`

Shows high-yield OAS, investment-grade OAS, spread trend, percentile state, and divergence notes.

### Methodology `/methodology`

Explains data sources, update cadence, score formula, limitations, GitHub-only architecture, and the no-financial-advice disclaimer.

## Components

- `AppLayout`: top navigation, page shell, responsive content grid
- `MetricCard`: metric name, value, changes, percentile, state, last updated, source
- `RegimeBadge`: label and color mapping for score state
- `TimeSeriesChart`: reusable line chart from the static series contract
- `PercentileBandChart`: displays series value with percentile context when available
- `SourceNote`: source URL, cadence, and caveat
- `DataStatusTable`: status, last observation, expected cadence, and freshness

Charts should prioritize readability and stable layout over visual complexity.

## GitHub Actions

### `update-data.yml`

Triggers:

- scheduled weekday update
- manual `workflow_dispatch`

Responsibilities:

1. Check out the repo.
2. Set up Python.
3. Install `requirements.txt`.
4. Fetch public CSV data.
5. Normalize into `public/data/series`.
6. Compute derived files.
7. Validate schemas and freshness.
8. Commit `public/data` updates if files changed.

If validation fails after a fetch error, the workflow should preserve the last known good series files and update `data_status.json` to show `partial` or `failed` where possible.

### `deploy-pages.yml`

Triggers:

- push to the default branch
- manual `workflow_dispatch`

Responsibilities:

1. Check out the repo.
2. Set up Node.
3. Install dependencies.
4. Build the Vite app.
5. Upload the Pages artifact.
6. Deploy to GitHub Pages.

## Subagent Work Packages

### Agent 1: App Shell

Ownership:

- `package.json`
- `vite.config.ts`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/routes/*`
- `src/components/AppLayout.tsx`

Deliverables:

- Vite React TypeScript project
- Pages-safe routing
- top navigation
- route scaffolds wired to real component interfaces
- responsive research-dashboard layout

Dependencies:

- consumes TypeScript contracts from Agent 2 when available
- should not edit Python scripts or workflows

### Agent 2: Data Pipeline

Ownership:

- `requirements.txt`
- `scripts/ingest/*`
- `scripts/transform/normalize_series.py`
- `scripts/shared/*`
- `public/data/catalog/series_catalog.json`
- `public/data/series/*`

Deliverables:

- no-secret Cboe and FRED CSV fetchers
- normalized series JSON files
- reusable catalog-driven FRED fetch configuration
- local command that regenerates `public/data/series`

Dependencies:

- should emit the data contracts documented here
- should not edit React components

### Agent 3: Scoring and Validation

Ownership:

- `scripts/transform/compute_percentiles.py`
- `scripts/transform/compute_regime_score.py`
- `scripts/validate/*`
- `public/data/derived/*`
- `public/data/status/*`
- `src/lib/scoring.ts`

Deliverables:

- derived 10Y-2Y series
- percentile calculations
- bucket scores and overall weather score
- schema/freshness validation
- data health JSON

Dependencies:

- consumes normalized series from Agent 2
- should coordinate with Agent 4 on display fields

### Agent 4: Components and Charts

Ownership:

- `src/components/MetricCard.tsx`
- `src/components/RegimeBadge.tsx`
- `src/components/TimeSeriesChart.tsx`
- `src/components/PercentileBandChart.tsx`
- `src/components/SourceNote.tsx`
- `src/components/DataStatusTable.tsx`
- `src/lib/formatters.ts`
- chart-related styling

Deliverables:

- reusable data-driven cards and charts
- source notes and freshness table
- stable responsive chart dimensions
- empty/error/loading states for missing JSON

Dependencies:

- consumes types/loaders from Agent 2 and route composition from Agent 1
- should not change workflow files

### Agent 5: Workflows and Documentation

Ownership:

- `.github/workflows/update-data.yml`
- `.github/workflows/deploy-pages.yml`
- `README.md`
- `docs/DATA_SOURCES.md`
- `docs/METHODOLOGY.md`
- `docs/LIMITATIONS.md`

Deliverables:

- scheduled data update workflow
- Pages deploy workflow
- setup and deployment documentation
- methodology and limitations docs consistent with the app

Dependencies:

- coordinates commands with Agents 1-3
- should not modify UI components unless docs uncover a contract mismatch

### Agent 6: Integration QA

Ownership:

- no primary ownership; review and verification only

Deliverables:

- run Python data generation locally
- run validation
- run frontend build
- verify static JSON loads through the Vite build
- inspect route behavior
- report integration bugs with file references

Dependencies:

- starts after Agents 1-5 have produced their first integration pass
- may make small fixes only after identifying ownership and avoiding conflicts

## Error Handling

- Missing series files should show a visible page-level data error rather than crashing the app.
- Stale data should be labeled as stale with the last observation date.
- Failed fetches should not overwrite last known good data.
- Validation failures should fail the update workflow unless they can be represented as partial status without corrupting existing data.
- Frontend loaders should tolerate missing optional fields and reject malformed required fields.

## Testing and Verification

Minimum checks before Phase 1 is considered complete:

- `python scripts/ingest/fetch_cboe.py`
- `python scripts/ingest/fetch_fred_csv.py`
- `python scripts/transform/normalize_series.py`
- `python scripts/transform/compute_percentiles.py`
- `python scripts/transform/compute_regime_score.py`
- `python scripts/validate/validate_schema.py`
- `python scripts/validate/validate_freshness.py`
- `npm run build`
- verify that built app uses the GitHub Pages base path correctly
- verify that every route renders without live network calls to data providers

## Acceptance Criteria

- The repository contains a working Vite React TypeScript app.
- GitHub Actions can fetch public no-secret data and write static JSON.
- GitHub Actions can deploy the static app to GitHub Pages.
- The app renders overview, volatility, rates, liquidity, credit, and methodology pages.
- The app displays source, last observation, freshness, and status for each metric.
- The app includes a transparent initial weather score and bucket scores.
- The frontend has no market-data provider API calls.
- The app does not provide financial advice or trading instructions.
- Documentation explains sources, methodology, limitations, and deployment.

## Open Risks

- Public CSV endpoints can change shape or rate-limit automated requests.
- FRED graph CSV endpoints are convenient but are not as explicit as the API; Phase 2 can switch to API keys in GitHub Secrets if needed.
- Some liquidity interpretations are complex; Phase 1 should keep liquidity scoring conservative.
- GitHub Actions commits can trigger deploy workflows repeatedly; workflow conditions should avoid loops that update unchanged files.
- GitHub Pages project routing requires careful Vite base path configuration.
