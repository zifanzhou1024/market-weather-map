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
import type { DerivedSeriesFile, Observation, TimeSeriesFile } from "../../lib/types";

/**
 * Hero credit-spread matrix for the Credit route.
 *
 * Three option-adjusted-spread (OAS) lines: high-yield, investment-grade, and
 * BBB. Each spread is plotted on the same percent axis so the credit-quality
 * ladder reads at a glance. A descriptive `markLine` annotation marks the
 * latest HY-IG stress value (sourced from the precomputed
 * `hy_minus_ig_oas.json` derived series) anchored at the HY series, so the
 * "current credit stress gap" is visually tied to the same axis as the HY OAS
 * level it relates to.
 *
 * Tone: descriptive only. No buy/sell/short/target/stop language. The
 * `markLine` reads as a data point, not a recommendation.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const HY_COLOR = chartCategoricalPalette[2]; // warning red — riskier credit
const BBB_COLOR = chartCategoricalPalette[3]; // gold/burnt orange — middle
const IG_COLOR = chartCategoricalPalette[1]; // support green — safest

export interface CreditSpreadMatrixHeroProps {
  hyOas: TimeSeriesFile;
  igOas: TimeSeriesFile;
  bbbOas: TimeSeriesFile;
  hyMinusIgOas: DerivedSeriesFile;
}

function toLinePoints(obs: Observation[]): Array<[string, number]> {
  return obs
    .filter((o) => Number.isFinite(o.value))
    .map((o) => [o.date, o.value] as [string, number]);
}

function tooltipFormatter(raw: unknown): string {
  const params = Array.isArray(raw)
    ? (raw as Array<{
        axisValueLabel?: string;
        seriesName: string;
        color?: string;
        value: [string, number];
      }>)
    : [];
  if (!params.length) return "";
  const date = params[0].axisValueLabel ?? "";
  const rows = params.map((p) => {
    const value = Array.isArray(p.value) ? p.value[1] : (p.value as unknown as number);
    const dot = p.color ? `<span style="color:${p.color}">●</span> ` : "";
    return `${dot}${p.seriesName}: <strong>${formatNumber(value, 2)}%</strong>`;
  });
  return [`<strong>${date}</strong>`, ...rows].join("<br/>");
}

function describeLatest(
  hy: TimeSeriesFile,
  ig: TimeSeriesFile,
  bbb: TimeSeriesFile,
  spread: DerivedSeriesFile
): string {
  const hyLatest = hy.observations[hy.observations.length - 1];
  const igLatest = ig.observations[ig.observations.length - 1];
  const bbbLatest = bbb.observations[bbb.observations.length - 1];
  const spreadLatest = spread.observations[spread.observations.length - 1];

  if (!hyLatest && !igLatest && !bbbLatest && !spreadLatest) {
    return "Credit spread history is not currently active.";
  }

  const parts: string[] = [];
  if (hyLatest && Number.isFinite(hyLatest.value)) {
    parts.push(`HY OAS ${formatNumber(hyLatest.value, 2)}%`);
  }
  if (igLatest && Number.isFinite(igLatest.value)) {
    parts.push(`IG OAS ${formatNumber(igLatest.value, 2)}%`);
  }
  if (bbbLatest && Number.isFinite(bbbLatest.value)) {
    parts.push(`BBB OAS ${formatNumber(bbbLatest.value, 2)}%`);
  }
  let prefix = parts.join(", ");
  if (spreadLatest && Number.isFinite(spreadLatest.value)) {
    const stressPercentile = spreadLatest.percentile_252d;
    const percentileSuffix =
      stressPercentile !== null && stressPercentile !== undefined && Number.isFinite(stressPercentile)
        ? ` (${formatNumber(stressPercentile, 0)} percentile over the last year)`
        : "";
    if (prefix.length > 0) prefix += ". ";
    prefix += `HY-IG stress ${formatNumber(spreadLatest.value, 2)} pp${percentileSuffix}.`;
  } else if (prefix.length > 0) {
    prefix += ".";
  }
  return prefix;
}

export default function CreditSpreadMatrixHero({
  hyOas,
  igOas,
  bbbOas,
  hyMinusIgOas
}: CreditSpreadMatrixHeroProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const hyFiltered = useMemo(
    () => buildTimeWindow(hyOas.observations, range),
    [hyOas.observations, range]
  );
  const igFiltered = useMemo(
    () => buildTimeWindow(igOas.observations, range),
    [igOas.observations, range]
  );
  const bbbFiltered = useMemo(
    () => buildTimeWindow(bbbOas.observations, range),
    [bbbOas.observations, range]
  );

  const noData =
    hyOas.observations.length === 0 &&
    igOas.observations.length === 0 &&
    bbbOas.observations.length === 0;

  if (noData) {
    return (
      <InteractiveChartShell
        title="Credit spread matrix"
        ariaLabel="High yield, investment grade, and BBB option-adjusted spread history with HY-IG stress annotation"
      >
        <EChartPanel
          title="Credit spread matrix"
          state="empty"
          emptyMessage="Credit spread history is not currently active."
          height={380}
        />
      </InteractiveChartShell>
    );
  }

  const hyLatestForMark = hyOas.observations[hyOas.observations.length - 1];
  const spreadLatest = hyMinusIgOas.observations[hyMinusIgOas.observations.length - 1];
  const markValue =
    hyLatestForMark && spreadLatest && Number.isFinite(spreadLatest.value)
      ? Number.isFinite(hyLatestForMark.value)
        ? hyLatestForMark.value
        : null
      : null;

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 40, bottom: 64 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    legend: {
      data: ["HY OAS", "BBB OAS", "IG OAS"],
      top: 8,
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
      name: "OAS (%)",
      nameTextStyle: { color: chartColors.muted, fontSize: 11 }
    },
    dataZoom: [
      { type: "inside" as const, throttle: 50 },
      { type: "slider" as const, height: 18, bottom: 12 }
    ],
    series: [
      {
        name: "HY OAS",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.6, color: HY_COLOR },
        itemStyle: { color: HY_COLOR },
        data: toLinePoints(hyFiltered),
        markLine: markValue !== null && spreadLatest
          ? {
              silent: true,
              symbol: "none" as const,
              label: {
                color: chartColors.muted,
                fontSize: 10,
                formatter: `HY-IG stress ${formatNumber(spreadLatest.value, 2)} pp`
              },
              lineStyle: { type: "dashed" as const, color: chartColors.warning },
              data: [
                {
                  yAxis: markValue,
                  name: "HY-IG stress annotation"
                }
              ]
            }
          : undefined
      },
      {
        name: "BBB OAS",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.6, color: BBB_COLOR },
        itemStyle: { color: BBB_COLOR },
        data: toLinePoints(bbbFiltered)
      },
      {
        name: "IG OAS",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.6, color: IG_COLOR },
        itemStyle: { color: IG_COLOR },
        data: toLinePoints(igFiltered)
      }
    ]
  };

  const insight = describeLatest(hyOas, igOas, bbbOas, hyMinusIgOas);

  return (
    <InteractiveChartShell
      title="Credit spread matrix"
      ariaLabel="High yield, investment grade, and BBB option-adjusted spread history with HY-IG stress annotation"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight={insight}
    >
      <EChartPanel
        title="Credit spread matrix"
        description="HY, IG, and BBB option-adjusted spreads with a descriptive HY-IG stress marker."
        state="ready"
        option={option}
        ariaLabel="Multi-line time series of HY, IG, and BBB option-adjusted spreads in percent, with HY-IG stress annotation."
        height={380}
      />
    </InteractiveChartShell>
  );
}
