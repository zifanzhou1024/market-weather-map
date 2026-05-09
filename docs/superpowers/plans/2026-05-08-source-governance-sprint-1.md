# Source Governance Sprint 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auditable source-review documentation and classification tables for the next data-expansion phase without adding ingestion or scoring.

**Architecture:** This is a docs-first governance PR. It adds a source-review template, standardized review files, and summary documentation while preserving the current static GitHub Pages architecture. It may add Python documentation-structure tests, but it must not touch generated JSON, ingestion modules, scoring logic, React routes, or workflows.

**Tech Stack:** Markdown docs, Python pytest for documentation-shape checks, existing React/Vite/Vitest/Python validation suite for regression verification.

---

## Required Context

Read first:

- `docs/superpowers/specs/2026-05-08-source-governance-sprint-1-design.md`
- `docs/DATA_SOURCES.md`
- `docs/LIMITATIONS.md`
- Existing source reviews under `docs/source_reviews/`
- `tests/python/test_source_registry.py`
- `tests/python/test_tactical_candidate_sources.py`

Implementation worktree:

```text
/Users/sakura/WebstormProjects/market-weather-map/.worktrees/source-governance-sprint1
```

Branch:

```text
codex/source-governance-sprint1
```

Baseline already verified before implementation:

```text
npm run test -> 144 passed
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python -q -> 186 passed
```

## Non-Negotiable Constraints

- Do not add Python fetchers.
- Do not add or modify GitHub Actions secret wiring.
- Do not call FRED, BLS, BEA, EIA, Census, FiscalData, Cboe, ICE, NY Fed, ISM, S&P, AAII, NAAIM, Nasdaq, NYSE, or any provider.
- Do not edit generated `public/data/**/*.json`.
- Do not change catalog `score_status`, source statuses, scoring weights, generated schemas, or route behavior.
- Do not commit literal API key values. Mention secret names only:
  - `FRED_API_KEY`
  - `BLS_API_KEY`
  - `BEA_API_KEY`
  - `EIA_API_KEY`
  - `CENSUS_API_KEY`
- Do not use browser-side API calls or provider credentials.
- Do not add financial advice, forecasts, trade recommendations, entries, targets, or stop language.

## File Ownership Map

Task 1 owns:

- Create: `tests/python/test_source_reviews.py`

Task 2 owns:

- Create: `docs/source_reviews/README.md`
- Modify: `tests/python/test_source_reviews.py`

Task 3 owns official/free-public candidate review docs:

- Create: `docs/source_reviews/sloos.md`
- Create: `docs/source_reviews/regional_fed_surveys_as_pmi_proxy.md`
- Create: `docs/source_reviews/treasury_fiscal_supply.md`
- Create: `docs/source_reviews/treasury_auctions.md`
- Create: `docs/source_reviews/event_calendars.md`
- Create: `docs/source_reviews/term_premium.md`
- Create: `docs/source_reviews/bond_volatility_proxy.md`
- Create: `docs/source_reviews/business_loans_freshness.md`

Task 4 owns gated/restricted review docs:

- Create: `docs/source_reviews/ism_spglobal_pmis.md`
- Create: `docs/source_reviews/gold_xau.md`
- Create: `docs/source_reviews/equity_breadth.md`
- Create: `docs/source_reviews/aaii_naaim.md`
- Create: `docs/source_reviews/valuation_erp_earnings.md`
- Modify: `docs/source_reviews/cboe_put_call.md`
- Modify: `docs/source_reviews/cboe_skew.md`
- Modify: `docs/source_reviews/ice_move.md`
- Modify: `docs/source_reviews/ny_fed_acm_term_premium.md`
- Modify: `docs/source_reviews/vix_futures_curve.md`

Task 5 owns summary docs:

- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `tests/python/test_source_reviews.py`

Task 6 owns final verification and PR creation only.

## Chunk 1: Documentation Guardrails

### Task 1: Add Source-Review Documentation Tests

**Purpose:** Make the docs sprint verifiable so future agents cannot omit required review files or accidentally write vague reviews that do not answer the governance checklist.

