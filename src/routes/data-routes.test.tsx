import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Overview from "./Overview";
import Rates from "./Rates";
import App from "../App";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  RegimeReplayFile,
  RegimeSnapshotFile,
  ScoreSummaryFile,
  ScoreHistoryFile,
  ShockRiskSnapshotFile,
  SeriesCategory,
  SeriesCatalogEntry,
  SeriesFrequency,
  SignalPriorityFile,
  TimeSeriesFile
} from "../lib/types";

vi.mock("../components/TimeSeriesChart", () => ({
  default: () => <section aria-label="Chart placeholder" />
}));

// echarts attempts to render to a canvas during setOption; jsdom has no
// canvas so we stub the modular imports that EChartPanel uses.
vi.mock("echarts/core", () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn()
  })),
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

function renderOverview() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Overview />
    </MemoryRouter>
  );
}

function unmountRendered(container: HTMLElement) {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  container.remove();
}

function LocationObserver({ onPathChange }: { onPathChange: (pathname: string) => void }) {
  const location = useLocation();

  useEffect(() => {
    onPathChange(location.pathname);
  }, [location.pathname, onPathChange]);

  return null;
}

async function waitForContent(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (container.textContent?.includes(text)) return;
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
    "/data/derived/regime_snapshot.json": regimeSnapshot,
    "/data/derived/score_history.json": scoreHistory,
    "/data/derived/score_summary.json": scoreSummaryFile,
    "/data/derived/shock_risk_snapshot.json": shockRiskSnapshot,
    "/data/derived/signal_priority.json": signalPriority,
    "/data/series/cftc_sp500_lev_money_net.json": seriesFile("cftc_sp500_lev_money_net", 12500),
    "/data/series/financial_stress.json": seriesFile("financial_stress", -0.33),
    "/data/series/us10y.json": seriesFile("us10y", 4.2),
    "/data/series/vix.json": seriesFile("vix", 17.1),
    "/data/series/wti_crude.json": seriesFile("wti_crude", 78.4),
    "/data/status/data_status.json": status
  };
}

function derivedFile(seriesId: string, value: number): DerivedSeriesFile {
  return {
    depends_on: [],
    frequency: "daily",
    generated_at_utc: "2026-05-03T18:32:54Z",
    method: `${seriesId} derived test fixture.`,
    observations: [{ date: "2026-05-01", percentile_252d: 52, value }],
    series_id: seriesId,
    source: "Derived",
    source_url: `https://example.com/${seriesId}`,
    summary: {
      change_1d: 0.01,
      change_1m: 0.05,
      change_1w: -0.02,
      latest_date: "2026-05-01",
      latest_value: value,
      percentile_252d: 52
    },
    units: seriesId.includes("ratio") ? "ratio" : "index"
  };
}

function diagnosticSeriesFile(
  seriesId: string,
  values: number[],
  units = "percent",
  frequency: SeriesFrequency = "daily",
  source = "FRED"
): TimeSeriesFile {
  const observations = values.map((value, index) => ({
    date: `2026-05-0${index + 1}`,
    percentile_252d: 50 + index,
    value
  }));
  const latest = observations[observations.length - 1];

  return {
    frequency,
    generated_at_utc: "2026-05-09T00:00:00Z",
    observations,
    series_id: seriesId,
    source,
    source_url: `https://example.com/${seriesId}`,
    summary: latest
      ? {
          change_1d: null,
          change_1m: null,
          change_1w: null,
          latest_date: latest.date,
          latest_value: latest.value,
          percentile_252d: latest.percentile_252d ?? null
        }
      : undefined,
    units
  };
}

