import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import ConfidenceBreakdown from "./ConfidenceBreakdown";
import DataGapPanel from "./DataGapPanel";
import DataStatusTable from "./DataStatusTable";
import HowToReadPanel from "./HowToReadPanel";
import InterpretationPanel from "./InterpretationPanel";
import MetricCard from "./MetricCard";
import PercentileBandChart from "./PercentileBandChart";
import RegimeBadge from "./RegimeBadge";
import ScoreCard from "./ScoreCard";
import SignalList from "./SignalList";
import SourceNote from "./SourceNote";
import SourceAccessBadge from "./SourceAccessBadge";
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
});
