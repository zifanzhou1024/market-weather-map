import { lazy, Suspense } from "react";
import type { SeriesCatalogEntry, TimeSeriesFile } from "../lib/types";

const TimeSeriesChartInner = lazy(() => import("./TimeSeriesChartInner"));

export interface TimeSeriesChartProps {
  series: TimeSeriesFile;
  catalogEntry?: SeriesCatalogEntry;
}

export default function TimeSeriesChart(props: TimeSeriesChartProps) {
  return (
    <Suspense fallback={<TimeSeriesChartFallback {...props} />}>
      <TimeSeriesChartInner {...props} />
    </Suspense>
  );
}

function TimeSeriesChartFallback({ series, catalogEntry }: TimeSeriesChartProps) {
  return (
    <section className="panel chart-panel" aria-busy="true">
      <div className="section-header">
        <div>
          <p className="eyebrow">History</p>
          <h3>{catalogEntry?.name ?? series.series_id}</h3>
        </div>
        <p>{catalogEntry?.units ?? series.units}</p>
      </div>
      <div className="chart-frame chart-frame--loading">Loading chart</div>
    </section>
  );
}
