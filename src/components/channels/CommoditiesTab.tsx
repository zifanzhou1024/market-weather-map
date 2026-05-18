import { useEffect, useState } from "react";
import CommodityImpulseHero from "../charts/CommodityImpulseHero";
import DataGapPanel from "../DataGapPanel";
import DataStatusTable from "../DataStatusTable";
import FocusBlock from "../FocusBlock";
import InterpretationPanel from "../InterpretationPanel";
import MetricCard from "../MetricCard";
import PageInsightHero from "../PageInsightHero";
import RouteDataFooter from "../RouteDataFooter";
import TimeSeriesChart from "../TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadDerivedSeries, loadPageInsights, loadSeries } from "../../lib/data";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  PageInsightsFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../../lib/types";
import { loadRouteDerivedSeries } from "../../routes/routeSeries";

const commoditySeriesIds = ["wti_crude", "brent_crude", "corn_price", "wheat_price", "soybean_price"];
const commodityStatusIds = ["commodity_inflation_impulse", ...commoditySeriesIds, "brent_wti_spread"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  impulse: DerivedSeriesFile;
  spread: DerivedSeriesFile;
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

function brentWtiSpreadEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  return {
    category: "commodities",
    frequency: series.frequency,
    higher_is: "contextual",
    id: series.series_id,
    max_stale_days: 10,
    name: "Brent-WTI spread",
    notes: series.method,
    public: true,
    source: series.source,
    source_url: series.source_url,
    units: series.units,
    access_status: "free_public_active",
    terms_status: "ok",
    score_status: "active",
    active_scoring_allowed: true,
    public_redistribution_allowed: true,
    requires_secret: false
  };
}

function commodityImpulseEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  return {
    category: "commodities",
    frequency: series.frequency,
    higher_is: "riskier",
    id: series.series_id,
    max_stale_days: 10,
    name: "Commodity inflation impulse",
    notes: series.method,
    public: true,
    source: series.source,
    source_url: series.source_url,
    units: series.units,
    access_status: "free_public_active",
    terms_status: "ok",
    score_status: "active",
    active_scoring_allowed: true,
    public_redistribution_allowed: true,
    requires_secret: false
  };
}

export default function CommoditiesTab() {
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

    async function loadCommodities() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const [series, spread, [impulse]] = await Promise.all([
          Promise.all(commoditySeriesIds.map((seriesId) => loadSeries(seriesId))),
          loadDerivedSeries("brent_wti_spread"),
          loadRouteDerivedSeries(["commodity_inflation_impulse"], catalog, status, {
            allowMissing: new Set(["commodity_inflation_impulse"])
          })
        ]);
        if (active) setData({ catalog, impulse, spread, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load commodities data.");
      }
    }

    void loadCommodities();

    return () => {
      active = false;
    };
  }, []);

  const wti = data?.series.find((series) => series.series_id === "wti_crude");
  const spreadCatalogEntry = data ? brentWtiSpreadEntry(data.spread) : undefined;
  const impulseCatalogEntry = data ? commodityImpulseEntry(data.impulse) : undefined;

  return (
    <section data-testid="commodities-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="commodities" />
          {(() => {
            const section = pageInsights?.routes?.commodities?.sections?.find(
              (s) => s.id === "commodity_impulse"
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
          {/* SLOT:commodities_primary_chart */}
          {data.impulse.observations.length > 0 || data.spread.observations.length > 0 ? (
            <CommodityImpulseHero impulse={data.impulse} brentWtiSpread={data.spread} />
          ) : (
            <section className="panel chart-panel" aria-label="Commodity impulse">
              <p>Commodity impulse chart unavailable until source data is active.</p>
            </section>
          )}
          <InterpretationPanel
            label="Price level versus impulse"
            summary="Spot commodity prices describe current level pressure, while the derived impulse highlights whether commodity prices are adding to or subtracting from inflation pressure."
            supports={["Lower or cooling commodity impulse can support disinflation."]}
            risks={["Rising commodity impulse can feed near-term inflation pressure even when individual price levels look mixed."]}
            notes={["The impulse is a derived summary and should be read alongside oil and crop price levels."]}
          />
          <section className="metric-grid" aria-label="Commodities metrics">
            <MetricCard catalogEntry={impulseCatalogEntry} series={data.impulse} />
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
            <MetricCard catalogEntry={spreadCatalogEntry} series={data.spread} />
          </section>
          {wti ? (
            <TimeSeriesChart catalogEntry={data.catalog.find((entry) => entry.id === "wti_crude")} series={wti} />
          ) : null}
          <RouteDataFooter route="commodities">
            <DataGapPanel seriesIds={commodityStatusIds} status={data.status} />
            <DataStatusTable seriesIds={commodityStatusIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </section>
  );
}
