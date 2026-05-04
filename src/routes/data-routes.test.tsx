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
  ScoreSummaryFile,
  SeriesCategory,
  SeriesCatalogEntry,
  SeriesFrequency,
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

function h3Texts(container: HTMLElement) {
  return Array.from(container.querySelectorAll("h3"), (heading) => heading.textContent);
}

function mockStaticFetch(files: Record<string, unknown>, failures: Record<string, number> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const failureStatus = failures[path];
      if (failureStatus !== undefined) {
        return {
          ok: false,
          status: failureStatus,
          json: async () => ({})
        };
      }

      const data = files[path];

      return {
        ok: data !== undefined,
        status: data === undefined ? 404 : 200,
        json: async () => data
      };
    })
  );
}

function overviewFetchFiles(scoreSummaryFile: unknown = scoreSummary) {
  const regime: RegimeScoreFile = {
    buckets: { volatility: -12.34, rates: 4.5 },
    date: "2026-05-01",
    generated_at_utc: "2026-05-03T18:32:54Z",
    label: "Neutral",
    method_version: "phase2-public-data-v1",
    overall_score: 19.17,
    top_risks: ["Volatility"],
    top_supports: ["Rates"]
  };

  return {
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
    "/data/derived/score_summary.json": scoreSummaryFile,
    "/data/series/cftc_sp500_lev_money_net.json": seriesFile("cftc_sp500_lev_money_net", 12500),
    "/data/series/financial_stress.json": seriesFile("financial_stress", -0.33),
    "/data/series/us10y.json": seriesFile("us10y", 4.2),
    "/data/series/vix.json": seriesFile("vix", 17.1),
    "/data/series/wti_crude.json": seriesFile("wti_crude", 78.4),
    "/data/status/data_status.json": status
  };
}

function catalogEntry(
  id: string,
  category: SeriesCategory,
  name: string,
  units = "percent",
  frequency: SeriesFrequency = "daily"
): SeriesCatalogEntry {
  return {
    category,
    frequency,
    higher_is: "contextual",
    id,
    max_stale_days: frequency === "weekly" ? 14 : 7,
    name,
    notes: `${name} test fixture.`,
    public: true,
    source: "FRED",
    source_url: `https://example.com/${id}`,
    units
  };
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
  },
  catalogEntry("cfnai", "growth", "Chicago Fed National Activity Index", "index", "monthly"),
  catalogEntry("cfnai_3m_avg", "growth", "CFNAI 3-month average", "index", "monthly"),
  catalogEntry("real_retail_sales", "growth", "Real retail sales", "index", "monthly"),
  catalogEntry("industrial_production", "growth", "Industrial production", "index", "monthly"),
  catalogEntry("durable_goods_orders", "growth", "Durable goods orders", "USD millions", "monthly"),
  catalogEntry("unemployment_rate", "growth", "Unemployment rate"),
  catalogEntry("nonfarm_payrolls", "growth", "Nonfarm payrolls", "thousands", "monthly"),
  catalogEntry("initial_claims", "growth", "Initial jobless claims", "thousands", "weekly"),
  catalogEntry("sahm_rule", "growth", "Sahm Rule recession indicator", "percentage points", "monthly"),
  catalogEntry("headline_cpi", "inflation", "Headline CPI", "percent", "monthly"),
  catalogEntry("core_cpi", "inflation", "Core CPI", "percent", "monthly"),
  catalogEntry("core_pce", "inflation", "Core PCE", "percent", "monthly"),
  catalogEntry("ppi_final_demand", "inflation", "PPI final demand", "percent", "monthly"),
  catalogEntry("breakeven_10y", "inflation", "10-year breakeven inflation rate"),
  catalogEntry("breakeven_5y", "inflation", "5-year breakeven inflation rate"),
  catalogEntry("forward_inflation_5y5y", "inflation", "5Y5Y forward inflation expectation rate"),
  catalogEntry("real_yield_5y", "rates", "5-year real yield"),
  catalogEntry("real_yield_10y", "rates", "10-year real yield"),
  catalogEntry("high_yield_oas", "credit", "High yield OAS", "basis points"),
  catalogEntry("investment_grade_oas", "credit", "Investment grade OAS", "basis points"),
  catalogEntry("bbb_oas", "credit", "BBB OAS", "basis points"),
  catalogEntry("financial_conditions", "credit", "Financial conditions index", "index", "weekly"),
  catalogEntry("reserve_balances", "credit", "Reserve balances", "USD billions", "weekly"),
  catalogEntry("bank_credit", "credit", "Bank credit", "USD billions", "weekly"),
  catalogEntry("loans_and_leases", "credit", "Loans and leases", "USD billions", "weekly"),
  catalogEntry("business_loans", "credit", "Commercial and industrial loans", "USD billions", "weekly"),
  catalogEntry("bank_deposits", "credit", "Bank deposits", "USD billions", "weekly"),
  catalogEntry("broad_dollar", "dollar", "Nominal Broad U.S. Dollar Index", "index"),
  catalogEntry("usdjpy", "dollar", "USD/JPY", "exchange rate"),
  catalogEntry("eurusd", "dollar", "EUR/USD", "exchange rate")
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

