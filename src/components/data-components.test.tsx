import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import DataStatusTable from "./DataStatusTable";
import HowToReadPanel from "./HowToReadPanel";
import MetricCard from "./MetricCard";
import PercentileBandChart from "./PercentileBandChart";
import RegimeBadge from "./RegimeBadge";
import ScoreCard from "./ScoreCard";
import SourceNote from "./SourceNote";
import SourceAccessBadge from "./SourceAccessBadge";
import type { DataStatusFile, ScoreBlock, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

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
    expect(container.textContent).toContain("-12.34");
    expect(container.textContent).toContain("Mixed");
    expect(container.textContent).toContain("82%");
    expect(container.textContent).toContain("Confidence notes");
    expect(container.textContent).toContain("Sentiment is limited to CFTC positioning.");
    expect(container.textContent).toContain("High-yield spreads widened over the past month.");
    expect(container.textContent).toContain("Reserve balances improved over the past month.");
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
});
