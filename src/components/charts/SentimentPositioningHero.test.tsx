import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setOption = vi.fn();
const resize = vi.fn();
const dispose = vi.fn();

vi.mock("echarts/core", () => ({
  init: vi.fn(() => ({ setOption, resize, dispose })),
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

import SentimentPositioningHero from "./SentimentPositioningHero";
import type { TimeSeriesFile } from "../../lib/types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

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

beforeEach(() => {
  setOption.mockClear();
  resize.mockClear();
  dispose.mockClear();
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

function buildSeries(
  seriesId: string,
  startPercentile: number,
  step = 0.3
): TimeSeriesFile {
  // ~3 years of weekly CFTC observations.
  const start = new Date("2023-06-01").getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const observations: TimeSeriesFile["observations"] = [];
  for (let i = 0; i < 156; i += 1) {
    const date = new Date(start + i * oneWeek).toISOString().slice(0, 10);
    // Keep within 0-100.
    const raw = startPercentile + step * Math.sin(i / 6) * 20 + (i % 5) * 0.2;
    const clamped = Math.max(0, Math.min(100, raw));
    observations.push({
      date,
      value: 10 + i * 0.1,
      percentile_252d: clamped
    });
  }
  return {
    series_id: seriesId,
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "CFTC",
    source_url: "https://www.cftc.gov/",
    frequency: "weekly",
    units: "net_contracts",
    observations
  };
}

const assetMgrFixture = buildSeries("cftc_sp500_asset_mgr_net", 60);
const levMoneyFixture = buildSeries("cftc_sp500_lev_money_net", 40, -0.4);

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("SentimentPositioningHero", () => {
  it("wraps the chart in InteractiveChartShell with the sentiment positioning title", () => {
    const c = render(
      <SentimentPositioningHero
        assetManagerNet={assetMgrFixture}
        leveragedMoneyNet={levMoneyFixture}
      />
    );
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent).toContain("Sentiment positioning");
  });

  it("renders two line series named for asset managers and leveraged money", () => {
    render(
      <SentimentPositioningHero
        assetManagerNet={assetMgrFixture}
        leveragedMoneyNet={levMoneyFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{ name: string; type: string; data: unknown[] }>;
    const names = series.map((s) => s.name);
    expect(names).toContain("Asset manager net");
    expect(names).toContain("Leveraged money net");
    expect(series.filter((s) => s.type === "line").length).toBeGreaterThanOrEqual(2);
  });

  it("uses a time x-axis and a percentile value y-axis fixed to 0-100", () => {
    render(
      <SentimentPositioningHero
        assetManagerNet={assetMgrFixture}
        leveragedMoneyNet={levMoneyFixture}
      />
    );
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string };
    const yAxis = option?.yAxis as { type: string; name?: string; min?: number; max?: number };
    expect(xAxis.type).toBe("time");
    expect(yAxis.type).toBe("value");
    expect((yAxis.name ?? "").toLowerCase()).toContain("percentile");
    expect(yAxis.min).toBe(0);
    expect(yAxis.max).toBe(100);
  });

  it("hides datapoint symbols on the lines for a clean dual-line look", () => {
    render(
      <SentimentPositioningHero
        assetManagerNet={assetMgrFixture}
        leveragedMoneyNet={levMoneyFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{ name: string; showSymbol?: boolean }>;
    for (const s of series) {
      expect(s.showSymbol).toBe(false);
    }
  });

  it("renders a silent dashed markLine at the 50-percentile neutral reference", () => {
    render(
      <SentimentPositioningHero
        assetManagerNet={assetMgrFixture}
        leveragedMoneyNet={levMoneyFixture}
      />
    );
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      markLine?: {
        silent?: boolean;
        lineStyle?: { type?: string };
        data: Array<{ yAxis?: number; name?: string }>;
      };
    }>;
    const seriesWithMark = series.filter((s) => s.markLine);
    expect(seriesWithMark.length).toBeGreaterThan(0);
    const found = seriesWithMark.find((s) =>
      (s.markLine?.data ?? []).some((d) => d.yAxis === 50)
    );
    expect(found).toBeDefined();
    expect(found?.markLine?.silent).toBe(true);
    expect(found?.markLine?.lineStyle?.type).toBe("dashed");
  });

  it("includes dataZoom inside+slider", () => {
    render(
      <SentimentPositioningHero
        assetManagerNet={assetMgrFixture}
        leveragedMoneyNet={levMoneyFixture}
      />
    );
    const option = lastOption();
    const dataZoom = option?.dataZoom as Array<{ type: string }>;
    expect(Array.isArray(dataZoom)).toBe(true);
    const types = dataZoom.map((d) => d.type);
    expect(types).toContain("inside");
    expect(types).toContain("slider");
  });

  it("defaults to 1Y range and switches when a range preset changes", () => {
    const c = render(
      <SentimentPositioningHero
        assetManagerNet={assetMgrFixture}
        leveragedMoneyNet={levMoneyFixture}
      />
    );
    const initial = lastOption();
    const initialSeries = initial?.series as Array<{ name: string; data: unknown[] }>;
    const initialLength =
      initialSeries.find((s) => s.name === "Asset manager net")?.data.length ?? 0;
    expect(initialLength).toBeGreaterThan(0);
    expect(initialLength).toBeLessThan(assetMgrFixture.observations.length);

    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYear = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYear.click();
    });
    const after = lastOption();
    const afterSeries = after?.series as Array<{ name: string; data: unknown[] }>;
    const afterLength =
      afterSeries.find((s) => s.name === "Asset manager net")?.data.length ?? 0;
    expect(afterLength).toBeGreaterThanOrEqual(initialLength);
  });

  it("renders an insight callout describing the two latest percentiles and the gap", () => {
    const c = render(
      <SentimentPositioningHero
        assetManagerNet={assetMgrFixture}
        leveragedMoneyNet={levMoneyFixture}
      />
    );
    const insightText = c.querySelector(".insight-callout")?.textContent ?? "";
    expect(insightText.toLowerCase()).toContain("asset manager");
    expect(insightText.toLowerCase()).toContain("leveraged money");
    expect(insightText.toLowerCase()).toContain("percentile");
    expect(insightText.toLowerCase()).toMatch(/pp gap|gap/);
  });

  it("renders an empty state when both observation sets are empty", () => {
    const empty = (id: string): TimeSeriesFile => ({
      series_id: id,
      generated_at_utc: "",
      source: "",
      source_url: "",
      frequency: "weekly",
      units: "",
      observations: []
    });
    const c = render(
      <SentimentPositioningHero
        assetManagerNet={empty("cftc_sp500_asset_mgr_net")}
        leveragedMoneyNet={empty("cftc_sp500_lev_money_net")}
      />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(c.textContent?.toLowerCase() ?? "").toContain(
      "cftc positioning data is not currently active."
    );
  });

  it("renders empty state when observations have only null percentile_252d", () => {
    const stripped = (id: string): TimeSeriesFile => ({
      series_id: id,
      generated_at_utc: "",
      source: "",
      source_url: "",
      frequency: "weekly",
      units: "",
      observations: [
        { date: "2025-01-01", value: 10, percentile_252d: null },
        { date: "2025-01-08", value: 11, percentile_252d: null }
      ]
    });
    const c = render(
      <SentimentPositioningHero
        assetManagerNet={stripped("cftc_sp500_asset_mgr_net")}
        leveragedMoneyNet={stripped("cftc_sp500_lev_money_net")}
      />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });
});
