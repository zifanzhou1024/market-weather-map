import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadSeries } from "../lib/data";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const liquiditySeriesIds = ["fed_assets", "reverse_repo", "treasury_general_account", "sofr"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
}

export default function Liquidity() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLiquidity() {
      try {
        const [catalog, series] = await Promise.all([
          loadCatalog(),
          Promise.all(liquiditySeriesIds.map((seriesId) => loadSeries(seriesId)))
        ]);
        if (active) setData({ catalog, series });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load liquidity data.");
      }
    }

    void loadLiquidity();

    return () => {
      active = false;
    };
  }, []);

  const fedAssets = data?.series.find((series) => series.series_id === "fed_assets");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Liquidity</p>
        <h2>Funding and balance sheet</h2>
        <p>Fed assets, reverse repo, Treasury General Account, and SOFR.</p>
      </section>
      {error ? <p className="data-error">Data error: {error}</p> : null}
      {data ? (
        <div className="route-stack">
          <section className="metric-grid" aria-label="Liquidity metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {fedAssets ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "fed_assets")}
              series={fedAssets}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
