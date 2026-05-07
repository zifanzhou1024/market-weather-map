import json
from pathlib import Path

from scripts.shared import catalog as catalog_module
from scripts.shared.catalog import catalog_entries


PHASE3_FRED_SERIES = {
    "high_yield_oas": "BAMLH0A0HYM2",
    "investment_grade_oas": "BAMLC0A0CM",
    "bbb_oas": "BAMLC0A4CBBB",
    "real_yield_10y": "DFII10",
    "real_yield_5y": "DFII5",
    "breakeven_10y": "T10YIE",
    "breakeven_5y": "T5YIE",
    "forward_inflation_5y5y": "T5YIFR",
    "cfnai": "CFNAI",
    "cfnai_3m_avg": "CFNAIMA3",
    "real_retail_sales": "RRSFS",
    "industrial_production": "INDPRO",
    "durable_goods_orders": "DGORDER",
    "unemployment_rate": "UNRATE",
    "nonfarm_payrolls": "PAYEMS",
    "initial_claims": "ICSA",
    "sahm_rule": "SAHMREALTIME",
    "headline_cpi": "CPIAUCSL",
    "core_cpi": "CPILFESL",
    "core_pce": "PCEPILFE",
    "ppi_final_demand": "PPIFIS",
    "broad_dollar": "DTWEXBGS",
    "usdjpy": "DEXJPUS",
    "eurusd": "DEXUSEU",
    "reserve_balances": "WRESBAL",
    "bank_credit": "TOTBKCR",
    "loans_and_leases": "TOTLL",
    "business_loans": "BUSLOANS",
    "bank_deposits": "DPSACBW027SBOG",
}


ALLOWED_REGIME_ROLES = {
    "real_yield",
    "nominal_yield",
    "inflation_expectation",
    "dollar",
    "credit",
    "volatility",
    "liquidity",
    "growth",
    "labor",
    "housing",
    "commodity",
    "sentiment",
    "tail_risk",
    "bond_volatility",
    "banking",
}


def test_phase2_catalog_contains_no_secret_commodity_sources():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    assert entries["wti_crude"]["endpoint_url"].endswith("DCOILWTICO")
    assert entries["brent_crude"]["endpoint_url"].endswith("DCOILBRENTEU")
    assert entries["corn_price"]["endpoint_url"].endswith("PMAIZMTUSDM")
    assert entries["wheat_price"]["endpoint_url"].endswith("PWHEAMTUSDM")
    assert entries["soybean_price"]["endpoint_url"].endswith("PSOYBUSDM")
    assert entries["corn_price"]["frequency"] == "monthly"
    assert entries["soybean_price"]["max_stale_days"] == 75


def test_phase2_catalog_contains_cftc_positioning_sources():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    asset_mgr = entries["cftc_sp500_asset_mgr_net"]
    lev_money = entries["cftc_sp500_lev_money_net"]

    assert asset_mgr["source"] == "CFTC"
    assert lev_money["source"] == "CFTC"
    assert asset_mgr["category"] == "sentiment"
    assert lev_money["frequency"] == "weekly"
    assert "HistoricalCompressed" in str(asset_mgr["source_url"])


def test_available_catalog_entries_excludes_pending_series_files(tmp_path, monkeypatch):
    series_dir = tmp_path / "series"
    series_dir.mkdir()
    (series_dir / "vix.json").write_text("{}", encoding="utf-8")

    monkeypatch.setattr(catalog_module, "data_dir", lambda: tmp_path, raising=False)

    full_entries = {str(entry["id"]) for entry in catalog_entries()}
    available_entries = {str(entry["id"]) for entry in catalog_module.available_catalog_entries()}

    assert "cftc_sp500_asset_mgr_net" in full_entries
    assert "cftc_sp500_asset_mgr_net" not in available_entries
    assert available_entries == {"vix"}


def test_checked_in_catalog_artifact_includes_phase2_metadata():
    catalog_path = Path("public/data/catalog/series_catalog.json")
    entries = {str(entry["id"]): entry for entry in json.loads(catalog_path.read_text())}

    assert "wti_crude" in entries
    assert "cftc_sp500_asset_mgr_net" in entries


