# Source Governance Sprint 1 Design

## Purpose

This spec defines the next PR after the merged vNext horizon UI and polish work. The product structure is now largely in place: short-term, long-term, fragility, regime map, replay, source-gated candidate panels, and data-quality banners are implemented. The next blocker is source governance, not UI.

The PR should create auditable source-review documentation and classification tables that future ingestion work can rely on. It should not ingest new data, promote candidates into scores, or add provider calls from the browser.

## Branch Strategy

Create the implementation branch from updated `origin/main` after PR #15 is merged.

Recommended branch:

```text
codex/source-governance-sprint1
```

The local root checkout may be on an older branch. Use an isolated worktree based on `origin/main` to avoid mixing stale local commits into this docs sprint.

## Non-Negotiable Constraints

Preserve the static GitHub Pages model:

- No backend service.
- No database.
- No browser-side API keys or provider credentials.
- No live market feed or real-time trading data.
- No paid or authenticated provider calls from the frontend.
- No trade recommendations, financial advice, forecasts, entries, targets, or stop language.

Candidate and source-gated inputs can be displayed as missing, inactive, or readiness rows, but they must not affect active scores, regime labels, checklist states, or confidence until a review explicitly promotes them and a later implementation PR changes ingestion/scoring.

## Secret Handling

The following GitHub Actions secrets are available for future ingestion infrastructure:

```text
FRED_API_KEY
BLS_API_KEY
BEA_API_KEY
EIA_API_KEY
CENSUS_API_KEY
```

This PR must not write literal key values anywhere. Review docs may mention secret names and intended GitHub Actions usage only.

Rules:

- API keys may be used by future Python ingestion running in GitHub Actions or local developer environments.
- API keys must never be sent to the browser, bundled into Vite output, committed into static JSON, or logged in test output.
- Source-review docs should state whether a source requires a key and whether the key can be used in GitHub Actions.
- A source that requires a key can still be compatible with the static site if the key is used only during generation and the generated JSON contains source data, metadata, and attribution but no credentials.

## Current Baseline

Already present on `origin/main`:

- Five minimal source-review docs:
  - `docs/source_reviews/cboe_put_call.md`
  - `docs/source_reviews/cboe_skew.md`
  - `docs/source_reviews/ice_move.md`
  - `docs/source_reviews/ny_fed_acm_term_premium.md`
  - `docs/source_reviews/vix_futures_curve.md`
- `docs/DATA_SOURCES.md` includes active no-secret inputs and candidate-source tables.
- `docs/LIMITATIONS.md` explains candidate-source and static-site limits.
- Candidate panels expose options sentiment, strategic gaps, regime confirmation candidates, and fragility gated stress without scoring them.

Known gap:

- The existing source-review docs are too thin for implementation decisions.
- Several promising official/public sources have no review file.
- There is no standardized source-review template.
- There is no single classification table separating likely clean official sources from commercial/licensed sources.

## Design Scope

### 1. Add a Source-Review Template

Create:

```text
docs/source_reviews/README.md
```

The README should define the status taxonomy and the review checklist every source file must answer.

Recommended checklist:

```text
1. Source owner
2. Official page / documentation reviewed
3. Data format: API / CSV / JSON / XLSX / HTML / PDF
4. Historical availability
5. Automated download allowed?
6. Static JSON redistribution allowed?
7. Attribution requirement
8. API key required?
9. Can it be used in browser?
10. Can it be used in GitHub Actions ingestion?
11. Can it affect active scores?
12. Recommended catalog status:
    free_public / terms_review_needed / restricted / unavailable
13. Recommended score status:
    active / candidate / unavailable
14. Citation text to show on website
15. Notes / unresolved questions
```

Status rules:

```text
free_public:
  Official source/API/export path appears compatible with automated static publication,
  terms reviewed, attribution added, and no browser key exposure.

terms_review_needed:
  Publicly visible data exists, but automated download, static JSON redistribution,
  attribution, commercial use, or scoring use is unclear.

restricted:
  License, data agreement, benchmark license, exchange redistribution license, or
  paid data relationship appears necessary.

unavailable:
  No stable public source, no usable archive, or access is locked/paywalled.
```

The README must make clear that this repository is not providing legal advice; it records implementation governance decisions for this static public dashboard.

### 2. Add Missing Source-Review Docs

Create docs-only review files for:

```text
docs/source_reviews/sloos.md
docs/source_reviews/regional_fed_surveys_as_pmi_proxy.md
docs/source_reviews/ism_spglobal_pmis.md
docs/source_reviews/treasury_fiscal_supply.md
docs/source_reviews/treasury_auctions.md
docs/source_reviews/event_calendars.md
docs/source_reviews/term_premium.md
docs/source_reviews/gold_xau.md
docs/source_reviews/equity_breadth.md
docs/source_reviews/aaii_naaim.md
docs/source_reviews/valuation_erp_earnings.md
docs/source_reviews/bond_volatility_proxy.md
docs/source_reviews/business_loans_freshness.md
```

Each file should use the README checklist. Keep decisions conservative when terms are not clear.

The files should be useful to future agents by including:

- The most relevant official URLs.
- The initial classification.
- Whether future ingestion can use one of the configured secret names.
- Explicit scoring rule: active scoring is allowed only if the review classifies the source as usable and a later ingestion/scoring PR implements it.

### 3. Recommended Initial Classification

Use this as the starting point for the sprint. Review docs can refine wording, but should not over-promote a source without clear evidence.

Likely first-pass `free_public` candidates after review:

