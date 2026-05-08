import { formatNumber } from "../lib/formatters";
import type {
  DataStatusFile,
  ScoreSummaryFile,
  SeriesCatalogEntry,
  ShockRiskSnapshotFile
} from "../lib/types";
import SignalList from "./SignalList";

interface ShockRiskReadHeaderProps {
  catalog?: SeriesCatalogEntry[];
  scoreSummary: ScoreSummaryFile;
  shockSnapshot: ShockRiskSnapshotFile;
  status?: DataStatusFile;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export default function ShockRiskReadHeader({ scoreSummary, shockSnapshot }: ShockRiskReadHeaderProps) {
  const activeSignals = safeArray<ShockRiskSnapshotFile["active_signals"][number]>(shockSnapshot.active_signals);
  const sourceGaps = safeArray<ShockRiskSnapshotFile["source_gaps"][number]>(shockSnapshot.source_gaps);
  const mismatchWarnings = safeArray<ShockRiskSnapshotFile["mismatch_warnings"][number]>(
    shockSnapshot.mismatch_warnings
  );

  return (
    <section className="panel interpretation-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Current Shock-Risk Read</p>
          <h3>{shockSnapshot.label}</h3>
          <p>
            Fragility score {formatNumber(scoreSummary.scores.fragility.score)} ({scoreSummary.scores.fragility.label}).
          </p>
        </div>
        <strong className="score-card__value">{formatNumber(shockSnapshot.score)}</strong>
      </div>
      <div className="interpretation-grid">
        <SignalList
          emptyText="No active stress channels in the current shock-risk snapshot."
          items={activeSignals.map((signal) => signal.label)}
          title="Active stress channels"
        />
        <SignalList
          emptyText="No candidate stress channels in the current shock-risk snapshot."
          items={sourceGaps.map((gap) => gap.label)}
          title="Candidate stress channels"
        />
        <section>
          <h4>Mismatch warnings</h4>
          <p className="score-note">{mismatchWarnings.length} mismatch warning rows.</p>
        </section>
        <section>
          <h4>Source gaps</h4>
          <p className="score-note">{sourceGaps.length} source-gap rows.</p>
        </section>
      </div>
    </section>
  );
}
