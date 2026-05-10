# Cboe Put/Call Source Review

## Candidate Use

Options-sentiment context using Cboe total, index, equity, VIX, ETP, and SPX/SPXW put/call ratios after terms review.

## Review Answers

Source owner: Cboe Global Markets / Cboe Options.
Official page / documentation reviewed: Cboe Daily Market Statistics https://www.cboe.com/us/options/market_statistics/daily/ and Cboe DataShop data policies https://datashop.cboe.com/data-policies.
Data format: Web tables and possible Cboe DataShop or licensed historical data products; no approved static ingestion endpoint documented here.
Historical availability: Current daily market statistics are public on Cboe pages, but historical bulk availability and redistribution rights require review.
Automated download allowed: Not approved; Cboe terms and DataShop policies must be reviewed before scraping, API use, or scheduled downloads.
Static JSON redistribution allowed: Not approved; public display does not establish permission to republish Cboe ratio data in generated static JSON.
Attribution requirement: Attribute Cboe Global Markets and the specific Cboe market statistics page if a later review approves use.
API key required: No public key path is approved; licensed Cboe/DataShop access may require vendor credentials.
Can it be used in browser: No; do not fetch Cboe data directly from browser code.
Can it be used in GitHub Actions ingestion: No, not until terms, automation, attribution, and redistribution are approved.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: Cboe put/call ratios are candidate-only options sentiment inputs pending Cboe terms and redistribution review.
Notes / unresolved questions: Confirm whether daily market statistics, historical archives, DataShop products, or a licensed vendor feed is the intended source. Do not promote these ratios into active scoring in this review.

## Decision

Keep Cboe put/call rows source-gated and non-active until a later review documents an approved access and redistribution path.
