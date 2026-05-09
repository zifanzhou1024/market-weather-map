# Official Event Calendar Implementation Plan

## Objective

Surface official source-linked event-risk context on the Short-Term page and expand the generated static event calendar.

## Steps

1. Add failing tests.
   - Python generator test expects GDP, retail sales, CPI, payrolls, PCE, FOMC, Treasury auctions, and COT rows.
   - Component test expects `EventRiskPanel` to render official calendar rows as non-scoring source-linked context and keep OPEX as candidate-only.
   - Route test expects Short-Term to load `/data/events/macro_calendar.json` and render official event context.

2. Expand `scripts/generate_macro_calendar.py`.
   - Add GDP and retail sales rows.
   - Keep existing official source-linked rows.
   - Keep method version updated.
   - Keep rows deterministic and schema-valid.

3. Update `public/data/events/macro_calendar.json`.
   - Regenerate through `python -m scripts.generate_macro_calendar`.

4. Update frontend event-risk UI.
   - Add `calendar` prop to `EventRiskPanel`.
   - Render official rows when calendar data is supplied.
   - Render candidate rows for unresolved items, especially OPEX.

5. Wire Short-Term route.
   - Load macro calendar alongside catalog/status/score/regime data.
   - Pass it to `EventRiskPanel`.

6. Verify.
   - Targeted frontend and Python tests.
   - Full `npm test -- --run`.
   - `GITHUB_PAGES=true npm run build`.
   - Python tests in temp venv if needed.
