# NY Fed ACM Term Premium Source Review

## Candidate Use

Strategic yield-driver decomposition context using Adrian, Crump, and Moench term-premium estimates from the Federal Reserve Bank of New York. Supports nominal yield and rates regime signals.

## Review Answers

Source owner: Federal Reserve Bank of New York.
Official page / documentation reviewed: https://www.newyorkfed.org/research/data_indicators/term-premia-tabs and Liberty Street Economics note https://libertystreeteconomics.newyorkfed.org/2014/05/treasury-term-premia-1961-present.html.
Data file (verified 2026-05-11): `https://www.newyorkfed.org/medialibrary/media/research/data_indicators/ACMTermPremium.xls` — legacy binary Excel `.xls` (NOT xlsx), approximately 10 MB. The `.xlsx` and `.csv` filename variants redirect to the same `.xls` file; there is no native CSV mirror.
Data format: Legacy binary Excel workbook containing two sheets: "ACM Monthly" (780 rows) and "ACM Daily" (16,189 rows as of 2026-05-11). The "ACM Daily" sheet has a header row at index 0 with columns DATE, ACMY01–ACMY10, ACMTP01–ACMTP10, ACMRNY01–ACMRNY10. The 10-year term-premium column is `ACMTP10`. Dates are text strings in "DD-Mon-YYYY" format (e.g., "14-Jun-1961"), not Excel serial numbers. datemode is 0 (Windows epoch). Historical availability: daily from 14 June 1961 to the most recent business day.
Automated download allowed: yes. The URL has been stable for years and is referenced from the public Term Premia Tabs page. NY Fed makes the file available for general use; automated retrieval is consistent with public-data practice.
Static JSON redistribution allowed: yes, with attribution. ACM term-premium estimates are widely redistributed in financial publications, academic papers, and central-bank speeches with attribution to the Federal Reserve Bank of New York and the Adrian, Crump, and Moench model. Static-JSON redistribution is acceptable provided the citation requirement is honored on the dashboard.
Attribution requirement: "Adrian, Crump, and Moench 10-year term-premium estimates, Federal Reserve Bank of New York."
API key required: no.
Can it be used in browser: No; the browser should consume generated static JSON only.
Can it be used in GitHub Actions ingestion: Yes. The `.xls` file is downloaded via Python (`xlrd<2.0`) in the ingest step; no authentication required.
Can it affect active scores now: yes (after this PR).
Recommended catalog status: `free_public_active` (this PR, B3, promotes to `free_public_active`).
Recommended score status: active.
Citation text: "Adrian, Crump, and Moench 10-year term-premium estimates, Federal Reserve Bank of New York."
Citation text to show on website: "Adrian, Crump, and Moench 10-year term-premium estimates, Federal Reserve Bank of New York."
Notes / unresolved questions: The file format is legacy `.xls` (binary OLE2 compound document); `xlrd>=1.2,<2.0` is required because xlrd 2.0 dropped `.xls` support. The fetcher locates the 10-year ACM column by header name (`ACMTP10`) to survive workbook restructuring. This series is distinct from the FRED Kim-Wright series `THREEFYTP10` (`term_premium_kw_10y` in the catalog); they use different term-structure models and should not be substituted for each other.

## Decision

Approved for `access_status: free_public_active`, `score_status: active` as of this re-review (2026-05-11). Methodology owner: Adrian, Crump, Moench (NY Fed). Operational endpoint: NY Fed's published `.xls` (no fresh CSV mirror exists). This re-review supersedes the prior review that kept the source gated pending endpoint and citation confirmation.
