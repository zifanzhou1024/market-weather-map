/**
 * Tests for the 7 channel-tab FocusBlock placements added in the
 * channel-focus-blocks follow-up. Each tab is rendered with the data
 * loaders mocked so the section text from page_insights.json appears
 * inside the FocusBlock above the primary chart.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataStatusFile,
  PageInsightsFile,
  SectionId,
  SeriesCatalogEntry,
  TimeSeriesFile,
  DerivedSeriesFile
} from "../../lib/types";

// Mock the data loader for every channel tab so we can assert FocusBlock
// renders from page_insights.json without invoking real network fetches.
vi.mock("../../lib/data", () => ({
  loadCatalog: vi.fn(),
  loadDataStatus: vi.fn(),
  loadPageInsights: vi.fn(),
  loadSeries: vi.fn(),
  loadDerivedSeries: vi.fn()
}));

vi.mock("../../routes/routeSeries", () => ({
  loadRouteSeries: vi.fn(),
  loadRouteDerivedSeries: vi.fn(),
  // Force the per-tab heavy chart guards to render the "data unavailable"
  // panel rather than instantiate ECharts (which throws under jsdom).
  hasObservations: () => false
}));

import {
  loadCatalog,
  loadDataStatus,
  loadPageInsights,
  loadSeries,
  loadDerivedSeries
} from "../../lib/data";
import { loadRouteSeries, loadRouteDerivedSeries } from "../../routes/routeSeries";

import LiquidityTab from "./LiquidityTab";
import CreditTab from "./CreditTab";
import DollarTab from "./DollarTab";
import CommoditiesTab from "./CommoditiesTab";
import GrowthTab from "./GrowthTab";
import HousingTab from "./HousingTab";
import InflationTab from "./InflationTab";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (container.textContent?.includes(expectedText)) return;
  }
  expect(container.textContent).toContain(expectedText);
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function emptySeries(id: string): TimeSeriesFile {
  // Empty observations so per-tab chart guards render the fallback panel
  // instead of mounting ECharts (which throws inside jsdom).
  return {
    series_id: id,
    frequency: "daily",
    units: "index",
    source: "FRED",
    source_url: "https://example.com",
    generated_at_utc: "2026-05-16T00:00:00Z",
    observations: []
  };
}

function emptyDerivedSeries(id: string): DerivedSeriesFile {
  return {
    series_id: id,
    frequency: "daily",
    units: "index",
    source: "Derived",
    source_url: "/data/series/",
    method: "test",
    depends_on: [],
    generated_at_utc: "2026-05-16T00:00:00Z",
    observations: []
  };
}

const emptyStatus: DataStatusFile = {
  last_successful_update_utc: "2026-05-16T00:00:00Z",
  generated_at_utc: "2026-05-16T00:00:00Z",
  overall_status: "ok",
  series: {}
};

const emptyCatalog: SeriesCatalogEntry[] = [];

function mkPageInsights(
  route: keyof PageInsightsFile["routes"],
  sectionId: SectionId,
  eyebrow: string,
  question: string,
  answer: string
): PageInsightsFile {
  return {
    generated_at_utc: "2026-05-16T00:00:00Z",
    date: "2026-05-15",
    method_version: "test-1",
    routes: {
      [route]: {
        title: route,
        state: "calm",
        why_it_matters: "Test why_it_matters string.",
        confidence: 0.5,
        freshness_notes: [],
        sections: [
          {
            id: sectionId,
            eyebrow,
            question,
            answer,
            freshness_status: "ok"
          }
        ]
      }
    }
  };
}

function defaultMocks() {
  vi.mocked(loadCatalog).mockResolvedValue(emptyCatalog);
  vi.mocked(loadDataStatus).mockResolvedValue(emptyStatus);
  vi.mocked(loadSeries).mockImplementation((id: string) => Promise.resolve(emptySeries(id)));
  vi.mocked(loadDerivedSeries).mockImplementation((id: string) =>
    Promise.resolve(emptyDerivedSeries(id))
  );
  vi.mocked(loadRouteSeries).mockImplementation((ids: string[]) =>
    Promise.resolve(ids.map(emptySeries))
  );
  vi.mocked(loadRouteDerivedSeries).mockImplementation((ids: string[]) =>
    Promise.resolve(ids.map(emptyDerivedSeries))
  );
}

describe("channel-tab FocusBlock placements", () => {
  it("LiquidityTab renders liquidity_funding FocusBlock when page_insights provides it", async () => {
    defaultMocks();
    const answer = "Net liquidity is expanding (+$50B over four weeks to $5,000B); Fed balance sheet outpaces TGA and reverse repo drain.";
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights(
        "liquidity",
        "liquidity_funding",
        "Liquidity & funding",
        "Is net liquidity expanding or contracting, and which Fed components are driving it?",
        answer
      )
    );
    const c = render(<LiquidityTab />);
    await flushPromises(c, "Is net liquidity expanding");
    expect(c.querySelector(".focus-block")).not.toBeNull();
    expect(c.textContent).toContain("Liquidity & funding");
    expect(c.textContent).toContain(answer);
  });

  it("CreditTab renders credit_dispersion FocusBlock when page_insights provides it", async () => {
    defaultMocks();
    const answer = "The HY-IG OAS spread is widening (+0.50 pp over 30 days to 2.50 pp), an early sign of credit-quality dispersion.";
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights(
        "credit",
        "credit_dispersion",
        "Credit dispersion",
        "Is the HY-IG spread widening (early credit stress) or tightening (risk-on)?",
        answer
      )
    );
    const c = render(<CreditTab />);
    await flushPromises(c, "Is the HY-IG spread widening");
    expect(c.querySelector(".focus-block")).not.toBeNull();
    expect(c.textContent).toContain("Credit dispersion");
    expect(c.textContent).toContain(answer);
  });

  it("DollarTab renders dollar_pressure FocusBlock when page_insights provides it", async () => {
    defaultMocks();
    const answer = "The broad dollar is strengthening (+1.50% over one month to 120.00); global financial conditions are tightening from the FX side.";
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights(
        "dollar_global",
        "dollar_pressure",
        "Dollar pressure",
        "Is the broad dollar tightening or easing global financial conditions?",
        answer
      )
    );
    const c = render(<DollarTab />);
    await flushPromises(c, "Is the broad dollar tightening");
    expect(c.querySelector(".focus-block")).not.toBeNull();
    expect(c.textContent).toContain("Dollar pressure");
    expect(c.textContent).toContain(answer);
  });

  it("CommoditiesTab renders commodity_impulse FocusBlock when page_insights provides it", async () => {
    defaultMocks();
    const answer = "Commodity prices are adding to inflation pressure (impulse +15.0, 85th percentile of the past year).";
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights(
        "commodities",
        "commodity_impulse",
        "Commodity impulse",
        "Are commodity prices adding to or subtracting from inflation pressure?",
        answer
      )
    );
    const c = render(<CommoditiesTab />);
    await flushPromises(c, "Are commodity prices adding");
    expect(c.querySelector(".focus-block")).not.toBeNull();
    expect(c.textContent).toContain("Commodity impulse");
    expect(c.textContent).toContain(answer);
  });

  it("GrowthTab renders growth_breadth FocusBlock when page_insights provides it", async () => {
    defaultMocks();
    const answer = "Growth breadth is firm: 5 of 5 growth and labor inputs are in their constructive zones.";
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights(
        "growth",
        "growth_breadth",
        "Growth breadth",
        "Is broad-based growth firm, mixed, or softening across labor and production inputs?",
        answer
      )
    );
    const c = render(<GrowthTab />);
    await flushPromises(c, "Is broad-based growth firm");
    expect(c.querySelector(".focus-block")).not.toBeNull();
    expect(c.textContent).toContain("Growth breadth");
    expect(c.textContent).toContain(answer);
  });

  it("HousingTab renders housing_pulse FocusBlock when page_insights provides it", async () => {
    defaultMocks();
    const answer = "Housing activity is expanding with the 30Y mortgage at 5.50%; starts and permits are rising over three months.";
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights(
        "housing",
        "housing_pulse",
        "Housing pulse",
        "Is housing activity expanding or contracting given current mortgage rates?",
        answer
      )
    );
    const c = render(<HousingTab />);
    await flushPromises(c, "Is housing activity expanding");
    expect(c.querySelector(".focus-block")).not.toBeNull();
    expect(c.textContent).toContain("Housing pulse");
    expect(c.textContent).toContain(answer);
  });

  it("InflationTab renders inflation_dispersion FocusBlock when page_insights provides it", async () => {
    defaultMocks();
    const answer = "Core and headline inflation are aligned and disinflating (headline 2.5% YoY, core CPI 2.7% YoY, both easing).";
    vi.mocked(loadPageInsights).mockResolvedValue(
      mkPageInsights(
        "inflation",
        "inflation_dispersion",
        "Inflation dispersion",
        "Are core and headline inflation moving in the same direction or diverging?",
        answer
      )
    );
    const c = render(<InflationTab />);
    await flushPromises(c, "Are core and headline inflation");
    expect(c.querySelector(".focus-block")).not.toBeNull();
    expect(c.textContent).toContain("Inflation dispersion");
    expect(c.textContent).toContain(answer);
  });

  it("LiquidityTab omits FocusBlock when page_insights has no matching section", async () => {
    defaultMocks();
    vi.mocked(loadPageInsights).mockResolvedValue({
      generated_at_utc: "2026-05-16T00:00:00Z",
      date: "2026-05-15",
      method_version: "test-1",
      routes: {}
    });
    const c = render(<LiquidityTab />);
    // Wait for the data to load so [data-testid='liquidity-tab'] populated.
    await flushPromises(c, "Liquidity funding conditions");
    expect(c.querySelector(".focus-block")).toBeNull();
  });
});
