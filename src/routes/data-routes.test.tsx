import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Overview from "./Overview";
import Rates from "./Rates";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  RegimeScoreFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../lib/types";

vi.mock("../components/TimeSeriesChart", () => ({
  default: () => <section aria-label="Chart placeholder" />
}));

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

async function waitForContent(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  expect(container.textContent).toContain(text);
}

function mockStaticFetch(files: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const data = files[path];

      return {
        ok: data !== undefined,
        status: data === undefined ? 404 : 200,
        json: async () => data
      };
    })
  );
}

const catalog: SeriesCatalogEntry[] = [
  {
    category: "rates",
    frequency: "daily",
    higher_is: "riskier",
    id: "us2y",
    max_stale_days: 7,
    name: "2-Year Treasury Constant Maturity Rate",
    notes: "Daily 2-year Treasury yield from FRED.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/us2y",
    units: "percent"
  },
  {
    category: "rates",
    frequency: "daily",
    higher_is: "riskier",
    id: "us10y",
    max_stale_days: 7,
    name: "10-Year Treasury Constant Maturity Rate",
    notes: "Daily 10-year Treasury yield from FRED.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/us10y",
    units: "percent"
  },
  {
    category: "rates",
    frequency: "daily",
    higher_is: "riskier",
    id: "us20y",
    max_stale_days: 7,
    name: "20-Year Treasury Constant Maturity Rate",
    notes: "Daily 20-year Treasury yield from FRED.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/us20y",
    units: "percent"
  },
  {
    category: "rates",
    frequency: "daily",
    higher_is: "riskier",
    id: "us30y",
    max_stale_days: 7,
    name: "30-Year Treasury Constant Maturity Rate",
    notes: "Daily 30-year Treasury yield from FRED.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/us30y",
    units: "percent"
  }
];

function seriesFile(seriesId: string, latestValue: number): TimeSeriesFile {
  return {
    frequency: "daily",
    generated_at_utc: "2026-05-03T18:11:59Z",
    observations: [{ date: "2026-05-01", percentile_252d: 60, value: latestValue }],
    series_id: seriesId,
    source: "FRED",
    source_url: `https://example.com/${seriesId}`,
    summary: {
      change_1d: 0.01,
      change_1m: 0.05,
      change_1w: -0.02,
      latest_date: "2026-05-01",
      latest_value: latestValue,
      percentile_252d: 60
    },
    units: "percent"
  };
}

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
    financial_stress: {
      expected_frequency: "weekly",
      freshness_days: 9,
      last_observation: "2026-04-24",
      max_stale_days: 14,
      source: "FRED",
      status: "ok"
    },
    us10y: {
      expected_frequency: "daily",
      freshness_days: 3,
      last_observation: "2026-04-30",
      max_stale_days: 7,
      source: "FRED",
      status: "ok"
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

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("data-backed routes", () => {
  it("renders bucket scores from the regime payload on overview", async () => {
    const regime: RegimeScoreFile = {
      buckets: { volatility: -12.34, rates: 4.5 },
      date: "2026-05-01",
      generated_at_utc: "2026-05-03T18:32:54Z",
      label: "Neutral",
      method_version: "phase1-github-native-v1",
      overall_score: 19.17,
      top_risks: ["Volatility"],
      top_supports: ["Rates"]
    };

    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      "/data/derived/regime_score.json": regime,
      "/data/series/fed_assets.json": seriesFile("fed_assets", 6800),
      "/data/series/financial_stress.json": seriesFile("financial_stress", -0.33),
      "/data/series/us10y.json": seriesFile("us10y", 4.2),
      "/data/series/vix.json": seriesFile("vix", 17.1),
      "/data/status/data_status.json": status
    });

    const container = render(<Overview />);
    await waitForContent(container, "Bucket scores");

    expect(container.textContent).toContain("Volatility");
    expect(container.textContent).toContain("-12.34");
  });

  it("renders the 10Y-2Y spread from the derived static file on rates", async () => {
    const curve: DerivedSeriesFile = {
      depends_on: ["us10y", "us2y"],
      frequency: "daily",
      generated_at_utc: "2026-05-03T18:32:54Z",
      method: "10-year Treasury yield minus 2-year Treasury yield by matched observation date.",
      observations: [{ date: "2026-05-01", percentile_252d: 47, value: 0.42 }],
      series_id: "us10y_minus_us2y",
      source: "FRED",
      source_url: "https://example.com/us10y-minus-us2y",
      summary: {
        change_1d: 0.03,
        change_1m: -0.2,
        change_1w: 0.08,
        latest_date: "2026-05-01",
        latest_value: 0.42,
        percentile_252d: 47
      },
      units: "percentage points"
    };

    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      "/data/derived/us10y_minus_us2y.json": curve,
      "/data/series/us10y.json": seriesFile("us10y", 4.2),
      "/data/series/us20y.json": seriesFile("us20y", 4.7),
      "/data/series/us2y.json": seriesFile("us2y", 3.78),
      "/data/series/us30y.json": seriesFile("us30y", 4.9)
    });

    const container = render(<Rates />);
    await waitForContent(container, "10Y-2Y spread");

    expect(container.textContent).toContain("0.42 percentage points");
  });
});
