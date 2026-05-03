# Phase 1 GitHub-Native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `market-weather-map` as a GitHub Pages static app whose data is fetched, normalized, scored, validated, committed, and deployed entirely through GitHub Actions.

**Architecture:** Public no-secret CSV endpoints are fetched by Python scripts in GitHub Actions, normalized into static JSON under `public/data`, and consumed by a Vite React TypeScript frontend. GitHub Pages serves only static assets; the browser never calls market data providers directly.

**Tech Stack:** Vite, React, TypeScript, React Router, Recharts, Vitest, Python 3.11 standard library, pytest, GitHub Actions, GitHub Pages.

---

## Implementation Order

Use this order unless a lead agent explicitly coordinates parallel work:

1. Task 1 creates shared project scaffolding and data contracts.
2. Tasks 2 and 3 can run after Task 1.
3. Tasks 4 and 5 can run after Task 1; Task 5 integrates real data best after Tasks 2 and 3.
4. Task 6 can run after Tasks 1 through 3 define commands.
5. Task 7 runs after all earlier tasks.

Workers are not alone in the codebase. Do not revert edits made by other workers. Keep to the ownership listed for each task and coordinate if a required change crosses ownership.

## File Responsibility Map

### Project and Frontend

- `package.json`: npm scripts and frontend dependencies.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript compiler settings.
- `vite.config.ts`: Vite React config, GitHub Pages base path, test config.
- `index.html`: static app entry point.
- `src/main.tsx`: React bootstrapping.
- `src/App.tsx`: route definitions and app-level composition.
- `src/styles.css`: dashboard visual system and responsive layout.
- `src/routes/*.tsx`: route-level page composition.
- `src/components/*.tsx`: reusable UI and chart components.
- `src/lib/types.ts`: TypeScript data contracts matching `public/data`.
- `src/lib/data.ts`: static JSON loader using `import.meta.env.BASE_URL`.
- `src/lib/formatters.ts`: number, percent, date, and status formatting.
- `src/lib/scoring.ts`: frontend score helpers and badge labels.
- `src/lib/*.test.ts`: focused frontend unit tests.

### Data Pipeline

- `requirements.txt`: Python test dependency.
- `scripts/shared/catalog.py`: canonical source registry and freshness policy.
- `scripts/shared/io.py`: repository paths, JSON writing, provider-compatible CSV download and parsing helpers.
- `scripts/ingest/fetch_cboe.py`: fetches Cboe VIX CSV into `public/data/series/vix.json`.
- `scripts/ingest/fetch_fred_csv.py`: fetches configured FRED graph CSVs into `public/data/series/*.json`.
- `scripts/transform/normalize_series.py`: writes catalog and enforces sorted unique observations.
- `scripts/transform/compute_percentiles.py`: appends summary statistics to series files.
- `scripts/transform/compute_regime_score.py`: writes derived curve, bucket scores, regime score, and data status.
- `scripts/validate/validate_schema.py`: validates JSON shapes and required files.
- `scripts/validate/validate_freshness.py`: validates source-specific freshness windows.
- `tests/python/*.py`: unit tests for parsing, normalization, scoring, and validation.

### Static Data

- `public/data/catalog/series_catalog.json`: generated source catalog.
- `public/data/series/*.json`: generated chart-ready series.
- `public/data/derived/us10y_minus_us2y.json`: generated 10Y minus 2Y spread.
- `public/data/derived/bucket_scores.json`: generated bucket scoring file.
- `public/data/derived/regime_score.json`: generated overall weather score.
- `public/data/status/data_status.json`: generated health and freshness state.

### GitHub and Documentation

- `.github/workflows/update-data.yml`: scheduled and manual data update workflow.
- `.github/workflows/deploy-pages.yml`: static app build and GitHub Pages deployment workflow.
- `README.md`: local setup, workflow, and project summary.
- `docs/DATA_SOURCES.md`: source list and endpoint notes.
- `docs/METHODOLOGY.md`: scoring, freshness, and data contract explanation.
- `docs/LIMITATIONS.md`: no-financial-advice language and static-site constraints.

---

## Task 1: Project Scaffold and Shared Type Contracts

**Owner:** App shell worker

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/lib/types.ts`
- Create: `src/lib/data.ts`
- Create: `src/lib/formatters.ts`
- Create: `src/lib/scoring.ts`
- Create: `src/lib/formatters.test.ts`

- [ ] **Step 1: Create npm project metadata**

Create `package.json`:

```json
{
  "name": "market-weather-map",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build && cp dist/index.html dist/404.html",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-router-dom": "latest",
    "recharts": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "vitest": "latest",
    "jsdom": "latest"
  }
}
```

- [ ] **Step 2: Install frontend dependencies**

Run:

```bash
npm install
```

Expected: npm exits with status `0` and creates `package-lock.json`. If npm reports non-critical funding notices, continue. If it reports a dependency conflict, keep React, Vite, TypeScript, React Router, Recharts, and Vitest and resolve the version ranges in `package.json`.

- [ ] **Step 3: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "references": [
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Add Vite config with Pages-safe base**

Create `vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/market-weather-map/" : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

- [ ] **Step 5: Add static entry point**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="A static cross-asset dashboard for understanding equity market weather using delayed public data."
    />
    <title>Market Weather Map</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Define TypeScript data contracts**

Create `src/lib/types.ts`:

```ts
export type DataStatus = "ok" | "stale" | "partial" | "failed";

export type WeatherLabel =
  | "Supportive"
  | "Neutral"
  | "Mixed"
  | "Fragile"
  | "Stressed"
  | "Crowded";

export interface SeriesCatalogEntry {
  id: string;
  name: string;
  category: "volatility" | "rates" | "liquidity" | "credit" | "commodities" | "sentiment";
  source: string;
  source_url: string;
  endpoint_url?: string;
  frequency: "daily" | "weekly";
  units: string;
  higher_is: "supportive" | "riskier" | "contextual";
  public: boolean;
  max_stale_days: number;
  notes: string;
}

export interface Observation {
  date: string;
  value: number;
  percentile_252d?: number | null;
}

export interface SeriesSummary {
  latest_date: string;
  latest_value: number;
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  percentile_252d: number | null;
}

export interface TimeSeriesFile {
  series_id: string;
  generated_at_utc: string;
  source: string;
  source_url: string;
  frequency: "daily" | "weekly";
  units: string;
  summary?: SeriesSummary;
  observations: Observation[];
}

export interface DerivedSeriesFile extends TimeSeriesFile {
  depends_on: string[];
  method: string;
}

export interface BucketScoresFile {
  generated_at_utc: string;
  date: string;
  method_version: string;
  buckets: Record<string, number>;
  weights: Record<string, number>;
}

export interface RegimeScoreFile {
  date: string;
  generated_at_utc: string;
  overall_score: number;
  label: WeatherLabel;
  buckets: Record<string, number>;
  top_supports: string[];
  top_risks: string[];
  method_version: string;
}

export interface SeriesStatus {
  status: DataStatus;
  last_observation: string | null;
  source: string;
  expected_frequency: "daily" | "weekly";
  freshness_days: number | null;
  max_stale_days: number;
  message?: string;
}

export interface DataStatusFile {
  last_successful_update_utc: string | null;
  generated_at_utc: string;
  overall_status: DataStatus;
  series: Record<string, SeriesStatus>;
}
```

- [ ] **Step 7: Add static JSON loader**

Create `src/lib/data.ts`:

```ts
import type {
  BucketScoresFile,
  DataStatusFile,
  RegimeScoreFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "./types";

const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

export class DataLoadError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "DataLoadError";
  }
}

export async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    throw new DataLoadError(`Failed to load ${path}`, path, response.status);
  }

  return (await response.json()) as T;
}

export function loadCatalog(): Promise<SeriesCatalogEntry[]> {
  return loadJson<SeriesCatalogEntry[]>("/data/catalog/series_catalog.json");
}

export function loadSeries(seriesId: string): Promise<TimeSeriesFile> {
  return loadJson<TimeSeriesFile>(`/data/series/${seriesId}.json`);
}

export function loadRegimeScore(): Promise<RegimeScoreFile> {
  return loadJson<RegimeScoreFile>("/data/derived/regime_score.json");
}

export function loadBucketScores(): Promise<BucketScoresFile> {
  return loadJson<BucketScoresFile>("/data/derived/bucket_scores.json");
}

export function loadDataStatus(): Promise<DataStatusFile> {
  return loadJson<DataStatusFile>("/data/status/data_status.json");
}
```

