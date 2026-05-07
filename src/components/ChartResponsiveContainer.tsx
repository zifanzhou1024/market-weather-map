import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

export const INITIAL_CHART_DIMENSION = {
  height: 340,
  width: 640
} as const;

export default function ChartResponsiveContainer({ children }: { children: ReactNode }) {
  return (
    <ResponsiveContainer height="100%" initialDimension={INITIAL_CHART_DIMENSION} width="100%">
      {children}
    </ResponsiveContainer>
  );
}
