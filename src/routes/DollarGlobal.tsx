import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { loadRouteSeries } from "./routeSeries";

const dollarSeriesIds = ["broad_dollar", "usdjpy", "eurusd"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function DollarGlobal() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDollarGlobal() {
      try {
        const catalog = await loadCatalog();
        const [status, series] = await Promise.all([
          loadDataStatus(),
          loadRouteSeries(dollarSeriesIds, catalog)
        ]);
        if (active) setData({ catalog, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load dollar data.");
      }
    }

    void loadDollarGlobal();

    return () => {
      active = false;
    };
  }, []);

  const broadDollar = data?.series.find((series) => series.series_id === "broad_dollar");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Dollar & Global</p>
        <h2>Dollar & Global</h2>
        <p>Broad dollar and major currency pairs.</p>
      </section>
      {error ? <p className="data-error">Data error: {error}</p> : null}
      {data ? (
        <div className="route-stack">
          <section className="metric-grid" aria-label="Dollar and global metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {broadDollar ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "broad_dollar")}
              series={broadDollar}
            />
          ) : null}
          <DataStatusTable seriesIds={dollarSeriesIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
