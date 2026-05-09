# Regional Fed Surveys As PMI Proxy Source Review

## Candidate Use

Business-cycle breadth proxy using official regional Federal Reserve manufacturing survey diffusion indexes. This is not ISM PMI or S&P Global PMI.

## Review Answers

Source owner: Regional Federal Reserve Banks; Philadelphia Fed Manufacturing Business Outlook Survey is the first named candidate.
Official page / documentation reviewed: Philadelphia Fed Manufacturing Business Outlook Survey data page https://www.philadelphiafed.org/surveys-and-data/regional-economic-analysis/mbos-data; FRED mirrors may be reviewed for selected regional survey series.
Data format: Official regional Fed downloads or FRED API/CSV, depending on final series selection.
Historical availability: Historical regional survey series are available from official regional Fed pages and/or FRED mirrors, subject to selected series coverage.
Automated download allowed: Likely compatible through official regional Fed or FRED paths after endpoint-specific engineering review; not a legal determination.
Static JSON redistribution allowed: Likely compatible for derived proxy publication with attribution after endpoint and source-owner notice review; not a legal determination.
Attribution requirement: Attribute the relevant regional Federal Reserve Bank and/or FRED plus selected series identifiers.
API key required: FRED_API_KEY if using a FRED mirror; official regional Fed pages may not require a key.
Can it be used in browser: No; the browser should consume generated static JSON and cite source pages.
Can it be used in GitHub Actions ingestion: Yes, after exact series and endpoints are reviewed.
Can it affect active scores now: No
Recommended catalog status: free_public
Recommended score status: candidate
Citation text: Regional Federal Reserve manufacturing survey proxy; not ISM PMI or S&P Global PMI.
Citation text to show on website: Regional Federal Reserve manufacturing survey proxy; not ISM PMI or S&P Global PMI.
Notes / unresolved questions: Label this as a regional Fed survey proxy, not PMI. Decide whether to use only Philadelphia Fed MBOS or a multi-bank composite, and document transformation, seasonal adjustment, and diffusion-index direction before scoring.

## Decision

Eligible as a public official proxy candidate after endpoint-specific review. It remains non-scoring until a later ingestion/scoring PR.
