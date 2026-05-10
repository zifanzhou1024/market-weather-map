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
import MacroRegimeQuadrant, {
  buildQuadrantPoints
} from "./MacroRegimeQuadrant";
import GrowthLaborInflationMatrix from "./GrowthLaborInflationMatrix";
import StrategicSourceGapMatrix from "./StrategicSourceGapMatrix";
import type { RegimeSnapshotFile, ScoreSummaryFile } from "../lib/types";

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
});

function makeTrail(
  overrides?: Array<Partial<RegimeSnapshotFile["quadrant_trail"][number]>>
): RegimeSnapshotFile["quadrant_trail"] {
  const base = [
    {
      date: "2026-05-01",
      dollar_change: 0.5,
      real_yield_change: 0.1,
      nominal_yield_change: 0.2,
      vix_percentile: 25,
      credit_change: 0.0
    },
    {
      date: "2026-05-05",
      dollar_change: -0.3,
      real_yield_change: -0.2,
      nominal_yield_change: -0.1,
      vix_percentile: 60,
      credit_change: 0.1
    },
    {
      date: "2026-05-08",
      dollar_change: 0.7,
      real_yield_change: 0.4,
      nominal_yield_change: 0.5,
      vix_percentile: 80,
      credit_change: 0.2
    }
  ];
  if (!overrides) return base;
  return base.map((entry, i) => ({ ...entry, ...(overrides[i] ?? {}) }));
}

describe("MacroRegimeQuadrant", () => {
  it("renders the empty state when trail is empty", () => {
    const c = render(<MacroRegimeQuadrant trail={[]} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(setOption).not.toHaveBeenCalled();
  });

  it("renders ready state with finite trail entries", () => {
    const trail = makeTrail();
    const c = render(<MacroRegimeQuadrant trail={trail} />);
    expect(c.querySelector("[data-state='ready']")).not.toBeNull();
    const points = buildQuadrantPoints(trail);
    expect(points.length).toBe(3);
  });

  it("filters out entries with null or non-finite x/y values", () => {
    const trail: RegimeSnapshotFile["quadrant_trail"] = [
      {
        date: "2026-05-01",
        dollar_change: 0.5,
        real_yield_change: 0.1,
        nominal_yield_change: 0.2,
        vix_percentile: 25
      },
      {
        date: "2026-05-02",
        dollar_change: Number.NaN,
        real_yield_change: 0.1,
        nominal_yield_change: 0.2,
        vix_percentile: 30
      },
      {
        date: "2026-05-03",
        dollar_change: 0.3,
        // @ts-expect-error null is part of the runtime contract
        real_yield_change: null,
        nominal_yield_change: 0.2,
        vix_percentile: 40
      },
      {
        date: "2026-05-04",
        dollar_change: 0.6,
        real_yield_change: 0.3,
        nominal_yield_change: 0.4,
        vix_percentile: 50
      }
    ];
    const points = buildQuadrantPoints(trail);
    expect(points.length).toBe(2);
    expect(points.map((p) => p.date)).toEqual(["2026-05-01", "2026-05-04"]);
  });

  it("marks the last finite entry as the latest point", () => {
    const trail = makeTrail();
    const points = buildQuadrantPoints(trail);
    const latest = points.find((p) => p.isLatest);
    expect(latest?.date).toBe("2026-05-08");
    expect(points.filter((p) => p.isLatest).length).toBe(1);
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
});
