import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDerivedSeries, loadSeries } from "../lib/data";
import type { DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const liquiditySeriesIds = ["fed_assets", "reverse_repo", "treasury_general_account", "sofr"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  netLiquidity: DerivedSeriesFile;
  series: TimeSeriesFile[];
}

export default function Liquidity() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLiquidity() {
      try {
        const [catalog, series, netLiquidity] = await Promise.all([
          loadCatalog(),
          Promise.all(liquiditySeriesIds.map((seriesId) => loadSeries(seriesId))),
          loadDerivedSeries("net_liquidity")
        ]);
        if (active) setData({ catalog, netLiquidity, series });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load liquidity data.");
      }
    }

    void loadLiquidity();

    return () => {
      active = false;
    };
  }, []);

  const netLiquidityCatalogEntry: SeriesCatalogEntry | undefined = data
    ? {
        category: "liquidity",
        frequency: data.netLiquidity.frequency,
        higher_is: "supportive",
        id: data.netLiquidity.series_id,
        max_stale_days: 14,
        name: "Net liquidity proxy",
        notes: data.netLiquidity.method,
        public: true,
        source: data.netLiquidity.source,
        source_url: data.netLiquidity.source_url,
        units: data.netLiquidity.units
      }
    : undefined;

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Liquidity</p>
        <h2>Funding and balance sheet</h2>
        <p>Net liquidity, Fed assets, reverse repo, Treasury General Account, and SOFR.</p>
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
            <MetricCard catalogEntry={netLiquidityCatalogEntry} series={data.netLiquidity} />
          </section>
          <TimeSeriesChart catalogEntry={netLiquidityCatalogEntry} series={data.netLiquidity} />
        </div>
      ) : null}
    </main>
  );
}
