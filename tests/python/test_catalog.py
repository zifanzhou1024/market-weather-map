from scripts.shared import catalog as catalog_module
from scripts.shared.catalog import catalog_entries


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
