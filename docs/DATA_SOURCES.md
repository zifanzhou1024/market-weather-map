# Data Sources

The project uses active, no-secret public endpoints. The ingestion scripts run in GitHub Actions or locally and write static JSON files under `public/data`. The frontend reads those JSON files and does not call provider endpoints.

| Bucket | Series | Provider | Public endpoint | Frequency | Notes |
| --- | --- | --- | --- | --- | --- |
| Volatility | VIX | Cboe | `https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv` | Daily | Cboe Volatility Index historical daily close. |
| Rates | DGS2 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2` | Daily | 2-Year Treasury Constant Maturity Rate. |
| Rates | DGS10 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10` | Daily | 10-Year Treasury Constant Maturity Rate. |
| Rates | DGS20 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS20` | Daily | 20-Year Treasury Constant Maturity Rate. |
| Rates | DGS30 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30` | Daily | 30-Year Treasury Constant Maturity Rate. |
| Liquidity | WALCL | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL` | Weekly | Federal Reserve total assets. |
| Liquidity | RRPONTSYD | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=RRPONTSYD` | Daily | Overnight reverse repurchase agreements. |
| Liquidity | WTREGEN | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=WTREGEN` | Weekly | Treasury General Account balance. |
| Liquidity | SOFR | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR` | Daily | Secured Overnight Financing Rate. |
| Credit | STLFSI4 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=STLFSI4` | Weekly | St. Louis Fed Financial Stress Index. |
| Credit | NFCI | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=NFCI` | Weekly | Chicago Fed National Financial Conditions Index. |

## Phase 2 Sources

Phase 2 extends the same no-secret ingestion model with additional public FRED graph CSV endpoints and CFTC historical positioning reports.

| Bucket | Series | Provider | Public endpoint | Frequency | Notes |
| --- | --- | --- | --- | --- | --- |
| Commodities | DCOILWTICO | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO` | Daily | WTI crude oil spot price. |
| Commodities | DCOILBRENTEU | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU` | Daily | Brent crude oil spot price. |
| Commodities | PMAIZMTUSDM | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PMAIZMTUSDM` | Monthly | Global corn price. |
| Commodities | PWHEAMTUSDM | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PWHEAMTUSDM` | Monthly | Global wheat price. |
| Commodities | PSOYBUSDM | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PSOYBUSDM` | Monthly | Global soybean price. |
| Sentiment | E-mini S&P 500 positioning | CFTC | `https://www.cftc.gov/files/dea/history/fut_fin_txt_<year>.zip` | Weekly | Historical compressed text report for futures positioning. The ingest script selects the current UTC year dynamically. |

## Active No-Secret Inputs

The GitHub-only data model uses active `free_public` targets when they can be fetched without secrets, normalized into static JSON, and redistributed as source-referenced observations.

| Theme | Series or group | Provider | Public endpoint pattern | Frequency | Score use |
| --- | --- | --- | --- | --- | --- |
| Volatility | VIX | Cboe | `https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv` | Daily | Market Weather and Fragility stress pressure. |
| Rates | DGS2, DGS10, DGS20, DGS30 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily | Market Weather rate pressure and curve context. |
| Real yields/inflation compensation | DFII5, DFII10, T5YIE, T10YIE, T5YIFR | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily | Real yields feed Macro Climate and rate pressure; inflation-compensation series provide commodity impulse and rate context. |
| Credit OAS | BAMLH0A0HYM2, BAMLC0A0CM, BAMLC0A4CBBB | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily | High yield, investment grade, and BBB spread stress for Market Weather and Fragility. |
| Growth/Labor | CFNAI, CFNAIMA3, RRSFS, INDPRO, DGORDER, UNRATE, PAYEMS, ICSA, SAHMREALTIME | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Weekly or monthly | Macro Climate growth breadth, labor trend, and recession-risk context. |
| Inflation | CPIAUCSL, CPILFESL, PCEPILFE, PPIFIS | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Monthly | Macro Climate inflation trend and policy pressure. |
| Housing | HOUST, PERMIT, MORTGAGE30US | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Weekly or monthly | Macro Climate housing bucket: construction activity, permits, and mortgage-rate pressure. |
| Dollar/Banking | DTWEXBGS, DEXJPUS, DEXUSEU, WRESBAL, TOTBKCR, TOTLL, BUSLOANS, DPSACBW027SBOG | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily or weekly | Dollar pressure, reserve balances, bank credit, loans, business lending, and deposits for Fragility. |
| Liquidity | WALCL, RRPONTSYD, WTREGEN, SOFR | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily or weekly | Net liquidity proxy and funding context. |
| Commodities | DCOILWTICO, DCOILBRENTEU, PMAIZMTUSDM, PWHEAMTUSDM, PSOYBUSDM | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily or monthly | Commodity impulse and inflation-pressure context. |
| Positioning | E-mini S&P 500 commitments | CFTC | `https://www.cftc.gov/files/dea/history/fut_fin_txt_<year>.zip` | Weekly | Crowding and underexposure context for Market Weather. |

## Active Phase 4 PR 2 Housing Sources

Housing uses the existing no-secret FRED graph CSV ingestion path. Census New Residential Construction remains the primary source context for starts and permits.

