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

import MacroClimateHeatmap, {
  buildMacroClimateHeatmapPayload
} from "./MacroClimateHeatmap";
import MacroRegimeQuadrant from "./MacroRegimeQuadrant";
import GrowthLaborInflationMatrix from "./GrowthLaborInflationMatrix";
import StrategicSourceGapMatrix from "./StrategicSourceGapMatrix";
import type {
  RegimeDashboardFile,
  RegimeWindowKey,
  RegimeWindowPoint,
  ScoreSummaryFile
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

function makeScoreSummary(overrides?: {
  bucket_scores?: Record<string, number>;
  bucket_weights?: Record<string, number>;
  top_supports?: string[];
  top_risks?: string[];
}): ScoreSummaryFile {
  const bucket_scores = overrides?.bucket_scores ?? {
    growth: 41.66,
    labor: 68.16,
    inflation: -100.0,
    consumer_production: 66.67,
    housing: -0.96,
    consumer_balance_sheet: 39.53,
    real_yields: -46.04
  };
  const bucket_weights = overrides?.bucket_weights ?? {
    growth: 0.18,
    labor: 0.18,
    inflation: 0.16,
    consumer_production: 0.16,
    housing: 0.12,
    consumer_balance_sheet: 0.1,
    real_yields: 0.1
  };
  return {
    generated_at_utc: "2026-05-09T23:33:42Z",
    date: "2026-05-08",
    method_version: "phase5-pr4-strategic-macro-completeness-v1",
    scores: {
      market_weather: {
        score: 0,
        label: "Neutral",
        confidence: 1,
        confidence_reasons: [],
        bucket_scores: {},
        bucket_weights: {},
        top_supports: [],
        top_risks: [],
        recent_changes: [],
        missing_or_stale_notes: []
      },
      macro_climate: {
        score: 13.67,
        label: "Mixed",
        confidence: 0.99,
        confidence_reasons: [],
        bucket_scores,
        bucket_weights,
        top_supports: overrides?.top_supports ?? [],
        top_risks: overrides?.top_risks ?? [],
        recent_changes: [],
        missing_or_stale_notes: []
      },
      fragility: {
        score: 0,
        label: "Low Fragility",
        confidence: 1,
        confidence_reasons: [],
        bucket_scores: {},
        bucket_weights: {},
        top_supports: [],
        top_risks: [],
        recent_changes: [],
        missing_or_stale_notes: []
      }
    },
    conflicting_signals: [],
    data_quality: {
      coverage_confidence: 1,
      freshness_confidence: 1,
      model_confidence: 1,
      source_confidence: 1,
      overall_confidence: 1,
      tier: "high",
      reasons: []
    }
  };
}

describe("MacroClimateHeatmap", () => {
  it("renders the empty state when bucket_scores is empty", () => {
    const summary = makeScoreSummary({ bucket_scores: {}, bucket_weights: {} });
    const c = render(<MacroClimateHeatmap scoreSummary={summary} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(setOption).not.toHaveBeenCalled();
  });

  it("renders ready state with all 7 buckets when given a normal score summary", () => {
    const summary = makeScoreSummary();
    const c = render(<MacroClimateHeatmap scoreSummary={summary} />);
    expect(c.querySelector("[data-state='ready']")).not.toBeNull();
    const payload = buildMacroClimateHeatmapPayload(summary);
    expect(payload.bucketKeys.length).toBe(7);
  });

  it("orders buckets by absolute weighted contribution descending", () => {
    const summary = makeScoreSummary({
      bucket_scores: {
        growth: 10,
        labor: 50,
        inflation: -90
      },
      bucket_weights: {
        growth: 0.5, // |contribution| = 5
        labor: 0.2, //  |contribution| = 10
        inflation: 0.3 // |contribution| = 27
      }
    });
    const payload = buildMacroClimateHeatmapPayload(summary);
    expect(payload.bucketKeys).toEqual(["inflation", "labor", "growth"]);
  });

  it("humanises bucket keys for axis labels", () => {
    const summary = makeScoreSummary({
      bucket_scores: { consumer_balance_sheet: 20 },
      bucket_weights: { consumer_balance_sheet: 0.1 }
    });
    const payload = buildMacroClimateHeatmapPayload(summary);
    expect(payload.axisLabels).toEqual(["Consumer balance sheet"]);
  });

  it("humanises a single-word bucket key by capitalising the first letter only", () => {
    const summary = makeScoreSummary({
      bucket_scores: { growth: 25 },
      bucket_weights: { growth: 0.18 }
    });
    const payload = buildMacroClimateHeatmapPayload(summary);
    expect(payload.axisLabels).toEqual(["Growth"]);
  });
});

function makeDashboardWindow(seed: number, count: number): RegimeWindowPoint[] {
  const points: RegimeWindowPoint[] = [];
  const start = new Date("2026-03-01").getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  for (let i = 0; i < count; i += 1) {
    const date = new Date(start + i * oneDay).toISOString().slice(0, 10);
    points.push({
      date,
      real_yield_change_bps: Math.sin((i + seed) / 5) * 25,
      dollar_change_pct: Math.cos((i + seed) / 7) * 1.5,
      vix_percentile: ((i * 5 + seed) % 100),
      credit_change_bps: Math.sin(i / 4) * 30,
      fragility_score: 0.2,
      regime: i % 2 === 0 ? "risk_on_easing" : "rotation_reflation"
    });
  }
  return points;
}

function makeDashboardFixture(): RegimeDashboardFile {
  return {
    date: "2026-05-01",
    generated_at_utc: "2026-05-10T14:58:30Z",
    method_version: "phase8-pr1-regime-dashboard-v1",
    thresholds: { real_yield_neutral_bps: 5.0, dollar_neutral_pct: 0.5 },
    windows: {
      "20D": makeDashboardWindow(1, 20),
      "60D": makeDashboardWindow(2, 60),
      "120D": makeDashboardWindow(3, 120)
    }
  };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function stubFetchOk(fixture: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => fixture
    }))
  );
}

