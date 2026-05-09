# SLOOS Source Review

## Candidate Use

Long-term credit-cycle and bank-lending-standards context from official Federal Reserve survey series.

## Review Answers

Source owner: Federal Reserve; FRED mirrors may also be used for specific series.
Official page / documentation reviewed: Federal Reserve SLOOS page https://www.federalreserve.gov/data/sloos.htm and Data Download Program https://www.federalreserve.gov/DataDownload/Choose.aspx?rel=SLOOS.
Data format: Federal Reserve Data Download Program export or FRED API/CSV, depending on final ingestion choice.
Historical availability: Historical SLOOS survey series are available through official Fed/FRED paths, with exact series coverage to be selected in the ingestion PR.
Automated download allowed: Likely compatible through official export/API paths after endpoint-specific engineering review; not a legal determination.
Static JSON redistribution allowed: Likely compatible for derived static publication with attribution after source-owner notice review; not a legal determination.
Attribution requirement: Attribute Federal Reserve and/or FRED plus the selected source series identifiers.
API key required: FRED_API_KEY only if the FRED API is used; Fed Data Download Program paths may not require a key.
Can it be used in browser: No; the browser should consume generated static JSON only.
Can it be used in GitHub Actions ingestion: Yes, after the ingestion PR chooses reviewed endpoints and keeps any secrets out of static artifacts.
Can it affect active scores now: No
Recommended catalog status: free_public
Recommended score status: candidate
Citation text: Senior Loan Officer Opinion Survey on Bank Lending Practices, Federal Reserve.
Citation text to show on website: Senior Loan Officer Opinion Survey on Bank Lending Practices, Federal Reserve.
Notes / unresolved questions: Select exact lending-standards and demand series, transformation direction, release cadence, and citation wording before implementation; free_public means eligible for later implementation review, not a legal conclusion.

## Decision

Promising first-pass official source. Keep current candidate rows non-scoring until a later PR implements ingestion and scoring.
