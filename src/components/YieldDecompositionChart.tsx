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
import type { RegimeSnapshotFile } from "../lib/types";

const lines = [
  { id: "nominal_10y", name: "10Y nominal", color: "#2f6f73" },
  { id: "real_yield_10y", name: "10Y real yield", color: "#31516b" },
  { id: "breakeven_10y", name: "10Y breakeven", color: "#b76f2b" }
] as const;

export default function YieldDecompositionChart({
  data
}: {
  data: RegimeSnapshotFile["yield_decomposition"];
}) {
  return (
    <section className="panel chart-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Rates</p>
          <h3>Yield decomposition</h3>
        </div>
        <p>percent</p>
      </div>
      <ul className="chart-legend" aria-label="Yield decomposition legend">
        {lines.map((line) => (
          <li key={line.id}>
            <span style={{ backgroundColor: line.color }} />
            {line.name}
          </li>
        ))}
      </ul>
      {data.length ? (
        <div className="chart-frame">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={data} margin={{ bottom: 8, left: 0, right: 20, top: 8 }}>
              <CartesianGrid stroke="#dfe5da" strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={36} tick={{ fill: "#607066", fontSize: 12 }} />
              <YAxis tick={{ fill: "#607066", fontSize: 12 }} tickFormatter={(value) => formatNumber(value)} width={64} />
              <Tooltip formatter={(value) => [formatNumber(Number(value)), "percent"]} labelFormatter={(label) => String(label)} />
              {lines.map((line) => (
                <Line
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
      ) : (
        <p>No yield decomposition data is available.</p>
      )}
    </section>
  );
}
