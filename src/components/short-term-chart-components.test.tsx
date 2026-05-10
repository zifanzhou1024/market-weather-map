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

import VixCurveProxyChart from "./VixCurveProxyChart";
import VolatilityComplexChart from "./VolatilityComplexChart";
import RatesPressureChart from "./RatesPressureChart";
import CreditStressMatrix from "./CreditStressMatrix";
import LiquidityDollarPressureChart from "./LiquidityDollarPressureChart";
import EventRiskTimeline from "./EventRiskTimeline";
import type { MacroCalendarFile, TimeSeriesFile } from "../lib/types";

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
  dispose.mockClear();
  resize.mockClear();
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

function makeSeries(seriesId: string, value: number, dates: string[] = ["2026-05-06"]): TimeSeriesFile {
  return {
    series_id: seriesId,
    generated_at_utc: "2026-05-08T00:17:53Z",
    source: "Test",
    source_url: "https://example.com/test",
    frequency: "daily",
    units: "index",
    summary: {
      latest_date: dates[dates.length - 1],
      latest_value: value,
      change_1d: null,
      change_1w: null,
      change_1m: null,
      percentile_252d: null
    },
    observations: dates.map((date, index) => ({
      date,
      value: value + index
    }))
  };
}

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<string, unknown>;
}

