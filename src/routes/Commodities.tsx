import { useEffect, useState } from "react";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import PageInsightHero from "../components/PageInsightHero";
import RouteDataFooter from "../components/RouteDataFooter";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadDerivedSeries, loadSeries } from "../lib/data";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { loadRouteDerivedSeries } from "./routeSeries";

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
    units: series.units
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
    units: series.units
  };
}

export default function Commodities() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

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
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Commodities</p>
        <h2>Energy and grains</h2>
        <p>Commodity price levels, inflation impulse, and the Brent-WTI spread.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="commodities" />
          {/* SLOT:commodities_primary_chart */}
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
    </main>
  );
}
