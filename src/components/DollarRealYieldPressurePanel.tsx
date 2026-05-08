import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { RegimeSnapshotFile, SeriesCatalogEntry, TimeSeriesFile, YieldDriver } from "../lib/types";

interface DollarRealYieldPressurePanelProps {
  broadDollar?: TimeSeriesFile;
  realYield10y?: TimeSeriesFile;
  snapshot: RegimeSnapshotFile;
  catalog: SeriesCatalogEntry[];
}

const yieldDriverLabels: Record<YieldDriver, string> = {
  breakeven_inflation_driven: "Breakeven inflation driven",
  mixed: "Mixed",
  real_yield_driven: "Real-yield driven",
  real_yield_easing: "Real-yield easing",
  safe_haven_or_growth_scare: "Safe-haven or growth scare",
  unavailable: "Unavailable"
};

function latest(series?: TimeSeriesFile) {
  const latestObservation = series?.observations[series.observations.length - 1];
  return {
    change: series?.summary?.change_1w ?? null,
    date: series?.summary?.latest_date ?? latestObservation?.date ?? null,
    value: series?.summary?.latest_value ?? latestObservation?.value ?? null
  };
}

function seriesName(seriesId: string, catalog: SeriesCatalogEntry[]) {
  return catalog.find((entry) => entry.id === seriesId)?.name ?? seriesId;
}

function PressureMetric({
  catalog,
  series,
  seriesId
}: {
  catalog: SeriesCatalogEntry[];
  series?: TimeSeriesFile;
  seriesId: string;
}) {
  const current = latest(series);
  const catalogEntry = catalog.find((entry) => entry.id === seriesId);
  const units = catalogEntry?.units ?? series?.units ?? "";
  const isAvailable = current.value !== null;

  return (
    <article className="metric-card">
      <p className="metric-source">{seriesName(seriesId, catalog)}</p>
      <strong>{isAvailable ? `${formatNumber(current.value)} ${units}` : "Unavailable"}</strong>
      <p>
        {isAvailable
          ? `1W change ${formatSigned(current.change)}; last observation ${formatDate(current.date)}.`
          : "This row is unavailable in the loaded static data."}
      </p>
    </article>
  );
}

export default function DollarRealYieldPressurePanel({
  broadDollar,
  catalog,
  realYield10y,
  snapshot
}: DollarRealYieldPressurePanelProps) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Pressure</p>
          <h3>Dollar + real-yield pressure</h3>
          <p>Dollar direction, real-yield row availability, and the current regime snapshot yield driver.</p>
        </div>
      </div>
      <div className="metric-grid">
        <PressureMetric catalog={catalog} series={broadDollar} seriesId="broad_dollar" />
        <PressureMetric catalog={catalog} series={realYield10y} seriesId="real_yield_10y" />
        <article className="metric-card">
          <p className="metric-source">Yield driver</p>
          <strong>{yieldDriverLabels[snapshot.regime.yield_driver]}</strong>
          <p>Dollar direction {snapshot.regime.dollar_direction}; TIPS direction {snapshot.regime.tips_direction}.</p>
        </article>
      </div>
    </section>
  );
}
