import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadSeries } from "../lib/data";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

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
}

export default function Inflation() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInflation() {
      try {
        const [catalog, series] = await Promise.all([
          loadCatalog(),
          Promise.all(inflationSeriesIds.map((seriesId) => loadSeries(seriesId)))
        ]);
        if (active) setData({ catalog, series });
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
      {error ? <p className="data-error">Data error: {error}</p> : null}
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
          {headlineCpi ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "headline_cpi")}
              series={headlineCpi}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