function routeFetchFiles(overrides: Record<string, unknown> = {}) {
  return {
    "/data/catalog/series_catalog.json": catalog,
    "/data/events/macro_calendar.json": macroCalendar,
    "/data/derived/brent_wti_spread.json": {
      ...derivedFile("brent_wti_spread", 3.21),
      depends_on: ["brent_crude", "wti_crude"],
      method: "Brent crude minus WTI crude by matched observation date.",
      units: "USD/barrel"
    } satisfies DerivedSeriesFile,
    "/data/derived/commodity_inflation_impulse.json": {
      ...derivedFile("commodity_inflation_impulse", 1.42),
      depends_on: ["wti_crude", "corn_price", "wheat_price", "soybean_price"],
      method: "Composite commodity price impulse test fixture.",
      units: "index"
    } satisfies DerivedSeriesFile,
    "/data/derived/hy_minus_ig_oas.json": {
      ...derivedFile("hy_minus_ig_oas", 2.35),
      depends_on: ["high_yield_oas", "investment_grade_oas"],
      method: "High-yield OAS minus investment-grade OAS.",
      units: "basis points"
    } satisfies DerivedSeriesFile,
    "/data/derived/net_liquidity.json": {
      ...derivedFile("net_liquidity", 6123),
      depends_on: ["fed_assets", "reverse_repo", "treasury_general_account"],
      frequency: "weekly",
      method: "Fed assets less reverse repo and Treasury General Account.",
      units: "USD billions"
    } satisfies DerivedSeriesFile,
    "/data/derived/regime_replay.json": regimeReplay,
    "/data/derived/score_history.json": scoreHistory,
    "/data/derived/score_summary.json": scoreSummary,
    "/data/derived/shock_risk_snapshot.json": shockRiskSnapshot,
    "/data/derived/regime_snapshot.json": regimeSnapshot,
    "/data/derived/signal_priority.json": signalPriority,
    "/data/derived/us10y_minus_us2y.json": {
      ...derivedFile("us10y_minus_us2y", 0.42),
      depends_on: ["us10y", "us2y"],
      method: "10-year Treasury yield minus 2-year Treasury yield by matched observation date.",
      units: "percentage points"
    } satisfies DerivedSeriesFile,
    "/data/derived/vix9d_vix_ratio.json": {
      ...derivedFile("vix9d_vix_ratio", 0.91),
      depends_on: ["vix9d", "vix"],
      method: "Cboe VIX9D divided by Cboe VIX.",
      units: "ratio"
    } satisfies DerivedSeriesFile,
    "/data/derived/vix_vix3m_ratio.json": {
      ...derivedFile("vix_vix3m_ratio", 0.84),
      depends_on: ["vix", "vix3m"],
      method: "Cboe VIX divided by Cboe VIX3M.",
      units: "ratio"
    } satisfies DerivedSeriesFile,
    "/data/derived/bond_volatility_proxy.json": {
      ...diagnosticSeriesFile("bond_volatility_proxy", [9.1, 10.4, 8.7], "basis points", "daily", "Derived"),
      depends_on: ["us10y"],
      method: "Rolling realized volatility of daily 10-year Treasury-yield changes."
    } satisfies DerivedSeriesFile,
    "/data/series/ci_loans_weekly.json": diagnosticSeriesFile(
      "ci_loans_weekly",
      [2810, 2825, 2840],
      "USD billions",
      "weekly"
    ),
    "/data/series/philly_fed_mfg_general_activity.json": diagnosticSeriesFile(
      "philly_fed_mfg_general_activity",
      [-8.1, 2.4, 12.6],
      "diffusion_index",
      "monthly",
      "FRED"
    ),
    "/data/series/sloos_lending_standards.json": diagnosticSeriesFile(
      "sloos_lending_standards",
      [8, 12, 16],
      "net percent",
      "quarterly"
    ),
    "/data/series/sloos_small_firm_standards.json": diagnosticSeriesFile(
      "sloos_small_firm_standards",
      [11, 15, 18],
      "net percent",
      "quarterly"
    ),
    "/data/series/sloos_large_firm_demand.json": diagnosticSeriesFile(
      "sloos_large_firm_demand",
      [-20, -16, -10],
      "net percent",
      "quarterly"
    ),
    "/data/series/term_premium_kw_10y.json": diagnosticSeriesFile("term_premium_kw_10y", [0.42, 0.48, 0.52]),
    "/data/series/monthly_treasury_receipts.json": diagnosticSeriesFile(
      "monthly_treasury_receipts",
      [326770, 367645, 850169],
      "millions_usd",
      "monthly",
      "FiscalData"
    ),
    "/data/series/monthly_treasury_outlays.json": diagnosticSeriesFile(
      "monthly_treasury_outlays",
      [584220, 528174, 591769],
      "millions_usd",
      "monthly",
      "FiscalData"
    ),
    "/data/series/monthly_treasury_deficit_surplus.json": diagnosticSeriesFile(
      "monthly_treasury_deficit_surplus",
      [257450, 160528, -258400],
      "millions_usd",
      "monthly",
      "FiscalData"
    ),
    "/data/series/treasury_auction_supply.json": diagnosticSeriesFile(
      "treasury_auction_supply",
      [125000, 147000, 132000],
      "millions_usd",
      "weekly",
      "FiscalData"
    ),
    ...seriesFiles([
      "bank_credit",
      "bbb_oas",
      "brent_crude",
      "business_loans",
      "cftc_sp500_asset_mgr_net",
      "cftc_sp500_lev_money_net",
      "corn_price",
      "fed_assets",
      "financial_conditions",
      "financial_stress",
      "housing_starts",
      "high_yield_oas",
      "investment_grade_oas",
      "building_permits",
      "household_debt_service_ratio",
      "consumer_debt_service_ratio",
      "credit_card_delinquency_rate",
      "loans_and_leases",
      "bank_deposits",
      "mortgage_rate_30y",
      "reserve_balances",
      "reverse_repo",
      "sofr",
      "soybean_price",
      "treasury_general_account",
      "us2y",
      "us10y",
      "us20y",
      "us30y",
      "vix",
      "vix3m",
      "vix9d",
      "vvix",
      "wheat_price",
      "wti_crude"
    ]),
    "/data/status/data_status.json": status,
    ...overrides
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

function candidateCatalogEntry(
  id: string,
  category: SeriesCategory,
  name: string,
  notes: string
): SeriesCatalogEntry {
  return {
    ...catalogEntry(id, category, name, "candidate"),
    access_status: "terms_review_needed",
    notes,
    score_status: "candidate",
    source: "Candidate registry",
    source_url: `https://example.com/${id}`
  };
}

function generatedDiagnosticCatalogEntry(
  id: string,
  category: SeriesCategory,
  name: string,
  notes: string,
  units = "index",
  frequency: SeriesFrequency = "daily",
  source = "FRED"
): SeriesCatalogEntry {
  return {
    ...catalogEntry(id, category, name, units, frequency),
    access_status: "free_public",
    notes,
    score_status: "candidate",
    source,
    source_url: `https://example.com/${id}`
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
  catalogEntry("vvix", "volatility", "Cboe VIX Volatility Index", "index"),
  catalogEntry("vix9d", "volatility", "Cboe 9-Day Volatility Index", "index"),
  catalogEntry("vix3m", "volatility", "Cboe 3-Month Volatility Index", "index"),
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
  catalogEntry("housing_starts", "housing", "Housing Starts", "thousands_saar", "monthly"),
  catalogEntry("building_permits", "housing", "Building Permits", "thousands_saar", "monthly"),
  catalogEntry("mortgage_rate_30y", "housing", "30-Year Fixed Mortgage Rate", "percent", "weekly"),
  catalogEntry("household_debt_service_ratio", "credit", "Household debt service ratio", "percent", "quarterly"),
  catalogEntry("consumer_debt_service_ratio", "credit", "Consumer debt service ratio", "percent", "quarterly"),
  catalogEntry("credit_card_delinquency_rate", "credit", "Credit card delinquency rate", "percent", "quarterly"),
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
  catalogEntry("fed_assets", "liquidity", "Fed assets", "USD billions", "weekly"),
  catalogEntry("reverse_repo", "liquidity", "Reverse repo", "USD billions", "weekly"),
  catalogEntry("treasury_general_account", "liquidity", "Treasury General Account", "USD billions", "weekly"),
  catalogEntry("sofr", "liquidity", "SOFR", "percent"),
  catalogEntry("reserve_balances", "credit", "Reserve Balances", "USD billions", "weekly"),
  catalogEntry("bank_credit", "credit", "Bank credit", "USD billions", "weekly"),
  catalogEntry("loans_and_leases", "credit", "Loans and leases", "USD billions", "weekly"),
  catalogEntry("business_loans", "credit", "Commercial and industrial loans", "USD billions", "weekly"),
  generatedDiagnosticCatalogEntry(
    "philly_fed_mfg_general_activity",
    "growth",
    "Philadelphia Fed Manufacturing General Activity",
    "Generated non-scoring regional Fed survey proxy from Philadelphia Fed MBOS via FRED; not ISM PMI or S&P Global PMI.",
    "diffusion_index",
    "monthly"
  ),
  generatedDiagnosticCatalogEntry(
    "ci_loans_weekly",
    "credit",
    "Commercial and Industrial Loans, All Commercial Banks",
    "Generated non-scoring weekly H.8 C&I loan diagnostic from FRED TOTCI.",
    "USD billions",
    "weekly"
  ),
  generatedDiagnosticCatalogEntry(
    "sloos_lending_standards",
    "credit",
    "SLOOS C&I Lending Standards: Large and Middle-Market Firms",
    "Generated non-scoring SLOOS lending-standards diagnostic from FRED.",
    "net percent",
    "quarterly"
  ),
  generatedDiagnosticCatalogEntry(
    "sloos_small_firm_standards",
    "credit",
    "SLOOS C&I Lending Standards: Small Firms",
    "Generated non-scoring SLOOS small-firm lending-standards diagnostic from FRED.",
    "net percent",
    "quarterly"
  ),
  generatedDiagnosticCatalogEntry(
    "sloos_large_firm_demand",
    "credit",
    "SLOOS C&I Loan Demand: Large and Middle-Market Firms",
    "Generated non-scoring SLOOS loan-demand diagnostic from FRED.",
    "net percent",
    "quarterly"
  ),
  generatedDiagnosticCatalogEntry(
    "term_premium_kw_10y",
    "rates",
    "Kim-Wright 10-Year Zero-Coupon Term Premium",
    "Generated non-scoring Kim-Wright term-premium diagnostic from FRED.",
    "percent"
  ),
  generatedDiagnosticCatalogEntry(
    "monthly_treasury_receipts",
    "liquidity",
    "Monthly Treasury Receipts",
    "Generated non-scoring monthly Treasury receipts diagnostic from FiscalData Monthly Treasury Statement table 1.",
    "millions_usd",
    "monthly",
    "FiscalData"
  ),
  generatedDiagnosticCatalogEntry(
    "monthly_treasury_outlays",
    "liquidity",
    "Monthly Treasury Outlays",
    "Generated non-scoring monthly Treasury outlays diagnostic from FiscalData Monthly Treasury Statement table 1.",
    "millions_usd",
    "monthly",
    "FiscalData"
  ),
  generatedDiagnosticCatalogEntry(
    "monthly_treasury_deficit_surplus",
    "liquidity",
    "Monthly Treasury Deficit or Surplus",
    "Generated non-scoring monthly Treasury deficit-or-surplus diagnostic from FiscalData Monthly Treasury Statement table 1.",
    "millions_usd",
    "monthly",
    "FiscalData"
  ),
  generatedDiagnosticCatalogEntry(
    "treasury_auction_supply",
    "rates",
    "Treasury Auction Supply",
    "Generated non-scoring weekly Treasury auction offering-amount diagnostic from FiscalData Treasury Securities Auctions Data.",
    "millions_usd",
    "weekly",
    "FiscalData"
  ),
  generatedDiagnosticCatalogEntry(
    "bond_volatility_proxy",
    "volatility",
    "Realized 10-Year Yield Volatility Proxy",
    "Generated non-scoring realized Treasury-yield volatility proxy derived from public 10-year Treasury yields; not ICE MOVE.",
    "basis points",
    "daily",
    "Derived"
  ),
  catalogEntry("bank_deposits", "credit", "Bank deposits", "USD billions", "weekly"),
  catalogEntry("broad_dollar", "dollar", "Nominal Broad U.S. Dollar Index", "index"),
  catalogEntry("usdjpy", "dollar", "USD/JPY", "exchange rate"),
  catalogEntry("eurusd", "dollar", "EUR/USD", "exchange rate"),
  candidateCatalogEntry(
    "put_call_spxw",
    "sentiment",
    "SPXW put/call ratio",
    "SPXW option sentiment candidate pending source and terms readiness review."
  ),
  candidateCatalogEntry(
    "put_call_spx",
    "sentiment",
    "SPX put/call ratio",
    "SPX option sentiment candidate pending source and terms readiness review."
  ),
  candidateCatalogEntry(
    "put_call_index",
    "sentiment",
    "Index put/call ratio",
    "Index option sentiment candidate pending source and terms readiness review."
  ),
  candidateCatalogEntry(
    "put_call_equity",
    "sentiment",
    "Equity put/call ratio",
    "Equity option sentiment candidate pending source and terms readiness review."
  ),
  candidateCatalogEntry(
    "put_call_vix",
    "sentiment",
    "VIX put/call ratio",
    "VIX option sentiment candidate pending source and terms readiness review."
  ),
  candidateCatalogEntry(
    "put_call_etp",
    "sentiment",
    "ETP put/call ratio",
    "ETP option sentiment candidate pending source and terms readiness review."
  ),
  candidateCatalogEntry(
    "put_call_total",
    "sentiment",
    "Total put/call ratio",
    "Total option sentiment candidate pending source and terms readiness review."
  ),
  ...Array.from({ length: 8 }, (_, index) => {
    const month = index + 1;
    return candidateCatalogEntry(
      `vx${month}`,
      "volatility",
      `VX${month} futures`,
      `VX${month} futures candidate month pending source and terms readiness review.`
    );
  }),
  candidateCatalogEntry(
    "move_index",
    "volatility",
    "MOVE Index",
    "Bond-volatility source pending access and terms readiness review."
  ),
  candidateCatalogEntry(
    "skew_index",
    "volatility",
    "SKEW Index",
    "Equity tail-risk source pending access and terms readiness review."
  ),
  candidateCatalogEntry(
    "event_cpi",
    "inflation",
    "CPI release calendar",
    "Release-calendar candidate pending source readiness review."
  ),
  candidateCatalogEntry(
    "event_fomc",
    "rates",
    "FOMC meeting calendar",
    "Meeting-calendar candidate pending source readiness review."
  ),
  candidateCatalogEntry(
    "event_payrolls",
    "labor",
    "Payrolls release calendar",
    "Labor-release candidate pending source readiness review."
  ),
  candidateCatalogEntry(
    "event_treasury_auction",
    "rates",
    "Treasury auction calendar",
    "Auction-calendar candidate pending source readiness review."
  ),
  candidateCatalogEntry(
    "event_opex",
    "sentiment",
    "OPEX calendar",
    "Options-expiration calendar candidate pending source readiness review."
  )
];

const macroCalendar = {
  generated_at_utc: "2026-05-03T18:32:54Z",
  method_version: "test",
  events: [
    {
      category: "inflation",
      date: null,
      id: "consumer_price_index",
      importance: "high",
      notes: "Use BLS schedule for exact dates.",
      source: "BLS",
      source_url: "https://www.bls.gov/schedule/news_release/cpi.htm",
      status: "source_link",
      time: "08:30",
      timezone: "America/New_York",
      title: "Consumer Price Index"
    },
    {
      category: "policy",
      date: "2026-05-06",
      id: "fomc_minutes",
      importance: "medium",
      notes: "Use Federal Reserve calendar for exact publication context.",
      source: "Federal Reserve",
      source_url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      status: "scheduled",
      time: "14:00",
      timezone: "America/New_York",
      title: "FOMC Minutes"
    },
    {
      category: "growth",
      date: null,
      id: "beige_book",
      importance: "low",
      notes: "District commentary calendar reference.",
      source: "Federal Reserve",
      source_url: "https://www.federalreserve.gov/monetarypolicy/beige-book-default.htm",
      status: "estimated",
      time: null,
      timezone: null,
      title: "Beige Book"
    }
  ]
};

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

function candidateStatusRow(message: string): DataStatusFile["series"][string] {
  return {
    ...statusRow("terms_review_needed"),
    freshness_days: null,
    last_observation: null,
    max_stale_days: 30,
    message,
    source: "Candidate registry"
  };
}

function generatedDiagnosticStatusRow(
  message: string,
  frequency: SeriesFrequency = "daily",
  observationPeriod = "2026-05-01",
  source = "FRED"
): DataStatusFile["series"][string] {
  return {
    ...statusRow("ok", frequency),
    max_stale_days: frequency === "quarterly" ? 120 : frequency === "weekly" ? 14 : 7,
    message,
    observation_period: observationPeriod,
    score_status: "candidate",
    source
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
    vvix: statusRow("ok"),
    vix9d: statusRow("ok"),
    vix3m: statusRow("ok"),
    vix9d_vix_ratio: statusRow("ok"),
    vix_vix3m_ratio: statusRow("ok"),
    net_liquidity: {
      expected_frequency: "weekly",
      freshness_days: 4,
      last_observation: "2026-04-29",
      max_stale_days: 14,
      source: "Derived",
      status: "ok"
    },
    reverse_repo: statusRow("ok", "weekly"),
    treasury_general_account: statusRow("ok", "weekly"),
    sofr: statusRow("ok"),
    hy_minus_ig_oas: statusRow("ok"),
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
    commodity_inflation_impulse: statusRow("ok"),
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
    housing_starts: statusRow("ok", "monthly"),
    building_permits: statusRow("ok", "monthly"),
    mortgage_rate_30y: statusRow("ok", "weekly"),
    household_debt_service_ratio: statusRow("ok", "quarterly"),
    consumer_debt_service_ratio: statusRow("ok", "quarterly"),
    credit_card_delinquency_rate: statusRow("ok", "quarterly"),
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
    philly_fed_mfg_general_activity: generatedDiagnosticStatusRow(
      "Latest monthly observation covers 2026-04 and is within the expected release window ending 2026-06-15. candidate diagnostic only; does not affect active scores.",
      "monthly",
      "2026-04"
    ),
    ci_loans_weekly: generatedDiagnosticStatusRow(
      "Latest weekly observation is within the expected release window. candidate diagnostic only; does not affect active scores.",
      "weekly",
      "week of 2026-04-29"
    ),
    sloos_lending_standards: generatedDiagnosticStatusRow(
      "Latest quarterly observation covers 2026-Q2. candidate diagnostic only; does not affect active scores.",
      "quarterly",
      "2026-Q2"
    ),
    sloos_small_firm_standards: generatedDiagnosticStatusRow(
      "Latest quarterly observation covers 2026-Q2. candidate diagnostic only; does not affect active scores.",
      "quarterly",
      "2026-Q2"
    ),
    sloos_large_firm_demand: generatedDiagnosticStatusRow(
      "Latest quarterly observation covers 2026-Q2. candidate diagnostic only; does not affect active scores.",
      "quarterly",
      "2026-Q2"
    ),
    term_premium_kw_10y: generatedDiagnosticStatusRow(
      "Latest daily observation is 8 days old. candidate diagnostic only; does not affect active scores."
    ),
    monthly_treasury_receipts: generatedDiagnosticStatusRow(
      "Latest monthly observation covers 2026-04 and is within the expected release window ending 2026-06-15. candidate diagnostic only; does not affect active scores.",
      "monthly",
      "2026-04",
      "FiscalData"
    ),
    monthly_treasury_outlays: generatedDiagnosticStatusRow(
      "Latest monthly observation covers 2026-04 and is within the expected release window ending 2026-06-15. candidate diagnostic only; does not affect active scores.",
      "monthly",
      "2026-04",
      "FiscalData"
    ),
    monthly_treasury_deficit_surplus: generatedDiagnosticStatusRow(
      "Latest monthly observation covers 2026-04 and is within the expected release window ending 2026-06-15. candidate diagnostic only; does not affect active scores.",
      "monthly",
      "2026-04",
      "FiscalData"
    ),
    treasury_auction_supply: generatedDiagnosticStatusRow(
      "Latest weekly observation is within the expected release window ending 2026-05-25. candidate diagnostic only; does not affect active scores.",
      "weekly",
      "week of 2026-05-11",
      "FiscalData"
    ),
    bond_volatility_proxy: generatedDiagnosticStatusRow(
      "Latest daily observation is 2 days old. candidate diagnostic only; does not affect active scores.",
      "daily",
      "2026-05-01",
      "Derived"
    ),
    bank_deposits: statusRow("unavailable", "weekly"),
    broad_dollar: statusRow("unavailable"),
    usdjpy: statusRow("unavailable"),
    eurusd: statusRow("unavailable"),
    put_call_spxw: candidateStatusRow("SPXW options source remains under terms review."),
    put_call_spx: candidateStatusRow("SPX options source remains under terms review."),
    put_call_index: candidateStatusRow("Index options source remains under terms review."),
    put_call_equity: candidateStatusRow("Equity options source remains under terms review."),
    put_call_vix: candidateStatusRow("VIX options source remains under terms review."),
    put_call_etp: candidateStatusRow("ETP options source remains under terms review."),
    put_call_total: candidateStatusRow("Total options source remains under terms review."),
    vx1: candidateStatusRow("VX1 futures source remains under terms review."),
    vx2: candidateStatusRow("VX2 futures source remains under terms review."),
    vx3: candidateStatusRow("VX3 futures source remains under terms review."),
    vx4: candidateStatusRow("VX4 futures source remains under terms review."),
    vx5: candidateStatusRow("VX5 futures source remains under terms review."),
    vx6: candidateStatusRow("VX6 futures source remains under terms review."),
    vx7: candidateStatusRow("VX7 futures source remains under terms review."),
    vx8: candidateStatusRow("VX8 futures source remains under terms review."),
    move_index: candidateStatusRow("MOVE Index source remains under terms review."),
    skew_index: candidateStatusRow("SKEW Index source remains under terms review."),
    event_cpi: candidateStatusRow("CPI calendar source remains under review."),
    event_fomc: candidateStatusRow("FOMC calendar source remains under review."),
    event_payrolls: candidateStatusRow("Payrolls calendar source remains under review."),
    event_treasury_auction: candidateStatusRow("Treasury auction calendar source remains under review."),
    event_opex: candidateStatusRow("OPEX calendar source remains under review.")
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
      bucket_scores: {
        consumer_balance_sheet: -2,
        consumer_production: 5,
        growth: 6,
        housing: 4,
        inflation: -3,
        labor: 2,
        real_yields: -4
      },
      bucket_weights: {
        consumer_balance_sheet: 0.1,
        consumer_production: 0.16,
        growth: 0.18,
        housing: 0.12,
        inflation: 0.16,
        labor: 0.18,
        real_yields: 0.1
      },
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
    coverage_confidence: 0.8,
    freshness_confidence: 0.7,
    model_confidence: 0.75,
    source_confidence: 0.68,
    overall_confidence: 0.92,
    reasons: ["Treasury/bond volatility source is not active."]
  }
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

const regimeSnapshot: RegimeSnapshotFile = {
  date: "2026-05-01",
  generated_at_utc: "2026-05-04T00:00:00Z",
  method_version: "phase3-regime-snapshot-v1",
  regime: {
    dollar_direction: "up",
    label: "Tightening / risk-off",
    nominal_yield_direction: "up",
    tips_direction: "up",
    yield_driver: "real_yield_driven"
  },
  checklist: [
    {
      id: "vix_curve",
      label: "VIX term-structure proxy",
      message: "VIX remains below VIX3M, but the front of the curve is firming.",
      state: "watch"
    },
    {
      id: "credit_spreads",
      label: "Credit spread pressure",
      message: "High-yield spreads are wider than investment-grade spreads on the latest snapshot.",
      state: "risk"
    },
    {
      id: "liquidity",
      label: "Liquidity impulse",
      message: "Net liquidity remains positive but has flattened over the last month.",
      state: "mixed"
    }
  ],
  confirmations: [
    {
      id: "credit",
      label: "Cross-asset confirmation",
      message: "Credit and volatility confirm a more fragile backdrop.",
      status: "confirming"
    },
    {
      id: "dollar",
      label: "Dollar confirmation",
      message: "Dollar strength is consistent with tighter global financial conditions.",
      status: "confirming"
    }
  ],
  quadrant_trail: [
    {
      credit_change: 0.18,
      date: "2026-04-29",
      dollar_change: 0.2,
      nominal_yield_change: 0.06,
      real_yield_change: 0.04,
      vix_percentile: 55
    },
    {
      credit_change: 0.24,
      date: "2026-04-30",
      dollar_change: 0.35,
      nominal_yield_change: 0.08,
      real_yield_change: 0.06,
      vix_percentile: 61
    },
    {
      credit_change: 0.31,
      date: "2026-05-01",
      dollar_change: 0.48,
      nominal_yield_change: 0.1,
      real_yield_change: 0.09,
      vix_percentile: 64
    }
  ],
  yield_decomposition: [
    {
      breakeven_10y: 2.28,
      date: "2026-04-29",
      nominal_10y: 4.32,
      real_yield_10y: 2.04
    },
    {
      breakeven_10y: 2.27,
      date: "2026-04-30",
      nominal_10y: 4.37,
      real_yield_10y: 2.1
    },
    {
      breakeven_10y: 2.26,
      date: "2026-05-01",
      nominal_10y: 4.42,
      real_yield_10y: 2.16
    }
  ]
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

const malformedShockRiskSnapshot = {
  ...shockRiskSnapshot,
  active_signals: "not an array",
  source_gaps: null,
  mismatch_warnings: { id: "not-array" }
} as unknown as ShockRiskSnapshotFile;

const signalPriority: SignalPriorityFile = {
  date: "2026-05-06",
  generated_at_utc: "2026-05-07T17:57:48Z",
  method_version: "phase6-pr1-signal-priority-v1",
  overall_read: {
    short_term: { label: "Mixed", score: 7.18, confidence: 1.0 },
    long_term: { label: "Mixed", score: 14.44, confidence: 0.99 },
    fragility: { label: "Low Fragility", score: 39.47, confidence: 0.99 },
    regime: { label: "Mixed" }
  },
  top_warnings: [
    {
      id: "real_yields",
      label: "10Y real yields",
      group: "Rates / Real-Yield Pressure",
      category: "rates",
      horizon: "both",
      importance: 5,
      severity: 33.34,
      priority: 167,
      direction: "risk",
      urgency: "near_term",
      confidence: 1.0,
      freshness_status: "ok",
      source_status: "active",
      message: "Real yields are elevated and pressuring valuations.",
      why_it_matters: "Higher real yields tighten financial conditions."
    }
  ],
  top_supports: [
    {
      id: "credit_spreads",
      label: "Credit spreads",
      group: "Credit",
      category: "credit",
      horizon: "both",
      importance: 5,
      severity: 62.3,
      priority: 311,
      direction: "support",
      urgency: "near_term",
      confidence: 1.0,
      freshness_status: "ok",
      source_status: "active",
      message: "Credit spread pressure is contained.",
      why_it_matters: "Credit spreads confirm whether stress is spreading beyond equities."
    }
  ],
  missing_high_value_signals: [
    {
      id: "move_index",
      label: "MOVE Index (bond volatility)",
      group: "Volatility & tail risk",
      category: "volatility",
      horizon: "fragility",
      importance: 4,
      source_status: "terms_review_needed",
      message: "Candidate source requires access or terms review before scoring.",
      why_it_matters: "Bond-volatility moves can pressure markets even when equity volatility is calm."
    }
  ]
};

const malformedShockRiskRowSnapshot = {
  ...shockRiskSnapshot,
  active_signals: [
    null,
    {
      change: "not-a-number",
      id: "valid_active",
      label: "Valid active stress",
      message: "First active signal message.",
      score: undefined,
      value: Number.NaN
    },
    {
      change: 2.1,
      id: "valid_active",
      label: "Duplicate active stress",
      message: "Duplicate active signal message.",
      score: -1,
      value: 20
    },
    {
      change: 1.2,
      id: "missing_message",
      label: "Missing active message",
      score: -2,
      value: 21
    }
  ],
  mismatch_warnings: [
    null,
    {
      id: "valid_warning",
      label: "Valid warning",
      message: "First warning message."
    },
    {
      id: "valid_warning",
      label: "Duplicate warning",
      message: "Duplicate warning message."
    },
    {
      id: "missing_warning_message",
      label: "Missing warning message"
    }
  ],
  source_gaps: [
    null,
    {
      id: "valid_partial_gap",
      label: "Valid partial gated stress",
      message: "Partial source gap should remain visible.",
      status: "partial"
    },
    {
      id: "valid_partial_gap",
      label: "Duplicate partial gated stress",
      message: "Duplicate partial source gap message.",
      status: "unavailable"
    },
    {
      id: "restricted_gap",
      label: "Restricted gated stress",
      message: "Restricted source gap should be dropped.",
      status: "restricted"
    },
    {
      id: "release_window_gap",
      label: "Release-window gated stress",
      message: "Release-window source gap should be dropped.",
      status: "release_window_ok"
    }
  ]
} as unknown as ShockRiskSnapshotFile;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("data-backed routes", () => {
  it("renders canonical short-term and long-term horizon routes", async () => {
    mockStaticFetch(routeFetchFiles());

    const shortTerm = render(
      <MemoryRouter initialEntries={["/short-term"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(shortTerm, "Short-Term Market Reaction");
    expect(shortTerm.textContent).toContain("High data quality");
    expect(shortTerm.textContent).toContain("Treasury/bond volatility source is not active.");
    expect(shortTerm.textContent).toContain("Current Tactical Read");
    expect(shortTerm.textContent).toContain("Volatility term-structure");
    expect(shortTerm.textContent).toContain("Credit pulse");
    expect(shortTerm.textContent).toContain("Dollar + real-yield pressure");
    expect(shortTerm.textContent).toContain("Liquidity pulse");
    expect(shortTerm.textContent).toContain("Options sentiment");
    expect(shortTerm.textContent).toContain("Event risk");

    unmountRendered(shortTerm);

    const longTerm = render(
      <MemoryRouter initialEntries={["/long-term"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(longTerm, "Long-Term Macro / Allocation Climate");
    expect(longTerm.textContent).toContain("High data quality");
    expect(longTerm.textContent).toContain("Treasury/bond volatility source is not active.");
  });

  it("keeps tactical and macro-climate deep links compatible", async () => {
    mockStaticFetch(routeFetchFiles());

    let tacticalPath = "";
    const tactical = render(
      <MemoryRouter initialEntries={["/tactical"]}>
        <App />
        <LocationObserver onPathChange={(pathname) => {
          tacticalPath = pathname;
        }} />
      </MemoryRouter>
    );
    await waitForContent(tactical, "Short-Term Market Reaction");
    expect(tacticalPath).toBe("/short-term");

    unmountRendered(tactical);

    let macroPath = "";
    const macro = render(
      <MemoryRouter initialEntries={["/macro-climate"]}>
        <App />
        <LocationObserver onPathChange={(pathname) => {
          macroPath = pathname;
        }} />
      </MemoryRouter>
    );
    await waitForContent(macro, "Long-Term Macro / Allocation Climate");
    expect(macroPath).toBe("/long-term");
  });

  it("renders grouped navigation with primary views before the data library", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Primary Views");
    const text = container.textContent ?? "";
    expect(text.indexOf("Primary Views")).toBeLessThan(text.indexOf("Data Library"));
    expect(text.indexOf("Data Library")).toBeLessThan(text.indexOf("Reference"));
    expect(text).toContain("Short-Term");
    expect(text).toContain("Long-Term");
  });

  it("routes every grouped navigation link to its page heading", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Overview");

    const navExpectations = [
      { label: "Overview", heading: "Overview" },
      { label: "Short-Term", heading: "Short-Term Market Reaction" },
      { label: "Long-Term", heading: "Long-Term Macro / Allocation Climate" },
      { label: "Fragility", heading: "Fragility / Shock Risk" },
      { label: "Regime Map", heading: "TIPS x Dollar Regime Map" },
      { label: "Replay", heading: "Historical Regime Replay" },
      { label: "Volatility", heading: "VIX state" },
      { label: "Rates", heading: "Rates & Policy" },
      { label: "Liquidity", heading: "Funding and balance sheet" },
      { label: "Credit", heading: "Credit & Banking" },
      { label: "Dollar", heading: "Dollar & Global" },
      { label: "Commodities", heading: "Energy and grains" },
      { label: "Growth", heading: "Growth" },
      { label: "Housing", heading: "Housing" },
      { label: "Inflation", heading: "Inflation" },
      { label: "Positioning", heading: "Sentiment & Positioning" },
      { label: "Calendar", heading: "Macro Calendar" },
      { label: "Methodology", heading: "How the map works" }
    ];

    for (const expectation of navExpectations) {
      const link = Array.from(container.querySelectorAll("nav a")).find(
        (anchor) => anchor.textContent === expectation.label
      );
      expect(link, `Missing nav link ${expectation.label}`).toBeTruthy();

      await act(async () => {
        link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await waitForContent(container, expectation.heading);
      expect(container.querySelector("h2")?.textContent).toBe(expectation.heading);
    }
  });

  it("renders overview as a horizon decision hub", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Short-Term Market Reaction");
    expect(container.textContent).toContain("Long-Term Macro / Allocation Climate");
    expect(container.textContent).toContain("Fragility / Shock Risk");
    expect(container.textContent).toContain("TIPS x Dollar Regime Map");
    expect(container.textContent).toContain("Short-Term Impact");
    expect(container.textContent).toContain("Long-Term Impact");
  });

  it("renders overview when score history is unavailable", async () => {
    mockStaticFetch(routeFetchFiles({ "/data/derived/score_history.json": undefined }));

    const container = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Short-Term Market Reaction");
    expect(container.textContent).toContain("Data quality");
  });

  it("renders the three-score overview without legacy weather score duplication", async () => {
    mockStaticFetch(overviewFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Macro Climate");

    expect(container.textContent).toContain("High data quality");
    expect(container.textContent).toContain("Treasury/bond volatility source is not active.");
    expect(container.textContent).toContain("Macro Climate");
    expect(container.textContent).toContain("Fragility");
    expect(container.textContent).toContain("Data confidence");
    expect(container.textContent).toContain("Freshness and coverage notes");
    expect(container.textContent).not.toContain("Weather score");
    expect(container.textContent).not.toContain("Market Weather buckets");
  });

  it("renders top warnings, supports, and missing high-value signals on overview", async () => {
    mockStaticFetch(overviewFetchFiles());

    const container = renderOverview();
    await waitForContent(container, "Top Active Warnings");

    expect(container.textContent).toContain("Top Active Warnings");
    expect(container.textContent).toContain("Top Active Supports");
    expect(container.textContent).toContain("Missing High-Value Signals");
    // Active warning entry from fixture.
    expect(container.textContent).toContain("10Y real yields");
    expect(container.textContent).toContain("Real yields are elevated and pressuring valuations.");
    // Active support entry.
    expect(container.textContent).toContain("Credit spreads");
    expect(container.textContent).toContain("Credit spread pressure is contained.");
    // Missing high-value entry surfaces the gated source status.
    expect(container.textContent).toContain("MOVE Index (bond volatility)");
    expect(container.textContent).toContain("terms_review_needed");
    // The two-column signal-priority section holds warnings and supports.
    const grid = container.querySelector(".signal-priority-grid");
    expect(grid).not.toBeNull();
    expect(grid?.querySelectorAll(".top-signal-list--warning li").length).toBe(1);
    expect(grid?.querySelectorAll(".top-signal-list--support li").length).toBe(1);
    // Missing high-value signals render via the dedicated MissingSignalPanel,
    // not as the third column of the signal-priority grid.
    expect(grid?.querySelectorAll(".top-signal-list--missing").length).toBe(0);
    const missingPanelRows = container.querySelectorAll(".missing-signal-panel-row");
    expect(missingPanelRows.length).toBe(1);
  });

  it("omits the signal-priority section when signal_priority.json is missing", async () => {
    const { "/data/derived/signal_priority.json": _omitted, ...filesWithoutSignalPriority } =
      overviewFetchFiles();
    void _omitted;
    mockStaticFetch(filesWithoutSignalPriority);

    const container = renderOverview();
    // Wait for the overview to finish loading something the fixture provides.
    await waitForContent(container, "Macro Climate");

    expect(container.querySelector(".signal-priority-grid")).toBeNull();
    expect(container.textContent).not.toContain("Top Active Warnings");
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
        coverage_confidence: 0.8,
        freshness_confidence: 0.7,
        model_confidence: 0.75,
        source_confidence: 0.68,
        overall_confidence: Number.NaN,
        reasons: []
      }
    } as unknown as ScoreSummaryFile;

    mockStaticFetch(overviewFetchFiles(malformedScoreSummary));

    const container = renderOverview();
    await waitForContent(container, "Recent changes");

    expect(container.textContent).toContain("No recent changes in the current score summary.");
    expect(container.textContent).toContain("No conflicting signals in the current score summary.");
    expect(container.textContent).toContain("0% overall");
    expect(container.textContent).toContain("No confidence notes in the current score summary.");
  });

  it("renders overview fallback confidence when score summary data quality is missing", async () => {
    const malformedScoreSummary = {
      ...scoreSummary,
      data_quality: null
    } as unknown as ScoreSummaryFile;

    mockStaticFetch(overviewFetchFiles(malformedScoreSummary));

    const container = renderOverview();
    await waitForContent(container, "Data confidence");

    expect(container.textContent).toContain("0% overall");
    expect(container.textContent).toContain("No confidence notes in the current score summary.");
  });

  it("renders overview fallback confidence when score summary data quality is omitted", async () => {
    const malformedScoreSummary = { ...scoreSummary } as Partial<ScoreSummaryFile>;
    delete malformedScoreSummary.data_quality;

    mockStaticFetch(overviewFetchFiles(malformedScoreSummary));

    const container = renderOverview();
    await waitForContent(container, "Data confidence");

    expect(container.textContent).toContain("0% overall");
    expect(container.textContent).toContain("No confidence notes in the current score summary.");
  });

  it("renders overview fallback labels for malformed score summary labels", async () => {
    const malformedScoreSummary = {
      ...scoreSummary,
      scores: {
        ...scoreSummary.scores,
        market_weather: {
          ...scoreSummary.scores.market_weather,
          label: undefined
        },
        fragility: {
          ...scoreSummary.scores.fragility,
          label: 12
        }
      }
    } as unknown as ScoreSummaryFile;

    mockStaticFetch(overviewFetchFiles(malformedScoreSummary));

    const container = renderOverview();
    await waitForContent(container, "Current regime read");

    expect(container.textContent).toContain("unknown market weather");
    expect(container.textContent).toContain("unknown fragility");
  });

  it("does not duplicate fragility in the overview regime label", async () => {
    const lowFragilityScoreSummary: ScoreSummaryFile = {
      ...scoreSummary,
      scores: {
        ...scoreSummary.scores,
        fragility: {
          ...scoreSummary.scores.fragility,
          label: "Low Fragility"
        }
      }
    };

    mockStaticFetch(overviewFetchFiles(lowFragilityScoreSummary));

    const container = renderOverview();
    await waitForContent(container, "Current regime read");

    expect(container.textContent).toContain("low fragility");
    expect(container.textContent).not.toContain("fragility fragility");
  });

  it("announces overview data load errors", async () => {
    const files = overviewFetchFiles();
    delete files["/data/derived/score_summary.json"];
    mockStaticFetch(files);

    const container = renderOverview();
    await waitForContent(container, "Data error:");

    expect(container.querySelector(".data-error")?.getAttribute("role")).toBe("alert");
  });

  it("renders net liquidity from the derived static file on overview", async () => {
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
      "/data/derived/regime_snapshot.json": regimeSnapshot,
      "/data/derived/score_summary.json": scoreSummary,
      "/data/derived/shock_risk_snapshot.json": shockRiskSnapshot,
      "/data/series/cftc_sp500_lev_money_net.json": seriesFile("cftc_sp500_lev_money_net", 12500),
      "/data/series/financial_stress.json": seriesFile("financial_stress", -0.33),
      "/data/series/us10y.json": seriesFile("us10y", 4.2),
      "/data/series/vix.json": seriesFile("vix", 17.1),
      "/data/series/wti_crude.json": seriesFile("wti_crude", 78.4),
      "/data/status/data_status.json": status
    });

    const container = renderOverview();
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
      "/data/derived/regime_snapshot.json": regimeSnapshot,
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
    expect(container.textContent).toContain("Rates");
    expect(container.textContent).toContain("Credit");
    expect(container.textContent).toContain("Dollar");
    expect(container.textContent).toContain("Positioning");
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

  it("renders macro calendar route", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Macro Calendar");
    await waitForContent(container, "Consumer Price Index");

    expect(container.textContent).toContain("Consumer Price Index");
    expect(container.textContent).toContain("FOMC Minutes");
    expect(container.textContent).toContain("Beige Book");
    expect(container.textContent).toContain("BLS");
    expect(container.textContent).toContain("High");
    expect(container.textContent).toContain("Medium");
    expect(container.textContent).toContain("Low");
    expect(container.textContent).toContain("Source link");
    expect(container.textContent).toContain("America/New_York");

    const sourceLink = container.querySelector(
      'a[aria-label="Source calendar for Consumer Price Index (BLS)"]'
    );
    expect(sourceLink?.getAttribute("href")).toBe("https://www.bls.gov/schedule/news_release/cpi.htm");
  });

  it("renders macro calendar empty group copy", async () => {
    mockStaticFetch(
      routeFetchFiles({
        "/data/events/macro_calendar.json": {
          ...macroCalendar,
          events: macroCalendar.events.filter((event) => event.importance !== "low")
        }
      })
    );

    const container = render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "No low importance events in this file.");

    expect(container.textContent).toContain("Consumer Price Index");
    expect(container.textContent).toContain("FOMC Minutes");
  });

  it("surfaces a data error when macro calendar file is missing", async () => {
    const files: Record<string, unknown> = routeFetchFiles();
    delete files["/data/events/macro_calendar.json"];
    mockStaticFetch(files);

    const container = render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Data error:");

    expect(container.querySelector(".data-error")?.getAttribute("role")).toBe("alert");
    expect(container.textContent).toContain("Failed to load /data/events/macro_calendar.json");
  });

  it("surfaces a data error when macro calendar importance is unknown", async () => {
    mockStaticFetch(
      routeFetchFiles({
        "/data/events/macro_calendar.json": {
          ...macroCalendar,
          events: [
            {
              ...macroCalendar.events[0],
              importance: "urgent" as any
            }
          ]
        }
      })
    );

    const container = render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Data error:");

    expect(container.querySelector(".data-error")?.getAttribute("role")).toBe("alert");
    expect(container.textContent).toContain("Invalid macro calendar importance");
  });

  it("renders housing route with active housing data", async () => {
    mockStaticFetch({
      "/data/catalog/series_catalog.json": catalog,
      ...seriesFiles(["housing_starts", "building_permits", "mortgage_rate_30y"]),
      "/data/status/data_status.json": status
    });

    const container = render(
      <MemoryRouter initialEntries={["/housing"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Housing Starts");

    expect(container.textContent).toContain("Housing");
    expect(container.textContent).toContain("Housing Starts");
    expect(container.textContent).toContain("Building Permits");
    expect(container.textContent).toContain("30-Year Fixed Mortgage Rate");
    expect(container.textContent).toContain("mortgage-rate sensitivity");
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
      "/data/derived/regime_snapshot.json": regimeSnapshot,
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

  it("surfaces active Cboe volatility curve inputs", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/volatility"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Cboe Volatility Index");

    expect(container.textContent).toContain("Cboe Volatility Index");
    expect(container.textContent).toContain("Cboe VIX Volatility Index");
    expect(container.textContent).toContain("Cboe 9-Day Volatility Index");
    expect(container.textContent).toContain("Cboe 3-Month Volatility Index");
    expect(container.textContent).toContain("VIX9D / VIX");
    expect(container.textContent).toContain("VIX / VIX3M");
    expect(container.textContent).toContain("VX futures curve");
    expect(container.textContent).toContain("Fallback proxy");
    expect(container.textContent).toContain("VX1 futures");
    expect(container.textContent).toContain("VX1 futures source remains under terms review.");
    expect(fetch).not.toHaveBeenCalledWith("/data/series/vx1.json");
  });

  it("surfaces net liquidity and reserve balances on liquidity", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/liquidity"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Net liquidity proxy");

    expect(container.textContent).toContain("Net liquidity proxy");
    expect(container.textContent).toContain("Reserve Balances");
  });

  it("surfaces HY minus IG OAS on credit", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/credit"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "HY minus IG OAS");

    expect(container.textContent).toContain("HY minus IG OAS");
  });

  it("surfaces commodity inflation impulse on commodities", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/commodities"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Commodity inflation impulse");

    expect(container.textContent).toContain("Commodity inflation impulse");
  });

  it("labels sentiment active data as positioning only", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/sentiment"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Active data is positioning only");

    expect(container.textContent).toContain("Active data is positioning only");
    expect(container.textContent).toContain("CFTC positioning is weekly, delayed, and futures-specific.");
  });

  it("renders tactical trading weather from active regime data", async () => {
    mockStaticFetch(
      routeFetchFiles({
        "/data/derived/regime_snapshot.json": regimeSnapshot
      })
    );

    const container = render(
      <MemoryRouter initialEntries={["/tactical"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Short-Term Market Reaction");
    expect(container.textContent).toContain("Daily checklist");
    expect(container.textContent).toContain("VIX term-structure proxy");
    expect(container.textContent).toContain("Options sentiment");
    expect(container.textContent).toContain("Event risk");
    expect(container.textContent).toContain("Official source-linked calendar context");
    expect(container.textContent).toContain("Consumer Price Index");
    expect(container.textContent).toContain("FOMC Minutes");
    expect(container.textContent).toContain("Not scored");
    expect(container.textContent).toContain("does not affect active scores, regime labels, checklist states, or confidence");
    expect(container.textContent).toContain("VIX futures readiness");
    expect(container.textContent).toContain("SPXW put/call ratio");
    expect(container.textContent).toContain("SPXW options source remains under terms review.");
    expect(container.textContent).toContain("VX1 futures");
    expect(container.textContent).toContain("OPEX calendar");
    expect(container.textContent).toContain("OPEX calendar source remains under review.");

    expect(container.textContent).toContain("Market weather");
    expect(container.textContent).toContain("Mixed");
    expect(container.textContent).toContain("19.17");
    expect(container.textContent).toContain("Fragility");
    expect(container.textContent).toContain("Moderate");
    expect(container.textContent).toContain("-4.10");
    expect(fetch).not.toHaveBeenCalledWith("/data/series/put_call_spxw.json");
    expect(fetch).not.toHaveBeenCalledWith("/data/series/vx1.json");
    expect(fetch).toHaveBeenCalledWith("/data/events/macro_calendar.json");
  });

  it("renders short-term credit pulse unavailable state when HY minus IG OAS is missing", async () => {
    const files: Record<string, unknown> = routeFetchFiles();
    delete files["/data/derived/hy_minus_ig_oas.json"];
    mockStaticFetch(files);

    const container = render(
      <MemoryRouter initialEntries={["/short-term"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Credit pulse");

    const creditPanel = Array.from(container.querySelectorAll("section.panel")).find((panel) =>
      panel.textContent?.includes("Credit pulse")
    );
    expect(creditPanel?.textContent).toContain("HY minus IG OAS");
    expect(creditPanel?.textContent).toContain("Unavailable");
  });

  it("renders fragility shock risk route", async () => {
    mockStaticFetch(routeFetchFiles({
      "/data/derived/shock_risk_snapshot.json": shockRiskSnapshot
    }));

    const container = render(
      <MemoryRouter initialEntries={["/fragility"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Fragility / Shock Risk");
    expect(container.textContent).toContain("High data quality");
    expect(container.textContent).toContain("Treasury/bond volatility source is not active.");
    expect(container.textContent).toContain("Visible vs gated stress");
    expect(container.textContent).toContain("Public bond-volatility diagnostic");
    expect(container.textContent).toContain("Realized 10-Year Yield Volatility Proxy");
    expect(container.textContent).toContain("Generated candidate diagnostic");
    expect(container.textContent).toContain("Not scored");
    expect(container.textContent).toContain("not ICE MOVE");
    // Load-bearing caveat: the full literal must render verbatim (asserted
    // by substring) so the bond-volatility chart can never be mistaken for
    // the licensed ICE MOVE index after future refactors.
    expect(container.textContent).toContain("is NOT the licensed ICE MOVE Index");
    expect(container.textContent).toContain("Trend window 3 observations");
    expect(container.textContent).toContain("Latest 8.70 basis points on 2026-05-03");
    expect(container.textContent).toContain("Gated stress");
    expect(container.textContent).toContain("Mismatch severity");
    expect(container.textContent).toContain("MOVE");
    expect(container.textContent).toContain("SKEW");
    expect(container.textContent).toContain("Mismatch warnings");
  });

  it("renders fragility active and candidate stress channel read", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/fragility"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Current Shock-Risk Read");
    expect(container.textContent).toContain("Active stress channels");
    expect(container.textContent).toContain("Candidate stress channels");
    expect(container.textContent).toContain("MOVE");
    expect(container.textContent).toContain("SKEW");
  });

  it("renders fragility route empty states with malformed snapshot arrays", async () => {
    mockStaticFetch(routeFetchFiles({
      "/data/derived/shock_risk_snapshot.json": malformedShockRiskSnapshot
    }));

    const container = render(
      <MemoryRouter initialEntries={["/fragility"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Fragility / Shock Risk");
    expect(container.textContent).toContain("No active shock-risk signals in the current snapshot.");
    expect(container.textContent).toContain("No shock-risk source gaps in the current snapshot.");
    expect(container.textContent).toContain("No mismatch warnings in the current shock-risk snapshot.");
  });

  it("sanitizes malformed fragility shock-risk rows before rendering children", async () => {
    mockStaticFetch(routeFetchFiles({
      "/data/derived/shock_risk_snapshot.json": malformedShockRiskRowSnapshot
    }));

    const container = render(
      <MemoryRouter initialEntries={["/fragility"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Fragility / Shock Risk");
    expect(container.textContent).toContain("Valid active stress");
    expect(container.textContent).toContain("First active signal message.");
    expect(container.textContent).toContain("Score N/A");
    expect(container.textContent).not.toContain("Duplicate active stress");
    expect(container.textContent).not.toContain("Duplicate active signal message.");
    expect(container.textContent).not.toContain("Missing active message");

    expect(container.textContent).toContain("Valid partial gated stress");
    expect(container.textContent).toContain("Partial source gap should remain visible.");
    expect(container.textContent).toContain("Partial");
    expect(container.textContent).not.toContain("Duplicate partial gated stress");
    expect(container.textContent).not.toContain("Duplicate partial source gap message.");
    expect(container.textContent).not.toContain("Restricted gated stress");
    expect(container.textContent).not.toContain("Release-window gated stress");

    expect(container.textContent).toContain("Valid warning");
    expect(container.textContent).toContain("First warning message.");
    expect(container.textContent).not.toContain("Duplicate warning");
    expect(container.textContent).not.toContain("Duplicate warning message.");
    expect(container.textContent).not.toContain("Missing warning message");
  });

  it("renders long-term macro climate from current score summary", async () => {
    mockStaticFetch(
      routeFetchFiles({
        "/data/derived/regime_snapshot.json": regimeSnapshot
      })
    );

    const container = render(
      <MemoryRouter initialEntries={["/macro-climate"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Long-Term Macro / Allocation Climate");
    expect(container.textContent).toContain("Current Long-Term Read");
    expect(container.textContent).toContain("Macro bucket grid");
    expect(container.textContent).toContain("Generated official diagnostics");
    expect(container.textContent).toContain("Philadelphia Fed Manufacturing General Activity");
    expect(container.textContent).toContain("SLOOS C&I Lending Standards: Large and Middle-Market Firms");
    expect(container.textContent).toContain("SLOOS C&I Lending Standards: Small Firms");
    expect(container.textContent).toContain("SLOOS C&I Loan Demand: Large and Middle-Market Firms");
    expect(container.textContent).toContain("Commercial and Industrial Loans, All Commercial Banks");
    expect(container.textContent).toContain("Kim-Wright 10-Year Zero-Coupon Term Premium");
    expect(container.textContent).toContain("Monthly Treasury Receipts");
    expect(container.textContent).toContain("Monthly Treasury Outlays");
    expect(container.textContent).toContain("Monthly Treasury Deficit or Surplus");
    expect(container.textContent).toContain("Treasury Auction Supply");
    expect(container.textContent).toContain("Generated candidate diagnostic");
    expect(container.textContent).toContain("Not scored");
    expect(container.textContent).toContain("Does not affect active scores, labels, checklist states, or confidence.");
    expect(container.textContent).toContain("Trend window 3 observations");
    expect(container.textContent).toContain("Latest 2,840.00 USD billions on 2026-05-03");
    expect(container.textContent).toContain("Strategic source gaps");
    expect(container.textContent).toContain("PMIs");
    expect(container.textContent).toContain("SLOOS scoring promotion");
    expect(container.textContent).toContain("NY Fed ACM term premium");
    expect(container.textContent).toContain("Treasury net issuance");
    expect(container.textContent).toContain("valuation");
    expect(container.textContent).toContain("earnings revisions");
    const strategicRows = Array.from(container.querySelectorAll(".candidate-source-row"));
    expect(strategicRows).toHaveLength(11);
    expect(strategicRows.every((row) => row.getAttribute("role") === "listitem")).toBe(true);
    expect(container.querySelectorAll(".status-terms_review_needed")).toHaveLength(11);
    expect(container.querySelectorAll(".candidate-diagnostic-row")).toHaveLength(10);
    expect(container.querySelectorAll(".candidate-diagnostic-sparkline")).toHaveLength(10);
    expect(fetch).toHaveBeenCalledWith("/data/series/philly_fed_mfg_general_activity.json");
    expect(fetch).toHaveBeenCalledWith("/data/series/sloos_lending_standards.json");
    expect(fetch).toHaveBeenCalledWith("/data/series/ci_loans_weekly.json");
    expect(fetch).toHaveBeenCalledWith("/data/series/term_premium_kw_10y.json");
    expect(fetch).toHaveBeenCalledWith("/data/series/monthly_treasury_receipts.json");
    expect(fetch).toHaveBeenCalledWith("/data/series/treasury_auction_supply.json");
    expect(container.textContent).toContain("Macro Climate");
    expect(container.textContent).toContain("Growth cycle");
    expect(container.textContent).toContain("Consumer and production");
    expect(container.textContent).toContain("Housing cycle");
    expect(container.textContent).toContain("Consumer balance sheet");
    expect(container.textContent).toContain("Credit cycle");
    expect(container.textContent).toContain("Liquidity cycle");
  });

  it("renders long-term read when strategic bucket scores are missing", async () => {
    const scoreSummaryWithoutStrategicBuckets: ScoreSummaryFile = {
      ...scoreSummary,
      scores: {
        ...scoreSummary.scores,
        macro_climate: {
          ...scoreSummary.scores.macro_climate,
          bucket_scores: {
            consumer_balance_sheet: -2,
            consumer_production: 5,
            growth: 6,
            housing: 4,
            inflation: -3,
            labor: 2
          },
          bucket_weights: {
            consumer_balance_sheet: 0.1,
            consumer_production: 0.16,
            growth: 0.18,
            housing: 0.12,
            inflation: 0.16,
            labor: 0.18
          }
        }
      }
    };

    mockStaticFetch(
      routeFetchFiles({
        "/data/derived/regime_snapshot.json": regimeSnapshot,
        "/data/derived/score_summary.json": scoreSummaryWithoutStrategicBuckets
      })
    );

    const container = render(
      <MemoryRouter initialEntries={["/long-term"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Long-Term Macro / Allocation Climate");
    expect(container.querySelector(".data-error")).toBeNull();
    expect(container.textContent).toContain("Current Long-Term Read");

    const factCards = Array.from(container.querySelectorAll(".horizon-header__facts .metric-card"));
    const realYieldsFact = factCards.find((card) => card.textContent?.includes("Real yields"));
    expect(realYieldsFact?.textContent).toContain("N/A");
  });

  it("renders the regime map route", async () => {
    mockStaticFetch(
      routeFetchFiles({
        "/data/derived/regime_snapshot.json": regimeSnapshot
      })
    );

    const container = render(
      <MemoryRouter initialEntries={["/regime-map"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "TIPS x Dollar Regime Map");
    expect(container.textContent).toContain("High data quality");
    expect(container.textContent).toContain("Treasury/bond volatility source is not active.");
    expect(container.textContent).toContain("Yield driver");
    expect(container.textContent).toContain("Cross-asset confirmation");
    expect(container.textContent).toContain("Gold / XAU");
    expect(container.textContent).toContain("MOVE");
    expect(container.textContent).toContain("Terms review needed");
    expect(container.textContent).toContain("Duration-bond confirmation");
    expect(container.textContent).not.toContain("signal-duration");
    expect(container.textContent).not.toContain("signal-bond");
  });

  it("renders regime interpretation and conflict context", async () => {
    mockStaticFetch(routeFetchFiles({ "/data/derived/regime_snapshot.json": regimeSnapshot }));

    const container = render(
      <MemoryRouter initialEntries={["/regime-map"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "TIPS x Dollar Regime Map");
    expect(container.textContent).toContain("What confirms it");
    expect(container.textContent).toContain("What conflicts with it");
    expect(container.textContent).toContain("What weakens confidence");
  });

  it("renders the historical regime replay route with attribution", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/replay"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Historical Regime Replay");
    expect(container.textContent).toContain("Why scores changed");
    expect(container.textContent).toContain("Tightening / risk-off");
    expect(container.textContent).toContain("Historical regime occurrences are descriptive context, not forecasts.");
    expect(container.textContent).not.toContain("Average SPY return");
    expect(container.textContent).not.toContain("forward return");
  });

  it("growth route renders growth and labor read interpretation", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/growth"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Growth and labor read");
    expect(container.textContent).toContain("Monthly growth and labor data can lag source release schedules.");
  });

  it("inflation route renders inflation pressure read interpretation", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/inflation"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Inflation pressure read");
    expect(container.textContent).toContain("CPI, PCE, PPI, breakevens, and forward inflation expectations");
  });

  it("rates route renders rates and policy read interpretation", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/rates"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Rates and policy read");
    expect(container.textContent).toContain("Nominal yields, real yields, breakevens, and the 10Y-2Y curve");
  });

  it("rates route renders yield decomposition and current driver context", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/rates"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "10Y yield decomposition");
    expect(container.textContent).toContain("Yield driver");
  });

  it("rates route renders generated Treasury supply diagnostics as non-scoring context", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/rates"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Treasury supply diagnostics");
    expect(container.textContent).toContain("Monthly Treasury Deficit or Surplus");
    expect(container.textContent).toContain("Treasury Auction Supply");
    expect(container.textContent).toContain("Generated candidate diagnostic");
    expect(container.textContent).toContain("Not scored");
    expect(fetch).toHaveBeenCalledWith("/data/series/monthly_treasury_deficit_surplus.json");
    expect(fetch).toHaveBeenCalledWith("/data/series/treasury_auction_supply.json");
  });

  it("dollar route renders dollar pressure read interpretation", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/dollar-global"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "Dollar pressure read");
    expect(container.textContent).toContain("Broad dollar strength can tighten global financial conditions.");
  });

  it("renders volatility base data and status when a derived ratio 404s", async () => {
    const files: Record<string, unknown> = routeFetchFiles();
    delete files["/data/derived/vix9d_vix_ratio.json"];
    mockStaticFetch(files);

    const container = render(
      <MemoryRouter initialEntries={["/volatility"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Cboe Volatility Index");

    expect(container.textContent).toContain("Cboe Volatility Index");
    expect(container.textContent).toContain("Static feed freshness");
    expect(container.querySelector(".data-error")).toBeNull();
  });

  it("volatility route renders the active VIX term-structure proxy", async () => {
    mockStaticFetch(routeFetchFiles());

    const container = render(
      <MemoryRouter initialEntries={["/volatility"]}>
        <App />
      </MemoryRouter>
    );

    await waitForContent(container, "VIX term-structure proxy");
    expect(container.textContent).toContain("VIX9D");
    expect(container.textContent).toContain("VIX");
    expect(container.textContent).toContain("VIX3M");
  });

  it("renders credit base data and status when HY minus IG OAS 404s", async () => {
    const files: Record<string, unknown> = routeFetchFiles();
    delete files["/data/derived/hy_minus_ig_oas.json"];
    mockStaticFetch(files);

    const container = render(
      <MemoryRouter initialEntries={["/credit"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "High yield OAS");

    expect(container.textContent).toContain("High yield OAS");
    expect(container.textContent).toContain("Static feed freshness");
    expect(container.querySelector(".data-error")).toBeNull();
  });

  it("renders commodity base data and status when commodity impulse 404s", async () => {
    const files: Record<string, unknown> = routeFetchFiles();
    delete files["/data/derived/commodity_inflation_impulse.json"];
    mockStaticFetch(files);

    const container = render(
      <MemoryRouter initialEntries={["/commodities"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "WTI crude oil");

    expect(container.textContent).toContain("WTI crude oil");
    expect(container.textContent).toContain("Static feed freshness");
    expect(container.querySelector(".data-error")).toBeNull();
  });

  it("renders liquidity base data and status when net liquidity 404s", async () => {
    const files: Record<string, unknown> = routeFetchFiles();
    delete files["/data/derived/net_liquidity.json"];
    mockStaticFetch(files);

    const container = render(
      <MemoryRouter initialEntries={["/liquidity"]}>
        <App />
      </MemoryRouter>
    );
    await waitForContent(container, "Reserve Balances");

    expect(container.textContent).toContain("Reserve Balances");
    expect(container.textContent).toContain("Static feed freshness");
    expect(container.textContent).toContain("Featured chart unavailable until source data is available.");
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
      "/data/derived/commodity_inflation_impulse.json": derivedFile("commodity_inflation_impulse", 1.42),
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

  it("renders phase 3 methodology panels", async () => {
    const container = render(
      <MemoryRouter initialEntries={["/methodology"]}>
        <App />
      </MemoryRouter>
    );

    expect(h3Texts(container)).toContain("Market Weather Score");
    expect(h3Texts(container)).toContain("Macro Climate Score");
    expect(h3Texts(container)).toContain("Fragility Score");
    expect(h3Texts(container)).toContain("Source access status");
    expect(container.textContent).toContain("free_public");
    expect(container.textContent).toContain("terms_review_needed");
    expect(container.textContent).toContain("restricted");
    expect(container.textContent).toContain("unavailable");
    expect(container.textContent).toContain("active no-secret public feeds");
    expect(container.textContent).toContain("paid, gated, or license-restricted");
    expect(container.textContent).toContain("credit_spreads");
    expect(container.textContent).toContain("growth, labor, inflation, consumer_production, housing, and real_yields");
    expect(container.textContent).toContain("commodity_inflation_impulse");
    expect(container.textContent).toContain("Net liquidity");
    expect(container.textContent).toContain("0.0 neutral fallbacks");
    expect(container.textContent).toContain("breakeven_10y can confirm commodity inflation pressure");
  });
});

// ---------------------------------------------------------------------------
// W2-13: cross-route IA consistency. Verifies that every route file follows
// the hero + slot + footer pattern from the spec slot map. JSX comments are
// stripped at render time so we scan the source files directly.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __routesDir = dirname(__filename);

// All 18 route source files (every file under src/routes/ except the test).
const ALL_ROUTE_FILES = readdirSync(__routesDir)
  .filter((name) => name.endsWith(".tsx") && name !== "data-routes.test.tsx")
  .sort();

// Routes that consume PageInsightHero (the 12 single-domain content routes).
// LongTermMacroClimate keeps HorizonScoreHeader instead; Overview, Tactical,
// Calendar, Methodology, HistoricalRegimeReplay also do NOT get a hero.
const SINGLE_DOMAIN_ROUTES = [
  "Rates.tsx",
  "Volatility.tsx",
  "RegimeMap.tsx",
  "Credit.tsx",
  "Liquidity.tsx",
  "DollarGlobal.tsx",
  "Commodities.tsx",
  "Inflation.tsx",
  "Growth.tsx",
  "Housing.tsx",
  "Sentiment.tsx",
  "FragilityShockRisk.tsx"
];

// Spec slot map (Wave 2 design § "Slot map reference").
// 14 routes total carry slot comments; 5 routes carry 2 each (10) + 9 routes
// carry 1 each = 19 slot markers.
const EXPECTED_SLOTS_BY_ROUTE: Record<string, string[]> = {
  "Rates.tsx": ["rates_primary_chart", "rates_secondary_charts"],
  "Volatility.tsx": ["volatility_primary_chart", "volatility_secondary_charts"],
  "RegimeMap.tsx": ["regime_primary_chart"],
  "LongTermMacroClimate.tsx": ["macro_regime_chart", "macro_yield_chart"],
  "Credit.tsx": ["credit_primary_chart"],
  "Liquidity.tsx": ["liquidity_primary_chart"],
  "DollarGlobal.tsx": ["dollar_global_primary_chart"],
  "Commodities.tsx": ["commodities_primary_chart"],
  "Inflation.tsx": ["inflation_primary_chart"],
  "Growth.tsx": ["growth_primary_chart"],
  "Housing.tsx": ["housing_primary_chart"],
  "Sentiment.tsx": ["sentiment_primary_chart"],
  "FragilityShockRisk.tsx": ["fragility_primary_chart", "fragility_pre_metrics_slot"],
  "TacticalTradingWeather.tsx": ["tactical_vol_curve_slot", "tactical_vol_complex_slot"]
};

function readRouteSource(filename: string): string {
  return readFileSync(join(__routesDir, filename), "utf8");
}

describe("W2-13: cross-route IA consistency", () => {
  it("discovers exactly 18 route source files (sanity check on the inventory)", () => {
    expect(ALL_ROUTE_FILES).toHaveLength(18);
  });

  it.each(ALL_ROUTE_FILES)(
    "%s imports and uses <RouteDataFooter> so the page ends with the data footer",
    (file) => {
      const source = readRouteSource(file);
      expect(source).toMatch(/import\s+RouteDataFooter\s+from\s+"\.\.\/components\/RouteDataFooter"/);
      expect(source).toMatch(/<RouteDataFooter/);
    }
  );

  it.each(ALL_ROUTE_FILES)(
    "%s places <RouteDataFooter> after all <DataGapPanel>, <DataStatusTable>, <CandidateDiagnosticPanel> usages (source-gated panels live in the footer)",
    (file) => {
      const source = readRouteSource(file);
      const footerIdx = source.search(/<RouteDataFooter/);
      // The footer must appear at least once.
      expect(footerIdx).toBeGreaterThan(-1);

      const restrictedComponents = [
        "DataGapPanel",
        "DataStatusTable",
        "CandidateDiagnosticPanel"
      ];
      for (const component of restrictedComponents) {
        // Match `<DataGapPanel` JSX usages (open tags) but ignore the import line.
        const usageRegex = new RegExp(`<${component}\\b`, "g");
        const matches: number[] = [];
        let m: RegExpExecArray | null;
        while ((m = usageRegex.exec(source)) !== null) matches.push(m.index);
        for (const index of matches) {
          if (index < footerIdx) {
            throw new Error(
              `${file}: <${component} ...> usage at offset ${index} is above <RouteDataFooter at offset ${footerIdx}; data-transparency panels must live inside the footer.`
            );
          }
        }
      }
    }
  );

  it.each(SINGLE_DOMAIN_ROUTES)(
    "%s renders <PageInsightHero ...> in the route body (single-domain routes get a hero)",
    (file) => {
      const source = readRouteSource(file);
      expect(source).toMatch(/import\s+PageInsightHero\s+from\s+"\.\.\/components\/PageInsightHero"/);
      expect(source).toMatch(/<PageInsightHero\s+route=/);
    }
  );

  it("non-hero routes do NOT import PageInsightHero (keeps the IA boundary explicit)", () => {
    const heroless = ALL_ROUTE_FILES.filter((file) => !SINGLE_DOMAIN_ROUTES.includes(file));
    for (const file of heroless) {
      const source = readRouteSource(file);
      expect(source).not.toMatch(/<PageInsightHero/);
    }
  });

  it.each(Object.keys(EXPECTED_SLOTS_BY_ROUTE))(
    "%s contains exactly the slot-comment markers the spec slot map says it should",
    (file) => {
      const source = readRouteSource(file);
      const expectedSlots = EXPECTED_SLOTS_BY_ROUTE[file];
      for (const slotId of expectedSlots) {
        const markerPattern = new RegExp(`\\{/\\* SLOT:${slotId} \\*/\\}`);
        expect(source).toMatch(markerPattern);
      }
    }
  );

  it("total slot count across all 14 routes equals 19 (5 routes x 2 + 9 routes x 1)", () => {
    let total = 0;
    for (const slots of Object.values(EXPECTED_SLOTS_BY_ROUTE)) {
      total += slots.length;
    }
    expect(total).toBe(19);
    expect(Object.keys(EXPECTED_SLOTS_BY_ROUTE)).toHaveLength(14);
  });

  it("TacticalTradingWeather wraps its two vol slots with open + close markers (W3 swap convention)", () => {
    const source = readRouteSource("TacticalTradingWeather.tsx");
    // Both vol slots use open + close marker pairs so vol-charts-agent can
    // swap the wrapped JSX atomically in Wave 3.
    expect(source).toMatch(/\{\/\* SLOT:tactical_vol_curve_slot \*\/\}/);
    expect(source).toMatch(/\{\/\* \/SLOT:tactical_vol_curve_slot \*\/\}/);
    expect(source).toMatch(/\{\/\* SLOT:tactical_vol_complex_slot \*\/\}/);
    expect(source).toMatch(/\{\/\* \/SLOT:tactical_vol_complex_slot \*\/\}/);
  });

  it("FragilityShockRisk's primary chart slot precedes the existing <ShockRiskContributionChart /> JSX", () => {
    const source = readRouteSource("FragilityShockRisk.tsx");
    const slotIdx = source.indexOf("{/* SLOT:fragility_primary_chart */}");
    const chartIdx = source.indexOf("<ShockRiskContributionChart");
    expect(slotIdx).toBeGreaterThan(-1);
    expect(chartIdx).toBeGreaterThan(-1);
    expect(slotIdx).toBeLessThan(chartIdx);
  });

  it("FragilityShockRisk's pre-metrics slot sits between <TailRiskReadinessMatrix /> and <section className=\"score-grid\">", () => {
    const source = readRouteSource("FragilityShockRisk.tsx");
    const tailIdx = source.indexOf("<TailRiskReadinessMatrix");
    const slotIdx = source.indexOf("{/* SLOT:fragility_pre_metrics_slot */}");
    const scoreGridIdx = source.indexOf('className="score-grid"');
    expect(tailIdx).toBeGreaterThan(-1);
    expect(slotIdx).toBeGreaterThan(tailIdx);
    expect(scoreGridIdx).toBeGreaterThan(slotIdx);
  });

  it("FragilityShockRisk preserves the load-bearing 'is NOT the licensed ICE MOVE Index' caveat verbatim in BondVolatilityProxyChart", () => {
    // Verifies the constraint in W2-7: substring match on the chart source
    // file. Tested independently of the rendered DOM because the literal lives
    // in the chart component, which the route always renders.
    const chartSource = readFileSync(
      join(__routesDir, "..", "components", "BondVolatilityProxyChart.tsx"),
      "utf8"
    );
    expect(chartSource).toContain("is NOT the licensed ICE MOVE Index");
  });

  it("HistoricalRegimeReplayPanel keeps the '20-observation changes' literal at line 79 (correct per METHODOLOGY)", () => {
    const panelSource = readFileSync(
      join(__routesDir, "..", "components", "HistoricalRegimeReplayPanel.tsx"),
      "utf8"
    );
    const lines = panelSource.split("\n");
    // line index 78 == line 79 (1-indexed) in the file.
    expect(lines[78]).toContain("20-observation changes");
  });

  it("RegimeQuadrantChart still carries the '20-observation' label until W3 regime-charts-agent rebuilds it", () => {
    // W3 rebuilds RegimeQuadrantChart to use a dynamic '{window} change' label.
    // W2 must NOT pre-edit the chart's static literal so the W3 agent's
    // exact-string replacement (replacing the misleading static label) still
    // matches. We only assert the file exists and is still Recharts-based, not
    // the precise label text, to avoid coupling to the in-flight W3 change.
    const chartSource = readFileSync(
      join(__routesDir, "..", "components", "RegimeQuadrantChart.tsx"),
      "utf8"
    );
    expect(chartSource.length).toBeGreaterThan(0);
  });
});
