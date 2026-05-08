import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

interface CreditPulsePanelProps {
  highYieldOas?: TimeSeriesFile;
  hyMinusIgOas?: TimeSeriesFile;
  catalog: SeriesCatalogEntry[];
}

function latest(series?: TimeSeriesFile) {
  const latestObservation = series?.observations[series.observations.length - 1];
  return {
    change: series?.summary?.change_1w ?? null,
    date: series?.summary?.latest_date ?? latestObservation?.date ?? null,
    value: series?.summary?.latest_value ?? latestObservation?.value ?? null
  };
}

function seriesName(seriesId: string, catalog: SeriesCatalogEntry[]) {
  const derivedNames: Record<string, string> = {
    hy_minus_ig_oas: "HY minus IG OAS"
  };
  return catalog.find((entry) => entry.id === seriesId)?.name ?? derivedNames[seriesId] ?? seriesId;
}

function PulseMetric({
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

export default function CreditPulsePanel({ catalog, highYieldOas, hyMinusIgOas }: CreditPulsePanelProps) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Credit</p>
          <h3>Credit pulse</h3>
          <p>High-yield spread level and the HY minus IG spread gap from already loaded credit rows.</p>
        </div>
      </div>
      <div className="metric-grid">
        <PulseMetric catalog={catalog} series={highYieldOas} seriesId="high_yield_oas" />
        <PulseMetric catalog={catalog} series={hyMinusIgOas} seriesId="hy_minus_ig_oas" />
      </div>
    </section>
  );
}
