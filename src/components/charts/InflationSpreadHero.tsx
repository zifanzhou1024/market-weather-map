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
 * Hero realized-vs-market-implied inflation chart for the Inflation route.
 *
 * Four overlapping percent-axis lines:
 *   - Headline CPI (YoY %) — computed from monthly CPI index observations.
 *   - Core CPI (YoY %) — computed from monthly Core CPI index observations.
 *   - 10Y breakeven — passes through (already in percent).
 *   - 5y5y forward inflation — passes through (already in percent).
 *
 * A neutral grey descriptive `markLine` sits at 2.0% to label the Fed's
 * long-run goal — a reference line, not a target or recommendation.
 *
 * YoY conversion drops the first 12 monthly observations of each CPI input,
 * since YoY requires a 12-month look-back. Empty series are omitted from the
 * rendered option so the legend doesn't show zero-length lines.
 *
 * Tone: descriptive only. No buy/sell/short/target/stop/forecast language.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const HEADLINE_COLOR = chartCategoricalPalette[2]; // warning red
const CORE_COLOR = chartCategoricalPalette[3]; // gold/burnt orange
const BREAKEVEN_COLOR = chartCategoricalPalette[0]; // earthy green
const FORWARD_COLOR = chartCategoricalPalette[4]; // earthy blue
const FED_GOAL_PERCENT = 2.0;

export interface InflationSpreadHeroProps {
  headlineCpi: TimeSeriesFile;
  coreCpi: TimeSeriesFile;
  breakeven10y: TimeSeriesFile;
  forwardInflation5y5y: TimeSeriesFile;
}

/**
 * Convert a monthly index series (e.g. CPI) into a year-over-year percent
 * change series: `((obs[i].value / obs[i-12].value) - 1) * 100`. Drops the
 * first 12 observations since YoY requires a 12-month look-back, and skips
 * any observation whose 12-month pair has a non-finite or zero value.
 */