**Files:**

- Create: `tests/python/test_source_reviews.py`

- [ ] **Step 1: Write the failing source-review tests**

Create `tests/python/test_source_reviews.py`:

```python
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE_REVIEWS = ROOT / "docs" / "source_reviews"

REQUIRED_REVIEW_FILES = {
    "aaii_naaim.md",
    "bond_volatility_proxy.md",
    "business_loans_freshness.md",
    "cboe_put_call.md",
    "cboe_skew.md",
    "equity_breadth.md",
    "event_calendars.md",
    "gold_xau.md",
    "ice_move.md",
    "ism_spglobal_pmis.md",
    "ny_fed_acm_term_premium.md",
    "README.md",
    "regional_fed_surveys_as_pmi_proxy.md",
    "sloos.md",
    "term_premium.md",
    "treasury_auctions.md",
    "treasury_fiscal_supply.md",
    "valuation_erp_earnings.md",
    "vix_futures_curve.md",
}

REQUIRED_REVIEW_FIELDS = (
    "Source owner:",
    "Official page / documentation reviewed:",
    "Data format:",
    "Historical availability:",
    "Automated download allowed:",
    "Static JSON redistribution allowed:",
    "Attribution requirement:",
    "API key required:",
    "Can it be used in browser:",
    "Can it be used in GitHub Actions ingestion:",
    "Can it affect active scores now:",
    "Recommended catalog status:",
    "Recommended score status:",
    "Citation text:",
    "Notes / unresolved questions:",
)


def read_review(filename: str) -> str:
    return (SOURCE_REVIEWS / filename).read_text(encoding="utf-8")


def test_required_source_review_files_exist():
    existing = {path.name for path in SOURCE_REVIEWS.glob("*.md")}

    assert REQUIRED_REVIEW_FILES <= existing


def test_source_review_readme_defines_template_and_status_taxonomy():
    body = read_review("README.md")

    for field in REQUIRED_REVIEW_FIELDS:
        assert field in body

    for status in ("free_public", "terms_review_needed", "restricted", "unavailable"):
        assert status in body

    assert "not legal advice" in body.lower()
    assert "browser" in body.lower()
    assert "github actions" in body.lower()


def test_source_review_docs_answer_governance_questions():
    review_files = REQUIRED_REVIEW_FILES - {"README.md"}

    for filename in sorted(review_files):
        body = read_review(filename)
        for field in REQUIRED_REVIEW_FIELDS:
            assert field in body, f"{filename} missing {field}"

        assert "Can it affect active scores now: No" in body
        assert "Recommended catalog status:" in body
        assert "Recommended score status:" in body


def test_source_review_docs_reference_secret_names_only():
    combined = "\n".join(
        path.read_text(encoding="utf-8")
        for path in SOURCE_REVIEWS.glob("*.md")
    )

    assert "FRED_API_KEY" in combined
    assert "BLS_API_KEY" in combined
    assert "BEA_API_KEY" in combined
    assert "CENSUS_API_KEY" in combined
    assert "EIA_API_KEY" in combined

    forbidden_assignment_fragments = (
        "FRED_API_KEY=",
        "BLS_API_KEY=",
        "BEA_API_KEY=",
        "EIA_API_KEY=",
        "CENSUS_API_KEY=",
        "FRED_API_KEY:",
        "BLS_API_KEY:",
        "BEA_API_KEY:",
        "EIA_API_KEY:",
        "CENSUS_API_KEY:",
    )
    for fragment in forbidden_assignment_fragments:
        assert fragment not in combined
```

- [ ] **Step 2: Run the failing docs test**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python/test_source_reviews.py -v
```

Expected: FAIL because the required README and review files do not exist yet.

- [ ] **Step 3: Commit the failing test**

Do not commit a failing test by itself. Keep it unstaged until Task 2 starts making it pass.

### Task 2: Add Source-Review README Template

**Purpose:** Establish a repeatable review format and status taxonomy.

**Files:**

- Create: `docs/source_reviews/README.md`
- Modify: `tests/python/test_source_reviews.py` only if the test needs wording alignment.

- [ ] **Step 1: Create the README**

Create `docs/source_reviews/README.md` with this structure:

```markdown
# Source Reviews

