import { useEffect, useState } from "react";
import SentimentPositioningHero from "../components/charts/SentimentPositioningHero";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import PageInsightHero from "../components/PageInsightHero";
import RouteDataFooter from "../components/RouteDataFooter";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadCatalog, loadDataStatus, loadSeries } from "../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const sentimentSeriesIds = ["cftc_sp500_asset_mgr_net", "cftc_sp500_lev_money_net"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function Sentiment() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSentiment() {
      try {
        const [catalog, status, series] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          Promise.all(sentimentSeriesIds.map((seriesId) => loadSeries(seriesId)))
        ]);
        if (active) setData({ catalog, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load sentiment data.");
      }
    }

    void loadSentiment();

    return () => {
      active = false;
    };
  }, []);

  const assetManager = data?.series.find((series) => series.series_id === "cftc_sp500_asset_mgr_net");
  const leveragedMoney = data?.series.find((series) => series.series_id === "cftc_sp500_lev_money_net");

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Sentiment & Positioning</p>
        <h2>Sentiment & Positioning</h2>
        <p>S&P 500 asset manager and leveraged money net positioning from CFTC public data.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="sentiment" />
          {/* SLOT:sentiment_primary_chart */}
          {assetManager && leveragedMoney ? (
            <SentimentPositioningHero
              assetManagerNet={assetManager}
              leveragedMoneyNet={leveragedMoney}
            />
          ) : null}
          <InterpretationPanel
            label="Active data is positioning only"
            notes={[
              "CFTC positioning is weekly, delayed, and futures-specific.",
              "Survey sentiment, options sentiment, fund flows, and exposure indexes remain candidate sources."
            ]}
            risks={["Very high leveraged-money positioning can indicate crowding risk."]}
            summary="This page currently shows CFTC E-mini S&P 500 asset-manager and leveraged-money positioning. It should not be read as a complete sentiment model."
            supports={["Low or moderate positioning can describe underexposure context."]}
          />
          <section className="metric-grid" aria-label="Sentiment metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {leveragedMoney ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "cftc_sp500_lev_money_net")}
              series={leveragedMoney}
            />
          ) : null}
          <RouteDataFooter route="sentiment">
            <DataGapPanel seriesIds={sentimentSeriesIds} status={data.status} />
            <DataStatusTable seriesIds={sentimentSeriesIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </main>
  );
}
