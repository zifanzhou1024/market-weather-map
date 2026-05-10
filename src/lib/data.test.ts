import { afterEach, describe, expect, it, test, vi } from "vitest";
import {
  DataLoadError,
  loadJson,
  loadJsonOrNull,
  loadScoreSummary,
  loadSeries,
  loadSourceRegistry
} from "./data";
import type {
  DataStatusFile,
  PageInsightsFile,
  RatesDashboardFile,
  RegimeDashboardFile,
  RouteInsight,
  ScoreSummaryFile,
  SeriesCatalogEntry,
  SignalFreshnessStatus,
  SignalRef,
  SourceRegistryFile,
  VolatilityDashboardFile
} from "./types";

const fetchMock = vi.fn();

describe("data loaders", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("rejects absolute URLs before calling fetch", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadJson("https://example.com/data.json")).rejects.toMatchObject({
      name: "DataLoadError",
      path: "https://example.com/data.json"
    } satisfies Partial<DataLoadError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-data paths before calling fetch", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadJson("/not-data/file.json")).rejects.toMatchObject({
      name: "DataLoadError",
      path: "/not-data/file.json"
    } satisfies Partial<DataLoadError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe series IDs before calling fetch", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadSeries("../secret")).rejects.toMatchObject({
      name: "DataLoadError",
      path: "../secret"
    } satisfies Partial<DataLoadError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads safe series IDs from the static data path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ series_id: "us10y", observations: [] })
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadSeries("us10y");

    expect(fetchMock).toHaveBeenCalledWith("/data/series/us10y.json");
  });

  it("loads phase 3 static JSON contracts from safe data paths", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ generated_at_utc: "2026-05-04T00:00:00Z" })
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadScoreSummary();
    await loadSourceRegistry();

    expect(fetchMock).toHaveBeenCalledWith("/data/derived/score_summary.json");
    expect(fetchMock).toHaveBeenCalledWith("/data/catalog/source_registry.json");
  });
});

describe("loadJsonOrNull", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns parsed JSON when the response is 200", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadJsonOrNull("/data/derived/page_insights.json")).resolves.toEqual({
      ok: true
    });
    expect(fetchMock).toHaveBeenCalledWith("/data/derived/page_insights.json");
  });

  it("returns null when the response is 404", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn()
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadJsonOrNull("/data/derived/page_insights.json")).resolves.toBeNull();
  });

  it("throws DataLoadError when the response is 500", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn()
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadJsonOrNull("/data/derived/page_insights.json")).rejects.toMatchObject({
      name: "DataLoadError",
      status: 500
    } satisfies Partial<DataLoadError>);
  });

  it("throws DataLoadError when the path is invalid (matches dataPathPattern)", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadJsonOrNull("/not-data/file.json")).rejects.toMatchObject({
      name: "DataLoadError",
      path: "/not-data/file.json"
    } satisfies Partial<DataLoadError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-throws when JSON parsing fails on a present file", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected end of JSON input"))
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadJsonOrNull("/data/derived/page_insights.json")).rejects.toBeInstanceOf(
      SyntaxError
    );
  });
});

test("type contracts: SignalRef.freshness_status reuses SignalFreshnessStatus enum", () => {
  // Compile-time check: assigning an enum member to a SignalRef field must be
  // accepted; an off-spec literal must be rejected (caught by tsc strict mode).
  const freshnessOk: SignalFreshnessStatus = "ok";
  const freshnessStale: SignalFreshnessStatus = "stale";
  const freshnessUnavailable: SignalFreshnessStatus = "unavailable";
  const ref: SignalRef = {
    id: "vix_complex",
    label: "VIX / VVIX complex",
    message: "Volatility tail risk is contained.",
    why_it_matters: "Tail risk is calm.",
    severity: 25.79,
    freshness_status: freshnessOk,
    confidence: 0.99,
    source_status: "free_public"
  };
  expect(ref.freshness_status).toBe("ok");
  expect(freshnessStale).toBe("stale");
  expect(freshnessUnavailable).toBe("unavailable");
});

test("type contracts: PageInsightsFile, route insight, dashboard files compose without circular imports", () => {
  const routeInsight: RouteInsight = {
    title: "Volatility",
    state: "calm",
    why_it_matters: "Volatility tail risk is contained.",
    confidence: 0.99,
    freshness_notes: []
  };
  const file: PageInsightsFile = {
    generated_at_utc: "2026-05-10T00:00:00Z",
    date: "2026-05-10",
    method_version: "phase8-pr1-page-insights-v1",
    routes: { volatility: routeInsight }
  };
  const vol: VolatilityDashboardFile = {
    generated_at_utc: "2026-05-10T00:00:00Z",
    date: "2026-05-10",
    method_version: "phase8-pr1-volatility-dashboard-v1",
    latest_curve: [
      { tenor: "9D", value: 14.0, percentile_5y: 30 },
      { tenor: "30D", value: 16.0, percentile_5y: 35 },
      { tenor: "3M", value: 17.0, percentile_5y: 40 }
    ],
    ratio_history: [],
    hidden_stress: [],
    thresholds: {
      vix9d_vix_calm: 0.95,
      vix9d_vix_stress: 1.05,
      vix_vix3m_calm: 0.95,
      vix_vix3m_stress: 1.0,
      hidden_stress_watch: 15,
      hidden_stress_elevated: 30
    }
  };
  const rates: RatesDashboardFile = {
    generated_at_utc: "2026-05-10T00:00:00Z",
    date: "2026-05-10",
    method_version: "phase8-pr1-rates-dashboard-v1",
    yield_change_windows: {
      "1M": { nominal_10y_bps: 5, real_yield_10y_bps: 3, breakeven_10y_bps: 2, driver: "balanced" },
      "3M": { nominal_10y_bps: 15, real_yield_10y_bps: 12, breakeven_10y_bps: 3, driver: "real_yield" },
      "6M": { nominal_10y_bps: 25, real_yield_10y_bps: 5, breakeven_10y_bps: 20, driver: "breakeven" },
      "1Y": { nominal_10y_bps: 40, real_yield_10y_bps: 30, breakeven_10y_bps: 10, driver: "real_yield" }
    },
    current_decomposition: {
      nominal_10y_pct: 4.4,
      real_yield_10y_pct: 2.0,
      breakeven_10y_pct: 2.4
    },
    curve_snapshots: {
      current: [{ tenor: "10Y", value: 4.4 }],
      one_month_ago: [],
      three_months_ago: [],
      one_year_ago: []
    },
    decomposition_history: []
  };
  const regime: RegimeDashboardFile = {
    generated_at_utc: "2026-05-10T00:00:00Z",
    date: "2026-05-10",
    method_version: "phase8-pr1-regime-dashboard-v1",
    windows: { "20D": [], "60D": [], "120D": [] },
    thresholds: { real_yield_neutral_bps: 5, dollar_neutral_pct: 0.5 }
  };

  expect(file.routes.volatility?.state).toBe("calm");
  expect(vol.latest_curve).toHaveLength(3);
  expect(rates.yield_change_windows["1Y"].driver).toBe("real_yield");
  expect(regime.thresholds.real_yield_neutral_bps).toBe(5);
});

