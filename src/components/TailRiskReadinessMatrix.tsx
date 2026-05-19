import type { DataStatusFile } from "../lib/types";
import ExternalResearchLinks from "./ExternalResearchLinks";
import { useT } from "../lib/i18n";

interface TailRiskReadinessMatrixProps {
  status: DataStatusFile;
}

interface SignalRow {
  id: string;
  label: string;
}

interface SignalGroup {
  key: string;
  heading: string;
  signals: SignalRow[];
}

const GROUPS_BASE: Array<Omit<SignalGroup, "heading"> & { headingKey: string }> = [
  {
    key: "volatility",
    headingKey: "sections.volatilityVvix",
    signals: [
      { id: "vix", label: "VIX" },
      { id: "vvix", label: "VVIX" },
      { id: "vix9d", label: "VIX9D" },
      { id: "vix3m", label: "VIX3M" }
    ]
  },
  {
    key: "vol_curve",
    headingKey: "sections.volCurveDerived",
    signals: [
      { id: "vix9d_vix_ratio", label: "VIX9D / VIX ratio" },
      { id: "vix_vix3m_ratio", label: "VIX / VIX3M ratio" }
    ]
  },
  {
    key: "tail_risk",
    headingKey: "sections.tailRiskIndices",
    signals: [
      { id: "move_index", label: "ICE MOVE" },
      { id: "skew_index", label: "Cboe SKEW" }
    ]
  },
  {
    key: "bond_vol_proxy",
    headingKey: "sections.bondVolProxy",
    signals: [{ id: "bond_volatility_proxy", label: "Bond-vol proxy (not MOVE)" }]
  },
  {
    key: "options_sentiment",
    headingKey: "sections.optionsSentiment",
    signals: [
      { id: "put_call_total", label: "Cboe put/call (total)" },
      { id: "put_call_spxw", label: "Cboe put/call (SPXW / 0DTE)" }
    ]
  },
  {
    key: "vx_curve",
    headingKey: "sections.vxFuturesCurve",
    signals: [
      { id: "vx1", label: "VX1 front" },
      { id: "vx2", label: "VX2" }
    ]
  }
];

const GATED_STATUSES = new Set(["terms_review_needed", "unavailable"]);
const DISPLAY_GATED_STATUSES = new Set([
  "candidate_gated",
  "not_implemented",
  "source_gated",
  "terms_gated"
]);
const TERMS_GATED_READINESS_IDS = new Set(["put_call_total", "put_call_spxw"]);
const READINESS_STATUS_OVERRIDES: Record<string, string> = {
  move_index: "candidate_gated",
  skew_index: "source_gated",
  vx1: "terms_gated",
  vx2: "terms_gated",
  vx3: "terms_gated",
  vx4: "terms_gated",
  vx5: "terms_gated",
  vx6: "terms_gated",
  vx7: "terms_gated",
  vx8: "terms_gated"
};
const READINESS_STATUS_LABELS: Record<string, string> = {
  candidate_gated: "candidate gated",
  failed: "failed",
  not_implemented: "not implemented",
  ok: "ok",
  source_gated: "source gated",
  stale: "stale",
  terms_gated: "terms gated",
  terms_review_needed: "terms gated",
  unavailable: "unavailable",
  unknown: "unknown"
};

function badgeModifier(status: string | undefined): string {
  if (status === "ok") return "tail-risk-readiness-badge--active";
  if (status === "stale") return "tail-risk-readiness-badge--stale";
  if (status === "failed") return "tail-risk-readiness-badge--failed";
  if (status && (GATED_STATUSES.has(status) || DISPLAY_GATED_STATUSES.has(status))) {
    return "tail-risk-readiness-badge--gated";
  }
  return "tail-risk-readiness-badge--unknown";
}

function rawStatusFor(status: DataStatusFile, id: string): string {
  const entry = status.series?.[id];
  if (!entry || typeof entry.status !== "string") return "unknown";
  return entry.status;
}

function displayStatusFor(status: DataStatusFile, id: string): string {
  const rawStatus = rawStatusFor(status, id);
  const override = READINESS_STATUS_OVERRIDES[id];
  if (override) return override;
  if (TERMS_GATED_READINESS_IDS.has(id) && rawStatus === "terms_review_needed") return "terms_gated";
  return rawStatus;
}

function statusLabelFor(status: string): string {
  return READINESS_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export default function TailRiskReadinessMatrix({ status }: TailRiskReadinessMatrixProps) {
  const { t, tDriver } = useT();
  return (
    <section className="tail-risk-readiness-matrix" aria-label="Tail-risk readiness matrix">
      <header>
        <h3>{t("sections.tailRiskReadiness")}</h3>
        <p>{t("panels.tailRiskReadinessDesc")}</p>
      </header>
      {GROUPS_BASE.map((group) => (
        <div key={group.key} className="tail-risk-readiness-group">
          <h4 className="tail-risk-readiness-group-heading">{t(group.headingKey)}</h4>
          {group.signals.map((signal) => {
            const displayStatus = displayStatusFor(status, signal.id);
            return (
              <div key={signal.id} className="tail-risk-readiness-row">
                <span className="tail-risk-readiness-main">
                  <span className="tail-risk-readiness-label">{tDriver(signal.label)}</span>
                  <ExternalResearchLinks
                    className="tail-risk-readiness-links"
                    id={signal.id}
                    label={signal.label}
                  />
                </span>
                <span
                  className={`tail-risk-readiness-badge ${badgeModifier(displayStatus)}`}
                >
                  {statusLabelFor(displayStatus)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
