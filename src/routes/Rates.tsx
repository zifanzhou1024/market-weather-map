import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadSeries } from "../lib/data";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const ratesSeriesIds = ["us2y", "us10y", "us20y", "us30y"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
}

export default function Rates() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRates() {
      try {
        const [catalog, series] = await Promise.all([
          loadCatalog(),
          Promise.all(ratesSeriesIds.map((seriesId) => loadSeries(seriesId)))
        ]);
        if (active) setData({ catalog, series });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load rates data.");
      }
    }

    void loadRates();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Rates</p>
        <h2>Treasury curve</h2>
        <p>U.S. Treasury yields across the 2Y, 10Y, 20Y, and 30Y maturities.</p>
      </section>
      {error ? <p className="data-error">Data error: {error}</p> : null}
      {data ? (
        <div className="route-stack">
          <section className="metric-grid" aria-label="Rates metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {data.series.find((series) => series.series_id === "us10y") ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "us10y")}
              series={data.series.find((series) => series.series_id === "us10y") as TimeSeriesFile}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
