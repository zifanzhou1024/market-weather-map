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

function safeStringArray(value: unknown): string[] {
  return safeArray<unknown>(value).filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
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

function normalizedStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (
    normalized === "confirming" ||
    normalized === "diverging" ||
    normalized === "mixed" ||
    normalized === "unavailable"
  ) {
    return normalized;
  }
  return null;
}

function confirmationText(confirmation: RegimeSnapshotFile["confirmations"][number]) {
  return confirmation.message ? `${confirmation.label}: ${confirmation.message}` : confirmation.label;
}

export default function RegimeInterpretationPanel({ scoreSummary, snapshot }: RegimeInterpretationPanelProps) {
  const confirmations = safeArray<unknown>(snapshot.confirmations)
    .filter(isUsableConfirmation)
    .map((confirmation) => ({ ...confirmation, normalizedStatus: normalizedStatus(confirmation.status) }))
    .filter((confirmation): confirmation is RegimeSnapshotFile["confirmations"][number] & {
      normalizedStatus: "confirming" | "diverging" | "mixed" | "unavailable";
    } => confirmation.normalizedStatus !== null);
  const confirmingSignals = confirmations
    .filter((confirmation) => confirmation.normalizedStatus === "confirming")
    .map(confirmationText);
  const divergentSignals = confirmations
    .filter((confirmation) => confirmation.normalizedStatus === "diverging")
    .map(confirmationText);
  const conflicts = [
    ...safeStringArray((scoreSummary as { conflicting_signals?: unknown }).conflicting_signals),
    ...divergentSignals
  ];
  const weakConfidenceSignals = confirmations
    .filter(
      (confirmation) => confirmation.normalizedStatus === "mixed" || confirmation.normalizedStatus === "unavailable"
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