function stubFetch404() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({})
    }))
  );
}

describe("MacroRegimeQuadrant", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the empty state when regime_dashboard.json is missing (404)", async () => {
    stubFetch404();
    const c = render(<MacroRegimeQuadrant />);
    await flush();
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
  });

  it("renders ready state with points from regime_dashboard.json (default 60D)", async () => {
    const fixture = makeDashboardFixture();
    stubFetchOk(fixture);
    const c = render(<MacroRegimeQuadrant />);
    await flush();
    expect(c.querySelector("[data-state='ready']")).not.toBeNull();
    const option = lastOption();
    const series = option?.series as Array<{ type: string; data: unknown[] }>;
    const scatter = series.find((s) => s.type === "scatter");
    // Default window is 60D — should match the 60D window length in the fixture.
    expect(scatter?.data.length).toBe(fixture.windows["60D"].length);
  });

  it("uses real-yield (x) and dollar (y) axis convention", async () => {
    stubFetchOk(makeDashboardFixture());
    render(<MacroRegimeQuadrant />);
    await flush();
    const option = lastOption();
    const xName = String((option?.xAxis as { name?: string })?.name ?? "").toLowerCase();
    const yName = String((option?.yAxis as { name?: string })?.name ?? "").toLowerCase();
    expect(xName).toContain("real");
    expect(xName).toContain("yield");
    expect(yName).toContain("dollar");
  });

  it("switches window when a different lookback is selected", async () => {
    const fixture = makeDashboardFixture();
    stubFetchOk(fixture);
    const c = render(<MacroRegimeQuadrant />);
    await flush();
    const radios = Array.from(c.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
    const oneTwentyD = radios.find((b) => b.textContent === "120D");
    expect(oneTwentyD).toBeDefined();
    act(() => {
      oneTwentyD!.click();
    });
    await flush();
    const option = lastOption();
    const series = option?.series as Array<{ type: string; data: unknown[] }>;
    const scatter = series.find((s) => s.type === "scatter");
    expect(scatter?.data.length).toBe(fixture.windows["120D"].length);
  });

  it("marks the last point with a label that includes its date", async () => {
    const fixture = makeDashboardFixture();
    stubFetchOk(fixture);
    render(<MacroRegimeQuadrant />);
    await flush();
    const option = lastOption();
    const series = option?.series as Array<{
      type: string;
      data: Array<{ label?: { show?: boolean; formatter?: string } }>;
    }>;
    const scatter = series.find((s) => s.type === "scatter");
    const labeled = (scatter?.data ?? []).filter((d) => d.label?.show === true);
    expect(labeled).toHaveLength(1);
    const lastDate =
      fixture.windows["60D"][fixture.windows["60D"].length - 1].date;
    expect(labeled[0].label!.formatter ?? "").toContain(lastDate);
  });

  it("renders the four quadrant meaning strings in its legend", async () => {
    stubFetchOk(makeDashboardFixture());
    const c = render(<MacroRegimeQuadrant />);
    await flush();
    const text = (c.textContent ?? "").toLowerCase();
    expect(text).toContain("risk-on easing");
    expect(text).toContain("global tightening");
    expect(text).toContain("safe-haven");
    expect(text).toContain("rotation");
  });

  it("defaults to the 60D window selector being active", async () => {
    stubFetchOk(makeDashboardFixture());
    const c = render(<MacroRegimeQuadrant />);
    await flush();
    const radios = Array.from(c.querySelectorAll('[role="radio"]'));
    const sixtyD = radios.find((b) => b.textContent === "60D");
    expect(sixtyD?.getAttribute("aria-checked")).toBe("true");
    // Spec sanity: 20D and 120D should NOT be checked at first render.
    const otherWindows: RegimeWindowKey[] = ["20D", "120D"];
    for (const w of otherWindows) {
      const node = radios.find((b) => b.textContent === w);
      expect(node?.getAttribute("aria-checked")).toBe("false");
    }
  });
});

