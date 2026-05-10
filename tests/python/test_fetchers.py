import pytest

from scripts.ingest import fetch_cboe
from scripts.ingest import fetch_fred_csv
from scripts.ingest import fetch_treasury
from scripts.ingest.fetch_fred_csv import normalize_fred_rows
from scripts.shared.catalog import FRED_SERIES, catalog_entries


def test_catalog_includes_active_public_fred_oas_sources():
    catalog_text = repr(catalog_entries()) + repr(FRED_SERIES)

    assert "financial_stress" in catalog_text
    assert "financial_conditions" in catalog_text
    assert "STLFSI4" in catalog_text
    assert "NFCI" in catalog_text
    assert "high_yield_oas" in catalog_text
    assert "investment_grade_oas" in catalog_text
    assert "BAMLH0A0HYM2" in catalog_text
    assert "BAMLC0A0CM" in catalog_text


def test_normalize_fred_rows_requires_expected_fred_column():
    rows = [{"observation_date": "2026-04-30", "OTHER": "1.25"}]

    with pytest.raises(ValueError, match="missing expected FRED column DGS10"):
        normalize_fred_rows(rows, "DGS10")


def test_normalize_fred_rows_rejects_all_missing_observations():
    rows = [
        {"observation_date": "2026-04-29", "DGS10": "."},
        {"observation_date": "2026-04-30", "DGS10": ""},
    ]

    with pytest.raises(ValueError, match="no observations parsed for DGS10"):
        normalize_fred_rows(rows, "DGS10")


def test_active_fred_series_excludes_candidate_and_non_public_entries(monkeypatch):
    monkeypatch.setattr(
        fetch_fred_csv,
        "FRED_SERIES",
        [
            {"id": "active_default", "fred_id": "ACTIVE"},
            {
                "id": "generated_candidate",
                "fred_id": "CANDIDATE",
                "score_status": "candidate",
                "access_status": "free_public",
                "generate_static": True,
            },
            {"id": "terms_review", "fred_id": "TERMS", "access_status": "terms_review_needed"},
            {
                "id": "active_explicit",
                "fred_id": "EXPLICIT",
                "score_status": "active",
                "access_status": "free_public",
            },
        ],
    )

    active_ids = {str(series["id"]) for series in fetch_fred_csv.active_fred_series()}

    assert active_ids == {"active_default", "active_explicit"}


def test_generated_fred_series_includes_explicit_free_public_candidates(monkeypatch):
    monkeypatch.setattr(
        fetch_fred_csv,
        "FRED_SERIES",
        [
            {"id": "active_default", "fred_id": "ACTIVE"},
            {
                "id": "generated_candidate",
                "fred_id": "CANDIDATE",
                "score_status": "candidate",
                "access_status": "free_public",
                "generate_static": True,
            },
            {
                "id": "plain_candidate",
                "fred_id": "PLAIN",
                "score_status": "candidate",
                "access_status": "free_public",
            },
            {
                "id": "terms_candidate",
                "fred_id": "TERMS",
                "score_status": "candidate",
                "access_status": "terms_review_needed",
                "generate_static": True,
            },
        ],
    )

    generated_ids = {str(series["id"]) for series in fetch_fred_csv.generated_fred_series()}

    assert generated_ids == {"active_default", "generated_candidate"}


def test_normalize_vix_rows_requires_date_and_close_columns():
    with pytest.raises(ValueError, match="missing required VIX columns"):
        fetch_cboe.normalize_vix_rows([{"timestamp": "2026-04-30", "last": "16.5"}])


def test_normalize_vix_rows_rejects_empty_observations():
    rows = [{"DATE": "2026-04-30", "CLOSE": "."}]

    with pytest.raises(ValueError, match="no observations parsed for vix"):
        fetch_cboe.normalize_vix_rows(rows)


def test_normalize_cboe_rows_accepts_close_column_and_iso_dates():
    rows = [{"DATE": "2026-04-30", "CLOSE": "16.5"}]

    assert fetch_cboe.normalize_cboe_rows(rows, "vix", ("CLOSE", "VIX")) == [
        {"date": "2026-04-30", "value": 16.5}
    ]


