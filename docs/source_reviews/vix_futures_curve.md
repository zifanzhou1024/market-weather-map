# VIX Futures Curve Source Review

## Candidate Use

True VX futures term-structure context (`vx1` through `vx8` monthly contracts) for volatility-curve diagnosis.
Listed as readiness-UI candidates only; no operational free-public path has been approved as of this re-review.

## Review Answers

Source owner: Cboe Futures Exchange / Cboe Global Markets.
Official page / documentation reviewed: https://www.cboe.com/tradable_products/vix/vix_futures/ (VIX futures product page), https://www.cboe.com/markets/us/futures/market-statistics/settlement/futures/daily/ (daily settlement page), and Cboe DataShop at https://datashop.cboe.com/.
Data format: The daily settlement page exposes a CSV link under `https://www-api.cboe.com/us/futures/market_statistics/settlement/csv?dt=YYYY-MM-DD`. The CSV columns observed on 2026-05-12 were `Product`, `Symbol`, `Expiration Date`, and `Price`; standard monthly VX rows are distinguishable from weekly VX rows and VXM mini rows by `Product=VX` and symbols such as `VX/K6`, `VX/M6`, etc. Cboe DataShop offers licensed historical CSV products.
Historical availability: The daily settlement page exposes recent daily CSV snapshots; the older archive at https://cdn.cboe.com/resources/futures/archive/volume-and-price/CFE_FinalSettlement_Archive.csv exists, but bulk historical use and redistribution rights still require separate review.
Automated download allowed: Candidate-only, with caveats. The daily settlement CSV endpoint was reachable from a normal automated request on 2026-05-12, so `scripts.ingest.fetch_cboe_vx_settlement` can generate a non-scoring candidate snapshot. This does not approve active scoring or public redistribution; Cboe content/use terms still require review before treating VX settlements as active public static data.
Static JSON redistribution allowed: Not approved for active/public scoring data. The current implementation writes a source-gated candidate file for local/GitHub Actions visibility and marks `public_redistribution_allowed: false`; do not promote to active `public/data/series/` output without documented Cboe permission or a later review decision.
Attribution requirement: Cboe Futures Exchange and the relevant historical data or product page if a licensed path is later approved.
API key required: No public key path is approved. Cboe DataShop credentials are required for the licensed path.
Can it be used in browser: No.
Can it be used in GitHub Actions ingestion: Candidate-only. The daily settlement CSV endpoint can be probed by GitHub Actions and written to `public/data/candidates/cboe_vx_settlement_candidate.json`, but it remains non-scoring and terms-gated.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: VIX futures curve data is candidate-only. Cboe daily settlement CSV can generate a source-gated VX settlement candidate snapshot, but the data must remain non-scoring until redistribution rights are approved.
Notes / unresolved questions: Stooq mirror considered and deferred. Stooq publishes some VIX-related series but symbol mapping for the monthly VX1-VX8 curve is unclear without manual verification, and Stooq's own redistribution terms add a second layer of review. TradingView authenticated mirror remains a possible fallback, but the Cboe daily settlement CSV is the preferred candidate probe while it remains reachable. Candidate data must not enter active scoring, must not drive PageInsight primary warnings or supports, and must not be promoted to active series JSON unless a future source review explicitly approves publication. Re-review if Cboe publishes explicit redistribution terms for the settlement CSV, if licensing changes, or if the project adopts DataShop with appropriate budget and terms acceptance.

## Decision

Keep VX futures curve rows source-gated and non-active. As of 2026-05-12, a daily Cboe settlement CSV endpoint is reachable and may be used for a candidate snapshot, but Cboe redistribution and use terms still block active public scoring promotion. The candidate output stays outside active scoring per the governance rules in this repo.

Re-review if Cboe publishes a documented free public CFE endpoint, if licensing changes, or if the project adopts DataShop with appropriate budget and terms acceptance.
