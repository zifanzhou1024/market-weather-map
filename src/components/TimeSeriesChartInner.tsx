import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import ChartResponsiveContainer from "./ChartResponsiveContainer";
import { formatNumber } from "../lib/formatters";
import type { TimeSeriesChartProps } from "./TimeSeriesChart";

export default function TimeSeriesChartInner({ series, catalogEntry }: TimeSeriesChartProps) {
  const data = series.observations.slice(-260);

  return (
    <section className="panel chart-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">History</p>
          <h3>{catalogEntry?.name ?? series.series_id}</h3>
        </div>
        <p>{catalogEntry?.units ?? series.units}</p>
      </div>
      <div className="chart-frame">
        <ChartResponsiveContainer>
          <LineChart data={data} margin={{ bottom: 8, left: 0, right: 20, top: 8 }}>
            <CartesianGrid stroke="#dfe5da" strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={36} tick={{ fill: "#607066", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "#607066", fontSize: 12 }}
              tickFormatter={(value: number) => formatNumber(value)}
              width={64}
            />
            <Tooltip
              formatter={(value) => [formatNumber(Number(value)), catalogEntry?.units ?? series.units]}
              labelFormatter={(label) => String(label)}
            />
            <Line
              dataKey="value"
              dot={false}
              isAnimationActive={false}
              name={catalogEntry?.name ?? series.series_id}
              stroke="#2f6f73"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartResponsiveContainer>
      </div>
    </section>
  );
}
