import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setOption = vi.fn();
const resize = vi.fn();
const dispose = vi.fn();

vi.mock("echarts/core", () => ({
  init: vi.fn(() => ({
    setOption,
    resize,
    dispose
  })),
  use: vi.fn()
}));

vi.mock("echarts/charts", () => ({
  LineChart: {},
  BarChart: {},
  HeatmapChart: {}
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

import EChartPanel from "./EChartPanel";
import * as echartsCore from "echarts/core";

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
  (echartsCore.init as ReturnType<typeof vi.fn>).mockClear();
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

describe("EChartPanel", () => {
  it("renders the title and description in the header", () => {
    const c = render(
      <EChartPanel
        title="VIX curve proxy"
        description="VIX9D, VIX, VIX3M term structure"
        state="empty"
        emptyMessage="No volatility observations available."
      />
    );
    expect(c.textContent).toContain("VIX curve proxy");
    expect(c.textContent).toContain("VIX9D, VIX, VIX3M term structure");
  });

  it("renders the loading state when state=loading", () => {
    const c = render(<EChartPanel title="VIX curve proxy" state="loading" />);
    const region = c.querySelector("[data-state='loading']");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.textContent).toMatch(/loading/i);
  });

  it("renders the error state with the provided message", () => {
    const c = render(
      <EChartPanel title="VIX curve proxy" state="error" errorMessage="Failed to load chart data." />
    );
    const region = c.querySelector("[data-state='error']");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("alert");
    expect(region?.textContent).toContain("Failed to load chart data.");
  });

  it("renders the empty state with the provided message", () => {
    const c = render(
      <EChartPanel title="VIX curve proxy" state="empty" emptyMessage="No active observations." />
    );
    const region = c.querySelector("[data-state='empty']");
    expect(region).not.toBeNull();
    expect(region?.textContent).toContain("No active observations.");
  });

  it("renders the chart container in the ready state with the provided aria label", () => {
    const c = render(
      <EChartPanel
        title="VIX curve proxy"
        ariaLabel="VIX9D over VIX over VIX3M term-structure chart"
        state="ready"
        option={{ series: [] }}
      />
    );
    const chart = c.querySelector("[data-state='ready']");
    expect(chart).not.toBeNull();
    expect(chart?.getAttribute("role")).toBe("img");
    expect(chart?.getAttribute("aria-label")).toBe("VIX9D over VIX over VIX3M term-structure chart");
  });

  it("initializes echarts and applies the option when state becomes ready", () => {
    render(
      <EChartPanel
        title="VIX curve proxy"
        state="ready"
        option={{ title: { text: "Test" }, series: [] }}
      />
    );
    expect(echartsCore.init).toHaveBeenCalled();
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({ title: { text: "Test" }, series: [] })
    );
  });

  it("does not initialize echarts when state is not ready", () => {
    render(<EChartPanel title="VIX curve proxy" state="loading" />);
    expect(echartsCore.init).not.toHaveBeenCalled();
    expect(setOption).not.toHaveBeenCalled();
  });

  it("disposes the echarts instance on unmount", () => {
    render(<EChartPanel title="VIX curve proxy" state="ready" option={{ series: [] }} />);
    expect(dispose).not.toHaveBeenCalled();
    if (root) {
      act(() => root!.unmount());
      root = undefined;
    }
    expect(dispose).toHaveBeenCalled();
  });

  it("re-applies the option when it changes between renders", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
      root.render(
        <EChartPanel title="VIX" state="ready" option={{ title: { text: "First" }, series: [] }} />
      );
    });
    expect(setOption).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: { text: "First" } })
    );
    act(() => {
      root!.render(
        <EChartPanel title="VIX" state="ready" option={{ title: { text: "Second" }, series: [] }} />
      );
    });
    expect(setOption).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: { text: "Second" } })
    );
  });
});
