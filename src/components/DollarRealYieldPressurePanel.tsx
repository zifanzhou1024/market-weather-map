import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { RegimeSnapshotFile, SeriesCatalogEntry, TimeSeriesFile, YieldDriver } from "../lib/types";
import { useT } from "../lib/i18n";

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

interface PressureMetricProps {
  catalog: SeriesCatalogEntry[];
  series?: TimeSeriesFile;
  seriesId: string;
  unavailableLabel: string;
  unavailableMessage: string;
  changePrefix: string;
  lastObservationPrefix: string;
}

function PressureMetric({
  catalog,
  series,
  seriesId,
  unavailableLabel,
  unavailableMessage,
  changePrefix,
  lastObservationPrefix,
}: PressureMetricProps) {
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

export default function DollarRealYieldPressurePanel({
  broadDollar,
  catalog,
  realYield10y,
  snapshot
}: DollarRealYieldPressurePanelProps) {
  const { t, tCategorical } = useT();
  const labels = {
    unavailableLabel: t("chrome.unavailable"),
    unavailableMessage: t("panels.metricUnavailable"),
    changePrefix: t("panels.metricChange1W"),
    lastObservationPrefix: t("panels.lastObservationPrefix"),
  };
  const driverLabel = tCategorical("yieldDriver", yieldDriverLabels[snapshot.regime.yield_driver]);
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.pressure")}</p>
          <h3>{t("sections.dollarRealYieldPressure")}</h3>
          <p>{t("panels.dollarRealYieldDesc")}</p>
        </div>
      </div>
      <div className="metric-grid">
        <PressureMetric catalog={catalog} series={broadDollar} seriesId="broad_dollar" {...labels} />
        <PressureMetric catalog={catalog} series={realYield10y} seriesId="real_yield_10y" {...labels} />
        <article className="metric-card">
          <p className="metric-source">{t("sections.yieldDriver")}</p>
          <strong>{driverLabel}</strong>
          <p>
            {t("panels.yieldDriverDesc", {
              vars: { dollar: snapshot.regime.dollar_direction, tips: snapshot.regime.tips_direction },
            })}
          </p>
        </article>
      </div>
    </section>
  );
}
