import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import { formatNumber, formatSigned } from "../lib/formatters";
import { safeNumber } from "../lib/regime";
import type { RegimeSnapshotFile } from "../lib/types";

export default function RegimeQuadrantChart({
  trail
}: {
  trail: RegimeSnapshotFile["quadrant_trail"];
}) {
  const data = trail
    .map((point) => ({
      ...point,
      dollar_change: safeNumber(point.dollar_change),
      real_yield_change: safeNumber(point.real_yield_change)
    }))
    .filter((point) => point.dollar_change !== null && point.real_yield_change !== null);

  return (
    <section className="panel chart-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Regime map</p>
          <h3>Dollar and real-yield quadrant</h3>
        </div>
        <p>change</p>
      </div>
      <div className="quadrant-frame">
        <span className="quadrant-label quadrant-label--top-left">Strong risk-on</span>
        <span className="quadrant-label quadrant-label--top-right">Reallocation / rotation</span>
        <span className="quadrant-label quadrant-label--bottom-right">Tightening / risk-off</span>
        <span className="quadrant-label quadrant-label--bottom-left">Bonds-first / safe haven</span>
        {data.length ? (
          <ResponsiveContainer height="100%" width="100%">
            <ScatterChart margin={{ bottom: 20, left: 0, right: 20, top: 20 }}>
              <CartesianGrid stroke="#dfe5da" strokeDasharray="3 3" />
              <XAxis
                dataKey="dollar_change"
                name="Dollar"
                tick={{ fill: "#607066", fontSize: 12 }}
                tickFormatter={(value) => formatNumber(value)}
                type="number"
              />
              <YAxis
                dataKey="real_yield_change"
                name="Real yield"
                tick={{ fill: "#607066", fontSize: 12 }}
                tickFormatter={(value) => formatNumber(value)}
                type="number"
                width={64}
              />
              <ZAxis range={[56, 56]} />
              <ReferenceLine stroke="#9aa79d" x={0} />
              <ReferenceLine stroke="#9aa79d" y={0} />
              <Tooltip
                formatter={(value, name) => [formatSigned(Number(value)), String(name)]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
              />
              <Scatter data={data} fill="#2f6f73" isAnimationActive={false} line={{ stroke: "#2f6f73", strokeWidth: 1.5 }} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <p>No quadrant trail data is available.</p>
        )}
      </div>
    </section>
  );
}
