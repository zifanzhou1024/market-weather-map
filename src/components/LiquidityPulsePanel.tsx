import { formatDate, formatNumber, formatSigned } from "../lib/formatters";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

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
  const current = latest(netLiquidity);
  const catalogEntry = catalog.find((entry) => entry.id === "net_liquidity");
  const units = netLiquidity?.units ?? catalogEntry?.units ?? "";
  const isAvailable = current.value !== null;

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Liquidity</p>
          <h3>Liquidity pulse</h3>
          <p>Net liquidity from the already loaded derived static row.</p>
        </div>
      </div>
      <div className="metric-grid">
        <article className="metric-card">
          <p className="metric-source">{catalogEntry?.name ?? "Net liquidity proxy"}</p>
          <strong>{isAvailable ? `${formatNumber(current.value)} ${units}` : "Unavailable"}</strong>
          <p>
            {isAvailable
              ? `Recent change ${formatSigned(current.change)}; last observation ${formatDate(current.date)}.`
              : "This row is unavailable in the loaded static data."}
          </p>
        </article>
      </div>
    </section>
  );
}
