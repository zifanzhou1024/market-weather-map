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
 * Hero sentiment-positioning chart for the Sentiment & Positioning route.
 *
 * Plots the rolling 1-year percentile (`percentile_252d`) of CFTC E-mini S&P
 * 500 asset-manager and leveraged-money net positioning on a single
 * percentile-value axis (0-100). The 50-percentile reference line is a silent,
 * dashed grey markLine — descriptive only, not a target or recommendation.
 *
 * Tone: descriptive only. The insight callout summarises the latest two
 * percentile values and the absolute gap between them; it does not advise.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const ASSET_MGR_COLOR = chartCategoricalPalette[0]; // forest green
const LEV_MONEY_COLOR = chartCategoricalPalette[4]; // slate blue

const NEUTRAL_PERCENTILE = 50;
const ALIGNED_THRESHOLD_PP = 10;

export interface SentimentPositioningHeroProps {
  assetManagerNet: TimeSeriesFile;
  leveragedMoneyNet: TimeSeriesFile;
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
    return `${dot}${p.seriesName}: <strong>${formatNumber(value, 1)}</strong>`;
  });
  return [`<strong>${date}</strong>`, ...rows].join("<br/>");
}

function latestPercentile(series: TimeSeriesFile): number | null {
  for (let i = series.observations.length - 1; i >= 0; i -= 1) {
    const obs = series.observations[i];
    if (
      obs.percentile_252d !== null &&
      obs.percentile_252d !== undefined &&
      Number.isFinite(obs.percentile_252d)
    ) {
      return obs.percentile_252d;
    }
  }
  return null;
}

function describeInsight(
  assetManagerNet: TimeSeriesFile,
  leveragedMoneyNet: TimeSeriesFile
): string | null {
  const am = latestPercentile(assetManagerNet);
  const lm = latestPercentile(leveragedMoneyNet);
  if (am === null || lm === null) return null;
  const gap = Math.abs(am - lm);
  const tail =
    gap < ALIGNED_THRESHOLD_PP ? " Broadly aligned." : " In disagreement.";
  return `Asset managers at ${formatNumber(am, 0)} percentile, leveraged money at ${formatNumber(
    lm,
    0
  )} percentile. ${formatNumber(gap, 0)} pp gap.${tail}`;
}

function hasUsablePercentiles(series: TimeSeriesFile): boolean {
  return series.observations.some(
    (o) =>
      o.percentile_252d !== null &&
      o.percentile_252d !== undefined &&
      Number.isFinite(o.percentile_252d)
  );
}

export default function SentimentPositioningHero({
  assetManagerNet,
  leveragedMoneyNet
}: SentimentPositioningHeroProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const assetMgrFiltered = useMemo(
    () => buildTimeWindow(assetManagerNet.observations, range),
    [assetManagerNet.observations, range]
  );
  const levMoneyFiltered = useMemo(
    () => buildTimeWindow(leveragedMoneyNet.observations, range),
    [leveragedMoneyNet.observations, range]
  );

  const usable =
    hasUsablePercentiles(assetManagerNet) || hasUsablePercentiles(leveragedMoneyNet);

  if (!usable) {
    return (
      <InteractiveChartShell
        title="Sentiment positioning"
        ariaLabel="CFTC asset-manager and leveraged-money positioning percentile dual line"
      >
        <EChartPanel
          title="Sentiment positioning"
          state="empty"
          emptyMessage="CFTC positioning data is not currently active."
          height={380}
        />
      </InteractiveChartShell>
    );
  }

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 40, bottom: 64 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    legend: {
      data: ["Asset manager net", "Leveraged money net"],
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
      min: 0,
      max: 100,
      name: "Percentile",
      nameTextStyle: { color: chartColors.muted, fontSize: 11 }
    },
    dataZoom: [
      { type: "inside" as const, throttle: 50 },
      { type: "slider" as const, height: 18, bottom: 12 }
    ],
    series: [
      {
        name: "Asset manager net",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.6, color: ASSET_MGR_COLOR },
        itemStyle: { color: ASSET_MGR_COLOR },
        data: toPercentilePoints(assetMgrFiltered),
        markLine: {
          silent: true,
          symbol: "none" as const,
          label: {
            color: chartColors.muted,
            fontSize: 10,
            formatter: "Neutral (50)"
          },
          lineStyle: { type: "dashed" as const, color: chartColors.muted },
          data: [{ yAxis: NEUTRAL_PERCENTILE, name: "Neutral reference" }]
        }
      },
      {
        name: "Leveraged money net",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.6, color: LEV_MONEY_COLOR },
        itemStyle: { color: LEV_MONEY_COLOR },
        data: toPercentilePoints(levMoneyFiltered)
      }
    ]
  };

  const insight = describeInsight(assetManagerNet, leveragedMoneyNet);

  return (
    <InteractiveChartShell
      title="Sentiment positioning"
      ariaLabel="CFTC asset-manager and leveraged-money positioning percentile dual line"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight={insight ?? undefined}
    >
      <EChartPanel
        title="Sentiment positioning"
        description="Rolling 1-year percentile of CFTC E-mini S&P 500 asset-manager and leveraged-money net positioning. The 50-percentile reference line is a descriptive neutral marker."
        state="ready"
        option={option}
        ariaLabel="Dual-line time series of asset-manager and leveraged-money positioning percentiles."
        height={380}
      />
    </InteractiveChartShell>
  );
}
