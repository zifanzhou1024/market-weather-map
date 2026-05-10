# Valuation / ERP / Earnings Source Review

## Candidate Use

Strategic valuation context using CAPE, equity-risk-premium estimates, earnings revisions, or forward earnings after source review.

## Review Answers

Source owner: Potential owners include Robert Shiller/Yale, Aswath Damodaran/NYU Stern, S&P Dow Jones Indices, FactSet, Zacks, and other licensed earnings providers depending on the selected metric.
Official page / documentation reviewed: Robert Shiller online data page https://www.econ.yale.edu/~shiller/data.htm, Damodaran Online current data page https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html, S&P DJI data licensing page https://www.spglobal.com/spdji/en/about-us/data-index-licensing/, FactSet Consensus Estimates DataFeed page https://insight.factset.com/resources/factset-consensus-estimates-datafeed, and Zacks terms of service https://www.zacks.com/terms_of_service.
Data format: Public academic spreadsheets/pages, licensed index data packages, licensed earnings-estimates feeds, vendor APIs, or vendor files depending on source.
Historical availability: Shiller and Damodaran provide public research datasets, while S&P, FactSet, Zacks, and other licensed earnings-provider histories are generally provider-controlled products.
Automated download allowed: Not approved; each public academic page and commercial vendor source needs terms, automation, attribution, and revision-policy review.
Static JSON redistribution allowed: Not approved; public visibility or academic availability does not establish permission to republish values in static JSON.
Attribution requirement: Attribute the exact academic author, institution, vendor, index provider, model, and source series if later approved.
API key required: No public project key is approved; vendor data feeds may require licensed credentials.
Can it be used in browser: No; do not fetch academic spreadsheets or vendor estimates directly from browser code.
Can it be used in GitHub Actions ingestion: No, not until exact source terms and static redistribution treatment are documented.
Can it affect active scores now: No
Recommended catalog status: terms_review_needed
Recommended score status: candidate
Citation text: Valuation, ERP, and earnings-estimate inputs are candidate-only pending terms and redistribution review.
Notes / unresolved questions: Separate Shiller CAPE, Damodaran ERP, S&P index earnings, FactSet/Zacks or other licensed earnings estimates, and any derived ERP calculation before implementation. Do not mix academic public datasets with licensed forward-earnings estimates under one approval.

## Decision

Keep valuation, ERP, and earnings sources source-gated and non-active until source-specific reviews approve ingestion and publication.