- [ ] **Step 8: Add formatting helpers and test**

Create `src/lib/formatters.ts`:

```ts
import type { DataStatus } from "./types";

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function formatPercentile(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${Math.round(value)}%`;
}

export function formatSigned(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  return value;
}

export function statusLabel(status: DataStatus): string {
  const labels: Record<DataStatus, string> = {
    ok: "OK",
    stale: "Stale",
    partial: "Partial",
    failed: "Failed"
  };
  return labels[status];
}
```

Create `src/lib/formatters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatNumber, formatPercentile, formatSigned, statusLabel } from "./formatters";

describe("formatters", () => {
  it("formats numeric values with fixed precision", () => {
    expect(formatNumber(4.268, 2)).toBe("4.27");
  });

  it("formats unavailable numbers as N/A", () => {
    expect(formatNumber(null)).toBe("N/A");
    expect(formatPercentile(undefined)).toBe("N/A");
  });

  it("formats signed values with a plus sign for positive changes", () => {
    expect(formatSigned(0.125, 2)).toBe("+0.13");
    expect(formatSigned(-0.125, 2)).toBe("-0.13");
  });

  it("maps machine status to readable labels", () => {
    expect(statusLabel("partial")).toBe("Partial");
  });
});
```

- [ ] **Step 9: Add score label helper**

Create `src/lib/scoring.ts`:

```ts
import type { WeatherLabel } from "./types";

export function labelForScore(score: number): WeatherLabel {
  if (score <= -50) return "Stressed";
  if (score <= -20) return "Fragile";
  if (score < 20) return "Neutral";
  if (score < 50) return "Supportive";
  return "Supportive";
}

export function scoreTone(score: number): "positive" | "neutral" | "warning" | "negative" {
  if (score <= -50) return "negative";
  if (score <= -20) return "warning";
  if (score < 20) return "neutral";
  return "positive";
}
```

- [ ] **Step 10: Add React bootstrapping**

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<main className="page-shell">Overview loading...</main>} />
      <Route path="/volatility" element={<main className="page-shell">Volatility loading...</main>} />
      <Route path="/rates" element={<main className="page-shell">Rates loading...</main>} />
      <Route path="/liquidity" element={<main className="page-shell">Liquidity loading...</main>} />
      <Route path="/credit" element={<main className="page-shell">Credit loading...</main>} />
      <Route path="/methodology" element={<main className="page-shell">Methodology loading...</main>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color: #17201a;
  background: #f6f7f3;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #f6f7f3;
}

a {
  color: inherit;
}

button,
input,
select {
  font: inherit;
}

.page-shell {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 32px 0;
}
```

- [ ] **Step 11: Verify scaffold**

Run:

```bash
npm test
npm run build
```

Expected:

```text
Test Files  1 passed
✓ built in
```

- [ ] **Step 12: Commit scaffold**

