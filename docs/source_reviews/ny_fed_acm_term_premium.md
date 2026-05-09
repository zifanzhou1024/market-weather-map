# NY Fed ACM Term Premium Source Review

## Candidate Use

Strategic yield-driver decomposition context using Adrian, Crump, and Moench term-premium estimates from the New York Fed after source-specific review.

## Review Answers

Source owner: Federal Reserve Bank of New York.
Official page / documentation reviewed: New York Fed term premia data indicators https://www.newyorkfed.org/research/data_indicators/term-premia-tabs and Liberty Street Economics ACM term-premia note https://libertystreeteconomics.newyorkfed.org/2014/05/treasury-term-premia-1961-present.html.
Data format: New York Fed published data/downloads and research documentation; exact machine-readable endpoint requires review before automation.
Historical availability: ACM estimates are described as available from 1961 to present, with model documentation in New York Fed research materials.
Automated download allowed: Not approved in this review; endpoint stability, terms, attribution, and update cadence need source-specific confirmation.
Static JSON redistribution allowed: Not approved in this review; public research availability does not by itself settle static redistribution handling.
Attribution requirement: Attribute Federal Reserve Bank of New York and the Adrian, Crump, and Moench model/source documentation if later used.
API key required: No API key expected from the New York Fed page, but no automated endpoint is approved here.
Can it be used in browser: No; the browser should not scrape or fetch New York Fed files directly.
Can it be used in GitHub Actions ingestion: No, not until exact data URL, terms, attribution, and redistribution treatment are documented.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: NY Fed ACM term-premium estimates are candidate-only pending New York Fed data-access and redistribution review.
Notes / unresolved questions: Keep this separate from the FRED Kim-Wright first-pass candidate documented in term_premium.md. Confirm whether monthly or daily ACM series, vintage behavior, and model revisions are acceptable for the dashboard.

## Decision

Keep NY Fed ACM source-gated and non-active until a later review documents the exact approved data path and citation language.
