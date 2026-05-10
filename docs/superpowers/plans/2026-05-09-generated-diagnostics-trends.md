# Generated Diagnostics Trends Implementation Plan

## Objective

Show generated diagnostic trends in the existing non-scoring diagnostics panels.

## Steps

1. Add failing component tests.
   - `CandidateDiagnosticPanel` accepts generated series observations.
   - A row with observations renders a sparkline, latest value/date, and trend-window count.
   - A row without observations renders a clear unavailable state.

2. Add failing route tests.
   - Long-Term fetches generated diagnostic series files and renders trend copy.
   - Fragility fetches `bond_volatility_proxy` from derived data and renders trend copy.
   - MOVE/SKEW and strategic gated sources remain terms-review rows.

3. Implement panel trend support.
   - Add optional `series` prop.
   - Match by `series_id`.
   - Add a small SVG sparkline helper with stable dimensions.
   - Keep all governance labels unchanged.

4. Wire route data.
   - Long-Term: load `macroDiagnosticIds` via `loadRouteSeries()`.
   - Fragility: load `fragilityDiagnosticIds` via `loadRouteDerivedSeries()`.
   - Pass loaded series to `CandidateDiagnosticPanel`.

5. Add styles.
   - Responsive two-column diagnostic row layout.
   - Compact sparkline frame.
   - Mobile rows collapse cleanly.

6. Verify.
   - Run targeted component/route tests.
   - Run full `npm test -- --run`.
   - Run `GITHUB_PAGES=true npm run build`.
   - Run Python tests in a temp venv if the host Python lacks pytest.
