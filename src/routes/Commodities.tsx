import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadDerivedSeries, loadSeries } from "../lib/data";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const commoditySeriesIds = ["wti_crude", "brent_crude", "corn_price", "wheat_price", "soybean_price"];
const commodityStatusIds = [...commoditySeriesIds, "brent_wti_spread"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  spread: DerivedSeriesFile;
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

function derivedCatalogEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
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

export default function Commodities() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCommodities() {
      try {
        const [catalog, status, series, spread] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          Promise.all(commoditySeriesIds.map((seriesId) => loadSeries(seriesId))),
          loadDerivedSeries("brent_wti_spread")
        ]);
        if (active) setData({ catalog, spread, series, status });
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
  const spreadCatalogEntry = data ? derivedCatalogEntry(data.spread) : undefined;

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Commodities</p>
        <h2>Energy and grains</h2>
        <p>WTI, Brent, corn, wheat, soybeans, and the Brent-WTI spread.</p>
      </section>
      {error ? <p className="data-error">Data error: {error}</p> : null}
      {data ? (
        <div className="route-stack">
          <section className="metric-grid" aria-label="Commodities metrics">
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
          <DataStatusTable seriesIds={commodityStatusIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
