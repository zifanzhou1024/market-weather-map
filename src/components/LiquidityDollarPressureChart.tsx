import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartCategoricalPalette,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import type { TimeSeriesFile } from "../lib/types";

interface LiquidityDollarPressureChartProps {
  broadDollar?: TimeSeriesFile;
  realYield10y?: TimeSeriesFile;
}

function dataPoints(series?: TimeSeriesFile): Array<[string, number]> {
  if (!series) return [];
  return series.observations
    .filter((obs) => typeof obs.value === "number" && Number.isFinite(obs.value))
    .map((obs) => [obs.date, obs.value] as [string, number]);
}

export default function LiquidityDollarPressureChart({
  broadDollar,
  realYield10y
}: LiquidityDollarPressureChartProps) {
  const dollarData = dataPoints(broadDollar);
  const realYieldData = dataPoints(realYield10y);

  if (dollarData.length === 0 && realYieldData.length === 0) {
    return (
      <EChartPanel
        title="Dollar × real-yield pressure"
        description="Broad dollar and 10Y real yield on dual axes. Both up = global tightening pressure."
        state="empty"
        emptyMessage="Broad dollar and real yield are not currently active."
      />
    );
  }

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 32, bottom: 56 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      valueFormatter: (value: number) => value.toFixed(2)
    },
    legend: {
      data: ["Broad dollar", "10Y real yield"],
      bottom: 0,
      textStyle: { color: chartTextStyle.color, fontSize: 11 }
    },
    xAxis: { ...chartAxisDefaults, type: "time" as const },
    yAxis: [
      {
        ...chartAxisDefaults,
        type: "value" as const,
        name: "Broad dollar",
        nameTextStyle: { color: chartCategoricalPalette[6], fontSize: 11 },
        scale: true
      },
      {
        ...chartAxisDefaults,
        type: "value" as const,
        name: "Real yield (%)",
        nameTextStyle: { color: chartCategoricalPalette[2], fontSize: 11 },
        scale: true,
        position: "right" as const
      }
    ],
    series: [
      {
        name: "Broad dollar",
        type: "line" as const,
        showSymbol: false,
        yAxisIndex: 0,
        lineStyle: { width: 1.5, color: chartCategoricalPalette[6] },
        itemStyle: { color: chartCategoricalPalette[6] },
        data: dollarData
      },
      {
        name: "10Y real yield",
        type: "line" as const,
        showSymbol: false,
        yAxisIndex: 1,
        lineStyle: { width: 1.5, color: chartCategoricalPalette[2] },
        itemStyle: { color: chartCategoricalPalette[2] },
        data: realYieldData
      }
    ]
  };

  return (
    <EChartPanel
      title="Dollar × real-yield pressure"
      description="Broad dollar (left axis) and 10Y real yield (right axis) on dual axes. Both rising = global tightening pressure on risk assets."
      state="ready"
      option={option}
      ariaLabel="Dual-axis line chart of broad dollar and 10Y real yield over time"
      height={300}
    />
  );
}
