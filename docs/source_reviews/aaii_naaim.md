# AAII / NAAIM Source Review

## Candidate Use

Investor-positioning and sentiment context using NAAIM Exposure Index (weekly fund-manager equity exposure) and AAII Sentiment Survey (weekly retail bull/bear/neutral breakdown). Listed as readiness-UI candidates only; no operational free-public path has been approved as of this re-review.

## Review Answers

Source owner: American Association of Individual Investors (AAII) and National Association of Active Investment Managers (NAAIM).
Official page / documentation reviewed: AAII Sentiment Investing dashboard https://sentiment.aaii.com/dashboard; AAII Sentiment Survey page https://www.aaii.com/sentimentsurvey; NAAIM Exposure Index page https://www.naaim.org/programs/naaim-exposure-index/.
Data format: AAII publishes weekly survey results via a subscription/dashboard interface. NAAIM publishes a weekly XLSX (`USE_Data-since-Inception_YYYY-MM-DD.xlsx`) linked from its public page.
Historical availability: AAII survey results go back to 1987 but are subscription-gated. NAAIM Exposure Index history is published in the weekly XLSX file.
Access probe (2026-05-11): AAII (`aaii.com/sentimentsurvey`, `sentiment.aaii.com/dashboard`) returns HTTP 403 (Cloudflare) to automated requests; content is subscription/dashboard-oriented and there is no honest free-public scheduled-fetch path. NAAIM (`naaim.org/programs/naaim-exposure-index/`) HTML page returns 200 and the weekly XLSX is publicly downloadable (Cloudflare cache, no automated-request block observed); however, redistribution rights for derived static JSON are not approved by current review.
Automated download allowed: No. AAII is subscription-gated and Cloudflare-blocked; no free-public scheduled fetch is feasible. NAAIM's weekly XLSX is publicly downloadable, but NAAIM's stated usage limits and request for permission on commercial/redistribution use mean an honest scheduled-ingest decision requires explicit source-owner contact and a redistribution-permission review. Both paths remain deferred.
Static JSON redistribution allowed: No. Both NAAIM (usage-limits and permission-request language) and AAII (subscription/paywall) require explicit redistribution agreements before publishing derived static JSON.
Attribution requirement: Attribute AAII (Investor Sentiment Survey) and NAAIM (Exposure Index) per their respective notices if a later approved path is established.
API key required: AAII subscription access is required for any direct AAII path. NAAIM does not gate via API key but the redistribution question remains open.
Can it be used in browser: No.
Can it be used in GitHub Actions ingestion: No. Neither source has an approved free-public endpoint for scheduled GitHub Actions collection. AAII is Cloudflare-blocked and subscription-gated; NAAIM ingestion is deferred pending redistribution-permission review.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: AAII Sentiment Survey and NAAIM Exposure Index are candidate-only sentiment inputs. AAII is subscription/Cloudflare-gated; NAAIM redistribution rights are not approved. Both deferred to Phase C TradingView authenticated-candidate path.
Notes / unresolved questions: Phase C TradingView mirror is planned as the operational candidate fallback for both signals. TradingView tickers such as `AAII_BULL`, `AAII_BEAR`, `AAII_NEUT`, and an exposure-index equivalent are accessed under an authenticated TradingView account. Output will be tagged `access_status: authenticated_candidate`, `score_status: candidate`, `active_scoring_allowed: false`, `requires_secret: true`. TradingView data must not enter active scoring, must not drive PageInsight primary warnings or supports, and raw observations are not committed to public static JSON unless a future source review explicitly approves publication. Re-review AAII if it releases an automated free-public endpoint, NAAIM if the project obtains explicit redistribution permission, or either if the project signs a licensed data agreement.

## Decision

Keep AAII and NAAIM source-gated and non-active. As of 2026-05-11:

- AAII has no honest free-public scheduled-fetch path; the sentiment dashboard and survey page both return HTTP 403 to automated requests, and data access is subscription-oriented.
- NAAIM has a publicly downloadable weekly XLSX, but redistribution rights for derived static JSON are not approved by current review. NAAIM's stated usage limits and permission-request language mean an automated scheduled ingest requires a separate redistribution-permission step before implementing.

The operational fallback for both is the Phase C TradingView authenticated-candidate path; that path keeps data outside active scoring per the governance rules in CLAUDE.md.

Re-review either source if AAII releases an automated free-public endpoint, if NAAIM grants explicit redistribution permission, or if the project signs a licensed data agreement.
