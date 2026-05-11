# Shiller CAPE Ratio Source Review

## Candidate Use

Monthly Cyclically Adjusted Price-to-Earnings ratio for the S&P 500, published by Robert Shiller (Yale University). Provides long-horizon valuation context for equity regime signals.

## Review Answers

Source owner: Robert Shiller, Yale University.
Official page / documentation reviewed: http://www.econ.yale.edu/~shiller/data.htm
Data file (verified 2026-05-11): `http://www.econ.yale.edu/~shiller/data/ie_data.xls` — legacy Excel `.xls` format (NOT xlsx), approximately 1.6 MB. Last-Modified header observed: 2023-10-17.
Data format: Monthly CAPE ratio; "Data" sheet, column header "CAPE". Date column uses Shiller's `YYYY.MM` convention (e.g., "2024.01" for January 2024). Fetcher converts to ISO `YYYY-MM-01` (first-of-month convention).
Historical availability: Full historical series from 1871 onward.
Automated download allowed: yes; the URL has been stable since Shiller's site was established. No rate limiting observed.
Static JSON redistribution allowed: yes; Shiller's data is broadly considered public for academic and derived use.
Attribution requirement: "Cyclically Adjusted P/E ratio from Robert Shiller, Yale University."
API key required: no.
Can it be used in browser: No; the browser should consume generated static JSON only.
Can it be used in GitHub Actions ingestion: Yes, direct URL fetch with no authentication required.
Can it affect active scores now: yes.
Recommended catalog status: `free_public_active` (this PR, B2, promotes to `free_public_active`).
Recommended score status: active.
Citation text: "Cyclically Adjusted P/E ratio from Robert Shiller, Yale University."
Citation text to show on website: "Cyclically Adjusted P/E ratio from Robert Shiller, Yale University."
Notes / unresolved questions: Source file is binary `.xls` (not `.xlsx`); parsing depends on `xlrd<2.0` (xlrd 2.0 dropped `.xls` support). Column index for CAPE is looked up by header name, not hardcoded index, to survive workbook restructuring. Last observed update October 2023; cadence is irregular (Shiller updates manually). `max_stale_days` set to 90 to tolerate approximately two missed monthly updates.

## Decision

Approved for `access_status: free_public_active`, `score_status: active`. Monthly cadence but irregular updates from source; `xlrd<2.0` required for legacy `.xls` parsing. Header row and column are located dynamically to be resilient to workbook layout changes.
