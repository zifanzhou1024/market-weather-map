# ICE MOVE Source Review

## Candidate Use

Bond-volatility fragility context using the ICE BofA MOVE Index if an approved licensed data path exists.

## Review Answers

Source owner: ICE Data Indices.
Official page / documentation reviewed: ICE Data Indices MOVE Index catalog https://developer.ice.com/fixed-income-data-services/catalog/ice-data-indices-move-index and ICE index-data terms https://www.ice.com/publicdocs/IDI_-_Terms_and_Conditions_for_the_Index_Data_and_Custom_Index_Services.pdf.
Data format: Licensed index data delivered through ICE products such as ICE Data API, ICE Data Files, ICE Consolidated Feed, or related vendor delivery.
Historical availability: ICE describes MOVE history since 1996 with delayed, end-of-day, intraday, and historical data products.
Automated download allowed: No current project approval; automated access appears tied to ICE or vendor licensing.
Static JSON redistribution allowed: No current project approval; treat MOVE values as licensed index data not suitable for public static redistribution without written permission.
Attribution requirement: Attribute ICE Data Indices and any required ICE/BofA index marks exactly as license terms require if later approved.
API key required: No public project key is approved; ICE or vendor access may require licensed credentials.
Can it be used in browser: No; do not fetch or expose licensed ICE data from browser code.
Can it be used in GitHub Actions ingestion: No, not under the current public-static workflow without documented licensed access and redistribution rights.
Can it affect active scores now: No
Recommended catalog status: restricted
Recommended score status: candidate
Citation text: ICE MOVE is a licensed bond-volatility index candidate and is not approved for current static redistribution or scoring.
Notes / unresolved questions: A separate public bond-volatility proxy review covers a Treasury-yield realized-volatility alternative. Do not substitute MOVE values from third-party chart pages without a source-owner review.

## Decision

Keep ICE MOVE restricted and non-active for the current static dashboard unless a later licensing review approves ingestion and redistribution.
