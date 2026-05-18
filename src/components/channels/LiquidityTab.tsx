import { useEffect, useState } from "react";
import LiquidityDecompositionHero from "../charts/LiquidityDecompositionHero";
import DataGapPanel from "../DataGapPanel";
import DataStatusTable from "../DataStatusTable";
import FocusBlock from "../FocusBlock";
import InterpretationPanel from "../InterpretationPanel";
import MetricCard from "../MetricCard";
import PageInsightHero from "../PageInsightHero";
import RouteDataFooter from "../RouteDataFooter";
import TimeSeriesChart from "../TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadPageInsights } from "../../lib/data";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  PageInsightsFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../../lib/types";
import { hasObservations, loadRouteDerivedSeries, loadRouteSeries } from "../../routes/routeSeries";

const liquiditySeriesIds = ["fed_assets", "reverse_repo", "treasury_general_account", "sofr", "reserve_balances"];
const liquidityStatusIds = ["net_liquidity", ...liquiditySeriesIds];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  netLiquidity: DerivedSeriesFile;
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function LiquidityTab() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageInsights, setPageInsights] = useState<PageInsightsFile | null>(null);

  useEffect(() => {
    let active = true;

    loadPageInsights()
      .then((result) => {
        if (active) setPageInsights(result);
      })
      .catch(() => {
        // pageInsights is optional — swallow errors; FocusBlock will not render
      });

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
    <section data-testid="liquidity-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="liquidity" />
          {(() => {
            const section = pageInsights?.routes?.liquidity?.sections?.find(
              (s) => s.id === "liquidity_funding"
            );
            return section ? (
              <FocusBlock
                variant="section"
                sectionId={section.id}
                eyebrow={section.eyebrow}
                question={section.question}
                answer={section.answer}
                why={section.why}
                risk={section.risk}
                support={section.support}
                caveat={section.caveat}
                freshnessStatus={section.freshness_status}
              />
            ) : null;
          })()}
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
    </section>
  );
}
