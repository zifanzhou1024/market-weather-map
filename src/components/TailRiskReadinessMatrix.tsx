import type { DataStatusFile } from "../lib/types";

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

const GROUPS: SignalGroup[] = [
  {
    key: "volatility",
    heading: "Volatility & VVIX",
    signals: [
      { id: "vix", label: "VIX" },
      { id: "vvix", label: "VVIX" },
      { id: "vix9d", label: "VIX9D" },
      { id: "vix3m", label: "VIX3M" }
    ]
  },
  {
    key: "vol_curve",
    heading: "Vol curve (derived)",
    signals: [
      { id: "vix9d_vix_ratio", label: "VIX9D / VIX ratio" },
      { id: "vix_vix3m_ratio", label: "VIX / VIX3M ratio" }
    ]
  },
  {
    key: "tail_risk",
    heading: "Tail-risk indices",
    signals: [
      { id: "move_index", label: "ICE MOVE" },
      { id: "skew_index", label: "Cboe SKEW" }
    ]
  },
  {
    key: "bond_vol_proxy",
    heading: "Bond-vol proxy",
    signals: [{ id: "bond_volatility_proxy", label: "Bond-vol proxy (not MOVE)" }]
  },
  {
    key: "options_sentiment",
    heading: "Options sentiment",
    signals: [
      { id: "put_call_total", label: "Cboe put/call (total)" },
      { id: "put_call_spxw", label: "Cboe put/call (SPXW / 0DTE)" }
    ]
  },
  {
    key: "vx_curve",
    heading: "VX futures curve",
    signals: [
      { id: "vx1", label: "VX1 front" },
      { id: "vx2", label: "VX2" }
    ]
  }
];

const GATED_STATUSES = new Set(["terms_review_needed", "restricted", "unavailable"]);

function badgeModifier(status: string | undefined): string {
  if (status === "ok") return "tail-risk-readiness-badge--active";
  if (status === "stale") return "tail-risk-readiness-badge--stale";
  if (status && GATED_STATUSES.has(status)) return "tail-risk-readiness-badge--gated";
  return "tail-risk-readiness-badge--unknown";
}

function statusFor(status: DataStatusFile, id: string): string {
  const entry = status.series?.[id];
  if (!entry || typeof entry.status !== "string") return "unknown";
  return entry.status;
}

export default function TailRiskReadinessMatrix({ status }: TailRiskReadinessMatrixProps) {
  return (
    <section className="tail-risk-readiness-matrix" aria-label="Tail-risk readiness matrix">
      <header>
        <h3>Tail-risk readiness</h3>
        <p>
          Active vs gated tail-risk signals. Gated entries are surfaced for visibility but do not
          affect scoring.
        </p>
      </header>
      {GROUPS.map((group) => (
        <div key={group.key} className="tail-risk-readiness-group">
          <h4 className="tail-risk-readiness-group-heading">{group.heading}</h4>
          {group.signals.map((signal) => {
            const rawStatus = statusFor(status, signal.id);
            return (
              <div key={signal.id} className="tail-risk-readiness-row">
                <span className="tail-risk-readiness-label">{signal.label}</span>
                <span
                  className={`tail-risk-readiness-badge ${badgeModifier(rawStatus)}`}
                >
                  {rawStatus}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