These files document source-governance decisions for candidate market, macro, event, and confirmation inputs.

This repository is a static public dashboard. Source reviews are implementation governance records, not legal advice.

## Status Taxonomy

| Status | Meaning |
| --- | --- |
| `free_public` | Official source/API/export path appears compatible with automated static publication, attribution is documented, and no browser key exposure is needed. |
| `terms_review_needed` | Publicly visible data exists, but automated download, static JSON redistribution, attribution, commercial use, or scoring use is unclear. |
| `restricted` | License, data agreement, benchmark license, exchange redistribution license, or paid data relationship appears necessary. |
| `unavailable` | No stable public source, no usable archive, or access is locked/paywalled. |

## Secret Handling

Future ingestion may use GitHub Actions secrets by name only:

- `FRED_API_KEY`
- `BLS_API_KEY`
- `BEA_API_KEY`
- `EIA_API_KEY`
- `CENSUS_API_KEY`

Literal key values must never be committed, logged, written to static JSON, bundled in frontend output, or sent to the browser.

## Review Template

Each source-review file should answer:

```text
Source owner:
Official page / documentation reviewed:
Data format:
Historical availability:
Automated download allowed:
Static JSON redistribution allowed:
Attribution requirement:
API key required:
Can it be used in browser:
Can it be used in GitHub Actions ingestion:
Can it affect active scores now:
Recommended catalog status:
Recommended score status:
Citation text:
Notes / unresolved questions:
```

## Scoring Rule

Candidate sources cannot affect active scores, regime labels, checklist states, or confidence until a review classifies the source as usable and a later implementation PR changes ingestion/scoring.
```

- [ ] **Step 2: Run the docs test**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python/test_source_reviews.py -v
```

Expected: still FAIL because the individual source-review files are not all present.

- [ ] **Step 3: Commit the README with the test**

```bash
git add docs/source_reviews/README.md tests/python/test_source_reviews.py
git commit -m "test: require source review governance docs"
```

## Chunk 2: Source-Review Files

### Task 3: Add Official/Public Candidate Source Reviews

**Purpose:** Document the cleaner first-pass source candidates: official government, central-bank, FRED, FiscalData, and derived public-data proxies.

**Files:**

- Create: `docs/source_reviews/sloos.md`
- Create: `docs/source_reviews/regional_fed_surveys_as_pmi_proxy.md`
- Create: `docs/source_reviews/treasury_fiscal_supply.md`
- Create: `docs/source_reviews/treasury_auctions.md`
- Create: `docs/source_reviews/event_calendars.md`
- Create: `docs/source_reviews/term_premium.md`
- Create: `docs/source_reviews/bond_volatility_proxy.md`
- Create: `docs/source_reviews/business_loans_freshness.md`

- [ ] **Step 1: Add `sloos.md`**

Use this decision shape:

```markdown
# SLOOS Source Review

## Candidate Use

Long-term credit-cycle and bank-lending-standards context.

## Review Answers

Source owner: Federal Reserve; FRED mirrors may also be used for specific series.
Official page / documentation reviewed: Federal Reserve SLOOS page and Data Download Program; FRED SLOOS-tagged series.
Data format: Federal Reserve Data Download Program export or FRED API/CSV, depending on final ingestion choice.
Historical availability: Historical survey series are available through official Fed/FRED paths.
Automated download allowed: Likely compatible through official export/API paths, but final ingestion PR must verify endpoint terms and attribution.
Static JSON redistribution allowed: Likely compatible for derived static publication with attribution, but confirm exact source-owner notices before promotion.
Attribution requirement: Attribute Federal Reserve and/or FRED plus source series identifiers.
API key required: `FRED_API_KEY` only if FRED API is used; Fed Data Download Program paths may not require a key.
Can it be used in browser: No.
Can it be used in GitHub Actions ingestion: Yes, after the ingestion PR chooses a reviewed endpoint.
Can it affect active scores now: No.
Recommended catalog status: `free_public` candidate after endpoint-specific review.
Recommended score status: `candidate` now; eligible for active scoring only in a later ingestion/scoring PR.
Citation text: Senior Loan Officer Opinion Survey on Bank Lending Practices, Federal Reserve.
Notes / unresolved questions: Select exact series, transformation direction, and release cadence before implementation.

## Decision

Promising first-pass official source. Keep current candidate rows non-scoring until a later PR implements ingestion and scoring.
```

