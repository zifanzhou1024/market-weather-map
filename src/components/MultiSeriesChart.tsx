import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatNumber } from "../lib/formatters";
import { safeNumber } from "../lib/regime";

export interface MultiSeriesChartSeries {
  id: string;
  name: string;
  data: Array<{ date: string; value: number }>;
  color: string;
}

export default function MultiSeriesChart({
  title,
  units,
  series
}: {
  title: string;
  units: string;
  series: MultiSeriesChartSeries[];
}) {
  const chartData = mergeSeriesData(series);

  return (
    <section className="panel chart-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">History</p>
          <h3>{title}</h3>
        </div>
        <p>{units}</p>
      </div>
      {series.length ? (
        <>
          <ul className="chart-legend" aria-label={`${title} legend`}>
            {series.map((line) => (
              <li key={line.id}>
                <span style={{ backgroundColor: line.color }} />
                {line.name}
              </li>
            ))}
          </ul>
          <div className="chart-frame">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={chartData} margin={{ bottom: 8, left: 0, right: 20, top: 8 }}>
                <CartesianGrid stroke="#dfe5da" strokeDasharray="3 3" />
                <XAxis dataKey="date" minTickGap={36} tick={{ fill: "#607066", fontSize: 12 }} />
                <YAxis tick={{ fill: "#607066", fontSize: 12 }} tickFormatter={(value) => formatNumber(value)} width={64} />
                <Tooltip formatter={(value) => [formatNumber(Number(value)), units]} labelFormatter={(label) => String(label)} />
                {series.map((line) => (
                  <Line
                    connectNulls
                    dataKey={line.id}
                    dot={false}
                    isAnimationActive={false}
                    key={line.id}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={2}
                    type="monotone"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p>No chart series are available.</p>
      )}
    </section>
  );
}

function mergeSeriesData(series: MultiSeriesChartSeries[]) {
  const rows = new Map<string, Record<string, number | string | null>>();

  for (const line of series) {
    for (const point of line.data) {
      const row = rows.get(point.date) ?? { date: point.date };
      row[line.id] = safeNumber(point.value);
      rows.set(point.date, row);
    }
  }

  return Array.from(rows.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
