import { useEffect, useState } from "react";
import CreditSpreadMatrixHero from "../charts/CreditSpreadMatrixHero";
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
  DerivedSeriesFile,
  PageInsightsFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../../lib/types";
import { hasObservations, loadRouteDerivedSeries, loadRouteSeries } from "../../routes/routeSeries";

const creditSeriesIds = [
  "high_yield_oas",
  "investment_grade_oas",
  "bbb_oas",
  "financial_stress",
  "financial_conditions",
  "reserve_balances",
  "bank_credit",
  "loans_and_leases",
  "business_loans",
  "bank_deposits"
];
const creditStatusIds = ["hy_minus_ig_oas", ...creditSeriesIds];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  hyMinusIgOas: DerivedSeriesFile;
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

function creditDerivedEntry(series: DerivedSeriesFile): SeriesCatalogEntry {
  return {
    category: "credit",
    frequency: series.frequency,
    higher_is: "riskier",
    id: series.series_id,
    max_stale_days: 7,
    name: "HY minus IG OAS",
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

export default function CreditTab() {
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

    async function loadCredit() {
      try {
        const [catalog, status] = await Promise.all([loadCatalog(), loadDataStatus()]);
        const [series, [hyMinusIgOas]] = await Promise.all([
          loadRouteSeries(creditSeriesIds, catalog, status),
          loadRouteDerivedSeries(["hy_minus_ig_oas"], catalog, status, {
            allowMissing: new Set(["hy_minus_ig_oas"])
          })
        ]);
        if (active) setData({ catalog, hyMinusIgOas, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load credit data.");
      }
    }

    void loadCredit();

    return () => {
      active = false;
    };
  }, []);

  const financialStress = data?.series.find((series) => series.series_id === "financial_stress");
  const hyOasSeries = data?.series.find((series) => series.series_id === "high_yield_oas");
  const igOasSeries = data?.series.find((series) => series.series_id === "investment_grade_oas");
  const bbbOasSeries = data?.series.find((series) => series.series_id === "bbb_oas");
  const heroDataReady =
    hyOasSeries && igOasSeries && bbbOasSeries && data?.hyMinusIgOas;
  const heroHasObservations =
    heroDataReady &&
    (hyOasSeries.observations.length > 0 ||
      igOasSeries.observations.length > 0 ||
      bbbOasSeries.observations.length > 0);

  return (
    <section data-testid="credit-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="credit" />
          {(() => {
            const section = pageInsights?.routes?.credit?.sections?.find(
              (s) => s.id === "credit_dispersion"
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
          {/* SLOT:credit_primary_chart */}
          {heroDataReady && heroHasObservations ? (
            <CreditSpreadMatrixHero
              hyOas={hyOasSeries}
              igOas={igOasSeries}
              bbbOas={bbbOasSeries}
              hyMinusIgOas={data.hyMinusIgOas}
            />
          ) : (
            <section className="panel chart-panel" aria-label="Credit spread matrix">
              <p>Credit spread matrix unavailable until HY, IG, and BBB OAS data are active.</p>
            </section>
          )}
          <InterpretationPanel
            label="Credit stress and banking liquidity"
            summary="Credit spreads, stress indexes, and banking aggregates show whether funding stress is concentrated in risky credit or spreading through the banking system."
            supports={["Stable spreads and bank deposits can support easier credit conditions."]}
            risks={["A wider HY minus IG OAS spread points to lower-quality credit underperforming higher-quality credit."]}
            notes={["HY minus IG OAS is derived from matched high-yield and investment-grade option-adjusted spread observations."]}
          />
          <section className="metric-grid" aria-label="Credit and banking metrics">
            <MetricCard catalogEntry={creditDerivedEntry(data.hyMinusIgOas)} series={data.hyMinusIgOas} />
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
          </section>
          {hasObservations(financialStress) ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "financial_stress")}
              series={financialStress}
            />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "financial_stress")?.name ?? "financial_stress"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "financial_stress")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <RouteDataFooter route="credit">
            <DataGapPanel seriesIds={creditStatusIds} status={data.status} />
            <DataStatusTable seriesIds={creditStatusIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </section>
  );
}
