# Generated Diagnostics Trends Design

## Context

PR #18 exposed generated official/public diagnostics in Long-Term and Fragility panels, but the panels only show metadata and governance labels. The generated JSON payloads now include historical observations, so the next UI step is to show the trend without changing scoring.

## Goal

Add compact trend sparklines to generated candidate diagnostic rows:

- Long-Term Macro / Allocation Climate:
  - SLOOS lending standards
  - SLOOS small-firm standards
  - SLOOS large-firm demand
  - weekly C&I loans
  - Kim-Wright 10-year term premium
- Fragility / Shock Risk:
  - realized 10-year yield-volatility proxy

## Design

Extend `CandidateDiagnosticPanel` with an optional `series` prop. The panel will match series files by `series_id` and render a compact SVG sparkline for each row when observations are available.

Each diagnostic row will still show:

- `Generated candidate diagnostic`
- `Not scored`
- the governance sentence: `Does not affect active scores, labels, checklist states, or confidence.`

The trend block will show:

- a small SVG sparkline using recent observations
- latest value and latest date
- observation count in the trend window
- a fallback message when observations are unavailable

## Data Flow

Long-Term loads the five generated series through `loadRouteSeries()`.

Fragility loads `bond_volatility_proxy` through `loadRouteDerivedSeries()`.

No score summary, regime snapshot, shock-risk snapshot, checklist state, confidence, or data-status scoring field is modified.

## Non-Goals

- No scoring changes.
- No source promotion.
- No new ingestion.
- No browser-side API keys.
- No activation of MOVE, SKEW, Cboe, valuation, or earnings data.

## Acceptance Criteria

- Long-Term diagnostic rows render trend sparklines for generated official/public diagnostics.
- Fragility renders a trend sparkline for the public bond-volatility proxy.
- Diagnostics remain labeled candidate and not scored.
- Missing diagnostic observations fall back gracefully.
- Tests cover component-level trend rendering and route-level data loading.
