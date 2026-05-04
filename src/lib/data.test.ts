import { afterEach, describe, expect, it, test, vi } from "vitest";
import { DataLoadError, loadJson, loadSeries } from "./data";
import type { DataStatusFile, SeriesCatalogEntry } from "./types";

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
