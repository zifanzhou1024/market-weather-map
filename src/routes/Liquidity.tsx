import { useEffect, useState } from "react";
import LiquidityDecompositionHero from "../components/charts/LiquidityDecompositionHero";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import PageInsightHero from "../components/PageInsightHero";
import RouteDataFooter from "../components/RouteDataFooter";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus } from "../lib/data";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { hasObservations, loadRouteDerivedSeries, loadRouteSeries } from "./routeSeries";

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
        const [series, [netLiquidity]] = await Promise.all([
          loadRouteSeries(liquiditySeriesIds, catalog, status),
          loadRouteDerivedSeries(["net_liquidity"], catalog, status, {
            allowMissing: new Set(["net_liquidity"])
          })
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
        units: data.netLiquidity.units,
        access_status: "free_public_active",
        terms_status: "ok",
        score_status: "active",
        active_scoring_allowed: true,
        public_redistribution_allowed: true,
        requires_secret: false
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
          <PageInsightHero route="liquidity" />
          {/* SLOT:liquidity_primary_chart */}
          {data.netLiquidity.observations.length > 0 ? (
            <LiquidityDecompositionHero netLiquidity={data.netLiquidity} />
          ) : (
            <section className="panel chart-panel" aria-label="Net liquidity">
              <p>Net liquidity chart unavailable until source data is active.</p>
            </section>
          )}
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
          {hasObservations(data.netLiquidity) ? (
            <TimeSeriesChart catalogEntry={netLiquidityCatalogEntry} series={data.netLiquidity} />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>Net liquidity proxy</h3>
                </div>
                <p>{netLiquidityCatalogEntry?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <RouteDataFooter route="liquidity">
            <DataGapPanel seriesIds={liquidityStatusIds} status={data.status} />
            <DataStatusTable seriesIds={liquidityStatusIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </main>
  );
}
