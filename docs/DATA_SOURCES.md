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

## Active Phase 3 No-Secret Inputs

Phase 3 keeps the GitHub-only data model. Inputs listed here are active `free_public` targets when they can be fetched without secrets, normalized into static JSON, and redistributed as source-referenced observations.

| Theme | Series or group | Provider | Public endpoint pattern | Frequency | Score use |
| --- | --- | --- | --- | --- | --- |
| Volatility | VIX | Cboe | `https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv` | Daily | Market Weather and Fragility stress pressure. |
| Rates | DGS2, DGS10, DGS20, DGS30 | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily | Market Weather rate pressure and curve context. |
| Real yields/inflation compensation | DFII5, DFII10, T5YIE, T10YIE, T5YIFR | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily | Real yields feed Macro Climate and rate pressure; inflation-compensation series provide commodity impulse and rate context. |
| Credit OAS | BAMLH0A0HYM2, BAMLC0A0CM, BAMLC0A4CBBB | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily | High yield, investment grade, and BBB spread stress for Market Weather and Fragility. |
| Growth/Labor | CFNAI, CFNAIMA3, RRSFS, INDPRO, DGORDER, UNRATE, PAYEMS, ICSA, SAHMREALTIME | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Weekly or monthly | Macro Climate growth breadth, labor trend, and recession-risk context. |
| Inflation | CPIAUCSL, CPILFESL, PCEPILFE, PPIFIS | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Monthly | Macro Climate inflation trend and policy pressure. |
| Dollar/Banking | DTWEXBGS, DEXJPUS, DEXUSEU, WRESBAL, TOTBKCR, TOTLL, BUSLOANS, DPSACBW027SBOG | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily or weekly | Dollar pressure, reserve balances, bank credit, loans, business lending, and deposits for Fragility. |
| Liquidity | WALCL, RRPONTSYD, WTREGEN, SOFR | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily or weekly | Net liquidity proxy and funding context. |
| Commodities | DCOILWTICO, DCOILBRENTEU, PMAIZMTUSDM, PWHEAMTUSDM, PSOYBUSDM | FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<series>` | Daily or monthly | Commodity impulse and inflation-pressure context. |
| Positioning | E-mini S&P 500 commitments | CFTC | `https://www.cftc.gov/files/dea/history/fut_fin_txt_<year>.zip` | Weekly | Crowding and underexposure context for Market Weather. |

## Phase 4 PR 1 Source Handling

Phase 4 PR 1 does not add new source families. It improves release-aware freshness and confidence decomposition for the existing active generated data.

Future Phase 4 source expansion should prefer FRED graph CSV mirrors for time series when a clean FRED-hosted series exists. Original no-secret government APIs or official machine-readable pages should be used when FRED is not enough, especially for event calendars, Treasury auction metadata, fiscal datasets, and release schedules.

## Candidate Sources

Candidate sources are not active scoring inputs until legal, terms, cadence, and redistribution review is complete. They should be marked `terms_review_needed` in source planning unless a later review moves them to `free_public`, `restricted`, or `unavailable`.

These candidate rows are displayed as source gaps. They do not affect active scores, regime labels, checklist states, or confidence except as documented source-readiness gaps.

