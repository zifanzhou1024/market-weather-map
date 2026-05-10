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

import ShockRiskContributionChart from "./ShockRiskContributionChart";
import HiddenStressMismatchPanel from "./HiddenStressMismatchPanel";
import BondVolatilityProxyChart from "./BondVolatilityProxyChart";
import TailRiskReadinessMatrix from "./TailRiskReadinessMatrix";
import { chartColors } from "../charts/chartTheme";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  ShockRiskMismatchWarning,
  ShockRiskSignal,
  SeriesStatus
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

function lastOption() {
  return setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<string, unknown>;
}

function makeSignal(
  id: string,
  label: string,
  score: number,
  value: number | null = null,
  change: number | null = null
): ShockRiskSignal {
  return {
    id,
    label,
    score,
    value,
    change,
    message: `${label} message`
  };
}

describe("ShockRiskContributionChart", () => {
  it("renders the empty state when there are no active signals", () => {
    const c = render(<ShockRiskContributionChart activeSignals={[]} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(setOption).not.toHaveBeenCalled();
  });

  it("orders y-axis bars ascending by |score| so the largest contributor sits at the top of the rendered chart", () => {
    const signals: ShockRiskSignal[] = [
      makeSignal("a", "Signal A", 12),
      makeSignal("b", "Signal B", -34),
      makeSignal("c", "Signal C", 5)
    ];
    render(<ShockRiskContributionChart activeSignals={signals} />);
    const option = lastOption();
    const yAxisData = (option.yAxis as { data: string[] }).data;
    expect(yAxisData).toEqual(["Signal C", "Signal A", "Signal B"]);
    const series = option.series as Array<{ data: Array<{ value: number }> }>;
    expect(series[0].data.length).toBe(3);
  });

  it("colors positive bars warning and negative bars support", () => {
    const signals: ShockRiskSignal[] = [
      makeSignal("a", "Positive", 22),
      makeSignal("b", "Negative", -22)
    ];
    render(<ShockRiskContributionChart activeSignals={signals} />);
    const option = lastOption();
    const data = (option.series as Array<{ data: Array<{ value: number; itemStyle: { color: string } }> }>)[0].data;
    const positive = data.find((d) => d.value === 22)!;
    const negative = data.find((d) => d.value === -22)!;
    expect(positive.itemStyle.color).toBe(chartColors.warning);
    expect(negative.itemStyle.color).toBe(chartColors.support);
  });
});

describe("HiddenStressMismatchPanel", () => {
  it("renders the empty state when there are no warnings", () => {
    const c = render(<HiddenStressMismatchPanel warnings={[]} />);
    const empty = c.querySelector(".hidden-stress-mismatch-panel-empty");
    expect(empty).not.toBeNull();
    expect(empty?.textContent ?? "").toContain("No mismatches");
  });

  it("renders each warning's label and message", () => {
    const warnings: ShockRiskMismatchWarning[] = [
      { id: "w1", label: "VIX vs credit", message: "VIX calm but credit widening." },
      { id: "w2", label: "VVIX vs VIX", message: "VVIX up while VIX flat." }
    ];
    const c = render(<HiddenStressMismatchPanel warnings={warnings} />);
    const text = c.textContent ?? "";
    expect(text).toContain("VIX vs credit");
    expect(text).toContain("VIX calm but credit widening.");
    expect(text).toContain("VVIX vs VIX");
    expect(text).toContain("VVIX up while VIX flat.");
  });

  it("preserves the caller's order across rows", () => {
    const warnings: ShockRiskMismatchWarning[] = [
      { id: "first", label: "First label", message: "First message." },
      { id: "second", label: "Second label", message: "Second message." },
      { id: "third", label: "Third label", message: "Third message." }
    ];
    const c = render(<HiddenStressMismatchPanel warnings={warnings} />);
    const labels = Array.from(c.querySelectorAll(".hidden-stress-mismatch-panel-label")).map(
      (el) => el.textContent
    );
    expect(labels).toEqual(["First label", "Second label", "Third label"]);
  });
});

function makeProxySeries(observations: Array<{ date: string; value: number }>): DerivedSeriesFile {
  return {
    series_id: "bond_volatility_proxy",
    generated_at_utc: "2026-05-09T00:00:00Z",
    source: "Derived",
    source_url: "https://example.com/proxy",
    frequency: "daily",
    units: "annualized %",
    depends_on: ["us10y"],
    method: "rolling_realized_vol_v1",
    observations
  };
}

describe("BondVolatilityProxyChart", () => {
  it("renders empty when series is undefined", () => {
    const c = render(<BondVolatilityProxyChart series={undefined} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("renders empty when observations array is empty", () => {
    const c = render(<BondVolatilityProxyChart series={makeProxySeries([])} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("includes the NOT MOVE caveat in title and description", () => {
    const c = render(
      <BondVolatilityProxyChart
        series={makeProxySeries([
          { date: "2026-05-05", value: 6.1 },
          { date: "2026-05-06", value: 6.4 },
          { date: "2026-05-07", value: 6.2 }
        ])}
      />
    );
    const text = c.textContent ?? "";
    expect(text).toContain("NOT MOVE");
    expect(text).toContain("ICE MOVE");
  });
});

function statusEntry(status: SeriesStatus["status"]): SeriesStatus {
  return {
    status,
    last_observation: "2026-05-08",
    source: "Test",
    expected_frequency: "daily",
    freshness_days: 1,
    max_stale_days: 5
  };
}

function makeStatusFile(series: Record<string, SeriesStatus>): DataStatusFile {
  return {
    last_successful_update_utc: "2026-05-09T00:00:00Z",
    generated_at_utc: "2026-05-09T00:00:00Z",
    overall_status: "ok",
    series
  };
}

describe("TailRiskReadinessMatrix", () => {
  it("renders all expected category groups", () => {
    const c = render(<TailRiskReadinessMatrix status={makeStatusFile({})} />);
    const text = c.textContent ?? "";
    expect(text).toContain("Volatility & VVIX");
    expect(text).toContain("Vol curve (derived)");
    expect(text).toContain("Tail-risk indices");
    expect(text).toContain("Bond-vol proxy");
    expect(text).toContain("Options sentiment");
    expect(text).toContain("VX futures curve");
  });

  it("uses --active badge class for ok status", () => {
    const c = render(
      <TailRiskReadinessMatrix
        status={makeStatusFile({
          vix: statusEntry("ok")
        })}
      />
    );
    const badges = Array.from(c.querySelectorAll(".tail-risk-readiness-row")).filter((row) =>
      (row.textContent ?? "").includes("VIX")
    );
    expect(badges.length).toBeGreaterThan(0);
    const badge = badges[0].querySelector(".tail-risk-readiness-badge");
    expect(badge?.classList.contains("tail-risk-readiness-badge--active")).toBe(true);
    expect(badge?.textContent).toContain("ok");
  });

  it("uses --gated badge class for terms_review_needed and unavailable statuses", () => {
    const c = render(
      <TailRiskReadinessMatrix
        status={makeStatusFile({
          move_index: statusEntry("terms_review_needed"),
          skew_index: statusEntry("unavailable")
        })}
      />
    );
    const rows = Array.from(c.querySelectorAll(".tail-risk-readiness-row"));
    const moveRow = rows.find((r) => (r.textContent ?? "").includes("ICE MOVE"));
    const skewRow = rows.find((r) => (r.textContent ?? "").includes("Cboe SKEW"));
    expect(
      moveRow?.querySelector(".tail-risk-readiness-badge")?.classList.contains(
        "tail-risk-readiness-badge--gated"
      )
    ).toBe(true);
    expect(
      skewRow?.querySelector(".tail-risk-readiness-badge")?.classList.contains(
        "tail-risk-readiness-badge--gated"
      )
    ).toBe(true);
  });

  it("uses --failed badge class for failed status (distinct from gated)", () => {
    const c = render(
      <TailRiskReadinessMatrix
        status={makeStatusFile({
          vix: statusEntry("failed")
        })}
      />
    );
    const rows = Array.from(c.querySelectorAll(".tail-risk-readiness-row"));
    const vixRow = rows.find((r) => (r.textContent ?? "").includes("VIX"));
    const badge = vixRow?.querySelector(".tail-risk-readiness-badge");
    expect(badge?.classList.contains("tail-risk-readiness-badge--failed")).toBe(true);
    expect(badge?.classList.contains("tail-risk-readiness-badge--gated")).toBe(false);
    expect(badge?.textContent).toContain("failed");
  });

  it("renders the bond-vol proxy row with the exact 'Bond-vol proxy (not MOVE)' label", () => {
    const c = render(<TailRiskReadinessMatrix status={makeStatusFile({})} />);
    const labels = Array.from(c.querySelectorAll(".tail-risk-readiness-label")).map(
      (el) => el.textContent
    );
    expect(labels).toContain("Bond-vol proxy (not MOVE)");
  });
});
