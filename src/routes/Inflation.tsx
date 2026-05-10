import { useEffect, useState } from "react";
import InflationSpreadHero from "../components/charts/InflationSpreadHero";
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

const inflationSeriesIds = [
  "headline_cpi",
  "core_cpi",
  "core_pce",
  "ppi_final_demand",
  "breakeven_10y",
  "breakeven_5y",
  "forward_inflation_5y5y"
];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Inflation() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInflation() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const series = await loadRouteSeries(inflationSeriesIds, catalog, status);
        if (active) setData({ catalog, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load inflation data.");
      }
    }

    void loadInflation();

    return () => {
      active = false;
    };
  }, []);

  const headlineCpi = data?.series.find((series) => series.series_id === "headline_cpi");
  const coreCpi = data?.series.find((series) => series.series_id === "core_cpi");
  const breakeven10y = data?.series.find((series) => series.series_id === "breakeven_10y");
  const forwardInflation5y5y = data?.series.find(
    (series) => series.series_id === "forward_inflation_5y5y"
  );
  const heroHasData =
    headlineCpi &&
    coreCpi &&
    breakeven10y &&
    forwardInflation5y5y &&
    (headlineCpi.observations.length > 0 ||
      coreCpi.observations.length > 0 ||
      breakeven10y.observations.length > 0 ||
      forwardInflation5y5y.observations.length > 0);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Inflation</p>
        <h2>Inflation</h2>
        <p>Price pressure and market expectations.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="inflation" />
          {/* SLOT:inflation_primary_chart */}
          {heroHasData ? (
            <InflationSpreadHero
              headlineCpi={headlineCpi}
              coreCpi={coreCpi}
              breakeven10y={breakeven10y}
              forwardInflation5y5y={forwardInflation5y5y}
            />
          ) : (
            <section className="panel chart-panel" aria-label="Realized vs market-implied inflation">
              <p>Realized vs market-implied inflation chart unavailable until headline CPI, core CPI, 10Y breakevens, or 5y5y forward inflation are active.</p>
            </section>
          )}
          <InterpretationPanel
            label="Inflation pressure read"
            notes={["Monthly inflation indexes use observation months and should be read with release-aware freshness notes."]}
            risks={["High or reaccelerating core inflation can keep policy pressure elevated."]}
            summary="CPI, PCE, PPI, breakevens, and forward inflation expectations separate realized price pressure from market-implied inflation compensation."
            supports={["Contained breakevens and easing core momentum can reduce macro climate pressure."]}
          />
          <section className="metric-grid" aria-label="Inflation metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {hasObservations(headlineCpi) ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "headline_cpi")}
              series={headlineCpi}
            />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "headline_cpi")?.name ?? "headline_cpi"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "headline_cpi")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <RouteDataFooter route="inflation">
            <DataGapPanel status={data.status} seriesIds={inflationSeriesIds} />
            <DataStatusTable seriesIds={inflationSeriesIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </main>
  );
}
