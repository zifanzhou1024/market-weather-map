# Business Loans Freshness Source Review

## Candidate Use

Weekly H.8/FRED commercial and industrial loan freshness supplement for business-credit monitoring, including FRED TOTCI alongside existing BUSLOANS context.

## Review Answers

Source owner: Federal Reserve H.8 and FRED mirrors.
Official page / documentation reviewed: Federal Reserve H.8 release https://www.federalreserve.gov/releases/h8/; FRED TOTCI https://fred.stlouisfed.org/series/TOTCI; FRED BUSLOANS https://fred.stlouisfed.org/series/BUSLOANS.
Data format: Federal Reserve H.8 downloads or FRED API/CSV/graph CSV depending on final ingestion choice.
Historical availability: Weekly H.8/FRED C&I loan history is available for selected series; exact historical coverage and vintage behavior must be verified before implementation.
Automated download allowed: Likely compatible through official Fed/FRED paths after endpoint-specific review; not a legal determination.
Static JSON redistribution allowed: Likely compatible for transformed static dashboard rows with attribution after source-owner notice review; not a legal determination.
Attribution requirement: Attribute Federal Reserve H.8 and/or FRED plus the selected C&I loan series identifiers.
API key required: FRED_API_KEY only if the FRED API is used; graph CSV or Fed release paths may not require a key.
Can it be used in browser: No; the browser should consume generated static JSON only.
Can it be used in GitHub Actions ingestion: Yes, after selected series and endpoints are reviewed.
Can it affect active scores now: No
Recommended catalog status: free_public
Recommended score status: candidate
Citation text: Federal Reserve H.8 commercial and industrial loans via Fed/FRED.
Citation text to show on website: Federal Reserve H.8 commercial and industrial loans via Fed/FRED.
Notes / unresolved questions: Decide whether TOTCI replaces, supplements, or freshness-checks BUSLOANS; document weekly aggregation, revision behavior, stale-data thresholds, and scoring direction before implementation.

## Decision

Official public weekly credit source candidate. Keep non-scoring until a later ingestion/scoring PR defines the freshness rule.
