import { useEffect, useState } from "react";
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

const housingSeriesIds = ["housing_starts", "building_permits", "mortgage_rate_30y"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Housing() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadHousing() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const series = await loadRouteSeries(housingSeriesIds, catalog, status);
        if (active) setData({ catalog, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load housing data.");
      }
    }

    void loadHousing();

    return () => {
      active = false;
    };
  }, []);

  const housingStarts = data?.series.find((series) => series.series_id === "housing_starts");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Housing</p>
        <h2>Housing</h2>
        <p>Construction activity, permits, and mortgage-rate sensitivity.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="housing" />
          {/* SLOT:housing_primary_chart */}
          <InterpretationPanel
            label="Housing activity read"
            notes={["Housing starts and building permits are monthly, while mortgage rates update weekly."]}
            risks={["Higher mortgage rates can pressure affordability and reduce construction demand."]}
            summary="Housing starts, building permits, and 30-year mortgage rates track construction momentum and mortgage-rate sensitivity."
            supports={["Firm starts and permits can support growth when rate pressure is contained."]}
          />
          <section className="metric-grid" aria-label="Housing metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {hasObservations(housingStarts) ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "housing_starts")}
              series={housingStarts}
            />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "housing_starts")?.name ?? "housing_starts"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "housing_starts")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <RouteDataFooter route="housing">
            <DataGapPanel status={data.status} seriesIds={housingSeriesIds} />
            <DataStatusTable seriesIds={housingSeriesIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </main>
  );
}