test("type contracts support monthly public data and update metadata", () => {
  const monthlyEntry: SeriesCatalogEntry = {
    id: "corn_price",
    name: "Global Corn Price",
    category: "commodities",
    source: "FRED",
    source_url: "https://fred.stlouisfed.org/series/PMAIZMTUSDM",
    endpoint_url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PMAIZMTUSDM",
    frequency: "monthly",
    units: "usd_per_metric_ton",
    higher_is: "riskier",
    public: true,
    max_stale_days: 75,
    notes: "Monthly global corn price from FRED graph CSV."
  };

  const status: DataStatusFile = {
    generated_at_utc: "2026-05-03T00:00:00Z",
    last_attempt_utc: "2026-05-03T00:00:00Z",
    last_successful_update_utc: "2026-05-02T00:00:00Z",
    overall_status: "partial",
    update_status: "failed",
    update_message: "Fetch failed; preserved previous public data files.",
    series: {}
  };

  expect(monthlyEntry.frequency).toBe("monthly");
  expect(status.update_status).toBe("failed");
});

test("type contracts support phase 3 source governance and score summary", () => {
  const catalogEntry: SeriesCatalogEntry = {
    access_status: "free_public",
    category: "growth",
    citation_notes: "FRED graph CSV, review source-specific citation fields.",
    endpoint_url: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CFNAI",
    frequency: "monthly",
    higher_is: "contextual",
    id: "cfnai",
    max_stale_days: 75,
    name: "Chicago Fed National Activity Index",
    notes: "Broad monthly activity gauge.",
    provider_id: "fred",
    public: true,
    score_status: "active",
    source: "FRED",
    source_url: "https://fred.stlouisfed.org/series/CFNAI",
    terms_status: "review_each_series",
    units: "index"
  };

  const registry: SourceRegistryFile = {
    fred: {
      access_status: "free_public",
      base_url: "https://fred.stlouisfed.org",
      name: "Federal Reserve Economic Data",
      notes: "No-secret graph CSV endpoints; review each hosted series.",
      requires_secret: false,
      terms_status: "review_each_series",
      update_cadence: "varies_by_series"
    }
  };

  const scoreSummary: ScoreSummaryFile = {
    date: "2026-05-01",
    generated_at_utc: "2026-05-04T00:00:00Z",
    method_version: "phase3-three-score-v1",
    scores: {
      market_weather: {
        bucket_scores: { credit_spreads: -20 },
        bucket_weights: { credit_spreads: 0.2 },
        confidence: 0.82,
        confidence_reasons: ["All primary credit spread data is fresh."],
        label: "Mixed",
        missing_or_stale_notes: [],
        recent_changes: ["High-yield spreads widened over the past month."],
        score: -8.4,
        top_risks: ["High-yield spreads widened over the past month."],
        top_supports: ["Reserve balances improved over the past month."]
      },
      macro_climate: {
        bucket_scores: { growth: 5 },
        bucket_weights: { growth: 0.25 },
        confidence: 0.7,
        confidence_reasons: ["Housing is a candidate input, not active."],
        label: "Mixed",
        missing_or_stale_notes: ["Housing is not active in Phase 3."],
        recent_changes: [],
        score: 2,
        top_risks: [],
        top_supports: []
      },
      fragility: {
        bucket_scores: { dollar_spike: -10 },
        bucket_weights: { dollar_spike: 0.15 },
        confidence: 0.68,
        confidence_reasons: ["Treasury bond volatility source is not active."],
        label: "Moderate",
        missing_or_stale_notes: ["MOVE is a candidate input."],
        recent_changes: [],
        score: -12,
        top_risks: ["Broad dollar strength is tightening global conditions."],
        top_supports: []
      }
    },
    conflicting_signals: ["Credit is calm while inflation momentum is elevated."],
    data_quality: {
      coverage_confidence: 0.8,
      freshness_confidence: 0.7,
      model_confidence: 0.75,
      source_confidence: 0.68,
      overall_confidence: 0.73,
      reasons: ["Sentiment is limited to CFTC positioning."]
    }
  };

  expect(catalogEntry.score_status).toBe("active");
  expect(registry.fred.terms_status).toBe("review_each_series");
  expect(scoreSummary.scores.market_weather.confidence).toBe(0.82);
});