| Candidate | Provider | Access status | Potential use | Review notes |
| --- | --- | --- | --- | --- |
| ISM manufacturing and services | Institute for Supply Management | `terms_review_needed` | Growth breadth and business-cycle momentum. | Confirm redistribution and automation terms before static publication. |
| AAII investor sentiment | AAII | `terms_review_needed` | Retail sentiment and contrarian crowding context. | Confirm historical access, redistribution rights, and automated download terms. |
| NAAIM Exposure Index | NAAIM | `terms_review_needed` | Active manager exposure and risk appetite. | Confirm whether automated ingestion and public JSON redistribution are permitted. |
| SLOOS | Federal Reserve | `terms_review_needed` | Bank lending standards and credit availability. | Public release is available, but transformation and redistribution format need review. |
| MOVE Index | ICE Data Indices or licensed redistributors | `terms_review_needed` | Rates volatility and fragility. | Review source access and redistribution terms before scoring. |
| Equity put-call ratios | OCC, Cboe, or other exchanges | `terms_review_needed` | Options positioning and sentiment. | Confirm source-specific terms and whether historical files can be redistributed. |
| NY Fed ACM term premium | Federal Reserve Bank of New York | `terms_review_needed` | Term premium and real-rate decomposition. | Review download format, attribution, and static redistribution expectations. |
| Cboe put/call ratios | Cboe | `terms_review_needed` | Options activity and sentiment context. | Candidate score status until exchange terms, historical access, and redistribution rules are reviewed. |
| Cboe SKEW | Cboe | `terms_review_needed` | Tail-risk and options-market confirmation. | Candidate score status until index terms and redistribution rules are reviewed. |
| VIX futures curve | Cboe Futures Exchange or licensed redistributors | `terms_review_needed` | Tradable volatility term-structure context. | Candidate score status until futures data terms, redistribution rules, and delayed-data constraints are reviewed. |
| MOVE | ICE Data Indices or licensed redistributors | `terms_review_needed` | Treasury volatility confirmation and fragility context. | Candidate score status until licensed-index terms and redistribution rules are reviewed. |
| Gold/XAU confirmation | FRED, LBMA, exchange data, or licensed redistributors | `terms_review_needed` | Cross-asset confirmation for real-rate, dollar, and stress regimes. | Candidate score status until source choice, cadence, and redistribution rules are reviewed. |
| Equity breadth | Exchange, index-provider, or licensed market-data sources | `terms_review_needed` | Internal equity-market confirmation and risk breadth. | Candidate score status until source terms, calculation method, and redistribution rules are reviewed. |
| Term premium | Federal Reserve Bank of New York or other model providers | `terms_review_needed` | Yield-driver decomposition and rate-regime context. | Candidate score status until source terms, model attribution, and static redistribution rules are reviewed. |
| Valuation | S&P, MSCI, FactSet, Robert Shiller dataset, or other providers | `terms_review_needed` | Long-term macro climate and expected-return context. | Candidate score status until source coverage, calculation method, and redistribution rules are reviewed. |
| Treasury supply | U.S. Treasury, TreasuryDirect, or fiscal-data APIs | `terms_review_needed` | Issuance, auction, and duration-supply pressure. | Candidate score status until source endpoints, transformation rules, and redistribution expectations are reviewed. |
| PMIs/SLOOS | ISM, S&P Global, Federal Reserve, or FRED mirrors | `terms_review_needed` | Business-cycle breadth and lending-standards confirmation. | Candidate score status until survey terms, redistribution rules, and permitted derived publication are reviewed. |

## PR 2 Tactical Source Gates

PR 2 tactical panels expose source-readiness gaps for options sentiment, VX futures readiness, and event risk while source access is reviewed. Each row remains `terms_review_needed` until source terms, automation constraints, attribution, cadence, historical coverage, and static redistribution rules are documented.

These candidate rows are displayed as source gaps. They do not affect active scores, regime labels, checklist states, or confidence except as documented source-readiness gaps.

| Candidate family | Candidate rows | Provider candidates | Access status | Source-readiness use | Review notes |
| --- | --- | --- | --- | --- | --- |
| Put/call categories | Total, index, equity, ETP, VIX, SPX, SPXW | OCC, Cboe, exchanges, or licensed redistributors | `terms_review_needed` | Options sentiment coverage and category-level source gaps. | Confirm category definitions, historical access, redistribution rules, and automated ingestion terms. |
| VIX futures curve | VX1, VX2, VX3, VX4, VX5, VX6, VX7, VX8 | Cboe Futures Exchange or licensed redistributors | `terms_review_needed` | VX futures readiness and volatility term-structure source gaps. | Confirm delayed-data constraints, contract roll handling, access terms, attribution, and static redistribution rules. |
| Event calendar families | CPI, FOMC, payrolls, Treasury auctions, OPEX | BLS, Federal Reserve, Treasury, OCC, exchanges, or official calendars | `terms_review_needed` | Event-risk source gaps and calendar-readiness context. | Confirm official machine-readable endpoints, update cadence, historical coverage, attribution, and redistribution expectations. |

## Source Handling

- Cboe and FRED data are fetched by Python scripts, then normalized into static JSON.
- FRED graph CSV endpoints do not require API keys or secrets.
- CFTC positioning data is fetched from public historical compressed text files and transformed into static JSON. The CFTC source index is `https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm`.
- Data freshness is validated against each series' expected cadence and maximum stale-day threshold.
- The generated catalog and status files expose source URLs, expected frequencies, and freshness notes for the frontend.
