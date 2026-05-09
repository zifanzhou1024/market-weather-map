# Treasury Supply Diagnostics Follow-up

## Scope

Add official/public Treasury fiscal and auction diagnostics as generated static candidate series.

This PR keeps the source-governance boundary intact:

- no backend service
- no browser-side credentials
- no active score changes
- no Treasury supply pressure in regime labels, checklist states, or confidence
- generated rows are labeled candidate diagnostics and not scored

## Implemented Series

Generated from U.S. Treasury FiscalData:

- `monthly_treasury_receipts`
- `monthly_treasury_outlays`
- `monthly_treasury_deficit_surplus`
- `treasury_auction_supply`

The Monthly Treasury Statement table 1 rows are transformed into monthly observations in millions of dollars. Fiscal-month rows later than the report `record_date` are filtered out so generated time series do not become future-dated.

Treasury auction rows are grouped by auction week using offering amount in millions of dollars. Future auction dates are excluded from the numeric series because forward auction schedule context belongs in the event calendar layer.

## UI Placement

- Long-Term Macro / Allocation Climate: added to the existing generated official diagnostics panel.
- Rates & Policy: added a Treasury supply diagnostics panel.

Both surfaces use the existing `CandidateDiagnosticPanel` labels:

- Generated candidate diagnostic
- Not scored
- Does not affect active scores, labels, checklist states, or confidence.

## Verification

Use:

```bash
.venv/bin/python -m pytest tests/python -q
npm test
GITHUB_PAGES=true npm run build
.venv/bin/python -m scripts.validate.validate_schema
.venv/bin/python -m scripts.validate.validate_freshness
```

Treasury-only generation can be refreshed with:

```bash
.venv/bin/python -m scripts.ingest.fetch_treasury
.venv/bin/python -m scripts.transform.normalize_series
.venv/bin/python -m scripts.transform.compute_percentiles
.venv/bin/python -m scripts.transform.compute_regime_score
```

`python -m scripts.update_data` still remains the canonical full update command, but this local run observed a FRED network read timeout before the Treasury step.
