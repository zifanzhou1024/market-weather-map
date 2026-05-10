# Official/Public Ingestion Sprint 1 Implementation Plan

Date: 2026-05-09

## Objective

Implement the first generated official/public diagnostic inputs from Source Governance Sprint 1 while preserving candidate-only scoring gates.

## Step 1: Write Failing Tests

Add Python tests for:

- Official/FRED diagnostic catalog rows are `free_public`, `review_each_series`, `candidate`, and public.
- Generated diagnostic candidates are excluded from `available_catalog_entries()` even when static files exist.
- The FRED fetcher has a separate generated-series selector that includes explicitly generated free-public candidates but excludes unresolved candidates.
- Existing `active_fred_series()` remains active-only.
- The bond-volatility proxy calculation uses rolling realized 10-year-yield volatility and is clearly derived from `us10y`.
- Candidate diagnostic extremes do not change active score summaries.
- Required generated files include `bond_volatility_proxy.json`.

Run the focused tests and confirm they fail before implementation.

## Step 2: Add Generated Candidate Metadata

Update `scripts/shared/catalog.py`:

- Add official/FRED generated candidates to `FRED_SERIES` with `score_status: candidate`, `access_status: free_public`, `terms_status: review_each_series`, and `generate_static: True`.
- Keep NY Fed ACM as `term_premium_acm_10y` and add Kim-Wright separately as `term_premium_kw_10y`.
- Move `sloos_lending_standards` out of the old gated strategic source list to avoid duplicate IDs.
- Add `bond_volatility_proxy` as a derived candidate catalog row.
- Add regime roles and horizon metadata for the new IDs.

## Step 3: Update FRED Fetch Selection

Update `scripts/ingest/fetch_fred_csv.py`:

- Preserve `active_fred_series()` as active-only.
- Add `generated_fred_series()` for active FRED rows plus explicit generated free-public candidates.
- Use `generated_fred_series()` in `main()`.

## Step 4: Add Bond-Volatility Proxy Generation

Update `scripts/transform/compute_regime_score.py`:

- Add `build_bond_volatility_proxy()`.
- Generate `public/data/derived/bond_volatility_proxy.json`.
- Add derived status metadata.
- Keep fragility scoring unchanged.

Update `scripts/validate/validate_schema.py`:

- Add `bond_volatility_proxy.json` to `REQUIRED_GENERATED_FILES`.

## Step 5: Status Layer

Update status generation so generated free-public candidates with payloads can report freshness while clearly remaining candidate diagnostics. Gated candidates should continue to report `terms_review_needed`.

## Step 6: Regenerate Artifacts

Run:

```bash
python3 -m scripts.update_data
```

Expected generated changes:

- `public/data/series/sloos_lending_standards.json`
- `public/data/series/sloos_small_firm_standards.json`
- `public/data/series/sloos_large_firm_demand.json`
- `public/data/series/ci_loans_weekly.json`
- `public/data/series/term_premium_kw_10y.json`
- `public/data/derived/bond_volatility_proxy.json`
- Catalog and status artifacts.

## Step 7: Verification

Run:

```bash
python3 -m pytest tests/python/test_catalog.py tests/python/test_fetchers.py tests/python/test_scoring.py tests/python/test_tactical_candidate_sources.py
python3 -m scripts.update_data
npm test
GITHUB_PAGES=true npm run build
```

If Python dependencies are unavailable, document the blocker and run the highest-signal available subset.

## Step 8: Publish

Commit, push `codex/official-public-ingestion-sprint1`, and open a pull request.

PR title:

```text
Generate official public diagnostic candidates
```
