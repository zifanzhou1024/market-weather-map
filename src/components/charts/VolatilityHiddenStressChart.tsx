import { useMemo, useState } from "react";
import EChartPanel from "../../charts/EChartPanel";
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
  VolatilityHiddenStressPoint
} from "../../lib/types";

/**
 * Two-panel diagnostic for "hidden options stress" — the regime in which
 * VVIX percentile leads VIX percentile.
 *
 * Full mode (default):
 *   - Top: scatter of VIX percentile (x) vs VVIX percentile (y). Points
 *     colored by recency via visualMap so the most recent observations
 *     stand out. Upper-left quadrant annotated "hidden options stress."
 *   - Bottom: line strip of the hidden_stress_score over time, with markLines
 *     at the watch and elevated thresholds.
 *   - ChartRangeControls (1M / 3M / 6M / 1Y / 3Y / All) controls both panels.
 *
 * Compact mode: scatter panel only, no controls, no shell. Used inside
 * Tactical's 6-tile grid where the surrounding tile supplies the title.
 *
 * Tone: descriptive only. Quadrant labels describe the percentile coordinates;
 * no advice or buy/sell language anywhere.
 */

export interface VolatilityHiddenStressChartProps {
  data: VolatilityHiddenStressPoint[];
  thresholds: VolatilityDashboardThresholds;
  compact?: boolean;
}

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const SCATTER_COLOR_OLD = "#dce1d8";
const SCATTER_COLOR_NEW = chartCategoricalPalette[0];
const STRIP_COLOR = chartCategoricalPalette[1];

interface ScatterDatum {
  point: [number, number];
  recencyIndex: number;
}

function tooltipScatterFormatter(data: VolatilityHiddenStressPoint[]) {
  return (raw: unknown): string => {
    const params = raw as { dataIndex: number };
    const point = data[params.dataIndex];
    if (!point) return "";
    return [
      `<strong>${point.date}</strong>`,
      `VIX percentile: ${formatNumber(point.vix_percentile, 1)}`,
      `VVIX percentile: ${formatNumber(point.vvix_percentile, 1)}`,
      `Hidden stress score: ${formatNumber(point.hidden_stress_score, 1)}`
    ].join("<br/>");
  };
}

function tooltipStripFormatter(raw: unknown): string {
  const params = raw as Array<{ axisValueLabel: string; value: [string, number] }>;
  if (!params || params.length === 0) return "";
  const row = params[0];
  const value = Array.isArray(row.value) ? row.value[1] : (row.value as unknown as number);
  return `<strong>${row.axisValueLabel}</strong><br/>Hidden stress score: ${formatNumber(value, 1)}`;
}

function buildCompactScatterOption(
  data: VolatilityHiddenStressPoint[],
  thresholds: VolatilityDashboardThresholds
) {
  void thresholds;
  const points: ScatterDatum[] = data.map((p, i) => ({
    point: [p.vix_percentile, p.vvix_percentile],
    recencyIndex: i
  }));

  return {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 24, bottom: 28 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: tooltipScatterFormatter(data)
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      min: 0,
      max: 100,
      name: "VIX %",
      nameLocation: "middle" as const,
      nameGap: 22,
      nameTextStyle: { color: chartColors.muted, fontSize: 10 }
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      min: 0,
      max: 100,
      name: "VVIX %",
      nameTextStyle: { color: chartColors.muted, fontSize: 10 }
    },
    visualMap: [
      {
        type: "continuous" as const,
        seriesIndex: 0,
        dimension: 2,
        min: 0,
        max: Math.max(0, data.length - 1),
        inRange: { color: [SCATTER_COLOR_OLD, SCATTER_COLOR_NEW] },
        show: false
      }
    ],
    series: [
      {
        name: "Hidden stress points",
        type: "scatter" as const,
        symbolSize: 6,
        data: points.map((p) => [...p.point, p.recencyIndex])
      }
    ]
  };
}

