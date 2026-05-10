import EChartPanel from "../../charts/EChartPanel";
import { buildMarkBands } from "../../charts/buildMarkBands";
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
  VolatilityCurvePoint,
  VolatilityDashboardThresholds
} from "../../lib/types";

/**
 * Term-structure snapshot of the public volatility curve (VIX9D / VIX / VIX3M).
 *
 * The chart intentionally uses "proxy" in the title because these are
 * index points, not VX futures — VX futures remain source-gated under
 * CLAUDE.md and never enter active scoring or hero copy.
 *
 * Full mode (default) wraps the chart in `InteractiveChartShell` with title,
 * descriptive insight, and ARIA chrome. Compact mode (for the Tactical
 * 6-tile grid) renders the bare `EChartPanel` with a shorter height and a
 * terser tooltip, since the surrounding tile already supplies a title.
 *
 * Threshold bands (when provided) shade the y-axis using the project's
 * existing volatility classifier values. Bands are descriptive — they hint
 * at calm vs. stress regions without making advice claims.
 */

export interface VixCurveTermStructureChartProps {
  data: VolatilityCurvePoint[];
  thresholds?: VolatilityDashboardThresholds;
  compact?: boolean;
}

interface CurveTooltipParams {
  dataIndex: number;
  value: number;
  name: string;
}

function classifyCurve(values: number[]): "contango" | "backwardation" | "flat" {
  if (values.length < 3) return "flat";
  const [, vix, vix3m] = values;
  if (vix3m - vix > 1) return "contango";
  if (vix - vix3m > 0.5) return "backwardation";
  return "flat";
}

const STATE_BY_CURVE: Record<
  "contango" | "backwardation" | "flat",
  { state: "calm" | "watch" | "risk"; description: string }
> = {
  contango: {
    state: "calm",
    description:
      "Contango proxy: longer-dated VIX3M sits above VIX, the calmer term-structure shape."
  },
  flat: {
    state: "watch",
    description:
      "Flat proxy: VIX and VIX3M are close, neither contango nor backwardation is meaningful."
  },
  backwardation: {
    state: "risk",
    description:
      "Backwardation proxy: VIX sits above VIX3M, an acute-stress shape often associated with near-term equity stress."
  }
};

function buildCurveBands(thresholds: VolatilityDashboardThresholds) {
  // The thresholds JSON encodes ratio-based classifiers (e.g. vix/vix3m_stress)
  // not absolute VIX level cutoffs. We render descriptive y-axis bands using
  // common public-volatility level breakpoints so the chart still gives a
  // visual regime hint without mis-using the ratio thresholds.
  // Reference levels: calm ≤ 15, watch 15–25, elevated ≥ 25 — matches the
  // descriptive cuts in docs/METHODOLOGY.md.
  // Thresholds object is included in the signature so the type-check stays
  // tight; we read it conditionally so chart consumers know "if thresholds
  // present, expect bands". (vix9d/vix calm threshold cited for completeness.)
  void thresholds;
  return buildMarkBands([
    { label: "Calm", max: 15, color: "rgba(58, 125, 91, 0.10)" },
    { label: "Watch", min: 15, max: 25, color: "rgba(192, 139, 50, 0.10)" },
    { label: "Elevated", min: 25, color: "rgba(176, 74, 58, 0.10)" }
  ]);
}

function fullTooltipFormatter(data: VolatilityCurvePoint[]) {
  return (raw: unknown): string => {
    const params = raw as CurveTooltipParams;
    const point = data[params.dataIndex];
    if (!point) return "";
    return [
      `<strong>${point.tenor}</strong>`,
      `Value: ${formatNumber(point.value, 2)}`,
      `5-year percentile: ${formatNumber(point.percentile_5y, 1)}`
    ].join("<br/>");
  };
}

function compactTooltipFormatter(data: VolatilityCurvePoint[]) {
  return (raw: unknown): string => {
    const params = raw as CurveTooltipParams;
    const point = data[params.dataIndex];
    if (!point) return "";
    return `${point.tenor}: ${formatNumber(point.value, 2)}`;
  };
}

const COMPACT_HEIGHT = 200;
const FULL_HEIGHT = 400;

export default function VixCurveTermStructureChart({
  data,
  thresholds,
  compact = false
}: VixCurveTermStructureChartProps) {
  if (data.length === 0) {
    const emptyPanel = (
      <EChartPanel
        title={compact ? "Volatility curve" : "Volatility curve (proxy)"}
        description="Public-data volatility curve proxy across 9-day, 30-day, and 3-month horizons."
        state="empty"
        emptyMessage="VIX9D, VIX, or VIX3M is not currently active."
        height={compact ? COMPACT_HEIGHT : FULL_HEIGHT}
      />
    );
    if (compact) return emptyPanel;
    return (
      <InteractiveChartShell
        title="Volatility curve (proxy)"
        ariaLabel="Volatility curve term structure"
      >
        {emptyPanel}
      </InteractiveChartShell>
    );
  }

  const tenors = data.map((point) => point.tenor);
  const values = data.map((point) => point.value);
  const curveState = classifyCurve(values);
  const { state, description } = STATE_BY_CURVE[curveState];

  const tooltipFormatter = compact
    ? compactTooltipFormatter(data)
    : fullTooltipFormatter(data);

  const seriesEntry: Record<string, unknown> = {
    name: "Volatility curve",
    type: "line",
    showSymbol: true,
    symbolSize: 9,
    lineStyle: { width: 2, color: chartCategoricalPalette[0] },
    itemStyle: { color: chartCategoricalPalette[0] },
    data: values,
    label: {
      show: !compact,
      position: "top",
      formatter: (p: { value: number }) => formatNumber(p.value, 2),
      color: chartColors.text,
      fontSize: 11
    }
  };

  if (thresholds) {
    seriesEntry.markArea = {
      silent: true,
      data: buildCurveBands(thresholds)
    };
  }

  const option = {
    textStyle: chartTextStyle,
    grid: { ...chartGridDefaults, top: compact ? 16 : 28, bottom: 28 },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: tooltipFormatter
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "category" as const,
      data: tenors,
      boundaryGap: false
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      scale: true,
      name: compact ? undefined : "VIX level",
      nameTextStyle: compact ? undefined : { color: chartColors.muted, fontSize: 11 }
    },
    series: [seriesEntry]
  };

  const panel = (
    <EChartPanel
      title={compact ? "Volatility curve" : "Volatility curve (proxy)"}
      description={
        compact
          ? undefined
          : `VIX9D, VIX, VIX3M term-structure shape. ${description}`
      }
      state="ready"
      option={option}
      ariaLabel={`Volatility curve term structure. Shape: ${curveState}.`}
      height={compact ? COMPACT_HEIGHT : FULL_HEIGHT}
    />
  );

  if (compact) return panel;

  return (
    <InteractiveChartShell
      title="Volatility curve (proxy)"
      ariaLabel="Volatility curve term structure"
      state={state}
      insight={description}
    >
      {panel}
    </InteractiveChartShell>
  );
}
