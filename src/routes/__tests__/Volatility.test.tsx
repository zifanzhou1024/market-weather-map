/**
 * D3: FocusBlock placement tests for Volatility route.
 *
 * These tests verify the conditional rendering of FocusBlock based on the
 * sections array in page_insights.json. The route renders FocusBlock only
 * when a section with id="volatility_complex" is present in the loaded
 * page insights; otherwise it is absent.
 *
 * Fixtures used:
 *   volatility_complete.json  — sections includes volatility_complex
 *   volatility_minimal.json   — sections includes volatility_complex (min fields)
 *
 * Mock data approach: vi.mock("../../lib/data") intercepts all data loading.
 * All heavy async loaders (loadCatalog, loadDataStatus, loadSeries, etc.)
 * return minimal stubs so the route can mount without network.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Volatility from "../Volatility";
import volatilityComplete from "../../__fixtures__/page_insights/volatility_complete.json";
import volatilityMinimal from "../../__fixtures__/page_insights/volatility_minimal.json";
import type { PageInsightsFile } from "../../lib/types";

// Stub echarts modular imports — jsdom has no canvas.
vi.mock("echarts/core", () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn()
  })),
  use: vi.fn()
}));
vi.mock("echarts/charts", () => ({
  LineChart: {},
  BarChart: {},
  HeatmapChart: {},
  ScatterChart: {}
}));
vi.mock("echarts/components", () => ({
  TitleComponent: {},
  TooltipComponent: {},
  GridComponent: {},
  LegendComponent: {},
  MarkLineComponent: {},
  MarkAreaComponent: {},
  DataZoomComponent: {},
  VisualMapComponent: {}
}));
vi.mock("echarts/renderers", () => ({
  CanvasRenderer: {}
}));

vi.mock("../../lib/data", () => ({
  loadCatalog: vi.fn(),
  loadDataStatus: vi.fn(),
  loadPageInsights: vi.fn(),
  loadSeries: vi.fn(),
  loadVolatilityDashboard: vi.fn()
}));

// routeSeries helpers used by Volatility.
vi.mock("../routeSeries", () => ({
  loadRouteDerivedSeries: vi.fn()
}));

import {
  loadCatalog,
  loadDataStatus,
  loadPageInsights,
  loadSeries,
  loadVolatilityDashboard
} from "../../lib/data";
import { loadRouteDerivedSeries } from "../routeSeries";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return container;
}

async function flushPromises() {
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function minimalSeriesFile(seriesId: string) {
  return {
    frequency: "daily",
    generated_at_utc: "2026-05-11T00:00:00Z",
    observations: [{ date: "2026-05-11", value: 17.1, percentile_252d: 42 }],
    series_id: seriesId,
    source: "Cboe",
    source_url: "https://example.com",
    summary: {
      change_1d: null,
      change_1m: null,
      change_1w: null,
      latest_date: "2026-05-11",
      latest_value: 17.1,
      percentile_252d: 42
    },
    units: "index"
  };
}

function minimalStatus() {
  return { generated_at_utc: "2026-05-11T00:00:00Z", series: {}, updates: [] };
}

function minimalCatalog() {
  return [];
}

function setupDataMocks() {
  vi.mocked(loadCatalog).mockResolvedValue(minimalCatalog() as never);
  vi.mocked(loadDataStatus).mockResolvedValue(minimalStatus() as never);
  vi.mocked(loadSeries).mockResolvedValue(minimalSeriesFile("vix") as never);
  vi.mocked(loadVolatilityDashboard).mockResolvedValue(null);
  vi.mocked(loadRouteDerivedSeries).mockResolvedValue([]);
}

describe("Volatility route — FocusBlock placement (D3)", () => {
  it("renders FocusBlock when sections includes volatility_complex", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(volatilityComplete as PageInsightsFile);

    const container = render(<Volatility />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();

    // Check the section data flows through correctly
    expect(container.textContent).toContain(
      "What is the vol surface signaling about near-term risk appetite?"
    );
    expect(container.textContent).toContain(
      "The VIX term structure is in contango"
    );
  });

  it("renders FocusBlock from minimal fixture (only required fields)", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(volatilityMinimal as PageInsightsFile);

    const container = render(<Volatility />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();
    expect(container.textContent).toContain(
      "What is the vol surface signaling about near-term risk appetite?"
    );
  });

  it("does NOT render FocusBlock when loadPageInsights resolves null", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(null);

    const container = render(<Volatility />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when sections array is absent from route insight", async () => {
    setupDataMocks();
    const fileWithoutSections: PageInsightsFile = {
      generated_at_utc: "2026-05-11T00:00:00Z",
      date: "2026-05-11",
      method_version: "1.0.0",
      routes: {
        volatility: {
          title: "Volatility",
          state: "support",
          why_it_matters: "VIX is calm.",
          confidence: 0.9,
          freshness_notes: []
          // sections intentionally absent
        }
      }
    };
    vi.mocked(loadPageInsights).mockResolvedValue(fileWithoutSections);

    const container = render(<Volatility />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when sections exist but no entry matches volatility_complex", async () => {
    setupDataMocks();
    const fileWithWrongId: PageInsightsFile = {
      generated_at_utc: "2026-05-11T00:00:00Z",
      date: "2026-05-11",
      method_version: "1.0.0",
      routes: {
        volatility: {
          title: "Volatility",
          state: "support",
          why_it_matters: "VIX is calm.",
          confidence: 0.9,
          freshness_notes: [],
          sections: [
            {
              id: "rates_pressure", // wrong id — should not match volatility_complex
              eyebrow: "Wrong section",
              question: "Wrong question?",
              answer: "Wrong answer.",
              freshness_status: "ok"
            }
          ]
        }
      }
    };
    vi.mocked(loadPageInsights).mockResolvedValue(fileWithWrongId);

    const container = render(<Volatility />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when loadPageInsights rejects", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockRejectedValue(new Error("network error"));

    const container = render(<Volatility />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });
});
