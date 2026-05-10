# Official/Public Ingestion Sprint 1 Design

Date: 2026-05-09

## Goal

Add the first generated official/public diagnostic inputs after the source-governance review sprint, without changing active scores, regime labels, checklist states, confidence, or the static no-backend architecture.

This sprint turns a small set of reviewed public candidates into static JSON artifacts so the UI and future work can inspect them, while preserving candidate-only scoring gates.

## Scope

Generate these non-scoring candidates:

- `sloos_lending_standards`: FRED `DRTSCILM`, SLOOS C&I lending standards for large and middle-market firms.
- `sloos_small_firm_standards`: FRED `DRTSCIS`, SLOOS C&I lending standards for small firms.
- `sloos_large_firm_demand`: FRED `DRSDCILM`, SLOOS C&I loan demand for large and middle-market firms.
- `ci_loans_weekly`: FRED `TOTCI`, weekly C&I loans at all commercial banks.
- `term_premium_kw_10y`: FRED `THREEFYTP10`, Kim-Wright 10-year zero-coupon term premium.
- `bond_volatility_proxy`: derived rolling realized volatility of daily 10-year Treasury-yield changes.

## Non-Goals

- No Cboe put/call ingestion.
- No VIX futures ingestion.
- No SKEW ingestion.
- No ICE MOVE ingestion.
- No gold/XAU, equity breadth, valuation, ERP, or earnings-revision ingestion.
- No new frontend provider calls.
- No browser-exposed API keys.
- No active score, label, checklist, or confidence changes.

## Governance Model

Official/FRED diagnostic candidates use:

- `access_status: free_public`
- `terms_status: review_each_series`
- `score_status: candidate`
- `public: true`

That combination means the static ingestion pipeline may generate JSON artifacts, but `available_catalog_entries()` still excludes them because they are not active scoring inputs.

Gated candidates remain:

- `access_status: terms_review_needed`
- `terms_status: review_needed`
- `score_status: candidate`
- `public: false`

The status layer should distinguish generated free-public candidates from unresolved gated candidates. Generated diagnostic candidates can report freshness from their static payloads, but the status message must still state that they are candidate diagnostics and cannot affect active scoring.

## Bond-Volatility Proxy

`bond_volatility_proxy` is explicitly not ICE MOVE. It is a derived realized-volatility proxy built from active public 10-year Treasury-yield observations:

1. Match daily `us10y` observations.
2. Compute daily changes in yield percentage points.
3. Use a rolling 21-observation standard deviation.
4. Annualize by `sqrt(252)`.
5. Convert to basis points.

This gives a useful public diagnostic for Treasury-yield volatility while keeping MOVE source-gated.

## Data Pipeline Changes

- Add a generated-candidate FRED selector separate from the existing active-only selector.
- Keep `active_fred_series()` unchanged for tests and scoring assumptions.
- Make the FRED fetcher ingest active FRED series plus explicitly generated free-public candidates.
- Add the bond-volatility proxy to derived generation and required generated-file validation.
- Add catalog metadata for the derived proxy.
- Regenerate `public/data` artifacts.

## Acceptance Criteria

- Official/public candidates generate static JSON files.
- Generated candidates remain absent from `available_catalog_entries()`.
- Candidate extremes do not change score summaries.
- Bond-volatility proxy is generated and validated as a derived file.
- Gated sources remain `terms_review_needed`, non-public, and non-scoring.
- `npm test` and `GITHUB_PAGES=true npm run build` pass.
- `python3 -m scripts.update_data` passes.
