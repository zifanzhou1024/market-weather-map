# Cboe Put/Call Source Review

## Candidate Use

Options-sentiment context using Cboe total, index, equity, ETP, VIX, SPX, and SPXW put/call ratios.
Listed as readiness-UI candidates only; no operational free-public path has been approved as of this re-review.

## Review Answers

Source owner: Cboe Global Markets / Cboe Options.
Official page / documentation reviewed: https://www.cboe.com/us/options/market_statistics/daily/ and https://www.cboe.com/markets/us/options/market-statistics/daily (the daily statistics URL 302-redirects to the latter); Cboe DataShop data policies at https://datashop.cboe.com/.
Data format: Web tables intended for human viewing; Cboe DataShop (https://datashop.cboe.com/) offers licensed historical CSV products.
Historical availability: Current daily statistics are displayed on the Cboe market-statistics page, but historical bulk availability and redistribution rights require a licensing agreement with Cboe or DataShop.
Automated download allowed: No. Cboe's Cloudflare gating and DataShop terms together preclude an honest free-public scheduled fetch. Direct CDN paths under https://cdn.cboe.com/api/global/us_indices/daily_prices/ return HTTP 403 to automated requests even with a browser User-Agent (probed 2026-05-11). The public market-statistics page is HTML-only with no machine-readable CSV link.
Static JSON redistribution allowed: No. Cboe's terms do not authorize redistribution of put/call ratios as derived static data outside licensed channels.
Attribution requirement: Cboe Global Markets and the specific market-statistics page if a later licensed path is approved.
API key required: No public key path is approved. Cboe DataShop credentials are required for the licensed path.
Can it be used in browser: No.
Can it be used in GitHub Actions ingestion: No. Cboe CDN paths are Cloudflare-blocked; DataShop is paid and licensed; no approved free-public endpoint exists.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: Cboe put/call ratios are candidate-only options sentiment inputs. Cboe CDN endpoints are Cloudflare-blocked; no approved free-public ingestion path exists. Operational fallback is Phase C TradingView authenticated-candidate path (PR C3).
Notes / unresolved questions: Stooq mirror considered and deferred. Stooq publishes Cboe-derived put/call series but requires user-registered API keys, symbol mapping is unclear without manual verification, and Stooq's own redistribution terms add a second layer of review. TradingView authenticated mirror planned as Phase C fallback (PR C3); output will be tagged access_status: authenticated_candidate, score_status: candidate, active_scoring_allowed: false, requires_secret: true. TradingView data must not enter active scoring, must not drive PageInsight primary warnings or supports, and raw observations are not committed to public static JSON unless a future source review explicitly approves publication. Re-review if Cboe publishes a documented free public endpoint, if licensing changes, or if the project adopts DataShop with appropriate budget and terms acceptance.

## Decision

Keep Cboe put/call rows source-gated and non-active. No automated free-public path is feasible as of 2026-05-11; Cboe's Cloudflare gating, paid DataShop, and unclear Stooq licensing rule out direct ingestion. The operational fallback is the Phase C TradingView authenticated-candidate path (see PR C3); that path keeps the data outside active scoring per the governance rules in CLAUDE.md.

Re-review the source if Cboe publishes a documented free public endpoint, if licensing changes, or if the project adopts DataShop with appropriate budget and terms acceptance.
