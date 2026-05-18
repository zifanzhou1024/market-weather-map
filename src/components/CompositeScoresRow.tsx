import type { CockpitCompositeScore } from "../lib/types";
import type { Mode } from "../lib/mode";
import Sparkline from "./Sparkline";
import PercentileBand from "./PercentileBand";
import GlossaryTerm from "./GlossaryTerm";

/**
 * The headline row of the cockpit on Overview.
 *
 * Design notes:
 * - Fixed-position invariant: the row always renders three cells in the order
 *   `market_weather → macro_climate → fragility`, regardless of how the input
 *   array is sorted. The three named scores are the site's headline contract,
 *   so re-sorting the input keeps that contract stable even if the JSON
 *   producer changes order.
 * - Each cell uses the same template as `CockpitCell` but renders the numeric
 *   value larger and uses a wider sparkline (120px vs 60px) — these are the
 *   composite "headline" numbers, not individual vital signs.
 * - Mode-aware in the same way as CockpitCell: Brief hides Δ7d to keep
 *   newcomers focused on the headline; Detail reveals the change so power
 *   users can see momentum.
 * - `Mode` is imported from `./CockpitCell` for PR 2; PR 3 Task 3.4 will move
 *   the canonical declaration to `src/lib/mode.ts` and both files will
 *   re-import from there.
 * - Null `value` renders an em-dash placeholder so the cell stays the same
 *   height across days when one composite is unavailable.
 */
const FIXED_ORDER: ReadonlyArray<CockpitCompositeScore["id"]> = [
  "market_weather",
  "macro_climate",
  "fragility",
];

interface Props {
  scores: CockpitCompositeScore[];
  mode: Mode;
}

function formatDelta(d: number | null): string | null {
  if (d === null) return null;
  // Hide near-zero deltas — keeps an effectively-zero change from rendering as
  // a misleading signed "-0.0" / "+0.0" badge. 0.05 is the round-half-up
  // threshold for the toFixed(1) below.
  if (Math.abs(d) < 0.05) return null;
  const prefix = d >= 0 ? "+" : "";
  return `${prefix}${d.toFixed(1)}`;
}

function formatValue(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(1);
}

export default function CompositeScoresRow({ scores, mode }: Props) {
  // Re-sort by fixed order — the headline contract is invariant.
  const byId = new Map(scores.map((s) => [s.id, s]));
  const ordered = FIXED_ORDER.map((id) => byId.get(id)).filter(
    (s): s is CockpitCompositeScore => s !== undefined,
  );

  return (
    <section
      className="composite-scores-row"
      aria-label="Today's composite scores"
    >
      {ordered.map((s) => {
        const delta7d = formatDelta(s.delta_7d);
        return (
          <article
            key={s.id}
            className={`composite-score-cell composite-score-cell--${s.id} composite-score-cell--${s.direction}`}
            tabIndex={0}
            aria-label={`${s.label}: ${formatValue(s.value)} (${s.regime_label})`}
          >
            <header className="composite-score-cell__header">
              {/* Composite labels ("Market Weather", "Macro Climate",
                * "Fragility") are product names, not jargon — intentionally
                * left out of the glossary. The regime label is wrapped so
                * future regime additions ("Stress", etc.) can inherit
                * tooltips without touching this file again; today's regimes
                * fall through unchanged. */}
              <span className="composite-score-cell__label">{s.label}</span>
              <span className="composite-score-cell__regime">
                <GlossaryTerm term={s.regime_label} />
              </span>
            </header>
            <div className="composite-score-cell__primary">
              <span className="composite-score-cell__value">{formatValue(s.value)}</span>
            </div>
            <Sparkline
              points={s.sparkline_90d}
              width={120}
              height={28}
              className="composite-score-cell__spark"
            />
            <PercentileBand
              percentile={s.percentile_5y}
              direction={s.direction}
              windowDays={s.percentile_window_days ?? undefined}
              width={120}
            />
            {mode === "detail" && delta7d !== null && (
              <p className="composite-score-cell__delta">Δ7d {delta7d}</p>
            )}
          </article>
        );
      })}
    </section>
  );
}
