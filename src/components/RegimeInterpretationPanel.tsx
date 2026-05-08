import { yieldDriverLabel } from "../lib/regime";
import type { RegimeSnapshotFile, ScoreSummaryFile } from "../lib/types";
import SignalList from "./SignalList";

interface RegimeInterpretationPanelProps {
  scoreSummary: ScoreSummaryFile;
  snapshot: RegimeSnapshotFile;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function isUsableConfirmation(value: unknown): value is RegimeSnapshotFile["confirmations"][number] {
  if (!value || typeof value !== "object") return false;
  const confirmation = value as Partial<RegimeSnapshotFile["confirmations"][number]>;
  return (
    typeof confirmation.status === "string" &&
    confirmation.status.trim().length > 0 &&
    typeof confirmation.label === "string" &&
    confirmation.label.trim().length > 0 &&
    typeof confirmation.message === "string" &&
    confirmation.message.trim().length > 0
  );
}

function statusIncludes(status: unknown, terms: string[]) {
  const normalized = typeof status === "string" ? status.toLowerCase() : "";
  return terms.some((term) => normalized.includes(term));
}

function confirmationText(confirmation: RegimeSnapshotFile["confirmations"][number]) {
  return confirmation.message ? `${confirmation.label}: ${confirmation.message}` : confirmation.label;
}

export default function RegimeInterpretationPanel({ scoreSummary, snapshot }: RegimeInterpretationPanelProps) {
  const confirmations = safeArray<unknown>(snapshot.confirmations).filter(isUsableConfirmation);
  const confirmingSignals = confirmations
    .filter((confirmation) => statusIncludes(confirmation.status, ["confirm"]))
    .map(confirmationText);
  const divergentSignals = confirmations
    .filter((confirmation) => statusIncludes(confirmation.status, ["diverg"]))
    .map(confirmationText);
  const conflicts = [
    ...safeArray<string>((scoreSummary as { conflicting_signals?: unknown }).conflicting_signals),
    ...divergentSignals
  ];
  const weakConfidenceSignals = confirmations
    .filter((confirmation) =>
      statusIncludes(confirmation.status, ["missing", "stale", "candidate", "unavailable"])
    )
    .map(confirmationText);

  return (
    <section className="panel interpretation-panel">
      <p className="eyebrow">Current regime read</p>
      <h3>{snapshot.regime.label}</h3>
      <p>Yield driver: {yieldDriverLabel(snapshot.regime.yield_driver)}</p>
      <div className="interpretation-grid">
        <SignalList
          emptyText="No confirming regime signals in the current snapshot."
          items={confirmingSignals}
          title="What confirms it"
        />
        <SignalList
          emptyText="No conflicting regime signals in the current snapshot."
          items={conflicts}
          title="What conflicts with it"
        />
        <SignalList
          emptyText="No weak-confidence regime signals in the current snapshot."
          items={weakConfidenceSignals}
          title="What weakens confidence"
        />
      </div>
    </section>
  );
}