describe("VixCurveProxyChart", () => {
  it("renders the empty state when any of vix9d/vix/vix3m is missing", () => {
    const c = render(
      <VixCurveProxyChart vix9d={undefined} vix={makeSeries("vix", 17)} vix3m={makeSeries("vix3m", 20)} />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(setOption).not.toHaveBeenCalled();
  });

  it("renders the three categorical points in VIX9D / VIX / VIX3M order", () => {
    render(
      <VixCurveProxyChart
        vix9d={makeSeries("vix9d", 15)}
        vix={makeSeries("vix", 17)}
        vix3m={makeSeries("vix3m", 20)}
      />
    );
    const option = lastOption();
    expect((option.xAxis as { data: string[] }).data).toEqual(["VIX9D", "VIX", "VIX3M"]);
    const series = option.series as Array<{ data: number[] }>;
    expect(series[0].data).toEqual([15, 17, 20]);
  });

  it("labels the curve as contango proxy when VIX3M is well above VIX", () => {
    const c = render(
      <VixCurveProxyChart
        vix9d={makeSeries("vix9d", 15)}
        vix={makeSeries("vix", 17)}
        vix3m={makeSeries("vix3m", 20)}
      />
    );
    expect(c.textContent?.toLowerCase()).toContain("contango");
  });

  it("labels the curve as backwardation proxy when VIX is well above VIX3M", () => {
    const c = render(
      <VixCurveProxyChart
        vix9d={makeSeries("vix9d", 28)}
        vix={makeSeries("vix", 25)}
        vix3m={makeSeries("vix3m", 22)}
      />
    );
    expect(c.textContent?.toLowerCase()).toContain("backwardation");
  });
});

describe("VolatilityComplexChart", () => {
  it("renders empty when both series are missing", () => {
    const c = render(<VolatilityComplexChart vix={undefined} vvix={undefined} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("plots VIX and VVIX on a dual-axis line chart when both are present", () => {
    const dates = ["2026-05-04", "2026-05-05", "2026-05-06"];
    render(
      <VolatilityComplexChart
        vix={makeSeries("vix", 17, dates)}
        vvix={makeSeries("vvix", 90, dates)}
      />
    );
    const option = lastOption();
    const series = option.series as Array<{ name: string }>;
    const names = series.map((s) => s.name);
    expect(names).toContain("VIX");
    expect(names).toContain("VVIX");
    // Two y-axes so VIX (~10-30) and VVIX (~60-150) can both render at scale.
    expect((option.yAxis as unknown[]).length ?? 0).toBe(2);
  });
});

describe("RatesPressureChart", () => {
  it("renders empty when none of the rates inputs are present", () => {
    const c = render(<RatesPressureChart us2y={undefined} us10y={undefined} realYield10y={undefined} breakeven10y={undefined} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("plots whichever active rate series are available", () => {
    const dates = ["2026-05-04", "2026-05-05", "2026-05-06"];
    render(
      <RatesPressureChart
        us2y={makeSeries("us2y", 4.1, dates)}
        us10y={makeSeries("us10y", 4.4, dates)}
        realYield10y={makeSeries("real_yield_10y", 1.94, dates)}
        breakeven10y={makeSeries("breakeven_10y", 2.42, dates)}
      />
    );
    const option = lastOption();
    const names = (option.series as Array<{ name: string }>).map((s) => s.name);
    expect(names).toContain("US2Y");
    expect(names).toContain("US10Y");
    expect(names).toContain("10Y real yield");
    expect(names).toContain("10Y breakeven");
  });
});

describe("CreditStressMatrix", () => {
  it("renders empty when no credit OAS series are provided", () => {
    const c = render(
      <CreditStressMatrix highYieldOas={undefined} investmentGradeOas={undefined} bbbOas={undefined} />
    );
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("emits a heatmap with rows for HY/IG/BBB and columns for the 1D/1W/1M change horizons", () => {
    const dates = ["2026-04-06", "2026-04-29", "2026-05-05", "2026-05-06"];
    render(
      <CreditStressMatrix
        highYieldOas={makeSeries("high_yield_oas", 4.2, dates)}
        investmentGradeOas={makeSeries("investment_grade_oas", 1.1, dates)}
        bbbOas={makeSeries("bbb_oas", 1.5, dates)}
      />
    );
    const option = lastOption();
    expect((option.yAxis as { data: string[] }).data).toEqual([
      "HY OAS",
      "IG OAS",
      "BBB OAS"
    ]);
    expect((option.xAxis as { data: string[] }).data).toEqual(["1D", "1W", "1M"]);
    const cells = (option.series as Array<{ data: Array<[number, number, number]> }>)[0].data;
    // 3 rows × 3 columns = 9 cells.
    expect(cells.length).toBe(9);
  });
});

describe("LiquidityDollarPressureChart", () => {
  it("renders empty when both inputs are missing", () => {
    const c = render(<LiquidityDollarPressureChart broadDollar={undefined} realYield10y={undefined} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("plots broad dollar and 10Y real yield on a dual-axis line chart", () => {
    const dates = ["2026-05-04", "2026-05-05", "2026-05-06"];
    render(
      <LiquidityDollarPressureChart
        broadDollar={makeSeries("broad_dollar", 118.39, dates)}
        realYield10y={makeSeries("real_yield_10y", 1.94, dates)}
      />
    );
    const option = lastOption();
    const names = (option.series as Array<{ name: string }>).map((s) => s.name);
    expect(names).toContain("Broad dollar");
    expect(names).toContain("10Y real yield");
    expect((option.yAxis as unknown[]).length).toBe(2);
  });
});

const calendar: MacroCalendarFile = {
  generated_at_utc: "2026-05-08T00:17:53Z",
  method_version: "phase4-pr2-event-calendar-v1",
  events: [
    {
      id: "cpi-2026-05-13",
      title: "CPI",
      category: "inflation",
      importance: "high",
      date: "2026-05-13",
      time: "08:30",
      timezone: "America/New_York",
      source: "BLS",
      source_url: "https://example.com/cpi",
      notes: "CPI report.",
      status: "scheduled"
    },
    {
      id: "fomc-2026-05-15",
      title: "FOMC",
      category: "rates",
      importance: "high",
      date: "2026-05-15",
      time: "14:00",
      timezone: "America/New_York",
      source: "Fed",
      source_url: "https://example.com/fomc",
      notes: "Rate decision.",
      status: "scheduled"
    },
    {
      id: "retail-sales-2026-05-16",
      title: "Retail sales",
      category: "growth",
      importance: "medium",
      date: "2026-05-16",
      time: null,
      timezone: null,
      source: "Census",
      source_url: "https://example.com/retail",
      notes: "Retail sales.",
      status: "scheduled"
    }
  ]
};

describe("EventRiskTimeline", () => {
  it("renders empty when there are no upcoming events", () => {
    const c = render(<EventRiskTimeline calendar={{ ...calendar, events: [] }} today="2026-05-12" />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("plots upcoming events as a horizontal bar timeline ordered by date", () => {
    render(<EventRiskTimeline calendar={calendar} today="2026-05-12" />);
    const option = lastOption();
    // yAxis carries event titles in date order; high-importance entries appear first.
    const yAxisData = (option.yAxis as { data: string[] }).data;
    expect(yAxisData).toContain("CPI");
    expect(yAxisData).toContain("FOMC");
    expect(yAxisData).toContain("Retail sales");
  });

  it("drops events that are already in the past relative to `today`", () => {
    render(<EventRiskTimeline calendar={calendar} today="2026-05-14" />);
    const option = lastOption();
    const titles = (option.yAxis as { data: string[] }).data;
    // CPI on 2026-05-13 is past relative to today=2026-05-14 → not in titles.
    expect(titles).not.toContain("CPI");
    expect(titles).toContain("FOMC");
    expect(titles).toContain("Retail sales");
  });
});
