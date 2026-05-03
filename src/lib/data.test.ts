import { afterEach, describe, expect, it, vi } from "vitest";
import { DataLoadError, loadJson, loadSeries } from "./data";

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
