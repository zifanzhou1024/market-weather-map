import pytest

from scripts.ingest import fetch_cboe
from scripts.ingest import fetch_fred_csv
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
