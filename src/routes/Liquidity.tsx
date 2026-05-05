import { useEffect, useState } from "react";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadDerivedSeries } from "../lib/data";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { loadRouteSeries } from "./routeSeries";

const liquiditySeriesIds = ["fed_assets", "reverse_repo", "treasury_general_account", "sofr", "reserve_balances"];
const liquidityStatusIds = ["net_liquidity", ...liquiditySeriesIds];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  netLiquidity: DerivedSeriesFile;
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Liquidity() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLiquidity() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const [series, netLiquidity] = await Promise.all([
          loadRouteSeries(liquiditySeriesIds, catalog, status),
          loadDerivedSeries("net_liquidity")
        ]);
        if (active) setData({ catalog, netLiquidity, series, status });
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
        <p>Net liquidity, Fed assets, reverse repo, Treasury General Account, SOFR, and reserve balances.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <InterpretationPanel
            label="Liquidity funding conditions"
            summary="This view combines a derived net liquidity proxy with balance-sheet and funding inputs."
            supports={["Rising net liquidity and ample reserve balances can support financial conditions."]}
            risks={["Falling reserve balances, rising SOFR pressure, or shrinking net liquidity can tighten funding."]}
            notes={["Net liquidity is derived from Fed assets, reverse repo, and Treasury General Account levels."]}
          />
          <section className="metric-grid" aria-label="Liquidity metrics">
            <MetricCard catalogEntry={netLiquidityCatalogEntry} series={data.netLiquidity} />
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          <TimeSeriesChart catalogEntry={netLiquidityCatalogEntry} series={data.netLiquidity} />
          <DataGapPanel seriesIds={liquidityStatusIds} status={data.status} />
          <DataStatusTable seriesIds={liquidityStatusIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