- [ ] **Step 2: Add `regional_fed_surveys_as_pmi_proxy.md`**

Use this decision:

```text
Recommended catalog status: `free_public` candidate after endpoint-specific review.
Recommended score status: `candidate` now; eligible only after later implementation.
Key note: label as regional Fed survey proxy, not PMI.
API key required: `FRED_API_KEY` if using FRED mirror; otherwise likely no key for official regional Fed pages.
```

Include Philadelphia Fed Manufacturing Business Outlook Survey as the first named source candidate.

- [ ] **Step 3: Add `treasury_fiscal_supply.md`**

Use this decision:

```text
Source owner: U.S. Treasury FiscalData.
Data format: API/CSV/JSON depending on FiscalData endpoint.
Recommended catalog status: `free_public` candidate after endpoint-specific review.
Recommended score status: `candidate` now.
API key required: No for FiscalData unless future endpoint documentation changes.
Use: receipts, outlays, surplus/deficit, debt, cash, and fiscal pressure context.
```

- [ ] **Step 4: Add `treasury_auctions.md`**

Use this decision:

```text
Source owner: U.S. Treasury / FiscalData / TreasuryDirect.
Data format: API/CSV/JSON/TSV/XML depending on endpoint.
Recommended catalog status: `free_public` candidate after endpoint-specific review.
Recommended score status: `candidate` now.
Use: auction calendar, auction supply, bid-to-cover, high yield/stop-out, and demand context.
```

- [ ] **Step 5: Add `event_calendars.md`**

Use this decision:

```text
Source owners: Federal Reserve, BLS, BEA, Census, Treasury, CFTC.
Data format: official calendars, API, HTML, CSV, or source-linked rows depending on event family.
API key required: `BLS_API_KEY`, `BEA_API_KEY`, and `CENSUS_API_KEY` may be used for future structured ingestion; source-linked calendars may not require keys.
Recommended catalog status: `free_public` candidate for source-linked event context after endpoint review.
Recommended score status: `candidate` or non-scoring event context; no score impact now.
```

- [ ] **Step 6: Add `term_premium.md`**

Distinguish FRED Kim-Wright from NY Fed ACM:

```text
FRED Kim-Wright: likely `free_public` candidate after FRED/source-owner notice review.
NY Fed ACM: keep `terms_review_needed` unless source terms and redistribution are documented.
API key required: `FRED_API_KEY` if using FRED API; no browser usage.
```

- [ ] **Step 7: Add `bond_volatility_proxy.md`**

Use this decision:

```text
Source owner: derived internally from active public Treasury-yield series.
Recommended catalog status: `free_public` candidate.
Recommended score status: `candidate` now; active only after later implementation.
Key note: not MOVE and not an implied volatility index.
```

- [ ] **Step 8: Add `business_loans_freshness.md`**

Use this decision:

```text
Source owner: Federal Reserve / FRED H.8.
Candidate series: weekly C&I loans such as FRED `TOTCI` to supplement monthly/stale `BUSLOANS`.
Recommended catalog status: `free_public` candidate.
Recommended score status: `candidate` now; active only after later implementation.
API key required: `FRED_API_KEY` only if FRED API is used.
```

