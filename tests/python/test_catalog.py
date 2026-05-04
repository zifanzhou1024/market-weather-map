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
