import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfidenceBreakdown from "./ConfidenceBreakdown";
import CandidateSourcePanel, { type CandidateSourceItem } from "./CandidateSourcePanel";
import CandidateDiagnosticPanel from "./CandidateDiagnosticPanel";
import CrossAssetConfirmationMatrix from "./CrossAssetConfirmationMatrix";
import DataGapPanel from "./DataGapPanel";
import DataStatusTable from "./DataStatusTable";
import EventRiskPanel from "./EventRiskPanel";
import DriverAttributionPanel from "./DriverAttributionPanel";
import HistoricalRegimeReplayPanel from "./HistoricalRegimeReplayPanel";
import HowToReadPanel from "./HowToReadPanel";
import InterpretationPanel from "./InterpretationPanel";
import MetricCard from "./MetricCard";
import MismatchWarningPanel from "./MismatchWarningPanel";
import MacroCyclePanel from "./MacroCyclePanel";
import ChartResponsiveContainer, { INITIAL_CHART_DIMENSION } from "./ChartResponsiveContainer";
import MultiSeriesChart from "./MultiSeriesChart";
import OptionsSentimentPanel from "./OptionsSentimentPanel";
import PercentileBandChart from "./PercentileBandChart";
import RegimeInterpretationPanel from "./RegimeInterpretationPanel";
import RegimeQuadrantChart, { domainIncludingZero } from "./RegimeQuadrantChart";
import RegimeBadge from "./RegimeBadge";
import ScoreCard from "./ScoreCard";
import ShockRiskDashboard from "./ShockRiskDashboard";
import ShockRiskReadHeader from "./ShockRiskReadHeader";
import SignalChecklist from "./SignalChecklist";
import SignalList from "./SignalList";
import SourceNote from "./SourceNote";
import SourceAccessBadge from "./SourceAccessBadge";
import StrategicSourceGapsPanel from "./StrategicSourceGapsPanel";
import TailRiskPanel from "./TailRiskPanel";
import VixFuturesReadinessPanel from "./VixFuturesReadinessPanel";
import YieldDecompositionChart from "./YieldDecompositionChart";
import type {
  ConfidenceBreakdownData,
  DataStatusFile,
  RegimeSnapshotFile,
  RegimeReplayFile,
  ScoreBlock,
  ScoreHistoryFile,
  ScoreSummaryFile,
  ShockRiskSnapshotFile,
  SeriesCatalogEntry,
  TimeSeriesFile
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

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
});

const catalogEntry: SeriesCatalogEntry = {
  category: "volatility",
  frequency: "daily",
  higher_is: "riskier",
  id: "vix",
  max_stale_days: 7,
  name: "CBOE Volatility Index",
  notes: "Daily VIX close from Cboe public historical data.",
  public: true,
  source: "Cboe",
  source_url: "https://example.com/vix",
  access_status: "free_public",
  citation_notes: "Cboe public historical index data; displayed with source caveats.",
  terms_status: "ok",
  units: "index"
};

const series: TimeSeriesFile = {
  frequency: "daily",
  generated_at_utc: "2026-05-03T18:11:59Z",
  observations: [
    { date: "2026-04-29", value: 16.7, percentile_252d: 54 },
    { date: "2026-04-30", value: 17.1, percentile_252d: 59 }
  ],
  series_id: "vix",
  source: "Cboe",
  source_url: "https://example.com/vix",
  summary: {
    change_1d: 0.4,
    change_1m: -1.25,
    change_1w: null,
    change_3m: 2.5,
    change_12m: -4.75,
    latest_date: "2026-04-30",
    latest_value: 17.1,
    percentile_252d: 59
  },
  units: "index"
};

const scoreBlock: ScoreBlock = {
  bucket_scores: { credit_spreads: -25 },
  bucket_weights: { credit_spreads: 0.2 },
  confidence: 0.82,
  confidence_reasons: ["Sentiment is limited to CFTC positioning."],
  label: "Mixed",
  missing_or_stale_notes: ["Treasury/bond volatility source is not active."],
  recent_changes: ["High-yield spreads widened over the past month."],
  score: -12.34,
  top_risks: ["High-yield spreads widened over the past month."],
  top_supports: ["Reserve balances improved over the past month."]
};

const candidateRows: CandidateSourceItem[] = [
  {
    id: "put_call_spxw",
    label: "SPX/SPXW put/call",
    note: "Candidate SPX and weekly SPX options source.",
    status: "terms_review_needed"
  },
  {
    id: "put_call_spx",
    label: "SPX put/call",
    note: "Candidate SPX options source.",
    status: "terms_review_needed"
  },
  {
    id: "put_call_index",
    label: "Index put/call",
    note: "Candidate index options source.",
    status: "source_review_required"
  },
  {
    id: "put_call_equity",
    label: "Equity put/call",
    note: "Candidate equity options source.",
    status: "source_review_required"
  },
  {
    id: "put_call_vix",
    label: "VIX put/call",
    note: "Candidate VIX options source.",
    status: "source_review_required"
  },
  {
    id: "put_call_etp",
    label: "ETP put/call",
    note: "Candidate ETP options source.",
    status: "source_review_required"
  },
  {
    id: "put_call_total",
    label: "Total put/call",
    note: "Candidate aggregate options source.",
    status: "source_review_required"
  }
];

const activeOptionsSeries: TimeSeriesFile = {
  frequency: "daily",
  generated_at_utc: "2026-05-01T21:00:00Z",
  observations: [{ date: "2026-05-01", value: 1.23 }],
  series_id: "put_call_spxw",
  source: "Cboe",
  source_url: "https://example.com/options",
  summary: {
    change_1d: 0.04,
    change_1m: null,
    change_1w: null,
    latest_date: "2026-05-01",
    latest_value: 1.23,
    percentile_252d: null
  },
  units: "ratio"
};

const shockRiskSnapshot: ShockRiskSnapshotFile = {
  active_signals: [
    {
      change: -8.39,
      id: "vix",
      label: "VIX",
      message: "VIX percentile is included in active shock-risk pressure.",
      score: -5.56,
      value: 17.39
    }
  ],
  date: "2026-05-06",
  generated_at_utc: "2026-05-07T17:57:48Z",
  label: "Contained shock risk",
  method_version: "phase5-shock-risk-v1",
  mismatch_warnings: [
    {
      id: "tightening_confirmation",
      label: "Tightening confirmation",
      message: "Dollar and real-yield pressure confirm tighter financial conditions."
    }
  ],
  score: 21.98,
  source_gaps: [
    {
      id: "move_index",
      label: "MOVE Index",
      message: "Candidate source requires access or terms review before scoring.",
      status: "terms_review_needed"
    },
    {
      id: "skew_index",
      label: "SKEW Index",
      message: "Candidate source requires access or terms review before scoring.",
      status: "terms_review_needed"
    }
  ]
};

