import { useEffect, useState } from "react";
import HousingActivityHero from "../charts/HousingActivityHero";
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

const housingSeriesIds = ["housing_starts", "building_permits", "mortgage_rate_30y"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function HousingTab() {
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
  const buildingPermits = data?.series.find((series) => series.series_id === "building_permits");
  const mortgageRate30y = data?.series.find(
    (series) => series.series_id === "mortgage_rate_30y"
  );
  const heroAllReady = housingStarts && buildingPermits && mortgageRate30y;
  const heroHasObservations =
    heroAllReady &&
    (housingStarts.observations.length > 0 ||
      buildingPermits.observations.length > 0 ||
      mortgageRate30y.observations.length > 0);

  return (
    <section data-testid="housing-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="housing" />
          {(() => {
            const section = pageInsights?.routes?.housing?.sections?.find(
              (s) => s.id === "housing_pulse"
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
          {/* SLOT:housing_primary_chart */}
          {heroAllReady && heroHasObservations ? (
            <HousingActivityHero
              housingStarts={housingStarts}
              buildingPermits={buildingPermits}
              mortgageRate30y={mortgageRate30y}
            />
          ) : (
            <section className="panel chart-panel" aria-label="Housing activity vs mortgage rate">
              <p>Housing activity vs mortgage rate chart unavailable until housing starts, building permits, or 30Y mortgage rate data are active.</p>
            </section>
          )}
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
    </section>
  );
}
