# ISM / S&P Global PMIs Source Review

## Candidate Use

Business-cycle PMI context from ISM and S&P Global after terms review, with regional Federal Reserve surveys preferred as the public proxy in a separate review.

## Review Answers

Source owner: Institute for Supply Management and S&P Global Market Intelligence.
Official page / documentation reviewed: ISM PMI reports page https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/ and S&P Global PMI product page https://www.spglobal.com/marketintelligence/en/mi/products/pmi.html.
Data format: Public report pages and PDFs for current releases; S&P Global describes PMI data as a subscription product; historical/download formats require provider review.
Historical availability: ISM current and historical reports are available in public-facing pages/PDFs, while S&P Global PMI history appears tied to subscription/data products.
Automated download allowed: Not approved; ISM publication terms and S&P Global subscription/licensing terms need review before automation.
Static JSON redistribution allowed: Not approved; avoid republishing ISM or S&P Global PMI values in static JSON until redistribution rights are documented.
Attribution requirement: Attribute ISM and/or S&P Global PMI exactly as source-owner terms require if later approved.
API key required: No public project key is approved; S&P Global or vendor access may require licensed credentials.
Can it be used in browser: No; do not scrape PMI report pages or subscription content from browser code.
Can it be used in GitHub Actions ingestion: No, not until access, automation, and static redistribution terms are documented.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: ISM and S&P Global PMI data are candidate-only business-cycle inputs pending source-owner terms review.
Notes / unresolved questions: S&P Global underlying PMI datasets should be treated as likely licensed or restricted unless proven otherwise. Use the separate regional_fed_surveys_as_pmi_proxy.md review for preferred public survey proxies.

## Decision

Keep ISM and S&P Global PMIs source-gated and non-active for this static dashboard until a later review approves access and redistribution.
