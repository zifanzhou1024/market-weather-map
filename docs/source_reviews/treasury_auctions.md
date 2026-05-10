# Treasury Auctions Source Review

## Candidate Use

Auction calendar, auction supply, bid-to-cover, high yield or stop-out, and demand context from official Treasury auction sources.

## Review Answers

Source owner: U.S. Treasury, FiscalData, and TreasuryDirect.
Official page / documentation reviewed: FiscalData Treasury Securities Auctions Data https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/; TreasuryDirect auction schedule https://www.treasuryauctions.gov/auctions/when-auctions-happen/.
Data format: FiscalData API/CSV/JSON and TreasuryDirect page or download formats depending on endpoint.
Historical availability: FiscalData provides historical auction records; TreasuryDirect provides official auction schedule context, with endpoint-specific range to be verified before implementation.
Automated download allowed: Likely compatible through official Treasury/FiscalData paths after endpoint-specific engineering review; not a legal determination.
Static JSON redistribution allowed: Likely compatible for derived static auction metrics with attribution after endpoint and field review; not a legal determination.
Attribution requirement: Attribute U.S. Treasury FiscalData, TreasuryDirect, and selected auction dataset names.
API key required: No key expected for FiscalData or TreasuryDirect unless future endpoint documentation changes.
Can it be used in browser: No; the browser should consume generated static JSON and link to official Treasury pages.
Can it be used in GitHub Actions ingestion: Yes. FiscalData Treasury Securities Auctions Data is now used for generated weekly offering-amount diagnostics only.
Can it affect active scores now: No
Recommended catalog status: free_public
Recommended score status: candidate
Citation text: U.S. Treasury FiscalData and TreasuryDirect auction data.
Citation text to show on website: U.S. Treasury FiscalData and TreasuryDirect auction data.
Notes / unresolved questions: Weekly auction supply is generated from `offering_amt` by auction week. Future auction dates remain event-calendar context instead of historical numeric observations. Bid-to-cover, auction tail, high yield, stop-out, and scoring remain deferred.

## Decision

Official public Treasury auction candidate. Generated weekly auction-supply diagnostics are allowed, but these rows remain non-scoring until a later governance/scoring PR promotes them.
