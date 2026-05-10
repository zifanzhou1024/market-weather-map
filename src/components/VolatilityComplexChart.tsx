import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartCategoricalPalette,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import type { TimeSeriesFile } from "../lib/types";

interface VolatilityComplexChartProps {
  vix?: TimeSeriesFile;
  vvix?: TimeSeriesFile;
}

function dataPoints(series?: TimeSeriesFile): Array<[string, number]> {
  if (!series) return [];
  return series.observations
    .filter((obs) => typeof obs.value === "number" && Number.isFinite(obs.value))
    .map((obs) => [obs.date, obs.value] as [string, number]);
}

export default function VolatilityComplexChart({ vix, vvix }: VolatilityComplexChartProps) {
  const vixData = dataPoints(vix);
  const vvixData = dataPoints(vvix);

  if (vixData.length === 0 && vvixData.length === 0) {
    return (
      <EChartPanel
        title="Volatility complex (VIX × VVIX)"
        description="VIX and VVIX over time. Hidden options stress shows up when VVIX rises while VIX stays calm."
        state="empty"
        emptyMessage="VIX and VVIX are not currently active."
      />
    );
  }

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 32, bottom: 56 },
    tooltip: { ...chartTooltipDefaults, trigger: "axis" as const },
    legend: {
      data: ["VIX", "VVIX"],
      bottom: 0,
      textStyle: { color: chartTextStyle.color, fontSize: 11 }
    },
    xAxis: { ...chartAxisDefaults, type: "time" as const },
    yAxis: [
      {
        ...chartAxisDefaults,
        type: "value" as const,
        name: "VIX",
        nameTextStyle: { color: chartCategoricalPalette[0], fontSize: 11 },
        scale: true
      },
      {
        ...chartAxisDefaults,
        type: "value" as const,
        name: "VVIX",
        nameTextStyle: { color: chartCategoricalPalette[1], fontSize: 11 },
        scale: true,
        position: "right" as const
      }
    ],
    series: [
      {
        name: "VIX",
        type: "line" as const,
        showSymbol: false,
        yAxisIndex: 0,
        lineStyle: { width: 1.5, color: chartCategoricalPalette[0] },
        itemStyle: { color: chartCategoricalPalette[0] },
        data: vixData
      },
      {
        name: "VVIX",
        type: "line" as const,
        showSymbol: false,
        yAxisIndex: 1,
        lineStyle: { width: 1.5, color: chartCategoricalPalette[1] },
        itemStyle: { color: chartCategoricalPalette[1] },
        data: vvixData
      }
    ]
  };

  return (
    <EChartPanel
      title="Volatility complex (VIX × VVIX)"
      description="VIX and VVIX on dual axes. Hidden options stress shows up when VVIX rises while VIX stays calm."
      state="ready"
      option={option}
      ariaLabel="Dual-axis line chart of VIX and VVIX over time"
      height={300}
    />
  );
}
