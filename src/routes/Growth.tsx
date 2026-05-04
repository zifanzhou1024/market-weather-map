import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { loadRouteSeries } from "./routeSeries";

const growthSeriesIds = [
  "cfnai",
  "cfnai_3m_avg",
  "real_retail_sales",
  "industrial_production",
  "durable_goods_orders"
];
const laborSeriesIds = ["unemployment_rate", "nonfarm_payrolls", "initial_claims", "sahm_rule"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  growthSeries: TimeSeriesFile[];
  laborSeries: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Growth() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadGrowth() {
      try {
        const catalog = await loadCatalog();
        const [status, growthSeries, laborSeries] = await Promise.all([
          loadDataStatus(),
          loadRouteSeries(growthSeriesIds, catalog),
          loadRouteSeries(laborSeriesIds, catalog)
        ]);
        if (active) setData({ catalog, growthSeries, laborSeries, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load growth data.");
      }
    }

    void loadGrowth();

    return () => {
      active = false;
    };
  }, []);

  const cfnai = data?.growthSeries.find((series) => series.series_id === "cfnai");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Growth</p>
        <h2>Growth</h2>
        <p>Growth breadth, real demand, production, and cyclical risk.</p>
      </section>
      {error ? <p className="data-error">Data error: {error}</p> : null}
      {data ? (
        <div className="route-stack">
          <section className="metric-grid" aria-label="Growth metrics">
            {data.growthSeries.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          <section className="route-stack" aria-labelledby="labor-risk-heading">
            <div className="section-heading">
              <h3 id="labor-risk-heading">Labor and recession risk</h3>
            </div>
            <section className="metric-grid" aria-label="Labor and recession risk metrics">
              {data.laborSeries.map((series) => (
                <MetricCard
                  catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                  key={series.series_id}
                  series={series}
                />
              ))}
            </section>
          </section>
          {cfnai ? (
            <TimeSeriesChart catalogEntry={data.catalog.find((entry) => entry.id === "cfnai")} series={cfnai} />
          ) : null}
          <DataStatusTable seriesIds={[...growthSeriesIds, ...laborSeriesIds]} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
