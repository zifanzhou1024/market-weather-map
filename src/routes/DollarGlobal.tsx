import { useEffect, useState } from "react";
import DollarPressureHero from "../components/charts/DollarPressureHero";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import PageInsightHero from "../components/PageInsightHero";
import RouteDataFooter from "../components/RouteDataFooter";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { hasObservations, loadRouteSeries } from "./routeSeries";

const dollarSeriesIds = ["broad_dollar", "usdjpy", "eurusd"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function DollarGlobal() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

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
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Dollar & Global</p>
        <h2>Dollar & Global</h2>
        <p>Broad dollar and major currency pairs.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="dollar_global" />
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
    </main>
  );
}
