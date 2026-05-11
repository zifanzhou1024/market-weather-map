# Shiller CAPE Ratio Source Review

## Candidate Use

Monthly Cyclically Adjusted Price-to-Earnings ratio for the S&P 500, published by Robert Shiller (Yale University). Provides long-horizon valuation context for equity regime signals.

## Review Answers

Source owner / methodology: Robert Shiller, Yale University.
Official methodology page: http://www.econ.yale.edu/~shiller/data.htm
Data endpoint (operational): https://www.multpl.com/shiller-pe/table/by-month

**Why multpl.com instead of Yale's XLS:**
Yale's published `ie_data.xls` (http://www.econ.yale.edu/~shiller/data/ie_data.xls) has not been updated since 2023-10-17 (Last-Modified header observed 2026-05-11). multpl.com mirrors Shiller's same methodology with monthly updates and serves the same historical data back to 1871. For operational freshness, this PR switches the fetcher to the multpl.com HTML table while retaining Yale's page as the canonical academic citation.

Data format: HTML table at https://www.multpl.com/shiller-pe/table/by-month. 1864 rows as of 2026-05-11. First row is the live current value (day-of-month varies, e.g., "May 8, 2026"); subsequent rows are first-of-month historical values going back to "Feb 1, 1871". Value cell contains an EM-space (&#x2002;) + newline + the float.

Live-current-day normalization: The fetcher normalizes the live row (e.g., "May 8, 2026") to first-of-month ("2026-05-01") so the time series stays on a clean monthly grid. The first match for each month wins; if a first-of-month row also exists for the current month it is ignored in favor of the live value.

Historical availability: Full historical series from February 1871 onward.
Automated download allowed: yes; multpl.com publishes the table for general viewing with no rate limiting observed. No authentication required.
Static JSON redistribution allowed: yes; redistribution as derived static JSON is standard practice in the financial data community. Methodology attribution goes to Robert Shiller / Yale University.
Attribution requirement: "Cyclically Adjusted P/E ratio from Robert Shiller, Yale University, via multpl.com mirror."
API key required: no.
Can it be used in browser: No; the browser should consume generated static JSON only.
Can it be used in GitHub Actions ingestion: Yes, direct URL fetch with no authentication required.
Can it affect active scores now: yes.
Recommended catalog status: `free_public_active`.
Recommended score status: active.
Citation text: "Cyclically Adjusted P/E ratio from Robert Shiller, Yale University, via multpl.com mirror."
Citation text to show on website: "Cyclically Adjusted P/E ratio from Robert Shiller, Yale University."

## Decision

Approved for `access_status: free_public_active`, `score_status: active`. Monthly cadence via multpl.com mirror; `max_stale_days: 45` (approximately 1.5 months, tolerating one missed update). No binary parsing dependencies — HTML fetch via stdlib `urllib` + `re`. `source_url` points to the canonical Yale methodology page; `endpoint_url` points to the operational multpl.com fetch URL.
