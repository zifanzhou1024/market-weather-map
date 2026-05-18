import type { CockpitVitalSign } from "../lib/types";
import type { Mode } from "../lib/mode";
import Sparkline from "./Sparkline";
import PercentileBand from "./PercentileBand";
import FreshnessPill from "./FreshnessPill";

/**
 * The atomic cell of the cockpit grid.
 *
 * Design notes:
 * - Same template and dimensions for every cell so 9 cells can be scanned
 *   in <2 seconds. The grid (Task 2.8) owns sizing; this component renders
 *   inside whatever box it is given.
 * - Direction (risk / support / neutral) is encoded as a CSS class on the
 *   <article> so a colored left border can be applied without per-cell
 *   logic in CSS (Task 2.10).
 * - `rank` badge ("#1") tells experienced users which signal is most
 *   urgent today; the badge is decorative (the rank is also encoded in
 *   read order via DOM position in the grid).
 * - Primary value uses tabular-nums in CSS so values align vertically
 *   across cells.
 * - Brief mode hides Δ7d and secondary values to keep newcomers focused
 *   on the headline number; Detail mode reveals them for power users.
 * - `tabIndex={0}` makes each cell keyboard-focusable so a keyboard user
 *   can Tab through the grid.
 * - `aria-label` is `"{label}: {value}{unit}"` so a screen reader announces
 *   the cell as a single coherent fact instead of reading every child.
 * - `title` carries `why_it_matters` as a hover tooltip; this is a
 *   progressive enhancement only — the dialog (Task 2.7) is the primary
 *   place to read the rationale.
 *
 * `Mode` is imported from `../lib/mode` — the canonical home (PR 3 Task 3.4
 * moved it there so `useMode()` and `ModeProvider` live alongside the type).
 */
interface Props {
  sign: CockpitVitalSign;
  mode: Mode;
}

function formatDelta(d: number | null, decimals: number): string | null {
  if (d === null) return null;
  // Hide near-zero deltas. Without this guard, values like -0.001 round to "-0"
  // at decimals=0 and read as misleading negative signals to the eye.
  const threshold = Math.pow(10, -decimals) / 2;
  if (Math.abs(d) < threshold) return null;
  const prefix = d >= 0 ? "+" : "";
  return `${prefix}${d.toFixed(decimals)}`;
}

export default function CockpitCell({ sign, mode }: Props) {
  const value = sign.primary_value.toFixed(sign.primary_decimals);
  const delta7d = formatDelta(sign.delta_7d, sign.primary_decimals);
  const delta1m = formatDelta(sign.delta_1m, sign.primary_decimals);
  const ariaLabel = `${sign.label}: ${value}${sign.primary_unit}`;

  return (
    <article
      className={`cockpit-cell cockpit-cell--${sign.direction} cockpit-cell--${mode}`}
      tabIndex={0}
      aria-label={ariaLabel}
      title={sign.why_it_matters || undefined}
    >
      <header className="cockpit-cell__header">
        <span className="cockpit-cell__rank" aria-hidden="true">
          #{sign.rank}
        </span>
        <h3 className="cockpit-cell__label">{sign.label}</h3>
      </header>

      <div className="cockpit-cell__primary">
        <span className="cockpit-cell__value">{value}</span>
        {sign.primary_unit && (
          <span className="cockpit-cell__unit">{sign.primary_unit}</span>
        )}
      </div>

      <Sparkline
        points={sign.sparkline_90d}
        className={`cockpit-cell__spark cockpit-cell__spark--${sign.direction}`}
      />

      <PercentileBand
        percentile={sign.percentile_5y}
        direction={sign.direction}
        windowDays={sign.percentile_window_days ?? undefined}
      />

      {mode === "detail" && (delta7d !== null || delta1m !== null) && (
        <p className="cockpit-cell__deltas">
          {delta7d !== null && <span>Δ7d {delta7d}</span>}
          {delta1m !== null && <span>Δ1m {delta1m}</span>}
        </p>
      )}

      {mode === "detail" && sign.secondary_values.length > 0 && (
        <ul className="cockpit-cell__secondary">
          {sign.secondary_values.map((s) => (
            <li key={s.label}>
              <span className="cockpit-cell__secondary-label">{s.label}</span>{" "}
              <span className="cockpit-cell__secondary-value">
                {s.value.toFixed(1)}
                {s.unit}
              </span>
            </li>
          ))}
        </ul>
      )}

      <FreshnessPill status={sign.freshness_status} asOf={sign.as_of} />
    </article>
  );
}
