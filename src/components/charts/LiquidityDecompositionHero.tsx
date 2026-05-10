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
 * Hero net-liquidity chart for the Liquidity route.
 *
 * Renders the precomputed net-liquidity proxy (Fed assets minus the Treasury
 * General Account minus reverse-repo balances) as an area series in USD
 * billions over time. The chart's `summary` block carries 1-month and
 * 3-month change values; we expose those as a compact descriptive strip
 * above the area so the reader sees both the level history and the
 * recent direction without scrolling.
 *
 * The current `net_liquidity.json` file does not include a per-component
 * decomposition; only the proxy itself is available. The chart is therefore
 * "decomposition-ready" — the area series is named so a future agent can
 * add component layers without renaming the public component.
 *
 * Tone: descriptive only. The change strip presents signed deltas without
 * recommendation or forecast language.
 */

const AVAILABLE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];
const DEFAULT_PRESET: RangePreset = "1Y";

const NET_LIQUIDITY_COLOR = chartCategoricalPalette[0]; // earthy green primary
const AREA_FILL_COLOR = "rgba(49, 72, 58, 0.18)";

export interface LiquidityDecompositionHeroProps {
  netLiquidity: DerivedSeriesFile;
}

function toLinePoints(obs: Observation[]): Array<[string, number]> {
  return obs
    .filter((o) => Number.isFinite(o.value))
    .map((o) => [o.date, o.value / 1_000] as [string, number]); // millions → billions
}

function formatBillionsDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value / 1_000, 1)} bn`;
}

function describeLatest(netLiquidity: DerivedSeriesFile): string {
  const latest = netLiquidity.observations[netLiquidity.observations.length - 1];
  const summary = netLiquidity.summary;
  if (!latest || !Number.isFinite(latest.value)) {
    return "Net liquidity history is not currently active.";
  }
  const levelBn = formatNumber(latest.value / 1_000, 1);
  const oneM = summary?.change_1m ?? null;
  const threeM = summary?.change_3m ?? null;
  return `Net liquidity ${levelBn} bn USD on ${latest.date}. 1-month change ${formatBillionsDelta(oneM)}, 3-month change ${formatBillionsDelta(threeM)}.`;
}

function tooltipFormatter(raw: unknown): string {
  const params = Array.isArray(raw)
    ? (raw as Array<{
        axisValueLabel?: string;
        seriesName: string;
        value: [string, number];
        color?: string;
      }>)
    : [];
  if (!params.length) return "";
  const date = params[0].axisValueLabel ?? "";
  const rows = params.map((p) => {
    const value = Array.isArray(p.value) ? p.value[1] : (p.value as unknown as number);
    const dot = p.color ? `<span style="color:${p.color}">●</span> ` : "";
    return `${dot}${p.seriesName}: <strong>${formatNumber(value, 1)} bn USD</strong>`;
  });
  return [`<strong>${date}</strong>`, ...rows].join("<br/>");
}

export default function LiquidityDecompositionHero({
  netLiquidity
}: LiquidityDecompositionHeroProps) {
  const [range, setRange] = useState<RangePreset>(DEFAULT_PRESET);

  const filtered = useMemo(
    () => buildTimeWindow(netLiquidity.observations, range),
    [netLiquidity.observations, range]
  );

  if (netLiquidity.observations.length === 0) {
    return (
      <InteractiveChartShell
        title="Net liquidity"
        ariaLabel="Net liquidity proxy history with recent 1-month and 3-month change strip"
      >
        <EChartPanel
          title="Net liquidity"
          state="empty"
          emptyMessage="Net liquidity history is not currently active."
          height={380}
        />
      </InteractiveChartShell>
    );
  }

  const linePoints = toLinePoints(filtered);

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 36, bottom: 64 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    legend: {
      data: ["Net liquidity"],
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
      name: "USD (billions)",
      nameTextStyle: { color: chartColors.muted, fontSize: 11 }
    },
    dataZoom: [
      { type: "inside" as const, throttle: 50 },
      { type: "slider" as const, height: 18, bottom: 12 }
    ],
    series: [
      {
        name: "Net liquidity",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.8, color: NET_LIQUIDITY_COLOR },
        itemStyle: { color: NET_LIQUIDITY_COLOR },
        areaStyle: { color: AREA_FILL_COLOR },
        data: linePoints
      }
    ]
  };

  const summary = netLiquidity.summary;
  const oneM = summary?.change_1m ?? null;
  const threeM = summary?.change_3m ?? null;
  const oneW = summary?.change_1w ?? null;
  const insight = describeLatest(netLiquidity);

  const changeStrip = (
    <div className="hero-change-strip" role="group" aria-label="Net liquidity recent changes">
      <div className="hero-change-strip__row">
        <span className="hero-change-strip__label">1-week change</span>
        <span
          className={`hero-change-strip__value hero-change-strip__value--${oneW && Number.isFinite(oneW) && oneW > 0 ? "up" : oneW && Number.isFinite(oneW) && oneW < 0 ? "down" : "flat"}`}
        >
          {formatBillionsDelta(oneW)}
        </span>
      </div>
      <div className="hero-change-strip__row">
        <span className="hero-change-strip__label">1-month change</span>
        <span
          className={`hero-change-strip__value hero-change-strip__value--${oneM && Number.isFinite(oneM) && oneM > 0 ? "up" : oneM && Number.isFinite(oneM) && oneM < 0 ? "down" : "flat"}`}
        >
          {formatBillionsDelta(oneM)}
        </span>
      </div>
      <div className="hero-change-strip__row">
        <span className="hero-change-strip__label">3-month change</span>
        <span
          className={`hero-change-strip__value hero-change-strip__value--${threeM && Number.isFinite(threeM) && threeM > 0 ? "up" : threeM && Number.isFinite(threeM) && threeM < 0 ? "down" : "flat"}`}
        >
          {formatBillionsDelta(threeM)}
        </span>
      </div>
    </div>
  );

  return (
    <InteractiveChartShell
      title="Net liquidity"
      ariaLabel="Net liquidity proxy history with recent 1-month and 3-month change strip"
      range={range}
      onRangeChange={setRange}
      availableRangePresets={AVAILABLE_PRESETS}
      insight={
        <div className="hero-callout">
          <p className="hero-callout__message">{insight}</p>
          {changeStrip}
        </div>
      }
    >
      <EChartPanel
        title="Net liquidity"
        description="Fed assets minus the Treasury General Account minus reverse repo, in USD billions."
        state="ready"
        option={option}
        ariaLabel="Area line chart of net liquidity proxy in USD billions over time."
        height={380}
      />
    </InteractiveChartShell>
  );
}
