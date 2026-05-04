# market-weather-map

market-weather-map is a GitHub Pages dashboard for reading broad market conditions as descriptive "weather." It combines delayed public market and macro series, static JSON artifacts, and transparent scoring so the app can be hosted without a backend or browser-side provider credentials.

## Phase 1

Phase 1 includes:

- A Vite, React, and TypeScript frontend.
- GitHub Actions ingestion for public Cboe and FRED CSV data.
- No-secret data collection from Cboe and FRED graph CSV endpoints.
- Static JSON under `public/data` for the browser to read.
- A GitHub Pages deployment workflow.
- Source notes, freshness status, and descriptive scoring metadata in the generated data and UI.

Phase 1 does not include:

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

## Local Setup

Install Node and Python dependencies:

```bash
npm ci
python -m pip install -r requirements.txt
```

## Generate Data Locally

Fetch public source data, transform it, compute scores, and validate the output:

```bash
python -m scripts.ingest.fetch_cboe
python -m scripts.ingest.fetch_fred_csv
python -m scripts.transform.normalize_series
python -m scripts.transform.compute_percentiles
python -m scripts.transform.compute_regime_score
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

`download_text` first requests data with the project user agent and retries provider-compatible behavior without that custom user agent if the project user-agent request times out.

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
