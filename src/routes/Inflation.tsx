import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { hasObservations, loadRouteSeries } from "./routeSeries";

const inflationSeriesIds = [
  "headline_cpi",
  "core_cpi",
  "core_pce",
  "ppi_final_demand",
  "breakeven_10y",
  "breakeven_5y",
  "forward_inflation_5y5y"
];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Inflation() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInflation() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const series = await loadRouteSeries(inflationSeriesIds, catalog, status);
        if (active) setData({ catalog, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load inflation data.");
      }
    }

    void loadInflation();

    return () => {
      active = false;
    };
  }, []);

  const headlineCpi = data?.series.find((series) => series.series_id === "headline_cpi");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Inflation</p>
        <h2>Inflation</h2>
        <p>Price pressure and market expectations.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <section className="metric-grid" aria-label="Inflation metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {hasObservations(headlineCpi) ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "headline_cpi")}
              series={headlineCpi}
            />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "headline_cpi")?.name ?? "headline_cpi"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "headline_cpi")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <DataStatusTable seriesIds={inflationSeriesIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
