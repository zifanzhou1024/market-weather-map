import { useEffect, useState } from "react";
import GrowthLaborMatrixHero from "../charts/GrowthLaborMatrixHero";
import DataGapPanel from "../DataGapPanel";
import DataStatusTable from "../DataStatusTable";
import InterpretationPanel from "../InterpretationPanel";
import MetricCard from "../MetricCard";
import PageInsightHero from "../PageInsightHero";
import RouteDataFooter from "../RouteDataFooter";
import TimeSeriesChart from "../TimeSeriesChart";
import { loadCatalog, loadDataStatus } from "../../lib/data";
import type { DataStatusFile, SeriesCatalogEntry, TimeSeriesFile } from "../../lib/types";
import { hasObservations, loadRouteSeries } from "../../routes/routeSeries";

const growthSeriesIds = [
  "cfnai",
  "cfnai_3m_avg",
  "real_retail_sales",
  "industrial_production",
  "durable_goods_orders"
];
const laborSeriesIds = ["unemployment_rate", "nonfarm_payrolls", "initial_claims", "sahm_rule"];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  growthSeries: TimeSeriesFile[];
  laborSeries: TimeSeriesFile[];
  status: DataStatusFile;
}

export default function GrowthTab() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadGrowth() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const [growthSeries, laborSeries] = await Promise.all([
          loadRouteSeries(growthSeriesIds, catalog, status),
          loadRouteSeries(laborSeriesIds, catalog, status)
        ]);
        if (active) setData({ catalog, growthSeries, laborSeries, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load growth data.");
      }
    }

    void loadGrowth();

    return () => {
      active = false;
    };
  }, []);

  const cfnai = data?.growthSeries.find((series) => series.series_id === "cfnai");
  const cfnai3mAvg = data?.growthSeries.find((series) => series.series_id === "cfnai_3m_avg");
  const realRetailSales = data?.growthSeries.find(
    (series) => series.series_id === "real_retail_sales"
  );
  const industrialProduction = data?.growthSeries.find(
    (series) => series.series_id === "industrial_production"
  );
  const durableGoodsOrders = data?.growthSeries.find(
    (series) => series.series_id === "durable_goods_orders"
  );
  const unemploymentRate = data?.laborSeries.find(
    (series) => series.series_id === "unemployment_rate"
  );
  const nonfarmPayrolls = data?.laborSeries.find(
    (series) => series.series_id === "nonfarm_payrolls"
  );
  const initialClaims = data?.laborSeries.find((series) => series.series_id === "initial_claims");
  const sahmRule = data?.laborSeries.find((series) => series.series_id === "sahm_rule");
  const heroAllReady =
    sahmRule &&
    initialClaims &&
    unemploymentRate &&
    nonfarmPayrolls &&
    durableGoodsOrders &&
    realRetailSales &&
    industrialProduction &&
    cfnai3mAvg &&
    cfnai;
  const heroHasObservations =
    heroAllReady &&
    [
      sahmRule,
      initialClaims,
      unemploymentRate,
      nonfarmPayrolls,
      durableGoodsOrders,
      realRetailSales,
      industrialProduction,
      cfnai3mAvg,
      cfnai
    ].some((series) => series.observations.length > 0);

  return (
    <section data-testid="growth-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="growth" />
          {/* SLOT:growth_primary_chart */}
          {heroAllReady && heroHasObservations ? (
            <GrowthLaborMatrixHero
              sahmRule={sahmRule}
              initialClaims={initialClaims}
              unemploymentRate={unemploymentRate}
              nonfarmPayrolls={nonfarmPayrolls}
              durableGoodsOrders={durableGoodsOrders}
              realRetailSales={realRetailSales}
              industrialProduction={industrialProduction}
              cfnai3mAvg={cfnai3mAvg}
              cfnai={cfnai}
            />
          ) : (
            <section className="panel chart-panel" aria-label="Growth, labor, and recession-risk percentile strip">
              <p>Growth, labor, and recession-risk percentile strip unavailable until growth and labor history are active.</p>
            </section>
          )}
          <InterpretationPanel
            label="Growth and labor read"
            notes={["Monthly growth and labor data can lag source release schedules."]}
            risks={["Rising claims, unemployment, or Sahm Rule pressure can indicate recession risk."]}
            summary="Growth combines activity breadth, real demand, production, durable goods, labor momentum, and recession-risk indicators."
            supports={["Firm CFNAI, retail sales, production, and payroll inputs support the macro climate score."]}
          />
          <section className="metric-grid" aria-label="Growth metrics">
            {data.growthSeries.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          <section className="route-stack" aria-labelledby="labor-risk-heading">
            <div className="section-heading">
              <h3 id="labor-risk-heading">Labor and recession risk</h3>
            </div>
            <section className="metric-grid" aria-label="Labor and recession risk metrics">
              {data.laborSeries.map((series) => (
                <MetricCard
                  catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                  key={series.series_id}
                  series={series}
                />
              ))}
            </section>
          </section>
          {hasObservations(cfnai) ? (
            <TimeSeriesChart catalogEntry={data.catalog.find((entry) => entry.id === "cfnai")} series={cfnai} />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "cfnai")?.name ?? "cfnai"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "cfnai")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <RouteDataFooter route="growth">
            <DataGapPanel status={data.status} seriesIds={growthSeriesIds.concat(laborSeriesIds)} />
            <DataStatusTable seriesIds={[...growthSeriesIds, ...laborSeriesIds]} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </section>
  );
}
