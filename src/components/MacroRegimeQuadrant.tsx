import { useEffect, useMemo, useState } from "react";
import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartColors,
  chartGridDefaults,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import { formatIsoDate, formatNumber, formatSignedScore } from "../charts/chartFormatters";
import { loadRegimeDashboard } from "../lib/data";
import type {
  RegimeDashboardFile,
  RegimeWindowKey,
  RegimeWindowPoint
} from "../lib/types";

/**
 * Macro regime quadrant — strategic counterpart to `RegimeQuadrantChart`.
 * Reads the same `regime_dashboard.json` data with the same axis convention
 * (real-yield-x, dollar-y) but defaults to the longer 60D window so it
 * surfaces the slower regime backdrop in the long-term macro climate route.
 *
 * Axes:
 *   x = real_yield_change_bps
 *   y = dollar_change_pct
 *
 * Encoding:
 *   - visualMap color (dim 2) = vix_percentile
 *   - latest point carries a date label
 *   - quadrant-meaning legend rendered below the chart
 *
 * Window controls switch between 20D / 60D / 120D lookbacks. Tone is
 * descriptive only.
 */

const WINDOW_OPTIONS: RegimeWindowKey[] = ["20D", "60D", "120D"];
const DEFAULT_WINDOW: RegimeWindowKey = "60D";

interface ScatterDatum {
  value: [number, number, number];
  date: string;
  regime: RegimeWindowPoint["regime"];
  vixPercentile: number;
  creditChange: number;
  itemStyle?: { borderColor?: string; borderWidth?: number };
  symbolSize: number;
  label?: {
    show: boolean;
    formatter: string;
    position: string;
    color: string;
    fontSize: number;
    distance: number;
  };
}

interface ScatterTooltipParams {
  data: ScatterDatum;
}

function maxAbs(values: number[], floor: number): number {
  let m = floor;
  for (const v of values) {
    if (Number.isFinite(v) && Math.abs(v) > m) m = Math.abs(v);
  }
  return m;
}

export function buildMacroScatterData(points: RegimeWindowPoint[]): ScatterDatum[] {
  if (points.length === 0) return [];
  return points.map((point, index) => {
    const isLatest = index === points.length - 1;
    const datum: ScatterDatum = {
      value: [
        point.real_yield_change_bps,
        point.dollar_change_pct,
        point.vix_percentile
      ],
      date: point.date,
      regime: point.regime,
      vixPercentile: point.vix_percentile,
      creditChange: point.credit_change_bps,
      symbolSize: isLatest ? 16 : 9
    };
    if (isLatest) {
      datum.itemStyle = { borderColor: chartColors.warning, borderWidth: 2 };
      datum.label = {
        show: true,
        formatter: formatIsoDate(point.date),
        position: "right",
        color: chartColors.text,
        fontSize: 12,
        distance: 8
      };
    }
    return datum;
  });
}

function buildOption(points: RegimeWindowPoint[]) {
  const xSpan = maxAbs(points.map((p) => p.real_yield_change_bps), 20);
  const ySpan = maxAbs(points.map((p) => p.dollar_change_pct), 1);
  const xMax = xSpan * 1.15;
  const yMax = ySpan * 1.15;
  const scatterData = buildMacroScatterData(points);

  return {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 36, bottom: 80, left: 68, right: 40 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (raw: unknown) => {
        const params = raw as ScatterTooltipParams;
        const d = params.data;
        if (!d || !Array.isArray(d.value)) return "";
        const [realY, dol, vix] = d.value;
        return [
          `<strong>${formatIsoDate(d.date)}</strong>`,
          `Real-yield change ${formatSignedScore(realY, 0)} bps`,
          `Dollar change ${formatSignedScore(dol, 2)}%`,
          `VIX percentile ${formatNumber(vix, 1)}`,
          `Credit change ${formatSignedScore(d.creditChange, 0)} bps`,
          `Regime ${d.regime.replace(/_/g, " ")}`
        ].join("<br/>");
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      name: "Real-yield change (bps)",
      nameLocation: "middle" as const,
      nameGap: 30,
      min: -xMax,
      max: xMax,
      scale: false
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      name: "Dollar change (%)",
      nameLocation: "middle" as const,
      nameGap: 48,
      min: -yMax,
      max: yMax,
      scale: false
    },
    visualMap: [
      {
        type: "continuous" as const,
        seriesIndex: 0,
        dimension: 2,
        min: 0,
        max: 100,
        calculable: true,
        orient: "horizontal" as const,
        left: "center",
        bottom: 6,
        text: ["High VIX %", "Low VIX %"],
        textStyle: { color: chartColors.muted, fontSize: 11 },
        inRange: {
          color: ["#3a7d5b", "#dbcb7a", "#b04a3a"]
        },
        outOfRange: { color: [chartColors.muted] }
      }
    ],
    series: [
      {
        name: "Macro regime points",
        type: "scatter" as const,
        symbol: "circle",
        data: scatterData,
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: chartColors.axis, type: "dashed" as const, width: 1 },
          data: [{ xAxis: 0 }, { yAxis: 0 }]
        },
        markArea: {
          silent: true,
          itemStyle: { color: "rgba(0,0,0,0)" },
          data: [
            [
              {
                name: "risk-on easing",
                xAxis: -xMax,
                yAxis: -yMax,
                label: {
                  show: true,
                  position: "insideBottomLeft" as const,
                  color: chartColors.muted,
                  fontSize: 11,
                  fontStyle: "italic" as const,
                  formatter: "risk-on easing"
                }
              },
              { xAxis: 0, yAxis: 0 }
            ],
            [
              {
                name: "global tightening / risk-off",
                xAxis: 0,
                yAxis: 0,
                label: {
                  show: true,
                  position: "insideTopRight" as const,
                  color: chartColors.muted,
                  fontSize: 11,
                  fontStyle: "italic" as const,
                  formatter: "global tightening / risk-off"
                }
              },
              { xAxis: xMax, yAxis: yMax }
            ],
            [
              {
                name: "safe-haven / growth scare",
                xAxis: -xMax,
                yAxis: 0,
                label: {
                  show: true,
                  position: "insideTopLeft" as const,
                  color: chartColors.muted,
                  fontSize: 11,
                  fontStyle: "italic" as const,
                  formatter: "safe-haven / growth scare"
                }
              },
              { xAxis: 0, yAxis: yMax }
            ],
            [
              {
                name: "rotation / reflation / mixed",
                xAxis: 0,
                yAxis: -yMax,
                label: {
                  show: true,
                  position: "insideBottomRight" as const,
                  color: chartColors.muted,
                  fontSize: 11,
                  fontStyle: "italic" as const,
                  formatter: "rotation / reflation / mixed"
                }
              },
              { xAxis: xMax, yAxis: 0 }
            ]
          ]
        }
      },
      {
        name: "Macro trail",
        type: "line" as const,
        smooth: false,
        showSymbol: false,
        z: 1,
        lineStyle: {
          color: chartColors.primary,
          width: 1.2,
          opacity: 0.55
        },
        data: points.map((p) => [p.real_yield_change_bps, p.dollar_change_pct])
      }
    ]
  };
}

