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

import YieldChangeWaterfallChart from "./YieldChangeWaterfallChart";
import type { RatesDashboardFile } from "../../lib/types";

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

const windowsFixture: RatesDashboardFile["yield_change_windows"] = {
  "1M": {
    nominal_10y_bps: 12,
    real_yield_10y_bps: 0,
    breakeven_10y_bps: 11,
    driver: "breakeven"
  },
  "3M": {
    nominal_10y_bps: 19,
    real_yield_10y_bps: 8,
    breakeven_10y_bps: 10,
    driver: "balanced"
  },
  "6M": {
    nominal_10y_bps: 31,
    real_yield_10y_bps: 15,
    breakeven_10y_bps: 15,
    driver: "balanced"
  },
  "1Y": {
    nominal_10y_bps: 5,
    real_yield_10y_bps: -12,
    breakeven_10y_bps: 19,
    driver: "breakeven"
  }
};

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("YieldChangeWaterfallChart", () => {
  it("wraps the chart in InteractiveChartShell with the waterfall title", () => {
    const c = render(<YieldChangeWaterfallChart data={windowsFixture} />);
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent).toContain("Yield change waterfall");
  });

  it("uses a categorical x-axis with 1M, 3M, 6M, 1Y in that order", () => {
    render(<YieldChangeWaterfallChart data={windowsFixture} />);
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string; data: string[] };
    expect(xAxis.type).toBe("category");
    expect(xAxis.data).toEqual(["1M", "3M", "6M", "1Y"]);
  });

  it("emits a real-yield series and a breakeven series in bps", () => {
    render(<YieldChangeWaterfallChart data={windowsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      type: string;
      stack?: string;
      data: Array<number | { value: number }>;
    }>;
    const names = series.map((s) => s.name);
    expect(names).toContain("Real yield");
    expect(names).toContain("Breakeven");
    const real = series.find((s) => s.name === "Real yield")!;
    const breakeven = series.find((s) => s.name === "Breakeven")!;
    // Bars are stacked so positive/negative segments share the column.
    expect(real.type).toBe("bar");
    expect(breakeven.type).toBe("bar");
    expect(real.stack).toBe("yield_change");
    expect(breakeven.stack).toBe("yield_change");
    // Values map 1:1 from the fixture in window order.
    const realValues = real.data.map((d) =>
      typeof d === "number" ? d : d.value
    );
    const beValues = breakeven.data.map((d) =>
      typeof d === "number" ? d : d.value
    );
    expect(realValues).toEqual([0, 8, 15, -12]);
    expect(beValues).toEqual([11, 10, 15, 19]);
  });

  it("annotates each window with its nominal total in bps", () => {
    render(<YieldChangeWaterfallChart data={windowsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      data: Array<number | { value: number }>;
      label?: { show?: boolean; formatter?: (p: { dataIndex: number }) => string };
    }>;
    // The nominal total is a separate transparent helper series so we can place
    // a single label per column rather than per stack segment.
    const totalSeries = series.find((s) => s.name === "Nominal total" || s.name === "Nominal");
    expect(totalSeries).toBeDefined();
    const label = totalSeries?.label;
    expect(label?.show).toBe(true);
    const formatter = label?.formatter;
    expect(typeof formatter).toBe("function");
    // The label formatter receives a dataIndex and returns a string containing
    // the actual nominal bps value (12 bps for 1M from the fixture).
    const html = formatter!({ dataIndex: 0 });
    expect(html).toContain("12");
    // Negative-prefix friendly for the 1Y window (+5 bps from fixture).
    const html1y = formatter!({ dataIndex: 3 });
    expect(html1y).toContain("5");
  });

  it("highlights the driver column via fill opacity on non-driver segments", () => {
    render(<YieldChangeWaterfallChart data={windowsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      data: Array<number | { value: number; itemStyle?: { opacity?: number } }>;
    }>;
    const real = series.find((s) => s.name === "Real yield")!;
    const breakeven = series.find((s) => s.name === "Breakeven")!;

    // 1M driver is "breakeven" → real bar dimmed, breakeven bar at full opacity.
    const realOpacity1m =
      typeof real.data[0] === "number" ? undefined : real.data[0]?.itemStyle?.opacity;
    const beOpacity1m =
      typeof breakeven.data[0] === "number" ? undefined : breakeven.data[0]?.itemStyle?.opacity;
    expect(realOpacity1m).toBeLessThan(1);
    expect(beOpacity1m === 1 || beOpacity1m === undefined).toBe(true);

    // 3M driver is "balanced" → both at full opacity.
    const realOpacity3m =
      typeof real.data[1] === "number" ? undefined : real.data[1]?.itemStyle?.opacity;
    const beOpacity3m =
      typeof breakeven.data[1] === "number" ? undefined : breakeven.data[1]?.itemStyle?.opacity;
    expect(realOpacity3m === 1 || realOpacity3m === undefined).toBe(true);
    expect(beOpacity3m === 1 || beOpacity3m === undefined).toBe(true);
  });

  it("tooltip surfaces the driver tag for each window", () => {
    render(<YieldChangeWaterfallChart data={windowsFixture} />);
    const option = lastOption();
    const tooltip = option?.tooltip as { formatter?: (p: unknown) => string };
    expect(typeof tooltip.formatter).toBe("function");
    const html = tooltip.formatter!([{ axisValueLabel: "1M" }]);
    // The 1M window driver is "breakeven" — tooltip should describe it.
    expect(html.toLowerCase()).toContain("breakeven");
    expect(html).toContain("1M");
    // Nominal total surfaces in the tooltip as well.
    expect(html).toContain("12");
  });

  it("uses bps as the y-axis unit", () => {
    render(<YieldChangeWaterfallChart data={windowsFixture} />);
    const option = lastOption();
    const yAxis = option?.yAxis as { type: string; name?: string };
    expect(yAxis.type).toBe("value");
    expect((yAxis.name ?? "").toLowerCase()).toContain("bps");
  });

  it("renders an empty state when all four windows are missing", () => {
    const emptyWindows = {
      "1M": { nominal_10y_bps: NaN, real_yield_10y_bps: NaN, breakeven_10y_bps: NaN, driver: "balanced" },
      "3M": { nominal_10y_bps: NaN, real_yield_10y_bps: NaN, breakeven_10y_bps: NaN, driver: "balanced" },
      "6M": { nominal_10y_bps: NaN, real_yield_10y_bps: NaN, breakeven_10y_bps: NaN, driver: "balanced" },
      "1Y": { nominal_10y_bps: NaN, real_yield_10y_bps: NaN, breakeven_10y_bps: NaN, driver: "balanced" }
    } as unknown as RatesDashboardFile["yield_change_windows"];
    const c = render(<YieldChangeWaterfallChart data={emptyWindows} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });
});
