import { afterEach, describe, expect, it, test, vi } from "vitest";
import {
  DataLoadError,
  loadJson,
  loadScoreSummary,
  loadSeries,
  loadSourceRegistry
} from "./data";
import type {
  DataStatusFile,
  ScoreSummaryFile,
  SeriesCatalogEntry,
  SourceRegistryFile
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
      overall_confidence: 0.73,
      reasons: ["Sentiment is limited to CFTC positioning."]
    }
  };

  expect(catalogEntry.score_status).toBe("active");
  expect(registry.fred.terms_status).toBe("review_each_series");
  expect(scoreSummary.scores.market_weather.confidence).toBe(0.82);
});