- [ ] **Step 9: Run the source-review test**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python/test_source_reviews.py -v
```

Expected: still FAIL until Task 4 adds the remaining reviews and upgrades existing docs.

- [ ] **Step 10: Commit official/public reviews**

```bash
git add docs/source_reviews/sloos.md \
  docs/source_reviews/regional_fed_surveys_as_pmi_proxy.md \
  docs/source_reviews/treasury_fiscal_supply.md \
  docs/source_reviews/treasury_auctions.md \
  docs/source_reviews/event_calendars.md \
  docs/source_reviews/term_premium.md \
  docs/source_reviews/bond_volatility_proxy.md \
  docs/source_reviews/business_loans_freshness.md
git commit -m "docs: review official source candidates"
```

### Task 4: Add Gated and Restricted Source Reviews

**Purpose:** Document why exchange, benchmark, index-provider, sentiment, valuation, and earnings inputs remain gated or likely restricted.

**Files:**

- Create: `docs/source_reviews/ism_spglobal_pmis.md`
- Create: `docs/source_reviews/gold_xau.md`
- Create: `docs/source_reviews/equity_breadth.md`
- Create: `docs/source_reviews/aaii_naaim.md`
- Create: `docs/source_reviews/valuation_erp_earnings.md`
- Modify: existing five source-review files.

- [ ] **Step 1: Add `ism_spglobal_pmis.md`**

Decision:

```text
ISM PMI: `terms_review_needed`.
S&P Global PMI: likely `restricted` for underlying data unless licensed.
Recommended score status: `candidate` or `unavailable` depending on provider path.
Can it affect active scores now: No.
```

- [ ] **Step 2: Add `gold_xau.md`**

Decision:

```text
LBMA/IBA benchmark prices: `restricted` or `terms_review_needed` unless benchmark redistribution license is documented.
Nasdaq XAU: `terms_review_needed` due index-provider/copyright concerns.
FRED-hosted alternatives may still require source-owner notice review.
Can it affect active scores now: No.
```

- [ ] **Step 3: Add `equity_breadth.md`**

Decision:

```text
Exchange proprietary breadth feeds: likely `restricted` without a redistribution license.
Percent-above-moving-average pages or vendor indicators: `terms_review_needed`.
Equal-weight/cap-weight proxy: still requires clean price/index source review.
Can it affect active scores now: No.
```

- [ ] **Step 4: Add `aaii_naaim.md`**

Decision:

```text
AAII sentiment: `terms_review_needed`.
NAAIM Exposure Index: `terms_review_needed`.
Can it affect active scores now: No.
```

- [ ] **Step 5: Add `valuation_erp_earnings.md`**

Decision:

```text
CAPE/Shiller: `terms_review_needed`.
Damodaran ERP: `terms_review_needed`.
S&P/FactSet/Zacks earnings estimates and revisions: likely `restricted` unless licensed.
Can it affect active scores now: No.
```

- [ ] **Step 6: Expand existing five reviews into the standard template**

Update:

```text
docs/source_reviews/cboe_put_call.md
docs/source_reviews/cboe_skew.md
docs/source_reviews/ice_move.md
docs/source_reviews/ny_fed_acm_term_premium.md
docs/source_reviews/vix_futures_curve.md
```

Each file must include every `REQUIRED_REVIEW_FIELDS` value from `tests/python/test_source_reviews.py`.

Expected decisions:

```text
Cboe put/call: `terms_review_needed`, candidate.
Cboe SKEW: `terms_review_needed`, candidate.
ICE MOVE: likely `restricted` or `terms_review_needed`; keep non-scoring.
NY Fed ACM: `terms_review_needed`; candidate.
VIX futures curve: `terms_review_needed`; candidate.
```

- [ ] **Step 7: Run docs tests**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python/test_source_reviews.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit gated/restricted reviews**

```bash
git add docs/source_reviews tests/python/test_source_reviews.py
git commit -m "docs: review gated source candidates"
```

## Chunk 3: Summary Docs and Final Verification

### Task 5: Update Data Sources and Limitations

**Purpose:** Give future agents and readers a one-page view of the source-governance sprint decisions without reading every review file.

**Files:**

- Modify: `docs/DATA_SOURCES.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `tests/python/test_source_reviews.py`

