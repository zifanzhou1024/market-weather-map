# Official Event Calendar Design

## Context

The repo already generates `public/data/events/macro_calendar.json` as descriptive, source-linked calendar context. The Calendar route reads that file, but the Short-Term Market Reaction page still renders event families as generic source-gated candidate rows. That makes official public event context less visible than it should be.

## Goal

Make official event-risk context visible in the Short-Term page without changing scoring.

## Design

1. Expand the static macro calendar generator with additional official source-linked rows:
   - CPI and PPI from BLS.
   - Employment Situation / payrolls from BLS.
   - Personal Income and Outlays / PCE from BEA.
   - GDP from BEA.
   - Retail sales from Census.
   - New Residential Construction from Census.
   - FOMC calendar from the Federal Reserve.
   - Treasury auctions from TreasuryDirect.
   - CFTC Commitments of Traders release schedule.

2. Update `EventRiskPanel` so it can render official calendar rows from `MacroCalendarFile`.
   - The panel labels these rows as `Official source-linked calendar context`.
   - The panel labels them as `Not scored`.
   - The panel states the rows do not affect active scores, regime labels, checklist states, or confidence.
   - Candidate-only fallback rows remain available for unresolved market-structure events such as OPEX.

3. Update `TacticalTradingWeather` to load `loadMacroCalendar()` and pass the calendar to `EventRiskPanel`.

## Non-Goals

- No exact-date scraping in this PR.
- No score changes.
- No checklist-state changes.
- No API keys in the browser.
- No Cboe/OPEX activation.
- No trade recommendations or predictive event alerts.

## Acceptance Criteria

- Short-Term renders official event calendar context from static JSON.
- OPEX remains candidate-only.
- Calendar rows show source links and non-scoring governance copy.
- `public/data/events/macro_calendar.json` includes GDP and retail-sales rows in addition to existing event families.
- Python schema validation still accepts the calendar.
- Frontend route tests confirm Short-Term uses the calendar and does not fetch or score OPEX.
