import { useMemo, useState } from "react";
import EChartPanel from "../../charts/EChartPanel";
import { buildMarkBands } from "../../charts/buildMarkBands";
import { buildTimeWindow, type RangePreset } from "../../charts/buildTimeWindow";
import {
  chartAxisDefaults,
  chartCategoricalPalette,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../../charts/chartTheme";
import { formatNumber } from "../../charts/chartFormatters";
import InteractiveChartShell from "../InteractiveChartShell";
import type {
  VolatilityDashboardThresholds,
  VolatilityRatioHistoryPoint
} from "../../lib/types";

/**
 * History chart for the public volatility-curve ratios:
 *   - VIX9D / VIX  (front-curve compression)
 *   - VIX / VIX3M  (full-curve compression vs. backwardation)
 *
 * Threshold bands shade the ratio space: a "stress" band sits above 1.0 (or
 * above the VIX9D/VIX stress threshold), a "calm" band sits below 0.95, and
 * the middle "flat" band lives between them. The bands are descriptive only —
 * they do not encode any recommended action.
 *
 * Default range is 1Y so the chart loads with a useful look-back without
 * being noisy. dataZoom (slider + inside) lets users pan within the chosen
 * window; ChartRangeControls changes the window itself.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const VIX9D_VIX_COLOR = chartCategoricalPalette[0];
const VIX_VIX3M_COLOR = chartCategoricalPalette[1];

export interface VixRatioHistoryChartProps {
  data: VolatilityRatioHistoryPoint[];
  thresholds: VolatilityDashboardThresholds;
}

interface RatioTooltipParam {
  axisValueLabel: string;
  seriesName: string;
  value: [string, number];
  color: string;
}

function tooltipFormatter(raw: unknown): string {
  const params = raw as RatioTooltipParam[];
  if (!params || params.length === 0) return "";
  const date = params[0].axisValueLabel;
  const rows = params.map((p) => {
    const value = Array.isArray(p.value) ? p.value[1] : (p.value as unknown as number);
    return `<span style="color:${p.color}">●</span> ${p.seriesName}: <strong>${formatNumber(value, 3)}</strong>`;
  });
  return [`<strong>${date}</strong>`, ...rows].join("<br/>");
}

function buildVix9dVixBands(thresholds: VolatilityDashboardThresholds) {
  return buildMarkBands([
    { label: "Calm", max: thresholds.vix9d_vix_calm, color: "rgba(58, 125, 91, 0.10)" },
    {
      label: "Flat",
      min: thresholds.vix9d_vix_calm,
      max: thresholds.vix9d_vix_stress,
      color: "rgba(96, 112, 102, 0.08)"
    },
    { label: "Stress", min: thresholds.vix9d_vix_stress, color: "rgba(176, 74, 58, 0.10)" }
  ]);
}

function buildVixVix3mBands(thresholds: VolatilityDashboardThresholds) {
  return buildMarkBands([
    { label: "Calm", max: thresholds.vix_vix3m_calm, color: "rgba(58, 125, 91, 0.10)" },
    {
      label: "Flat",
      min: thresholds.vix_vix3m_calm,
      max: thresholds.vix_vix3m_stress,
      color: "rgba(96, 112, 102, 0.08)"
    },
    { label: "Stress", min: thresholds.vix_vix3m_stress, color: "rgba(176, 74, 58, 0.10)" }
  ]);
}

export default function VixRatioHistoryChart({
  data,
  thresholds
}: VixRatioHistoryChartProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const filtered = useMemo(() => buildTimeWindow(data, range), [data, range]);

  if (data.length === 0) {
    return (
      <InteractiveChartShell
        title="Volatility ratio history"
        ariaLabel="VIX9D over VIX and VIX over VIX3M ratio history"
      >
        <EChartPanel
          title="Volatility ratio history"
          state="empty"
          emptyMessage="Volatility ratio history is not currently active."
          height={360}
        />
      </InteractiveChartShell>
    );
  }

  const vix9dVixSeries = filtered.map((p) => [p.date, p.vix9d_vix]);
  const vix_vix3mSeries = filtered.map((p) => [p.date, p.vix_vix3m]);

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 36, bottom: 64 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    legend: {
      data: ["VIX9D / VIX", "VIX / VIX3M"],
      top: 4,
      textStyle: { color: chartTextStyle.color, fontSize: 11 }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "time" as const
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      scale: true,
      name: "Ratio",
      nameTextStyle: { color: chartColors.muted, fontSize: 11 }
    },
    dataZoom: [
      { type: "inside" as const, throttle: 50 },
      { type: "slider" as const, height: 18, bottom: 12 }
    ],
    series: [
      {
        name: "VIX9D / VIX",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.6, color: VIX9D_VIX_COLOR },
        itemStyle: { color: VIX9D_VIX_COLOR },
        data: vix9dVixSeries,
        markArea: {
          silent: true,
          data: buildVix9dVixBands(thresholds)
        }
      },
      {
        name: "VIX / VIX3M",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.6, color: VIX_VIX3M_COLOR },
        itemStyle: { color: VIX_VIX3M_COLOR },
        data: vix_vix3mSeries,
        markArea: {
          silent: true,
          data: buildVixVix3mBands(thresholds)
        }
      }
    ]
  };

  return (
    <InteractiveChartShell
      title="Volatility ratio history"
      ariaLabel="VIX9D over VIX and VIX over VIX3M ratio history"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight="VIX9D / VIX above 1 signals front-curve stress. VIX / VIX3M above 1 signals full-curve backwardation."
    >
      <EChartPanel
        title="Volatility ratio history"
        state="ready"
        option={option}
        ariaLabel="Time series of VIX9D over VIX and VIX over VIX3M with threshold bands"
        height={360}
      />
    </InteractiveChartShell>
  );
}
