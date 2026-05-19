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
import { useT } from "../lib/i18n";

/**
 * Regime quadrant chart — rebuilt in ECharts (W3C) replacing the legacy
 * Recharts implementation. Reads `regime_dashboard.json` and renders a
 * connected scatter+line trail of the dollar / real-yield regime path over
 * the selected lookback window.
 *
 * Axes (standardized after W3C):
 *   x = real_yield_change_bps (positive = tightening / rising real yields)
 *   y = dollar_change_pct     (positive = stronger dollar)
 *
 * Visual encoding:
 *   - color (visualMap, dim 2) = vix_percentile of each point
 *   - size (visualMap, dim 3)  = absolute credit_change_bps magnitude
 *   - opacity (line strokeOpacity) blends old (faint) to new (full)
 *
 * Annotations:
 *   - markLine at x=0 and y=0 frame the four quadrants
 *   - markArea labels describe each quadrant in plain language:
 *       x<0, y<0 → "risk-on easing"
 *       x>0, y>0 → "global tightening / risk-off"
 *       x<0, y>0 → "safe-haven / growth scare"
 *       x>0, y<0 → "rotation / reflation / mixed"
 *   - latest point carries a date label (right-aligned)
 *   - quadrant-meaning legend rendered below the chart as plain text
 *
 * Window controls: a local segmented control switches between 20D / 60D /
 * 120D lookbacks (regime_dashboard.json carries those three windows). The
 * project's `ChartRangeControls` is constrained to calendar-time presets
 * (1M / 3M / ... / All); regime windows are observation-count windows so a
 * small local control matches their semantics without expanding the global
 * preset enum.
 *
 * Tone: descriptive only. Quadrant labels describe coordinates; no advice or
 * directional recommendation language.
 */

const WINDOW_OPTIONS: RegimeWindowKey[] = ["20D", "60D", "120D"];
const DEFAULT_WINDOW: RegimeWindowKey = "20D";

