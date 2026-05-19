import type { SignalFreshnessStatus } from "../lib/types";
import { useT } from "../lib/i18n";

/**
 * Ranked list of "what's driving this read" with proportional horizontal bars.
 *
 * Layout per row:
 *   - Label + priority value on the top line
 *   - Horizontal bar below, width scaled to the maximum priority in the list
 *   - Bar color carries direction (risk / support / neutral)
 *   - Hover tooltip composes why_it_matters + freshness_status + confidence
 *
 * Ordering is always priority-descending. `max` truncates to the top-N.
 *
 * Used by:
 *   - Wave 2's PageInsightHero to render the primary warning / primary support
 *     pair side-by-side.
 *   - Wave 4 hero charts that want a "ranked drivers" sidebar.
 *
 * Type intentionally re-derives `freshness_status` from
 * `SignalFreshnessStatus` so a future enum change in src/lib/types.ts rolls
 * through here automatically.
 */

export type DriverDirection = "risk" | "support" | "neutral";

export interface Driver {
  id: string;
  label: string;
  priority: number;
  direction: DriverDirection;
  why_it_matters: string;
  freshness_status: SignalFreshnessStatus;
  confidence: number;
}

export interface DriverBarListProps {
  items: Driver[];
  /**
   * If set, truncates the visible list to the top-N drivers by priority.
   */
  max?: number;
}

function formatConfidence(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(2);
}

interface BuildTooltipDeps {
  // Resolved status / freshness / confidence labels — the caller resolves them
  // through `useT()` (which is a hook and cannot be called outside the
  // component body) and threads them in.
  freshnessLabel: string;
  freshnessPrefix: string;
  confidencePrefix: string;
}

function buildTooltip(driver: Driver, deps: BuildTooltipDeps): string {
  const parts = [
    driver.why_it_matters,
    `${deps.freshnessPrefix}: ${deps.freshnessLabel}`,
    `${deps.confidencePrefix}: ${formatConfidence(driver.confidence)}`
  ];
  return parts.join(" — ");
}

export default function DriverBarList({ items, max }: DriverBarListProps) {
  const { t, tCategorical, tNarrative } = useT();
  if (items.length === 0) {
    return (
      <p className="driver-bar-list__empty">{t("narrative.emptyDrivers")}</p>
    );
  }

  const sorted = [...items].sort((a, b) => b.priority - a.priority);
  const visible = typeof max === "number" ? sorted.slice(0, max) : sorted;

  // Scale bar widths relative to the highest visible priority so the highest
  // bar is always 100%. Guard against all-zero priority (avoid /0).
  const peak = Math.max(...visible.map((d) => d.priority), 0);
  const denominator = peak > 0 ? peak : 1;

  // Resolve prefixes once for the tooltip. These are static UI chrome
  // strings, not Python-emitted, so the dictionary lookup is safe.
  const freshnessPrefix = t("narrative.freshnessPrefix");
  const confidencePrefix = t("narrative.confidence");

  return (
    <ul className="driver-bar-list">
      {visible.map((driver) => {
        const widthPct = Math.max(0, Math.min(100, (driver.priority / denominator) * 100));
        // Map cockpit freshness ("ok" / "stale" / "unavailable") through the
        // status categorical so the tooltip shows "新鲜 / 过时 / 不可用" under zh.
        const freshnessLabel = tCategorical("status", driver.freshness_status);
        const tooltipDriver: Driver = {
          ...driver,
          why_it_matters: tNarrative(driver.why_it_matters).text,
        };
        const tooltip = buildTooltip(tooltipDriver, {
          freshnessLabel,
          freshnessPrefix,
          confidencePrefix,
        });
        return (
          <li
            key={driver.id}
            className="driver-bar-list__row"
            title={tooltip}
            aria-label={`${driver.label} (${driver.direction}, priority ${driver.priority.toFixed(0)})`}
          >
            <div className="driver-bar-list__label-row">
              <span className="driver-bar-list__label">{driver.label}</span>
              <span className="driver-bar-list__priority">{driver.priority.toFixed(0)}</span>
            </div>
            <div className="driver-bar-list__bar-track">
              <div
                className={`driver-bar-list__bar driver-bar-list__bar--${driver.direction}`}
                data-has-priority={driver.priority > 0 ? "true" : "false"}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