export default function MacroRegimeQuadrant() {
  const [dashboard, setDashboard] = useState<RegimeDashboardFile | null | undefined>(undefined);
  const [window, setWindow] = useState<RegimeWindowKey>(DEFAULT_WINDOW);

  useEffect(() => {
    let active = true;
    loadRegimeDashboard()
      .then((file) => {
        if (active) setDashboard(file);
      })
      .catch(() => {
        if (active) setDashboard(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const points = useMemo<RegimeWindowPoint[]>(() => {
    if (!dashboard) return [];
    const w = dashboard.windows[window];
    return Array.isArray(w) ? w : [];
  }, [dashboard, window]);

  const option = useMemo(() => (points.length > 0 ? buildOption(points) : null), [points]);

  const isLoading = dashboard === undefined;
  const hasData = points.length > 0;

  return (
    <section className="panel chart-panel macro-regime-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Strategic regime</p>
          <h3>Macro regime quadrant trail</h3>
        </div>
        <p aria-label="Active lookback window">{`${window} change`}</p>
      </div>
      <p className="chart-panel__description">
        Recent strategic backdrop: real-yield change vs dollar change. Quadrants describe whether
        the policy / USD regime is tightening, easing, or rotating across this window.
      </p>
      <div
        className="chart-range-controls macro-regime-window-controls"
        role="radiogroup"
        aria-label="Macro regime lookback window"
      >
        {WINDOW_OPTIONS.map((w) => {
          const isActive = w === window;
          const className = [
            "chart-range-controls__button",
            isActive ? "chart-range-controls__button--active" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={isActive ? "true" : "false"}
              aria-label={`Show ${w} macro regime trail`}
              tabIndex={isActive ? 0 : -1}
              className={className}
              onClick={() => {
                if (w !== window) setWindow(w);
              }}
            >
              {w}
            </button>
          );
        })}
      </div>
      {isLoading ? (
        <EChartPanel
          title="Macro regime quadrant trail"
          state="loading"
          height={420}
        />
      ) : hasData && option ? (
        <EChartPanel
          title="Macro regime quadrant trail"
          state="ready"
          option={option}
          ariaLabel="Scatter plot of macro regime path: real-yield change on the x-axis, dollar change on the y-axis, colored by VIX percentile."
          height={420}
        />
      ) : (
        <EChartPanel
          title="Macro regime quadrant trail"
          state="empty"
          emptyMessage="No regime-dashboard observations are available for this window."
          height={420}
        />
      )}
      <dl className="quadrant-legend" aria-label="Quadrant meaning legend">
        <div>
          <dt>Bottom-left (real yield down, dollar weaker)</dt>
          <dd>risk-on easing</dd>
        </div>
        <div>
          <dt>Top-right (real yield up, dollar stronger)</dt>
          <dd>global tightening / risk-off</dd>
        </div>
        <div>
          <dt>Top-left (real yield down, dollar stronger)</dt>
          <dd>safe-haven / growth scare</dd>
        </div>
        <div>
          <dt>Bottom-right (real yield up, dollar weaker)</dt>
          <dd>rotation / reflation / mixed</dd>
        </div>
      </dl>
    </section>
  );
}
