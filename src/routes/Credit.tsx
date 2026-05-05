import { useEffect, useState } from "react";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadDerivedSeries } from "../lib/data";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { hasObservations, loadRouteSeries } from "./routeSeries";

const creditSeriesIds = [
  "high_yield_oas",
  "investment_grade_oas",
  "bbb_oas",
  "financial_stress",
  "financial_conditions",
  "reserve_balances",
  "bank_credit",
  "loans_and_leases",
  "business_loans",
  "bank_deposits"
];
const creditStatusIds = ["hy_minus_ig_oas", ...creditSeriesIds];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  hyMinusIgOas: DerivedSeriesFile;
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

function creditDerivedEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  return {
    category: "credit",
    frequency: series.frequency,
    higher_is: "riskier",
    id: series.series_id,
    max_stale_days: 7,
    name: "HY minus IG OAS",
    notes: series.method,
    public: true,
    source: series.source,
    source_url: series.source_url,
    units: series.units
  };
}

export default function Credit() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCredit() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const [series, hyMinusIgOas] = await Promise.all([
          loadRouteSeries(creditSeriesIds, catalog, status),
          loadDerivedSeries("hy_minus_ig_oas")
        ]);
        if (active) setData({ catalog, hyMinusIgOas, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load credit data.");
      }
    }

    void loadCredit();

    return () => {
      active = false;
    };
  }, []);

  const financialStress = data?.series.find((series) => series.series_id === "financial_stress");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Credit & Banking</p>
        <h2>Credit & Banking</h2>
        <p>Credit spreads, financial stress, banking system liquidity, lending, and deposits.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <InterpretationPanel
            label="Credit stress and banking liquidity"
            summary="Credit spreads, stress indexes, and banking aggregates show whether funding stress is concentrated in risky credit or spreading through the banking system."
            supports={["Stable spreads and bank deposits can support easier credit conditions."]}
            risks={["A wider HY minus IG OAS spread points to lower-quality credit underperforming higher-quality credit."]}
            notes={["HY minus IG OAS is derived from matched high-yield and investment-grade option-adjusted spread observations."]}
          />
          <section className="metric-grid" aria-label="Credit and banking metrics">
            <MetricCard catalogEntry={creditDerivedEntry(data.hyMinusIgOas)} series={data.hyMinusIgOas} />
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {hasObservations(financialStress) ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "financial_stress")}
              series={financialStress}
            />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "financial_stress")?.name ?? "financial_stress"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "financial_stress")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <DataGapPanel seriesIds={creditStatusIds} status={data.status} />
          <DataStatusTable seriesIds={creditStatusIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
