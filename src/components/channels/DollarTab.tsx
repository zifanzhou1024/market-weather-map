import { useEffect, useState } from "react";
import DollarPressureHero from "../charts/DollarPressureHero";
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
  PageInsightsFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../../lib/types";
import { hasObservations, loadRouteSeries } from "../../routes/routeSeries";

const dollarSeriesIds = ["broad_dollar", "usdjpy", "eurusd"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function DollarTab() {
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

    async function loadDollarGlobal() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const series = await loadRouteSeries(dollarSeriesIds, catalog, status);
        if (active) setData({ catalog, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load dollar data.");
      }
    }

    void loadDollarGlobal();

    return () => {
      active = false;
    };
  }, []);

  const broadDollar = data?.series.find((series) => series.series_id === "broad_dollar");

  return (
    <section data-testid="dollar-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="dollar_global" />
          {(() => {
            const section = pageInsights?.routes?.dollar_global?.sections?.find(
              (s) => s.id === "dollar_pressure"
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
          {/* SLOT:dollar_global_primary_chart */}
          {broadDollar && broadDollar.observations.length > 0 ? (
            <DollarPressureHero broadDollar={broadDollar} />
          ) : (
            <section className="panel chart-panel" aria-label="Dollar pressure">
              <p>Dollar pressure chart unavailable until broad-dollar data is active.</p>
            </section>
          )}
          <InterpretationPanel
            label="Dollar pressure read"
            notes={["FX series can be stale around holidays and should be checked against freshness status."]}
            risks={["Broad dollar strength can tighten global financial conditions."]}
            summary="The broad dollar, USDJPY, and EURUSD provide global dollar-pressure context for Market Weather and Fragility."
            supports={["Dollar easing can reduce global liquidity pressure."]}
          />
          <section className="metric-grid" aria-label="Dollar and global metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {hasObservations(broadDollar) ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "broad_dollar")}
              series={broadDollar}
            />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "broad_dollar")?.name ?? "broad_dollar"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "broad_dollar")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <RouteDataFooter route="dollar_global">
            <DataGapPanel status={data.status} seriesIds={dollarSeriesIds} />
            <DataStatusTable seriesIds={dollarSeriesIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </section>
  );
}
