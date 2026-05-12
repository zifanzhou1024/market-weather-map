export interface CandidateDisplayOverride {
  label?: string;
  note?: string;
  status?: string;
}

const vxFuturesIds = new Set(["vx1", "vx2", "vx3", "vx4", "vx5", "vx6", "vx7", "vx8"]);

const VX_SOURCE_GATED_NOTE =
  "Cboe VX settlement candidate fetcher is implemented. Rows remain source-gated and non-scoring until redistribution review approves publication.";

const MOVE_GATED_NOTE =
  "Official ICE MOVE remains unavailable for this public static bundle; the TradingView MOVE candidate is secret-gated, candidate-only, and not active in scoring.";

const SKEW_GATED_NOTE =
  "Cboe SKEW remains source-gated, and this repo has no implemented TradingView SKEW candidate fetcher.";

export function candidateDisplayOverride(id: string): CandidateDisplayOverride | undefined {
  if (id === "move_index") {
    return {
      label: "MOVE official unavailable; TradingView candidate gated.",
      note: MOVE_GATED_NOTE,
      status: "candidate_gated"
    };
  }

  if (id === "skew_index") {
    return {
      label: "Cboe SKEW source gated; no implemented candidate.",
      note: SKEW_GATED_NOTE,
      status: "not_implemented"
    };
  }

  if (id === "vx_futures_curve" || id === "vix_futures_curve") {
    return {
      label: "VX futures curve source-gated.",
      note: VX_SOURCE_GATED_NOTE,
      status: "terms_review_needed"
    };
  }

  if (vxFuturesIds.has(id)) {
    return {
      note: VX_SOURCE_GATED_NOTE,
      status: "terms_review_needed"
    };
  }

  return undefined;
}

export function applyCandidateDisplayOverride<T extends { id: string; label: string; note: string; status: string }>(
  item: T
): T {
  const override = candidateDisplayOverride(item.id);
  if (!override) return item;

  return {
    ...item,
    label: override.label ?? item.label,
    note: override.note ?? item.note,
    status: override.status ?? item.status
  };
}

export function candidateDisplayLabel(id: string, fallback: string) {
  return candidateDisplayOverride(id)?.label ?? fallback;
}

export function candidateDisplayMessage(id: string, fallback: string) {
  return candidateDisplayOverride(id)?.note ?? fallback;
}
