# VIX Futures Curve Source Review

## Candidate Use

True VX futures term-structure context using Cboe Futures Exchange settlement or quote data after terms review.

## Review Answers

Source owner: Cboe Futures Exchange / Cboe Global Markets.
Official page / documentation reviewed: Cboe VIX futures product page https://www.cboe.com/tradable_products/vix/vix_futures/ and CFE historical data page https://ww2.cboe.com/us/futures/market_statistics/historical_data/.
Data format: Delayed futures quotes, settlement prices, historical data archives, and possible Cboe DataShop or licensed CFE data products.
Historical availability: CFE publishes selected historical data and archives, but approved curve construction, automation, and redistribution rights are unresolved.
Automated download allowed: Not approved; CFE/Cboe terms and any DataShop policies must be reviewed before scheduled downloads.
Static JSON redistribution allowed: Not approved; publishing derived VX curve values from Cboe futures data needs source-owner review.
Attribution requirement: Attribute Cboe Futures Exchange and the specific VIX futures or CFE historical data source if later approved.
API key required: No public key path is approved; licensed Cboe/DataShop access may require vendor credentials.
Can it be used in browser: No; do not fetch CFE/Cboe futures data directly from browser code.
Can it be used in GitHub Actions ingestion: No, not until access, automation, attribution, and static redistribution are approved.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: VIX futures curve data is candidate-only pending Cboe/CFE terms and redistribution review.
Notes / unresolved questions: Define whether the source would be daily settlements, delayed quotes, month contracts, or a licensed vendor feed. Keep any current VX rows source-gated and non-active.

## Decision

Keep the VIX futures curve source-gated and non-active until a later review approves the data path and curve methodology.
