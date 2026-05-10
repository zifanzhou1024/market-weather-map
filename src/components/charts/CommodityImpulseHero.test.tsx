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

import CommodityImpulseHero from "./CommodityImpulseHero";
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

function buildImpulse(): DerivedSeriesFile {
  const start = new Date("2023-05-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const observations = [] as DerivedSeriesFile["observations"];
  for (let i = 0; i < 800; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    observations.push({
      date,
      value: 10 * Math.sin(i / 25),
      percentile_252d: 50 + 25 * Math.cos(i / 30)
    });
  }
  return {
    series_id: "commodity_inflation_impulse",
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "FRED",
    source_url: "https://fred.stlouisfed.org/",
    frequency: "daily",
    units: "score",
    observations,
    depends_on: ["wti_crude", "brent_crude", "corn_price", "wheat_price", "soybean_price"],
    method: "Composite oil + crop momentum impulse",
    summary: {
      latest_date: "2026-05-08",
      latest_value: -48.17,
      change_1d: null,
      change_1w: null,
      change_1m: null,
      change_3m: null,
      change_12m: null,
      percentile_252d: 100
    }
  };
}

function buildBrentWtiSpread(): DerivedSeriesFile {
  const start = new Date("2023-05-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const observations = [] as DerivedSeriesFile["observations"];
  for (let i = 0; i < 800; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    observations.push({
      date,
      value: 5 + 8 * Math.cos(i / 40),
      percentile_252d: 60 + 20 * Math.sin(i / 50)
    });
  }
  return {
    series_id: "brent_wti_spread",
    generated_at_utc: "2026-05-08T00:00:00Z",
    source: "EIA",
    source_url: "https://www.eia.gov/",
    frequency: "daily",
    units: "usd_per_barrel",
    observations,
    depends_on: ["brent_crude", "wti_crude"],
    method: "Brent crude minus WTI crude by matched date"
  };
}

const impulseFixture = buildImpulse();
const spreadFixture = buildBrentWtiSpread();

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
    string,
    unknown
  > | undefined;
}

describe("CommodityImpulseHero", () => {
  it("wraps the chart in InteractiveChartShell with the commodity impulse title", () => {
    const c = render(
      <CommodityImpulseHero impulse={impulseFixture} brentWtiSpread={spreadFixture} />
    );
    expect(c.querySelector(".interactive-chart-shell")).not.toBeNull();
    expect(c.textContent?.toLowerCase()).toContain("commodity");
  });

  it("renders both an impulse and a Brent-WTI spread series", () => {
    render(
      <CommodityImpulseHero impulse={impulseFixture} brentWtiSpread={spreadFixture} />
    );
    const option = lastOption();
    const series = option?.series as Array<{ name: string; type: string; data: unknown[] }>;
    const names = series.map((s) => s.name.toLowerCase());
    expect(names.some((n) => n.includes("impulse"))).toBe(true);
    expect(names.some((n) => n.includes("brent"))).toBe(true);
    series.forEach((s) => expect(s.data.length).toBeGreaterThan(0));
  });

  it("renders a dual-axis configuration with impulse score and Brent-WTI USD per barrel", () => {
    render(
      <CommodityImpulseHero impulse={impulseFixture} brentWtiSpread={spreadFixture} />
    );
    const option = lastOption();
    const yAxis = option?.yAxis as Array<{ type: string; name?: string }>;
    expect(Array.isArray(yAxis)).toBe(true);
    expect(yAxis.length).toBe(2);
    const leftName = (yAxis[0].name ?? "").toLowerCase();
    const rightName = (yAxis[1].name ?? "").toLowerCase();
    expect(leftName).toMatch(/impulse|score/);
    expect(rightName).toMatch(/brent|wti|usd|bbl|barrel|spread/);
  });

  it("defaults to 1Y range and switches when a range preset changes", () => {
    const c = render(
      <CommodityImpulseHero impulse={impulseFixture} brentWtiSpread={spreadFixture} />
    );
    const initialOption = lastOption();
    const initialSeries = initialOption?.series as Array<{ name: string; data: unknown[] }>;
    const impulseSeries = initialSeries.find((s) =>
      s.name.toLowerCase().includes("impulse")
    );
    const initialLength = impulseSeries?.data.length ?? 0;
    expect(initialLength).toBeGreaterThan(0);
    expect(initialLength).toBeLessThan(impulseFixture.observations.length);

    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const threeYear = radios.find((b) => b.textContent === "3Y") as HTMLButtonElement;
    act(() => {
      threeYear.click();
    });

    const after = lastOption();
    const afterSeries = after?.series as Array<{ name: string; data: unknown[] }>;
    const afterImpulseSeries = afterSeries.find((s) =>
      s.name.toLowerCase().includes("impulse")
    );
    expect((afterImpulseSeries?.data.length ?? 0)).toBeGreaterThanOrEqual(initialLength);
  });

  it("gracefully renders when impulse has only one observation", () => {
    const singletonImpulse: DerivedSeriesFile = {
      ...impulseFixture,
      observations: [{ date: "2026-05-08", value: -48.17, percentile_252d: 100 }]
    };
    const c = render(
      <CommodityImpulseHero impulse={singletonImpulse} brentWtiSpread={spreadFixture} />
    );
    // Should still render the chart (not the empty state).
    expect(c.querySelector("[data-state='ready']")).not.toBeNull();
    const option = lastOption();
    const series = option?.series as Array<{ name: string; data: unknown[] }>;
    // Brent-WTI spread series remains active even when impulse is sparse.
    const spreadSeries = series.find((s) => s.name.toLowerCase().includes("brent"));
    expect(spreadSeries?.data.length).toBeGreaterThan(0);
  });

  it("renders an empty state when both observations are empty", () => {
    const empty: DerivedSeriesFile = {
      ...impulseFixture,
      observations: []
    };
    const emptySpread: DerivedSeriesFile = {
      ...spreadFixture,
      observations: []
    };
    const c = render(<CommodityImpulseHero impulse={empty} brentWtiSpread={emptySpread} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("uses a time x-axis", () => {
    render(
      <CommodityImpulseHero impulse={impulseFixture} brentWtiSpread={spreadFixture} />
    );
    const option = lastOption();
    const xAxis = option?.xAxis;
    const xSpec = Array.isArray(xAxis) ? (xAxis[0] as { type: string }) : (xAxis as { type: string });
    expect(xSpec.type).toBe("time");
  });
});
