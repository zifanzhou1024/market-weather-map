# AAII / NAAIM Source Review

## Candidate Use

Investor-positioning and sentiment context using AAII sentiment and NAAIM Exposure Index data after terms review.

## Review Answers

Source owner: American Association of Individual Investors and National Association of Active Investment Managers.
Official page / documentation reviewed: AAII Sentiment Investing dashboard https://sentiment.aaii.com/dashboard and NAAIM Exposure Index page https://naaim.org/programs/naaim-exposure-index/.
Data format: AAII subscription/dashboard content and NAAIM web table or downloadable spreadsheet; exact approved automated format is not documented here.
Historical availability: AAII advertises survey history and dashboard content; NAAIM publishes current and historical exposure data on its page, subject to its stated usage limits.
Automated download allowed: Not approved; source-owner terms must be reviewed before scheduled collection.
Static JSON redistribution allowed: Not approved; both datasets need redistribution and commercial-use review before public static publication.
Attribution requirement: Attribute AAII, AAII Investor Sentiment Survey or dashboard, NAAIM, and NAAIM Exposure Index if later approved.
API key required: No public project key is approved; AAII subscription access or other credentials may be required.
Can it be used in browser: No; do not fetch survey or exposure data directly from browser code.
Can it be used in GitHub Actions ingestion: No, not until access, automation, attribution, and redistribution are approved.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: AAII sentiment and NAAIM Exposure Index are candidate-only sentiment inputs pending terms and redistribution review.
Notes / unresolved questions: NAAIM states usage limits and asks for permission for commercial use; AAII dashboard access appears subscription-oriented. Do not infer static redistribution rights from visible tables or downloads.

## Decision

Keep AAII and NAAIM source-gated and non-active until a later review approves an access and publication path.
