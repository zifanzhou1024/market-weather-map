import { useCallback, useRef, type KeyboardEvent } from "react";
import type { RangePreset } from "../charts/buildTimeWindow";

/**
 * Segmented control for selecting a chart time-range preset.
 *
 * - All six presets render so the control's width is stable regardless of
 *   which subset is data-available. Presets not in `available` render as
 *   visually muted buttons with `aria-disabled="true"` and a native tooltip
 *   carrying `disabledReason` so users hovering on them learn why.
 * - Keyboard model matches the WAI-ARIA radiogroup pattern: ArrowRight /
 *   ArrowDown moves to the next enabled preset; ArrowLeft / ArrowUp moves to
 *   the previous one; Home / End jump to first / last; Enter and Space
 *   activate the focused preset. Disabled presets are skipped during
 *   arrow-key navigation.
 * - The outer container has `role="radiogroup"`; each button has
 *   `role="radio"` and `aria-checked` matching the active state.
 */

const ALL_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "All"];

export interface ChartRangeControlsProps {
  value: RangePreset;
  onChange: (next: RangePreset) => void;
  /**
   * Optional whitelist. When provided, presets outside this set still render
   * but are disabled. Defaults to all 6 presets.
   */
  available?: RangePreset[];
  /**
   * Native tooltip text applied to disabled presets — surfaces the "why" of
   * disabling without needing a custom tooltip component.
   */
  disabledReason?: string;
  /**
   * Optional human-readable label for assistive tech, defaults to "Chart range".
   */
  ariaLabel?: string;
}

export default function ChartRangeControls({
  value,
  onChange,
  available,
  disabledReason,
  ariaLabel = "Chart range"
}: ChartRangeControlsProps) {
  const enabledSet = new Set<RangePreset>(available ?? ALL_PRESETS);
  const groupRef = useRef<HTMLDivElement | null>(null);

  const focusPreset = useCallback((preset: RangePreset) => {
    const root = groupRef.current;
    if (!root) return;
    const target = root.querySelector(`[data-preset="${preset}"]`) as HTMLButtonElement | null;
    target?.focus();
  }, []);

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      const enabledOrdered = ALL_PRESETS.filter((p) => enabledSet.has(p));
      if (enabledOrdered.length === 0) return;
      const currentIdx = enabledOrdered.indexOf(value);
      // If the active value is not in the enabled set, snap to the first/last enabled.
      const baseIdx = currentIdx === -1 ? (direction === 1 ? -1 : enabledOrdered.length) : currentIdx;
      const nextIdx =
        (baseIdx + direction + enabledOrdered.length) % enabledOrdered.length;
      const next = enabledOrdered[nextIdx];
      onChange(next);
      focusPreset(next);
    },
    [enabledSet, focusPreset, onChange, value]
  );

  const jumpTo = useCallback(
    (end: "first" | "last") => {
      const enabledOrdered = ALL_PRESETS.filter((p) => enabledSet.has(p));
      if (enabledOrdered.length === 0) return;
      const target = end === "first" ? enabledOrdered[0] : enabledOrdered[enabledOrdered.length - 1];
      onChange(target);
      focusPreset(target);
    },
    [enabledSet, focusPreset, onChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, preset: RangePreset) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          moveSelection(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          moveSelection(-1);
          break;
        case "Home":
          event.preventDefault();
          jumpTo("first");
          break;
        case "End":
          event.preventDefault();
          jumpTo("last");
          break;
        case "Enter":
        case " ":
          // Activate the focused preset (only if enabled).
          if (enabledSet.has(preset)) {
            event.preventDefault();
            onChange(preset);
          }
          break;
        default:
          break;
      }
    },
    [enabledSet, jumpTo, moveSelection, onChange]
  );

  return (
    <div
      ref={groupRef}
      className="chart-range-controls"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {ALL_PRESETS.map((preset) => {
        const isActive = preset === value;
        const isEnabled = enabledSet.has(preset);
        const className = [
          "chart-range-controls__button",
          isActive ? "chart-range-controls__button--active" : "",
          !isEnabled ? "chart-range-controls__button--disabled" : ""
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={isActive ? "true" : "false"}
            aria-disabled={isEnabled ? undefined : "true"}
            tabIndex={isActive ? 0 : -1}
            data-preset={preset}
            className={className}
            title={!isEnabled ? disabledReason : undefined}
            onClick={() => {
              if (!isEnabled) return;
              if (preset !== value) onChange(preset);
            }}
            onKeyDown={(event) => handleKeyDown(event, preset)}
          >
            {preset}
          </button>
        );
      })}
    </div>
  );
}