function seriesFiles(seriesIds: string[]): Record<string, TimeSeriesFile> {
  return Object.fromEntries(
    seriesIds.map((seriesId, index) => [`/data/series/${seriesId}.json`, seriesFile(seriesId, index + 1)])
  );
}

function statusRow(
  statusValue: DataStatusFile["series"][string]["status"],
  frequency: SeriesFrequency = "daily"
): DataStatusFile["series"][string] {
  return {
    expected_frequency: frequency,
    freshness_days: statusValue === "unavailable" ? null : 2,
    last_observation: statusValue === "unavailable" ? null : "2026-05-01",
    max_stale_days: frequency === "weekly" ? 14 : 7,
    source: "FRED",
    status: statusValue
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
    us2y: {
      expected_frequency: "daily",
      freshness_days: 3,
      last_observation: "2026-04-30",
      max_stale_days: 7,
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
    },
    cfnai: statusRow("unavailable", "monthly"),
    cfnai_3m_avg: statusRow("unavailable", "monthly"),
    real_retail_sales: statusRow("unavailable", "monthly"),
    industrial_production: statusRow("unavailable", "monthly"),
    durable_goods_orders: statusRow("unavailable", "monthly"),
    unemployment_rate: statusRow("unavailable"),
    nonfarm_payrolls: statusRow("unavailable", "monthly"),
    initial_claims: statusRow("unavailable", "weekly"),
    sahm_rule: statusRow("unavailable", "monthly"),
    headline_cpi: statusRow("unavailable", "monthly"),
    core_cpi: statusRow("unavailable", "monthly"),
    core_pce: statusRow("unavailable", "monthly"),
    ppi_final_demand: statusRow("unavailable", "monthly"),
    breakeven_10y: statusRow("unavailable"),
    breakeven_5y: statusRow("unavailable"),
    forward_inflation_5y5y: statusRow("unavailable"),
    real_yield_5y: statusRow("unavailable"),
    real_yield_10y: statusRow("unavailable"),
    high_yield_oas: statusRow("unavailable"),
    investment_grade_oas: statusRow("unavailable"),
    bbb_oas: statusRow("unavailable"),
    financial_conditions: statusRow("unavailable", "weekly"),
    reserve_balances: statusRow("unavailable", "weekly"),
    bank_credit: statusRow("unavailable", "weekly"),
    loans_and_leases: statusRow("unavailable", "weekly"),
    business_loans: statusRow("unavailable", "weekly"),
    bank_deposits: statusRow("unavailable", "weekly"),
    broad_dollar: statusRow("unavailable"),
    usdjpy: statusRow("unavailable"),
    eurusd: statusRow("unavailable")
  }
};

