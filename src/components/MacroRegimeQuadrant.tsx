import { useMemo } from "react";
import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import { formatIsoDate, formatPercent, formatSignedScore } from "../charts/chartFormatters";
import type { RegimeSnapshotFile } from "../lib/types";

interface MacroRegimeQuadrantProps {
  trail: RegimeSnapshotFile["quadrant_trail"];
}

export interface QuadrantPoint {
  date: string;
  realYieldChange: number;
  dollarChange: number;
  vixPercentile: number | null;
  isLatest: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildQuadrantPoints(
  trail: RegimeSnapshotFile["quadrant_trail"]
): QuadrantPoint[] {
  const filtered = trail.filter(
    (entry) =>
      isFiniteNumber(entry.real_yield_change) && isFiniteNumber(entry.dollar_change)
  );
  return filtered.map((entry, index) => ({
    date: entry.date,
    realYieldChange: entry.real_yield_change as number,
    dollarChange: entry.dollar_change as number,
    vixPercentile: isFiniteNumber(entry.vix_percentile) ? (entry.vix_percentile as number) : null,
    isLatest: index === filtered.length - 1
  }));
}

interface ScatterPoint {
  value: [number, number, number];
  date: string;
  vixPercentile: number | null;
  isLatest: boolean;
  symbolSize: number;
  label?: { show: boolean; formatter: string; position: string; color: string; fontSize: number };
}

interface ScatterTooltipParams {
  data: ScatterPoint;
}

function buildOption(points: QuadrantPoint[]) {
  const VIX_PLACEHOLDER = -1;

  const scatterData: ScatterPoint[] = points.map((point) => ({
    value: [
      point.realYieldChange,
      point.dollarChange,
      point.vixPercentile ?? VIX_PLACEHOLDER
    ],
    date: point.date,
    vixPercentile: point.vixPercentile,
    isLatest: point.isLatest,
    symbolSize: point.isLatest ? 18 : 10,
    label: point.isLatest
      ? {
          show: true,
          formatter: formatIsoDate(point.date),
          position: "right",
          color: chartColors.text,
          fontSize: 11
        }
      : undefined
  }));

  return {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 32, bottom: 72, left: 64, right: 36 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (params: ScatterTooltipParams) => {
        const { date, value, vixPercentile } = params.data;
        const [realYield, dollar] = value;
        const lines = [
          formatIsoDate(date),
          `Real-yield change ${formatSignedScore(realYield, 2)}`,
          `Dollar change ${formatSignedScore(dollar, 2)}`
        ];
        if (vixPercentile !== null) {
          lines.push(`VIX % ${formatPercent(vixPercentile)}`);
        }
        return lines.join("<br/>");
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      name: "Real-yield change",
      nameLocation: "middle" as const,
      nameGap: 28,
      scale: true
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      name: "Dollar change",
      nameLocation: "middle" as const,
      nameGap: 44,
      scale: true
    },
    visualMap: {
      type: "continuous" as const,
      min: 0,
      max: 100,
      dimension: 2,
      calculable: true,
      orient: "horizontal" as const,
      left: "center",
      bottom: 4,
      text: ["High VIX %", "Low VIX %"],
      textStyle: { color: chartColors.muted, fontSize: 11 },
      inRange: {
        color: [chartColors.support, "#f0eee5", chartColors.warning]
      },
      outOfRange: {
        color: [chartColors.muted]
      }
    },
    series: [
      {
        type: "scatter" as const,
        data: scatterData,
        symbol: "circle",
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: chartColors.axis, type: "dashed" as const },
          data: [
            { xAxis: 0 },
            { yAxis: 0 }
          ]
        }
      }
    ]
  };
}

export default function MacroRegimeQuadrant({ trail }: MacroRegimeQuadrantProps) {
  const points = useMemo(() => buildQuadrantPoints(trail), [trail]);
  const option = useMemo(() => buildOption(points), [points]);

  if (points.length === 0) {
    return (
      <EChartPanel
        title="Macro regime quadrant trail"
        description="Recent strategic backdrop: real-yield change vs dollar change. Quadrants show whether the policy/USD regime tightens, eases, or rotates."
        state="empty"
        emptyMessage="No quadrant trail observations are available for the current snapshot."
        height={360}
      />
    );
  }

  return (
    <EChartPanel
      title="Macro regime quadrant trail"
      description="Recent strategic backdrop: real-yield change vs dollar change. Quadrants show whether the policy/USD regime tightens, eases, or rotates."
      state="ready"
      option={option}
      ariaLabel="Scatter plot of recent real-yield change vs dollar change, colored by VIX percentile"
      height={360}
    />
  );
}