def test_checked_in_source_registry_artifact_includes_access_metadata():
    registry_path = Path("public/data/catalog/source_registry.json")
    registry = json.loads(registry_path.read_text())

    assert registry["fred"]["access_status"] == "free_public"


def test_checked_in_catalog_artifact_includes_phase3_governance_metadata():
    catalog_path = Path("public/data/catalog/series_catalog.json")
    entries = {str(entry["id"]): entry for entry in json.loads(catalog_path.read_text())}

    assert entries["vix"]["provider_id"] == "cboe"
    assert entries["vix"]["score_status"] == "active"
    assert entries["ism_manufacturing_pmi"]["score_status"] == "candidate"


def test_checked_in_catalog_artifact_matches_generated_catalog_ids():
    catalog_path = Path("public/data/catalog/series_catalog.json")
    checked_in_ids = {
        str(entry["id"]) for entry in json.loads(catalog_path.read_text(encoding="utf-8"))
    }
    generated_ids = {str(entry["id"]) for entry in catalog_entries()}

    assert checked_in_ids == generated_ids
    assert {"vvix", "vix9d", "vix3m", "high_yield_oas", "broad_dollar"} <= checked_in_ids


def test_checked_in_catalog_artifact_uses_dollar_category_for_phase3_dollar_series():
    catalog_path = Path("public/data/catalog/series_catalog.json")
    entries = {
        str(entry["id"]): entry for entry in json.loads(catalog_path.read_text(encoding="utf-8"))
    }

    for series_id in ("broad_dollar", "usdjpy", "eurusd"):
        assert entries[series_id]["category"] == "dollar"


def test_catalog_entries_include_phase3_governance_fields():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    vix = entries["vix"]
    assert vix["provider_id"] == "cboe"
    assert vix["access_status"] == "free_public"
    assert vix["terms_status"] == "ok"
    assert vix["score_status"] == "active"
    assert isinstance(vix["citation_notes"], str)


def test_catalog_entries_include_horizon_regime_metadata():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    assert entries["vix"]["horizon"] == "tactical"
    assert entries["vix"]["regime_role"] == ["volatility"]
    assert entries["vix"]["preferred_chart"] == "curve"

    assert entries["real_yield_10y"]["horizon"] == "both"
    assert entries["real_yield_10y"]["regime_role"] == ["real_yield"]
    assert entries["real_yield_10y"]["preferred_chart"] == "decomposition"

    assert entries["cfnai"]["horizon"] == "strategic"
    assert entries["cfnai"]["regime_role"] == ["growth"]
    assert entries["cfnai"]["preferred_chart"] == "line"


def test_catalog_regime_roles_match_frontend_contract():
    unexpected_roles = {
        role
        for entry in catalog_entries()
        for role in entry.get("regime_role", [])
        if role not in ALLOWED_REGIME_ROLES
    }

    assert unexpected_roles == set()


def test_catalog_entries_include_phase3_active_fred_macro_series():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    for series_id, fred_id in PHASE3_FRED_SERIES.items():
        entry = entries[series_id]
        assert entry["provider_id"] == "fred"
        assert entry["access_status"] == "free_public"
        assert entry["score_status"] == "active"
        assert entry["endpoint_url"].endswith(fred_id)


def test_phase4_catalog_contains_active_housing_sources():
    entries = {entry["id"]: entry for entry in catalog_module.catalog_entries()}
    expected_sources = {
        "housing_starts": "HOUST",
        "building_permits": "PERMIT",
        "mortgage_rate_30y": "MORTGAGE30US",
    }

    for series_id, fred_id in expected_sources.items():
        entry = entries[series_id]
        assert entry["category"] == "housing"
        assert entry["source"] == "FRED"
        assert entry["source_url"] == f"https://fred.stlouisfed.org/series/{fred_id}"
        assert entry["endpoint_url"] == f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fred_id}"
        assert entry["public"] is True
        assert entry["score_status"] == "active"
        assert entry["access_status"] == "free_public"
        assert entry["terms_status"] == "review_each_series"


