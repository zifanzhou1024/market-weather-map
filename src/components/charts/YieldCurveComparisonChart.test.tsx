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

import YieldCurveComparisonChart from "./YieldCurveComparisonChart";
import type { RatesCurveSnapshots } from "../../lib/types";

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

const snapshotsFixture: RatesCurveSnapshots = {
  current: [
    { tenor: "2Y", value: 3.92 },
    { tenor: "10Y", value: 4.41 },
    { tenor: "20Y", value: 4.84 },
    { tenor: "30Y", value: 4.97 }
  ],
  one_month_ago: [
    { tenor: "2Y", value: 3.95 },
    { tenor: "10Y", value: 4.29 },
    { tenor: "20Y", value: 4.7 },
    { tenor: "30Y", value: 4.81 }
  ],
  three_months_ago: [
    { tenor: "2Y", value: 4.02 },
    { tenor: "10Y", value: 4.22 },
    { tenor: "20Y", value: 4.6 },
    { tenor: "30Y", value: 4.72 }
  ],
  one_year_ago: [
    { tenor: "2Y", value: 3.83 },
    { tenor: "10Y", value: 4.36 },
    { tenor: "20Y", value: 4.84 },
    { tenor: "30Y", value: 4.83 }
  ]
};

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("YieldCurveComparisonChart", () => {
  it("wraps the chart in InteractiveChartShell with the curve title", () => {
    const c = render(<YieldCurveComparisonChart data={snapshotsFixture} />);
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent).toContain("Yield curve comparison");
  });

  it("uses a categorical x-axis with tenors 2Y / 10Y / 20Y / 30Y in order", () => {
    render(<YieldCurveComparisonChart data={snapshotsFixture} />);
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string; data: string[] };
    expect(xAxis.type).toBe("category");
    expect(xAxis.data).toEqual(["2Y", "10Y", "20Y", "30Y"]);
  });

  it("renders four line series — current and three historical snapshots", () => {
    render(<YieldCurveComparisonChart data={snapshotsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{ name: string; type: string; data: unknown[] }>;
    expect(series).toHaveLength(4);
    const names = series.map((s) => s.name);
    expect(names).toContain("Current");
    expect(names).toContain("1M ago");
    expect(names).toContain("3M ago");
    expect(names).toContain("1Y ago");
    for (const s of series) {
      expect(s.type).toBe("line");
    }
  });

  it("maps each series value to the categorical tenor order for the current snapshot", () => {
    render(<YieldCurveComparisonChart data={snapshotsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{ name: string; data: Array<number | null> }>;
    const current = series.find((s) => s.name === "Current")!;
    expect(current.data).toEqual([3.92, 4.41, 4.84, 4.97]);
  });

  it("skips a missing tenor in a snapshot without crashing other series", () => {
    const partial: RatesCurveSnapshots = {
      ...snapshotsFixture,
      one_year_ago: [
        { tenor: "2Y", value: 3.83 },
        { tenor: "10Y", value: 4.36 }
        // 20Y and 30Y deliberately missing from this snapshot.
      ]
    };
    render(<YieldCurveComparisonChart data={partial} />);
    const option = lastOption();
    const series = option?.series as Array<{ name: string; data: Array<number | null> }>;
    const oneYear = series.find((s) => s.name === "1Y ago")!;
    // ECharts honors null values as line breaks — that's the graceful skip.
    expect(oneYear.data[0]).toBe(3.83);
    expect(oneYear.data[1]).toBe(4.36);
    expect(oneYear.data[2]).toBeNull();
    expect(oneYear.data[3]).toBeNull();
    // Other series remain intact.
    const current = series.find((s) => s.name === "Current")!;
    expect(current.data).toEqual([3.92, 4.41, 4.84, 4.97]);
  });

  it("uses a gradient line color old to new (Current darker/warmer, 1Y ago lighter)", () => {
    render(<YieldCurveComparisonChart data={snapshotsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      lineStyle?: { color?: string; width?: number };
    }>;
    const current = series.find((s) => s.name === "Current")!;
    const oneYear = series.find((s) => s.name === "1Y ago")!;
    expect(current.lineStyle?.color).toBeDefined();
    expect(oneYear.lineStyle?.color).toBeDefined();
    expect(current.lineStyle?.color).not.toBe(oneYear.lineStyle?.color);
    // Newer series is heavier — visual emphasis on current.
    expect(current.lineStyle?.width ?? 0).toBeGreaterThanOrEqual(
      oneYear.lineStyle?.width ?? 0
    );
  });

  it("tooltip lists the tenor header and four vintage rows when axis is hovered", () => {
    render(<YieldCurveComparisonChart data={snapshotsFixture} />);
    const option = lastOption();
    const tooltip = option?.tooltip as { formatter?: (p: unknown) => string };
    expect(typeof tooltip.formatter).toBe("function");
    const html = tooltip.formatter!([
      { axisValueLabel: "10Y", seriesName: "Current", value: 4.41 },
      { axisValueLabel: "10Y", seriesName: "1M ago", value: 4.29 },
      { axisValueLabel: "10Y", seriesName: "3M ago", value: 4.22 },
      { axisValueLabel: "10Y", seriesName: "1Y ago", value: 4.36 }
    ]);
    expect(html).toContain("10Y");
    expect(html).toContain("Current");
    expect(html).toContain("4.41");
    expect(html).toContain("1Y ago");
    expect(html).toContain("4.36");
  });

  it("renders an empty state when current snapshot is empty", () => {
    const empty: RatesCurveSnapshots = {
      current: [],
      one_month_ago: [],
      three_months_ago: [],
      one_year_ago: []
    };
    const c = render(<YieldCurveComparisonChart data={empty} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });
});
