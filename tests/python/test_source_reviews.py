import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE_REVIEWS = ROOT / "docs" / "source_reviews"
DATA_SOURCES_DOC = ROOT / "docs" / "DATA_SOURCES.md"
LIMITATIONS_DOC = ROOT / "docs" / "LIMITATIONS.md"

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

ALLOWED_SECRET_NAMES = {
    "FRED_API_KEY",
    "BLS_API_KEY",
    "BEA_API_KEY",
    "CENSUS_API_KEY",
    "EIA_API_KEY",
}

CATALOG_STATUSES = {
    "free_public",
    "terms_review_needed",
    "restricted",
    "unavailable",
}

SCORE_STATUSES = {
    "candidate",
    "unavailable",
}


def review_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parsed_review_fields(text: str) -> dict[str, str]:
    fields = {}

    for line in text.splitlines():
        for field in REQUIRED_REVIEW_FIELDS:
            if line.startswith(field):
                fields[field] = line.removeprefix(field).strip()

    return fields


def assert_review_field_has_value(fields: dict[str, str], field: str) -> str:
    assert field in fields
    assert fields[field]
    return fields[field]


def normalize_status_value(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("`", "")).strip()


def markdown_section(text: str, heading: str) -> str:
    match = re.search(
        rf"(?ms)^## {re.escape(heading)}\n(?P<section>.*?)(?=^## |\Z)",
        text,
    )

    assert match, f"Missing section: {heading}"
    return match.group("section")


def markdown_table_rows(section: str) -> dict[str, str]:
    rows = {}

    for line in section.splitlines():
        if not line.startswith("|"):
            continue

        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not cells or re.fullmatch(r"-+", cells[0]):
            continue

        rows[cells[0]] = line

    return rows


def assert_table_row_contains(
    rows: dict[str, str],
    first_cell: str,
    expected_values: tuple[str, ...],
) -> str:
    assert first_cell in rows
    row = rows[first_cell]

    for expected in expected_values:
        assert expected in row

    return row


def test_required_source_review_files_exist():
    present = {path.name for path in SOURCE_REVIEWS.glob("*.md")}

    assert REQUIRED_REVIEW_FILES <= present


def test_source_review_readme_defines_template_and_status_taxonomy():
    readme = review_text(SOURCE_REVIEWS / "README.md").lower()

    for field in REQUIRED_REVIEW_FIELDS:
        assert field.lower() in readme

    for status in (
        "free_public",
        "terms_review_needed",
        "restricted",
        "unavailable",
    ):
        assert status in readme

    assert "not legal advice" in readme
    assert "browser" in readme
    assert "github actions" in readme


def test_source_review_docs_answer_governance_questions():
    for filename in sorted(REQUIRED_REVIEW_FILES - {"README.md"}):
        text = review_text(SOURCE_REVIEWS / filename)
        fields = parsed_review_fields(text)

        for field in REQUIRED_REVIEW_FIELDS:
            assert_review_field_has_value(fields, field)

        assert "Can it affect active scores now: No" in text
        catalog_status = normalize_status_value(fields["Recommended catalog status:"])
        score_status = normalize_status_value(fields["Recommended score status:"])

        assert catalog_status in CATALOG_STATUSES
        assert score_status in SCORE_STATUSES


def test_source_review_docs_reference_secret_names_only():
    combined = "\n".join(
        review_text(path) for path in sorted(SOURCE_REVIEWS.glob("*.md"))
    )
    referenced_secret_names = set(re.findall(r"\b[A-Z][A-Z0-9_]*_API_KEY\b", combined))

    assert ALLOWED_SECRET_NAMES <= referenced_secret_names
    assert referenced_secret_names <= ALLOWED_SECRET_NAMES

    for secret_name in ALLOWED_SECRET_NAMES:
        assert not re.search(rf"\b{re.escape(secret_name)}\b\s*(?:=|:)\s*\S", combined)


def test_data_sources_summarizes_source_governance_sprint():
    text = review_text(DATA_SOURCES_DOC)

    for expected in (
        "Source Governance Sprint 1",
        "SLOOS",
        "Treasury FiscalData",
        "Bond-volatility proxy",
        "ICE MOVE",
        "FRED_API_KEY",
        "No browser provider calls",
        "Sprint 1 reviewed recommendation",
        "Current shipped catalog/status rows remain unchanged in this docs-only PR",
        "Official/public candidate",
        "Current shipped catalog/status",
    ):
        assert expected in text

    sprint_rows = markdown_table_rows(
        markdown_section(text, "Source Governance Sprint 1")
    )
    for first_cell in (
        "SLOOS",
        "Treasury FiscalData",
        "Bond-volatility proxy",
        "Event calendars",
    ):
        row = assert_table_row_contains(
            sprint_rows,
            first_cell,
            ("Official/public candidate",),
        )
        assert "Sprint 1 reviewed recommendation" in sprint_rows["Candidate family"]
        assert row.count("|") >= 5

    candidate_rows = markdown_table_rows(markdown_section(text, "Candidate Sources"))
    for first_cell in ("SLOOS", "Treasury supply", "PMIs/SLOOS"):
        assert_table_row_contains(
            candidate_rows,
            first_cell,
            (
                "terms_review_needed",
                "Current shipped catalog/status remains",
                "Source Governance Sprint 1",
            ),
        )

    pr2_rows = markdown_table_rows(markdown_section(text, "PR 2 Tactical Source Gates"))
    assert_table_row_contains(
        pr2_rows,
        "Event calendar families",
        ("terms_review_needed", "Source Governance Sprint 1"),
    )

    pr4_rows = markdown_table_rows(markdown_section(text, "PR 4 Strategic Source Gates"))
    for first_cell in (
        "PMIs and lending standards",
        "Term premium and Treasury supply",
    ):
        assert_table_row_contains(
            pr4_rows,
            first_cell,
            ("terms_review_needed", "Source Governance Sprint 1"),
        )


def test_limitations_document_api_key_and_redistribution_boundaries():
    text = review_text(LIMITATIONS_DOC)

    for expected in (
        "API-key-enabled ingestion",
        "browser must never call provider APIs directly",
        "Publicly accessible",
        "redistributable as static JSON",
    ):
        assert expected in text
