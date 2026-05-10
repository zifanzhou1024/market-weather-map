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

import VixCurveTermStructureChart from "./VixCurveTermStructureChart";
import type {
  VolatilityCurvePoint,
  VolatilityDashboardThresholds
} from "../../lib/types";

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

const curveFixture: VolatilityCurvePoint[] = [
  { tenor: "9D", value: 14.32, percentile_5y: 28.5 },
  { tenor: "30D", value: 16.18, percentile_5y: 42.1 },
  { tenor: "3M", value: 18.05, percentile_5y: 51.4 }
];

const thresholdsFixture: VolatilityDashboardThresholds = {
  vix9d_vix_calm: 0.95,
  vix9d_vix_stress: 1.05,
  vix_vix3m_calm: 0.95,
  vix_vix3m_stress: 1.0,
  hidden_stress_watch: 15,
  hidden_stress_elevated: 30
};

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("VixCurveTermStructureChart", () => {
  it("renders an InteractiveChartShell with the proxy title in full mode", () => {
    const c = render(
      <VixCurveTermStructureChart data={curveFixture} thresholds={thresholdsFixture} />
    );
    // Full mode wraps the chart in InteractiveChartShell
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    // Title intentionally uses the word "proxy" — these are index points, not VX futures.
    expect(c.textContent).toContain("Volatility curve (proxy)");
    expect(c.textContent?.toLowerCase()).toContain("proxy");
  });

  it("renders the chart body via EChartPanel and initializes echarts in ready state", () => {
    render(
      <VixCurveTermStructureChart data={curveFixture} thresholds={thresholdsFixture} />
    );
    // EChartPanel calls setOption once it transitions to ready.
    expect(setOption).toHaveBeenCalled();
    const option = lastOption();
    expect(option).toBeDefined();
    expect(option?.xAxis).toBeDefined();
    expect(option?.series).toBeDefined();
  });

  it("uses categorical x-axis with 9D / 30D / 3M tenors and the fixture y values", () => {
    render(
      <VixCurveTermStructureChart data={curveFixture} thresholds={thresholdsFixture} />
    );
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string; data: string[] };
    expect(xAxis.type).toBe("category");
    expect(xAxis.data).toEqual(["9D", "30D", "3M"]);
    const series = option?.series as Array<{
      type: string;
      data: number[];
    }>;
    expect(series[0].type).toBe("line");
    expect(series[0].data).toEqual([14.32, 16.18, 18.05]);
  });

  it("adds a markArea on the series when thresholds are provided", () => {
    render(
      <VixCurveTermStructureChart data={curveFixture} thresholds={thresholdsFixture} />
    );
    const option = lastOption();
    const series = option?.series as Array<{ markArea?: unknown }>;
    expect(series[0].markArea).toBeDefined();
  });

  it("omits markArea when no thresholds are provided", () => {
    render(<VixCurveTermStructureChart data={curveFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{ markArea?: unknown }>;
    expect(series[0].markArea).toBeUndefined();
  });

  it("emits a tooltip formatter that includes the 5-year percentile in non-compact mode", () => {
    render(
      <VixCurveTermStructureChart data={curveFixture} thresholds={thresholdsFixture} />
    );
    const option = lastOption();
    const tooltip = option?.tooltip as { formatter?: (p: unknown) => string };
    expect(tooltip).toBeDefined();
    expect(typeof tooltip.formatter).toBe("function");
    const html = tooltip.formatter!({
      dataIndex: 0,
      value: 14.32,
      name: "9D"
    });
    expect(html).toContain("9D");
    expect(html).toContain("14.32");
    // Full mode tooltip surfaces the 5-year percentile.
    expect(html).toMatch(/percentile/i);
  });

  it("renders a compact mode without the InteractiveChartShell chrome", () => {
    const c = render(
      <VixCurveTermStructureChart data={curveFixture} thresholds={thresholdsFixture} compact />
    );
    // Compact mode skips the shell wrapper so there is no .interactive-chart-shell.
    expect(c.querySelector(".interactive-chart-shell")).toBeNull();
    // The compact title is suppressed via EChartPanel, so no "proxy" word appears.
    expect(c.textContent || "").not.toContain("Volatility curve (proxy)");
  });

  it("compact-mode tooltip formatter omits percentile to keep the panel terse", () => {
    render(
      <VixCurveTermStructureChart data={curveFixture} thresholds={thresholdsFixture} compact />
    );
    const option = lastOption();
    const tooltip = option?.tooltip as { formatter?: (p: unknown) => string };
    expect(typeof tooltip.formatter).toBe("function");
    const html = tooltip.formatter!({ dataIndex: 0, value: 14.32, name: "9D" });
    expect(html).toContain("9D");
    expect(html).toContain("14.32");
    // No 5-year percentile in compact tooltip.
    expect(html).not.toMatch(/percentile/i);
  });

  it("renders an empty state when data is empty", () => {
    const c = render(<VixCurveTermStructureChart data={[]} thresholds={thresholdsFixture} />);
    // EChartPanel's empty state lives behind [data-state='empty'].
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });
});
