import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";
import { useT } from "../lib/i18n";

interface LiquidityPulsePanelProps {
  netLiquidity?: TimeSeriesFile;
  catalog: SeriesCatalogEntry[];
}

function latest(series?: TimeSeriesFile) {
  const latestObservation = series?.observations[series.observations.length - 1];
  return {
    change: series?.summary?.change_1m ?? series?.summary?.change_1w ?? null,
    date: series?.summary?.latest_date ?? latestObservation?.date ?? null,
    value: series?.summary?.latest_value ?? latestObservation?.value ?? null
  };
}

export default function LiquidityPulsePanel({ catalog, netLiquidity }: LiquidityPulsePanelProps) {
  const { t } = useT();
  const current = latest(netLiquidity);
  const catalogEntry = catalog.find((entry) => entry.id === "net_liquidity");
  const units = netLiquidity?.units ?? catalogEntry?.units ?? "";
  const isAvailable = current.value !== null;

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("sections.liquidity")}</p>
          <h3>{t("sections.liquidityPulse")}</h3>
          <p>{t("panels.liquidityPulseDesc")}</p>
        </div>
      </div>
      <div className="metric-grid">
        <article className="metric-card">
          <p className="metric-source">{catalogEntry?.name ?? t("panels.netLiquidity")}</p>
          <strong>{isAvailable ? `${formatNumber(current.value)} ${units}` : t("chrome.unavailable")}</strong>
          <p>
            {isAvailable
              ? `${t("panels.metricChangePrefix")} ${formatSigned(current.change)}; ${t("panels.lastObservationPrefix")} ${formatDate(current.date)}.`
              : t("panels.metricUnavailable")}
          </p>
        </article>
      </div>
    </section>
  );
}