const scoreHistory: ScoreHistoryFile = {
  generated_at_utc: "2026-05-08T00:00:00Z",
  latest_attribution: {
    fragility: {
      recent_changes: ["Dollar pressure increased."],
      top_risks: ["Dollar pressure increased."],
      top_supports: ["Liquidity remains stable."]
    },
    macro_climate: {
      recent_changes: ["Growth breadth improved."],
      top_risks: ["Inflation momentum remains sticky."],
      top_supports: ["Growth breadth improved."]
    },
    market_weather: {
      recent_changes: ["Volatility eased while rates pressure increased."],
      top_risks: ["Rates pressure increased."],
      top_supports: ["Volatility eased."]
    }
  },
  method_version: "phase5-score-history-v1",
  observations: [
    {
      date: "2026-04-30",
      fragility: -6.1,
      macro_climate: 7.4,
      market_weather: 16.67
    },
    {
      date: "2026-05-01",
      fragility: -4.1,
      macro_climate: 8.2,
      market_weather: 19.17
    }
  ]
};

const regimeReplay: RegimeReplayFile = {
  generated_at_utc: "2026-05-08T00:00:00Z",
  method_version: "phase5-regime-replay-v1",
  scenarios: [
    {
      caveat: "Historical regime occurrences are descriptive context, not forecasts.",
      description: "Real yields rising, dollar rising, and credit or volatility pressure rising.",
      id: "tightening_risk_off",
      label: "Tightening / risk-off",
      last_occurrence_date: "2026-05-01",
      occurrence_count: 2,
      occurrences: [
        {
          credit_20obs_change: 0.14,
          date: "2026-04-30",
          dollar_20obs_change: 1.2,
          nominal_10y_20obs_change: 0.2,
          real_yield_20obs_change: 0.18,
          vix_curve_20obs_change: 0.03
        },
        {
          credit_20obs_change: 0.2,
          date: "2026-05-01",
          dollar_20obs_change: 1.35,
          nominal_10y_20obs_change: 0.26,
          real_yield_20obs_change: 0.22,
          vix_curve_20obs_change: 0.04
        }
      ]
    },
    {
      caveat: "Historical regime occurrences are descriptive context, not forecasts.",
      description: "Real yields falling, dollar falling, and credit or volatility pressure contained.",
      id: "strong_risk_on",
      label: "Strong risk-on",
      last_occurrence_date: null,
      occurrence_count: 0,
      occurrences: []
    }
  ]
};

const tailRiskCatalog: SeriesCatalogEntry[] = [
  {
    ...catalogEntry,
    access_status: "terms_review_needed",
    id: "move_index",
    name: "MOVE Index",
    notes: "Bond-volatility readiness source pending terms review.",
    score_status: "candidate"
  },
  {
    ...catalogEntry,
    access_status: "terms_review_needed",
    id: "skew_index",
    name: "SKEW Index",
    notes: "Equity tail-risk readiness source pending terms review.",
    score_status: "candidate"
  }
];

const tailRiskStatus: DataStatusFile = {
  generated_at_utc: "2026-05-07T17:57:48Z",
  last_successful_update_utc: "2026-05-07T17:57:48Z",
  overall_status: "partial",
  series: {
    move_index: {
      expected_frequency: "daily",
      freshness_days: null,
      last_observation: null,
      max_stale_days: 30,
      message: "MOVE Index source remains under terms review.",
      source: "Candidate registry",
      status: "terms_review_needed"
    },
    skew_index: {
      expected_frequency: "daily",
      freshness_days: null,
      last_observation: null,
      max_stale_days: 30,
      message: "SKEW Index source remains under terms review.",
      source: "Candidate registry",
      status: "terms_review_needed"
    }
  }
};