const scoreSummary: ScoreSummaryFile = {
  date: "2026-05-01",
  generated_at_utc: "2026-05-04T00:00:00Z",
  method_version: "phase3-three-score-v1",
  scores: {
    market_weather: {
      bucket_scores: { volatility: -12.34, rates: 4.5 },
      bucket_weights: { volatility: 0.5, rates: 0.5 },
      confidence: 0.82,
      confidence_reasons: ["Core market inputs are fresh."],
      label: "Mixed",
      missing_or_stale_notes: [],
      recent_changes: ["Volatility eased while rates pressure increased."],
      score: 19.17,
      top_risks: ["Volatility"],
      top_supports: ["Rates"]
    },
    macro_climate: {
      bucket_scores: { growth: 6, inflation: -3 },
      bucket_weights: { growth: 0.5, inflation: 0.5 },
      confidence: 0.74,
      confidence_reasons: ["Macro inputs are mostly current."],
      label: "Goldilocks",
      missing_or_stale_notes: [],
      recent_changes: ["Growth breadth improved."],
      score: 8.2,
      top_risks: ["Inflation momentum remains sticky."],
      top_supports: ["Growth breadth improved."]
    },
    fragility: {
      bucket_scores: { dollar: -7, liquidity: 3 },
      bucket_weights: { dollar: 0.5, liquidity: 0.5 },
      confidence: 0.69,
      confidence_reasons: ["Some fragility inputs are candidate-only."],
      label: "Moderate",
      missing_or_stale_notes: ["MOVE remains a candidate input."],
      recent_changes: ["Dollar pressure increased."],
      score: -4.1,
      top_risks: ["Dollar pressure increased."],
      top_supports: ["Liquidity remains stable."]
    }
  },
  conflicting_signals: ["Growth is firm while inflation momentum remains sticky."],
  data_quality: {
    overall_confidence: 0.73,
    reasons: ["Sentiment coverage is limited to public CFTC positioning."]
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
  it("renders three score summary sections and market weather buckets on overview", async () => {
    mockStaticFetch(overviewFetchFiles());

    const container = render(<Overview />);
    await waitForContent(container, "Market Weather buckets");

    expect(container.textContent).toContain("Macro Climate");
    expect(container.textContent).toContain("Fragility");
    expect(container.textContent).toContain("Recent changes");
    expect(container.textContent).not.toContain("What changed this week");
    expect(container.textContent).toContain("Conflicting signals");
    expect(container.textContent).toContain("Data confidence");
    expect(container.textContent).toContain("73%");
    expect(container.textContent).toContain("Sentiment coverage is limited to public CFTC positioning.");
    expect(container.textContent).toContain("Volatility");
    expect(container.textContent).toContain("-12.34");
  });

  it("renders overview empty states for malformed score summary top-level fields", async () => {
    const malformedScoreSummary = {
      ...scoreSummary,
      scores: {
        ...scoreSummary.scores,
        market_weather: {
          ...scoreSummary.scores.market_weather,
          recent_changes: "not an array"
        },
        macro_climate: {
          ...scoreSummary.scores.macro_climate,
          recent_changes: undefined
        },
        fragility: {
          ...scoreSummary.scores.fragility,
          recent_changes: []
        }
      },
      conflicting_signals: "not an array",
      data_quality: {
        overall_confidence: Number.NaN
      }
    } as unknown as ScoreSummaryFile;

    mockStaticFetch(overviewFetchFiles(malformedScoreSummary));

    const container = render(<Overview />);
    await waitForContent(container, "Recent changes");

    expect(container.textContent).toContain("No recent changes in the current score summary.");
    expect(container.textContent).toContain("No conflicting signals in the current score summary.");
    expect(container.textContent).toContain("0% overall confidence");
    expect(container.textContent).toContain("No data confidence notes in the current score summary.");
  });

  it("announces overview data load errors", async () => {
    const files = overviewFetchFiles();
    delete files["/data/derived/score_summary.json"];
    mockStaticFetch(files);

    const container = render(<Overview />);
    await waitForContent(container, "Data error:");

    expect(container.querySelector(".data-error")?.getAttribute("role")).toBe("alert");
  });

  it("renders net liquidity from the derived static file on overview", async () => {
    const regime: RegimeScoreFile = {
      buckets: { volatility: -12.34, rates: 4.5 },
      date: "2026-05-01",
      generated_at_utc: "2026-05-03T18:32:54Z",
      label: "Neutral",
      method_version: "phase2-public-data-v1",
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
      "/data/derived/score_summary.json": scoreSummary,
      "/data/series/cftc_sp500_lev_money_net.json": seriesFile("cftc_sp500_lev_money_net", 12500),
      "/data/series/financial_stress.json": seriesFile("financial_stress", -0.33),
      "/data/series/us10y.json": seriesFile("us10y", 4.2),
      "/data/series/vix.json": seriesFile("vix", 17.1),
      "/data/series/wti_crude.json": seriesFile("wti_crude", 78.4),
      "/data/status/data_status.json": status
    });

    const container = render(<Overview />);
    await waitForContent(container, "Net liquidity proxy");

    expect(container.textContent).toContain("Net liquidity proxy");
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
      ...seriesFiles(["breakeven_10y", "breakeven_5y", "forward_inflation_5y5y", "real_yield_10y", "real_yield_5y"]),
      "/data/series/us10y.json": seriesFile("us10y", 4.2),
      "/data/series/us20y.json": seriesFile("us20y", 4.7),
      "/data/series/us2y.json": seriesFile("us2y", 3.78),
      "/data/series/us30y.json": seriesFile("us30y", 4.9),
      "/data/status/data_status.json": status
    });

    const container = render(<Rates />);
    await waitForContent(container, "10Y-2Y spread");

    expect(container.textContent).toContain("0.42 percentage points");
  });

  it("renders the growth route with growth and labor risk sections", async () => {
    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      ...seriesFiles([
        "cfnai",
        "cfnai_3m_avg",
        "real_retail_sales",
        "industrial_production",
        "durable_goods_orders",
        "unemployment_rate",
        "nonfarm_payrolls",
        "initial_claims",
        "sahm_rule"
      ]),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/growth"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Labor and recession risk");

    expect(container.querySelector("h2")?.textContent).toBe("Growth");
    expect(container.textContent).toContain("Chicago Fed National Activity Index");
    expect(container.textContent).toContain("Durable goods orders");
    expect(container.textContent).toContain("Sahm Rule recession indicator");
    expect(container.textContent).toContain("Rates & Policy");
    expect(container.textContent).toContain("Credit & Banking");
    expect(container.textContent).toContain("Dollar & Global");
    expect(container.textContent).toContain("Sentiment & Positioning");
    expect(container.textContent).toContain("Static feed freshness");
  });

  it("renders growth placeholders when a phase 3 series file is missing", async () => {
    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      ...seriesFiles([
        "cfnai_3m_avg",
        "real_retail_sales",
        "industrial_production",
        "durable_goods_orders",
        "unemployment_rate",
        "nonfarm_payrolls",
        "initial_claims",
        "sahm_rule"
      ]),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/growth"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Labor and recession risk");

    expect(container.textContent).toContain("Chicago Fed National Activity Index");
    expect(container.textContent).toContain("N/A index");
    expect(container.textContent).toContain("Featured chart unavailable until source data is available.");
    expect(container.querySelector('[aria-label="Chart placeholder"]')).toBeNull();
    expect(container.querySelector(".data-error")).toBeNull();
  });

  it("surfaces a data error when a missing core series is marked ok", async () => {
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
      ...seriesFiles(["breakeven_10y", "breakeven_5y", "forward_inflation_5y5y", "real_yield_10y", "real_yield_5y"]),
      "/data/series/us20y.json": seriesFile("us20y", 4.7),
      "/data/series/us2y.json": seriesFile("us2y", 3.78),
      "/data/series/us30y.json": seriesFile("us30y", 4.9),
      "/data/status/data_status.json": status
    });

    const container = render(<Rates />);
    await waitForContent(container, "Data error:");

    expect(container.querySelector(".data-error")?.getAttribute("role")).toBe("alert");
    expect(container.textContent).toContain("Failed to load /data/series/us10y.json");
    expect(container.textContent).not.toContain("10-Year Treasury Constant Maturity Rate");
  });

  it("surfaces a data error when a series load fails with a non-404 response", async () => {
    mockStaticFetch(
      {
        "/data/catalog/series_catalog.json": catalog,
        ...seriesFiles(["cfnai_3m_avg", "real_retail_sales", "industrial_production", "durable_goods_orders"]),
        ...seriesFiles(["unemployment_rate", "nonfarm_payrolls", "initial_claims", "sahm_rule"]),
        "/data/status/data_status.json": status
      },
      { "/data/series/cfnai.json": 500 }
    );

    const container = render(
      <MemoryRouter initialEntries={["/growth"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Data error:");

    expect(container.querySelector(".data-error")?.getAttribute("role")).toBe("alert");
    expect(container.textContent).toContain("Failed to load /data/series/cfnai.json");
    expect(container.textContent).not.toContain("Labor and recession risk");
  });

  it("renders the inflation route with price and expectations series", async () => {
    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      ...seriesFiles([
        "headline_cpi",
        "core_cpi",
        "core_pce",
        "ppi_final_demand",
        "breakeven_10y",
        "breakeven_5y",
        "forward_inflation_5y5y"
      ]),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/inflation"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Headline CPI");

    expect(container.querySelector("h2")?.textContent).toBe("Inflation");
    expect(container.textContent).toContain("Headline CPI");
    expect(h3Texts(container)).toContain("Core CPI");
    expect(container.textContent).toContain("Core PCE");
    expect(container.textContent).toContain("5Y5Y forward inflation expectation rate");
    expect(container.textContent).toContain("Static feed freshness");
  });

  it("renders an unavailable featured chart panel when headline CPI is a placeholder", async () => {
    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      ...seriesFiles([
        "core_cpi",
        "core_pce",
        "ppi_final_demand",
        "breakeven_10y",
        "breakeven_5y",
        "forward_inflation_5y5y"
      ]),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/inflation"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Featured chart unavailable until source data is available.");

    expect(container.textContent).toContain("Headline CPI");
    expect(container.querySelector('[aria-label="Chart placeholder"]')).toBeNull();
    expect(container.querySelector(".data-error")).toBeNull();
  });

  it("renders the dollar global route with dollar and currency series", async () => {
    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      ...seriesFiles(["broad_dollar", "usdjpy", "eurusd"]),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/dollar-global"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Nominal Broad U.S. Dollar Index");

    expect(container.querySelector("h2")?.textContent).toBe("Dollar & Global");
    expect(h3Texts(container)).toContain("Nominal Broad U.S. Dollar Index");
    expect(container.textContent).toContain("USD/JPY");
    expect(container.textContent).toContain("EUR/USD");
    expect(container.textContent).toContain("Static feed freshness");
  });

  it("renders an unavailable featured chart panel when broad dollar is a placeholder", async () => {
    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      ...seriesFiles(["usdjpy", "eurusd"]),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/dollar-global"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Featured chart unavailable until source data is available.");

    expect(container.textContent).toContain("Nominal Broad U.S. Dollar Index");
    expect(container.querySelector('[aria-label="Chart placeholder"]')).toBeNull();
    expect(container.querySelector(".data-error")).toBeNull();
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

    expect(container.querySelector("h2")?.textContent).toBe("Sentiment & Positioning");
    expect(container.textContent).toContain("CFTC S&P 500 asset manager net");
    expect(container.textContent).toContain("CFTC S&P 500 leveraged money net");
    expect(container.textContent).toContain("cftc_sp500_asset_mgr_net");
    expect(container.textContent).toContain("cftc_sp500_lev_money_net");
  });
});
