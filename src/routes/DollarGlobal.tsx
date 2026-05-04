import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadSeries } from "../lib/data";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const dollarSeriesIds = ["broad_dollar", "usdjpy", "eurusd"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
}

export default function DollarGlobal() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDollarGlobal() {
      try {
        const [catalog, series] = await Promise.all([
          loadCatalog(),
          Promise.all(dollarSeriesIds.map((seriesId) => loadSeries(seriesId)))
        ]);
        if (active) setData({ catalog, series });
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
        </div>
      ) : null}
    </main>
  );
}