function toYearOverYear(obs: Observation[]): Observation[] {
  const sorted = [...obs]
    .filter((o) => Number.isFinite(o.value))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out: Observation[] = [];
  for (let i = 12; i < sorted.length; i += 1) {
    const current = sorted[i];
    const prior = sorted[i - 12];
    if (!Number.isFinite(prior.value) || prior.value === 0) continue;
    const yoy = (current.value / prior.value - 1) * 100;
    if (!Number.isFinite(yoy)) continue;
    out.push({ date: current.date, value: yoy, percentile_252d: null });
  }
  return out;
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

interface BuiltSeries {
  name: string;
  color: string;
  observations: Observation[];
}

function describeLatest(seriesList: BuiltSeries[]): string {
  const segments: string[] = [];
  for (const s of seriesList) {
    if (s.observations.length === 0) continue;
    const latest = s.observations[s.observations.length - 1];
    if (!latest || !Number.isFinite(latest.value)) continue;
    segments.push(`${s.name} ${formatNumber(latest.value, 2)}%`);
  }
  if (segments.length === 0) {
    return "Inflation and breakeven history is not currently active.";
  }
  const latestDate = seriesList
    .flatMap((s) => (s.observations.length > 0 ? [s.observations[s.observations.length - 1].date] : []))
    .sort()
    .pop();
  const trailing = latestDate ? ` Latest reading from ${latestDate}.` : "";
  return `${segments.join(", ")}. Market-implied breakevens and forward inflation track how expectations move alongside realized prices.${trailing}`;
}

export default function InflationSpreadHero({
  headlineCpi,
  coreCpi,
  breakeven10y,
  forwardInflation5y5y
}: InflationSpreadHeroProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const headlineYoYAll = useMemo(() => toYearOverYear(headlineCpi.observations), [headlineCpi.observations]);
  const coreYoYAll = useMemo(() => toYearOverYear(coreCpi.observations), [coreCpi.observations]);

  const headlineFiltered = useMemo(() => buildTimeWindow(headlineYoYAll, range), [headlineYoYAll, range]);
  const coreFiltered = useMemo(() => buildTimeWindow(coreYoYAll, range), [coreYoYAll, range]);
  const breakevenFiltered = useMemo(
    () => buildTimeWindow(breakeven10y.observations, range),
    [breakeven10y.observations, range]
  );
  const forwardFiltered = useMemo(
    () => buildTimeWindow(forwardInflation5y5y.observations, range),
    [forwardInflation5y5y.observations, range]
  );

  const noData =
    headlineYoYAll.length === 0 &&
    coreYoYAll.length === 0 &&
    breakeven10y.observations.length === 0 &&
    forwardInflation5y5y.observations.length === 0;

  if (noData) {
    return (
      <InteractiveChartShell
        title="Realized vs market-implied inflation"
        ariaLabel="Realized CPI inflation and market-implied breakevens with the Fed long-run goal reference"
      >
        <EChartPanel
          title="Realized vs market-implied inflation"
          state="empty"
          emptyMessage="Inflation and breakeven history is not currently active."
          height={380}
        />
      </InteractiveChartShell>
    );
  }

  // Build the list of candidate series, then filter empties so the legend
  // doesn't show zero-length lines.
  const candidates: BuiltSeries[] = [
    { name: "Headline CPI (YoY %)", color: HEADLINE_COLOR, observations: headlineFiltered },
    { name: "Core CPI (YoY %)", color: CORE_COLOR, observations: coreFiltered },
    { name: "10Y breakeven", color: BREAKEVEN_COLOR, observations: breakevenFiltered },
    { name: "5y5y forward inflation", color: FORWARD_COLOR, observations: forwardFiltered }
  ];
  const activeSeries = candidates.filter((s) => s.observations.length > 0);

  // The markLine sits on the first active series (canonical anchor); ECharts
  // markLines are global across the chart's y-axis, so the choice of host
  // series is decorative.
  const markedSeriesIndex = 0;

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 40, bottom: 64 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    legend: {
      data: activeSeries.map((s) => s.name),
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
      name: "Inflation (% YoY)",
      nameTextStyle: { color: chartColors.muted, fontSize: 11 }
    },
    dataZoom: [
      { type: "inside" as const, throttle: 50 },
      { type: "slider" as const, height: 18, bottom: 12 }
    ],
    series: activeSeries.map((s, idx) => ({
      name: s.name,
      type: "line" as const,
      showSymbol: false,
      lineStyle: { width: 1.6, color: s.color },
      itemStyle: { color: s.color },
      data: toLinePoints(s.observations),
      ...(idx === markedSeriesIndex
        ? {
            markLine: {
              silent: true,
              symbol: "none" as const,
              label: {
                color: chartColors.muted,
                fontSize: 10,
                formatter: "Fed long-run goal"
              },
              lineStyle: { type: "dashed" as const, color: chartColors.muted },
              data: [{ yAxis: FED_GOAL_PERCENT, name: "Fed long-run goal" }]
            }
          }
        : {})
    }))
  };

  const insight = describeLatest(activeSeries);

  return (
    <InteractiveChartShell
      title="Realized vs market-implied inflation"
      ariaLabel="Realized CPI inflation and market-implied breakevens with the Fed long-run goal reference"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight={insight}
    >
      <EChartPanel
        title="Realized vs market-implied inflation"
        description="Headline and Core CPI year-over-year, with 10Y breakevens and 5y5y forward inflation on the same percent axis. The dashed line at 2 percent is the Fed's long-run goal, shown as a descriptive reference."
        state="ready"
        option={option}
        ariaLabel="Multi-line time series of headline and core CPI year-over-year inflation alongside 10Y breakevens and 5y5y forward inflation, with a Fed long-run goal reference line at 2 percent."
        height={380}
      />
    </InteractiveChartShell>
  );
}
