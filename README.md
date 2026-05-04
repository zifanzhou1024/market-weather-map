# market-weather-map

market-weather-map is a GitHub Pages dashboard for reading broad market conditions as descriptive "weather." It combines delayed public market and macro series, static JSON artifacts, and transparent scoring so the app can be hosted without a backend or browser-side provider credentials.

## Current Scope

The current project includes:

- A Vite, React, and TypeScript frontend.
- GitHub Actions ingestion for public Cboe, FRED CSV, and CFTC historical compressed data.
- No-secret data collection from Cboe, FRED graph CSV endpoints, and CFTC public reports.
- Static JSON under `public/data` for the browser to read.
- A GitHub Pages deployment workflow.
- Source notes, freshness status, and descriptive scoring metadata in the generated data and UI.
- Phase 2 commodity, liquidity, and sentiment extensions.

The current project does not include:

- A backend service, database, or live market feed.
- Frontend API keys or browser-side calls to Cboe, FRED, or other data providers.
- Real-time data, paid data, or authenticated provider data.
- Financial advice, forecasts, or trade recommendations.

Phase 2 adds:

- Commodity coverage from no-secret FRED graph CSV endpoints.
- Public CFTC E-mini S&P 500 positioning data from historical compressed text reports.
- A derived net liquidity proxy and Brent-WTI spread.
- `/commodities` and `/sentiment` routes.
- A safe data update runner that preserves prior good JSON and surfaces failed update attempts in `data_status.json`.

Phase 3 direction:

- Expand from one descriptive weather score into three related score families: Market Weather, Macro Climate, and Fragility.
- Market Weather keeps the cross-asset market read across volatility, rates, liquidity, credit, commodities, and positioning.
- Macro Climate separates slower growth, labor, inflation, real-yield, and breakeven inputs from the market tape.
- Fragility focuses on stress channels that can amplify drawdowns, including credit spreads, financial conditions, dollar pressure, banking data, liquidity, and volatility.
- Preserve the no-backend GitHub Pages model by favoring active no-secret public inputs and documenting access status before sources enter the score.

## Data Access Status

Source access is tracked before data is treated as production scoring input.

| Status | Meaning | Examples |
| --- | --- | --- |
| `free_public` | Active no-secret public source that can be fetched in GitHub Actions and published as static JSON. | FRED graph CSV, Cboe historical VIX CSV, CFTC historical compressed reports. |
| `terms_review_needed` | Candidate source with useful coverage, but access terms, redistribution rules, cadence, or automation constraints must be reviewed before ingestion. | ISM, AAII, NAAIM, SLOOS, MOVE, put-call, NY Fed ACM. |
| `restricted_unavailable` | Restricted/unavailable source that is paid, gated, license-restricted, unavailable to the project, or not suitable for static public redistribution. | Authenticated feeds, licensed real-time data, vendor-only datasets. |

## Local Setup

Install Node and Python dependencies:

```bash
npm ci
python -m pip install -r requirements.txt
```

## Generate Data Locally

Fetch public source data, transform it, compute scores, and validate the output:

```bash
python -m scripts.update_data
```

`scripts.update_data` runs the full local data workflow: Cboe, FRED graph CSV, and CFTC public report ingestion; normalization; percentile enrichment; regime scoring; schema validation; and freshness validation. If a step fails, it restores the previous data snapshot and records the failed attempt in `public/data/status/data_status.json`.

`download_text` first requests data with the project user agent and retries provider-compatible behavior without that custom user agent if the project user-agent request times out.

For advanced debugging, lower-level modules can still be run directly:

```bash
python -m scripts.ingest.fetch_cboe
python -m scripts.ingest.fetch_fred_csv
python -m scripts.ingest.fetch_cftc
python -m scripts.transform.normalize_series
python -m scripts.transform.compute_percentiles
python -m scripts.transform.compute_regime_score
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

## Run The App

Start the Vite development server:

```bash
npm run dev
```

Build the static site:

```bash
npm run build
```

For a GitHub Pages-style build, set the Pages flag:

```bash
GITHUB_PAGES=true npm run build
```

## Deployment

The data workflow runs on weekdays and can also be started manually from GitHub Actions. It fetches public data, writes static JSON under `public/data`, validates schema and freshness, commits changed data files back to the repository, then builds and deploys the refreshed GitHub Pages artifact.

The Pages workflow runs on pushes to `main` and can also be started manually. It installs dependencies with `npm ci`, builds with `GITHUB_PAGES=true npm run build`, uploads `dist`, and deploys the static site to GitHub Pages.

## Documentation

- [Data sources](docs/DATA_SOURCES.md)
- [Methodology](docs/METHODOLOGY.md)
- [Limitations](docs/LIMITATIONS.md)
