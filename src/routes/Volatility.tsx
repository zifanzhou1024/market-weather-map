import { useEffect, useState } from "react";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import PercentileBandChart from "../components/PercentileBandChart";
import SourceNote from "../components/SourceNote";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadSeries } from "../lib/data";
import type { DataStatusFile, DerivedSeriesFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { loadRouteDerivedSeries } from "./routeSeries";

const volatilitySeriesIds = ["vix", "vvix", "vix9d", "vix3m"];
const volatilityDerivedIds = ["vix9d_vix_ratio", "vix_vix3m_ratio"];
const volatilityStatusIds = [...volatilitySeriesIds, ...volatilityDerivedIds];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  derived: DerivedSeriesFile[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

function volatilityDerivedEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  return {
    category: "volatility",
    frequency: series.frequency,
    higher_is: "contextual",
    id: series.series_id,
    max_stale_days: 7,
    name: series.series_id === "vix9d_vix_ratio" ? "VIX9D / VIX" : "VIX / VIX3M",
    notes: series.method,
    public: true,
    source: series.source,
    source_url: series.source_url,
    units: series.units
  };
}

export default function Volatility() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVolatility() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const [series, derived] = await Promise.all([
          Promise.all(volatilitySeriesIds.map((seriesId) => loadSeries(seriesId))),
          loadRouteDerivedSeries(volatilityDerivedIds, [], status, {
            allowMissing: new Set(volatilityDerivedIds)
          })
        ]);
        if (active) setData({ catalog, derived, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load volatility data.");
      }
    }

    void loadVolatility();

    return () => {
      active = false;
    };
  }, []);

  const vix = data?.series.find((series) => series.series_id === "vix");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Volatility</p>
        <h2>VIX state</h2>
        <p>Delayed Cboe volatility term-structure history with percentile context.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <InterpretationPanel
            label="Cboe volatility curve"
            summary="Spot VIX, very-short-dated VIX9D, 3-month VIX3M, and VVIX describe equity volatility level, curve shape, and volatility-of-volatility."
            supports={["Lower or contained VIX and VVIX can support risk appetite."]}
            risks={["Elevated front-end volatility or an inverted VIX curve can indicate near-term stress."]}
            notes={["Ratios are derived from matched public Cboe volatility observations."]}
          />
          <section className="metric-grid" aria-label="Volatility metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
            {data.derived.map((series) => (
              <MetricCard catalogEntry={volatilityDerivedEntry(series)} key={series.series_id} series={series} />
            ))}
          </section>
          {vix ? (
            <>
              <div className="detail-grid">
                <PercentileBandChart percentile={vix.summary?.percentile_252d} />
                <SourceNote catalogEntry={data.catalog.find((entry) => entry.id === "vix")} series={vix} />
              </div>
              <TimeSeriesChart catalogEntry={data.catalog.find((entry) => entry.id === "vix")} series={vix} />
            </>
          ) : null}
          <DataStatusTable seriesIds={volatilityStatusIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