| Bucket | Series ID | FRED series | Public endpoint | Frequency | Notes |
| --- | --- | --- | --- | --- | --- |
| Housing | `housing_starts` | HOUST | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=HOUST` | Monthly | Privately-owned housing starts, seasonally adjusted annual rate; stronger starts are treated as more supportive housing activity. |
| Housing | `building_permits` | PERMIT | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=PERMIT` | Monthly | Privately-owned housing units authorized by building permits, seasonally adjusted annual rate; stronger permits are treated as more supportive forward construction activity. |
| Housing | `mortgage_rate_30y` | MORTGAGE30US | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US` | Weekly | 30-year fixed mortgage rate; higher mortgage-rate pressure is treated as more restrictive for housing. |

## Phase 4 PR 1 Source Handling

Phase 4 PR 1 does not add new source families. It improves release-aware freshness and confidence decomposition for the existing active generated data.

Future Phase 4 source expansion should prefer FRED graph CSV mirrors for time series when a clean FRED-hosted series exists. Original no-secret government APIs or official machine-readable pages should be used when FRED is not enough, especially for event calendars, Treasury auction metadata, fiscal datasets, and release schedules.

## Static Macro Calendar Sources

The calendar at `public/data/events/macro_calendar.json` is descriptive event-risk context. PR 2 uses source-linked rows rather than scraped exact-date alerts.

| Event Area | Source | Source URL | Treatment |
| --- | --- | --- | --- |
| CPI | BLS | `https://www.bls.gov/schedule/news_release/cpi.htm` | Source-linked calendar context. |
| PPI | BLS | `https://www.bls.gov/schedule/news_release/ppi.htm` | Source-linked calendar context. |
| Payrolls | BLS | `https://www.bls.gov/schedule/news_release/empsit.htm` | Source-linked calendar context. |
| Personal Income and Outlays / PCE | BEA | `https://www.bea.gov/news/schedule/` | Source-linked calendar context. |
| FOMC meetings | Federal Reserve | `https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm` | Source-linked calendar context. |
| Treasury auctions | TreasuryDirect | `https://www.treasuryauctions.gov/auctions/when-auctions-happen/` | Source-linked calendar context. |
| Housing releases | Census | `https://www.census.gov/construction/nrc/` | Source-linked calendar context. |
| COT positioning | CFTC | `https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm` | Source-linked calendar context. |

## Candidate-Only Macro Completeness Sources

These rows are in the catalog/status files for roadmap transparency only. They are `terms_review_needed`, do not generate active series files in PR 2, and do not enter scoring.

| Domain | Series ID | Source | Source URL | Reason Not Active |
| --- | --- | --- | --- | --- |
| Consumer balance sheet | `real_disposable_personal_income` | FRED `DSPIC96` | `https://fred.stlouisfed.org/series/DSPIC96` | Scoring design deferred. |
| Consumer balance sheet | `personal_saving_rate` | FRED `PSAVERT` | `https://fred.stlouisfed.org/series/PSAVERT` | Scoring design deferred. |
| Consumer credit | `total_consumer_credit` | FRED `TOTALSL` | `https://fred.stlouisfed.org/series/TOTALSL` | Scoring design deferred. |
| Consumer credit | `revolving_consumer_credit` | FRED `REVOLSL` | `https://fred.stlouisfed.org/series/REVOLSL` | Scoring design deferred. |
| Consumer stress | `household_debt_service_ratio` | FRED `DSR` | `https://fred.stlouisfed.org/series/DSR` | Scoring design deferred. |
| Fiscal/Treasury supply | `monthly_treasury_receipts` | FiscalData MTS | `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/` | Direct FiscalData ingestion deferred. |
| Fiscal/Treasury supply | `monthly_treasury_outlays` | FiscalData MTS | `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/` | Direct FiscalData ingestion deferred. |
| Fiscal/Treasury supply | `monthly_treasury_deficit_surplus` | FiscalData MTS | `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/` | Direct FiscalData ingestion deferred. |
| Fiscal/Treasury supply | `treasury_interest_expense` | FiscalData MTS | `https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/` | Direct FiscalData ingestion deferred. |
| Treasury auction supply | `treasury_auction_supply` | TreasuryDirect | `https://www.treasuryauctions.gov/auctions/when-auctions-happen/` | Numeric auction ingestion deferred. |

## Candidate Sources

Candidate sources are not active scoring inputs until legal, terms, cadence, and redistribution review is complete. They should be marked `terms_review_needed` in source planning unless a later review moves them to `free_public`, `restricted`, or `unavailable`.

| Candidate | Provider | Access status | Potential use | Review notes |
| --- | --- | --- | --- | --- |
| ISM manufacturing and services | Institute for Supply Management | `terms_review_needed` | Growth breadth and business-cycle momentum. | Confirm redistribution and automation terms before static publication. |
| AAII investor sentiment | AAII | `terms_review_needed` | Retail sentiment and contrarian crowding context. | Confirm historical access, redistribution rights, and automated download terms. |
| NAAIM Exposure Index | NAAIM | `terms_review_needed` | Active manager exposure and risk appetite. | Confirm whether automated ingestion and public JSON redistribution are permitted. |
| SLOOS | Federal Reserve | `terms_review_needed` | Bank lending standards and credit availability. | Public release is available, but transformation and redistribution format need review. |
| MOVE Index | ICE Data Indices or licensed redistributors | `terms_review_needed` | Rates volatility and fragility. | Review source access and redistribution terms before scoring. |
| Equity put-call ratios | OCC, Cboe, or other exchanges | `terms_review_needed` | Options positioning and sentiment. | Confirm source-specific terms and whether historical files can be redistributed. |
| NY Fed ACM term premium | Federal Reserve Bank of New York | `terms_review_needed` | Term premium and real-rate decomposition. | Review download format, attribution, and static redistribution expectations. |

## Source Handling

- Cboe and FRED data are fetched by Python scripts, then normalized into static JSON.
- FRED graph CSV endpoints do not require API keys or secrets.
- CFTC positioning data is fetched from public historical compressed text files and transformed into static JSON. The CFTC source index is `https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm`.
- Data freshness is validated against each series' expected cadence and maximum stale-day threshold.
- The generated catalog and status files expose source URLs, expected frequencies, and freshness notes for the frontend.
