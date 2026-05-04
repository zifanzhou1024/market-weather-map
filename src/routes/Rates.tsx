import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadDerivedSeries } from "../lib/data";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { loadRouteSeries } from "./routeSeries";

const ratesSeriesIds = [
  "us2y",
  "us10y",
  "us20y",
  "us30y",
  "real_yield_5y",
  "real_yield_10y",
  "breakeven_5y",
  "breakeven_10y",
  "forward_inflation_5y5y"
];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  curve: DerivedSeriesFile;
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Rates() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRates() {
      try {
        const catalog = await loadCatalog();
        const [status, series, curve] = await Promise.all([
          loadDataStatus(),
          loadRouteSeries(ratesSeriesIds, catalog),
          loadDerivedSeries("us10y_minus_us2y")
        ]);
        if (active) setData({ catalog, curve, series, status });
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
        <p className="eyebrow">Rates & Policy</p>
        <h2>Rates & Policy</h2>
        <p>Nominal yields, real yields, and breakevens.</p>
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
          <DataStatusTable seriesIds={ratesSeriesIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