Run:

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src
git commit -m "feat: scaffold static React app"
```

---

## Task 2: Public Data Fetchers and Series Generation

**Owner:** Data pipeline worker

**Files:**
- Create: `requirements.txt`
- Create: `scripts/__init__.py`
- Create: `scripts/ingest/__init__.py`
- Create: `scripts/shared/__init__.py`
- Create: `scripts/transform/__init__.py`
- Create: `scripts/validate/__init__.py`
- Create: `scripts/shared/catalog.py`
- Create: `scripts/shared/io.py`
- Create: `scripts/ingest/fetch_cboe.py`
- Create: `scripts/ingest/fetch_fred_csv.py`
- Create: `scripts/transform/normalize_series.py`
- Create: `tests/python/test_io.py`
- Generate: `public/data/catalog/series_catalog.json`
- Generate: `public/data/series/*.json`

- [ ] **Step 1: Add Python test dependency**

Create `requirements.txt`:

```text
pytest>=8,<9
```

- [ ] **Step 2: Add Python package markers**

Create these files with no content:

```text
scripts/__init__.py
scripts/ingest/__init__.py
scripts/shared/__init__.py
scripts/transform/__init__.py
scripts/validate/__init__.py
```

- [ ] **Step 3: Add source catalog**

Create `scripts/shared/catalog.py`:

```python
from __future__ import annotations

CBOE_VIX = {
    "id": "vix",
    "name": "Cboe Volatility Index",
    "category": "volatility",
    "source": "Cboe",
    "source_url": "https://www.cboe.com/tradable_products/vix/vix_historical_data/",
    "endpoint_url": "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv",
    "frequency": "daily",
    "units": "index",
    "higher_is": "riskier",
    "public": True,
    "max_stale_days": 7,
    "notes": "Fetched from Cboe public VIX historical CSV."
}

FRED_SERIES = [
    {
        "id": "us2y",
        "fred_id": "DGS2",
        "name": "U.S. 2-Year Treasury Yield",
        "category": "rates",
        "units": "percent",
        "higher_is": "contextual",
        "frequency": "daily",
        "max_stale_days": 7,
        "notes": "Fetched from FRED graph CSV without an API key."
    },
    {
        "id": "us10y",
        "fred_id": "DGS10",
        "name": "U.S. 10-Year Treasury Yield",
        "category": "rates",
        "units": "percent",
        "higher_is": "contextual",
        "frequency": "daily",
        "max_stale_days": 7,
        "notes": "Fetched from FRED graph CSV without an API key."
    },
    {
        "id": "us20y",
        "fred_id": "DGS20",
        "name": "U.S. 20-Year Treasury Yield",
        "category": "rates",
        "units": "percent",
        "higher_is": "contextual",
        "frequency": "daily",
        "max_stale_days": 7,
        "notes": "Fetched from FRED graph CSV without an API key."
    },
    {
        "id": "us30y",
        "fred_id": "DGS30",
        "name": "U.S. 30-Year Treasury Yield",
        "category": "rates",
        "units": "percent",
        "higher_is": "contextual",
        "frequency": "daily",
        "max_stale_days": 7,
        "notes": "Fetched from FRED graph CSV without an API key."
    },
    {
        "id": "fed_assets",
        "fred_id": "WALCL",
        "name": "Federal Reserve Total Assets",
        "category": "liquidity",
        "units": "millions_usd",
        "higher_is": "contextual",
        "frequency": "weekly",
        "max_stale_days": 14,
        "notes": "H.4.1 balance sheet series from FRED graph CSV."
    },
    {
        "id": "reverse_repo",
        "fred_id": "RRPONTSYD",
        "name": "Overnight Reverse Repurchase Agreements",
        "category": "liquidity",
        "units": "billions_usd",
        "higher_is": "contextual",
        "frequency": "daily",
        "max_stale_days": 7,
        "notes": "Fetched from FRED graph CSV without an API key."
    },
    {
        "id": "treasury_general_account",
        "fred_id": "WTREGEN",
        "name": "Treasury General Account",
        "category": "liquidity",
        "units": "millions_usd",
        "higher_is": "contextual",
        "frequency": "weekly",
        "max_stale_days": 14,
        "notes": "Treasury General Account series from FRED graph CSV."
    },
    {
        "id": "sofr",
        "fred_id": "SOFR",
        "name": "Secured Overnight Financing Rate",
        "category": "liquidity",
        "units": "percent",
        "higher_is": "contextual",
        "frequency": "daily",
        "max_stale_days": 7,
        "notes": "Fetched from FRED graph CSV without an API key."
    },
    {
        "id": "high_yield_oas",
        "fred_id": "BAMLH0A0HYM2",
        "name": "ICE BofA U.S. High Yield OAS",
        "category": "credit",
        "units": "percent",
        "higher_is": "riskier",
        "frequency": "daily",
        "max_stale_days": 7,
        "notes": "Fetched from FRED graph CSV without an API key."
    },
    {
        "id": "investment_grade_oas",
        "fred_id": "BAMLC0A0CM",
        "name": "ICE BofA U.S. Corporate OAS",
        "category": "credit",
        "units": "percent",
        "higher_is": "riskier",
        "frequency": "daily",
        "max_stale_days": 7,
        "notes": "Fetched from FRED graph CSV without an API key."
    }
]


def fred_endpoint(fred_id: str) -> str:
    return f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fred_id}"


def catalog_entries() -> list[dict]:
    entries = [dict(CBOE_VIX)]
    for item in FRED_SERIES:
        entry = {
            "id": item["id"],
            "name": item["name"],
            "category": item["category"],
            "source": "FRED",
            "source_url": f"https://fred.stlouisfed.org/series/{item['fred_id']}",
            "endpoint_url": fred_endpoint(item["fred_id"]),
            "frequency": item["frequency"],
            "units": item["units"],
            "higher_is": item["higher_is"],
            "public": True,
            "max_stale_days": item["max_stale_days"],
            "notes": item["notes"],
        }
        entries.append(entry)
    return entries
```

- [ ] **Step 4: Add shared IO helpers and tests**

Create `scripts/shared/io.py`:

```python
from __future__ import annotations

import csv
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def data_dir() -> Path:
    return repo_root() / "public" / "data"


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=False)
        handle.write("\n")
        temp_path = Path(handle.name)
    temp_path.replace(path)


def download_text(url: str) -> str:
    requests = [
        Request(url, headers={"User-Agent": "market-weather-map/0.1"}),
        Request(url),
    ]
    last_error: TimeoutError | None = None
    for request in requests:
        try:
            with urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8-sig")
        except TimeoutError as error:
            last_error = error
    if last_error is not None:
        raise last_error
    raise RuntimeError("download failed without an exception")


def parse_float(value: str) -> float | None:
    clean = value.strip()
    if clean in {"", ".", "NA", "N/A"}:
        return None
    return float(clean)


def parse_csv_rows(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(text.splitlines()))


def series_path(series_id: str) -> Path:
    return data_dir() / "series" / f"{series_id}.json"
```

Create `tests/python/test_io.py`:

```python
from scripts.shared.io import parse_csv_rows, parse_float


def test_parse_float_handles_missing_values():
    assert parse_float("") is None
    assert parse_float(".") is None
    assert parse_float("4.25") == 4.25


def test_parse_csv_rows_handles_header_and_rows():
    rows = parse_csv_rows("observation_date,DGS10\n2026-05-01,4.28\n")
    assert rows == [{"observation_date": "2026-05-01", "DGS10": "4.28"}]


def test_download_text_retries_with_provider_compatible_request_after_timeout(monkeypatch):
    import scripts.shared.io as io
    from scripts.shared.io import download_text

    attempts = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def read(self):
            return b"ok"

    def fake_urlopen(request, timeout):
        attempts.append((request.get_header("User-agent"), timeout))
        if len(attempts) == 1:
            raise TimeoutError("timed out")
        return FakeResponse()

    monkeypatch.setattr(io, "urlopen", fake_urlopen)

    assert download_text("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2") == "ok"
    assert attempts == [
        ("market-weather-map/0.1", 30),
        (None, 30),
    ]
```

- [ ] **Step 5: Add Cboe VIX fetcher**

Create `scripts/ingest/fetch_cboe.py`:

```python
from __future__ import annotations

from scripts.shared.catalog import CBOE_VIX
from scripts.shared.io import download_text, parse_csv_rows, parse_float, series_path, utc_now_iso, write_json


def normalize_vix_rows(text: str, generated_at: str) -> dict:
    observations = []
    for row in parse_csv_rows(text):
        date = row.get("DATE") or row.get("Date") or row.get("date")
        close = row.get("CLOSE") or row.get("Close") or row.get("close")
        if not date or close is None:
            continue
        value = parse_float(close)
        if value is None:
            continue
        observations.append({"date": date, "value": value})

    observations.sort(key=lambda item: item["date"])

    return {
        "series_id": CBOE_VIX["id"],
        "generated_at_utc": generated_at,
        "source": CBOE_VIX["source"],
        "source_url": CBOE_VIX["source_url"],
        "frequency": CBOE_VIX["frequency"],
        "units": CBOE_VIX["units"],
        "observations": observations,
    }


def main() -> None:
    generated_at = utc_now_iso()
    text = download_text(CBOE_VIX["endpoint_url"])
    payload = normalize_vix_rows(text, generated_at)
    write_json(series_path(CBOE_VIX["id"]), payload)


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Add FRED CSV fetcher**

Create `scripts/ingest/fetch_fred_csv.py`:

```python
from __future__ import annotations

from scripts.shared.catalog import FRED_SERIES, fred_endpoint
from scripts.shared.io import download_text, parse_csv_rows, parse_float, series_path, utc_now_iso, write_json


def normalize_fred_rows(series: dict, text: str, generated_at: str) -> dict:
    observations = []
    fred_id = series["fred_id"]

    for row in parse_csv_rows(text):
        date = row.get("observation_date")
        raw_value = row.get(fred_id)
        if not date or raw_value is None:
            continue
        value = parse_float(raw_value)
        if value is None:
            continue
        observations.append({"date": date, "value": value})

    observations.sort(key=lambda item: item["date"])

    return {
        "series_id": series["id"],
        "generated_at_utc": generated_at,
        "source": "FRED",
        "source_url": f"https://fred.stlouisfed.org/series/{fred_id}",
        "frequency": series["frequency"],
        "units": series["units"],
        "observations": observations,
    }


def main() -> None:
    generated_at = utc_now_iso()
    for series in FRED_SERIES:
        text = download_text(fred_endpoint(series["fred_id"]))
        payload = normalize_fred_rows(series, text, generated_at)
        write_json(series_path(series["id"]), payload)


if __name__ == "__main__":
    main()
```

- [ ] **Step 7: Add catalog writer and normalization pass**

Create `scripts/transform/normalize_series.py`:

```python
from __future__ import annotations

import json

from scripts.shared.catalog import catalog_entries
from scripts.shared.io import data_dir, series_path, write_json


def normalize_observations(observations: list[dict]) -> list[dict]:
    by_date: dict[str, float] = {}
    for item in observations:
        by_date[item["date"]] = float(item["value"])
    return [{"date": date, "value": by_date[date]} for date in sorted(by_date)]


def normalize_file(series_id: str) -> None:
    path = series_path(series_id)
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["observations"] = normalize_observations(payload["observations"])
    write_json(path, payload)


def main() -> None:
    entries = catalog_entries()
    write_json(data_dir() / "catalog" / "series_catalog.json", entries)
    for entry in entries:
        if series_path(entry["id"]).exists():
            normalize_file(entry["id"])


if __name__ == "__main__":
    main()
```

- [ ] **Step 8: Run fetchers and tests**

Run:

```bash
python -m pip install -r requirements.txt
python -m pytest tests/python/test_io.py -v
python -m scripts.ingest.fetch_cboe
python -m scripts.ingest.fetch_fred_csv
python -m scripts.transform.normalize_series
```

Expected:

```text
2 passed
```

Expected files:

```text
public/data/catalog/series_catalog.json
public/data/series/vix.json
public/data/series/us2y.json
public/data/series/us10y.json
public/data/series/us20y.json
public/data/series/us30y.json
public/data/series/fed_assets.json
public/data/series/reverse_repo.json
public/data/series/treasury_general_account.json
public/data/series/sofr.json
public/data/series/high_yield_oas.json
public/data/series/investment_grade_oas.json
```

- [ ] **Step 9: Commit data pipeline**

Run:

```bash
git add requirements.txt scripts tests public/data/catalog public/data/series
git commit -m "feat: fetch public market data"
```

---

## Task 3: Derived Metrics, Scoring, Status, and Validation

**Owner:** scoring and validation worker

**Files:**
- Create: `scripts/transform/compute_percentiles.py`
- Create: `scripts/transform/compute_regime_score.py`
- Create: `scripts/validate/validate_schema.py`
- Create: `scripts/validate/validate_freshness.py`
- Create: `tests/python/test_scoring.py`
- Generate: `public/data/derived/us10y_minus_us2y.json`
- Generate: `public/data/derived/bucket_scores.json`
- Generate: `public/data/derived/regime_score.json`
- Generate: `public/data/status/data_status.json`

- [ ] **Step 1: Add scoring tests**

Create `tests/python/test_scoring.py`:

```python
from scripts.transform.compute_percentiles import percentile_rank, series_summary
from scripts.transform.compute_regime_score import clamp, weighted_score


def test_percentile_rank_uses_zero_to_one_hundred_scale():
    assert percentile_rank([1, 2, 3, 4], 3) == 75.0


def test_series_summary_calculates_changes():
    observations = [
        {"date": "2026-04-01", "value": 10.0},
        {"date": "2026-04-02", "value": 12.0},
        {"date": "2026-04-03", "value": 13.0},
        {"date": "2026-04-06", "value": 14.0},
        {"date": "2026-04-07", "value": 15.0},
        {"date": "2026-04-08", "value": 20.0},
    ]
    summary = series_summary(observations)
    assert summary["latest_value"] == 20.0
    assert summary["change_1d"] == 5.0
    assert summary["change_1w"] == 10.0


def test_clamp_limits_scores_to_contract_range():
    assert clamp(150) == 100
    assert clamp(-125) == -100
    assert clamp(12) == 12


def test_weighted_score_combines_bucket_values():
    assert weighted_score({"a": 50, "b": -50}, {"a": 0.25, "b": 0.75}) == -25
```

- [ ] **Step 2: Add percentile and summary computation**

Create `scripts/transform/compute_percentiles.py`:

```python
from __future__ import annotations

import json

from scripts.shared.io import data_dir, write_json


def percentile_rank(values: list[float], value: float) -> float:
    if not values:
        return 0.0
    count = sum(1 for item in values if item <= value)
    return round((count / len(values)) * 100, 2)


def change_from_index(observations: list[dict], offset: int) -> float | None:
    if len(observations) <= offset:
        return None
    return round(observations[-1]["value"] - observations[-1 - offset]["value"], 6)


def series_summary(observations: list[dict]) -> dict:
    latest = observations[-1]
    window = observations[-252:]
    percentile = percentile_rank([item["value"] for item in window], latest["value"]) if len(window) >= 20 else None
    return {
        "latest_date": latest["date"],
        "latest_value": latest["value"],
        "change_1d": change_from_index(observations, 1),
        "change_1w": change_from_index(observations, 5),
        "change_1m": change_from_index(observations, 21),
        "percentile_252d": percentile,
    }


def enrich_file(path) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    observations = payload["observations"]
    values = [item["value"] for item in observations]
    enriched = []
    for index, item in enumerate(observations):
        window = values[max(0, index - 251): index + 1]
        percentile = percentile_rank(window, item["value"]) if len(window) >= 20 else None
        enriched.append({**item, "percentile_252d": percentile})
    payload["observations"] = enriched
    payload["summary"] = series_summary(enriched)
    write_json(path, payload)


def main() -> None:
    for path in sorted((data_dir() / "series").glob("*.json")):
        enrich_file(path)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Add derived score computation**

Create `scripts/transform/compute_regime_score.py`:

```python
from __future__ import annotations

import json
from datetime import datetime, timezone

from scripts.shared.catalog import catalog_entries
from scripts.shared.io import data_dir, write_json


WEIGHTS = {
    "volatility": 0.20,
    "rates": 0.15,
    "liquidity": 0.20,
    "credit": 0.20,
    "commodities": 0.10,
    "sentiment": 0.15,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clamp(value: float) -> int:
    return int(round(max(-100, min(100, value))))


def weighted_score(buckets: dict[str, int], weights: dict[str, float]) -> int:
    return clamp(sum(buckets[key] * weights[key] for key in weights))


def load_series(series_id: str) -> dict:
    return json.loads((data_dir() / "series" / f"{series_id}.json").read_text(encoding="utf-8"))


def latest_summary(series_id: str) -> dict:
    return load_series(series_id)["summary"]


def score_inverse_percentile(percentile: float | None) -> int:
    if percentile is None:
        return 0
    return clamp(50 - percentile)


def score_credit() -> int:
    hy = latest_summary("high_yield_oas")
    ig = latest_summary("investment_grade_oas")
    hy_score = score_inverse_percentile(hy["percentile_252d"])
    ig_score = score_inverse_percentile(ig["percentile_252d"])
    return clamp((hy_score * 0.65) + (ig_score * 0.35))


def score_volatility() -> int:
    vix = latest_summary("vix")
    return score_inverse_percentile(vix["percentile_252d"])


def score_rates() -> int:
    us10y = latest_summary("us10y")
    monthly_change = us10y["change_1m"] or 0
    return clamp(-monthly_change * 35)


def score_liquidity() -> int:
    fed_assets = latest_summary("fed_assets")
    reverse_repo = latest_summary("reverse_repo")
    fed_change = fed_assets["change_1m"] or 0
    rrp_change = reverse_repo["change_1m"] or 0
    scaled = (fed_change / 25000) - (rrp_change / 250)
    return clamp(scaled)


def build_curve(generated_at: str) -> dict:
    us2y = load_series("us2y")["observations"]
    us10y = load_series("us10y")["observations"]
    values_2y = {item["date"]: item["value"] for item in us2y}
    observations = []
    for item in us10y:
        date = item["date"]
        if date in values_2y:
            observations.append({"date": date, "value": round(item["value"] - values_2y[date], 6)})

    return {
        "series_id": "us10y_minus_us2y",
        "generated_at_utc": generated_at,
        "source": "Derived",
        "source_url": "https://fred.stlouisfed.org/series/DGS10",
        "frequency": "daily",
        "units": "percentage_points",
        "depends_on": ["us10y", "us2y"],
        "method": "us10y - us2y by matching observation date",
        "observations": observations,
    }


def label_for_score(score: int) -> str:
    if score <= -50:
        return "Stressed"
    if score <= -20:
        return "Fragile"
    if score < 20:
        return "Neutral"
    return "Supportive"


def build_status(generated_at: str) -> dict:
    entries = {entry["id"]: entry for entry in catalog_entries()}
    series_status = {}
    for series_id, entry in entries.items():
        payload = load_series(series_id)
        latest = payload["summary"]["latest_date"] if payload.get("summary") else payload["observations"][-1]["date"]
        latest_date = datetime.fromisoformat(latest)
        generated_date = datetime.fromisoformat(generated_at.replace("Z", "+00:00")).date()
        freshness_days = (generated_date - latest_date.date()).days
        status = "ok" if freshness_days <= entry["max_stale_days"] else "stale"
        series_status[series_id] = {
            "status": status,
            "last_observation": latest,
            "source": entry["source"],
            "expected_frequency": entry["frequency"],
            "freshness_days": freshness_days,
            "max_stale_days": entry["max_stale_days"],
        }

    overall = "ok" if all(item["status"] == "ok" for item in series_status.values()) else "partial"
    return {
        "last_successful_update_utc": generated_at,
        "generated_at_utc": generated_at,
        "overall_status": overall,
        "series": series_status,
    }


def main() -> None:
    generated_at = now_iso()
    curve = build_curve(generated_at)
    write_json(data_dir() / "derived" / "us10y_minus_us2y.json", curve)

    buckets = {
        "volatility": score_volatility(),
        "rates": score_rates(),
        "liquidity": score_liquidity(),
        "credit": score_credit(),
        "commodities": 0,
        "sentiment": 0,
    }
    overall = weighted_score(buckets, WEIGHTS)
    date = latest_summary("vix")["latest_date"]

    write_json(data_dir() / "derived" / "bucket_scores.json", {
        "generated_at_utc": generated_at,
        "date": date,
        "method_version": "phase-1.0",
        "buckets": buckets,
        "weights": WEIGHTS,
    })

    sorted_buckets = sorted(buckets.items(), key=lambda item: item[1])
    write_json(data_dir() / "derived" / "regime_score.json", {
        "date": date,
        "generated_at_utc": generated_at,
        "overall_score": overall,
        "label": label_for_score(overall),
        "buckets": buckets,
        "top_supports": [name.replace("_", " ").title() for name, value in reversed(sorted_buckets) if value > 0][:3],
        "top_risks": [name.replace("_", " ").title() for name, value in sorted_buckets if value < 0][:3],
        "method_version": "phase-1.0",
    })

    write_json(data_dir() / "status" / "data_status.json", build_status(generated_at))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Add schema validation**

Create `scripts/validate/validate_schema.py`:

```python
from __future__ import annotations

import json
from datetime import date

from scripts.shared.catalog import catalog_entries
from scripts.shared.io import data_dir


def assert_date(value: str) -> None:
    parsed = date.fromisoformat(value)
    if parsed > date.today():
        raise AssertionError(f"future-dated observation: {value}")


def validate_series(series_id: str) -> None:
    path = data_dir() / "series" / f"{series_id}.json"
    if not path.exists():
        raise AssertionError(f"missing series file: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    required = ["series_id", "generated_at_utc", "source", "source_url", "frequency", "units", "observations"]
    for key in required:
        if key not in payload:
            raise AssertionError(f"{series_id} missing {key}")
    if payload["series_id"] != series_id:
        raise AssertionError(f"{series_id} has mismatched series_id {payload['series_id']}")
    seen = set()
    previous = ""
    for observation in payload["observations"]:
        obs_date = observation["date"]
        assert_date(obs_date)
        if obs_date in seen:
            raise AssertionError(f"{series_id} duplicate date {obs_date}")
        if previous and obs_date < previous:
            raise AssertionError(f"{series_id} observations are not sorted")
        if not isinstance(observation["value"], (int, float)):
            raise AssertionError(f"{series_id} non-numeric value on {obs_date}")
        seen.add(obs_date)
        previous = obs_date


def validate_json_file(path) -> None:
    if not path.exists():
        raise AssertionError(f"missing required file: {path}")
    json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    for entry in catalog_entries():
        validate_series(entry["id"])
    validate_json_file(data_dir() / "catalog" / "series_catalog.json")
    validate_json_file(data_dir() / "derived" / "us10y_minus_us2y.json")
    validate_json_file(data_dir() / "derived" / "bucket_scores.json")
    validate_json_file(data_dir() / "derived" / "regime_score.json")
    validate_json_file(data_dir() / "status" / "data_status.json")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Add freshness validation**

Create `scripts/validate/validate_freshness.py`:

```python
from __future__ import annotations

import json

from scripts.shared.io import data_dir


def main() -> None:
    status_path = data_dir() / "status" / "data_status.json"
    payload = json.loads(status_path.read_text(encoding="utf-8"))
    failures = []
    for series_id, item in payload["series"].items():
        if item["status"] == "failed":
            failures.append(f"{series_id}: failed")
        if item["freshness_days"] is not None and item["freshness_days"] > item["max_stale_days"]:
            failures.append(f"{series_id}: stale by {item['freshness_days']} days")
    if failures:
        raise SystemExit("\n".join(failures))


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run scoring and validation**

Run:

```bash
python -m pytest tests/python/test_scoring.py -v
python -m scripts.transform.compute_percentiles
python -m scripts.transform.compute_regime_score
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

Expected:

```text
4 passed
```

Expected generated files:

```text
public/data/derived/us10y_minus_us2y.json
public/data/derived/bucket_scores.json
public/data/derived/regime_score.json
public/data/status/data_status.json
```

- [ ] **Step 7: Commit scoring and validation**

Run:

```bash
git add scripts/transform scripts/validate tests/python public/data/derived public/data/status public/data/series
git commit -m "feat: compute market weather scores"
```

---

## Task 4: Layout, Navigation, and Route Composition

**Owner:** app shell worker

**Files:**
- Create: `src/components/AppLayout.tsx`
- Create: `src/routes/Overview.tsx`
- Create: `src/routes/Volatility.tsx`
- Create: `src/routes/Rates.tsx`
- Create: `src/routes/Liquidity.tsx`
- Create: `src/routes/Credit.tsx`
- Create: `src/routes/Methodology.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add app layout**

Create `src/components/AppLayout.tsx`:

```tsx
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/volatility", label: "Volatility" },
  { to: "/rates", label: "Rates" },
  { to: "/liquidity", label: "Liquidity" },
  { to: "/credit", label: "Credit" },
  { to: "/methodology", label: "Methodology" }
];

export default function AppLayout() {
  return (
    <div className="app">
      <header className="site-header">
        <div>
          <p className="eyebrow">Delayed public data</p>
          <h1>Market Weather Map</h1>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
```

- [ ] **Step 2: Add route page modules**

Create `src/routes/Overview.tsx`:

```tsx
export default function Overview() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Market weather</p>
        <h2>Overview</h2>
        <p>Cross-asset conditions summarized from static JSON generated by GitHub Actions.</p>
      </section>
    </main>
  );
}
```

Create `src/routes/Volatility.tsx`:

```tsx
export default function Volatility() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Volatility</p>
        <h2>VIX state</h2>
        <p>Delayed Cboe VIX history with percentile context.</p>
      </section>
    </main>
  );
}
```

Create `src/routes/Rates.tsx`:

```tsx
export default function Rates() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Rates</p>
        <h2>Treasury curve</h2>
        <p>U.S. Treasury yields and the 10Y minus 2Y curve spread.</p>
      </section>
    </main>
  );
}
```

Create `src/routes/Liquidity.tsx`:

```tsx
export default function Liquidity() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Liquidity</p>
        <h2>Funding and balance sheet</h2>
        <p>Fed assets, reverse repo, Treasury General Account, and SOFR.</p>
      </section>
    </main>
  );
}
```

Create `src/routes/Credit.tsx`:

```tsx
export default function Credit() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Credit</p>
        <h2>Credit spreads</h2>
        <p>High-yield and investment-grade option-adjusted spreads.</p>
      </section>
    </main>
  );
}
```

Create `src/routes/Methodology.tsx`:

```tsx
export default function Methodology() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Methodology</p>
        <h2>How the map works</h2>
        <p>This static site explains market regimes. It does not provide financial advice.</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Wire routes through layout**

Replace `src/App.tsx` with:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Credit from "./routes/Credit";
import Liquidity from "./routes/Liquidity";
import Methodology from "./routes/Methodology";
import Overview from "./routes/Overview";
import Rates from "./routes/Rates";
import Volatility from "./routes/Volatility";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/volatility" element={<Volatility />} />
        <Route path="/rates" element={<Rates />} />
        <Route path="/liquidity" element={<Liquidity />} />
        <Route path="/credit" element={<Credit />} />
        <Route path="/methodology" element={<Methodology />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Add layout styles**

Append to `src/styles.css`:

```css
.app {
  min-height: 100vh;
}

.site-header {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 24px 0 12px;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto;
  gap: 24px;
  align-items: end;
  border-bottom: 1px solid #d9ded2;
}

.site-header h1,
.page-heading h2 {
  margin: 0;
  letter-spacing: 0;
}

.site-header h1 {
  font-size: clamp(1.8rem, 2.4vw, 2.6rem);
}

.eyebrow {
  margin: 0 0 6px;
  color: #607066;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.site-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.nav-link {
  padding: 9px 12px;
  border: 1px solid #d7ded1;
  border-radius: 8px;
  color: #344238;
  text-decoration: none;
  background: #fffef9;
}

.nav-link.active {
  border-color: #31483a;
  color: #ffffff;
  background: #31483a;
}

.page-heading {
  margin-bottom: 24px;
}

.page-heading h2 {
  font-size: clamp(1.6rem, 2.3vw, 2.4rem);
}

.page-heading p:last-child {
  max-width: 760px;
  color: #536157;
}

@media (max-width: 760px) {
  .site-header {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .site-nav {
    justify-content: flex-start;
  }
}
```

- [ ] **Step 5: Verify routing build**

Run:

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 6: Commit routes and layout**

Run:

```bash
git add src/App.tsx src/components/AppLayout.tsx src/routes src/styles.css
git commit -m "feat: add dashboard routes"
```

---

## Task 5: Data-Driven UI Components and Pages

**Owner:** components and charts worker

**Files:**
- Create: `src/components/MetricCard.tsx`
- Create: `src/components/RegimeBadge.tsx`
- Create: `src/components/TimeSeriesChart.tsx`
- Create: `src/components/PercentileBandChart.tsx`
- Create: `src/components/SourceNote.tsx`
- Create: `src/components/DataStatusTable.tsx`
- Modify: `src/routes/Overview.tsx`
- Modify: `src/routes/Volatility.tsx`
- Modify: `src/routes/Rates.tsx`
- Modify: `src/routes/Liquidity.tsx`
- Modify: `src/routes/Credit.tsx`
- Modify: `src/routes/Methodology.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add regime badge**

Create `src/components/RegimeBadge.tsx`:

```tsx
import { scoreTone } from "../lib/scoring";
import type { WeatherLabel } from "../lib/types";

interface RegimeBadgeProps {
  label: WeatherLabel;
  score?: number;
}

export default function RegimeBadge({ label, score }: RegimeBadgeProps) {
  const tone = score === undefined ? "neutral" : scoreTone(score);
  return (
    <span className={`regime-badge ${tone}`}>
      {label}
      {score !== undefined ? ` ${score}` : ""}
    </span>
  );
}
```

- [ ] **Step 2: Add metric card**

Create `src/components/MetricCard.tsx`:

```tsx
import { formatDate, formatNumber, formatPercentile, formatSigned } from "../lib/formatters";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

interface MetricCardProps {
  series: TimeSeriesFile;
  catalog?: SeriesCatalogEntry;
}

export default function MetricCard({ series, catalog }: MetricCardProps) {
  const summary = series.summary;
  return (
    <article className="metric-card">
      <div>
        <p className="metric-source">{series.source}</p>
        <h3>{catalog?.name ?? series.series_id}</h3>
      </div>
      <p className="metric-value">
        {formatNumber(summary?.latest_value)}
        <span>{series.units}</span>
      </p>
      <dl className="metric-grid">
        <div>
          <dt>1D</dt>
          <dd>{formatSigned(summary?.change_1d)}</dd>
        </div>
        <div>
          <dt>1W</dt>
          <dd>{formatSigned(summary?.change_1w)}</dd>
        </div>
        <div>
          <dt>1M</dt>
          <dd>{formatSigned(summary?.change_1m)}</dd>
        </div>
        <div>
          <dt>Percentile</dt>
          <dd>{formatPercentile(summary?.percentile_252d)}</dd>
        </div>
      </dl>
      <footer>Last observation: {formatDate(summary?.latest_date)}</footer>
    </article>
  );
}
```

- [ ] **Step 3: Add chart components**

Create `src/components/TimeSeriesChart.tsx`:

```tsx
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { TimeSeriesFile } from "../lib/types";

interface TimeSeriesChartProps {
  series: TimeSeriesFile;
  height?: number;
}

export default function TimeSeriesChart({ series, height = 280 }: TimeSeriesChartProps) {
  const data = series.observations.slice(-260);
  return (
    <div className="chart-panel" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 20, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="#dfe4da" strokeDasharray="3 3" />
          <XAxis dataKey="date" minTickGap={36} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={54} domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#2f6f5e" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Create `src/components/PercentileBandChart.tsx`:

```tsx
import type { TimeSeriesFile } from "../lib/types";
import { formatPercentile } from "../lib/formatters";

interface PercentileBandChartProps {
  series: TimeSeriesFile;
}

export default function PercentileBandChart({ series }: PercentileBandChartProps) {
  const percentile = series.summary?.percentile_252d ?? null;
  const width = percentile === null ? 0 : Math.max(0, Math.min(100, percentile));
  return (
    <div className="percentile-panel">
      <div className="percentile-label">
        <span>252-day percentile</span>
        <strong>{formatPercentile(percentile)}</strong>
      </div>
      <div className="percentile-track" aria-hidden="true">
        <div className="percentile-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add source note and data status table**

Create `src/components/SourceNote.tsx`:

```tsx
import type { SeriesCatalogEntry } from "../lib/types";

interface SourceNoteProps {
  entry: SeriesCatalogEntry;
}

export default function SourceNote({ entry }: SourceNoteProps) {
  return (
    <aside className="source-note">
      <h3>{entry.source}</h3>
      <p>{entry.notes}</p>
      <p>
        Frequency: <strong>{entry.frequency}</strong>
      </p>
      <a href={entry.source_url} target="_blank" rel="noreferrer">
        Source reference
      </a>
    </aside>
  );
}
```

Create `src/components/DataStatusTable.tsx`:

```tsx
import { formatDate, statusLabel } from "../lib/formatters";
import type { DataStatusFile } from "../lib/types";

interface DataStatusTableProps {
  status: DataStatusFile;
  seriesIds?: string[];
}

export default function DataStatusTable({ status, seriesIds }: DataStatusTableProps) {
  const rows = Object.entries(status.series).filter(([id]) => !seriesIds || seriesIds.includes(id));
  return (
    <section className="status-table">
      <div className="section-heading">
        <h3>Data health</h3>
        <p>Generated {formatDate(status.generated_at_utc)}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Series</th>
            <th>Status</th>
            <th>Last observation</th>
            <th>Freshness</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, item]) => (
            <tr key={id}>
              <td>{id}</td>
              <td>{statusLabel(item.status)}</td>
              <td>{formatDate(item.last_observation)}</td>
              <td>{item.freshness_days ?? "N/A"} days</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 5: Add data loading to overview**

Replace `src/routes/Overview.tsx` with:

```tsx
import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import MetricCard from "../components/MetricCard";
import RegimeBadge from "../components/RegimeBadge";
import { loadCatalog, loadDataStatus, loadRegimeScore, loadSeries } from "../lib/data";
import type { DataStatusFile, RegimeScoreFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const overviewSeries = ["vix", "us10y", "fed_assets", "high_yield_oas"];

export default function Overview() {
  const [catalog, setCatalog] = useState<SeriesCatalogEntry[]>([]);
  const [regime, setRegime] = useState<RegimeScoreFile | null>(null);
  const [status, setStatus] = useState<DataStatusFile | null>(null);
  const [series, setSeries] = useState<TimeSeriesFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadCatalog(),
      loadRegimeScore(),
      loadDataStatus(),
      Promise.all(overviewSeries.map((id) => loadSeries(id)))
    ])
      .then(([catalogData, regimeData, statusData, seriesData]) => {
        setCatalog(catalogData);
        setRegime(regimeData);
        setStatus(statusData);
        setSeries(seriesData);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load data"));
  }, []);

  const catalogById = Object.fromEntries(catalog.map((entry) => [entry.id, entry]));

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Market weather</p>
        <h2>Overview</h2>
        <p>Cross-asset conditions summarized from static JSON generated by GitHub Actions.</p>
      </section>

      {error ? <p className="data-error">{error}</p> : null}

      {regime ? (
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Weather score</p>
            <h3>{regime.overall_score}</h3>
            <RegimeBadge label={regime.label} score={regime.overall_score} />
          </div>
          <div>
            <h4>Top supports</h4>
            <p>{regime.top_supports.length ? regime.top_supports.join(", ") : "No positive driver above neutral"}</p>
            <h4>Top risks</h4>
            <p>{regime.top_risks.length ? regime.top_risks.join(", ") : "No negative driver below neutral"}</p>
          </div>
        </section>
      ) : null}

      <section className="metric-list">
        {series.map((item) => (
          <MetricCard key={item.series_id} series={item} catalog={catalogById[item.series_id]} />
        ))}
      </section>

      {status ? <DataStatusTable status={status} seriesIds={overviewSeries} /> : null}
    </main>
  );
}
```

- [ ] **Step 6: Add data loading to detail pages**

Replace `src/routes/Volatility.tsx` with:

```tsx
import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import PercentileBandChart from "../components/PercentileBandChart";
import SourceNote from "../components/SourceNote";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadSeries } from "../lib/data";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

export default function Volatility() {
  const [series, setSeries] = useState<TimeSeriesFile | null>(null);
  const [catalog, setCatalog] = useState<SeriesCatalogEntry | null>(null);

  useEffect(() => {
    Promise.all([loadSeries("vix"), loadCatalog()]).then(([seriesData, catalogData]) => {
      setSeries(seriesData);
      setCatalog(catalogData.find((entry) => entry.id === "vix") ?? null);
    });
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Volatility</p>
        <h2>VIX state</h2>
        <p>Delayed Cboe VIX history with percentile context.</p>
      </section>
      {series ? (
        <div className="detail-grid">
          <div>
            <MetricCard series={series} catalog={catalog ?? undefined} />
            <PercentileBandChart series={series} />
            <TimeSeriesChart series={series} />
          </div>
          {catalog ? <SourceNote entry={catalog} /> : null}
        </div>
      ) : (
        <p>Loading volatility data...</p>
      )}
    </main>
  );
}
```

Replace `src/routes/Rates.tsx` with:

```tsx
import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadSeries } from "../lib/data";
import type { TimeSeriesFile } from "../lib/types";

const ids = ["us2y", "us10y", "us20y", "us30y"];

export default function Rates() {
  const [series, setSeries] = useState<TimeSeriesFile[]>([]);

  useEffect(() => {
    Promise.all(ids.map((id) => loadSeries(id))).then(setSeries);
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Rates</p>
        <h2>Treasury curve</h2>
        <p>U.S. Treasury yields and the 10Y minus 2Y curve spread.</p>
      </section>
      <section className="metric-list">
        {series.map((item) => (
          <MetricCard key={item.series_id} series={item} />
        ))}
      </section>
      {series[1] ? <TimeSeriesChart series={series[1]} /> : <p>Loading rates data...</p>}
    </main>
  );
}
```

Replace `src/routes/Liquidity.tsx` with:

```tsx
import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadSeries } from "../lib/data";
import type { TimeSeriesFile } from "../lib/types";

const ids = ["fed_assets", "reverse_repo", "treasury_general_account", "sofr"];

export default function Liquidity() {
  const [series, setSeries] = useState<TimeSeriesFile[]>([]);

  useEffect(() => {
    Promise.all(ids.map((id) => loadSeries(id))).then(setSeries);
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Liquidity</p>
        <h2>Funding and balance sheet</h2>
        <p>Fed assets, reverse repo, Treasury General Account, and SOFR.</p>
      </section>
      <section className="metric-list">
        {series.map((item) => (
          <MetricCard key={item.series_id} series={item} />
        ))}
      </section>
      {series[0] ? <TimeSeriesChart series={series[0]} /> : <p>Loading liquidity data...</p>}
    </main>
  );
}
```

Replace `src/routes/Credit.tsx` with:

```tsx
import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadSeries } from "../lib/data";
import type { TimeSeriesFile } from "../lib/types";

const ids = ["high_yield_oas", "investment_grade_oas"];

export default function Credit() {
  const [series, setSeries] = useState<TimeSeriesFile[]>([]);

  useEffect(() => {
    Promise.all(ids.map((id) => loadSeries(id))).then(setSeries);
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Credit</p>
        <h2>Credit spreads</h2>
        <p>High-yield and investment-grade option-adjusted spreads.</p>
      </section>
      <section className="metric-list">
        {series.map((item) => (
          <MetricCard key={item.series_id} series={item} />
        ))}
      </section>
      {series[0] ? <TimeSeriesChart series={series[0]} /> : <p>Loading credit data...</p>}
    </main>
  );
}
```

- [ ] **Step 7: Add methodology content**

Replace `src/routes/Methodology.tsx` with:

```tsx
export default function Methodology() {
  return (
    <main className="page-shell methodology">
      <section className="page-heading">
        <p className="eyebrow">Methodology</p>
        <h2>How the map works</h2>
        <p>This static site explains market regimes. It does not provide financial advice.</p>
      </section>
      <section>
        <h3>GitHub-only architecture</h3>
        <p>
          GitHub Actions fetches public CSV data, writes static JSON, validates freshness, and
          deploys the React app to GitHub Pages. The browser reads only files from this repository.
        </p>
      </section>
      <section>
        <h3>Score interpretation</h3>
        <p>
          Scores range from -100 to +100. Positive values indicate more supportive market weather,
          values near zero are mixed, and negative values indicate more hostile conditions.
        </p>
      </section>
      <section>
        <h3>Limitations</h3>
        <p>
          Data is delayed, public endpoints can change, and the scoring model is descriptive. It is
          not a forecast, trading system, or recommendation.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Add component styles**

Append to `src/styles.css`:

```css
.hero-panel,
.metric-card,
.source-note,
.status-table,
.percentile-panel {
  border: 1px solid #d9ded2;
  border-radius: 8px;
  background: #fffef9;
  box-shadow: 0 1px 2px rgba(38, 50, 43, 0.05);
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(180px, 0.35fr) minmax(260px, 1fr);
  gap: 24px;
  padding: 24px;
  margin-bottom: 24px;
}

.hero-panel h3 {
  margin: 0 0 8px;
  font-size: 3rem;
  letter-spacing: 0;
}

.hero-panel h4 {
  margin: 0 0 6px;
}

.metric-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
  margin: 24px 0;
}

.metric-card {
  padding: 18px;
}

.metric-card h3 {
  margin: 0;
  font-size: 1rem;
}

.metric-source {
  margin: 0 0 4px;
  color: #607066;
  font-size: 0.78rem;
  font-weight: 700;
}

.metric-value {
  margin: 18px 0;
  font-size: 2rem;
  font-weight: 750;
}

.metric-value span {
  margin-left: 8px;
  color: #607066;
  font-size: 0.85rem;
  font-weight: 600;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.metric-grid div {
  padding: 10px;
  border-radius: 6px;
  background: #f3f5ef;
}

.metric-grid dt {
  color: #647267;
  font-size: 0.76rem;
}

.metric-grid dd {
  margin: 2px 0 0;
  font-weight: 700;
}

.metric-card footer {
  margin-top: 14px;
  color: #607066;
  font-size: 0.82rem;
}

.regime-badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 5px 10px;
  border-radius: 999px;
  font-weight: 750;
}

.regime-badge.positive {
  background: #dcefe2;
  color: #1f5a35;
}

.regime-badge.neutral {
  background: #e8e6d9;
  color: #554f2f;
}

.regime-badge.warning {
  background: #f3e5c4;
  color: #6b4b13;
}

.regime-badge.negative {
  background: #f3d9d4;
  color: #7a2d22;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
}

.chart-panel {
  margin-top: 16px;
  padding: 8px;
  border: 1px solid #d9ded2;
  border-radius: 8px;
  background: #fffef9;
}

.percentile-panel,
.source-note,
.status-table {
  padding: 18px;
}

.percentile-label {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.percentile-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e4e7dd;
}

.percentile-fill {
  height: 100%;
  background: #2f6f5e;
}

.status-table {
  overflow-x: auto;
}

.status-table table {
  width: 100%;
  border-collapse: collapse;
}

.status-table th,
.status-table td {
  padding: 10px 8px;
  border-top: 1px solid #e2e6dd;
  text-align: left;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.data-error {
  padding: 14px;
  border: 1px solid #e4b5aa;
  border-radius: 8px;
  color: #742f24;
  background: #fff0ec;
}

.methodology section {
  max-width: 820px;
  margin-bottom: 24px;
}

@media (max-width: 840px) {
  .hero-panel,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 9: Verify UI build**

Run:

```bash
npm test
npm run build
```

Expected:

```text
Test Files  1 passed
✓ built in
```

- [ ] **Step 10: Commit UI components**

Run:

```bash
git add src
git commit -m "feat: render static market data dashboard"
```

---

## Task 6: GitHub Actions Workflows and Documentation

**Owner:** workflows and documentation worker

**Files:**
- Create: `.github/workflows/update-data.yml`
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `README.md`
- Create: `docs/DATA_SOURCES.md`
- Create: `docs/METHODOLOGY.md`
- Create: `docs/LIMITATIONS.md`

- [ ] **Step 1: Add data update workflow**

Create `.github/workflows/update-data.yml`:

```yaml
name: Update market data

on:
  schedule:
    - cron: "30 23 * * 1-5"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update-data:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Python dependencies
        run: python -m pip install -r requirements.txt

      - name: Fetch public data
        run: |
          python -m scripts.ingest.fetch_cboe
          python -m scripts.ingest.fetch_fred_csv

      - name: Transform and score
        run: |
          python -m scripts.transform.normalize_series
          python -m scripts.transform.compute_percentiles
          python -m scripts.transform.compute_regime_score

      - name: Validate data
        run: |
          python -m scripts.validate.validate_schema
          python -m scripts.validate.validate_freshness

      - name: Commit updated data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/data
          git diff --cached --quiet && echo "No data changes" || git commit -m "chore: update market data"
          git push
```

- [ ] **Step 2: Add GitHub Pages deploy workflow**

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          GITHUB_PAGES: "true"
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Update README**

Replace `README.md` with:

```markdown
# market-weather-map

A GitHub Pages dashboard that maps market weather across volatility, rates, liquidity, and credit using delayed public data and transparent regime scoring.

## What Phase 1 Includes

- Vite + React + TypeScript static frontend
- GitHub Actions data update workflow
- no-secret public CSV sources from Cboe and FRED
- static JSON files under `public/data`
- GitHub Pages deployment workflow
- source notes, data freshness, and weather/regime scoring

## What It Does Not Do

- no external backend
- no database
- no live feed
- no frontend API keys
- no browser-side calls to market data providers
- no financial advice or trading signals

## Local Setup

```bash
npm install
python -m pip install -r requirements.txt
```

## Generate Data Locally

```bash
python -m scripts.ingest.fetch_cboe
python -m scripts.ingest.fetch_fred_csv
python -m scripts.transform.normalize_series
python -m scripts.transform.compute_percentiles
python -m scripts.transform.compute_regime_score
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

## Run the App

```bash
npm run dev
```

## Build

```bash
npm test
npm run build
```

## Deployment

`update-data.yml` fetches and commits static JSON data. `deploy-pages.yml` builds the Vite app and deploys it to GitHub Pages.
```

- [ ] **Step 4: Add data source docs**

Create `docs/DATA_SOURCES.md`:

```markdown
# Data Sources

Phase 1 uses public endpoints that do not require secrets.

| Series | Source | Endpoint |
| --- | --- | --- |
| VIX | Cboe | `https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv` |
| U.S. 2Y | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2` |
| U.S. 10Y | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10` |
| U.S. 20Y | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS20` |
| U.S. 30Y | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30` |
| Fed assets | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL` |
| Reverse repo | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=RRPONTSYD` |
| Treasury General Account | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=WTREGEN` |
| SOFR | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR` |
| High-yield OAS | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2` |
| Investment-grade OAS | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLC0A0CM` |

The frontend does not call these endpoints. GitHub Actions fetches them and writes static JSON files.
```

Create `docs/METHODOLOGY.md`:

```markdown
# Methodology

The weather score is descriptive. It summarizes delayed public data into a score from `-100` to `+100`.

## Bucket Weights

| Bucket | Weight |
| --- | ---: |
| Volatility | 20% |
| Rates | 15% |
| Liquidity | 20% |
| Credit | 20% |
| Commodities | 10% |
| Sentiment / positioning | 15% |

Phase 1 actively scores volatility, rates, liquidity, and credit. Commodities and sentiment use fixed neutral values until their public-source ingestion is added.

## Interpretation

- Positive scores mean more supportive market weather.
- Scores near zero mean mixed or neutral weather.
- Negative scores mean more hostile market weather.

The score is not a forecast and does not recommend trades.
```

Create `docs/LIMITATIONS.md`:

```markdown
# Limitations

- Data is delayed.
- Public CSV endpoints can change format or availability.
- FRED graph CSV downloads are used because Phase 1 avoids secrets.
- GitHub Pages serves static files only.
- GitHub Actions performs data ingestion before deployment.
- The weather score is explanatory and not predictive.
- This project does not provide financial advice.
```

- [ ] **Step 5: Verify workflow syntax by inspection and local commands**

Run:

```bash
npm run build
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

Expected:

```text
✓ built in
```

Both Python validation commands should exit with status `0`.

- [ ] **Step 6: Commit workflows and docs**

Run:

```bash
git add .github README.md docs
git commit -m "feat: add GitHub Pages workflows"
```

---

## Task 7: Integration Verification and Phase 1 Acceptance

**Owner:** integration QA worker

**Files:**
- Review: all files changed by Tasks 1 through 6
- Modify only when a concrete integration failure is found and the responsible owner is unavailable

- [ ] **Step 1: Confirm working tree state**

Run:

```bash
git status --short
```

Expected:

```text
```

The expected output is empty except for user-owned local files such as `.idea/`.

- [ ] **Step 2: Regenerate data from scratch**

Run:

```bash
python -m scripts.ingest.fetch_cboe
python -m scripts.ingest.fetch_fred_csv
python -m scripts.transform.normalize_series
python -m scripts.transform.compute_percentiles
python -m scripts.transform.compute_regime_score
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

Expected:

```text
```

All commands exit with status `0`.

- [ ] **Step 3: Run all tests**

Run:

```bash
python -m pytest tests/python -v
npm test
```

Expected:

```text
passed
Test Files
```

- [ ] **Step 4: Build for GitHub Pages**

Run:

```bash
GITHUB_PAGES=true npm run build
```

Expected:

```text
✓ built in
```

Confirm:

```bash
test -f dist/index.html
test -f dist/404.html
test -d dist/assets
```

- [ ] **Step 5: Verify deployed asset paths in build output**

Run:

```bash
grep -R "/market-weather-map/assets/" dist/index.html
```

Expected:

```text
/market-weather-map/assets/
```

- [ ] **Step 6: Verify frontend does not call provider endpoints**

Run:

```bash
grep -R "fred.stlouisfed.org\\|cdn.cboe.com" dist/assets || true
```

Expected:

```text
```

The expected output is empty. Source URLs may appear in static JSON under `public/data` before build, but provider endpoints should not be embedded in compiled JavaScript as runtime fetch targets.

- [ ] **Step 7: Smoke test local preview**

Run:

```bash
npm run preview -- --port 4173
```

Expected:

```text
Local:
```

Open `http://localhost:4173/market-weather-map/` and verify:

- Overview renders weather score and metric cards.
- `/market-weather-map/volatility` renders a VIX chart.
- `/market-weather-map/rates` renders Treasury cards.
- `/market-weather-map/liquidity` renders liquidity cards.
- `/market-weather-map/credit` renders credit cards.
- `/market-weather-map/methodology` renders limitations and disclaimer text.

Stop the preview server after verification.

- [ ] **Step 8: Commit integration fixes**

If Step 7 required fixes, run:

```bash
git add .
git commit -m "fix: complete phase 1 integration"
```

If no fixes were needed, do not create an empty commit.

- [ ] **Step 9: Final acceptance checklist**

Confirm each item is true:

```text
[ ] GitHub Actions can fetch no-secret public data.
[ ] Static JSON exists under public/data.
[ ] Validation fails on malformed or stale required files.
[ ] Vite builds with the GitHub Pages base path.
[ ] Browser routes render from static JSON only.
[ ] Data health is visible in the UI.
[ ] Source notes are visible in the UI.
[ ] The site avoids financial advice and trading instructions.
```

---

## Subagent Dispatch Map

Recommended subagent-driven execution:

1. Dispatch Task 1 to a worker first.
2. After Task 1 passes build, dispatch Task 2 and Task 4 in parallel.
3. After Task 2 lands, dispatch Task 3.
4. After Tasks 3 and 4 land, dispatch Task 5.
5. Dispatch Task 6 after Tasks 1 through 3 define stable commands.
6. Dispatch Task 7 last as a verification worker.

Each worker should edit only its owned files, run the task-specific checks, and list changed paths in its final response.
