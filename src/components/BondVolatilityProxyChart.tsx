import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartCategoricalPalette,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import type { DerivedSeriesFile } from "../lib/types";

interface BondVolatilityProxyChartProps {
  series?: DerivedSeriesFile;
}

const TITLE = "Bond-volatility proxy (NOT MOVE)";
const DESCRIPTION =
  "Public-data approximation of bond volatility derived from the rolling 21-observation realized standard deviation of daily 10-year Treasury yield changes (annualized × √252). This is NOT the licensed ICE MOVE Index and is not an implied-volatility benchmark — read it as a directional realized-vol proxy only.";
const ARIA_LABEL =
  "Line chart of public bond-volatility proxy over time, derived from realized 10-year yield volatility, not ICE MOVE";
const EMPTY_MESSAGE = "Bond-volatility proxy series is not currently active.";

interface AxisTooltipParam {
  axisValueLabel?: string;
  axisValue?: string | number;
  value?: [string, number] | number;
  data?: [string, number];
  seriesName?: string;
}

function formatTooltip(params: AxisTooltipParam[]): string {
  if (!Array.isArray(params) || params.length === 0) return "";
  const head = params[0];
  const dateLabel = head.axisValueLabel ?? String(head.axisValue ?? "");
  const lines = params
    .map((entry) => {
      const raw = Array.isArray(entry.data)
        ? entry.data[1]
        : Array.isArray(entry.value)
          ? entry.value[1]
          : typeof entry.value === "number"
            ? entry.value
            : null;
      if (raw == null || !Number.isFinite(raw)) return null;
      return `${entry.seriesName ?? "Bond-vol proxy"}: ${raw.toFixed(2)}`;
    })
    .filter((line): line is string => line !== null);
  return [dateLabel, ...lines].join("<br/>");
}

export default function BondVolatilityProxyChart({ series }: BondVolatilityProxyChartProps) {
  const points: Array<[string, number]> =
    series?.observations
      .filter((obs) => typeof obs.value === "number" && Number.isFinite(obs.value))
      .map((obs) => [obs.date, obs.value] as [string, number]) ?? [];

  if (!series || series.observations.length === 0 || points.length === 0) {
    return (
      <EChartPanel
        title={TITLE}
        description={DESCRIPTION}
        state="empty"
        emptyMessage={EMPTY_MESSAGE}
        height={280}
      />
    );
  }

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: formatTooltip
    },
    xAxis: { ...chartAxisDefaults, type: "time" as const },
    yAxis: { ...chartAxisDefaults, type: "value" as const, scale: true },
    series: [
      {
        name: "Bond-vol proxy",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.5, color: chartCategoricalPalette[6] },
        itemStyle: { color: chartCategoricalPalette[6] },
        data: points
      }
    ]
  };

  return (
    <EChartPanel
      title={TITLE}
      description={DESCRIPTION}
      state="ready"
      option={option}
      ariaLabel={ARIA_LABEL}
      height={280}
    />
  );
}
