import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

vi.mock("../lib/data", () => ({
  loadVolatilityDashboard: vi.fn()
}));

import VixVvixHiddenStressPanel from "./VixVvixHiddenStressPanel";
import { loadVolatilityDashboard } from "../lib/data";
import type {
  VolatilityDashboardFile,
  VolatilityHiddenStressPoint
} from "../lib/types";

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

async function flushPromises(container: HTMLElement, expectedText: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (container.textContent?.includes(expectedText)) return;
  }
  expect(container.textContent).toContain(expectedText);
}

async function flushPromisesUntilEmpty(container: HTMLElement, expectedSelector: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (container.querySelector(expectedSelector)) return;
  }
  expect(container.querySelector(expectedSelector)).not.toBeNull();
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
  vi.clearAllMocks();
});

function makeHiddenStressPoint(
  overrides: Partial<VolatilityHiddenStressPoint> = {}
): VolatilityHiddenStressPoint {
  return {
    date: overrides.date ?? "2026-05-08",
    vix_value: overrides.vix_value ?? 18.2,
    vvix_value: overrides.vvix_value ?? 92.4,
    vix_percentile: overrides.vix_percentile ?? 45.2,
    vvix_percentile: overrides.vvix_percentile ?? 60.1,
    hidden_stress_score: overrides.hidden_stress_score ?? 14.9,
    state: overrides.state ?? "watch"
  };
}

function makeDashboard(
  hidden_stress: VolatilityHiddenStressPoint[]
): VolatilityDashboardFile {
  return {
    generated_at_utc: "2026-05-08T00:00:00Z",
    date: "2026-05-08",
    method_version: "test-1",
    latest_curve: [],
    ratio_history: [],
    hidden_stress,
    thresholds: {
      vix9d_vix_calm: 0.95,
      vix9d_vix_stress: 1.05,
      vix_vix3m_calm: 0.95,
      vix_vix3m_stress: 1.05,
      hidden_stress_watch: 10,
      hidden_stress_elevated: 25
    }
  };
}

describe("VixVvixHiddenStressPanel", () => {
  it("renders score and watch badge with a fixture (latest score is shown)", async () => {
    vi.mocked(loadVolatilityDashboard).mockResolvedValue(
      makeDashboard([
        makeHiddenStressPoint({ date: "2026-04-30", hidden_stress_score: 8, state: "calm" }),
        makeHiddenStressPoint({ date: "2026-05-08", hidden_stress_score: 14.9, state: "watch" })
      ])
    );

    const container = render(<VixVvixHiddenStressPanel />);
    await flushPromises(container, "VIX vs VVIX percentile mismatch");

    expect(container.querySelector(".vix-vvix-hidden-stress-panel")).not.toBeNull();
    const text = container.textContent ?? "";
    expect(text).toContain("VIX vs VVIX percentile mismatch");
    // The latest score should appear as a numeric.
    expect(text).toMatch(/14\.9/);
  });

  it("renders a calm badge with chartColors.support styling when latest state is calm", async () => {
    vi.mocked(loadVolatilityDashboard).mockResolvedValue(
      makeDashboard([
        makeHiddenStressPoint({ date: "2026-05-08", hidden_stress_score: 2, state: "calm" })
      ])
    );

    const container = render(<VixVvixHiddenStressPanel />);
    await flushPromises(container, "VIX vs VVIX percentile mismatch");

    expect(container.querySelector(".chart-state-badge--calm")).not.toBeNull();
  });

  it("renders a watch badge when latest state is watch", async () => {
    vi.mocked(loadVolatilityDashboard).mockResolvedValue(
      makeDashboard([
        makeHiddenStressPoint({ date: "2026-05-08", hidden_stress_score: 12, state: "watch" })
      ])
    );

    const container = render(<VixVvixHiddenStressPanel />);
    await flushPromises(container, "VIX vs VVIX percentile mismatch");

    expect(container.querySelector(".chart-state-badge--watch")).not.toBeNull();
  });

  it("renders a risk badge when latest state is elevated", async () => {
    vi.mocked(loadVolatilityDashboard).mockResolvedValue(
      makeDashboard([
        makeHiddenStressPoint({ date: "2026-05-08", hidden_stress_score: 30, state: "elevated" })
      ])
    );

    const container = render(<VixVvixHiddenStressPanel />);
    await flushPromises(container, "VIX vs VVIX percentile mismatch");

    expect(container.querySelector(".chart-state-badge--risk")).not.toBeNull();
  });

  it("renders an inline trend strip via EChartPanel using setOption", async () => {
    vi.mocked(loadVolatilityDashboard).mockResolvedValue(
      makeDashboard(
        Array.from({ length: 30 }, (_, i) =>
          makeHiddenStressPoint({
            date: `2026-04-${String(i + 1).padStart(2, "0")}`,
            hidden_stress_score: 5 + (i % 8),
            state: "watch"
          })
        )
      )
    );

    const container = render(<VixVvixHiddenStressPanel />);
    await flushPromises(container, "VIX vs VVIX percentile mismatch");
    expect(setOption).toHaveBeenCalled();
    const option = setOption.mock.calls[setOption.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    const series = option.series as Array<{ type: string; data: unknown[] }>;
    expect(Array.isArray(series)).toBe(true);
    expect(series[0].type).toBe("line");
    expect(series[0].data.length).toBeGreaterThan(0);
  });

  it("renders fallback when loadVolatilityDashboard returns null", async () => {
    vi.mocked(loadVolatilityDashboard).mockResolvedValue(null);

    const container = render(<VixVvixHiddenStressPanel />);
    await flushPromisesUntilEmpty(container, ".vix-vvix-hidden-stress-panel");

    const text = container.textContent ?? "";
    expect(text.toLowerCase()).toContain(
      "vix/vvix percentile history is not currently active."
    );
    // No state badge in the fallback.
    expect(container.querySelector(".chart-state-badge")).toBeNull();
    // No setOption call in the fallback (no trend strip).
    expect(setOption).not.toHaveBeenCalled();
  });

  it("renders fallback when hidden_stress array is empty", async () => {
    vi.mocked(loadVolatilityDashboard).mockResolvedValue(makeDashboard([]));

    const container = render(<VixVvixHiddenStressPanel />);
    await flushPromisesUntilEmpty(container, ".vix-vvix-hidden-stress-panel");

    const text = container.textContent ?? "";
    expect(text.toLowerCase()).toContain(
      "vix/vvix percentile history is not currently active."
    );
    expect(container.querySelector(".chart-state-badge")).toBeNull();
    expect(setOption).not.toHaveBeenCalled();
  });

  it("does not import or extend HiddenStressMismatchPanel (distinct from PR 6)", () => {
    const sourcePath = resolve(
      __dirname,
      "VixVvixHiddenStressPanel.tsx"
    );
    const source = readFileSync(sourcePath, "utf8");
    expect(source).not.toMatch(/HiddenStressMismatchPanel/);
  });
});
