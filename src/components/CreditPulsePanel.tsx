import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { useT } from "../lib/i18n";

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

interface PulseMetricProps {
  catalog: SeriesCatalogEntry[];
  series?: TimeSeriesFile;
  seriesId: string;
  unavailableLabel: string;
  unavailableMessage: string;
  changePrefix: string;
  lastObservationPrefix: string;
}

function PulseMetric({
  catalog,
  series,
  seriesId,
  unavailableLabel,
  unavailableMessage,
  changePrefix,
  lastObservationPrefix,
}: PulseMetricProps) {
  const current = latest(series);
  const catalogEntry = catalog.find((entry) => entry.id === seriesId);
  const units = catalogEntry?.units ?? series?.units ?? "";
  const isAvailable = current.value !== null;

  return (
    <article className="metric-card">
      <p className="metric-source">{seriesName(seriesId, catalog)}</p>
      <strong>{isAvailable ? `${formatNumber(current.value)} ${units}` : unavailableLabel}</strong>
      <p>
        {isAvailable
          ? `${changePrefix} ${formatSigned(current.change)}; ${lastObservationPrefix} ${formatDate(current.date)}.`
          : unavailableMessage}
      </p>
    </article>
  );
}

export default function CreditPulsePanel({ catalog, highYieldOas, hyMinusIgOas }: CreditPulsePanelProps) {
  const { t } = useT();
  const labels = {
    unavailableLabel: t("chrome.unavailable"),
    unavailableMessage: t("panels.metricUnavailable"),
    changePrefix: t("panels.metricChange1W"),
    lastObservationPrefix: t("panels.lastObservationPrefix"),
  };
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.credit")}</p>
          <h3>{t("sections.creditPulse")}</h3>
          <p>{t("panels.creditPulseDesc")}</p>
        </div>
      </div>
      <div className="metric-grid">
        <PulseMetric catalog={catalog} series={highYieldOas} seriesId="high_yield_oas" {...labels} />
        <PulseMetric catalog={catalog} series={hyMinusIgOas} seriesId="hy_minus_ig_oas" {...labels} />
      </div>
    </section>
  );
}
