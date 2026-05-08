import MultiSeriesChart, { type MultiSeriesChartSeries } from "./MultiSeriesChart";
import { formatNumber } from "../lib/formatters";
import { classifyNearTermEventVol, classifyVixProxy } from "../lib/horizon";
import type { TimeSeriesFile } from "../lib/types";

interface VolatilityTermStructurePanelProps {
  vix?: TimeSeriesFile;
  vix9d?: TimeSeriesFile;
  vix3m?: TimeSeriesFile;
  chartSeries: MultiSeriesChartSeries[];
}

function latestValue(series?: TimeSeriesFile) {
  const latestObservation = series?.observations[series.observations.length - 1];
  return series?.summary?.latest_value ?? latestObservation?.value ?? null;
}

function ratioText(value: number | null) {
  return value === null ? "N/A" : formatNumber(value);
}

export default function VolatilityTermStructurePanel({
  chartSeries,
  vix,
  vix3m,
  vix9d
}: VolatilityTermStructurePanelProps) {
  const vixValue = latestValue(vix);
  const vix3mValue = latestValue(vix3m);
  const vix9dValue = latestValue(vix9d);
  const curveState = classifyVixProxy(vixValue, vix3mValue);
  const eventVolState = classifyNearTermEventVol(vix9dValue, vixValue);

  return (
    <>
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Volatility</p>
            <h3>Volatility term-structure</h3>
            <p>VIX, VIX9D, and VIX3M define the active short-term volatility curve proxy.</p>
          </div>
        </div>
        <div className="metric-grid">
          <article className="metric-card">
            <p className="metric-source">VIX / VIX3M</p>
            <strong>{curveState.label}</strong>
            <p>Ratio {ratioText(curveState.ratio)}.</p>
          </article>
          <article className="metric-card">
            <p className="metric-source">VIX9D / VIX</p>
            <strong>{eventVolState.label}</strong>
            <p>Ratio {ratioText(eventVolState.ratio)}.</p>
          </article>
        </div>
      </section>
      <MultiSeriesChart series={chartSeries} title="VIX term-structure proxy" units="index" />
    </>
  );
}