function buildFullOption(
  data: VolatilityHiddenStressPoint[],
  thresholds: VolatilityDashboardThresholds
) {
  const scatterPoints = data.map((p, i) => [
    p.vix_percentile,
    p.vvix_percentile,
    i
  ]);
  const stripPoints = data.map((p) => [p.date, p.hidden_stress_score]);

  return {
    textStyle: chartTextStyle,
    grid: [
      { left: 60, right: 24, top: 24, height: "55%", containLabel: true },
      { left: 60, right: 24, top: "74%", height: "18%", containLabel: true }
    ],
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (raw: unknown) => {
        const params = raw as { seriesIndex: number; dataIndex: number };
        if (params.seriesIndex === 0) {
          return tooltipScatterFormatter(data)(params);
        }
        const arrayParams = Array.isArray(raw) ? raw : [raw];
        return tooltipStripFormatter(arrayParams);
      }
    },
    xAxis: [
      {
        ...chartAxisDefaults,
        type: "value" as const,
        gridIndex: 0,
        min: 0,
        max: 100,
        name: "VIX percentile",
        nameLocation: "middle" as const,
        nameGap: 22,
        nameTextStyle: { color: chartColors.muted, fontSize: 11 }
      },
      {
        ...chartAxisDefaults,
        type: "time" as const,
        gridIndex: 1
      }
    ],
    yAxis: [
      {
        ...chartAxisDefaults,
        type: "value" as const,
        gridIndex: 0,
        min: 0,
        max: 100,
        name: "VVIX percentile",
        nameTextStyle: { color: chartColors.muted, fontSize: 11 }
      },
      {
        ...chartAxisDefaults,
        type: "value" as const,
        gridIndex: 1,
        scale: true,
        name: "Hidden stress score",
        nameTextStyle: { color: chartColors.muted, fontSize: 11 }
      }
    ],
    visualMap: [
      {
        type: "continuous" as const,
        seriesIndex: 0,
        dimension: 2,
        min: 0,
        max: Math.max(0, data.length - 1),
        inRange: { color: [SCATTER_COLOR_OLD, SCATTER_COLOR_NEW] },
        text: ["recent", "older"],
        right: 8,
        top: 16,
        itemHeight: 80,
        itemWidth: 10,
        textStyle: { color: chartColors.muted, fontSize: 10 }
      }
    ],
    series: [
      {
        name: "Hidden stress points",
        type: "scatter" as const,
        xAxisIndex: 0,
        yAxisIndex: 0,
        symbolSize: 7,
        data: scatterPoints,
        markArea: {
          silent: true,
          itemStyle: { color: "rgba(176, 74, 58, 0.06)" },
          data: [
            [
              {
                name: "Hidden options stress",
                xAxis: 0,
                yAxis: 50,
                label: {
                  show: true,
                  position: "insideTopLeft" as const,
                  color: chartColors.warning,
                  fontSize: 10,
                  fontWeight: "bold" as const
                }
              },
              { xAxis: 50, yAxis: 100 }
            ]
          ]
        }
      },
      {
        name: "Hidden stress score",
        type: "line" as const,
        xAxisIndex: 1,
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { width: 1.4, color: STRIP_COLOR },
        itemStyle: { color: STRIP_COLOR },
        data: stripPoints,
        markLine: {
          silent: true,
          symbol: "none",
          label: { color: chartColors.muted, fontSize: 10 },
          data: [
            {
              yAxis: thresholds.hidden_stress_watch,
              label: { formatter: "Watch" },
              lineStyle: { type: "dashed" as const, color: chartColors.missing }
            },
            {
              yAxis: thresholds.hidden_stress_elevated,
              label: { formatter: "Elevated" },
              lineStyle: { type: "dashed" as const, color: chartColors.warning }
            }
          ]
        }
      }
    ]
  };
}

function computeState(
  data: VolatilityHiddenStressPoint[]
): "calm" | "watch" | "risk" {
  if (data.length === 0) return "calm";
  const latest = data[data.length - 1].state;
  if (latest === "elevated") return "risk";
  if (latest === "watch") return "watch";
  return "calm";
}

export default function VolatilityHiddenStressChart({
  data,
  thresholds,
  compact = false
}: VolatilityHiddenStressChartProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const filtered = useMemo(() => buildTimeWindow(data, range), [data, range]);

  if (data.length === 0) {
    const emptyPanel = (
      <EChartPanel
        title="Hidden options stress"
        state="empty"
        emptyMessage="VIX/VVIX percentile history is not currently active."
        height={compact ? 200 : 420}
      />
    );
    if (compact) return emptyPanel;
    return (
      <InteractiveChartShell
        title="Hidden options stress"
        ariaLabel="Hidden options stress scatter and stress score history"
      >
        {emptyPanel}
      </InteractiveChartShell>
    );
  }

  if (compact) {
    const option = buildCompactScatterOption(data, thresholds);
    return (
      <EChartPanel
        title="Hidden options stress"
        state="ready"
        option={option}
        ariaLabel="VIX percentile by VVIX percentile scatter, recency-colored"
        height={200}
      />
    );
  }

  const option = buildFullOption(filtered, thresholds);
  const state = computeState(filtered);
  const latest = filtered[filtered.length - 1];

  const insight = latest
    ? `Latest hidden stress score is ${formatNumber(latest.hidden_stress_score, 1)} (state: ${latest.state}). Upper-left quadrant marks the hidden-options-stress regime where VVIX percentile leads VIX percentile.`
    : "Upper-left quadrant marks the hidden-options-stress regime where VVIX percentile leads VIX percentile.";

  return (
    <InteractiveChartShell
      title="Hidden options stress"
      ariaLabel="Hidden options stress scatter and stress score history"
      state={state}
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight={insight}
    >
      <EChartPanel
        title="Hidden options stress"
        state="ready"
        option={option}
        ariaLabel="Scatter of VIX vs VVIX percentile (top) and hidden stress score over time (bottom)"
        height={420}
      />
    </InteractiveChartShell>
  );
}
