import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Overview from "./Overview";
import Rates from "./Rates";
import App from "../App";
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
    category: "volatility",
    frequency: "daily",
    higher_is: "riskier",
    id: "vix",
    max_stale_days: 7,
    name: "Cboe Volatility Index",
    notes: "Daily VIX close from Cboe.",
    public: true,
    source: "Cboe",
    source_url: "https://example.com/vix",
    units: "index"
  },
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
  },
  {
    category: "liquidity",
    frequency: "weekly",
    higher_is: "supportive",
    id: "net_liquidity",
    max_stale_days: 14,
    name: "Net liquidity proxy",
    notes: "Fed assets less RRP and Treasury General Account.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/net-liquidity",
    units: "USD billions"
  },
  {
    category: "credit",
    frequency: "weekly",
    higher_is: "riskier",
    id: "financial_stress",
    max_stale_days: 14,
    name: "Financial Stress Index",
    notes: "Weekly financial stress index from FRED.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/financial-stress",
    units: "index"
  },
  {
    category: "commodities",
    frequency: "daily",
    higher_is: "contextual",
    id: "wti_crude",
    max_stale_days: 7,
    name: "WTI crude oil",
    notes: "Daily WTI crude price.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/wti",
    units: "USD/barrel"
  },
  {
    category: "commodities",
    frequency: "daily",
    higher_is: "contextual",
    id: "brent_crude",
    max_stale_days: 7,
    name: "Brent crude oil",
    notes: "Daily Brent crude price.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/brent",
    units: "USD/barrel"
  },
  {
    category: "commodities",
    frequency: "daily",
    higher_is: "contextual",
    id: "corn_price",
    max_stale_days: 7,
    name: "Corn price",
    notes: "Daily corn price.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/corn",
    units: "USD/bushel"
  },
  {
    category: "commodities",
    frequency: "daily",
    higher_is: "contextual",
    id: "wheat_price",
    max_stale_days: 7,
    name: "Wheat price",
    notes: "Daily wheat price.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/wheat",
    units: "USD/bushel"
  },
  {
    category: "commodities",
    frequency: "daily",
    higher_is: "contextual",
    id: "soybean_price",
    max_stale_days: 7,
    name: "Soybean price",
    notes: "Daily soybean price.",
    public: true,
    source: "FRED",
    source_url: "https://example.com/soybean",
    units: "USD/bushel"
  },
  {
    category: "sentiment",
    frequency: "weekly",
    higher_is: "contextual",
    id: "cftc_sp500_asset_mgr_net",
    max_stale_days: 14,
    name: "CFTC S&P 500 asset manager net",
    notes: "Asset manager net positioning.",
    public: true,
    source: "CFTC",
    source_url: "https://example.com/cftc-asset-manager",
    units: "contracts"
  },
  {
    category: "sentiment",
    frequency: "weekly",
    higher_is: "contextual",
    id: "cftc_sp500_lev_money_net",
    max_stale_days: 14,
    name: "CFTC S&P 500 leveraged money net",
    notes: "Leveraged money net positioning.",
    public: true,
    source: "CFTC",
    source_url: "https://example.com/cftc-lev-money",
    units: "contracts"
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
    },
    net_liquidity: {
      expected_frequency: "weekly",
      freshness_days: 4,
      last_observation: "2026-04-29",
      max_stale_days: 14,
      source: "Derived",
      status: "ok"
    },
    wti_crude: {
      expected_frequency: "daily",
      freshness_days: 2,
      last_observation: "2026-05-01",
      max_stale_days: 7,
      source: "FRED",
      status: "ok"
    },
    brent_crude: {
      expected_frequency: "daily",
      freshness_days: 2,
      last_observation: "2026-05-01",
      max_stale_days: 7,
      source: "FRED",
      status: "ok"
    },
    corn_price: {
      expected_frequency: "daily",
      freshness_days: 2,
      last_observation: "2026-05-01",
      max_stale_days: 7,
      source: "FRED",
      status: "ok"
    },
    wheat_price: {
      expected_frequency: "daily",
      freshness_days: 2,
      last_observation: "2026-05-01",
      max_stale_days: 7,
      source: "FRED",
      status: "ok"
    },
    soybean_price: {
      expected_frequency: "daily",
      freshness_days: 2,
      last_observation: "2026-05-01",
      max_stale_days: 7,
      source: "FRED",
      status: "ok"
    },
    brent_wti_spread: {
      expected_frequency: "daily",
      freshness_days: 2,
      last_observation: "2026-05-01",
      max_stale_days: 10,
      source: "Derived",
      status: "ok"
    },
    cftc_sp500_asset_mgr_net: {
      expected_frequency: "weekly",
      freshness_days: 3,
      last_observation: "2026-04-29",
      max_stale_days: 14,
      source: "CFTC",
      status: "ok"
    },
    cftc_sp500_lev_money_net: {
      expected_frequency: "weekly",
      freshness_days: 3,
      last_observation: "2026-04-29",
      max_stale_days: 14,
      source: "CFTC",
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
      "/data/derived/net_liquidity.json": {
        depends_on: ["fed_assets", "reverse_repo", "treasury_general_account"],
        frequency: "weekly",
        generated_at_utc: "2026-05-03T18:32:54Z",
        method: "Fed assets less reverse repo and Treasury General Account.",
        observations: [{ date: "2026-04-29", percentile_252d: 72, value: 6123 }],
        series_id: "net_liquidity",
        source: "FRED",
        source_url: "https://example.com/net-liquidity",
        summary: {
          change_1d: null,
          change_1m: 100,
          change_1w: 25,
          latest_date: "2026-04-29",
          latest_value: 6123,
          percentile_252d: 72
        },
        units: "USD billions"
      } satisfies DerivedSeriesFile,
      "/data/derived/regime_score.json": regime,
      "/data/series/cftc_sp500_lev_money_net.json": seriesFile("cftc_sp500_lev_money_net", 12500),
      "/data/series/financial_stress.json": seriesFile("financial_stress", -0.33),
      "/data/series/us10y.json": seriesFile("us10y", 4.2),
      "/data/series/vix.json": seriesFile("vix", 17.1),
      "/data/series/wti_crude.json": seriesFile("wti_crude", 78.4),
      "/data/status/data_status.json": status
    });

    const container = render(<Overview />);
    await waitForContent(container, "Bucket scores");

    expect(container.textContent).toContain("Volatility");
    expect(container.textContent).toContain("-12.34");
  });

  it("renders net liquidity from the derived static file on overview", async () => {
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
    const netLiquidity: DerivedSeriesFile = {
      depends_on: ["fed_assets", "reverse_repo", "treasury_general_account"],
      frequency: "weekly",
      generated_at_utc: "2026-05-03T18:32:54Z",
      method: "Fed assets less reverse repo and Treasury General Account.",
      observations: [{ date: "2026-04-29", percentile_252d: 72, value: 6123 }],
      series_id: "net_liquidity",
      source: "FRED",
      source_url: "https://example.com/net-liquidity",
      summary: {
        change_1d: null,
        change_1m: 100,
        change_1w: 25,
        latest_date: "2026-04-29",
        latest_value: 6123,
        percentile_252d: 72
      },
      units: "USD billions"
    };

    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      "/data/derived/net_liquidity.json": netLiquidity,
      "/data/derived/regime_score.json": regime,
      "/data/series/cftc_sp500_lev_money_net.json": seriesFile("cftc_sp500_lev_money_net", 12500),
      "/data/series/financial_stress.json": seriesFile("financial_stress", -0.33),
      "/data/series/us10y.json": seriesFile("us10y", 4.2),
      "/data/series/vix.json": seriesFile("vix", 17.1),
      "/data/series/wti_crude.json": seriesFile("wti_crude", 78.4),
      "/data/status/data_status.json": status
    });

    const container = render(<Overview />);
    await waitForContent(container, "Net liquidity proxy");

    expect(container.textContent).toContain("6,123.00 USD billions");
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

  it("renders the commodities route with series and the Brent-WTI spread from static files", async () => {
    const spread: DerivedSeriesFile = {
      depends_on: ["brent_crude", "wti_crude"],
      frequency: "daily",
      generated_at_utc: "2026-05-03T18:32:54Z",
      method: "Brent crude minus WTI crude by matched observation date.",
      observations: [{ date: "2026-05-01", percentile_252d: 55, value: 3.21 }],
      series_id: "brent_wti_spread",
      source: "FRED",
      source_url: "https://example.com/brent-wti-spread",
      summary: {
        change_1d: 0.1,
        change_1m: -0.3,
        change_1w: 0.2,
        latest_date: "2026-05-01",
        latest_value: 3.21,
        percentile_252d: 55
      },
      units: "USD/barrel"
    };

    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      "/data/derived/brent_wti_spread.json": spread,
      "/data/series/brent_crude.json": seriesFile("brent_crude", 81.61),
      "/data/series/corn_price.json": seriesFile("corn_price", 4.85),
      "/data/series/soybean_price.json": seriesFile("soybean_price", 11.25),
      "/data/series/wti_crude.json": seriesFile("wti_crude", 78.4),
      "/data/series/wheat_price.json": seriesFile("wheat_price", 5.47),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/commodities"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "WTI crude oil");

    expect(container.querySelector("h2")?.textContent).toBe("Energy and grains");
    expect(container.textContent).toContain("WTI crude oil");
    expect(container.textContent).toContain("3.21 USD/barrel");
    expect(container.textContent).toContain("wti_crude");
  });

  it("renders the sentiment route with CFTC series from static files", async () => {
    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      "/data/series/cftc_sp500_asset_mgr_net.json": seriesFile("cftc_sp500_asset_mgr_net", 8200),
      "/data/series/cftc_sp500_lev_money_net.json": seriesFile("cftc_sp500_lev_money_net", 12500),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/sentiment"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "CFTC S&P 500 asset manager net");

    expect(container.querySelector("h2")?.textContent).toBe("CFTC positioning");
    expect(container.textContent).toContain("CFTC S&P 500 asset manager net");
    expect(container.textContent).toContain("CFTC S&P 500 leveraged money net");
    expect(container.textContent).toContain("cftc_sp500_asset_mgr_net");
    expect(container.textContent).toContain("cftc_sp500_lev_money_net");
  });
});