describe("GrowthLaborInflationMatrix", () => {
  it("renders three cards for growth, labor, and inflation", () => {
    const summary = makeScoreSummary();
    const c = render(<GrowthLaborInflationMatrix scoreSummary={summary} />);
    const cards = c.querySelectorAll(".growth-labor-inflation-card");
    expect(cards.length).toBe(3);
    const text = c.textContent ?? "";
    expect(text).toContain("Growth");
    expect(text).toContain("Labor");
    expect(text).toContain("Inflation");
  });

  it("shows em-dash placeholders for a bucket missing from bucket_scores", () => {
    const summary = makeScoreSummary({
      bucket_scores: { growth: 30, labor: 40 },
      bucket_weights: { growth: 0.18, labor: 0.18 }
    });
    const c = render(<GrowthLaborInflationMatrix scoreSummary={summary} />);
    const cards = Array.from(c.querySelectorAll(".growth-labor-inflation-card"));
    const inflationCard = cards.find((card) => (card.textContent ?? "").includes("Inflation"));
    expect(inflationCard).toBeTruthy();
    expect(inflationCard?.textContent ?? "").toContain("—");
    expect(inflationCard?.textContent ?? "").toContain("Bucket not scored in current run.");
  });

  it("picks a top-supports note matching the bucket label", () => {
    const summary = makeScoreSummary({
      top_supports: ["Growth inputs are supportive."]
    });
    const c = render(<GrowthLaborInflationMatrix scoreSummary={summary} />);
    const cards = Array.from(c.querySelectorAll(".growth-labor-inflation-card"));
    const growthCard = cards.find((card) => (card.textContent ?? "").startsWith("Growth"));
    expect(growthCard?.textContent ?? "").toContain("Growth inputs are supportive.");
  });

  it("falls back to a neutral note when no bucket-specific support or risk exists", () => {
    const summary = makeScoreSummary({
      top_supports: ["Macro overall is steady."],
      top_risks: []
    });
    const c = render(<GrowthLaborInflationMatrix scoreSummary={summary} />);
    const cards = Array.from(c.querySelectorAll(".growth-labor-inflation-card"));
    const growthCard = cards.find((card) => (card.textContent ?? "").startsWith("Growth"));
    expect(growthCard?.textContent ?? "").toContain("No bucket-specific note in the latest read.");
  });

  it("does not cross-attribute a note that mentions another bucket name mid-sentence", () => {
    // The note STARTS with "Inflation" so it must surface only on the inflation
    // card. The growth card must NOT pick it up just because the word "growth"
    // appears later in the sentence.
    const summary = makeScoreSummary({
      top_supports: ["Inflation pressure constrains growth opportunities."],
      top_risks: []
    });
    const c = render(<GrowthLaborInflationMatrix scoreSummary={summary} />);
    const cards = Array.from(c.querySelectorAll(".growth-labor-inflation-card"));
    const growthCard = cards.find((card) => (card.textContent ?? "").startsWith("Growth"));
    const inflationCard = cards.find((card) =>
      (card.textContent ?? "").startsWith("Inflation")
    );
    expect(growthCard?.textContent ?? "").not.toContain(
      "Inflation pressure constrains growth opportunities."
    );
    expect(growthCard?.textContent ?? "").toContain(
      "No bucket-specific note in the latest read."
    );
    expect(inflationCard?.textContent ?? "").toContain(
      "Inflation pressure constrains growth opportunities."
    );
  });
});