```text
SLOOS via Federal Reserve Data Download Program or FRED
Fed regional survey proxy for PMI, clearly labeled as a proxy
Treasury FiscalData MTS / DTS / debt and cash-flow datasets
Treasury auction / issuance datasets from FiscalData or TreasuryDirect
Official event-calendar source links from Fed, BLS, BEA, Census, Treasury, and CFTC
FRED Kim-Wright term-premium series, subject to FRED/source-owner notices
FRED or Fed H.8 weekly C&I loan series for business-loans freshness
Realized bond-volatility proxy derived from active FRED Treasury-yield series
```

Keep `terms_review_needed` unless a review reaches a clearer conclusion:

```text
Cboe put/call ratios
Cboe SKEW
Cboe VIX futures curve
ISM PMI
S&P Global PMI
AAII sentiment
NAAIM Exposure Index
Gold / LBMA benchmark sources
Nasdaq XAU / gold-miner index sources
Equity breadth feeds
CAPE / Shiller valuation data
Damodaran ERP
NY Fed ACM term premium
```

Likely `restricted` or at least not promotable without a license:

```text
ICE MOVE
S&P / FactSet / Zacks earnings estimates and revisions
NYSE / Nasdaq proprietary breadth feeds without a license
S&P Global PMI underlying data
```

### 4. Official Source Anchors

Use official primary sources where possible.

Minimum anchors to include in the review docs:

```text
FRED API terms:
https://fred.stlouisfed.org/docs/api/terms_of_use.html

BLS Public Data API:
https://www.bls.gov/bls/api_features.htm
https://www.bls.gov/developers/api_signature_v2.htm

BEA API:
https://apps.bea.gov/api/signup/

EIA API:
https://www.eia.gov/developer/

Census API:
https://www.census.gov/data/developers/guidance/api-user-guide/help.html

FiscalData API:
https://fiscaldata.treasury.gov/api-documentation/

Federal Reserve SLOOS Data Download Program:
https://www.federalreserve.gov/DataDownload/Choose.aspx?rel=SLOOS

Treasury FiscalData datasets:
https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/
https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/

Federal Reserve calendars:
https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm

FRED Kim-Wright term premium category:
https://fred.stlouisfed.org/categories/33825
```

Commercial/exchange/licensed sources should be reviewed from official terms, licensing, or documentation pages before any status changes.

### 5. Update Data-Source Documentation

Update `docs/DATA_SOURCES.md` with a compact “Source Governance Sprint 1” section.

It should include:

- A table of newly reviewed source families.
- Recommended initial status.
- Whether a GitHub Actions secret is expected for future ingestion.
- Whether the source is eligible for future active scoring.
- A short note on why.

Do not edit generated `public/data` artifacts in this PR.

### 6. Update Limitations

Update `docs/LIMITATIONS.md` with two points:

- API-key-enabled ingestion still runs before static publication; the browser must never call provider APIs directly.
- “Publicly accessible” is not the same as “redistributable as static JSON,” especially for exchange, benchmark, index, sentiment, and earnings data.

### 7. Optional Catalog Notes

This PR should normally avoid catalog/status changes. If a docs-only classification requires a wording clarification in shared catalog metadata, keep it narrow and candidate-only.

Do not change:

- `score_status`
- generated JSON
- scoring weights
- ingestion modules
- route behavior

## Out of Scope

Do not implement:

- New Python fetchers.
- GitHub Actions secret wiring.
- FRED/BLS/BEA/EIA/Census API calls.
- FiscalData ingestion.
- Event-calendar generation changes.
- Candidate-to-active score promotion.
- Frontend provider calls.
- Historical return/outcome research.
- Watchlists or thresholds.

Those are later PRs after this source-governance sprint.

## Follow-On PR Candidates

After this docs sprint, likely implementation PRs are:

1. **Official-source ingestion PR**
   - SLOOS, weekly C&I loans, FiscalData, event calendars, or Kim-Wright term premium, depending on final review classifications.
2. **Business-loans freshness PR**
   - Add weekly `TOTCI` or equivalent H.8/FRED series to supplement stale monthly `BUSLOANS`.
3. **Bond-volatility proxy PR**
   - Add realized volatility of active Treasury-yield series as a public proxy, clearly labeled as not MOVE.
4. **Replay research PR**
   - Add descriptive historical outcomes only if source governance for asset history is resolved and caveats are explicit.

## Testing and Verification

Because this sprint is docs-first, primary verification is consistency and absence of accidental secrets.

Required checks:

```bash
rg -n "api_key=.*[A-Za-z0-9]|[A-Za-z0-9_-]{32,}" docs src scripts public README.md
rg -n "buy|sell|short|entry|target|stop loss|recommendation|forecast" docs/source_reviews docs/DATA_SOURCES.md docs/LIMITATIONS.md
npm run test
npm run build
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python -v
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_schema
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_freshness
git diff --check
```

If the secret grep finds literal credential values, remove them immediately. Docs may mention secret names only.

## Acceptance Criteria

- A standard source-review template exists.
- The missing source-review docs exist and answer the template questions.
- `docs/DATA_SOURCES.md` has a source-governance sprint table.
- `docs/LIMITATIONS.md` clarifies API-key and redistribution limits.
- No literal API key values are committed.
- No candidate source is promoted into ingestion or scoring.
- The PR gives future implementation agents a clear order:
  1. official/free-public sources first;
  2. exchange/licensed/commercial sources gated;
  3. candidate-to-active promotion only after explicit source review.
