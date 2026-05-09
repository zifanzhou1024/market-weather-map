# Equity Breadth Source Review

## Candidate Use

Market-breadth confirmation using advance/decline counts, percent-above-moving-average measures, or equal-weight versus cap-weight proxies after source review.

## Review Answers

Source owner: Potential owners include NYSE, Nasdaq, S&P Dow Jones Indices, Cboe, and market-data vendors depending on the exact breadth input.
Official page / documentation reviewed: NYSE market data page https://www.nyse.com/market-data, Nasdaq data page https://www.nasdaq.com/solutions/data, and S&P Dow Jones Indices data licensing page https://www.spglobal.com/spdji/en/about-us/data-index-licensing/.
Data format: Exchange proprietary market-data feeds, index-provider data packages, vendor breadth indicators, or derived calculations from approved constituent/security prices.
Historical availability: Vendor and exchange breadth histories may exist, but public automated access and static redistribution are not approved in this review.
Automated download allowed: Not approved; exchange/index-provider/vendor terms must be reviewed before any scheduled collection.
Static JSON redistribution allowed: Not approved; breadth values derived from proprietary exchange or index data may still carry redistribution constraints.
Attribution requirement: Attribute the exchange, index provider, vendor, and any underlying source series if later approved.
API key required: No public project key is approved; vendor or exchange feeds may require licensed credentials.
Can it be used in browser: No; do not fetch exchange or vendor breadth data directly from browser code.
Can it be used in GitHub Actions ingestion: No, not until the exact source and redistribution rights are documented.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: Equity breadth is candidate-only pending exchange, index-provider, or vendor terms review.
Notes / unresolved questions: A clean proxy may be possible from reviewed public price/index sources, but constituent lists, index levels, and exchange breadth feeds each need separate governance review.

## Decision

Keep equity-breadth inputs source-gated and non-active until a later review selects an approved source and calculation path.
