import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import PercentileBandChart from "../components/PercentileBandChart";
import SourceNote from "../components/SourceNote";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadSeries } from "../lib/data";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

interface RouteState {
  catalogEntry?: SeriesCatalogEntry;
  series: TimeSeriesFile;
}

export default function Volatility() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVolatility() {
      try {
        const [catalog, series] = await Promise.all([loadCatalog(), loadSeries("vix")]);
        if (active) setData({ catalogEntry: catalog.find((entry) => entry.id === "vix"), series });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load volatility data.");
      }
    }

    void loadVolatility();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Volatility</p>
        <h2>VIX state</h2>
        <p>Delayed Cboe VIX history with percentile context.</p>
      </section>
      {error ? <p className="data-error">Data error: {error}</p> : null}
      {data ? (
        <div className="route-stack">
          <section className="metric-grid single">
            <MetricCard catalogEntry={data.catalogEntry} series={data.series} />
          </section>
          <div className="detail-grid">
            <PercentileBandChart percentile={data.series.summary?.percentile_252d} />
            <SourceNote catalogEntry={data.catalogEntry} series={data.series} />
          </div>
          <TimeSeriesChart catalogEntry={data.catalogEntry} series={data.series} />
        </div>
      ) : null}
    </main>
  );
}
