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
import type { Observation, TimeSeriesFile } from "../../lib/types";

/**
 * Hero broad-dollar chart for the DollarGlobal route.
 *
 * Two-line dual-axis chart: the broad-dollar index (left axis, in index
 * points) and the percentile-normalized FX pressure (right axis, 0..100)
 * sourced from the precomputed `percentile_252d` field on the broad-dollar
 * series. The percentile is the project's standard 252-day rolling
 * percentile and serves as a stable normalization without requiring a
 * separate z-score derived series.
 *
 * A descriptive `markLine` is drawn on the right axis at percentile 80 to
 * surface "elevated pressure" visually. The line is a data reference, not
 * a recommendation.
 *
 * Tone: descriptive only. No buy/sell/short/forecast language.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const DOLLAR_COLOR = chartCategoricalPalette[0]; // earthy green
const PERCENTILE_COLOR = chartCategoricalPalette[2]; // warning red — pressure
const PRESSURE_HIGH_PERCENTILE = 80;

export interface DollarPressureHeroProps {
  broadDollar: TimeSeriesFile;
}

function toLevelPoints(obs: Observation[]): Array<[string, number]> {
  return obs
    .filter((o) => Number.isFinite(o.value))
    .map((o) => [o.date, o.value] as [string, number]);
}

function toPercentilePoints(obs: Observation[]): Array<[string, number]> {
  return obs
    .filter(
      (o) =>
        o.percentile_252d !== null &&
        o.percentile_252d !== undefined &&
        Number.isFinite(o.percentile_252d)
    )
    .map((o) => [o.date, o.percentile_252d as number] as [string, number]);
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
    const isPercentile = p.seriesName.toLowerCase().includes("percentile");
    const formatted = isPercentile
      ? `${formatNumber(value, 0)} percentile`
      : formatNumber(value, 2);
    return `${dot}${p.seriesName}: <strong>${formatted}</strong>`;
  });
  return [`<strong>${date}</strong>`, ...rows].join("<br/>");
}

function describeLatest(broadDollar: TimeSeriesFile): string {
  const summary = broadDollar.summary;
  const latest = broadDollar.observations[broadDollar.observations.length - 1];
  if (!latest || !Number.isFinite(latest.value)) {
    return "Broad-dollar history is not currently active.";
  }
  const level = formatNumber(latest.value, 2);
  const change1m = summary?.change_1m;
  const direction =
    change1m === null || change1m === undefined || !Number.isFinite(change1m)
      ? "flat"
      : change1m > 0
        ? "rising"
        : change1m < 0
          ? "easing"
          : "flat";
  const pct = summary?.percentile_252d;
  const pctSuffix =
    pct !== null && pct !== undefined && Number.isFinite(pct)
      ? ` (1-year percentile ${formatNumber(pct, 0)})`
      : "";
  return `Broad dollar at ${level} on ${latest.date}; ${direction} over the past month${pctSuffix}.`;
}

export default function DollarPressureHero({ broadDollar }: DollarPressureHeroProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const filtered = useMemo(
    () => buildTimeWindow(broadDollar.observations, range),
    [broadDollar.observations, range]
  );

  if (broadDollar.observations.length === 0) {
    return (
      <InteractiveChartShell
        title="Dollar pressure"
        ariaLabel="Broad dollar level and 1-year percentile pressure overlay"
      >
        <EChartPanel
          title="Dollar pressure"
          state="empty"
          emptyMessage="Broad-dollar history is not currently active."
          height={380}
        />
      </InteractiveChartShell>
    );
  }

  const levelPoints = toLevelPoints(filtered);
  const percentilePoints = toPercentilePoints(filtered);

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 40, bottom: 64, right: 56 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    legend: {
      data: ["Broad dollar (level)", "FX pressure percentile"],
      top: 8,
      textStyle: { color: chartTextStyle.color, fontSize: 11 }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "time" as const
    },
    yAxis: [
      {
        ...chartAxisDefaults,
        type: "value" as const,
        scale: true,
        name: "Broad dollar (index)",
        nameTextStyle: { color: chartColors.muted, fontSize: 11 }
      },
      {
        ...chartAxisDefaults,
        type: "value" as const,
        min: 0,
        max: 100,
        name: "1-year percentile",
        nameTextStyle: { color: chartColors.muted, fontSize: 11 },
        splitLine: { show: false }
      }
    ],
    dataZoom: [
      { type: "inside" as const, throttle: 50 },
      { type: "slider" as const, height: 18, bottom: 12 }
    ],
    series: [
      {
        name: "Broad dollar (level)",
        type: "line" as const,
        yAxisIndex: 0,
        showSymbol: false,
        lineStyle: { width: 1.8, color: DOLLAR_COLOR },
        itemStyle: { color: DOLLAR_COLOR },
        data: levelPoints
      },
      {
        name: "FX pressure percentile",
        type: "line" as const,
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { width: 1.4, color: PERCENTILE_COLOR, type: "dashed" as const },
        itemStyle: { color: PERCENTILE_COLOR },
        data: percentilePoints,
        markLine: {
          silent: true,
          symbol: "none" as const,
          label: {
            color: chartColors.muted,
            fontSize: 10,
            formatter: "Elevated 80"
          },
          lineStyle: { type: "dotted" as const, color: chartColors.warning },
          data: [{ yAxis: PRESSURE_HIGH_PERCENTILE }]
        }
      }
    ]
  };

  const insight = describeLatest(broadDollar);

  return (
    <InteractiveChartShell
      title="Dollar pressure"
      ariaLabel="Broad dollar level and 1-year percentile pressure overlay"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight={insight}
    >
      <EChartPanel
        title="Dollar pressure"
        description="Broad dollar index with the 1-year percentile-normalized FX pressure overlay."
        state="ready"
        option={option}
        ariaLabel="Dual-axis line chart of the broad dollar index and its 1-year percentile-normalized FX pressure."
        height={380}
      />
    </InteractiveChartShell>
  );
}