interface ScatterDatum {
  value: [number, number, number, number];
  date: string;
  regime: RegimeWindowPoint["regime"];
  vixPercentile: number;
  creditChange: number;
  recencyIndex: number;
  symbolSize: number;
  itemStyle?: { borderColor?: string; borderWidth?: number };
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

function symbolSizeForCredit(change: number): number {
  // Map absolute credit change (bps) to symbol radius. Linear with a floor so
  // very small credit moves still render visibly.
  const magnitude = Math.abs(change);
  if (!Number.isFinite(magnitude)) return 8;
  const scaled = 6 + Math.min(magnitude, 80) / 5;
  return Math.max(6, Math.min(22, scaled));
}

export function buildScatterData(points: RegimeWindowPoint[]): ScatterDatum[] {
  if (points.length === 0) return [];
  return points.map((point, index) => {
    const isLatest = index === points.length - 1;
    const datum: ScatterDatum = {
      value: [
        point.real_yield_change_bps,
        point.dollar_change_pct,
        point.vix_percentile,
        Math.abs(point.credit_change_bps)
      ],
      date: point.date,
      regime: point.regime,
      vixPercentile: point.vix_percentile,
      creditChange: point.credit_change_bps,
      recencyIndex: index,
      symbolSize: symbolSizeForCredit(point.credit_change_bps)
    };
    if (isLatest) {
      datum.itemStyle = { borderColor: chartColors.warning, borderWidth: 2 };
      datum.label = {
        show: true,
        formatter: formatIsoDate(point.date),
        position: "right",
        color: chartColors.text,
        fontSize: 11,
        distance: 8
      };
    }
    return datum;
  });
}

const QUADRANT_LABELS: Array<{
  name: string;
  xRange: [number, number] | "negative" | "positive";
  yRange: [number, number] | "negative" | "positive";
  position: "insideTopLeft" | "insideTopRight" | "insideBottomLeft" | "insideBottomRight";
}> = [
  { name: "risk-on easing", xRange: "negative", yRange: "negative", position: "insideBottomLeft" },
  {
    name: "global tightening / risk-off",
    xRange: "positive",
    yRange: "positive",
    position: "insideTopRight"
  },
  {
    name: "safe-haven / growth scare",
    xRange: "negative",
    yRange: "positive",
    position: "insideTopLeft"
  },
  {
    name: "rotation / reflation / mixed",
    xRange: "positive",
    yRange: "negative",
    position: "insideBottomRight"
  }
];

function rangeToBounds(
  range: [number, number] | "negative" | "positive",
  span: number
): { from: number; to: number } {
  if (range === "negative") return { from: -span, to: 0 };
  if (range === "positive") return { from: 0, to: span };
  return { from: range[0], to: range[1] };
}

export function quadrantMarkAreaData(span: { x: number; y: number }) {
  return QUADRANT_LABELS.map((q) => {
    const x = rangeToBounds(q.xRange, span.x);
    const y = rangeToBounds(q.yRange, span.y);
    return [
      {
        name: q.name,
        xAxis: x.from,
        yAxis: y.from,
        label: {
          show: true,
          position: q.position,
          color: chartColors.muted,
          fontSize: 10,
          fontStyle: "italic" as const,
          formatter: q.name
        }
      },
      { xAxis: x.to, yAxis: y.to }
    ];
  });
}

function maxAbs(values: number[], floor: number): number {
  let m = floor;
  for (const v of values) {
    if (Number.isFinite(v) && Math.abs(v) > m) m = Math.abs(v);
  }
  return m;
}

function buildOption(points: RegimeWindowPoint[]) {
  const scatterData = buildScatterData(points);
  const xSpan = maxAbs(points.map((p) => p.real_yield_change_bps), 20);
  const ySpan = maxAbs(points.map((p) => p.dollar_change_pct), 1);
  // Pad the axis spans so the markArea labels have room to render.
  const xMax = xSpan * 1.15;
  const yMax = ySpan * 1.15;

  return {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: 32, bottom: 64, left: 60, right: 36 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "item" as const,
      formatter: (raw: unknown) => {
        const params = raw as ScatterTooltipParams;
        const d = params.data;
        if (!d || !Array.isArray(d.value)) return "";
        const [realY, dol, vix, credit] = d.value;
        return [
          `<strong>${formatIsoDate(d.date)}</strong>`,
          `Real-yield change ${formatSignedScore(realY, 0)} bps`,
          `Dollar change ${formatSignedScore(dol, 2)}%`,
          `VIX percentile ${formatNumber(vix, 1)}`,
          `Credit change ${formatSignedScore(d.creditChange, 0)} bps (size = ${formatNumber(credit, 0)})`,
          `Regime ${d.regime.replace(/_/g, " ")}`
        ].join("<br/>");
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      name: "Real-yield change (bps)",
      nameLocation: "middle" as const,
      nameGap: 28,
      min: -xMax,
      max: xMax,
      scale: false
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      name: "Dollar change (%)",
      nameLocation: "middle" as const,
      nameGap: 44,
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
        bottom: 4,
        text: ["High VIX %", "Low VIX %"],
        textStyle: { color: chartColors.muted, fontSize: 10 },
        inRange: {
          color: ["#3a7d5b", "#dbcb7a", "#b04a3a"]
        },
        outOfRange: { color: [chartColors.muted] }
      }
    ],
    series: [
      {
        name: "Regime points",
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
          data: quadrantMarkAreaData({ x: xMax, y: yMax })
        }
      },
      {
        name: "Trail",
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

function windowAriaLabel(window: RegimeWindowKey): string {
  return `Show ${window} regime quadrant trail`;
}

export default function RegimeQuadrantChart() {
  const { t } = useT();
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
  const eyebrow = `${window} ${t("sections.change").toLowerCase()}`;

  return (
    <section className="panel chart-panel regime-quadrant-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t("focus.regime_drivers.eyebrow")}</p>
          <h3>Dollar and real-yield quadrant</h3>
        </div>
        <p aria-label="Active lookback window">{eyebrow}</p>
      </div>
      <div
        className="chart-range-controls regime-window-controls"
        role="radiogroup"
        aria-label="Regime quadrant lookback window"
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
              aria-label={windowAriaLabel(w)}
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
          title="Dollar and real-yield quadrant"
          state="loading"
          height={360}
        />
      ) : hasData && option ? (
        <EChartPanel
          title="Dollar and real-yield quadrant"
          state="ready"
          option={option}
          ariaLabel="Scatter plot of regime path: real-yield change on the x-axis, dollar change on the y-axis, colored by VIX percentile and sized by credit change."
          height={360}
        />
      ) : (
        <EChartPanel
          title="Dollar and real-yield quadrant"
          state="empty"
          emptyMessage="No regime-dashboard observations are available for this window."
          height={360}
        />
      )}
      <dl className="quadrant-legend" aria-label={t("panels.quadrantLegendAria")}>
        <div>
          <dt>{t("panels.quadrantBottomLeft")}</dt>
          <dd>{t("panels.quadrantRiskOnEasing")}</dd>
        </div>
        <div>
          <dt>{t("panels.quadrantTopRight")}</dt>
          <dd>{t("panels.quadrantGlobalTightening")}</dd>
        </div>
        <div>
          <dt>{t("panels.quadrantTopLeft")}</dt>
          <dd>{t("panels.quadrantSafeHaven")}</dd>
        </div>
        <div>
          <dt>{t("panels.quadrantBottomRight")}</dt>
          <dd>{t("panels.quadrantRotation")}</dd>
        </div>
      </dl>
    </section>
  );
}