describe("data-driven components", () => {
  it("renders a regime badge with score-based tone", () => {
    const container = render(<RegimeBadge label="Fragile" score={-25} />);

    expect(container.textContent).toContain("Fragile");
    expect(container.textContent).toContain("-25.00");
    expect(container.querySelector(".tone-warning")).not.toBeNull();
  });

  it("renders metric summary fields with formatted values", () => {
    const container = render(<MetricCard catalogEntry={catalogEntry} series={series} />);

    expect(container.textContent).toContain("Cboe");
    expect(container.textContent).toContain("Free public");
    expect(container.textContent).toContain("Terms ok");
    expect(container.textContent).toContain("CBOE Volatility Index");
    expect(container.textContent).toContain("17.10 index");
    expect(container.textContent).toContain("+0.40");
    expect(container.textContent).toContain("N/A");
    expect(container.textContent).toContain("-1.25");
    expect(container.textContent).toContain("+2.50");
    expect(container.textContent).toContain("-4.75");
    expect(container.textContent).toContain("59%");
    expect(container.textContent).toContain("2026-04-30");
  });

  it("clamps percentile bar width while preserving the displayed percentile", () => {
    const container = render(<PercentileBandChart percentile={125} />);
    const fill = container.querySelector<HTMLElement>(".percentile-fill");

    expect(container.textContent).toContain("125%");
    expect(fill?.style.width).toBe("100%");
  });

  it("exposes available percentile meter values to assistive technology", () => {
    const container = render(<PercentileBandChart percentile={42} />);
    const meter = container.querySelector('[role="meter"]');

    expect(meter?.getAttribute("aria-valuenow")).toBe("42");
    expect(meter?.getAttribute("aria-valuetext")).toBe("42%");
  });

  it("does not expose a misleading meter value when percentile is unavailable", () => {
    const container = render(<PercentileBandChart percentile={null} />);
    const meter = container.querySelector('[role="meter"]');

    expect(meter?.hasAttribute("aria-valuenow")).toBe(false);
    expect(meter?.getAttribute("aria-valuetext")).toBe("N/A");
  });

  it("renders source metadata and source reference link", () => {
    const container = render(<SourceNote catalogEntry={catalogEntry} series={series} />);

    expect(container.textContent).toContain("Cboe");
    expect(container.textContent).toContain("daily");
    expect(container.textContent).toContain("Daily VIX close from Cboe public historical data.");
    expect(container.textContent).toContain("Free public");
    expect(container.textContent).toContain("Terms ok");
    expect(container.textContent).toContain("Cboe public historical index data; displayed with source caveats.");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.com/vix");
  });

  it("renders phase 3 score card details", () => {
    const container = render(<ScoreCard title="Market Weather" score={scoreBlock} />);

    expect(container.textContent).toContain("Market Weather");
    expect(container.querySelector("h3")?.textContent).toBe("Market Weather");
    expect(container.textContent).toContain("-12.34");
    expect(container.textContent).toContain("Mixed");
    expect(container.textContent).toContain("82%");
    expect(container.textContent).toContain("Confidence notes");
    expect(container.textContent).toContain("Sentiment is limited to CFTC positioning.");
    expect(container.textContent).toContain("High-yield spreads widened over the past month.");
    expect(container.textContent).toContain("Reserve balances improved over the past month.");
  });

  it("renders duplicate score messages without React key warnings", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const duplicateScore = {
      ...scoreBlock,
      recent_changes: ["Credit spread pressure is contained.", "Credit spread pressure is contained."],
      top_risks: ["Real yields are elevated.", "Real yields are elevated."],
      top_supports: ["Credit spread pressure is contained.", "Credit spread pressure is contained."]
    };

    render(<ScoreCard title="Duplicate Score" score={duplicateScore} />);

    const messages = consoleError.mock.calls.map((call) => String(call[0])).join("\n");
    expect(messages).not.toContain("Encountered two children with the same key");
    consoleError.mockRestore();
  });

  it("renders score card fallbacks for stale partial score payloads", () => {
    const partialScore = {
      confidence: 1.5,
      label: "Mixed",
      score: Number.NaN
    } as unknown as ScoreBlock;

    const container = render(<ScoreCard title="Partial Score" score={partialScore} />);

    expect(container.textContent).toContain("Partial Score");
    expect(container.textContent).toContain("0.00");
    expect(container.textContent).toContain("100%");
    expect(container.textContent).toContain("N/A");
  });

  it("renders macro cycle score label signals and source caveat", () => {
    const container = render(
      <MacroCyclePanel
        caveat="Active public data only; candidate PMI and SLOOS rows remain source-gated."
        label="Mixed"
        risks={["Mortgage rates remain elevated."]}
        score={12.34}
        supports={["Housing starts improved."]}
        title="Housing cycle"
      />
    );

    expect(container.textContent).toContain("Housing cycle");
    expect(container.textContent).toContain("12.34");
    expect(container.textContent).toContain("Mixed");
    expect(container.textContent).toContain("Supports");
    expect(container.textContent).toContain("Housing starts improved.");
    expect(container.textContent).toContain("Risks");
    expect(container.textContent).toContain("Mortgage rates remain elevated.");
    expect(container.textContent).toContain(
      "Active public data only; candidate PMI and SLOOS rows remain source-gated."
    );
  });

  it("renders how-to-read panel without exposing advice language", () => {
    const container = render(
      <HowToReadPanel description="Positive values are supportive; negative values indicate observed stress." />
    );

    expect(container.textContent).toContain("How to read this");
    expect(container.textContent).toContain("observed stress");
    expect((container.textContent ?? "").toLowerCase()).not.toContain("buy");
  });

  it("renders source access status", () => {
    const container = render(
      <SourceAccessBadge accessStatus="terms_review_needed" termsStatus="review_needed" />
    );

    expect(container.textContent).toContain("Terms review needed");
    expect(container.textContent).toContain("Review needed");
  });

  it("renders safe fallbacks for unknown source access runtime strings", () => {
    const container = render(
      <SourceAccessBadge
        accessStatus={"pending_license" as never}
        termsStatus={"needs_counsel" as never}
      />
    );

    expect(container.textContent).toContain("Pending license");
    expect(container.textContent).toContain("Needs counsel");
  });

  it("renders candidate source names and normalized review status", () => {
    const container = render(
      <CandidateSourcePanel
        items={[
          {
            id: "put_call_index",
            label: "Index put/call",
            note: "Candidate options source pending review.",
            status: "terms_review_needed"
          }
        ]}
        title="Candidate inputs"
      />
    );

    expect(container.textContent).toContain("Candidate inputs");
    expect(container.textContent).toContain("Index put/call");
    expect(container.textContent).toContain("Terms review needed");
    expect(container.textContent).toContain("Candidate options source pending review.");
  });

  it("renders an explicit candidate source empty state", () => {
    const container = render(<CandidateSourcePanel items={[]} title="Candidate inputs" />);

    expect(container.textContent).toContain("Candidate inputs");
    expect(container.textContent).toContain("No candidate source rows are configured for this view.");
  });

  it("renders generated candidate diagnostics as non-scoring official rows", () => {
    const diagnosticCatalog: SeriesCatalogEntry[] = [
      {
        category: "credit",
        frequency: "quarterly",
        higher_is: "riskier",
        id: "sloos_lending_standards",
        max_stale_days: 120,
        name: "SLOOS C&I Lending Standards: Large and Middle-Market Firms",
        notes: "Generated non-scoring SLOOS lending-standards diagnostic from FRED.",
        public: true,
        source: "FRED",
        source_url: "https://example.com/sloos",
        units: "net percent",
        access_status: "free_public",
        score_status: "candidate"
      }
    ];
    const diagnosticStatus: DataStatusFile = {
      generated_at_utc: "2026-05-09T00:00:00Z",
      last_successful_update_utc: "2026-05-09T00:00:00Z",
      overall_status: "ok",
      series: {
        sloos_lending_standards: {
          expected_frequency: "quarterly",
          freshness_days: 38,
          last_observation: "2026-04-01",
          max_stale_days: 120,
          message:
            "Latest quarterly observation covers 2026-Q2. candidate diagnostic only; does not affect active scores.",
          observation_period: "2026-Q2",
          score_status: "candidate",
          source: "FRED",
          status: "ok"
        }
      }
    };

    const container = render(
      <CandidateDiagnosticPanel
        catalog={diagnosticCatalog}
        diagnosticIds={["sloos_lending_standards"]}
        series={[
          {
            frequency: "quarterly",
            generated_at_utc: "2026-05-09T00:00:00Z",
            observations: [
              { date: "2025-07-01", value: 10 },
              { date: "2025-10-01", value: 20 },
              { date: "2026-01-01", value: 15 },
              { date: "2026-04-01", value: 30 }
            ],
            series_id: "sloos_lending_standards",
            source: "FRED",
            source_url: "https://example.com/sloos",
            summary: {
              change_1d: null,
              change_1m: null,
              change_1w: null,
              latest_date: "2026-04-01",
              latest_value: 30,
              percentile_252d: null
            },
            units: "net percent"
          }
        ]}
        status={diagnosticStatus}
        title="Generated official diagnostics"
      />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("Generated official diagnostics");
    expect(text).toContain("SLOOS C&I Lending Standards: Large and Middle-Market Firms");
    expect(text).toContain("Generated candidate diagnostic");
    expect(text).toContain("Not scored");
    expect(text).toContain("Does not affect active scores, labels, checklist states, or confidence.");
    expect(text).toContain("Observation 2026-Q2");
    expect(text).toContain("Trend window 4 observations");
    expect(text).toContain("Latest 30.00 net percent on 2026-04-01");
    expect(text).toContain("FRED");
    expect(text).not.toContain("Terms review needed");
    expect(container.querySelectorAll(".candidate-diagnostic-row")).toHaveLength(1);
    expect(container.querySelector(".candidate-diagnostic-sparkline")).not.toBeNull();
  });

  it("renders a clear generated diagnostic trend fallback without observations", () => {
    const container = render(
      <CandidateDiagnosticPanel
        catalog={[]}
        diagnosticIds={["missing_diagnostic"]}
        series={[
          {
            frequency: "daily",
            generated_at_utc: "2026-05-09T00:00:00Z",
            observations: [],
            series_id: "missing_diagnostic",
            source: "Derived",
            source_url: "https://example.com/missing",
            units: "index"
          }
        ]}
        status={{
          generated_at_utc: "2026-05-09T00:00:00Z",
          last_successful_update_utc: "2026-05-09T00:00:00Z",
          overall_status: "ok",
          series: {}
        }}
        title="Generated official diagnostics"
      />
    );

    expect(container.textContent).toContain("Trend unavailable");
    expect(container.textContent).toContain("No generated observations are available for this diagnostic.");
  });

  it("orders options sentiment candidates without active signal labels", () => {
    const container = render(<OptionsSentimentPanel items={[...candidateRows].reverse()} />);
    const text = container.textContent ?? "";
    const orderedLabels = [
      "SPX/SPXW put/call",
      "SPX put/call",
      "Index put/call",
      "Equity put/call",
      "VIX put/call",
      "ETP put/call",
      "Total put/call"
    ];

    expect(text).toContain("Options sentiment");
    expect(text).toContain("Useful short-term sentiment context");
    expect(text).toContain("automated historical access");
    expect(text).toContain("static JSON redistribution");
    expect(text).toContain(
      "cannot affect scores, regime labels, checklist states, or confidence"
    );
    expect(text).toContain("SPX/SPXW, index, equity, VIX, ETP, and total put/call");
    expect(text).toContain("Source review required");
    for (const label of orderedLabels) {
      expect(text).toContain(label);
    }
    for (let index = 0; index < orderedLabels.length - 1; index += 1) {
      expect(text.indexOf(orderedLabels[index])).toBeLessThan(text.indexOf(orderedLabels[index + 1]));
    }
    expect(text.toLowerCase()).not.toMatch(/\b(panic|hedged|complacent)\b/);
  });

  it("renders active options sentiment series before candidate-only fallback rows", () => {
    const activeEquitySeries: TimeSeriesFile = {
      ...activeOptionsSeries,
      series_id: "put_call_equity",
      summary: {
        change_1d: 0.04,
        change_1m: null,
        change_1w: null,
        latest_date: "2026-05-01",
        latest_value: 0.81,
        percentile_252d: null
      }
    };
    const container = render(
      <OptionsSentimentPanel activeSeries={[activeEquitySeries]} items={candidateRows} />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("Options sentiment");
    expect(text).toContain("Equity put/call");
    expect(text).toContain("Active data");
    expect(text).toContain("Latest ratio 0.81 on 2026-05-01.");
    expect(text.indexOf("Equity put/call")).toBeLessThan(text.indexOf("SPX/SPXW put/call"));
    expect(text).toContain("Source review required");
    expect(text.toLowerCase()).not.toMatch(/\b(panic|hedged|complacent)\b/);
  });

  it("deduplicates duplicate active options sentiment series ids", () => {
    const container = render(
      <OptionsSentimentPanel activeSeries={[activeOptionsSeries, activeOptionsSeries]} items={candidateRows} />
    );
    const activeRows = Array.from(container.querySelectorAll(".candidate-source-row")).filter((row) =>
      row.textContent?.includes("Active data")
    );

    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]?.textContent).toContain("SPX/SPXW put/call");
  });

  it("renders options sentiment source-review empty state without active signal labels", () => {
    const container = render(<OptionsSentimentPanel items={[]} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Options sentiment");
    expect(text).toContain("Source review required");
    expect(text).toContain("No active options sentiment candidate rows are configured.");
    expect(text.toLowerCase()).not.toMatch(/\b(panic|hedged|complacent)\b/);
  });

  it("renders strategic source gaps with source-review governance copy", () => {
    const container = render(<StrategicSourceGapsPanel />);
    const text = container.textContent ?? "";
    const labels = [
      "PMIs",
      "SLOOS scoring promotion",
      "NY Fed ACM term premium",
      "Treasury net issuance",
      "Auction tail",
      "Bid-to-cover",
      "CAPE",
      "Forward P/E",
      "Equity risk premium",
      "Earnings revision breadth",
      "Fiscal deficit / interest expense"
    ];

    expect(text).toContain("Strategic source gaps");
    for (const label of labels) {
      expect(text).toContain(label);
    }
    expect(text).toContain("cannot affect scores until source review promotes it");
    expect(container.querySelectorAll(".candidate-source-row")).toHaveLength(labels.length);
    expect(container.querySelectorAll(".status-terms_review_needed")).toHaveLength(labels.length);
  });

  it("renders event risk source-gated candidate rows", () => {
    const container = render(<EventRiskPanel />);
    const text = container.textContent ?? "";

    expect(text).toContain("Event risk");
    expect(text).toContain("does not publish event predictions");
    expect(text).toContain("CPI");
    expect(text).toContain("FOMC");
    expect(text).toContain("payrolls");
    expect(text).toContain("Treasury auctions");
    expect(text).toContain("OPEX");
  });

  it("renders official event calendar rows as non-scoring source-linked context", () => {
    const container = render(
      <EventRiskPanel
        calendar={{
          generated_at_utc: "2026-05-09T00:00:00Z",
          method_version: "official-event-calendar-v1",
          events: [
            {
              category: "inflation",
              date: null,
              id: "cpi",
              importance: "high",
              notes: "BLS monthly Consumer Price Index release calendar.",
              source: "BLS",
              source_url: "https://www.bls.gov/schedule/news_release/cpi.htm",
              status: "source_link",
              time: "08:30",
              timezone: "America/New_York",
              title: "CPI"
            }
          ]
        }}
        items={[
          {
            id: "event_opex",
            label: "OPEX",
            note: "Options-expiration calendar remains source-gated.",
            status: "terms_review_needed"
          }
        ]}
      />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("Official source-linked calendar context");
    expect(text).toContain("Not scored");
    expect(text).toContain("does not affect active scores, regime labels, checklist states, or confidence");
    expect(text).toContain("CPI");
    expect(text).toContain("BLS monthly Consumer Price Index release calendar.");
    expect(text).toContain("BLS");
    expect(text).toContain("See source 08:30 America/New_York");
    expect(text).toContain("OPEX");
    expect(text).toContain("Options-expiration calendar remains source-gated.");
    expect(container.querySelectorAll(".calendar-event")).toHaveLength(1);
    expect(container.querySelectorAll(".candidate-source-row")).toHaveLength(1);
  });

  it("renders route-provided event risk candidate rows", () => {
    const container = render(
      <EventRiskPanel
        items={[
          {
            id: "event_cpi",
            label: "Distinct CPI route event",
            note: "Route-provided CPI calendar readiness note.",
            status: "terms_review_needed"
          }
        ]}
      />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("Event risk");
    expect(text).toContain("does not publish event predictions");
    expect(text).toContain("Distinct CPI route event");
    expect(text).toContain("Route-provided CPI calendar readiness note.");
    expect(text).toContain("Terms review needed");
  });

  it("renders VIX futures candidates and fallback proxy text when VX data is inactive", () => {
    const container = render(<VixFuturesReadinessPanel />);
    const text = container.textContent ?? "";

    expect(text).toContain("VIX futures readiness");
    for (let month = 1; month <= 8; month += 1) {
      expect(text).toContain(`VX${month}`);
    }
    expect(text).toContain("Fallback proxy");
    expect(text).toContain("not a tradable futures curve");
    expect(text).toContain("VIX9D");
    expect(text).toContain("VIX");
    expect(text).toContain("VIX3M");
  });

  it("renders route-provided VIX futures candidate rows", () => {
    const container = render(
      <VixFuturesReadinessPanel
        items={[
          {
            id: "vx1",
            label: "Distinct VX1 route candidate",
            note: "Route-provided VX1 readiness note.",
            status: "partial"
          }
        ]}
      />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("VIX futures readiness");
    expect(text).toContain("Distinct VX1 route candidate");
    expect(text).toContain("Route-provided VX1 readiness note.");
    expect(text).toContain("Partial");
    expect(text).toContain("Fallback proxy");
  });

  it("renders shock risk label score source gap and active VIX signal", () => {
    const container = render(<ShockRiskDashboard snapshot={shockRiskSnapshot} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Contained shock risk");
    expect(text).toContain("21.98");
    expect(text).toContain("MOVE Index");
    expect(text).toContain("VIX");
    expect(text).toContain("17.39");
    expect(text).toContain("-8.39");
  });

  it("renders shock risk empty states when snapshot arrays are malformed", () => {
    const malformedSnapshot = {
      ...shockRiskSnapshot,
      active_signals: "not an array",
      source_gaps: undefined
    } as unknown as ShockRiskSnapshotFile;

    const container = render(<ShockRiskDashboard snapshot={malformedSnapshot} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Contained shock risk");
    expect(text).toContain("0 active shock-risk signal rows.");
    expect(text).toContain("0 gated or unavailable source rows.");
    expect(text).toContain("No active shock-risk signals in the current snapshot.");
    expect(text).toContain("No shock-risk source gaps in the current snapshot.");
  });

  it("renders MOVE and SKEW source gaps with terms-review readiness copy", () => {
    const container = render(
      <TailRiskPanel catalog={tailRiskCatalog} snapshot={shockRiskSnapshot} status={tailRiskStatus} />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("MOVE Index");
    expect(text).toContain("SKEW Index");
    expect(text).toContain("Terms Review Needed");
    expect(text).toContain("Bond volatility");
    expect(text).toContain("distinct from VIX");
    expect(text).toContain("Candidate source requires access or terms review before scoring.");
  });

  it("renders mismatch warning rows and an explicit empty state", () => {
    const warningContainer = render(
      <MismatchWarningPanel warnings={shockRiskSnapshot.mismatch_warnings} />
    );

    expect(warningContainer.textContent).toContain("Mismatch warnings");
    expect(warningContainer.textContent).toContain("tightening_confirmation");
    expect(warningContainer.textContent).toContain("Tightening confirmation");

    act(() => root?.unmount());
    document.body.replaceChildren();
    root = undefined;

    const emptyContainer = render(<MismatchWarningPanel warnings={[]} />);

    expect(emptyContainer.textContent).toContain("Mismatch warnings");
    expect(emptyContainer.textContent).toContain("No mismatch warnings in the current shock-risk snapshot.");
  });

  it("renders mismatch warning empty state when warnings are malformed", () => {
    const container = render(<MismatchWarningPanel warnings={"not an array" as never} />);

    expect(container.textContent).toContain("Mismatch warnings");
    expect(container.textContent).toContain("No mismatch warnings in the current shock-risk snapshot.");
  });

  it("filters data status rows by selected series ids", () => {
    const status: DataStatusFile = {
      generated_at_utc: "2026-05-03T18:32:54Z",
      last_successful_update_utc: "2026-05-03T18:32:54Z",
      overall_status: "ok",
      series: {
        fed_assets: {
          expected_frequency: "weekly",
          freshness_days: 4,
          last_observation: "2026-04-29",
          max_stale_days: 14,
          source: "FRED",
          status: "ok"
        },
        vix: {
          expected_frequency: "daily",
          freshness_days: 2,
          last_observation: "2026-05-01",
          max_stale_days: 7,
          source: "Cboe",
          status: "stale"
        }
      }
    };

    const container = render(<DataStatusTable seriesIds={["vix"]} status={status} />);

    expect(container.textContent).toContain("Generated 2026-05-03T18:32:54Z");
    expect(container.textContent).toContain("vix");
    expect(container.textContent).toContain("Stale");
    expect(container.textContent).toContain("2 days");
    expect(container.textContent).not.toContain("fed_assets");
  });

  it("renders confidence breakdown detail and reason text", () => {
    const confidence: ConfidenceBreakdownData = {
      coverage_confidence: 0.91,
      freshness_confidence: 0.72,
      model_confidence: 0.84,
      source_confidence: 0.75,
      overall_confidence: 0.82,
      reasons: ["Housing is not active in Phase 4 PR 1."]
    };

    const container = render(<ConfidenceBreakdown dataQuality={confidence} />);

    expect(container.textContent).toContain("Data confidence");
    expect(container.textContent).toContain("82% overall");
    expect(container.textContent).toContain("Coverage");
    expect(container.textContent).toContain("91%");
    expect(container.textContent).toContain("Freshness");
    expect(container.textContent).toContain("72%");
    expect(container.textContent).toContain("84%");
    expect(container.textContent).toContain("75%");
    expect(container.textContent).toContain("Housing is not active in Phase 4 PR 1.");
  });

  it("renders confidence fallback when fetched reasons are malformed", () => {
    const confidence = {
      coverage_confidence: 0.91,
      freshness_confidence: 0.72,
      model_confidence: 0.84,
      source_confidence: 0.75,
      overall_confidence: 0.82,
      reasons: "not an array"
    } as unknown as ConfidenceBreakdownData;

    const container = render(<ConfidenceBreakdown dataQuality={confidence} />);

    expect(container.textContent).toContain("82% overall");
    expect(container.textContent).toContain("No confidence notes in the current score summary.");
  });

  it("renders signal list items without empty fallback when items exist", () => {
    const container = render(
      <SignalList
        emptyText="No support signals."
        items={["Reserve balances improved.", "Credit spreads narrowed."]}
        title="Supports"
      />
    );

    expect(container.textContent).toContain("Supports");
    expect(container.textContent).toContain("Reserve balances improved.");
    expect(container.textContent).toContain("Credit spreads narrowed.");
    expect(container.textContent).not.toContain("No support signals.");
    expect(container.querySelector(".score-list")).not.toBeNull();
  });

  it("renders duplicate signal list messages without React key warnings", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <SignalList
        emptyText="No signals."
        items={["Real yields are elevated.", "Real yields are elevated."]}
        title="Risks"
      />
    );

    const messages = consoleError.mock.calls.map((call) => String(call[0])).join("\n");
    expect(messages).not.toContain("Encountered two children with the same key");
    consoleError.mockRestore();
  });

  it("renders data gap notes for stale candidate and expected-release-window rows", () => {
    const status: DataStatusFile = {
      generated_at_utc: "2026-05-03T18:32:54Z",
      last_successful_update_utc: "2026-05-03T18:32:54Z",
      overall_status: "partial",
      series: {
        broad_dollar: {
          expected_frequency: "daily",
          freshness_days: 23,
          last_observation: "2026-04-10",
          max_stale_days: 7,
          message: "Broad dollar feed is stale.",
          source: "FRED",
          status: "stale"
        },
        core_cpi: {
          expected_frequency: "monthly",
          freshness_days: 33,
          last_observation: "2026-03-31",
          max_stale_days: 45,
          message: "Core CPI next update is still pending.",
          observation_period: "2026-03",
          expected_next_release_window: { start: "2026-04-01", end: "2026-05-16" },
          source: "BLS",
          status: "ok"
        },
        ism_manufacturing_pmi: {
          expected_frequency: "monthly",
          freshness_days: null,
          last_observation: null,
          max_stale_days: 45,
          message: "Candidate source requires terms review.",
          source: "ISM",
          status: "terms_review_needed"
        },
        vix: {
          expected_frequency: "daily",
          freshness_days: 2,
          last_observation: "2026-05-01",
          max_stale_days: 7,
          source: "Cboe",
          status: "ok"
        }
      }
    };

    const container = render(
      <DataGapPanel seriesIds={["core_cpi", "ism_manufacturing_pmi", "broad_dollar"]} status={status} />
    );

    expect(container.textContent).toContain("Data gaps");
    expect(container.textContent).toContain("core_cpi");
    expect(container.textContent).toContain("2026-03");
    expect(container.textContent).toContain("Core CPI next update is still pending.");
    expect(container.textContent).toContain("ism_manufacturing_pmi");
    expect(container.textContent).toContain("Terms Review Needed");
    expect(container.textContent).toContain("broad_dollar");
    expect(container.textContent).toContain("Stale");
    expect(container.textContent).not.toContain("vix");
  });

  it("renders interpretation label summary signals conflicts and caveats", () => {
    const container = render(
      <InterpretationPanel
        caveats={["Housing is not active in Phase 4 PR 1."]}
        conflicts={["Dollar strength conflicts with easier liquidity."]}
        label="Mixed"
        risks={["Credit spreads widened."]}
        summary="Conditions are balanced but fragile."
        supports={["Reserve balances improved."]}
      />
    );

    expect(container.textContent).toContain("What this page says");
    expect(container.textContent).toContain("Mixed");
    expect(container.textContent).toContain("Conditions are balanced but fragile.");
    expect(container.textContent).toContain("Reserve balances improved.");
    expect(container.textContent).toContain("Credit spreads widened.");
    expect(container.textContent).toContain("Dollar strength conflicts with easier liquidity.");
    expect(container.textContent).toContain("Housing is not active in Phase 4 PR 1.");
  });

  it("renders signal checklist rows from fixture items", () => {
    const container = render(
      <SignalChecklist
        items={[
          { id: "real_yield", label: "Real yield", state: "confirming", message: "Real yields eased." },
          { id: "dollar", label: "Dollar", state: "diverging", message: "Dollar strengthened." },
          { id: "overall", label: "Overall regime", state: "mixed", message: "Signals are mixed." }
        ]}
      />
    );

    expect(container.textContent).toContain("Real yield");
    expect(container.textContent).toContain("Dollar");
    expect(container.textContent).toContain("Overall regime");
  });

  it("renders cross-asset confirmation states without advice terms", () => {
    const container = render(
      <CrossAssetConfirmationMatrix
        items={[
          { id: "credit", label: "Credit", status: "confirming", message: "Spreads narrowed." },
          { id: "dollar", label: "Dollar", status: "diverging", message: "Dollar rose." },
          { id: "growth", label: "Growth", status: "unavailable", message: "Awaiting source." }
        ]}
      />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("Confirming");
    expect(text).toContain("Diverging");
    expect(text).toContain("Unavailable");
    expect(text.toLowerCase()).not.toMatch(/\b(buy|sell|short|long|entry|target|stop)\b/);
  });

  it("renders candidate-only cross-asset rows after active confirmations", () => {
    const container = render(
      <CrossAssetConfirmationMatrix
        items={[
          {
            id: "credit",
            label: "Credit",
            message: "Credit confirms the current regime.",
            status: "confirming"
          }
        ]}
        candidateItems={[
          {
            id: "move_index",
            label: "MOVE",
            message: "Bond-volatility confirmation remains source-gated.",
            status: "terms_review_needed"
          }
        ]}
      />
    );
    const rows = Array.from(container.querySelectorAll(".confirmation-matrix__item"));
    const text = container.textContent ?? "";

    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Credit");
    expect(rows[1]?.textContent).toContain("MOVE");
    expect(rows[1]?.classList.contains("candidate-only")).toBe(true);
    expect(rows[1]?.querySelector(".status-pill")?.classList.contains("status-terms_review_needed")).toBe(true);
    expect(text.indexOf("Credit")).toBeLessThan(text.indexOf("MOVE"));
    expect(text).toContain("Terms review needed");
  });

  it("deduplicates candidate-only cross-asset rows against active rows by normalized id or label", () => {
    const container = render(
      <CrossAssetConfirmationMatrix
        items={[
          {
            id: "credit",
            label: "Credit",
            message: "Credit confirms the current regime.",
            status: "confirming"
          },
          {
            id: "liquidity",
            label: "Liquidity",
            message: "Liquidity confirms the current regime.",
            status: "confirming"
          }
        ]}
        candidateItems={[
          {
            id: "Credit",
            label: "Credit candidate",
            message: "Duplicate by id.",
            status: "terms_review_needed"
          },
          {
            id: "liquidity_candidate",
            label: "liquidity",
            message: "Duplicate by label.",
            status: "terms_review_needed"
          },
          {
            id: "move_index",
            label: "MOVE",
            message: "Bond-volatility confirmation remains source-gated.",
            status: "terms_review_needed"
          }
        ]}
      />
    );
    const rows = Array.from(container.querySelectorAll(".confirmation-matrix__item"));

    expect(rows).toHaveLength(3);
    expect(container.textContent).toContain("MOVE");
    expect(container.textContent).not.toContain("Credit candidate");
    expect(container.textContent).not.toContain("Duplicate by label.");
  });

  it("ignores malformed active confirmation rows before deduplicating candidates", () => {
    const malformedItems = [
      {
        id: "credit",
        label: "Credit",
        message: "Credit confirms the current regime.",
        status: "confirming"
      },
      {
        id: null,
        label: "Malformed active",
        message: "This malformed active row should not render.",
        status: "confirming"
      },
      {
        id: "bad_label",
        label: 42,
        message: "This malformed label should not render.",
        status: "diverging"
      }
    ] as unknown as RegimeSnapshotFile["confirmations"];

    const container = render(
      <CrossAssetConfirmationMatrix
        items={malformedItems}
        candidateItems={[
          {
            id: "Credit",
            label: "Credit candidate",
            message: "Duplicate by valid active id.",
            status: "terms_review_needed"
          },
          {
            id: "move_index",
            label: "MOVE",
            message: "Candidate-only row remains visible.",
            status: "terms_review_needed"
          }
        ]}
      />
    );
    const rows = Array.from(container.querySelectorAll(".confirmation-matrix__item"));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Credit");
    expect(rows[1]?.textContent).toContain("MOVE");
    expect(container.textContent).not.toContain("Malformed active");
    expect(container.textContent).not.toContain("malformed label");
    expect(container.textContent).not.toContain("Credit candidate");
  });

  it("renders regime quadrant labels as DOM text", () => {
    const container = render(
      <RegimeQuadrantChart
        trail={[
          {
            date: "2026-05-01",
            dollar_change: -0.4,
            real_yield_change: -0.2,
            nominal_yield_change: -0.1,
            vix_percentile: 40,
            credit_change: -3
          }
        ]}
      />
    );

    expect(container.textContent).toContain("Strong risk-on");
    expect(container.textContent).toContain("Reallocation / rotation");
    expect(container.textContent).toContain("Tightening / risk-off");
    expect(container.textContent).toContain("Bonds-first / safe haven");
  });

  it("places regime quadrant labels by dollar and real-yield sign", () => {
    const container = render(
      <RegimeQuadrantChart
        trail={[
          {
            date: "2026-05-01",
            dollar_change: 0.4,
            real_yield_change: 0.2,
            nominal_yield_change: 0.1,
            vix_percentile: 40,
            credit_change: 3
          }
        ]}
      />
    );

    expect(container.querySelector(".quadrant-label--top-left")?.textContent).toBe("Reallocation / rotation");
    expect(container.querySelector(".quadrant-label--top-right")?.textContent).toBe("Tightening / risk-off");
    expect(container.querySelector(".quadrant-label--bottom-right")?.textContent).toBe(
      "Bonds-first / safe haven"
    );
    expect(container.querySelector(".quadrant-label--bottom-left")?.textContent).toBe("Strong risk-on");
  });

  it("configures regime quadrant numeric domains to include zero", () => {
    expect(domainIncludingZero([0.2, 0.5, 1.1])).toEqual([0, 1.1]);
    expect(domainIncludingZero([-1.1, -0.5, -0.2])).toEqual([-1.1, 0]);
    expect(domainIncludingZero([-0.7, 0.4, 1.2])).toEqual([-0.7, 1.2]);
  });

  it("starts responsive charts with positive dimensions", () => {
    const container = render(
      <div className="chart-frame">
        <ChartResponsiveContainer>
          <div>chart payload</div>
        </ChartResponsiveContainer>
      </div>
    );

    expect(INITIAL_CHART_DIMENSION.width).toBeGreaterThan(0);
    expect(INITIAL_CHART_DIMENSION.height).toBeGreaterThan(0);
    expect(container.textContent).toContain("chart payload");
  });

  it("renders yield decomposition legend labels", () => {
    const container = render(
      <YieldDecompositionChart
        data={[
          {
            date: "2026-05-01",
            nominal_10y: 4.2,
            real_yield_10y: 1.8,
            breakeven_10y: 2.4
          }
        ]}
      />
    );

    expect(container.textContent).toContain("10Y nominal");
    expect(container.textContent).toContain("10Y real yield");
    expect(container.textContent).toContain("10Y breakeven");
  });

  it("renders each configured multi-series line name", () => {
    const container = render(
      <MultiSeriesChart
        title="Cross asset history"
        units="index"
        series={[
          { id: "vix", name: "VIX", color: "#2f6f73", data: [{ date: "2026-05-01", value: 18 }] },
          {
            id: "credit",
            name: "High yield spread",
            color: "#b76f2b",
            data: [{ date: "2026-05-01", value: 3.4 }]
          }
        ]}
      />
    );

    expect(container.textContent).toContain("VIX");
    expect(container.textContent).toContain("High yield spread");
  });

  it("renders score driver attribution with latest score changes", () => {
    const container = render(<DriverAttributionPanel history={scoreHistory} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Why scores changed");
    expect(text).toContain("Market Weather");
    expect(text).toContain("+2.50");
    expect(text).toContain("Volatility eased while rates pressure increased.");
    expect(text).toContain("Inflation momentum remains sticky.");
    expect(text.toLowerCase()).not.toMatch(/\b(buy|sell|short|entry|target|stop)\b/);
  });

  it("renders historical regime replay as descriptive context without forward returns", () => {
    const container = render(<HistoricalRegimeReplayPanel replay={regimeReplay} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Historical regime replay");
    expect(text).toContain("Tightening / risk-off");
    expect(text).toContain("2 occurrences");
    expect(text).toContain("2026-05-01");
    expect(text).toContain("Real yield 20 obs");
    expect(text).toContain("Historical regime occurrences are descriptive context, not forecasts.");
    expect(text).not.toContain("Average SPY return");
    expect(text).not.toContain("forward return");
    expect(container.querySelector('[data-label="Real yield 20 obs"]')?.textContent).toBe("+0.22");
    expect(container.querySelector('[data-label="Dollar 20 obs"]')?.textContent).toBe("+1.35");
    expect(container.querySelector('[data-label="10Y nominal 20 obs"]')?.textContent).toBe("+0.26");
  });

  it("renders regime interpretation empty states for malformed confirmation rows", () => {
    const malformedSnapshot = {
      regime: {
        dollar_direction: "up",
        label: "Tightening / risk-off",
        nominal_yield_direction: "up",
        tips_direction: "up",
        yield_driver: "real_yield_driven"
      },
      confirmations: [
        null,
        { status: "confirming" },
        { label: "Divergence without message", status: "divergent" },
        { message: "Confirming message without label", status: "confirming" }
      ]
    } as unknown as RegimeSnapshotFile;
    const scoreSummary = {
      conflicting_signals: []
    } as unknown as ScoreSummaryFile;

    const container = render(<RegimeInterpretationPanel scoreSummary={scoreSummary} snapshot={malformedSnapshot} />);
    const text = container.textContent ?? "";

    expect(text).toContain("No confirming regime signals in the current snapshot.");
    expect(text).toContain("No conflicting regime signals in the current snapshot.");
    expect(text).toContain("No weak-confidence regime signals in the current snapshot.");
    expect(text).not.toContain("Divergence without message");
    expect(text).not.toContain("Confirming message without label");
  });

  it("groups exact regime confirmation statuses and filters malformed conflicts", () => {
    const snapshot = {
      regime: {
        dollar_direction: "up",
        label: "Tightening / risk-off",
        nominal_yield_direction: "up",
        tips_direction: "up",
        yield_driver: "real_yield_driven"
      },
      confirmations: [
        {
          id: "confirming-row",
          label: "Credit confirmation",
          message: "Credit spreads confirm tighter conditions.",
          status: "confirming"
        },
        {
          id: "diverging-row",
          label: "Volatility divergence",
          message: "Volatility is diverging from the regime.",
          status: "diverging"
        },
        {
          id: "mixed-row",
          label: "Dollar mixed read",
          message: "Dollar confirmation is mixed.",
          status: "mixed"
        },
        {
          id: "unavailable-row",
          label: "MOVE unavailable",
          message: "MOVE source is unavailable.",
          status: "unavailable"
        },
        {
          id: "unconfirmed-row",
          label: "Accidental substring",
          message: "This status should not become confirming.",
          status: "unconfirmed"
        }
      ]
    } as unknown as RegimeSnapshotFile;
    const scoreSummary = {
      conflicting_signals: ["Inflation conflict", 42, null]
    } as unknown as ScoreSummaryFile;

    const container = render(<RegimeInterpretationPanel scoreSummary={scoreSummary} snapshot={snapshot} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Credit confirmation: Credit spreads confirm tighter conditions.");
    expect(text).toContain("Volatility divergence: Volatility is diverging from the regime.");
    expect(text).toContain("Inflation conflict");
    expect(text).toContain("Dollar mixed read: Dollar confirmation is mixed.");
    expect(text).toContain("MOVE unavailable: MOVE source is unavailable.");
    expect(text).not.toContain("Accidental substring");
    expect(text).not.toContain("42");
  });

  it("renders shock risk read empty states for malformed signal and gap rows", () => {
    const scoreSummary = {
      scores: {
        fragility: {
          label: "Moderate",
          score: -4.1
        }
      }
    } as unknown as ScoreSummaryFile;
    const malformedShockSnapshot = {
      ...shockRiskSnapshot,
      active_signals: [null, { id: "partial-active" }, { label: "", message: "Blank label" }],
      source_gaps: [null, { id: "partial-gap" }, { label: "", message: "Blank gap label" }]
    } as unknown as ShockRiskSnapshotFile;

    const container = render(
      <ShockRiskReadHeader scoreSummary={scoreSummary} shockSnapshot={malformedShockSnapshot} />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("No active stress channels in the current shock-risk snapshot.");
    expect(text).toContain("No candidate stress channels in the current shock-risk snapshot.");
    expect(text).toContain("0 source-gap rows.");
    expect(text).not.toContain("Blank label");
    expect(text).not.toContain("Blank gap label");
  });
});
