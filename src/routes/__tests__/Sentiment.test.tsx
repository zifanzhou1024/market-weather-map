/**
 * D4: FocusBlock placement tests for Sentiment route.
 *
 * These tests verify the conditional rendering of FocusBlock based on the
 * sections array in page_insights.json. The route renders FocusBlock only
 * when a section with id="positioning_vs_candidate_sentiment" is present in
 * the loaded page insights; otherwise it is absent.
 *
 * Fixtures used:
 *   sentiment_complete.json  — sections includes positioning_vs_candidate_sentiment (all optional fields)
 *   sentiment_minimal.json   — sections includes positioning_vs_candidate_sentiment (min fields only)
 *
 * Mock data approach: vi.mock("../../lib/data") intercepts all data loading.
 * All heavy async loaders return minimal stubs so the route can mount.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sentiment from "../Sentiment";
import sentimentComplete from "../../__fixtures__/page_insights/sentiment_complete.json";
import sentimentMinimal from "../../__fixtures__/page_insights/sentiment_minimal.json";
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
  loadSeries: vi.fn()
}));

import {
  loadCatalog,
  loadDataStatus,
  loadPageInsights,
  loadSeries
} from "../../lib/data";

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
    frequency: "weekly",
    generated_at_utc: "2026-05-11T00:00:00Z",
    observations: [{ date: "2026-05-09", value: 150000, percentile_252d: 60 }],
    series_id: seriesId,
    source: "CFTC",
    source_url: "https://example.com",
    summary: {
      change_1d: null,
      change_1m: null,
      change_1w: null,
      latest_date: "2026-05-09",
      latest_value: 150000,
      percentile_252d: 60
    },
    units: "contracts"
  };
}

function setupDataMocks() {
  vi.mocked(loadCatalog).mockResolvedValue([] as never);
  vi.mocked(loadDataStatus).mockResolvedValue({
    generated_at_utc: "2026-05-11T00:00:00Z",
    series: {},
    updates: []
  } as never);
  vi.mocked(loadSeries).mockResolvedValue(minimalSeriesFile("cftc_sp500_asset_mgr_net") as never);
}

describe("Sentiment route — FocusBlock placement (D4)", () => {
  it("renders FocusBlock when sections includes positioning_vs_candidate_sentiment", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(sentimentComplete as PageInsightsFile);

    const container = render(<Sentiment />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();

    expect(container.textContent).toContain(
      "Are institutional positioning and broad sentiment aligned or diverging?"
    );
    expect(container.textContent).toContain(
      "Asset manager net longs in S&P 500 futures are elevated"
    );
  });

  it("renders FocusBlock from minimal fixture (only required fields)", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(sentimentMinimal as PageInsightsFile);

    const container = render(<Sentiment />);
    await flushPromises();

    const block = container.querySelector(".focus-block");
    expect(block).not.toBeNull();
    expect(container.textContent).toContain(
      "Are institutional positioning and broad sentiment aligned or diverging?"
    );
  });

  it("does NOT render FocusBlock when loadPageInsights resolves null", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockResolvedValue(null);

    const container = render(<Sentiment />);
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
        sentiment: {
          title: "Sentiment",
          state: "mixed",
          why_it_matters: "Positioning extremes are contrarian indicators.",
          confidence: 0.8,
          freshness_notes: []
          // sections intentionally absent
        }
      }
    };
    vi.mocked(loadPageInsights).mockResolvedValue(fileWithoutSections);

    const container = render(<Sentiment />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when sections exist but no entry matches positioning_vs_candidate_sentiment", async () => {
    setupDataMocks();
    const fileWithWrongId: PageInsightsFile = {
      generated_at_utc: "2026-05-11T00:00:00Z",
      date: "2026-05-11",
      method_version: "1.0.0",
      routes: {
        sentiment: {
          title: "Sentiment",
          state: "mixed",
          why_it_matters: "Positioning extremes are contrarian indicators.",
          confidence: 0.8,
          freshness_notes: [],
          sections: [
            {
              id: "regime_drivers", // wrong id — should not match positioning_vs_candidate_sentiment
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

    const container = render(<Sentiment />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });

  it("does NOT render FocusBlock when loadPageInsights rejects", async () => {
    setupDataMocks();
    vi.mocked(loadPageInsights).mockRejectedValue(new Error("network error"));

    const container = render(<Sentiment />);
    await flushPromises();

    expect(container.querySelector(".focus-block")).toBeNull();
  });
});
