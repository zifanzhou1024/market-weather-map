# Treasury Fiscal Supply Source Review

## Candidate Use

Fiscal supply, receipts, outlays, deficit/surplus, debt, cash, and interest-expense context from official U.S. Treasury datasets.

## Review Answers

Source owner: U.S. Treasury FiscalData.
Official page / documentation reviewed: FiscalData API documentation https://fiscaldata.treasury.gov/api-documentation/; Monthly Treasury Statement https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/; Daily Treasury Statement https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/.
Data format: FiscalData API, CSV, or JSON depending on selected endpoint.
Historical availability: Historical monthly and daily fiscal datasets are available through FiscalData, with endpoint-specific date ranges to be verified during implementation.
Automated download allowed: Likely compatible through FiscalData public API/download paths after endpoint-specific engineering review; not a legal determination.
Static JSON redistribution allowed: Likely compatible for transformed static dashboard rows with attribution after endpoint review; not a legal determination.
Attribution requirement: Attribute U.S. Treasury FiscalData and the selected dataset names.
API key required: No key expected for FiscalData unless future endpoint documentation changes.
Can it be used in browser: No; the browser should consume generated static JSON and link to source documentation.
Can it be used in GitHub Actions ingestion: Yes, after endpoint selection and schema handling are implemented.
Can it affect active scores now: No
Recommended catalog status: free_public
Recommended score status: candidate
Citation text: U.S. Treasury FiscalData Monthly Treasury Statement and related fiscal datasets.
Citation text to show on website: U.S. Treasury FiscalData Monthly Treasury Statement and related fiscal datasets.
Notes / unresolved questions: Select exact fields for receipts, outlays, surplus/deficit, debt, cash, and interest expense; document revision behavior and transformation rules before active scoring.

## Decision

Official public fiscal-data candidate. Keep as source-reviewed candidate until a later PR implements ingestion and scoring.
