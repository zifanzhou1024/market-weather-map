# VIX Futures Curve Source Review

## Candidate Use

True VX futures term-structure context (`vx1` through `vx8` monthly contracts) for volatility-curve diagnosis.
Listed as readiness-UI candidates only; no operational free-public path has been approved as of this re-review.

## Review Answers

Source owner: Cboe Futures Exchange / Cboe Global Markets.
Official page / documentation reviewed: https://www.cboe.com/tradable_products/vix/vix_futures/ (VIX futures product page) and https://ww2.cboe.com/us/futures/market_statistics/historical_data/ (CFE historical data page); Cboe DataShop at https://datashop.cboe.com/.
Data format: Delayed futures quotes, settlement prices, and historical archives; CFE historical data is published via HTML pages on the legacy ww2.cboe.com domain. Cboe DataShop (https://datashop.cboe.com/) offers licensed historical CSV products.
Historical availability: CFE publishes selected historical data on the legacy ww2.cboe.com domain, but historical bulk availability and redistribution rights require a licensing agreement with Cboe or DataShop.
Automated download allowed: No. Cboe's Cloudflare gating and DataShop terms together preclude an honest free-public scheduled fetch. Direct CDN paths under https://cdn.cboe.com/api/global/delayed_quotes/futures/ return HTTP 403 (Cloudflare) to automated requests, even with a browser User-Agent (probed 2026-05-11). The CFE historical-data page is HTML-only with no machine-readable bulk endpoint linked from the public page. Cboe DataShop is paid/licensed and requires explicit terms acceptance.
Static JSON redistribution allowed: No. Cboe's terms do not authorize redistribution of VX futures settlements or quotes as derived static data outside licensed channels.
Attribution requirement: Cboe Futures Exchange and the relevant historical data or product page if a licensed path is later approved.
API key required: No public key path is approved. Cboe DataShop credentials are required for the licensed path.
Can it be used in browser: No.
Can it be used in GitHub Actions ingestion: No. Cboe CDN paths are Cloudflare-blocked; DataShop is paid and licensed; no approved free-public endpoint exists.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: VIX futures curve data is candidate-only. Cboe CDN endpoints are Cloudflare-blocked; no approved free-public ingestion path exists. Operational fallback is Phase C TradingView authenticated-candidate path (PR C4, tradingview_vx_curve_candidate).
Notes / unresolved questions: Stooq mirror considered and deferred. Stooq publishes some VIX-related series but symbol mapping for the monthly VX1-VX8 curve is unclear without manual verification, and Stooq's own redistribution terms add a second layer of review. Not worth the implementation effort versus the Phase C TradingView path. TradingView authenticated mirror planned as Phase C fallback (PR C4, tradingview_vx_curve_candidate); output will be tagged access_status: authenticated_candidate, score_status: candidate, active_scoring_allowed: false, requires_secret: true. TradingView data must not enter active scoring, must not drive PageInsight primary warnings or supports, and raw observations are not committed to public static JSON unless a future source review explicitly approves publication. Re-review if Cboe publishes a documented free public CFE endpoint, if licensing changes, or if the project adopts DataShop with appropriate budget and terms acceptance.

## Decision

Keep VX futures curve rows source-gated and non-active. No automated free-public path is feasible as of 2026-05-11; Cboe's Cloudflare gating, paid DataShop, and unclear Stooq licensing rule out direct ingestion. The operational fallback is the Phase C TradingView authenticated-candidate path (see PR C4, tradingview_vx_curve_candidate); that path keeps the data outside active scoring per the governance rules in CLAUDE.md.

Re-review if Cboe publishes a documented free public CFE endpoint, if licensing changes, or if the project adopts DataShop with appropriate budget and terms acceptance.
