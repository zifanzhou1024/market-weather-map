import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import ConfidenceBreakdown from "./ConfidenceBreakdown";
import CandidateSourcePanel, { type CandidateSourceItem } from "./CandidateSourcePanel";
import CrossAssetConfirmationMatrix from "./CrossAssetConfirmationMatrix";
import DataGapPanel from "./DataGapPanel";
import DataStatusTable from "./DataStatusTable";
import EventRiskPanel from "./EventRiskPanel";
import HowToReadPanel from "./HowToReadPanel";
import InterpretationPanel from "./InterpretationPanel";
import MetricCard from "./MetricCard";
import MultiSeriesChart from "./MultiSeriesChart";
import OptionsSentimentPanel from "./OptionsSentimentPanel";
import PercentileBandChart from "./PercentileBandChart";
import RegimeQuadrantChart, { domainIncludingZero } from "./RegimeQuadrantChart";
import RegimeBadge from "./RegimeBadge";
import ScoreCard from "./ScoreCard";
import SignalChecklist from "./SignalChecklist";
import SignalList from "./SignalList";
import SourceNote from "./SourceNote";
import SourceAccessBadge from "./SourceAccessBadge";
import VixFuturesReadinessPanel from "./VixFuturesReadinessPanel";
import YieldDecompositionChart from "./YieldDecompositionChart";
import type {
  ConfidenceBreakdownData,
  DataStatusFile,
  ScoreBlock,
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
    const container = render(
      <OptionsSentimentPanel activeSeries={[activeOptionsSeries]} items={candidateRows} />
    );
    const text = container.textContent ?? "";

    expect(text).toContain("Options sentiment");
    expect(text).toContain("SPX/SPXW put/call");
    expect(text).toContain("Active data");
    expect(text).toContain("Latest ratio 1.23 on 2026-05-01.");
    expect(text.indexOf("SPX/SPXW put/call")).toBeLessThan(text.indexOf("SPX put/call"));
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

  it("configures regime quadrant numeric domains to include zero", () => {
    expect(domainIncludingZero([0.2, 0.5, 1.1])).toEqual([0, 1.1]);
    expect(domainIncludingZero([-1.1, -0.5, -0.2])).toEqual([-1.1, 0]);
    expect(domainIncludingZero([-0.7, 0.4, 1.2])).toEqual([-0.7, 1.2]);
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
});
