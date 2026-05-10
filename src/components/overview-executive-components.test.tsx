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

import MarketBriefHeader from "./MarketBriefHeader";
import MissingSignalPanel from "./MissingSignalPanel";
import ScoreContributionHeatmap from "./ScoreContributionHeatmap";
import type {
  ScoreSummaryFile,
  SignalMissingEntry,
  SignalPriorityFile
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

const overallRead: SignalPriorityFile["overall_read"] = {
  short_term: { label: "Mixed", score: 7.18, confidence: 1.0 },
  long_term: { label: "Mixed", score: 14.44, confidence: 0.99 },
  fragility: { label: "Low Fragility", score: 39.47, confidence: 0.99 },
  regime: { label: "Mixed" }
};

describe("MarketBriefHeader", () => {
  it("renders the four headline reads with their labels and scores", () => {
    const c = render(<MarketBriefHeader overallRead={overallRead} date="2026-05-07" />);
    expect(c.textContent).toContain("Short-term");
    expect(c.textContent).toContain("Long-term");
    expect(c.textContent).toContain("Fragility");
    expect(c.textContent).toContain("Regime");
    // Active reads include label + signed score.
    expect(c.textContent).toContain("Mixed");
    expect(c.textContent).toContain("Low Fragility");
    expect(c.textContent).toMatch(/\+?7\.2|7\.18/);
    expect(c.textContent).toMatch(/14\.4/);
    expect(c.textContent).toMatch(/39\.5|39\.47/);
  });

  it("shows confidence as a percentage for the three scored reads", () => {
    const c = render(<MarketBriefHeader overallRead={overallRead} date="2026-05-07" />);
    // 1.0 → 100%, 0.99 → 99% (twice).
    const text = c.textContent ?? "";
    expect(text.match(/100\s*%/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(text.match(/99\s*%/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("does not render a score or confidence for the regime entry", () => {
    const c = render(<MarketBriefHeader overallRead={overallRead} date="2026-05-07" />);
    const regimeCard = Array.from(c.querySelectorAll(".market-brief-card"))
      .find((node) => node.textContent?.includes("Regime"));
    expect(regimeCard).toBeTruthy();
    // The regime card has only the label — no score number, no confidence percent.
    expect(regimeCard?.querySelector(".market-brief-card__score")).toBeNull();
    expect(regimeCard?.querySelector(".market-brief-card__confidence")).toBeNull();
  });

  it("renders the snapshot date so users know how fresh the read is", () => {
    const c = render(<MarketBriefHeader overallRead={overallRead} date="2026-05-07" />);
    expect(c.textContent).toContain("2026-05-07");
  });
});

const moveMissing: SignalMissingEntry = {
  id: "move_index",
  label: "MOVE Index (bond volatility)",
  group: "Volatility & tail risk",
  category: "volatility",
  horizon: "fragility",
  importance: 4,
  source_status: "terms_review_needed",
  message: "Candidate source requires access or terms review before scoring.",
  why_it_matters: "Bond-volatility moves can pressure markets even when equity volatility is calm."
};

const skewMissing: SignalMissingEntry = {
  id: "skew_index",
  label: "Cboe SKEW",
  group: "Volatility & tail risk",
  category: "volatility",
  horizon: "short_term",
  importance: 4,
  source_status: "terms_review_needed",
  message: "Candidate source requires access or terms review before scoring.",
  why_it_matters: "SKEW measures tail-risk pricing in S&P options beyond at-the-money volatility."
};

describe("MissingSignalPanel", () => {
  it("renders an empty state when there are no missing signals", () => {
    const c = render(<MissingSignalPanel signals={[]} />);
    expect(c.textContent).toContain("Missing High-Value Signals");
    expect(c.textContent?.toLowerCase()).toContain("all high-value signals");
    expect(c.querySelector(".missing-signal-panel-table")).toBeNull();
  });

  it("renders each missing signal with label, importance, source status, and why_it_matters", () => {
    const c = render(<MissingSignalPanel signals={[moveMissing, skewMissing]} />);
    expect(c.textContent).toContain("MOVE Index (bond volatility)");
    expect(c.textContent).toContain("Cboe SKEW");
    expect(c.textContent).toContain("terms_review_needed");
    expect(c.textContent).toContain("Bond-volatility moves can pressure markets");
    expect(c.textContent).toContain("SKEW measures tail-risk pricing");
    expect(c.textContent).toContain("Importance");
  });

  it("preserves caller-provided order (caller pre-ranks by importance × severity × etc.)", () => {
    const c = render(<MissingSignalPanel signals={[skewMissing, moveMissing]} />);
    const labels = Array.from(c.querySelectorAll(".missing-signal-panel-row")).map((node) =>
      node.querySelector(".missing-signal-panel-label")?.textContent
    );
    expect(labels).toEqual(["Cboe SKEW", "MOVE Index (bond volatility)"]);
  });

  it("shows the category and horizon as inline metadata badges", () => {
    const c = render(<MissingSignalPanel signals={[moveMissing]} />);
    expect(c.textContent).toContain("Volatility");
    expect(c.textContent).toContain("Fragility");
  });
});

const scoreSummary: ScoreSummaryFile = {
  generated_at_utc: "2026-05-08T00:17:53Z",
  date: "2026-05-07",
  method_version: "phase5-pr4-strategic-macro-completeness-v1",
  conflicting_signals: [],
  data_quality: {
    coverage_confidence: 1,
    freshness_confidence: 1,
    model_confidence: 1,
    source_confidence: 1,
    overall_confidence: 1,
    reasons: []
  },
  scores: {
    market_weather: {
      score: 7.18,
      label: "Mixed",
      confidence: 1.0,
      confidence_reasons: [],
      bucket_scores: {
        credit_spreads: 62.3,
        rates_real_yields: -33.34,
        volatility_tail_risk: 23.94
      },
      bucket_weights: { credit_spreads: 0.22, rates_real_yields: 0.15, volatility_tail_risk: 0.15 },
      top_supports: [],
      top_risks: [],
      recent_changes: [],
      missing_or_stale_notes: []
    },
    macro_climate: {
      score: 14.44,
      label: "Mixed",
      confidence: 0.99,
      confidence_reasons: [],
      bucket_scores: {
        growth: 41.66,
        inflation: -100,
        labor: 65.39
      },
      bucket_weights: { growth: 0.18, inflation: 0.16, labor: 0.18 },
      top_supports: [],
      top_risks: [],
      recent_changes: [],
      missing_or_stale_notes: []
    },
    fragility: {
      score: 39.47,
      label: "Low Fragility",
      confidence: 0.99,
      confidence_reasons: [],
      bucket_scores: {
        credit_spread_widening: 86.5,
        positioning_crowding: -30.15
      },
      bucket_weights: { credit_spread_widening: 0.25, positioning_crowding: 0.15 },
      top_supports: [],
      top_risks: [],
      recent_changes: [],
      missing_or_stale_notes: []
    }
  }
};

describe("ScoreContributionHeatmap", () => {
  it("renders the panel title and description", () => {
    const c = render(<ScoreContributionHeatmap scoreSummary={scoreSummary} />);
    expect(c.textContent?.toLowerCase()).toContain("score contribution");
  });

  it("uses EChartPanel in ready state when bucket data is present", () => {
    render(<ScoreContributionHeatmap scoreSummary={scoreSummary} />);
    expect(setOption).toHaveBeenCalled();
  });

  it("emits a heatmap option with one row per score family and one column per unique bucket", () => {
    render(<ScoreContributionHeatmap scoreSummary={scoreSummary} />);
    const lastCall = setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
      string,
      unknown
    >;
    const yAxis = lastCall.yAxis as { data: string[] } | undefined;
    expect(yAxis?.data).toEqual(["Market Weather", "Macro Climate", "Fragility"]);
    const xAxis = lastCall.xAxis as { data: string[] } | undefined;
    // Union of buckets: 3 + 3 + 2 = 8 unique buckets across the fixture.
    expect(xAxis?.data?.length).toBeGreaterThanOrEqual(8);
    expect(xAxis?.data).toContain("credit_spreads");
    expect(xAxis?.data).toContain("growth");
    expect(xAxis?.data).toContain("credit_spread_widening");
  });

  it("only emits cells for buckets that the score family actually has", () => {
    render(<ScoreContributionHeatmap scoreSummary={scoreSummary} />);
    const lastCall = setOption.mock.calls[setOption.mock.calls.length - 1]?.[0] as Record<
      string,
      unknown
    >;
    const series = (lastCall.series as Array<{ data: Array<[number, number, number]> }> | undefined)?.[0];
    expect(series).toBeTruthy();
    // 3 + 3 + 2 = 8 cells total.
    expect(series?.data?.length).toBe(8);
    // Each cell carries [xIndex, yIndex, signedScore].
    for (const cell of series!.data) {
      expect(cell).toHaveLength(3);
      expect(typeof cell[2]).toBe("number");
    }
  });

  it("renders the empty state when no score family has any bucket data", () => {
    const emptySummary: ScoreSummaryFile = {
      ...scoreSummary,
      scores: {
        market_weather: { ...scoreSummary.scores.market_weather, bucket_scores: {} },
        macro_climate: { ...scoreSummary.scores.macro_climate, bucket_scores: {} },
        fragility: { ...scoreSummary.scores.fragility, bucket_scores: {} }
      }
    };
    const c = render(<ScoreContributionHeatmap scoreSummary={emptySummary} />);
    expect(c.querySelector("[data-state='empty']")).not.toBeNull();
    expect(setOption).not.toHaveBeenCalled();
  });
});