- [ ] **Step 1: Add failing summary-doc assertions**

Append tests to `tests/python/test_source_reviews.py`:

```python
def test_data_sources_summarizes_source_governance_sprint():
    body = (ROOT / "docs" / "DATA_SOURCES.md").read_text(encoding="utf-8")

    assert "Source Governance Sprint 1" in body
    assert "SLOOS" in body
    assert "Treasury FiscalData" in body
    assert "Bond-volatility proxy" in body
    assert "ICE MOVE" in body
    assert "FRED_API_KEY" in body
    assert "No browser provider calls" in body


def test_limitations_document_api_key_and_redistribution_boundaries():
    body = (ROOT / "docs" / "LIMITATIONS.md").read_text(encoding="utf-8")

    assert "API-key-enabled ingestion" in body
    assert "browser must never call provider APIs directly" in body
    assert "Publicly accessible" in body
    assert "redistributable as static JSON" in body
```

- [ ] **Step 2: Run the failing summary-doc assertions**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python/test_source_reviews.py -v
```

Expected: FAIL until `DATA_SOURCES.md` and `LIMITATIONS.md` are updated.

- [ ] **Step 3: Update `docs/DATA_SOURCES.md`**

Add a section after the existing candidate-source introduction or before the tactical source-gates section:

```markdown
## Source Governance Sprint 1

This sprint documents source-review decisions only. It does not add ingestion, scoring, frontend provider calls, or generated data.

No browser provider calls are allowed. Future API-key-enabled ingestion must run in GitHub Actions or locally before static publication, using secret names only.

| Source family | Initial status | Future secret use | Future active scoring eligibility | Notes |
| --- | --- | --- | --- | --- |
| SLOOS / lending standards | `free_public` candidate after endpoint review | `FRED_API_KEY` if using FRED API; otherwise none for Fed export path | Eligible only in later ingestion/scoring PR | Official Fed/FRED credit-availability source. |
| Regional Fed survey proxy | `free_public` candidate after endpoint review | `FRED_API_KEY` if using FRED mirror | Eligible only in later ingestion/scoring PR | Label as regional survey proxy, not PMI. |
| Treasury FiscalData | `free_public` candidate after endpoint review | None expected | Eligible only in later ingestion/scoring PR | Fiscal supply, receipts, outlays, deficit, debt/cash context. |
| Treasury auctions | `free_public` candidate after endpoint review | None expected | Eligible only in later ingestion/scoring PR | Auction calendar, supply, bid-to-cover, and demand context. |
| Event calendars | `free_public` candidate as source-linked context | `BLS_API_KEY`, `BEA_API_KEY`, `CENSUS_API_KEY` for future structured ingestion | Non-scoring context unless later methodology changes | Fed, BLS, BEA, Census, Treasury, and CFTC release context. |
| FRED Kim-Wright term premium | `free_public` candidate after FRED/source-owner notice review | `FRED_API_KEY` if using FRED API | Eligible only in later ingestion/scoring PR | Potential yield-driver decomposition input. |
| Business-loans freshness | `free_public` candidate after endpoint review | `FRED_API_KEY` if using FRED API | Eligible only in later ingestion/scoring PR | Weekly H.8/FRED C&I loan series can supplement monthly `BUSLOANS`. |
| Bond-volatility proxy | `free_public` candidate | None beyond active Treasury-yield source path | Eligible only in later ingestion/scoring PR | Realized Treasury-yield volatility; explicitly not MOVE. |
| Cboe / ICE / exchange / benchmark sources | `terms_review_needed` or `restricted` | None until licensed/reviewed | Not eligible now | Keep put/call, SKEW, VX futures, MOVE, gold benchmarks, and breadth gated. |
| Valuation / ERP / earnings revisions | `terms_review_needed` or `restricted` | None until reviewed | Not eligible now | Public pages do not automatically permit static redistribution. |
```

- [ ] **Step 4: Update `docs/LIMITATIONS.md`**

Add bullets under `Source Access And Review`:

```markdown
- API-key-enabled ingestion still happens before static publication. The browser must never call provider APIs directly or receive provider credentials.
- GitHub Actions secret names such as `FRED_API_KEY`, `BLS_API_KEY`, `BEA_API_KEY`, `EIA_API_KEY`, and `CENSUS_API_KEY` can support future ingestion, but literal key values must not appear in source files, static JSON, logs, or frontend bundles.
- Publicly accessible data is not automatically redistributable as static JSON. Exchange, benchmark, index, sentiment, valuation, and earnings sources require explicit review before ingestion or scoring.
```

- [ ] **Step 5: Run docs tests**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python/test_source_reviews.py -v
```

