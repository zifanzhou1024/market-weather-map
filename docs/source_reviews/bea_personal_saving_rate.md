# BEA Personal Saving Rate Source Review

## Candidate Use

Monthly household saving context from an official U.S. government statistical agency. Supports growth and consumer-stress regime signals.

## Review Answers

Source owner: U.S. Bureau of Economic Analysis.
Official page / documentation reviewed: https://www.bea.gov/data/income-saving/personal-saving-rate and FRED mirror at https://fred.stlouisfed.org/series/PSAVERT.
Data format: monthly, percent of disposable income.
Historical availability: Full historical series available via FRED graph CSV endpoint.
Automated download allowed: yes, via FRED graph CSV endpoint `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSAVERT`.
Static JSON redistribution allowed: yes (BEA data is in the public domain).
Attribution requirement: "U.S. Bureau of Economic Analysis, Personal Saving Rate [PSAVERT], via FRED."
API key required: no.
Can it be used in browser: No; the browser should consume generated static JSON only.
Can it be used in GitHub Actions ingestion: Yes, via FRED graph CSV endpoint with no key required.
Can it affect active scores now: yes.
Recommended catalog status: `free_public` (this PR promotes to `free_public_active` in BO2).
Recommended score status: active.
Citation text: "U.S. Bureau of Economic Analysis, Personal Saving Rate [PSAVERT], via FRED."
Citation text to show on website: "U.S. Bureau of Economic Analysis, Personal Saving Rate [PSAVERT], via FRED."
Notes / unresolved questions: None. BEA data is released on a monthly lag; the FRED mirror reflects the same lag. The FRED graph CSV endpoint does not require authentication.

## Decision

Approved for `access_status: free_public_active`, `score_status: active`. Monthly cadence; FRED mirror is the canonical automated endpoint.
