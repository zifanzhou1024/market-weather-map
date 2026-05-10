import { useEffect, useState } from "react";
import EChartPanel from "../charts/EChartPanel";
import {
  chartAxisDefaults,
  chartColors,
  chartTextStyle,
  chartTooltipDefaults
} from "../charts/chartTheme";
import { formatNumber } from "../charts/chartFormatters";
import ChartStateBadge, { type ChartState } from "./ChartStateBadge";
import { loadVolatilityDashboard } from "../lib/data";
import type {
  VolatilityDashboardFile,
  VolatilityHiddenStressPoint,
  VolatilityHiddenStressState
} from "../lib/types";

/**
 * Compact panel that surfaces the latest VIX vs VVIX percentile mismatch
 * (`hidden_stress_score`) along with a 30-day sparkline. Distinct from the
 * cross-asset mismatch warnings rendered elsewhere on the Fragility route —
 * this panel reads only from the options-volatility dashboard and shows a
 * single descriptive numeric.
 *
 * Tone: descriptive only. The score is the gap between VVIX percentile and
 * VIX percentile, not a forecast or trade recommendation.
 */

const SPARK_HEIGHT = 40;
const SPARK_WINDOW = 30;

const STATE_TO_BADGE: Record<VolatilityHiddenStressState, ChartState> = {
  calm: "calm",
  watch: "watch",
  elevated: "risk"
};

const STATE_TO_COLOR: Record<VolatilityHiddenStressState, string> = {
  calm: chartColors.support,
  watch: chartColors.missing,
  elevated: chartColors.warning
};

function buildSparkOption(
  points: VolatilityHiddenStressPoint[],
  color: string
): Parameters<typeof EChartPanel>[0]["option"] {
  return {
    textStyle: chartTextStyle,
    grid: { left: 4, right: 4, top: 4, bottom: 4, containLabel: false },
    tooltip: {
      ...chartTooltipDefaults,
      trigger: "axis" as const,
      formatter: (raw: unknown) => {
        const params = Array.isArray(raw)
          ? (raw as Array<{ axisValueLabel?: string; value: [string, number] }>)
          : [];
        if (!params.length) return "";
        const row = params[0];
        const value = Array.isArray(row.value)
          ? row.value[1]
          : (row.value as unknown as number);
        return `<strong>${row.axisValueLabel ?? ""}</strong><br/>Hidden stress: ${formatNumber(
          value,
          1
        )}`;
      }
    },
    xAxis: {
      ...chartAxisDefaults,
      type: "time" as const,
      show: false
    },
    yAxis: {
      ...chartAxisDefaults,
      type: "value" as const,
      scale: true,
      show: false
    },
    series: [
      {
        name: "Hidden stress score",
        type: "line" as const,
        showSymbol: false,
        lineStyle: { width: 1.6, color },
        itemStyle: { color },
        areaStyle: { color, opacity: 0.12 },
        data: points.map((p) => [p.date, p.hidden_stress_score])
      }
    ]
  };
}

export default function VixVvixHiddenStressPanel() {
  const [dashboard, setDashboard] = useState<VolatilityDashboardFile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadVolatilityDashboard()
      .then((result) => {
        if (active) {
          setDashboard(result);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setDashboard(null);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) {
    // Quiet placeholder before first load resolves. No badge, no chart, no
    // numeric — keeps the layout reserve but does not flash a fallback.
    return (
      <section
        className="vix-vvix-hidden-stress-panel"
        aria-label="VIX vs VVIX percentile mismatch"
      />
    );
  }

  const stressPoints = dashboard?.hidden_stress ?? [];
  if (!dashboard || stressPoints.length === 0) {
    return (
      <section
        className="vix-vvix-hidden-stress-panel"
        aria-label="VIX vs VVIX percentile mismatch"
      >
        <header className="vix-vvix-hidden-stress-panel__header">
          <h3 className="vix-vvix-hidden-stress-panel__title">
            VIX vs VVIX percentile mismatch
          </h3>
        </header>
        <p className="vix-vvix-hidden-stress-panel__fallback">
          VIX/VVIX percentile history is not currently active.
        </p>
      </section>
    );
  }

  const latest = stressPoints[stressPoints.length - 1];
  const badgeState = STATE_TO_BADGE[latest.state];
  const scoreColor = STATE_TO_COLOR[latest.state];
  const recent = stressPoints.slice(-SPARK_WINDOW);

  return (
    <section
      className="vix-vvix-hidden-stress-panel"
      aria-label="VIX vs VVIX percentile mismatch"
    >
      <header className="vix-vvix-hidden-stress-panel__header">
        <h3 className="vix-vvix-hidden-stress-panel__title">
          VIX vs VVIX percentile mismatch
        </h3>
        <ChartStateBadge state={badgeState} />
      </header>
      <div className="vix-vvix-hidden-stress-panel__score-row">
        <span
          className="vix-vvix-hidden-stress-panel__score"
          style={{ color: scoreColor }}
        >
          {formatNumber(latest.hidden_stress_score, 1)}
        </span>
        <span className="vix-vvix-hidden-stress-panel__score-caption">
          Hidden stress score, percentile gap
        </span>
      </div>
      <div className="vix-vvix-hidden-stress-panel__spark">
        <EChartPanel
          title="VIX-VVIX percentile mismatch trend"
          state="ready"
          option={buildSparkOption(recent, scoreColor)}
          ariaLabel={`Trend strip of the last ${recent.length} hidden stress score observations.`}
          height={SPARK_HEIGHT}
        />
      </div>
      <p className="vix-vvix-hidden-stress-panel__footer">
        When VVIX percentile leads VIX percentile, options markets price tail risk
        that hasn't shown up in headline vol yet. Score is the gap (VVIX percentile
        minus VIX percentile).
      </p>
    </section>
  );
}
