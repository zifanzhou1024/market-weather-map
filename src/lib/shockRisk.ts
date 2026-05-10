import type {
  DataStatus,
  ShockRiskMismatchWarning,
  ShockRiskSignal,
  ShockRiskSnapshotFile,
  ShockRiskSourceGap
} from "./types";

const dataStatuses = new Set<DataStatus>([
  "ok",
  "stale",
  "partial",
  "failed",
  "terms_review_needed",
  "unavailable"
]);

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isDataStatus(value: unknown): value is DataStatus {
  return typeof value === "string" && dataStatuses.has(value as DataStatus);
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type RequiredRowStrings = Record<string, unknown> & {
  id: string;
  label: string;
  message: string;
};

function hasRequiredRowStrings(row: Record<string, unknown>): row is RequiredRowStrings {
  return isNonEmptyString(row.id) && isNonEmptyString(row.label) && isNonEmptyString(row.message);
}

function sanitizeActiveSignals(rows: unknown): ShockRiskSignal[] {
  const sanitizedRows: ShockRiskSignal[] = [];
  const seenIds = new Set<string>();

  for (const row of safeArray(rows)) {
    if (!isRecord(row) || !hasRequiredRowStrings(row) || seenIds.has(row.id)) {
      continue;
    }

    sanitizedRows.push({
      change: safeNumber(row.change),
      id: row.id,
      label: row.label,
      message: row.message,
      score: safeNumber(row.score),
      value: safeNumber(row.value)
    });
    seenIds.add(row.id);
  }

  return sanitizedRows;
}

function sanitizeSourceGaps(rows: unknown): ShockRiskSourceGap[] {
  const sanitizedRows: ShockRiskSourceGap[] = [];
  const seenIds = new Set<string>();

  for (const row of safeArray(rows)) {
    if (!isRecord(row) || !hasRequiredRowStrings(row) || !isDataStatus(row.status) || seenIds.has(row.id)) {
      continue;
    }

    sanitizedRows.push({
      id: row.id,
      label: row.label,
      message: row.message,
      status: row.status
    });
    seenIds.add(row.id);
  }

  return sanitizedRows;
}

function sanitizeMismatchWarnings(rows: unknown): ShockRiskMismatchWarning[] {
  const sanitizedRows: ShockRiskMismatchWarning[] = [];
  const seenIds = new Set<string>();

  for (const row of safeArray(rows)) {
    if (!isRecord(row) || !hasRequiredRowStrings(row) || seenIds.has(row.id)) {
      continue;
    }

    sanitizedRows.push({
      id: row.id,
      label: row.label,
      message: row.message
    });
    seenIds.add(row.id);
  }

  return sanitizedRows;
}

export function sanitizeShockRiskSnapshot(snapshot: ShockRiskSnapshotFile): ShockRiskSnapshotFile {
  return {
    ...snapshot,
    active_signals: sanitizeActiveSignals(snapshot.active_signals),
    mismatch_warnings: sanitizeMismatchWarnings(snapshot.mismatch_warnings),
    source_gaps: sanitizeSourceGaps(snapshot.source_gaps)
  };
}
