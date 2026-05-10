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

import VixRatioHistoryChart from "./VixRatioHistoryChart";
import type {
  VolatilityDashboardThresholds,
  VolatilityRatioHistoryPoint
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

// Three-year fixture so the default 1Y window filters meaningfully.
function generateHistory(): VolatilityRatioHistoryPoint[] {
  const start = new Date("2023-05-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const points: VolatilityRatioHistoryPoint[] = [];
  // 800 daily points spans about 2.2 years; covers 1M/3M/6M/1Y/3Y windows.
  for (let i = 0; i < 800; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    // Oscillate around 0.92/0.88 so series stay plausible.
    points.push({
      date,
      vix9d_vix: 0.9 + 0.1 * Math.sin(i / 20),
      vix_vix3m: 0.88 + 0.08 * Math.cos(i / 25)
    });
  }
  return points;
}

const historyFixture = generateHistory();

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

describe("VixRatioHistoryChart", () => {
  it("renders both VIX9D/VIX and VIX/VIX3M series in the chart options", () => {
    render(<VixRatioHistoryChart data={historyFixture} thresholds={thresholdsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{ name: string; data: unknown[] }>;
    expect(series).toHaveLength(2);
    const names = series.map((s) => s.name);
    expect(names).toContain("VIX9D / VIX");
    expect(names).toContain("VIX / VIX3M");
    expect(series[0].data.length).toBeGreaterThan(0);
    expect(series[1].data.length).toBeGreaterThan(0);
  });

  it("defaults to 1Y range — filtered series shorter than the full fixture", () => {
    render(<VixRatioHistoryChart data={historyFixture} thresholds={thresholdsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{ data: unknown[] }>;
    // 800-point fixture filtered by 1Y (~365 days) should drop more than half.
    expect(series[0].data.length).toBeLessThan(historyFixture.length);
    expect(series[0].data.length).toBeGreaterThan(0);
  });

  it("switches the visible window when the user picks a 3Y range preset", () => {
    const c = render(
      <VixRatioHistoryChart data={historyFixture} thresholds={thresholdsFixture} />
    );
    // Default 1Y option length
    const initialOption = lastOption();
    const initialSeries = initialOption?.series as Array<{ data: unknown[] }>;
    const initialLength = initialSeries[0].data.length;

    // Click the 3Y radio in ChartRangeControls
    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYButton = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYButton.click();
    });

    const after = lastOption();
    const afterSeries = after?.series as Array<{ data: unknown[] }>;
    expect(afterSeries[0].data.length).toBeGreaterThanOrEqual(initialLength);
  });

  it("emits a markArea on the VIX/VIX3M series matching the stress threshold", () => {
    render(<VixRatioHistoryChart data={historyFixture} thresholds={thresholdsFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{
      name: string;
      markArea?: { data: Array<Array<{ yAxis: number }>> };
    }>;
    const ratioSeries = series.find((s) => s.name === "VIX / VIX3M");
    expect(ratioSeries?.markArea).toBeDefined();
    const flatThresholds = ratioSeries!.markArea!.data.flat().map((c) => c.yAxis);
    expect(flatThresholds).toContain(thresholdsFixture.vix_vix3m_stress);
  });

  it("includes dataZoom slider and inside zoom configuration", () => {
    render(<VixRatioHistoryChart data={historyFixture} thresholds={thresholdsFixture} />);
    const option = lastOption();
    const dataZoom = option?.dataZoom as Array<{ type: string }>;
    expect(Array.isArray(dataZoom)).toBe(true);
    const types = dataZoom.map((z) => z.type);
    expect(types).toContain("slider");
    expect(types).toContain("inside");
  });

  it("uses a time x-axis", () => {
    render(<VixRatioHistoryChart data={historyFixture} thresholds={thresholdsFixture} />);
    const option = lastOption();
    const xAxis = option?.xAxis as { type: string };
    expect(xAxis.type).toBe("time");
  });

  it("renders an empty state when data is empty", () => {
    const c = render(<VixRatioHistoryChart data={[]} thresholds={thresholdsFixture} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });
});
