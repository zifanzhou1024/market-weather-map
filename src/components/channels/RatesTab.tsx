import { useEffect, useState } from "react";
import CandidateDiagnosticPanel from "../CandidateDiagnosticPanel";
import DataGapPanel from "../DataGapPanel";
import DataStatusTable from "../DataStatusTable";
import FocusBlock from "../FocusBlock";
import InterpretationPanel from "../InterpretationPanel";
import MetricCard from "../MetricCard";
import PageInsightHero from "../PageInsightHero";
import RouteDataFooter from "../RouteDataFooter";
import TimeSeriesChart from "../TimeSeriesChart";
import YieldChangeWaterfallChart from "../charts/YieldChangeWaterfallChart";
import YieldCurveComparisonChart from "../charts/YieldCurveComparisonChart";
import YieldDecompositionChart from "../YieldDecompositionChart";
import YieldDecompositionStackChart from "../charts/YieldDecompositionStackChart";
import {
  loadCatalog,
  loadDataStatus,
  loadDerivedSeries,
  loadPageInsights,
  loadRatesDashboard,
  loadRegimeSnapshot
} from "../../lib/data";
import { directionLabel, yieldDriverLabel } from "../../lib/regime";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  DirectionState,
  PageInsightsFile,
  RatesDashboardFile,
  RegimeSnapshotFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../../lib/types";
import { hasObservations, loadRouteSeries } from "../../routes/routeSeries";

const ratesSeriesIds = [
  "us2y",
  "us10y",
  "us20y",
  "us30y",
  "real_yield_5y",
  "real_yield_10y",
  "breakeven_5y",
  "breakeven_10y",
  "forward_inflation_5y5y"
];
const treasurySupplyDiagnosticIds = [
  "monthly_treasury_deficit_surplus",
  "monthly_treasury_receipts",
  "monthly_treasury_outlays",
  "treasury_auction_supply"
];

interface RouteState {
  catalog: SeriesCatalogEntry[];
  curve: DerivedSeriesFile;
  diagnosticSeries: TimeSeriesFile[];
  ratesDashboard: RatesDashboardFile | null;
  snapshot: RegimeSnapshotFile;
  series: TimeSeriesFile[];
  status: DataStatusFile;
}

function breakevenDirection(snapshot: RegimeSnapshotFile): DirectionState {
  const latest = snapshot.yield_decomposition[snapshot.yield_decomposition.length - 1];
  const previous = snapshot.yield_decomposition[snapshot.yield_decomposition.length - 2];
  if (!latest || !previous) return "unavailable";

  if (latest.breakeven_10y > previous.breakeven_10y) return "up";
  if (latest.breakeven_10y < previous.breakeven_10y) return "down";
  return "flat";
}

