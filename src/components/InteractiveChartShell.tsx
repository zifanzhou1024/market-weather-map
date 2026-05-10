import type { ReactNode } from "react";
import ChartRangeControls from "./ChartRangeControls";
import ChartStateBadge, { type ChartState } from "./ChartStateBadge";
import InsightCallout from "./InsightCallout";
import type { RangePreset } from "../charts/buildTimeWindow";

/**
 * Chrome that wraps a chart with consistent navigation and interpretation
 * scaffolding.
 *
 * Layout (top-to-bottom):
 *   1. Title row — h3 title with optional ChartStateBadge inline, plus
 *      ChartRangeControls right-aligned when both `range` and
 *      `onRangeChange` are provided.
 *   2. Insight slot — InsightCallout (auto-wrapped when `insight` is a
 *      string) or the caller's own node, rendered above the chart body.
 *   3. Chart body — the `children` slot. Wave 3/4 typically passes an
 *      EChartPanel here, which has its own loading/empty/error states.
 *
 * The shell deliberately does NOT swallow EChartPanel's internal state — it
 * just provides surrounding chrome. If a chart is loading, the shell still
 * renders the title, badge, range controls, and insight; only the chart body
 * area carries the EChartPanel skeleton.
 */

export interface InteractiveChartShellProps {
  title: string;
  ariaLabel: string;
  range?: RangePreset;
  onRangeChange?: (next: RangePreset) => void;
  /**
   * Range presets to enable in the segmented control. Optional; defaults to
   * all six. Passed through to ChartRangeControls.
   */
  availableRangePresets?: RangePreset[];
  /**
   * Tooltip text surfaced on disabled range presets — e.g. "Not enough
   * history for this preset."
   */
  rangeDisabledReason?: string;
  state?: ChartState;
  /**
   * If a string, the shell wraps it in InsightCallout (with the same state
   * passed in `state`). If a ReactNode, it's rendered as-is in the insight
   * slot. Use the node form when a richer layout is needed (e.g. multi-line
   * with custom controls).
   */
  insight?: ReactNode;
  children: ReactNode;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export default function InteractiveChartShell({
  title,
  ariaLabel,
  range,
  onRangeChange,
  availableRangePresets,
  rangeDisabledReason,
  state,
  insight,
  children
}: InteractiveChartShellProps) {
  const showRangeControls = range !== undefined && onRangeChange !== undefined;

  let insightNode: ReactNode = null;
  if (insight !== undefined && insight !== null) {
    if (isString(insight)) {
      insightNode = <InsightCallout state={state} message={insight} />;
    } else {
      insightNode = insight;
    }
  }

  return (
    <section
      className="interactive-chart-shell"
      role="region"
      aria-label={ariaLabel}
    >
      <div className="interactive-chart-shell__title-row">
        <div className="interactive-chart-shell__title-group">
          <h3 className="interactive-chart-shell__title">{title}</h3>
          {state ? <ChartStateBadge state={state} /> : null}
        </div>
        {showRangeControls ? (
          <ChartRangeControls
            value={range}
            onChange={onRangeChange}
            available={availableRangePresets}
            disabledReason={rangeDisabledReason}
            ariaLabel={`${title} range`}
          />
        ) : null}
      </div>
      {insightNode}
      <div className="interactive-chart-shell__body">{children}</div>
    </section>
  );
}
