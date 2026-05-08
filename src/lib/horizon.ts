import type { DataStatus, ScoreBlock } from "./types";

export interface Classification {
  label: string;
  tone: "supportive" | "neutral" | "risk" | "unavailable";
  ratio: number | null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: unknown): value is number {
  return finiteNumber(value) && value > 0;
}

export function classifyVixProxy(vix: number | null | undefined, vix3m: number | null | undefined): Classification {
  if (!positiveNumber(vix) || !positiveNumber(vix3m)) {
    return { label: "Unavailable", tone: "unavailable", ratio: null };
  }

  const ratio = vix / vix3m;
  if (ratio >= 1.03) return { label: "Backwardation-like stress", tone: "risk", ratio };
  if (ratio <= 0.97) return { label: "Contango-like calm", tone: "supportive", ratio };
  return { label: "Flat / transition", tone: "neutral", ratio };
}

export function classifyNearTermEventVol(
  vix9d: number | null | undefined,
  vix: number | null | undefined
): Classification {
  if (!positiveNumber(vix9d) || !positiveNumber(vix)) {
    return { label: "Unavailable", tone: "unavailable", ratio: null };
  }

  const ratio = vix9d / vix;
  if (ratio >= 1.08) return { label: "Elevated near-term event risk", tone: "risk", ratio };
  if (ratio <= 0.92) return { label: "Near-term vol discounted", tone: "supportive", ratio };
  return { label: "Balanced near-term vol", tone: "neutral", ratio };
}

export function firstText(items: unknown[] | undefined, fallback: string) {
  const first = Array.isArray(items)
    ? items
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .find((item) => item.length > 0)
    : undefined;
  return first ?? fallback;
}

export function scoreLabel(score: Partial<Pick<ScoreBlock, "score" | "label">>) {
  const label = typeof score.label === "string" && score.label.trim().length > 0 ? score.label : "Unknown";
  const value = finiteNumber(score.score) ? score.score.toFixed(1) : "N/A";
  return `${label} ${value}`;
}

export function countSourceGaps(rows: Array<{ status?: DataStatus | string }> | undefined) {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((row) => row.status && row.status !== "ok").length;
}
