import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDerivedSeries, loadSeries } from "../lib/data";
import type { DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const ratesSeriesIds = ["us2y", "us10y", "us20y", "us30y"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  curve: DerivedSeriesFile;
  series: TimeSeriesFile[];
}

export default function Rates() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRates() {
      try {
        const [catalog, series, curve] = await Promise.all([
          loadCatalog(),
          Promise.all(ratesSeriesIds.map((seriesId) => loadSeries(seriesId))),
          loadDerivedSeries("us10y_minus_us2y")
        ]);
        if (active) setData({ catalog, curve, series });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load rates data.");
      }
    }

    void loadRates();

    return () => {
      active = false;
    };
  }, []);

  const us10y = data?.series.find((series) => series.series_id === "us10y");
  const curveCatalogEntry: SeriesCatalogEntry | undefined = data
    ? {
        category: "rates",
        frequency: data.curve.frequency,
        higher_is: "contextual",
        id: data.curve.series_id,
        max_stale_days: 7,
        name: "10Y-2Y spread",
        notes: data.curve.method,
        public: true,
        source: data.curve.source,
        source_url: data.curve.source_url,
        units: data.curve.units
      }
    : undefined;

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
            <MetricCard catalogEntry={curveCatalogEntry} series={data.curve} />
          </section>
          {us10y ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "us10y")}
              series={us10y}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
