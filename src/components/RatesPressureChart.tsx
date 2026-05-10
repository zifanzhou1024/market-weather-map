import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartCategoricalPalette,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import type { TimeSeriesFile } from "../lib/types";

interface RatesPressureChartProps {
  us2y?: TimeSeriesFile;
  us10y?: TimeSeriesFile;
  realYield10y?: TimeSeriesFile;
  breakeven10y?: TimeSeriesFile;
}

interface SeriesEntry {
  name: string;
  series?: TimeSeriesFile;
  color: string;
}

function dataPoints(series?: TimeSeriesFile): Array<[string, number]> {
  if (!series) return [];
  return series.observations
    .filter((obs) => typeof obs.value === "number" && Number.isFinite(obs.value))
    .map((obs) => [obs.date, obs.value] as [string, number]);
}

export default function RatesPressureChart({
  us2y,
  us10y,
  realYield10y,
  breakeven10y
}: RatesPressureChartProps) {
  const entries: SeriesEntry[] = [
    { name: "US2Y", series: us2y, color: chartCategoricalPalette[4] },
    { name: "US10Y", series: us10y, color: chartCategoricalPalette[0] },
    { name: "10Y real yield", series: realYield10y, color: chartCategoricalPalette[2] },
    { name: "10Y breakeven", series: breakeven10y, color: chartCategoricalPalette[3] }
  ];

  const activeEntries = entries.filter((entry) => dataPoints(entry.series).length > 0);

  if (activeEntries.length === 0) {
    return (
      <EChartPanel
        title="Rates / real-yield pressure"
        description="Treasury yield, real yield, and inflation breakeven over time."
        state="empty"
        emptyMessage="No active rates inputs are available in the current snapshot."
      />
    );
  }

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 32, bottom: 56 },
    tooltip: { ...chartTooltipDefaults, trigger: "axis" as const, valueFormatter: (value: number) => value.toFixed(2) },
    legend: {
      data: activeEntries.map((entry) => entry.name),
      bottom: 0,
      textStyle: { color: chartTextStyle.color, fontSize: 11 }
    },
    xAxis: { ...chartAxisDefaults, type: "time" as const },
    yAxis: { ...chartAxisDefaults, type: "value" as const, scale: true, name: "Yield (%)" },
    series: activeEntries.map((entry) => ({
      name: entry.name,
      type: "line" as const,
      showSymbol: false,
      lineStyle: { width: 1.5, color: entry.color },
      itemStyle: { color: entry.color },
      data: dataPoints(entry.series)
    }))
  };

  return (
    <EChartPanel
      title="Rates / real-yield pressure"
      description="Treasury yield, real yield, and inflation breakeven over time. Higher real yields tighten financial conditions."
      state="ready"
      option={option}
      ariaLabel={`Multi-line chart of ${activeEntries.map((e) => e.name).join(", ")} over time`}
      height={300}
    />
  );
}
