# Term Premium Source Review

## Candidate Use

Yield-driver decomposition context using a first-pass FRED Kim-Wright term-premium candidate, with NY Fed ACM kept separate.

## Review Answers

Source owner: FRED-hosted Kim-Wright term premium series; underlying source-owner notices must be reviewed before implementation.
Official page / documentation reviewed: FRED Kim-Wright term premium category https://fred.stlouisfed.org/categories/33825.
Data format: FRED API/CSV or graph CSV depending on final ingestion choice.
Historical availability: FRED category contains historical Kim-Wright term-premium series; exact series coverage and vintage behavior must be verified before implementation.
Automated download allowed: Likely compatible through FRED paths after source-owner notice and endpoint-specific review; not a legal determination.
Static JSON redistribution allowed: Likely compatible for derived static publication with FRED/source-owner attribution after review; not a legal determination.
Attribution requirement: Attribute FRED and the Kim-Wright source series/model identifiers selected for use.
API key required: FRED_API_KEY if using the FRED API; graph CSV may not require a key if selected and reviewed.
Can it be used in browser: No; the browser should consume generated static JSON only.
Can it be used in GitHub Actions ingestion: Yes, after selected FRED series and source notices are reviewed.
Can it affect active scores now: No
Recommended catalog status: free_public
Recommended score status: candidate
Citation text: Kim-Wright term premium series via FRED.
Citation text to show on website: Kim-Wright term premium series via FRED.
Notes / unresolved questions: Keep this review focused on first-pass Kim-Wright classification. NY Fed ACM term premium remains terms_review_needed unless its access, attribution, model citation, and static redistribution handling are documented separately.

## Decision

FRED Kim-Wright is a plausible official/public candidate after series-level review. It remains non-scoring until a later ingestion/scoring PR.
