import { yieldDriverLabel } from "../lib/regime";
import type { RegimeSnapshotFile, ScoreSummaryFile } from "../lib/types";
import SignalList from "./SignalList";
import { useT } from "../lib/i18n";

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
  const { t, tCategorical } = useT();
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
  const regimeLabel = tCategorical("regime", snapshot.regime.label);
  const driverLabel = tCategorical("yieldDriver", yieldDriverLabel(snapshot.regime.yield_driver));

  return (
    <section className="panel interpretation-panel">
      <p className="eyebrow">{t("panels.currentRegimeRead")}</p>
      <h3>{regimeLabel}</h3>
      <p>{t("panels.yieldDriverLabel", { vars: { driver: driverLabel } })}</p>
      <div className="interpretation-grid">
        <SignalList
          emptyText={t("panels.emptyConfirming")}
          items={confirmingSignals}
          title={t("panels.whatConfirmsIt")}
        />
        <SignalList
          emptyText={t("panels.emptyConflicting")}
          items={conflicts}
          title={t("panels.whatConflictsWithIt")}
        />
        <SignalList
          emptyText={t("panels.emptyWeakConfidence")}
          items={weakConfidenceSignals}
          title={t("panels.whatWeakensConfidence")}
        />
      </div>
    </section>
  );
}
