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
import type { DerivedSeriesFile, Observation } from "../../lib/types";

/**
 * Hero commodity-impulse chart for the Commodities route.
 *
 * Dual-axis line chart:
 *   - Left axis: commodity inflation impulse (composite oil + crop momentum
 *     score, can be negative). A descriptive zero `markLine` anchors the
 *     neutral midpoint.
 *   - Right axis: Brent minus WTI crude spread (USD per barrel) as a
 *     contextual overlay — the spread is descriptive of relative
 *     supply/demand pressure, not a recommendation.
 *
 * Graceful degradation: the impulse series is short-lived at present
 * (sometimes only one observation). In that case the impulse renders as a
 * single point/marker while the long-history Brent-WTI overlay still
 * carries the time-series view.
 *
 * Tone: descriptive only. No advice or forecast language.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const IMPULSE_COLOR = chartCategoricalPalette[2]; // warning red — inflation pressure
const SPREAD_COLOR = chartCategoricalPalette[4]; // earthy blue — supply context

export interface CommodityImpulseHeroProps {
  impulse: DerivedSeriesFile;
  brentWtiSpread: DerivedSeriesFile;
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
    const isSpread = p.seriesName.toLowerCase().includes("brent");
    const formatted = isSpread
      ? `${formatNumber(value, 2)} USD/bbl`
      : formatNumber(value, 2);
    return `${dot}${p.seriesName}: <strong>${formatted}</strong>`;
  });
  return [`<strong>${date}</strong>`, ...rows].join("<br/>");
}

function describeLatest(
  impulse: DerivedSeriesFile,
  spread: DerivedSeriesFile
): string {
  const impLatest = impulse.observations[impulse.observations.length - 1];
  const spreadLatest = spread.observations[spread.observations.length - 1];

  if (!impLatest && !spreadLatest) {
    return "Commodity impulse and Brent-WTI spread history are not currently active.";
  }

  const parts: string[] = [];
  if (impLatest && Number.isFinite(impLatest.value)) {
    parts.push(
      `Commodity inflation impulse ${formatNumber(impLatest.value, 1)} on ${impLatest.date}`
    );
  }
  if (spreadLatest && Number.isFinite(spreadLatest.value)) {
    parts.push(
      `Brent-WTI spread ${formatNumber(spreadLatest.value, 2)} USD per barrel on ${spreadLatest.date}`
    );
  }
  return `${parts.join(". ")}.`;
}

export default function CommodityImpulseHero({
  impulse,
  brentWtiSpread
}: CommodityImpulseHeroProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const impulseFiltered = useMemo(
    () => buildTimeWindow(impulse.observations, range),
    [impulse.observations, range]
  );
  const spreadFiltered = useMemo(
    () => buildTimeWindow(brentWtiSpread.observations, range),
    [brentWtiSpread.observations, range]
  );

  const noData =
    impulse.observations.length === 0 && brentWtiSpread.observations.length === 0;

  if (noData) {
    return (
      <InteractiveChartShell
        title="Commodity impulse"
        ariaLabel="Commodity inflation impulse with Brent minus WTI spread overlay"
      >
        <EChartPanel
          title="Commodity impulse"
          state="empty"
          emptyMessage="Commodity impulse and Brent-WTI spread history are not currently active."
          height={380}
        />
      </InteractiveChartShell>
    );
  }

  const impulsePoints = toLinePoints(impulseFiltered);
  const spreadPoints = toLinePoints(spreadFiltered);

  // When impulse degrades to a single observation, show it as a labelled
  // symbol so the reader still sees a point on the impulse axis.
  const impulseSparse = impulsePoints.length <= 1;

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 40, bottom: 64, right: 56 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    legend: {
      data: ["Inflation impulse", "Brent − WTI spread"],
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
        name: "Impulse (score)",
        nameTextStyle: { color: chartColors.muted, fontSize: 11 }
      },
      {
        ...chartAxisDefaults,
        type: "value" as const,
        scale: true,
        name: "Brent − WTI (USD/bbl)",
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
        name: "Inflation impulse",
        type: "line" as const,
        yAxisIndex: 0,
        showSymbol: impulseSparse,
        symbolSize: impulseSparse ? 9 : 0,
        lineStyle: { width: 1.8, color: IMPULSE_COLOR },
        itemStyle: { color: IMPULSE_COLOR },
        data: impulsePoints,
        markLine: {
          silent: true,
          symbol: "none" as const,
          label: {
            color: chartColors.muted,
            fontSize: 10,
            formatter: "Neutral"
          },
          lineStyle: { type: "dashed" as const, color: chartColors.muted },
          data: [{ yAxis: 0 }]
        }
      },
      {
        name: "Brent − WTI spread",
        type: "line" as const,
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { width: 1.4, color: SPREAD_COLOR, type: "dashed" as const },
        itemStyle: { color: SPREAD_COLOR },
        data: spreadPoints
      }
    ]
  };

  const insight = describeLatest(impulse, brentWtiSpread);

  return (
    <InteractiveChartShell
      title="Commodity impulse"
      ariaLabel="Commodity inflation impulse with Brent minus WTI spread overlay"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight={insight}
    >
      <EChartPanel
        title="Commodity impulse"
        description="Commodity inflation impulse on the left axis with the Brent minus WTI spread overlay on the right."
        state="ready"
        option={option}
        ariaLabel="Dual-axis line chart of the commodity inflation impulse and the Brent minus WTI spread in USD per barrel."
        height={380}
      />
    </InteractiveChartShell>
  );
}
