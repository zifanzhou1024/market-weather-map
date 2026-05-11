import scripts.update_data as mod


def test_modules_list_contains_existing_paths():
    expected = [
        "scripts.ingest.fetch_cboe",
        "scripts.ingest.fetch_fred_csv",
        "scripts.ingest.fetch_treasury",
        "scripts.ingest.fetch_cftc",
        "scripts.transform.normalize_series",
        "scripts.transform.compute_percentiles",
        "scripts.transform.compute_regime_score",
        "scripts.transform.build_signal_priority",
        "scripts.transform.build_page_insights",
        "scripts.transform.build_volatility_dashboard",
        "scripts.transform.build_rates_dashboard",
        "scripts.transform.build_regime_dashboard",
        "scripts.generate_macro_calendar",
        "scripts.validate.validate_schema",
        "scripts.validate.validate_freshness",
    ]
    for path in expected:
        assert path in mod.MODULES, f"missing {path} in MODULES"


def test_modules_order_ingest_transform_validate():
    indices = {p: i for i, p in enumerate(mod.MODULES)}
    assert indices["scripts.ingest.fetch_cboe"] < indices["scripts.transform.normalize_series"]
    assert indices["scripts.transform.normalize_series"] < indices["scripts.validate.validate_schema"]


def test_sub_lists_exist():
    assert hasattr(mod, "MODULES_INGEST_EXISTING")
    assert hasattr(mod, "MODULES_INGEST_PHASE_B_OFFICIAL")
    assert hasattr(mod, "MODULES_INGEST_PHASE_B_CBOE")
    assert hasattr(mod, "MODULES_INGEST_PHASE_B_SENTIMENT")
    assert hasattr(mod, "MODULES_INGEST_PHASE_C_TRADINGVIEW")
    assert hasattr(mod, "MODULES_TRANSFORM_EXISTING")
    assert hasattr(mod, "MODULES_TRANSFORM_PHASE_B")
    assert hasattr(mod, "MODULES_VALIDATE")


def test_sub_lists_are_lists():
    for name in [
        "MODULES_INGEST_EXISTING",
        "MODULES_INGEST_PHASE_B_OFFICIAL",
        "MODULES_INGEST_PHASE_B_CBOE",
        "MODULES_INGEST_PHASE_B_SENTIMENT",
        "MODULES_INGEST_PHASE_C_TRADINGVIEW",
        "MODULES_TRANSFORM_EXISTING",
        "MODULES_TRANSFORM_PHASE_B",
        "MODULES_VALIDATE",
    ]:
        assert isinstance(getattr(mod, name), list), name