def test_normalize_cboe_rows_accepts_series_specific_value_columns():
    rows = [{"DATE": "04/30/2026", "VVIX": "88.25"}]

    assert fetch_cboe.normalize_cboe_rows(rows, "vvix", ("CLOSE", "VVIX")) == [
        {"date": "2026-04-30", "value": 88.25}
    ]


def test_normalize_mts_table_1_rows_builds_monthly_fiscal_series():
    rows = [
        {
            "record_date": "2026-03-31",
            "record_fiscal_year": "2026",
            "classification_desc": "October",
            "current_month_gross_rcpt_amt": "326770236058.10",
            "current_month_gross_outly_amt": "584220273025.31",
            "current_month_dfct_sur_amt": "257450036967.21",
        },
        {
            "record_date": "2026-03-31",
            "record_fiscal_year": "2026",
            "classification_desc": "Year-to-Date",
            "current_month_gross_rcpt_amt": "5234616472030.91",
            "current_month_gross_outly_amt": "7009985661849.26",
            "current_month_dfct_sur_amt": "1775369189818.35",
        },
        {
            "record_date": "2026-03-31",
            "record_fiscal_year": "2026",
            "classification_desc": "April",
            "current_month_gross_rcpt_amt": "850169317772.81",
            "current_month_gross_outly_amt": "591769368657.85",
            "current_month_dfct_sur_amt": "-258399949114.96",
        },
        {
            "record_date": "2026-03-31",
            "record_fiscal_year": "2026",
            "classification_desc": "March",
            "current_month_gross_rcpt_amt": "367645430943.32",
            "current_month_gross_outly_amt": "528173752442.68",
            "current_month_dfct_sur_amt": "160528321499.36",
        },
    ]

    normalized = fetch_treasury.normalize_mts_table_1_rows(rows)

    assert normalized["monthly_treasury_receipts"] == [
        {"date": "2025-10-31", "value": 326770.2361},
        {"date": "2026-03-31", "value": 367645.4309},
    ]
    assert normalized["monthly_treasury_outlays"] == [
        {"date": "2025-10-31", "value": 584220.273},
        {"date": "2026-03-31", "value": 528173.7524},
    ]
    assert normalized["monthly_treasury_deficit_surplus"] == [
        {"date": "2025-10-31", "value": 257450.037},
        {"date": "2026-03-31", "value": 160528.3215},
    ]


def test_normalize_auction_rows_groups_offering_amount_by_auction_week():
    rows = [
        {
            "auction_date": "2026-05-13",
            "security_type": "Bond",
            "security_term": "30-Year",
            "offering_amt": "25000000000",
        },
        {
            "auction_date": "2026-05-14",
            "security_type": "Bill",
            "security_term": "8-Week",
            "offering_amt": "80000000000",
        },
        {
            "auction_date": "2026-05-13",
            "security_type": "Note",
            "security_term": "10-Year",
            "offering_amt": "42000000000",
        },
        {
            "auction_date": "2026-05-21",
            "security_type": "Bill",
            "security_term": "4-Week",
            "offering_amt": "null",
        },
    ]

    normalized = fetch_treasury.normalize_auction_supply_rows(rows, as_of_date="2026-05-20")

    assert normalized == [
        {
            "date": "2026-05-11",
            "value": 147000.0,
            "auction_count": 3,
            "security_types": ["Bill", "Bond", "Note"],
        }
    ]


def test_treasury_auction_endpoint_fetches_latest_records_first():
    assert "sort=-auction_date" in fetch_treasury.AUCTIONS_QUERY_URL


def test_normalize_auction_rows_skips_future_auction_dates():
    rows = [
        {
            "auction_date": "2026-05-08",
            "security_type": "Bill",
            "offering_amt": "70000000000",
        },
        {
            "auction_date": "2026-05-13",
            "security_type": "Bond",
            "offering_amt": "25000000000",
        },
    ]

    normalized = fetch_treasury.normalize_auction_supply_rows(rows, as_of_date="2026-05-09")

    assert normalized == [
        {
            "date": "2026-05-04",
            "value": 70000.0,
            "auction_count": 1,
            "security_types": ["Bill"],
        }
    ]
