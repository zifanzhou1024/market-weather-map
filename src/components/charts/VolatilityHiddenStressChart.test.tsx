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

import VolatilityHiddenStressChart from "./VolatilityHiddenStressChart";
import type {
  VolatilityDashboardThresholds,
  VolatilityHiddenStressPoint
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

function generateStressFixture(): VolatilityHiddenStressPoint[] {
  const start = new Date("2024-01-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const points: VolatilityHiddenStressPoint[] = [];
  for (let i = 0; i < 400; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    const vix = 30 + 30 * Math.sin(i / 25);
    const vvix = 40 + 25 * Math.cos(i / 30);
    const score = vvix - vix;
    points.push({
      date,
      vix_value: 14 + Math.cos(i / 30) * 2,
      vvix_value: 88 + Math.sin(i / 20) * 4,
      vix_percentile: Math.max(0, Math.min(100, vix)),
      vvix_percentile: Math.max(0, Math.min(100, vvix)),
      hidden_stress_score: score,
      state: score > 30 ? "elevated" : score > 15 ? "watch" : "calm"
    });
  }
  return points;
}

const fixture = generateStressFixture();

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

describe("VolatilityHiddenStressChart", () => {
  it("renders a scatter and a line series across two grids in full mode", () => {
    render(
      <VolatilityHiddenStressChart data={fixture} thresholds={thresholdsFixture} />
    );
    const option = lastOption();
    const grid = option?.grid as unknown[];
    expect(Array.isArray(grid)).toBe(true);
    expect(grid).toHaveLength(2);

    const series = option?.series as Array<{ type: string; xAxisIndex?: number }>;
    const types = series.map((s) => s.type);
    expect(types).toContain("scatter");
    expect(types).toContain("line");
  });

  it("emits a visualMap configured for recency coloring on the scatter series", () => {
    render(
      <VolatilityHiddenStressChart data={fixture} thresholds={thresholdsFixture} />
    );
    const option = lastOption();
    const visualMap = option?.visualMap as Array<{
      type: string;
      seriesIndex?: number;
      dimension?: number;
      min: number;
      max: number;
    }>;
    expect(Array.isArray(visualMap)).toBe(true);
    expect(visualMap.length).toBeGreaterThan(0);
    // visualMap dimension 2 spans the recency index of the *filtered* scatter
    // points (the chart applies the 1Y default time window). We assert the
    // configuration is correct without coupling to an exact index count.
    expect(visualMap[0].dimension).toBe(2);
    expect(visualMap[0].min).toBe(0);
    expect(visualMap[0].max).toBeGreaterThan(0);
    expect(visualMap[0].max).toBeLessThanOrEqual(fixture.length - 1);
    // The series being colored is the scatter (seriesIndex 0).
    expect(visualMap[0].seriesIndex).toBe(0);
  });

  it("annotates upper-left quadrant with 'hidden options stress' label", () => {
    const c = render(
      <VolatilityHiddenStressChart data={fixture} thresholds={thresholdsFixture} />
    );
    // The label can live inside ECharts options (graphic / markArea labels) OR as an SR-friendly
    // DOM aria label. Either path is acceptable; both surface the descriptive phrase.
    const option = lastOption();
    const optionText = JSON.stringify(option);
    const domText = c.textContent ?? "";
    expect(
      optionText.toLowerCase().includes("hidden options stress") ||
        domText.toLowerCase().includes("hidden options stress")
    ).toBe(true);
  });

  it("emits markLine entries at the watch and elevated thresholds on the line strip", () => {
    render(
      <VolatilityHiddenStressChart data={fixture} thresholds={thresholdsFixture} />
    );
    const option = lastOption();
    const series = option?.series as Array<{
      type: string;
      markLine?: { data: Array<{ yAxis: number }> };
    }>;
    const lineSeries = series.find((s) => s.type === "line");
    expect(lineSeries?.markLine).toBeDefined();
    const yValues = lineSeries!.markLine!.data.map((d) => d.yAxis);
    expect(yValues).toContain(thresholdsFixture.hidden_stress_watch);
    expect(yValues).toContain(thresholdsFixture.hidden_stress_elevated);
  });

  it("renders ChartRangeControls in full mode and filters series when a preset switches", () => {
    const c = render(
      <VolatilityHiddenStressChart data={fixture} thresholds={thresholdsFixture} />
    );
    expect(c.querySelector('[role="radiogroup"]')).not.toBeNull();
    const initialOption = lastOption();
    const initialLineSeries = (initialOption?.series as Array<{ type: string; data: unknown[] }>).find(
      (s) => s.type === "line"
    );
    const initialLength = initialLineSeries!.data.length;

    // Switch to 1M
    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const oneMonth = radios.find((b) => b.textContent === "1M") as HTMLButtonElement;
    act(() => {
      oneMonth.click();
    });

    const after = lastOption();
    const afterLineSeries = (after?.series as Array<{ type: string; data: unknown[] }>).find(
      (s) => s.type === "line"
    );
    expect(afterLineSeries!.data.length).toBeLessThan(initialLength);
  });

  it("collapses to scatter-only in compact mode and removes chrome", () => {
    const c = render(
      <VolatilityHiddenStressChart
        data={fixture}
        thresholds={thresholdsFixture}
        compact
      />
    );
    // No InteractiveChartShell wrapper.
    expect(c.querySelector(".interactive-chart-shell")).toBeNull();
    // No ChartRangeControls.
    expect(c.querySelector('[role="radiogroup"]')).toBeNull();

    const option = lastOption();
    // In compact mode the grid is a single panel (not an array of two).
    const grid = option?.grid as unknown;
    if (Array.isArray(grid)) {
      expect(grid).toHaveLength(1);
    }
    const series = option?.series as Array<{ type: string }>;
    expect(series.every((s) => s.type === "scatter")).toBe(true);
  });

  it("renders an empty state when data is empty", () => {
    const c = render(
      <VolatilityHiddenStressChart data={[]} thresholds={thresholdsFixture} />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });
});
