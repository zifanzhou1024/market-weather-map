import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FreshnessPill from "../components/FreshnessPill";
import GlossaryTerm from "../components/GlossaryTerm";
import { loadDiff } from "../lib/data";
import { useMode, type Mode } from "../lib/mode";
import type { DiffFile, DiffRow, DiffWindowKey } from "../lib/types";

// "What flipped since yesterday?" surface for the daily pro user.
// All math runs in build_diff.py; this component is a thin render layer.

const WINDOW_LABELS: Record<DiffWindowKey, string> = {
  "1d": "1 Day",
  "7d": "1 Week",
  "30d": "1 Month"
};

const WINDOW_KEYS: readonly DiffWindowKey[] = ["1d", "7d", "30d"] as const;

function isWindowKey(value: string | null): value is DiffWindowKey {
  return value === "1d" || value === "7d" || value === "30d";
}

function formatValue(v: number | null, decimals: number): string {
  if (v === null || Number.isNaN(v)) return "—";
  return v.toFixed(decimals);
}

type DeltaTone = "up" | "down" | "flat" | "na";

function formatDelta(
  d: number | null,
  decimals: number
): { text: string; tone: DeltaTone } {
  if (d === null || Number.isNaN(d)) return { text: "—", tone: "na" };
  if (d === 0) return { text: `0.${"0".repeat(decimals)}`, tone: "flat" };
  const prefix = d > 0 ? "+" : "";
  const tone: DeltaTone = d > 0 ? "up" : "down";
  return { text: `${prefix}${d.toFixed(decimals)}`, tone };
}

function formatDeltaPct(d: number | null): string {
  if (d === null || Number.isNaN(d)) return "—";
  const prefix = d > 0 ? "+" : "";
  return `${prefix}${d.toFixed(1)}%`;
}

export default function Diff() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = useMode();
  const rawWindow = searchParams.get("window");
  // 7d is the default because the cockpit whitelist mixes daily + weekly +
  // monthly series. A 1d window leaves ~5 of 15 rows with null deltas
  // (their underlying series didn't update yesterday), which reduces
  // first-impression signal. 7d catches the weekly series cleanly and
  // most daily series; users who want intraday motion can still click 1d.
  const activeWindow: DiffWindowKey = isWindowKey(rawWindow) ? rawWindow : "7d";

  const [diff, setDiff] = useState<DiffFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadDiff()
      .then((data) => {
        if (alive) setDiff(data);
      })
      .catch(() => {
        if (alive) setError("Unable to load diff data.");
      });
    return () => {
      alive = false;
    };
  }, []);

  function setWindow(w: DiffWindowKey) {
    const next = new URLSearchParams(searchParams);
    next.set("window", w);
    // replace:false so each window selection produces a back-history entry,
    // mirroring how ChannelTabs handles its tab navigation.
    setSearchParams(next, { replace: false });
  }

  // Sort vital signs by absolute delta in the active window (biggest movers
  // first). Rows whose window delta is null sink to the bottom so they don't
  // crowd out real data.
  const sortedVitals = diff
    ? [...diff.vital_signs].sort((a, b) => {
        const ad = a.windows[activeWindow]?.delta;
        const bd = b.windows[activeWindow]?.delta;
        const aMag = ad === null || ad === undefined ? -1 : Math.abs(ad);
        const bMag = bd === null || bd === undefined ? -1 : Math.abs(bd);
        return bMag - aMag;
      })
    : [];

  return (
    <main className="page-shell diff">
      <section className="page-heading">
        <p className="eyebrow">What flipped</p>
        <h2>Diff</h2>
        <p>
          Value-level changes across the cockpit signals over the selected
          window. Composite scores first; vital signs sorted by absolute change.
        </p>
      </section>

      <nav
        className="diff-window-tabs channel-tabs"
        aria-label="Diff window"
        data-testid="diff-window-tabs"
      >
        {WINDOW_KEYS.map((w) => (
          <button
            key={w}
            type="button"
            className={`channel-tab ${w === activeWindow ? "channel-tab--active" : ""}`.trim()}
            onClick={() => setWindow(w)}
            aria-current={w === activeWindow ? "page" : undefined}
            data-testid={`diff-window-tab-${w}`}
          >
            {WINDOW_LABELS[w]}
          </button>
        ))}
      </nav>

      {error !== null ? (
        <p className="diff__error" data-testid="diff-error">
          {error}
        </p>
      ) : diff === null ? (
        <p className="diff__loading" data-testid="diff-loading">
          Loading diff&hellip;
        </p>
      ) : (
        <>
          <section
            className="diff-table-section"
            aria-label="Composite scores diff"
          >
            <h3 className="diff-section-title">Composite Scores</h3>
            <DiffTable
              rows={diff.composite_scores}
              window={activeWindow}
              mode={mode}
              testId="diff-table-composite"
            />
          </section>
          <section
            className="diff-table-section"
            aria-label="Vital signs diff"
          >
            <h3 className="diff-section-title">
              Vital Signs (sorted by absolute change)
            </h3>
            <DiffTable
              rows={sortedVitals}
              window={activeWindow}
              mode={mode}
              testId="diff-table-vitals"
            />
          </section>
        </>
      )}
    </main>
  );
}

interface DiffTableProps {
  rows: DiffRow[];
  window: DiffWindowKey;
  mode: Mode;
  testId: string;
}

function DiffTable({ rows, window, mode, testId }: DiffTableProps) {
  return (
    <table className="diff-table" data-testid={testId}>
      <thead>
        <tr>
          <th scope="col">Signal</th>
          <th scope="col">Now</th>
          <th scope="col">Then</th>
          <th scope="col">&Delta;</th>
          {mode === "detail" && <th scope="col">&Delta;%</th>}
          <th scope="col">Freshness</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const entry = row.windows[window];
          const delta = formatDelta(
            entry?.delta ?? null,
            row.primary_decimals
          );
          const insufficientHistory =
            entry?.value === null && row.current_value !== null;
          const thenCellTitle = insufficientHistory
            ? "Insufficient history for this window"
            : undefined;
          return (
            <tr
              key={row.id}
              className={`diff-row diff-row--${row.direction}`}
              data-testid={`diff-row-${row.id}`}
            >
              <th scope="row" className="diff-cell diff-cell--label">
                <GlossaryTerm term={row.label} />
                <span
                  className={`diff-cadence diff-cadence--${row.frequency}`}
                  data-testid={`diff-row-${row.id}-cadence`}
                >
                  <GlossaryTerm term={row.frequency}>{row.frequency}</GlossaryTerm>
                </span>
              </th>
              <td className="diff-cell diff-cell--current">
                {formatValue(row.current_value, row.primary_decimals)}
                {row.primary_unit}
              </td>
              <td
                className="diff-cell diff-cell--prior"
                title={thenCellTitle}
              >
                {formatValue(entry?.value ?? null, row.primary_decimals)}
              </td>
              <td
                className={`diff-cell diff-cell--delta diff-cell--delta--${delta.tone}`}
                data-testid={`diff-row-${row.id}-delta`}
              >
                {delta.text}
              </td>
              {mode === "detail" && (
                <td
                  className="diff-cell diff-cell--delta-pct"
                  data-testid={`diff-row-${row.id}-delta-pct`}
                >
                  {formatDeltaPct(entry?.delta_pct ?? null)}
                </td>
              )}
              <td className="diff-cell diff-cell--freshness">
                <FreshnessPill
                  status={row.freshness_status}
                  asOf={row.current_date ?? "—"}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
