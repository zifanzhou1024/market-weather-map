import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadSeries } from "../lib/data";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const creditSeriesIds = ["financial_stress", "financial_conditions"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
}

export default function Credit() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCredit() {
      try {
        const [catalog, series] = await Promise.all([
          loadCatalog(),
          Promise.all(creditSeriesIds.map((seriesId) => loadSeries(seriesId)))
        ]);
        if (active) setData({ catalog, series });
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
        <p className="eyebrow">Credit</p>
        <h2>Financial stress</h2>
        <p>Fed-published financial stress and conditions indexes.</p>
      </section>
      {error ? <p className="data-error">Data error: {error}</p> : null}
      {data ? (
        <div className="route-stack">
          <section className="metric-grid" aria-label="Financial stress metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {financialStress ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "financial_stress")}
              series={financialStress}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
