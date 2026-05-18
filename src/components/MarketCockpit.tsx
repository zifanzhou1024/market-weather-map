import type { CockpitFile } from "../lib/types";
import type { Mode } from "../lib/mode";
import CockpitCell from "./CockpitCell";
import CompositeScoresRow from "./CompositeScoresRow";

/**
 * Top-level orchestrator for the cockpit on Overview.
 *
 * Design notes:
 * - Renders two stacked sections: the fixed `CompositeScoresRow` headline and
 *   the variable `vital-signs-grid` of `CockpitCell`s ranked by today's
 *   priority. The grid component itself is intentionally trivial — the cells
 *   carry the visual weight, and Task 2.10 owns the responsive sizing.
 * - Loading state: when `data` is `null` the cockpit renders a labelled
 *   skeleton instead of throwing or collapsing to an empty fragment. The
 *   `aria-busy` attribute lets screen readers know data is still arriving.
 * - Empty state: when `vital_signs` is empty (e.g. ingest gap) the composite
 *   row still renders so the user keeps their bearings; a short placeholder
 *   replaces the grid so a reviewer never sees a blank rectangle.
 * - `data-testid="market-cockpit"` is the locator the Overview integration
 *   test (PR 4) uses to find this section. It is intentionally stable across
 *   loading, populated, and empty variants.
 * - `mode` is propagated to both children so the entire cockpit toggles in
 *   sync between Brief (newcomer) and Detail (power user) presentations.
 * - The grid uses `role="list"` / `role="listitem"` so screen readers
 *   announce it as a ranked list of vital signs rather than a generic
 *   collection of divs.
 */
interface Props {
  data: CockpitFile | null;
  mode: Mode;
}

export default function MarketCockpit({ data, mode }: Props) {
  if (data === null) {
    return (
      <section
        className="market-cockpit market-cockpit--loading"
        data-testid="market-cockpit"
        aria-busy="true"
        aria-label="Loading market cockpit"
      >
        <div className="market-cockpit__skeleton">Loading cockpit…</div>
      </section>
    );
  }

  return (
    <section
      className={`market-cockpit market-cockpit--${mode}`}
      data-testid="market-cockpit"
      aria-label="Market cockpit"
    >
      <CompositeScoresRow scores={data.composite_scores} mode={mode} />
      {data.vital_signs.length > 0 ? (
        <div
          className="vital-signs-grid"
          data-testid="vital-signs-grid"
          role="list"
          aria-label="Top vital signs ranked by today's priority"
        >
          {data.vital_signs.map((sign) => (
            <div role="listitem" key={sign.id}>
              <CockpitCell sign={sign} mode={mode} />
            </div>
          ))}
        </div>
      ) : (
        <p className="vital-signs-grid__empty">
          No vital signs available in the current snapshot.
        </p>
      )}
    </section>
  );
}
