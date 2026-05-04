import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
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

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Credit() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCredit() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const series = await loadRouteSeries(creditSeriesIds, catalog, status);
        if (active) setData({ catalog, series, status });
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
          <section className="metric-grid" aria-label="Credit and banking metrics">
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
          <DataStatusTable seriesIds={creditSeriesIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
