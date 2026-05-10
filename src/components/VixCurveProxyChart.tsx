import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartCategoricalPalette,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import { formatNumber } from "../charts/chartFormatters";
import type { TimeSeriesFile } from "../lib/types";

interface VixCurveProxyChartProps {
  vix9d?: TimeSeriesFile;
  vix?: TimeSeriesFile;
  vix3m?: TimeSeriesFile;
}

function latest(series?: TimeSeriesFile): number | null {
  if (!series) return null;
  const summary = series.summary?.latest_value;
  if (typeof summary === "number" && Number.isFinite(summary)) return summary;
  const last = series.observations[series.observations.length - 1]?.value;
  return typeof last === "number" && Number.isFinite(last) ? last : null;
}

function classifyCurve(vix: number, vix3m: number): "contango" | "backwardation" | "flat" {
  if (vix3m - vix > 1) return "contango";
  if (vix - vix3m > 0.5) return "backwardation";
  return "flat";
}

const STATE_DESCRIPTION: Record<"contango" | "backwardation" | "flat", string> = {
  contango: "Contango proxy: longer-dated VIX3M sits above VIX, the calmer term-structure shape.",
  flat:
    "Flat proxy: VIX and VIX3M are close, neither contango nor backwardation is meaningful.",
  backwardation:
    "Backwardation proxy: VIX sits above VIX3M, an acute-stress shape. Watch for confirmation in credit and dollar."
};

export default function VixCurveProxyChart({ vix9d, vix, vix3m }: VixCurveProxyChartProps) {
  const v9d = latest(vix9d);
  const v = latest(vix);
  const v3m = latest(vix3m);

  if (v9d === null || v === null || v3m === null) {
    return (
      <EChartPanel
        title="VIX curve proxy (VIX9D → VIX → VIX3M)"
        description="Public-data volatility curve proxy across 9-day, 30-day, and 3-month horizons."
        state="empty"
        emptyMessage="VIX9D, VIX, or VIX3M is not currently active."
      />
    );
  }

  const curveState = classifyCurve(v, v3m);
  const description = `${STATE_DESCRIPTION[curveState]} Latest: VIX9D ${formatNumber(v9d, 2)} · VIX ${formatNumber(v, 2)} · VIX3M ${formatNumber(v3m, 2)}.`;

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 24, bottom: 28 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: ["VIX9D", "VIX", "VIX3M"]
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      scale: true
    },
    series: [
      {
        name: "VIX curve proxy",
        type: "line" as const,
        symbolSize: 10,
        lineStyle: { width: 2, color: chartCategoricalPalette[0] },
        itemStyle: { color: chartCategoricalPalette[0] },
        data: [v9d, v, v3m],
        label: { show: true, position: "top" as const, formatter: (params: { value: number }) => formatNumber(params.value, 2) }
      }
    ]
  };

  return (
    <EChartPanel
      title="VIX curve proxy (VIX9D → VIX → VIX3M)"
      description={description}
      state="ready"
      option={option}
      ariaLabel={`VIX curve proxy. Curve state: ${curveState}. Latest VIX9D ${formatNumber(v9d, 2)}, VIX ${formatNumber(v, 2)}, VIX3M ${formatNumber(v3m, 2)}.`}
      height={240}
    />
  );
}
