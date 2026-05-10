# Cboe SKEW Source Review

## Candidate Use

Equity tail-risk context using the Cboe SKEW Index after terms and index-data review.

## Review Answers

Source owner: Cboe Global Markets / Cboe Global Indices.
Official page / documentation reviewed: Cboe SKEW white paper https://cdn.cboe.com/resources/indices/documents/SKEWwhitepaperjan2011.pdf and Cboe Global Indices data access page https://res.cboe.com/us/indices/accessing-index-data/.
Data format: Index values and methodology documents; real-time or historical index delivery appears to require Cboe index-data access paths.
Historical availability: Methodology and public references are available, but approved historical value access and redistribution are unresolved.
Automated download allowed: Not approved; Cboe index-data terms must be reviewed before scheduled collection.
Static JSON redistribution allowed: Not approved; index values should be treated as provider-controlled data until licensed or reviewed.
Attribution requirement: Attribute Cboe Global Markets, Cboe Global Indices, and Cboe SKEW Index if later approved.
API key required: No public key path is approved; licensed index feed access may require vendor credentials.
Can it be used in browser: No; do not fetch Cboe index data directly from browser code.
Can it be used in GitHub Actions ingestion: No, not until Cboe index-data access and redistribution rights are documented.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: Cboe SKEW is a candidate-only tail-risk input pending Cboe index-data terms review.
Notes / unresolved questions: Determine whether a delayed public quote, DataShop file, or licensed index feed is the intended source and whether static chart/data redistribution is permitted. Before implementation, align catalog provider and source URL metadata to the Cboe SKEW index/data-access source; do not rely on an options-statistics placeholder as approval.

## Decision

Keep Cboe SKEW source-gated and non-active until a later review identifies an approved data source and redistribution treatment.
