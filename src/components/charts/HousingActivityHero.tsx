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
 * Hero housing-activity-vs-mortgage chart for the Housing route.
 *
 * Dual-axis time series:
 *   - Housing starts (left axis, thousands of units SAAR) — solid line.
 *   - Building permits (left axis, thousands of units SAAR) — dashed line.
 *   - 30Y mortgage rate (right axis, percent) — solid line.
 *
 * Two descriptive markLines anchor the reference levels:
 *   - Left axis at 1,500 labeled "Long-run mid" (neutral grey).
 *   - Right axis at 6.0 labeled "Recent multi-year average" (neutral grey).
 *
 * Both reference lines are descriptive; they are not forecasts, targets, or
 * recommendations. The tooltip formats the unit-of-measure inline so the
 * reader understands that the left axis is units and the right axis is
 * percent.
 *
 * Tone: descriptive only. No buy/sell/short/target/stop/forecast language.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const STARTS_COLOR = chartCategoricalPalette[0]; // earthy green
const PERMITS_COLOR = chartCategoricalPalette[1]; // support green
const MORTGAGE_COLOR = chartCategoricalPalette[2]; // warning red — affordability pressure

const LEFT_LONG_RUN_MID = 1500;
const RIGHT_RECENT_AVERAGE_PCT = 6.0;

export interface HousingActivityHeroProps {
  housingStarts: TimeSeriesFile;
  buildingPermits: TimeSeriesFile;
  mortgageRate30y: TimeSeriesFile;
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
    const isMortgage = p.seriesName.toLowerCase().includes("mortgage");
    const formatted = isMortgage
      ? `${formatNumber(value, 2)}%`
      : `${formatNumber(value, 0)} units`;
    return `${dot}${p.seriesName}: <strong>${formatted}</strong>`;
  });
  return [`<strong>${date}</strong>`, ...rows].join("<br/>");
}

function describeLatest(
  starts: TimeSeriesFile,
  permits: TimeSeriesFile,
  mortgage: TimeSeriesFile
): string {
  const startsLatest = starts.observations[starts.observations.length - 1];
  const permitsLatest = permits.observations[permits.observations.length - 1];
  const mortgageLatest = mortgage.observations[mortgage.observations.length - 1];

  if (!startsLatest && !permitsLatest && !mortgageLatest) {
    return "Housing and mortgage history is not currently active.";
  }

  const parts: string[] = [];
  if (startsLatest && Number.isFinite(startsLatest.value)) {
    parts.push(`Housing starts ${formatNumber(startsLatest.value, 0)} units on ${startsLatest.date}`);
  }
  if (permitsLatest && Number.isFinite(permitsLatest.value)) {
    parts.push(`building permits ${formatNumber(permitsLatest.value, 0)} units on ${permitsLatest.date}`);
  }
  if (mortgageLatest && Number.isFinite(mortgageLatest.value)) {
    parts.push(`30Y mortgage rate ${formatNumber(mortgageLatest.value, 2)}% on ${mortgageLatest.date}`);
  }
  return `${parts.join("; ")}. Permits and starts read residential construction momentum; the mortgage rate reads affordability pressure on that momentum.`;
}

export default function HousingActivityHero({
  housingStarts,
  buildingPermits,
  mortgageRate30y
}: HousingActivityHeroProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const startsFiltered = useMemo(
    () => buildTimeWindow(housingStarts.observations, range),
    [housingStarts.observations, range]
  );
  const permitsFiltered = useMemo(
    () => buildTimeWindow(buildingPermits.observations, range),
    [buildingPermits.observations, range]
  );
  const mortgageFiltered = useMemo(
    () => buildTimeWindow(mortgageRate30y.observations, range),
    [mortgageRate30y.observations, range]
  );

  const noData =
    housingStarts.observations.length === 0 &&
    buildingPermits.observations.length === 0 &&
    mortgageRate30y.observations.length === 0;

  if (noData) {
    return (
      <InteractiveChartShell
        title="Housing activity vs mortgage rate"
        ariaLabel="Housing starts, building permits, and 30Y mortgage rate dual-axis time series with reference markLines"
      >
        <EChartPanel
          title="Housing activity vs mortgage rate"
          state="empty"
          emptyMessage="Housing and mortgage history is not currently active."
          height={380}
        />
      </InteractiveChartShell>
    );
  }

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 40, bottom: 64, right: 56 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      axisPointer: { snap: true },
      formatter: tooltipFormatter
    },
    legend: {
      data: ["Housing starts", "Building permits", "30Y mortgage rate"],
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
        name: "Annual rate (thousands of units)",
        nameTextStyle: { color: chartColors.muted, fontSize: 11 }
      },
      {
        ...chartAxisDefaults,
        type: "value" as const,
        scale: true,
        name: "30Y mortgage rate (%)",
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
        name: "Housing starts",
        type: "line" as const,
        yAxisIndex: 0,
        showSymbol: false,
        lineStyle: { width: 1.6, color: STARTS_COLOR },
        itemStyle: { color: STARTS_COLOR },
        data: toLinePoints(startsFiltered),
        markLine: {
          silent: true,
          symbol: "none" as const,
          label: {
            color: chartColors.muted,
            fontSize: 10,
            formatter: "Long-run mid"
          },
          lineStyle: { type: "dashed" as const, color: chartColors.muted },
          data: [{ yAxis: LEFT_LONG_RUN_MID, name: "Long-run mid" }]
        }
      },
      {
        name: "Building permits",
        type: "line" as const,
        yAxisIndex: 0,
        showSymbol: false,
        lineStyle: { width: 1.4, color: PERMITS_COLOR, type: "dashed" as const },
        itemStyle: { color: PERMITS_COLOR },
        data: toLinePoints(permitsFiltered)
      },
      {
        name: "30Y mortgage rate",
        type: "line" as const,
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { width: 1.6, color: MORTGAGE_COLOR },
        itemStyle: { color: MORTGAGE_COLOR },
        data: toLinePoints(mortgageFiltered),
        markLine: {
          silent: true,
          symbol: "none" as const,
          label: {
            color: chartColors.muted,
            fontSize: 10,
            formatter: "Recent multi-year average"
          },
          lineStyle: { type: "dashed" as const, color: chartColors.muted },
          data: [{ yAxis: RIGHT_RECENT_AVERAGE_PCT, name: "Recent multi-year average" }]
        }
      }
    ]
  };

  const insight = describeLatest(housingStarts, buildingPermits, mortgageRate30y);

  return (
    <InteractiveChartShell
      title="Housing activity vs mortgage rate"
      ariaLabel="Housing starts, building permits, and 30Y mortgage rate dual-axis time series with reference markLines"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight={insight}
    >
      <EChartPanel
        title="Housing activity vs mortgage rate"
        description="Housing starts and building permits on the left axis (annual rate, thousands of units); the 30Y mortgage rate on the right axis (percent). Both reference lines are descriptive only."
        state="ready"
        option={option}
        ariaLabel="Dual-axis line chart of housing starts and building permits (left) with the 30-year mortgage rate (right)."
        height={380}
      />
    </InteractiveChartShell>
  );
}
