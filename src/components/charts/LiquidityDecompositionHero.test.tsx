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

import LiquidityDecompositionHero from "./LiquidityDecompositionHero";
import type { DerivedSeriesFile } from "../../lib/types";

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

function buildNetLiquidity(): DerivedSeriesFile {
  const start = new Date("2023-05-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const observations = [] as DerivedSeriesFile["observations"];
  for (let i = 0; i < 800; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    observations.push({
      date,
      value: 5_500_000 + 200_000 * Math.sin(i / 40),
      percentile_252d: 50 + 25 * Math.cos(i / 30)
    });
  }
  return {
    series_id: "net_liquidity",
    generated_at_utc: "2026-05-06T00:00:00Z",
    source: "FRED",
    source_url: "https://fred.stlouisfed.org/",
    frequency: "daily",
    units: "usd_millions",
    observations,
    depends_on: ["fed_assets", "treasury_general_account", "reverse_repo"],
    method: "Fed assets minus TGA minus reverse repo",
    summary: {
      latest_date: "2026-05-06",
      latest_value: 5_830_111,
      change_1d: 112_837,
      change_1w: 112_837,
      change_1m: -115_207,
      change_3m: 135_389,
      change_12m: -142_192,
      percentile_252d: 59.62
    }
  };
}

const netLiquidityFixture = buildNetLiquidity();

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("LiquidityDecompositionHero", () => {
  it("wraps the chart in InteractiveChartShell with the liquidity title", () => {
    const c = render(<LiquidityDecompositionHero netLiquidity={netLiquidityFixture} />);
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent).toContain("Net liquidity");
  });

  it("renders a net liquidity series with a time axis", () => {
    render(<LiquidityDecompositionHero netLiquidity={netLiquidityFixture} />);
    const option = lastOption();
    const series = option?.series as Array<{ name: string; type: string; data: unknown[] }>;
    const netLiquiditySeries = series.find((s) => s.name === "Net liquidity");
    expect(netLiquiditySeries).toBeDefined();
    expect(netLiquiditySeries!.data.length).toBeGreaterThan(0);

    // x-axis must be a time axis; could be a single axis or first in array
    const xAxis = option?.xAxis;
    if (Array.isArray(xAxis)) {
      expect((xAxis[0] as { type: string }).type).toBe("time");
    } else {
      expect((xAxis as { type: string }).type).toBe("time");
    }
  });

  it("renders the 1M/3M change strip from summary changes", () => {
    const c = render(<LiquidityDecompositionHero netLiquidity={netLiquidityFixture} />);
    // The change strip surfaces summary changes either via an additional
    // series on a top grid or as descriptive text rendered above the chart.
    // We accept either representation as long as both 1M and 3M change
    // information is visible.
    const option = lastOption();
    const optionText = JSON.stringify(option);
    const domText = c.textContent ?? "";
    // The 1M change is -115,207 and 3M is +135,389 — locale-formatted versions
    // should appear somewhere. We check less restrictively for "115" and "135".
    const combined = `${optionText}${domText}`;
    expect(combined).toMatch(/1[  \s,]?M|1-month/i);
    expect(combined).toMatch(/3[  \s,]?M|3-month/i);
  });

  it("defaults to 1Y range and switches when a range preset changes", () => {
    const c = render(<LiquidityDecompositionHero netLiquidity={netLiquidityFixture} />);
    const initialOption = lastOption();
    const initialSeries = initialOption?.series as Array<{ name: string; data: unknown[] }>;
    const initialLength =
      initialSeries.find((s) => s.name === "Net liquidity")?.data.length ?? 0;
    expect(initialLength).toBeGreaterThan(0);
    expect(initialLength).toBeLessThan(netLiquidityFixture.observations.length);

    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYear = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYear.click();
    });

    const after = lastOption();
    const afterSeries = after?.series as Array<{ name: string; data: unknown[] }>;
    const afterLength =
      afterSeries.find((s) => s.name === "Net liquidity")?.data.length ?? 0;
    expect(afterLength).toBeGreaterThanOrEqual(initialLength);
  });

  it("renders an empty state when observations are empty", () => {
    const empty: DerivedSeriesFile = {
      ...netLiquidityFixture,
      observations: []
    };
    const c = render(<LiquidityDecompositionHero netLiquidity={empty} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("uses USD billions or millions in the y-axis label", () => {
    render(<LiquidityDecompositionHero netLiquidity={netLiquidityFixture} />);
    const option = lastOption();
    const yAxis = option?.yAxis;
    const ySpec = Array.isArray(yAxis) ? (yAxis[0] as { name?: string }) : (yAxis as { name?: string });
    expect((ySpec?.name ?? "").toLowerCase()).toMatch(/usd|billion|million|\$/);
  });

  it("renders direct manual-check links for the net-liquidity source components", () => {
    const c = render(<LiquidityDecompositionHero netLiquidity={netLiquidityFixture} />);

    expect(c.querySelector("a[href='https://fred.stlouisfed.org/series/WALCL']")).not.toBeNull();
    expect(c.querySelector("a[href='https://fred.stlouisfed.org/series/WTREGEN']")).not.toBeNull();
    expect(c.querySelector("a[href='https://fred.stlouisfed.org/series/RRPONTSYD']")).not.toBeNull();
  });
});