describe("StrategicSourceGapMatrix", () => {
  it("renders all category headings in declaration order", () => {
    const c = render(<StrategicSourceGapMatrix />);
    const headings = Array.from(c.querySelectorAll(".strategic-source-gap-group-heading")).map(
      (el) => el.textContent
    );
    expect(headings).toEqual([
      "Activity breadth",
      "Banking",
      "Valuation",
      "Fiscal / supply",
      "Earnings"
    ]);
  });

  it("sorts importance non-increasing within each category", () => {
    const c = render(<StrategicSourceGapMatrix />);
    const groups = Array.from(c.querySelectorAll(".strategic-source-gap-group"));
    for (const group of groups) {
      const importanceCells = Array.from(
        group.querySelectorAll(".strategic-source-gap-importance")
      );
      const importances = importanceCells.map((el) => {
        // Count filled dots ●
        return (el.textContent ?? "").split("").filter((c) => c === "●").length;
      });
      for (let i = 1; i < importances.length; i++) {
        expect(importances[i]).toBeLessThanOrEqual(importances[i - 1]);
      }
    }
  });

  it("uses the --gated badge modifier on every row", () => {
    const c = render(<StrategicSourceGapMatrix />);
    const badges = Array.from(c.querySelectorAll(".strategic-source-gap-badge"));
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(badge.classList.contains("strategic-source-gap-badge--gated")).toBe(true);
    }
  });

  it("renders an unlock paragraph for every row", () => {
    const c = render(<StrategicSourceGapMatrix />);
    const rows = Array.from(c.querySelectorAll(".strategic-source-gap-row"));
    const unlocks = Array.from(c.querySelectorAll(".strategic-source-gap-unlock"));
    expect(rows.length).toBeGreaterThan(0);
    expect(unlocks.length).toBe(rows.length);
    for (const unlock of unlocks) {
      expect(unlock.textContent ?? "").toContain("Unlocks:");
    }
  });

  it("renders external research links for strategic source gaps", () => {
    const c = render(<StrategicSourceGapMatrix />);

    expect(
      c.querySelector(
        "a[href='https://en.macromicro.me/collections/34/us-stock-relative/45614/sp500-shiller-cape-ratio']"
      )
    ).not.toBeNull();
    expect(c.querySelector("a[href='https://en.macromicro.me/charts/27100/sp500-forward-pe-ratio']"))
      .not.toBeNull();
    expect(
      c.querySelector(
        "a[href='https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/']"
      )
    ).not.toBeNull();
  });
});