export default function RatesTab() {
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

    async function loadRates() {
      try {
        const [catalog, status, snapshot, ratesDashboard] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          loadRegimeSnapshot(),
          loadRatesDashboard()
        ]);
        const [series, diagnosticSeries, curve] = await Promise.all([
          loadRouteSeries(ratesSeriesIds, catalog, status),
          loadRouteSeries(treasurySupplyDiagnosticIds, catalog, status, {
            allowMissing: new Set(treasurySupplyDiagnosticIds)
          }),
          loadDerivedSeries("us10y_minus_us2y")
        ]);
        if (active)
          setData({ catalog, curve, diagnosticSeries, ratesDashboard, snapshot, series, status });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load rates data.");
      }
    }

    void loadRates();

    return () => {
      active = false;
    };
  }, []);

  const us10y = data?.series.find((series) => series.series_id === "us10y");
  const curveCatalogEntry: SeriesCatalogEntry | undefined = data
    ? {
        category: "rates",
        frequency: data.curve.frequency,
        higher_is: "contextual",
        id: data.curve.series_id,
        max_stale_days: 7,
        name: "10Y-2Y spread",
        notes: data.curve.method,
        public: true,
        source: data.curve.source,
        source_url: data.curve.source_url,
        units: data.curve.units,
        access_status: "free_public_active",
        terms_status: "ok",
        score_status: "active",
        active_scoring_allowed: true,
        public_redistribution_allowed: true,
        requires_secret: false
      }
    : undefined;

  return (
    <section data-testid="rates-tab" className="channel-tab-body">
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
          <PageInsightHero route="rates" />
          {(() => {
            const section = pageInsights?.routes?.rates?.sections?.find(
              (s) => s.id === "rates_pressure"
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
          {/* SLOT:rates_primary_chart */}
          {data.ratesDashboard ? (
            <YieldChangeWaterfallChart data={data.ratesDashboard.yield_change_windows} />
          ) : (
            <p className="data-loading" role="status">
              Interactive rates view loading…
            </p>
          )}
          {/* SLOT:rates_secondary_charts */}
          {data.ratesDashboard ? (
            <>
              <YieldCurveComparisonChart data={data.ratesDashboard.curve_snapshots} />
              <YieldDecompositionStackChart data={data.ratesDashboard.current_decomposition} />
            </>
          ) : null}
          <InterpretationPanel
            label="Rates and policy read"
            notes={["Real-yield and breakeven data are daily market-implied context, not policy forecasts."]}
            risks={["Elevated real yields can tighten financial conditions and pressure valuation-sensitive assets."]}
            summary="Nominal yields, real yields, breakevens, and the 10Y-2Y curve describe policy-rate pressure, inflation compensation, and curve regime."
            supports={["Falling real yields or less inverted curves can ease market weather pressure."]}
          />
          <InterpretationPanel
            label="10Y yield decomposition"
            notes={[
              `Real yield direction: ${directionLabel(data.snapshot.regime.tips_direction)}`,
              `Breakeven direction: ${directionLabel(breakevenDirection(data.snapshot))}`,
              `Nominal-yield direction: ${directionLabel(data.snapshot.regime.nominal_yield_direction)}`
            ]}
            summary={`Yield driver: ${yieldDriverLabel(data.snapshot.regime.yield_driver)}`}
          />
          {hasObservations(us10y) ? (
            <TimeSeriesChart
              catalogEntry={data.catalog.find((entry) => entry.id === "us10y")}
              series={us10y}
            />
          ) : (
            <section className="panel chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>{data.catalog.find((entry) => entry.id === "us10y")?.name ?? "us10y"}</h3>
                </div>
                <p>{data.catalog.find((entry) => entry.id === "us10y")?.units ?? ""}</p>
              </div>
              <p>Featured chart unavailable until source data is available.</p>
            </section>
          )}
          <section className="route-stack" aria-labelledby="yield-decomposition-history-heading">
            <div className="section-header">
              <div>
                <p className="eyebrow">History</p>
                <h3 id="yield-decomposition-history-heading">Yield decomposition history</h3>
              </div>
            </div>
            <YieldDecompositionChart data={data.snapshot.yield_decomposition} />
          </section>
          <section className="metric-grid" aria-label="Rates metrics">
            {data.series.map((series) => (
              <MetricCard
                catalogEntry={data.catalog.find((entry) => entry.id === series.series_id)}
                key={series.series_id}
                series={series}
              />
            ))}
            <MetricCard catalogEntry={curveCatalogEntry} series={data.curve} />
          </section>
          <RouteDataFooter route="rates">
            <DataGapPanel status={data.status} seriesIds={ratesSeriesIds.concat(["us10y_minus_us2y"])} />
            <CandidateDiagnosticPanel
              catalog={data.catalog}
              diagnosticIds={treasurySupplyDiagnosticIds}
              eyebrow="Official/public diagnostics"
              series={data.diagnosticSeries}
              status={data.status}
              summary="FiscalData Treasury supply rows are generated as static candidate diagnostics for rates context only."
              title="Treasury supply diagnostics"
            />
            <DataStatusTable seriesIds={ratesSeriesIds} status={data.status} />
          </RouteDataFooter>
        </div>
      ) : null}
    </section>
  );
}
