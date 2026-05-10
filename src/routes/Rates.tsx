import { useEffect, useState } from "react";
import CandidateDiagnosticPanel from "../components/CandidateDiagnosticPanel";
import DataGapPanel from "../components/DataGapPanel";
import DataStatusTable from "../components/DataStatusTable";
import InterpretationPanel from "../components/InterpretationPanel";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import YieldDecompositionChart from "../components/YieldDecompositionChart";
import { loadCatalog, loadDataStatus, loadDerivedSeries, loadRegimeSnapshot } from "../lib/data";
import { directionLabel, yieldDriverLabel } from "../lib/regime";
import type {
  DataStatusFile,
  DerivedSeriesFile,
  DirectionState,
  RegimeSnapshotFile,
  SeriesCatalogEntry,
  TimeSeriesFile
} from "../lib/types";
import { hasObservations, loadRouteSeries } from "./routeSeries";

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

export default function Rates() {
  const [data, setData] = useState<RouteState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRates() {
      try {
        const [catalog, status, snapshot] = await Promise.all([
          loadCatalog(),
          loadDataStatus(),
          loadRegimeSnapshot()
        ]);
        const [series, diagnosticSeries, curve] = await Promise.all([
          loadRouteSeries(ratesSeriesIds, catalog, status),
          loadRouteSeries(treasurySupplyDiagnosticIds, catalog, status, {
            allowMissing: new Set(treasurySupplyDiagnosticIds)
          }),
          loadDerivedSeries("us10y_minus_us2y")
        ]);
        if (active) setData({ catalog, curve, diagnosticSeries, snapshot, series, status });
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
        units: data.curve.units
      }
    : undefined;

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Rates & Policy</p>
        <h2>Rates & Policy</h2>
        <p>Nominal yields, real yields, and breakevens.</p>
      </section>
      {error ? (
        <p className="data-error" role="alert">
          Data error: {error}
        </p>
      ) : null}
      {data ? (
        <div className="route-stack">
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
          <YieldDecompositionChart data={data.snapshot.yield_decomposition} />
          <DataStatusTable seriesIds={ratesSeriesIds} status={data.status} />
        </div>
      ) : null}
    </main>
  );
}
