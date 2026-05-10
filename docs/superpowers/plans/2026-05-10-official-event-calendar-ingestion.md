# Official Event Calendar Ingestion Plan

## Goal

Promote the official/public event-calendar layer from source-linked placeholders to generated static diagnostics where reviewed official endpoints are available.

The output remains descriptive only:

- no browser provider calls
- no browser credentials
- no backend service
- no score, regime-label, checklist, or confidence changes
- no live alerts or event predictions

## Scope

Add generated scheduled rows for:

- Federal Reserve FOMC meetings from the official FOMC calendar
- BEA Personal Income and Outlays / PCE from the official BEA schedule
- BEA GDP releases from the official BEA schedule
- Census retail-sales releases from the official economic indicators calendar
- Census New Residential Construction releases from the official economic indicators calendar
- Treasury auctions from the FiscalData Treasury securities auctions API

Preserve source-linked rows for:

- BLS CPI
- BLS PPI
- BLS Employment Situation / payrolls
- CFTC Commitments of Traders
- OPEX and exchange-linked event candidates

## Implementation Steps

1. Add parser tests for BEA, Census, FOMC, and FiscalData auction fixtures.
2. Add an event-calendar ingestion helper with pure parsing functions and defensive fetch wrappers.
3. Update `scripts/generate_macro_calendar.py` to overlay scheduled official rows onto the existing static event list.
4. Keep BLS rows source-linked because reviewed BLS release-calendar pages returned blocked responses in local automated checks.
5. Update the event-risk UI copy to label the layer as a generated candidate diagnostic, not a live alert.
6. Update source-governance docs to describe the new generated/static boundary.
7. Regenerate `public/data/events/macro_calendar.json`.
8. Verify Python tests, frontend tests, schema validation, and Pages-style build.

## Acceptance Criteria

- `macro_calendar.json` has `method_version: official-event-calendar-v2`.
- Fed, BEA, Census, and FiscalData events become `scheduled` when official rows are parseable.
- BLS and gated event rows remain source-linked or candidate-only.
- The frontend says event rows are generated candidate diagnostics and non-scoring.
- Candidate/gated sources still cannot affect active scores, regime labels, checklist states, or confidence.