Expected: PASS.

- [ ] **Step 6: Run source-governance grep**

```bash
rg -n "api_key=.*[A-Za-z0-9]|[A-Za-z0-9_-]{32,}" docs src scripts public README.md || true
rg -n "buy|sell|short|entry|target|stop loss|recommendation|forecast" docs/source_reviews docs/DATA_SOURCES.md docs/LIMITATIONS.md || true
```

Expected:

- No literal credential values.
- Secret names are acceptable.
- Advice-language hits, if any, should be policy/limitation wording only.

- [ ] **Step 7: Commit summary docs**

```bash
git add docs/DATA_SOURCES.md docs/LIMITATIONS.md tests/python/test_source_reviews.py
git commit -m "docs: summarize source governance classifications"
```

### Task 6: Final Verification and Draft PR

**Purpose:** Verify this docs-only PR has no accidental code/data behavior changes and no secret leakage.

**Files:**

- No planned edits.

- [ ] **Step 1: Run documentation tests**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python/test_source_reviews.py -v
```

Expected: PASS.

- [ ] **Step 2: Run full Python tests**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python -v
```

Expected: PASS.

- [ ] **Step 3: Run frontend tests**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: PASS. Existing Vite chunk-size warning is acceptable unless errors appear.

- [ ] **Step 5: Run static-data validators**

```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_schema
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_freshness
```

Expected: PASS.

- [ ] **Step 6: Run secret and advice-language checks**

```bash
rg -n "api_key=.*[A-Za-z0-9]|[A-Za-z0-9_-]{32,}" docs src scripts public README.md || true
rg -n "buy|sell|short|entry|target|stop loss|recommendation|forecast" docs/source_reviews docs/DATA_SOURCES.md docs/LIMITATIONS.md || true
```

Manually inspect hits. Secret names are allowed; literal values are not. Advice-language hits must be policy/limitation context only.

- [ ] **Step 7: Check diff hygiene**

```bash
git status --short
git diff --check origin/main...HEAD
git diff --name-only origin/main...HEAD
```

Expected:

- No generated `public/data` files.
- No ingestion, scoring, workflow, or route behavior changes.
- No whitespace errors.

- [ ] **Step 8: Push and create draft PR**

```bash
git push -u origin codex/source-governance-sprint1
body_file="$(mktemp)"
printf '%s\n' \
  '## Summary' \
  '- Add a standard source-review template.' \
  '- Add source-review docs for official/public candidates and gated commercial/exchange sources.' \
  '- Summarize Source Governance Sprint 1 classifications in DATA_SOURCES and LIMITATIONS.' \
  '- Document GitHub Actions secret-name usage without adding ingestion or exposing credentials.' \
  '' \
  '## Verification' \
  '- /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python/test_source_reviews.py -v' \
  '- /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m pytest tests/python -v' \
  '- npm run test' \
  '- npm run build' \
  '- /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_schema' \
  '- /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m scripts.validate.validate_freshness' \
  '' \
  '## Governance' \
  'Docs-only source-governance PR. No ingestion, scoring, generated data, frontend provider calls, browser credentials, live feeds, forecasts, or trade recommendations.' \
  > "$body_file"
gh pr create --draft --base main --head codex/source-governance-sprint1 --title "[codex] document source governance sprint 1" --body-file "$body_file"
```

Expected: draft PR opens against `main`.
