# Event Calendars Source Review

## Candidate Use

Descriptive event-risk context for official macro releases, policy meetings, Treasury auctions, housing releases, and positioning calendars.

## Review Answers

Source owner: Federal Reserve, BLS, BEA, Census, U.S. Treasury, TreasuryDirect, and CFTC for first-pass official event families.
Official page / documentation reviewed: Federal Reserve FOMC calendars https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm; BLS CPI/PPI/payroll release calendars https://www.bls.gov/schedule/news_release/cpi.htm, https://www.bls.gov/schedule/news_release/ppi.htm, and https://www.bls.gov/schedule/news_release/empsit.htm; BEA release schedule https://www.bea.gov/news/schedule/; Census New Residential Construction https://www.census.gov/construction/nrc/; TreasuryDirect auction schedule https://www.treasuryauctions.gov/auctions/when-auctions-happen/; CFTC release schedule https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm.
Data format: Official calendars, API responses, HTML pages, CSV/downloads, or source-linked static rows depending on event family.
Historical availability: Varies by source and event family; source-linked forward calendars are the first-pass use, and historical event backfills require separate endpoint review.
Automated download allowed: Likely compatible for official source-linked calendar context after endpoint-specific review; API-backed structured ingestion must be reviewed per agency.
Static JSON redistribution allowed: Likely compatible for descriptive source-linked event rows with attribution after endpoint review; not a legal determination.
Attribution requirement: Attribute the owning agency or official calendar page for each event family.
API key required: BLS_API_KEY, BEA_API_KEY, and CENSUS_API_KEY may support future structured ingestion; source-linked Fed/Treasury/CFTC pages may not require keys.
Can it be used in browser: No; the browser should read generated static event JSON and follow official links only.
Can it be used in GitHub Actions ingestion: Yes, after each event family endpoint is reviewed and no secrets are exposed to static artifacts.
Can it affect active scores now: No
Recommended catalog status: free_public
Recommended score status: candidate
Citation text: Official agency release calendars and Treasury auction calendars; descriptive event-risk context only.
Citation text to show on website: Official agency release calendars and Treasury auction calendars; descriptive event-risk context only.
Notes / unresolved questions: Treat these rows as descriptive event risk only unless a later methodology explicitly scores event risk. Confirm exact update cadence, time-zone handling, holiday behavior, and historical backfill support per source.

## Decision

Official public calendar pages are suitable first-pass candidates for source-linked, non-scoring event context after endpoint-specific review.