def test_phase4_catalog_contains_consumer_and_fiscal_candidates_only():
    entries = {entry["id"]: entry for entry in catalog_module.catalog_entries()}
    active_ids = {entry["id"] for entry in catalog_module.available_catalog_entries()}
    fiscaldata_url = "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/"
    expected_candidates = {
        "real_disposable_personal_income": (
            "FRED",
            "https://fred.stlouisfed.org/series/DSPIC96",
        ),
        "personal_saving_rate": ("FRED", "https://fred.stlouisfed.org/series/PSAVERT"),
        "total_consumer_credit": ("FRED", "https://fred.stlouisfed.org/series/TOTALSL"),
        "revolving_consumer_credit": ("FRED", "https://fred.stlouisfed.org/series/REVOLSL"),
        "household_debt_service_ratio": ("FRED", "https://fred.stlouisfed.org/series/DSR"),
        "monthly_treasury_receipts": ("FiscalData", fiscaldata_url),
        "monthly_treasury_outlays": ("FiscalData", fiscaldata_url),
        "monthly_treasury_deficit_surplus": ("FiscalData", fiscaldata_url),
        "treasury_interest_expense": ("FiscalData", fiscaldata_url),
        "treasury_auction_supply": (
            "TreasuryDirect",
            "https://www.treasuryauctions.gov/auctions/when-auctions-happen/",
        ),
    }

    for series_id, (source, source_url) in expected_candidates.items():
        entry = entries[series_id]
        assert entry["source"] == source
        assert entry["source_url"] == source_url
        assert entry["score_status"] == "candidate"
        assert entry["public"] is False
        assert entry["access_status"] == "terms_review_needed"
        assert entry["terms_status"] == "review_needed"
        assert series_id not in active_ids


def test_catalog_entries_use_dollar_category_for_phase3_dollar_series():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    for series_id in ("broad_dollar", "usdjpy", "eurusd"):
        assert entries[series_id]["category"] == "dollar"


def test_oas_series_include_source_specific_citation_notes():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    for series_id in ("high_yield_oas", "investment_grade_oas", "bbb_oas"):
        entry = entries[series_id]
        assert entry["score_status"] == "active"
        assert "FRED graph CSV" in str(entry["citation_notes"])
        assert "source-specific citation and terms review" in str(entry["citation_notes"])


def test_catalog_entries_include_expanded_cboe_volatility_series():
    entries = {str(entry["id"]): entry for entry in catalog_entries()}

    expected_files = {
        "vix": "VIX_History.csv",
        "vvix": "VVIX_History.csv",
        "vix9d": "VIX9D_History.csv",
        "vix3m": "VIX3M_History.csv",
    }
    expected_value_columns = {
        "vix": ("CLOSE", "VIX"),
        "vvix": ("CLOSE", "VVIX"),
        "vix9d": ("CLOSE", "VIX9D"),
        "vix3m": ("CLOSE", "VIX3M"),
    }

    for series_id, filename in expected_files.items():
        entry = entries[series_id]
        assert entry["provider_id"] == "cboe"
        assert entry["access_status"] == "free_public"
        assert entry["score_status"] == "active"
        assert str(entry["endpoint_url"]).endswith(filename)
        assert tuple(entry["value_columns"]) == expected_value_columns[series_id]


def test_catalog_can_include_candidate_sources_without_making_them_available(tmp_path, monkeypatch):
    series_dir = tmp_path / "series"
    series_dir.mkdir()
    monkeypatch.setattr(catalog_module, "data_dir", lambda: tmp_path, raising=False)

    entries = {str(entry["id"]): entry for entry in catalog_entries()}
    assert entries["ism_manufacturing_pmi"]["score_status"] == "candidate"
    assert entries["ism_manufacturing_pmi"]["access_status"] == "terms_review_needed"
    assert "ism_manufacturing_pmi" not in {
        str(entry["id"]) for entry in catalog_module.available_catalog_entries()
    }


def test_available_catalog_entries_excludes_candidate_even_if_series_file_exists(tmp_path, monkeypatch):
    series_dir = tmp_path / "series"
    series_dir.mkdir()
    (series_dir / "ism_manufacturing_pmi.json").write_text("{}", encoding="utf-8")
    (series_dir / "vix.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(catalog_module, "data_dir", lambda: tmp_path, raising=False)

    available_entries = {str(entry["id"]) for entry in catalog_module.available_catalog_entries()}

    assert "vix" in available_entries
    assert "ism_manufacturing_pmi" not in available_entries
